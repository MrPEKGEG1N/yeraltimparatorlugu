#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const paths = [
  "db/backups/oyun-2026-06-30.db",
  "db/backups/oyun-2026-06-29.db",
  "db/backups/oyun-2026-06-28.db",
  "db/backups/oyun-2026-06-27.db",
  "db/oyun.db",
  "seed/oyun.db",
];

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

async function inspect(p) {
  const full = path.join(process.cwd(), p);
  const db = new sqlite3.Database(full, sqlite3.OPEN_READONLY);
  try {
    const u = await q(db, `SELECT id, username, reis_adi FROM users WHERE username = 'dd1'`);
    if (!u.length) return null;
    const id = u[0].id;
    const pl = await q(
      db,
      `SELECT kasa, guc, puan, profil_aciklama, profil_resmi, dostlar, dusmanlar FROM players WHERE user_id = ?`,
      [id]
    );
    let owned = [];
    let employee = [];
    let mafya = null;
    let uyelik = null;
    try {
      owned = await q(db, `SELECT * FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [id]);
    } catch (_) {}
    try {
      employee = await q(
        db,
        `SELECT c.*, s.isim, s.tur_id FROM sirket_calisanlari c JOIN oyuncu_sirketleri s ON s.id = c.sirket_id WHERE c.user_id = ?`,
        [id]
      );
    } catch (_) {}
    try {
      uyelik = await q(
        db,
        `SELECT mu.*, mg.isim AS grup_adi, mg.lider_user_id FROM mafya_uyeleri mu JOIN mafya_gruplari mg ON mg.id = mu.grup_id WHERE mu.user_id = ?`,
        [id]
      );
    } catch (_) {}
    try {
      mafya = await q(db, `SELECT * FROM mafya_gruplari WHERE lider_user_id = ?`, [id]);
    } catch (_) {}
    return { path: p, user: u[0], player: pl[0], owned, employee, uyelik, mafyaLider: mafya };
  } catch (e) {
    return { path: p, error: e.message };
  } finally {
    db.close();
  }
}

(async () => {
  for (const p of paths) {
    const r = await inspect(p);
    if (!r) continue;
    console.log("===", r.path, "===");
    console.log(JSON.stringify(r, null, 2));
  }
})();
