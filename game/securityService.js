const { run, get, all } = require("../db/database");

const MAX_ACCOUNTS_PER_VISITOR = 3;
const LOCAL_IPS = new Set(["127.0.0.1", "::1", "0.0.0.0", ""]);

const CRITICAL_ACTIONS = new Set([
  "job",
  "hire",
  "mekan_al",
  "para_gonder",
  "mafya_evi_hibe",
  "dusmana_cok",
  "liman_cok",
  "baba_cok",
  "mekan_devri",
  "banka_yatir",
  "banka_cek",
  "rusvet_ver",
  "saldiri",
  "attack",
  "port",
  "limanCok",
  "babaCok",
]);

const ACTION_ALIASES = {
  port: "liman_cok",
  attack: "dusmana_cok",
  saldiri: "dusmana_cok",
  limanCok: "liman_cok",
  babaCok: "baba_cok",
};

function normalizeAction(action) {
  return ACTION_ALIASES[action] || action;
}

function isCriticalAction(action) {
  return CRITICAL_ACTIONS.has(action) || CRITICAL_ACTIONS.has(normalizeAction(action));
}

function clientIp(req) {
  const raw =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  return String(raw).replace(/^::ffff:/, "").trim();
}

function clientUserAgent(req) {
  return String(req.headers["user-agent"] || "").slice(0, 512);
}

function clientVisitorId(req) {
  return String(req.headers["x-visitor-id"] || req.body?.visitorId || "")
    .trim()
    .slice(0, 64);
}

function extractClientMeta(req) {
  return {
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
    visitorId: clientVisitorId(req),
  };
}

async function logSecurityEvent(db, userId, eventType, detail = {}) {
  try {
    await run(
      db,
      `INSERT INTO security_events (user_id, event_type, detail, ip, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId || null,
        eventType,
        JSON.stringify(detail).slice(0, 2000),
        detail.ip || null,
        Math.floor(Date.now() / 1000),
      ]
    );
  } catch (_) {
    /* audit tablosu yoksa sessiz geç */
  }
}

async function recordFingerprint(db, userId, meta) {
  const { ip, userAgent, visitorId } = meta;
  if (!userId) return;

  const now = Math.floor(Date.now() / 1000);
  const sets = [];
  const params = [];

  if (ip) {
    sets.push("son_ip = ?");
    params.push(ip);
  }
  if (userAgent) {
    sets.push("user_agent = ?");
    params.push(userAgent);
  }
  if (visitorId) {
    sets.push("visitor_id = ?");
    params.push(visitorId);
  }
  if (sets.length) {
    sets.push("last_login_at = ?");
    params.push(now);
    params.push(userId);
    await run(db, `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
  }

  if (!visitorId && !ip) return;

  const existing = await get(
    db,
    `SELECT id FROM user_fingerprints
     WHERE user_id = ? AND visitor_id = ? AND son_ip = ?`,
    [userId, visitorId || "", ip || ""]
  );
  if (existing) {
    await run(db, `UPDATE user_fingerprints SET last_seen = ?, user_agent = ? WHERE id = ?`, [
      now,
      userAgent || "",
      existing.id,
    ]);
    return;
  }

  await run(
    db,
    `INSERT INTO user_fingerprints (user_id, visitor_id, son_ip, user_agent, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, visitorId || "", ip || "", userAgent || "", now, now]
  );
}

async function countAccountsForVisitor(db, visitorId) {
  if (!visitorId) return 0;
  const row = await get(
    db,
    `SELECT COUNT(DISTINCT user_id) AS n FROM user_fingerprints WHERE visitor_id = ?`,
    [visitorId]
  );
  return row?.n || 0;
}

async function isUserBanned(db, userId) {
  const row = await get(db, `SELECT banned FROM users WHERE id = ?`, [userId]);
  return !!(row && row.banned);
}

async function registerSecurityCheck(db, meta) {
  const { visitorId, ip } = meta;
  if (!visitorId) return { ok: true };

  const count = await countAccountsForVisitor(db, visitorId);
  if (count >= MAX_ACCOUNTS_PER_VISITOR) {
    await logSecurityEvent(db, null, "register_blocked_visitor", { visitorId, ip, count });
    return {
      ok: false,
      error: `Bu cihazdan en fazla ${MAX_ACCOUNTS_PER_VISITOR} hesap açılabilir.`,
    };
  }
  return { ok: true };
}

function isLocalIp(ip) {
  return LOCAL_IPS.has(ip) || ip.startsWith("192.168.") || ip.startsWith("10.");
}

async function areLinkedAccounts(db, userIdA, userIdB) {
  if (!userIdA || !userIdB || userIdA === userIdB) return false;

  const linked = await get(
    db,
    `SELECT 1 AS hit
     FROM user_fingerprints f1
     INNER JOIN user_fingerprints f2 ON f1.user_id != f2.user_id
       AND (
         (f1.visitor_id != '' AND f1.visitor_id = f2.visitor_id)
         OR (
           f1.son_ip != '' AND f1.son_ip = f2.son_ip
           AND f1.son_ip NOT IN ('127.0.0.1', '::1', '0.0.0.0')
         )
       )
     WHERE f1.user_id = ? AND f2.user_id = ?
     LIMIT 1`,
    [userIdA, userIdB]
  );
  if (linked) return true;

  const [a, b] = await Promise.all([
    get(db, `SELECT visitor_id, son_ip FROM users WHERE id = ?`, [userIdA]),
    get(db, `SELECT visitor_id, son_ip FROM users WHERE id = ?`, [userIdB]),
  ]);
  if (!a || !b) return false;

  if (a.visitor_id && b.visitor_id && a.visitor_id === b.visitor_id) return true;

  if (
    a.son_ip &&
    b.son_ip &&
    a.son_ip === b.son_ip &&
    !isLocalIp(a.son_ip)
  ) {
    return true;
  }

  return false;
}

async function enforceNoAltAccount(db, userId, targetUserId, actionLabel, meta = {}) {
  if (!targetUserId || userId === targetUserId) return { ok: true };

  if (await areLinkedAccounts(db, userId, targetUserId)) {
    await logSecurityEvent(db, userId, "alt_account_block", {
      targetUserId,
      action: actionLabel,
      ip: meta.ip,
      visitorId: meta.visitorId,
    });
    return {
      ok: false,
      error:
        "Güvenlik: Aynı cihaz veya ağ üzerinden kayıtlı hesaplar arasında bu işlem yapılamaz.",
    };
  }
  return { ok: true };
}

async function withTransaction(db, fn) {
  await run(db, "BEGIN IMMEDIATE");
  try {
    const result = await fn();
    await run(db, "COMMIT");
    return result;
  } catch (err) {
    try {
      await run(db, "ROLLBACK");
    } catch (_) {}
    throw err;
  }
}

module.exports = {
  CRITICAL_ACTIONS,
  normalizeAction,
  isCriticalAction,
  clientIp,
  clientUserAgent,
  clientVisitorId,
  extractClientMeta,
  logSecurityEvent,
  recordFingerprint,
  registerSecurityCheck,
  isUserBanned,
  areLinkedAccounts,
  enforceNoAltAccount,
  withTransaction,
  MAX_ACCOUNTS_PER_VISITOR,
};
