const { get, all, run } = require("../db/database");
const { ensureEvi, kapasite } = require("./mafyaEviService");

const CIKIS_UCRET = 1_000_000;

async function kullaniciGrubu(db, userId) {
  return get(
    db,
    `SELECT g.*, m.rutbe, m.user_id AS uye_id
     FROM mafya_uyeleri m
     JOIN mafya_gruplari g ON g.id = m.grup_id
     WHERE m.user_id = ?`,
    [userId]
  );
}

async function bekleyenBasvuruSayisi(db, liderUserId) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM mafya_basvurulari b
     JOIN mafya_gruplari g ON g.id = b.grup_id
     WHERE g.lider_user_id = ? AND b.durum = 'beklemede'`,
    [liderUserId]
  );
  return row ? row.n : 0;
}

async function listeGruplar(db) {
  return all(
    db,
    `SELECT g.id, g.isim, g.aciklama, u.reis_adi AS lider_adi,
            (SELECT COUNT(*) FROM mafya_uyeleri WHERE grup_id = g.id) AS uye_sayisi
     FROM mafya_gruplari g
     JOIN users u ON u.id = g.lider_user_id
     ORDER BY g.isim`
  );
}

async function grupUyeleri(db, grupId) {
  return all(
    db,
    `SELECT m.user_id, m.rutbe, u.reis_adi, p.puan
     FROM mafya_uyeleri m
     JOIN users u ON u.id = m.user_id
     JOIN players p ON p.user_id = m.user_id
     WHERE m.grup_id = ?
     ORDER BY p.puan DESC`,
    [grupId]
  );
}

async function grupOlustur(db, userId, isim, aciklama) {
  const mevcut = await kullaniciGrubu(db, userId);
  if (mevcut) return { ok: false, error: "Zaten bir Mafya Grubundasın." };

  const temizIsim = String(isim || "").trim().slice(0, 32);
  if (temizIsim.length < 2) return { ok: false, error: "Grup adı en az 2 karakter." };

  const varMi = await get(db, `SELECT id FROM mafya_gruplari WHERE LOWER(isim) = LOWER(?)`, [
    temizIsim,
  ]);
  if (varMi) return { ok: false, error: "Bu isimde grup zaten var." };

  const ins = await run(
    db,
    `INSERT INTO mafya_gruplari (isim, aciklama, lider_user_id) VALUES (?, ?, ?)`,
    [temizIsim, String(aciklama || "").slice(0, 200), userId]
  );
  const grupId = ins.lastID;
  await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, ?)`, [
    grupId,
    userId,
    "Mafya Lideri",
  ]);
  await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [temizIsim + " Mafya Grubu", userId]);
  return { ok: true, grupId, isim: temizIsim };
}

async function grupAra(db, arama) {
  const q = `%${String(arama || "").trim()}%`;
  return all(
    db,
    `SELECT g.id, g.isim, g.aciklama, u.reis_adi AS lider_adi
     FROM mafya_gruplari g
     JOIN users u ON u.id = g.lider_user_id
     WHERE g.isim LIKE ? OR g.aciklama LIKE ?
     ORDER BY g.isim LIMIT 20`,
    [q, q]
  );
}

async function basvur(db, userId, grupId) {
  const uyelik = await kullaniciGrubu(db, userId);
  if (uyelik) return { ok: false, error: "Zaten bir gruptasın." };
  const bekleyen = await get(
    db,
    `SELECT id FROM mafya_basvurulari WHERE user_id = ? AND durum = 'beklemede'`,
    [userId]
  );
  if (bekleyen) return { ok: false, error: "Zaten bekleyen bir başvurun var." };
  await run(
    db,
    `INSERT INTO mafya_basvurulari (grup_id, user_id, durum) VALUES (?, ?, 'beklemede')`,
    [grupId, userId]
  );
  return { ok: true };
}

async function basvuruKabul(db, liderId, basvuruId) {
  const b = await get(
    db,
    `SELECT b.*, g.lider_user_id FROM mafya_basvurulari b
     JOIN mafya_gruplari g ON g.id = b.grup_id WHERE b.id = ?`,
    [basvuruId]
  );
  if (!b || b.lider_user_id !== liderId) return { ok: false, error: "Yetkisiz." };

  // Mafya Evi kapasitesi kontrolü
  const ev = await ensureEvi(db, b.grup_id);
  const cap = kapasite(ev.seviye);
  const cnt = await get(db, `SELECT COUNT(*) AS n FROM mafya_uyeleri WHERE grup_id = ?`, [b.grup_id]);
  if ((cnt?.n || 0) >= cap) {
    return { ok: false, error: `Mafya Evi kapasitesi dolu (max ${cap}). Seviye yükseltin.` };
  }

  await run(db, `UPDATE mafya_basvurulari SET durum = 'kabul' WHERE id = ?`, [basvuruId]);
  await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, ?)`, [
    b.grup_id,
    b.user_id,
    "Mafya Üyesi",
  ]);
  const grup = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [b.grup_id]);
  await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [
    grup.isim + " Mafya Grubu",
    b.user_id,
  ]);
  return { ok: true };
}

async function basvuruRed(db, liderId, basvuruId) {
  const b = await get(
    db,
    `SELECT b.*, g.lider_user_id FROM mafya_basvurulari b
     JOIN mafya_gruplari g ON g.id = b.grup_id WHERE b.id = ?`,
    [basvuruId]
  );
  if (!b || b.lider_user_id !== liderId) return { ok: false, error: "Yetkisiz." };
  await run(db, `UPDATE mafya_basvurulari SET durum = 'red' WHERE id = ?`, [basvuruId]);
  return { ok: true };
}

async function rutbeDegistir(db, liderId, hedefUserId, yeniRutbe) {
  const grup = await kullaniciGrubu(db, liderId);
  if (!grup || grup.lider_user_id !== liderId) return { ok: false, error: "Sadece lider rütbe verir." };
  const uye = await get(
    db,
    `SELECT * FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`,
    [grup.id, hedefUserId]
  );
  if (!uye) return { ok: false, error: "Üye bulunamadı." };
  if (hedefUserId === liderId) return { ok: false, error: "Liderin rütbesi sabittir." };
  const rutbe = String(yeniRutbe || "").trim().slice(0, 40) || "Mafya Üyesi";
  await run(db, `UPDATE mafya_uyeleri SET rutbe = ? WHERE grup_id = ? AND user_id = ?`, [
    rutbe,
    grup.id,
    hedefUserId,
  ]);
  return { ok: true };
}

async function uyeCikar(db, liderId, hedefUserId) {
  const grup = await kullaniciGrubu(db, liderId);
  if (!grup || grup.lider_user_id !== liderId) return { ok: false, error: "Yetkisiz." };
  if (hedefUserId === liderId) return { ok: false, error: "Kendini çıkaramazsın." };
  await run(db, `DELETE FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`, [
    grup.id,
    hedefUserId,
  ]);
  await run(db, `UPDATE users SET grup = 'Bağımsız Reis' WHERE id = ?`, [hedefUserId]);
  return { ok: true };
}

async function liderlikDevret(db, liderId, yeniLiderId) {
  const grup = await kullaniciGrubu(db, liderId);
  if (!grup || grup.lider_user_id !== liderId) return { ok: false, error: "Yetkisiz." };
  const uye = await get(
    db,
    `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`,
    [grup.id, yeniLiderId]
  );
  if (!uye) return { ok: false, error: "Yeni lider grupta olmalı." };
  await run(db, `UPDATE mafya_gruplari SET lider_user_id = ? WHERE id = ?`, [yeniLiderId, grup.id]);
  await run(db, `UPDATE mafya_uyeleri SET rutbe = 'Mafya Üyesi' WHERE grup_id = ? AND user_id = ?`, [
    grup.id,
    liderId,
  ]);
  await run(db, `UPDATE mafya_uyeleri SET rutbe = 'Mafya Lideri' WHERE grup_id = ? AND user_id = ?`, [
    grup.id,
    yeniLiderId,
  ]);
  return { ok: true };
}

async function gurupDagit(db, liderId) {
  const grup = await kullaniciGrubu(db, liderId);
  if (!grup || grup.lider_user_id !== liderId) return { ok: false, error: "Yetkisiz." };
  const uyeler = await all(db, `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`, [grup.id]);
  await run(db, `DELETE FROM mafya_basvurulari WHERE grup_id = ?`, [grup.id]);
  await run(db, `DELETE FROM mafya_uyeleri WHERE grup_id = ?`, [grup.id]);
  await run(db, `DELETE FROM mafya_gruplari WHERE id = ?`, [grup.id]);
  for (const u of uyeler) {
    await run(db, `UPDATE users SET grup = 'Bağımsız Reis' WHERE id = ?`, [u.user_id]);
  }
  return { ok: true };
}

async function guruptanCik(db, userId, player) {
  const uyelik = await kullaniciGrubu(db, userId);
  if (!uyelik) return { ok: false, error: "Grupta değilsin." };
  if (uyelik.lider_user_id === userId) {
    return { ok: false, error: "Lider önce liderliği devretmeli veya grubu dağıtmalı." };
  }
  if (player.kasa < CIKIS_UCRET) {
    return { ok: false, error: `Çıkmak için ${CIKIS_UCRET.toLocaleString("tr-TR")} TL gerekir.` };
  }
  player.kasa -= CIKIS_UCRET;
  const lider = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [uyelik.lider_user_id]);
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [
    lider.kasa + CIKIS_UCRET,
    uyelik.lider_user_id,
  ]);
  await run(db, `DELETE FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`, [
    uyelik.id,
    userId,
  ]);
  await run(db, `UPDATE users SET grup = 'Bağımsız Reis' WHERE id = ?`, [userId]);
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  return { ok: true, player };
}

async function mafyaPanel(db, userId) {
  const uyelik = await kullaniciGrubu(db, userId);
  const bekleyenSayisi = await bekleyenBasvuruSayisi(db, userId);
  if (!uyelik) {
    return {
      uyelik: null,
      bekleyenBasvuru: bekleyenSayisi,
      tumGruplar: await listeGruplar(db),
    };
  }
  const uyeler = await grupUyeleri(db, uyelik.id);
  let basvurular = [];
  if (uyelik.lider_user_id === userId) {
    basvurular = await all(
      db,
      `SELECT b.id, b.user_id, u.reis_adi FROM mafya_basvurulari b
       JOIN users u ON u.id = b.user_id
       WHERE b.grup_id = ? AND b.durum = 'beklemede'`,
      [uyelik.id]
    );
  }
  return {
    uyelik: {
      id: uyelik.id,
      isim: uyelik.isim,
      aciklama: uyelik.aciklama,
      liderUserId: uyelik.lider_user_id,
      benLiderim: uyelik.lider_user_id === userId,
      rutbe: uyelik.rutbe,
    },
    uyeler,
    basvurular,
    bekleyenBasvuru: bekleyenSayisi,
  };
}

module.exports = {
  CIKIS_UCRET,
  mafyaPanel,
  kullaniciGrubu,
  grupOlustur,
  grupAra,
  basvur,
  basvuruKabul,
  basvuruRed,
  rutbeDegistir,
  uyeCikar,
  liderlikDevret,
  gurupDagit,
  guruptanCik,
  bekleyenBasvuruSayisi,
};
