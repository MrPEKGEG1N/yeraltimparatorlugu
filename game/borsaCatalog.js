/** Borsa — NPC şirket kataloğu (Torn City tarzı, yeraltı evrenine uyarlı) */

const BORSA_MIN_ISLEM = 1;
/** İstismar önleme — pratikte kasa/portföy zaten sınırlar */
const BORSA_ADET_UST_SINIR = 2_000_000_000;
const BORSA_FIYAT_MIN = 10;
/** Baz fiyata göre bant — aşırı şişme/düşüş engeli */
const BORSA_FIYAT_MIN_CARPAN = 0.6;
const BORSA_FIYAT_MAX_CARPAN = 2.0;
/** Her fiyat tick'inde baz fiyata çekilme gücü */
const BORSA_MEAN_REVERT_ORAN = 0.03;
/** Rastgele dalgalanma (katalog volatilitesi ile çarpılır) */
const BORSA_RASTGELE_CARPAN = 0.4;
/** Tek işlemde en fazla fiyat etkisi */
const BORSA_ISLEM_ETKI_MAX = 0.04;
/** Bu adet referans hacimde tam etki ölçeği */
const BORSA_ISLEM_HACIM_REF = 600;

/** Haftalık temettü: portföy değerinin bu oranı bankaya yatar */
const BORSA_SIRKETLERI = [
  {
    id: "YLD",
    ad: "Yıldız Holding",
    sektor: "Holding",
    bazFiyat: 150,
    temettuOran: 0.012,
    volatilite: 0.035,
    aciklama: "Şehrin en büyük holdingi; dengeli getiri.",
  },
  {
    id: "KRL",
    ad: "Kara Lojistik",
    sektor: "Lojistik",
    bazFiyat: 95,
    temettuOran: 0.01,
    volatilite: 0.045,
    aciklama: "Yeraltı nakliye ağının omurgası.",
  },
  {
    id: "SBG",
    ad: "Sibergöz A.Ş.",
    sektor: "Teknoloji",
    bazFiyat: 185,
    temettuOran: 0.008,
    volatilite: 0.06,
    aciklama: "Yüksek risk, yüksek hareket — siber ve finans yazılımı.",
  },
  {
    id: "LMN",
    ad: "Liman Yatırım",
    sektor: "Denizcilik",
    bazFiyat: 220,
    temettuOran: 0.014,
    volatilite: 0.03,
    aciklama: "Liman gelirlerine bağlı; güçlü temettü.",
  },
  {
    id: "RHN",
    ad: "Rehin Finans",
    sektor: "Finans",
    bazFiyat: 130,
    temettuOran: 0.011,
    volatilite: 0.04,
    aciklama: "Gölge bankacılık ve kredi hatları.",
  },
  {
    id: "ATL",
    ad: "Atlas İnşaat",
    sektor: "İnşaat",
    bazFiyat: 78,
    temettuOran: 0.013,
    volatilite: 0.05,
    aciklama: "Mekân ve arsa yatırımları; ucuz hisse, dalgalı.",
  },
  {
    id: "MRC",
    ad: "Mercury Enerji",
    sektor: "Enerji",
    bazFiyat: 165,
    temettuOran: 0.009,
    volatilite: 0.042,
    aciklama: "Kaçak elektrik ve sanayi tedariki.",
  },
  {
    id: "VLD",
    ad: "Vadi Medya",
    sektor: "Medya",
    bazFiyat: 112,
    temettuOran: 0.01,
    volatilite: 0.038,
    aciklama: "Şehir gazetesi ve reklam ağları.",
  },
];

function borsaSirketBul(id) {
  return BORSA_SIRKETLERI.find((s) => s.id === String(id || "").toUpperCase()) || null;
}

module.exports = {
  BORSA_MIN_ISLEM,
  BORSA_ADET_UST_SINIR,
  BORSA_FIYAT_MIN,
  BORSA_FIYAT_MIN_CARPAN,
  BORSA_FIYAT_MAX_CARPAN,
  BORSA_MEAN_REVERT_ORAN,
  BORSA_RASTGELE_CARPAN,
  BORSA_ISLEM_ETKI_MAX,
  BORSA_ISLEM_HACIM_REF,
  BORSA_SIRKETLERI,
  borsaSirketBul,
};
