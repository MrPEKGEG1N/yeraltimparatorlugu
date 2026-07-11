#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const paths = [
  "db/oyun.db",
  "db/oyun.db.bak",
  "db/backups/oyun-2026-06-30.db",
  "db/_prod-supabase.db",
];

function q(db, sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

(async () => {
  for (const p of paths) {
    try {
      const db = new sqlite3.Database(p, sqlite3.OPEN_READONLY);
      const u = await q(db, `SELECT id FROM users WHERE username = 'dd1'`);
      if (!u[0]) {
        db.close();
        continue;
      }
      const id = u[0].id;
      const sektor = await q(
        db,
        `SELECT sektor, mekan_key, adet FROM sektor_sahiplik WHERE user_id = ? AND adet > 0`,
        [id]
      );
      const liman = await q(db, `SELECT liman_id FROM liman_sahiplik WHERE owner_user_id = ?`, [id]);
      const makam = await q(db, `SELECT makam FROM baba_makamlari WHERE owner_user_id = ?`, [id]);
      const pl = await q(
        db,
        `SELECT kara_listede, guc, kasa, puan, sehre_hukmet_sayisi FROM players WHERE user_id = ?`,
        [id]
      );
      const hukum = await q(
        db,
        `SELECT baslangic, bitis FROM sehir_hukumranlik WHERE user_id = ? ORDER BY id`,
        [id]
      );
      console.log(
        JSON.stringify({
          path: p,
          player: pl[0],
          sektorAdet: sektor.length,
          sektorToplam: sektor.reduce((s, r) => s + r.adet, 0),
          liman: liman.map((x) => x.liman_id),
          makam: makam.map((x) => x.makam),
          hukum,
        })
      );
      db.close();
    } catch (e) {
      console.log(p, "ERR", e.message);
    }
  }
})();
