/** Yetenek (çalışma stat) sistemi — katalog ve formüller (üst sınır yok) */

const {
  ZORLUK_ORANI,
  ANTRENMAN_MIN_MALIYET,
  ANTRENMAN_BAZ_MALIYET,
  ANTRENMAN_STAT_CARPAN,
  ANTRENMAN_YUKSEK_ESIK,
  ANTRENMAN_YUKSEK_CARPAN,
  GUNLUK_ANTRENMAN_LIMIT,
} = require("./ekonomiConstants");

const YETENEK_ANAHTARLAR = ["guc", "zeka", "dayaniklilik", "beceri"];

const YETENEK_ETIKET = {
  guc: "Güç",
  zeka: "Zeka",
  dayaniklilik: "Dayanıklılık",
  beceri: "Beceri",
};

const YETENEK_TANIM = {
  guc: {
    emoji: "💪",
    aciklama: "Fiziksel iş, taşıma ve zorlu saha görevleri.",
  },
  zeka: {
    emoji: "🧠",
    aciklama: "Planlama, kayıt, muhasebe ve hızlı karar verme.",
  },
  dayaniklilik: {
    emoji: "🛡️",
    aciklama: "Uzun vardiya, yorucu tempo ve baskı altında dayanıklılık.",
  },
  beceri: {
    emoji: "🎯",
    aciklama: "El becerisi, servis kalitesi ve işine özen.",
  },
};

/** Yeni oyuncu — giriş seviyesi işlere uygun */
const BASLANGIC_YETENEK = 8;

/** Her antrenman +1 stat */
const ANTRENMAN_KAZANC = 1;

/** Son kademe min değerinden sonra her 50 puan yeni “blok” sayılır (ilerleme çubuğu) */
const MIT_KADEME_BLOK = 50;

const YETENEK_KADEMELER = [
  { min: 0, max: 10, ad: "Acemi", emoji: "🌱" },
  { min: 11, max: 20, ad: "Deneyimli", emoji: "📘" },
  { min: 21, max: 35, ad: "Usta", emoji: "⭐" },
  { min: 36, max: 50, ad: "Uzman", emoji: "🏅" },
  { min: 51, max: 75, ad: "Efsane", emoji: "👑" },
  { min: 76, max: 100, ad: "Grandmaster", emoji: "💎" },
  { min: 101, max: 150, ad: "Efsanevi", emoji: "🔥" },
  { min: 151, max: 999999, ad: "Mit", emoji: "⚡" },
];

function yetenekNormalize(deger) {
  return Math.max(0, Math.floor(deger || 0));
}

function yetenekleriNormalize(yetenekler) {
  const out = {};
  for (const key of YETENEK_ANAHTARLAR) {
    out[key] = yetenekNormalize(yetenekler?.[key]);
  }
  return out;
}

function yetenekKademe(deger) {
  const v = yetenekNormalize(deger);
  return (
    YETENEK_KADEMELER.find((k) => v >= k.min && v <= k.max) ||
    YETENEK_KADEMELER[YETENEK_KADEMELER.length - 1]
  );
}

function yetenekKademeDetay(deger) {
  const v = yetenekNormalize(deger);
  const kademe = yetenekKademe(v);
  const sonrakiIdx = YETENEK_KADEMELER.findIndex((k) => k.min > v);
  const sonrakiKademe = sonrakiIdx >= 0 ? YETENEK_KADEMELER[sonrakiIdx] : null;
  const ustSinir = sonrakiKademe ? sonrakiKademe.min - 1 : null;

  let yuzde;
  if (ustSinir == null) {
    const blokPos = (v - kademe.min) % MIT_KADEME_BLOK;
    yuzde = Math.round((blokPos / MIT_KADEME_BLOK) * 100);
  } else if (ustSinir <= kademe.min) {
    yuzde = 100;
  } else {
    yuzde = Math.min(100, Math.round(((v - kademe.min) / (ustSinir - kademe.min + 1)) * 100));
  }

  return {
    kademe,
    yuzde,
    sonrakiEsik: sonrakiKademe ? sonrakiKademe.min : null,
    sonrakiKademeAd: sonrakiKademe ? sonrakiKademe.ad : null,
  };
}

function antrenmanMaliyet(mevcutStat) {
  const s = yetenekNormalize(mevcutStat);
  const linear = ANTRENMAN_BAZ_MALIYET + s * ANTRENMAN_STAT_CARPAN;
  const yuksek =
    s > ANTRENMAN_YUKSEK_ESIK
      ? Math.floor((s - ANTRENMAN_YUKSEK_ESIK) ** 2 * ANTRENMAN_YUKSEK_CARPAN)
      : 0;
  return Math.max(ANTRENMAN_MIN_MALIYET, linear + yuksek);
}

function yetenekOzeti(yetenekler) {
  const y = yetenekleriNormalize(yetenekler);
  const statlar = YETENEK_ANAHTARLAR.map((key) => {
    const deger = y[key];
    const detay = yetenekKademeDetay(deger);
    return {
      key,
      ad: YETENEK_ETIKET[key],
      emoji: YETENEK_TANIM[key]?.emoji || "📊",
      aciklama: YETENEK_TANIM[key]?.aciklama || "",
      deger,
      yuzde: detay.yuzde,
      kademe: detay.kademe.ad,
      kademeEmoji: detay.kademe.emoji,
      sonrakiEsik: detay.sonrakiEsik,
      sonrakiKademeAd: detay.sonrakiKademeAd,
      antrenmanMaliyet: antrenmanMaliyet(deger),
    };
  });
  const toplam = statlar.reduce((s, x) => s + x.deger, 0);
  const ortalama = Math.round(toplam / YETENEK_ANAHTARLAR.length);
  const genelDetay = yetenekKademeDetay(ortalama);
  return {
    statlar,
    toplam,
    ortalama,
    kademe: genelDetay.kademe,
    baslangic: BASLANGIC_YETENEK,
    sinirsiz: true,
  };
}

module.exports = {
  YETENEK_ANAHTARLAR,
  YETENEK_ETIKET,
  YETENEK_TANIM,
  BASLANGIC_YETENEK,
  GUNLUK_ANTRENMAN_LIMIT,
  ANTRENMAN_MIN_MALIYET,
  ANTRENMAN_BAZ_MALIYET,
  ANTRENMAN_STAT_CARPAN,
  ANTRENMAN_KAZANC,
  ZORLUK_ORANI,
  YETENEK_KADEMELER,
  MIT_KADEME_BLOK,
  yetenekNormalize,
  yetenekleriNormalize,
  yetenekKademe,
  yetenekKademeDetay,
  antrenmanMaliyet,
  yetenekOzeti,
};
