const { run, get, all } = require("../db/database");
const { HIRE } = require("./catalog");
const { elitFiyatCarpani } = require("./elitFiyatService");

function birimFiyat(baz, sahipAdet) {
  return Math.floor(baz * Math.pow(1.01, sahipAdet));
}

function toplamFiyat(baz, sahipAdet, miktar) {
  let total = 0;
  for (let i = 0; i < miktar; i++) {
    total += birimFiyat(baz, sahipAdet + i);
  }
  return total;
}

async function getKiralamaAdet(db, userId, itemKey) {
  const row = await get(
    db,
    `SELECT adet FROM oyuncu_kiralama WHERE user_id = ? AND item_key = ?`,
    [userId, itemKey]
  );
  return row ? row.adet || 0 : 0;
}

async function getKiralamaEnvanter(db, userId) {
  const rows = await all(
    db,
    `SELECT item_key, adet FROM oyuncu_kiralama WHERE user_id = ? AND adet > 0`,
    [userId]
  );
  const envanter = {};
  for (const r of rows) {
    envanter[r.item_key] = r.adet;
  }
  return envanter;
}

async function kiralamaSatinAl(db, userId, player, itemKey, miktar) {
  const item = HIRE[itemKey];
  if (!item) return { ok: false, error: "Geçersiz satın alma." };

  const adet = Math.min(999, Math.max(1, parseInt(miktar, 10) || 1));
  const mevcut = await getKiralamaAdet(db, userId, itemKey);
  let toplamMaliyet = toplamFiyat(item.maliyet, mevcut, adet);
  const fiyatCarpani = await elitFiyatCarpani(db, userId);
  toplamMaliyet = Math.floor(toplamMaliyet * fiyatCarpani);
  const toplamGuc = item.guc * adet;

  if (player.kasa < toplamMaliyet) {
    return {
      ok: false,
      error: `Kasanda yeterli nakit yok! ${adet} adet için ${toplamMaliyet.toLocaleString("tr-TR")} TL gerekir.`,
    };
  }

  player.kasa -= toplamMaliyet;
  player.guc += toplamGuc;
  const yeniAdet = mevcut + adet;

  await run(
    db,
    `INSERT INTO oyuncu_kiralama (user_id, item_key, adet) VALUES (?, ?, ?)
     ON CONFLICT(user_id, item_key) DO UPDATE SET adet = excluded.adet`,
    [userId, itemKey, yeniAdet]
  );
  await run(db, `UPDATE players SET kasa = ?, guc = ? WHERE user_id = ?`, [
    player.kasa,
    player.guc,
    userId,
  ]);

  return {
    ok: true,
    unvan: item.unvan,
    guc: toplamGuc,
    adet,
    toplamMaliyet,
    yeniSahip: yeniAdet,
    sonrakiBirimFiyat: birimFiyat(item.maliyet, yeniAdet),
  };
}

function fiyatBilgisi(itemKey, sahipAdet) {
  const item = HIRE[itemKey];
  if (!item) return null;
  return {
    birimFiyat: birimFiyat(item.maliyet, sahipAdet),
    sahipAdet,
  };
}

module.exports = {
  birimFiyat,
  getKiralamaAdet,
  getKiralamaEnvanter,
  kiralamaSatinAl,
  fiyatBilgisi,
};
