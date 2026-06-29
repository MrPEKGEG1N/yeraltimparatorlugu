/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = ["public", "game", "routes", "services"];
const SKIP = new Set(["node_modules", "i18n", "admin", "images"]);

const TR_RE = /[\u00C0-\u024F\u0400-\u04FF\u0600-\u06FFa-zA-Z0-9][\u00C0-\u024F\u0400-\u04FF\u0600-\u06FFa-zA-Z0-9\s.,!?;:…—–\-+'"%()/\[\]₺⚔️👑🕶️📜💼🏢🎯💀⚖️📖🕵️📰📄💬📬🔄🏦⭐💪🏠👤⏳📱🛡️💵🏛️✦🔍🚩×]+/u;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp, out);
    else if (ent.name.endsWith(".js") || ent.name.endsWith(".html")) out.push(fp);
  }
  return out;
}

function extractFromContent(content) {
  const found = new Set();
  const patterns = [
    /toast\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /confirm\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /prompt\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /error:\s*['"`]([^'"`]+)['"`]/g,
    /mesaj:\s*['"`]([^'"`]+)['"`]/g,
    /data-i18n(?:-placeholder|-title|-tip|-aria)?=(?:"([^"]+)"|'([^']+)')/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) {
      const s = (m[1] || m[2] || "").trim();
      if (s.length >= 2 && /[çğıöşüÇĞİÖŞÜ]/.test(s)) found.add(s);
    }
  }
  const litRe = /['"`]([^'"`\n]{4,120})['"`]/g;
  let m;
  while ((m = litRe.exec(content))) {
    const s = m[1].trim();
    if (/[çğıöşüÇĞİÖŞÜ]/.test(s) && !/^[a-z_\-./:]+$/i.test(s) && !s.includes("${")) {
      found.add(s);
    }
  }
  return found;
}

const all = new Set();
for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    if (file.includes("locales.js") || file.includes("dynamic.js")) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const s of extractFromContent(content)) all.add(s);
  }
}

const list = [...all].sort((a, b) => a.localeCompare(b, "tr"));
console.log("phrases", list.length);
fs.writeFileSync(path.join(ROOT, "scripts/phrases-raw.json"), JSON.stringify(list, null, 2), "utf8");
