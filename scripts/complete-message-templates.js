/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { translate } = require("google-translate-api-x");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "message-templates.json");
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

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVars(tr) {
  const vars = [];
  const re = /\$\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(tr))) vars.push(m[1]);
  return vars;
}

function buildRegex(tr) {
  let pattern = "^";
  let last = 0;
  const re = /\$\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(tr))) {
    pattern += escapeRe(tr.slice(last, m.index));
    pattern += "(.+?)";
    last = m.index + m[0].length;
  }
  pattern += escapeRe(tr.slice(last)) + "$";
  return pattern;
}

function applyVars(template, vars, values) {
  let out = template;
  vars.forEach((v, i) => {
    out = out.split("${" + v + "}").join(values[i] || "");
  });
  return out;
}

function protectPlaceholders(text) {
  const map = [];
  let i = 0;
  const out = text.replace(/\$\{([^}]+)\}/g, (m) => {
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

function scanTemplates() {
  const found = new Set();
  const gameDir = path.join(ROOT, "game");
  const re = /mesaj:\s*`([^`]+)`/g;

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(fp);
      else if (ent.name.endsWith(".js")) {
        const content = fs.readFileSync(fp, "utf8");
        let m;
        while ((m = re.exec(content))) {
          if (/[çğıöşüÇĞİÖŞÜ]/.test(m[1]) || /\$\{/.test(m[1])) found.add(m[1]);
        }
      }
    }
  }
  walk(gameDir);
  return [...found];
}

async function translateTemplate(tr, lang) {
  const { out, map } = protectPlaceholders(tr);
  const res = await translate(out, {
    from: "tr",
    to: GOOGLE_TO[lang] || lang,
    rejectOnPartialFail: false,
    forceTo: true,
  });
  return restore(res.text, map);
}

async function main() {
  const list = scanTemplates();
  let store = {};
  if (fs.existsSync(OUT)) store = JSON.parse(fs.readFileSync(OUT, "utf8"));

  console.log("templates", list.length);

  for (const tr of list) {
    if (!store[tr]) {
      store[tr] = { tr, vars: extractVars(tr), pattern: buildRegex(tr) };
    }
    const row = store[tr];
    row.vars = extractVars(tr);
    row.pattern = buildRegex(tr);

    for (const lang of TARGETS) {
      if (row[lang] && row[lang] !== row.tr) continue;
      try {
        row[lang] = await translateTemplate(tr, lang);
        if (lang === "en") row["en-US"] = row.en;
        process.stdout.write(".");
        await sleep(200);
      } catch (err) {
        console.warn("\nfail", lang, tr.slice(0, 40), err.message);
        row[lang] = row.en || row.tr;
      }
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(store, null, 2), "utf8");
  console.log("\nsaved", OUT);
  if (fs.existsSync(path.join(__dirname, "i18n-cache.json"))) {
    const { generate } = require("./generate-errors-module");
    const cache = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n-cache.json"), "utf8"));
    generate(cache);
    console.log("regenerated game/errors.js + catalog.js");
  }
}

main().catch(console.error);
