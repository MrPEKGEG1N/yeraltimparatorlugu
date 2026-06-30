const { run } = require("../db/database");

const SUPPORTED_LANGS = new Set([
  "tr",
  "en",
  "en-US",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "pt-BR",
  "nl",
  "ro",
  "cs",
  "el",
  "ru",
  "zh",
  "ar",
]);

const COUNTRY_HEADERS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "cloudfront-viewer-country",
  "x-appengine-country",
];

function normalizeGameLang(code) {
  const c = String(code || "").trim();
  if (!c) return "tr";
  if (SUPPORTED_LANGS.has(c)) return c;
  const base = c.split("-")[0];
  if (SUPPORTED_LANGS.has(base)) return base;
  return "tr";
}

function normalizeCountryCode(code) {
  const c = String(code || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || c === "XX" || c === "T1") return "";
  return c;
}

function extractCountryFromReq(req) {
  for (const header of COUNTRY_HEADERS) {
    const value = normalizeCountryCode(req.headers[header]);
    if (value) return value;
  }
  return "";
}

function resolveRegistrationCountry(meta, clientHint) {
  return normalizeCountryCode(meta?.country) || normalizeCountryCode(clientHint) || "";
}

async function updateUserGameLang(db, userId, lang) {
  const normalized = normalizeGameLang(lang);
  await run(db, `UPDATE users SET oyun_dili = ? WHERE id = ?`, [normalized, userId]);
  return normalized;
}

module.exports = {
  normalizeGameLang,
  normalizeCountryCode,
  extractCountryFromReq,
  resolveRegistrationCountry,
  updateUserGameLang,
  SUPPORTED_LANGS,
};
