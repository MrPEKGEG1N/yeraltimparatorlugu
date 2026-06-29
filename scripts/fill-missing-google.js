/* eslint-disable no-console */
/** Fill missing cache translations via Google Translate (slow, avoids burst rate limits) */
const fs = require("fs");
const path = require("path");
const { translate } = require("google-translate-api-x");

const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const LANGS = ["en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];
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

function needs(row, lang) {
  const v = row[lang];
  if (!v || v === row.tr) return true;
  if (lang !== "en" && lang !== "en-US") {
    const en = row.en;
    if (en && en !== row.tr && v === en) return true;
  }
  return false;
}

async function tr(text, lang, from) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await translate(text, {
        from,
        to: GOOGLE_TO[lang] || lang,
        rejectOnPartialFail: false,
        forceTo: true,
      });
      if (res && res.text) return res.text;
    } catch (err) {
      if (/too many|429/i.test(String(err.message))) await sleep(20000 + i * 10000);
    }
    await sleep(2000);
  }
  throw new Error("translate failed");
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  let done = 0;
  let fail = 0;
  const entries = Object.entries(cache);

  for (let i = 0; i < entries.length; i++) {
    const [trText, row] = entries[i];
    if (!row.tr) continue;

    for (const lang of LANGS) {
      if (!needs(row, lang)) continue;
      const useEn = row.en && row.en !== row.tr && lang !== "en" && lang !== "en-US";
      const src = useEn ? row.en : row.tr;
      const from = useEn ? "en" : "tr";
      try {
        row[lang] = await tr(src, lang, from);
        if (lang === "en") row["en-US"] = row.en;
        done++;
        process.stdout.write(".");
      } catch {
        fail++;
        process.stdout.write("x");
      }
      await sleep(8000);
    }

    if ((i + 1) % 3 === 0) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
      require("./generate-errors-module").generate(cache);
    }
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  require("./generate-errors-module").generate(cache);
  console.log("\ndone", done, "fail", fail);
}

main().catch(console.error);
