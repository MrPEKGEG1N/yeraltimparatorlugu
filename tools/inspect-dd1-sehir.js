#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const roots = [
  "db/backups",
  "db",
  "seed",
];

function collectDbFiles() {
  const out = new Set();
  for (const root of roots) {
    const full = path.join(process.cwd(), root);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isFile() && full.endsWith(".db")) {
      out.add(full);
      continue;
    }
    for (const name of fs.readdirSync(full)) {
      if (!name.endsWith(".db") || name.includes("-shm") || name.includes("-wal")) continue;
      const p = path.join(full, name);
      try {
        if (fs.statSync(p).size < 512) continue;
        out.add(p);
      } catch (_) {}
    }
  }
  return [...out].sort();
}

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

function get(db, sql, p = []) {
  return new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

async function inspectDb(dbPath) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  try {
    const u = await get(db, `SELECT id, username, reis_adi, grup FROM users WHERE username = 'dd1'`);
    if (!u) return null;

    const pl = await get(
      db,
      `SELECT kasa, guc, puan, kara_listede, sehir_efsane, aktif_hukumranlik_id,
              profil_aciklama, devlet_iliskisi, icraat, sms_hakki
       FROM players WHERE user_id = ?`,
      [u.id]
    );

    let hukum = [];
    let tarih = [];
    let mekanlar = [];
    let owned = [];
    let mafya = null;

    try {
      hukum = await q(
        db,
        `SELECT * FROM sehir_hukumranlik WHERE user_id = ? ORDER BY id`,
        [u.id]
      );
    } catch (_) {}
    try {
      tarih = await q(
        db,
        `SELECT * FROM sehir_tarihi WHERE hukumdar_user_id = ? ORDER BY id`,
        [u.id]
      );
    } catch (_) {}
    try {
      mekanlar = await q(
        db,
        `SELECT sektor, mekan_key, adet FROM oyuncu_mekanlari WHERE user_id = ? AND adet > 0 ORDER BY sektor, mekan_key`,
        [u.id]
      );
    } catch (_) {}
    try {
      owned = await q(db, `SELECT id, isim, tur_id, kasa FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [
        u.id,
      ]);
    } catch (_) {}
    try {
      mafya = await get(
        db,
        `SELECT mg.id, mg.isim, mu.rutbe FROM mafya_uyeleri mu
         JOIN mafya_gruplari mg ON mg.id = mu.grup_id WHERE mu.user_id = ?`,
        [u.id]
      );
    } catch (_) {}

    const aktifHukumdar = await get(
      db,
      `SELECT u.username, u.reis_adi, p.kara_listede, h.baslangic
       FROM players p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN sehir_hukumranlik h ON h.user_id = p.user_id AND h.bitis IS NULL
       WHERE p.kara_listede = 1
       LIMIT 1`
    ).catch(() => null);

    const mekanToplam = mekanlar.reduce((s, m) => s + (m.adet || 0), 0);

    return {
      path: path.relative(process.cwd(), dbPath),
      kasa: pl?.kasa,
      guc: pl?.guc,
      puan: pl?.puan,
      kara_listede: pl?.kara_listede,
      sehir_efsane: pl?.sehir_efsane,
      mekanToplam,
      mekanlar: mekanlar.length,
      owned: owned.map((s) => `${s.tur_id}:${s.isim}`),
      mafya: mafya ? `${mafya.isim} (${mafya.rutbe})` : null,
      hukumKayit: hukum.length,
      aktifHukum: hukum.filter((h) => !h.bitis).length,
      hukumBaslangic: hukum.find((h) => !h.bitis)?.baslangic || hukum[hukum.length - 1]?.baslangic,
      tarihKayit: tarih.length,
      aktifHukumdar: aktifHukumdar
        ? `${aktifHukumdar.username} (kara=${aktifHukumdar.kara_listede})`
        : null,
    };
  } catch (e) {
    return { path: path.relative(process.cwd(), dbPath), error: e.message };
  } finally {
    db.close();
  }
}

(async () => {
  const files = collectDbFiles();
  console.log("DB dosyalari:", files.length);
  const rows = [];
  for (const f of files) {
    const r = await inspectDb(f);
    if (r) rows.push(r);
  }
  rows.sort((a, b) => (b.kara_listede || 0) - (a.kara_listede || 0) || (b.guc || 0) - (a.guc || 0));
  for (const r of rows) console.log(JSON.stringify(r));
})();
