/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { translate } = require("google-translate-api-x");

const LOCALES_PATH = path.join(__dirname, "..", "public/i18n/locales.js");
const PL_CACHE_PATH = path.join(__dirname, "pl-locale-cache.json");
const PL_INDEX = 16;

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

function parseRowLine(line) {
  const keyM = line.match(/row\("([^"]+)"/);
  if (!keyM) return null;
  const start = line.indexOf("[");
  const end = line.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  return { key: keyM[1], vals: parseStringArray(line.slice(start + 1, end)) };
}

function formatRow(key, vals) {
  while (vals.length <= PL_INDEX) vals.push(vals[1] || vals[0] || "");
  return `    row("${key}", [${vals.slice(0, PL_INDEX + 1).map((v) => `"${esc(v)}"`).join(", ")}]),`;
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

async function trPl(text) {
  const { out, map } = protectPlaceholders(text);
  const res = await translate(out, { from: "en", to: "pl", rejectOnPartialFail: false, forceTo: true });
  return restorePlaceholders(res.text, map);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const plCache = fs.existsSync(PL_CACHE_PATH)
    ? JSON.parse(fs.readFileSync(PL_CACHE_PATH, "utf8"))
    : {};
  const lines = fs.readFileSync(LOCALES_PATH, "utf8").split("\n");
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = parseRowLine(lines[i]);
    if (!row || row.vals.length > PL_INDEX) continue;
    const en = row.vals[1] || row.vals[0];
    const cacheKey = "ui:" + row.key;
    try {
      row.vals[PL_INDEX] = plCache[cacheKey] || (await trPl(en));
      plCache[cacheKey] = row.vals[PL_INDEX];
      lines[i] = formatRow(row.key, row.vals);
      n++;
      console.log(n, row.key, "->", row.vals[PL_INDEX]);
      await sleep(500);
    } catch (err) {
      console.warn("fail", row.key, err.message);
      row.vals[PL_INDEX] = en;
      lines[i] = formatRow(row.key, row.vals);
    }
  }
  fs.writeFileSync(LOCALES_PATH, lines.join("\n"), "utf8");
  fs.writeFileSync(PL_CACHE_PATH, JSON.stringify(plCache, null, 2), "utf8");
  console.log("patched", n, "rows");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
