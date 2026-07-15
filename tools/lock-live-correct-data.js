#!/usr/bin/env node
/**
 * Canli ekrandaki dogru liderlik + gazete verisini seed'e kilitler.
 * Kaynak: 16 Tem 2026 canli ekran (kullanici dogruladi)
 */
const fs = require("fs");
const path = require("path");
const { initDatabase, DB_PATH, run, get } = require("../db/database");
const { exportSnapshotsToSeed } = require("../game/oyuncuRestoreService");
const { exportWorldState } = require("../game/worldStateSnapshot");
const { jackpotBirikimAyarla } = require("../game/kumarhanePiyangoService");
const { kabusHaberMetni, gazeteEkle, zamanDamgasi } = require("../game/sehirGazeteService");
const {
  istanbulGunKey,
  gunKeyEkle,
  istanbulGunBaslangicUnix,
} = require("../game/turkiyeSaati");

const ROOT = process.cwd();
const SEED_DB = path.join(ROOT, "seed", "oyun.db");

const PUANLAR = {
  dd1: 305150,
  dcdc1: 182434,
  mrpekgeg1n: 8712,
  bgrjrakn: 3103,
  deniz: 1500,
  bihtersel: 1500,
  dogac123: 1500,
};

const JACKPOT_DEVREDEN = 1_800_000;

async function userRow(db, username) {
  return get(
    db,
    `SELECT u.id, u.username, u.reis_adi, p.puan FROM users u JOIN players p ON p.user_id=u.id WHERE LOWER(u.username)=LOWER(?)`,
    [username]
  );
}

async function setPuan(db, username, puan) {
  const u = await userRow(db, username);
  if (!u) {
    console.warn("[skip] kullanici yok:", username);
    return null;
  }
  await run(db, `UPDATE players SET puan = ? WHERE user_id = ?`, [puan, u.id]);
  return { username, puan, onceki: u.puan };
}

async function setKabusDd1(db) {
  const dd1 = await userRow(db, "dd1");
  if (!dd1) throw new Error("dd1 yok");
  const bugun = istanbulGunKey();
  const dun = gunKeyEkle(bugun, -1);
  const haber = kabusHaberMetni(dd1.reis_adi || "dd1", PUANLAR.dd1, 0);
  const kayit = {
    gunKey: dun,
    userId: dd1.id,
    isim: dd1.reis_adi || "dd1",
    sayginlik: PUANLAR.dd1,
    icraat: 0,
    icraatIs: 0,
    puan: PUANLAR.dd1,
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
    [`gazete_kabus_${dun}`, JSON.stringify(kayit)]
  );
  const bitis = istanbulGunBaslangicUnix(bugun);
  const mevcut = await get(
    db,
    `SELECT id FROM sehir_gazete WHERE mesaj LIKE '%Şehrin Yeni Kabusu:%' ORDER BY id DESC LIMIT 1`
  );
  const full = `${zamanDamgasi(bitis)} — ${haber.baslik}`;
  if (mevcut?.id) {
    await run(db, `UPDATE sehir_gazete SET mesaj = ? WHERE id = ?`, [full, mevcut.id]);
  } else {
    await gazeteEkle(db, haber.baslik, bitis);
  }
  return haber;
}

async function main() {
  process.env.DATABASE_PATH = DB_PATH;
  const db = await initDatabase();

  const results = {};
  for (const [username, puan] of Object.entries(PUANLAR)) {
    results[username] = await setPuan(db, username, puan);
  }

  await jackpotBirikimAyarla(db, JACKPOT_DEVREDEN);
  const kabus = await setKabusDd1(db);
  await exportWorldState(db);
  const n = await exportSnapshotsToSeed(db, { merge: true });
  fs.copyFileSync(DB_PATH, SEED_DB);

  for (const username of Object.keys(PUANLAR)) {
    const p = path.join(ROOT, "seed", "oyuncular", `${username}.json`);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    j.force_restore = true;
    if (j.player) j.player.puan = PUANLAR[username];
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  }

  console.log(
    JSON.stringify(
      {
        puanlar: results,
        jackpotDevreden: JACKPOT_DEVREDEN,
        buyukOdulEkran: 2_250_000,
        kabus: kabus.baslik,
        snapshots: n,
      },
      null,
      2
    )
  );

  await new Promise((r) => db.close(() => r()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
