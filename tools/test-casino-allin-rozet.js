#!/usr/bin/env node
/**
 * Kumarhane all-in rozetleri: Kasa Bizim / Sıfırı Tüketen
 */
const path = require("path");
const fs = require("fs");

const TEST_DB = path.join(__dirname, ".casino-allin-rozet-test.db");
for (const p of [TEST_DB, TEST_DB + "-shm", TEST_DB + "-wal"]) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}
process.env.DATABASE_PATH = TEST_DB;
process.env.NODE_ENV = "test";
process.env.SKIP_SUPABASE = "1";

const { initDatabase, run, get } = require("../db/database");
const {
  BASARI_BY_ID,
  basariRozetArtir,
  oyuncuBasariRozetleri,
  ensureBasariColumns,
} = require("../game/basariRozetService");
const { ensureKumarhaneTables, chipGuncelle, oyunOyna } = require("../game/kumarhaneService");
const slot = require("../game/kumarhane/slot");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

async function main() {
  assert(BASARI_BY_ID.casino_allin_win, "casino_allin_win tanımlı olmalı");
  assert(BASARI_BY_ID.casino_allin_bust, "casino_allin_bust tanımlı olmalı");

  const winIcon = path.join(__dirname, "../public/images/profil/rozet/basari/casino_allin_win.png");
  const bustIcon = path.join(__dirname, "../public/images/profil/rozet/basari/casino_allin_bust.png");
  assert(fs.existsSync(winIcon), "win ikonu yok");
  assert(fs.existsSync(bustIcon), "bust ikonu yok");

  const db = await initDatabase();
  const { DB_PATH } = require("../db/database");
  assert(path.resolve(DB_PATH) === path.resolve(TEST_DB), "izolasyon DB");

  const uid = 9301;
  const now = Math.floor(Date.now() / 1000);
  await run(
    db,
    `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi, created_at, last_login_at)
     VALUES (?, 'allint', 'x', 'AllInT', ?, ?)`,
    [uid, now, now]
  );
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas, profil_resmi)
     VALUES (?, 0, 100, 50, 1, 50, 0, 'erkek-01')`,
    [uid]
  );
  await ensureBasariColumns(db);
  await ensureKumarhaneTables(db);

  // Chip = bahis → all-in kayıp
  await chipGuncelle(db, uid, 50_000);
  const origOyna = slot.oyna;
  slot.oyna = (bahis) => ({
    ok: true,
    bitti: true,
    kazanc: 0,
    mesaj: "Kaybettin",
    gorunum: { mock: "lose" },
  });
  try {
    const lose = await oyunOyna(db, uid, { oyunId: "slot", bahis: 50_000 });
    assert(lose.ok && lose.bitti, "kayıp oyun ok");
    assert(lose.net < 0 || lose.kazanc === 0, "net kayıp");
  } finally {
    slot.oyna = origOyna;
  }

  let counts = await get(db, `SELECT basari_rozet_json FROM players WHERE user_id = ?`, [uid]);
  let parsed = JSON.parse(counts.basari_rozet_json || "{}");
  assert(parsed.casino_allin_bust >= 1, "Sıfırı Tüketen latch");

  // Chip = bahis → all-in kazanç
  await chipGuncelle(db, uid, 50_000);
  slot.oyna = (bahis) => ({
    ok: true,
    bitti: true,
    kazanc: bahis * 2,
    mesaj: "Kazandın",
    gorunum: { mock: "win" },
  });
  try {
    const win = await oyunOyna(db, uid, { oyunId: "slot", bahis: 50_000 });
    assert(win.ok && win.net > 0, "kazanç oyun ok");
  } finally {
    slot.oyna = origOyna;
  }

  counts = await get(db, `SELECT basari_rozet_json FROM players WHERE user_id = ?`, [uid]);
  parsed = JSON.parse(counts.basari_rozet_json || "{}");
  assert(parsed.casino_allin_win >= 1, "Kasa Bizim latch");

  // Kısmi bahis → rozet artmamalı
  const beforeWin = parsed.casino_allin_win;
  const beforeBust = parsed.casino_allin_bust;
  await chipGuncelle(db, uid, 100_000);
  slot.oyna = (bahis) => ({
    ok: true,
    bitti: true,
    kazanc: 0,
    mesaj: "Kaybettin",
    gorunum: { mock: "partial" },
  });
  try {
    await oyunOyna(db, uid, { oyunId: "slot", bahis: 10_000 });
  } finally {
    slot.oyna = origOyna;
  }
  counts = await get(db, `SELECT basari_rozet_json FROM players WHERE user_id = ?`, [uid]);
  parsed = JSON.parse(counts.basari_rozet_json || "{}");
  assert(parsed.casino_allin_bust === beforeBust, "kısmi bahiste bust artmamalı");
  assert(parsed.casino_allin_win === beforeWin, "kısmi bahiste win artmamalı");

  const liste = await oyuncuBasariRozetleri(db, uid);
  const winRozet = (liste.liste || []).find((x) => x.id === "casino_allin_win");
  const bustRozet = (liste.liste || []).find((x) => x.id === "casino_allin_bust");
  assert(winRozet && winRozet.unlocked, "Kasa Bizim açık");
  assert(bustRozet && bustRozet.unlocked, "Sıfırı Tüketen açık");

  // latch helper smoke
  await basariRozetArtir(db, uid, "casino_allin_win", 1);

  console.log("OK casino all-in rozetleri");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
