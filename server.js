const express = require("express");

const path = require("path");

const cookieParser = require("cookie-parser");

const { initDatabase } = require("./db/database");

const { createAuthRouter } = require("./routes/auth");

const { createGameRouter } = require("./routes/game");
const { savasiCoz } = require("./game/mafyaSavasService");



const app = express();

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");



app.use(express.json());

app.use(cookieParser());



app.get("/api/health", (req, res) => {

  res.json({ ok: true, name: "yeralti-imparatorlugu", auth: true, mafya: true });

});



async function start() {

  const db = await initDatabase();

  // Arka plan: Mafya savaşlarını zamanı gelince çöz
  setInterval(() => {
    savasiCoz(db).catch((err) => console.error("Mafya savaşı çözüm hatası:", err));
  }, 60 * 1000);


  // API önce — static dosyalar /api yolunu ezmesin

  app.use("/api/auth", createAuthRouter(db));

  app.use("/api", createGameRouter(db));

  app.use("/api", (req, res) => {
    res.status(404).json({
      ok: false,
      error: `API yolu yok (${req.method} ${req.originalUrl}). Oyunu npm start ile başlatıp http://localhost:${PORT} adresinden aç.`,
    });
  });

  app.use(express.static(PUBLIC_DIR));



  app.listen(PORT, () => {

    console.log(`Yeraltı İmparatorluğu: http://localhost:${PORT}`);

    console.log("Durdurmak için Ctrl+C");

  });

}



start().catch((err) => {

  console.error("Sunucu başlatılamadı:", err);

  process.exit(1);

});


