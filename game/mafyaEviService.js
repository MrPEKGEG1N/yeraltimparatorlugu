const { run, get } = require("../db/database");

function kapasite(seviye) {
  const s = Math.max(1, parseInt(seviye, 10) || 1);
  return 3 + (s - 1) * 3;
}

function sonrakiSeviyeMaliyeti(seviye) {
  const s = Math.max(1, parseInt(seviye, 10) || 1);
  // Erken oyunda erişilebilir, ileride zorlaşır
  return Math.floor(75_000 * s * s);
}

async function ensureEvi(db, grupId) {
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
  };
}

async function hibeEt(db, userId, player, grupId, miktar) {
  const tutar = Math.floor(Number(miktar) || 0);
  if (tutar < 1) return { ok: false, error: "Hibe miktarı geçersiz." };
  if (player.kasa < tutar) return { ok: false, error: "Kasanda yeterli nakit yok!" };

  await ensureEvi(db, grupId);
  player.kasa -= tutar;
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  await run(db, `UPDATE mafya_evi SET birikmis_para = birikmis_para + ? WHERE grup_id = ?`, [
    tutar,
    grupId,
  ]);
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
  return { ok: true };
}

module.exports = {
  kapasite,
  sonrakiSeviyeMaliyeti,
  ensureEvi,
  eviGetir,
  hibeEt,
  seviyeYukselt,
};

