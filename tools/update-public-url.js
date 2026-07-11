#!/usr/bin/env node
/**
 * Tum Railway URL referanslarini yeni PUBLIC_BASE_URL ile gunceller.
 * Kullanim: node tools/update-public-url.js https://xxx.code.run
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OLD = "yeraltimparatorlugu-production.up.railway.app";
const FILES = [
  "capacitor.config.js",
  "tools/verify-dd1.js",
  "tools/fetch-live.js",
  "tools/test-prod-admin-http.js",
  "tools/setup-persistence.ps1",
  "tools/setup-supabase-backup.ps1",
  "tools/setup-railway-volume.ps1",
  "tools/build-share-apk.ps1",
  "tools/deploy-railway.ps1",
  "tools/run-android-debug.ps1",
  "tools/build-release-full.ps1",
  "tools/prepare-google-play.ps1",
  "tools/google-play-store-listing.txt",
  "public/kurallar/kurallar.json",
  "android/app/src/main/assets/capacitor.config.json",
  "northflank/env.runtime.example",
  "render/DEPLOY.md",
];

function main() {
  let base = process.argv[2] || process.env.PUBLIC_BASE_URL || "";
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base.replace(/^https?:\/\//, "");
  const host = new URL(base).host;

  let changed = 0;
  for (const rel of FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, "utf8");
    const after = before.split(OLD).join(host).split("https://" + host).join(base).replace(
      new RegExp(`https://${host.replace(/\./g, "\\.")}(?!/)`, "g"),
      (m, offset, str) => {
        const next = str[offset + m.length];
        if (next === "/" || next === '"' || next === "'" || next === "`") return base;
        return m;
      }
    );
    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      console.log("[url] guncellendi:", rel);
      changed++;
    }
  }
  console.log(`\n[url] ${changed} dosya guncellendi. PUBLIC_BASE_URL=${base}`);
}

main();
