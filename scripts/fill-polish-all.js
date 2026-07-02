/* eslint-disable no-console */
/**
 * Fill complete Polish (pl) translations for UI locales, error catalog, and templates.
 */
const fs = require("fs");
const path = require("path");
const { translate } = require("google-translate-api-x");

const ROOT = path.join(__dirname, "..");
const LOCALES_PATH = path.join(ROOT, "public/i18n/locales.js");
const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const PL_CACHE_PATH = path.join(__dirname, "pl-locale-cache.json");
const TEMPLATES_PATH = path.join(__dirname, "message-templates.json");
const C = [
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
  "pl",
];
const PL_INDEX = C.indexOf("pl");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function protectPlaceholders(text) {
  const map = [];
  let i = 0;
  const out = String(text).replace(/(\$\{[^}]+\}|\{[^}]+\}|<[^>]+>)/g, (m) => {
    const token = `__PH${i}__`;
    map.push({ token, value: m });
    i++;
    return token;
  });
  return { out, map };
}

function restorePlaceholders(text, map) {
  let out = text;
  map.forEach(({ token, value }) => {
    out = out.split(token).join(value);
  });
  return out;
}

function parseStringArray(inner) {
  const vals = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && /[\s,]/.test(inner[i])) i++;
    if (i >= inner.length) break;
    if (inner[i] !== '"') break;
    i++;
    let s = "";
    while (i < inner.length) {
      if (inner[i] === "\\") {
        s += inner[i + 1];
        i += 2;
      } else if (inner[i] === '"') {
        i++;
        break;
      } else {
        s += inner[i];
        i++;
      }
    }
    vals.push(s);
  }
  return vals;
}

function parseLocaleRows(src) {
  const rows = [];
  const re = /row\("([^"]+)",\s*\[([^\]]*)\]\)/g;
  let m;
  while ((m = re.exec(src))) {
    rows.push({ key: m[1], vals: parseStringArray(m[2]) });
  }
  return rows;
}

function formatRow(key, vals) {
  while (vals.length < C.length) vals.push(vals[1] || vals[0] || "");
  const slice = vals.slice(0, C.length);
  return `    row("${key}", [${slice.map((v) => `"${esc(v)}"`).join(", ")}]),`;
}

function loadPlCache() {
  if (!fs.existsSync(PL_CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(PL_CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function savePlCache(cache) {
  fs.writeFileSync(PL_CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

async function trPl(text) {
  const src = String(text || "").trim();
  if (!src) return src;
  const { out, map } = protectPlaceholders(src);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await translate(out, {
        from: "en",
        to: "pl",
        rejectOnPartialFail: false,
        forceTo: true,
      });
      if (res && res.text) return restorePlaceholders(res.text, map);
    } catch (err) {
      if (/too many|429|rate/i.test(String(err.message))) await sleep(12000 + attempt * 8000);
    }
    await sleep(600 * (attempt + 1));
  }
  throw new Error("translate failed: " + src.slice(0, 40));
}

async function ensurePl(text, cache, cacheKey) {
  if (cache[cacheKey]) return cache[cacheKey];
  const pl = await trPl(text);
  cache[cacheKey] = pl;
  return pl;
}

function rebuildLocalesJs(src, rows) {
  const lines = src.split("\n");
  const rowMap = new Map(rows.map((r) => [r.key, r]));
  const out = lines.map((line) => {
    const m = line.match(/row\("([^"]+)",\s*\[/);
    if (!m) return line;
    const row = rowMap.get(m[1]);
    if (!row) return line;
    return formatRow(row.key, row.vals);
  });
  return out.join("\n");
}

async function fillUiLocales(plCache) {
  const src = fs.readFileSync(LOCALES_PATH, "utf8");
  const rows = parseLocaleRows(src);
  console.log("UI rows:", rows.length);
  let done = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const en = row.vals[1] || row.vals[0];
    const cacheKey = "ui:" + row.key;
    if (row.vals[PL_INDEX] && row.vals[PL_INDEX] !== en && row.vals[PL_INDEX] !== row.vals[0]) {
      done++;
      continue;
    }
    try {
      row.vals[PL_INDEX] = await ensurePl(en, plCache, cacheKey);
      done++;
      if (done % 20 === 0) {
        savePlCache(plCache);
        console.log(" UI", done, "/", rows.length);
      }
      await sleep(400);
    } catch (err) {
      console.warn(" UI fail", row.key, err.message);
      row.vals[PL_INDEX] = en;
    }
  }
  savePlCache(plCache);
  fs.writeFileSync(LOCALES_PATH, rebuildLocalesJs(src, rows), "utf8");
  console.log("locales.js updated");
}

async function fillErrorCache(plCache) {
  if (!fs.existsSync(CACHE_PATH)) return;
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  const keys = Object.keys(cache);
  let done = 0;
  for (const trText of keys) {
    const row = cache[trText];
    const en = row.en || row["en-US"] || trText;
    if (row.pl && row.pl !== en && row.pl !== trText) {
      done++;
      continue;
    }
    try {
      row.pl = await ensurePl(en, plCache, "err:" + row.code);
      done++;
      if (done % 10 === 0) console.log(" errors", done, "/", keys.length);
      await sleep(400);
    } catch (err) {
      console.warn(" err fail", row.code, err.message);
      row.pl = en;
    }
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  console.log("i18n-cache.json updated");
}

async function fillMessageTemplates(plCache) {
  if (!fs.existsSync(TEMPLATES_PATH)) return;
  const store = JSON.parse(fs.readFileSync(TEMPLATES_PATH, "utf8"));
  const keys = Object.keys(store);
  for (const k of keys) {
    const tpl = store[k];
    const en = tpl.en || tpl["en-US"] || tpl.tr;
    if (tpl.pl && tpl.pl !== en) continue;
    try {
      tpl.pl = await ensurePl(en, plCache, "tpl:" + k.slice(0, 48));
      await sleep(400);
    } catch (err) {
      console.warn(" tpl fail", k.slice(0, 40), err.message);
      tpl.pl = en;
    }
  }
  fs.writeFileSync(TEMPLATES_PATH, JSON.stringify(store, null, 2), "utf8");
  console.log("message-templates.json updated");
}

function regenerateErrorsModule() {
  const genPath = path.join(__dirname, "generate-errors-module.js");
  let genSrc = fs.readFileSync(genPath, "utf8");
  if (!genSrc.includes('"pl"')) {
    genSrc = genSrc.replace(
      '"cs", "el", "ru"',
      '"cs", "pl", "el", "ru"'
    );
    fs.writeFileSync(genPath, genSrc, "utf8");
  }
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  const { generate } = require("./generate-errors-module");
  generate(cache);
  console.log("game/errors.js + catalog.js regenerated");
}

async function main() {
  const plCache = loadPlCache();
  await fillUiLocales(plCache);
  await fillErrorCache(plCache);
  await fillMessageTemplates(plCache);
  regenerateErrorsModule();
  savePlCache(plCache);
  console.log("Polish translation complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
