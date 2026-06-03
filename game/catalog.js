/** Sunucu tarafı oyun tanımları — istemci değerleri güvenilmez, burası tek kaynak. */
const HIRE = {
  delikanli: { unvan: "Mahalle Delikanlısı", maliyet: 500, guc: 50 },
  bodyguard: { unvan: "BodyGuard", maliyet: 2000, guc: 250 },
  profesyonel: { unvan: "Profesyonel Koruma", maliyet: 8000, guc: 1100 },
  harekat: { unvan: "Özel Harekat Emeklisi", maliyet: 30000, guc: 4500 },
  tabanca: { unvan: "Baretta Tabanca", maliyet: 1200, guc: 100 },
  pompali: { unvan: "Taktik Pompalı", maliyet: 4500, guc: 450 },
  ak47: { unvan: "AK-47 Keleş", maliyet: 15000, guc: 1800 },
  agir_silah: { unvan: "Görünmez Gölge Kasası", maliyet: 45000, guc: 6000 },
  sniper: { unvan: "AWM Keskin Nişancı", maliyet: 55000, guc: 7500 },
  saat: { unvan: "Lüks Kol Saati", maliyet: 15000, guc: 2500 },
  motorsiklet: { unvan: "Özel Motorsiklet", maliyet: 75000, guc: 15000 },
  araba: { unvan: "İtalyan Spor Araba", maliyet: 350000, guc: 80000 },
  yat: { unvan: "Süper Lüks Yat", maliyet: 2500000, guc: 600000 },
  helikopter: { unvan: "Özel Helikopter", maliyet: 8000000, guc: 2000000 },
  jet: { unvan: "Özel Jet", maliyet: 45000000, guc: 10000000 },
};

const JOBS = {
  market: {
    isAdi: "Köşedeki Marketi Haraca Bağla",
    netKazanc: 800,
    puan: 5,
    icraat: 1,
    minGuc: 300,
    gorselKey: "market",
  },
  tamirhane: {
    isAdi: "Kaçak Otomobil Tamirhanesi",
    netKazanc: 1500,
    puan: 10,
    icraat: 1,
    minGuc: 600,
    gorselKey: "tamirhane",
  },
  esnafa_guvence: {
    isAdi: "Esnafa Güvence Sağlama",
    netKazanc: 2800,
    puan: 15,
    icraat: 2,
    minGuc: 1200,
    gorselKey: "koruma",
  },
  zar_salonu: {
    isAdi: "Yeraltı Zar Salonu",
    netKazanc: 4500,
    puan: 25,
    icraat: 2,
    minGuc: 2500,
    gorselKey: "kumarhane",
  },
  gece_kulubu: {
    isAdi: "Lüks Gece Kulübü Güvenliği",
    netKazanc: 12000,
    puan: 60,
    icraat: 3,
    minGuc: 6000,
    gorselKey: "gece_kulubu",
  },
  kumarhane_agi: {
    isAdi: "Kumarhane Ağı",
    netKazanc: 18000,
    puan: 80,
    icraat: 3,
    minGuc: 8000,
    gorselKey: "kumarhane_agi",
  },
  kara_para: {
    isAdi: "Kara Para Aklama",
    netKazanc: 25000,
    puan: 100,
    icraat: 4,
    minGuc: 10000,
    gorselKey: "kara_para",
  },
  semt_galeri: {
    isAdi: "Semt Galerisine Çök",
    netKazanc: 32000,
    puan: 120,
    icraat: 4,
    minGuc: 12000,
    gorselKey: "galeri",
  },
  lojistik: {
    isAdi: "Lojistik İhalesi",
    netKazanc: 45000,
    puan: 150,
    icraat: 5,
    minGuc: 15000,
    gorselKey: "lojistik",
  },
  gumruk: {
    isAdi: "Gümrük Müdürünü Satın Al",
    netKazanc: 80000,
    puan: 200,
    icraat: 6,
    minGuc: 25000,
    gorselKey: "gumruk",
  },
  belediye: {
    isAdi: "Belediye İhalesi",
    netKazanc: 120000,
    puan: 300,
    icraat: 8,
    minGuc: 40000,
    gorselKey: "belediye",
  },
  buyuk_holding: {
    isAdi: "Büyük Holdinge Güvence Sağla",
    netKazanc: 200000,
    puan: 400,
    icraat: 10,
    minGuc: 55000,
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

const ICRAAT_MAX = 25;
const ICRAAT_REGEN_SEC = 144;

module.exports = { HIRE, JOBS, LIMAN_BILGI, COUNCIL, ICRAAT_MAX, ICRAAT_REGEN_SEC };
