const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { ADMIN_USERNAME } = require("../config");
const { temizGrupAdi } = require("../game/grupAdi");
const { rastgeleProfilResmi, normalizeProfilResmi } = require("../game/profilPortreler");

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "oyun.db");

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
  if (table && table.sql && !table.sql.includes("user_id")) {
    await run(db, "DROP TABLE players");
  }
}

async function initDatabase() {
  const db = await openDb();

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      reis_adi TEXT NOT NULL,
      lakap TEXT NOT NULL DEFAULT 'Mafya',
      grup TEXT NOT NULL DEFAULT 'Sokakların Hakimi',
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
    if (cleaned && cleaned !== row.grup) {
      await run(db, `UPDATE users SET grup = ? WHERE id = ?`, [cleaned, row.id]);
    }
  }

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

  const { ensureUserBaseTable } = require("../game/guvenliYerService");
  await ensureUserBaseTable(db);

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
  bootstrapAdminUser,
  ensureConfiguredAdmin,
  getConfiguredAdminUsername,
};
