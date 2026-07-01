#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { openDb, run } = require("../db/database");

const DB_PATH = path.join(__dirname, ".meslek-schema-test.db");

async function copyDb(src) {
  fs.copyFileSync(src, DB_PATH);
  for (const ext of ["-shm", "-wal"]) {
    const p = src + ext;
    if (fs.existsSync(p)) fs.copyFileSync(p, DB_PATH + ext);
  }
}

async function testMissingIseAlimAcik() {
  const seed = path.join(__dirname, "..", "db", "oyun.db");
  if (!fs.existsSync(seed)) throw new Error("db/oyun.db bulunamadı");
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  await copyDb(seed);

  const db = await openDb(DB_PATH);
  try {
    try {
      await run(db, "ALTER TABLE oyuncu_sirketleri DROP COLUMN ise_alim_acik");
    } catch (_) {}

    const { panelGetir: meslek } = require("../game/meslekService");
    const { panelGetir: sirket } = require("../game/sirketService");
    const m = await meslek(db, 2);
    const s = await sirket(db, 2);
    if (!m.ok || !s.ok) throw new Error("panel ok=false");
    console.log("meslek+sirket schema recovery: OK");
  } finally {
    for (const p of [DB_PATH, DB_PATH + "-shm", DB_PATH + "-wal"]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (_) {}
    }
  }
}

testMissingIseAlimAcik().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
