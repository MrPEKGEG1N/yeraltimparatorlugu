const { run, get, all } = require("../db/database");
const { mafyaSavasIlanHaber, mafyaSavasSonucHaber } = require("./sehirGazeteService");
const { gucKaybiOranliUygula, toplamGuc } = require("./gucService");

const SAVAS_BEKLEME_SURESI = 8 * 60 * 60 * 1000; // 8 hours
const GUC_KAYBI_ORANI = 0.1;
const KAYIP_ODEME_BIRIM = 30_000;

async function katilimciEkle(db, savasId, userId, grupId) {
  if (!userId || !grupId) return;
  await run(
    db,
    `INSERT OR IGNORE INTO mafya_savas_katilim (savas_id, user_id, grup_id) VALUES (?, ?, ?)`,
    [savasId, userId, grupId]
  );
}

async function liderleriSavasaEkle(db, savasId, saldiranGrupId, hedefGrupId) {
  const saldiran = await get(db, `SELECT lider_user_id FROM mafya_gruplari WHERE id = ?`, [saldiranGrupId]);
  const hedef = await get(db, `SELECT lider_user_id FROM mafya_gruplari WHERE id = ?`, [hedefGrupId]);
  if (saldiran?.lider_user_id) {
    await katilimciEkle(db, savasId, saldiran.lider_user_id, saldiranGrupId);
  }
  if (hedef?.lider_user_id) {
    await katilimciEkle(db, savasId, hedef.lider_user_id, hedefGrupId);
  }
}

async function grupAktifSavasVarMi(db, grupId) {
  const row = await get(
    db,
    `SELECT id FROM mafya_savaslar
     WHERE durum = 'bekliyor' AND (saldiran_grup_id = ? OR hedef_grup_id = ?)`,
    [grupId, grupId]
  );
  return !!row;
}

async function grupKatilimciToplamGuc(db, savasId, grupId) {
  const katilim = await all(
    db,
    `SELECT user_id FROM mafya_savas_katilim WHERE savas_id = ? AND grup_id = ?`,
    [savasId, grupId]
  );
  let toplam = 0;
  for (const k of katilim) {
    const p = await get(
      db,
      `SELECT guc, COALESCE(bonus_guc, 0) AS bonus_guc FROM players WHERE user_id = ?`,
      [k.user_id]
    );
    toplam += toplamGuc(p);
  }
  return { toplam, katilim };
}

async function savasIlanEt(db, saldiranGrupId, hedefGrupId) {
  // Check if there's already a war between these groups
  const mevcutSavas = await get(
    db,
    `SELECT id FROM mafya_savaslar 
     WHERE ((saldiran_grup_id = ? AND hedef_grup_id = ?) 
        OR (saldiran_grup_id = ? AND hedef_grup_id = ?))
       AND durum IN ('bekliyor', 'aktif')`,
    [saldiranGrupId, hedefGrupId, hedefGrupId, saldiranGrupId]
  );
  
  if (mevcutSavas) {
    return { ok: false, error: "Bu gruplar arasında zaten aktif bir savaş var." };
  }
  
  const baslangicZamani = Date.now();
  const savasZamani = baslangicZamani + SAVAS_BEKLEME_SURESI;
  
  const ins = await run(
    db,
    `INSERT INTO mafya_savaslar (saldiran_grup_id, hedef_grup_id, baslangic_zamani, savas_zamani, durum)
     VALUES (?, ?, ?, ?, 'bekliyor')`,
    [saldiranGrupId, hedefGrupId, baslangicZamani, savasZamani]
  );
  await liderleriSavasaEkle(db, ins.lastID, saldiranGrupId, hedefGrupId);

  const saldiran = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [saldiranGrupId]);
  const hedef = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [hedefGrupId]);
  try {
    await mafyaSavasIlanHaber(db, saldiran?.isim || "?", hedef?.isim || "?");
  } catch (err) {
    console.error("[mafya-savas] gazete ilan:", err?.message || err);
  }

  const { grupUyelerineBildir } = require("./bildirimService");
  const saldiranAd = saldiran?.isim || "Grubun";
  const hedefAd = hedef?.isim || "Düşman";
  grupUyelerineBildir(
    db,
    saldiranGrupId,
    "mafya_savas_baslatildi",
    "Mafya Grubun Savaş Başlattı",
    `${saldiranAd}, ${hedefAd} grubuna karşı savaş ilan etti.`,
    "/?ekran=mafya"
  ).catch(() => {});
  grupUyelerineBildir(
    db,
    hedefGrupId,
    "mafya_savas_acildi",
    "Mafya Grubuna Savaş Açıldı",
    `${saldiranAd} grubu size karşı savaş açtı.`,
    "/?ekran=mafya"
  ).catch(() => {});
  
  return { ok: true, mesaj: "Savaş ilan edildi! 8 saat sonra başlayacak." };
}

async function savasaKatil(db, savasId, userId, grupId) {
  const savas = await get(db, `SELECT * FROM mafya_savaslar WHERE id = ?`, [savasId]);
  if (!savas) {
    return { ok: false, error: "Savaş bulunamadı." };
  }
  
  if (savas.durum !== 'bekliyor') {
    return { ok: false, error: "Savaş katılmaya kapalı." };
  }
  
  if (savas.saldiran_grup_id !== grupId && savas.hedef_grup_id !== grupId) {
    return { ok: false, error: "Bu savaşa katılamazsın." };
  }
  
  const mevcut = await get(
    db,
    `SELECT 1 AS ok FROM mafya_savas_katilim WHERE savas_id = ? AND user_id = ?`,
    [savasId, userId]
  );
  if (mevcut) {
    return { ok: false, error: "Zaten bu savaşa katıldın; savaş bitene kadar ayrılamazsın." };
  }

  await katilimciEkle(db, savasId, userId, grupId);
  return { ok: true, mesaj: "Savaşa katıldın! Savaş bitene kadar ayrılamazsın." };
}

async function savaslariListele(db, grupId, userId = null) {
  const savaslar = await all(
    db,
    `SELECT s.*,
     sg.isim AS saldiran_grup_adi,
     hg.isim AS hedef_grup_adi,
     (SELECT COUNT(*) FROM mafya_savas_katilim WHERE savas_id = s.id AND grup_id = s.saldiran_grup_id) as saldiran_katilim,
     (SELECT COUNT(*) FROM mafya_savas_katilim WHERE savas_id = s.id AND grup_id = s.hedef_grup_id) as hedef_katilim,
     (SELECT 1 FROM mafya_savas_katilim WHERE savas_id = s.id AND user_id = ?) as ben_katildim
     FROM mafya_savaslar s
     JOIN mafya_gruplari sg ON sg.id = s.saldiran_grup_id
     JOIN mafya_gruplari hg ON hg.id = s.hedef_grup_id
     WHERE s.saldiran_grup_id = ? OR s.hedef_grup_id = ?
     ORDER BY s.baslangic_zamani DESC`,
    [userId, grupId, grupId]
  );

  return savaslar.map((s) => ({ ...s, ben_katildim: !!s.ben_katildim }));
}

async function savasiCoz(db) {
  const simdikiZaman = Date.now();
  const bekleyenSavaslar = await all(
    db,
    `SELECT * FROM mafya_savaslar WHERE durum = 'bekliyor' AND savas_zamani <= ?`,
    [simdikiZaman]
  );
  
  for (const savas of bekleyenSavaslar) {
    const saldiran = await grupKatilimciToplamGuc(db, savas.id, savas.saldiran_grup_id);
    const hedef = await grupKatilimciToplamGuc(db, savas.id, savas.hedef_grup_id);
    const saldiranKatilim = saldiran.katilim;
    const hedefKatilim = hedef.katilim;

    let kazananGrupId;
    let kaybedenGrupId;

    // Kazanan: savaşa katılan üyelerin güç + bonus toplamı yüksek olan taraf; eşitlikte savunan kazanır.
    if (saldiran.toplam > hedef.toplam) {
      kazananGrupId = savas.saldiran_grup_id;
      kaybedenGrupId = savas.hedef_grup_id;
    } else {
      kazananGrupId = savas.hedef_grup_id;
      kaybedenGrupId = savas.saldiran_grup_id;
    }
    
    const kazananKatilim =
      kazananGrupId === savas.saldiran_grup_id ? saldiranKatilim : hedefKatilim;
    const kaybedenKatilim =
      kaybedenGrupId === savas.saldiran_grup_id ? saldiranKatilim : hedefKatilim;

    let toplananOdul = 0;
    for (const k of kaybedenKatilim) {
      const player = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [k.user_id]);
      if (!player) continue;
      const kes = Math.min(Math.max(0, player.kasa), KAYIP_ODEME_BIRIM);
      toplananOdul += kes;
      if (kes > 0) {
        await run(db, `UPDATE players SET kasa = kasa - ? WHERE user_id = ?`, [kes, k.user_id]);
      }
    }

    const tumKatilim = [...saldiranKatilim, ...hedefKatilim];
    for (const k of tumKatilim) {
      const player = await get(
        db,
        `SELECT guc, COALESCE(bonus_guc, 0) AS bonus_guc FROM players WHERE user_id = ?`,
        [k.user_id]
      );
      if (!player) continue;
      const gucSync = await gucKaybiOranliUygula(db, k.user_id, player, GUC_KAYBI_ORANI);
      await run(db, `UPDATE players SET guc = ? WHERE user_id = ?`, [gucSync.guc, k.user_id]);
    }

    if (kazananKatilim.length > 0 && toplananOdul > 0) {
      const payBase = Math.floor(toplananOdul / kazananKatilim.length);
      let remainder = toplananOdul - payBase * kazananKatilim.length;
      for (let i = 0; i < kazananKatilim.length; i++) {
        const pay = payBase + (i < remainder ? 1 : 0);
        if (pay <= 0) continue;
        await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [
          pay,
          kazananKatilim[i].user_id,
        ]);
      }
    }
    
    await run(
      db,
      `UPDATE mafya_savaslar SET durum = 'tamamlandi', kazanan_grup_id = ? WHERE id = ?`,
      [kazananGrupId, savas.id]
    );

    const saldiranGrup = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [savas.saldiran_grup_id]);
    const hedefGrup = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [savas.hedef_grup_id]);
    const kazananGrup = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [kazananGrupId]);
    const kaybedenGrup = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [kaybedenGrupId]);
    try {
      await mafyaSavasSonucHaber(
        db,
        kazananGrup?.isim || "?",
        kaybedenGrup?.isim || "?"
      );
    } catch (err) {
      console.error("[mafya-savas] gazete sonuç:", err?.message || err);
    }
  }
}

module.exports = {
  savasIlanEt,
  savasaKatil,
  savaslariListele,
  savasiCoz,
  grupKatilimciToplamGuc,
  grupAktifSavasVarMi,
  SAVAS_BEKLEME_SURESI,
  GUC_KAYBI_ORANI,
  KAYIP_ODEME_BIRIM,
};
