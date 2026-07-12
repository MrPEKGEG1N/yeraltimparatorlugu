#!/usr/bin/env node
/**
 * Bugunun en guncel yerel DB'sini seed + Supabase yedegine yazar.
 * Kullanim: node tools/restore-today-production.js [--upload]
 */
const fs = require("fs");
const path = require("path");
const { initDatabase, DB_PATH } = require("../db/database");
const { exportSnapshotsToSeed } = require("../game/oyuncuRestoreService");

const ROOT = process.cwd();
const SEED_DB = path.join(ROOT, "seed", "oyun.db");
const SOURCE_CANDIDATES = [
  path.join(ROOT, "db", "oyun.db"),
  path.join(ROOT, "db", "backups", "oyun-2026-07-12.db"),
  path.join(ROOT, "db", "backups", "oyun-2026-07-11.db"),
];

function pickSource() {
  let best = null;
  let bestScore = -1;
  for (const p of SOURCE_CANDIDATES) {
    if (!fs.existsSync(p) || fs.statSync(p).size < 512) continue;
    const mtime = fs.statSync(p).mtimeMs;
    const score = fs.statSync(p).size + mtime;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (!best) throw new Error("Gecerli kaynak DB bulunamadi.");
  return best;
}

function copyDb(src, dest) {
  if (fs.existsSync(dest)) fs.copyFileSync(dest, dest + ".pre-restore.bak");
  fs.copyFileSync(src, dest);
  for (const ext of ["-wal", "-shm"]) {
    try {
      if (fs.existsSync(dest + ext)) fs.unlinkSync(dest + ext);
    } catch (_) {}
  }
}

async function main() {
  const upload = process.argv.includes("--upload");
  const src = pickSource();
  console.log("[restore-today] Kaynak:", path.relative(ROOT, src));

  copyDb(src, DB_PATH);
  copyDb(src, SEED_DB);
  console.log("[restore-today] db/oyun.db ve seed/oyun.db guncellendi");

  process.env.DATABASE_PATH = DB_PATH;
  const db = await initDatabase();
  const n = await exportSnapshotsToSeed(db, { merge: true });
  console.log("[restore-today] snapshot export:", n);

  const dd1 = await new Promise((res, rej) =>
    db.get(
      `SELECT u.username, p.puan, p.kasa, p.guc FROM users u JOIN players p ON p.user_id=u.id WHERE u.username='dd1'`,
      [],
      (e, r) => (e ? rej(e) : res(r))
    )
  );
  console.log("[restore-today] dd1:", dd1);

  if (upload) {
    if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = require("ws");
    const { uploadDbBackup } = require("../services/supabaseBackupService");
    const up = await uploadDbBackup(DB_PATH);
    console.log("[restore-today] supabase:", up);
    if (!up.uploaded) process.exit(1);
  }

  await new Promise((resolve) => db.close(() => resolve()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
