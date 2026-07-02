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

const IMAGE_SNAPSHOT_DIR = path.join(process.cwd(), "seed", "oyuncular");

function getSnapshotDir() {
  const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (vol) return path.join(vol, "oyuncular");
  return IMAGE_SNAPSHOT_DIR;
}

function bootstrapVolumeSnapshots() {
  const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (!vol) return 0;
  const target = path.join(vol, "oyuncular");
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  if (!fs.existsSync(IMAGE_SNAPSHOT_DIR)) return 0;

  let n = 0;
  for (const file of fs.readdirSync(IMAGE_SNAPSHOT_DIR).filter((f) => f.endsWith(".json"))) {
    const imagePath = path.join(IMAGE_SNAPSHOT_DIR, file);
    const volPath = path.join(target, file);
    try {
      const imageSnap = JSON.parse(fs.readFileSync(imagePath, "utf8"));
      let snap = imageSnap;
      if (fs.existsSync(volPath)) {
        const existing = JSON.parse(fs.readFileSync(volPath, "utf8"));
        snap = mergeSnapshot(existing, imageSnap);
      }
      fs.writeFileSync(volPath, JSON.stringify(snap, null, 2) + "\n", "utf8");
      n++;
    } catch (err) {
      console.warn(`[persist] Volume snapshot sync ${file}:`, err.message);
    }
  }
  if (n > 0) console.log(`[persist] Volume snapshot sync: ${n} oyuncu (image -> volume)`);
  return n;
}

const PLAYER_COLS = [
  "kasa",
  "guc",
  "puan",
  "icraat",
  "devlet_iliskisi",
  "sms_hakki",
  "elmas",
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

const FLOOR_COLS = new Set(["kasa", "guc", "puan", "icraat", "sms_hakki", "elmas"]);
const RECOVERY_RATIO = 0.92;

async function playerNeedsRecovery(db, userId, snap, created) {
  if (!snap.force_restore) return false;
  if (created) return true;

  const p = await get(
    db,
    `SELECT kasa, guc, puan, icraat, sms_hakki, elmas FROM players WHERE user_id = ?`,
    [userId]
  );
  if (!p) return true;

  const sp = snap.player || {};
  for (const col of FLOOR_COLS) {
    if (sp[col] == null) continue;
    const min = Math.floor(Number(sp[col]) * RECOVERY_RATIO);
    if ((parseInt(p[col], 10) || 0) < min) return true;
  }

  const snapMekan = (snap.mekanlar || []).reduce((s, m) => s + (parseInt(m.adet, 10) || 0), 0);
  if (snapMekan > 0) {
    const row = await get(
      db,
      `SELECT COALESCE(SUM(adet), 0) AS t FROM sektor_sahiplik WHERE user_id = ?`,
      [userId]
    );
    if ((row?.t || 0) < Math.floor(snapMekan * 0.85)) return true;
  }

  if (snap.guvenli_yer?.base_seviye != null) {
    const gy = await get(db, `SELECT base_seviye FROM user_base WHERE user_id = ?`, [userId]);
    if ((gy?.base_seviye || 0) < snap.guvenli_yer.base_seviye) return true;
  }

  if (snap.sirket_kapali === true) {
    const owned = await get(db, `SELECT id FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [userId]);
    if (owned) return true;
  } else if (snap.sirket?.tur_id) {
    const owned = await get(db, `SELECT id FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [userId]);
    if (!owned) return true;
  }
  if (snap.mafya) {
    const m = await get(db, `SELECT 1 AS n FROM mafya_uyeleri WHERE user_id = ?`, [userId]);
    if (!m) return true;
  }
  if (snap.sehre_hukmet?.aktif) {
    const { sehreHukmediyorMu } = require("./karaListeService");
    if (!(await sehreHukmediyorMu(db, userId))) return true;
    if (snap.sehre_hukmet.baslangic) {
      const aktif = await get(
        db,
        `SELECT baslangic FROM sehir_hukumranlik WHERE user_id = ? AND bitis IS NULL ORDER BY id DESC LIMIT 1`,
        [userId]
      );
      const snapBas = parseInt(snap.sehre_hukmet.baslangic, 10);
      if (
        aktif &&
        !Number.isNaN(snapBas) &&
        Math.abs(Number(aktif.baslangic || 0) - snapBas) >= 3600
      ) {
        return true;
      }
    }
  }

  if (snap.meslek?.meslek_id) {
    const row = await get(db, `SELECT meslek_id FROM oyuncu_meslek WHERE user_id = ?`, [userId]);
    if (!row || row.meslek_id !== snap.meslek.meslek_id) return true;
  }

  if (snap.sirket_calisan?.pozisyon_id) {
    const row = await get(
      db,
      `SELECT pozisyon_id FROM sirket_calisanlari WHERE user_id = ?`,
      [userId]
    );
    if (!row || row.pozisyon_id !== snap.sirket_calisan.pozisyon_id) return true;
  }

  return false;
}

async function applyForceSnapshot(db, userId, snap) {
  const player = snap.player || {};
  const cur = await get(
    db,
    `SELECT puan, kasa, guc, icraat, sms_hakki, elmas FROM players WHERE user_id = ?`,
    [userId]
  );
  const sets = [];
  const vals = [];
  for (const col of PLAYER_COLS) {
    if (player[col] === undefined || player[col] === null || player[col] === "") continue;
    let val = player[col];
    if (FLOOR_COLS.has(col)) {
      const snapN = parseInt(player[col], 10);
      const curN = parseInt(cur?.[col], 10) || 0;
      if (!Number.isNaN(snapN)) val = Math.max(curN, snapN);
    }
    sets.push(`${col} = ?`);
    vals.push(val);
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
  if (snap.sirket_kapali === true) {
    await clearOwnedSirket(db, userId);
  } else {
    await applySirket(db, userId, snap.sirket);
  }
  await applyMafya(db, userId, snap.mafya);
  await applySehreHukmet(db, userId, snap.sehre_hukmet);
  await applyMeslek(db, userId, snap.meslek);
  await applySirketCalisan(db, userId, snap.sirket_calisan);
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

async function applyMeslek(db, userId, meslek) {
  if (!meslek?.meslek_id) return;
  const { ensureMeslekTables } = require("./meslekService");
  const { meslekBul } = require("./meslekCatalog");
  if (!meslekBul(meslek.meslek_id)) return;
  await ensureMeslekTables(db);
  await run(db, `DELETE FROM sirket_calisanlari WHERE user_id = ?`, [userId]);
  await run(
    db,
    `INSERT OR REPLACE INTO oyuncu_meslek (user_id, meslek_id, ise_baslama, son_gelir_gunu)
     VALUES (?, ?, ?, ?)`,
    [
      userId,
      meslek.meslek_id,
      parseInt(meslek.ise_baslama, 10) || Math.floor(Date.now() / 1000),
      meslek.son_gelir_gunu || null,
    ]
  );
}

async function applySirketCalisan(db, userId, calisan) {
  if (!calisan?.pozisyon_id) return;
  await ensureSirketTables(db);
  let sirketId = parseInt(calisan.sirket_id, 10) || null;
  if (!sirketId && calisan.sirket_sahip) {
    const owner = await get(db, `SELECT id FROM users WHERE username = ?`, [
      String(calisan.sirket_sahip).trim().toLowerCase(),
    ]);
    if (owner) {
      const sirket = await get(db, `SELECT id FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [
        owner.id,
      ]);
      sirketId = sirket?.id || null;
    }
  }
  if (!sirketId) return;
  await run(db, `DELETE FROM oyuncu_meslek WHERE user_id = ?`, [userId]);
  await run(db, `DELETE FROM sirket_calisanlari WHERE user_id = ?`, [userId]);
  await run(
    db,
    `INSERT INTO sirket_calisanlari (sirket_id, user_id, pozisyon_id, gunluk_maas)
     VALUES (?, ?, ?, ?)`,
    [sirketId, userId, calisan.pozisyon_id, parseInt(calisan.gunluk_maas, 10) || 0]
  );
}

async function clearOwnedSirket(db, userId) {
  await ensureSirketTables(db);
  const owned = await get(db, `SELECT id FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [userId]);
  if (!owned) return false;
  await run(db, `DELETE FROM sirket_stok WHERE sirket_id = ?`, [owned.id]);
  await run(db, `DELETE FROM sirket_gunluk_rapor WHERE sirket_id = ?`, [owned.id]);
  await run(db, `DELETE FROM sirket_istifa_bildirimleri WHERE sirket_id = ?`, [owned.id]);
  await run(db, `DELETE FROM sirket_calisanlari WHERE sirket_id = ?`, [owned.id]);
  await run(db, `DELETE FROM sirket_basvurulari WHERE sirket_id = ?`, [owned.id]);
  await run(db, `DELETE FROM sirket_zam_talepleri WHERE sirket_id = ?`, [owned.id]);
  await run(db, `DELETE FROM oyuncu_sirketleri WHERE id = ?`, [owned.id]);
  return true;
}

async function applySirket(db, userId, sirket) {
  if (!sirket || !sirket.tur_id) return;
  const tur = turBul(sirket.tur_id);
  if (!tur) return;

  await ensureSirketTables(db);
  await run(db, `DELETE FROM sirket_calisanlari WHERE user_id = ?`, [userId]);
  await run(db, `DELETE FROM sirket_basvurulari WHERE user_id = ?`, [userId]);
  await clearOwnedSirket(db, userId);

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

  if (snap.sirket_kapali === true) {
    const removed = await clearOwnedSirket(db, userId);
    if (removed) console.log(`[restore] Sirket kaldirildi (kapali): ${username}`);
  }

  if (snap.force_restore) {
    const need = await playerNeedsRecovery(db, userId, snap, created);
    if (need) {
      await applyForceSnapshot(db, userId, snap);
      console.log(`[restore] Kurtarma uygulandi: ${username}`);
    }
  }

  console.log(
    `[restore] ${created ? "Eklendi" : "Korundu"}: ${username} (${reisAdi}) ip=${snap.son_ip || "-"}`
  );
  return { ok: true, userId, created, username, reisAdi };
}

async function restoreOyuncuSnapshots(db) {
  if (!fs.existsSync(getSnapshotDir())) return [];
  await ensureAktiviteSchema(db);
  const files = fs
    .readdirSync(getSnapshotDir())
    .filter((f) => f.endsWith(".json"))
    .sort();
  const results = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(getSnapshotDir(), file), "utf8");
      const snap = JSON.parse(raw);
      results.push(await restoreOneSnapshot(db, snap));
    } catch (err) {
      console.warn(`[restore] ${file} yuklenemedi:`, err.message);
      results.push({ ok: false, file, error: err.message });
    }
  }
  return results;
}

function mergeSnapshot(existing, exported) {
  const out = { ...existing, ...exported, force_restore: true };
  out.player = { ...(existing.player || {}), ...(exported.player || {}) };
  for (const col of FLOOR_COLS) {
    const a = parseInt(existing.player?.[col], 10);
    const b = parseInt(exported.player?.[col], 10);
    if (!Number.isNaN(a) || !Number.isNaN(b)) {
      out.player[col] = Math.max(Number.isNaN(a) ? 0 : a, Number.isNaN(b) ? 0 : b);
    }
  }
  out.guvenli_yer = { ...(existing.guvenli_yer || {}), ...(exported.guvenli_yer || {}) };
  out.istihbarat = { ...(existing.istihbarat || {}), ...(exported.istihbarat || {}) };
  if (exported.sirket_kapali === true) {
    delete out.sirket;
    out.sirket_kapali = true;
  } else if (exported.sirket) {
    out.sirket = exported.sirket;
    delete out.sirket_kapali;
  } else if (exported.sirket_kapali === false) {
    delete out.sirket_kapali;
  }
  if (exported.mafya) out.mafya = exported.mafya;
  else if (!out.mafya && existing.mafya) out.mafya = existing.mafya;
  if (exported.meslek) out.meslek = exported.meslek;
  else if (existing.meslek) out.meslek = existing.meslek;
  if (exported.sirket_calisan) out.sirket_calisan = exported.sirket_calisan;
  else if (existing.sirket_calisan) out.sirket_calisan = existing.sirket_calisan;
  if (exported.sehre_hukmet) {
    if (exported.sehre_hukmet.aktif === false) delete out.sehre_hukmet;
    else out.sehre_hukmet = exported.sehre_hukmet;
  } else if (!out.sehre_hukmet && existing.sehre_hukmet) out.sehre_hukmet = existing.sehre_hukmet;
  if (exported.yetenekler) out.yetenekler = exported.yetenekler;
  else if (!out.yetenekler && existing.yetenekler) out.yetenekler = existing.yetenekler;
  if (exported.mekanlar?.length) out.mekanlar = exported.mekanlar;
  else if (existing.mekanlar) out.mekanlar = existing.mekanlar;
  return out;
}

function mapSehreHukmetForSeed(full) {
  const limanlar = (full.limanlar || [])
    .map((l) => l.limanId || l.liman_id)
    .filter(Boolean);
  const makamlar = (full.babaMakamlari || [])
    .map((m) => m.makam)
    .filter(Boolean);
  const aktifHukum = (full.sehirHukumranliklar || []).find((h) => !h.bitis);
  const meta = full.sehirMeta || {};
  const st = full.istatistikler || {};
  if (!aktifHukum && !st.karaListede && !limanlar.length && !makamlar.length) {
    return { aktif: false };
  }
  const baslangic = aktifHukum?.baslangic
    ? Math.floor(new Date(aktifHukum.baslangic).getTime() / 1000)
    : undefined;
  return {
    aktif: !!(aktifHukum || st.karaListede),
    baslangic,
    sehre_hukmet_sayisi: meta.sehreHukmetSayisi || st.sehreHukmetSayisi || 1,
    limanlar: limanlar.length ? limanlar : undefined,
    makamlar: makamlar.length ? makamlar : undefined,
  };
}

function mapSirketForSeed(full) {
  const row = full._seedSirket || full.sahipSirket;
  if (!row) return null;
  const panel = full.sirketPanel?.yonetim;
  const stokRows = row.stok || panel?.stok || [];
  return {
    tur_id: row.tur_id || row.turId,
    isim: row.isim,
    aciklama: String(row.aciklama || panel?.aciklama || "").slice(0, 280),
    kasa: parseInt(row.kasa, 10) || 0,
    ise_alim_acik: row.ise_alim_acik === 0 || row.iseAlimAcik === false ? 0 : 1,
    kapasite_seviye: parseInt(row.kapasite_seviye ?? panel?.kapasiteSeviye, 10) || 0,
    depo_seviye: parseInt(row.depo_seviye ?? panel?.depoSeviye, 10) || 0,
    personel_odasi_seviye: parseInt(row.personel_odasi_seviye ?? panel?.personelOdasiSeviye, 10) || 0,
    reklam_seviye: parseInt(row.reklam_seviye ?? panel?.reklamSeviye, 10) || 0,
    fiyat_carpani: Number(row.fiyat_carpani ?? panel?.fiyatCarpani) || 1,
    yildiz: parseInt(row.yildiz ?? panel?.yildiz, 10) || 0,
    populerlik: parseInt(row.populerlik ?? panel?.populerlik, 10) || 0,
    stok: stokRows
      .map((s) => ({
        malzeme_id: s.malzeme_id || s.id,
        miktar: Math.floor(Number(s.miktar) || 0),
      }))
      .filter((s) => s.malzeme_id),
  };
}

function mapMafyaForSeed(full) {
  if (full._seedMafya) return full._seedMafya;
  if (!full.mafyaUyelik) return null;
  return { grup_id: full.mafyaUyelik.grupId, rutbe: full.mafyaUyelik.rutbe || "Mafya Üyesi" };
}

function mapYeteneklerForSeed(full) {
  const yt = full._seedYetenekler || full.yetenekler;
  if (!yt || typeof yt !== "object") return null;
  return {
    guc: yt.guc ?? yt.yetenek_guc,
    zeka: yt.zeka ?? yt.yetenek_zeka,
    dayaniklilik: yt.dayaniklilik ?? yt.yetenek_dayaniklilik,
    beceri: yt.beceri ?? yt.yetenek_beceri,
  };
}

function mapMeslekForSeed(full) {
  if (full._seedMeslek) {
    return {
      meslek_id: full._seedMeslek.meslek_id,
      ise_baslama: full._seedMeslek.ise_baslama,
      son_gelir_gunu: full._seedMeslek.son_gelir_gunu,
    };
  }
  const m = full.aktifMeslek;
  if (!m?.id) return null;
  return {
    meslek_id: m.id,
    ise_baslama: m.iseBaslama,
    son_gelir_gunu: m.sonGelirGunu,
  };
}

function mapSirketCalisanForSeed(full) {
  if (full._seedSirketCalisan) {
    const c = full._seedSirketCalisan;
    return {
      sirket_sahip: c.sirket_sahip,
      pozisyon_id: c.pozisyon_id,
      gunluk_maas: c.gunluk_maas,
    };
  }
  const c = full.sirketCalisan;
  if (!c?.pozisyon_id) return null;
  return {
    pozisyon_id: c.pozisyon_id,
    gunluk_maas: c.gunluk_maas,
  };
}

async function enrichExportForSeed(db, userId, full) {
  const { yetenekleriGetir } = require("./meslekService");
  const sirket = await get(db, `SELECT * FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [userId]);
  if (sirket) {
    const stok = await all(db, `SELECT malzeme_id, miktar FROM sirket_stok WHERE sirket_id = ?`, [
      sirket.id,
    ]);
    full._seedSirket = { ...sirket, stok };
  }
  const lider = await get(
    db,
    `SELECT isim, aciklama, created_at FROM mafya_gruplari WHERE lider_user_id = ?`,
    [userId]
  );
  const uyelik = await get(
    db,
    `SELECT mu.grup_id, mu.rutbe, mg.isim
     FROM mafya_uyeleri mu
     JOIN mafya_gruplari mg ON mg.id = mu.grup_id
     WHERE mu.user_id = ?`,
    [userId]
  );
  if (lider) {
    full._seedMafya = {
      lider: true,
      isim: lider.isim,
      aciklama: lider.aciklama || "",
      rutbe: uyelik?.rutbe || "Mafya Lideri",
      created_at: lider.created_at,
    };
  } else if (uyelik) {
    full._seedMafya = { grup_id: uyelik.grup_id, rutbe: uyelik.rutbe || "Mafya Üyesi" };
  }
  const yt = await yetenekleriGetir(db, userId);
  if (yt) full._seedYetenekler = yt;
  const extra = await get(
    db,
    `SELECT sehre_hukmet_sayisi, liman_istanbul, dostlar, dusmanlar, aktif_ekran,
            son_aksiyon, son_aksiyon_detay, sehir_efsane
     FROM players WHERE user_id = ?`,
    [userId]
  );
  if (extra) full._seedPlayerExtra = extra;
  const meslekRow = await get(
    db,
    `SELECT meslek_id, ise_baslama, son_gelir_gunu FROM oyuncu_meslek WHERE user_id = ?`,
    [userId]
  );
  if (meslekRow) full._seedMeslek = meslekRow;
  const calisanRow = await get(
    db,
    `SELECT c.sirket_id, c.pozisyon_id, c.gunluk_maas, su.username AS sirket_sahip
     FROM sirket_calisanlari c
     JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
     JOIN users su ON su.id = s.sahip_user_id
     WHERE c.user_id = ?`,
    [userId]
  );
  if (calisanRow) full._seedSirketCalisan = calisanRow;
  return full;
}

function mapExportToSeed(full) {
  const k = full.kullanici || {};
  const st = full.istatistikler || {};
  const gy = full.guvenliYer || {};
  const px = full._seedPlayerExtra || {};
  const out = {
    id: k.username || String(full.oyuncuId || ""),
    username: k.username,
    reis_adi: k.reisAdi || k.username,
    lakap: k.lakap || "Mafya",
    force_restore: true,
    player: {
      kasa: st.kasa,
      guc: st.guc,
      puan: st.puan,
      icraat: st.icraat,
      sms_hakki: st.smsHakki,
      elmas: st.elmas,
      profil_resmi: st.profilResmi,
      profil_aciklama: st.profilAciklama,
      devlet_iliskisi: st.devletIliskisi,
      kara_listede: st.karaListede ? 1 : 0,
      sehir_efsane: px.sehir_efsane != null ? px.sehir_efsane : st.sehirEfsane ? 1 : 0,
      sehre_hukmet_sayisi: px.sehre_hukmet_sayisi,
      liman_istanbul: px.liman_istanbul,
      dostlar: px.dostlar,
      dusmanlar: px.dusmanlar,
      aktif_ekran: px.aktif_ekran,
      son_aksiyon: px.son_aksiyon,
      son_aksiyon_detay: px.son_aksiyon_detay,
    },
    guvenli_yer: { base_seviye: gy.baseSeviye != null ? gy.baseSeviye : 1 },
    istihbarat: { eleman_sayisi: full.istihbaratEleman != null ? full.istihbaratEleman : 0 },
    mekanlar: (full.mekanlar || []).map((m) => ({
      sektor: m.sektor,
      mekan_key: m.mekanKey || m.mekan_key,
      adet: m.adet != null ? m.adet : 0,
    })),
    son_ip: k.sonIp || undefined,
    visitor_id: k.visitorId || undefined,
    user_agent: k.userAgent || undefined,
    sirket_kapali: !full.sahipSirket && !full._seedSirket,
  };
  const sehreHukmet = mapSehreHukmetForSeed(full);
  if (sehreHukmet) {
    if (sehreHukmet.aktif === false) out.sehre_hukmet_kapali = true;
    else out.sehre_hukmet = sehreHukmet;
  }
  const sirket = mapSirketForSeed(full);
  if (sirket) out.sirket = sirket;
  const mafya = mapMafyaForSeed(full);
  if (mafya) out.mafya = mafya;
  const yetenekler = mapYeteneklerForSeed(full);
  if (yetenekler) out.yetenekler = yetenekler;
  const meslek = mapMeslekForSeed(full);
  if (meslek) out.meslek = meslek;
  const sirketCalisan = mapSirketCalisanForSeed(full);
  if (sirketCalisan) out.sirket_calisan = sirketCalisan;
  return out;
}

async function enforceLiveSnapshotPolicies(db) {
  if (!fs.existsSync(getSnapshotDir())) return [];
  const files = fs
    .readdirSync(getSnapshotDir())
    .filter((f) => f.endsWith(".json"))
    .sort();
  const results = [];
  for (const file of files) {
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(getSnapshotDir(), file), "utf8"));
      const userId = await findSnapshotUser(db, snap);
      if (!userId) continue;

      if (snap.sirket_kapali === true) {
        const removed = await clearOwnedSirket(db, userId);
        if (removed) {
          console.log(`[restore] Guvenlik: sirket_kapali uygulandi (${snap.username})`);
          results.push({ username: snap.username, sirketRemoved: true });
        }
      }

      if (!snap.force_restore) continue;

      if (snap.sehre_hukmet?.aktif && snap.sehre_hukmet.baslangic) {
        const { syncAktifHukumBaslangic } = require("./saygiDuvariService");
        const synced = await syncAktifHukumBaslangic(
          db,
          userId,
          parseInt(snap.sehre_hukmet.baslangic, 10)
        );
        if (synced) {
          console.log(`[restore] Hukum baslangic senkron: ${snap.username}`);
          results.push({ username: snap.username, hukumBaslangicSynced: true });
        }
      }

      const need = await playerNeedsRecovery(db, userId, snap, false);
      if (!need) continue;

      await applyForceSnapshot(db, userId, snap);
      console.log(`[restore] Canli DB kurtarma: ${snap.username}`);
      results.push({ username: snap.username, recovered: true });
    } catch (err) {
      console.warn(`[restore] canli politika ${file}:`, err.message);
      results.push({ file, error: err.message });
    }
  }
  return results;
}

async function updatePlayerSeedSnapshot(db, userId, { merge = true } = {}) {
  const user = await get(db, `SELECT username FROM users WHERE id = ?`, [userId]);
  if (!user?.username) return false;
  const { exportPlayerSnapshot } = require("./adminService");
  let full = await exportPlayerSnapshot(db, userId);
  if (!full) return false;
  full = await enrichExportForSeed(db, userId, full);
  const exported = mapExportToSeed(full);
  const dir = getSnapshotDir();
  const file = path.join(dir, `${user.username}.json`);
  let snap = exported;
  if (merge && fs.existsSync(file)) {
    try {
      const existing = JSON.parse(fs.readFileSync(file, "utf8"));
      snap = mergeSnapshot(existing, exported);
    } catch (_) {}
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snap, null, 2) + "\n", "utf8");
  return true;
}

async function exportSnapshotsToSeed(db, { merge = true } = {}) {
  const { exportPlayerSnapshot } = require("./adminService");
  const users = await all(db, `SELECT id, username FROM users ORDER BY id`);
  const dir = getSnapshotDir();
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const u of users) {
    let full = await exportPlayerSnapshot(db, u.id);
    if (!full) continue;
    full = await enrichExportForSeed(db, u.id, full);
    const exported = mapExportToSeed(full);
    const file = path.join(dir, `${u.username}.json`);
    let snap = exported;
    if (merge && fs.existsSync(file)) {
      try {
        const existing = JSON.parse(fs.readFileSync(file, "utf8"));
        snap = mergeSnapshot(existing, exported);
      } catch (_) {}
    }
    fs.writeFileSync(file, JSON.stringify(snap, null, 2) + "\n", "utf8");
    n++;
  }
  return n;
}

module.exports = {
  restoreOyuncuSnapshots,
  restoreOneSnapshot,
  applyForceSnapshot,
  applySirket,
  clearOwnedSirket,
  applyMafya,
  exportSnapshotsToSeed,
  enforceLiveSnapshotPolicies,
  enforceSnapshotSafetyFlags: enforceLiveSnapshotPolicies,
  updatePlayerSeedSnapshot,
  enrichExportForSeed,
  bootstrapVolumeSnapshots,
  getSnapshotDir,
  playerNeedsRecovery,
};
