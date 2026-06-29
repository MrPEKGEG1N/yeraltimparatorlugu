const crypto = require("crypto");

const BAHISLER = {
  pas: { ad: "Pas", aciklama: "7 veya 11 — 2.2x", carpan: 2.2 },
  yedi: { ad: "Yedi", aciklama: "Toplam 7 — 5x", carpan: 5 },
  cift: { ad: "Çift", aciklama: "İkiz zar — 6x", carpan: 6 },
  onbir: { ad: "On Bir", aciklama: "Toplam 11 — 6x", carpan: 6 },
};

function zarAt() {
  return [crypto.randomInt(1, 7), crypto.randomInt(1, 7)];
}

function bahisKontrol(tur) {
  const t = String(tur || "").toLowerCase();
  if (!BAHISLER[t]) return { ok: false, error: "Geçersiz barbut bahsi." };
  return { ok: true, tur: t };
}

function oyna(bahis, tur) {
  const kontrol = bahisKontrol(tur);
  if (!kontrol.ok) return kontrol;

  const [z1, z2] = zarAt();
  const toplam = z1 + z2;
  const cift = z1 === z2;
  const t = kontrol.tur;
  let kazanc = 0;
  let mesaj = `Zarlar: ${z1} + ${z2} = ${toplam}. `;

  if (t === "pas") {
    if (toplam === 7 || toplam === 11) {
      kazanc = Math.floor(bahis * BAHISLER.pas.carpan);
      mesaj += "Pas tuttu — kazandın!";
    } else if (toplam === 2 || toplam === 3 || toplam === 12) {
      mesaj += "Barbut — kaybettin.";
    } else {
      mesaj += "Pas tutmadı.";
    }
  } else if (t === "yedi" && toplam === 7) {
    kazanc = Math.floor(bahis * BAHISLER.yedi.carpan);
    mesaj += "Yedi geldi!";
  } else if (t === "cift" && cift) {
    kazanc = Math.floor(bahis * BAHISLER.cift.carpan);
    mesaj += `Çift ${z1} — büyük ödeme!`;
  } else if (t === "onbir" && toplam === 11) {
    kazanc = Math.floor(bahis * BAHISLER.onbir.carpan);
    mesaj += "On bir geldi!";
  } else {
    mesaj += "Bahis tutmadı.";
  }

  return {
    ok: true,
    bitti: true,
    kazanc,
    mesaj,
    gorunum: { z1, z2, toplam, tur: t, cift },
  };
}

module.exports = { oyna, bahisKontrol, BAHISLER, zarAt };
