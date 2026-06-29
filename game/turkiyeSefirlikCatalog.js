/** Türkiye Sefirliği — oynanabilir şehirler (harita konumu % olarak) */
const SEHIRLER = [
  { id: "istanbul", ad: "İstanbul", tier: 3, x: 22, y: 26, kontrolMaliyet: 100_000, ihaleMin: 250_000, kontrolKazanc: 6 },
  { id: "ankara", ad: "Ankara", tier: 3, x: 44, y: 34, kontrolMaliyet: 100_000, ihaleMin: 250_000, kontrolKazanc: 6 },
  { id: "izmir", ad: "İzmir", tier: 3, x: 10, y: 38, kontrolMaliyet: 100_000, ihaleMin: 250_000, kontrolKazanc: 6 },
  { id: "bursa", ad: "Bursa", tier: 2, x: 18, y: 30, kontrolMaliyet: 50_000, ihaleMin: 100_000, kontrolKazanc: 8 },
  { id: "antalya", ad: "Antalya", tier: 2, x: 26, y: 54, kontrolMaliyet: 50_000, ihaleMin: 100_000, kontrolKazanc: 8 },
  { id: "adana", ad: "Adana", tier: 2, x: 50, y: 52, kontrolMaliyet: 50_000, ihaleMin: 100_000, kontrolKazanc: 8 },
  { id: "gaziantep", ad: "Gaziantep", tier: 2, x: 58, y: 48, kontrolMaliyet: 50_000, ihaleMin: 100_000, kontrolKazanc: 8 },
  { id: "konya", ad: "Konya", tier: 2, x: 36, y: 44, kontrolMaliyet: 50_000, ihaleMin: 100_000, kontrolKazanc: 8 },
  { id: "diyarbakir", ad: "Diyarbakır", tier: 2, x: 72, y: 42, kontrolMaliyet: 50_000, ihaleMin: 100_000, kontrolKazanc: 8 },
  { id: "trabzon", ad: "Trabzon", tier: 1, x: 58, y: 18, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "samsun", ad: "Samsun", tier: 1, x: 48, y: 22, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "erzurum", ad: "Erzurum", tier: 1, x: 70, y: 28, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "eskisehir", ad: "Eskişehir", tier: 1, x: 28, y: 32, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "kayseri", ad: "Kayseri", tier: 1, x: 50, y: 38, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "mersin", ad: "Mersin", tier: 1, x: 44, y: 58, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "mugla", ad: "Muğla", tier: 1, x: 14, y: 48, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "tekirdag", ad: "Tekirdağ", tier: 1, x: 12, y: 22, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
  { id: "van", ad: "Van", tier: 1, x: 84, y: 38, kontrolMaliyet: 25_000, ihaleMin: 50_000, kontrolKazanc: 10 },
];

const TIER_ETIKET = {
  1: "Bölgesel",
  2: "Büyükşehir",
  3: "Stratejik (Mafya)",
};

const SAHIP_ESIK = 100;
const LIDER_ESIK = 51;
const KONTROL_COOLDOWN_SEC = 30 * 60;
const SALDIRI_KONTROL_KAZANC = 12;

function sehirBul(id) {
  return SEHIRLER.find((s) => s.id === id) || null;
}

module.exports = {
  SEHIRLER,
  TIER_ETIKET,
  SAHIP_ESIK,
  LIDER_ESIK,
  KONTROL_COOLDOWN_SEC,
  SALDIRI_KONTROL_KAZANC,
  sehirBul,
};
