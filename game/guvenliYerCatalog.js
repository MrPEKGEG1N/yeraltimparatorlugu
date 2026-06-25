/** Güvenli Yer — 15 sıralı seviye (rehber ızgarası: soldan sağa, yukarıdan aşağı) */
const BASE_GENISLIK = 305;
const BASE_YUKSEKLIK = 320;
const MAX_SEVIYE = 15;

const SEVIYELER = [
  {
    seviye: 1,
    id: "bos_arazi",
    ad: "Boş Arazi",
    aciklama: "Gece vakti gizli arazi parselin. Üs buradan büyür.",
    maliyet: 0,
    gucBonus: 0,
  },
  {
    seviye: 2,
    id: "malikane_cit",
    ad: "Ana Malikane & Ahşap Çit",
    aciklama: "Merkez malikane ve ilk çevre güvenliği.",
    maliyet: 50_000,
    gucBonus: 4_500,
  },
  {
    seviye: 3,
    id: "tas_duvar",
    ad: "Taş Duvar",
    aciklama: "Çevreyi taş duvarla güçlendir.",
    maliyet: 120_000,
    gucBonus: 12_000,
  },
  {
    seviye: 4,
    id: "bahce",
    ad: "Bahçe",
    aciklama: "Malikanenin çevresine düzenli bahçe alanı.",
    maliyet: 250_000,
    gucBonus: 27_500,
  },
  {
    seviye: 5,
    id: "guclendirme_5",
    ad: "Çevre Güçlendirme",
    aciklama: "Duvar hatları ve giriş kontrol noktası.",
    maliyet: 400_000,
    gucBonus: 48_000,
  },
  {
    seviye: 6,
    id: "enerji_duvari",
    ad: "Enerji Duvarı",
    aciklama: "Dinamik enerji bariyeri — saldırılara karşı ek koruma.",
    maliyet: 600_000,
    gucBonus: 78_000,
  },
  {
    seviye: 7,
    id: "guclendirme_7",
    ad: "Savunma Hattı",
    aciklama: "İkinci halka savunma ve gözetleme.",
    maliyet: 900_000,
    gucBonus: 126_000,
  },
  {
    seviye: 8,
    id: "yeralti_hazirlik",
    ad: "Yeraltı Hazırlık",
    aciklama: "Gizli tüneller ve sığınak altyapısı.",
    maliyet: 1_200_000,
    gucBonus: 180_000,
  },
  {
    seviye: 9,
    id: "gizli_duzenler",
    ad: "Gizli Düzenler",
    aciklama: "Holografik operasyon işaretleri.",
    maliyet: 1_800_000,
    gucBonus: 288_000,
  },
  {
    seviye: 10,
    id: "keskin_nisanci",
    ad: "Keskin Nişancı Kulesi",
    aciklama: "Üssün köşesine gözetleme kulesi.",
    maliyet: 2_500_000,
    gucBonus: 425_000,
  },
  {
    seviye: 11,
    id: "guclendirme_11",
    ad: "Yeraltı Ağı",
    aciklama: "Tünel bağlantıları ve gizli geçitler.",
    maliyet: 3_500_000,
    gucBonus: 630_000,
  },
  {
    seviye: 12,
    id: "guclendirme_12",
    ad: "Lojistik Alanı",
    aciklama: "Depo ve tedarik hatları.",
    maliyet: 4_200_000,
    gucBonus: 798_000,
  },
  {
    seviye: 13,
    id: "helikopter_pisti",
    ad: "Helikopter Pisti",
    aciklama: "Hızlı tahliye ve lojistik iniş alanı.",
    maliyet: 5_000_000,
    gucBonus: 1_000_000,
  },
  {
    seviye: 14,
    id: "stratejik_bunker",
    ad: "Stratejik Bunker",
    aciklama: "Komuta merkezi ve ağır koruma.",
    maliyet: 8_000_000,
    gucBonus: 1_760_000,
  },
  {
    seviye: 15,
    id: "bunker_girisi",
    ad: "Bunker Girişi",
    aciklama: "Gizli yeraltı giriş kapısı — maksimum güvenlik.",
    maliyet: 10_000_000,
    gucBonus: 2_400_000,
  },
];

const MODUL_ALAN = {
  malikane_cit: "building_lvl",
  tas_duvar: "wall_lvl",
  bahce: "garden_lvl",
  enerji_duvari: "energy_wall",
  yeralti_hazirlik: "underground_lvl",
  gizli_duzenler: "secret_orders",
  keskin_nisanci: "has_tower",
  helikopter_pisti: "helipad",
  stratejik_bunker: "bunker_lvl",
  bunker_girisi: "bunker_entrance",
};

function seviyeGorselYolu(seviye) {
  const n = Math.max(1, Math.min(MAX_SEVIYE, parseInt(seviye, 10) || 1));
  return `/images/guvenli-yer/levels/seviye-${String(n).padStart(2, "0")}.png`;
}

function seviyeBul(n) {
  return SEVIYELER.find((s) => s.seviye === n) || SEVIYELER[0];
}

function sonrakiSeviye(baseSeviye) {
  const s = Math.max(1, parseInt(baseSeviye, 10) || 1);
  if (s >= MAX_SEVIYE) return null;
  return seviyeBul(s + 1);
}

function toplamGucBonusu(baseSeviye) {
  const s = Math.max(1, parseInt(baseSeviye, 10) || 1);
  return SEVIYELER.filter((x) => x.seviye <= s).reduce((t, x) => t + (x.gucBonus || 0), 0);
}

module.exports = {
  BASE_GENISLIK,
  BASE_YUKSEKLIK,
  MAX_SEVIYE,
  SEVIYELER,
  MODUL_ALAN,
  seviyeGorselYolu,
  seviyeBul,
  sonrakiSeviye,
  toplamGucBonusu,
};
