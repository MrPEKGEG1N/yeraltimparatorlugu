#!/usr/bin/env node
/**
 * Uretim sunucusunu disaridan uyandirir (cron / manuel).
 *   node tools/keep-alive-ping.js
 *   KEEP_ALIVE_URL=https://... node tools/keep-alive-ping.js
 */
const BASE = (
  process.env.KEEP_ALIVE_URL ||
  process.env.PUBLIC_BASE_URL ||
  process.env.LIVE_URL ||
  "https://yeralti-game.onrender.com"
).replace(/\/$/, "");

const PATHS = (process.env.KEEP_ALIVE_PATHS || "/api/ping,/api/health")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
const TIMEOUT_MS = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 90000);
const RETRIES = Number(process.env.KEEP_ALIVE_RETRIES || 3);

async function pingOnce(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const paths = process.argv[2] ? [process.argv[2]] : PATHS;
  for (let i = 1; i <= RETRIES; i++) {
    for (const path of paths) {
      try {
        const r = await pingOnce(path);
        if (r.ok) {
          console.log(`OK ${BASE}${path} (${r.status}) ${r.body.slice(0, 120)}`);
          return;
        }
        console.warn(`FAIL ${path} attempt ${i}: HTTP ${r.status}`);
      } catch (err) {
        console.warn(`FAIL ${path} attempt ${i}:`, err.message || err);
      }
    }
    if (i < RETRIES) await new Promise((r) => setTimeout(r, 20000));
  }
  process.exit(1);
}

main();
