/** Günlük görev havuzu — sunucu tek kaynak (spesifikasyon v1) */
const { HIRE } = require("./catalog");

const MAHALLE_ISLERI = ["market", "tamirhane", "esnafa_guvence", "zar_salonu"];
const SEMT_ISLERI = ["gece_kulubu", "kumarhane_agi", "kara_para", "semt_galeri"];
const SEHIR_ISLERI = ["lojistik", "gumruk", "belediye", "buyuk_holding"];

const YUKSEK_ESYA_MIN_MALIYET = 8000;

const GOREV_HAVUZU = {
  K1: {
    id: "K1",
    ad: "Rakibe saldırıp kazan",
    tur: "saldiri",
    zorluk: "kolay",
    hedefAdet: 3,
    odul: { puan: 30, icraat: 2, kasa: 1500 },
    sureAlabilir: true,
  },
  K2: {
    id: "K2",
    ad: "Mahalle işi tamamla",
    tur: "is_mahalle",
    zorluk: "kolay",
    hedefAdet: 2,
    odul: { puan: 20, icraat: 0, kasa: 1000 },
    sureAlabilir: true,
  },
  K3: {
    id: "K3",
    ad: "Güçlen'den eşya satın al",
    tur: "esya",
    zorluk: "kolay",
    hedefAdet: 1,
    odul: { puan: 15, icraat: 0, kasa: 800 },
    sureAlabilir: true,
  },
  K4: {
    id: "K4",
    ad: "Sektörden alım yap",
    tur: "sektor",
    zorluk: "kolay",
    hedefAdet: 1,
    odul: { puan: 10, icraat: 0, kasa: 600 },
    sureAlabilir: true,
  },
  K5: {
    id: "K5",
    ad: "İstihbarat ile rakip gücünü öğren (başarılı)",
    tur: "istihbarat",
    zorluk: "kolay",
    hedefAdet: 1,
    odul: { puan: 20, icraat: 0, kasa: 1200 },
    sureAlabilir: false,
  },
  K6: {
    id: "K6",
    ad: "Mafya işi tamamla",
    tur: "mafya_isi",
    zorluk: "kolay",
    hedefAdet: 1,
    odul: { puan: 15, icraat: 0, kasa: 1000 },
    sureAlabilir: false,
  },
  O1: {
    id: "O1",
    ad: "Rakibe saldırıp kazan",
    tur: "saldiri",
    zorluk: "orta",
    hedefAdet: 7,
    odul: { puan: 75, icraat: 5, kasa: 4000 },
    sureAlabilir: true,
  },
  O2: {
    id: "O2",
    ad: "Mahalle/Semt işi tamamla (karışık)",
    tur: "is_mahalle_semt",
    zorluk: "orta",
    hedefAdet: 5,
    odul: { puan: 60, icraat: 0, kasa: 3500 },
    sureAlabilir: true,
  },
  O3: {
    id: "O3",
    ad: "Güçlen'den eşya satın al",
    tur: "esya",
    zorluk: "orta",
    hedefAdet: 3,
    odul: { puan: 50, icraat: 0, kasa: 3000 },
    sureAlabilir: true,
  },
  O4: {
    id: "O4",
    ad: "Sektörden alım yap",
    tur: "sektor",
    zorluk: "orta",
    hedefAdet: 2,
    odul: { puan: 35, icraat: 0, kasa: 2000 },
    sureAlabilir: true,
  },
  O5: {
    id: "O5",
    ad: "Farklı 3 rakibe saldır (aynı kişiye değil)",
    tur: "saldiri_farkli",
    zorluk: "orta",
    hedefAdet: 3,
    odul: { puan: 40, icraat: 0, kasa: 2500 },
    sureAlabilir: true,
  },
  O6: {
    id: "O6",
    ad: "İstihbarat ile rakip gücünü öğren (başarılı)",
    tur: "istihbarat",
    zorluk: "orta",
    hedefAdet: 3,
    odul: { puan: 60, icraat: 0, kasa: 3500 },
    sureAlabilir: false,
  },
  O7: {
    id: "O7",
    ad: "Mafya işi tamamla",
    tur: "mafya_isi",
    zorluk: "orta",
    hedefAdet: 3,
    odul: { puan: 55, icraat: 0, kasa: 3000 },
    sureAlabilir: false,
  },
  Z1: {
    id: "Z1",
    ad: "Rakibe saldırıp kazan",
    tur: "saldiri",
    zorluk: "zor",
    hedefAdet: 15,
    odul: { puan: 200, icraat: 10, kasa: 12000 },
    sureAlabilir: true,
  },
  Z2: {
    id: "Z2",
    ad: "Şehir işi tamamla",
    tur: "is_sehir",
    zorluk: "zor",
    hedefAdet: 1,
    odul: { puan: 150, icraat: 0, kasa: 10000 },
    sureAlabilir: true,
  },
  Z3: {
    id: "Z3",
    ad: "Semt işi tamamla",
    tur: "is_semt",
    zorluk: "zor",
    hedefAdet: 3,
    odul: { puan: 120, icraat: 0, kasa: 8000 },
    sureAlabilir: true,
  },
  Z4: {
    id: "Z4",
    ad: "Güçlen'den eşya satın al (yüksek seviye)",
    tur: "esya_yuksek",
    zorluk: "zor",
    hedefAdet: 5,
    odul: { puan: 180, icraat: 0, kasa: 9000 },
    sureAlabilir: true,
  },
  Z5: {
    id: "Z5",
    ad: "Sektörden alım yap",
    tur: "sektor",
    zorluk: "zor",
    hedefAdet: 4,
    odul: { puan: 100, icraat: 0, kasa: 6000 },
    sureAlabilir: true,
  },
  Z6: {
    id: "Z6",
    ad: "İstihbarat ile rakip gücünü öğren (başarılı)",
    tur: "istihbarat",
    zorluk: "zor",
    hedefAdet: 5,
    odul: { puan: 150, icraat: 0, kasa: 9000 },
    sureAlabilir: false,
  },
  Z7: {
    id: "Z7",
    ad: "Mafya işi tamamla",
    tur: "mafya_isi",
    zorluk: "zor",
    hedefAdet: 6,
    odul: { puan: 160, icraat: 0, kasa: 9500 },
    sureAlabilir: false,
  },
};

const ZORLUK_HAVUZLARI = {
  kolay: ["K1", "K2", "K3", "K4", "K5", "K6"],
  orta: ["O1", "O2", "O3", "O4", "O5", "O6", "O7"],
  zor: ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"],
};

const GUNLUK_SLOT_SAYISI = 10;
const MAX_KABUL = 3;
const GUNLUK_DAGILIM = { kolay: 5, orta: 3, zor: 2 };

/** Yeni oyuncu varsayılan saygınlığı (players.puan DEFAULT 1500) */
const REFERANS_SAYGINLIK = 1500;
const SAYGINLIK_KATSAYI_MIN = 0.6;
const SAYGINLIK_KATSAYI_MAX = 3.5;

function sayginlikKatsayiHesapla(puan) {
  const p = Math.max(0, Number(puan) || 0);
  const ham = p / REFERANS_SAYGINLIK;
  const k = Math.sqrt(ham);
  return Math.min(SAYGINLIK_KATSAYI_MAX, Math.max(SAYGINLIK_KATSAYI_MIN, k));
}

function gunlukDagilimHesapla(puan) {
  const k = sayginlikKatsayiHesapla(puan);
  if (k >= 2) return { kolay: 3, orta: 4, zor: 3 };
  if (k >= 1.4) return { kolay: 4, orta: 4, zor: 2 };
  if (k < 0.85) return { kolay: 6, orta: 3, zor: 1 };
  return { ...GUNLUK_DAGILIM };
}

function gorevOlcekle(def, puan) {
  const katsayi = sayginlikKatsayiHesapla(puan);
  const hedefAdet = Math.max(1, Math.round(def.hedefAdet * katsayi));
  return {
    katsayi,
    hedefAdet,
    odul: {
      puan: Math.round((def.odul.puan || 0) * katsayi),
      icraat: Math.max(0, Math.round((def.odul.icraat || 0) * katsayi)),
      kasa: Math.round((def.odul.kasa || 0) * katsayi),
    },
  };
}

function gorevBul(id) {
  return GOREV_HAVUZU[id] || null;
}

function isMahalleIsi(jobKey) {
  return MAHALLE_ISLERI.includes(jobKey);
}

function isSemtIsi(jobKey) {
  return SEMT_ISLERI.includes(jobKey);
}

function isSehirIsi(jobKey) {
  return SEHIR_ISLERI.includes(jobKey);
}

function esyaYuksekSeviye(hireKey) {
  const h = HIRE[hireKey];
  return !!(h && h.maliyet >= YUKSEK_ESYA_MIN_MALIYET);
}

function rastgeleSec(pool, adet) {
  const kopya = [...pool];
  const secilen = [];
  for (let i = 0; i < adet && kopya.length; i++) {
    const idx = Math.floor(Math.random() * kopya.length);
    secilen.push(kopya.splice(idx, 1)[0]);
  }
  return secilen;
}

function gunlukGorevSecimi(puan) {
  const dagilim = gunlukDagilimHesapla(puan);
  const ids = [
    ...rastgeleSec(ZORLUK_HAVUZLARI.kolay, dagilim.kolay),
    ...rastgeleSec(ZORLUK_HAVUZLARI.orta, dagilim.orta),
    ...rastgeleSec(ZORLUK_HAVUZLARI.zor, dagilim.zor),
  ];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function odulMetni(odul) {
  const parcalar = [];
  if (odul.puan) parcalar.push(`${odul.puan} Saygınlık`);
  if (odul.icraat) parcalar.push(`${odul.icraat} İcraat`);
  if (odul.kasa) parcalar.push(`${odul.kasa.toLocaleString("tr-TR")}₺`);
  return parcalar.join(" + ") || "—";
}

module.exports = {
  GOREV_HAVUZU,
  GUNLUK_SLOT_SAYISI,
  MAX_KABUL,
  REFERANS_SAYGINLIK,
  gorevBul,
  gunlukGorevSecimi,
  gunlukDagilimHesapla,
  sayginlikKatsayiHesapla,
  gorevOlcekle,
  odulMetni,
  isMahalleIsi,
  isSemtIsi,
  isSehirIsi,
  esyaYuksekSeviye,
};
