#!/usr/bin/env node
const path = require("path");
const fs = require("fs");

const TEST_DB = path.join(__dirname, ".basari-rozet-test.db");
for (const p of [TEST_DB, TEST_DB + "-shm", TEST_DB + "-wal"]) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}
process.env.DATABASE_PATH = TEST_DB;
process.env.NODE_ENV = "test";
process.env.SKIP_SUPABASE = "1";

const { initDatabase, run, get } = require("../db/database");
const { oyuncuBasariRozetleri, BASARI_ROZETLER, ensureBasariColumns } = require("../game/basariRozetService");
const { istanbulGunKey, gunKeyEkle } = require("../game/turkiyeSaati");

async function main() {
  const db = await initDatabase();
  const { DB_PATH } = require("../db/database");
  if (path.resolve(DB_PATH) !== path.resolve(TEST_DB)) {
    throw new Error("test must use isolated DB, got " + DB_PATH);
  }

  const uid = 9201;
  const now = Math.floor(Date.now() / 1000);

  await run(
    db,
    `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi, created_at, last_login_at)
     VALUES (?, 'basarit', 'x', 'BasariT', ?, ?)`,
    [uid, now - 400 * 86400, now]
  );
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas, profil_resmi, sehre_hukmet_sayisi)
     VALUES (?, 100000, 1000, 100, 10, 100, 0, 'erkek-01', 2)`,
    [uid]
  );

  await ensureBasariColumns(db);
  await run(db, `UPDATE players SET basari_login_meta = ? WHERE user_id = ?`, [
    JSON.stringify({ sonGun: gunKeyEkle(istanbulGunKey(), -1), streak: 6 }),
    uid,
  ]);

  await run(db, `INSERT OR REPLACE INTO sistem_gunluk (anahtar, deger, guncelleme) VALUES (?, ?, ?)`, [
    "gazete_kabus_2026-07-01",
    JSON.stringify({ userId: uid, isim: "BasariT", puan: 12 }),
    now,
  ]);

  try {
    await run(
      db,
      `INSERT INTO kumarhane_piyango_bilet (cekilis_id, user_id, sayilar, eslesme, odul)
       VALUES (1, ?, '[1,2,3,4,5,6]', 6, 9000)`,
      [uid]
    );
  } catch (_) {
    await run(
      db,
      `CREATE TABLE IF NOT EXISTS kumarhane_piyango_bilet (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cekilis_id INTEGER,
        user_id INTEGER,
        sayilar TEXT,
        eslesme INTEGER DEFAULT 0,
        odul INTEGER DEFAULT 0
      )`
    );
    await run(
      db,
      `INSERT INTO kumarhane_piyango_bilet (cekilis_id, user_id, sayilar, eslesme, odul)
       VALUES (1, ?, '[1,2,3,4,5,6]', 6, 9000)`,
      [uid]
    );
  }

  try {
    await run(db, `INSERT OR REPLACE INTO oyuncu_meslek (user_id, meslek_id) VALUES (?, 'garson')`, [uid]);
  } catch (_) {
    await run(db, `CREATE TABLE IF NOT EXISTS oyuncu_meslek (user_id INTEGER PRIMARY KEY, meslek_id TEXT)`);
    await run(db, `INSERT OR REPLACE INTO oyuncu_meslek (user_id, meslek_id) VALUES (?, 'garson')`, [uid]);
  }

  try {
    await run(db, `INSERT INTO oyuncu_sirketleri (sahip_user_id, tur_id, isim) VALUES (?, 'cafe', 'Test Co')`, [
      uid,
    ]);
  } catch (_) {}

  let grupId = 8801;
  try {
    await run(db, `INSERT INTO mafya_gruplari (id, isim, lider_user_id) VALUES (?, 'BasariGrup', ?)`, [
      grupId,
      uid,
    ]);
  } catch (_) {
    const g = await get(db, `SELECT id FROM mafya_gruplari WHERE lider_user_id = ?`, [uid]);
    if (g?.id) grupId = g.id;
  }
  try {
    await run(
      db,
      `INSERT OR REPLACE INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, 'Mafya Lideri')`,
      [grupId, uid]
    );
  } catch (_) {}

  const sonuc = await oyuncuBasariRozetleri(db, uid, { syncLogin: true });
  const unlocked = new Set(sonuc.unlockedIds);
  const expected = [
    "nightmare",
    "lottery_winner",
    "rule_city",
    "daily_player",
    "yearly_player",
    "npc_worker",
    "mafia_member",
    "mafia_leader",
  ];
  const missing = expected.filter((id) => !unlocked.has(id));
  if (missing.length) {
    throw new Error("missing unlocks: " + missing.join(",") + " got=" + [...unlocked].join(","));
  }
  if (sonuc.liste.length !== BASARI_ROZETLER.length) {
    throw new Error("liste length mismatch");
  }
  const nightmare = sonuc.liste.find((x) => x.id === "nightmare");
  if (!nightmare || nightmare.count < 1) {
    throw new Error("nightmare count missing");
  }
  const rule = sonuc.liste.find((x) => x.id === "rule_city");
  if (!rule || rule.count < 2) {
    throw new Error("rule_city count expected >=2 got " + (rule && rule.count));
  }

  // İkinci kabus günü → sayaç artsın
  await run(db, `INSERT OR REPLACE INTO sistem_gunluk (anahtar, deger, guncelleme) VALUES (?, ?, ?)`, [
    "gazete_kabus_2026-07-02",
    JSON.stringify({ userId: uid, isim: "BasariT", puan: 9 }),
    now,
  ]);
  const tekrar = await oyuncuBasariRozetleri(db, uid, { syncLogin: false });
  const n2 = tekrar.liste.find((x) => x.id === "nightmare");
  if (!n2 || n2.count < 2) {
    throw new Error("nightmare count should be >=2 after second kabus");
  }

  console.log("OK basari-rozet", sonuc.unlockedIds.join(","), "nightmare=" + n2.count);
}

main().catch((err) => {
  console.error("FAIL", err.message || err);
  process.exit(1);
});
