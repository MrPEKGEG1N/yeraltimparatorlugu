/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const TEMPLATES_PATH = path.join(__dirname, "message-templates.json");
const LANGS = ["tr", "en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];

function loadTemplates() {
  if (!fs.existsSync(TEMPLATES_PATH)) return [];
  const store = JSON.parse(fs.readFileSync(TEMPLATES_PATH, "utf8"));
  return Object.values(store).map((t) => ({
    pattern: t.pattern,
    vars: t.vars || [],
    tr: t.tr,
    en: t.en,
    "en-US": t["en-US"],
    de: t.de,
    fr: t.fr,
    es: t.es,
    it: t.it,
    pt: t.pt,
    "pt-BR": t["pt-BR"],
    nl: t.nl,
    ro: t.ro,
    cs: t.cs,
    el: t.el,
    ru: t.ru,
    zh: t.zh,
    ar: t.ar,
  }));
}

function generate(cache) {
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

  const TEMPLATES = loadTemplates();

  const serverBody = `/* AUTO-GENERATED — scripts/generate-errors-module.js */
const LANGS = ${JSON.stringify(LANGS)};

const CATALOG = ${JSON.stringify(CATALOG, null, 2)};

const MSG_TO_CODE = ${JSON.stringify(MSG_TO_CODE, null, 2)};

const TEMPLATES = ${JSON.stringify(TEMPLATES, null, 2)};

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

function applyTemplate(text, lang) {
  const l = normalizeLang(lang);
  if (l === "tr") return text;
  for (let i = 0; i < TEMPLATES.length; i++) {
    const tpl = TEMPLATES[i];
    if (!tpl.pattern) continue;
    let re;
    try {
      re = new RegExp(tpl.pattern);
    } catch (_) {
      continue;
    }
    const m = text.match(re);
    if (!m) continue;
    let out = tpl[l] || tpl.en || tpl["en-US"] || tpl.tr;
    const vars = tpl.vars || [];
    for (let j = 0; j < vars.length; j++) {
      out = out.split("\${" + vars[j] + "}").join(m[j + 1] || "");
    }
    return out;
  }
  return null;
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
  const tpl = applyTemplate(text, l);
  if (tpl) return tpl;
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
  TEMPLATES,
  normalizeLang,
  localizeText,
  localizeByCode,
  localizePayload,
};
`;

  fs.writeFileSync(path.join(ROOT, "game/errors.js"), serverBody, "utf8");
  fs.writeFileSync(
    path.join(ROOT, "public/i18n/catalog.js"),
    `(function (global) {\n  "use strict";\n  global.I18N_CATALOG = ${JSON.stringify(CATALOG)};\n  global.I18N_MSG_TO_CODE = ${JSON.stringify(MSG_TO_CODE)};\n  global.I18N_TEMPLATES = ${JSON.stringify(TEMPLATES)};\n})(window);\n`,
    "utf8"
  );

  return { catalog: Object.keys(CATALOG).length, templates: TEMPLATES.length };
}

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  const r = generate(cache);
  console.log("catalog", r.catalog, "templates", r.templates);
}

if (require.main === module) main();

module.exports = { generate };
