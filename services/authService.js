const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { run, get } = require("../db/database");
const { JWT_SECRET } = require("../config");

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASS_MIN = 6;
const REIS_MAX = 24;
const LAKAPLAR = new Set([
  "Tetikçi",
  "Soyguncu",
  "İşlemeci",
  "Satıcı",
  "İş Adamı",
  "Mafya",
  "Baba",
  "Baron",
  "Aslan",
  "Tilki",
  "Çakal",
]);

function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, reisAdi: user.reis_adi },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function registerUser(db, { username, password, reisAdi, lakap }) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");
  const reis = String(reisAdi || "").trim();
  const secilenLakap = String(lakap || "Mafya").trim();

  if (!USERNAME_RE.test(u)) {
    return { ok: false, error: "Kullanıcı adı 3-20 karakter; harf, rakam ve _ olabilir." };
  }
  if (p.length < PASS_MIN) {
    return { ok: false, error: `Şifre en az ${PASS_MIN} karakter olmalı.` };
  }
  if (!reis || reis.length > REIS_MAX) {
    return { ok: false, error: `Reis adı 1-${REIS_MAX} karakter olmalı.` };
  }
  if (!LAKAPLAR.has(secilenLakap)) {
    return { ok: false, error: "Geçerli bir lakap seçmelisin." };
  }

  const exists = await get(db, "SELECT id FROM users WHERE username = ?", [u]);
  if (exists) {
    return { ok: false, error: "Bu kullanıcı adı zaten alınmış." };
  }

  const hash = await bcrypt.hash(p, 10);
  const result = await run(
    db,
    "INSERT INTO users (username, password_hash, reis_adi, lakap) VALUES (?, ?, ?, ?)",
    [u, hash, reis, secilenLakap]
  );

  const userId = result.lastID;
  await run(db, "INSERT INTO players (user_id) VALUES (?)", [userId]);

  const user = await get(db, "SELECT id, username, reis_adi FROM users WHERE id = ?", [
    userId,
  ]);
  return { ok: true, user, token: signToken(user) };
}

async function loginUser(db, { username, password }) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");

  const user = await get(
    db,
    "SELECT id, username, reis_adi, lakap, password_hash FROM users WHERE username = ?",
    [u]
  );
  if (!user) {
    return { ok: false, error: "Kullanıcı adı veya şifre hatalı." };
  }

  const match = await bcrypt.compare(p, user.password_hash);
  if (!match) {
    return { ok: false, error: "Kullanıcı adı veya şifre hatalı." };
  }

  const row = await get(db, "SELECT user_id FROM players WHERE user_id = ?", [user.id]);
  if (!row) {
    await run(db, "INSERT INTO players (user_id) VALUES (?)", [user.id]);
  }

  return {
    ok: true,
    user: { id: user.id, username: user.username, reis_adi: user.reis_adi, lakap: user.lakap },
    token: signToken(user),
  };
}

async function changePassword(db, userId, { eskiSifre, yeniSifre }) {
  const eski = String(eskiSifre || "");
  const yeni = String(yeniSifre || "");
  if (yeni.length < PASS_MIN) {
    return { ok: false, error: `Yeni şifre en az ${PASS_MIN} karakter olmalı.` };
  }
  const user = await get(db, "SELECT password_hash FROM users WHERE id = ?", [userId]);
  if (!user) return { ok: false, error: "Kullanıcı bulunamadı." };
  const match = await bcrypt.compare(eski, user.password_hash);
  if (!match) return { ok: false, error: "Mevcut şifre hatalı." };
  const hash = await bcrypt.hash(yeni, 10);
  await run(db, "UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
  return { ok: true };
}

module.exports = { registerUser, loginUser, signToken, changePassword };
