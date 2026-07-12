#!/usr/bin/env node
/** Piyango devreden odulunu geri yukler ve world-state snapshot yazar */
const { initDatabase, DB_PATH } = require("../db/database");
const { jackpotBirikimAyarla, buyukOdulToplam, aktifCekilisOzet } = require("../game/kumarhanePiyangoService");
const { exportWorldState, importWorldState } = require("../game/worldStateSnapshot");
const { exportSnapshotsToSeed } = require("../game/oyuncuRestoreService");
const fs = require("fs");
const path = require("path");

const TARGET = Number(process.argv[2] || 900000);

async function main() {
  process.env.DATABASE_PATH = DB_PATH;
  const db = await initDatabase();
  const ozet = await aktifCekilisOzet(db);
  const cekilisId = ozet?.id;
  const before = cekilisId ? await buyukOdulToplam(db, cekilisId) : { buyukOdul: 0, devreden: 0 };

  await jackpotBirikimAyarla(db, TARGET);
  const after = cekilisId ? await buyukOdulToplam(db, cekilisId) : { buyukOdul: TARGET, devreden: TARGET };
  await exportWorldState(db);
  await exportSnapshotsToSeed(db, { merge: true });
  fs.copyFileSync(DB_PATH, path.join(process.cwd(), "seed", "oyun.db"));

  console.log(
    JSON.stringify(
      {
        targetJackpot: TARGET,
        before,
        after,
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
