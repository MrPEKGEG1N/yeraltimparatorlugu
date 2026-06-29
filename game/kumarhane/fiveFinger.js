const crypto = require("crypto");

const TUR_SAYISI = 5;
const CARPANLAR = [1, 1.5, 2, 3, 5];

function baslat(bahis) {
  return {
    bitti: false,
    state: {
      bahis,
      tur: 1,
      carpan: 1,
      faz: "oyunda",
    },
    gorunum: gorunum({ bahis, tur: 1, carpan: 1, faz: "oyunda" }),
  };
}

function gorunum(state) {
  return {
    tur: state.tur,
    toplamTur: TUR_SAYISI,
    carpan: state.carpan,
    bahis: state.bahis,
    faz: state.faz,
    parmaklar: [1, 2, 3, 4, 5],
  };
}

function devam(state, parmak) {
  if (!state || state.faz !== "oyunda") {
    return { ok: false, error: "Aktif Five Finger turun yok." };
  }
  const secim = parseInt(parmak, 10);
  if (!Number.isFinite(secim) || secim < 1 || secim > 5) {
    return { ok: false, error: "1–5 arası parmak seç." };
  }

  const tehlike = crypto.randomInt(1, 6);
  if (secim === tehlike) {
    return {
      ok: true,
      bitti: true,
      kazanc: 0,
      mesaj: `Bıçak ${tehlike}. parmağa denk geldi — kaybettin!`,
      gorunum: { ...gorunum(state), tehlike, secim, sonuc: "kayip" },
    };
  }

  const yeniTur = state.tur + 1;
  const carpan = CARPANLAR[Math.min(state.tur, CARPANLAR.length - 1)] || 5;
  if (yeniTur > TUR_SAYISI) {
    const kazanc = Math.floor(state.bahis * carpan);
    return {
      ok: true,
      bitti: true,
      kazanc,
      mesaj: `5 tur atlattın — x${carpan} çarpan!`,
      gorunum: { ...gorunum(state), tehlike, secim, sonuc: "zafer", carpan },
    };
  }

  const yeniState = { ...state, tur: yeniTur, carpan };
  return {
    ok: true,
    bitti: false,
    state: yeniState,
    mesaj: `Tur ${state.tur} geçildi — çarpan x${carpan}`,
    gorunum: { ...gorunum(yeniState), tehlike, secim, sonuc: "devam" },
  };
}

module.exports = { baslat, devam, gorunum, TUR_SAYISI };
