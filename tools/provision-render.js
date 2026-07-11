#!/usr/bin/env node
/**
 * Render ucretsiz deploy (kart gerektirmez).
 * Supabase yedek + seed/oyun.db ile 7 oyuncu korunur.
 *
 * RENDER_API_KEY varsa API ile servis olusturur/gunceller.
 * Yoksa blueprint deeplink acar.
 *
 * Kullanim:
 *   npm run provision:render
 *   RENDER_API_KEY=rnd_... npm run provision:render
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const API = "https://api.render.com/v1";
const REPO = "https://github.com/MrPEKGEG1N/yeraltimparatorlugu";
const SERVICE_NAME = "yeralti-game";

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

function openUrl(url) {
  const plat = process.platform;
  if (plat === "win32") {
    spawnSync("cmd", ["/c", "start", "", url], { shell: false });
  } else if (plat === "darwin") {
    spawnSync("open", [url], { shell: false });
  } else {
    spawnSync("xdg-open", [url], { shell: false });
  }
}

async function renderApi(method, pathSuffix, body) {
  const key = process.env.RENDER_API_KEY;
  if (!key) throw new Error("RENDER_API_KEY yok");
  const res = await fetch(`${API}${pathSuffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
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
    throw new Error(`${method} ${pathSuffix} -> ${res.status}: ${text.slice(0, 600)}`);
  }
  return json;
}

async function findService(ownerId) {
  const list = await renderApi("GET", `/services?ownerId=${ownerId}&limit=100`);
  const items = Array.isArray(list) ? list : list?.items || [];
  return items.find((s) => (s.service?.name || s.name) === SERVICE_NAME)?.service || items.find((s) => s.name === SERVICE_NAME);
}

async function pollHealth(url, tries = 40) {
  const health = `${url.replace(/\/$/, "")}/api/health`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(health, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data, health };
      }
    } catch (_) {}
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 15000));
  }
  return { ok: false, health };
}

async function main() {
  const rw = railwayVars();
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || rw.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl =
    process.env.SUPABASE_URL || rw.SUPABASE_URL || "https://pzkafimfxuspoeybrywx.supabase.co";
  const jwt =
    process.env.JWT_SECRET || rw.JWT_SECRET || "yeralti-dev-gizli-anahtar-degistir";

  const blueprint =
    "https://dashboard.render.com/blueprint/new?repo=" +
    encodeURIComponent(REPO);

  if (!process.env.RENDER_API_KEY) {
    console.log("[render] RENDER_API_KEY yok — blueprint deeplink aciliyor.");
    console.log("[render] GitHub ile giris yap, SUPABASE_SERVICE_ROLE_KEY gir, Apply.");
    console.log(`\n${blueprint}\n`);
    openUrl(blueprint);
    console.log("[render] Deploy bitince URL'yi al:");
    console.log("  npm run update:url https://yeralti-game.onrender.com");
    process.exit(0);
  }

  console.log("[render] API ile servis kuruluyor...");
  const owners = await renderApi("GET", "/owners?limit=20");
  const owner = (Array.isArray(owners) ? owners[0] : owners?.items?.[0])?.owner || owners?.[0];
  const ownerId = owner?.id;
  if (!ownerId) throw new Error("Render owner bulunamadi");

  let service = await findService(ownerId);
  const envVars = [
    { key: "NODE_ENV", value: "production" },
    { key: "PORT", value: "3000" },
    { key: "ADMIN_USERNAME", value: "mrpekgeg1n" },
    { key: "JWT_SECRET", value: jwt },
    { key: "SUPABASE_URL", value: supabaseUrl },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: supabaseKey },
  ].filter((e) => e.value);

  if (!service) {
    const created = await renderApi("POST", "/services", {
      type: "web_service",
      name: SERVICE_NAME,
      ownerId,
      repo: REPO,
      branch: "main",
      runtime: "docker",
      plan: "free",
      region: "frankfurt",
      autoDeploy: "yes",
      healthCheckPath: "/api/health",
      envVars,
    });
    service = created?.service || created;
    console.log("[render] Servis olusturuldu:", service.id || service.name);
  } else {
    const sid = service.id;
    for (const ev of envVars) {
      await renderApi("POST", `/services/${sid}/env-vars`, ev).catch(async () => {
        await renderApi("PUT", `/services/${sid}/env-vars/${ev.key}`, { value: ev.value });
      });
    }
    await renderApi("POST", `/services/${sid}/deploys`, { clearCache: "do_not_clear" });
    console.log("[render] Servis guncellendi, redeploy baslatildi:", sid);
  }

  const sid = service.id;
  let url = service.serviceDetails?.url || service.url;
  if (!url) {
    const info = await renderApi("GET", `/services/${sid}`);
    url = info?.serviceDetails?.url || info?.url;
  }
  if (!url && service.slug) url = `https://${service.slug}.onrender.com`;

  if (url) {
    console.log(`\n[render] URL: ${url}`);
    console.log("[render] Health bekleniyor (cold start ~1-2 dk)...");
    const h = await pollHealth(url);
    if (h.ok) {
      console.log(`\n[render] Health OK: oyuncular=${h.data.oyuncular}, kaliciVeri=${h.data.kaliciVeri}`);
      spawnSync("node", [path.join(__dirname, "update-public-url.js"), url], {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
      });
    } else {
      console.log(`\n[render] Health henuz hazir degil: ${h.health}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
