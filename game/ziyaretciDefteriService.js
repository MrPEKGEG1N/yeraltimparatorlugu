const { run, get, all } = require("../db/database");
const { smsHarca, getSmsHakki } = require("./messagingService");

const DEFTER_MAX_LEN = 280;
const DEFTER_LISTE_LIMIT = 40;

async function ensureZiyaretciDefteri(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS ziyaretci_defteri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_user_id INTEGER NOT NULL,
      yazar_user_id INTEGER NOT NULL,
      metin TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (yazar_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS ziyaretci_defteri_oy (
      kayit_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      oy INTEGER NOT NULL CHECK (oy IN (-1, 1)),
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (kayit_id, user_id),
      FOREIGN KEY (kayit_id) REFERENCES ziyaretci_defteri(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  try {
    await run(
      db,
      `CREATE INDEX IF NOT EXISTS idx_ziyaretci_defteri_target
       ON ziyaretci_defteri(target_user_id, created_at DESC)`
    );
  } catch (_) {}
}

function sanitizeDefterMetin(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, DEFTER_MAX_LEN);
}

function kayitMap(row) {
  return {
    id: row.id,
    yazarUserId: row.yazar_user_id,
    yazarAdi: row.yazar_adi || "—",
    metin: row.metin || "",
    createdAt: row.created_at || 0,
    begeni: Number(row.begeni) || 0,
    begenme: Number(row.begenme) || 0,
    benimOy: row.benim_oy == null ? 0 : Number(row.benim_oy),
  };
}

async function defterListeGetir(db, targetUserId, viewerUserId) {
  await ensureZiyaretciDefteri(db);
  const vid = Number(viewerUserId) || 0;
  const rows = await all(
    db,
    `SELECT d.id, d.target_user_id, d.yazar_user_id, d.metin, d.created_at,
            u.reis_adi AS yazar_adi,
            (SELECT COUNT(*) FROM ziyaretci_defteri_oy o
              WHERE o.kayit_id = d.id AND o.oy = 1) AS begeni,
            (SELECT COUNT(*) FROM ziyaretci_defteri_oy o
              WHERE o.kayit_id = d.id AND o.oy = -1) AS begenme,
            (SELECT o.oy FROM ziyaretci_defteri_oy o
              WHERE o.kayit_id = d.id AND o.user_id = ?) AS benim_oy
     FROM ziyaretci_defteri d
     JOIN users u ON u.id = d.yazar_user_id
     WHERE d.target_user_id = ?
     ORDER BY d.created_at DESC
     LIMIT ?`,
    [vid, targetUserId, DEFTER_LISTE_LIMIT]
  );
  return (rows || []).map(kayitMap);
}

async function defterYaz(db, yazarUserId, targetUserId, metin) {
  await ensureZiyaretciDefteri(db);
  const tid = Number(targetUserId);
  const yid = Number(yazarUserId);
  if (!tid || !yid) return { ok: false, error: "Geçersiz oyuncu." };
  if (tid === yid) return { ok: false, error: "Kendi defterine yazamazsın." };

  const hedef = await get(db, `SELECT id FROM users WHERE id = ?`, [tid]);
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı." };

  const temiz = sanitizeDefterMetin(metin);
  if (!temiz) return { ok: false, error: "Yazı boş olamaz." };

  const sms = await smsHarca(db, yid);
  if (!sms.ok) {
    return { ok: false, error: "Şu an yazı bırakılamıyor." };
  }

  const now = Math.floor(Date.now() / 1000);
  const ins = await run(
    db,
    `INSERT INTO ziyaretci_defteri (target_user_id, yazar_user_id, metin, created_at)
     VALUES (?, ?, ?, ?)`,
    [tid, yid, temiz, now]
  );

  const yazar = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [yid]);
  const kayit = {
    id: ins?.lastID || null,
    yazarUserId: yid,
    yazarAdi: yazar?.reis_adi || "—",
    metin: temiz,
    createdAt: now,
    begeni: 0,
    begenme: 0,
    benimOy: 0,
  };
  const liste = await defterListeGetir(db, tid, yid);
  const smsHakki = await getSmsHakki(db, yid);
  return { ok: true, kayit, liste, smsHakki };
}

async function defterOyVer(db, userId, kayitId, tip) {
  await ensureZiyaretciDefteri(db);
  const uid = Number(userId);
  const kid = Number(kayitId);
  if (!uid || !kid) return { ok: false, error: "Geçersiz istek." };

  const istenen = tip === "begenme" || tip === -1 || tip === "-1" ? -1 : 1;

  const kayit = await get(
    db,
    `SELECT id, target_user_id FROM ziyaretci_defteri WHERE id = ?`,
    [kid]
  );
  if (!kayit) return { ok: false, error: "Yazı bulunamadı." };

  const mevcut = await get(
    db,
    `SELECT oy FROM ziyaretci_defteri_oy WHERE kayit_id = ? AND user_id = ?`,
    [kid, uid]
  );

  if (mevcut && Number(mevcut.oy) === istenen) {
    await run(
      db,
      `DELETE FROM ziyaretci_defteri_oy WHERE kayit_id = ? AND user_id = ?`,
      [kid, uid]
    );
  } else if (mevcut) {
    await run(
      db,
      `UPDATE ziyaretci_defteri_oy SET oy = ?, created_at = strftime('%s','now')
       WHERE kayit_id = ? AND user_id = ?`,
      [istenen, kid, uid]
    );
  } else {
    await run(
      db,
      `INSERT INTO ziyaretci_defteri_oy (kayit_id, user_id, oy, created_at)
       VALUES (?, ?, ?, strftime('%s','now'))`,
      [kid, uid, istenen]
    );
  }

  const counts = await get(
    db,
    `SELECT
       (SELECT COUNT(*) FROM ziyaretci_defteri_oy WHERE kayit_id = ? AND oy = 1) AS begeni,
       (SELECT COUNT(*) FROM ziyaretci_defteri_oy WHERE kayit_id = ? AND oy = -1) AS begenme,
       (SELECT oy FROM ziyaretci_defteri_oy WHERE kayit_id = ? AND user_id = ?) AS benim_oy`,
    [kid, kid, kid, uid]
  );

  return {
    ok: true,
    kayitId: kid,
    targetUserId: kayit.target_user_id,
    begeni: Number(counts?.begeni) || 0,
    begenme: Number(counts?.begenme) || 0,
    benimOy: counts?.benim_oy == null ? 0 : Number(counts.benim_oy),
  };
}

module.exports = {
  DEFTER_MAX_LEN,
  DEFTER_LISTE_LIMIT,
  ensureZiyaretciDefteri,
  defterListeGetir,
  defterYaz,
  defterOyVer,
};
