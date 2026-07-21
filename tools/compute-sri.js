const crypto = require("crypto");
const https = require("https");

const urls = [
  "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js",
  "https://openfpcdn.io/fingerprintjs/v4/iife.min.js",
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

(async () => {
  for (const url of urls) {
    const buf = await fetch(url);
    const hash = crypto.createHash("sha384").update(buf).digest("base64");
    console.log(`${url}\n  integrity="sha384-${hash}"\n  size=${buf.length}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
