const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const { initDatabase, get, DB_PATH, backupDbFile, getDbDiagnostics } = require("./db/database");
const { ensureMessagingTables } = require("./game/messagingService");
const { ensureBildirimTables, configureWebPush } = require("./game/bildirimService");
const { createAuthRouter } = require("./routes/auth");
const { createGameRouter } = require("./routes/game");
const { createAdminRouter } = require("./routes/admin");
const { savasiCoz } = require("./game/mafyaSavasService");
const { aySonuKontrol } = require("./game/aylikMafyaSampiyonService");
const { faizIsle } = require("./game/bankaService");
const { gunlukMaasIsle } = require("./game/gunlukMaasService");
const { saatlikGelirIsle } = require("./game/saatlikGelirService");
const { JWT_SECRET } = require("./config");
const { attachLang, localizeResponse } = require("./middleware/lang");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

if (process.env.NODE_ENV === "production" && JWT_SECRET.includes("dev-gizli")) {
  console.warn("⚠️  ÜRETİM: JWT_SECRET ortam değişkeni ile ayarlanmalı!");
}

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://openfpcdn.io",
          "https://cdn.tailwindcss.com",
        ],
        "script-src-attr": ["'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", "https://openfpcdn.io", "https://cdn.tailwindcss.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://cdn.tailwindcss.com",
        ],
      },
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Sunucu yoğun. Lütfen kısa süre sonra tekrar dene." },
});

app.use("/api", globalApiLimiter);
app.use("/api", attachLang);
app.use("/api", localizeResponse);

async function start() {
  const db = await initDatabase();
  await ensureMessagingTables(db);
  await ensureBildirimTables(db);
  configureWebPush();

  app.get("/api/health", async (req, res) => {
    try {
      const diag = await getDbDiagnostics();
      const row = await get(db, "SELECT COUNT(*) AS n FROM users");
      let dd1 = null;
      const dd1Row = await get(
        db,
        `SELECT u.id, p.kasa, p.puan, p.icraat, p.sms_hakki, COALESCE(p.bonus_guc,0) AS bonus_guc, p.guc
         FROM users u JOIN players p ON p.user_id = u.id WHERE u.username = 'dd1'`
      );
      if (dd1Row) {
        const mekan = await get(
          db,
          `SELECT COALESCE(SUM(adet),0) AS t FROM sektor_sahiplik WHERE user_id = ?`,
          [dd1Row.id]
        );
        const gy = await get(db, `SELECT base_seviye FROM user_base WHERE user_id = ?`, [dd1Row.id]);
        const ist = await get(db, `SELECT eleman_sayisi FROM istihbarat WHERE user_id = ?`, [dd1Row.id]);
        dd1 = {
          ok:
            dd1Row.kasa === 580784000 &&
            dd1Row.puan >= 159850 &&
            dd1Row.icraat === 250 &&
            dd1Row.sms_hakki === 349 &&
            (mekan?.t || 0) === 88 &&
            (gy?.base_seviye || 0) === 15 &&
            (ist?.eleman_sayisi || 0) === 2,
          kasa: dd1Row.kasa,
          puan: dd1Row.puan,
          mekanToplam: mekan?.t || 0,
          guvenliYer: gy?.base_seviye || 0,
          istihbarat: ist?.eleman_sayisi || 0,
          toplamGuc: (dd1Row.guc || 0) + (dd1Row.bonus_guc || 0),
        };
      }
      res.json({
        ok: true,
        name: "yeralti-imparatorlugu",
        version: require("./package.json").version,
        commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
        auth: true,
        mafya: true,
        oyuncular: row?.n || 0,
        db: DB_PATH,
        volume: diag.volumeMount,
        volumeOk: diag.volumeOk,
        supabase: diag.supabase,
        seed: diag.seed,
        kaliciVeri: diag.volumeOk && diag.supabase?.configured
          ? "railway-volume+supabase"
          : diag.volumeOk
            ? "railway-volume"
            : diag.supabase?.configured
              ? "supabase-yedek"
              : diag.seed?.ok
                ? "seed-yedek"
                : "riskli",
        dd1,
        uyari: !diag.volumeMount && !diag.supabase?.configured && !diag.seed?.ok
          ? "Kalici depolama yok! Railway Volume, Supabase veya seed/oyun.db gerekli."
          : !diag.volumeMount && !diag.supabase?.configured && diag.seed?.ok
            ? "Volume yok; deployda seed/oyun.db + oyuncu snapshotlari geri yuklenir. Volume onerilir."
            : !diag.volumeMount && diag.supabase?.configured
              ? "Railway Volume yok; Supabase yedegi aktif. Volume eklemek onerilir."
              : !diag.volumeOk
                ? "DB yolu volume mount ile uyusmuyor — DATABASE_PATH degiskenini kaldirin."
                : null,
      });
    } catch (err) {
      res.json({ ok: true, name: "yeralti-imparatorlugu", auth: true, mafya: true });
    }
  });

  setInterval(() => {
    savasiCoz(db).catch((err) => console.error("Mafya savaşı çözüm hatası:", err));
  }, 60 * 1000);

  setInterval(() => {
    const { sabotajKuyrukIsle } = require("./game/sabotajService");
    sabotajKuyrukIsle(db).catch((err) => console.error("Sabotaj kuyruk hatası:", err));
  }, 60 * 1000);

  const { ensureBorsaTables, fiyatGuncelle, temettuIsle } = require("./game/borsaService");
  ensureBorsaTables(db)
    .then(() => fiyatGuncelle(db))
    .catch((err) => console.error("Borsa başlangıç hatası:", err));
  temettuIsle(db).catch((err) => console.error("Borsa temettü telafi hatası:", err));
  setInterval(() => {
    fiyatGuncelle(db).catch((err) => console.error("Borsa fiyat hatası:", err));
  }, 3 * 60 * 1000);
  setInterval(() => {
    temettuIsle(db).catch((err) => console.error("Borsa temettü hatası:", err));
  }, 60 * 1000);

  setInterval(() => {
    faizIsle(db).catch((err) => console.error("Banka faiz hatası:", err));
  }, 60 * 1000);

  setInterval(() => {
    saatlikGelirIsle(db).catch((err) => console.error("Saatlik gelir hatası:", err));
  }, 60 * 1000);

  await saatlikGelirIsle(db).catch((err) => console.error("Saatlik gelir telafi hatası:", err));

  setInterval(() => {
    gunlukMaasIsle(db).catch((err) => console.error("Günlük maaş/rapor hatası:", err));
  }, 60 * 1000);

  await gunlukMaasIsle(db, { startup: true }).catch((err) =>
    console.error("Günlük maaş telafi hatası:", err)
  );

  const { restoreOyuncuSnapshots } = require("./game/oyuncuRestoreService");
  await restoreOyuncuSnapshots(db);

  aySonuKontrol(db).catch((err) => console.error("Aylık mafya şampiyonu hatası:", err));
  setInterval(() => {
    aySonuKontrol(db).catch((err) => console.error("Aylık mafya şampiyonu hatası:", err));
  }, 5 * 60 * 1000);

  setInterval(() => {
    backupDbFile(DB_PATH).catch((err) => console.warn("[db] Periyodik yedek hatasi:", err.message));
  }, 6 * 60 * 60 * 1000);

  setInterval(() => {
    const { uploadDbBackup } = require("./services/supabaseBackupService");
    uploadDbBackup(DB_PATH).catch((err) =>
      console.warn("[supabase] Periyodik yedek hatasi:", err.message)
    );
  }, 30 * 60 * 1000);

  // Ilk acilista Supabase'e yedekle (volume varsa da bulut kopyasi)
  const { uploadDbBackup } = require("./services/supabaseBackupService");
  uploadDbBackup(DB_PATH).catch(() => {});

  app.use("/api/auth", createAuthRouter(db));
  app.use("/api/admin", createAdminRouter(db));
  app.use("/api", createGameRouter(db));

  app.get("/admin", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin", "index.html"));
  });

  app.get("/admin/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin", "index.html"));
  });

  app.use("/api", (req, res) => {
    res.status(404).json({
      ok: false,
      error: `API yolu yok (${req.method} ${req.originalUrl}). Oyunu npm start ile başlatıp http://localhost:${PORT} adresinden aç.`,
    });
  });

  function sendNoCacheHtml(res, filePath) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(filePath);
  }

  app.get(["/", "/index.html"], (req, res) => {
    sendNoCacheHtml(res, path.join(PUBLIC_DIR, "index.html"));
  });

  app.use("/static", express.static(path.join(__dirname, "static")));
  app.use(
    express.static(PUBLIC_DIR, {
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    })
  );

  app.listen(PORT, () => {
    console.log(`Yeraltı İmparatorluğu: http://localhost:${PORT}`);
    console.log("Durdurmak için Ctrl+C");
  });

  let shuttingDown = false;
  async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[db] ${signal} — yedek aliniyor...`);
    try {
      await backupDbFile(DB_PATH);
      const { uploadDbBackup } = require("./services/supabaseBackupService");
      await uploadDbBackup(DB_PATH);
      await new Promise((resolve) => db.close(() => resolve()));
    } catch (err) {
      console.warn("[db] Kapanis yedegi hatasi:", err.message);
    }
    process.exit(0);
  }
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Sunucu başlatılamadı:", err);
  process.exit(1);
});
