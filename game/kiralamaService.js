const { run, get, all } = require("../db/database");
const { HIRE } = require("./catalog");
const { elitFiyatCarpani } = require("./elitFiyatService");

function birimFiyat(baz, sahipAdet) {
  return Math.floor(baz * Math.pow(1.05, sahipAdet));
}

function toplamFiyat(baz, sahipAdet, miktar) {
  let total = 0;
  for (let i = 0; i < miktar; i++) {
    total += birimFiyat(baz, sahipAdet + i);
  }
  return total;
}

function hireGucHesapla(envanter) {
  let total = 0;
  for (const [key, adet] of Object.entries(envanter || {})) {
    const item = HIRE[key];
    if (item && adet > 0) total += item.guc * adet;
  }
  return total;
}

async function getKiralamaRow(db, userId, itemKey) {
  const row = await get(
    db,
    `SELECT adet, COALESCE(fiyat_adet, adet, 0) AS fiyat_adet
     FROM oyuncu_kiralama WHERE user_id = ? AND item_key = ?`,
    [userId, itemKey]
  );
  if (!row) return { adet: 0, fiyat_adet: 0 };
  return {
    adet: row.adet || 0,
    fiyat_adet: row.fiyat_adet || 0,
  };
}

async function getKiralamaAdet(db, userId, itemKey) {
  const row = await getKiralamaRow(db, userId, itemKey);
  return row.adet;
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

async function getKiralamaFiyatEnvanter(db, userId) {
  const rows = await all(
    db,
    `SELECT item_key, COALESCE(fiyat_adet, adet, 0) AS fiyat_adet
     FROM oyuncu_kiralama WHERE user_id = ? AND COALESCE(fiyat_adet, adet, 0) > 0`,
    [userId]
  );
  const envanter = {};
  for (const r of rows) {
    envanter[r.item_key] = r.fiyat_adet || 0;
  }
  return envanter;
}

/**
 * Saldırı vb. güç kaybında: ekip/silah/lüks adetleri orantılı azalır;
 * fiyat basamağı (fiyat_adet) korunur — bir sonraki alım aynı fiyat kademesinden devam eder.
 */
async function gucKaybiEnvanterUygula(db, userId, eskiGuc, hedefGuc) {
  eskiGuc = Math.max(0, Math.floor(Number(eskiGuc) || 0));
  hedefGuc = Math.max(0, Math.floor(Number(hedefGuc) || 0));

  if (hedefGuc >= eskiGuc) {
    return {
      guc: hedefGuc,
      envanter: await getKiralamaEnvanter(db, userId),
      fiyatEnvanter: await getKiralamaFiyatEnvanter(db, userId),
    };
  }

  const rows = await all(
    db,
    `SELECT item_key, adet, COALESCE(fiyat_adet, adet, 0) AS fiyat_adet
     FROM oyuncu_kiralama WHERE user_id = ? AND adet > 0`,
    [userId]
  );

  if (!rows.length) {
    await run(db, `UPDATE players SET guc = ? WHERE user_id = ?`, [hedefGuc, userId]);
    return {
      guc: hedefGuc,
      envanter: {},
      fiyatEnvanter: await getKiralamaFiyatEnvanter(db, userId),
    };
  }

  let hireGuc = 0;
  for (const r of rows) {
    const item = HIRE[r.item_key];
    if (item) hireGuc += item.guc * r.adet;
  }

  if (hireGuc <= 0) {
    await run(db, `UPDATE players SET guc = ? WHERE user_id = ?`, [hedefGuc, userId]);
    return {
      guc: hedefGuc,
      envanter: await getKiralamaEnvanter(db, userId),
      fiyatEnvanter: await getKiralamaFiyatEnvanter(db, userId),
    };
  }

  const otherGuc = Math.max(0, eskiGuc - hireGuc);
  const delta = eskiGuc - hedefGuc;
  const hireLoss = Math.min(delta, hireGuc);
  const targetHireGuc = hireGuc - hireLoss;
  const ratio = targetHireGuc / hireGuc;

  const guncel = rows.map((r) => {
    const item = HIRE[r.item_key];
    const yeniAdet = item ? Math.max(0, Math.floor(r.adet * ratio)) : 0;
    return { ...r, yeniAdet };
  });

  for (const s of guncel) {
    await run(db, `UPDATE oyuncu_kiralama SET adet = ? WHERE user_id = ? AND item_key = ?`, [
      s.yeniAdet,
      userId,
      s.item_key,
    ]);
  }

  const yeniEnvanter = await getKiralamaEnvanter(db, userId);
  const yeniHireGuc = hireGucHesapla(yeniEnvanter);
  const finalGuc = otherGuc + yeniHireGuc;

  await run(db, `UPDATE players SET guc = ? WHERE user_id = ?`, [finalGuc, userId]);

  return {
    guc: finalGuc,
    envanter: yeniEnvanter,
    fiyatEnvanter: await getKiralamaFiyatEnvanter(db, userId),
  };
}

async function kiralamaSatinAl(db, userId, player, itemKey, miktar) {
  const item = HIRE[itemKey];
  if (!item) return { ok: false, error: "Geçersiz satın alma." };

  const adet = Math.min(999, Math.max(1, parseInt(miktar, 10) || 1));
  const mevcut = await getKiralamaRow(db, userId, itemKey);
  let toplamMaliyet = toplamFiyat(item.maliyet, mevcut.fiyat_adet, adet);
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
  const yeniAdet = mevcut.adet + adet;
  const yeniFiyatAdet = mevcut.fiyat_adet + adet;

  await run(
    db,
    `INSERT INTO oyuncu_kiralama (user_id, item_key, adet, fiyat_adet) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, item_key) DO UPDATE SET
       adet = excluded.adet,
       fiyat_adet = excluded.fiyat_adet`,
    [userId, itemKey, yeniAdet, yeniFiyatAdet]
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
    sonrakiBirimFiyat: birimFiyat(item.maliyet, yeniFiyatAdet),
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
  hireGucHesapla,
  getKiralamaAdet,
  getKiralamaEnvanter,
  getKiralamaFiyatEnvanter,
  gucKaybiEnvanterUygula,
  kiralamaSatinAl,
  fiyatBilgisi,
};
