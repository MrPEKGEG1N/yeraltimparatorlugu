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
  if (!id) return db.close();
  const stats = await q(
    db,
    `SELECT tur, SUM(miktar) toplam, COUNT(*) adet, MAX(miktar) max_tek
     FROM stat_hareketleri WHERE user_id=? GROUP BY tur`,
    [id]
  ).catch(() => []);
  const sayg = await q(
    db,
    `SELECT miktar, detay, created_at FROM stat_hareketleri WHERE user_id=? AND tur='sayginlik' ORDER BY id DESC LIMIT 15`,
    [id]
  ).catch(() => []);
  const all = await q(db, `SELECT u.username, p.puan FROM players p JOIN users u ON u.id=p.user_id ORDER BY p.puan DESC`);
  console.log({ path: dbPath, dd1_id: id, leaderboard: all, statOzet: stats, sonSayginlik: sayg });
  db.close();
})();
