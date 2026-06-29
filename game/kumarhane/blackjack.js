const { yeniDeste, elToplam, elGoster } = require("./cardUtils");

function baslat(bahis) {
  const deste = yeniDeste();
  const oyuncu = [deste.pop(), deste.pop()];
  const krupiye = [deste.pop(), deste.pop()];
  const state = {
    bahis,
    deste,
    oyuncu,
    krupiye,
    faz: "oyunda",
    double: false,
  };

  if (elToplam(oyuncu) === 21) {
    return bitir(state, true);
  }
  return { bitti: false, state, gorunum: gorunum(state, true) };
}

function gorunum(state, krupiyeGizli) {
  const krGoster = elGoster(state.krupiye);
  const kr = krupiyeGizli ? [krGoster[0], "??"] : krGoster;
  return {
    oyuncu: elGoster(state.oyuncu),
    krupiye: kr,
    oyuncuToplam: elToplam(state.oyuncu),
    krupiyeToplam: krupiyeGizli ? null : elToplam(state.krupiye),
    faz: state.faz,
    bahis: state.bahis,
    doubleKullanildi: state.double,
  };
}

function krupiyeOyna(state) {
  while (elToplam(state.krupiye) < 17) {
    state.krupiye.push(state.deste.pop());
  }
}

function bitir(state, erkenBlackjack) {
  state.faz = "bitti";
  if (!erkenBlackjack) krupiyeOyna(state);
  const p = elToplam(state.oyuncu);
  const d = elToplam(state.krupiye);
  let kazanc = 0;
  let mesaj = "";

  if (p > 21) {
    mesaj = "Battın — 21'i geçtin.";
  } else if (d > 21) {
    kazanc = state.bahis * 2;
    mesaj = "Krupiye battı! Kazandın.";
  } else if (p > d) {
    kazanc = state.bahis * 2;
    mesaj = "Elin krupiyeden büyük — kazandın!";
  } else if (p === d) {
    kazanc = state.bahis;
    mesaj = "Berabere — bahis iade.";
  } else {
    mesaj = "Krupiye kazandı.";
  }

  if (erkenBlackjack && p === 21) {
    kazanc = Math.floor(state.bahis * 2.5);
    mesaj = "Blackjack! 3:2 ödeme.";
  }

  return {
    bitti: true,
    state,
    kazanc,
    mesaj,
    gorunum: gorunum(state, false),
  };
}

function devam(state, aksiyon) {
  if (!state || state.faz !== "oyunda") {
    return { ok: false, error: "Aktif blackjack elin yok." };
  }

  if (aksiyon === "hit") {
    state.oyuncu.push(state.deste.pop());
    if (elToplam(state.oyuncu) > 21) {
      const sonuc = bitir(state, false);
      sonuc.kazanc = 0;
      sonuc.mesaj = "Battın — 21'i geçtin.";
      return { ok: true, ...sonuc };
    }
    return { ok: true, bitti: false, state, gorunum: gorunum(state, true) };
  }

  if (aksiyon === "double") {
    if (state.double || state.oyuncu.length !== 2) {
      return { ok: false, error: "Double sadece ilk hamlede yapılabilir." };
    }
    state.double = true;
    state.bahis *= 2;
    state.oyuncu.push(state.deste.pop());
    const sonuc = bitir(state, false);
    if (elToplam(state.oyuncu) > 21) {
      sonuc.kazanc = 0;
      sonuc.mesaj = "Double sonrası battın.";
    }
    return { ok: true, ...sonuc };
  }

  if (aksiyon === "stand") {
    const sonuc = bitir(state, false);
    return { ok: true, ...sonuc };
  }

  return { ok: false, error: "Geçersiz hamle." };
}

module.exports = { baslat, devam, gorunum };
