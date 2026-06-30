/**
 * Supabase Storage — SQLite yedekleme ve geri yukleme.
 * Railway volume birincil; Supabase bulut yedegi deploy/volume kaybinda kurtarir.
 */
const fs = require("fs");
const path = require("path");

const BUCKET = process.env.SUPABASE_DB_BUCKET || "yeralti-db-backups";
const REMOTE_FILE = "oyun.db";
const REMOTE_STAMPED_PREFIX = "oyun-";

let _client = null;
let _lastUploadAt = null;
let _lastUploadOk = false;
let _lastRestoreAt = null;
let _lastRestoreOk = false;
let _lastError = null;

function isConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!_client) {
    const { createClient } = require("@supabase/supabase-js");
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    if (typeof globalThis.WebSocket === "undefined") {
      options.global = { WebSocket: require("ws") };
    }
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
  }
  return _client;
}

async function ensureBucket(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if ((buckets || []).some((b) => b.name === BUCKET)) return;
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (createErr && !String(createErr.message || "").includes("already exists")) {
    throw createErr;
  }
}

async function countUsersInFile(dbPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 512) return resolve(0);
    try {
      const sqlite3 = require("sqlite3").verbose();
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) return resolve(0);
        db.get("SELECT COUNT(*) AS n FROM users", [], (e, row) => {
          db.close(() => resolve(e ? 0 : row?.n || 0));
        });
      });
    } catch {
      resolve(0);
    }
  });
}

async function downloadLatest(supabase, destPath) {
  const tryDownload = async (remotePath) => {
    const { data, error } = await supabase.storage.from(BUCKET).download(remotePath);
    if (error) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.length < 512) return null;
    return buf;
  };

  let buf = await tryDownload(REMOTE_FILE);
  if (!buf) {
    const { data: files, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 50,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) throw error;
    const stamped = (files || [])
      .filter((f) => f.name && f.name.startsWith(REMOTE_STAMPED_PREFIX) && f.name.endsWith(".db"))
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    for (const f of stamped) {
      buf = await tryDownload(f.name);
      if (buf) break;
    }
  }
  if (!buf) return false;

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    fs.copyFileSync(destPath, destPath + ".pre-supabase.bak");
  }
  fs.writeFileSync(destPath, buf);
  return true;
}

/**
 * Volume bos veya oyuncu yoksa Supabase'den geri yukle.
 */
async function restoreDbFromSupabase(destPath) {
  if (!isConfigured()) {
    console.log("[supabase] Yapilandirilmamis — SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
    return { restored: false, reason: "not_configured" };
  }
  const users = await countUsersInFile(destPath);
  if (users > 0) {
    return { restored: false, reason: "local_ok", users };
  }

  try {
    const supabase = getClient();
    await ensureBucket(supabase);
    const ok = await downloadLatest(supabase, destPath);
    _lastRestoreAt = new Date().toISOString();
    _lastRestoreOk = ok;
    _lastError = null;
    if (ok) {
      const after = await countUsersInFile(destPath);
      console.log(`[supabase] Veritabani geri yuklendi -> ${destPath} (${after} kullanici)`);
      return { restored: true, users: after };
    }
    console.log("[supabase] Uzak yedek bulunamadi (ilk kurulum olabilir)");
    return { restored: false, reason: "no_remote_backup" };
  } catch (err) {
    _lastError = err.message;
    _lastRestoreOk = false;
    console.warn("[supabase] Geri yukleme hatasi:", err.message);
    return { restored: false, reason: "error", error: err.message };
  }
}

/**
 * SQLite dosyasini Supabase Storage'a yukle.
 */
async function uploadDbBackup(dbPath) {
  if (!isConfigured()) return { uploaded: false, reason: "not_configured" };
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 512) {
    return { uploaded: false, reason: "empty_db" };
  }
  const users = await countUsersInFile(dbPath);
  if (users <= 0) return { uploaded: false, reason: "no_users" };

  try {
    const supabase = getClient();
    await ensureBucket(supabase);
    const buf = fs.readFileSync(dbPath);
    const stamp = new Date().toISOString().slice(0, 10);

    const { error: mainErr } = await supabase.storage.from(BUCKET).upload(REMOTE_FILE, buf, {
      upsert: true,
      contentType: "application/x-sqlite3",
    });
    if (mainErr) throw mainErr;

    const stampedName = `${REMOTE_STAMPED_PREFIX}${stamp}.db`;
    await supabase.storage.from(BUCKET).upload(stampedName, buf, {
      upsert: true,
      contentType: "application/x-sqlite3",
    });

    _lastUploadAt = new Date().toISOString();
    _lastUploadOk = true;
    _lastError = null;
    console.log(`[supabase] Yedek yuklendi: ${BUCKET}/${REMOTE_FILE} (${users} kullanici, ${buf.length} byte)`);
    return { uploaded: true, users, bytes: buf.length, bucket: BUCKET };
  } catch (err) {
    _lastError = err.message;
    _lastUploadOk = false;
    console.warn("[supabase] Yukleme hatasi:", err.message);
    return { uploaded: false, reason: "error", error: err.message };
  }
}

function getStatus() {
  return {
    configured: isConfigured(),
    bucket: BUCKET,
    lastUploadAt: _lastUploadAt,
    lastUploadOk: _lastUploadOk,
    lastRestoreAt: _lastRestoreAt,
    lastRestoreOk: _lastRestoreOk,
    lastError: _lastError,
  };
}

module.exports = {
  isConfigured,
  restoreDbFromSupabase,
  uploadDbBackup,
  getStatus,
};
