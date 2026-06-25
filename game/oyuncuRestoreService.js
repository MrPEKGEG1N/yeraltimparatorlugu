const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { run, get, all } = require("../db/database");
const { rastgeleProfilResmi } = require("./profilPortreler");
const { ensureAktiviteSchema } = require("./aktiviteService");

const SNAPSHOT_DIR = path.join(process.cwd(), "seed", "oyuncular");

const PLAYER_COLS = [
  "kasa",
  "guc",
  "puan",
  "icraat",
  "devlet_iliskisi",
  "sms_hakki",
  "profil_aciklama",
  "profil_resmi",
  "aktif_ekran",
  "son_aksiyon",
  "son_aksiyon_detay",
  "son_aksiyon_at",
  "last_seen_at",
  "bonus_guc",
  "kara_listede",
  "sehir_efsane",
];

async function findSnapshotUser(db, snap) {
  const username = String(snap.username || "").trim().toLowerCase();
  if (username) {
    const byUser = await get(db, `SELECT id FROM users WHERE username = ?`, [username]);
    if (byUser) return byUser.id;
  }
  const reis = String(snap.reis_adi || "").trim();
  const ip = String(snap.son_ip || "").trim();
  if (reis && ip) {
    const byReisIp = await get(
      db,
      `SELECT id FROM users WHERE reis_adi = ? COLLATE NOCASE AND son_ip = ?`,
      [reis, ip]
    );
    if (byReisIp) return byReisIp.id;
  }
  if (reis) {
    const byReis = await get(db, `SELECT id FROM users WHERE reis_adi = ? COLLATE NOCASE`, [reis]);
    if (byReis) return byReis.id;
  }
  return null;
}

async function upsertFingerprint(db, userId, fp) {
  const visitorId = String(fp.visitor_id || "").trim();
  const sonIp = String(fp.son_ip || "").trim();
  if (!visitorId && !sonIp) return;
  const now = Math.floor(Date.now() / 1000);
  const first = fp.first_seen || now;
  const last = fp.last_seen || now;
  const ua = String(fp.user_agent || "").slice(0, 500);
  await run(
    db,
    `INSERT INTO user_fingerprints (user_id, visitor_id, son_ip, user_agent, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, visitor_id, son_ip) DO UPDATE SET
       user_agent = excluded.user_agent,
       last_seen = excluded.last_seen`,
    [userId, visitorId, sonIp, ua, first, last]
  );
}

async function restoreAktiviteLog(db, userId, logs) {
  if (!Array.isArray(logs) || !logs.length) return;
  const mevcut = await get(
    db,
    `SELECT COUNT(*) AS n FROM oyuncu_aktivite_log WHERE user_id = ?`,
    [userId]
  );
  if ((mevcut?.n || 0) > 0) return;
  for (const row of logs) {
    await run(
      db,
      `INSERT INTO oyuncu_aktivite_log (user_id, ekran, aksiyon, detay, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        String(row.ekran || "").slice(0, 80),
        String(row.aksiyon || "").slice(0, 80),
        String(row.detay || "").slice(0, 200),
        row.created_at || Math.floor(Date.now() / 1000),
      ]
    );
  }
}

async function restoreSecurityEvents(db, userId, events) {
  if (!Array.isArray(events) || !events.length) return;
  for (const ev of events) {
    const exists = await get(
      db,
      `SELECT id FROM security_events
       WHERE user_id = ? AND event_type = ? AND ip = ? AND created_at = ?`,
      [userId, ev.event_type, ev.ip || "", ev.created_at || 0]
    );
    if (exists) continue;
    await run(
      db,
      `INSERT INTO security_events (user_id, event_type, detail, ip, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        String(ev.event_type || "restore"),
        String(ev.detail || "").slice(0, 500),
        String(ev.ip || "").slice(0, 64),
        ev.created_at || Math.floor(Date.now() / 1000),
      ]
    );
  }
}

async function restoreOneSnapshot(db, snap) {
  const username = String(snap.username || "").trim().toLowerCase();
  const reisAdi = String(snap.reis_adi || username || "").trim();
  if (!username || !reisAdi) return { ok: false, reason: "eksik kimlik" };

  let userId = await findSnapshotUser(db, snap);
  let created = false;

  if (!userId) {
    let passwordHash = snap.password_hash;
    if (!passwordHash && snap.restore_password) {
      passwordHash = await bcrypt.hash(String(snap.restore_password), 10);
    }
    if (!passwordHash) return { ok: false, reason: "sifre yok" };

    const result = await run(
      db,
      `INSERT INTO users (username, password_hash, reis_adi, lakap, son_ip, visitor_id, user_agent, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        passwordHash,
        reisAdi,
        snap.lakap || "Mafya",
        snap.son_ip || "",
        snap.visitor_id || "",
        snap.user_agent || "",
        snap.created_at || Math.floor(Date.now() / 1000),
        snap.last_login_at || 0,
      ]
    );
    userId = result.lastID;
    created = true;

    const portre = snap.player?.profil_resmi || rastgeleProfilResmi();
    await run(db, `INSERT INTO players (user_id, profil_resmi) VALUES (?, ?)`, [userId, portre]);
  } else {
    await run(
      db,
      `UPDATE users SET
         reis_adi = ?,
         lakap = COALESCE(?, lakap),
         son_ip = CASE WHEN ? != '' THEN ? ELSE son_ip END,
         visitor_id = CASE WHEN ? != '' THEN ? ELSE visitor_id END,
         user_agent = CASE WHEN ? != '' THEN ? ELSE user_agent END,
         last_login_at = MAX(COALESCE(last_login_at, 0), ?)
       WHERE id = ?`,
      [
        reisAdi,
        snap.lakap || null,
        snap.son_ip || "",
        snap.son_ip || "",
        snap.visitor_id || "",
        snap.visitor_id || "",
        snap.user_agent || "",
        snap.user_agent || "",
        snap.last_login_at || 0,
        userId,
      ]
    );
  }

  const player = snap.player || {};
  const sets = [];
  const vals = [];
  for (const col of PLAYER_COLS) {
    if (player[col] !== undefined && player[col] !== null && player[col] !== "") {
      sets.push(`${col} = ?`);
      vals.push(player[col]);
    }
  }
  if (sets.length) {
    vals.push(userId);
    await run(db, `UPDATE players SET ${sets.join(", ")} WHERE user_id = ?`, vals);
  }

  const fps = Array.isArray(snap.fingerprints) ? snap.fingerprints : [];
  if (snap.visitor_id || snap.son_ip) {
    fps.unshift({
      visitor_id: snap.visitor_id || "",
      son_ip: snap.son_ip || "",
      user_agent: snap.user_agent || "",
      first_seen: snap.created_at,
      last_seen: snap.last_login_at || snap.created_at,
    });
  }
  for (const fp of fps) await upsertFingerprint(db, userId, fp);

  await restoreAktiviteLog(db, userId, snap.aktivite_log);
  await restoreSecurityEvents(db, userId, snap.security_events);

  console.log(
    `[restore] ${created ? "Eklendi" : "Guncellendi"}: ${username} (${reisAdi}) ip=${snap.son_ip || "-"}`
  );
  return { ok: true, userId, created, username, reisAdi };
}

async function restoreOyuncuSnapshots(db) {
  if (!fs.existsSync(SNAPSHOT_DIR)) return [];
  await ensureAktiviteSchema(db);
  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const results = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SNAPSHOT_DIR, file), "utf8");
      const snap = JSON.parse(raw);
      results.push(await restoreOneSnapshot(db, snap));
    } catch (err) {
      console.warn(`[restore] ${file} yuklenemedi:`, err.message);
      results.push({ ok: false, file, error: err.message });
    }
  }
  return results;
}

module.exports = { restoreOyuncuSnapshots, restoreOneSnapshot };
