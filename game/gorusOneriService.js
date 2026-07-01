const { run, get, all } = require("../db/database");

const MESAJ_MIN = 10;
const MESAJ_MAX = 2000;
const TEKRAR_SURE = 300;

async function ensureGorusOneriTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_gorus_onerileri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mesaj TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_gorus_oneri_created ON oyuncu_gorus_onerileri(created_at DESC)`
  );
}

function sanitizeMesaj(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, MESAJ_MAX);
}

async function gorusOneriGonder(db, userId, mesaj) {
  const temiz = sanitizeMesaj(mesaj);
  if (temiz.length < MESAJ_MIN) {
    return { ok: false, error: `Mesaj en az ${MESAJ_MIN} karakter olmalı.` };
  }

  const simdi = Math.floor(Date.now() / 1000);
  const son = await get(
    db,
    `SELECT id FROM oyuncu_gorus_onerileri
     WHERE user_id = ? AND created_at > ?`,
    [userId, simdi - TEKRAR_SURE]
  );
  if (son) {
    return { ok: false, error: "Kısa süre önce görüş gönderdin. Biraz bekleyip tekrar dene." };
  }

  await run(
    db,
    `INSERT INTO oyuncu_gorus_onerileri (user_id, mesaj) VALUES (?, ?)`,
    [userId, temiz]
  );

  return { ok: true, mesaj: "Görüşün iletildi. Teşekkürler!" };
}

async function gorusOnerileriListele(db, limit = 100) {
  const cap = Math.min(200, Math.max(1, limit));
  return all(
    db,
    `SELECT g.*, u.reis_adi AS oyuncu_adi, u.username AS oyuncu_username
     FROM oyuncu_gorus_onerileri g
     JOIN users u ON u.id = g.user_id
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [cap]
  );
}

function mapGorusOneriRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    oyuncuAdi: r.oyuncu_adi,
    oyuncuUsername: r.oyuncu_username,
    mesaj: r.mesaj,
    at: r.created_at,
  };
}

module.exports = {
  ensureGorusOneriTables,
  gorusOneriGonder,
  gorusOnerileriListele,
  mapGorusOneriRow,
};
