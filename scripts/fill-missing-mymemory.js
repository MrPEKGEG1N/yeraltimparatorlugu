/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "i18n-cache.json");
const LANGS = ["en", "en-US", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "ro", "cs", "el", "ru", "zh", "ar"];
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

function needs(row, lang) {
  const v = row[lang];
  if (!v || v === row.tr) return true;
  if (lang !== "en" && lang !== "en-US") {
    const en = row.en;
    if (en && en !== row.tr && v === en) return true;
  }
  return false;
}

async function mm(text, from, to) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 480)) +
    "&langpair=" +
    encodeURIComponent(from + "|" + to);
  const res = await fetch(url);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || "fail");
  return data.responseData.translatedText;
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  let done = 0;
  let fail = 0;

  for (const [trText, row] of Object.entries(cache)) {
    if (!row.tr) continue;
    for (const lang of LANGS) {
      if (!needs(row, lang)) continue;
      const src = row.en && row.en !== row.tr && lang !== "en" && lang !== "en-US" ? row.en : row.tr;
      const from = src === row.tr ? "tr-TR" : "en-GB";
      const to = MYMEMORY[lang] || lang;
      try {
        row[lang] = await mm(src, from, to);
        if (lang === "en") row["en-US"] = row.en;
        done++;
        process.stdout.write(".");
        await sleep(2800);
      } catch (err) {
        fail++;
        if (/MYMEMORY WARNING|429|quota/i.test(String(err.message))) {
          console.warn("\nquota hit, saving and stopping");
          fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
          require("./generate-errors-module").generate(cache);
          console.log("\npartial done", done, "fail", fail);
          return;
        }
        await sleep(3500);
      }
    }
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  require("./generate-errors-module").generate(cache);
  console.log("\ndone", done, "fail", fail);
}

main().catch(console.error);
