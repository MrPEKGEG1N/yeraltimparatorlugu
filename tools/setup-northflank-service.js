#!/usr/bin/env node
/**
 * Northflank combined service + volume kurulumu (API).
 *
 * Gerekli:
 *   NORTHFLANK_API_TOKEN  — Northflank → Team Settings → API → Create token
 *   NORTHFLANK_PROJECT_ID — Proje ID (URL'den veya panel)
 *
 * Opsiyonel (yoksa Railway CLI'dan okunur):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, PUBLIC_BASE_URL
 *
 * Kullanim:
 *   node tools/setup-northflank-service.js
 */
const { spawnSync } = require("child_process");
const crypto = require("crypto");

const API = "https://api.northflank.com/v1";
const SERVICE_NAME = process.env.NORTHFLANK_SERVICE_NAME || "yeraltimparatorlugu";
const VOLUME_NAME = process.env.NORTHFLANK_VOLUME_NAME || "yeralti-db";
const REPO_URL = "https://github.com/MrPEKGEG1N/yeraltimparatorlugu";
const BRANCH = "main";

function die(msg) {
  console.error(`[northflank-setup] ${msg}`);
  process.exit(1);
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

async function api(method, path, body) {
  const token = process.env.NORTHFLANK_API_TOKEN;
  if (!token) die("NORTHFLANK_API_TOKEN gerekli");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    die(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

async function findService(projectId, name) {
  const list = await api("GET", `/projects/${projectId}/services`);
  const items = list?.data?.services || list?.data || [];
  return items.find((s) => s.name === name || s.id === name);
}

async function findVolume(projectId, name) {
  const list = await api("GET", `/projects/${projectId}/volumes`);
  const items = list?.data?.volumes || list?.data || [];
  return items.find((v) => v.name === name || v.id === name);
}

async function main() {
  const projectId = process.env.NORTHFLANK_PROJECT_ID;
  if (!projectId) die("NORTHFLANK_PROJECT_ID gerekli");

  const rw = railwayVars();
  const jwt =
    process.env.JWT_SECRET ||
    rw.JWT_SECRET ||
    "yeralti-dev-gizli-anahtar-degistir";
  const supabaseUrl = process.env.SUPABASE_URL || rw.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || rw.SUPABASE_SERVICE_ROLE_KEY;
  const publicBase = process.env.PUBLIC_BASE_URL || "";

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[northflank-setup] Supabase anahtarlari eksik — volume + seed kullanilir.");
  }

  let volume = await findVolume(projectId, VOLUME_NAME);
  if (!volume) {
    console.log(`[northflank-setup] Volume olusturuluyor: ${VOLUME_NAME}`);
    const created = await api("POST", `/projects/${projectId}/volumes`, {
      name: VOLUME_NAME,
      storageSize: 1024,
    });
    volume = created?.data || created;
  }
  const volumeId = volume.id || volume.name;

  let service = await findService(projectId, SERVICE_NAME);
  const runtimeEnvironment = {
    PERSISTENT_DATA_PATH: "/data",
    NODE_ENV: "production",
    PORT: "3000",
    ADMIN_USERNAME: "mrpekgeg1n",
    JWT_SECRET: jwt,
    ...(supabaseUrl ? { SUPABASE_URL: supabaseUrl } : {}),
    ...(supabaseKey ? { SUPABASE_SERVICE_ROLE_KEY: supabaseKey } : {}),
    ...(publicBase ? { PUBLIC_BASE_URL: publicBase } : {}),
  };

  const payload = {
    name: SERVICE_NAME,
    description: "Yeralti Imparatorlugu oyun sunucusu",
    billing: {
      deploymentPlan: "nf-compute-20",
      buildPlan: "nf-compute-20",
    },
    deployment: {
      instances: 1,
      docker: { configType: "default" },
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
      projectUrl: REPO_URL,
      projectType: "github",
      projectBranch: BRANCH,
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
        initialDelaySeconds: 30,
        periodSeconds: 30,
        timeoutSeconds: 10,
        failureThreshold: 5,
        successThreshold: 1,
      },
    ],
    runtimeEnvironment,
    createOptions: {
      volumesToAttach: [volumeId],
    },
  };

  if (service) {
    console.log(`[northflank-setup] Servis guncelleniyor: ${SERVICE_NAME}`);
    await api(
      "PATCH",
      `/projects/${projectId}/services/combined/${service.id}`,
      payload
    );
  } else {
    console.log(`[northflank-setup] Combined service olusturuluyor: ${SERVICE_NAME}`);
    const created = await api("POST", `/projects/${projectId}/services/combined`, payload);
    service = created?.data || created;
  }

  console.log("\n[northflank-setup] Tamam.");
  console.log(`  Proje: ${projectId}`);
  console.log(`  Servis: ${service.id || SERVICE_NAME}`);
  console.log(`  Volume: ${volumeId} -> /data`);
  console.log("\nSonraki adimlar:");
  console.log("  1. Northflank panelinde volume mount path = /data oldugunu dogrula");
  console.log("  2. Build bitince public URL'yi al");
  console.log("  3. PUBLIC_BASE_URL ortam degiskenini guncelle");
  console.log("  4. GET <url>/api/health -> oyuncular: 7, volumeOk: true");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
