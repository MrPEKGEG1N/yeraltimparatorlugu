/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { generate } = require("./generate-errors-module");

const ROOT = path.join(__dirname, "..");
const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const MANUAL_PATH = path.join(__dirname, "manual-missing-translations.json");
const LANGS = ["en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  const manual = JSON.parse(fs.readFileSync(MANUAL_PATH, "utf8"));
  let updated = 0;
  let skipped = 0;

  for (const [trKey, langs] of Object.entries(manual)) {
    const row = cache[trKey];
    if (!row) {
      console.warn("skip (not in cache):", trKey.slice(0, 60));
      skipped++;
      continue;
    }
    let touched = false;
    for (const lang of LANGS) {
      if (langs[lang]) {
        row[lang] = langs[lang];
        touched = true;
      }
    }
    if (touched) updated++;
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");
  const r = generate(cache);
  console.log("updated entries:", updated);
  console.log("skipped keys:", skipped);
  console.log("catalog", r.catalog, "templates", r.templates);
}

if (require.main === module) main();

module.exports = { main };
