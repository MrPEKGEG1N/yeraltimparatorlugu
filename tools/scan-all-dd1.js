#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p, out);
      else if (name.endsWith(".db") && st.size >= 512) out.push(p);
    } catch (_) {}
  }
  return out;
}

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  const roots = ["db", "seed", "tools", "db/supabase-dl"];
  const files = new Set();
  for (const r of roots) walk(path.join(process.cwd(), r), []).forEach((f) => files.add(f));

  const rows = [];
  for (const f of [...files]) {
    const db = new sqlite3.Database(f, sqlite3.OPEN_READONLY);
    try {
      const dd1 = await q(
        db,
        `SELECT p.puan, p.icraat, p.kasa, p.guc FROM users u JOIN players p ON p.user_id=u.id WHERE u.username='dd1'`
      );
      const mr = await q(
        db,
        `SELECT p.puan, p.kasa FROM users u JOIN players p ON p.user_id=u.id WHERE u.username='mrpekgeg1n'`
      );
      let kabus = null;
      try {
        kabus = await q(
          db,
          `SELECT * FROM sehir_gazete_gunluk WHERE manset LIKE '%Kabusu%' OR icerik LIKE '%Kabusu%' ORDER BY gun_key DESC LIMIT 3`
        );
      } catch (_) {}
      if (dd1[0] || mr[0]) {
        rows.push({
          f: path.relative(process.cwd(), f),
          mtime: fs.statSync(f).mtime.toISOString(),
          size: fs.statSync(f).size,
          dd1: dd1[0],
          mr: mr[0],
          kabus: kabus?.length || 0,
          kabusManset: kabus?.[0]?.manset || kabus?.[0]?.baslik || null,
        });
      }
    } catch (e) {
      rows.push({ f: path.relative(process.cwd(), f), error: e.message });
    }
    db.close();
  }
  rows.sort((a, b) => (b.dd1?.puan || 0) - (a.dd1?.puan || 0));
  console.log("=== dd1 puan (yuksekten) ===");
  for (const r of rows.slice(0, 20)) console.log(JSON.stringify(r));

  // aktivite icraat count for dd1 in current db
  const live = path.join(process.cwd(), "db", "oyun.db");
  if (fs.existsSync(live)) {
    const db = new sqlite3.Database(live, sqlite3.OPEN_READONLY);
    try {
      const uid = await q(db, `SELECT id FROM users WHERE username='dd1'`);
      if (uid[0]) {
        const acts = await q(
          db,
          `SELECT COUNT(*) AS n FROM aktivite_log WHERE user_id=? AND tur='icraat_is' AND created_at > strftime('%s','now')-86400`,
          [uid[0].id]
        );
        const acts2 = await q(
          db,
          `SELECT tur, detay, created_at FROM aktivite_log WHERE user_id=? ORDER BY created_at DESC LIMIT 15`,
          [uid[0].id]
        );
        console.log("\n=== dd1 son aktivite (live) ===");
        console.log("icraat_is son 24s:", acts[0]);
        acts2.forEach((a) => console.log(a));
      }
      const gaz = await q(
        db,
        `SELECT gun_key, manset, icerik FROM sehir_gazete_gunluk ORDER BY gun_key DESC LIMIT 5`
      );
      console.log("\n=== son gazete gunluk ===");
      gaz.forEach((g) => console.log(g.gun_key, (g.manset || "").slice(0, 80)));
    } catch (e) {
      console.log("live extra err", e.message);
    }
    db.close();
  }
})();
