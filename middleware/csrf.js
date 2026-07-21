const crypto = require("crypto");

const CSRF_COOKIE = "yi_csrf";
const CSRF_HEADER = "x-csrf-token";

const CSRF_EXEMPT = [/^\/api\/health$/, /^\/api\/ping$/];
const SW_AUTH_PATHS = ["/api/bildirim/subscribe", "/api/bildirim/fcm"];

function sameOriginRequest(req) {
  const host = String(req.headers.host || "").toLowerCase();
  if (!host) return false;
  const origin = String(req.headers.origin || "").toLowerCase();
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = String(req.headers.referer || "").toLowerCase();
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return req.secure === false && process.env.NODE_ENV !== "production";
}

function ensureCsrfCookie(req, res, next) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || typeof token !== "string" || token.length < 32) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  req.csrfToken = token;
  next();
}

function csrfProtect(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const path = req.path || "";
  if (CSRF_EXEMPT.some((re) => re.test(path))) return next();

  if (
    SW_AUTH_PATHS.includes(path) &&
    sameOriginRequest(req) &&
    req.cookies?.yeralti_token
  ) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = String(req.headers[CSRF_HEADER] || "").trim();

  if (cookieToken && headerToken && cookieToken === headerToken) {
    return next();
  }

  if (!sameOriginRequest(req)) {
    return res.status(403).json({
      ok: false,
      error: "Geçersiz istek kaynağı.",
    });
  }

  return res.status(403).json({
    ok: false,
    error: "Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar dene.",
  });
}

module.exports = {
  CSRF_COOKIE,
  CSRF_HEADER,
  CSRF_EXEMPT,
  SW_AUTH_PATHS,
  ensureCsrfCookie,
  csrfProtect,
  sameOriginRequest,
};
