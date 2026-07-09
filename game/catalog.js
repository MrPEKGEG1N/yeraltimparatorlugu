/** Sunucu tarafı oyun tanımları — istemci değerleri güvenilmez, burası tek kaynak. */
const HIRE = {
  delikanli: { unvan: "Mahalle Delikanlısı", maliyet: 500, guc: 50 },
  bodyguard: { unvan: "BodyGuard", maliyet: 2000, guc: 185 },
  profesyonel: { unvan: "Profesyonel Koruma", maliyet: 8000, guc: 690 },
  harekat: { unvan: "Özel Harekat Emeklisi", maliyet: 30000, guc: 2430 },
  tabanca: { unvan: "Baretta Tabanca", maliyet: 1200, guc: 115 },
  pompali: { unvan: "Taktik Pompalı", maliyet: 4500, guc: 400 },
  ak47: { unvan: "AK-47 Keleş", maliyet: 15000, guc: 1260 },
  agir_silah: { unvan: "Görünmez Gölge Kasası", maliyet: 45000, guc: 3570 },
  sniper: { unvan: "AWM Keskin Nişancı", maliyet: 55000, guc: 4320 },
  saat: { unvan: "Lüks Kol Saati", maliyet: 15000, guc: 1260 },
  motorsiklet: { unvan: "Özel Motorsiklet", maliyet: 75000, guc: 5790 },
  araba: { unvan: "İtalyan Spor Araba", maliyet: 350000, guc: 25000 },
  yat: { unvan: "Süper Lüks Yat", maliyet: 2500000, guc: 161000 },
  helikopter: { unvan: "Özel Helikopter", maliyet: 8000000, guc: 486000 },
  jet: { unvan: "Özel Jet", maliyet: 45000000, guc: 2500000 },
};

const JOBS = {
  market: {
    isAdi: "Köşedeki Marketi Haraca Bağla",
    netKazanc: 800,
    puan: 1,
    icraat: 1,
    minGuc: 300,
    gorselKey: "market",
  },
  tamirhane: {
    isAdi: "Kaçak Otomobil Tamirhanesi",
    netKazanc: 950,
    puan: 2,
    icraat: 1,
    minGuc: 580,
    gorselKey: "tamirhane",
  },
  esnafa_guvence: {
    isAdi: "Esnafa Güvence Sağlama",
    netKazanc: 2200,
    puan: 4,
    icraat: 2,
    minGuc: 1110,
    gorselKey: "koruma",
  },
  zar_salonu: {
    isAdi: "Yeraltı Zar Salonu",
    netKazanc: 2600,
    puan: 6,
    icraat: 2,
    minGuc: 2135,
    gorselKey: "kumarhane",
  },
  gece_kulubu: {
    isAdi: "Lüks Gece Kulübü Güvenliği",
    netKazanc: 4600,
    puan: 9,
    icraat: 3,
    minGuc: 4106,
    gorselKey: "gece_kulubu",
  },
  kumarhane_agi: {
    isAdi: "Kumarhane Ağı",
    netKazanc: 5400,
    puan: 14,
    icraat: 3,
    minGuc: 7899,
    gorselKey: "kumarhane_agi",
  },
  kara_para: {
    isAdi: "Kara Para Aklama",
    netKazanc: 8500,
    puan: 21,
    icraat: 4,
    minGuc: 15193,
    gorselKey: "kara_para",
  },
  semt_galeri: {
    isAdi: "Semt Galerisine Çök",
    netKazanc: 10000,
    puan: 33,
    icraat: 4,
    minGuc: 29223,
    gorselKey: "galeri",
  },
  lojistik: {
    isAdi: "Lojistik İhalesi",
    netKazanc: 14700,
    puan: 51,
    icraat: 5,
    minGuc: 56209,
    gorselKey: "lojistik",
  },
  gumruk: {
    isAdi: "Gümrük Müdürünü Satın Al",
    netKazanc: 20800,
    puan: 79,
    icraat: 6,
    minGuc: 108116,
    gorselKey: "gumruk",
  },
  belediye: {
    isAdi: "Belediye İhalesi",
    netKazanc: 32700,
    puan: 90,
    icraat: 8,
    minGuc: 207958,
    gorselKey: "belediye",
  },
  buyuk_holding: {
    isAdi: "Büyük Holdinge Güvence Sağla",
    netKazanc: 48000,
    puan: 100,
    icraat: 10,
    minGuc: 400000,
    gorselKey: "holding",
  },
};

const LIMAN_BILGI = {
  istanbul: {
    ad: "İstanbul Limanı",
    aciklama: "Boğazın altın kapısı; konteyner ve kaçak yükün kalbi.",
  },
  izmir: {
    ad: "İzmir Limanı",
    aciklama: "Ege'nin ticaret üssü; Avrupa bağlantılı sevkiyat hattı.",
  },
  hatay: {
    ad: "Hatay Limanı",
    aciklama: "Akdeniz çıkışı; sınır ötesi yüklerin gizli rotası.",
  },
};

const COUNCIL = { maliyet: 20000, gucCarpan: 1.3 };

const ICRAAT_MAX = 999999;
const ICRAAT_REGEN_SEC = 3600;
const ICRAAT_SAATLIK_BONUS = 25;

module.exports = { HIRE, JOBS, LIMAN_BILGI, COUNCIL, ICRAAT_MAX, ICRAAT_REGEN_SEC, ICRAAT_SAATLIK_BONUS };
