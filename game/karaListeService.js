const { run, get, all } = require("../db/database");
const { sektorPanel } = require("./sectorService");
const {
  LIMAN_IDS,
  BABA_MAKAMLAR,
  LIMAN_SAATLIK,
} = require("./worldConstants");
const { yeniHukumdarRejimBaslat, hukumdarligiBitir } = require("./saygiDuvariService");

async function karaListeyeEkle(db, userId) {
  await run(db, `UPDATE players SET kara_listede = 1 WHERE user_id = ?`, [userId]);
}

async function karaListedenCikar(db, userId) {
  await run(db, `UPDATE players SET kara_listede = 0 WHERE user_id = ?`, [userId]);
}

async function karaListeyiGetir(db) {
  const liste = await all(
    db,
    `SELECT u.id AS user_id, u.reis_adi, u.grup, p.puan
     FROM players p
     JOIN users u ON u.id = p.user_id
     WHERE p.kara_listede = 1
     ORDER BY p.puan DESC`
  );
  return liste;
}

async function sehreHukmediyorMu(db, userId) {
  // limanlar
  const limanlar = await all(
    db,
    `SELECT liman_id FROM liman_sahiplik WHERE owner_user_id = ?`,
    [userId]
  );
  const limanSahibi = LIMAN_IDS.every((l) => limanlar.some((x) => x.liman_id === l));

  // makamlar
  const makams = await all(
    db,
    `SELECT makam FROM baba_makamlari WHERE owner_user_id = ?`,
    [userId]
  );
  const makamSahibi = BABA_MAKAMLAR.every((m) => makams.some((x) => x.makam === m));

  return limanSahibi && makamSahibi;
}

async function saatlikKazancHesapla(db, userId) {
  const { getLimanDurumu } = require("./worldService");
  const limanlar = await getLimanDurumu(db);
  const sahipLiman = limanlar.filter((l) => l.sahipUserId === userId).length;
  const { saatlikKazanc: sektorSaatlik } = await sektorPanel(db, userId);
  return sahipLiman * LIMAN_SAATLIK + (sektorSaatlik || 0);
}

async function sehreHukmetGuncelle(db, yeniHukumdarId) {
  const yeni = await sehreHukmediyorMu(db, yeniHukumdarId);
  if (!yeni) return { ok: true, degisti: false };

  const eski = await get(
    db,
    `SELECT user_id FROM players WHERE kara_listede = 1 AND user_id <> ? LIMIT 1`,
    [yeniHukumdarId]
  );

  // Kara liste tek kişi olsun
  await run(db, `UPDATE players SET kara_listede = 0 WHERE user_id <> ?`, [yeniHukumdarId]);

  // Yeni hükümranı işaretle + sayacı arttır
  await run(
    db,
    `UPDATE players SET kara_listede = 1, sehre_hukmet_sayisi = sehre_hukmet_sayisi + 1 WHERE user_id = ?`,
    [yeniHukumdarId]
  );

  // Ödül: alınan kişinin 24 saatlik kazancı
  const oncekiId = eski?.user_id || null;
  if (oncekiId) {
    await hukumdarligiBitir(db, oncekiId);
    const eskiU = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [oncekiId]);
    const yeniU = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [yeniHukumdarId]);
    if (eskiU?.reis_adi && yeniU?.reis_adi) {
      const { hukumdarDegisimHaberleri } = require("./sehirGazeteService");
      await hukumdarDegisimHaberleri(db, eskiU.reis_adi, yeniU.reis_adi);
    }
    const eskiSaatlik = await saatlikKazancHesapla(db, oncekiId);
    const odul = Math.max(0, Math.floor(eskiSaatlik * 24));
    await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [odul, yeniHukumdarId]);
    await yeniHukumdarRejimBaslat(db, yeniHukumdarId, oncekiId);
    return { ok: true, degisti: true, odulVar: true };
  }
  await yeniHukumdarRejimBaslat(db, yeniHukumdarId, null);
  return { ok: true, degisti: true, odulVar: false };
}

async function kaybedenHukumdariKontrol(db, userId) {
  if (!userId) return;
  const row = await get(db, `SELECT kara_listede FROM players WHERE user_id = ?`, [userId]);
  if (!row?.kara_listede) return;
  if (await sehreHukmediyorMu(db, userId)) return;
  await karaListedenCikar(db, userId);
  await hukumdarligiBitir(db, userId);
}

/** Oyuncu yüklemede kara listeyi gerçek duruma göre düzelt */
async function karaListeSenkronize(db) {
  const oyuncular = await all(db, `SELECT user_id FROM players`);
  let hukumdar = null;
  for (const o of oyuncular) {
    if (await sehreHukmediyorMu(db, o.user_id)) {
      hukumdar = o.user_id;
      break;
    }
  }
  await run(db, `UPDATE players SET kara_listede = 0`);
  if (hukumdar) {
    const onceki = await get(db, `SELECT kara_listede FROM players WHERE user_id = ?`, [hukumdar]);
    await run(db, `UPDATE players SET kara_listede = 1 WHERE user_id = ?`, [hukumdar]);
    if (!onceki?.kara_listede) {
      await sehreHukmetGuncelle(db, hukumdar);
    }
  }
  return hukumdar;
}

module.exports = {
  karaListeyeEkle,
  karaListedenCikar,
  karaListeyiGetir,
  sehreHukmediyorMu,
  sehreHukmetGuncelle,
  kaybedenHukumdariKontrol,
  karaListeSenkronize,
};
