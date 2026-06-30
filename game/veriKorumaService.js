/**
 * Veritabani butunlugu — yedek karsilastirma ve bozulunca geri yukleme.
 */
const fs = require("fs");
const path = require("path");
const { scoreDbFile, DB_PATH } = require("../db/database");

const SCORE_DROP_RATIO = 0.88;
const MIN_BETTER_SCORE = 5000;

function listLocalBackupFiles(targetPath) {
  const dir = path.dirname(path.resolve(targetPath));
  const out = new Set();
  const names = [
    targetPath + ".bak",
    path.join(dir, "oyun.db.bak"),
    path.join(process.cwd(), "seed", "oyun.db"),
    path.join(__dirname, "..", "seed", "oyun.db"),
  ];
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
    const ok = await downloadRemoteSnapshot(temp);
    return ok ? temp : null;
  } catch (err) {
    console.warn("[veri-koruma] Supabase aday indirilemedi:", err.message);
    return null;
  }
}

async function pickBestCandidate(targetPath, extraPaths = []) {
  const seen = new Set();
  const candidates = [];
  const add = async (p) => {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    const stats = await scoreDbFile(resolved);
    if (stats.users > 0) candidates.push({ path: resolved, ...stats });
  };

  await add(targetPath);
  for (const p of listLocalBackupFiles(targetPath)) await add(p);
  for (const p of extraPaths) if (p) await add(p);

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function shouldRecover(current, best) {
  if (!best || best.users <= 0) return false;
  if (current.users <= 0) return true;
  if (best.users > current.users) return true;
  if (best.kasa > current.kasa + MIN_BETTER_SCORE && best.score > current.score) return true;
  if (best.score >= current.score + MIN_BETTER_SCORE && best.score > current.score / SCORE_DROP_RATIO) {
    return true;
  }
  return false;
}

/**
 * Mevcut DB dusmusse en iyi yedekten geri yukle (volume, .bak, backups/, seed, supabase).
 */
async function recoverDbIfDegraded(targetPath = DB_PATH) {
  const remotePath = await downloadSupabaseCandidate(targetPath);
  const ranked = await pickBestCandidate(targetPath, remotePath ? [remotePath] : []);
  const current = ranked.find((c) => path.resolve(c.path) === path.resolve(targetPath)) || {
    path: targetPath,
    ...(await scoreDbFile(targetPath)),
  };
  const best = ranked[0];
  if (!best || path.resolve(best.path) === path.resolve(targetPath)) {
    return { recovered: false, reason: "current_ok", users: current.users, score: current.score };
  }
  if (!shouldRecover(current, best)) {
    return {
      recovered: false,
      reason: "not_degraded",
      users: current.users,
      score: current.score,
      bestScore: best.score,
    };
  }

  try {
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size >= 512) {
      fs.copyFileSync(targetPath, targetPath + ".pre-recover.bak");
    }
    fs.copyFileSync(best.path, targetPath);
    console.log(
      `[veri-koruma] DB geri yuklendi: ${best.path} -> ${targetPath} (skor ${best.score} > ${current.score}, kullanici ${best.users})`
    );
    return {
      recovered: true,
      from: best.path,
      users: best.users,
      score: best.score,
      previousUsers: current.users,
      previousScore: current.score,
    };
  } catch (err) {
    console.warn("[veri-koruma] Geri yukleme basarisiz:", err.message);
    return { recovered: false, reason: "error", error: err.message };
  } finally {
    if (remotePath && fs.existsSync(remotePath)) {
      try {
        fs.unlinkSync(remotePath);
      } catch (_) {}
    }
  }
}

let _lastSnapshotExport = 0;

async function maybeExportPlayerSnapshots(db, minIntervalMs = 5 * 60 * 1000) {
  const now = Date.now();
  if (now - _lastSnapshotExport < minIntervalMs) return;
  _lastSnapshotExport = now;
  try {
    const { exportSnapshotsToSeed } = require("./oyuncuRestoreService");
    const n = await exportSnapshotsToSeed(db, { merge: true });
    if (n > 0) console.log(`[veri-koruma] ${n} oyuncu snapshot guncellendi (seed/oyuncular)`);
  } catch (err) {
    console.warn("[veri-koruma] Snapshot export atlandi:", err.message);
  }
}

module.exports = {
  recoverDbIfDegraded,
  maybeExportPlayerSnapshots,
  pickBestCandidate,
  shouldRecover,
};
