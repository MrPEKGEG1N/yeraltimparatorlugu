const { htmlToPlainText, profilAciklamaFFormatMi } = require("./profilFFormat");

const MIN_UZUNLUK = 10;

const KUFUR_KALIPLAR = [
  /\b(amk|aq|amına|amina|siktir|sikeyim|sikerim|orospu|orospucoc|piç|pic|pezevenk|göt|got|yarrak|yarak|mal|salak|gerizekalı|gerizekali)\b/i,
  /\b(fuck|shit|bitch|asshole|dick|pussy|cunt)\b/i,
];

function grupAciklamaPlain(raw) {
  const src = String(raw || "");
  if (!src.trim()) return "";
  if (profilAciklamaFFormatMi(src)) {
    return htmlToPlainText(src)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
  }
  return htmlToPlainText(src).trim();
}

function spamMi(metin) {
  const s = String(metin || "").trim();
  if (!s) return false;
  if (/(.)\1{6,}/.test(s)) return true;
  if (/^[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]{8,}$/.test(s)) return true;
  const kelimeler = s.split(/\s+/).filter(Boolean);
  if (kelimeler.length >= 3 && kelimeler.every((k) => k === kelimeler[0])) return true;
  return false;
}

function kufurMi(metin) {
  const s = String(metin || "").toLowerCase();
  if (!s) return false;
  return KUFUR_KALIPLAR.some((re) => re.test(s));
}

function validateGrupAciklama(raw) {
  const plain = grupAciklamaPlain(raw);
  if (!plain) return { ok: true, plain: "" };
  if (plain.length < MIN_UZUNLUK) {
    return {
      ok: false,
      error: `Grup açıklaması en az ${MIN_UZUNLUK} karakter olmalı.`,
    };
  }
  if (kufurMi(plain)) {
    return { ok: false, error: "Grup açıklamasında uygunsuz ifade tespit edildi." };
  }
  if (spamMi(plain)) {
    return { ok: false, error: "Grup açıklaması spam olarak algılandı." };
  }
  return { ok: true, plain };
}

module.exports = {
  MIN_UZUNLUK,
  grupAciklamaPlain,
  validateGrupAciklama,
};
