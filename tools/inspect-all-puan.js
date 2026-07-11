#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

function collectDbFiles() {
  const out = new Set();
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (name.endsWith(".db") && !name.includes("-shm") && !name.includes("-wal")) {
        try {
          if (fs.statSync(p).size >= 512) out.add(p);
        } catch (_) {}
      }
    }
  }
  walk(path.join(process.cwd(), "db"));
  walk(path.join(process.cwd(), "seed"));
  return [...out];
}

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  let globalMax = { puan: 0, path: "", username: "" };
  for (const f of collectDbFiles()) {
    const db = new sqlite3.Database(f, sqlite3.OPEN_READONLY);
    try {
      const rows = await q(
        db,
        `SELECT u.username, p.puan, p.kasa, p.guc FROM users u JOIN players p ON p.user_id=u.id ORDER BY p.puan DESC`
      );
      const dd1 = rows.find((r) => r.username === "dd1");
      const top = rows[0];
      if (top && top.puan > globalMax.puan) globalMax = { ...top, path: f };
      if (dd1) console.log(path.relative(process.cwd(), f), "dd1 puan=", dd1.puan, "kasa=", dd1.kasa);
    } catch (e) {
      console.log(path.relative(process.cwd(), f), "ERR", e.message);
    } finally {
      db.close();
    }
  }
  console.log("GLOBAL MAX PUAN:", globalMax);
})();
