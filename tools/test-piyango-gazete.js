/** Piyango günlük gazete — günde bir kez + ödül artınca güncelleme */
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { run, get, all } = require("../db/database");

function openTestDb(file) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, (err) => (err ? reject(err) : resolve(db)));
  });
}

async function setupBaseSchema(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      reis_adi TEXT NOT NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS players (
      user_id INTEGER PRIMARY KEY,
      elmas INTEGER NOT NULL DEFAULT 0,
      kasa INTEGER NOT NULL DEFAULT 0,
      kara_listede INTEGER NOT NULL DEFAULT 0
    )`
  );
}

async function main() {
  process.env.KUMARHANE_PIYANGO = "1";
  const dbPath = path.join(__dirname, ".piyango-gazete-test.db");
  for (const ext of ["", "-shm", "-wal"]) {
    const p = dbPath + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const db = await openTestDb(dbPath);
  await setupBaseSchema(db);
  await run(db, `INSERT INTO users (id, username, password_hash, reis_adi) VALUES (1, 't', 'x', 'Test')`);
  await run(db, `INSERT INTO players (user_id, elmas, kasa) VALUES (1, 0, 0)`);

  const { ensureKumarhaneTables, chipGuncelle } = require("../game/kumarhaneService");
  await ensureKumarhaneTables(db);
  await chipGuncelle(db, 1, 5_000_000);

  const {
    gunlukPiyangoGazeteHaber,
    jackpotBirikimAyarla,
    biletAl,
    panelVerisiGetir,
    buyukOdulToplam,
  } = require("../game/kumarhanePiyangoService");
  const { ensureGazeteTable, gunlukHaberUret } = require("../game/sehirGazeteService");
  const { istanbulGunKey } = require("../game/turkiyeSaati");

  await ensureGazeteTable(db);
  await panelVerisiGetir(db, 1);

  await jackpotBirikimAyarla(db, 0);
  const b1 = await biletAl(db, 1, [1, 2, 3, 4, 5, 6]);
  if (!b1.ok) throw new Error(b1.error);

  const aktif = await get(
    db,
    `SELECT id FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
  );
  await run(
    db,
    `UPDATE kumarhane_piyango_cekilis SET piyango_gazete_gun = NULL, piyango_gazete_odul = 0 WHERE id = ?`,
    [aktif.id]
  );

  const onceki = await all(
    db,
    `SELECT id FROM sehir_gazete WHERE mesaj LIKE '%Kumarhane Piyangosu%'`
  );

  if (!(await gunlukPiyangoGazeteHaber(db))) throw new Error("İlk gazete haberi eklenmedi");

  const sonraki1 = await all(
    db,
    `SELECT id, mesaj FROM sehir_gazete WHERE mesaj LIKE '%Kumarhane Piyangosu%' ORDER BY id DESC`
  );
  if (sonraki1.length - onceki.length !== 1) {
    throw new Error(`İlk çağrıda 1 haber bekleniyordu, fark: ${sonraki1.length - onceki.length}`);
  }

  const row1 = await get(
    db,
    `SELECT piyango_gazete_gun, piyango_gazete_odul FROM kumarhane_piyango_cekilis WHERE id = ?`,
    [aktif.id]
  );
  if (row1.piyango_gazete_gun !== istanbulGunKey()) {
    throw new Error("piyango_gazete_gun güncellenmedi");
  }

  if (await gunlukPiyangoGazeteHaber(db)) {
    throw new Error("Aynı gün ve ödülde ikinci çağrı haber eklememeli");
  }

  const oncekiOdul = (await buyukOdulToplam(db, aktif.id)).buyukOdul;
  await jackpotBirikimAyarla(db, 250_000);
  if (!(await gunlukPiyangoGazeteHaber(db))) {
    throw new Error("Devreden artınca gazete güncellenmedi");
  }

  const sonraki2 = await all(
    db,
    `SELECT id, mesaj FROM sehir_gazete WHERE mesaj LIKE '%Kumarhane Piyangosu%' ORDER BY id DESC`
  );
  if (sonraki2.length <= sonraki1.length) {
    throw new Error("Ödül artınca gazete güncellenmedi");
  }
  if (!sonraki2[0].mesaj.includes("yükseldi")) {
    throw new Error("Güncelleme haberi bekleniyordu: " + sonraki2[0].mesaj);
  }
  if (!sonraki2[0].mesaj.includes("Devreden")) {
    throw new Error("Devreden metni gazetede yok");
  }

  await gunlukHaberUret(db);
  const sonraki3 = await all(
    db,
    `SELECT id FROM sehir_gazete WHERE mesaj LIKE '%Kumarhane Piyangosu%' ORDER BY id DESC`
  );
  if (sonraki3.length !== sonraki2.length) {
    throw new Error("gunlukHaberUret gereksiz yinelenen piyango haberi ekledi");
  }

  const yeniOdul = (await buyukOdulToplam(db, aktif.id)).buyukOdul;
  if (yeniOdul <= oncekiOdul) throw new Error("Ödül artışı hesaplanmadı");

  console.log("OK piyango gazete —", sonraki2[0].mesaj.slice(0, 90) + "...");
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
