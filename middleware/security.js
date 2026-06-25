const {
  extractClientMeta,
  recordFingerprint,
  isUserBanned,
  logSecurityEvent,
  normalizeAction,
  isCriticalAction,
} = require("../game/securityService");

const lastActionAt = new Map();
const lastClientTs = new Map();
const ipBuckets = new Map();

const ACTION_MIN_INTERVAL_MS = 1000;
const CLIENT_TS_TOLERANCE_MS = 60_000;
const MAX_FUTURE_SKEW_MS = 5000;

function cleanupBuckets(now) {
  if (ipBuckets.size < 5000) return;
  for (const [key, bucket] of ipBuckets) {
    if (now > bucket.resetAt) ipBuckets.delete(key);
  }
}

function ipRateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupBuckets(now);
    const ip = extractClientMeta(req).ip || "unknown";
    const key = `${req.baseUrl || ""}:${ip}`;
    let bucket = ipBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      ipBuckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({
        ok: false,
        error: "Çok fazla istek. Lütfen biraz bekleyin.",
      });
    }
    next();
  };
}

function attachClientMeta(req, _res, next) {
  req.clientMeta = extractClientMeta(req);
  next();
}

function createBannedCheck(db) {
  return async function bannedCheck(req, res, next) {
    try {
      if (req.user?.id && (await isUserBanned(db, req.user.id))) {
        return res.status(403).json({ ok: false, error: "Hesabınız askıya alındı." });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function createFingerprintRefresh(db) {
  return async function fingerprintRefresh(req, res, next) {
    try {
      if (req.user?.id && req.clientMeta) {
        await recordFingerprint(db, req.user.id, req.clientMeta);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function createActionGuard(db) {
  return function actionGuard(req, res, next) {
    const body = req.body || {};
    const action = normalizeAction(body.action || "");

    if (!isCriticalAction(action)) {
      return next();
    }

    const userId = req.user?.id;
    const now = Date.now();
    const clientTs = parseInt(body.clientTs, 10);

    if (!clientTs || Number.isNaN(clientTs)) {
      logSecurityEvent(db, userId, "missing_client_ts", {
        action,
        ip: req.clientMeta?.ip,
      }).catch(() => {});
      return res.status(400).json({
        ok: false,
        error: "İstek zaman damgası eksik. Sayfayı yenileyip tekrar dene.",
      });
    }

    if (clientTs > now + MAX_FUTURE_SKEW_MS) {
      return res.status(400).json({ ok: false, error: "İstek zaman damgası geçersiz." });
    }
    if (now - clientTs > CLIENT_TS_TOLERANCE_MS) {
      return res.status(400).json({
        ok: false,
        error: "İstek süresi doldu. Sayfayı yenileyip tekrar dene.",
      });
    }

    const prevClientTs = lastClientTs.get(userId) || 0;
    if (clientTs <= prevClientTs) {
      logSecurityEvent(db, userId, "replay_client_ts", { action, clientTs, prevClientTs }).catch(
        () => {}
      );
      return res.status(400).json({ ok: false, error: "Tekrarlanan istek reddedildi." });
    }

    const lastAt = lastActionAt.get(userId) || 0;
    if (now - lastAt < ACTION_MIN_INTERVAL_MS) {
      logSecurityEvent(db, userId, "action_rate_limit", { action, ip: req.clientMeta?.ip }).catch(
        () => {}
      );
      return res.status(429).json({
        ok: false,
        error: "Çok hızlı! Kritik işlemler arasında en az 1 saniye beklemelisin.",
      });
    }

    lastClientTs.set(userId, clientTs);
    lastActionAt.set(userId, now);
    next();
  };
}

module.exports = {
  ipRateLimit,
  attachClientMeta,
  createBannedCheck,
  createFingerprintRefresh,
  createActionGuard,
};
