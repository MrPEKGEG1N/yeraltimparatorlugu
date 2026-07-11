#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.argv[2] || "db/oyun.db";

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  const db = new sqlite3.Database(path.resolve(dbPath), sqlite3.OPEN_READONLY);
  const limanlar = await q(
    db,
    `SELECT l.liman_id, u.username, u.reis_adi FROM liman_sahiplik l JOIN users u ON u.id = l.owner_user_id`
  );
  const makamlar = await q(
    db,
    `SELECT m.makam, u.username, u.reis_adi FROM baba_makamlari m JOIN users u ON u.id = m.owner_user_id`
  );
  const kara = await q(
    db,
    `SELECT u.username, p.kara_listede, p.puan, p.sehre_hukmet_sayisi FROM players p JOIN users u ON u.id=p.user_id WHERE p.kara_listede=1`
  );
  const hukum = await q(
    db,
    `SELECT h.*, u.username FROM sehir_hukumranlik h JOIN users u ON u.id=h.user_id ORDER BY h.id`
  );
  const tarih = await q(db, `SELECT * FROM sehir_tarihi ORDER BY id DESC LIMIT 10`);
  const aktivite = await q(
    db,
    `SELECT a.* FROM aktivite_log a JOIN users u ON u.id=a.user_id WHERE u.username='dd1' AND (a.aksiyon LIKE '%huk%' OR a.aksiyon LIKE '%liman%' OR a.aksiyon LIKE '%makam%' OR a.detay LIKE '%huk%' OR a.ekran LIKE '%kara%') ORDER BY a.id DESC LIMIT 20`
  ).catch(() => []);
  console.log("=== LIMANLAR ===");
  console.log(limanlar);
  console.log("=== MAKAMLAR ===");
  console.log(makamlar);
  console.log("=== KARA LISTE ===");
  console.log(kara);
  console.log("=== HUKUMRANLIK ===");
  console.log(hukum);
  console.log("=== SEHIR TARIHI (son 10) ===");
  console.log(tarih);
  console.log("=== DD1 AKTIVITE (hukum/liman) ===");
  console.log(aktivite);
  db.close();
})();
