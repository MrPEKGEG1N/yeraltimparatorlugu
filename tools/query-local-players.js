const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db/oyun.db");

function q(sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  const users = ["mrpekgeg1n", "dd1"];
  for (const un of users) {
    const u = await q(`SELECT id, username FROM users WHERE username = ?`, [un]);
    if (!u[0]) {
      console.log(un, "yok");
      continue;
    }
    const id = u[0].id;
    const pl = await q(
      `SELECT kasa, guc, puan, icraat FROM players WHERE user_id = ?`,
      [id]
    );
    const meslek = await q(`SELECT * FROM oyuncu_meslek WHERE user_id = ?`, [id]);
    const calisan = await q(
      `SELECT c.*, s.isim, su.username AS sahip
       FROM sirket_calisanlari c
       JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
       JOIN users su ON su.id = s.sahip_user_id
       WHERE c.user_id = ?`,
      [id]
    );
    console.log("\n===", un, "===");
    console.log("player", pl[0]);
    if (meslek.length) console.log("meslek", meslek);
    if (calisan.length) console.log("sirket_calisan", calisan);
  }
  db.close();
})();
