#!/usr/bin/env node
/**
 * Kayip ~1 saatlik veriyi geri yukler (yedekte bulunamayan):
 * - dd1: 302000 sayginlik, son 10 icraat isi
 * - mrpekgeg1n: gazete "Sehrin Yeni Kabusu" manseti
 */
const fs = require("fs");
const path = require("path");
const { initDatabase, DB_PATH, run, get, all } = require("../db/database");
const { exportSnapshotsToSeed } = require("../game/oyuncuRestoreService");
const { kabusHaberMetni, gazeteEkle } = require("../game/sehirGazeteService");
const {
  istanbulGunKey,
  gunKeyEkle,
  istanbulGunBaslangicUnix,
} = require("../game/turkiyeSaati");

const ROOT = process.cwd();
const SEED_DB = path.join(ROOT, "seed", "oyun.db");
const DD1_PUAN = 302000;
const MR_ICRAAT_IS = 10;
const MR_SAYGINLIK = 847;
const ONE_HOUR_AGO = Math.floor(Date.now() / 1000) - 3600;

async function userByName(db, username) {
  return get(
    db,
    `SELECT u.id, u.reis_adi, p.puan, p.icraat FROM users u JOIN players p ON p.user_id=u.id WHERE u.username=?`,
    [username]
  );
}

async function ensureStatRows(db, userId, rows) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS stat_hareketleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tip TEXT NOT NULL,
      delta INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  for (const r of rows) {
    await run(
      db,
      `INSERT INTO stat_hareketleri (user_id, tip, delta, created_at) VALUES (?, ?, ?, ?)`,
      [userId, r.tip, r.delta, r.ts]
    );
  }
}

async function setKabus(db, gunKey, userId, isim, sayginlik, icraatIs) {
  const haber = kabusHaberMetni(isim, sayginlik, icraatIs);
  const kayit = {
    gunKey,
    userId,
    isim,
    sayginlik,
    icraat: 0,
    icraatIs,
    puan: sayginlik + icraatIs,
    baslik: haber.baslik,
    metin: haber.metin,
  };
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sistem_gunluk (
      anahtar TEXT PRIMARY KEY,
      deger TEXT NOT NULL,
      guncelleme INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );
  await run(
    db,
    `INSERT OR REPLACE INTO sistem_gunluk (anahtar, deger, guncelleme) VALUES (?, ?, strftime('%s','now'))`,
    [`gazete_kabus_${gunKey}`, JSON.stringify(kayit)]
  );
  return haber;
}

async function main() {
  process.env.DATABASE_PATH = DB_PATH;
  const db = await initDatabase();

  const dd1 = await userByName(db, "dd1");
  const mr = await userByName(db, "mrpekgeg1n");
  if (!dd1?.id || !mr?.id) throw new Error("dd1 veya mrpekgeg1n bulunamadi");

  const puanFark = DD1_PUAN - (dd1.puan || 0);
  if (puanFark > 0) {
    await run(db, `UPDATE players SET puan = ? WHERE user_id = ?`, [DD1_PUAN, dd1.id]);
    await ensureStatRows(db, dd1.id, [
      { tip: "sayginlik", delta: puanFark, ts: ONE_HOUR_AGO },
      ...Array.from({ length: 10 }, (_, i) => ({
        tip: "icraat_is",
        delta: 1,
        ts: ONE_HOUR_AGO - i * 120,
      })),
    ]);
  }

  const bugun = istanbulGunKey();
  const dun = gunKeyEkle(bugun, -1);
  const dunBas = istanbulGunBaslangicUnix(dun);
  const dunBit = istanbulGunBaslangicUnix(bugun);
  const mrTsBase = Math.min(dunBit - 3600, ONE_HOUR_AGO);

  await ensureStatRows(db, mr.id, [
    { tip: "sayginlik", delta: MR_SAYGINLIK, ts: mrTsBase },
    ...Array.from({ length: MR_ICRAAT_IS }, (_, i) => ({
      tip: "icraat_is",
      delta: 1,
      ts: mrTsBase - i * 300,
    })),
  ]);

  const haber = await setKabus(db, dun, mr.id, mr.reis_adi, MR_SAYGINLIK, MR_ICRAAT_IS);
  await gazeteEkle(db, haber.baslik, mrTsBase);

  const n = await exportSnapshotsToSeed(db, { merge: true });
  fs.copyFileSync(DB_PATH, SEED_DB);

  const verify = {
    dd1: await userByName(db, "dd1"),
    mr: await userByName(db, "mrpekgeg1n"),
    kabus: await get(db, `SELECT deger FROM sistem_gunluk WHERE anahtar=?`, [`gazete_kabus_${dun}`]),
    snapshots: n,
  };
  console.log(JSON.stringify(verify, null, 2));

  await new Promise((r) => db.close(() => r()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
