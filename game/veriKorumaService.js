/**
 * Veritabani butunlugu — yedek karsilastirma ve bozulunca geri yukleme.
 */
const fs = require("fs");
const { getPersistentDataPath } = require("../db/persistPath");
const path = require("path");
const { scoreDbFile, DB_PATH, isDbCorrupt, replaceDbFile } = require("../db/database");

const SCORE_DROP_RATIO = 0.88;
const MIN_BETTER_SCORE = 5000;

function allowDbFileRestore() {
  return process.env.ALLOW_DB_FILE_RESTORE === "1";
}

function isProductionLive(users) {
  return process.env.NODE_ENV === "production" && users > 0;
}

function listLocalBackupFiles(targetPath, currentUsers = 0) {
  const dir = path.dirname(path.resolve(targetPath));
  const out = new Set();
  const names = [targetPath + ".bak", path.join(dir, "oyun.db.bak")];
  const mount = getPersistentDataPath();
  if (mount) {
    names.push(path.join(mount, "oyun-seed.db"));
  }
  const blockBundledSeed =
    isProductionLive(currentUsers) && !allowDbFileRestore();
  if (!blockBundledSeed) {
    names.push(
      path.join(process.cwd(), "seed", "oyun.db"),
      path.join(__dirname, "..", "seed", "oyun.db")
    );
  }
  const backupDir = path.join(dir, "backups");
  if (fs.existsSync(backupDir)) {
    for (const f of fs.readdirSync(backupDir)) {
      if (f.endsWith(".db")) names.push(path.join(backupDir, f));
    }
  }
  for (const p of names) {
    const resolved = path.resolve(p);
    if (resolved === path.resolve(targetPath)) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).size >= 512) out.add(resolved);
  }
  return [...out];
}

async function downloadSupabaseCandidate(targetPath) {
  try {
    const { isConfigured, downloadRemoteSnapshot } = require("../services/supabaseBackupService");
    if (!isConfigured()) return null;
    const temp = path.join(path.dirname(path.resolve(targetPath)), ".supabase-recovery.db");
    const ok = await Promise.race([
      downloadRemoteSnapshot(temp),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("supabase aday indirme timeout (20s)")), 20000)
      ),
    ]);
    return ok ? temp : null;
  } catch (err) {
    console.warn("[veri-koruma] Supabase aday indirilemedi:", err.message);
    return null;
  }
}

async function pickBestCandidate(targetPath, extraPaths = []) {
  const seen = new Set();
  const candidates = [];
  const currentStats = await scoreDbFile(targetPath);
  const add = async (p) => {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    const stats = await scoreDbFile(resolved);
    if (stats.corrupt) return;
    if (stats.users > 0) candidates.push({ path: resolved, ...stats });
  };

  await add(targetPath);
  for (const p of listLocalBackupFiles(targetPath, currentStats.users)) await add(p);
  for (const p of extraPaths) if (p) await add(p);

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function shouldRecover(current, best, opts = {}) {
  if (!best || best.users <= 0) return false;
  if (current.users <= 0) return true;
  if (opts.corruptOnly) return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEGRADED_RECOVERY !== "1") {
    return false;
  }
  if (best.users > current.users) return true;
  if (best.kasa > current.kasa + MIN_BETTER_SCORE && best.score > current.score) return true;
  if (best.score >= current.score + MIN_BETTER_SCORE && best.score > current.score / SCORE_DROP_RATIO) {
    return true;
  }
  return false;
}

/**
 * Mevcut DB dusmusse veya bozuksa en iyi yedekten geri yukle (volume, .bak, backups/, seed, supabase).
 */
async function recoverDbIfDegraded(targetPath = DB_PATH, opts = {}) {
  const beforeReplace = opts.beforeReplace;
  const remotePath = await downloadSupabaseCandidate(targetPath);
  const currentCorrupt = await isDbCorrupt(targetPath);
  const ranked = await pickBestCandidate(targetPath, remotePath ? [remotePath] : []);
  const current = ranked.find((c) => path.resolve(c.path) === path.resolve(targetPath)) || {
    path: targetPath,
    ...(await scoreDbFile(targetPath)),
  };
  const best =
    ranked.find((c) => path.resolve(c.path) !== path.resolve(targetPath)) || ranked[0];

  if (!best || path.resolve(best.path) === path.resolve(targetPath)) {
    return {
      recovered: false,
      reason: currentCorrupt ? "corrupt_no_backup" : "current_ok",
      corrupt: currentCorrupt,
      users: current.users,
      score: current.score,
    };
  }

  const mustRecover =
    currentCorrupt || shouldRecover(current, best, { corruptOnly: opts.corruptOnly });
  if (!mustRecover) {
    return {
      recovered: false,
      reason: "not_degraded",
      corrupt: currentCorrupt,
      users: current.users,
      score: current.score,
      bestScore: best.score,
    };
  }

  try {
    if (beforeReplace) await beforeReplace();
    replaceDbFile(targetPath, best.path);
    console.log(
      `[veri-koruma] DB geri yuklendi: ${best.path} -> ${targetPath} (${currentCorrupt ? "bozuk" : "dusuk skor"}, skor ${best.score} > ${current.score}, kullanici ${best.users})`
    );
    return {
      recovered: true,
      corrupt: currentCorrupt,
      from: best.path,
      users: best.users,
      score: best.score,
      previousUsers: current.users,
      previousScore: current.score,
    };
  } catch (err) {
    console.warn("[veri-koruma] Geri yukleme basarisiz:", err.message);
    return { recovered: false, reason: "error", corrupt: currentCorrupt, error: err.message };
  } finally {
    if (remotePath && fs.existsSync(remotePath)) {
      try {
        fs.unlinkSync(remotePath);
      } catch (_) {}
    }
  }
}

let _lastSnapshotExport = 0;

function syncVolumeSeedDatabase(liveDbPath) {
  const vol = getPersistentDataPath();
  if (!vol || !liveDbPath || !fs.existsSync(liveDbPath)) return false;
  try {
    const dest = path.join(vol, "oyun-seed.db");
    fs.copyFileSync(liveDbPath, dest);
    return true;
  } catch (err) {
    console.warn("[persist] Volume seed DB yazilamadi:", err.message);
    return false;
  }
}

async function persistLiveGameState(db) {
  const { exportSnapshotsToSeed } = require("./oyuncuRestoreService");
  const { exportWorldState } = require("./worldStateSnapshot");
  const { DB_PATH, isDbCorrupt } = require("../db/database");
  if (await isDbCorrupt(DB_PATH)) {
    console.warn("[persist] Bozuk DB — snapshot yazilmadi");
    return { snapshots: 0, seedDb: false, skipped: "corrupt" };
  }
  const n = await exportSnapshotsToSeed(db, { merge: true });
  const seedOk = syncVolumeSeedDatabase(DB_PATH);
  let worldState = null;
  try {
    worldState = await exportWorldState(db);
  } catch (err) {
    console.warn("[persist] Dunya durumu yazilamadi:", err.message);
  }
  if (n > 0 || seedOk || worldState?.written) {
    console.log(
      `[persist] Canli durum kaydedildi (${n} snapshot${seedOk ? ", volume seed DB" : ""}${worldState?.written ? ", world-state" : ""})`
    );
  }
  return { snapshots: n, seedDb: seedOk, worldState };
}

async function maybeExportPlayerSnapshots(db, minIntervalMs = 5 * 60 * 1000) {
  const now = Date.now();
  if (now - _lastSnapshotExport < minIntervalMs) return;
  _lastSnapshotExport = now;
  try {
    await persistLiveGameState(db);
  } catch (err) {
    console.warn("[veri-koruma] Snapshot export atlandi:", err.message);
  }
}

module.exports = {
  recoverDbIfDegraded,
  maybeExportPlayerSnapshots,
  persistLiveGameState,
  syncVolumeSeedDatabase,
  pickBestCandidate,
  allowDbFileRestore,
  isProductionLive,
  shouldRecover,
};
