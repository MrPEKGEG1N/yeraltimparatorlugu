const fs = require("fs");
const path = require("path");
const data = require("./game-ui-i18n-data");

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const localesPath = path.join(__dirname, "..", "public", "i18n", "locales.js");
let src = fs.readFileSync(localesPath, "utf8");
const marker = '    row("mafya.olustur"';

const keys = Object.keys(data).sort();
const missing = keys.filter(function (key) {
  return src.indexOf('row("' + key + '"') < 0;
});

if (!missing.length) {
  console.log("All", keys.length, "game-ui keys already present");
  process.exit(0);
}

const rows = missing
  .map(function (key) {
    const vals = data[key].map(esc).map(function (v) {
      return '"' + v + '"';
    });
    return '    row("' + key + '", [' + vals.join(", ") + "]),";
  })
  .join("\n");

if (src.indexOf(marker) < 0) throw new Error("marker not found");
src = src.replace(marker, rows + "\n\n" + marker);
fs.writeFileSync(localesPath, src, "utf8");
console.log("Inserted", missing.length, "missing game-ui locale keys (of", keys.length, "total)");
