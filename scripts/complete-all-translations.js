/* eslint-disable no-console */
/**
 * Completes all missing error-catalog translations via google-translate-api-x.
 * Skips langs already translated (not equal to tr or en fallback).
 */
const fs = require("fs");
const path = require("path");
const { translate } = require("google-translate-api-x");

const ROOT = path.join(__dirname, "..");
const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const LANGS = ["tr", "en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];
const TARGETS = LANGS.filter((l) => l !== "tr");

const GOOGLE_TO = {
  en: "en",
  "en-US": "en",
  de: "de",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  "pt-BR": "pt",
  nl: "nl",
  ro: "ro",
  cs: "cs",
  el: "el",
  ru: "ru",
  zh: "zh-CN",
  ar: "ar",
};

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

function needsTranslation(row, lang) {
  const val = row[lang];
  if (!val || val === row.tr) return true;
  if (lang === "en" || lang === "en-US") return false;
  const en = row.en || row["en-US"];
  if (en && en !== row.tr && val === en) return true;
  return false;
}

function writeOutputs(cache) {
  const { generate } = require("./generate-errors-module");
  const r = generate(cache);
  return r.catalog;
}

async function translateRow(trText, lang, sourceText) {
  const src = sourceText || trText;
  const { out, map } = protectPlaceholders(src);
  const to = GOOGLE_TO[lang] || lang;
  const from = src === trText ? "tr" : "en";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await translate(out, {
        from,
        to,
        rejectOnPartialFail: false,
        forceTo: true,
      });
      if (res && res.text) return restore(res.text, map);
    } catch (err) {
      if (/too many|429|rate/i.test(String(err.message))) await sleep(15000 + attempt * 5000);
    }
    await sleep(800 * (attempt + 1));
  }
  throw new Error("Too Many Requests");
}

async function main() {
  const errorsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, "errors-raw.json"), "utf8"));
  const cache = loadCache();

  for (const e of errorsRaw) {
    if (!cache[e.msg]) cache[e.msg] = { code: e.code, tr: e.msg };
    else cache[e.msg].code = e.code;
  }

  // Mekan yedek verisi (tr() ile kullanılıyor)
  try {
    const mekanPath = path.join(ROOT, "public/mekanlar-data.js");
    const src = fs.readFileSync(mekanPath, "utf8");
    const re = /(?:ad|aciklama):\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      const msg = m[1];
      if (!cache[msg]) cache[msg] = { code: "UI_MEKAN_" + msg.slice(0, 20).replace(/\W+/g, "_").toUpperCase(), tr: msg };
    }
  } catch (_) {}

  // Sunucu başarı mesajları (sabit metinler)
  const gameDir = path.join(ROOT, "game");
  const mesajRe = /mesaj:\s*"([^"]+)"/g;
  function scanGame(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name);
      if (ent.isDirectory()) scanGame(fp);
      else if (ent.name.endsWith(".js")) {
        const content = fs.readFileSync(fp, "utf8");
        let mm;
        while ((mm = mesajRe.exec(content))) {
          const msg = mm[1];
          if (/[çğıöşüÇĞİÖŞÜ]/.test(msg) && !cache[msg]) {
            cache[msg] = {
              code: "MSG_" + msg.slice(0, 30).replace(/\W+/g, "_").toUpperCase(),
              tr: msg,
            };
          }
        }
      }
    }
  }
  scanGame(gameDir);

  let done = 0;
  let skipped = 0;
  let failed = 0;
  const entries = Object.entries(cache);

  for (let i = 0; i < entries.length; i++) {
    const [trText, row] = entries[i];

    for (const lang of TARGETS) {
      if (!needsTranslation(row, lang)) {
        skipped++;
        continue;
      }
      try {
        const srcEn = row.en && row.en !== row.tr ? row.en : null;
        const source = lang === "en" || lang === "en-US" || !srcEn ? trText : srcEn;
        row[lang] = await translateRow(trText, lang, source);
        if (lang === "en") row["en-US"] = row.en;
        done++;
        process.stdout.write(".");
        await sleep(1200);
      } catch (err) {
        failed++;
        const msg = err.message || "";
        if (/too many|429|rate/i.test(msg)) await sleep(8000);
        console.warn("\nfail", lang, trText.slice(0, 36), msg.slice(0, 60));
        await sleep(800);
      }
    }

    if ((i + 1) % 5 === 0) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
      writeOutputs(cache);
    }
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  const n = writeOutputs(cache);
  console.log("\nentries", n, "translated", done, "skipped", skipped, "failed", failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
