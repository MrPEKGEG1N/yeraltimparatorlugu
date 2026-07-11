#!/usr/bin/env node
/**
 * Northflank Sandbox (ucretsiz) — volume YOK, nf-compute-10, Supabase yedek.
 * Sandbox: 2 ucretsiz servis; volume ayri ucretlidir, sandbox'ta atlanir.
 *
 * Kullanim: node tools/provision-northflank.js
 *           node tools/provision-northflank.js --volume   (ucretli volume ile)
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PROJECT_ID = "yeralti-imparatorlugu";
const SERVICE_NAME = "yeralti-game";
const SANDBOX = !process.argv.includes("--volume");
const COMPUTE_PLAN = SANDBOX ? "nf-compute-10" : "nf-compute-20";

function nf(args) {
  const r = spawnSync("npx", ["--yes", "@northflank/cli", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`northflank ${args.join(" ")}\n${(r.stderr || r.stdout || "").trim()}`);
  }
  const out = (r.stdout || "").trim();
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
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

function failPayment() {
  console.error("\n[nf] Northflank Sandbox icin bile kart dogrulamasi gerekli (ucret cekilmez).");
  console.error("     1. https://app.northflank.com/t/mrpekgeg1ns-team/billing → kart ekle");
  console.error("     2. Plan: Developer Sandbox (ucretsiz) secili olsun");
  console.error("     3. npm run provision:northflank");
  process.exit(2);
}

function main() {
  const rw = railwayVars();
  const supabaseUrl = process.env.SUPABASE_URL || rw.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || rw.SUPABASE_SERVICE_ROLE_KEY;
  const jwt = process.env.JWT_SECRET || rw.JWT_SECRET || "yeralti-dev-gizli-anahtar-degistir";

  console.log(`[nf] Mod: ${SANDBOX ? "SANDBOX (ucretsiz, volume yok)" : "VOLUME + compute-20"}`);
  console.log(`[nf] Compute plan: ${COMPUTE_PLAN}`);

  let volumeId = null;
  if (!SANDBOX) {
    const volFile = path.join(ROOT, "northflank", "volume.generated.json");
    fs.writeFileSync(
      volFile,
      JSON.stringify({
        name: "yeralti-db",
        mounts: [{ containerMountPath: "/data" }],
        spec: { storageSize: 1024 },
      }),
      "utf8"
    );
    console.log("[nf] Volume olusturuluyor...");
    try {
      const volume = nf(["create", "volume", "--projectId", PROJECT_ID, "-f", volFile, "-o", "json"]);
      volumeId = volume?.id || volume?.name;
    } catch (e) {
      const msg = String(e);
      if (/payment method/i.test(msg)) failPayment();
      if (!/already|409|exists/i.test(msg)) throw e;
      volumeId = "yeralti-db";
    }
    console.log("[nf] Volume:", volumeId);
  } else {
    console.log("[nf] Volume atlandi — oyuncu verisi Supabase + seed ile korunur.");
  }

  const runtimeEnvironment = {
    NODE_ENV: "production",
    PORT: "3000",
    ADMIN_USERNAME: "mrpekgeg1n",
    JWT_SECRET: jwt,
    ...(supabaseUrl ? { SUPABASE_URL: supabaseUrl } : {}),
    ...(supabaseKey ? { SUPABASE_SERVICE_ROLE_KEY: supabaseKey } : {}),
  };
  if (!SANDBOX) runtimeEnvironment.PERSISTENT_DATA_PATH = "/data";

  const serviceDef = {
    name: SERVICE_NAME,
    description: "Yeralti Imparatorlugu Sandbox",
    billing: {
      deploymentPlan: COMPUTE_PLAN,
      buildPlan: COMPUTE_PLAN,
    },
    deployment: {
      instances: 1,
      docker: { configType: "default" },
      storage: { ephemeralStorage: { storageSize: 1024 } },
    },
    ports: [
      {
        name: "http",
        internalPort: 3000,
        public: true,
        protocol: "HTTP",
      },
    ],
    buildSource: "git",
    vcsData: {
      projectUrl: "https://github.com/MrPEKGEG1N/yeraltimparatorlugu",
      projectType: "github",
      projectBranch: "main",
      accountLogin: "MrPEKGEG1N",
    },
    buildSettings: {
      dockerfile: {
        dockerFilePath: "/Dockerfile",
        dockerWorkDir: "/",
        buildEngine: "buildkit",
      },
    },
    healthChecks: [
      {
        protocol: "HTTP",
        type: "readinessProbe",
        path: "/api/health",
        port: 3000,
        initialDelaySeconds: 45,
        periodSeconds: 30,
        timeoutSeconds: 10,
        failureThreshold: 5,
        successThreshold: 1,
      },
    ],
    runtimeEnvironment,
  };

  if (volumeId) {
    serviceDef.createOptions = { volumesToAttach: [volumeId] };
  }

  const defFile = path.join(ROOT, "northflank", "combined-service.generated.json");
  fs.writeFileSync(defFile, JSON.stringify(serviceDef, null, 2));

  console.log("[nf] Combined service olusturuluyor...");
  let service;
  try {
    service = nf(
      ["create", "service", "combined", "--projectId", PROJECT_ID, "-f", defFile, "-o", "json"]
    );
  } catch (e) {
    const msg = String(e);
    if (/payment method/i.test(msg)) failPayment();
    if (!/already|409|exists/i.test(msg)) throw e;
    console.log("[nf] Servis guncelleniyor...");
    service = nf(
      [
        "patch",
        "service",
        "combined",
        "--projectId",
        PROJECT_ID,
        "--serviceId",
        SERVICE_NAME,
        "-f",
        defFile,
        "-o",
        "json",
      ]
    );
  }

  console.log("\n[nf] Kurulum tamam.");
  console.log(JSON.stringify({ mode: SANDBOX ? "sandbox" : "volume", projectId: PROJECT_ID, service }, null, 2));

  try {
    const info = nf(["get", "service", "--projectId", PROJECT_ID, "--serviceId", SERVICE_NAME, "-o", "json"]);
    const ports = info?.ports || info?.data?.ports || [];
    const pub = ports.find((p) => p.public);
    const domain = pub?.domains?.[0] || pub?.dns;
    if (domain) console.log("\nPUBLIC_URL=https://" + domain.replace(/^https?:\/\//, ""));
  } catch (_) {}
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
