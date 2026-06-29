const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const root = path.join(__dirname, "..");
const paths = [
  path.join(root, "db", "oyun.db"),
  path.join(root, "db", "oyun.db.bak"),
  path.join(root, "seed", "oyun.db"),
];

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function inspect(p) {
  if (!fs.existsSync(p)) {
    console.log("YOK", p);
    return;
  }
  const db = new sqlite3.Database(p);
  try {
    const users = await all(
      db,
      `SELECT id, username, reis_adi, son_ip, visitor_id, created_at, last_login_at
       FROM users
       WHERE reis_adi LIKE '%Deniz%' OR username LIKE '%deniz%' OR son_ip = ?`,
      ["78.180.25.238"]
    );
    const fps = await all(
      db,
      `SELECT uf.user_id, uf.visitor_id, uf.son_ip, u.reis_adi, u.username
       FROM user_fingerprints uf
       JOIN users u ON u.id = uf.user_id
       WHERE uf.son_ip = ? OR u.reis_adi LIKE '%Deniz%'`,
      ["78.180.25.238"]
    );
    console.log("\n===", p, "size", fs.statSync(p).size, "===");
    console.log("users:", JSON.stringify(users, null, 2));
    console.log("fingerprints:", JSON.stringify(fps, null, 2));
    for (const u of users) {
      const pl = await all(db, "SELECT * FROM players WHERE user_id = ?", [u.id]);
      console.log("player row:", JSON.stringify(pl[0], null, 2));
      const msgs = await all(
        db,
        "SELECT COUNT(*) AS n FROM oyuncu_mesajlari WHERE to_user_id = ? OR from_user_id = ?",
        [u.id, u.id]
      );
      const sektor = await all(
        db,
        "SELECT * FROM sektor_sahiplik WHERE user_id = ?",
        [u.id]
      );
      const banka = await all(db, "SELECT * FROM banka_hesaplari WHERE user_id = ?", [u.id]);
      console.log("mesaj:", msgs[0]?.n, "sektor:", sektor.length, "banka:", banka[0]);
    }
  } catch (err) {
    console.log("err", p, err.message);
  } finally {
    db.close();
  }
}

(async () => {
  for (const p of paths) await inspect(p);
})();
