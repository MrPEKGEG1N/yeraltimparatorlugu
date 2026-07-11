#!/usr/bin/env node
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const { LIMAN_IDS, BABA_MAKAMLAR } = require("../game/worldConstants");

function collectDbFiles() {
  const out = new Set();
  for (const root of ["db/backups", "db", "seed"]) {
    const full = path.join(process.cwd(), root);
    if (!fs.existsSync(full)) continue;
    const entries = fs.statSync(full).isFile() ? [path.basename(full)] : fs.readdirSync(full);
    for (const name of entries) {
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
function get(db, sql, p = []) {
  return new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
}

async function inspect(dbPath) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  try {
    const u = await get(db, `SELECT id, username FROM users WHERE username='dd1'`);
    if (!u) return null;

    const pl = await get(
      db,
      `SELECT kasa, guc, puan, kara_listede, sehir_efsane, sehre_hukmet_sayisi FROM players WHERE user_id=?`,
      [u.id]
    );

    const limanlar = await q(
      db,
      `SELECT liman_id FROM liman_sahiplik WHERE owner_user_id=?`,
      [u.id]
    ).catch(() => []);
    const makamlar = await q(
      db,
      `SELECT makam FROM baba_makamlari WHERE owner_user_id=?`,
      [u.id]
    ).catch(() => []);
    const sektor = await q(
      db,
      `SELECT sektor, mekan_key, adet FROM sektor_sahiplik WHERE user_id=? AND adet>0`,
      [u.id]
    ).catch(() => []);
    const hukum = await q(
      db,
      `SELECT id, baslangic, bitis FROM sehir_hukumranlik WHERE user_id=? ORDER BY id`,
      [u.id]
    ).catch(() => []);

    const limanOk = LIMAN_IDS.every((l) => limanlar.some((x) => x.liman_id === l));
    const makamOk = BABA_MAKAMLAR.every((m) => makamlar.some((x) => x.makam === m));
    const sektorToplam = sektor.reduce((s, r) => s + r.adet, 0);

    return {
      path: path.relative(process.cwd(), dbPath),
      kasa: pl?.kasa,
      guc: pl?.guc,
      puan: pl?.puan,
      kara_listede: pl?.kara_listede,
      sehre_hukmet_sayisi: pl?.sehre_hukmet_sayisi,
      limanlar: limanlar.map((l) => l.liman_id),
      makamlar: makamlar.map((m) => m.makam),
      limanTam: limanOk,
      makamTam: makamOk,
      sehreHukmeder: limanOk && makamOk,
      sektorToplam,
      hukumKayit: hukum.length,
      aktifHukum: hukum.find((h) => !h.bitis)?.baslangic || null,
    };
  } catch (e) {
    return { path: path.relative(process.cwd(), dbPath), error: e.message };
  } finally {
    db.close();
  }
}

(async () => {
  const files = collectDbFiles();
  const rows = [];
  for (const f of files) {
    const r = await inspect(f);
    if (r) rows.push(r);
  }
  rows.sort(
    (a, b) =>
      (b.sehreHukmeder ? 1 : 0) - (a.sehreHukmeder ? 1 : 0) ||
      (b.kara_listede || 0) - (a.kara_listede || 0) ||
      (b.guc || 0) - (a.guc || 0)
  );
  for (const r of rows) console.log(JSON.stringify(r));
})();
