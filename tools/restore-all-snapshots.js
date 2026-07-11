#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { initDatabase, DB_PATH } = require("../db/database");
const { restoreOyuncuSnapshots } = require("../game/oyuncuRestoreService");
const { exportPlayerSnapshot } = require("../game/adminService");

async function main() {
  const upload = process.argv.includes("--upload");
  const db = await initDatabase();
  const results = await restoreOyuncuSnapshots(db);
  console.log("restore results:", JSON.stringify(results, null, 2));

  for (const name of ["dd1", "mrpekgeg1n"]) {
    const u = await new Promise((res, rej) =>
      db.get(`SELECT id FROM users WHERE username = ?`, [name], (e, r) => (e ? rej(e) : res(r)))
    );
    if (!u) continue;
    const snap = await exportPlayerSnapshot(db, u.id);
    console.log(
      name,
      "puan=",
      snap.istatistikler.puan,
      "kasa=",
      snap.istatistikler.kasa,
      "meslek=",
      snap.aktifMeslek?.unvan || "-"
    );
  }

  const seedDb = path.join(process.cwd(), "seed", "oyun.db");
  await new Promise((resolve) => db.close(() => resolve()));
  for (const ext of ["-shm", "-wal"]) {
    const sidecar = seedDb + ext;
    try {
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    } catch (_) {}
  }
  fs.copyFileSync(DB_PATH, seedDb);
  console.log("seed/oyun.db guncellendi");

  if (upload) {
    if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = require("ws");
    const { uploadDbBackup } = require("../services/supabaseBackupService");
    const up = await uploadDbBackup(DB_PATH);
    console.log("supabase upload:", up);
    if (!up.uploaded) process.exit(1);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
