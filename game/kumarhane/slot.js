const crypto = require("crypto");

const SEMBOLLER = [
  { id: "kiraz", g: "🍒", carpan: 2 },
  { id: "limon", g: "🍋", carpan: 3 },
  { id: "zil", g: "🔔", carpan: 5 },
  { id: "bar", g: "🟥", carpan: 10 },
  { id: "yedi", g: "7️⃣", carpan: 25 },
];

function cevirSembol() {
  const i = crypto.randomInt(0, SEMBOLLER.length);
  return SEMBOLLER[i];
}

function oyna(bahis) {
  const makara = [cevirSembol(), cevirSembol(), cevirSembol()];
  let kazanc = 0;
  let mesaj = makara.map((s) => s.g).join(" | ");

  if (makara[0].id === makara[1].id && makara[1].id === makara[2].id) {
    kazanc = bahis * makara[0].carpan;
    mesaj += ` — Üçlü ${makara[0].g}! x${makara[0].carpan}`;
  } else if (
    makara[0].id === makara[1].id ||
    makara[1].id === makara[2].id ||
    makara[0].id === makara[2].id
  ) {
    const es = makara[0].id === makara[1].id ? makara[0] : makara[1].id === makara[2].id ? makara[1] : makara[0];
    kazanc = Math.floor(bahis * (es.carpan * 0.4));
    mesaj += " — İkili eşleşme!";
  } else {
    mesaj += " — Kaybettin.";
  }

  return {
    ok: true,
    bitti: true,
    kazanc,
    mesaj,
    gorunum: { makara: makara.map((s) => ({ id: s.id, g: s.g })) },
  };
}

module.exports = { oyna, SEMBOLLER };
