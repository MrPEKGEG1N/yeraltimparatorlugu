#!/usr/bin/env node
/**
 * dd1 tam geri yukleme — istatistik + gece kulubu + mafya + sehre hukmet.
 * Kullanim: node tools/restore-dd1-full.js [--upload] [--from-backup]
 */
const fs = require("fs");
const path = require("path");
const { initDatabase, get, DB_PATH } = require("../db/database");
const { restoreOneSnapshot } = require("../game/oyuncuRestoreService");
const { exportPlayerSnapshot } = require("../game/adminService");
const { sehreHukmediyorMu } = require("../game/karaListeService");

const PRE_SUPABASE_BACKUP = path.join(process.cwd(), "db", "backups", "oyun-2026-06-30.db");

async function main() {
  const upload = process.argv.includes("--upload");
  const fromBackup = process.argv.includes("--from-backup");

  if (fromBackup && fs.existsSync(PRE_SUPABASE_BACKUP)) {
    fs.copyFileSync(PRE_SUPABASE_BACKUP, DB_PATH);
    console.log("Pre-supabase yedek yuklendi:", PRE_SUPABASE_BACKUP);
  }

  const snapPath = path.join(process.cwd(), "seed", "oyuncular", "dd1.json");
  const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));

  const db = await initDatabase();
  const result = await restoreOneSnapshot(db, snap);
  if (!result.ok) {
    console.error("Restore basarisiz:", result);
    process.exit(1);
  }

  const full = await exportPlayerSnapshot(db, result.userId);
  const hukmeder = await sehreHukmediyorMu(db, result.userId);
  console.log("dd1 restore OK");
  console.log("- kasa:", full.istatistikler.kasa);
  console.log("- mekanToplam:", full.mekanToplam);
  console.log("- sahipSirket:", full.sahipSirket);
  console.log("- mafyaUyelik:", full.mafyaUyelik);
  console.log("- profil:", full.profil);
  console.log("- karaListede:", full.istatistikler.karaListede);
  console.log("- limanlar:", full.limanlar);
  console.log("- babaMakamlari:", full.babaMakamlari);
  console.log("- sehreHukmeder:", hukmeder);
  console.log("- sehirHukumranliklar:", full.sehirHukumranliklar);

  const seedDb = path.join(process.cwd(), "seed", "oyun.db");
  for (const ext of ["-shm", "-wal"]) {
    const sidecar = seedDb + ext;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  fs.copyFileSync(DB_PATH, seedDb);
  console.log("seed/oyun.db guncellendi");

  if (upload) {
    const { uploadDbBackup } = require("../services/supabaseBackupService");
    if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = require("ws");
    const up = await uploadDbBackup(DB_PATH);
    console.log("supabase upload:", up);
    if (!up.uploaded) process.exit(1);
  }

  await new Promise((resolve) => db.close(() => resolve()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
