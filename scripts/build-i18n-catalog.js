/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const LANGS = ["tr", "en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];
const TARGETS = LANGS.filter((l) => l !== "tr");
const MYMEMORY = {
  en: "en-GB",
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
  el: "el-GR",
  ru: "ru-RU",
  zh: "zh-CN",
  ar: "ar-SA",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function protectPlaceholders(text) {
  const map = [];
  let i = 0;
  const protectedText = text.replace(/\$\{[^}]+\}/g, (m) => {
    const token = `__PH${i}__`;
    map.push({ token, value: m });
    i++;
    return token;
  });
  return { protectedText, map };
}

function restorePlaceholders(text, map) {
  let out = text;
  map.forEach(({ token, value }) => {
    out = out.split(token).join(value);
  });
  return out;
}

function isCleanPhrase(s) {
  if (!s || s.length < 3 || s.length > 200) return false;
  if (/^[\s<>,.;)\]}(]/.test(s)) return false;
  if (/<\/?[a-z]/i.test(s)) return false;
  return /[çğıöşüÇĞİÖŞÜ]/.test(s);
}

function slugify(s) {
  return (
    s
      .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 55)
      .toUpperCase() || "MSG"
  );
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

async function myMemoryTranslate(text, from, to) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text) +
    "&langpair=" +
    encodeURIComponent(from + "|" + to);
  const res = await fetch(url);
  const data = await res.json();
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(data.responseDetails || "translate failed");
  }
  return data.responseData.translatedText;
}

async function translateText(trText, lang) {
  const { protectedText, map } = protectPlaceholders(trText);
  const target = MYMEMORY[lang] || lang;
  let out;
  if (lang === "en" || lang === "en-US") {
    out = await myMemoryTranslate(protectedText, "tr-TR", target);
  } else {
    const en = await myMemoryTranslate(protectedText, "tr-TR", "en-GB");
    out = await myMemoryTranslate(en, "en-GB", target);
  }
  return restorePlaceholders(out, map);
}

function writeOutputs(cache) {
  const CATALOG = {};
  const MSG_TO_CODE = {};
  for (const row of Object.values(cache)) {
    if (!row.tr || !row.code) continue;
    CATALOG[row.code] = {};
    LANGS.forEach((l) => {
      CATALOG[row.code][l] = row[l] || row.en || row.tr;
    });
    MSG_TO_CODE[row.tr] = row.code;
  }

  const serverBody = `/* AUTO-GENERATED — scripts/build-i18n-catalog.js */
const LANGS = ${JSON.stringify(LANGS)};

const CATALOG = ${JSON.stringify(CATALOG, null, 2)};

const MSG_TO_CODE = ${JSON.stringify(MSG_TO_CODE, null, 2)};

function normalizeLang(code) {
  const c = String(code || "tr").trim();
  if (LANGS.includes(c)) return c;
  const base = c.split("-")[0];
  if (LANGS.includes(base)) return base;
  return "tr";
}

function interpolate(str, params) {
  if (!str || !params) return str || "";
  return String(str).replace(/\\$\\{([^}]+)\\}/g, (_, key) => {
    const k = key.trim();
    if (params[k] !== undefined && params[k] !== null) return String(params[k]);
    return "";
  });
}

function localizeByCode(code, lang, params) {
  const entry = CATALOG[code];
  if (!entry) return null;
  const l = normalizeLang(lang);
  const text = entry[l] || entry.en || entry["en-US"] || entry.tr;
  return interpolate(text, params || {});
}

function localizeText(text, lang, params) {
  if (!text) return text;
  const l = normalizeLang(lang);
  if (l === "tr") return interpolate(text, params);
  const code = MSG_TO_CODE[text];
  if (code) return localizeByCode(code, l, params);
  return text;
}

function localizePayload(data, lang) {
  if (!data || normalizeLang(lang) === "tr") return data;
  if (Array.isArray(data)) return data.map((x) => localizePayload(x, lang));
  const out = { ...data };
  if (typeof out.error === "string") out.error = localizeText(out.error, lang);
  if (typeof out.mesaj === "string") out.mesaj = localizeText(out.mesaj, lang);
  if (out.effect && typeof out.effect.mesaj === "string") {
    out.effect = { ...out.effect, mesaj: localizeText(out.effect.mesaj, lang) };
  }
  if (out.message && typeof out.message === "string") out.message = localizeText(out.message, lang);
  return out;
}

module.exports = {
  LANGS,
  CATALOG,
  MSG_TO_CODE,
  normalizeLang,
  localizeText,
  localizeByCode,
  localizePayload,
};
`;

  fs.writeFileSync(path.join(ROOT, "game/errors.js"), serverBody, "utf8");
  fs.writeFileSync(
    path.join(ROOT, "public/i18n/catalog.js"),
    `(function (global) {\n  "use strict";\n  global.I18N_CATALOG = ${JSON.stringify(CATALOG)};\n  global.I18N_MSG_TO_CODE = ${JSON.stringify(MSG_TO_CODE)};\n})(window);\n`,
    "utf8"
  );
  console.log("written", Object.keys(CATALOG).length, "entries");
}

async function main() {
  const errorsOnly = process.argv.includes("--errors-only");
  const errorsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, "errors-raw.json"), "utf8"));
  let uiPhrases = [];
  if (!errorsOnly && fs.existsSync(path.join(__dirname, "phrases-raw.json"))) {
    uiPhrases = JSON.parse(fs.readFileSync(path.join(__dirname, "phrases-raw.json"), "utf8")).filter(isCleanPhrase);
  }

  const cache = loadCache();
  const entries = new Map();
  errorsRaw.forEach((e) => entries.set(e.msg, { code: e.code, tr: e.msg }));
  uiPhrases.forEach((msg) => {
    if (!entries.has(msg)) entries.set(msg, { code: "UI_" + slugify(msg), tr: msg });
  });

  console.log("total entries", entries.size);

  let n = 0;
  for (const [trText, entry] of entries) {
    if (!cache[trText]) cache[trText] = { code: entry.code, tr: trText };
    const row = cache[trText];
    row.code = entry.code;

    for (const lang of TARGETS) {
      if (row[lang]) continue;
      try {
        row[lang] = await translateText(trText, lang);
        process.stdout.write(".");
      } catch (err) {
        console.warn("\nfail", lang, trText.slice(0, 36), err.message);
        row[lang] = row.en || trText;
      }
      await sleep(350);
    }
    n++;
    if (n % 10 === 0) {
      saveCache(cache);
      writeOutputs(cache);
    }
  }

  saveCache(cache);
  writeOutputs(cache);
  console.log("\ndone");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
