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
      yeni_reis_adi TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (hukumdar_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  try {
    await run(db, `ALTER TABLE sehir_tarihi ADD COLUMN yeni_reis_adi TEXT`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE players ADD COLUMN sehir_efsane INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE players ADD COLUMN aktif_hukumranlik_id INTEGER`);
  } catch (_) {}
}

/** Hüküm günü: başladığı gün 1, her 24 saatte +1 */
function hukumGunSayisi(baslangic, bitis) {
  const son = bitis ?? Math.floor(Date.now() / 1000);
  const saniye = Math.max(0, son - baslangic);
  return Math.max(1, Math.floor(saniye / 86400) + 1);
}

function gunFarki(baslangic, bitis) {
  return hukumGunSayisi(baslangic, bitis);
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

async function temizleHukumranlikKopyalari(db) {
  const coklu = await all(
    db,
    `SELECT user_id
     FROM sehir_hukumranlik
     WHERE bitis IS NULL
     GROUP BY user_id
     HAVING COUNT(*) > 1`
  );
  for (const row of coklu) {
    const aktifler = await all(
      db,
      `SELECT id, baslangic FROM sehir_hukumranlik
       WHERE user_id = ? AND bitis IS NULL
       ORDER BY baslangic ASC, id ASC`,
      [row.user_id]
    );
    const keeper = aktifler[0];
    for (let i = 1; i < aktifler.length; i++) {
      await run(db, `DELETE FROM sehir_hukumranlik WHERE id = ?`, [aktifler[i].id]);
    }
    if (keeper) {
      await run(
        db,
        `UPDATE players SET aktif_hukumranlik_id = ? WHERE user_id = ?`,
        [keeper.id, row.user_id]
      );
    }
  }
}

async function aktifHukumdarKaydi(db) {
  let row = await get(
    db,
    `SELECT h.user_id, u.reis_adi AS hukumdar_adi, h.baslangic, h.onceki_user_id, h.id
     FROM players p
     JOIN users u ON u.id = p.user_id
     JOIN sehir_hukumranlik h ON h.user_id = p.user_id AND h.bitis IS NULL
     WHERE p.kara_listede = 1
     ORDER BY h.baslangic ASC, h.id ASC
     LIMIT 1`
  );
  if (row) return row;

  return get(
    db,
    `SELECT h.user_id, u.reis_adi AS hukumdar_adi, h.baslangic, h.onceki_user_id, h.id
     FROM sehir_hukumranlik h
     JOIN users u ON u.id = h.user_id
     WHERE h.bitis IS NULL
     ORDER BY h.baslangic ASC, h.id ASC
     LIMIT 1`
  );
}

async function hukumranlikKapat(db, userId, kaybedenId, yeniId) {
  const row = await get(
    db,
    `SELECT h.id, h.baslangic, h.onceki_user_id, u.reis_adi
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

  let oncekiReisAdi = null;
  if (row.onceki_user_id) {
    const onceki = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [row.onceki_user_id]);
    oncekiReisAdi = onceki?.reis_adi || null;
  }
  const yeni = yeniId ? await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [yeniId]) : null;

  await run(
    db,
    `INSERT INTO sehir_tarihi (hukumdar_user_id, hukumdar_adi, baslangic, bitis, gun_sayisi, onceki_reis_adi, kaybeden_reis_adi, yeni_reis_adi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      row.reis_adi,
      row.baslangic,
      now,
      gunFarki(row.baslangic, now),
      oncekiReisAdi,
      row.reis_adi,
      yeni?.reis_adi || null,
    ]
  );
}

async function hukumranlikBaslat(db, userId, oncekiUserId) {
  const aktif = await get(
    db,
    `SELECT id FROM sehir_hukumranlik WHERE user_id = ? AND bitis IS NULL ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  if (aktif) return;

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
  const kendiAktif = await get(
    db,
    `SELECT id FROM sehir_hukumranlik WHERE user_id = ? AND bitis IS NULL ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  if (kendiAktif) {
    await hukumranlikKapat(db, userId, userId, null);
  }
  await hukumranlikBaslat(db, userId, oncekiUserId || null);
}

async function hukumdarligiBitir(db, userId) {
  await ensureSaygiTables(db);
  await hukumranlikKapat(db, userId, userId, null);
}

async function syncAktifHukumBaslangic(db, userId, baslangicUnix) {
  await ensureSaygiTables(db);
  const hedef = parseInt(baslangicUnix, 10);
  if (!hedef || hedef <= 0) return false;
  const row = await get(
    db,
    `SELECT id, baslangic FROM sehir_hukumranlik WHERE user_id = ? AND bitis IS NULL ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  if (!row) return false;
  if (Math.abs(Number(row.baslangic || 0) - hedef) < 3600) return false;
  await run(db, `UPDATE sehir_hukumranlik SET baslangic = ? WHERE id = ?`, [hedef, row.id]);
  console.log(
    `[saygi] Hukum baslangic guncellendi: user=${userId} ${row.baslangic} -> ${hedef}`
  );
  return true;
}

async function saygiDuvariniGetir(db) {
  await ensureSaygiTables(db);
  await temizleHukumranlikKopyalari(db);
  const now = Math.floor(Date.now() / 1000);
  const rows = await all(
    db,
    `SELECT u.id AS user_id, u.reis_adi, p.puan, p.sehir_efsane, p.kara_listede,
            COALESCE(SUM(
              CASE WHEN h.bitis IS NOT NULL THEN h.bitis - h.baslangic
                   ELSE ? - h.baslangic END
            ), 0) AS toplam_saniye,
            (SELECT h2.baslangic FROM sehir_hukumranlik h2
             WHERE h2.user_id = u.id AND h2.bitis IS NULL
             ORDER BY h2.baslangic DESC LIMIT 1) AS aktif_baslangic
     FROM users u
     JOIN players p ON p.user_id = u.id
     LEFT JOIN sehir_hukumranlik h ON h.user_id = u.id
     GROUP BY u.id
     HAVING toplam_saniye > 0
     ORDER BY toplam_saniye DESC, p.puan DESC
     LIMIT 8`,
    [now]
  );
  return rows.map((r) => {
    let gun;
    if (r.kara_listede && r.aktif_baslangic) {
      gun = hukumGunSayisi(r.aktif_baslangic, now);
    } else {
      gun = Math.max(1, Math.floor((r.toplam_saniye || 0) / 86400) + 1);
    }
    return {
      userId: r.user_id,
      reisAdi: r.reis_adi,
      puan: r.puan,
      efsane: !!r.sehir_efsane,
      gun,
      hukumdar: !!r.kara_listede,
    };
  });
}

async function sehirTarihiniGetir(db) {
  await ensureSaygiTables(db);
  await temizleHukumranlikKopyalari(db);
  const now = Math.floor(Date.now() / 1000);
  const gecmis = await all(
    db,
    `SELECT hukumdar_user_id, hukumdar_adi, baslangic, bitis, gun_sayisi, onceki_reis_adi, kaybeden_reis_adi, yeni_reis_adi
     FROM sehir_tarihi
     ORDER BY baslangic ASC`
  );
  const aktifRow = await aktifHukumdarKaydi(db);
  const ham = [];

  gecmis.forEach((g) => {
    ham.push({
      userId: g.hukumdar_user_id,
      hukumdarAdi: g.hukumdar_adi,
      baslangic: g.baslangic,
      bitis: g.bitis,
      gunSayisi: g.gun_sayisi,
      oncekiReisAdi: g.onceki_reis_adi,
      yeniReisAdi: g.yeni_reis_adi,
      aktif: false,
    });
  });

  if (aktifRow) {
    let oncekiAdi = null;
    if (aktifRow.onceki_user_id) {
      const o = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [aktifRow.onceki_user_id]);
      oncekiAdi = o?.reis_adi || null;
    }
    ham.push({
      userId: aktifRow.user_id,
      hukumdarAdi: aktifRow.hukumdar_adi,
      baslangic: aktifRow.baslangic,
      bitis: null,
      gunSayisi: gunFarki(aktifRow.baslangic, now),
      oncekiReisAdi: oncekiAdi,
      yeniReisAdi: null,
      aktif: true,
    });
  }

  ham.sort((a, b) => (a.baslangic || 0) - (b.baslangic || 0));

  for (let i = 0; i < ham.length; i++) {
    if (!ham[i].yeniReisAdi && !ham[i].aktif && ham[i + 1]) {
      ham[i].yeniReisAdi = ham[i + 1].hukumdarAdi;
      ham[i].yeniReisUserId = ham[i + 1].userId;
    }
    if (!ham[i].oncekiReisAdi && i > 0) {
      ham[i].oncekiReisAdi = ham[i - 1].hukumdarAdi;
      ham[i].oncekiReisUserId = ham[i - 1].userId;
    }
  }

  return ham.map((k) => ({
    userId: k.userId,
    hukumdarAdi: k.hukumdarAdi,
    baslangic: k.baslangic,
    bitis: k.bitis,
    gunSayisi: k.gunSayisi || gunFarki(k.baslangic, k.bitis || now),
    oncekiReisAdi: k.oncekiReisAdi || null,
    oncekiReisUserId: k.oncekiReisUserId || null,
    yeniReisAdi: k.yeniReisAdi || null,
    yeniReisUserId: k.yeniReisUserId || null,
    aktif: !!k.aktif,
    baslangicMetin: trTarih(k.baslangic),
    bitisMetin: k.bitis ? trTarih(k.bitis) : null,
  }));
}

module.exports = {
  ZAYIF_HAMLE_MSG,
  ensureSaygiTables,
  temizleHukumranlikKopyalari,
  yeniHukumdarRejimBaslat,
  hukumdarligiBitir,
  hukumGunSayisi,
  syncAktifHukumBaslangic,
  saygiDuvariniGetir,
  sehirTarihiniGetir,
};
