const { run, get, all } = require("../db/database");
const { sektorPanel } = require("./sectorService");
const { getLimanDurumu } = require("./worldService");
const { limanSaatlikToplam } = require("./worldConstants");
const { mafyaSavasIlanHaber, mafyaSavasSonucHaber } = require("./sehirGazeteService");
const { gucKaybiOranliUygula, toplamGuc } = require("./gucService");

const SAVAS_BEKLEME_SURESI = 8 * 60 * 60 * 1000; // 8 hours

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

async function saatlikKazancHesapla(db, userId) {
  const limanlar = await getLimanDurumu(db);
  const sahipLimanlar = limanlar.filter((l) => l.sahipUserId === userId).length;
  const { saatlikKazanc: sektorSaatlik } = await sektorPanel(db, userId);
  return limanSaatlikToplam(sahipLimanlar) + (sektorSaatlik || 0);
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
  
  await run(
    db,
    `INSERT INTO mafya_savaslar (saldiran_grup_id, hedef_grup_id, baslangic_zamani, savas_zamani, durum)
     VALUES (?, ?, ?, ?, 'bekliyor')`,
    [saldiranGrupId, hedefGrupId, baslangicZamani, savasZamani]
  );

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
  
  try {
    await run(
      db,
      `INSERT INTO mafya_savas_katilim (savas_id, user_id, grup_id) VALUES (?, ?, ?)`,
      [savasId, userId, grupId]
    );
    return { ok: true, mesaj: "Savaşa katıldın!" };
  } catch (e) {
    return { ok: false, error: "Zaten bu savaşa katıldın." };
  }
}

async function savaslariListele(db, grupId) {
  const savaslar = await all(
    db,
    `SELECT s.*,
     sg.isim AS saldiran_grup_adi,
     hg.isim AS hedef_grup_adi,
     (SELECT COUNT(*) FROM mafya_savas_katilim WHERE savas_id = s.id AND grup_id = s.saldiran_grup_id) as saldiran_katilim,
     (SELECT COUNT(*) FROM mafya_savas_katilim WHERE savas_id = s.id AND grup_id = s.hedef_grup_id) as hedef_katilim
     FROM mafya_savaslar s
     JOIN mafya_gruplari sg ON sg.id = s.saldiran_grup_id
     JOIN mafya_gruplari hg ON hg.id = s.hedef_grup_id
     WHERE s.saldiran_grup_id = ? OR s.hedef_grup_id = ?
     ORDER BY s.baslangic_zamani DESC`,
    [grupId, grupId]
  );
  
  return savaslar;
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
    
    // Apply penalties
    // Winner: 10% power reduction, 3 hours of hourly income bonus
    // Loser: 50% power reduction, lose all state relations
    
    for (const k of saldiranKatilim) {
      const player = await get(
        db,
        `SELECT guc, COALESCE(bonus_guc, 0) AS bonus_guc, kasa FROM players WHERE user_id = ?`,
        [k.user_id]
      );
      if (player) {
        const kazandi = kazananGrupId === savas.saldiran_grup_id;
        const gucSync = await gucKaybiOranliUygula(db, k.user_id, player, kazandi ? 0.1 : 0.5);
        let yeniKasa = player.kasa;
        let yeniDevlet = null;
        if (kazandi) {
          const saatlik = await saatlikKazancHesapla(db, k.user_id);
          yeniKasa += Math.max(0, Math.floor(saatlik * 3));
        } else {
          yeniDevlet = 0;
        }
        if (yeniDevlet === null) {
          await run(db, `UPDATE players SET guc = ?, kasa = ? WHERE user_id = ?`, [
            gucSync.guc,
            yeniKasa,
            k.user_id,
          ]);
        } else {
          await run(
            db,
            `UPDATE players SET guc = ?, kasa = ?, devlet_iliskisi = ? WHERE user_id = ?`,
            [gucSync.guc, yeniKasa, yeniDevlet, k.user_id]
          );
        }
      }
    }

    for (const k of hedefKatilim) {
      const player = await get(
        db,
        `SELECT guc, COALESCE(bonus_guc, 0) AS bonus_guc, devlet_iliskisi FROM players WHERE user_id = ?`,
        [k.user_id]
      );
      if (player) {
        const kazandi = kazananGrupId === savas.hedef_grup_id;
        const gucSync = await gucKaybiOranliUygula(db, k.user_id, player, kazandi ? 0.1 : 0.5);
        const yeniIliski = kazandi ? player.devlet_iliskisi : 0;
        const kasaRow = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [k.user_id]);
        let yeniKasa = kasaRow?.kasa || 0;
        if (kazandi) {
          const saatlik = await saatlikKazancHesapla(db, k.user_id);
          yeniKasa += Math.max(0, Math.floor(saatlik * 3));
        }
        await run(
          db,
          `UPDATE players SET guc = ?, kasa = ?, devlet_iliskisi = ? WHERE user_id = ?`,
          [gucSync.guc, yeniKasa, yeniIliski, k.user_id]
        );
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
  SAVAS_BEKLEME_SURESI,
};
