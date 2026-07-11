#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { initDatabase, get, DB_PATH } = require("../db/database");
const { applyForceSnapshot } = require("../game/oyuncuRestoreService");
const { exportPlayerSnapshot } = require("../game/adminService");

async function main() {
  const upload = process.argv.includes("--upload");
  const snapPath = path.join(process.cwd(), "seed", "oyuncular", "dd1.json");
  const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));

  const db = await initDatabase();
  const user = await get(db, `SELECT id FROM users WHERE username = 'dd1'`);
  if (!user) throw new Error("dd1 bulunamadi");

  await applyForceSnapshot(db, user.id, snap);

  const full = await exportPlayerSnapshot(db, user.id);
  console.log("dd1 puan:", full.istatistikler.puan);
  console.log("dd1 kasa:", full.istatistikler.kasa);

  await new Promise((resolve) => db.close(() => resolve()));

  const seedDb = path.join(process.cwd(), "seed", "oyun.db");
  fs.copyFileSync(DB_PATH, seedDb);
  console.log("seed/oyun.db guncellendi");

  if (upload) {
    if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = require("ws");
    const { uploadDbBackup } = require("../services/supabaseBackupService");
    const up = await uploadDbBackup(DB_PATH);
    console.log("supabase:", up);
    if (!up.uploaded) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
