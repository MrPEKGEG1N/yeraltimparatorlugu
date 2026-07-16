const path = require("path");
const { initDatabase, get, run } = require("../db/database");
const { updatePlayerFull, getPlayerDetail, mapPlayerRow } = require("../game/adminService");

async function main() {
  process.env.DATABASE_PATH = path.join(__dirname, "..", "db", "oyun.db");
  const db = await initDatabase();
  const row = await get(db, `SELECT user_id, elmas FROM players ORDER BY user_id LIMIT 1`);
  if (!row) throw new Error("no player");
  const uid = row.user_id;
  const before = row.elmas || 0;
  console.log("before", uid, before);

  const detail = await getPlayerDetail(db, uid);
  console.log("detail elmas", detail.user.elmas, "mapped", mapPlayerRow(detail.user).elmas);

  const admin = await get(db, `SELECT id FROM users WHERE is_admin = 1 LIMIT 1`);
  const adminId = admin?.id || uid;

  const sonuc = await updatePlayerFull(db, adminId, uid, {
    oyuncu: { elmas: before + 7 },
  });
  console.log("update", sonuc);

  const after = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [uid]);
  console.log("after", after.elmas);

  await run(db, `UPDATE players SET elmas = ? WHERE user_id = ?`, [before, uid]);
  if (!sonuc.ok || after.elmas !== before + 7) {
    throw new Error("elmas update failed");
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
