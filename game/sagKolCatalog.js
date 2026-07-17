/** Sağ Kol — spor salonu eğitimi ve savaş çarpanları */

const { antrenmanMaliyet, YETENEK_ANAHTARLAR, YETENEK_ETIKET, YETENEK_TANIM, ANTRENMAN_KAZANC } = require("./yetenekCatalog");

/** Tüm sağ kol yetenekleri 1'den başlar */
const SAG_KOL_BASLANGIC = 1;

/** Rütbe başına üst sınır; mutlak max Altın sonu */
const SAG_KOL_SEGMENT = 100;
const SAG_KOL_MAX = 400;

/** Oyuncu antrenman maliyetinin 1.5 katı */
const SAG_KOL_MALIYET_CARPAN = 1.5;

/** Seviye atlama (100→101, 200→201, 300→301) maliyet çarpanı — UI'da yazılmaz */
const SAG_KOL_SEVIYE_ATLAMA_CARPAN = 2;

/** Gelişim süresi: 1.5 saat */
const SAG_KOL_ANTRENMAN_SURE_SN = Math.floor(1.5 * 60 * 60);

const SAG_KOL_ICRAAT = 3;
const SAG_KOL_GUNLUK_LIMIT = 4;

/** Sağ kol satın alma bedeli (TL) */
const SAG_KOL_SATIN_AL_FIYAT = 500000;

/** Sağlık: max 150, savaşta −10, hastanede +10 */
const SAG_KOL_SAGLIK_MAX = 150;
const SAG_KOL_SAGLIK_HASAR = 10;
const SAG_KOL_SAGLIK_IYILESME = 10;
/** Yeraltı hastanesi: her +10 için saatlik kazancın %10'u */
const SAG_KOL_HASTANE_MALIYET_ORAN = 0.1;
/** Can 0 (hastanelik): 2,5 saatlik bedelle full çıkış */
const SAG_KOL_HASTANE_FULL_CARPAN = 2.5;
/** V.I.P Yeraltı Hastanesi — elmas */
const SAG_KOL_VIP_IYILESME_ELMAS = 3;
const SAG_KOL_VIP_FULL_ELMAS = 35;

/** Her 10 Güç → Normal Güce +%1 */
const SAG_KOL_GUC_BONUS_PER_10 = 0.01;
/** Her 10 Zekâ → rakip Bonus Gücü −%1.5 */
const SAG_KOL_ZEKA_KESIM_PER_10 = 0.015;
/** Her 10 Beceri → Güvenli Ev bonusuna +%1 */
const SAG_KOL_BECERI_BONUS_PER_10 = 0.01;
/** Her 10 Dayanıklılık → Mafya Evi bonusuna +%1.5 */
const SAG_KOL_DAYANIKLILIK_BONUS_PER_10 = 0.015;

const SAG_KOL_RUTBELER = [
  { id: "demir", ad: "Demir", min: 1, max: 100, icon: "images/sag-kol/rozet/demir.png" },
  { id: "bronz", ad: "Bronz", min: 101, max: 200, icon: "images/sag-kol/rozet/bronz.png" },
  { id: "gumus", ad: "Gümüş", min: 201, max: 300, icon: "images/sag-kol/rozet/gumus.png" },
  { id: "altin", ad: "Altın", min: 301, max: 400, icon: "images/sag-kol/rozet/altin.png" },
];

function sagKolRutbeSirasi(rutbeId) {
  const idx = SAG_KOL_RUTBELER.findIndex((r) => r.id === rutbeId);
  return idx >= 0 ? idx : 0;
}

function sagKolAntrenmanMaliyet(mevcutStat) {
  return Math.floor(antrenmanMaliyet(mevcutStat) * SAG_KOL_MALIYET_CARPAN);
}

function sagKolNormalize(deger) {
  const n = Math.floor(Number(deger) || SAG_KOL_BASLANGIC);
  return Math.max(SAG_KOL_BASLANGIC, Math.min(SAG_KOL_MAX, n));
}

function sagKolYetenekleriNormalize(raw) {
  const out = {};
  for (const key of YETENEK_ANAHTARLAR) {
    const v = raw?.[key];
    out[key] = v == null || v === "" ? SAG_KOL_BASLANGIC : sagKolNormalize(v);
  }
  return out;
}

function sagKolRutbeFromDeger(deger) {
  const v = sagKolNormalize(deger);
  for (let i = SAG_KOL_RUTBELER.length - 1; i >= 0; i--) {
    if (v >= SAG_KOL_RUTBELER[i].min) return SAG_KOL_RUTBELER[i];
  }
  return SAG_KOL_RUTBELER[0];
}

/** Genel rütbe: en düşük yeteneğe göre (başlangıç Demir) */
function sagKolGenelRutbe(yetenekler) {
  const y = sagKolYetenekleriNormalize(yetenekler);
  const min = Math.min(...YETENEK_ANAHTARLAR.map((k) => y[k]));
  return sagKolRutbeFromDeger(min);
}

function sagKolSeviyeAtlamaMi(mevcutStat) {
  const v = sagKolNormalize(mevcutStat);
  return v === 100 || v === 200 || v === 300;
}

function sagKolMaxaUlastiMi(mevcutStat) {
  return sagKolNormalize(mevcutStat) >= SAG_KOL_MAX;
}

/** Antrenman TL maliyeti — seviye atlamada x2 (oyuncuya çarpan yazılmaz) */
function sagKolAntrenmanMaliyetTam(mevcutStat) {
  if (sagKolMaxaUlastiMi(mevcutStat)) return null;
  const base = sagKolAntrenmanMaliyet(mevcutStat);
  if (sagKolSeviyeAtlamaMi(mevcutStat)) {
    return base * SAG_KOL_SEVIYE_ATLAMA_CARPAN;
  }
  return base;
}

function sagKolStatIlerleme(deger) {
  const v = sagKolNormalize(deger);
  const rutbe = sagKolRutbeFromDeger(v);
  const segmentIdx = Math.min(SAG_KOL_RUTBELER.length - 1, Math.floor((v - 1) / SAG_KOL_SEGMENT));
  const segmentBase = segmentIdx * SAG_KOL_SEGMENT;
  const pos = Math.max(1, Math.min(SAG_KOL_SEGMENT, v - segmentBase));
  const yuzde = Math.min(100, Math.round((pos / SAG_KOL_SEGMENT) * 100));
  const seviyeAtlamaHazir = sagKolSeviyeAtlamaMi(v);
  const maxaUlasti = sagKolMaxaUlastiMi(v);
  const sonrakiRutbe =
    seviyeAtlamaHazir && segmentIdx + 1 < SAG_KOL_RUTBELER.length
      ? SAG_KOL_RUTBELER[segmentIdx + 1]
      : null;
  return {
    deger: v,
    yuzde,
    rutbe,
    rutbeId: rutbe.id,
    rutbeAd: rutbe.ad,
    seviyeAtlamaHazir,
    maxaUlasti,
    sonrakiRutbeAd: sonrakiRutbe ? sonrakiRutbe.ad : null,
    segmentMax: rutbe.max,
  };
}

function sagKolStatCarpan(deger, per10) {
  return Math.floor(sagKolNormalize(deger) / 10) * per10;
}

function sagKolSavasEtkileri(yetenekler) {
  const y = sagKolYetenekleriNormalize(yetenekler);
  return {
    gucBonusOran: sagKolStatCarpan(y.guc, SAG_KOL_GUC_BONUS_PER_10),
    zekaKesimOran: sagKolStatCarpan(y.zeka, SAG_KOL_ZEKA_KESIM_PER_10),
    beceriBonusOran: sagKolStatCarpan(y.beceri, SAG_KOL_BECERI_BONUS_PER_10),
    dayaniklilikBonusOran: sagKolStatCarpan(y.dayaniklilik, SAG_KOL_DAYANIKLILIK_BONUS_PER_10),
    yetenekler: y,
  };
}

function sagKolOzeti(yetenekler) {
  const y = sagKolYetenekleriNormalize(yetenekler);
  const etkiler = sagKolSavasEtkileri(y);
  const genelRutbe = sagKolGenelRutbe(y);
  const statlar = YETENEK_ANAHTARLAR.map((key) => {
    const deger = y[key];
    const ilerleme = sagKolStatIlerleme(deger);
    let etkiMetin = "";
    if (key === "guc") {
      etkiMetin = `Normal güç +%${(etkiler.gucBonusOran * 100).toFixed(0)}`;
    } else if (key === "zeka") {
      etkiMetin = `Rakip bonus −%${(etkiler.zekaKesimOran * 100).toFixed(1)}`;
    } else if (key === "beceri") {
      etkiMetin = `Güvenli Ev bonus +%${(etkiler.beceriBonusOran * 100).toFixed(0)}`;
    } else if (key === "dayaniklilik") {
      etkiMetin = `Mafya Evi bonus +%${(etkiler.dayaniklilikBonusOran * 100).toFixed(1)}`;
    }
    const maliyet = sagKolAntrenmanMaliyetTam(deger);
    return {
      key,
      ad: YETENEK_ETIKET[key],
      emoji: YETENEK_TANIM[key]?.emoji || "📊",
      aciklama: YETENEK_TANIM[key]?.aciklama || "",
      deger,
      yuzde: ilerleme.yuzde,
      kademe: ilerleme.rutbeAd,
      rutbeId: ilerleme.rutbeId,
      rutbeAd: ilerleme.rutbeAd,
      seviyeAtlamaHazir: ilerleme.seviyeAtlamaHazir,
      maxaUlasti: ilerleme.maxaUlasti,
      sonrakiRutbeAd: ilerleme.sonrakiRutbeAd,
      sonrakiEsik: ilerleme.seviyeAtlamaHazir ? deger + 1 : ilerleme.segmentMax < SAG_KOL_MAX ? ilerleme.segmentMax : null,
      antrenmanMaliyet: maliyet == null ? 0 : maliyet,
      etkiMetin,
    };
  });
  return {
    yetenekler: y,
    statlar,
    etkiler,
    rutbe: genelRutbe,
    rutbeId: genelRutbe.id,
    rutbeAd: genelRutbe.ad,
    rutbeIcon: genelRutbe.icon || "",
    rutbeler: SAG_KOL_RUTBELER.map((r) => ({
      id: r.id,
      ad: r.ad,
      min: r.min,
      max: r.max,
      icon: r.icon,
      aktif: r.id === genelRutbe.id,
      acik: sagKolRutbeSirasi(r.id) <= sagKolRutbeSirasi(genelRutbe.id),
    })),
    baslangic: SAG_KOL_BASLANGIC,
    max: SAG_KOL_MAX,
    antrenmanSureDk: SAG_KOL_ANTRENMAN_SURE_SN / 60,
    maliyetCarpan: SAG_KOL_MALIYET_CARPAN,
    icraatMaliyet: SAG_KOL_ICRAAT,
    gunlukLimit: SAG_KOL_GUNLUK_LIMIT,
  };
}

module.exports = {
  SAG_KOL_BASLANGIC,
  SAG_KOL_SEGMENT,
  SAG_KOL_MAX,
  SAG_KOL_MALIYET_CARPAN,
  SAG_KOL_SEVIYE_ATLAMA_CARPAN,
  SAG_KOL_ANTRENMAN_SURE_SN,
  SAG_KOL_ICRAAT,
  SAG_KOL_GUNLUK_LIMIT,
  SAG_KOL_SATIN_AL_FIYAT,
  SAG_KOL_SAGLIK_MAX,
  SAG_KOL_SAGLIK_HASAR,
  SAG_KOL_SAGLIK_IYILESME,
  SAG_KOL_HASTANE_MALIYET_ORAN,
  SAG_KOL_HASTANE_FULL_CARPAN,
  SAG_KOL_VIP_IYILESME_ELMAS,
  SAG_KOL_VIP_FULL_ELMAS,
  SAG_KOL_GUC_BONUS_PER_10,
  SAG_KOL_ZEKA_KESIM_PER_10,
  SAG_KOL_BECERI_BONUS_PER_10,
  SAG_KOL_DAYANIKLILIK_BONUS_PER_10,
  SAG_KOL_RUTBELER,
  ANTRENMAN_KAZANC,
  YETENEK_ANAHTARLAR,
  YETENEK_ETIKET,
  YETENEK_TANIM,
  sagKolAntrenmanMaliyet,
  sagKolAntrenmanMaliyetTam,
  sagKolSeviyeAtlamaMi,
  sagKolMaxaUlastiMi,
  sagKolNormalize,
  sagKolYetenekleriNormalize,
  sagKolRutbeFromDeger,
  sagKolGenelRutbe,
  sagKolRutbeSirasi,
  sagKolStatIlerleme,
  sagKolStatCarpan,
  sagKolSavasEtkileri,
  sagKolOzeti,
};
