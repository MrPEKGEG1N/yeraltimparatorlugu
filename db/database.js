const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { ADMIN_USERNAME } = require("../config");
const { temizGrupAdi } = require("../game/grupAdi");
const { rastgeleProfilResmi, normalizeProfilResmi } = require("../game/profilPortreler");

const { getPersistentDataPath } = require("./persistPath");

const PRODUCTION_DB_DIRS = ["/data", "/app/db"];

function resolveDbPath() {
  const mount = getPersistentDataPath();
  if (mount) return path.join(mount, "oyun.db");
  if (process.env.DATABASE_PATH) return path.resolve(process.env.DATABASE_PATH);
  const local = path.join(__dirname, "oyun.db");
  if (process.env.NODE_ENV === "production") return path.join(PRODUCTION_DB_DIRS[0], "oyun.db");
  return local;
}

const DB_PATH = resolveDbPath();

function knownDbDirectories() {
  const dirs = new Set([path.dirname(DB_PATH), path.join(__dirname), path.join(process.cwd(), "db")]);
  for (const d of PRODUCTION_DB_DIRS) dirs.add(d);
  if (getPersistentDataPath()) dirs.add(getPersistentDataPath());
  if (process.env.DATABASE_PATH) dirs.add(path.dirname(path.resolve(process.env.DATABASE_PATH)));
  return [...dirs];
}

function knownDbFileCandidates() {
  const files = new Set();
  for (const dir of knownDbDirectories()) {
    files.add(path.join(dir, "oyun.db"));
    files.add(path.join(dir, "oyun.db.bak"));
    files.add(path.join(dir, "oyun.db-wal"));
    files.add(path.join(dir, "backups", "oyun.db"));
    files.add(path.join(dir, "backups", "oyun.db.bak"));
  }
  files.add(DB_PATH);
  files.add(DB_PATH + ".bak");
  return [...files];
}

function isVolumeMounted() {
  const mount = getPersistentDataPath();
  if (!mount) return false;
  return path.resolve(path.dirname(DB_PATH)) === path.resolve(mount);
}

function ensureDbDirectory(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function bootstrapDbFromLegacy(targetPath) {
  try {
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) return false;
    const candidates = [path.join(__dirname, "oyun.db"), path.join(process.cwd(), "db", "oyun.db")];
    for (const legacy of candidates) {
      const resolved = path.resolve(legacy);
      if (resolved === path.resolve(targetPath)) continue;
      if (!fs.existsSync(resolved)) continue;
      if (fs.statSync(resolved).size <= 0) continue;
      ensureDbDirectory(targetPath);
      fs.copyFileSync(resolved, targetPath);
      console.log(`[db] Mevcut veritabani korunarak tasindi: ${resolved} -> ${targetPath}`);
      return true;
    }
  } catch (err) {
    console.warn("[db] Veritabani tasinamadi:", err.message);
  }
  return false;
}

function isSqliteCorruptError(err) {
  const msg = String(err?.message || err || "");
  return /SQLITE_CORRUPT|database disk image is malformed|file is not a database/i.test(msg);
}

function removeWalSidecars(dbPath) {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = dbPath + suffix;
    if (fs.existsSync(sidecar)) {
      try {
        fs.unlinkSync(sidecar);
      } catch (_) {}
    }
  }
}

function isDbCorrupt(dbPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 512) return resolve(false);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        resolve(isSqliteCorruptError(err) || true);
        return;
      }
      db.get("PRAGMA integrity_check", [], (checkErr, row) => {
        db.close(() => {
          if (checkErr) {
            resolve(isSqliteCorruptError(checkErr) || true);
            return;
          }
          const val = row ? row.integrity_check || Object.values(row)[0] : "ok";
          resolve(String(val).toLowerCase() !== "ok");
        });
      });
    });
  });
}

function replaceDbFile(targetPath, sourcePath) {
  const target = path.resolve(targetPath);
  const source = path.resolve(sourcePath);
  if (target === source) return;
  if (!fs.existsSync(source) || fs.statSync(source).size < 512) {
    throw new Error("Gecerli yedek dosyasi bulunamadi.");
  }
  ensureDbDirectory(target);
  if (fs.existsSync(target) && fs.statSync(target).size >= 512) {
    fs.copyFileSync(target, target + ".pre-recover.bak");
  }
  removeWalSidecars(target);
  fs.copyFileSync(source, target);
  removeWalSidecars(target);
}

function countSqliteUsers(dbPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve(-1);
    if (fs.statSync(dbPath).size < 512) return resolve(0);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve(-1);
      db.get(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='users'",
        [],
        (tblErr, tbl) => {
          if (tblErr || !tbl) {
            db.close(() => resolve(-1));
            return;
          }
          db.get("SELECT COUNT(*) AS n FROM users", [], (e, row) => {
            db.close(() => resolve(e ? -1 : row?.n || 0));
          });
        }
      );
    });
  });
}

function scoreDbFile(dbPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve({ users: 0, score: 0, size: 0, corrupt: false });
    const size = fs.statSync(dbPath).size;
    if (size < 512) return resolve({ users: 0, score: 0, size, corrupt: false });
    isDbCorrupt(dbPath).then((corrupt) => {
      if (corrupt) {
        return resolve({ users: 0, score: -1, size, corrupt: true });
      }
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          return resolve({
            users: 0,
            score: isSqliteCorruptError(err) ? -1 : 0,
            size,
            corrupt: isSqliteCorruptError(err),
          });
        }
        db.get(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='users'",
          [],
          (tblErr, tbl) => {
            if (tblErr || !tbl) {
              db.close(() =>
                resolve({
                  users: 0,
                  score: 0,
                  size,
                  corrupt: isSqliteCorruptError(tblErr),
                })
              );
              return;
            }
            db.get(
              `SELECT
                 (SELECT COUNT(*) FROM users) AS users,
                 (SELECT COUNT(*) FROM players) AS players,
                 (SELECT COALESCE(SUM(kasa), 0) FROM players) AS kasa,
                 (SELECT COALESCE(SUM(puan), 0) FROM players) AS puan`,
              [],
              (e, row) => {
                db.close(() => {
                  if (e || !row) {
                    return resolve({
                      users: 0,
                      players: 0,
                      kasa: 0,
                      puan: 0,
                      score: 0,
                      size,
                      corrupt: isSqliteCorruptError(e),
                    });
                  }
                  const users = row.users || 0;
                  const players = row.players || 0;
                  const kasa = row.kasa || 0;
                  const puan = row.puan || 0;
                  const score =
                    users * 1_000_000_000 + players * 1_000_000 + kasa * 10 + puan;
                  resolve({ users, players, kasa, puan, score, size, corrupt: false });
                });
              }
            );
          }
        );
      });
    });
  });
}

async function restoreFromSeed(targetPath) {
  const currentUsers = await countSqliteUsers(targetPath);
  if (currentUsers > 0) return false;
  const seedPaths = [];
  const mount = getPersistentDataPath();
  if (mount) {
    seedPaths.push(path.join(mount, "oyun-seed.db"));
  }
  seedPaths.push(
    path.join(process.cwd(), "seed", "oyun.db"),
    path.join(__dirname, "..", "seed", "oyun.db")
  );
  for (const seed of seedPaths) {
    const resolved = path.resolve(seed);
    if (!fs.existsSync(resolved)) continue;
    if (fs.statSync(resolved).size < 512) continue;
    const users = await countSqliteUsers(resolved);
    if (users <= 0) continue;
    ensureDbDirectory(targetPath);
    fs.copyFileSync(resolved, targetPath);
    console.log(`[db] Seed yuklendi: ${resolved} -> ${targetPath} (${users} kullanici, mrpekgeg1n dahil)`);
    return true;
  }
  return false;
}

async function restoreDbFromBestCandidate(targetPath) {
  ensureDbDirectory(targetPath);
  const seen = new Set();
  let bestPath = null;
  let bestScore = -1;

  for (const p of knownDbFileCandidates()) {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (!fs.existsSync(resolved)) continue;
    const stats = await scoreDbFile(resolved);
    if (stats.corrupt) continue;
    if (stats.users <= 0) continue;
    if (stats.score > bestScore) {
      bestScore = stats.score;
      bestPath = resolved;
    }
  }

  const targetResolved = path.resolve(targetPath);
  const current = await scoreDbFile(targetResolved);
  if (bestPath && bestScore > 0 && (current.users <= 0 || bestScore > current.score)) {
    if (bestPath !== targetResolved) {
      if (current.users > 0) {
        try {
          fs.copyFileSync(targetResolved, targetPath + ".pre-restore.bak");
        } catch (_) {}
      }
      ensureDbDirectory(targetPath);
      fs.copyFileSync(bestPath, targetResolved);
      console.log(
        `[db] Veritabani geri yuklendi: ${bestPath} -> ${targetResolved} (skor ${bestScore} > ${current.score})`
      );
    }
  }
}

async function consolidateLegacyDbCopies(targetPath) {
  const targetResolved = path.resolve(targetPath);
  const targetStats = await scoreDbFile(targetResolved);
  for (const p of knownDbFileCandidates()) {
    const resolved = path.resolve(p);
    if (resolved === targetResolved) continue;
    if (!fs.existsSync(resolved)) continue;
    const stats = await scoreDbFile(resolved);
    if (stats.corrupt) continue;
    if (stats.users <= 0) continue;
    if (targetStats.users <= 0 && stats.users > 0) {
      ensureDbDirectory(targetPath);
      fs.copyFileSync(resolved, targetResolved);
      console.log(`[db] Eski konumdan tasindi: ${resolved} -> ${targetResolved} (${stats.users} kullanici)`);
      return;
    }
    if (stats.score > targetStats.score) {
      try {
        if (fs.existsSync(targetResolved)) fs.copyFileSync(targetResolved, targetPath + ".pre-merge.bak");
      } catch (_) {}
      fs.copyFileSync(resolved, targetResolved);
      console.log(
        `[db] Daha zengin kopya birlestirildi: ${resolved} -> ${targetResolved} (skor ${stats.score} > ${targetStats.score})`
      );
      return;
    }
  }
}

function pruneOldBackups(backupDir, keepCount = 72) {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("oyun-") && f.endsWith(".db"))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const f of files.slice(keepCount)) {
      fs.unlinkSync(path.join(backupDir, f.name));
    }
  } catch (_) {}
}

async function backupDbFile(targetPath) {
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size < 512) return;
  if (await isDbCorrupt(targetPath)) {
    console.warn("[db] Bozuk DB yedeklenmedi:", targetPath);
    return;
  }
  const users = await countSqliteUsers(targetPath);
  if (users <= 0) return;
  const dir = path.dirname(targetPath);
  const bak = targetPath + ".bak";
  const backupDir = path.join(dir, "backups");
  try {
    fs.copyFileSync(targetPath, bak);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const dayStamp = new Date().toISOString().slice(0, 10);
    const minuteStamp = new Date().toISOString().slice(0, 16).replace("T", "-");
    fs.copyFileSync(targetPath, path.join(backupDir, `oyun-${dayStamp}.db`));
    fs.copyFileSync(targetPath, path.join(backupDir, `oyun-${minuteStamp}.db`));
    pruneOldBackups(backupDir, 144);
      console.log(`[db] Yedek alindi: ${bak} (${users} kullanici)`);
    try {
      const { uploadDbBackup } = require("../services/supabaseBackupService");
      uploadDbBackup(targetPath).catch((err) => {
        console.warn("[supabase] Yedek yuklenemedi:", err.message);
      });
    } catch (err) {
      console.warn("[supabase] Yedek yuklenemedi:", err.message);
    }
  } catch (err) {
    console.warn("[db] Yedek alinamadi:", err.message);
  }
}

function logDbEnvironment() {
  const mount = getPersistentDataPath() || "(yok)";
  const envPath = process.env.DATABASE_PATH || "(yok)";
  console.log(`[db] Hedef: ${DB_PATH}`);
  console.log(`[db] PERSISTENT_DATA_PATH=${mount}, DATABASE_PATH=${envPath}`);
  if (process.env.NODE_ENV === "production" && !getPersistentDataPath()) {
    console.warn(
      "[db] UYARI: Kalici volume bagli degil! Northflank/Railway'de /data volume mount edin ve PERSISTENT_DATA_PATH=/data ayarlayin."
    );
  }
  if (getPersistentDataPath() && !isVolumeMounted()) {
    console.warn(
      `[db] UYARI: DB yolu volume mount ile uyusmuyor! DB=${DB_PATH}, volume=${getPersistentDataPath()}`
    );
  }
}

async function configureSqlitePragmas(db) {
  try {
    await run(db, "PRAGMA journal_mode = WAL");
    await run(db, "PRAGMA synchronous = NORMAL");
    await run(db, "PRAGMA foreign_keys = ON");
    await run(db, "PRAGMA busy_timeout = 10000");
  } catch (err) {
    console.warn("[db] PRAGMA ayarlanamadi:", err.message);
  }
}

function seedDbPath() {
  const candidates = [
    path.join(process.cwd(), "seed", "oyun.db"),
    path.join(__dirname, "..", "seed", "oyun.db"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).size >= 512) return path.resolve(p);
  }
  return null;
}

async function getDbDiagnostics() {
  const users = fs.existsSync(DB_PATH) ? await countSqliteUsers(DB_PATH) : 0;
  const corrupt = fs.existsSync(DB_PATH) ? await isDbCorrupt(DB_PATH) : false;
  let supabase = { configured: false };
  try {
    const { getStatus } = require("../services/supabaseBackupService");
    supabase = getStatus();
  } catch (_) {}
  const seed = seedDbPath();
  let seedUsers = 0;
  if (seed) seedUsers = await countSqliteUsers(seed);
  return {
    path: DB_PATH,
    volumeMount: getPersistentDataPath(),
    volumeOk: isVolumeMounted(),
    users,
    corrupt,
    sizeKb: fs.existsSync(DB_PATH) ? Math.round(fs.statSync(DB_PATH).size / 1024) : 0,
    supabase,
    seed: seed ? { path: seed, users: seedUsers, ok: seedUsers > 0 } : null,
  };
}

async function logDatabaseStats(db) {
  try {
    const stats = await get(
      db,
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM players) AS players`
    );
    const size = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    console.log(
      `[db] ${DB_PATH} (${Math.round(size / 1024)} KB) — kayitli kullanici: ${stats?.users || 0}, oyuncu: ${stats?.players || 0}`
    );
    if (process.env.NODE_ENV === "production" && (stats?.users || 0) === 0) {
      console.warn(
        "[db] UYARI: Canli ortamda kayitli oyuncu yok. Railway Volume (/data) bagli mi kontrol edin."
      );
    }
  } catch (err) {
    console.warn("[db] Istatistik okunamadi:", err.message);
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function migratePlayersTable(db) {
  const table = await get(
    db,
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='players'"
  );
  if (!table || !table.sql || table.sql.includes("user_id")) return;
  const users = await get(db, "SELECT COUNT(*) AS n FROM users");
  const row = await get(db, "SELECT COUNT(*) AS n FROM players");
  if ((users?.n || 0) > 0 || (row?.n || 0) > 0) {
    console.warn("[db] Eski players semasi var; mevcut kayitlar korunuyor (DROP atlandi).");
    return;
  }
  await run(db, "DROP TABLE players");
}

async function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${Math.round(ms / 1000)}s)`)), ms)
    ),
  ]);
}

async function tryRepairDatabase(db) {
  try {
    const row = await get(db, "PRAGMA integrity_check");
    const val = String(row?.integrity_check || Object.values(row || {})[0] || "ok");
    if (val.toLowerCase() === "ok") return { ok: true };
    if (/index/i.test(val)) {
      console.warn("[db] Indeks tutarsizligi — REINDEX deneniyor:", val);
      try {
        await run(db, "REINDEX");
      } catch (reindexErr) {
        return { ok: false, detail: reindexErr.message, corrupt: isSqliteCorruptError(reindexErr) };
      }
      const row2 = await get(db, "PRAGMA integrity_check");
      const val2 = String(row2?.integrity_check || Object.values(row2 || {})[0] || "ok");
      if (val2.toLowerCase() === "ok") {
        console.log("[db] REINDEX ile onarildi");
        return { ok: true, repaired: true };
      }
      return { ok: false, detail: val2 };
    }
    return { ok: false, detail: val };
  } catch (err) {
    return { ok: false, detail: err.message, corrupt: isSqliteCorruptError(err) };
  }
}

async function initDatabase() {
  logDbEnvironment();
  ensureDbDirectory(DB_PATH);

  const hasLiveDb = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size >= 512;
  const liveUsers = hasLiveDb ? await countSqliteUsers(DB_PATH) : 0;
  const fastStartup = process.env.NODE_ENV === "production" && liveUsers > 0;

  if (fastStartup) {
    console.log(`[db] Production hizli baslangic — mevcut DB (${liveUsers} kullanici)`);
    try {
      const corrupt = await isDbCorrupt(DB_PATH);
      if (corrupt) {
        console.warn("[db] Bozuk veritabani tespit edildi — yedekten geri yukleniyor...");
        const { recoverDbIfDegraded } = require("../game/veriKorumaService");
        const rec = await withTimeout(recoverDbIfDegraded(DB_PATH), 30000, "veri-koruma");
        if (rec.recovered) {
          console.log(`[veri-koruma] Bozuk DB onarildi: ${rec.from}`);
        } else {
          console.warn("[veri-koruma] Bozuk DB onarilamadi:", rec.reason || rec.error);
        }
      }
    } catch (err) {
      console.warn("[veri-koruma] Butunluk kontrolu atlandi:", err.message);
    }
  } else {
    try {
      const { restoreDbFromSupabase } = require("../services/supabaseBackupService");
      await withTimeout(restoreDbFromSupabase(DB_PATH), 20000, "supabase restore");
    } catch (err) {
      console.warn("[supabase] Baslangic geri yukleme atlandi:", err.message);
    }

    if (hasLiveDb && liveUsers > 0) await backupDbFile(DB_PATH);
    bootstrapDbFromLegacy(DB_PATH);
    await restoreDbFromBestCandidate(DB_PATH);
    await consolidateLegacyDbCopies(DB_PATH);
    await restoreFromSeed(DB_PATH);

    try {
      const { recoverDbIfDegraded } = require("../game/veriKorumaService");
      await withTimeout(recoverDbIfDegraded(DB_PATH), 25000, "veri-koruma");
    } catch (err) {
      console.warn("[veri-koruma] Baslangic kontrolu atlandi:", err.message);
    }
  }

  let db = await openDb();
  await configureSqlitePragmas(db);

  const repair = await tryRepairDatabase(db);
  if (!repair.ok) {
    console.warn("[db] Butunluk hatasi:", repair.detail);
    await new Promise((resolve) => db.close(() => resolve()));
    try {
      const { recoverDbIfDegraded } = require("../game/veriKorumaService");
      const rec = await withTimeout(recoverDbIfDegraded(DB_PATH), 30000, "veri-koruma");
      if (rec.recovered) {
        console.log(`[veri-koruma] DB dosyasi degistirildi: ${rec.from}`);
      }
    } catch (err) {
      console.warn("[veri-koruma] Acilis onarimi atlandi:", err.message);
    }
    db = await openDb();
    await configureSqlitePragmas(db);
    const repair2 = await tryRepairDatabase(db);
    if (!repair2.ok) {
      console.warn("[db] Onarim sonrasi hala sorunlu:", repair2.detail);
    }
  }

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      reis_adi TEXT NOT NULL,
      lakap TEXT NOT NULL DEFAULT 'Mafya',
      grup TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );

  try {
    await run(db, `ALTER TABLE users ADD COLUMN lakap TEXT NOT NULL DEFAULT 'Mafya'`);
  } catch (_) {
    /* sütun zaten var */
  }

  await migratePlayersTable(db);

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS players (
      user_id INTEGER PRIMARY KEY,
      kasa INTEGER NOT NULL DEFAULT 10000,
      guc INTEGER NOT NULL DEFAULT 500,
      puan INTEGER NOT NULL DEFAULT 1500,
      icraat INTEGER NOT NULL DEFAULT 25,
      liman_istanbul INTEGER NOT NULL DEFAULT 0,
      last_icraat_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      last_uc_bonus_hour TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run(db, `ALTER TABLE players ADD COLUMN last_uc_bonus_hour TEXT`);
  } catch (_) {
    /* sütun zaten var */
  }

  const playerCols = [
    ["devlet_iliskisi", "INTEGER NOT NULL DEFAULT 100"],
    ["sms_hakki", "INTEGER NOT NULL DEFAULT 50"],
    ["last_sms_day", "TEXT"],
    ["last_seen_at", "INTEGER NOT NULL DEFAULT 0"],
    ["profil_aciklama", "TEXT NOT NULL DEFAULT ''"],
    ["dostlar", "TEXT NOT NULL DEFAULT ''"],
    ["dusmanlar", "TEXT NOT NULL DEFAULT ''"],
    ["profil_resmi", "TEXT NOT NULL DEFAULT ''"],
    ["masa_ozellestirme", "TEXT NOT NULL DEFAULT '{}'"],
    ["bonus_guc", "INTEGER NOT NULL DEFAULT 0"],
    ["last_saatlik_gelir_hour", "TEXT"],
    ["elmas", "INTEGER NOT NULL DEFAULT 0"],
    ["premium_paket", "TEXT NOT NULL DEFAULT ''"],
    ["last_icraat_paket_at", "INTEGER NOT NULL DEFAULT 0"],
    ["premium_paket_bitis", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of playerCols) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {
      /* sütun zaten var */
    }
  }

  await run(
    db,
    `UPDATE players
     SET last_icraat_at = strftime('%s','now')
     WHERE last_icraat_at IS NULL OR last_icraat_at <= 0`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sektor_sahiplik (
      user_id INTEGER NOT NULL,
      sektor TEXT NOT NULL,
      mekan_key TEXT NOT NULL,
      adet INTEGER NOT NULL DEFAULT 0,
      last_income_hour TEXT,
      PRIMARY KEY (user_id, sektor, mekan_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_mesajlari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_user_id INTEGER NOT NULL,
      from_user_id INTEGER,
      tip TEXT NOT NULL DEFAULT 'ozel',
      konu TEXT NOT NULL DEFAULT '',
      icerik TEXT NOT NULL,
      okundu INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_sohbet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mesaj TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS liman_sahiplik (
      liman_id TEXT PRIMARY KEY,
      owner_user_id INTEGER,
      last_income_hour TEXT,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS baba_makamlari (
      makam TEXT PRIMARY KEY,
      owner_user_id INTEGER,
      baba_derki TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sadakat_oylari (
      user_id INTEGER NOT NULL,
      makam TEXT NOT NULL,
      oy TEXT NOT NULL,
      PRIMARY KEY (user_id, makam),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_gruplari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT UNIQUE NOT NULL,
      aciklama TEXT NOT NULL DEFAULT '',
      lider_user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (lider_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_uyeleri (
      grup_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rutbe TEXT NOT NULL DEFAULT 'Mafya Üyesi',
      PRIMARY KEY (grup_id, user_id),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  const { ensureWorldRows } = require("../game/worldService");
  await ensureWorldRows(db);

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_basvurulari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'beklemede',
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_davetleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER NOT NULL,
      davet_eden_user_id INTEGER NOT NULL,
      davet_edilen_user_id INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'beklemede',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (davet_eden_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (davet_edilen_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS profil_ziyaretleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_user_id INTEGER NOT NULL,
      viewer_user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(target_user_id, viewer_user_id),
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // Banka sistemi
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS banka_hesaplari (
      user_id INTEGER PRIMARY KEY,
      yatirilan_miktar INTEGER NOT NULL DEFAULT 0,
      banka_hakki INTEGER NOT NULL DEFAULT 20,
      last_banka_hak_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      faiz_bekleyen INTEGER NOT NULL DEFAULT 0,
      faiz_gun TEXT,
      faiz_islendi_gun TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  const bankaCols = [
    ["banka_hakki", "INTEGER NOT NULL DEFAULT 20"],
    ["last_banka_hak_at", "INTEGER DEFAULT 0"],
    ["faiz_bekleyen", "INTEGER NOT NULL DEFAULT 0"],
    ["faiz_gun", "TEXT"],
    ["faiz_islendi_gun", "TEXT"],
  ];
  for (const [col, def] of bankaCols) {
    try {
      await run(db, `ALTER TABLE banka_hesaplari ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
  try {
    await run(
      db,
      `UPDATE banka_hesaplari SET last_banka_hak_at = strftime('%s','now')
       WHERE last_banka_hak_at IS NULL OR last_banka_hak_at = 0`
    );
  } catch (_) {}

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_kiralama (
      user_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      adet INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, item_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run(db, `ALTER TABLE oyuncu_kiralama ADD COLUMN fiyat_adet INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    await run(
      db,
      `UPDATE oyuncu_kiralama SET fiyat_adet = adet WHERE COALESCE(fiyat_adet, 0) < adet`
    );
  } catch (_) {}

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_grup_mesajlari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      parent_id INTEGER,
      icerik TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  const mesajCols = [
    ["grup_id", "INTEGER"],
    ["grup_mesaj_id", "INTEGER"],
    ["davet_id", "INTEGER"],
  ];
  for (const [col, def] of mesajCols) {
    try {
      await run(db, `ALTER TABLE oyuncu_mesajlari ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }

  // İstihbarat sistemi
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS istihbarat (
      user_id INTEGER PRIMARY KEY,
      eleman_sayisi INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // Mafya savaşları
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_savaslar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saldiran_grup_id INTEGER NOT NULL,
      hedef_grup_id INTEGER NOT NULL,
      baslangic_zamani INTEGER NOT NULL,
      savas_zamani INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'bekliyor',
      FOREIGN KEY (saldiran_grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (hedef_grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_savas_katilim (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      savas_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      grup_id INTEGER NOT NULL,
      UNIQUE(savas_id, user_id),
      FOREIGN KEY (savas_id) REFERENCES mafya_savaslar(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_aylik_sampiyon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      yil INTEGER NOT NULL,
      ay INTEGER NOT NULL,
      grup_id INTEGER NOT NULL,
      toplam_guc INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(yil, ay),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE
    )`
  );

  // Mafya işleri (soygunlar)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_isleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      is_turu TEXT NOT NULL,
      grup_id INTEGER NOT NULL,
      baslangic_zamani INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'hazirlaniyor',
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_is_katilim (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      is_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(is_id, user_id),
      FOREIGN KEY (is_id) REFERENCES mafya_isleri(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // Mafya evi seviyesi
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_evi (
      grup_id INTEGER PRIMARY KEY,
      seviye INTEGER NOT NULL DEFAULT 1,
      birikmis_para INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE
    )`
  );

  // Şehre hükmetme sayacı
  const playerCols2 = [
    ["sehre_hukmet_sayisi", "INTEGER NOT NULL DEFAULT 0"],
    ["kara_listede", "INTEGER NOT NULL DEFAULT 0"],
    ["sehir_efsane", "INTEGER NOT NULL DEFAULT 0"],
    ["aktif_hukumranlik_id", "INTEGER"],
    ["profil_ziyaret_okundu_at", "INTEGER NOT NULL DEFAULT 0"],
    ["meslek_sirket_bildirim", "INTEGER NOT NULL DEFAULT 0"],
    ["yetenek_maas_antrenman_puani", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of playerCols2) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {
      /* sütun zaten var */
    }
  }

  // Medya sistemi
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS medya_haberleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      haber TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      aktif INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run(db, `ALTER TABLE mafya_savaslar ADD COLUMN kazanan_grup_id INTEGER`);
  } catch (_) {}

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS stat_hareketleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tip TEXT NOT NULL,
      delta INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  try {
    await run(db, `ALTER TABLE players ADD COLUMN gazete_okundu_id INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}

  const grupRows = await all(db, `SELECT id, grup FROM users`);
  for (const row of grupRows) {
    const cleaned = temizGrupAdi(row.grup);
    if (cleaned !== row.grup) {
      await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [cleaned, row.id]);
    }
  }

  await run(
    db,
    `UPDATE users SET grup = ''
     WHERE grup = 'Sokakların Hakimi'
       AND id NOT IN (SELECT user_id FROM mafya_uyeleri)`
  );

  const eskiPortreler = await all(
    db,
    `SELECT user_id, profil_resmi FROM players WHERE profil_resmi LIKE 'portre-%'`
  );
  for (const row of eskiPortreler) {
    const yeni = normalizeProfilResmi(row.profil_resmi);
    if (yeni && yeni !== row.profil_resmi) {
      await run(db, `UPDATE players SET profil_resmi = ? WHERE user_id = ?`, [
        yeni,
        row.user_id,
      ]);
    }
  }

  const bosPortreler = await all(
    db,
    `SELECT user_id FROM players WHERE profil_resmi IS NULL OR profil_resmi = ''`
  );
  for (const row of bosPortreler) {
    await run(db, `UPDATE players SET profil_resmi = ? WHERE user_id = ?`, [
      rastgeleProfilResmi(),
      row.user_id,
    ]);
  }

  try {
    const cokluHukum = await all(
      db,
      `SELECT user_id
       FROM sehir_hukumranlik
       WHERE bitis IS NULL
       GROUP BY user_id
       HAVING COUNT(*) > 1`
    );
    for (const row of cokluHukum) {
      const aktifler = await all(
        db,
        `SELECT id FROM sehir_hukumranlik
         WHERE user_id = ? AND bitis IS NULL
         ORDER BY baslangic ASC, id ASC`,
        [row.user_id]
      );
      for (let i = 1; i < aktifler.length; i++) {
        await run(db, `DELETE FROM sehir_hukumranlik WHERE id = ?`, [aktifler[i].id]);
      }
    }
  } catch (_) {
    /* tablo henüz yok */
  }

  const userSecurityCols = [
    ["son_ip", "TEXT NOT NULL DEFAULT ''"],
    ["user_agent", "TEXT NOT NULL DEFAULT ''"],
    ["visitor_id", "TEXT NOT NULL DEFAULT ''"],
    ["last_login_at", "INTEGER NOT NULL DEFAULT 0"],
    ["failed_login_count", "INTEGER NOT NULL DEFAULT 0"],
    ["banned", "INTEGER NOT NULL DEFAULT 0"],
    ["is_admin", "INTEGER NOT NULL DEFAULT 0"],
    ["token_version", "INTEGER NOT NULL DEFAULT 0"],
    ["kayit_ulkesi", "TEXT NOT NULL DEFAULT ''"],
    ["oyun_dili", "TEXT NOT NULL DEFAULT 'tr'"],
  ];
  for (const [col, def] of userSecurityCols) {
    try {
      await run(db, `ALTER TABLE users ADD COLUMN ${col} ${def}`);
    } catch (_) {
      /* sütun zaten var */
    }
  }

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS user_fingerprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      visitor_id TEXT NOT NULL DEFAULT '',
      son_ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_fp_visitor ON user_fingerprints(visitor_id)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_fp_ip ON user_fingerprints(son_ip)`);
  await run(db, `CREATE UNIQUE INDEX IF NOT EXISTS idx_fp_user_visitor_ip ON user_fingerprints(user_id, visitor_id, son_ip)`);

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_type TEXT NOT NULL,
      detail TEXT,
      ip TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_sec_events_user ON security_events(user_id)`);

  await bootstrapAdminUser(db);

  const { ensureGunlukGorevTables } = require("../game/gunlukGorevService");
  await ensureGunlukGorevTables(db);

  const { ensureUserBaseTable, migrateGuvenliYerBonusGuc } = require("../game/guvenliYerService");
  await ensureUserBaseTable(db);
  await migrateGuvenliYerBonusGuc(db);

  const { ensureAktiviteSchema } = require("../game/aktiviteService");
  await ensureAktiviteSchema(db);

  const {
    restoreOyuncuSnapshots,
    enforceLiveSnapshotPolicies,
    bootstrapVolumeSnapshots,
    reconcileHukumBaslangicFromImageSeeds,
  } = require("../game/oyuncuRestoreService");
  bootstrapVolumeSnapshots();
  if (fastStartup && process.env.RESTORE_SNAPSHOTS !== "1") {
    await enforceLiveSnapshotPolicies(db);
    await reconcileHukumBaslangicFromImageSeeds(db);
    console.log("[restore] Canli DB — bozulan snapshot verileri kontrol edildi");
  } else {
    await restoreOyuncuSnapshots(db);
    await reconcileHukumBaslangicFromImageSeeds(db);
  }

  try {
    const { persistLiveGameState } = require("../game/veriKorumaService");
    await persistLiveGameState(db);
  } catch (err) {
    console.warn("[persist] Baslangic kaydi atlandi:", err.message);
  }

  const { ensureSefirlikTables } = require("../game/turkiyeSefirlikService");
  await ensureSefirlikTables(db);

  const { ensureMeslekTables } = require("../game/meslekService");
  await ensureMeslekTables(db);

  const { ensureSirketTables } = require("../game/sirketService");
  await ensureSirketTables(db);

  const { ensureRaporTables } = require("../game/raporService");
  await ensureRaporTables(db);

  const { ensureGorusOneriTables } = require("../game/gorusOneriService");
  await ensureGorusOneriTables(db);

  await logDatabaseStats(db);
  await backupDbFile(DB_PATH);
  return db;
}

async function bootstrapAdminUser(db) {
  const adminUser = getConfiguredAdminUsername();
  if (!adminUser) return;
  try {
    const result = await ensureConfiguredAdmin(db, adminUser);
    if (result.updated) {
      console.log(`Yönetici atandı: ${adminUser} (ADMIN_USERNAME)`);
    }
  } catch (err) {
    console.warn("Yönetici ataması yapılamadı:", err.message);
  }
}

function getConfiguredAdminUsername() {
  return ADMIN_USERNAME;
}

async function ensureConfiguredAdmin(db, username) {
  const adminUser = getConfiguredAdminUsername();
  if (!adminUser) return { updated: false };
  const u = String(username || "").trim().toLowerCase();
  if (u !== adminUser) return { updated: false };
  const result = await run(db, `UPDATE users SET is_admin = 1 WHERE username = ?`, [adminUser]);
  return { updated: (result.changes || 0) > 0 };
}

module.exports = {
  openDb,
  run,
  get,
  all,
  initDatabase,
  DB_PATH,
  backupDbFile,
  scoreDbFile,
  getDbDiagnostics,
  isDbCorrupt,
  isSqliteCorruptError,
  replaceDbFile,
  removeWalSidecars,
  bootstrapAdminUser,
  ensureConfiguredAdmin,
  getConfiguredAdminUsername,
};
