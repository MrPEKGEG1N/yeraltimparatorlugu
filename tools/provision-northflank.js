#!/usr/bin/env node
/**
 * Northflank proje + volume + combined service kurulumu (CLI token kullanir).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PROJECT_ID = "yeralti-imparatorlugu";
const SERVICE_NAME = "yeralti-game";

function nf(args, input) {
  const r = spawnSync("npx", ["--yes", "@northflank/cli", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    input: input ? JSON.stringify(input) : undefined,
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim();
    throw new Error(`northflank ${args.join(" ")}\n${err}`);
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

function main() {
  const rw = railwayVars();
  const supabaseUrl = process.env.SUPABASE_URL || rw.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || rw.SUPABASE_SERVICE_ROLE_KEY;
  const jwt = process.env.JWT_SECRET || rw.JWT_SECRET || "yeralti-dev-gizli-anahtar-degistir";

  console.log("[nf] Volume olusturuluyor...");
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
  let volume;
  try {
    volume = nf(
      ["create", "volume", "--projectId", PROJECT_ID, "-f", volFile, "-o", "json"]
    );
  } catch (e) {
    const msg = String(e);
    if (/payment method/i.test(msg)) {
      console.error("\n[nf] Northflank odeme yontemi gerekli.");
      console.error("     https://app.northflank.com/t/mrpekgeg1ns-team/billing");
      console.error("     Kart ekledikten sonra: npm run provision:northflank");
      process.exit(2);
    }
    if (!/already|409|exists/i.test(msg)) throw e;
    console.log("[nf] Volume zaten var, devam...");
    volume = { id: "yeralti-db", name: "yeralti-db" };
  }
  const volumeId = volume?.id || volume?.name || "yeralti-db";
  console.log("[nf] Volume:", volumeId);

  const serviceDef = {
    name: SERVICE_NAME,
    description: "Yeralti Imparatorlugu oyun sunucusu",
    billing: {
      deploymentPlan: "nf-compute-20",
      buildPlan: "nf-compute-20",
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
    runtimeEnvironment: {
      PERSISTENT_DATA_PATH: "/data",
      NODE_ENV: "production",
      PORT: "3000",
      ADMIN_USERNAME: "mrpekgeg1n",
      JWT_SECRET: jwt,
      ...(supabaseUrl ? { SUPABASE_URL: supabaseUrl } : {}),
      ...(supabaseKey ? { SUPABASE_SERVICE_ROLE_KEY: supabaseKey } : {}),
    },
    createOptions: {
      volumesToAttach: [volumeId],
    },
  };

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
    if (/payment method/i.test(msg)) {
      console.error("\n[nf] Northflank odeme yontemi gerekli.");
      console.error("     https://app.northflank.com/t/mrpekgeg1ns-team/billing");
      console.error("     Kart ekledikten sonra: node tools/provision-northflank.js");
      process.exit(2);
    }
    if (!/already|409|exists/i.test(msg)) throw e;
    console.log("[nf] Servis zaten var, patch deneniyor...");
    service = nf(
      ["patch", "service", "combined", "--projectId", PROJECT_ID, "--serviceId", SERVICE_NAME, "-f", defFile, "-o", "json"]
    );
  }

  console.log("\n[nf] Kurulum tamam.");
  console.log(JSON.stringify({ projectId: PROJECT_ID, service, volumeId }, null, 2));

  // Public URL al
  try {
    const info = nf(["get", "service", "--projectId", PROJECT_ID, "--serviceId", SERVICE_NAME, "-o", "json"]);
    const ports = info?.ports || info?.data?.ports || [];
    const pub = ports.find((p) => p.public);
    if (pub?.domains?.length) {
      console.log("\nPUBLIC_URL=https://" + pub.domains[0]);
    } else if (pub?.dns) {
      console.log("\nPUBLIC_URL=https://" + pub.dns);
    }
  } catch (_) {}
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
