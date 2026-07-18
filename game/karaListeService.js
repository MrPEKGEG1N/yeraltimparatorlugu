const { run, get, all } = require("../db/database");
const { sektorPanel } = require("./sectorService");
const {
  LIMAN_IDS,
  BABA_MAKAMLAR,
  limanSaatlikToplam,
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
    `SELECT u.id AS user_id, u.reis_adi, u.grup, p.puan, m.grup_id
     FROM players p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN mafya_uyeleri m ON m.user_id = u.id
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

/** Tüm liman ve makamlara sahip tek oyuncunun kimliği (liderlik vb. için). */
async function getSehreHukmedenUserId(db) {
  const adaylar = await all(
    db,
    `SELECT owner_user_id AS user_id
     FROM liman_sahiplik
     WHERE owner_user_id IS NOT NULL AND liman_id IN (${LIMAN_IDS.map(() => "?").join(",")})
     GROUP BY owner_user_id
     HAVING COUNT(DISTINCT liman_id) = ?`,
    [...LIMAN_IDS, LIMAN_IDS.length]
  );
  for (const a of adaylar) {
    if (a.user_id && (await sehreHukmediyorMu(db, a.user_id))) return a.user_id;
  }
  return null;
}

const SEHRE_HUKMET_SAYGINLIK_ORAN = 0.05;
const MAKAM_LIMAN_SAYGINLIK_ORAN = 0.01;

async function ensureDusenHukumdarTable(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sehir_hukum_odul (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      dusen_user_id INTEGER,
      puan_baslangic INTEGER NOT NULL DEFAULT 0,
      alinmis INTEGER NOT NULL DEFAULT 0
    )`
  );
  try {
    await run(db, `ALTER TABLE sehir_hukum_odul ADD COLUMN puan_baslangic INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE sehir_hukum_odul ADD COLUMN alinmis INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
}

/** Düşen hükümranı sakla — kademeli ele geçirmede toplam %5 tavanı için */
async function dusenHukumdarKaydet(db, userId) {
  if (!userId) return;
  await ensureDusenHukumdarTable(db);
  const mevcut = await get(db, `SELECT dusen_user_id FROM sehir_hukum_odul WHERE id = 1`);
  if (mevcut?.dusen_user_id === userId) return;
  const puanRow = await get(db, `SELECT puan FROM players WHERE user_id = ?`, [userId]);
  const puanBaslangic = Math.max(0, puanRow?.puan || 0);
  await run(
    db,
    `INSERT INTO sehir_hukum_odul (id, dusen_user_id, puan_baslangic, alinmis) VALUES (1, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET
       dusen_user_id = excluded.dusen_user_id,
       puan_baslangic = excluded.puan_baslangic,
       alinmis = 0`,
    [userId, puanBaslangic]
  );
}

async function dusenHukumdarOku(db) {
  await ensureDusenHukumdarTable(db);
  const row = await get(
    db,
    `SELECT dusen_user_id, puan_baslangic, alinmis FROM sehir_hukum_odul WHERE id = 1`
  );
  return row || null;
}

async function dusenHukumdarAlinmisEkle(db, miktar) {
  if (!miktar || miktar <= 0) return;
  await ensureDusenHukumdarTable(db);
  await run(db, `UPDATE sehir_hukum_odul SET alinmis = alinmis + ? WHERE id = 1`, [miktar]);
}

async function dusenHukumdarTemizle(db) {
  await ensureDusenHukumdarTable(db);
  await run(
    db,
    `UPDATE sehir_hukum_odul SET dusen_user_id = NULL, puan_baslangic = 0, alinmis = 0 WHERE id = 1`
  );
}

/** Kazanan ← kaybeden saygınlık transferi (oran: 0.01 = %1) */
async function sayginlikOranAktar(db, kazananId, kaybedenId, oran) {
  if (!kazananId || !kaybedenId || kazananId === kaybedenId) return 0;
  const r = Math.max(0, Number(oran) || 0);
  if (r <= 0) return 0;
  const row = await get(db, `SELECT puan FROM players WHERE user_id = ?`, [kaybedenId]);
  const eskiPuan = Math.max(0, row?.puan || 0);
  const miktar = Math.floor(eskiPuan * r);
  if (miktar <= 0) return 0;
  await run(db, `UPDATE players SET puan = puan + ? WHERE user_id = ?`, [miktar, kazananId]);
  await run(db, `UPDATE players SET puan = ? WHERE user_id = ?`, [
    Math.max(0, eskiPuan - miktar),
    kaybedenId,
  ]);
  const { logStatHareket } = require("./statService");
  await logStatHareket(db, kazananId, "sayginlik", miktar);
  await logStatHareket(db, kaybedenId, "sayginlik", -miktar);
  return miktar;
}

async function saatlikKazancHesapla(db, userId) {
  const { getLimanDurumu } = require("./worldService");
  const limanlar = await getLimanDurumu(db);
  const sahipLiman = limanlar.filter((l) => l.sahipUserId === userId).length;
  const { saatlikKazanc: sektorSaatlik } = await sektorPanel(db, userId);
  return limanSaatlikToplam(sahipLiman) + (sektorSaatlik || 0);
}

async function sehreHukmetGuncelle(db, yeniHukumdarId, opts = {}) {
  const yeni = await sehreHukmediyorMu(db, yeniHukumdarId);
  if (!yeni) return { ok: true, degisti: false };

  const eskiKara = await get(
    db,
    `SELECT user_id FROM players WHERE kara_listede = 1 AND user_id <> ? LIMIT 1`,
    [yeniHukumdarId]
  );

  let oncekiId = opts.oncekiHukumdarId || null;
  const dusenRow = await dusenHukumdarOku(db);
  if (!oncekiId && dusenRow?.dusen_user_id) oncekiId = dusenRow.dusen_user_id;
  if (!oncekiId && eskiKara?.user_id) oncekiId = eskiKara.user_id;
  if (oncekiId === yeniHukumdarId) oncekiId = null;

  // Kara liste tek kişi olsun
  await run(db, `UPDATE players SET kara_listede = 0 WHERE user_id <> ?`, [yeniHukumdarId]);

  // Yeni hükümranı işaretle + sayacı arttır
  await run(
    db,
    `UPDATE players SET kara_listede = 1, sehre_hukmet_sayisi = sehre_hukmet_sayisi + 1 WHERE user_id = ?`,
    [yeniHukumdarId]
  );

  // Ödül: tüm liman + makamlar tamamlanınca önceki hükümranın saygınlığının %5'i (kademeli %1'ler düşülür)
  if (oncekiId) {
    await hukumdarligiBitir(db, oncekiId);
    const eskiU = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [oncekiId]);
    const yeniU = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [yeniHukumdarId]);
    if (eskiU?.reis_adi && yeniU?.reis_adi) {
      const { hukumdarDegisimHaberleri } = require("./sehirGazeteService");
      await hukumdarDegisimHaberleri(db, eskiU.reis_adi, yeniU.reis_adi);
    }

    const puanBaz =
      dusenRow?.dusen_user_id === oncekiId && dusenRow.puan_baslangic > 0
        ? dusenRow.puan_baslangic
        : (await get(db, `SELECT puan FROM players WHERE user_id = ?`, [oncekiId]))?.puan || 0;
    const hedefOdul = Math.max(0, Math.floor(puanBaz * SEHRE_HUKMET_SAYGINLIK_ORAN));
    const alinmis = dusenRow?.dusen_user_id === oncekiId ? dusenRow.alinmis || 0 : 0;
    const kalanOdul = Math.max(0, hedefOdul - alinmis);

    let odulSayginlik = 0;
    if (kalanOdul > 0) {
      const kaybedenPuan =
        (await get(db, `SELECT puan FROM players WHERE user_id = ?`, [oncekiId]))?.puan || 0;
      odulSayginlik = Math.min(kalanOdul, Math.max(0, kaybedenPuan));
      if (odulSayginlik > 0) {
        await run(db, `UPDATE players SET puan = puan + ? WHERE user_id = ?`, [
          odulSayginlik,
          yeniHukumdarId,
        ]);
        await run(db, `UPDATE players SET puan = ? WHERE user_id = ?`, [
          Math.max(0, kaybedenPuan - odulSayginlik),
          oncekiId,
        ]);
        const { logStatHareket } = require("./statService");
        await logStatHareket(db, yeniHukumdarId, "sayginlik", odulSayginlik);
        await logStatHareket(db, oncekiId, "sayginlik", -odulSayginlik);
      }
    }

    await dusenHukumdarTemizle(db);
    await yeniHukumdarRejimBaslat(db, yeniHukumdarId, oncekiId);
    try {
      const { schedulePlayerSnapshotPersist } = require("./oyuncuSnapshotPersist");
      schedulePlayerSnapshotPersist(db, yeniHukumdarId, 8000);
      schedulePlayerSnapshotPersist(db, oncekiId, 8000);
    } catch (_) {}
    return {
      ok: true,
      degisti: true,
      odulVar: odulSayginlik > 0 || hedefOdul > 0,
      odulSayginlik: hedefOdul, // toplam fetih ödülü (gösterim); transfer kalan kadardı
      odulSayginlikTransfer: odulSayginlik,
      oncekiId,
    };
  }

  await dusenHukumdarTemizle(db);
  await yeniHukumdarRejimBaslat(db, yeniHukumdarId, null);
  try {
    const { schedulePlayerSnapshotPersist } = require("./oyuncuSnapshotPersist");
    schedulePlayerSnapshotPersist(db, yeniHukumdarId, 8000);
  } catch (_) {}
  return { ok: true, degisti: true, odulVar: false, odulSayginlik: 0 };
}

async function kaybedenHukumdariKontrol(db, userId) {
  if (!userId) return;
  const row = await get(db, `SELECT kara_listede FROM players WHERE user_id = ?`, [userId]);
  if (!row?.kara_listede) return;
  if (await sehreHukmediyorMu(db, userId)) return;
  await dusenHukumdarKaydet(db, userId);
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

  const oncekiKara = hukumdar
    ? await get(db, `SELECT kara_listede FROM players WHERE user_id = ?`, [hukumdar])
    : null;

  await run(db, `UPDATE players SET kara_listede = 0`);
  if (hukumdar) {
    await run(db, `UPDATE players SET kara_listede = 1 WHERE user_id = ?`, [hukumdar]);
    await dusenHukumdarTemizle(db);
    if (!oncekiKara?.kara_listede) {
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
  getSehreHukmedenUserId,
  sehreHukmetGuncelle,
  kaybedenHukumdariKontrol,
  karaListeSenkronize,
  sayginlikOranAktar,
  dusenHukumdarOku,
  dusenHukumdarAlinmisEkle,
  SEHRE_HUKMET_SAYGINLIK_ORAN,
  MAKAM_LIMAN_SAYGINLIK_ORAN,
};
