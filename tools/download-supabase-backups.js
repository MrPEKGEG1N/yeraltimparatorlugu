#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
  process.exit(1);
}

const BUCKET = process.env.SUPABASE_DB_BUCKET || "yeralti-db-backups";
const outDir = path.join(__dirname, "..", "db", "supabase-dl");
fs.mkdirSync(outDir, { recursive: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: files, error } = await supabase.storage.from(BUCKET).list("", {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw error;
  console.log("Remote files:", (files || []).map((f) => ({ name: f.name, updated: f.updated_at })));

  for (const f of files || []) {
    if (!f.name?.endsWith(".db")) continue;
    const dest = path.join(outDir, f.name);
    const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(f.name);
    if (dlErr) {
      console.warn("skip", f.name, dlErr.message);
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log("downloaded", f.name, buf.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
