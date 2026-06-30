/** Oyuncu şirketleri — tam katalog */

const { YETENEK_ETIKET } = require("./meslekCatalog");

const EGITIM_MALIYET = 5000;
const EGITIM_KAZANC = 2;
const MAX_GUNLUK_TELAFI = 7;
const MAX_UPGRADE_SEVIYE = 6;
const MAX_GUNLUK_MAAS = 50000;
const MIN_GUNLUK_MAAS = 500;

/** Günlük eğitim slotu = personel odası seviyesi + yıldız bonusu */
const EGITIM_SLOT_BAZ = 1;

const UPGRADE_TIPLERI = {
  kapasite: {
    id: "kapasite",
    ad: "Şirket Büyüklüğü",
    emoji: "🏗️",
    aciklama: "Daha fazla çalışan alabilirsin.",
    calisanBonus: [0, 1, 1, 2, 2, 3, 3],
    maliyetCarpani: 0.15,
  },
  depo: {
    id: "depo",
    ad: "Depo / Stok Alanı",
    emoji: "📦",
    aciklama: "Daha fazla malzeme stoklayabilirsin.",
    kapasiteBonus: [0, 50, 100, 180, 280, 400, 550],
    maliyetCarpani: 0.12,
  },
  personel_odasi: {
    id: "personel_odasi",
    ad: "Personel Odası",
    emoji: "🛋️",
    aciklama: "Çalışan verimliliği ve günlük eğitim slotu artar.",
    verimBonus: [0, 3, 6, 10, 14, 18, 22],
    egitimSlotBonus: [0, 1, 1, 2, 2, 3, 3],
    maliyetCarpani: 0.1,
  },
};

const REKLAM_SEVIYELERI = [
  { id: 0, ad: "Kapalı", gunlukMaliyet: 0, musteriBonus: 0 },
  { id: 1, ad: "Mahalle Afişi", gunlukMaliyet: 800, musteriBonus: 0.08 },
  { id: 2, ad: "Sosyal Medya", gunlukMaliyet: 2500, musteriBonus: 0.18 },
  { id: 3, ad: "Radyo Spotu", gunlukMaliyet: 6000, musteriBonus: 0.3 },
  { id: 4, ad: "TV Kampanyası", gunlukMaliyet: 15000, musteriBonus: 0.45 },
  { id: 5, ad: "Agresif Pazarlama", gunlukMaliyet: 35000, musteriBonus: 0.65 },
];

const MALZEME_TANIM = {
  kahve_cekirdek: { ad: "Kahve Çekirdeği", emoji: "☕", birimFiyat: 85 },
  sut: { ad: "Süt & Krema", emoji: "🥛", birimFiyat: 45 },
  seker: { ad: "Şeker & Tatlandırıcı", emoji: "🍬", birimFiyat: 25 },
  ambalaj: { ad: "Ambalaj & Bardak", emoji: "📦", birimFiyat: 18 },
  kargo_koli: { ad: "Kargo Kolisi", emoji: "📮", birimFiyat: 55 },
  yakit: { ad: "Yakıt", emoji: "⛽", birimFiyat: 120 },
  palet: { ad: "Depo Paleti", emoji: "🪵", birimFiyat: 90 },
  sunucu_guc: { ad: "Sunucu Gücü (kredi)", emoji: "🖥️", birimFiyat: 200 },
  lisans: { ad: "Yazılım Lisansı", emoji: "📄", birimFiyat: 150 },
  guvenlik_ekipman: { ad: "Güvenlik Ekipmanı", emoji: "🦺", birimFiyat: 70 },
  icecek_stok: { ad: "Alkolsüz & Alkollü Stok", emoji: "🍹", birimFiyat: 95 },
  ses_isik: { ad: "Ses & Işık Sarfı", emoji: "💡", birimFiyat: 110 },
  gida_hammadde: { ad: "Gıda Hammaddesi", emoji: "🥩", birimFiyat: 65 },
};

const SIRKET_TURLERI = [
  {
    id: "cafe",
    ad: "Cafe & Bar",
    emoji: "☕",
    aciklama: "İçecek servisi. Malzeme stoku olmadan satış yapılamaz.",
    kurulusUcreti: 3000000,
    bazCalisan: 4,
    bazDepoKapasite: 120,
    urunAd: "İçecek Servisi",
    birimSatisFiyati: 420,
    birimMaliyetOran: 0.35,
    pozisyonlar: [
      {
        id: "stajyer",
        unvan: "Stajyer Garson",
        seviye: "giris",
        varsayilanMaas: 1800,
        uretimBonus: 1,
        gereksinim: { beceri: 5, dayaniklilik: 5 },
        yetenekKazanc: { beceri: 1 },
      },
      {
        id: "garson",
        unvan: "Garson",
        seviye: "orta",
        varsayilanMaas: 2500,
        uretimBonus: 1.4,
        gereksinim: { beceri: 10, dayaniklilik: 8 },
        yetenekKazanc: { beceri: 1 },
      },
      {
        id: "barista",
        unvan: "Barista",
        seviye: "orta",
        varsayilanMaas: 3200,
        uretimBonus: 1.6,
        gereksinim: { beceri: 14, zeka: 10 },
        yetenekKazanc: { beceri: 1, zeka: 1 },
      },
      {
        id: "kasiyer",
        unvan: "Kasiyer",
        seviye: "giris",
        varsayilanMaas: 2200,
        uretimBonus: 1.1,
        gereksinim: { zeka: 6, beceri: 6 },
        yetenekKazanc: { zeka: 1 },
      },
      {
        id: "muhasebeci",
        unvan: "Muhasebeci",
        seviye: "ozel",
        ozel: "sekreter",
        varsayilanMaas: 3800,
        uretimBonus: 0.5,
        gereksinim: { zeka: 12, beceri: 10 },
        yetenekKazanc: { zeka: 2 },
      },
      {
        id: "pazarlamaci",
        unvan: "Pazarlamacı",
        seviye: "ozel",
        ozel: "pazarlamaci",
        varsayilanMaas: 4000,
        uretimBonus: 0.6,
        gereksinim: { zeka: 14, beceri: 12 },
        yetenekKazanc: { zeka: 1, beceri: 1 },
      },
      {
        id: "mudur",
        unvan: "Salon Müdürü",
        seviye: "ileri",
        ozel: "mudur",
        varsayilanMaas: 5000,
        uretimBonus: 2,
        gereksinim: { zeka: 18, beceri: 16, dayaniklilik: 12 },
        yetenekKazanc: { zeka: 2 },
      },
    ],
    malzemeler: [
      { id: "kahve_cekirdek", birimTuketim: 1 },
      { id: "sut", birimTuketim: 0.6 },
      { id: "seker", birimTuketim: 0.3 },
      { id: "ambalaj", birimTuketim: 0.5 },
    ],
  },
  {
    id: "lojistik",
    ad: "Lojistik Firması",
    emoji: "🚚",
    aciklama: "Kargo taşımacılığı. Yakıt ve koli stoku zorunlu.",
    kurulusUcreti: 5000000,
    bazCalisan: 5,
    bazDepoKapasite: 200,
    urunAd: "Kargo Teslimatı",
    birimSatisFiyati: 680,
    birimMaliyetOran: 0.4,
    pozisyonlar: [
      {
        id: "depo_stajyer",
        unvan: "Depo Stajyeri",
        seviye: "giris",
        varsayilanMaas: 2000,
        uretimBonus: 1,
        gereksinim: { guc: 5, dayaniklilik: 5 },
        yetenekKazanc: { guc: 1 },
      },
      {
        id: "depo",
        unvan: "Depo Elemanı",
        seviye: "orta",
        varsayilanMaas: 2800,
        uretimBonus: 1.5,
        gereksinim: { guc: 10, dayaniklilik: 10 },
        yetenekKazanc: { guc: 1, dayaniklilik: 1 },
      },
      {
        id: "sofor",
        unvan: "Şoför",
        seviye: "orta",
        varsayilanMaas: 3500,
        uretimBonus: 1.8,
        gereksinim: { beceri: 12, zeka: 8 },
        yetenekKazanc: { beceri: 1 },
      },
      {
        id: "planlama",
        unvan: "Planlama Uzmanı",
        seviye: "ileri",
        varsayilanMaas: 4200,
        uretimBonus: 1.4,
        gereksinim: { zeka: 16, beceri: 12 },
        yetenekKazanc: { zeka: 2 },
      },
      {
        id: "muhasebeci",
        unvan: "Lojistik Muhasebeci",
        seviye: "ozel",
        ozel: "sekreter",
        varsayilanMaas: 4000,
        uretimBonus: 0.5,
        gereksinim: { zeka: 12, beceri: 10 },
        yetenekKazanc: { zeka: 2 },
      },
      {
        id: "operasyon",
        unvan: "Operasyon Şefi",
        seviye: "ileri",
        ozel: "mudur",
        varsayilanMaas: 5500,
        uretimBonus: 2.2,
        gereksinim: { zeka: 20, dayaniklilik: 14, guc: 12 },
        yetenekKazanc: { zeka: 1, dayaniklilik: 1 },
      },
    ],
    malzemeler: [
      { id: "kargo_koli", birimTuketim: 1 },
      { id: "yakit", birimTuketim: 0.8 },
      { id: "palet", birimTuketim: 0.2 },
    ],
  },
  {
    id: "teknoloji",
    ad: "Teknoloji Ofisi",
    emoji: "💻",
    aciklama: "Yazılım & destek. Sunucu kredisi ve lisans stoku gerekir.",
    kurulusUcreti: 8000000,
    bazCalisan: 4,
    bazDepoKapasite: 80,
    urunAd: "Hizmet Paketi",
    birimSatisFiyati: 950,
    birimMaliyetOran: 0.25,
    pozisyonlar: [
      {
        id: "stajyer_destek",
        unvan: "Destek Stajyeri",
        seviye: "giris",
        varsayilanMaas: 2200,
        uretimBonus: 1,
        gereksinim: { zeka: 6, beceri: 5 },
        yetenekKazanc: { zeka: 1 },
      },
      {
        id: "destek",
        unvan: "Destek Uzmanı",
        seviye: "orta",
        varsayilanMaas: 3000,
        uretimBonus: 1.4,
        gereksinim: { zeka: 12, beceri: 8 },
        yetenekKazanc: { zeka: 1 },
      },
      {
        id: "gelistirici",
        unvan: "Geliştirici",
        seviye: "ileri",
        varsayilanMaas: 4800,
        uretimBonus: 2,
        gereksinim: { zeka: 18, beceri: 14 },
        yetenekKazanc: { zeka: 2, beceri: 1 },
      },
      {
        id: "proje",
        unvan: "Proje Yöneticisi",
        seviye: "ileri",
        ozel: "mudur",
        varsayilanMaas: 5200,
        uretimBonus: 1.6,
        gereksinim: { zeka: 20, dayaniklilik: 10 },
        yetenekKazanc: { zeka: 2 },
      },
      {
        id: "pazarlamaci",
        unvan: "Büyüme Pazarlamacısı",
        seviye: "ozel",
        ozel: "pazarlamaci",
        varsayilanMaas: 4200,
        uretimBonus: 0.7,
        gereksinim: { zeka: 14, beceri: 10 },
        yetenekKazanc: { zeka: 1, beceri: 1 },
      },
    ],
    malzemeler: [
      { id: "sunucu_guc", birimTuketim: 0.5 },
      { id: "lisans", birimTuketim: 0.3 },
    ],
  },
  {
    id: "gece_kulubu",
    ad: "Gece Kulübü",
    emoji: "🎭",
    aciklama: "Gece eğlencesi. İçecek ve teknik sarf malzemesi tüketir.",
    kurulusUcreti: 10000000,
    bazCalisan: 5,
    bazDepoKapasite: 160,
    urunAd: "Gece Servisi",
    birimSatisFiyati: 780,
    birimMaliyetOran: 0.38,
    pozisyonlar: [
      {
        id: "temizlik",
        unvan: "Temizlik Görevlisi",
        seviye: "giris",
        varsayilanMaas: 1900,
        uretimBonus: 0.9,
        gereksinim: { dayaniklilik: 5, guc: 5 },
        yetenekKazanc: { dayaniklilik: 1 },
      },
      {
        id: "guvenlik",
        unvan: "Güvenlik",
        seviye: "orta",
        varsayilanMaas: 3200,
        uretimBonus: 1.2,
        gereksinim: { guc: 12, dayaniklilik: 10 },
        yetenekKazanc: { guc: 1, dayaniklilik: 1 },
      },
      {
        id: "barmen",
        unvan: "Barmen",
        seviye: "orta",
        varsayilanMaas: 3800,
        uretimBonus: 1.7,
        gereksinim: { beceri: 12, zeka: 10 },
        yetenekKazanc: { beceri: 1 },
      },
      {
        id: "hostes",
        unvan: "Hostes",
        seviye: "giris",
        varsayilanMaas: 2600,
        uretimBonus: 1.3,
        gereksinim: { beceri: 8, zeka: 8 },
        yetenekKazanc: { beceri: 1, zeka: 1 },
      },
      {
        id: "dj",
        unvan: "DJ / Eğlence",
        seviye: "orta",
        varsayilanMaas: 3400,
        uretimBonus: 1.5,
        gereksinim: { beceri: 10, zeka: 10 },
        yetenekKazanc: { beceri: 1 },
      },
      {
        id: "muhasebeci",
        unvan: "Gece Muhasebecisi",
        seviye: "ozel",
        ozel: "sekreter",
        varsayilanMaas: 4100,
        uretimBonus: 0.5,
        gereksinim: { zeka: 12, beceri: 10 },
        yetenekKazanc: { zeka: 2 },
      },
      {
        id: "mudur",
        unvan: "Gece Müdürü",
        seviye: "ileri",
        ozel: "mudur",
        varsayilanMaas: 6000,
        uretimBonus: 2.3,
        gereksinim: { zeka: 18, beceri: 16, guc: 10 },
        yetenekKazanc: { zeka: 2 },
      },
    ],
    malzemeler: [
      { id: "icecek_stok", birimTuketim: 1 },
      { id: "ses_isik", birimTuketim: 0.4 },
      { id: "guvenlik_ekipman", birimTuketim: 0.15 },
      { id: "ambalaj", birimTuketim: 0.3 },
    ],
  },
];

function turBul(id) {
  return SIRKET_TURLERI.find((t) => t.id === id) || null;
}

function pozisyonBul(turId, pozisyonId) {
  const tur = turBul(turId);
  if (!tur) return null;
  return tur.pozisyonlar.find((p) => p.id === pozisyonId) || null;
}

function malzemeBul(id) {
  return MALZEME_TANIM[id] || null;
}

function upgradeMaliyet(tur, tipId, mevcutSeviye) {
  const tip = UPGRADE_TIPLERI[tipId];
  if (!tip || mevcutSeviye >= MAX_UPGRADE_SEVIYE) return null;
  return Math.floor(tur.kurulusUcreti * tip.maliyetCarpani * (mevcutSeviye + 1));
}

function maxCalisanHesapla(tur, kapasiteSeviye) {
  const bonus = UPGRADE_TIPLERI.kapasite.calisanBonus[kapasiteSeviye] || 0;
  return tur.bazCalisan + bonus;
}

function depoKapasiteHesapla(tur, depoSeviye) {
  const bonus = UPGRADE_TIPLERI.depo.kapasiteBonus[depoSeviye] || 0;
  return tur.bazDepoKapasite + bonus;
}

function personelOdasiBonuslari(seviye) {
  const tip = UPGRADE_TIPLERI.personel_odasi;
  return {
    verimBonus: tip.verimBonus[seviye] || 0,
    egitimSlotBonus: tip.egitimSlotBonus[seviye] || 0,
  };
}

function birimBasinaMalzemeMaliyet(tur) {
  let toplam = 0;
  for (const m of tur.malzemeler || []) {
    const tanim = malzemeBul(m.id);
    if (tanim) toplam += tanim.birimFiyat * (m.birimTuketim || 1);
  }
  return Math.floor(toplam);
}

function turMalzemeListesi(tur) {
  return (tur.malzemeler || []).map((m) => {
    const tanim = malzemeBul(m.id);
    return {
      id: m.id,
      ad: tanim ? tanim.ad : m.id,
      emoji: tanim ? tanim.emoji : "📦",
      birimFiyat: tanim ? tanim.birimFiyat : 0,
      birimTuketim: m.birimTuketim,
    };
  });
}

module.exports = {
  YETENEK_ETIKET,
  EGITIM_MALIYET,
  EGITIM_KAZANC,
  EGITIM_SLOT_BAZ,
  MAX_GUNLUK_TELAFI,
  MAX_UPGRADE_SEVIYE,
  MAX_GUNLUK_MAAS,
  MIN_GUNLUK_MAAS,
  UPGRADE_TIPLERI,
  REKLAM_SEVIYELERI,
  MALZEME_TANIM,
  SIRKET_TURLERI,
  turBul,
  pozisyonBul,
  malzemeBul,
  upgradeMaliyet,
  maxCalisanHesapla,
  depoKapasiteHesapla,
  personelOdasiBonuslari,
  birimBasinaMalzemeMaliyet,
  turMalzemeListesi,
};
