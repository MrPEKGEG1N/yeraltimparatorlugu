const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const files = [];
for (const d of ["db/backups", "db", "seed"]) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (f.endsWith(".db") && !f.includes("test") && !f.startsWith(".")) {
      files.push(path.join(d, f));
    }
  }
}

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  for (const fp of files) {
    try {
      const db = new sqlite3.Database(fp, sqlite3.OPEN_READONLY);
      const emp = await q(
        db,
        `SELECT u.username, s.isim AS sirket, s.sahip_user_id, su.username AS sahip,
                c.pozisyon_id, c.gunluk_maas
         FROM sirket_calisanlari c
         JOIN users u ON u.id = c.user_id
         JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
         JOIN users su ON su.id = s.sahip_user_id
         WHERE u.username = 'mrpekgeg1n'`
      );
      const meslek = await q(
        db,
        `SELECT u.username, m.meslek_id FROM oyuncu_meslek m JOIN users u ON u.id = m.user_id WHERE u.username = 'mrpekgeg1n'`
      );
      const dd1 = await q(
        db,
        `SELECT p.puan, p.kasa FROM users u JOIN players p ON p.user_id = u.id WHERE u.username = 'dd1'`
      );
      if (emp.length || meslek.length || dd1.length) {
        console.log("\n===", fp, "===");
        if (dd1[0]) console.log("dd1", dd1[0]);
        if (emp.length) console.log("sirket_calisan", emp);
        if (meslek.length) console.log("meslek", meslek);
      }
      db.close();
    } catch (_) {}
  }
})();
