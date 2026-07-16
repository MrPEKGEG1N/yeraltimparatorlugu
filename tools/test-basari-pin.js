#!/usr/bin/env node
const path = require("path");
const fs = require("fs");

const TEST_DB = path.join(__dirname, ".basari-pin-test.db");
for (const p of [TEST_DB, TEST_DB + "-shm", TEST_DB + "-wal"]) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}
process.env.DATABASE_PATH = TEST_DB;
process.env.NODE_ENV = "test";
process.env.SKIP_SUPABASE = "1";

const { initDatabase, run, get } = require("../db/database");
const {
  oyuncuBasariRozetleri,
  oyuncuBasariPinKaydet,
  ensureBasariColumns,
} = require("../game/basariRozetService");

async function main() {
  const db = await initDatabase();
  const uid = 9301;
  const now = Math.floor(Date.now() / 1000);

  await run(
    db,
    `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi, created_at, last_login_at)
     VALUES (?, 'pint', 'x', 'PinT', ?, ?)`,
    [uid, now, now]
  );
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas, profil_resmi)
     VALUES (?, 1000, 100, 10, 10, 100, 0, 'erkek-01')`,
    [uid]
  );
  await ensureBasariColumns(db);
  await run(db, `UPDATE players SET basari_rozet_json = ? WHERE user_id = ?`, [
    JSON.stringify({ war_victor: 2, mafia_leader: 1, nightmare: 1, lottery_winner: 0 }),
    uid,
  ]);

  const before = await oyuncuBasariRozetleri(db, uid, { syncLogin: false });
  const unlocked = before.liste.filter((x) => x.unlocked).map((x) => x.id);
  if (!unlocked.includes("war_victor") || !unlocked.includes("mafia_leader")) {
    throw new Error("expected unlocked badges, got " + unlocked.join(","));
  }

  const bad = await oyuncuBasariPinKaydet(db, uid, ["lottery_winner"]);
  if (bad.ok) throw new Error("locked badge should be rejected");

  const ok = await oyuncuBasariPinKaydet(db, uid, [
    "war_victor",
    "mafia_leader",
    "nightmare",
    "war_victor",
  ]);
  if (!ok.ok) throw new Error("pin save failed: " + ok.error);
  if (ok.pinIds.length !== 3 || ok.pinIds[0] !== "war_victor") {
    throw new Error("unexpected pins: " + JSON.stringify(ok.pinIds));
  }

  const after = await oyuncuBasariRozetleri(db, uid, { syncLogin: false });
  if (JSON.stringify(after.pinIds) !== JSON.stringify(ok.pinIds)) {
    throw new Error("pin read mismatch");
  }

  const row = await get(db, `SELECT basari_rozet_pin_json FROM players WHERE user_id = ?`, [uid]);
  console.log("OK pins=", row.basari_rozet_pin_json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
