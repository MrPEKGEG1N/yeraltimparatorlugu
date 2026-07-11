#!/usr/bin/env node
/**
 * Koyeb Hobby (ucretsiz) deploy — kart gerektirmez (cogu bolgede).
 * Supabase yedek + seed ile oyuncu verisi korunur (volume yok).
 *
 * Once: tools/bin/koyeb.exe login
 * Sonra: npm run provision:koyeb
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const KOYEB = path.join(ROOT, "tools", "bin", "koyeb.exe");
const APP = "yeralti-imparatorlugu";
const SERVICE = "yeralti-game";

function koyeb(args) {
  const r = spawnSync(KOYEB, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`koyeb ${args.join(" ")}\n${(r.stderr || r.stdout || "").trim()}`);
  }
  return (r.stdout || "").trim();
}

function railwayVars() {
  const r = spawnSync("npx", ["--yes", "@railway/cli", "variables", "--json"], {
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) return {};
  try {
    return JSON.parse(r.stdout);
  } catch {
    return {};
  }
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(KOYEB)) {
    console.error("[koyeb] CLI yok. Once: npm run setup:koyeb");
    process.exit(1);
  }

  const rw = railwayVars();
  const envFlags = [
    ["NODE_ENV", "production"],
    ["PORT", "3000"],
    ["ADMIN_USERNAME", "mrpekgeg1n"],
    ["JWT_SECRET", process.env.JWT_SECRET || rw.JWT_SECRET || "yeralti-dev-gizli-anahtar-degistir"],
    ["SUPABASE_URL", process.env.SUPABASE_URL || rw.SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY || rw.SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, v]) => v);

  const envArgs = envFlags.flatMap(([k, v]) => ["--env", `${k}=${v}`]);

  console.log("[koyeb] Hobby plan — Frankfurt, docker, Supabase yedek");

  const appsRaw = koyeb(["apps", "list", "-o", "json"]);
  const apps = parseJsonSafe(appsRaw);
  const exists = Array.isArray(apps) && apps.some((a) => a.name === APP || a.id === APP);

  if (!exists) {
    console.log("[koyeb] App + service olusturuluyor (GitHub)...");
    koyeb([
      "app",
      "init",
      APP,
      "--git",
      "github.com/MrPEKGEG1N/yeraltimparatorlugu",
      "--git-branch",
      "main",
      "--git-builder",
      "docker",
      "--instance-type",
      "free",
      "--regions",
      "fra",
      "--ports",
      "3000:http",
      "--routes",
      "/:3000",
      "--checks",
      "3000:http:/api/health",
      ...envArgs,
    ]);
  } else {
    console.log("[koyeb] Servis guncelleniyor...");
    try {
      koyeb([
        "service",
        "update",
        `${APP}/${SERVICE}`,
        "--git",
        "github.com/MrPEKGEG1N/yeraltimparatorlugu",
        "--git-branch",
        "main",
        "--git-builder",
        "docker",
        "--instance-type",
        "free",
        "--regions",
        "fra",
        ...envArgs,
      ]);
    } catch {
      koyeb(["service", "redeploy", `${APP}/${SERVICE}`]);
    }
  }

  console.log("[koyeb] Deploy baslatildi. URL icin:");
  console.log(`  ${KOYEB} services list`);
  console.log(`  ${KOYEB} service get ${APP}/${SERVICE}`);
}

try {
  main();
} catch (err) {
  const msg = String(err.message || err);
  if (/configuration file|login/i.test(msg)) {
    console.error("\n[koyeb] Once giris yapin:");
    console.error("  tools\\bin\\koyeb.exe login");
    console.error("  npm run provision:koyeb");
    process.exit(2);
  }
  console.error(msg);
  process.exit(1);
}
