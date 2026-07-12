const { run, get } = require("../db/database");
const { ICRAAT_MAX, ICRAAT_REGEN_SEC, ICRAAT_SAATLIK_BONUS } = require("./catalog");

function normalizeLastIcraatAt(value, now) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return now;
  return Math.floor(n);
}

function applyIcraatRegen(player, nowSec, bonuslar) {
  bonuslar = bonuslar || {};
  const saatlikBonus = bonuslar.icraatSaatlik ?? ICRAAT_SAATLIK_BONUS;
  const now = nowSec != null ? nowSec : Math.floor(Date.now() / 1000);
  const lastAt = normalizeLastIcraatAt(player.last_icraat_at, now);
  const elapsed = now - lastAt;
  const hours = Math.floor(elapsed / ICRAAT_REGEN_SEC);

  if (hours <= 0) {
    return {
      icraat: player.icraat || 0,
      last_icraat_at: lastAt,
      yenilendi: false,
      eklenen: 0,
    };
  }

  const eklenen = hours * saatlikBonus;
  return {
    icraat: Math.min(ICRAAT_MAX, (player.icraat || 0) + eklenen),
    last_icraat_at: lastAt + hours * ICRAAT_REGEN_SEC,
    yenilendi: true,
    eklenen,
  };
}

async function syncIcraatRegen(db, userId) {
  const row = await get(db, `SELECT icraat, last_icraat_at FROM players WHERE user_id = ?`, [userId]);
  if (!row) {
    const now = Math.floor(Date.now() / 1000);
    return { icraat: 0, last_icraat_at: now, yenilendi: false, eklenen: 0 };
  }

  let bonuslar = {};
  try {
    const { getPremiumBonuses } = require("./premiumService");
    const b = await getPremiumBonuses(db, userId);
    bonuslar = { icraatSaatlik: b.icraatSaatlik };
  } catch (_) {}

  const synced = applyIcraatRegen(
    {
      icraat: row.icraat,
      last_icraat_at: row.last_icraat_at,
    },
    undefined,
    bonuslar
  );

  if (
    synced.icraat !== Number(row.icraat || 0) ||
    synced.last_icraat_at !== normalizeLastIcraatAt(row.last_icraat_at, synced.last_icraat_at)
  ) {
    await run(db, `UPDATE players SET icraat = ?, last_icraat_at = ? WHERE user_id = ?`, [
      synced.icraat,
      synced.last_icraat_at,
      userId,
    ]);
  }

  return synced;
}

async function icraatHarca(db, userId, miktar) {
  const miktarInt = Math.max(0, Math.floor(Number(miktar) || 0));
  if (miktarInt <= 0) return { ok: true, icraat: null };

  const synced = await syncIcraatRegen(db, userId);
  if (synced.icraat < miktarInt) {
    return { ok: false, error: "Yeterli İcraat Hakkın kalmadı! Biraz bekle." };
  }

  const yeni = synced.icraat - miktarInt;
  await run(db, `UPDATE players SET icraat = ? WHERE user_id = ?`, [yeni, userId]);
  try {
    const { logStatHareket } = require("./statService");
    await logStatHareket(db, userId, "icraat", miktarInt);
  } catch (_) {}
  return { ok: true, icraat: yeni };
}

module.exports = {
  ICRAAT_MAX,
  ICRAAT_REGEN_SEC,
  ICRAAT_SAATLIK_BONUS,
  applyIcraatRegen,
  syncIcraatRegen,
  icraatHarca,
};
