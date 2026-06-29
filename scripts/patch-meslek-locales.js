const fs = require("fs");
const path = require("path");
const data = require("./meslek-i18n-data");

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const rows = Object.keys(data)
  .sort()
  .map(function (key) {
    const vals = data[key].map(esc).map(function (v) {
      return '"' + v + '"';
    });
    return '    row("' + key + '", [' + vals.join(", ") + "]),";
  })
  .join("\n");

const localesPath = path.join(__dirname, "..", "public", "i18n", "locales.js");
let src = fs.readFileSync(localesPath, "utf8");
const marker = '    row("mafya.olustur"';
if (src.indexOf('row("meslek.loading"') >= 0) {
  console.log("meslek keys already present");
  process.exit(0);
}
if (src.indexOf(marker) < 0) throw new Error("marker not found");
src = src.replace(marker, rows + "\n\n" + marker);
fs.writeFileSync(localesPath, src, "utf8");
console.log("Inserted", Object.keys(data).length, "meslek locale keys");
