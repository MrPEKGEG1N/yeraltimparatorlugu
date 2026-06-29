/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { translate } = require("google-translate-api-x");

const ROOT = path.join(__dirname, "..");
const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const LANGS = ["tr", "en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function protectPlaceholders(text) {
  const map = [];
  let i = 0;
  const out = text.replace(/\$\{[^}]+\}/g, (m) => {
    const token = `__PH${i}__`;
    map.push({ token, value: m });
    i++;
    return token;
  });
  return { out, map };
}

function restore(text, map) {
  let r = text;
  map.forEach(({ token, value }) => {
    r = r.split(token).join(value);
  });
  return r;
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
}

function writeOutputs(cache) {
  const CATALOG = {};
  const MSG_TO_CODE = {};
  for (const row of Object.values(cache)) {
    if (!row.tr || !row.code) continue;
    CATALOG[row.code] = {};
    LANGS.forEach((l) => {
      if (l === "tr") CATALOG[row.code][l] = row.tr;
      else CATALOG[row.code][l] = row[l] || row.en || row["en-US"] || row.tr;
    });
    MSG_TO_CODE[row.tr] = row.code;
  }

  const serverBody = fs.readFileSync(path.join(ROOT, "game/errors.js"), "utf8").split("const LANGS")[0];
  // rebuild from template in build-i18n-catalog.js
  const body = `/* AUTO-GENERATED — scripts/complete-error-translations.js */
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
  if (typeof out.message === "string") out.message = localizeText(out.message, lang);
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

  fs.writeFileSync(path.join(ROOT, "game/errors.js"), body, "utf8");
  fs.writeFileSync(
    path.join(ROOT, "public/i18n/catalog.js"),
    `(function (global) {\n  "use strict";\n  global.I18N_CATALOG = ${JSON.stringify(CATALOG)};\n  global.I18N_MSG_TO_CODE = ${JSON.stringify(MSG_TO_CODE)};\n})(window);\n`,
    "utf8"
  );
  console.log("written", Object.keys(CATALOG).length);
}

async function main() {
  const errorsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, "errors-raw.json"), "utf8"));
  const cache = loadCache();

  for (const e of errorsRaw) {
    if (!cache[e.msg]) cache[e.msg] = { code: e.code, tr: e.msg };
    else cache[e.msg].code = e.code;
  }

  let fixed = 0;
  for (const [trText, row] of Object.entries(cache)) {
    if (row.en && row.en !== row.tr) continue;
    const { out, map } = protectPlaceholders(trText);
    try {
      const res = await translate(out, { from: "tr", to: "en", rejectOnPartialFail: false, forceTo: true });
      row.en = restore(res.text, map);
      row["en-US"] = row.en;
      fixed++;
      process.stdout.write(".");
      await sleep(200);
    } catch (err) {
      console.warn("\nfail", trText.slice(0, 40), err.message);
    }
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  writeOutputs(cache);
  console.log("\nfixed en:", fixed);
}

main().catch(console.error);
