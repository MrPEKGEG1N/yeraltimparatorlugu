const crypto = require("crypto");
const { run, get, all } = require("../db/database");
const { chipGetir, chipGuncelle, logEkle, ensureKumarhaneTables } = require("./kumarhaneService");
const { turkeyNowParts, gunKeyEkle } = require("./turkiyeSaati");

const SAYI_MAX = 25;
const SECIM_SAYISI = 6;
const BILET_UCRET = 100_000;
const BILET_ELMAS_MALIYET = 2;
const HAVUZ_ODUL_ORANI = 0.9;
const MAX_BILET_KULLANICI = 5;
const CEKILIS_GUNLER = [1, 3, 5];
const CEKILIS_SAAT = 20;
const CEKILIS_DAKIKA = 30;
const CEKILIS_PENCERE_DK = 5;
const TESELLI_SON_3_HAK = 2;
const TESELLI_SON_2_HAK = 1;

function havuzOdulHesapla(biletAdet) {
  const havuzToplam = Math.max(0, biletAdet) * BILET_UCRET;
  const buyukOdul = Math.floor(havuzToplam * HAVUZ_ODUL_ORANI);
  return { havuzToplam, buyukOdul };
}

async function jackpotBirikimGetir(db) {
  await ensurePiyangoTables(db);
  const row = await get(db, `SELECT jackpot_birikim FROM kumarhane_piyango_meta WHERE id = 1`);
  return row?.jackpot_birikim || 0;
}

async function jackpotBirikimAyarla(db, miktar) {
  await ensurePiyangoTables(db);
  const val = Math.max(0, Math.floor(miktar || 0));
  await run(
    db,
    `INSERT INTO kumarhane_piyango_meta (id, jackpot_birikim) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET jackpot_birikim = ?`,
    [val, val]
  );
  return val;
}

async function buyukOdulToplam(db, cekilisId) {
  const ucretli = await get(
    db,
    `SELECT COUNT(*) AS n FROM kumarhane_piyango_bilet WHERE cekilis_id = ? AND ucretsiz = 0`,
    [cekilisId]
  );
  const { havuzToplam, buyukOdul: donemOdul } = havuzOdulHesapla(ucretli?.n || 0);
  const devreden = await jackpotBirikimGetir(db);
  return {
    devreden,
    donemHavuz: havuzToplam,
    donemOdul,
    buyukOdul: devreden + donemOdul,
    havuzToplam: devreden + havuzToplam,
  };
}

function piyangoAktifMi() {
  return process.env.NODE_ENV !== "production" || process.env.KUMARHANE_PIYANGO === "1";
}

function istanbulWeekday(tarih) {
  const str = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(tarih || new Date());
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[str] ?? 0;
}

function weekdayFromDayKey(dayKey) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  return istanbulWeekday(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

function donemKeyFromDay(dayKey) {
  return `${dayKey}T${String(CEKILIS_SAAT).padStart(2, "0")}${String(CEKILIS_DAKIKA).padStart(2, "0")}`;
}

function parseDonemAnahtari(donem) {
  const m = String(donem || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}T${m[2]}:${m[3]}:00+03:00`).getTime();
}

function sonrakiCekilisZamani(from = new Date()) {
  const parts = turkeyNowParts(from);
  for (let g = 0; g < 21; g++) {
    const dayKey = gunKeyEkle(parts.dayKey, g);
    if (!CEKILIS_GUNLER.includes(weekdayFromDayKey(dayKey))) continue;
    const donem = donemKeyFromDay(dayKey);
    const ms = parseDonemAnahtari(donem);
    if (ms != null && ms > from.getTime()) {
      return { donem, ms };
    }
  }
  const fallback = donemKeyFromDay(gunKeyEkle(parts.dayKey, 7));
  return { donem: fallback, ms: parseDonemAnahtari(fallback) || from.getTime() + 86400000 };
}

function cekilisPenceresiMi(tarih = new Date()) {
  const parts = turkeyNowParts(tarih);
  if (!CEKILIS_GUNLER.includes(weekdayFromDayKey(parts.dayKey))) return false;
  return (
    parts.hour === CEKILIS_SAAT &&
    parts.minute >= CEKILIS_DAKIKA &&
    parts.minute <= CEKILIS_DAKIKA + CEKILIS_PENCERE_DK
  );
}

function donemBitisMs(from = new Date()) {
  const acik = sonrakiCekilisZamani(from);
  return Math.max(0, acik.ms - from.getTime());
}

function sonSayilariEslesme(ticketSayilar, cekilisSayilari, adet) {
  if (!Array.isArray(cekilisSayilari) || cekilisSayilari.length < adet) return false;
  const son = cekilisSayilari.slice(-adet);
  const set = new Set(ticketSayilar);
  return son.every((n) => set.has(n));
}

function teselliHakHesapla(ticketSayilar, cekilisSayilari) {
  if (sonSayilariEslesme(ticketSayilar, cekilisSayilari, 3)) return TESELLI_SON_3_HAK;
  if (sonSayilariEslesme(ticketSayilar, cekilisSayilari, 2)) return TESELLI_SON_2_HAK;
  return 0;
}

function sayilariDogrula(sayilar) {
  if (!Array.isArray(sayilar) || sayilar.length !== SECIM_SAYISI) {
    return { ok: false, error: `Tam ${SECIM_SAYISI} numara seçmelisin (1–${SAYI_MAX}).` };
  }
  const set = new Set();
  for (const raw of sayilar) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > SAYI_MAX) {
      return { ok: false, error: `Numaralar 1 ile ${SAYI_MAX} arasında olmalı.` };
    }
    if (set.has(n)) return { ok: false, error: "Aynı numarayı iki kez seçemezsin." };
    set.add(n);
  }
  return { ok: true, sayilar: [...set].sort((a, b) => a - b) };
}

function cekilisSayilariUret() {
  const havuz = [];
  for (let i = 1; i <= SAYI_MAX; i++) havuz.push(i);
  const sonuc = [];
  for (let i = 0; i < SECIM_SAYISI; i++) {
    const idx = crypto.randomInt(0, havuz.length);
    sonuc.push(havuz.splice(idx, 1)[0]);
  }
  return sonuc.sort((a, b) => a - b);
}

function eslesmeSay(sayilar, cekilis) {
  const set = new Set(cekilis);
  return sayilar.filter((n) => set.has(n)).length;
}

async function ensurePiyangoTables(db) {
  await ensureKumarhaneTables(db);
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_piyango_cekilis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donem TEXT NOT NULL UNIQUE,
      sayilar TEXT,
      durum TEXT NOT NULL DEFAULT 'acik',
      kazanan_sayisi INTEGER NOT NULL DEFAULT 0,
      havuz_toplam INTEGER NOT NULL DEFAULT 0,
      odul_toplam INTEGER NOT NULL DEFAULT 0,
      piyango_gazete_gun TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      cekilis_at INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_piyango_bilet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cekilis_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      sayilar TEXT NOT NULL,
      eslesme INTEGER,
      odul INTEGER NOT NULL DEFAULT 0,
      teselli_hak INTEGER NOT NULL DEFAULT 0,
      ucretsiz INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (cekilis_id) REFERENCES kumarhane_piyango_cekilis(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_piyango_hak (
      user_id INTEGER PRIMARY KEY,
      hak INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_piyango_bilet_cekilis ON kumarhane_piyango_bilet(cekilis_id)`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_piyango_bilet_user ON kumarhane_piyango_bilet(user_id, cekilis_id)`
  );
  try {
    await run(db, `ALTER TABLE kumarhane_piyango_cekilis ADD COLUMN havuz_toplam INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE kumarhane_piyango_cekilis ADD COLUMN piyango_gazete_gun TEXT`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE kumarhane_piyango_bilet ADD COLUMN teselli_hak INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE kumarhane_piyango_bilet ADD COLUMN ucretsiz INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_piyango_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      jackpot_birikim INTEGER NOT NULL DEFAULT 0
    )`
  );
  await run(
    db,
    `INSERT OR IGNORE INTO kumarhane_piyango_meta (id, jackpot_birikim) VALUES (1, 0)`
  );
}

async function piyangoJackpotOnar(db) {
  const now = Date.now();
  const aciklar = await all(
    db,
    `SELECT * FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id ASC`
  );
  for (const c of aciklar) {
    const bitis = parseDonemAnahtari(c.donem);
    if (bitis != null && bitis <= now) {
      await cekilisTamamla(db, c);
    }
  }

  const mevcut = await jackpotBirikimGetir(db);
  if (mevcut > 0) return mevcut;

  const son = await get(
    db,
    `SELECT c.id, c.kazanan_sayisi, c.odul_toplam, c.havuz_toplam, c.sayilar
     FROM kumarhane_piyango_cekilis c
     WHERE c.durum = 'tamam' AND c.sayilar IS NOT NULL AND c.kazanan_sayisi = 0
     ORDER BY c.cekilis_at DESC, c.id DESC
     LIMIT 1`
  );
  if (!son) return 0;

  let miktar = son.odul_toplam > 0 ? son.odul_toplam : 0;
  if (miktar <= 0 && son.havuz_toplam > 0) {
    miktar = Math.floor(son.havuz_toplam * HAVUZ_ODUL_ORANI);
  }
  if (miktar <= 0) {
    const ucretli = await get(
      db,
      `SELECT COUNT(*) AS n FROM kumarhane_piyango_bilet WHERE cekilis_id = ? AND ucretsiz = 0`,
      [son.id]
    );
    miktar = havuzOdulHesapla(ucretli?.n || 0).buyukOdul;
  }
  if (miktar > 0) return await jackpotBirikimAyarla(db, miktar);
  return 0;
}

async function hakGetir(db, userId) {
  await ensurePiyangoTables(db);
  const row = await get(db, `SELECT hak FROM kumarhane_piyango_hak WHERE user_id = ?`, [userId]);
  return row?.hak || 0;
}

async function hakEkle(db, userId, adet) {
  if (adet <= 0) return;
  await ensurePiyangoTables(db);
  await run(
    db,
    `INSERT INTO kumarhane_piyango_hak (user_id, hak) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET hak = hak + ?`,
    [userId, adet, adet]
  );
}

async function hakKullan(db, userId) {
  const hak = await hakGetir(db, userId);
  if (hak < 1) return false;
  const res = await run(
    db,
    `UPDATE kumarhane_piyango_hak SET hak = hak - 1 WHERE user_id = ? AND hak > 0`,
    [userId]
  );
  return !!res?.changes;
}

async function yeniCekilisDonemiAc(db) {
  const sonraki = sonrakiCekilisZamani();
  let row = await get(db, `SELECT * FROM kumarhane_piyango_cekilis WHERE donem = ?`, [sonraki.donem]);
  if (!row) {
    await run(db, `INSERT INTO kumarhane_piyango_cekilis (donem, durum) VALUES (?, 'acik')`, [sonraki.donem]);
    row = await get(db, `SELECT * FROM kumarhane_piyango_cekilis WHERE donem = ?`, [sonraki.donem]);
  } else if (row.durum !== "acik") {
    await run(db, `UPDATE kumarhane_piyango_cekilis SET durum = 'acik' WHERE id = ?`, [row.id]);
    row.durum = "acik";
  }
  return row;
}

async function aktifCekilisGetir(db) {
  await ensurePiyangoTables(db);
  await vadesiGelenCekilisleriYap(db);
  const now = Date.now();
  const acik = await get(
    db,
    `SELECT * FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
  );
  if (acik) {
    const bitis = parseDonemAnahtari(acik.donem);
    if (bitis == null) {
      await run(
        db,
        `UPDATE kumarhane_piyango_cekilis SET durum = 'tamam', cekilis_at = strftime('%s','now') WHERE id = ?`,
        [acik.id]
      );
    } else if (bitis > now) {
      return acik;
    }
  }
  return yeniCekilisDonemiAc(db);
}

function cekilisDonemMetni(donem) {
  const ms = parseDonemAnahtari(donem);
  if (!ms) return "yakında";
  return new Date(ms).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function aktifCekilisOzet(db) {
  let cekilis = await get(
    db,
    `SELECT * FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
  );
  if (!cekilis) cekilis = await yeniCekilisDonemiAc(db);

  const bitis = parseDonemAnahtari(cekilis.donem);
  if (bitis != null && Date.now() >= bitis) return null;

  const toplam = await get(
    db,
    `SELECT COUNT(*) AS n FROM kumarhane_piyango_bilet WHERE cekilis_id = ?`,
    [cekilis.id]
  );
  const odul = await buyukOdulToplam(db, cekilis.id);
  return {
    cekilis,
    ...odul,
    biletAdet: toplam?.n || 0,
  };
}

async function gunlukPiyangoGazeteHaber(db) {
  if (!piyangoAktifMi()) return;

  await ensurePiyangoTables(db);
  const { istanbulGunKey } = require("./turkiyeSaati");
  const gunKey = istanbulGunKey();
  const ozet = await aktifCekilisOzet(db);
  if (!ozet) return;

  const { cekilis, havuzToplam, buyukOdul, devreden, donemOdul, biletAdet } = ozet;
  if (buyukOdul <= 0) return;
  if (cekilis.piyango_gazete_gun === gunKey) return;

  const { gazeteEkle } = require("./sehirGazeteService");
  const cekilisMetin = cekilisDonemMetni(cekilis.donem);
  const odulMetin = buyukOdul.toLocaleString("tr-TR");
  const devredenMetin = devreden.toLocaleString("tr-TR");
  const donemMetin = donemOdul.toLocaleString("tr-TR");
  const havuzMetin = havuzToplam.toLocaleString("tr-TR");

  const mesaj =
    devreden > 0
      ? `🎟️ Kumarhane Piyangosu: Büyük ödül ${odulMetin} çip! (Devreden ${devredenMetin} + bu dönem ${donemMetin} çip, ${biletAdet} bilet). Çekiliş ${cekilisMetin} — 6 sayının tamamını bilene.`
      : `🎟️ Kumarhane Piyangosu: Büyük ödül ${odulMetin} çip! (Havuz ${havuzMetin} çip, ${biletAdet} bilet). Çekiliş ${cekilisMetin} — 6 sayının tamamını bilene.`;

  await gazeteEkle(db, mesaj);

  await run(db, `UPDATE kumarhane_piyango_cekilis SET piyango_gazete_gun = ? WHERE id = ?`, [
    gunKey,
    cekilis.id,
  ]);
}

async function piyangoGazeteDevretmeHaber(db, cekilisSayilari, devredenMiktar) {
  if (devredenMiktar <= 0) return;
  const { gazeteEkle } = require("./sehirGazeteService");
  const sayiMetin = cekilisSayilari.join(", ");
  const odulMetin = devredenMiktar.toLocaleString("tr-TR");
  const sonraki = sonrakiCekilisZamani();
  const sonrakiMetin = cekilisDonemMetni(sonraki.donem);
  await gazeteEkle(
    db,
    `🎟️ Kumarhane Piyangosu çekildi (${sayiMetin}). Kazanan çıkmadı — büyük ödül ${odulMetin} çip sonraki çekilişe devretti! (Sonraki çekiliş: ${sonrakiMetin})`
  );
}

async function piyangoGazeteHaber(db, cekilisSayilari, kazananlar, kisiBasiOdul, toplamJackpot, devredenDahil) {
  if (!kazananlar.length || kisiBasiOdul <= 0) return;
  const isimler = [];
  for (const k of kazananlar) {
    const u = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [k.user_id]);
    if (u?.reis_adi) isimler.push(u.reis_adi);
  }
  if (!isimler.length) return;
  const { gazeteEkle } = require("./sehirGazeteService");
  const sayiMetin = cekilisSayilari.join(", ");
  const odulMetin = kisiBasiOdul.toLocaleString("tr-TR");
  const havuzMetin = toplamJackpot.toLocaleString("tr-TR");
  const devredenNot =
    devredenDahil > 0 ? ` (devreden ${devredenDahil.toLocaleString("tr-TR")} çip dahil)` : "";
  const kazananMetin =
    isimler.length === 1
      ? isimler[0]
      : `${isimler.slice(0, -1).join(", ")} ve ${isimler[isimler.length - 1]}`;
  await gazeteEkle(
    db,
    `🎟️ Kumarhane Piyangosu çekildi (${sayiMetin}). 6 sayının tamamını bilen ${kazananMetin} büyük ödülü kazandı — ${odulMetin} çip! (Toplam havuz: ${havuzMetin} çip${devredenNot})`
  );
}

async function cekilisTamamla(db, cekilisRow) {
  const biletler = await all(
    db,
    `SELECT id, user_id, sayilar, ucretsiz FROM kumarhane_piyango_bilet WHERE cekilis_id = ?`,
    [cekilisRow.id]
  );

  if (!biletler.length) {
    const devreden = await jackpotBirikimGetir(db);
    await run(
      db,
      `UPDATE kumarhane_piyango_cekilis
       SET durum = 'tamam', sayilar = NULL, kazanan_sayisi = 0, havuz_toplam = 0, odul_toplam = 0, cekilis_at = strftime('%s','now')
       WHERE id = ?`,
      [cekilisRow.id]
    );
    return {
      cekilisId: cekilisRow.id,
      donem: cekilisRow.donem,
      sayilar: null,
      maxEslesme: 0,
      kazananSayisi: 0,
      havuzToplam: 0,
      buyukOdul: devreden,
      devreden,
      kisiBasiOdul: 0,
    };
  }

  const cekilisSayilari = cekilisSayilariUret();
  let maxEslesme = 0;
  const skorlar = biletler.map((b) => {
    let sayilar;
    try {
      sayilar = JSON.parse(b.sayilar);
    } catch (_) {
      sayilar = [];
    }
    const eslesme = eslesmeSay(sayilar, cekilisSayilari);
    if (eslesme > maxEslesme) maxEslesme = eslesme;
    return { ...b, sayilar, eslesme };
  });

  const kazananlar = skorlar.filter((s) => s.eslesme === SECIM_SAYISI);
  const odul = await buyukOdulToplam(db, cekilisRow.id);
  const { devreden, donemOdul, buyukOdul, havuzToplam } = odul;
  const kisiBasiOdul = kazananlar.length ? Math.floor(buyukOdul / kazananlar.length) : 0;
  const dagitilanOdul = kisiBasiOdul * kazananlar.length;
  const kazananIdSet = new Set(kazananlar.map((k) => k.id));

  for (const skor of skorlar) {
    const odulMiktar = kazananIdSet.has(skor.id) ? kisiBasiOdul : 0;
    let teselli = 0;
    if (odulMiktar <= 0) {
      teselli = teselliHakHesapla(skor.sayilar, cekilisSayilari);
      if (teselli > 0) await hakEkle(db, skor.user_id, teselli);
    }

    await run(
      db,
      `UPDATE kumarhane_piyango_bilet SET eslesme = ?, odul = ?, teselli_hak = ? WHERE id = ?`,
      [skor.eslesme, odulMiktar, teselli, skor.id]
    );

    if (odulMiktar > 0) {
      await chipGuncelle(db, skor.user_id, odulMiktar);
      await logEkle(db, skor.user_id, "piyango", 0, odulMiktar, {
        cekilisId: cekilisRow.id,
        eslesme: skor.eslesme,
        cekilisSayilari,
        havuzToplam,
        buyukOdul,
        devreden,
      });
    }
  }

  if (kazananlar.length) {
    await jackpotBirikimAyarla(db, 0);
    await piyangoGazeteHaber(db, cekilisSayilari, kazananlar, kisiBasiOdul, buyukOdul, devreden);
  } else {
    await jackpotBirikimAyarla(db, buyukOdul);
    await piyangoGazeteDevretmeHaber(db, cekilisSayilari, buyukOdul);
  }

  await run(
    db,
    `UPDATE kumarhane_piyango_cekilis
     SET sayilar = ?, durum = 'tamam', kazanan_sayisi = ?, havuz_toplam = ?, odul_toplam = ?, cekilis_at = strftime('%s','now')
     WHERE id = ?`,
    [
      JSON.stringify(cekilisSayilari),
      kazananlar.length,
      havuzToplam,
      kazananlar.length ? dagitilanOdul : buyukOdul,
      cekilisRow.id,
    ]
  );

  return {
    cekilisId: cekilisRow.id,
    donem: cekilisRow.donem,
    sayilar: cekilisSayilari,
    maxEslesme,
    kazananSayisi: kazananlar.length,
    havuzToplam,
    buyukOdul,
    devreden,
    donemOdul,
    kisiBasiOdul,
  };
}

async function vadesiGelenCekilisleriYap(db) {
  const now = Date.now();
  const aciklar = await all(
    db,
    `SELECT * FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id ASC`
  );
  for (const cekilis of aciklar) {
    const bitis = parseDonemAnahtari(cekilis.donem);
    if (bitis == null) continue;
    if (bitis <= now) {
      await cekilisTamamla(db, cekilis);
    }
  }
}

async function panelVerisiGetir(db, userId) {
  if (!piyangoAktifMi()) return null;

  await ensurePiyangoTables(db);
  await vadesiGelenCekilisleriYap(db);
  await piyangoJackpotOnar(db);

  const cekilis = await aktifCekilisGetir(db);
  const sonraki = sonrakiCekilisZamani();
  const biletSayisi = await get(
    db,
    `SELECT COUNT(*) AS n FROM kumarhane_piyango_bilet WHERE cekilis_id = ?`,
    [cekilis.id]
  );
  const benimBiletler = await all(
    db,
    `SELECT id, sayilar, eslesme, odul, teselli_hak, ucretsiz, created_at
     FROM kumarhane_piyango_bilet
     WHERE cekilis_id = ? AND user_id = ?
     ORDER BY id DESC`,
    [cekilis.id, userId]
  );
  const sonCekilis = await get(
    db,
    `SELECT c.*
     FROM kumarhane_piyango_cekilis c
     WHERE c.durum = 'tamam' AND c.havuz_toplam > 0 AND c.sayilar IS NOT NULL
     ORDER BY c.cekilis_at DESC, c.id DESC
     LIMIT 1`
  );

  let sonKazananlar = [];
  if (sonCekilis) {
    sonKazananlar = await all(
      db,
      `SELECT b.eslesme, b.odul, b.teselli_hak, u.reis_adi
       FROM kumarhane_piyango_bilet b
       JOIN users u ON u.id = b.user_id
       WHERE b.cekilis_id = ? AND (b.odul > 0 OR b.teselli_hak > 0)
       ORDER BY b.odul DESC, b.teselli_hak DESC`,
      [sonCekilis.id]
    );
  }

  const benimBiletSayisi = benimBiletler.length;
  const biletAdet = biletSayisi?.n || 0;
  const odul = await buyukOdulToplam(db, cekilis.id);
  const biletHak = await hakGetir(db, userId);

  return {
    aktif: true,
    donem: cekilis.donem,
    sonrakiCekilis: sonraki.donem,
    cekilisProgram: "Pazartesi, Çarşamba, Cuma 20:30",
    biletUcret: BILET_UCRET,
    biletElmasMaliyet: BILET_ELMAS_MALIYET,
    biletHak,
    devredenOdul: odul.devreden,
    donemOdul: odul.donemOdul,
    donemHavuz: odul.donemHavuz,
    havuzToplam: odul.havuzToplam,
    buyukOdul: odul.buyukOdul,
    odul: odul.buyukOdul,
    secimSayisi: SECIM_SAYISI,
    sayiMax: SAYI_MAX,
    kalanMs: donemBitisMs(),
    toplamBilet: biletAdet,
    maxBilet: MAX_BILET_KULLANICI,
    benimBiletSayisi,
    biletKalan: Math.max(0, MAX_BILET_KULLANICI - benimBiletSayisi),
    benimBiletler: benimBiletler.map((b) => {
      let sayilar = [];
      try {
        sayilar = JSON.parse(b.sayilar);
      } catch (_) {}
      return {
        id: b.id,
        sayilar,
        eslesme: b.eslesme,
        odul: b.odul,
        teselliHak: b.teselli_hak,
        ucretsiz: !!b.ucretsiz,
      };
    }),
    sonCekilis: sonCekilis
      ? {
          donem: sonCekilis.donem,
          sayilar: sonCekilis.sayilar ? JSON.parse(sonCekilis.sayilar) : [],
          kazananSayisi: sonCekilis.kazanan_sayisi,
          havuzToplam: sonCekilis.havuz_toplam || 0,
          odulToplam: sonCekilis.odul_toplam,
          devredenOdul:
            sonCekilis.kazanan_sayisi === 0 && sonCekilis.odul_toplam > 0
              ? sonCekilis.odul_toplam
              : 0,
          kazananlar: sonKazananlar.map((k) => ({
            reisAdi: k.reis_adi,
            eslesme: k.eslesme,
            odul: k.odul,
            teselliHak: k.teselli_hak,
          })),
        }
      : null,
  };
}

async function biletAl(db, userId, hamSayilar, opts = {}) {
  const odeme = opts.odeme === "elmas" ? "elmas" : "chip";
  if (!piyangoAktifMi()) {
    return { ok: false, error: "Piyango şu an kullanılamıyor." };
  }

  const parsed = sayilariDogrula(hamSayilar);
  if (!parsed.ok) return parsed;

  await ensurePiyangoTables(db);
  await vadesiGelenCekilisleriYap(db);
  const cekilis = await aktifCekilisGetir(db);
  const bitis = parseDonemAnahtari(cekilis.donem);
  if (bitis != null && Date.now() >= bitis) {
    return { ok: false, error: "Bu dönemin çekilişi kapandı — sonraki çekilişi bekle." };
  }
  if (cekilis.durum !== "acik") {
    return { ok: false, error: "Bu dönemin çekilişi kapandı — sonraki çekilişi bekle." };
  }

  const mevcut = await get(
    db,
    `SELECT COUNT(*) AS n FROM kumarhane_piyango_bilet WHERE cekilis_id = ? AND user_id = ?`,
    [cekilis.id, userId]
  );
  if ((mevcut?.n || 0) >= MAX_BILET_KULLANICI) {
    return {
      ok: false,
      error: `Bu çekiliş döneminde en fazla ${MAX_BILET_KULLANICI} bilet alabilirsin (çip veya elmas).`,
    };
  }

  const ucretsiz = odeme === "chip" ? await hakKullan(db, userId) : false;
  if (!ucretsiz) {
    if (odeme === "elmas") {
      const elmasRow = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
      const elmas = elmasRow?.elmas || 0;
      if (elmas < BILET_ELMAS_MALIYET) {
        return {
          ok: false,
          error: `Yeterli elmasın yok! ${BILET_ELMAS_MALIYET} elmas gerekir.`,
        };
      }
      const elmasRes = await run(
        db,
        `UPDATE players SET elmas = elmas - ? WHERE user_id = ? AND elmas >= ?`,
        [BILET_ELMAS_MALIYET, userId, BILET_ELMAS_MALIYET]
      );
      if (!elmasRes?.changes) return { ok: false, error: "Elmas düşülemedi." };
    } else {
      const chip = await chipGetir(db, userId);
      if (chip < BILET_UCRET) {
        return {
          ok: false,
          error: `Yeterli çipin yok! ${BILET_UCRET.toLocaleString("tr-TR")} çip gerekir.`,
        };
      }
      const ok = await chipGuncelle(db, userId, -BILET_UCRET);
      if (!ok) return { ok: false, error: "Çip düşülemedi." };
    }
  }

  await run(
    db,
    `INSERT INTO kumarhane_piyango_bilet (cekilis_id, user_id, sayilar, ucretsiz) VALUES (?, ?, ?, ?)`,
    [cekilis.id, userId, JSON.stringify(parsed.sayilar), ucretsiz ? 1 : 0]
  );

  if (!ucretsiz) {
    if (odeme === "elmas") {
      await logEkle(db, userId, "piyango", 0, 0, {
        tip: "bilet_elmas",
        elmas: BILET_ELMAS_MALIYET,
        sayilar: parsed.sayilar,
        cekilisId: cekilis.id,
      });
    } else {
      await logEkle(db, userId, "piyango", BILET_UCRET, 0, {
        tip: "bilet",
        sayilar: parsed.sayilar,
        cekilisId: cekilis.id,
      });
    }
  }

  const mesaj = ucretsiz
    ? `Ücretsiz bilet kullanıldı: ${parsed.sayilar.join(", ")}.`
    : odeme === "elmas"
      ? `Bilet alındı: ${parsed.sayilar.join(", ")} — ${BILET_ELMAS_MALIYET} elmas.`
      : `Bilet alındı: ${parsed.sayilar.join(", ")} — ${BILET_UCRET.toLocaleString("tr-TR")} çip.`;

  const elmasRow = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
  return {
    ok: true,
    mesaj,
    chip: await chipGetir(db, userId),
    elmas: elmasRow?.elmas || 0,
    piyango: await panelVerisiGetir(db, userId),
  };
}

async function periyodikKontrol(db) {
  if (!piyangoAktifMi()) return;
  await ensurePiyangoTables(db);
  await gunlukPiyangoGazeteHaber(db);
  await vadesiGelenCekilisleriYap(db);
  await piyangoJackpotOnar(db);
}

module.exports = {
  piyangoAktifMi,
  BILET_UCRET,
  BILET_ELMAS_MALIYET,
  HAVUZ_ODUL_ORANI,
  SECIM_SAYISI,
  SAYI_MAX,
  CEKILIS_GUNLER,
  CEKILIS_SAAT,
  CEKILIS_DAKIKA,
  TESELLI_SON_3_HAK,
  TESELLI_SON_2_HAK,
  havuzOdulHesapla,
  jackpotBirikimGetir,
  jackpotBirikimAyarla,
  buyukOdulToplam,
  sonrakiCekilisZamani,
  cekilisPenceresiMi,
  donemBitisMs,
  sonSayilariEslesme,
  teselliHakHesapla,
  panelVerisiGetir,
  biletAl,
  periyodikKontrol,
  gunlukPiyangoGazeteHaber,
  vadesiGelenCekilisleriYap,
  cekilisTamamla,
  piyangoJackpotOnar,
};
