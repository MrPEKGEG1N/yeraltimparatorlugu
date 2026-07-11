/** Spor salonu — meslek antrenman ekonomisine bağlı kademeli salonlar. */
const {
  YETENEK_ANAHTARLAR,
  YETENEK_ETIKET,
  YETENEK_TANIM,
  ANTRENMAN_KAZANC,
  antrenmanMaliyet,
} = require("./yetenekCatalog");

/** Her antrenman oturumu süresi (saniye) */
const ANTRENMAN_SURE_SN = 30 * 60;

/**
 * Meslek antrenmanı: ~100.000 TL / +1 stat (stat 8 civarı), günde 4 hak.
 * Spor salonu: benzer TL + icraat; her seans 30 dk sürer.
 */
const SALONLAR = [
  {
    id: "mahalle",
    ad: "Mahalle Spor Salonu",
    aciklama: "Burada sadece ter ve demir var.",
    aciklamaDetay: [
      "Bodrum katında, loş, sarı ışıklı bir ortam.",
      "Eski, dökülmeye başlamış beton ve tuğla duvarlar.",
      "Paslanmış halterler, derme çatma ağırlık sehpaları, eski lastikler ve bir kum torbası.",
      "Havalandırma boruları, duvarda asılı eski amatör bir boks kulübü posteri.",
    ],
    slogan: "Burada sadece ter ve demir var.",
    kayitUcret: 0,
    unlockOnceki: null,
    unlockAntrenman: 0,
    icraatMaliyet: 2,
    tlCarpan: 0.92,
    kazanc: ANTRENMAN_KAZANC,
    gunlukLimit: 5,
    dots: 1,
    tier: 1,
    statOdak: ["guc", "dayaniklilik"],
  },
  {
    id: "semt",
    ad: "Semt Fitness",
    aciklama: "Daha düzenli, daha ulaşılabilir.",
    aciklamaDetay: [
      "Sokak seviyesinde bir dükkanın dönüştürülmesiyle oluşmuş, floresan aydınlatmalı bir alan.",
      "Temiz, açık renkli boya ve kısmen aynalı duvarlar.",
      "Modern, ancak temel seviye kardiyo makineleri (koşu bantları, eliptik bisikletler) ve birkaç çok istasyonlu ağırlık makinesi.",
      "Büyük pencerelerden dışarıdaki caddenin (gece) hafif görüntüsü.",
    ],
    slogan: "Daha düzenli, daha ulaşılabilir.",
    kayitUcret: 750_000,
    unlockOnceki: "mahalle",
    unlockAntrenman: 20,
    icraatMaliyet: 3,
    tlCarpan: 1.0,
    kazanc: ANTRENMAN_KAZANC,
    gunlukLimit: 4,
    dots: 2,
    tier: 2,
    statOdak: ["guc", "beceri"],
  },
  {
    id: "sehir",
    ad: "Şehir Bodybuilding",
    aciklama: "Ciddi ağırlıklar, ciddi adamlar.",
    aciklamaDetay: [
      "Geniş, yüksek tavanlı, endüstriyel şıklığa sahip bir depo veya fabrika dönüşümü. Aydınlatma güçlü ve soğuk beyaz.",
      "Koyu gri beton ve tuğla kombinasyonu, her yerde devasa aynalar.",
      "Ağır hizmet tipi (heavy-duty) Hammer Strength tipi makineler, olimpik yarışma sehpaları, devasa bir dambıl serisi (50kg+). Kardiyo makineleri sadece ısınma içindir.",
      "Tavanlarda açıkta kalan kirişler, profesyonel vücut geliştirme posterleri, özel yapım bir \"ŞEHİR BODYBUILDING\" neon tabelası.",
    ],
    slogan: "Ciddi ağırlıklar, ciddi adamlar.",
    kayitUcret: 3_500_000,
    unlockOnceki: "semt",
    unlockAntrenman: 30,
    icraatMaliyet: 4,
    tlCarpan: 1.08,
    kazanc: ANTRENMAN_KAZANC,
    gunlukLimit: 3,
    dots: 3,
    tier: 3,
    statOdak: ["zeka", "beceri"],
  },
  {
    id: "elit",
    ad: "Elit Dövüş Kampı",
    aciklama: "Mükemmellik ve disiplin.",
    aciklamaDetay: [
      "Geniş, gün ışığı alan, yüksek güvenlikli bir tesis. Şehir manzarasına hakim bir teras katı.",
      "Minimalist tasarım, cilalı beton ve koyu ahşap paneller.",
      "Son teknoloji hibrit antrenman makineleri, profesyonel bir MMA kafesi (sekizgen ring), yüksek kaliteli hız topları ve profesyonel bir fizyoterapi alanı.",
      "Zemin kauçuk kaplı, tavanda modern LED aydınlatma sistemi, duvarda zarif bir şekilde işlenmiş \"ELİT DÖVÜŞ KAMPI\" amblemi, dışarıda panoramik şehir manzarası.",
    ],
    slogan: "Mükemmellik ve disiplin.",
    kayitUcret: 15_000_000,
    unlockOnceki: "sehir",
    unlockAntrenman: 40,
    icraatMaliyet: 5,
    tlCarpan: 1.15,
    kazanc: ANTRENMAN_KAZANC,
    gunlukLimit: 2,
    dots: 4,
    tier: 4,
    statOdak: ["guc", "zeka", "dayaniklilik", "beceri"],
  },
];

function salonBul(id) {
  return SALONLAR.find((s) => s.id === id) || null;
}

function salonTlMaliyet(salon, mevcutStat) {
  return Math.floor(antrenmanMaliyet(mevcutStat) * salon.tlCarpan);
}

function salonStatMaliyetMap(salon, yetenekler) {
  const out = {};
  for (const key of YETENEK_ANAHTARLAR) {
    out[key] = salonTlMaliyet(salon, yetenekler?.[key] || 0);
  }
  return out;
}

function salonKazancMap(salon) {
  const k = salon.kazanc || ANTRENMAN_KAZANC;
  const out = {};
  for (const key of YETENEK_ANAHTARLAR) out[key] = k;
  return out;
}

module.exports = {
  SALONLAR,
  salonBul,
  salonTlMaliyet,
  salonStatMaliyetMap,
  salonKazancMap,
  YETENEK_ANAHTARLAR,
  YETENEK_ETIKET,
  YETENEK_TANIM,
  ANTRENMAN_KAZANC,
  ANTRENMAN_SURE_SN,
};
