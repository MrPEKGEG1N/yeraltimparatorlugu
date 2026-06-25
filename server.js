const express = require("express");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const { initDatabase, get, DB_PATH, backupDbFile, getDbDiagnostics } = require("./db/database");
const { ensureMessagingTables } = require("./game/messagingService");
const { createAuthRouter } = require("./routes/auth");
const { createGameRouter } = require("./routes/game");
const { createAdminRouter } = require("./routes/admin");
const { savasiCoz, aylikMafyaOzeti } = require("./game/mafyaSavasService");
const { faizIsle } = require("./game/bankaService");
const { JWT_SECRET } = require("./config");

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

async function start() {
  const db = await initDatabase();
  await ensureMessagingTables(db);

  app.get("/api/health", async (req, res) => {
    try {
      const diag = await getDbDiagnostics();
      const row = await get(db, "SELECT COUNT(*) AS n FROM users");
      res.json({
        ok: true,
        name: "yeralti-imparatorlugu",
        auth: true,
        mafya: true,
        oyuncular: row?.n || 0,
        db: DB_PATH,
        volume: diag.volumeMount,
        volumeOk: diag.volumeOk,
        uyari: !diag.volumeMount
          ? "Railway Volume bagli degil — deployda oyuncu verileri silinir! Panelden servise Volume ekleyin (mount: /app/db)."
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
    faizIsle(db).catch((err) => console.error("Banka faiz hatası:", err));
  }, 60 * 1000);

  function aylikRaporKontrol() {
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() < 10) {
      aylikMafyaOzeti(db).catch((err) => console.error("Aylık mafya raporu hatası:", err));
    }
  }
  setInterval(aylikRaporKontrol, 5 * 60 * 1000);

  setInterval(() => {
    backupDbFile(DB_PATH).catch((err) => console.warn("[db] Periyodik yedek hatasi:", err.message));
  }, 6 * 60 * 60 * 1000);

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
