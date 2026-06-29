const express = require("express");
const rateLimit = require("express-rate-limit");
const { registerUser, loginUser, changePassword } = require("../services/authService");
const { createRequireAuth } = require("../middleware/auth");
const { COOKIE_NAME, TOKEN_MAX_AGE_MS } = require("../config");
const { attachClientMeta, ipRateLimit } = require("../middleware/security");
const { extractClientMeta } = require("../game/securityService");

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE_MS,
    secure: process.env.NODE_ENV === "production",
  });
}

function createAuthRouter(db) {
  const router = express.Router();
  const requireAuth = createRequireAuth(db);

  router.use(attachClientMeta);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Çok fazla giriş denemesi. 15 dakika sonra tekrar dene." },
  });

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Bu IP adresinden çok fazla kayıt denemesi yapıldı." },
  });

  router.post("/register", registerLimiter, async (req, res) => {
    try {
      const meta = extractClientMeta(req);
      const result = await registerUser(db, req.body, meta);
      if (!result.ok) return res.status(400).json(result);
      setAuthCookie(res, result.token);
      res.json({
        ok: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          reisAdi: result.user.reis_adi,
          lakap: result.user.lakap,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Kayıt sırasında hata oluştu." });
    }
  });

  router.post("/login", authLimiter, async (req, res) => {
    try {
      const meta = extractClientMeta(req);
      const result = await loginUser(db, req.body, meta);
      if (!result.ok) return res.status(400).json(result);
      setAuthCookie(res, result.token);
      res.json({
        ok: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          reisAdi: result.user.reis_adi,
          lakap: result.user.lakap,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Giriş sırasında hata oluştu." });
    }
  });

  router.post("/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  router.get("/me", requireAuth, async (req, res) => {
    try {
      const u = await dbGetLakap(db, req.user.id);
      res.json({
        ok: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          reisAdi: req.user.reisAdi,
          lakap: u?.lakap || "Mafya",
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Oturum doğrulanamadı." });
    }
  });

  router.post("/password", requireAuth, ipRateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
    try {
      const result = await changePassword(db, req.user.id, req.body || {});
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Şifre güncellenemedi." });
    }
  });

  return router;
}

async function dbGetLakap(db, userId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT lakap FROM users WHERE id = ?", [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

module.exports = { createAuthRouter };
