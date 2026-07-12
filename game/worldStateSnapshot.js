/**
 * Oyuncu snapshot'larina dahil olmayan dunya durumu (piyango havuzu vb.)
 * Volume + seed JSON olarak saklanir; canli DB'den dusukse geri yuklenir.
 */
const fs = require("fs");
const path = require("path");
const { getPersistentDataPath } = require("../db/persistPath");
const { get, all } = require("../db/database");

const FILE_NAME = "world-state.json";
const VERSION = 1;

function snapshotPaths() {
  const out = [];
  const vol = getPersistentDataPath();
  if (vol) out.push(path.join(vol, FILE_NAME));
  out.push(
    path.join(process.cwd(), "seed", FILE_NAME),
    path.join(__dirname, "..", "seed", FILE_NAME)
  );
  return [...new Set(out.map((p) => path.resolve(p)))];
}

function readSnapshotFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

function loadBestSnapshot() {
  let best = null;
  for (const p of snapshotPaths()) {
    const data = readSnapshotFile(p);
    if (!data) continue;
    const jackpot = data?.piyango?.jackpot_birikim || 0;
    const exportedAt = data.exportedAt || 0;
    const score = jackpot * 1e6 + exportedAt;
    const bestScore = (best?.piyango?.jackpot_birikim || 0) * 1e6 + (best?.exportedAt || 0);
    if (!best || score > bestScore) best = data;
  }
  return best;
}

async function readPiyangoState(db) {
  try {
    const meta = await get(db, `SELECT jackpot_birikim FROM kumarhane_piyango_meta WHERE id = 1`);
    const cekilis = await get(
      db,
      `SELECT id, donem, durum, havuz_toplam, odul_toplam, kazanan_sayisi
       FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
    );
    let ucretliBilet = 0;
    if (cekilis?.id) {
      const row = await get(
        db,
        `SELECT COUNT(*) AS n FROM kumarhane_piyango_bilet WHERE cekilis_id = ? AND ucretsiz = 0`,
        [cekilis.id]
      );
      ucretliBilet = row?.n || 0;
    }
    return {
      jackpot_birikim: meta?.jackpot_birikim || 0,
      acikCekilis: cekilis || null,
      ucretliBilet,
    };
  } catch {
    return { jackpot_birikim: 0, acikCekilis: null, ucretliBilet: 0 };
  }
}

async function exportWorldState(db) {
  const piyango = await readPiyangoState(db);
  const payload = {
    version: VERSION,
    exportedAt: Math.floor(Date.now() / 1000),
    piyango,
  };

  let written = 0;
  for (const dest of snapshotPaths()) {
    try {
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const existing = readSnapshotFile(dest);
      const existingJackpot = existing?.piyango?.jackpot_birikim || 0;
      if (existingJackpot > piyango.jackpot_birikim && existing.exportedAt > payload.exportedAt - 300) {
        continue;
      }
      fs.writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
      written++;
    } catch (err) {
      console.warn("[world-state] Yazilamadi:", dest, err.message);
    }
  }
  return { written, piyango };
}

async function importWorldState(db, opts = {}) {
  if (!opts.snapshot && !loadBestSnapshot()) {
    try {
      const { downloadWorldStateSnapshot, isConfigured } = require("../services/supabaseBackupService");
      const { snapshotPaths } = require("./worldStateSnapshot");
      if (isConfigured()) {
        for (const p of snapshotPaths()) {
          if (!fs.existsSync(path.dirname(p))) continue;
          await downloadWorldStateSnapshot(p);
          break;
        }
      }
    } catch (_) {}
  }
  const snapshot = opts.snapshot || loadBestSnapshot();
  if (!snapshot?.piyango) return { restored: false, reason: "no_snapshot" };

  const { jackpotBirikimAyarla } = require("./kumarhanePiyangoService");

  const current = await readPiyangoState(db);
  const targetJackpot = Math.max(
    0,
    Math.floor(snapshot.piyango.jackpot_birikim || 0),
    opts.forceJackpot != null ? Math.floor(opts.forceJackpot) : 0
  );

  let restored = false;
  if (targetJackpot > current.jackpot_birikim) {
    await jackpotBirikimAyarla(db, targetJackpot);
    restored = true;
    console.log(
      `[world-state] Piyango devri geri yuklendi: ${current.jackpot_birikim} -> ${targetJackpot}`
    );
  }

  return {
    restored,
    jackpot: targetJackpot,
    previousJackpot: current.jackpot_birikim,
    sourceExportedAt: snapshot.exportedAt,
  };
}

module.exports = {
  FILE_NAME,
  snapshotPaths,
  loadBestSnapshot,
  readPiyangoState,
  exportWorldState,
  importWorldState,
};
