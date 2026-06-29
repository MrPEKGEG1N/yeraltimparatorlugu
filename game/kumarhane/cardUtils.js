const crypto = require("crypto");

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["S", "H", "D", "C"];

function yeniDeste() {
  const deste = [];
  for (const s of SUITS) {
    for (const r of RANKS) deste.push(`${r}${s}`);
  }
  return karistir(deste);
}

function karistir(deste) {
  const d = [...deste];
  for (let i = d.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function kartRutbe(kart) {
  const s = String(kart || "");
  if (s.startsWith("10")) return "10";
  return s.charAt(0);
}

function elToplam(el) {
  let toplam = 0;
  let as = 0;
  for (const k of el || []) {
    const r = kartRutbe(k);
    if (r === "A") {
      as++;
      toplam += 11;
    } else if (r === "K" || r === "Q" || r === "J") toplam += 10;
    else toplam += parseInt(r, 10) || 0;
  }
  while (toplam > 21 && as > 0) {
    toplam -= 10;
    as--;
  }
  return toplam;
}

function kartGoster(kart) {
  const r = kartRutbe(kart);
  const s = String(kart || "").slice(-1);
  const simge = { S: "♠", H: "♥", D: "♦", C: "♣" }[s] || s;
  return `${r}${simge}`;
}

function elGoster(el) {
  return (el || []).map(kartGoster);
}

module.exports = {
  yeniDeste,
  karistir,
  kartRutbe,
  elToplam,
  kartGoster,
  elGoster,
};
