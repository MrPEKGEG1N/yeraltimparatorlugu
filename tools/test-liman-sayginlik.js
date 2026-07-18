#!/usr/bin/env node
const path = require("path");
const fs = require("fs");

const TEST_DB = path.join(__dirname, ".liman-sayginlik-test.db");
for (const f of [TEST_DB, TEST_DB + "-shm", TEST_DB + "-wal"]) {
  try {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch (_) {}
}
process.env.DATABASE_PATH = TEST_DB;
process.env.NODE_ENV = "test";

const { initDatabase, run, get } = require("../db/database");
const { limanCok, babaCok, ensureWorldRows } = require("../game/worldService");
const { sehreHukmediyorMu } = require("../game/karaListeService");

async function main() {
  const db = await initDatabase();
  await ensureWorldRows(db);

  async function mk(id, name, puan) {
    await run(
      db,
      `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi) VALUES (?, ?, 'x', ?)`,
      [id, name, name]
    );
    await run(
      db,
      `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, kara_listede)
       VALUES (?, 5000000, ?, 9999999, 50, 100, 0)`,
      [id, puan]
    );
  }

  await mk(9201, "hukumdar_t", 100000);
  await mk(9202, "saldirgan_t", 1000);
  await run(db, `UPDATE players SET kara_listede = 0`);

  for (const liman of ["istanbul", "izmir", "hatay"]) {
    await run(db, `UPDATE liman_sahiplik SET owner_user_id = ? WHERE liman_id = ?`, [9201, liman]);
  }
  for (const makam of ["sozunu_gecir", "sadakat_yemini"]) {
    await run(db, `UPDATE baba_makamlari SET owner_user_id = ? WHERE makam = ?`, [9201, makam]);
  }
  await run(db, `UPDATE players SET kara_listede = 1 WHERE user_id = ?`, [9201]);

  const attacker = { icraat: 50 };

  const r1 = await limanCok(db, 9202, attacker, "istanbul", {});
  if (!r1.ok) throw new Error("liman1: " + r1.error);
  if (r1.sayginlikOdul !== 1000) throw new Error("tekil odul=" + r1.sayginlikOdul);
  let h = await get(db, `SELECT puan FROM players WHERE user_id = 9201`);
  let s = await get(db, `SELECT puan FROM players WHERE user_id = 9202`);
  if (h.puan !== 99000) throw new Error("hukumdar after 1: " + h.puan);
  if (s.puan !== 2000) throw new Error("saldirgan after 1: " + s.puan);
  console.log("OK tek liman %1");

  for (const liman of ["izmir", "hatay"]) {
    const r = await limanCok(db, 9202, attacker, liman, {});
    if (!r.ok) throw new Error(liman + ": " + r.error);
  }
  for (const makam of ["sozunu_gecir", "sadakat_yemini"]) {
    const r = await babaCok(db, 9202, attacker, makam, {});
    if (!r.ok) throw new Error(makam + ": " + r.error);
  }

  h = await get(db, `SELECT puan, kara_listede FROM players WHERE user_id = 9201`);
  s = await get(db, `SELECT puan, kara_listede FROM players WHERE user_id = 9202`);
  if (!(await sehreHukmediyorMu(db, 9202))) throw new Error("saldirgan hukumdar degil");
  if (!s.kara_listede) throw new Error("saldirgan kara listede degil");
  if (h.kara_listede) throw new Error("eski hukumdar hala listede");
  if (s.puan !== 6000) throw new Error("tam hakimiyet saldirgan=" + s.puan + " (beklenen 6000)");
  if (h.puan !== 95000) throw new Error("tam hakimiyet hukumdar=" + h.puan + " (beklenen 95000)");
  console.log("OK tam hakimiyet toplam %5");
  console.log("ALL PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
