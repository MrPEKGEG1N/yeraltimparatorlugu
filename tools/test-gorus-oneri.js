/**
 * Görüş ve öneri gönderme testi.
 * Kullanım: node tools/test-gorus-oneri.js
 */
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const TEST_DB = path.join(__dirname, ".gorus-oneri-test.db");

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
  if (fs.existsSync(TEST_DB)) {
    try { fs.unlinkSync(TEST_DB); } catch (_) {}
  }
  const db = await openDb(TEST_DB);

  await run(
    db,
    `CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT, reis_adi TEXT)`
  );
  await run(db, `INSERT INTO users VALUES (1, 't', 'x', 'Test Reis')`);

  const {
    ensureGorusOneriTables,
    gorusOneriGonder,
    gorusOnerileriListele,
  } = require("../game/gorusOneriService");

  await ensureGorusOneriTables(db);

  const kisa = await gorusOneriGonder(db, 1, "kısa");
  assert(!kisa.ok, "kısa mesaj reddedilmeli");

  const uzun = await gorusOneriGonder(db, 1, "Oyun çok güzel, daha fazla görev ekleyin lütfen.");
  assert(uzun.ok, uzun.error || "görüş gönderilemedi");

  const tekrar = await gorusOneriGonder(db, 1, "Hemen ardından ikinci mesaj denemesi.");
  assert(!tekrar.ok, "spam koruması çalışmalı");

  const liste = await gorusOnerileriListele(db, 10);
  assert(liste.length === 1, "tek kayıt olmalı");
  assert(liste[0].mesaj.includes("görev"), "mesaj kaydedilmeli");
  assert(liste[0].oyuncu_adi === "Test Reis", "oyuncu adı join olmalı");

  console.log("OK — görüş ve öneri testleri geçti");

  db.close();
  try { fs.unlinkSync(TEST_DB); } catch (_) {}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
