const { normalizeGameLang } = require("./localeMetaService");

const INTL_LOCALE = {
  tr: "tr-TR",
  en: "en-US",
  "en-US": "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  "pt-BR": "pt-BR",
  nl: "nl-NL",
  ro: "ro-RO",
  cs: "cs-CZ",
  pl: "pl-PL",
  el: "el-GR",
  ru: "ru-RU",
  zh: "zh-CN",
  ar: "ar-SA",
  ja: "ja-JP",
};

const TZ = "Europe/Istanbul";

function intlLocale(lang) {
  const code = normalizeGameLang(lang);
  return INTL_LOCALE[code] || INTL_LOCALE.en;
}

function fmtNumber(n, lang) {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat(intlLocale(lang)).format(num);
  } catch (_) {
    return String(num);
  }
}

function fmtMoney(n, lang) {
  return `${fmtNumber(n, lang)} YC`;
}

function fmtGuc(n, lang) {
  const num = Math.max(0, Math.floor(Number(n) || 0));
  if (num >= 1_000_000_000) {
    const b = num / 1_000_000_000;
    return `${b >= 10 ? b.toFixed(0) : b.toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 10_000) {
    const k = num / 1_000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return fmtNumber(num, lang);
}

function fmtDateTime(ts, lang, opts = {}) {
  const n = Number(ts);
  if (!n) return "";
  const ms = n < 1e12 ? n * 1000 : n;
  try {
    return new Date(ms).toLocaleString(intlLocale(lang), {
      timeZone: TZ,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...opts,
    });
  } catch (_) {
    return new Date(ms).toISOString();
  }
}

function fmtDate(ts, lang) {
  const n = Number(ts);
  if (!n) return "";
  const ms = n < 1e12 ? n * 1000 : n;
  try {
    return new Date(ms).toLocaleDateString(intlLocale(lang), {
      timeZone: TZ,
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (_) {
    return "";
  }
}

module.exports = {
  intlLocale,
  fmtNumber,
  fmtMoney,
  fmtGuc,
  fmtDateTime,
  fmtDate,
  TZ,
};
