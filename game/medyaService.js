const { run, get, all } = require("../db/database");

const HABER_MALIYET = 100000;

async function haberYayinla(db, userId, player, haberMetni) {
  if (player.kasa < HABER_MALIYET) {
    return { ok: false, error: "Kasanda yeterli nakit yok! Haber için " + HABER_MALIYET.toLocaleString("tr-TR") + " TL gerekir." };
  }

  player.kasa -= HABER_MALIYET;
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);

  const now = Math.floor(Date.now() / 1000);
  await run(
    db,
    `INSERT INTO medya_haberleri (user_id, haber, aktif, created_at) VALUES (?, ?, 1, ?)`,
    [userId, haberMetni, now]
  );

  return { ok: true, mesaj: "Haber yayınlandı! Gazete Oku → Yeraltı Manşetleri bölümünde görünecek." };
}

async function haberleriTemizle(db) {
  const esikZamani = Math.floor(Date.now() / 1000) - 86400;
  await run(db, `UPDATE medya_haberleri SET aktif = 0 WHERE created_at < ?`, [esikZamani]);
}

async function haberleriGetir(db) {
  await haberleriTemizle(db);
  return all(
    db,
    `SELECT h.haber, h.user_id, u.reis_adi, h.created_at
     FROM medya_haberleri h
     JOIN users u ON u.id = h.user_id
     WHERE h.aktif = 1
     ORDER BY h.created_at DESC
     LIMIT 10`
  );
}

module.exports = {
  HABER_MALIYET,
  haberYayinla,
  haberleriGetir,
  haberleriTemizle,
};
