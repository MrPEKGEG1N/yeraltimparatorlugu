#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { openDb, run } = require("../db/database");

const DB_PATH = path.join(__dirname, ".gazete-schema-test.db");

async function copyDb(src) {
  fs.copyFileSync(src, DB_PATH);
  for (const ext of ["-shm", "-wal"]) {
    const p = src + ext;
    if (fs.existsSync(p)) fs.copyFileSync(p, DB_PATH + ext);
  }
}

async function testMissingColumns() {
  const seed = path.join(__dirname, "..", "db", "oyun.db");
  if (!fs.existsSync(seed)) throw new Error("db/oyun.db bulunamadı");
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  await copyDb(seed);

  const db = await openDb(DB_PATH);
  try {
    try {
      await run(db, "ALTER TABLE players DROP COLUMN gazete_okundu_id");
    } catch (_) {}
    try {
      await run(db, "ALTER TABLE players DROP COLUMN profil_resmi");
    } catch (_) {}
    try {
      await run(db, "DROP TABLE medya_haberleri");
    } catch (_) {}

    const { getGazetePanel } = require("../game/sehirGazeteService");
    const panel = await getGazetePanel(db, 2);
    if (!panel || !panel.manset) throw new Error("panel boş döndü");
    console.log("missing schema recovery: OK");
  } finally {
    for (const p of [DB_PATH, DB_PATH + "-shm", DB_PATH + "-wal"]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (_) {}
    }
  }
}

testMissingColumns().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
