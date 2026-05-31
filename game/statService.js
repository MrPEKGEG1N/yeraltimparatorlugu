const { run, all } = require("../db/database");

async function ensureStatTable(db) {
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
}

async function logStatHareket(db, userId, tip, delta) {
  if (!userId || !delta) return;
  await ensureStatTable(db);
  await run(
    db,
    `INSERT INTO stat_hareketleri (user_id, tip, delta, created_at) VALUES (?, ?, ?, ?)`,
    [userId, tip, delta, Math.floor(Date.now() / 1000)]
  );
}

async function son24SaatSayginlik(db, limit = 5) {
  await ensureStatTable(db);
  const son24 = Math.floor(Date.now() / 1000) - 86400;
  const rows = await all(
    db,
    `SELECT u.id AS user_id, u.reis_adi AS isim, SUM(s.delta) AS toplam, 0 AS fallback
     FROM stat_hareketleri s
     JOIN users u ON u.id = s.user_id
     WHERE s.tip = 'sayginlik' AND s.delta > 0 AND s.created_at > ?
     GROUP BY s.user_id
     HAVING toplam > 0
     ORDER BY toplam DESC
     LIMIT ?`,
    [son24, limit]
  );
  if (rows.length) return rows;
  return all(
    db,
    `SELECT u.id AS user_id, u.reis_adi AS isim, p.puan AS toplam, 1 AS fallback
     FROM players p
     JOIN users u ON u.id = p.user_id
     WHERE p.puan > 0
     ORDER BY p.puan DESC
     LIMIT ?`,
    [limit]
  );
}

module.exports = { ensureStatTable, logStatHareket, son24SaatSayginlik };
