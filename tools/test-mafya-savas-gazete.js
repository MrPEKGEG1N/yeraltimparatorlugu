/** Mafya savaşı — gazete, lider otomatik katılım, %10 güç kaybı, oyundan gizli ödül */
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
    `CREATE TABLE IF NOT EXISTS oyuncu_mesajlari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_user_id INTEGER NOT NULL,
      from_user_id INTEGER,
      tip TEXT NOT NULL DEFAULT 'ozel',
      konu TEXT NOT NULL DEFAULT '',
      icerik TEXT NOT NULL,
      okundu INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
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
  const { ensureMessagingTables } = require("../game/messagingService");
  await ensureGazeteTable(db);
  await ensureMessagingTables(db);

  await run(db, `INSERT INTO mafya_gruplari (id, isim, lider_user_id) VALUES (1, 'Kurtlar', 1), (2, 'Yilanlar', 4), (3, 'Kartallar', 7)`);
  for (const row of [
    [1, "a1", "A1"],
    [2, "a2", "A2"],
    [3, "a3", "A3"],
    [4, "b1", "B1"],
    [5, "b2", "B2"],
    [6, "b3", "B3"],
    [7, "c1", "C1"],
    [8, "c2", "C2"],
    [9, "c3", "C3"],
  ]) {
    await run(db, `INSERT INTO users (id, username, password_hash, reis_adi) VALUES (?, ?, 'x', ?)`, row);
    await run(db, `INSERT INTO players (user_id, guc, bonus_guc, kasa) VALUES (?, 0, 0, 0)`, [row[0]]);
  }
  for (const uid of [1, 2, 3]) await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id) VALUES (1, ?)`, [uid]);
  for (const uid of [4, 5, 6]) await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id) VALUES (2, ?)`, [uid]);
  for (const uid of [7, 8, 9]) await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id) VALUES (3, ?)`, [uid]);

  await run(db, `UPDATE players SET guc = 100, bonus_guc = 10, kasa = 50000 WHERE user_id = 1`);
  await run(db, `UPDATE players SET guc = 50, bonus_guc = 0, kasa = 50000 WHERE user_id = 2`);
  await run(db, `UPDATE players SET guc = 200, bonus_guc = 50, kasa = 0 WHERE user_id = 4`);
  await run(db, `UPDATE players SET guc = 10, bonus_guc = 0, kasa = 0 WHERE user_id = 5`);
  await run(db, `UPDATE players SET guc = 10, bonus_guc = 0, kasa = 0 WHERE user_id = 6`);

  const {
    savasIlanEt,
    savasaKatil,
    savasiCoz,
    grupKatilimciToplamGuc,
    grupAktifSavasVarMi,
    GUC_KAYBI_ORANI,
    KAYIP_ODEME_BIRIM,
  } = require("../game/mafyaSavasService");
  const { guruptanCik } = require("../game/mafiaService");

  const ilan = await savasIlanEt(db, 1, 2);
  if (!ilan.ok) throw new Error(ilan.error);

  const savas = await get(db, `SELECT id, savas_zamani FROM mafya_savaslar ORDER BY id DESC LIMIT 1`);
  const liderKatilim = await all(db, `SELECT user_id FROM mafya_savas_katilim WHERE savas_id = ?`, [savas.id]);
  const liderIds = liderKatilim.map((r) => r.user_id).sort();
  if (JSON.stringify(liderIds) !== JSON.stringify([1, 4])) {
    throw new Error("Liderler otomatik katılmalı (1 ve 4): " + JSON.stringify(liderIds));
  }

  if (!(await grupAktifSavasVarMi(db, 1)) || !(await grupAktifSavasVarMi(db, 2))) {
    throw new Error("Her iki grup da aktif savaşta görünmeli");
  }

  const cikis = await guruptanCik(db, 2, { kasa: 2_000_000 });
  if (cikis.ok) throw new Error("Aktif savaşta gruptan çıkış engellenmeli");

  const ilanHaber = await get(
    db,
    `SELECT mesaj FROM sehir_gazete WHERE mesaj LIKE '%savaş ilan etti%' ORDER BY id DESC LIMIT 1`
  );
  if (!ilanHaber?.mesaj?.includes("Kurtlar") || !ilanHaber.mesaj.includes("8 saat")) {
    throw new Error("İlan gazetesi eksik: " + (ilanHaber?.mesaj || ""));
  }

  await savasaKatil(db, savas.id, 2, 1);
  await savasaKatil(db, savas.id, 5, 2);
  await savasaKatil(db, savas.id, 6, 2);

  const tekrar = await savasaKatil(db, savas.id, 1, 1);
  if (tekrar.ok) throw new Error("Katılan oyuncu tekrar katılamamalı");

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

  const p1 = await get(db, `SELECT guc, bonus_guc, kasa FROM players WHERE user_id = 1`);
  const p2 = await get(db, `SELECT guc, bonus_guc, kasa FROM players WHERE user_id = 2`);
  const p4 = await get(db, `SELECT guc, bonus_guc, kasa FROM players WHERE user_id = 4`);
  const p5 = await get(db, `SELECT guc, bonus_guc, kasa FROM players WHERE user_id = 5`);
  const p6 = await get(db, `SELECT guc, bonus_guc, kasa FROM players WHERE user_id = 6`);

  const beklenenGuc1 = Math.max(0, Math.floor((100 + 10) * (1 - GUC_KAYBI_ORANI)) - 10);
  if (p1.guc !== beklenenGuc1) throw new Error(`Oyuncu 1 güç ${p1.guc}, beklenen ${beklenenGuc1}`);
  const beklenenGuc2 = Math.floor(50 * (1 - GUC_KAYBI_ORANI));
  if (p2.guc !== beklenenGuc2) throw new Error(`Oyuncu 2 güç ${p2.guc}, beklenen ${beklenenGuc2}`);

  if (p1.kasa !== 50000) throw new Error(`Kaybeden 1 kasa değişmemeli: ${p1.kasa}`);
  if (p2.kasa !== 50000) throw new Error(`Kaybeden 2 kasa değişmemeli: ${p2.kasa}`);

  const toplamOdul = 2 * KAYIP_ODEME_BIRIM;
  const kazananToplam = p4.kasa + p5.kasa + p6.kasa;
  if (kazananToplam !== toplamOdul) {
    throw new Error(`Kazananlara oyundan verilen ${kazananToplam}, beklenen ${toplamOdul}`);
  }

  const sonucHaber = await get(
    db,
    `SELECT mesaj FROM sehir_gazete WHERE mesaj LIKE '%karşı savaşı kazandı%' ORDER BY id DESC LIMIT 1`
  );
  if (!sonucHaber?.mesaj?.includes("Yilanlar") || !sonucHaber.mesaj.includes("Kurtlar")) {
    throw new Error("Sonuç gazetesi eksik: " + (sonucHaber?.mesaj || ""));
  }
  if (!sonucHaber.mesaj.includes("gözler üzerinde")) {
    throw new Error("Gazete sonuç metni eksik");
  }

  const kazananMesaj = await get(
    db,
    `SELECT icerik FROM oyuncu_mesajlari WHERE to_user_id = 4 AND tip = 'mafya_savas' ORDER BY id DESC LIMIT 1`
  );
  if (!kazananMesaj?.icerik?.includes("kazandınız")) {
    throw new Error("Kazanan mesaj kutusu raporu eksik");
  }

  const kaybedenMesaj = await get(
    db,
    `SELECT icerik FROM oyuncu_mesajlari WHERE to_user_id = 1 AND tip = 'mafya_savas' ORDER BY id DESC LIMIT 1`
  );
  if (!kaybedenMesaj?.icerik?.includes("kaybettiniz")) {
    throw new Error("Kaybeden mesaj kutusu raporu eksik");
  }

  const saldiranTekrar = await savasIlanEt(db, 1, 3);
  if (saldiranTekrar.ok) throw new Error("Saldıran grup 2 gün beklemeden savaş açmamalı");
  if (!saldiranTekrar.error?.includes("yeni savaş başlatabilirsin")) {
    throw new Error("Saldıran bekleme mesajı beklenen değil: " + saldiranTekrar.error);
  }

  const hedefKoruma = await savasIlanEt(db, 2, 1);
  if (hedefKoruma.ok) throw new Error("Yenilen gruba savaş açılmamalı");
  if (!hedefKoruma.error?.includes("savaştan yeni çıktı")) {
    throw new Error("Yenilgi koruma mesajı beklenen değil: " + hedefKoruma.error);
  }

  const yenilenSavunanSaldir = await (async () => {
    await run(
      db,
      `INSERT INTO mafya_savaslar (saldiran_grup_id, hedef_grup_id, baslangic_zamani, savas_zamani, durum, kazanan_grup_id)
       VALUES (2, 3, ?, ?, 'tamamlandi', 2)`,
      [Date.now() - 100_000, Date.now() - 1000]
    );
    return savasIlanEt(db, 3, 2);
  })();
  if (!yenilenSavunanSaldir.ok) {
    throw new Error("Yenilen savunan grup savaş açabilmeli: " + yenilenSavunanSaldir.error);
  }

  console.log("OK mafya savaşı kuralları —", sonucHaber.mesaj.slice(0, 100) + "...");
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
