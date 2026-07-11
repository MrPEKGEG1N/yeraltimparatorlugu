#!/usr/bin/env node
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_DB_BUCKET || "yeralti-db-backups";

if (!url || !key) {
  console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const { data, error } = await supabase.storage.from(bucket).list("", { limit: 100 });
  if (error) throw error;
  console.log("Supabase yedekleri:");
  for (const f of (data || []).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))) {
    console.log(`- ${f.name} (${f.metadata?.size || "?"} byte, ${f.updated_at})`);
  }

  const outDir = path.join(process.cwd(), "db", "supabase-archive");
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of ["oyun-2026-06-29.db", "oyun-2026-06-28.db", "oyun-2026-06-27.db"]) {
    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(name);
    if (dlErr) {
      console.log(`indirilemedi: ${name}`, dlErr.message);
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const dest = path.join(outDir, name);
    fs.writeFileSync(dest, buf);
    console.log(`indirildi: ${dest} (${buf.length} byte)`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
