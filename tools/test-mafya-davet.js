/**
 * Mafya davet akışı: lider davet → mesaj → kabul/red bildirimleri
 */
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { run, get, all } = require("../db/database");
const { davetEt, davetKabul, davetRed, kullaniciGrubu } = require("../game/mafiaService");
const { mesajlariGetir, ensureMessagingTables } = require("../game/messagingService");

const DB = path.join(__dirname, ".mafya-davet-test.db");

function openTestDb(file) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, (err) => (err ? reject(err) : resolve(db)));
  });
}

async function main() {
  try { fs.unlinkSync(DB); } catch (_) {}
  const db = await openTestDb(DB);
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      reis_adi TEXT,
      grup TEXT DEFAULT 'Bağımsız Reis',
      lakap TEXT,
      password_hash TEXT,
      created_at INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS players (
      user_id INTEGER PRIMARY KEY,
      puan INTEGER DEFAULT 0,
      guc INTEGER DEFAULT 100,
      kasa INTEGER DEFAULT 10000,
      bonus_guc INTEGER DEFAULT 0,
      profil_resmi TEXT DEFAULT '',
      last_seen_at INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_gruplari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT UNIQUE,
      aciklama TEXT DEFAULT '',
      lider_user_id INTEGER NOT NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_uyeleri (
      grup_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rutbe TEXT DEFAULT 'Mafya Üyesi',
      PRIMARY KEY (grup_id, user_id)
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_evi (
      grup_id INTEGER PRIMARY KEY,
      seviye INTEGER DEFAULT 1,
      birikmis_para INTEGER DEFAULT 0
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_basvurulari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER,
      user_id INTEGER,
      durum TEXT DEFAULT 'beklemede'
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_mesajlari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_user_id INTEGER,
      from_user_id INTEGER,
      tip TEXT,
      konu TEXT,
      icerik TEXT,
      okundu INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      grup_id INTEGER,
      grup_mesaj_id INTEGER,
      davet_id INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS user_base (
      user_id INTEGER PRIMARY KEY,
      base_seviye INTEGER DEFAULT 0
    )`
  );
  await ensureMessagingTables(db);

  const lider = (await run(db, `INSERT INTO users (username, reis_adi) VALUES ('lider1', 'LiderReis')`)).lastID;
  const uye = (await run(db, `INSERT INTO users (username, reis_adi) VALUES ('uye1', 'UyeReis')`)).lastID;
  const hedef = (await run(db, `INSERT INTO users (username, reis_adi) VALUES ('hedef1', 'HedefReis')`)).lastID;
  for (const id of [lider, uye, hedef]) {
    await run(db, `INSERT INTO players (user_id) VALUES (?)`, [id]);
    await run(db, `INSERT INTO user_base (user_id, base_seviye) VALUES (?, 0)`, [id]);
  }

  const grupId = (
    await run(db, `INSERT INTO mafya_gruplari (isim, lider_user_id) VALUES ('TestGrup', ?)`, [lider])
  ).lastID;
  await run(db, `INSERT INTO mafya_evi (grup_id, seviye, birikmis_para) VALUES (?, 1, 0)`, [grupId]);
  await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, 'Mafya Lideri')`, [
    grupId,
    lider,
  ]);
  await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, 'Mafya Üyesi')`, [
    grupId,
    uye,
  ]);

  const davetSonuc = await davetEt(db, lider, hedef);
  if (!davetSonuc.ok) throw new Error("davetEt failed: " + davetSonuc.error);

  const hedefMesajlar = await mesajlariGetir(db, hedef);
  const davetMsg = hedefMesajlar.find((m) => m.tip === "mafya_davet");
  if (!davetMsg || !davetMsg.davetAktif) throw new Error("Davet mesajı yok veya aktif değil");
  if (!davetMsg.icerik.includes("TestGrup Mafya Grubu")) throw new Error("Davet metni hatalı");

  const redSonuc = await davetRed(db, hedef, davetMsg.davetId);
  if (!redSonuc.ok) throw new Error("davetRed failed: " + redSonuc.error);

  const liderMesaj = await mesajlariGetir(db, lider);
  const redBildirim = liderMesaj.find((m) => m.icerik.includes("davetini reddetti"));
  if (!redBildirim) throw new Error("Lider red bildirimi almadı");

  const davet2 = await davetEt(db, lider, hedef);
  const hedefMesajlar2 = await mesajlariGetir(db, hedef);
  const davetMsg2 = hedefMesajlar2.find((m) => m.tip === "mafya_davet" && m.davetAktif);
  const kabulSonuc = await davetKabul(db, hedef, davetMsg2.davetId);
  if (!kabulSonuc.ok) throw new Error("davetKabul failed: " + kabulSonuc.error);

  const hedefGrup = await kullaniciGrubu(db, hedef);
  if (!hedefGrup || hedefGrup.isim !== "TestGrup") throw new Error("Hedef gruba katılmadı");

  const uyeMesaj = await mesajlariGetir(db, uye);
  const katilimBildirim = uyeMesaj.find((m) => m.icerik.includes("gruba katıldı"));
  if (!katilimBildirim) throw new Error("Grup üyesi katılım bildirimi almadı");

  console.log("OK: mafya davet akışı (davet, red bildirimi, kabul, grup bildirimi)");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
