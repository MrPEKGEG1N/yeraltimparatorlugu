const SOHBET_KANALLARI = [
  "global",
  "tr",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "pl",
  "ru",
  "ar",
  "zh",
  "ja",
];

const LANG_TO_KANAL = {
  tr: "tr",
  en: "global",
  "en-US": "global",
  de: "de",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  "pt-BR": "pt",
  pl: "pl",
  ru: "ru",
  ar: "ar",
  zh: "zh",
  ja: "ja",
  nl: "global",
  ro: "global",
  cs: "global",
  el: "global",
};

function normalizeSohbetKanal(kanal) {
  const k = String(kanal || "")
    .trim()
    .toLowerCase();
  if (SOHBET_KANALLARI.includes(k)) return k;
  return "global";
}

function varsayilanKanal(oyunDili) {
  const lang = String(oyunDili || "tr").trim();
  if (LANG_TO_KANAL[lang]) return LANG_TO_KANAL[lang];
  const base = lang.split("-")[0];
  if (LANG_TO_KANAL[base]) return LANG_TO_KANAL[base];
  return "global";
}

module.exports = {
  SOHBET_KANALLARI,
  LANG_TO_KANAL,
  normalizeSohbetKanal,
  varsayilanKanal,
};
