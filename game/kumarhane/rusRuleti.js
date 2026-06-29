const crypto = require("crypto");

const YUVA_SAYISI = 6;
const HAYATTA_CARPAN = 1.5;

function oyna(bahis) {
  const mermi = crypto.randomInt(1, YUVA_SAYISI + 1);
  const tetik = crypto.randomInt(1, YUVA_SAYISI + 1);
  const hayatta = tetik !== mermi;

  let kazanc = 0;
  let mesaj;
  if (hayatta) {
    kazanc = Math.floor(bahis * HAYATTA_CARPAN);
    mesaj = `Tık… Boş yuva. Şanslısın! +${(kazanc - bahis).toLocaleString("tr-TR")} çip.`;
  } else {
    mesaj = `BANG! Ateş aldın — bahis gitti.`;
  }

  return {
    ok: true,
    bitti: true,
    kazanc,
    mesaj,
    gorunum: {
      mermi,
      tetik,
      hayatta,
      yuvaSayisi: YUVA_SAYISI,
    },
  };
}

module.exports = { oyna, YUVA_SAYISI, HAYATTA_CARPAN };
