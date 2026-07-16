const { run, get } = require("../db/database");
const { ICRAAT_SAATLIK_BONUS, ICRAAT_MAX } = require("./catalog");

const SMS_GUNLUK_VARSAYILAN = 50;
const BANKA_HAK_GUNLUK_VARSAYILAN = 20;
/** Paketsiz günlük banka faizi — bankaService.FAIZ_ORAN ile aynı */
const FAIZ_ORAN_VARSAYILAN = 0.005;

const PAKET_SIRA = { tetikci: 1, racon: 2, baron: 3 };
const PAKET_SURE_SN = 30 * 24 * 3600;

const ICRAAT_PAKET = {
  id: "icraat_paket",
  baslik: "İcraat Paketi",
  aciklama: "25 İcraat / 25 Elmas",
  icraatMiktar: 25,
  elmasMaliyet: 25,
  beklemeSn: 8 * 3600,
};

/** Gerçek parayla alınan elmas paketleri (TL) */
const ELMAS_TL_PAKETLER = {
  ufaklik: {
    id: "ufaklik",
    ikon: "💰",
    baslik: "Ufaklık Paketi",
    elmas: 100,
    bonusElmas: 0,
    tlFiyat: 75,
  },
  raconcu: {
    id: "raconcu",
    ikon: "💼",
    baslik: "Raconcu Paketi",
    elmas: 250,
    bonusElmas: 25,
    tlFiyat: 175,
  },
  baron_elmas: {
    id: "baron_elmas",
    ikon: "🦅",
    baslik: "Baron Paketi",
    elmas: 500,
    bonusElmas: 75,
    tlFiyat: 300,
  },
  imparator: {
    id: "imparator",
    ikon: "👑",
    baslik: "İmparator Paketi",
    elmas: 1000,
    bonusElmas: 250,
    tlFiyat: 550,
  },
};

const PREMIUM_PAKETLER = {
  tetikci: {
    id: "tetikci",
    baslik: "Tetikçi Paketi",
    altBaslik: "Gözü Kara Başlangıç",
    elmasMaliyet: 100,
    tlOrtalama: 75,
    icraatSaatlik: 35,
    smsGunluk: 75,
    smsSinirsiz: false,
    bankaHakGunluk: 30,
    bankaHakSinirsiz: false,
    faizOran: null,
    mekanGelirBonus: 0,
    prestijRozet: "🥉",
    prestijEtiket: "Bronz Kurşun",
  },
  racon: {
    id: "racon",
    baslik: "Racon Paketi",
    altBaslik: "Sözü Geçenler İçin",
    elmasMaliyet: 250,
    tlOrtalama: 175,
    icraatSaatlik: 45,
    smsGunluk: 100,
    smsSinirsiz: false,
    bankaHakGunluk: 50,
    bankaHakSinirsiz: false,
    faizOran: 0.01,
    mekanGelirBonus: 0.05,
    prestijRozet: "🥈",
    prestijEtiket: "Gümüş Şarjör",
  },
  baron: {
    id: "baron",
    baslik: "Baron / Hükümdar Paketi",
    altBaslik: "Yeraltının Tek Sahibi",
    elmasMaliyet: 600,
    tlOrtalama: 320,
    icraatSaatlik: 60,
    smsGunluk: null,
    smsSinirsiz: true,
    bankaHakGunluk: null,
    bankaHakSinirsiz: true,
    faizOran: 0.015,
    mekanGelirBonus: 0.1,
    hapisUyariEsik: 30,
    prestijRozet: "👑",
    prestijEtiket: "Altın Taç",
  },
};

function elmasPaketTanim(paketId) {
  const id = String(paketId || "").trim();
  return ELMAS_TL_PAKETLER[id] || null;
}

/** Uluslararası elmas paket fiyatları (USD/EUR) */
const ELMAS_INTL_FIYATLAR = {
  ufaklik: 4.99,
  raconcu: 7.99,
  baron_elmas: 9.99,
  imparator: 14.99,
};

const EUROZONE_ULKELER = new Set([
  "AT",
  "BE",
  "CY",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "SK",
  "SI",
  "ES",
  "HR",
  "AD",
  "MC",
  "SM",
  "VA",
  "ME",
  "XK",
]);

const PARA_SEMBOL = { TRY: "₺", USD: "$", EUR: "€" };

/** Avrupa oyun dilleri → € fiyatlandırma */
const EUR_OYUN_DILLERI = new Set(["de", "fr", "es", "it", "pt", "nl", "ro", "cs", "pl", "el"]);

function buildElmasLocale(userRow, clientMeta = {}) {
  const oyunDili = clientMeta.lang || userRow?.oyun_dili || "tr";
  const kayitUlkesi = String(userRow?.kayit_ulkesi || clientMeta.country || "").trim();
  return {
    kayitUlkesi,
    oyunDili,
    ulkeIp: String(clientMeta.country || "").trim(),
  };
}

/** Türkçe + Türkiye → TL; Avrupa dili veya avro ülkesi → €; diğer diller → $ */
function resolveElmasParaBirimi(kayitUlkesi, oyunDili, opts = {}) {
  const ulke = String(kayitUlkesi || opts.ulkeIp || "")
    .trim()
    .toUpperCase();
  const dilHam = String(oyunDili || "tr")
    .trim()
    .toLowerCase();
  const dilBase = dilHam.split("-")[0] || "tr";
  if (dilBase === "tr" && ulke === "TR") return "TRY";
  if (dilHam === "pt-br") return "USD";
  if (EUR_OYUN_DILLERI.has(dilBase)) return "EUR";
  if (EUROZONE_ULKELER.has(ulke)) return "EUR";
  return "USD";
}

function elmasPaketFiyat(paketId, paraBirimi) {
  const paket = elmasPaketTanim(paketId);
  if (!paket) return { fiyat: 0, paraBirimi: "TRY", sembol: "₺" };
  const birim = paraBirimi || "TRY";
  const fiyat = birim === "TRY" ? paket.tlFiyat : ELMAS_INTL_FIYATLAR[paketId] ?? 0;
  return {
    fiyat,
    paraBirimi: birim,
    sembol: PARA_SEMBOL[birim] || "$",
  };
}

function elmasPaketListesi(locale = {}) {
  const paraBirimi = resolveElmasParaBirimi(locale.kayitUlkesi, locale.oyunDili, {
    ulkeIp: locale.ulkeIp,
  });
  return Object.values(ELMAS_TL_PAKETLER).map((p) => {
    const toplam = p.elmas + (p.bonusElmas || 0);
    const fiyat =
      paraBirimi === "TRY" ? p.tlFiyat : ELMAS_INTL_FIYATLAR[p.id] ?? 0;
    const birimMaliyet =
      toplam > 0 ? Math.round((fiyat / toplam) * 100) / 100 : 0;
    return {
      id: p.id,
      ikon: p.ikon,
      baslik: p.baslik,
      elmas: p.elmas,
      bonusElmas: p.bonusElmas || 0,
      toplamElmas: toplam,
      fiyat,
      paraBirimi,
      sembol: PARA_SEMBOL[paraBirimi] || "$",
      tlFiyat: paraBirimi === "TRY" ? p.tlFiyat : undefined,
      birimMaliyet,
    };
  });
}

function paketTanim(paketId) {
  const id = String(paketId || "").trim();
  return PREMIUM_PAKETLER[id] || null;
}

function turkeyDayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Paket satın alındığında SMS ve banka hakkını hemen uygular. */
async function applyPremiumPaketAvantajlari(db, userId, paket) {
  const { syncIcraatRegen } = require("./icraatService");
  const bonuses = await getPremiumBonuses(db, userId);

  await syncIcraatRegen(db, userId);

  const day = turkeyDayKey();
  const playerRow = await get(
    db,
    `SELECT sms_hakki, last_sms_day FROM players WHERE user_id = ?`,
    [userId]
  );
  if (bonuses.smsSinirsiz) {
    await run(db, `UPDATE players SET last_sms_day = ? WHERE user_id = ?`, [day, userId]);
  } else if (paket.smsGunluk) {
    const mevcut = playerRow?.sms_hakki ?? 0;
    const yeni = Math.max(mevcut, paket.smsGunluk);
    await run(db, `UPDATE players SET sms_hakki = ?, last_sms_day = ? WHERE user_id = ?`, [
      yeni,
      day,
      userId,
    ]);
  }

  if (!bonuses.bankaHakSinirsiz && paket.bankaHakGunluk) {
    let bankaRow = await get(
      db,
      `SELECT banka_hakki FROM banka_hesaplari WHERE user_id = ?`,
      [userId]
    );
    if (!bankaRow) {
      const now = Math.floor(Date.now() / 1000);
      await run(
        db,
        `INSERT INTO banka_hesaplari (user_id, yatirilan_miktar, banka_hakki, last_banka_hak_at)
         VALUES (?, 0, ?, ?)`,
        [userId, BANKA_HAK_GUNLUK_VARSAYILAN, now]
      );
      bankaRow = { banka_hakki: BANKA_HAK_GUNLUK_VARSAYILAN };
    }
    const mevcutHak = Number(bankaRow.banka_hakki ?? BANKA_HAK_GUNLUK_VARSAYILAN);
    const yeniHak = Math.max(mevcutHak, paket.bankaHakGunluk);
    if (yeniHak !== mevcutHak) {
      await run(db, `UPDATE banka_hesaplari SET banka_hakki = ? WHERE user_id = ?`, [yeniHak, userId]);
    }
  }
}

function paketListesi() {
  return Object.values(PREMIUM_PAKETLER).map((p) => ({
    id: p.id,
    baslik: p.baslik,
    altBaslik: p.altBaslik,
    elmasMaliyet: p.elmasMaliyet,
    tlOrtalama: p.tlOrtalama,
    aylik: true,
    icraatSaatlik: p.icraatSaatlik,
    smsGunluk: p.smsSinirsiz ? null : p.smsGunluk,
    smsSinirsiz: !!p.smsSinirsiz,
    bankaHakGunluk: p.bankaHakSinirsiz ? null : p.bankaHakGunluk,
    bankaHakSinirsiz: !!p.bankaHakSinirsiz,
    faizYuzde: p.faizOran != null ? Math.round(p.faizOran * 1000) / 10 : null,
    mekanGelirBonusYuzde: Math.round(p.mekanGelirBonus * 100),
    hapisUyariEsik: p.hapisUyariEsik || null,
    prestijRozet: p.prestijRozet,
    prestijEtiket: p.prestijEtiket,
  }));
}

async function ensurePremiumColumns(db) {
  for (const [col, def] of [
    ["last_icraat_paket_at", "INTEGER NOT NULL DEFAULT 0"],
    ["premium_paket_bitis", "INTEGER NOT NULL DEFAULT 0"],
  ]) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
}

function formatPremiumBitis(bitisUnix) {
  if (!bitisUnix) return "";
  return new Date(bitisUnix * 1000).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function premiumKalanMetni(kalanSn) {
  if (kalanSn <= 0) return "";
  const gun = Math.floor(kalanSn / 86400);
  const saat = Math.floor((kalanSn % 86400) / 3600);
  const dk = Math.floor((kalanSn % 3600) / 60);
  const sn = kalanSn % 60;
  if (gun > 0) return `${gun} g ${saat} sa ${dk} dk`;
  if (saat > 0) return `${saat} sa ${dk} dk ${sn} sn`;
  if (dk > 0) return `${dk} dk ${sn} sn`;
  return `${sn} sn`;
}

async function expirePremiumIfNeeded(db, userId) {
  await ensurePremiumColumns(db);
  const row = await get(db, `SELECT premium_paket, premium_paket_bitis FROM players WHERE user_id = ?`, [
    userId,
  ]);
  if (!row?.premium_paket) return;
  const bitis = Number(row.premium_paket_bitis || 0);
  const simdi = Math.floor(Date.now() / 1000);
  if (bitis > 0 && bitis <= simdi) {
    await run(db, `UPDATE players SET premium_paket = '', premium_paket_bitis = 0 WHERE user_id = ?`, [
      userId,
    ]);
    try {
      const { vipPortreUyelikBitinceTemizle } = require("./vipPortreService");
      await vipPortreUyelikBitinceTemizle(db, userId);
    } catch (err) {
      console.error("[premium] vip portre temizlik:", err?.message || err);
    }
  }
}

async function getPremiumStatus(db, userId) {
  await expirePremiumIfNeeded(db, userId);
  const row = await get(db, `SELECT premium_paket, premium_paket_bitis FROM players WHERE user_id = ?`, [
    userId,
  ]);
  let paketId = String(row?.premium_paket || "").trim();
  if (!paketTanim(paketId)) paketId = "";
  let bitis = paketId ? Number(row?.premium_paket_bitis || 0) : 0;
  const simdi = Math.floor(Date.now() / 1000);
  if (paketId && bitis <= 0) {
    bitis = simdi + PAKET_SURE_SN;
    await run(db, `UPDATE players SET premium_paket_bitis = ? WHERE user_id = ?`, [bitis, userId]);
  }
  const kalanSn = bitis > simdi ? bitis - simdi : 0;
  if (paketId && kalanSn <= 0) {
    await run(db, `UPDATE players SET premium_paket = '', premium_paket_bitis = 0 WHERE user_id = ?`, [
      userId,
    ]);
    paketId = "";
    bitis = 0;
  }
  return {
    paket: paketId,
    bitis,
    kalanSn: paketId ? Math.max(0, bitis - simdi) : 0,
    bitisMetin: bitis ? formatPremiumBitis(bitis) : "",
    kalanMetin: premiumKalanMetni(Math.max(0, bitis - simdi)),
    aktif: !!paketId && bitis > simdi,
  };
}

async function getPlayerPremiumPaket(db, userId) {
  const st = await getPremiumStatus(db, userId);
  return st.paket;
}

async function getPremiumBonuses(db, userId) {
  const paketId = await getPlayerPremiumPaket(db, userId);
  const p = paketTanim(paketId);
  return {
    paket: paketId,
    icraatSaatlik: p?.icraatSaatlik ?? ICRAAT_SAATLIK_BONUS,
    smsGunluk: p?.smsSinirsiz ? SMS_GUNLUK_VARSAYILAN : p?.smsGunluk ?? SMS_GUNLUK_VARSAYILAN,
    smsSinirsiz: !!p?.smsSinirsiz,
    bankaHakGunluk: p?.bankaHakSinirsiz ? BANKA_HAK_GUNLUK_VARSAYILAN : p?.bankaHakGunluk ?? BANKA_HAK_GUNLUK_VARSAYILAN,
    bankaHakSinirsiz: !!p?.bankaHakSinirsiz,
    faizOran: p?.faizOran != null ? p.faizOran : FAIZ_ORAN_VARSAYILAN,
    mekanGelirBonus: p?.mekanGelirBonus ?? 0,
    prestijRozet: p?.prestijRozet || "",
    prestijEtiket: p?.prestijEtiket || "",
  };
}

async function ensureIcraatPaketColumn(db) {
  await ensurePremiumColumns(db);
}

function icraatPaketKalanMetni(kalanSn) {
  if (kalanSn <= 0) return "";
  const saat = Math.floor(kalanSn / 3600);
  const dk = Math.ceil((kalanSn % 3600) / 60);
  if (saat > 0) return `${saat} sa ${dk} dk`;
  return `${dk} dk`;
}

async function icraatPaketPanel(db, userId) {
  await ensureIcraatPaketColumn(db);
  const row = await get(db, `SELECT elmas, last_icraat_paket_at FROM players WHERE user_id = ?`, [userId]);
  const simdi = Math.floor(Date.now() / 1000);
  const last = Number(row?.last_icraat_paket_at || 0);
  const kalanSn = Math.max(0, last + ICRAAT_PAKET.beklemeSn - simdi);
  const elmas = row?.elmas || 0;
  return {
    id: ICRAAT_PAKET.id,
    baslik: ICRAAT_PAKET.baslik,
    aciklama: ICRAAT_PAKET.aciklama,
    icraatMiktar: ICRAAT_PAKET.icraatMiktar,
    elmasMaliyet: ICRAAT_PAKET.elmasMaliyet,
    beklemeSaat: ICRAAT_PAKET.beklemeSn / 3600,
    satinAlinabilir: kalanSn <= 0,
    kalanSn,
    kalanMetin: icraatPaketKalanMetni(kalanSn),
    yeterliElmas: elmas >= ICRAAT_PAKET.elmasMaliyet,
  };
}

async function icraatPaketSatinAl(db, userId) {
  try {
    await ensurePremiumColumns(db);
    const panel = await icraatPaketPanel(db, userId);
    if (!panel.satinAlinabilir) {
      return {
        ok: false,
        error: panel.kalanMetin
          ? `İcraat Paketi için ${panel.kalanMetin} beklemen gerekir.`
          : "İcraat Paketi şu an alınamaz.",
      };
    }
    if (!panel.yeterliElmas) {
      return {
        ok: false,
        error: `Yeterli elmasın yok! ${panel.elmasMaliyet.toLocaleString("tr-TR")} elmas gerekir.`,
      };
    }

    const { syncIcraatRegen } = require("./icraatService");
    const synced = await syncIcraatRegen(db, userId);
    const simdi = Math.floor(Date.now() / 1000);
    const yeniIcraat = Math.min(ICRAAT_MAX, (synced.icraat || 0) + ICRAAT_PAKET.icraatMiktar);
    const res = await run(
      db,
      `UPDATE players SET elmas = elmas - ?, icraat = ?, last_icraat_paket_at = ? WHERE user_id = ? AND elmas >= ?`,
      [ICRAAT_PAKET.elmasMaliyet, yeniIcraat, simdi, userId, ICRAAT_PAKET.elmasMaliyet]
    );
    if (!res?.changes) return { ok: false, error: "Satın alma başarısız. Elmas bakiyeni kontrol et." };

    return {
      ok: true,
      mesaj: `İcraat Paketi alındı! +${ICRAAT_PAKET.icraatMiktar} İcraat.`,
      icraatPaket: await icraatPaketPanel(db, userId),
    };
  } catch (err) {
    console.error("[premium] icraat paket satin al:", err.message);
    return { ok: false, error: "İcraat Paketi alınamadı. Sayfayı yenileyip tekrar dene." };
  }
}

async function elmasPaketSatinAl(db, userId, paketId, clientMeta = null) {
  const paket = elmasPaketTanim(paketId);
  if (!paket) return { ok: false, error: "Geçersiz elmas paketi." };

  const userRow = await get(db, `SELECT kayit_ulkesi, oyun_dili FROM users WHERE id = ?`, [userId]);
  const locale = buildElmasLocale(userRow, clientMeta || {});
  const paraBirimi = resolveElmasParaBirimi(locale.kayitUlkesi, locale.oyunDili, {
    ulkeIp: locale.ulkeIp,
  });
  const { fiyat, sembol } = elmasPaketFiyat(paketId, paraBirimi);
  const fiyatMetin =
    paraBirimi === "TRY" ? `${fiyat} TL` : `${fiyat} ${sembol}`;

  // Gerçek ödeme entegrasyonu (Play Store / kart) buraya bağlanacak.
  return {
    ok: false,
    error: `${paket.baslik} (${fiyatMetin}) için ödeme altyapısı çok yakında aktif olacak.`,
    odemeBekliyor: true,
    paket: paket.id,
    fiyat,
    paraBirimi,
    sembol,
    fiyatMetin,
    toplamElmas: paket.elmas + (paket.bonusElmas || 0),
  };
}

async function premiumSatinAl(db, userId, paketId) {
  await ensurePremiumColumns(db);
  const paket = paketTanim(paketId);
  if (!paket) return { ok: false, error: "Geçersiz premium paket." };

  const st = await getPremiumStatus(db, userId);
  const mevcut = st.paket;
  if (mevcut && (PAKET_SIRA[mevcut] || 0) > (PAKET_SIRA[paket.id] || 0)) {
    return { ok: false, error: "Zaten daha üst bir pakete sahipsin." };
  }

  const row = await get(db, `SELECT elmas, premium_paket_bitis FROM players WHERE user_id = ?`, [userId]);
  const elmas = row?.elmas || 0;
  if (elmas < paket.elmasMaliyet) {
    return {
      ok: false,
      error: `Yeterli elmasın yok! ${paket.elmasMaliyet.toLocaleString("tr-TR")} elmas gerekir.`,
    };
  }

  const simdi = Math.floor(Date.now() / 1000);
  const mevcutBitis = Number(row?.premium_paket_bitis || 0);
  const uzatma = mevcut === paket.id && mevcutBitis > simdi;
  const yeniBitis = uzatma ? mevcutBitis + PAKET_SURE_SN : simdi + PAKET_SURE_SN;

  const res = await run(
    db,
    `UPDATE players SET elmas = elmas - ?, premium_paket = ?, premium_paket_bitis = ? WHERE user_id = ? AND elmas >= ?`,
    [paket.elmasMaliyet, paket.id, yeniBitis, userId, paket.elmasMaliyet]
  );
  if (!res?.changes) return { ok: false, error: "Satın alma başarısız." };

  await applyPremiumPaketAvantajlari(db, userId, paket);
  try {
    const { vipPortreHediyeHakkiAc } = require("./vipPortreService");
    await vipPortreHediyeHakkiAc(db, userId, paket.id);
  } catch (err) {
    console.error("[premium] vip portre hediye:", err?.message || err);
  }

  return {
    ok: true,
    mesaj: `${paket.baslik} aktif! Bitiş: ${formatPremiumBitis(yeniBitis)}`,
    paket: paket.id,
    premiumPaketBitis: yeniBitis,
  };
}

module.exports = {
  PREMIUM_PAKETLER,
  ELMAS_TL_PAKETLER,
  PAKET_SIRA,
  paketTanim,
  elmasPaketTanim,
  paketListesi,
  elmasPaketListesi,
  buildElmasLocale,
  resolveElmasParaBirimi,
  elmasPaketFiyat,
  getPlayerPremiumPaket,
  getPremiumStatus,
  getPremiumBonuses,
  premiumSatinAl,
  elmasPaketSatinAl,
  icraatPaketPanel,
  icraatPaketSatinAl,
  ICRAAT_PAKET,
  FAIZ_ORAN_VARSAYILAN,
  applyPremiumPaketAvantajlari,
};
