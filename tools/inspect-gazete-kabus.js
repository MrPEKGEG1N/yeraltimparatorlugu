#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

async function inspect(f) {
  if (!fs.existsSync(f)) return null;
  const db = new sqlite3.Database(f, sqlite3.OPEN_READONLY);
  const out = { f: path.relative(process.cwd(), f), size: fs.statSync(f).size };
  try {
    const dd1 = await q(
      db,
      `SELECT p.puan, p.icraat, p.kasa FROM users u JOIN players p ON p.user_id=u.id WHERE u.username='dd1'`
    );
    out.dd1 = dd1[0];
    const mr = await q(
      db,
      `SELECT p.puan, p.kasa, u.reis_adi FROM users u JOIN players p ON p.user_id=u.id WHERE u.username='mrpekgeg1n'`
    );
    out.mr = mr[0];
    try {
      out.kabus = await q(
        db,
        `SELECT anahtar, deger FROM sistem_gunluk WHERE anahtar LIKE 'gazete_kabus_%' ORDER BY anahtar DESC LIMIT 5`
      );
    } catch (_) {}
    try {
      out.gazete = await q(
        db,
        `SELECT mesaj, created_at FROM sehir_gazete ORDER BY created_at DESC LIMIT 10`
      );
    } catch (_) {}
    try {
      out.stat = await q(
        db,
        `SELECT sh.tur, sh.miktar, sh.created_at FROM stat_hareket sh
         JOIN users u ON u.id=sh.user_id WHERE u.username='dd1' AND sh.tur='sayginlik'
         ORDER BY sh.created_at DESC LIMIT 30`
      );
    } catch (_) {}
    try {
      out.icraatIs = await q(
        db,
        `SELECT COUNT(*) AS n FROM stat_hareket sh
         JOIN users u ON u.id=sh.user_id WHERE u.username='dd1' AND sh.tur='icraat_is'
         AND sh.created_at > strftime('%s','now')-86400`
      );
    } catch (_) {}
  } catch (e) {
    out.error = e.message;
  }
  db.close();
  return out;
}

async function main() {
  const files = [
    "db/oyun.db",
    "db/oyun.db.bak",
    "db/backups/oyun-2026-07-12.db",
    "seed/oyun.db",
    "db/_prod-supabase.db",
  ];
  for (const f of files) {
    const r = await inspect(f);
    if (r) console.log(JSON.stringify(r, null, 2));
  }
}

main();
