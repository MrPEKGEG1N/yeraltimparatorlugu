#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.argv[2] || "db/_prod-supabase.db";

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  const db = new sqlite3.Database(path.resolve(dbPath), sqlite3.OPEN_READONLY);
  const u = await q(db, `SELECT id, username FROM users WHERE username='dd1'`);
  const id = u[0]?.id;
  console.log("dd1 id", id);
  const tables = await q(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  );
  console.log(
    "tables",
    tables.map((t) => t.name).filter((n) => /sirket|mafya|meslek|player|users/i.test(n))
  );

  const owned = await q(db, `SELECT * FROM oyuncu_sirketleri`);
  console.log("\nALL companies:");
  for (const s of owned) {
    const owner = await q(db, `SELECT username FROM users WHERE id=?`, [s.sahip_user_id]);
    console.log({ ...s, owner: owner[0]?.username });
  }

  if (id) {
    const pl = await q(db, `SELECT * FROM players WHERE user_id=?`, [id]);
    const meslek = await q(db, `SELECT * FROM oyuncu_meslek WHERE user_id=?`, [id]).catch(() => []);
    const emp = await q(
      db,
      `SELECT c.*, s.isim, s.tur_id FROM sirket_calisanlari c JOIN oyuncu_sirketleri s ON s.id=c.sirket_id WHERE c.user_id=?`,
      [id]
    );
    const mafya = await q(
      db,
      `SELECT mu.*, mg.isim grup_adi, mg.aciklama FROM mafya_uyeleri mu JOIN mafya_gruplari mg ON mg.id=mu.grup_id WHERE mu.user_id=?`,
      [id]
    );
    const lider = await q(db, `SELECT * FROM mafya_gruplari WHERE lider_user_id=?`, [id]);
    console.log("\ndd1 player cols:", Object.keys(pl[0] || {}));
    console.log("profil_aciklama:", pl[0]?.profil_aciklama);
    console.log("meslek", meslek);
    console.log("employee", emp);
    console.log("mafya uyelik", mafya);
    console.log("mafya lider", lider);
  }

  const gruplar = await q(db, `SELECT g.*, u.username lider FROM mafya_gruplari g LEFT JOIN users u ON u.id=g.lider_user_id`);
  console.log("\nALL mafya groups:", gruplar);

  db.close();
})();
