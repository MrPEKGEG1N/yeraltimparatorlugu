const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

function collectDbFiles() {
  const out = new Set();
  const roots = ["db", "seed", "tools"];
  for (const root of roots) {
    const full = path.join(process.cwd(), root);
    if (!fs.existsSync(full)) continue;
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        try {
          const st = fs.statSync(p);
          if (st.isDirectory()) walk(p);
          else if (name.endsWith(".db") && st.size >= 512) out.add(p);
        } catch (_) {}
      }
    };
    walk(full);
  }
  return [...out].sort();
}

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  for (const fp of collectDbFiles()) {
    try {
      const db = new sqlite3.Database(fp, sqlite3.OPEN_READONLY);
      const u = await q(db, `SELECT id FROM users WHERE username = 'dd1'`);
      if (!u[0]) {
        db.close();
        continue;
      }
      const id = u[0].id;
      const pl = await q(
        db,
        `SELECT kasa, guc, puan, icraat, sms_hakki, kara_listede, sehre_hukmet_sayisi
         FROM players WHERE user_id = ?`,
        [id]
      );
      const puan = pl[0]?.puan;
      if (puan >= 200000) {
        const mekan = await q(
          db,
          `SELECT COALESCE(SUM(adet),0) AS t FROM sektor_sahiplik WHERE user_id = ?`,
          [id]
        );
        const gy = await q(db, `SELECT base_seviye FROM user_base WHERE user_id = ?`, [id]);
        const sirket = await q(
          db,
          `SELECT tur_id, isim, kasa FROM oyuncu_sirketleri WHERE sahip_user_id = ?`,
          [id]
        );
        console.log("\n===", fp, "===");
        console.log("player", pl[0]);
        console.log("mekan", mekan[0]?.t);
        console.log("guvenli_yer", gy[0]?.base_seviye);
        if (sirket[0]) console.log("sirket", sirket[0]);
      }
      db.close();
    } catch (e) {
      // skip corrupt
    }
  }
})();
