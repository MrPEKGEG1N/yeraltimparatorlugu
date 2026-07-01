/**
 * Ücretsiz kota sonrası 1 elmasla görev teslim testi.
 * Kullanım: node tools/test-gorev-elmas.js
 */
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const TEST_DB = path.join(__dirname, ".gorev-elmas-test.db");

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
  await run(
    db,
    `CREATE TABLE players (
      user_id INTEGER PRIMARY KEY, kasa INTEGER DEFAULT 10000, guc INTEGER DEFAULT 500,
      puan INTEGER DEFAULT 1500, icraat INTEGER DEFAULT 25, liman_istanbul INTEGER DEFAULT 0,
      last_icraat_at INTEGER DEFAULT (strftime('%s','now')), elmas INTEGER DEFAULT 100
    )`
  );
  await run(db, `INSERT INTO users VALUES (1, 't', 'x', 'Test')`);
  await run(db, `INSERT INTO players (user_id, elmas, kasa, puan) VALUES (1, 100, 10000, 1500)`);

  const {
    ensureGunlukGorevTables,
    panelGetir,
    gorevKabul,
    gorevElmasTamamla,
    gorevOdulAl,
  } = require("../game/gunlukGorevService");
  const { turkeyDayKey } = require("../game/messagingService");
  const { ELMAS_GOREV_TESLIM, MAX_KABUL } = require("../game/gunlukGorevCatalog");

  await ensureGunlukGorevTables(db);
  await panelGetir(db, 1);

  const player = { kasa: 10000, puan: 1500, icraat: 25, elmas: 100 };

  for (let slot = 1; slot <= MAX_KABUL; slot++) {
    const kabul = await gorevKabul(db, 1, slot);
    assert(kabul.ok, `slot ${slot} ücretsiz kabul: ` + (kabul.error || ""));
    assert(!kabul.elmasEkstra, `slot ${slot} elmas_ekstra olmamalı`);
  }

  const ekstraKabul = await gorevKabul(db, 1, 4);
  assert(ekstraKabul.ok, ekstraKabul.error || "4. görev kabul edilemedi");
  assert(ekstraKabul.elmasEkstra, "4. görev elmas_ekstra olmalı");
  assert(ekstraKabul.kabulSayisi === MAX_KABUL, "ücretsiz kota sayısı 3 kalmalı");

  const gunKey = turkeyDayKey();
  const ekstraRow = await get(
    db,
    `SELECT durum, elmas_ekstra FROM gunluk_gorev_atama WHERE user_id = 1 AND gun_key = ? AND slot = 4`,
    [gunKey]
  );
  assert(ekstraRow.durum === "aktif", "4. görev aktif olmalı");
  assert(ekstraRow.elmas_ekstra === 1, "4. görev elmas_ekstra işaretli olmalı");

  const elmasOnce = player.elmas;
  const sonuc = await gorevElmasTamamla(db, 1, 4, player);
  assert(sonuc.ok, sonuc.error || "elmas teslim başarısız");
  assert(player.elmas === elmasOnce - ELMAS_GOREV_TESLIM, "1 elmas düşülmedi");

  const teslimRow = await get(
    db,
    `SELECT durum, odul_alindi, elmas_ekstra FROM gunluk_gorev_atama WHERE user_id = 1 AND gun_key = ? AND slot = 4`,
    [gunKey]
  );
  assert(teslimRow.durum === "teslim_edildi", "durum teslim_edildi değil: " + teslimRow.durum);
  assert(teslimRow.odul_alindi === 1, "ödül alınmadı");

  const kabulRow = await get(
    db,
    `SELECT COUNT(*) AS n FROM gunluk_gorev_atama WHERE user_id = 1 AND gun_key = ? AND kabul_edildi = 1 AND COALESCE(elmas_ekstra, 0) = 0`,
    [gunKey]
  );
  assert((kabulRow?.n || 0) === MAX_KABUL, "ücretsiz kota yalnızca 3 görev saymalı");

  // Doğal tamamlanma + ödül alma da 1 elmas kesmeli
  await gorevKabul(db, 1, 5);
  const slot5 = await get(
    db,
    `SELECT hedef_adet_olcekli FROM gunluk_gorev_atama WHERE user_id = 1 AND gun_key = ? AND slot = 5`,
    [gunKey]
  );
  await run(
    db,
    `UPDATE gunluk_gorev_atama SET durum = 'tamamlandi', ilerleme = ? WHERE user_id = 1 AND gun_key = ? AND slot = 5`,
    [slot5.hedef_adet_olcekli, gunKey]
  );
  const elmasOnce2 = player.elmas;
  const odul = await gorevOdulAl(db, 1, 5, player);
  assert(odul.ok, odul.error || "elmaslı ödül alma başarısız");
  assert(player.elmas === elmasOnce2 - ELMAS_GOREV_TESLIM, "ödül alırken 1 elmas düşülmedi");

  console.log("OK — görev elmas teslim testleri geçti");

  db.close();
  try { fs.unlinkSync(TEST_DB); } catch (_) {}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
