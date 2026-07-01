/**
 * Güvenli yer kasa elmas aboneliği testi.
 * Kullanım: node tools/test-guvenli-yer-kasa.js
 */
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const TEST_DB = path.join(__dirname, ".gy-kasa-test.db");
const KASA_ABONELIK_SN = 30 * 86400;

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function openDb(file) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, (err) => (err ? reject(err) : resolve(db)));
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

async function main() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = await openDb(TEST_DB);

  await run(
    db,
    `CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      reis_adi TEXT NOT NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE players (
      user_id INTEGER PRIMARY KEY,
      kasa INTEGER NOT NULL DEFAULT 10000,
      guc INTEGER NOT NULL DEFAULT 500,
      puan INTEGER NOT NULL DEFAULT 1500,
      icraat INTEGER NOT NULL DEFAULT 25,
      liman_istanbul INTEGER NOT NULL DEFAULT 0,
      last_icraat_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      bonus_guc INTEGER NOT NULL DEFAULT 0,
      elmas INTEGER NOT NULL DEFAULT 100
    )`
  );
  await run(db, `INSERT INTO users (username, password_hash, reis_adi) VALUES ('test', 'x', 'Test')`);
  await run(db, `INSERT INTO players (user_id, elmas) VALUES (1, 100)`);

  const { ensureUserBaseTable, ensureUserBase, kasaSatinAl } = require("../game/guvenliYerService");
  const { kasaKorumaOrani, kasaAktifMi, kasaBul } = require("../game/guvenliYerCatalog");

  await ensureUserBaseTable(db);
  await ensureUserBase(db, 1);
  await run(db, `UPDATE user_base SET base_seviye = 6 WHERE user_id = 1`);

  const player = { kasa: 10000, elmas: 100, bonus_guc: 0 };
  const gumus = await kasaSatinAl(db, 1, player, "gumus");
  assert(gumus.ok, gumus.error || "gumus alınamadı");
  assert(player.elmas === 75, "elmas düşülmedi: " + player.elmas);

  let row = await ensureUserBase(db, 1);
  assert(kasaAktifMi(row, kasaBul("gumus")), "gümüş kasa aktif değil");
  assert(kasaKorumaOrani(row) === 0.25, "koruma %25 değil");

  const bitis1 = row.kasa_gumus_bitis;
  assert(bitis1 > Math.floor(Date.now() / 1000), "bitiş gelecekte değil");

  player.elmas = 100;
  await run(db, `UPDATE players SET elmas = 100 WHERE user_id = 1`);
  const yenile = await kasaSatinAl(db, 1, player, "gumus");
  assert(yenile.ok, yenile.error || "yenileme başarısız");
  row = await ensureUserBase(db, 1);
  assert(row.kasa_gumus_bitis > bitis1, "yenilemede süre uzamadı");

  const altin = await kasaSatinAl(db, 1, player, "altin");
  assert(altin.ok, altin.error || "altın alınamadı");
  row = await ensureUserBase(db, 1);
  assert(kasaKorumaOrani(row) === 0.5, "altın koruma %50 değil");

  await run(db, `UPDATE user_base SET kasa_gumus_bitis = ?, kasa_altin_bitis = ? WHERE user_id = 1`, [1, 1]);
  row = await ensureUserBase(db, 1);
  assert(kasaKorumaOrani(row) === 0, "süresi dolunca koruma kalkmalı");

  console.log("OK — güvenli yer kasa abonelik testleri geçti");

  db.close();
  fs.unlinkSync(TEST_DB);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
