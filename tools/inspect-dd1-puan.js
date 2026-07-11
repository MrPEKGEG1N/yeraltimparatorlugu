#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

function collectDbFiles() {
  const out = new Set();
  for (const root of ["db/backups", "db", "seed"]) {
    const full = path.join(process.cwd(), root);
    if (!fs.existsSync(full)) continue;
    const names = fs.statSync(full).isFile() ? [path.basename(full)] : fs.readdirSync(full);
    for (const name of names) {
      if (!name.endsWith(".db")) continue;
      const p = path.join(full, name);
      try {
        if (fs.statSync(p).size >= 512) out.add(p);
      } catch (_) {}
    }
  }
  return [...out].sort();
}

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  const rows = [];
  for (const f of collectDbFiles()) {
    const db = new sqlite3.Database(f, sqlite3.OPEN_READONLY);
    try {
      const r = await q(
        db,
        `SELECT u.username, p.kasa, p.guc, p.puan, p.icraat, p.sms_hakki, p.kara_listede, p.sehre_hukmet_sayisi
         FROM users u JOIN players p ON p.user_id=u.id WHERE u.username='dd1'`
      );
      if (r[0]) rows.push({ path: path.relative(process.cwd(), f), ...r[0] });
    } catch (e) {
      rows.push({ path: path.relative(process.cwd(), f), error: e.message });
    } finally {
      db.close();
    }
  }
  rows.sort((a, b) => (b.puan || 0) - (a.puan || 0));
  console.log("dd1 puan karsilastirma (yuksekten dusuge):");
  for (const r of rows) console.log(JSON.stringify(r));
})();
