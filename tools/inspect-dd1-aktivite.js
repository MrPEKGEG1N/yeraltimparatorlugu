#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.argv[2] || "db/oyun.db";

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  const db = new sqlite3.Database(path.resolve(dbPath), sqlite3.OPEN_READONLY);
  const u = await q(db, `SELECT id FROM users WHERE username='dd1'`);
  const id = u[0]?.id;
  if (!id) {
    console.log("dd1 yok");
    return db.close();
  }
  const logs = await q(
    db,
    `SELECT aksiyon, detay, ekran, created_at FROM aktivite_log WHERE user_id=? ORDER BY id DESC LIMIT 50`,
    [id]
  ).catch(() => []);
  const sehirK = await q(
    db,
    `SELECT * FROM sehir_kontrol WHERE user_id=?`,
    [id]
  ).catch(() => []);
  const pl = await q(
    db,
    `SELECT liman_istanbul, kara_listede, sehre_hukmet_sayisi, sehir_efsane FROM players WHERE user_id=?`,
    [id]
  );
  console.log("player cols", pl[0]);
  console.log("sehir_kontrol", sehirK);
  console.log("son aktivite", logs);
  db.close();
})();
