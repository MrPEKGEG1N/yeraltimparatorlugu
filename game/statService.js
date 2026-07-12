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

async function aralikIstatistikleri(db, baslangic, bitis) {
  await ensureStatTable(db);
  const rows = await all(
    db,
    `SELECT user_id, tip, SUM(delta) AS toplam
     FROM stat_hareketleri
     WHERE created_at >= ? AND created_at < ?
       AND ((tip = 'sayginlik' AND delta > 0) OR (tip = 'icraat' AND delta > 0))
     GROUP BY user_id, tip`,
    [baslangic, bitis]
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.user_id)) map.set(row.user_id, { sayginlik: 0, icraat: 0 });
    const entry = map.get(row.user_id);
    if (row.tip === "sayginlik") entry.sayginlik += row.toplam || 0;
    else if (row.tip === "icraat") entry.icraat += row.toplam || 0;
  }
  return map;
}

async function arananLiderleriOlustur(db, baslangic, bitis, limit = 5) {
  const map = await aralikIstatistikleri(db, baslangic, bitis);
  const userIds = [...map.keys()];
  if (!userIds.length) {
    const rows = await all(
      db,
      `SELECT u.id AS user_id, u.reis_adi AS isim, p.puan AS toplam, 1 AS fallback, p.profil_resmi
       FROM players p
       JOIN users u ON u.id = p.user_id
       WHERE p.puan > 0
       ORDER BY p.puan DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((r) => ({
      userId: r.user_id,
      isim: r.isim,
      sayginlik: r.toplam || 0,
      icraat: 0,
      puan: r.toplam || 0,
      fallback: true,
      profilResmi: r.profil_resmi || "",
    }));
  }

  const placeholders = userIds.map(() => "?").join(",");
  const users = await all(
    db,
    `SELECT u.id AS user_id, u.reis_adi AS isim, p.profil_resmi
     FROM users u
     JOIN players p ON p.user_id = u.id
     WHERE u.id IN (${placeholders})`,
    userIds
  );

  const liste = users
    .map((u) => {
      const stat = map.get(u.user_id) || { sayginlik: 0, icraat: 0 };
      const puan = stat.sayginlik + stat.icraat;
      return {
        userId: u.user_id,
        isim: u.isim,
        sayginlik: stat.sayginlik,
        icraat: stat.icraat,
        puan,
        fallback: false,
        profilResmi: u.profil_resmi || "",
      };
    })
    .filter((r) => r.puan > 0)
    .sort((a, b) => b.puan - a.puan || b.sayginlik - a.sayginlik)
    .slice(0, limit);

  if (liste.length) return liste;

  const rows = await all(
    db,
    `SELECT u.id AS user_id, u.reis_adi AS isim, p.puan AS toplam, 1 AS fallback, p.profil_resmi
     FROM players p
     JOIN users u ON u.id = p.user_id
     WHERE p.puan > 0
     ORDER BY p.puan DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({
    userId: r.user_id,
    isim: r.isim,
    sayginlik: r.toplam || 0,
    icraat: 0,
    puan: r.toplam || 0,
    fallback: true,
    profilResmi: r.profil_resmi || "",
  }));
}

async function son24SaatSayginlik(db, limit = 5) {
  const son24 = Math.floor(Date.now() / 1000) - 86400;
  const now = Math.floor(Date.now() / 1000);
  const rows = await arananLiderleriOlustur(db, son24, now, limit);
  return rows.map((r) => ({
    user_id: r.userId,
    isim: r.isim,
    toplam: r.puan,
    fallback: r.fallback ? 1 : 0,
    profil_resmi: r.profilResmi,
    sayginlik: r.sayginlik,
    icraat: r.icraat,
  }));
}

async function son24SaatArananlar(db, limit = 5) {
  const son24 = Math.floor(Date.now() / 1000) - 86400;
  const now = Math.floor(Date.now() / 1000);
  return arananLiderleriOlustur(db, son24, now, limit);
}

async function gunAraligiArananLider(db, baslangic, bitis) {
  const liste = await arananLiderleriOlustur(db, baslangic, bitis, 1);
  return liste[0] || null;
}

module.exports = {
  ensureStatTable,
  logStatHareket,
  son24SaatSayginlik,
  son24SaatArananlar,
  arananLiderleriOlustur,
  gunAraligiArananLider,
};
