const { run, get } = require("../db/database");
const { ICRAAT_SAATLIK_BONUS, ICRAAT_MAX } = require("./catalog");

const SMS_GUNLUK_VARSAYILAN = 50;
const BANKA_HAK_GUNLUK_VARSAYILAN = 20;

const PAKET_SIRA = { tetikci: 1, racon: 2, baron: 3 };

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
    faizOran: 0.015,
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
    icraatSaatlik: 50,
    smsGunluk: 100,
    smsSinirsiz: false,
    bankaHakGunluk: 50,
    bankaHakSinirsiz: false,
    faizOran: 0.02,
    mekanGelirBonus: 0.1,
    prestijRozet: "🥈",
    prestijEtiket: "Gümüş Şarjör",
  },
  baron: {
    id: "baron",
    baslik: "Baron / Hükümdar Paketi",
    altBaslik: "Yeraltının Tek Sahibi",
    elmasMaliyet: 600,
    tlOrtalama: 320,
    icraatSaatlik: 75,
    smsGunluk: null,
    smsSinirsiz: true,
    bankaHakGunluk: null,
    bankaHakSinirsiz: true,
    faizOran: 0.025,
    mekanGelirBonus: 0.2,
    prestijRozet: "👑",
    prestijEtiket: "Altın Taç",
  },
};

function elmasPaketTanim(paketId) {
  const id = String(paketId || "").trim();
  return ELMAS_TL_PAKETLER[id] || null;
}

function elmasPaketListesi() {
  return Object.values(ELMAS_TL_PAKETLER).map((p) => {
    const toplam = p.elmas + (p.bonusElmas || 0);
    const birimMaliyet = toplam > 0 ? Math.round((p.tlFiyat / toplam) * 100) / 100 : 0;
    return {
      id: p.id,
      ikon: p.ikon,
      baslik: p.baslik,
      elmas: p.elmas,
      bonusElmas: p.bonusElmas || 0,
      toplamElmas: toplam,
      tlFiyat: p.tlFiyat,
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
    faizYuzde: Math.round(p.faizOran * 1000) / 10,
    mekanGelirBonusYuzde: Math.round(p.mekanGelirBonus * 100),
    prestijRozet: p.prestijRozet,
    prestijEtiket: p.prestijEtiket,
  }));
}

async function getPlayerPremiumPaket(db, userId) {
  const row = await get(db, `SELECT premium_paket FROM players WHERE user_id = ?`, [userId]);
  const id = String(row?.premium_paket || "").trim();
  return paketTanim(id) ? id : "";
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
    faizOran: p?.faizOran ?? 0.01,
    mekanGelirBonus: p?.mekanGelirBonus ?? 0,
    prestijRozet: p?.prestijRozet || "",
    prestijEtiket: p?.prestijEtiket || "",
  };
}

async function ensureIcraatPaketColumn(db) {
  try {
    await run(db, `ALTER TABLE players ADD COLUMN last_icraat_paket_at INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
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
  if (!res?.changes) return { ok: false, error: "Satın alma başarısız." };

  return {
    ok: true,
    mesaj: `İcraat Paketi alındı! +${ICRAAT_PAKET.icraatMiktar} İcraat.`,
    icraatPaket: await icraatPaketPanel(db, userId),
  };
}

async function elmasPaketSatinAl(db, userId, paketId) {
  const paket = elmasPaketTanim(paketId);
  if (!paket) return { ok: false, error: "Geçersiz elmas paketi." };

  // Gerçek ödeme entegrasyonu (Play Store / kart) buraya bağlanacak.
  return {
    ok: false,
    error: `${paket.baslik} (${paket.tlFiyat} TL) için ödeme altyapısı çok yakında aktif olacak.`,
    odemeBekliyor: true,
    paket: paket.id,
    tlFiyat: paket.tlFiyat,
    toplamElmas: paket.elmas + (paket.bonusElmas || 0),
  };
}

async function premiumSatinAl(db, userId, paketId) {
  const paket = paketTanim(paketId);
  if (!paket) return { ok: false, error: "Geçersiz premium paket." };

  const mevcut = await getPlayerPremiumPaket(db, userId);
  if (mevcut && (PAKET_SIRA[mevcut] || 0) >= (PAKET_SIRA[paket.id] || 0)) {
    return { ok: false, error: "Zaten bu pakete veya daha üst bir pakete sahipsin." };
  }

  const row = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
  const elmas = row?.elmas || 0;
  if (elmas < paket.elmasMaliyet) {
    return {
      ok: false,
      error: `Yeterli elmasın yok! ${paket.elmasMaliyet.toLocaleString("tr-TR")} elmas gerekir.`,
    };
  }

  await run(db, `UPDATE players SET elmas = elmas - ?, premium_paket = ? WHERE user_id = ?`, [
    paket.elmasMaliyet,
    paket.id,
    userId,
  ]);

  await applyPremiumPaketAvantajlari(db, userId, paket);

  return {
    ok: true,
    mesaj: `${paket.baslik} aktif edildi! Ayrıcalıkların hemen geçerli.`,
    paket: paket.id,
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
  getPlayerPremiumPaket,
  getPremiumBonuses,
  premiumSatinAl,
  elmasPaketSatinAl,
  icraatPaketPanel,
  icraatPaketSatinAl,
  ICRAAT_PAKET,
  applyPremiumPaketAvantajlari,
};
