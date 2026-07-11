const { get, all, run } = require("../db/database");
const { ensureEvi, kapasite } = require("./mafyaEviService");
const { sanitizeProfilAciklama } = require("./profilAciklamaSanitize");
const { syncBonusGuc } = require("./bonusGucService");
const { grupAktifSavasVarMi } = require("./mafyaSavasService");

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
    `SELECT m.user_id, m.rutbe, u.reis_adi, p.puan, p.last_seen_at
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

  const acik = sanitizeProfilAciklama(aciklama);

  const ins = await run(
    db,
    `INSERT INTO mafya_gruplari (isim, aciklama, lider_user_id) VALUES (?, ?, ?)`,
    [temizIsim, acik, userId]
  );
  const grupId = ins.lastID;
  await ensureEvi(db, grupId);
  await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, ?)`, [
    grupId,
    userId,
    "Mafya Lideri",
  ]);
  await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [temizIsim, userId]);
  await syncBonusGuc(db, userId);
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
  await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [grup.isim, b.user_id]);
  await syncBonusGuc(db, b.user_id);
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

async function ensureDavetTablosu(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_davetleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER NOT NULL,
      davet_eden_user_id INTEGER NOT NULL,
      davet_edilen_user_id INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'beklemede',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (davet_eden_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (davet_edilen_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  try {
    await run(db, `ALTER TABLE oyuncu_mesajlari ADD COLUMN davet_id INTEGER`);
  } catch (_) {}
}

async function davetEt(db, liderId, hedefUserId) {
  await ensureDavetTablosu(db);
  const hedefId = parseInt(hedefUserId, 10);
  if (!hedefId) return { ok: false, error: "Geçersiz oyuncu." };
  if (hedefId === liderId) return { ok: false, error: "Kendini davet edemezsin." };

  const grup = await kullaniciGrubu(db, liderId);
  if (!grup || grup.lider_user_id !== liderId) {
    return { ok: false, error: "Sadece grup lideri davet gönderebilir." };
  }

  const hedefUyelik = await kullaniciGrubu(db, hedefId);
  if (hedefUyelik) return { ok: false, error: "Bu oyuncu zaten bir mafya grubunda." };

  const bekleyenBasvuru = await get(
    db,
    `SELECT id FROM mafya_basvurulari WHERE user_id = ? AND durum = 'beklemede'`,
    [hedefId]
  );
  if (bekleyenBasvuru) return { ok: false, error: "Oyuncunun bekleyen bir başvurusu var." };

  const bekleyenDavet = await get(
    db,
    `SELECT id FROM mafya_davetleri WHERE davet_edilen_user_id = ? AND durum = 'beklemede'`,
    [hedefId]
  );
  if (bekleyenDavet) return { ok: false, error: "Bu oyuncuya zaten bekleyen bir davet var." };

  const bekleyenBizden = await get(
    db,
    `SELECT id FROM mafya_davetleri WHERE grup_id = ? AND davet_edilen_user_id = ? AND durum = 'beklemede'`,
    [grup.id, hedefId]
  );
  if (bekleyenBizden) return { ok: false, error: "Bu oyuncuya zaten davet gönderdin." };

  const ins = await run(
    db,
    `INSERT INTO mafya_davetleri (grup_id, davet_eden_user_id, davet_edilen_user_id, durum)
     VALUES (?, ?, ?, 'beklemede')`,
    [grup.id, liderId, hedefId]
  );
  const davetId = ins.lastID;
  const icerik = `${grup.isim} Mafya Grubu seni grubuna katılmaya davet etti.`;

  await run(
    db,
    `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, davet_id, created_at)
     VALUES (?, ?, 'mafya_davet', ?, ?, 0, ?, strftime('%s','now'))`,
    [hedefId, liderId, grup.isim, icerik, davetId]
  );

  try {
    const { bildirimGonder } = require("./bildirimService");
    await bildirimGonder(db, hedefId, "mafya_davet", {
      baslik: "Mafya Daveti",
      icerik: `${grup.isim} seni grubuna davet etti.`,
      url: "/?ekran=mesajKutusu",
    });
  } catch (_) {}

  const hedef = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [hedefId]);
  return { ok: true, davetId, mesaj: `${hedef?.reis_adi || "Oyuncu"} davet edildi.` };
}

async function davetKabul(db, userId, davetId) {
  await ensureDavetTablosu(db);
  const id = parseInt(davetId, 10);
  const d = await get(
    db,
    `SELECT d.*, g.isim AS grup_isim, g.lider_user_id
     FROM mafya_davetleri d
     JOIN mafya_gruplari g ON g.id = d.grup_id
     WHERE d.id = ?`,
    [id]
  );
  if (!d || d.davet_edilen_user_id !== userId) return { ok: false, error: "Davet bulunamadı." };
  if (d.durum !== "beklemede") return { ok: false, error: "Bu davet artık geçerli değil." };

  const uyelik = await kullaniciGrubu(db, userId);
  if (uyelik) return { ok: false, error: "Zaten bir gruptasın." };

  const ev = await ensureEvi(db, d.grup_id);
  const cap = kapasite(ev.seviye);
  const cnt = await get(db, `SELECT COUNT(*) AS n FROM mafya_uyeleri WHERE grup_id = ?`, [d.grup_id]);
  if ((cnt?.n || 0) >= cap) {
    return { ok: false, error: `Mafya Evi kapasitesi dolu (max ${cap}). Seviye yükseltin.` };
  }

  await run(db, `UPDATE mafya_davetleri SET durum = 'kabul' WHERE id = ?`, [id]);
  await run(
    db,
    `UPDATE mafya_davetleri SET durum = 'red'
     WHERE davet_edilen_user_id = ? AND durum = 'beklemede' AND id <> ?`,
    [userId, id]
  );
  await run(
    db,
    `UPDATE mafya_basvurulari SET durum = 'red' WHERE user_id = ? AND durum = 'beklemede'`,
    [userId]
  );
  await run(db, `INSERT INTO mafya_uyeleri (grup_id, user_id, rutbe) VALUES (?, ?, ?)`, [
    d.grup_id,
    userId,
    "Mafya Üyesi",
  ]);
  await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [d.grup_isim, userId]);
  await syncBonusGuc(db, userId);

  const katilan = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [userId]);
  const bildirimIcerik = `${katilan?.reis_adi || "Oyuncu"} gruba katıldı!`;
  const uyeler = await all(db, `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`, [d.grup_id]);
  const aliciIds = new Set(uyeler.map((u) => Number(u.user_id)));
  if (d.lider_user_id != null) aliciIds.add(Number(d.lider_user_id));
  for (const aliciId of aliciIds) {
    if (aliciId === userId) continue;
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
       VALUES (?, ?, 'ozel', ?, ?, 0, strftime('%s','now'))`,
      [aliciId, userId, d.grup_isim, bildirimIcerik]
    );
  }

  return { ok: true, grupIsim: d.grup_isim, mesaj: `${d.grup_isim} grubuna katıldın.` };
}

async function davetRed(db, userId, davetId) {
  await ensureDavetTablosu(db);
  const id = parseInt(davetId, 10);
  const d = await get(
    db,
    `SELECT d.*, g.isim AS grup_isim, g.lider_user_id
     FROM mafya_davetleri d
     JOIN mafya_gruplari g ON g.id = d.grup_id
     WHERE d.id = ?`,
    [id]
  );
  if (!d || d.davet_edilen_user_id !== userId) return { ok: false, error: "Davet bulunamadı." };
  if (d.durum !== "beklemede") return { ok: false, error: "Bu davet artık geçerli değil." };

  await run(db, `UPDATE mafya_davetleri SET durum = 'red' WHERE id = ?`, [id]);
  const reddeden = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [userId]);
  const icerik = `Davet ettiğin ${reddeden?.reis_adi || "oyuncu"} davetini reddetti!`;
  await run(
    db,
    `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
     VALUES (?, ?, 'ozel', ?, ?, 0, strftime('%s','now'))`,
    [d.lider_user_id, userId, d.grup_isim, icerik]
  );

  return { ok: true, mesaj: "Davet reddedildi." };
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
  if (await grupAktifSavasVarMi(db, grup.id)) {
    return { ok: false, error: "Grubun aktif savaşı var; savaş bitene kadar üye çıkarılamaz." };
  }
  await run(db, `DELETE FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`, [
    grup.id,
    hedefUserId,
  ]);
  await run(db, `UPDATE users SET grup = 'Bağımsız Reis' WHERE id = ?`, [hedefUserId]);
  await syncBonusGuc(db, hedefUserId);
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
  if (await grupAktifSavasVarMi(db, grup.id)) {
    return { ok: false, error: "Grubun aktif savaşı var; savaş bitene kadar grup dağıtılamaz." };
  }
  const uyeler = await all(db, `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`, [grup.id]);
  await run(db, `DELETE FROM mafya_basvurulari WHERE grup_id = ?`, [grup.id]);
  await run(db, `DELETE FROM mafya_uyeleri WHERE grup_id = ?`, [grup.id]);
  await run(db, `DELETE FROM mafya_gruplari WHERE id = ?`, [grup.id]);
  for (const u of uyeler) {
    await run(db, `UPDATE users SET grup = 'Bağımsız Reis' WHERE id = ?`, [u.user_id]);
    await syncBonusGuc(db, u.user_id);
  }
  return { ok: true };
}

async function guruptanCik(db, userId, player) {
  const uyelik = await kullaniciGrubu(db, userId);
  if (!uyelik) return { ok: false, error: "Grupta değilsin." };
  if (uyelik.lider_user_id === userId) {
    return { ok: false, error: "Lider önce liderliği devretmeli veya grubu dağıtmalı." };
  }
  if (await grupAktifSavasVarMi(db, uyelik.id)) {
    return { ok: false, error: "Grubun aktif savaşı var; savaş bitene kadar ayrılamazsın." };
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
  await syncBonusGuc(db, userId);
  return { ok: true, player };
}

async function grupAciklamaDegistir(db, liderId, yeniAciklama) {
  const grup = await kullaniciGrubu(db, liderId);
  if (!grup || grup.lider_user_id !== liderId) {
    return { ok: false, error: "Sadece Mafya Grubu lideri açıklamayı değiştirebilir." };
  }
  const acik = sanitizeProfilAciklama(yeniAciklama);
  await run(db, `UPDATE mafya_gruplari SET aciklama = ? WHERE id = ?`, [acik, grup.id]);
  return { ok: true, aciklama: acik };
}

async function grupIsimDegistir(db, liderId, yeniIsim) {
  const grup = await kullaniciGrubu(db, liderId);
  if (!grup || grup.lider_user_id !== liderId) {
    return { ok: false, error: "Sadece Mafya Grubu lideri grup adını değiştirebilir." };
  }
  const temizIsim = String(yeniIsim || "").trim().slice(0, 32);
  if (temizIsim.length < 2) return { ok: false, error: "Grup adı en az 2 karakter." };

  const varMi = await get(
    db,
    `SELECT id FROM mafya_gruplari WHERE LOWER(isim) = LOWER(?) AND id <> ?`,
    [temizIsim, grup.id]
  );
  if (varMi) return { ok: false, error: "Bu isimde grup zaten var." };

  await run(db, `UPDATE mafya_gruplari SET isim = ? WHERE id = ?`, [temizIsim, grup.id]);
  const uyeler = await all(db, `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`, [grup.id]);
  for (const u of uyeler) {
    await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [temizIsim, u.user_id]);
  }
  return { ok: true, isim: temizIsim };
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
  const { getGrupSampiyonluklari } = require("./aylikMafyaSampiyonService");
  const sampiyonluklar = await getGrupSampiyonluklari(db, uyelik.id);
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
    sampiyonluklar,
  };
}

async function grupProfil(db, grupId, viewerUserId) {
  const grup = await get(
    db,
    `SELECT id, isim, aciklama FROM mafya_gruplari WHERE id = ?`,
    [grupId]
  );
  if (!grup) return null;

  const uyeler = await grupUyeleri(db, grupId);
  const { eviGetir } = require("./mafyaEviService");
  const { getGrupSampiyonluklari } = require("./aylikMafyaSampiyonService");
  const ev = await eviGetir(db, grupId);
  const toplamSayginlik = uyeler.reduce((s, u) => s + (u.puan || 0), 0);
  const sampiyonluklar = await getGrupSampiyonluklari(db, grupId);

  let benimGrubum = false;
  let viewerBenLiderim = false;
  let savasIlanEdilebilir = false;
  if (viewerUserId) {
    const uyem = await get(
      db,
      `SELECT 1 FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`,
      [grupId, viewerUserId]
    );
    benimGrubum = !!uyem;
    const viewerGrup = await kullaniciGrubu(db, viewerUserId);
    viewerBenLiderim = !!(viewerGrup && viewerGrup.lider_user_id === viewerUserId);
    savasIlanEdilebilir = viewerBenLiderim && !benimGrubum && viewerGrup && viewerGrup.id !== grupId;
  }

  return {
    id: grup.id,
    isim: grup.isim,
    aciklama: grup.aciklama || "",
    uyeSayisi: uyeler.length,
    toplamSayginlik,
    evSeviye: ev.seviye,
    evKapasite: ev.kapasite,
    evUyeGucBonusu: ev.uyeGucBonusu,
    sampiyonluklar,
    benimGrubum,
    viewerBenLiderim,
    savasIlanEdilebilir,
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
  davetEt,
  davetKabul,
  davetRed,
  rutbeDegistir,
  uyeCikar,
  liderlikDevret,
  gurupDagit,
  guruptanCik,
  bekleyenBasvuruSayisi,
  grupProfil,
  grupIsimDegistir,
  grupAciklamaDegistir,
};
