/** Kumarhane — oyun kataloğu ve limitler */

const CHIP_ORAN = 1;
const KUMAR_MIN_CHIP_ISLEM = 100;
const KUMAR_MAX_CHIP_ISLEM = 50_000_000;
const KUMAR_MIN_BAHIS = 50;
const KUMAR_MAX_BAHIS = 5_000_000;

const KUMAR_OYUNLARI = [
  {
    id: "blackjack",
    ad: "Blackjack",
    ikon: "🃏",
    aciklama: "21'e en yakın ol — krupiyeyi yen. Hit, Stand veya Double.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 500_000,
    cokluAdim: true,
  },
  {
    id: "rulet",
    ad: "Rulet",
    ikon: "🎡",
    aciklama: "Avrupa ruleti — kırmızı/siyah, tek/çift veya şanslı numara.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 1_000_000,
    cokluAdim: false,
  },
  {
    id: "barbut",
    ad: "Barbut",
    ikon: "🎲",
    aciklama: "Sokak zarları — pas, yedi, çift veya on bir bahisleri.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 800_000,
    cokluAdim: false,
  },
  {
    id: "rus_ruleti",
    ad: "Rus Ruleti",
    ikon: "🔫",
    aciklama: "Tek kurşun — hayatta kalırsan 1.5x, yoksa her şey gider.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 500_000,
    cokluAdim: false,
  },
  {
    id: "uc_kart_poker",
    ad: "Üç Kart Poker",
    ikon: "♠️",
    aciklama: "Üç kartla krupiyeye karşı oyna — per veya floş yakala.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 500_000,
    cokluAdim: false,
  },
  {
    id: "slot",
    ad: "Slot Makinesi",
    ikon: "🎰",
    aciklama: "Üç makarayı çevir — aynı semboller büyük ödül.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 200_000,
    cokluAdim: false,
  },
  {
    id: "at_yarisi",
    ad: "At Yarışı",
    ikon: "🐎",
    aciklama: "Altılıgah pistinde at seç — oran yüksekse risk büyük.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 1_000_000,
    cokluAdim: false,
  },
  {
    id: "five_finger",
    ad: "Five Finger Fillet",
    ikon: "🔪",
    aciklama: "Bıçak dansı — doğru parmakları seç, tur atla, çarpanı büyüt.",
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: 300_000,
    cokluAdim: true,
  },
];

const PIYANGO_OYUN = {
  id: "piyango",
  ad: "Piyango",
  ikon: "🎟️",
  aciklama: "6/25 sayı seç — 6 sayının tamamını bilen havuzun %90'ını kazanır.",
  minBahis: 100_000,
  maxBahis: 100_000,
  cokluAdim: false,
  ozel: true,
};

function piyangoAktifMi() {
  return process.env.NODE_ENV !== "production" || process.env.KUMARHANE_PIYANGO === "1";
}

function kumarOyunlariGetir() {
  if (!piyangoAktifMi()) return KUMAR_OYUNLARI;
  const piyango = { ...PIYANGO_OYUN };
  return [piyango, ...KUMAR_OYUNLARI];
}

function oyunBul(id) {
  const sid = String(id || "");
  if (sid === "piyango" && piyangoAktifMi()) return PIYANGO_OYUN;
  return KUMAR_OYUNLARI.find((o) => o.id === sid) || null;
}

module.exports = {
  CHIP_ORAN,
  KUMAR_MIN_CHIP_ISLEM,
  KUMAR_MAX_CHIP_ISLEM,
  KUMAR_MIN_BAHIS,
  KUMAR_MAX_BAHIS,
  KUMAR_OYUNLARI,
  PIYANGO_OYUN,
  piyangoAktifMi,
  kumarOyunlariGetir,
  oyunBul,
};
