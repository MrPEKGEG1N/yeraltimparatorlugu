const jwt = require("jsonwebtoken");
const { JWT_SECRET, COOKIE_NAME } = require("../config");

function requireAuth(req, res, next) {
  const token =
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({ ok: false, error: "Giriş yapmanız gerekiyor." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.userId,
      username: payload.username,
      reisAdi: payload.reisAdi,
    };
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Oturum süresi doldu. Tekrar giriş yapın." });
  }
}

module.exports = { requireAuth };
