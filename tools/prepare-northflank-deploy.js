#!/usr/bin/env node
/**
 * Northflank deploy oncesi — en iyi oyuncu DB'sini sec, seed'e yaz, snapshot export et.
 * Supabase anahtarlari varsa once buluttan indirir.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SEED_DB = path.join(ROOT, "seed", "oyun.db");
const DL_DIR = path.join(ROOT, "db", "supabase-dl");

function listDbCandidates() {
  const out = new Set();
  const push = (p) => {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved) && fs.statSync(resolved).size >= 512) out.add(resolved);
  };
  push(path.join(ROOT, "db", "oyun.db"));
  push(SEED_DB);
  if (fs.existsSync(DL_DIR)) {
    for (const f of fs.readdirSync(DL_DIR)) {
      if (f.endsWith(".db") && !f.includes("-wal") && !f.includes("-shm")) {
        push(path.join(DL_DIR, f));
      }
    }
  }
  const backupDir = path.join(ROOT, "db", "backups");
  if (fs.existsSync(backupDir)) {
    for (const f of fs.readdirSync(backupDir)) {
      if (f.endsWith(".db") && !f.includes(".bak")) push(path.join(backupDir, f));
    }
  }
  return [...out];
}

function countUsers(dbPath) {
  return new Promise((resolve) => {
    try {
      const sqlite3 = require("sqlite3").verbose();
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) return resolve(0);
        db.get("SELECT COUNT(*) AS n FROM users", [], (e, row) => {
          db.close(() => resolve(e ? 0 : row?.n || 0));
        });
      });
    } catch {
      resolve(0);
    }
  });
}

async function scoreFile(dbPath) {
  const users = await countUsers(dbPath);
  const size = fs.statSync(dbPath).size;
  const mtime = fs.statSync(dbPath).mtimeMs;
  return { path: dbPath, users, size, mtime, score: users * 1_000_000 + size + mtime / 1e6 };
}

async function trySupabaseDownload() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[northflank] Supabase anahtari yok — yerel yedekler kullanilacak.");
    return false;
  }
  console.log("[northflank] Supabase yedekleri indiriliyor...");
  const r = spawnSync(process.execPath, [path.join(__dirname, "download-supabase-backups.js")], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  return r.status === 0;
}

function safeCopyDb(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.copyFileSync(dest, dest + ".pre-northflank.bak");
  }
  fs.copyFileSync(src, dest);
  for (const suffix of ["-wal", "-shm"]) {
    const side = src + suffix;
    if (fs.existsSync(side)) {
      try {
        fs.unlinkSync(dest + suffix);
      } catch (_) {}
    }
  }
}

async function main() {
  await trySupabaseDownload();

  const candidates = listDbCandidates();
  const scored = [];
  for (const p of candidates) {
    const s = await scoreFile(p);
    if (s.users > 0) scored.push(s);
  }
  scored.sort((a, b) => b.score - a.score);

  if (!scored.length) {
    console.error("[northflank] Gecerli oyuncu DB bulunamadi.");
    process.exit(1);
  }

  console.log("[northflank] Adaylar:");
  for (const s of scored.slice(0, 8)) {
    console.log(`  ${s.users} kullanici  ${s.size} B  ${path.relative(ROOT, s.path)}`);
  }

  const best = scored[0];
  console.log(`[northflank] Secilen: ${path.relative(ROOT, best.path)} (${best.users} kullanici)`);

  safeCopyDb(best.path, SEED_DB);
  console.log(`[northflank] seed/oyun.db guncellendi.`);

  process.env.DATABASE_PATH = SEED_DB;
  console.log("[northflank] Oyuncu snapshot export...");
  const exp = spawnSync(process.execPath, [path.join(__dirname, "export-all-players.js")], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_PATH: SEED_DB },
  });
  if (exp.status !== 0) {
    console.warn("[northflank] Snapshot export uyarili tamamlandi.");
  }

  console.log("\n[northflank] Hazir. Sonraki adimlar:");
  console.log("  1. Northflank servisinde volume mount: /data");
  console.log("  2. PERSISTENT_DATA_PATH=/data + JWT_SECRET + Supabase anahtarlari");
  console.log("  3. git push → Northflank otomatik deploy");
  console.log("  4. /api/health → oyuncular sayisini dogrula");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
