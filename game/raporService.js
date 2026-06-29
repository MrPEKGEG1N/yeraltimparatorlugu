const { run, get, all } = require("../db/database");

const SEBEP_MIN = 10;
const SEBEP_MAX = 500;
const TEKRAR_SURE = 3600;

async function ensureRaporTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS icerik_raporlari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raporlayan_user_id INTEGER NOT NULL,
      hedef_tip TEXT NOT NULL,
      hedef_user_id INTEGER,
      hedef_grup_id INTEGER,
      hedef_baslik TEXT NOT NULL DEFAULT '',
      sebep TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (raporlayan_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_rapor_created ON icerik_raporlari(created_at DESC)`);
}

function sanitizeSebep(raw) {
  return String(raw || "")
    .trim()
    .slice(0, SEBEP_MAX);
}

async function raporGonder(db, raporlayanUserId, { tip, hedefUserId, hedefGrupId, sebep }) {
  const temizTip = tip === "mafya_grup" ? "mafya_grup" : "profil";
  const temizSebep = sanitizeSebep(sebep);
  if (temizSebep.length < SEBEP_MIN) {
    return { ok: false, error: `Sebep en az ${SEBEP_MIN} karakter olmalı.` };
  }

  let hedefBaslik = "";
  let targetUserId = null;
  let targetGrupId = null;

  if (temizTip === "profil") {
    const uid = parseInt(hedefUserId, 10);
    if (!uid) return { ok: false, error: "Geçersiz hedef." };
    if (uid === raporlayanUserId) return { ok: false, error: "Kendi profilini raporlayamazsın." };
    const u = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [uid]);
    if (!u) return { ok: false, error: "Oyuncu bulunamadı." };
    targetUserId = uid;
    hedefBaslik = u.reis_adi;
  } else {
    const gid = parseInt(hedefGrupId, 10);
    if (!gid) return { ok: false, error: "Geçersiz grup." };
    const g = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [gid]);
    if (!g) return { ok: false, error: "Grup bulunamadı." };
    const uyem = await get(
      db,
      `SELECT 1 FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`,
      [gid, raporlayanUserId]
    );
    if (uyem) return { ok: false, error: "Kendi grubunu raporlayamazsın." };
    targetGrupId = gid;
    hedefBaslik = g.isim;
  }

  const simdi = Math.floor(Date.now() / 1000);
  const son = await get(
    db,
    `SELECT id FROM icerik_raporlari
     WHERE raporlayan_user_id = ? AND hedef_tip = ?
       AND COALESCE(hedef_user_id, 0) = COALESCE(?, 0)
       AND COALESCE(hedef_grup_id, 0) = COALESCE(?, 0)
       AND created_at > ?`,
    [raporlayanUserId, temizTip, targetUserId, targetGrupId, simdi - TEKRAR_SURE]
  );
  if (son) return { ok: false, error: "Bu içeriği kısa süre önce raporladın." };

  await run(
    db,
    `INSERT INTO icerik_raporlari (raporlayan_user_id, hedef_tip, hedef_user_id, hedef_grup_id, hedef_baslik, sebep)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [raporlayanUserId, temizTip, targetUserId, targetGrupId, hedefBaslik, temizSebep]
  );

  return { ok: true, mesaj: "Raporun iletildi. Teşekkürler." };
}

async function raporlariListele(db, limit = 100) {
  const cap = Math.min(200, Math.max(1, limit));
  return all(
    db,
    `SELECT r.*, u.reis_adi AS raporlayan_adi, u.username AS raporlayan_username
     FROM icerik_raporlari r
     JOIN users u ON u.id = r.raporlayan_user_id
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [cap]
  );
}

function mapRaporRow(r) {
  return {
    id: r.id,
    tip: r.hedef_tip,
    tipLabel: r.hedef_tip === "mafya_grup" ? "Mafya Grubu" : "Profil",
    hedefBaslik: r.hedef_baslik,
    hedefUserId: r.hedef_user_id,
    hedefGrupId: r.hedef_grup_id,
    sebep: r.sebep,
    raporlayanId: r.raporlayan_user_id,
    raporlayanAdi: r.raporlayan_adi,
    raporlayanUsername: r.raporlayan_username,
    at: r.created_at,
  };
}

module.exports = {
  ensureRaporTables,
  raporGonder,
  raporlariListele,
  mapRaporRow,
};
