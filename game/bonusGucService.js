const { run, get, all } = require("../db/database");
const { toplamGucBonusu } = require("./guvenliYerCatalog");

/**
 * Mafya evi üye bonus gücü — seviye arttıkça kademeli artar.
 * Güvenli Yer bonusunun altında kalır; grup yatırımıyla anlamlı ama dengeli güç verir.
 * Toplam(s) = 1200·s + 250·s·(s−1)
 */
function mafyaEviGucBonusu(seviye) {
  const s = Math.max(1, parseInt(seviye, 10) || 1);
  return Math.floor(1200 * s + 250 * s * (s - 1));
}

/** Bir sonraki seviyede kazanılacak ek bonus */
function mafyaEviSonrakiBonusArtisi(seviye) {
  const s = Math.max(1, parseInt(seviye, 10) || 1);
  return mafyaEviGucBonusu(s + 1) - mafyaEviGucBonusu(s);
}

async function mafyaEviBonusForUser(db, userId) {
  const row = await get(
    db,
    `SELECT COALESCE(e.seviye, 1) AS seviye
     FROM mafya_uyeleri m
     JOIN mafya_evi e ON e.grup_id = m.grup_id
     WHERE m.user_id = ?`,
    [userId]
  );
  if (!row) return 0;
  return mafyaEviGucBonusu(row.seviye);
}

async function guvenliYerBonusForUser(db, userId) {
  const row = await get(db, `SELECT base_seviye FROM user_base WHERE user_id = ?`, [userId]);
  return toplamGucBonusu(row ? row.base_seviye : 1);
}

async function syncBonusGuc(db, userId) {
  const gy = await guvenliYerBonusForUser(db, userId);
  const me = await mafyaEviBonusForUser(db, userId);
  const total = gy + me;
  await run(db, `UPDATE players SET bonus_guc = ? WHERE user_id = ?`, [total, userId]);
  return { toplam: total, guvenliYer: gy, mafyaEvi: me };
}

async function syncGrupUyeBonusGuc(db, grupId) {
  const uyeler = await all(db, `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`, [grupId]);
  for (const u of uyeler) {
    await syncBonusGuc(db, u.user_id);
  }
}

async function migrateTumBonusGuc(db) {
  const rows = await all(db, `SELECT user_id FROM players`);
  for (const r of rows) {
    await syncBonusGuc(db, r.user_id);
  }
}

module.exports = {
  mafyaEviGucBonusu,
  mafyaEviSonrakiBonusArtisi,
  mafyaEviBonusForUser,
  guvenliYerBonusForUser,
  syncBonusGuc,
  syncGrupUyeBonusGuc,
  migrateTumBonusGuc,
};
