const { all } = require("../db/database");

const BOTLAR = [
  { isim: "Baron Süleyman", grup: "Çakır Ailesi", puan: 2450, bot: true },
  { isim: "Kordon Celal", grup: "Ege Reisleri", puan: 1800, bot: true },
  { isim: "Fırtına Temel", grup: "Kuzey Lobisi", puan: 1200, bot: true },
  { isim: "Akrep Nuri", grup: "Gaddarlar Grubu", puan: 600, bot: true },
];

async function getLeaderboard(db, currentUserId) {
  const oyuncular = await all(
    db,
    `SELECT u.reis_adi AS isim, u.grup, p.puan, u.id AS user_id, p.sehre_hukmet_sayisi
     FROM players p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.puan DESC
     LIMIT 50`
  );

  const liste = oyuncular.map((o) => ({
    userId: o.user_id,
    isim: o.isim,
    grup: o.grup,
    puan: o.puan,
    sehreHukmetSayisi: o.sehre_hukmet_sayisi || 0,
    bot: false,
    benim: o.user_id === currentUserId,
  }));

  BOTLAR.forEach((b) => liste.push({ ...b, benim: false }));

  liste.sort((a, b) => b.puan - a.puan);
  return liste.slice(0, 25);
}

async function getGrupLeaderboard(db) {
  const rows = await all(
    db,
    `SELECT g.id AS grup_id, g.isim,
            COALESCE(SUM(p.puan), 0) AS toplam_puan,
            COUNT(DISTINCT u.user_id) AS uye_sayisi,
            COALESCE(e.seviye, 1) AS ev_seviye,
            (SELECT COUNT(*) FROM mafya_savaslar s
             WHERE s.durum = 'tamamlandi' AND s.kazanan_grup_id = g.id) AS kazanilan_savas
     FROM mafya_gruplari g
     LEFT JOIN mafya_uyeleri u ON u.grup_id = g.id
     LEFT JOIN players p ON p.user_id = u.user_id
     LEFT JOIN mafya_evi e ON e.grup_id = g.id
     GROUP BY g.id
     ORDER BY toplam_puan DESC
     LIMIT 25`
  );

  return rows.map((r) => ({
    grupId: r.grup_id,
    isim: r.isim,
    toplamPuan: r.toplam_puan || 0,
    uyeSayisi: r.uye_sayisi || 0,
    evSeviye: r.ev_seviye || 1,
    kazanilanSavas: r.kazanilan_savas || 0,
  }));
}

module.exports = { getLeaderboard, getGrupLeaderboard, BOTLAR };
