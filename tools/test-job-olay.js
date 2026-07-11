#!/usr/bin/env node
/**
 * İcraat işi olay akışı — %60 direkt, %40 sokak kavgası + savun/timeout.
 */
const path = require("path");
const fs = require("fs");
const { initDatabase } = require("../db/database");
const { loadPlayer } = require("../game/playerService");
const { jobOlaySonuc } = require("../game/jobEventService");
const { run, get } = require("../db/database");

const ROOT = path.join(__dirname, "..");
const TEST_DB = path.join(ROOT, "tools", ".job-olay-test.db");

async function main() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  process.env.DATABASE_PATH = TEST_DB;
  process.env.NODE_ENV = "test";

  const db = await initDatabase();
  const userId = 1;

  await db.run(
    `INSERT OR IGNORE INTO users (id, username, password_hash, reis_adi) VALUES (1, 'jobtest', 'x', 'JobTest')`
  );
  await db.run(
    `INSERT OR IGNORE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi) VALUES (1, 10000, 100, 5000, 20, 80)`
  );

  let player = await loadPlayer(db, userId);
  const baslangicKasa = player.kasa;

  // Zorla olay yolu: birkaç deneme veya mock — burada direkt jobOlaySonuc testi için
  // önce jobBaslat ile olay tetiklemek için random'u bypass edemiyoruz; manuel session yazalım
  const { run: _r, get } = require("../db/database");
  const session = {
    olayId: "test123",
    jobKey: "market",
    olayTipi: "sokak_kavgasi",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 30000,
    devletDusus: 7,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ? WHERE user_id = ?`, [
    JSON.stringify(session),
    userId,
  ]);

  player = await loadPlayer(db, userId);
  const savun = await jobOlaySonuc(db, userId, player, {
    savunuldu: true,
    olayId: "test123",
  });
  if (!savun.ok) throw new Error(savun.error);
  if (!savun.effect.savunuldu) throw new Error("savunuldu bekleniyordu");
  if (savun.effect.bonusPuan < 1) throw new Error("bonus puan yok");

  player = await loadPlayer(db, userId);
  if (player.kasa <= baslangicKasa) throw new Error("kasa artmadi");

  console.log("OK job olay savun testi gecti");

  // Şanslı fırsat — %20-50 bonus
  const { JOBS } = require("../game/catalog");
  const market = JOBS.market;
  const firsatSession = {
    olayId: "firsat456",
    jobKey: "market",
    olayTipi: "sansli_firsat",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 3,
    bonusYuzde: 35,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, kasa = ? WHERE user_id = ?`, [
    JSON.stringify(firsatSession),
    player.kasa,
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const kasaOnce = player.kasa;
  const firsat = await jobOlaySonuc(db, userId, player, {
    savunuldu: true,
    olayId: "firsat456",
  });
  if (!firsat.ok) throw new Error(firsat.error);
  const beklenen = Math.floor(market.netKazanc * 1.35);
  if (firsat.effect.netKazanc !== beklenen) {
    throw new Error(`firsat kazanc ${firsat.effect.netKazanc} beklenen ${beklenen}`);
  }
  if (firsat.effect.kazancBonusYuzde !== 35) throw new Error("bonus yuzde yanlis");
  player = await loadPlayer(db, userId);
  if (player.kasa !== kasaOnce + beklenen) throw new Error("firsat kasa yanlis");

  console.log("OK sansli firsat testi gecti");

  const muhbirRusvetSession = {
    olayId: "muhbir789",
    jobKey: "market",
    olayTipi: "muhbir",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, kasa = ?, guc = 5000, icraat = 10 WHERE user_id = ?`, [
    JSON.stringify(muhbirRusvetSession),
    player.kasa,
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const kasaMuhbirOnce = player.kasa;
  const muhbirRusvet = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "muhbir789",
    secim: "rusvet",
  });
  if (!muhbirRusvet.ok) throw new Error(muhbirRusvet.error);
  const yarimKayip = Math.floor(market.netKazanc / 2);
  if (muhbirRusvet.effect.paraKaybi !== yarimKayip) throw new Error("muhbir rusvet kayip yanlis");
  if (muhbirRusvet.effect.netKazanc !== market.netKazanc - yarimKayip) throw new Error("muhbir rusvet kazanc yanlis");
  player = await loadPlayer(db, userId);
  if (player.kasa !== kasaMuhbirOnce + market.netKazanc - yarimKayip) throw new Error("muhbir rusvet kasa yanlis");

  const muhbirKacSession = {
    olayId: "muhbir790",
    jobKey: "market",
    olayTipi: "muhbir",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, guc = 10000, icraat = 8 WHERE user_id = ?`, [
    JSON.stringify(muhbirKacSession),
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const gucOnce = player.guc;
  const icraatOnce = player.icraat;
  const muhbirKac = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "muhbir790",
    secim: "kac",
  });
  if (!muhbirKac.ok) throw new Error(muhbirKac.error);
  player = await loadPlayer(db, userId);
  const beklenenGucKaybi = Math.max(1, Math.floor(gucOnce * 0.01));
  if (player.guc !== gucOnce - beklenenGucKaybi) throw new Error("muhbir kac guc yanlis");
  if (player.icraat !== icraatOnce - 1) throw new Error("muhbir kac icraat yanlis");

  const muhbirTimeoutSession = {
    olayId: "muhbir991",
    jobKey: "market",
    olayTipi: "muhbir",
    basladiMs: Date.now() - 60000,
    bitisMs: Date.now() - 5000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, hapis_bitis_at = 0 WHERE user_id = ?`, [
    JSON.stringify(muhbirTimeoutSession),
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const yakalandi = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "muhbir991",
    secim: "",
  });
  if (!yakalandi.ok) throw new Error(yakalandi.error);
  if (!yakalandi.effect.hapisGiris) throw new Error("muhbir timeout hapis yok");
  const hapisRow = await get(db, `SELECT hapis_bitis_at FROM players WHERE user_id = ?`, [userId]);
  if (!hapisRow?.hapis_bitis_at || hapisRow.hapis_bitis_at <= Math.floor(Date.now() / 1000)) {
    throw new Error("muhbir timeout hapis bitis yanlis");
  }

  console.log("OK muhbir testleri gecti");
  console.log(JSON.stringify({ kasa: player.kasa, puan: player.puan, effect: firsat.effect }, null, 2));
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
