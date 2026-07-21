const crypto = require("crypto");

const CAPTCHA_TTL_MS = 10 * 60 * 1000;
const MAX_STORE = 5000;
const store = new Map();

function cleanup(now) {
  if (store.size < MAX_STORE) return;
  for (const [id, row] of store) {
    if (now > row.expiresAt) store.delete(id);
  }
  if (store.size >= MAX_STORE) {
    const drop = Math.floor(store.size / 4);
    let i = 0;
    for (const id of store.keys()) {
      store.delete(id);
      if (++i >= drop) break;
    }
  }
}

function randomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function createCaptcha() {
  const now = Date.now();
  cleanup(now);

  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  const op = randomInt(0, 1) === 0 ? "+" : "-";
  const answer = op === "+" ? a + b : a - b;
  const id = crypto.randomBytes(16).toString("hex");

  store.set(id, { answer, expiresAt: now + CAPTCHA_TTL_MS, used: false });

  return {
    id,
    question: `${a} ${op} ${b} = ?`,
  };
}

function verifyCaptcha(id, answer) {
  const key = String(id || "").trim();
  const row = store.get(key);
  store.delete(key);

  if (!row) {
    return { ok: false, error: "Güvenlik sorusu süresi doldu. Yenileyip tekrar dene." };
  }
  if (Date.now() > row.expiresAt) {
    return { ok: false, error: "Güvenlik sorusu süresi doldu. Yenileyip tekrar dene." };
  }
  if (row.used) {
    return { ok: false, error: "Güvenlik sorusu zaten kullanıldı. Yenileyip tekrar dene." };
  }

  const given = parseInt(String(answer ?? "").trim(), 10);
  if (Number.isNaN(given) || given !== row.answer) {
    return { ok: false, error: "Güvenlik sorusu yanlış." };
  }

  return { ok: true };
}

module.exports = { createCaptcha, verifyCaptcha };
