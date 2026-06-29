/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { translate } = require("google-translate-api-x");

const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const MISSING = JSON.parse(fs.readFileSync(path.join(__dirname, "missing-de.json"), "utf8"));
const LANGS = ["en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];
const GOOGLE_TO = { en: "en", de: "de", fr: "fr", es: "es", it: "it", pt: "pt", "pt-BR": "pt", nl: "nl", ro: "ro", cs: "cs", el: "el", ru: "ru", zh: "zh-CN", ar: "ar" };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function one(text, lang, from) {
  const res = await translate(text, { from, to: GOOGLE_TO[lang] || lang, rejectOnPartialFail: false, forceTo: true });
  if (!res || !res.text) throw new Error("empty");
  return res.text;
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  let done = 0;

  for (let i = 0; i < MISSING.length; i++) {
    const trText = MISSING[i];
    if (!cache[trText]) cache[trText] = { tr: trText, code: "MISSING_" + i };
    const row = cache[trText];

    try {
      if (!row.en || row.en === row.tr) {
        row.en = await one(trText, "en", "tr");
        row["en-US"] = row.en;
        await sleep(6000);
      }
      for (const lang of LANGS) {
        if (lang === "en" || lang === "en-US") continue;
        if (row[lang] && row[lang] !== row.tr && row[lang] !== row.en) continue;
        row[lang] = await one(row.en, lang, "en");
        done++;
        process.stdout.write(".");
        await sleep(6000);
      }
    } catch (err) {
      console.warn("\nfail", trText.slice(0, 40), err.message);
      await sleep(15000);
    }

    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
    require("./generate-errors-module").generate(cache);
  }

  console.log("\nfinished", done);
}

main().catch(console.error);
