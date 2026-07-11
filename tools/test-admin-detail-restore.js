const { initDatabase, all } = require("../db/database");
const { restoreOyuncuSnapshots } = require("../game/oyuncuRestoreService");
const { getPlayerDetail } = require("../game/adminService");

(async () => {
  const db = await initDatabase();
  const restore = await restoreOyuncuSnapshots(db);
  console.log("restore", restore);

  const users = await all(
    db,
    "SELECT id, username FROM users WHERE username IN ('dd1','mrpekgeg1n')"
  );
  for (const u of users) {
    const t0 = Date.now();
    try {
      const detail = await getPlayerDetail(db, u.id);
      const json = JSON.stringify(detail);
      console.log(
        u.username,
        "OK",
        Date.now() - t0 + "ms",
        "bytes",
        json.length,
        "mekan",
        detail.mekanToplam
      );
    } catch (e) {
      console.log(u.username, "FAIL", e.message);
      console.error(e);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
