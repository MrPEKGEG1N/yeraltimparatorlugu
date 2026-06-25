const jwt = require("jsonwebtoken");
const { JWT_SECRET, COOKIE_NAME, ADMIN_USERNAME } = require("../config");
const { get, ensureConfiguredAdmin } = require("../db/database");

async function loadAuthUser(db, userId) {
  if (!db || !userId) return null;
  return get(
    db,
    `SELECT id, username, reis_adi, banned, is_admin, token_version FROM users WHERE id = ?`,
    [userId]
  );
}

function readToken(req) {
  return (
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "")
  );
}

function attachUser(req, row) {
  req.user = {
    id: row.id,
    username: row.username,
    reisAdi: row.reis_adi,
    isAdmin: !!row.is_admin,
  };
}

async function verifySession(db, req, res) {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Giriş yapmanız gerekiyor." });
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const row = await loadAuthUser(db, payload.userId);

    if (!row) {
      res.status(401).json({ ok: false, error: "Kullanıcı bulunamadı." });
      return null;
    }
    if (row.banned) {
      res.status(403).json({ ok: false, error: "Hesabınız askıya alındı." });
      return null;
    }
    if ((row.token_version || 0) !== (payload.tv || 0)) {
      res.status(401).json({ ok: false, error: "Oturum sonlandırıldı. Tekrar giriş yapın." });
      return null;
    }

    attachUser(req, row);
    return row;
  } catch {
    res.status(401).json({ ok: false, error: "Oturum süresi doldu. Tekrar giriş yapın." });
    return null;
  }
}

function createRequireAuth(db) {
  return async function requireAuth(req, res, next) {
    const row = await verifySession(db, req, res);
    if (!row) return;
    next();
  };
}

function createRequireAdmin(db) {
  return async function requireAdmin(req, res, next) {
    let row = await verifySession(db, req, res);
    if (!row) return;

    let isAdmin = !!row.is_admin;
    if (!isAdmin && ADMIN_USERNAME && row.username === ADMIN_USERNAME) {
      await ensureConfiguredAdmin(db, row.username);
      row = await loadAuthUser(db, row.id);
      isAdmin = !!row?.is_admin;
    }

    if (!isAdmin) {
      res.status(403).json({ ok: false, error: "Yönetici yetkisi gerekli." });
      return;
    }

    attachUser(req, row);
    next();
  };
}

/** Geriye uyumluluk — db olmadan ban kontrolü yapılmaz */
function requireAuth(req, res, next) {
  return createRequireAuth(null)(req, res, next);
}

module.exports = { requireAuth, createRequireAuth, createRequireAdmin, loadAuthUser };
