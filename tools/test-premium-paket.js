/**
 * Premium paket faiz oranları ve satın alma sonrası anında avantaj uygulaması testi.
 * Kullanım: node tools/test-premium-paket.js
 */
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const TEST_DB = path.join(__dirname, ".premium-test.db");

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
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function openDb(file) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, (err) => (err ? reject(err) : resolve(db)));
  });
}

async function setupMinimalDb(db) {
  await run(
    db,
    `CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      reis_adi TEXT NOT NULL,
      lakap TEXT NOT NULL DEFAULT 'Mafya',
      grup TEXT NOT NULL DEFAULT ''
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
      sms_hakki INTEGER NOT NULL DEFAULT 50,
      last_sms_day TEXT,
      elmas INTEGER NOT NULL DEFAULT 0,
      premium_paket TEXT NOT NULL DEFAULT ''
    )`
  );
  await run(
    db,
    `CREATE TABLE banka_hesaplari (
      user_id INTEGER PRIMARY KEY,
      yatirilan_miktar INTEGER NOT NULL DEFAULT 0,
      banka_hakki INTEGER NOT NULL DEFAULT 20,
      last_banka_hak_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      faiz_bekleyen INTEGER NOT NULL DEFAULT 0,
      faiz_gun TEXT,
      faiz_islendi_gun TEXT
    )`
  );
  await run(db, `INSERT INTO users (username, password_hash, reis_adi) VALUES ('test', 'x', 'TestReis')`);
  await run(
    db,
    `INSERT INTO players (user_id, icraat, sms_hakki, elmas, premium_paket)
     VALUES (1, 40, 20, 1000, '')`
  );
  await run(
    db,
    `INSERT INTO banka_hesaplari (user_id, yatirilan_miktar, banka_hakki, last_banka_hak_at)
     VALUES (1, 0, 10, strftime('%s','now'))`
  );
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

async function main() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  const dbMod = require("../db/database");
  const origPath = dbMod.DB_PATH;
  Object.defineProperty(dbMod, "DB_PATH", { value: TEST_DB, writable: true, configurable: true });

  const db = await openDb(TEST_DB);
  await setupMinimalDb(db);

  const {
    paketTanim,
    getPremiumBonuses,
    premiumSatinAl,
    PREMIUM_PAKETLER,
  } = require("../game/premiumService");

  assert(paketTanim("tetikci").faizOran === 0.015, "tetikci faiz %1.5 olmalı");
  assert(paketTanim("racon").faizOran === 0.02, "racon faiz %2 olmalı");
  assert(paketTanim("baron").faizOran === 0.025, "baron faiz %2.5 olmalı");

  const sonuc = await premiumSatinAl(db, 1, "tetikci");
  assert(sonuc.ok, "tetikci satın alma başarısız: " + (sonuc.error || ""));
  const bonuses = await getPremiumBonuses(db, 1);
  assert(bonuses.paket === "tetikci", "aktif paket tetikci değil");
  assert(bonuses.faizOran === 0.015, "faiz oranı uygulanmadı");
  assert(bonuses.icraatSaatlik === 35, "icraat saatlik bonusu yanlış");

  const sms = await get(db, `SELECT sms_hakki FROM players WHERE user_id = 1`);
  assert(sms.sms_hakki >= 75, "SMS hakkı hemen yükselmedi: " + sms.sms_hakki);

  const banka = await get(db, `SELECT banka_hakki FROM banka_hesaplari WHERE user_id = 1`);
  assert(banka.banka_hakki >= 30, "banka hakkı hemen yükselmedi: " + banka.banka_hakki);

  const elmasRow = await get(db, `SELECT elmas, premium_paket FROM players WHERE user_id = 1`);
  assert(elmasRow.elmas === 900, "elmas düşülmedi");
  assert(elmasRow.premium_paket === "tetikci", "premium_paket kaydı yok");

  await run(db, `UPDATE players SET elmas = 1000, premium_paket = 'tetikci', sms_hakki = 60`);
  const racon = await premiumSatinAl(db, 1, "racon");
  assert(racon.ok, "racon yükseltme başarısız");
  const raconBonus = await getPremiumBonuses(db, 1);
  assert(raconBonus.faizOran === 0.02, "racon faiz %2 değil");
  const sms2 = await get(db, `SELECT sms_hakki FROM players WHERE user_id = 1`);
  assert(sms2.sms_hakki >= 100, "racon SMS yükseltmesi uygulanmadı");

  await run(db, `UPDATE players SET elmas = 2000, icraat = 150`);
  const baron = await premiumSatinAl(db, 1, "baron");
  assert(baron.ok, "baron yükseltme başarısız");
  const baronBonus = await getPremiumBonuses(db, 1);
  assert(baronBonus.faizOran === 0.025, "baron faiz %2.5 değil");
  assert(baronBonus.smsSinirsiz && baronBonus.bankaHakSinirsiz, "baron sınırsız haklar aktif değil");
  const icraat = await get(db, `SELECT icraat FROM players WHERE user_id = 1`);
  assert(icraat.icraat >= 150, "baron satın alınca icraat kesilmemeli: " + icraat.icraat);

  console.log("OK — premium paket testleri geçti");
  console.log(
    "  Faiz oranları:",
    Object.values(PREMIUM_PAKETLER)
      .map((p) => p.id + "=" + Math.round(p.faizOran * 1000) / 10 + "%")
      .join(", ")
  );

  db.close();
  fs.unlinkSync(TEST_DB);
  Object.defineProperty(dbMod, "DB_PATH", { value: origPath, writable: true, configurable: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
