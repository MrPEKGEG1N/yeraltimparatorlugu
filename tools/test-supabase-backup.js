#!/usr/bin/env node
/**
 * Supabase yedek testi — SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY gerekli.
 * Kullanim: node tools/test-supabase-backup.js [db-yolu]
 */
const path = require("path");
const fs = require("fs");
const { uploadDbBackup, getStatus, isConfigured } = require("../services/supabaseBackupService");

async function main() {
  if (!isConfigured()) {
    console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
    process.exit(1);
  }

  const arg = process.argv[2];
  const candidates = [
    arg,
    path.join(__dirname, "..", "db", "oyun.db"),
    path.join(__dirname, "..", "seed", "oyun.db"),
  ].filter(Boolean);

  let dbPath = null;
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).size >= 512) {
      dbPath = path.resolve(p);
      break;
    }
  }
  if (!dbPath) {
    console.error("SQLite dosyasi bulunamadi:", candidates.join(", "));
    process.exit(1);
  }

  console.log("Test DB:", dbPath);
  const result = await uploadDbBackup(dbPath);
  console.log("Sonuc:", JSON.stringify(result, null, 2));
  console.log("Durum:", JSON.stringify(getStatus(), null, 2));

  if (!result.uploaded) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
