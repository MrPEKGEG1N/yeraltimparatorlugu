const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node tools/scan-dd1-puan.js <db...>");
  process.exit(1);
}

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  let best = null;
  for (const fp of files) {
    if (!fs.existsSync(fp)) continue;
    try {
      const db = new sqlite3.Database(fp, sqlite3.OPEN_READONLY);
      const u = await q(db, `SELECT id FROM users WHERE username = 'dd1'`);
      if (!u[0]) {
        db.close();
        continue;
      }
      const id = u[0].id;
      let pl;
      try {
        pl = await q(
          db,
          `SELECT kasa, guc, puan, icraat, sms_hakki, kara_listede, sehre_hukmet_sayisi, elmas
           FROM players WHERE user_id = ?`,
          [id]
        );
      } catch (_) {
        pl = await q(
          db,
          `SELECT kasa, guc, puan, icraat, sms_hakki, kara_listede, sehre_hukmet_sayisi
           FROM players WHERE user_id = ?`,
          [id]
        );
      }
      const mekan = await q(
        db,
        `SELECT COALESCE(SUM(adet),0) AS t FROM sektor_sahiplik WHERE user_id = ?`,
        [id]
      );
      const row = { path: fp, ...pl[0], mekan: mekan[0]?.t || 0 };
      console.log(JSON.stringify(row));
      if (!best || row.puan > best.puan) best = row;
      db.close();
    } catch (e) {
      console.log(fp, "ERR", e.message);
    }
  }
  console.log("\nBEST:", JSON.stringify(best, null, 2));
})();
