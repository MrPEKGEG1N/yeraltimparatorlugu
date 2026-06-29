const { get } = require("../db/database");
const { gucKaybiEnvanterUygula } = require("./kiralamaService");

function toplamGuc(row) {
  const guc = Math.max(0, Number(row?.guc) || 0);
  const bonus = Math.max(0, Number(row?.bonus_guc) || 0);
  return guc + bonus;
}

function savunmaGucu(row) {
  if (!row) return 0;
  return toplamGuc(row);
}

/** Liman / Sözünü Geçir / Sadakat Yemini saldırılarında şehre hükmeden savunması yarı güç */
function makamSavunmaGucu(row) {
  if (!row) return 0;
  let t = toplamGuc(row);
  if (row.kara_listede) t = Math.floor(t * 0.5);
  return t;
}

async function oyuncuGucBilgisi(db, userId) {
  const row = await get(
    db,
    `SELECT guc, COALESCE(bonus_guc, 0) AS bonus_guc, kara_listede FROM players WHERE user_id = ?`,
    [userId]
  );
  if (!row) return { guc: 0, bonus_guc: 0, toplamGuc: 0, savunmaGucu: 0 };
  return {
    guc: row.guc || 0,
    bonus_guc: row.bonus_guc || 0,
    toplamGuc: toplamGuc(row),
    savunmaGucu: savunmaGucu(row),
  };
}

/**
 * Toplam güçten oran kadar kayıp uygular; bonus güç korunur, normal güç + envanter düşer.
 */
async function gucKaybiOranliUygula(db, userId, row, kayipOrani) {
  const bonus = Math.max(0, Number(row?.bonus_guc) || 0);
  const normalGuc = Math.max(0, Number(row?.guc) || 0);
  const toplam = normalGuc + bonus;
  const oran = Math.max(0, Math.min(1, Number(kayipOrani) || 0));
  const hedefToplam = Math.floor(toplam * (1 - oran));
  const hedefNormal = Math.max(0, hedefToplam - bonus);
  const sync = await gucKaybiEnvanterUygula(db, userId, normalGuc, hedefNormal);
  return {
    guc: sync.guc,
    bonus_guc: bonus,
    toplamGuc: sync.guc + bonus,
    envanter: sync.envanter,
    fiyatEnvanter: sync.fiyatEnvanter,
  };
}

module.exports = {
  toplamGuc,
  savunmaGucu,
  makamSavunmaGucu,
  oyuncuGucBilgisi,
  gucKaybiOranliUygula,
};
