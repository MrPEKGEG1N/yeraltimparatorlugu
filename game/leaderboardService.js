const { all, get } = require("../db/database");
const { temizGrupAdi, gercekGrupAdi } = require("./grupAdi");
const { kullaniciGrubu } = require("./mafiaService");

async function getLeaderboard(db, currentUserId) {
  const oyuncular = await all(
    db,
    `SELECT u.reis_adi AS isim, u.grup, p.puan, u.id AS user_id, p.sehre_hukmet_sayisi,
            m.grup_id, mg.isim AS gercek_grup_adi
     FROM players p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN mafya_uyeleri m ON m.user_id = u.id
     LEFT JOIN mafya_gruplari mg ON mg.id = m.grup_id
     ORDER BY p.puan DESC
     LIMIT 50`
  );

  return oyuncular.slice(0, 25).map((o) => ({
    userId: o.user_id,
    isim: o.isim,
    grup: gercekGrupAdi(o.gercek_grup_adi || o.grup, o.grup_id),
    grupId: o.grup_id || null,
    puan: o.puan,
    sehreHukmetSayisi: o.sehre_hukmet_sayisi || 0,
    bot: false,
    benim: o.user_id === currentUserId,
  }));
}

async function getOyuncuSira(db, userId) {
  const row = await get(db, `SELECT puan FROM players WHERE user_id = ?`, [userId]);
  if (!row) return null;
  const ust = await get(
    db,
    `SELECT COUNT(*) AS n FROM players WHERE puan > ?`,
    [row.puan || 0]
  );
  return (ust?.n || 0) + 1;
}

async function getGrupSira(db, userId, grupAdiFallback) {
  const grupListe = await getGrupLeaderboard(db);
  const grupUyelik = await kullaniciGrubu(db, userId);
  let grupIdx = -1;
  if (grupUyelik?.id) {
    grupIdx = grupListe.findIndex((g) => g.grupId === grupUyelik.id);
  }
  if (grupIdx < 0 && grupAdiFallback) {
    const grupAdi = temizGrupAdi(grupAdiFallback);
    grupIdx = grupListe.findIndex((g) => temizGrupAdi(g.isim) === grupAdi);
  }
  return grupIdx >= 0 ? grupIdx + 1 : null;
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

module.exports = { getLeaderboard, getGrupLeaderboard, getOyuncuSira, getGrupSira };
