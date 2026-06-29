const crypto = require("crypto");

const KIRMIZI = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** Avrupa ruleti çark sırası (saat yönü) */
const CARK_SIRASI = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const POCKET_SAYISI = CARK_SIRASI.length;
const POCKET_ACISI = 360 / POCKET_SAYISI;

function sayiRengi(n) {
  if (n === 0) return "yesil";
  return KIRMIZI.has(n) ? "kirmizi" : "siyah";
}

function pocketAcisi(sonuc) {
  const idx = CARK_SIRASI.indexOf(sonuc);
  if (idx < 0) return 0;
  return idx * POCKET_ACISI;
}

function cevir() {
  return crypto.randomInt(0, 37);
}

function bahisKontrol(tur, deger) {
  const t = String(tur || "").toLowerCase();
  const izinli = ["kirmizi", "siyah", "tek", "cift", "dusuk", "yuksek", "sayi"];
  if (!izinli.includes(t)) return { ok: false, error: "Geçersiz rulet bahsi." };
  if (t === "sayi") {
    const n = parseInt(deger, 10);
    if (!Number.isFinite(n) || n < 0 || n > 36) {
      return { ok: false, error: "0–36 arası numara seç." };
    }
  }
  return { ok: true, tur: t };
}

function oyna(bahis, tur, deger) {
  const kontrol = bahisKontrol(tur, deger);
  if (!kontrol.ok) return kontrol;

  const sonuc = cevir();
  let kazanc = 0;
  let mesaj = `Top ${sonuc} geldi. `;
  const t = kontrol.tur;

  if (t === "sayi" && parseInt(deger, 10) === sonuc) {
    kazanc = bahis * 36;
    mesaj += "Tam isabet — 35:1!";
  } else if (t === "kirmizi" && KIRMIZI.has(sonuc)) {
    kazanc = bahis * 2;
    mesaj += "Kırmızı kazandı.";
  } else if (t === "siyah" && sonuc > 0 && !KIRMIZI.has(sonuc)) {
    kazanc = bahis * 2;
    mesaj += "Siyah kazandı.";
  } else if (t === "tek" && sonuc > 0 && sonuc % 2 === 1) {
    kazanc = bahis * 2;
    mesaj += "Tek kazandı.";
  } else if (t === "cift" && sonuc > 0 && sonuc % 2 === 0) {
    kazanc = bahis * 2;
    mesaj += "Çift kazandı.";
  } else if (t === "dusuk" && sonuc >= 1 && sonuc <= 18) {
    kazanc = bahis * 2;
    mesaj += "1–18 kazandı.";
  } else if (t === "yuksek" && sonuc >= 19 && sonuc <= 36) {
    kazanc = bahis * 2;
    mesaj += "19–36 kazandı.";
  } else {
    mesaj += "Bahis tutmadı.";
  }

  return {
    ok: true,
    bitti: true,
    kazanc,
    mesaj,
    gorunum: { sonuc, tur: t, deger: deger ?? null, renk: sonuc === 0 ? "yesil" : KIRMIZI.has(sonuc) ? "kirmizi" : "siyah" },
  };
}

module.exports = { oyna, bahisKontrol, CARK_SIRASI, POCKET_ACISI, sayiRengi, pocketAcisi, KIRMIZI };
