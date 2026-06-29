const { yeniDeste, kartRutbe, elGoster } = require("./cardUtils");

const RANK_ORDER = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };

function elDegeri(el) {
  const rutbeler = el.map(kartRutbe).sort((a, b) => RANK_ORDER[b] - RANK_ORDER[a]);
  const degerler = rutbeler.map((r) => RANK_ORDER[r]);
  const suiteler = el.map((k) => k.slice(-1));
  const flush = suiteler.every((s) => s === suiteler[0]);
  const straight =
    (degerler[0] - degerler[2] === 2 && new Set(degerler).size === 3) ||
    (degerler.join("") === "14132"); // A-3-2
  const counts = {};
  rutbeler.forEach((r) => {
    counts[r] = (counts[r] || 0) + 1;
  });
  const vals = Object.values(counts).sort((a, b) => b - a);

  if (vals[0] === 3) return { skor: 6, ad: "Üçlü", ana: degerler[0] };
  if (flush && straight) return { skor: 5, ad: "Straight Flush", ana: degerler[0] };
  if (straight) return { skor: 4, ad: "Kent", ana: degerler[0] };
  if (flush) return { skor: 3, ad: "Floş", ana: degerler[0] };
  if (vals[0] === 2) return { skor: 2, ad: "Per", ana: degerler[0] };
  return { skor: 1, ad: "Yüksek Kart", ana: degerler[0] };
}

function karsilastir(a, b) {
  if (a.skor !== b.skor) return a.skor - b.skor;
  return a.ana - b.ana;
}

function krupiyeUygun(el) {
  const degerler = el.map((k) => RANK_ORDER[kartRutbe(k)]);
  return Math.max(...degerler) >= 12 || elDegeri(el).skor >= 2;
}

function oyna(bahis) {
  const deste = yeniDeste();
  const oyuncu = [deste.pop(), deste.pop(), deste.pop()];
  const krupiye = [deste.pop(), deste.pop(), deste.pop()];
  const pEl = elDegeri(oyuncu);
  const dEl = elDegeri(krupiye);
  const uygun = krupiyeUygun(krupiye);

  let kazanc = 0;
  let mesaj = `Sen: ${pEl.ad} — Krupiye: ${dEl.ad}. `;

  if (!uygun) {
    kazanc = bahis * 2;
    mesaj += "Krupiye oynamadı (Q yüksek yok) — ante iade + kazanç.";
  } else if (karsilastir(pEl, dEl) > 0) {
    kazanc = bahis * 2;
    if (pEl.skor >= 4) {
      kazanc = bahis * 4;
      mesaj += "Güçlü el bonusu!";
    } else if (pEl.skor === 3) {
      kazanc = Math.floor(bahis * 3);
    }
    mesaj += "Kazandın!";
  } else if (karsilastir(pEl, dEl) === 0) {
    kazanc = bahis;
    mesaj += "Berabere — bahis iade.";
  } else {
    mesaj += "Krupiye kazandı.";
  }

  return {
    ok: true,
    bitti: true,
    kazanc,
    mesaj,
    gorunum: {
      oyuncu: elGoster(oyuncu),
      krupiye: elGoster(krupiye),
      oyuncuEl: pEl.ad,
      krupiyeEl: dEl.ad,
      krupiyeUygun: uygun,
    },
  };
}

module.exports = { oyna };
