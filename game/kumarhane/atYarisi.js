const crypto = require("crypto");

const AT_ISIMLERI = [
  "Kara Şimşek",
  "Rüzgar Pençesi",
  "Altın Nal",
  "Gece Kurdu",
  "Çöl Fırtınası",
  "Yıldırım Kuyruğu",
];

function yarisOlustur() {
  const atlar = AT_ISIMLERI.map((ad, i) => {
    const oran = 2 + crypto.randomInt(1, 9);
    return { no: i + 1, ad, oran };
  });
  return atlar;
}

function kazananSec(atlar) {
  const agirlik = atlar.map((a) => Math.max(1, Math.floor(120 / a.oran)));
  const toplam = agirlik.reduce((s, w) => s + w, 0);
  let r = crypto.randomInt(0, toplam);
  for (let i = 0; i < atlar.length; i++) {
    r -= agirlik[i];
    if (r < 0) return atlar[i];
  }
  return atlar[0];
}

function oyna(bahis, atNo, atlar) {
  const secim = parseInt(atNo, 10);
  const at = (atlar || []).find((a) => a.no === secim);
  if (!at) return { ok: false, error: "Geçerli bir at seç." };

  const kazanan = kazananSec(atlar);
  let kazanc = 0;
  let mesaj = `${kazanan.ad} (${kazanan.no}) birinci geldi. `;
  if (kazanan.no === secim) {
    kazanc = Math.floor(bahis * at.oran);
    mesaj += `Tebrikler — ${at.oran}x ödeme!`;
  } else {
    mesaj += `${at.ad} bu turda yetmedi.`;
  }

  return {
    ok: true,
    bitti: true,
    kazanc,
    mesaj,
    gorunum: { atlar, kazanan: kazanan.no, secim: secim },
  };
}

module.exports = { yarisOlustur, oyna };
