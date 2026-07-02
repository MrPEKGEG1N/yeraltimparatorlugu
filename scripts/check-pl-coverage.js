const fs = require("fs");
const src = fs.readFileSync("public/i18n/locales.js", "utf8");
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
const parsed = [];
const re = /row\("([^"]+)",\s*\[([^\]]*)\]\)/g;
let m;
while ((m = re.exec(src))) parsed.push(m[1]);
const all = [];
const re2 = /row\("([^"]+)"/g;
while ((m = re2.exec(src))) all.push(m[1]);
const missing = all.filter((k) => !parsed.includes(k));
console.log("parsed", parsed.length, "total", all.length, "missing", missing.length);
if (missing.length) console.log(missing.join("\n"));

const g = { global: {} };
require("vm").runInNewContext(src.replace("window", "global"), g);
const pl = g.global.I18N_LOCALES.pl;
const en = g.global.I18N_LOCALES.en;
const same = Object.keys(en).filter((k) => pl[k] === en[k]);
console.log("pl same as en:", same.length);
if (same.length < 30) console.log(same.join("\n"));
