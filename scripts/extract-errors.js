/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN = ["game", "routes", "services"];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp, out);
    else if (ent.name.endsWith(".js")) out.push(fp);
  }
  return out;
}

function slugify(s) {
  return s
    .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .toUpperCase() || "ERR";
}

const re = /error:\s*["'`]([^"'`]+)["'`]/g;
const map = new Map();

for (const dir of SCAN) {
  for (const file of walk(path.join(ROOT, dir))) {
    const content = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(content))) {
      const msg = m[1].trim();
      if (!map.has(msg)) {
        let code = slugify(msg);
        let n = 1;
        while ([...map.values()].some((v) => v.code === code)) {
          code = slugify(msg) + "_" + n++;
        }
        map.set(msg, { code, msg });
      }
    }
  }
}

const list = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
console.log("errors", list.length);
fs.writeFileSync(path.join(ROOT, "scripts/errors-raw.json"), JSON.stringify(list, null, 2), "utf8");
