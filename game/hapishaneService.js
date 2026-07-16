const { run, get, all } = require("../db/database");
const { oyuncuSaatlikKazanc } = require("./saatlikGelirService");
const { HAPSE_GIR_ESIK, getDevletIliskisi } = require("./devletService");

const HAPIS_SURE_SN = 12 * 3600;
const NAKIT_KAYIP_ORANI = 0.2;
const RUSVET_SAAT = 3;
const ELMAS_CIKIS = 5;
const MIN_RUSVET = 500;

const HAPIS_IZINLI_AKSIYONLAR = new Set([
  "hapishane_rusvet_gardiyan",
  "hapishane_elmas_cik",
  "hapishane_oyuncu_cikar",
  "hapishane_oyuncu_elmas_cikar",
  "hapishane_hedef_bilgi",
  // Hapisteyken ilişki düzeltilebilsin (çıkınca eşik yüzünden tekrar hapse düşmesin)
  "rusvet_ver",
  "rusvet_elmas_ver",
]);

async function ensureHapisColumn(db) {
  try {
    await run(db, `ALTER TABLE players ADD COLUMN hapis_bitis_at INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
}

function simdiSn() {
  return Math.floor(Date.now() / 1000);
}

async function hapisBitisOku(db, userId) {
  await ensureHapisColumn(db);
  const row = await get(db, `SELECT hapis_bitis_at FROM players WHERE user_id = ?`, [userId]);
  return Math.max(0, Math.floor(row?.hapis_bitis_at || 0));
}

async function hapisAktifMi(db, userId) {
  const bitis = await hapisBitisOku(db, userId);
  return bitis > simdiSn();
}

async function hapisSureTemizle(db, userId) {
  const bitis = await hapisBitisOku(db, userId);
  const simdi = simdiSn();
  if (bitis > 0 && bitis <= simdi) {
    await run(db, `UPDATE players SET hapis_bitis_at = 0 WHERE user_id = ?`, [userId]);
    return true;
  }
  return false;
}

async function rusvetBedeliHesapla(db, userId) {
  const saatlik = await oyuncuSaatlikKazanc(db, userId);
  if (saatlik > 0) return Math.max(MIN_RUSVET, Math.floor(saatlik * RUSVET_SAAT));
  const row = await get(db, `SELECT puan FROM players WHERE user_id = ?`, [userId]);
  const puan = row?.puan || 0;
  return Math.max(MIN_RUSVET, Math.floor(Math.max(10, puan * 0.02) * RUSVET_SAAT));
}

async function mahkumSayisi(db) {
  await ensureHapisColumn(db);
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM players WHERE hapis_bitis_at > ?`,
    [simdiSn()]
  );
  return row?.n || 0;
}

async function hapseGir(db, userId) {
  await ensureHapisColumn(db);
  if (await hapisAktifMi(db, userId)) return { ok: true, zaten: true };

  const row = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [userId]);
  if (!row) return { ok: false, error: "Oyuncu bulunamadı." };

  const kayip = Math.floor((row.kasa || 0) * NAKIT_KAYIP_ORANI);
  const yeniKasa = Math.max(0, (row.kasa || 0) - kayip);
  const bitis = simdiSn() + HAPIS_SURE_SN;

  await run(db, `UPDATE players SET kasa = ?, hapis_bitis_at = ? WHERE user_id = ?`, [
    yeniKasa,
    bitis,
    userId,
  ]);

  try {
    const { basariRozetArtir } = require("./basariRozetService");
    await basariRozetArtir(db, userId, "jailed", 1);
  } catch (_) {}

  return { ok: true, kayip, bitisAt: bitis, sureSn: HAPIS_SURE_SN };
}

async function hapistenCikar(db, userId) {
  await run(db, `UPDATE players SET hapis_bitis_at = 0 WHERE user_id = ?`, [userId]);
}

async function devletDususundeHapseGir(db, userId, onceki, yeni) {
  if (yeni < HAPSE_GIR_ESIK && onceki >= HAPSE_GIR_ESIK) {
    return hapseGir(db, userId);
  }
  return null;
}

async function hapisKontrol(db, userId) {
  await hapisSureTemizle(db, userId);
  const devlet = await getDevletIliskisi(db, userId);
  // Hapse giriş yalnızca eşik altına DÜŞÜŞTE (devletDususundeHapseGir) veya olaylarla olur.
  // İlişki hâlâ düşükken yeniden hapse atma — parayla/elmasla/süreyle çıkan oyuncu
  // avukata rüşvet veremeden tekrar hapse girerdi (kısır döngü).
  if (await hapisAktifMi(db, userId)) {
    const bitis = await hapisBitisOku(db, userId);
    const kalan = Math.max(0, bitis - simdiSn());
    return {
      ok: false,
      error:
        "Hapistesin! İcraat yapamaz ve faaliyette bulunamazsın. Gardiyanlara rüşvet ver, elmas kullan, avukat ilişkini düzelt veya sürenin dolmasını bekle.",
      hapis: true,
      hapisBitisAt: bitis,
      hapisKalanSn: kalan,
    };
  }
  return { ok: true, devletIliskisi: devlet };
}

async function hapisAksiyonEngeli(db, userId, action) {
  if (HAPIS_IZINLI_AKSIYONLAR.has(action)) return { ok: true };
  return hapisKontrol(db, userId);
}

async function kullaniciAdindanBul(db, ad) {
  const temiz = String(ad || "").trim();
  if (!temiz) return null;
  return get(
    db,
    `SELECT u.id AS user_id, u.reis_adi, u.username
     FROM users u
     WHERE LOWER(u.reis_adi) = LOWER(?) OR LOWER(u.username) = LOWER(?)
     LIMIT 1`,
    [temiz, temiz]
  );
}

async function hapishanePanel(db, userId) {
  await hapisSureTemizle(db, userId);
  const bitis = await hapisBitisOku(db, userId);
  const simdi = simdiSn();
  const aktif = bitis > simdi;
  const rusvetBedeli = await rusvetBedeliHesapla(db, userId);
  const elmasRow = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
  return {
    mahkumSayisi: await mahkumSayisi(db),
    hapisAktif: aktif,
    hapisBitisAt: aktif ? bitis : 0,
    hapisKalanSn: aktif ? bitis - simdi : 0,
    rusvetBedeli,
    elmasBedel: ELMAS_CIKIS,
    elmas: elmasRow?.elmas || 0,
    hapisSureSaat: HAPIS_SURE_SN / 3600,
    rusvetSaat: RUSVET_SAAT,
    nakitKayipYuzde: Math.round(NAKIT_KAYIP_ORANI * 100),
  };
}

async function hapishaneHedefBilgi(db, userId, hedefAd) {
  const hapis = await hapisKontrol(db, userId);
  if (!hapis.ok) return hapis;

  const hedef = await kullaniciAdindanBul(db, hedefAd);
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı." };
  if (hedef.user_id === userId) {
    return { ok: false, error: "Kendini hapisten çıkarmak için gardiyan rüşveti veya elmas kullan." };
  }
  if (!(await hapisAktifMi(db, hedef.user_id))) {
    return { ok: false, error: "Bu oyuncu hapiste değil." };
  }

  const rusvetBedeli = await rusvetBedeliHesapla(db, hedef.user_id);
  return {
    ok: true,
    hedef: {
      userId: hedef.user_id,
      oyuncuAdi: hedef.reis_adi || hedef.username,
      rusvetBedeli,
      elmasBedel: ELMAS_CIKIS,
    },
  };
}

async function gardiyanRusveti(db, userId, player) {
  if (!(await hapisAktifMi(db, userId))) {
    return { ok: false, error: "Hapiste değilsin." };
  }
  const bedel = await rusvetBedeliHesapla(db, userId);
  if ((player.kasa || 0) < bedel) {
    return {
      ok: false,
      error: `Kasan yetersiz! Gardiyan rüşveti: ${bedel.toLocaleString("tr-TR")} TL`,
    };
  }
  await run(db, `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`, [
    bedel,
    userId,
    bedel,
  ]);
  await hapistenCikar(db, userId);
  player.kasa -= bedel;
  try {
    const { basariRozetArtir } = require("./basariRozetService");
    await basariRozetArtir(db, userId, "prison_bribe", 1);
  } catch (_) {}
  return { ok: true, odenen: bedel, mesaj: "Gardiyanlara rüşvet verdin. Sokaklara döndün!" };
}

async function elmaslaCik(db, userId, player) {
  if (!(await hapisAktifMi(db, userId))) {
    return { ok: false, error: "Hapiste değilsin." };
  }
  const elmas = player.elmas || 0;
  if (elmas < ELMAS_CIKIS) {
    return {
      ok: false,
      error: `Yeterli elmasın yok! ${ELMAS_CIKIS} elmas gerekir.`,
    };
  }
  await run(db, `UPDATE players SET elmas = elmas - ? WHERE user_id = ? AND elmas >= ?`, [
    ELMAS_CIKIS,
    userId,
    ELMAS_CIKIS,
  ]);
  await hapistenCikar(db, userId);
  player.elmas = elmas - ELMAS_CIKIS;
  return { ok: true, harcananElmas: ELMAS_CIKIS, mesaj: "Elmas karşılığında hapisten çıktın!" };
}

async function oyuncuHapistenCikar(db, userId, player, hedefAd) {
  const hapis = await hapisKontrol(db, userId);
  if (!hapis.ok) return hapis;

  const hedef = await kullaniciAdindanBul(db, hedefAd);
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı." };
  if (hedef.user_id === userId) {
    return { ok: false, error: "Kendini bu bölümden çıkaramazsın." };
  }
  if (!(await hapisAktifMi(db, hedef.user_id))) {
    return { ok: false, error: "Bu oyuncu hapiste değil." };
  }

  const bedel = await rusvetBedeliHesapla(db, hedef.user_id);
  if ((player.kasa || 0) < bedel) {
    return {
      ok: false,
      error: `Kasan yetersiz! Rüşvet: ${bedel.toLocaleString("tr-TR")} TL`,
    };
  }

  await run(db, `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`, [
    bedel,
    userId,
    bedel,
  ]);
  await hapistenCikar(db, hedef.user_id);
  player.kasa -= bedel;

  try {
    const { basariRozetArtir } = require("./basariRozetService");
    await basariRozetArtir(db, userId, "prison_rescue", 1);
  } catch (_) {}

  return {
    ok: true,
    odenen: bedel,
    hedefAdi: hedef.reis_adi || hedef.username,
    mesaj: `${hedef.reis_adi || hedef.username} hapishaneden çıkarıldı.`,
  };
}

async function oyuncuHapistenElmaslaCikar(db, userId, player, hedefAd) {
  const hapis = await hapisKontrol(db, userId);
  if (!hapis.ok) return hapis;

  const hedef = await kullaniciAdindanBul(db, hedefAd);
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı." };
  if (hedef.user_id === userId) {
    return { ok: false, error: "Kendini bu bölümden çıkaramazsın." };
  }
  if (!(await hapisAktifMi(db, hedef.user_id))) {
    return { ok: false, error: "Bu oyuncu hapiste değil." };
  }

  const elmas = player.elmas || 0;
  if (elmas < ELMAS_CIKIS) {
    return {
      ok: false,
      error: `Yeterli elmasın yok! ${ELMAS_CIKIS} elmas gerekir.`,
    };
  }

  await run(db, `UPDATE players SET elmas = elmas - ? WHERE user_id = ? AND elmas >= ?`, [
    ELMAS_CIKIS,
    userId,
    ELMAS_CIKIS,
  ]);
  await hapistenCikar(db, hedef.user_id);
  player.elmas = elmas - ELMAS_CIKIS;

  try {
    const { basariRozetArtir } = require("./basariRozetService");
    await basariRozetArtir(db, userId, "prison_rescue", 1);
  } catch (_) {}

  return {
    ok: true,
    harcananElmas: ELMAS_CIKIS,
    hedefAdi: hedef.reis_adi || hedef.username,
    mesaj: `${hedef.reis_adi || hedef.username} elmas karşılığında hapishaneden çıkarıldı.`,
  };
}

module.exports = {
  HAPIS_SURE_SN,
  ELMAS_CIKIS,
  RUSVET_SAAT,
  HAPIS_IZINLI_AKSIYONLAR,
  hapisKontrol,
  hapisAksiyonEngeli,
  hapseGir,
  hapistenCikar,
  hapisAktifMi,
  devletDususundeHapseGir,
  mahkumSayisi,
  rusvetBedeliHesapla,
  hapishanePanel,
  hapishaneHedefBilgi,
  gardiyanRusveti,
  elmaslaCik,
  oyuncuHapistenCikar,
  oyuncuHapistenElmaslaCikar,
};
