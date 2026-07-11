/** Mafya savaşı — gazete haberleri ve güç toplamıyla kazanan */
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
      guc INTEGER NOT NULL DEFAULT 0,
      bonus_guc INTEGER NOT NULL DEFAULT 0,
      kasa INTEGER NOT NULL DEFAULT 0,
      devlet_iliskisi INTEGER NOT NULL DEFAULT 100
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_gruplari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT NOT NULL,
      lider_user_id INTEGER NOT NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_uyeleri (
      grup_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rutbe TEXT NOT NULL DEFAULT 'uye',
      UNIQUE(grup_id, user_id)
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_savaslar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saldiran_grup_id INTEGER NOT NULL,
      hedef_grup_id INTEGER NOT NULL,
      baslangic_zamani INTEGER NOT NULL,
      savas_zamani INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'bekliyor',
      kazanan_grup_id INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_savas_katilim (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      savas_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      grup_id INTEGER NOT NULL,
      UNIQUE(savas_id, user_id)
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_kiralama (
      user_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      adet INTEGER NOT NULL DEFAULT 0,
      fiyat_adet INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, item_key)
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS liman_sahiplik (
      liman_id TEXT PRIMARY KEY,
      owner_user_id INTEGER,
      last_income_hour INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sektor_sahiplik (
      user_id INTEGER NOT NULL,
      sektor TEXT NOT NULL,
      mekan_key TEXT NOT NULL,
      adet INTEGER NOT NULL DEFAULT 0,
      last_income_hour INTEGER,
      PRIMARY KEY (user_id, sektor, mekan_key)
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS baba_makamlari (
      makam TEXT PRIMARY KEY,
      owner_user_id INTEGER,
      baba_derki TEXT NOT NULL DEFAULT ''
    )`
  );
  for (const limanId of ["istanbul", "izmir", "hatay"]) {
    await run(
      db,
      `INSERT OR IGNORE INTO liman_sahiplik (liman_id, owner_user_id, last_income_hour) VALUES (?, NULL, NULL)`,
      [limanId]
    );
  }
  for (const makam of ["sozunu_gecir", "sadakat_yemini"]) {
    await run(
      db,
      `INSERT OR IGNORE INTO baba_makamlari (makam, owner_user_id, baba_derki) VALUES (?, NULL, '')`,
      [makam]
    );
  }
}

async function main() {
  const dbPath = path.join(__dirname, ".mafya-savas-test.db");
  for (const ext of ["", "-shm", "-wal"]) {
    const p = dbPath + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const db = await openTestDb(dbPath);
  await setupBaseSchema(db);
  const { ensureGazeteTable } = require("../game/sehirGazeteService");
  await ensureGazeteTable(db);

  await run(db, `INSERT INTO mafya_gruplari (id, isim, lider_user_id) VALUES (1, 'Kurtlar', 1), (2, 'Yilanlar', 4)`);
  for (const row of [
    [1, "a1", "A1"],
    [2, "a2", "A2"],
    [3, "a3", "A3"],
    [4, "b1", "B1"],
    [5, "b2", "B2"],
    [6, "b3", "B3"],
  ]) {
    await run(db, `INSERT INTO users (id, username, password_hash, reis_adi) VALUES (?, ?, 'x', ?)`, row);
    await run(db, `INSERT INTO players (user_id, guc, bonus_guc, kasa) VALUES (?, 0, 0, 0)`, [row[0]]);
  }
  for (const uid of [1, 2, 3]) await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id) VALUES (1, ?)`, [uid]);
  for (const uid of [4, 5, 6]) await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id) VALUES (2, ?)`, [uid]);

  await run(db, `UPDATE players SET guc = 100, bonus_guc = 10 WHERE user_id = 1`);
  await run(db, `UPDATE players SET guc = 50, bonus_guc = 0 WHERE user_id = 2`);
  await run(db, `UPDATE players SET guc = 200, bonus_guc = 50 WHERE user_id = 4`);
  await run(db, `UPDATE players SET guc = 10, bonus_guc = 0 WHERE user_id = 5`);
  await run(db, `UPDATE players SET guc = 10, bonus_guc = 0 WHERE user_id = 6`);

  const { savasIlanEt, savasaKatil, savasiCoz, grupKatilimciToplamGuc } = require("../game/mafyaSavasService");

  const ilan = await savasIlanEt(db, 1, 2);
  if (!ilan.ok) throw new Error(ilan.error);

  const ilanHaber = await get(
    db,
    `SELECT mesaj FROM sehir_gazete WHERE mesaj LIKE '%savaş ilan etti%' ORDER BY id DESC LIMIT 1`
  );
  if (!ilanHaber?.mesaj?.includes("Kurtlar") || !ilanHaber.mesaj.includes("8 saat")) {
    throw new Error("İlan gazetesi eksik: " + (ilanHaber?.mesaj || ""));
  }

  const savas = await get(db, `SELECT id, savas_zamani FROM mafya_savaslar ORDER BY id DESC LIMIT 1`);
  await savasaKatil(db, savas.id, 1, 1);
  await savasaKatil(db, savas.id, 2, 1);
  await savasaKatil(db, savas.id, 4, 2);
  await savasaKatil(db, savas.id, 5, 2);
  await savasaKatil(db, savas.id, 6, 2);

  const saldiranGuc = await grupKatilimciToplamGuc(db, savas.id, 1);
  const hedefGuc = await grupKatilimciToplamGuc(db, savas.id, 2);
  if (saldiranGuc.toplam !== 160) throw new Error("Saldıran güç beklenen 160 değil: " + saldiranGuc.toplam);
  if (hedefGuc.toplam !== 270) throw new Error("Hedef güç beklenen 270 değil: " + hedefGuc.toplam);

  await run(db, `UPDATE mafya_savaslar SET savas_zamani = ? WHERE id = ?`, [Date.now() - 1000, savas.id]);
  await savasiCoz(db);

  const sonuc = await get(db, `SELECT durum, kazanan_grup_id FROM mafya_savaslar WHERE id = ?`, [savas.id]);
  if (sonuc.durum !== "tamamlandi" || sonuc.kazanan_grup_id !== 2) {
    throw new Error("Kazanan hedef grup olmalı (güç 270 > 160), alınan: " + JSON.stringify(sonuc));
  }

  const sonucHaber = await get(
    db,
    `SELECT mesaj FROM sehir_gazete WHERE mesaj LIKE '%Mafya Savaşı sonuçlandı%' ORDER BY id DESC LIMIT 1`
  );
  if (!sonucHaber?.mesaj?.includes("Yilanlar") || !sonucHaber.mesaj.includes("Kurtlar")) {
    throw new Error("Sonuç gazetesi eksik: " + (sonucHaber?.mesaj || ""));
  }

  console.log("OK mafya savaşı gazete —", sonucHaber.mesaj.slice(0, 100) + "...");
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
