/** Meslekler — işyerleri, pozisyonlar, mülakat soruları */

const { YETENEK_ETIKET, BASLANGIC_YETENEK } = require("./yetenekCatalog");

const YETENEK_SORULAR = {
  guc: "Fiziksel iş yükünü ve zorlu görevleri kaldırabilir misiniz?",
  zeka: "Hızlı düşünüp doğru karar verebilir misiniz?",
  dayaniklilik: "Uzun vardiyalara ve yorucu tempoya dayanıklı mısınız?",
  beceri: "Elleriniz becerikli; işinize özen gösterir misiniz?",
};

const ISYERLERI = [
  {
    id: "belediye",
    ad: "Belediye",
    npc: "Memur Ahmet",
    emoji: "🏛️",
    aciklama: "Resmi işler, kayıt ve şehir hizmetleri.",
  },
  {
    id: "cafe",
    ad: "Cafe",
    npc: "Barista Selin",
    emoji: "☕",
    aciklama: "Sıcak içecekler ve samimi müşteri ortamı.",
  },
  {
    id: "hastane",
    ad: "Hastane",
    npc: "Hemşire Ayşe",
    emoji: "🏥",
    aciklama: "Sağlık sektöründe düzenli vardiyalar.",
  },
  {
    id: "restoran",
    ad: "Restoran",
    npc: "Şef Mehmet",
    emoji: "🍽️",
    aciklama: "Mutfak ve salon hizmetleri.",
  },
  {
    id: "fastfood",
    ad: "Fast Food",
    npc: "Müdür Can",
    emoji: "🍔",
    aciklama: "Hızlı servis, yoğun tempo.",
  },
];

/** Başlangıç yeteneği 8 — her işyerinde en az 1 giriş pozisyonu req ≤ 8 */
const MESLEKLER = [
  {
    id: "belediye_temizlik",
    isyeriId: "belediye",
    unvan: "Temizlik Görevlisi",
    mulakatGorsel: "belediye-temizlik-mulakat",
    seviye: "giris",
    gunlukGelir: 1500,
    yetenekKazanc: { dayaniklilik: 1 },
    gereksinim: { guc: 6, dayaniklilik: 5 },
  },
  {
    id: "belediye_kayit",
    isyeriId: "belediye",
    unvan: "Kayıt Memuru",
    mulakatGorsel: "belediye-temizlik-mulakat",
    seviye: "orta",
    gunlukGelir: 2800,
    yetenekKazanc: { zeka: 1 },
    gereksinim: { zeka: 12, beceri: 8 },
  },
  {
    id: "belediye_sef",
    isyeriId: "belediye",
    unvan: "Şube Şefi",
    mulakatGorsel: "belediye-temizlik-mulakat",
    seviye: "ileri",
    gunlukGelir: 4200,
    yetenekKazanc: { zeka: 2 },
    gereksinim: { zeka: 18, beceri: 14, dayaniklilik: 10 },
  },
  {
    id: "cafe_stajyer",
    isyeriId: "cafe",
    unvan: "Stajyer Garson",
    mulakatGorsel: "cafe-mulakat",
    seviye: "giris",
    gunlukGelir: 1400,
    yetenekKazanc: { beceri: 1 },
    gereksinim: { beceri: 5, dayaniklilik: 5 },
  },
  {
    id: "cafe_garson",
    isyeriId: "cafe",
    unvan: "Garson",
    mulakatGorsel: "cafe-mulakat",
    seviye: "orta",
    gunlukGelir: 2200,
    yetenekKazanc: { beceri: 1 },
    gereksinim: { beceri: 10, dayaniklilik: 8 },
  },
  {
    id: "cafe_barista",
    isyeriId: "cafe",
    unvan: "Barista",
    mulakatGorsel: "cafe-mulakat",
    seviye: "ileri",
    gunlukGelir: 3200,
    yetenekKazanc: { beceri: 1, zeka: 1 },
    gereksinim: { beceri: 16, zeka: 12 },
  },
  {
    id: "hastane_hizmetli",
    isyeriId: "hastane",
    unvan: "Hizmetli",
    mulakatGorsel: "hastane-mulakat",
    seviye: "giris",
    gunlukGelir: 1600,
    yetenekKazanc: { dayaniklilik: 1 },
    gereksinim: { dayaniklilik: 6, guc: 5 },
  },
  {
    id: "hastane_sekreter",
    isyeriId: "hastane",
    unvan: "Sekreter",
    mulakatGorsel: "hastane-mulakat",
    seviye: "orta",
    gunlukGelir: 2600,
    yetenekKazanc: { zeka: 1 },
    gereksinim: { zeka: 12, beceri: 8 },
  },
  {
    id: "hastane_hemsire",
    isyeriId: "hastane",
    unvan: "Hemşire Yardımcısı",
    mulakatGorsel: "hastane-mulakat",
    seviye: "ileri",
    gunlukGelir: 3800,
    yetenekKazanc: { zeka: 1, dayaniklilik: 1 },
    gereksinim: { zeka: 16, dayaniklilik: 14, beceri: 10 },
  },
  {
    id: "restoran_bulasik",
    isyeriId: "restoran",
    unvan: "Bulaşıkçı",
    mulakatGorsel: "restoran-mulakat",
    seviye: "giris",
    gunlukGelir: 1450,
    yetenekKazanc: { dayaniklilik: 1 },
    gereksinim: { dayaniklilik: 5, guc: 5 },
  },
  {
    id: "restoran_garson",
    isyeriId: "restoran",
    unvan: "Garson",
    mulakatGorsel: "restoran-mulakat",
    seviye: "orta",
    gunlukGelir: 2400,
    yetenekKazanc: { beceri: 1 },
    gereksinim: { beceri: 10, zeka: 8 },
  },
  {
    id: "restoran_asci",
    isyeriId: "restoran",
    unvan: "Aşçı Yardımcısı",
    mulakatGorsel: "restoran-mulakat",
    seviye: "ileri",
    gunlukGelir: 3000,
    yetenekKazanc: { beceri: 1, guc: 1 },
    gereksinim: { beceri: 14, dayaniklilik: 10, guc: 8 },
  },
  {
    id: "fastfood_kasiyer",
    isyeriId: "fastfood",
    unvan: "Kasiyer",
    mulakatGorsel: "fastfood-mulakat",
    seviye: "giris",
    gunlukGelir: 1500,
    yetenekKazanc: { zeka: 1 },
    gereksinim: { zeka: 6, beceri: 5 },
  },
  {
    id: "fastfood_mutfak",
    isyeriId: "fastfood",
    unvan: "Mutfak Elemanı",
    mulakatGorsel: "fastfood-mulakat",
    seviye: "orta",
    gunlukGelir: 2100,
    yetenekKazanc: { beceri: 1 },
    gereksinim: { beceri: 9, dayaniklilik: 8 },
  },
  {
    id: "fastfood_vardiya",
    isyeriId: "fastfood",
    unvan: "Vardiya Şefi",
    mulakatGorsel: "fastfood-mulakat",
    seviye: "ileri",
    gunlukGelir: 2900,
    yetenekKazanc: { zeka: 1, dayaniklilik: 1 },
    gereksinim: { zeka: 14, beceri: 12, dayaniklilik: 10 },
  },
];

const MAX_GUNLUK_TELAFI = 7;

function isyeriBul(id) {
  return ISYERLERI.find((i) => i.id === id) || null;
}

function meslekBul(id) {
  return MESLEKLER.find((m) => m.id === id) || null;
}

function isyeriMeslekleri(isyeriId) {
  return MESLEKLER.filter((m) => m.isyeriId === isyeriId);
}

function mulakatSorulari(meslek) {
  if (!meslek || !meslek.gereksinim) return [];
  return Object.keys(meslek.gereksinim).map((key) => ({
    yetenek: key,
    etiket: YETENEK_ETIKET[key] || key,
    soru: YETENEK_SORULAR[key] || `${YETENEK_ETIKET[key] || key} yeterli mi?`,
    min: meslek.gereksinim[key],
  }));
}

module.exports = {
  YETENEK_ETIKET,
  YETENEK_SORULAR,
  ISYERLERI,
  MESLEKLER,
  BASLANGIC_YETENEK,
  MAX_GUNLUK_TELAFI,
  isyeriBul,
  meslekBul,
  isyeriMeslekleri,
  mulakatSorulari,
};
