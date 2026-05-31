const { run, get } = require("../db/database");

async function getBanka(db, userId) {
  const row = await get(db, `SELECT yatirilan_miktar FROM banka_hesaplari WHERE user_id = ?`, [userId]);
  return row ? row.yatirilan_miktar : 0;
}

async function paraYatir(db, userId, player) {
  const yatirilacak = Math.floor(player.kasa * 0.2);
  if (yatirilacak < 1) {
    return { ok: false, error: "Yatırılacak para yok." };
  }
  
  player.kasa -= yatirilacak;
  const mevcut = await getBanka(db, userId);
  const yeni = mevcut + yatirilacak;
  
  await run(db, `INSERT OR REPLACE INTO banka_hesaplari (user_id, yatirilan_miktar) VALUES (?, ?)`, [userId, yeni]);
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  
  return { ok: true, yatirilan: yatirilacak, toplam: yeni };
}

async function paraCek(db, userId, player) {
  const mevcut = await getBanka(db, userId);
  if (mevcut < 1) {
    return { ok: false, error: "Bankada para yok." };
  }
  
  player.kasa += mevcut;
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  await run(db, `DELETE FROM banka_hesaplari WHERE user_id = ?`, [userId]);
  
  return { ok: true, cekilen: mevcut, yeniKasa: player.kasa };
}

module.exports = {
  getBanka,
  paraYatir,
  paraCek,
};
