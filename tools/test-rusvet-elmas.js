#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { initDatabase, run, get } = require("../db/database");
const { loadPlayer } = require("../game/playerService");
const { rusvetElmasVer, AVUKAT_ILISKI_MAX, ELMAS_RUSVET_MALIYET } = require("../game/devletService");

const TEST_DB = path.join(__dirname, ".rusvet-elmas-test.db");

async function main() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  process.env.DATABASE_PATH = TEST_DB;
  process.env.NODE_ENV = "test";

  const db = await initDatabase();
  const U = 9101;
  await run(db, `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi) VALUES (?, 'elmasav', 'x', 'ElmasAv')`, [U]);
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas)
     VALUES (?, 50000, 5000, 1000, 10, 100, 15)`,
    [U]
  );

  let p = await loadPlayer(db, U);
  const sonuc = await rusvetElmasVer(db, U, p);
  if (!sonuc.ok) throw new Error(sonuc.error);
  if (sonuc.devletIliskisi !== AVUKAT_ILISKI_MAX) throw new Error("iliski max degil");
  if (sonuc.harcananElmas !== ELMAS_RUSVET_MALIYET) throw new Error("elmas yanlis");

  p = await loadPlayer(db, U);
  const row = await get(db, `SELECT devlet_iliskisi, elmas FROM players WHERE user_id = ?`, [U]);
  if (row.devlet_iliskisi !== AVUKAT_ILISKI_MAX) throw new Error("db iliski yanlis");
  if (row.elmas !== 5) throw new Error("db elmas yanlis " + row.elmas);

  const tekrar = await rusvetElmasVer(db, U, p);
  if (tekrar.ok) throw new Error("max iken tekrar alinmamali");

  console.log("OK rusvet elmas testleri gecti");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
