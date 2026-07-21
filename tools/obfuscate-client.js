/**
 * Üretim için isteğe bağlı istemci kodu karartma.
 * Kullanım: npm run security:obfuscate
 * Not: onclick="" handler'ları nedeniyle tüm script.js karartılmaz; guard dosyaları hedeflenir.
 */
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "..", "public");
const TARGETS = ["security-guard.js", "security.js"];

function obfuscateSource(code) {
  const encoded = Buffer.from(code, "utf8").toString("base64");
  return `(function(){var s=atob(${JSON.stringify(encoded)});(0,eval)(s);})();`;
}

for (const file of TARGETS) {
  const srcPath = path.join(PUBLIC, file);
  const outPath = path.join(PUBLIC, file.replace(/\.js$/, ".obf.js"));
  const src = fs.readFileSync(srcPath, "utf8");
  fs.writeFileSync(outPath, obfuscateSource(src), "utf8");
  console.log("Wrote", path.relative(process.cwd(), outPath));
}
