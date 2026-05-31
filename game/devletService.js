const { run, get } = require("../db/database");

const HAPSE_GIR_ESIK = 5;
const RUSVET_MAX = 10_000_000_000;

function rusvetMiktari(puan) {
  const min = Math.max(10, Math.floor(puan * 0.02));
  const max = Math.max(min, Math.floor(puan * 0.6));
  return { min, max, onerilen: Math.floor((min + max) / 2) };
}

async function getDevletIliskisi(db, userId) {
  const row = await get(db, `SELECT devlet_iliskisi FROM players WHERE user_id = ?`, [userId]);
  return row ? row.devlet_iliskisi : 100;
}

async function devletDusur(db, userId, miktar) {
  const row = await get(db, `SELECT devlet_iliskisi FROM players WHERE user_id = ?`, [userId]);
  const yeni = Math.max(0, (row?.devlet_iliskisi ?? 100) - miktar);
  await run(db, `UPDATE players SET devlet_iliskisi = ? WHERE user_id = ?`, [yeni, userId]);
  return yeni;
}

async function hapisKontrol(db, userId) {
  const d = await getDevletIliskisi(db, userId);
  if (d < HAPSE_GIR_ESIK) {
    return {
      ok: false,
      error:
        "Devlet ilişkin çok kötü — hapistesin! İcraata çıkamazsın. Rüşvet vererek ilişkini düzelt.",
    };
  }
  return { ok: true, devletIliskisi: d };
}

async function rusvetVer(db, userId, player, miktar) {
  const row = await get(db, `SELECT devlet_iliskisi FROM players WHERE user_id = ?`, [userId]);
  const mevcutIliski = row?.devlet_iliskisi ?? 100;

  const { min, max } = rusvetMiktari(player.puan);
  const tutar = Math.floor(Number(miktar) || 0);
  if (tutar < min) {
    return {
      ok: false,
      error: `Rüşvet en az ${min.toLocaleString("tr-TR")} TL olmalı.`,
    };
  }
  if (tutar > max) {
    return {
      ok: false,
      error: `Saygınlığına göre bu tur en fazla ${max.toLocaleString("tr-TR")} TL verebilirsin.`,
    };
  }
  if (player.kasa < tutar) {
    return { ok: false, error: "Kasanda yeterli nakit yok!" };
  }
  player.kasa -= tutar;
  const yeni = mevcutIliski + Math.floor(tutar / 50) + 5;
  await run(db, `UPDATE players SET kasa = ?, devlet_iliskisi = ? WHERE user_id = ?`, [
    player.kasa,
    yeni,
    userId,
  ]);
  return { ok: true, devletIliskisi: yeni, odenen: tutar };
}

module.exports = {
  HAPSE_GIR_ESIK,
  RUSVET_MAX,
  rusvetMiktari,
  getDevletIliskisi,
  devletDusur,
  hapisKontrol,
  rusvetVer,
};
