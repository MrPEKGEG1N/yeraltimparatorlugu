const express = require("express");
const { registerUser, loginUser, changePassword } = require("../services/authService");
const { requireAuth } = require("../middleware/auth");
const { loadPlayer, publicPlayerFull } = require("../game/playerService");
const { COOKIE_NAME, TOKEN_MAX_AGE_MS } = require("../config");

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

  router.post("/register", async (req, res) => {
    try {
      const result = await registerUser(db, req.body);
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

  router.post("/login", async (req, res) => {
    try {
      const result = await loginUser(db, req.body);
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
      const player = await loadPlayer(db, req.user.id);
      const u = await dbGetLakap(db, req.user.id);
      res.json({
        ok: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          reisAdi: req.user.reisAdi,
          lakap: u?.lakap || "Mafya",
        },
        player: await publicPlayerFull(db, req.user.id, player),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Oturum doğrulanamadı." });
    }
  });

  router.post("/password", requireAuth, async (req, res) => {
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
