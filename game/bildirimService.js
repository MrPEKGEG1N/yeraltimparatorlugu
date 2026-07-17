const fs = require("fs");
const path = require("path");
const { run, get, all } = require("../db/database");

let webpush = null;
try {
  webpush = require("web-push");
} catch (_) {}

let firebaseAdmin = null;
let firebaseInitTried = false;

const VAPID_FILE = path.join(__dirname, "..", "db", "vapid.json");

const BILDIRIM_TURLERI = {
  saatlik_gelir: "Saatlik gelir",
  gunluk_gorev: "Günlük görevler yenilendi",
  is_maasi: "İş maaşı yattı",
  ise_alindi: "İşe alındın",
  isten_atildi: "İşten atıldın",
  sirket_raporu: "Şirket raporu çıktı",
  saldiri: "Saldırıya uğradın",
  sabotaj: "Sabotaj",
  borsa_temettu: "Borsa temettüsü",
  borsa_emir: "Borsa emri gerçekleşti",
  gazete: "Gazetede yeni olay",
  mafya_savas_baslatildi: "Mafya grubun savaş başlattı",
  mafya_savas_acildi: "Mafya grubuna savaş açıldı",
  mafya_davet: "Mafya grubu daveti",
  zam_onay: "Zam talebin onaylandı",
  zam_red: "Zam talebin reddedildi",
  sirket_kapandi: "Şirket kapandı",
  kumarhane_pvp: "Kumarhane masası",
  ozel_mesaj: "Özel mesaj",
};

const TUR_ANAHTARLARI = Object.keys(BILDIRIM_TURLERI);

const EK_TERCIH_KOLONLARI = [
  "bildirim_aktif",
  "borsa_temettu",
  "borsa_emir",
  "mafya_davet",
  "zam_onay",
  "zam_red",
  "sirket_kapandi",
  "kumarhane_pvp",
  "ozel_mesaj",
];

async function ensureBildirimTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_bildirim_tercihleri (
      user_id INTEGER PRIMARY KEY,
      push_aktif INTEGER NOT NULL DEFAULT 1,
      saatlik_gelir INTEGER NOT NULL DEFAULT 1,
      gunluk_gorev INTEGER NOT NULL DEFAULT 1,
      is_maasi INTEGER NOT NULL DEFAULT 1,
      ise_alindi INTEGER NOT NULL DEFAULT 1,
      isten_atildi INTEGER NOT NULL DEFAULT 1,
      sirket_raporu INTEGER NOT NULL DEFAULT 1,
      saldiri INTEGER NOT NULL DEFAULT 1,
      sabotaj INTEGER NOT NULL DEFAULT 1,
      borsa_temettu INTEGER NOT NULL DEFAULT 1,
      borsa_emir INTEGER NOT NULL DEFAULT 1,
      gazete INTEGER NOT NULL DEFAULT 1,
      mafya_savas_baslatildi INTEGER NOT NULL DEFAULT 1,
      mafya_savas_acildi INTEGER NOT NULL DEFAULT 1,
      mafya_davet INTEGER NOT NULL DEFAULT 1,
      zam_onay INTEGER NOT NULL DEFAULT 1,
      zam_red INTEGER NOT NULL DEFAULT 1,
      sirket_kapandi INTEGER NOT NULL DEFAULT 1,
      kumarhane_pvp INTEGER NOT NULL DEFAULT 1,
      ozel_mesaj INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_push_abonelik (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_push_abonelik_user ON oyuncu_push_abonelik(user_id)`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_fcm_token (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL DEFAULT 'android',
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_fcm_token_user ON oyuncu_fcm_token(user_id)`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_bildirimleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tur TEXT NOT NULL,
      baslik TEXT NOT NULL,
      icerik TEXT NOT NULL,
      okundu INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_bildirim_user_okundu ON oyuncu_bildirimleri(user_id, okundu, created_at DESC)`
  );
  for (const col of EK_TERCIH_KOLONLARI) {
    try {
      await run(
        db,
        `ALTER TABLE oyuncu_bildirim_tercihleri ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 1`
      );
    } catch (_) {}
  }
  await run(
    db,
    `INSERT INTO oyuncu_bildirim_tercihleri (user_id)
     SELECT u.id FROM users u
     LEFT JOIN oyuncu_bildirim_tercihleri t ON t.user_id = u.id
     WHERE t.user_id IS NULL`
  );
}

async function bildirimAktifMi(db, userId) {
  const row = await ensureTercihler(db, userId);
  return !!(row?.bildirim_aktif ?? 1);
}

function getVapidKeys() {
  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv };
  }
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
      if (parsed.publicKey && parsed.privateKey) return parsed;
    }
  } catch (_) {}
  if (!webpush) return null;
  const keys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), "utf8");
    console.log("[bildirim] VAPID anahtarları oluşturuldu:", VAPID_FILE);
    console.warn(
      "[bildirim] Canlıda kalıcı abonelik için VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env ayarlayın."
    );
  } catch (err) {
    console.warn("[bildirim] VAPID dosyası yazılamadı:", err.message);
  }
  return keys;
}

function configureWebPush() {
  if (!webpush) return false;
  const keys = getVapidKeys();
  if (!keys) return false;
  const subject = process.env.VAPID_SUBJECT || "mailto:destek@yeraltimparatorlugu.com";
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return true;
}

function vapidPublicKey() {
  const keys = getVapidKeys();
  return keys ? keys.publicKey : null;
}

function getFirebaseAdmin() {
  if (firebaseInitTried) return firebaseAdmin;
  firebaseInitTried = true;
  try {
    firebaseAdmin = require("firebase-admin");
  } catch (_) {
    firebaseAdmin = null;
    return null;
  }
  if (firebaseAdmin.apps && firebaseAdmin.apps.length) return firebaseAdmin;

  try {
    let cred = null;
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson) {
      cred = JSON.parse(rawJson);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      cred = JSON.parse(fs.readFileSync(p, "utf8"));
    }
    if (!cred) {
      firebaseAdmin = null;
      return null;
    }
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(cred),
    });
    return firebaseAdmin;
  } catch (err) {
    console.warn("[bildirim] Firebase init başarısız:", err.message);
    firebaseAdmin = null;
    return null;
  }
}

async function ensureTercihler(db, userId) {
  await ensureBildirimTables(db);
  let row = await get(db, `SELECT * FROM oyuncu_bildirim_tercihleri WHERE user_id = ?`, [userId]);
  if (row) return row;
  await run(db, `INSERT INTO oyuncu_bildirim_tercihleri (user_id) VALUES (?)`, [userId]);
  row = await get(db, `SELECT * FROM oyuncu_bildirim_tercihleri WHERE user_id = ?`, [userId]);
  return row;
}

function tercihMap(row) {
  const out = {
    bildirimAktif: !!(row?.bildirim_aktif ?? 1),
    pushAktif: !!(row?.push_aktif ?? 1),
  };
  for (const tur of TUR_ANAHTARLARI) {
    out[tur] = !!(row?.[tur] ?? 1);
  }
  return out;
}

async function tercihleriGetir(db, userId) {
  const row = await ensureTercihler(db, userId);
  return {
    turler: BILDIRIM_TURLERI,
    tercihler: tercihMap(row),
  };
}

async function tercihleriKaydet(db, userId, patch) {
  await ensureTercihler(db, userId);
  if (patch.pushAktif === false) {
    await pushAbonelikSil(db, userId, null);
    await fcmTokenSil(db, userId, null);
  }
  const sets = [];
  const params = [];
  if (patch.bildirimAktif !== undefined) {
    sets.push("bildirim_aktif = ?");
    params.push(patch.bildirimAktif ? 1 : 0);
  }
  if (patch.pushAktif !== undefined) {
    sets.push("push_aktif = ?");
    params.push(patch.pushAktif ? 1 : 0);
  }
  for (const tur of TUR_ANAHTARLARI) {
    if (patch[tur] !== undefined) {
      sets.push(`${tur} = ?`);
      params.push(patch[tur] ? 1 : 0);
    }
  }
  if (!sets.length) return tercihleriGetir(db, userId);
  params.push(userId);
  await run(db, `UPDATE oyuncu_bildirim_tercihleri SET ${sets.join(", ")} WHERE user_id = ?`, params);
  return tercihleriGetir(db, userId);
}

async function turIzinliMi(db, userId, tur) {
  if (!TUR_ANAHTARLARI.includes(tur)) return false;
  const row = await ensureTercihler(db, userId);
  return !!(row?.[tur] ?? 1);
}

async function pushAbonelikEkle(db, userId, sub, userAgent = "") {
  await ensureBildirimTables(db);
  const endpoint = String(sub?.endpoint || "").trim();
  const p256dh = String(sub?.keys?.p256dh || "").trim();
  const auth = String(sub?.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Geçersiz push aboneliği." };
  }
  await run(
    db,
    `INSERT INTO oyuncu_push_abonelik (user_id, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       user_agent = excluded.user_agent`,
    [userId, endpoint, p256dh, auth, String(userAgent || "").slice(0, 300)]
  );
  await run(db, `UPDATE oyuncu_bildirim_tercihleri SET push_aktif = 1 WHERE user_id = ?`, [userId]);
  return { ok: true, mesaj: "Push aboneliği kaydedildi." };
}

async function pushAbonelikSil(db, userId, endpoint) {
  await ensureBildirimTables(db);
  if (endpoint) {
    await run(db, `DELETE FROM oyuncu_push_abonelik WHERE user_id = ? AND endpoint = ?`, [
      userId,
      endpoint,
    ]);
  } else {
    await run(db, `DELETE FROM oyuncu_push_abonelik WHERE user_id = ?`, [userId]);
    await run(db, `UPDATE oyuncu_bildirim_tercihleri SET push_aktif = 0 WHERE user_id = ?`, [userId]);
  }
  return { ok: true };
}

async function fcmTokenKaydet(db, userId, token, platform = "android") {
  await ensureBildirimTables(db);
  const t = String(token || "").trim();
  if (!t || t.length < 20) {
    return { ok: false, error: "Geçersiz FCM token." };
  }
  const plat = String(platform || "android").slice(0, 32);
  await run(
    db,
    `INSERT INTO oyuncu_fcm_token (user_id, token, platform, updated_at)
     VALUES (?, ?, ?, strftime('%s','now'))
     ON CONFLICT(token) DO UPDATE SET
       user_id = excluded.user_id,
       platform = excluded.platform,
       updated_at = strftime('%s','now')`,
    [userId, t, plat]
  );
  await run(db, `UPDATE oyuncu_bildirim_tercihleri SET push_aktif = 1 WHERE user_id = ?`, [userId]);
  return { ok: true, mesaj: "FCM token kaydedildi." };
}

async function fcmTokenSil(db, userId, token) {
  await ensureBildirimTables(db);
  if (token) {
    await run(db, `DELETE FROM oyuncu_fcm_token WHERE user_id = ? AND token = ?`, [userId, token]);
  } else {
    await run(db, `DELETE FROM oyuncu_fcm_token WHERE user_id = ?`, [userId]);
  }
  return { ok: true };
}

async function pushGonder(db, userId, payload) {
  if (!webpush || !configureWebPush()) return;
  const row = await ensureTercihler(db, userId);
  if (!row?.push_aktif) return;
  const subs = await all(db, `SELECT endpoint, p256dh, auth FROM oyuncu_push_abonelik WHERE user_id = ?`, [
    userId,
  ]);
  if (!subs.length) return;
  const body = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        { TTL: 86400 }
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await run(db, `DELETE FROM oyuncu_push_abonelik WHERE endpoint = ?`, [sub.endpoint]);
      }
    }
  }
}

async function fcmGonder(db, userId, payload) {
  const admin = getFirebaseAdmin();
  if (!admin) return;
  const row = await ensureTercihler(db, userId);
  if (!row?.push_aktif) return;
  const tokens = await all(db, `SELECT token FROM oyuncu_fcm_token WHERE user_id = ?`, [userId]);
  if (!tokens.length) return;

  const title = String(payload.title || "Yeraltı İmparatorluğu").slice(0, 120);
  const body = String(payload.body || "").slice(0, 500);
  const url = String(payload.url || "/").slice(0, 200);
  const data = {
    title,
    body,
    url,
    tur: String(payload.tur || ""),
    id: String(payload.id || ""),
  };

  for (const rowTok of tokens) {
    try {
      await admin.messaging().send({
        token: rowTok.token,
        notification: { title, body },
        data,
        android: {
          priority: "high",
          ttl: 86400000,
          notification: {
            channelId: "yeralti_bildirim",
            sound: "default",
          },
        },
      });
    } catch (err) {
      const code = err?.code || err?.errorInfo?.code || "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        await run(db, `DELETE FROM oyuncu_fcm_token WHERE token = ?`, [rowTok.token]);
      }
    }
  }
}

async function bildirimGonder(db, userId, tur, { baslik, icerik, url = "/" } = {}) {
  if (!userId || !tur || !baslik) return { ok: false };
  const aktif = await bildirimAktifMi(db, userId);
  if (!aktif) return { ok: false, skipped: "bildirim_kapali" };
  const izinli = await turIzinliMi(db, userId, tur);
  if (!izinli) return { ok: false, skipped: "tercih_kapali" };

  const temizBaslik = String(baslik).slice(0, 120);
  const temizIcerik = String(icerik || "").slice(0, 500);
  const temizUrl = String(url || "/").slice(0, 200);

  await ensureBildirimTables(db);
  const sonuc = await run(
    db,
    `INSERT INTO oyuncu_bildirimleri (user_id, tur, baslik, icerik) VALUES (?, ?, ?, ?)`,
    [userId, tur, temizBaslik, temizIcerik]
  );

  const payload = {
    title: temizBaslik,
    body: temizIcerik,
    url: temizUrl,
    tur,
    id: sonuc?.lastID,
  };

  setImmediate(() => {
    pushGonder(db, userId, payload).catch(() => {});
    fcmGonder(db, userId, payload).catch(() => {});
  });

  return { ok: true, id: sonuc?.lastID };
}

async function bildirimleriGetir(db, userId, limit = 40) {
  await ensureBildirimTables(db);
  const rows = await all(
    db,
    `SELECT id, tur, baslik, icerik, okundu, created_at
     FROM oyuncu_bildirimleri WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [userId, Math.min(80, Math.max(1, limit))]
  );
  return rows.map((r) => ({
    id: r.id,
    tur: r.tur,
    baslik: r.baslik,
    icerik: r.icerik,
    okundu: !!r.okundu,
    at: r.created_at,
  }));
}

async function okunmamisBildirimSayisi(db, userId) {
  await ensureBildirimTables(db);
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM oyuncu_bildirimleri WHERE user_id = ? AND okundu = 0`,
    [userId]
  );
  return row?.n || 0;
}

async function bildirimleriOkundu(db, userId, ids) {
  await ensureBildirimTables(db);
  if (!ids || !ids.length) {
    await run(db, `UPDATE oyuncu_bildirimleri SET okundu = 1 WHERE user_id = ?`, [userId]);
    return { ok: true };
  }
  const placeholders = ids.map(() => "?").join(",");
  await run(
    db,
    `UPDATE oyuncu_bildirimleri SET okundu = 1 WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids]
  );
  return { ok: true };
}

async function bildirimleriSil(db, userId, { ids, tumu } = {}) {
  await ensureBildirimTables(db);
  if (tumu) {
    await run(db, `DELETE FROM oyuncu_bildirimleri WHERE user_id = ?`, [userId]);
    return { ok: true, silinen: "tumu" };
  }
  const idList = (Array.isArray(ids) ? ids : [])
    .map((id) => parseInt(id, 10))
    .filter((id) => id > 0);
  if (!idList.length) {
    return { ok: false, error: "Silinecek bildirim seçilmedi." };
  }
  const placeholders = idList.map(() => "?").join(",");
  await run(
    db,
    `DELETE FROM oyuncu_bildirimleri WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...idList]
  );
  return { ok: true, silinen: idList.length };
}

async function gazeteBildirimYayinla(db, mesaj) {
  await ensureBildirimTables(db);
  const kullanicilar = await all(
    db,
    `SELECT u.id FROM users u
     LEFT JOIN oyuncu_bildirim_tercihleri t ON t.user_id = u.id
     WHERE COALESCE(u.banned, 0) = 0 AND COALESCE(t.bildirim_aktif, 1) = 1 AND COALESCE(t.gazete, 1) = 1`
  );
  const kisa = String(mesaj || "").replace(/^\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}\s—\s/, "").slice(0, 200);
  for (const u of kullanicilar) {
    bildirimGonder(db, u.id, "gazete", {
      baslik: "Gazetede yeni olay",
      icerik: kisa,
      url: "/?ekran=gazete",
    }).catch(() => {});
  }
}

async function grupUyelerineBildir(db, grupId, tur, baslik, icerik, url) {
  const uyeler = await all(db, `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`, [grupId]);
  for (const u of uyeler) {
    bildirimGonder(db, u.user_id, tur, { baslik, icerik, url }).catch(() => {});
  }
}

async function bildirimTestGonder(db, userId) {
  return bildirimGonder(db, userId, "saatlik_gelir", {
    baslik: "Test bildirimi",
    icerik: "Bildirim sistemi çalışıyor. Oyun içi ve tarayıcı uyarıları bu kanaldan gelir.",
    url: "/",
  });
}

async function bildirimSistemDurumu(db) {
  await ensureBildirimTables(db);
  const keys = getVapidKeys();
  const admin = getFirebaseAdmin();
  return {
    webPushYuklu: !!webpush,
    vapidHazir: !!(keys?.publicKey && keys?.privateKey),
    vapidEnv: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    pushYapilandirildi: configureWebPush(),
    fcmHazir: !!admin,
  };
}

module.exports = {
  BILDIRIM_TURLERI,
  TUR_ANAHTARLARI,
  ensureBildirimTables,
  vapidPublicKey,
  configureWebPush,
  tercihleriGetir,
  tercihleriKaydet,
  pushAbonelikEkle,
  pushAbonelikSil,
  fcmTokenKaydet,
  fcmTokenSil,
  bildirimGonder,
  bildirimleriGetir,
  okunmamisBildirimSayisi,
  bildirimleriOkundu,
  bildirimleriSil,
  gazeteBildirimYayinla,
  grupUyelerineBildir,
  bildirimAktifMi,
  bildirimTestGonder,
  bildirimSistemDurumu,
  ensureTercihler,
};
