const { run, get } = require("../db/database");

const HAPSE_GIR_ESIK = 15;
const AVUKAT_ILISKI_MAX = 2000;
const RUSVET_ARTIS_MAX = 50;
const RUSVET_MAX = 10_000_000_000;
const ELMAS_RUSVET_MALIYET = 10;

function clampAvukatIliskisi(deger) {
  const n = Number(deger);
  if (!Number.isFinite(n)) return 100;
  return Math.min(AVUKAT_ILISKI_MAX, Math.max(0, Math.floor(n)));
}

function rastgeleAvukatDususu(min = 5, max = 10) {
  const lo = Math.floor(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function rusvetMiktari(puan) {
  const min = Math.max(10, Math.floor(puan * 0.02));
  const max = Math.max(min, Math.floor(puan * 0.6));
  return { min, max, onerilen: Math.floor((min + max) / 2) };
}

async function getDevletIliskisi(db, userId) {
  const row = await get(db, `SELECT devlet_iliskisi FROM players WHERE user_id = ?`, [userId]);
  return clampAvukatIliskisi(row ? row.devlet_iliskisi : 100);
}

async function devletDusur(db, userId, miktar) {
  const row = await get(db, `SELECT devlet_iliskisi FROM players WHERE user_id = ?`, [userId]);
  const onceki = clampAvukatIliskisi(row?.devlet_iliskisi ?? 100);
  const yeni = clampAvukatIliskisi(onceki - miktar);
  await run(db, `UPDATE players SET devlet_iliskisi = ? WHERE user_id = ?`, [yeni, userId]);
  try {
    const { devletDususundeHapseGir } = require("./hapishaneService");
    await devletDususundeHapseGir(db, userId, onceki, yeni);
  } catch (_) {}
  return yeni;
}

async function hapisKontrol(db, userId) {
  const { hapisKontrol: hapishaneKontrol } = require("./hapishaneService");
  return hapishaneKontrol(db, userId);
}

async function rusvetVer(db, userId, player, miktar) {
  const row = await get(db, `SELECT devlet_iliskisi FROM players WHERE user_id = ?`, [userId]);
  const mevcutIliski = clampAvukatIliskisi(row?.devlet_iliskisi ?? 100);

  if (mevcutIliski >= AVUKAT_ILISKI_MAX) {
    return {
      ok: false,
      error: `Avukat ilişkin zaten maksimumda (${AVUKAT_ILISKI_MAX}). Daha fazla rüşvet veremezsin.`,
    };
  }

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
  const artis = Math.min(RUSVET_ARTIS_MAX, Math.floor(tutar / 50) + 5);
  const yeni = clampAvukatIliskisi(mevcutIliski + artis);
  await run(db, `UPDATE players SET kasa = ?, devlet_iliskisi = ? WHERE user_id = ?`, [
    player.kasa,
    yeni,
    userId,
  ]);
  const mesaj =
    yeni >= AVUKAT_ILISKI_MAX
      ? `Avukat ilişkin +${artis} arttı ve maksimuma ulaştı: ${yeni}/${AVUKAT_ILISKI_MAX}.`
      : `Avukat ilişkin +${artis} arttı: ${yeni}.`;
  return { ok: true, devletIliskisi: yeni, odenen: tutar, artis, mesaj };
}

async function rusvetElmasVer(db, userId, player) {
  const row = await get(db, `SELECT devlet_iliskisi FROM players WHERE user_id = ?`, [userId]);
  const mevcutIliski = clampAvukatIliskisi(row?.devlet_iliskisi ?? 100);

  if (mevcutIliski >= AVUKAT_ILISKI_MAX) {
    return {
      ok: false,
      error: `Avukat ilişkin zaten maksimumda (${AVUKAT_ILISKI_MAX}).`,
    };
  }

  const elmas = player.elmas || 0;
  if (elmas < ELMAS_RUSVET_MALIYET) {
    return {
      ok: false,
      error: `Yeterli elmasın yok! ${ELMAS_RUSVET_MALIYET} elmas gerekir.`,
    };
  }

  player.elmas = elmas - ELMAS_RUSVET_MALIYET;
  await run(db, `UPDATE players SET elmas = ?, devlet_iliskisi = ? WHERE user_id = ?`, [
    player.elmas,
    AVUKAT_ILISKI_MAX,
    userId,
  ]);

  return {
    ok: true,
    devletIliskisi: AVUKAT_ILISKI_MAX,
    harcananElmas: ELMAS_RUSVET_MALIYET,
    mesaj: `${ELMAS_RUSVET_MALIYET} elmas karşılığında avukat ilişkin maksimuma çıkarıldı: ${AVUKAT_ILISKI_MAX}.`,
  };
}

module.exports = {
  HAPSE_GIR_ESIK,
  AVUKAT_ILISKI_MAX,
  RUSVET_ARTIS_MAX,
  RUSVET_MAX,
  ELMAS_RUSVET_MALIYET,
  clampAvukatIliskisi,
  rastgeleAvukatDususu,
  rusvetMiktari,
  getDevletIliskisi,
  devletDusur,
  hapisKontrol,
  rusvetVer,
  rusvetElmasVer,
};
