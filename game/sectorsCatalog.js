/** Mekan Sahibi — bireysel alım; fiyat her alımda %5 artar, getiri/saygınlık sabit görünür. */
const SECTOR_KEYS = ["yeralti", "silah", "paket"];

const MEKANLAR = {
  yeralti: {
    kahvehane: {
      ad: "Kahvehane",
      aciklama: "Mahallede çay ocağı; küçük ama sürekli nakit.",
      fiyat: 25000,
      saatlik: 5000,
      sayginlik: 15,
      gorsel: "kahvehane",
    },
    bar: {
      ad: "Bar",
      aciklama: "Gece boyu akan içki ve müzik parası.",
      fiyat: 75000,
      saatlik: 15000,
      sayginlik: 40,
      gorsel: "bar",
    },
    disco: {
      ad: "Disco",
      aciklama: "Işıklar altında dönen kapı parası.",
      fiyat: 200000,
      saatlik: 40000,
      sayginlik: 90,
      gorsel: "disco",
    },
    lunapark: {
      ad: "Lunapark",
      aciklama: "Aile işi görünümlü, arka planda büyük oyun.",
      fiyat: 450000,
      saatlik: 85000,
      sayginlik: 150,
      gorsel: "lunapark",
    },
    kumarhane: {
      ad: "Kumarhane",
      aciklama: "Masaların kralı; en yüksek yeraltı getirisi.",
      fiyat: 1200000,
      saatlik: 250000,
      sayginlik: 400,
      gorsel: "kumarhane_mekan",
    },
  },
  silah: {
    sokak_arasi: {
      ad: "Sokak Arası Sektörü",
      aciklama: "Mahalle silah ticareti ve stok.",
      fiyat: 50000,
      saatlik: 12000,
      sayginlik: 25,
      gorsel: "sokak_arasi",
    },
    sehirler_arasi: {
      ad: "Şehirler Arası Sektörü",
      aciklama: "İl içi sevkiyat ve depo ağı.",
      fiyat: 180000,
      saatlik: 35000,
      sayginlik: 70,
      gorsel: "sehirler_arasi",
    },
    kacakcilik: {
      ad: "Kaçakçılık Sektörü",
      aciklama: "Sınır geçişli silah hatları.",
      fiyat: 500000,
      saatlik: 95000,
      sayginlik: 180,
      gorsel: "kacakcilik",
    },
    uluslararasi: {
      ad: "Uluslararası Sektörü",
      aciklama: "Konteynerlerle gelen ağır cephane.",
      fiyat: 1500000,
      saatlik: 280000,
      sayginlik: 450,
      gorsel: "uluslararasi",
    },
    atom: {
      ad: "Atom Sektörü",
      aciklama: "En üst düzey — sadece efsaneler dokunur.",
      fiyat: 5000000,
      saatlik: 900000,
      sayginlik: 1200,
      gorsel: "atom",
    },
  },
  paket: {
    mahalle_teslimat: {
      ad: "Mahalle Teslimatı",
      aciklama: "Sokak köşelerine gizli paket dağıtımı.",
      fiyat: 30000,
      saatlik: 8000,
      sayginlik: 20,
      gorsel: "mahalle_teslimat",
    },
    sehirler_arasi_teslimat: {
      ad: "Şehirler Arası Teslimat",
      aciklama: "Şehir hatlarında hızlı kurye ağı.",
      fiyat: 120000,
      saatlik: 28000,
      sayginlik: 55,
      gorsel: "sehir_teslimat",
    },
    ulke_capinda: {
      ad: "Ülke Çapında Teslimat",
      aciklama: "Türkiye geneli lojistik örgütü.",
      fiyat: 600000,
      saatlik: 120000,
      sayginlik: 220,
      gorsel: "ulke_teslimat",
    },
    uluslararasi_teslimat: {
      ad: "Uluslar Arası Teslimat",
      aciklama: "Pasaportsuz yük — dünya rotası.",
      fiyat: 2500000,
      saatlik: 480000,
      sayginlik: 800,
      gorsel: "ulus_teslimat",
    },
  },
};

function mekanTanim(sektor, mekanKey) {
  const s = MEKANLAR[sektor];
  if (!s) return null;
  const m = s[mekanKey];
  if (!m) return null;
  return { sektor, mekanKey, ...m };
}

function sonrakiFiyat(bazFiyat, adet) {
  return Math.floor(bazFiyat * Math.pow(1.05, adet));
}

module.exports = { SECTOR_KEYS, MEKANLAR, mekanTanim, sonrakiFiyat };
