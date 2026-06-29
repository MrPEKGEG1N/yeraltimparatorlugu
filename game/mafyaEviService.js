const { run, get, all } = require("../db/database");
const { syncGrupUyeBonusGuc, mafyaEviGucBonusu, mafyaEviSonrakiBonusArtisi } = require("./bonusGucService");

function kapasite(seviye) {
  const s = Math.max(1, parseInt(seviye, 10) || 1);
  return 3 + (s - 1) * 3;
}

function sonrakiSeviyeMaliyeti(seviye) {
  const s = Math.max(1, parseInt(seviye, 10) || 1);
  return Math.floor(75_000 * s * s);
}

async function ensureHibeTable(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_evi_hibeler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reis_adi TEXT NOT NULL,
      miktar INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE
    )`
  );
}

async function ensureEvi(db, grupId) {
  await ensureHibeTable(db);
  const row = await get(db, `SELECT grup_id, seviye, birikmis_para FROM mafya_evi WHERE grup_id = ?`, [
    grupId,
  ]);
  if (row) return row;
  await run(db, `INSERT INTO mafya_evi (grup_id, seviye, birikmis_para) VALUES (?, 1, 0)`, [grupId]);
  return { grup_id: grupId, seviye: 1, birikmis_para: 0 };
}

async function eviGetir(db, grupId) {
  const row = await ensureEvi(db, grupId);
  const cap = kapasite(row.seviye);
  const nextCost = sonrakiSeviyeMaliyeti(row.seviye);
  return {
    grupId,
    seviye: row.seviye,
    kapasite: cap,
    birikmisPara: row.birikmis_para,
    sonrakiMaliyet: nextCost,
    kalan: Math.max(0, nextCost - row.birikmis_para),
    uyeGucBonusu: mafyaEviGucBonusu(row.seviye),
    sonrakiUyeGucBonusu: mafyaEviGucBonusu(row.seviye + 1),
    sonrakiBonusArtisi: mafyaEviSonrakiBonusArtisi(row.seviye),
  };
}

function trTarihSaat(ts) {
  return new Date(ts * 1000).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function hibeGecmisiGetir(db, grupId, limit = 50) {
  await ensureHibeTable(db);
  const rows = await all(
    db,
    `SELECT reis_adi, miktar, created_at FROM mafya_evi_hibeler
     WHERE grup_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [grupId, limit]
  );
  return rows.map((r) => ({
    reisAdi: r.reis_adi,
    miktar: r.miktar,
    tarih: trTarihSaat(r.created_at),
    createdAt: r.created_at,
  }));
}

async function hibeEt(db, userId, player, grupId, miktar) {
  const tutar = Math.floor(Number(miktar) || 0);
  if (tutar < 1) return { ok: false, error: "Hibe miktarı geçersiz." };
  if (player.kasa < tutar) return { ok: false, error: "Kasanda yeterli nakit yok!" };

  await ensureEvi(db, grupId);
  const u = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [userId]);
  player.kasa -= tutar;
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  await run(db, `UPDATE mafya_evi SET birikmis_para = birikmis_para + ? WHERE grup_id = ?`, [
    tutar,
    grupId,
  ]);
  await run(
    db,
    `INSERT INTO mafya_evi_hibeler (grup_id, user_id, reis_adi, miktar) VALUES (?, ?, ?, ?)`,
    [grupId, userId, u?.reis_adi || "?", tutar]
  );
  return { ok: true, odenen: tutar };
}

async function seviyeYukselt(db, grupId) {
  const row = await ensureEvi(db, grupId);
  const maliyet = sonrakiSeviyeMaliyeti(row.seviye);
  if (row.birikmis_para < maliyet) {
    return { ok: false, error: "Yetersiz birikim. Kalan: " + (maliyet - row.birikmis_para).toLocaleString("tr-TR") + " TL" };
  }
  await run(db, `UPDATE mafya_evi SET seviye = seviye + 1, birikmis_para = birikmis_para - ? WHERE grup_id = ?`, [
    maliyet,
    grupId,
  ]);
  await syncGrupUyeBonusGuc(db, grupId);
  const yeni = await ensureEvi(db, grupId);
  return { ok: true, seviye: yeni.seviye, uyeGucBonusu: mafyaEviGucBonusu(yeni.seviye) };
}

module.exports = {
  kapasite,
  sonrakiSeviyeMaliyeti,
  mafyaEviGucBonusu,
  ensureEvi,
  eviGetir,
  hibeEt,
  hibeGecmisiGetir,
  seviyeYukselt,
};
