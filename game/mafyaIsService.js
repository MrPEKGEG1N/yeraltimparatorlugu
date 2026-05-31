const { run, get, all } = require("../db/database");

const ONLINE_WINDOW_SEC = 5 * 60; // 5 dk içinde aktifse online say

const ISLER = [
  {
    key: "oto_galeri",
    ad: "Şehrin Lüks Oto Galerisini Soy",
    minOnline: 3,
    minGuc: 50_000,
    kazancKisi: 300_000,
    sayginlikKisi: 20,
    devletDus: 4,
    gorselKey: "mafya_oto",
  },
  {
    key: "kuyumcu",
    ad: "Şehrin Lüks Kuyumcusunu Soy",
    minOnline: 5,
    minGuc: 100_000,
    kazancKisi: 750_000,
    sayginlikKisi: 45,
    devletDus: 7,
    gorselKey: "mafya_kuyumcu",
  },
  {
    key: "banka",
    ad: "Şehrin En İşlek Bankasını Soy",
    minOnline: 7,
    minGuc: 500_000,
    kazancKisi: 4_000_000,
    sayginlikKisi: 120,
    devletDus: 12,
    gorselKey: "mafya_banka",
  },
  {
    key: "darphane",
    ad: "Ülke Darphanesini Soy",
    minOnline: 15,
    minGuc: 2_500_000,
    kazancKisi: 25_000_000,
    sayginlikKisi: 300,
    devletDus: 18,
    gorselKey: "mafya_darphane",
  },
];

function isBul(key) {
  return ISLER.find((x) => x.key === key) || null;
}

async function grupUyeSayisi(db, grupId) {
  const row = await get(db, `SELECT COUNT(*) AS n FROM mafya_uyeleri WHERE grup_id = ?`, [grupId]);
  return row ? row.n : 0;
}

async function onlineUyeSayisi(db, grupId) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = await get(
      db,
      `SELECT COUNT(*) AS n
       FROM mafya_uyeleri m
       JOIN players p ON p.user_id = m.user_id
       WHERE m.grup_id = ? AND p.last_seen_at >= ?`,
      [grupId, now - ONLINE_WINDOW_SEC]
    );
    return row ? row.n : 0;
  } catch (_) {
    // Eski DB şemasında last_seen_at yoksa fallback: tüm üyeleri online say
    const row = await get(db, `SELECT COUNT(*) AS n FROM mafya_uyeleri WHERE grup_id = ?`, [grupId]);
    return row ? row.n : 0;
  }
}

async function aktifIsGetir(db, grupId) {
  return get(
    db,
    `SELECT * FROM mafya_isleri
     WHERE grup_id = ? AND durum = 'hazirlaniyor'
     ORDER BY baslangic_zamani DESC
     LIMIT 1`,
    [grupId]
  );
}

async function isKatilimcilar(db, isId) {
  let rows = [];
  try {
    rows = await all(
      db,
      `SELECT k.user_id, u.reis_adi, p.guc, p.last_seen_at
       FROM mafya_is_katilim k
       JOIN users u ON u.id = k.user_id
       JOIN players p ON p.user_id = k.user_id
       WHERE k.is_id = ?
       ORDER BY p.guc DESC`,
      [isId]
    );
  } catch (_) {
    rows = await all(
      db,
      `SELECT k.user_id, u.reis_adi, p.guc, 9999999999 as last_seen_at
       FROM mafya_is_katilim k
       JOIN users u ON u.id = k.user_id
       JOIN players p ON p.user_id = k.user_id
       WHERE k.is_id = ?
       ORDER BY p.guc DESC`,
      [isId]
    );
  }
  const now = Math.floor(Date.now() / 1000);
  return rows.map((r) => ({
    userId: r.user_id,
    reisAdi: r.reis_adi,
    guc: r.guc,
    online: r.last_seen_at >= now - ONLINE_WINDOW_SEC,
  }));
}

async function isPanel(db, grupId) {
  if (!grupId) {
    return { isler: ISLER, grup: null, aktifIs: null, katilanlar: [] };
  }
  const aktif = await aktifIsGetir(db, grupId);
  const katilanlar = aktif ? await isKatilimcilar(db, aktif.id) : [];
  const onlineN = await onlineUyeSayisi(db, grupId);
  const uyeN = await grupUyeSayisi(db, grupId);
  return {
    isler: ISLER,
    grup: { uyeSayisi: uyeN, onlineSayisi: onlineN },
    aktifIs: aktif
      ? { id: aktif.id, isTuru: aktif.is_turu, baslangic: aktif.baslangic_zamani, durum: aktif.durum }
      : null,
    katilanlar,
  };
}

async function isKatil(db, userId, grupId, isTuru) {
  const isDef = isBul(isTuru);
  if (!isDef) return { ok: false, error: "Geçersiz mafya işi." };

  const uyeN = await grupUyeSayisi(db, grupId);
  if (uyeN < 3) return { ok: false, error: "Mafya işi için grubunda en az 3 üye olmalı." };

  let aktif = await aktifIsGetir(db, grupId);
  if (aktif && aktif.is_turu !== isTuru) {
    return { ok: false, error: "Grubun şu an başka bir soygun için hazırlanıyor." };
  }
  if (!aktif) {
    const ins = await run(
      db,
      `INSERT INTO mafya_isleri (is_turu, grup_id, baslangic_zamani, durum) VALUES (?, ?, ?, 'hazirlaniyor')`,
      [isTuru, grupId, Date.now()]
    );
    aktif = { id: ins.lastID, is_turu: isTuru, durum: "hazirlaniyor" };
  }

  // Kişisel gereksinimler: online + min güç
  const now = Math.floor(Date.now() / 1000);
  let p;
  try {
    p = await get(db, `SELECT guc, last_seen_at FROM players WHERE user_id = ?`, [userId]);
  } catch (_) {
    p = await get(db, `SELECT guc, 9999999999 as last_seen_at FROM players WHERE user_id = ?`, [userId]);
  }
  if (!p) return { ok: false, error: "Oyuncu bulunamadı." };
  if (p.last_seen_at < now - ONLINE_WINDOW_SEC) return { ok: false, error: "Online değilsin. Sayfayı açık tut ve tekrar dene." };
  if (p.guc < isDef.minGuc) return { ok: false, error: "Yeterli gereksinimlere sahip değilsin! (Güç yetersiz)" };

  // Katılım kaydı
  try {
    await run(db, `INSERT INTO mafya_is_katilim (is_id, user_id) VALUES (?, ?)`, [aktif.id, userId]);
  } catch (_) {
    // zaten katıldı
  }
  return { ok: true, isId: aktif.id };
}

async function isGerceklestir(db, grupId, isId) {
  const aktif = await get(db, `SELECT * FROM mafya_isleri WHERE id = ? AND grup_id = ?`, [isId, grupId]);
  if (!aktif || aktif.durum !== "hazirlaniyor") return { ok: false, error: "Soygun bulunamadı veya kapalı." };

  const isDef = isBul(aktif.is_turu);
  if (!isDef) return { ok: false, error: "Soygun tanımı bulunamadı." };

  const katilanlar = await isKatilimcilar(db, isId);
  const uygun = katilanlar.filter((k) => k.online && k.guc >= isDef.minGuc);
  if (uygun.length < isDef.minOnline) {
    return { ok: false, error: "Şartlar sağlanmadı. Online + güç gereksinimleri eksik." };
  }

  // Ödül/ceza: katılan uygun oyunculara uygula
  for (const k of uygun) {
    const row = await get(db, `SELECT kasa, guc, puan, devlet_iliskisi FROM players WHERE user_id = ?`, [
      k.userId,
    ]);
    if (!row) continue;
    const yeniGuc = Math.floor(row.guc * 0.9);
    const yeniPuan = row.puan + isDef.sayginlikKisi;
    const yeniDevlet = Math.max(0, (row.devlet_iliskisi ?? 100) - isDef.devletDus);
    const yeniKasa = row.kasa + isDef.kazancKisi;
    await run(
      db,
      `UPDATE players SET kasa = ?, guc = ?, puan = ?, devlet_iliskisi = ? WHERE user_id = ?`,
      [yeniKasa, yeniGuc, yeniPuan, yeniDevlet, k.userId]
    );
  }

  await run(db, `UPDATE mafya_isleri SET durum = 'tamamlandi' WHERE id = ?`, [isId]);
  return {
    ok: true,
    mesaj:
      "Soygun başarıyla gerçekleştirildi! Katılan her üyeye " +
      isDef.kazancKisi.toLocaleString("tr-TR") +
      " TL dağıtıldı.",
    kazancKisi: isDef.kazancKisi,
    sayginlikKisi: isDef.sayginlikKisi,
    katilim: uygun.length,
  };
}

module.exports = {
  ISLER,
  isPanel,
  isKatil,
  isGerceklestir,
};

