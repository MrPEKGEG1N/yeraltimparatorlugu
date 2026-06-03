const { run, get } = require("../db/database");

async function getBanka(db, userId) {
  const row = await get(db, `SELECT yatirilan_miktar FROM banka_hesaplari WHERE user_id = ?`, [userId]);
  return row ? row.yatirilan_miktar : 0;
}

async function paraYatir(db, userId, player, yatirMiktari) {
  const yatir = Math.floor(yatirMiktari || 0);
  if (yatir < 1) {
    return { ok: false, error: "Geçerli bir miktar gir." };
  }
  if (player.kasa < yatir) {
    return { ok: false, error: `Yeterli paran yok. (Kasanda: ${player.kasa.toLocaleString("tr-TR")} TL)` };
  }
  
  player.kasa -= yatir;
  const mevcut = await getBanka(db, userId);
  const yeni = mevcut + yatir;
  
  await run(db, `INSERT OR REPLACE INTO banka_hesaplari (user_id, yatirilan_miktar) VALUES (?, ?)`, [userId, yeni]);
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  
  return { ok: true, yatirilan: yatir, toplam: yeni };
}

async function paraCek(db, userId, player, cekMiktari) {
  const mevcut = await getBanka(db, userId);
  const cek = Math.floor(cekMiktari || 0);
  
  if (cek < 1) {
    return { ok: false, error: "Geçerli bir miktar gir." };
  }
  if (mevcut < cek) {
    return { ok: false, error: `Bankada yeterli para yok. (Bankada: ${mevcut.toLocaleString("tr-TR")} TL)` };
  }
  
  const kalan = mevcut - cek;
  player.kasa += cek;
  
  if (kalan > 0) {
    await run(db, `UPDATE banka_hesaplari SET yatirilan_miktar = ? WHERE user_id = ?`, [kalan, userId]);
  } else {
    await run(db, `DELETE FROM banka_hesaplari WHERE user_id = ?`, [userId]);
  }
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  
  return { ok: true, cekilen: cek, yeniKasa: player.kasa };
}

module.exports = {
  getBanka,
  paraYatir,
  paraCek,
};
