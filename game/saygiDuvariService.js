const { get, all, run } = require("../db/database");
const ZAYIF_HAMLE_MSG = "Zayıf hamle, büyük rezillik. Geri dur!";

async function ensureSaygiTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sehir_hukumranlik (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      baslangic INTEGER NOT NULL,
      bitis INTEGER,
      onceki_user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sehir_tarihi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hukumdar_user_id INTEGER NOT NULL,
      hukumdar_adi TEXT NOT NULL,
      baslangic INTEGER NOT NULL,
      bitis INTEGER NOT NULL,
      gun_sayisi INTEGER NOT NULL,
      onceki_reis_adi TEXT,
      kaybeden_reis_adi TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (hukumdar_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  try {
    await run(db, `ALTER TABLE players ADD COLUMN sehir_efsane INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE players ADD COLUMN aktif_hukumranlik_id INTEGER`);
  } catch (_) {}
}

function gunFarki(baslangic, bitis) {
  const saniye = Math.max(0, bitis - baslangic);
  return Math.max(1, Math.ceil(saniye / 86400));
}

function trTarih(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function hukumranlikKapat(db, userId, kaybedenId, yeniId) {
  const row = await get(
    db,
    `SELECT h.id, h.baslangic, u.reis_adi
     FROM sehir_hukumranlik h
     JOIN users u ON u.id = h.user_id
     WHERE h.user_id = ? AND h.bitis IS NULL
     ORDER BY h.id DESC LIMIT 1`,
    [userId]
  );
  if (!row) return;
  const now = Math.floor(Date.now() / 1000);
  await run(db, `UPDATE sehir_hukumranlik SET bitis = ? WHERE id = ?`, [now, row.id]);
  await run(db, `UPDATE players SET aktif_hukumranlik_id = NULL WHERE user_id = ?`, [userId]);

  const onceki = kaybedenId
    ? await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [kaybedenId])
    : null;
  const yeni = yeniId ? await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [yeniId]) : null;

  await run(
    db,
    `INSERT INTO sehir_tarihi (hukumdar_user_id, hukumdar_adi, baslangic, bitis, gun_sayisi, onceki_reis_adi, kaybeden_reis_adi)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      row.reis_adi,
      row.baslangic,
      now,
      gunFarki(row.baslangic, now),
      onceki?.reis_adi || null,
      row.reis_adi,
    ]
  );
}

async function hukumranlikBaslat(db, userId, oncekiUserId) {
  const now = Math.floor(Date.now() / 1000);
  const ins = await run(
    db,
    `INSERT INTO sehir_hukumranlik (user_id, baslangic, onceki_user_id) VALUES (?, ?, ?)`,
    [userId, now, oncekiUserId || null]
  );
  await run(db, `UPDATE players SET sehir_efsane = 1, aktif_hukumranlik_id = ? WHERE user_id = ?`, [
    ins.lastID,
    userId,
  ]);
}

async function yeniHukumdarRejimBaslat(db, userId, oncekiUserId) {
  await ensureSaygiTables(db);
  if (oncekiUserId && oncekiUserId !== userId) {
    await hukumranlikKapat(db, oncekiUserId, oncekiUserId, userId);
  }
  await hukumranlikBaslat(db, userId, oncekiUserId || null);
}

async function hukumdarligiBitir(db, userId) {
  await ensureSaygiTables(db);
  await hukumranlikKapat(db, userId, userId, null);
}

async function saygiDuvariniGetir(db) {
  await ensureSaygiTables(db);
  const now = Math.floor(Date.now() / 1000);
  const rows = await all(
    db,
    `SELECT u.id AS user_id, u.reis_adi, p.puan, p.sehir_efsane,
            COALESCE(SUM(
              CASE WHEN h.bitis IS NOT NULL THEN h.bitis - h.baslangic
                   ELSE ? - h.baslangic END
            ), 0) AS toplam_saniye
     FROM sehir_hukumranlik h
     JOIN users u ON u.id = h.user_id
     JOIN players p ON p.user_id = u.id
     GROUP BY h.user_id
     ORDER BY toplam_saniye DESC, p.puan DESC
     LIMIT 8`,
    [now]
  );
  return rows.map((r) => ({
    userId: r.user_id,
    reisAdi: r.reis_adi,
    puan: r.puan,
    efsane: !!r.sehir_efsane,
    gun: Math.max(1, Math.ceil((r.toplam_saniye || 0) / 86400)),
  }));
}

async function sehirTarihiniGetir(db) {
  await ensureSaygiTables(db);
  const now = Math.floor(Date.now() / 1000);
  const gecmis = await all(
    db,
    `SELECT hukumdar_adi, baslangic, bitis, gun_sayisi, onceki_reis_adi, kaybeden_reis_adi
     FROM sehir_tarihi
     ORDER BY baslangic DESC
     LIMIT 50`
  );
  const aktif = await all(
    db,
    `SELECT u.reis_adi AS hukumdar_adi, h.baslangic, h.onceki_user_id
     FROM sehir_hukumranlik h
     JOIN users u ON u.id = h.user_id
     WHERE h.bitis IS NULL
     ORDER BY h.id DESC
     LIMIT 1`
  );
  const liste = [];
  if (aktif.length) {
    const a = aktif[0];
    let oncekiAdi = null;
    if (a.onceki_user_id) {
      const o = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [a.onceki_user_id]);
      oncekiAdi = o?.reis_adi || null;
    }
    liste.push({
      hukumdarAdi: a.hukumdar_adi,
      baslangic: a.baslangic,
      bitis: null,
      gunSayisi: gunFarki(a.baslangic, now),
      oncekiReisAdi: oncekiAdi,
      kaybedenReisAdi: null,
      aktif: true,
      baslangicMetin: trTarih(a.baslangic),
    });
  }
  gecmis.forEach((g) => {
    liste.push({
      hukumdarAdi: g.hukumdar_adi,
      baslangic: g.baslangic,
      bitis: g.bitis,
      gunSayisi: g.gun_sayisi,
      oncekiReisAdi: g.onceki_reis_adi,
      kaybedenReisAdi: g.kaybeden_reis_adi,
      aktif: false,
      baslangicMetin: trTarih(g.baslangic),
      bitisMetin: trTarih(g.bitis),
    });
  });
  return liste;
}

module.exports = {
  ZAYIF_HAMLE_MSG,
  ensureSaygiTables,
  yeniHukumdarRejimBaslat,
  hukumdarligiBitir,
  saygiDuvariniGetir,
  sehirTarihiniGetir,
};
