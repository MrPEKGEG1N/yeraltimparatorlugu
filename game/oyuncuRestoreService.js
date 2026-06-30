const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { run, get, all } = require("../db/database");
const { rastgeleProfilResmi } = require("./profilPortreler");
const { ensureAktiviteSchema } = require("./aktiviteService");
const { adminSeviyeAyarla } = require("./guvenliYerService");
const { syncBonusGuc } = require("./bonusGucService");
const { MEKANLAR, SECTOR_KEYS } = require("./sectorsCatalog");
const { ensureSirketTables } = require("./sirketService");
const { turBul } = require("./sirketCatalog");
const { ensureEvi } = require("./mafyaEviService");
const { ensureWorldRows } = require("./worldService");
const { LIMAN_IDS, BABA_MAKAMLAR } = require("./worldConstants");
const { ensureSaygiTables, hukumdarligiBitir } = require("./saygiDuvariService");

const SNAPSHOT_DIR = path.join(process.cwd(), "seed", "oyuncular");

const PLAYER_COLS = [
  "kasa",
  "guc",
  "puan",
  "icraat",
  "devlet_iliskisi",
  "sms_hakki",
  "profil_aciklama",
  "profil_resmi",
  "aktif_ekran",
  "son_aksiyon",
  "son_aksiyon_detay",
  "son_aksiyon_at",
  "last_seen_at",
  "bonus_guc",
  "kara_listede",
  "sehir_efsane",
];

async function findSnapshotUser(db, snap) {
  const username = String(snap.username || "").trim().toLowerCase();
  if (username) {
    const byUser = await get(db, `SELECT id FROM users WHERE username = ?`, [username]);
    if (byUser) return byUser.id;
  }
  const reis = String(snap.reis_adi || "").trim();
  const ip = String(snap.son_ip || "").trim();
  if (reis && ip) {
    const byReisIp = await get(
      db,
      `SELECT id FROM users WHERE reis_adi = ? COLLATE NOCASE AND son_ip = ?`,
      [reis, ip]
    );
    if (byReisIp) return byReisIp.id;
  }
  if (reis) {
    const byReis = await get(db, `SELECT id FROM users WHERE reis_adi = ? COLLATE NOCASE`, [reis]);
    if (byReis) return byReis.id;
  }
  return null;
}

async function upsertFingerprint(db, userId, fp) {
  const visitorId = String(fp.visitor_id || "").trim();
  const sonIp = String(fp.son_ip || "").trim();
  if (!visitorId && !sonIp) return;
  const now = Math.floor(Date.now() / 1000);
  const first = fp.first_seen || now;
  const last = fp.last_seen || now;
  const ua = String(fp.user_agent || "").slice(0, 500);
  await run(
    db,
    `INSERT INTO user_fingerprints (user_id, visitor_id, son_ip, user_agent, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, visitor_id, son_ip) DO UPDATE SET
       user_agent = excluded.user_agent,
       last_seen = excluded.last_seen`,
    [userId, visitorId, sonIp, ua, first, last]
  );
}

async function applyMekanlar(db, userId, mekanlar) {
  if (!Array.isArray(mekanlar) || !mekanlar.length) return;
  const gecerli = new Set();
  for (const sektor of SECTOR_KEYS) {
    for (const mekanKey of Object.keys(MEKANLAR[sektor] || {})) {
      gecerli.add(`${sektor}:${mekanKey}`);
    }
  }
  for (const item of mekanlar) {
    const sektor = String(item.sektor || "").trim();
    const mekanKey = String(item.mekan_key || item.mekanKey || "").trim();
    const key = `${sektor}:${mekanKey}`;
    if (!gecerli.has(key)) continue;
    const adet = parseInt(item.adet, 10);
    if (Number.isNaN(adet) || adet < 0) continue;
    if (adet === 0) {
      await run(
        db,
        `DELETE FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
        [userId, sektor, mekanKey]
      );
    } else {
      const row = await get(
        db,
        `SELECT adet FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
        [userId, sektor, mekanKey]
      );
      if (row) {
        await run(
          db,
          `UPDATE sektor_sahiplik SET adet = ? WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
          [adet, userId, sektor, mekanKey]
        );
      } else {
        await run(
          db,
          `INSERT INTO sektor_sahiplik (user_id, sektor, mekan_key, adet, last_income_hour)
           VALUES (?, ?, ?, ?, NULL)`,
          [userId, sektor, mekanKey, adet]
        );
      }
    }
  }
}

async function applyForceSnapshot(db, userId, snap) {
  const player = snap.player || {};
  const sets = [];
  const vals = [];
  for (const col of PLAYER_COLS) {
    if (player[col] !== undefined && player[col] !== null && player[col] !== "") {
      sets.push(`${col} = ?`);
      vals.push(player[col]);
    }
  }
  if (sets.length) {
    vals.push(userId);
    await run(db, `UPDATE players SET ${sets.join(", ")} WHERE user_id = ?`, vals);
  }

  if (snap.guvenli_yer && snap.guvenli_yer.base_seviye != null) {
    await adminSeviyeAyarla(db, userId, snap.guvenli_yer.base_seviye);
  } else {
    await syncBonusGuc(db, userId);
  }

  if (snap.istihbarat && snap.istihbarat.eleman_sayisi != null) {
    const n = parseInt(snap.istihbarat.eleman_sayisi, 10);
    if (!Number.isNaN(n) && n >= 0) {
      await run(db, `INSERT OR REPLACE INTO istihbarat (user_id, eleman_sayisi) VALUES (?, ?)`, [
        userId,
        n,
      ]);
    }
  }

  await applyMekanlar(db, userId, snap.mekanlar);
  await applyYetenekler(db, userId, snap.yetenekler);
  await applySirket(db, userId, snap.sirket);
  await applyMafya(db, userId, snap.mafya);
  await applySehreHukmet(db, userId, snap.sehre_hukmet);
}

async function applySehreHukmet(db, userId, cfg) {
  if (!cfg || cfg.aktif === false) return;
  await ensureWorldRows(db);
  await ensureSaygiTables(db);

  const limanlar = Array.isArray(cfg.limanlar) && cfg.limanlar.length ? cfg.limanlar : LIMAN_IDS;
  const makamlar = Array.isArray(cfg.makamlar) && cfg.makamlar.length ? cfg.makamlar : BABA_MAKAMLAR;

  for (const limanId of limanlar) {
    await run(db, `UPDATE liman_sahiplik SET owner_user_id = ?, last_income_hour = NULL WHERE liman_id = ?`, [
      userId,
      limanId,
    ]);
  }
  for (const makam of makamlar) {
    await run(db, `UPDATE baba_makamlari SET owner_user_id = ? WHERE makam = ?`, [userId, makam]);
  }

  const eskiKara = await all(db, `SELECT user_id FROM players WHERE kara_listede = 1 AND user_id <> ?`, [userId]);
  for (const eski of eskiKara) {
    await hukumdarligiBitir(db, eski.user_id);
    await run(db, `UPDATE players SET kara_listede = 0, sehir_efsane = 0 WHERE user_id = ?`, [eski.user_id]);
  }

  const digerAktif = await all(
    db,
    `SELECT user_id FROM sehir_hukumranlik WHERE bitis IS NULL AND user_id <> ?`,
    [userId]
  );
  for (const d of digerAktif) {
    await hukumdarligiBitir(db, d.user_id);
  }

  const baslangic = parseInt(cfg.baslangic, 10) || Math.floor(Date.now() / 1000);
  const sayac = parseInt(cfg.sehre_hukmet_sayisi, 10);
  const hukmetSayisi = Number.isNaN(sayac) ? 1 : Math.max(1, sayac);

  await run(
    db,
    `UPDATE players SET kara_listede = 1, sehir_efsane = 1, sehre_hukmet_sayisi = ?, liman_istanbul = ? WHERE user_id = ?`,
    [hukmetSayisi, limanlar.includes("istanbul") ? 1 : 0, userId]
  );

  const oncekiId = parseInt(cfg.onceki_user_id, 10) || eskiKara[0]?.user_id || null;
  const mevcutAktif = await get(
    db,
    `SELECT id FROM sehir_hukumranlik WHERE user_id = ? AND bitis IS NULL ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  if (mevcutAktif) {
    await run(db, `UPDATE sehir_hukumranlik SET baslangic = ?, onceki_user_id = ? WHERE id = ?`, [
      baslangic,
      oncekiId,
      mevcutAktif.id,
    ]);
    await run(db, `UPDATE players SET aktif_hukumranlik_id = ? WHERE user_id = ?`, [mevcutAktif.id, userId]);
  } else {
    const ins = await run(
      db,
      `INSERT INTO sehir_hukumranlik (user_id, baslangic, onceki_user_id) VALUES (?, ?, ?)`,
      [userId, baslangic, oncekiId]
    );
    await run(db, `UPDATE players SET aktif_hukumranlik_id = ? WHERE user_id = ?`, [ins.lastID, userId]);
  }
}

async function applyYetenekler(db, userId, yetenekler) {
  if (!yetenekler || typeof yetenekler !== "object") return;
  const cols = ["guc", "zeka", "dayaniklilik", "beceri"];
  const sets = [];
  const vals = [];
  for (const col of cols) {
    if (yetenekler[col] == null) continue;
    const n = parseInt(yetenekler[col], 10);
    if (Number.isNaN(n) || n < 0) continue;
    sets.push(`yetenek_${col} = ?`);
    vals.push(n);
  }
  if (!sets.length) return;
  vals.push(userId);
  await run(db, `UPDATE players SET ${sets.join(", ")} WHERE user_id = ?`, vals);
}

async function applySirket(db, userId, sirket) {
  if (!sirket || !sirket.tur_id) return;
  const tur = turBul(sirket.tur_id);
  if (!tur) return;

  await ensureSirketTables(db);
  await run(db, `DELETE FROM sirket_calisanlari WHERE user_id = ?`, [userId]);
  await run(db, `DELETE FROM sirket_basvurulari WHERE user_id = ?`, [userId]);

  const owned = await get(db, `SELECT id FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [userId]);
  if (owned) {
    await run(db, `DELETE FROM sirket_stok WHERE sirket_id = ?`, [owned.id]);
    await run(db, `DELETE FROM sirket_gunluk_rapor WHERE sirket_id = ?`, [owned.id]);
    await run(db, `DELETE FROM sirket_istifa_bildirimleri WHERE sirket_id = ?`, [owned.id]);
    await run(db, `DELETE FROM oyuncu_sirketleri WHERE id = ?`, [owned.id]);
  }

  const isim = String(sirket.isim || `${tur.ad}`).trim().slice(0, 48);
  const aciklama = String(sirket.aciklama || "").slice(0, 280);
  const ins = await run(
    db,
    `INSERT INTO oyuncu_sirketleri
      (sahip_user_id, tur_id, isim, aciklama, kasa, ise_alim_acik, son_gelir_gunu,
       kapasite_seviye, depo_seviye, personel_odasi_seviye, reklam_seviye, fiyat_carpani,
       yildiz, populerlik, son_egitim_gunu, egitim_slot_kullanim)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      tur.id,
      isim,
      aciklama,
      parseInt(sirket.kasa, 10) || 0,
      sirket.ise_alim_acik === false || sirket.ise_alim_acik === 0 ? 0 : 1,
      sirket.son_gelir_gunu || null,
      parseInt(sirket.kapasite_seviye, 10) || 0,
      parseInt(sirket.depo_seviye, 10) || 0,
      parseInt(sirket.personel_odasi_seviye, 10) || 0,
      parseInt(sirket.reklam_seviye, 10) || 0,
      Number(sirket.fiyat_carpani) || 1,
      parseInt(sirket.yildiz, 10) || 0,
      parseInt(sirket.populerlik, 10) || 0,
      sirket.son_egitim_gunu || null,
      parseInt(sirket.egitim_slot_kullanim, 10) || 0,
    ]
  );

  const sirketId = ins.lastID;
  const stok = Array.isArray(sirket.stok) ? sirket.stok : [];
  const stokMap = new Map(stok.map((s) => [s.malzeme_id, Number(s.miktar) || 0]));
  for (const m of tur.malzemeler || []) {
    const miktar = stokMap.has(m.id) ? stokMap.get(m.id) : 0;
    await run(
      db,
      `INSERT INTO sirket_stok (sirket_id, malzeme_id, miktar) VALUES (?, ?, ?)`,
      [sirketId, m.id, miktar]
    );
  }
}

async function applyMafya(db, userId, mafya) {
  if (!mafya) return;
  await run(db, `DELETE FROM mafya_basvurulari WHERE user_id = ?`, [userId]);
  await run(db, `DELETE FROM mafya_uyeleri WHERE user_id = ?`, [userId]);

  if (mafya.lider && mafya.isim) {
    const temizIsim = String(mafya.isim).trim().slice(0, 32);
    const aciklama = String(mafya.aciklama || "").slice(0, 280);
    const mevcut = await get(db, `SELECT id FROM mafya_gruplari WHERE LOWER(isim) = LOWER(?)`, [
      temizIsim,
    ]);
    let grupId;
    if (mevcut) {
      grupId = mevcut.id;
      await run(
        db,
        `UPDATE mafya_gruplari SET lider_user_id = ?, aciklama = ? WHERE id = ?`,
        [userId, aciklama, grupId]
      );
    } else {
      const ins = await run(
        db,
        `INSERT INTO mafya_gruplari (isim, aciklama, lider_user_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [temizIsim, aciklama, userId, mafya.created_at || Math.floor(Date.now() / 1000)]
      );
      grupId = ins.lastID;
    }
    await ensureEvi(db, grupId);
    await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, ?)`, [
      grupId,
      userId,
      mafya.rutbe || "Mafya Lideri",
    ]);
    await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [temizIsim, userId]);
    await syncBonusGuc(db, userId);
    return;
  }

  const grupId = parseInt(mafya.grup_id, 10);
  if (!grupId) {
    await run(db, `UPDATE users SET grup = '' WHERE id = ?`, [userId]);
    await syncBonusGuc(db, userId);
    return;
  }

  const grup = await get(db, `SELECT id, isim FROM mafya_gruplari WHERE id = ?`, [grupId]);
  if (!grup) return;

  await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, ?)`, [
    grupId,
    userId,
    mafya.rutbe || "Mafya Üyesi",
  ]);
  await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [grup.isim, userId]);
  await syncBonusGuc(db, userId);
}

async function restoreAktiviteLog(db, userId, logs) {
  if (!Array.isArray(logs) || !logs.length) return;
  const mevcut = await get(
    db,
    `SELECT COUNT(*) AS n FROM oyuncu_aktivite_log WHERE user_id = ?`,
    [userId]
  );
  if ((mevcut?.n || 0) > 0) return;
  for (const row of logs) {
    await run(
      db,
      `INSERT INTO oyuncu_aktivite_log (user_id, ekran, aksiyon, detay, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        String(row.ekran || "").slice(0, 80),
        String(row.aksiyon || "").slice(0, 80),
        String(row.detay || "").slice(0, 200),
        row.created_at || Math.floor(Date.now() / 1000),
      ]
    );
  }
}

async function restoreSecurityEvents(db, userId, events) {
  if (!Array.isArray(events) || !events.length) return;
  for (const ev of events) {
    const exists = await get(
      db,
      `SELECT id FROM security_events
       WHERE user_id = ? AND event_type = ? AND ip = ? AND created_at = ?`,
      [userId, ev.event_type, ev.ip || "", ev.created_at || 0]
    );
    if (exists) continue;
    await run(
      db,
      `INSERT INTO security_events (user_id, event_type, detail, ip, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        String(ev.event_type || "restore"),
        String(ev.detail || "").slice(0, 500),
        String(ev.ip || "").slice(0, 64),
        ev.created_at || Math.floor(Date.now() / 1000),
      ]
    );
  }
}

async function restoreOneSnapshot(db, snap) {
  const username = String(snap.username || "").trim().toLowerCase();
  const reisAdi = String(snap.reis_adi || username || "").trim();
  if (!username || !reisAdi) return { ok: false, reason: "eksik kimlik" };

  let userId = await findSnapshotUser(db, snap);
  let created = false;

  if (!userId) {
    let passwordHash = snap.password_hash;
    if (!passwordHash && snap.restore_password) {
      passwordHash = await bcrypt.hash(String(snap.restore_password), 10);
    }
    if (!passwordHash) return { ok: false, reason: "sifre yok" };

    const result = await run(
      db,
      `INSERT INTO users (username, password_hash, reis_adi, lakap, son_ip, visitor_id, user_agent, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        passwordHash,
        reisAdi,
        snap.lakap || "Mafya",
        snap.son_ip || "",
        snap.visitor_id || "",
        snap.user_agent || "",
        snap.created_at || Math.floor(Date.now() / 1000),
        snap.last_login_at || 0,
      ]
    );
    userId = result.lastID;
    created = true;

    const portre = snap.player?.profil_resmi || rastgeleProfilResmi();
    await run(db, `INSERT INTO players (user_id, profil_resmi) VALUES (?, ?)`, [userId, portre]);
  } else {
    await run(
      db,
      `UPDATE users SET
         reis_adi = ?,
         lakap = COALESCE(?, lakap),
         son_ip = CASE WHEN ? != '' THEN ? ELSE son_ip END,
         visitor_id = CASE WHEN ? != '' THEN ? ELSE visitor_id END,
         user_agent = CASE WHEN ? != '' THEN ? ELSE user_agent END,
         last_login_at = MAX(COALESCE(last_login_at, 0), ?)
       WHERE id = ?`,
      [
        reisAdi,
        snap.lakap || null,
        snap.son_ip || "",
        snap.son_ip || "",
        snap.visitor_id || "",
        snap.visitor_id || "",
        snap.user_agent || "",
        snap.user_agent || "",
        snap.last_login_at || 0,
        userId,
      ]
    );
  }

  const player = snap.player || {};
  if (created) {
    const sets = [];
    const vals = [];
    for (const col of PLAYER_COLS) {
      if (player[col] !== undefined && player[col] !== null && player[col] !== "") {
        sets.push(`${col} = ?`);
        vals.push(player[col]);
      }
    }
    if (sets.length) {
      vals.push(userId);
      await run(db, `UPDATE players SET ${sets.join(", ")} WHERE user_id = ?`, vals);
    }
  }

  const fps = Array.isArray(snap.fingerprints) ? snap.fingerprints : [];
  if (snap.visitor_id || snap.son_ip) {
    fps.unshift({
      visitor_id: snap.visitor_id || "",
      son_ip: snap.son_ip || "",
      user_agent: snap.user_agent || "",
      first_seen: snap.created_at,
      last_seen: snap.last_login_at || snap.created_at,
    });
  }
  for (const fp of fps) await upsertFingerprint(db, userId, fp);

  await restoreAktiviteLog(db, userId, snap.aktivite_log);
  await restoreSecurityEvents(db, userId, snap.security_events);

  if (snap.force_restore) {
    await applyForceSnapshot(db, userId, snap);
    console.log(`[restore] Zorunlu guncelleme: ${username}`);
  }

  console.log(
    `[restore] ${created ? "Eklendi" : "Korundu"}: ${username} (${reisAdi}) ip=${snap.son_ip || "-"}`
  );
  return { ok: true, userId, created, username, reisAdi };
}

async function restoreOyuncuSnapshots(db) {
  if (!fs.existsSync(SNAPSHOT_DIR)) return [];
  await ensureAktiviteSchema(db);
  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const results = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SNAPSHOT_DIR, file), "utf8");
      const snap = JSON.parse(raw);
      results.push(await restoreOneSnapshot(db, snap));
    } catch (err) {
      console.warn(`[restore] ${file} yuklenemedi:`, err.message);
      results.push({ ok: false, file, error: err.message });
    }
  }
  return results;
}

module.exports = { restoreOyuncuSnapshots, restoreOneSnapshot, applyForceSnapshot, applySirket, applyMafya };
