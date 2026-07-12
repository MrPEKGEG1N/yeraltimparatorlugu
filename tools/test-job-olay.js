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

  const teknikTamirSession = {
    olayId: "teknik801",
    jobKey: "market",
    olayTipi: "teknik_ariza",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, kasa = ? WHERE user_id = ?`, [
    JSON.stringify(teknikTamirSession),
    player.kasa,
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const kasaTeknikOnce = player.kasa;
  const teknikTamir = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "teknik801",
    secim: "tamir",
  });
  if (!teknikTamir.ok) throw new Error(teknikTamir.error);
  const teknikYarim = Math.floor(market.netKazanc / 2);
  if (teknikTamir.effect.paraKaybi !== teknikYarim) throw new Error("teknik tamir kayip yanlis");
  if (teknikTamir.effect.olaySecim !== "tamir") throw new Error("teknik tamir secim yanlis");
  player = await loadPlayer(db, userId);
  if (player.kasa !== kasaTeknikOnce + market.netKazanc - teknikYarim) {
    throw new Error("teknik tamir kasa yanlis");
  }

  const origRandom = Math.random;
  Math.random = () => 0.9;
  const teknikKirSession = {
    olayId: "teknik802",
    jobKey: "market",
    olayTipi: "teknik_ariza",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, kasa = ? WHERE user_id = ?`, [
    JSON.stringify(teknikKirSession),
    player.kasa,
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const kasaKirOnce = player.kasa;
  const teknikKir = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "teknik802",
    secim: "kir",
  });
  Math.random = origRandom;
  if (!teknikKir.ok) throw new Error(teknikKir.error);
  if (teknikKir.effect.olaySecim !== "kir") throw new Error("teknik kir secim yanlis");
  if (teknikKir.effect.netKazanc !== market.netKazanc) throw new Error("teknik kir kazanc yanlis");
  player = await loadPlayer(db, userId);
  if (player.kasa !== kasaKirOnce + market.netKazanc) throw new Error("teknik kir kasa yanlis");

  Math.random = () => 0.1;
  const teknikYakalaSession = {
    olayId: "teknik803",
    jobKey: "market",
    olayTipi: "teknik_ariza",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, hapis_bitis_at = 0 WHERE user_id = ?`, [
    JSON.stringify(teknikYakalaSession),
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const teknikYakala = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "teknik803",
    secim: "kir",
  });
  Math.random = origRandom;
  if (!teknikYakala.ok) throw new Error(teknikYakala.error);
  if (!teknikYakala.effect.hapisGiris) throw new Error("teknik kir yakalanma hapis yok");
  if (teknikYakala.effect.olaySecim !== "kir_yakalandi") throw new Error("teknik kir yakalanma secim yanlis");

  console.log("OK teknik ariza testleri gecti");

  const polisKacSession = {
    olayId: "polis901",
    jobKey: "market",
    olayTipi: "polis_baskini",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, kasa = ?, hapis_bitis_at = 0 WHERE user_id = ?`, [
    JSON.stringify(polisKacSession),
    player.kasa,
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const kasaPolisOnce = player.kasa;
  const polisKac = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "polis901",
    secim: "kac",
  });
  if (!polisKac.ok) throw new Error(polisKac.error);
  if (polisKac.effect.netKazanc !== 0) throw new Error("polis kac kazanc sifir olmali");
  if (polisKac.effect.olaySecim !== "kac") throw new Error("polis kac secim yanlis");
  player = await loadPlayer(db, userId);
  if (player.kasa !== kasaPolisOnce) throw new Error("polis kac kasa degismemeli");

  const origRandom2 = Math.random;
  Math.random = () => 0.9;
  const polisSoySession = {
    olayId: "polis902",
    jobKey: "market",
    olayTipi: "polis_baskini",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, kasa = ? WHERE user_id = ?`, [
    JSON.stringify(polisSoySession),
    player.kasa,
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const kasaSoyOnce = player.kasa;
  const polisSoy = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "polis902",
    secim: "soy_kac",
  });
  Math.random = origRandom2;
  if (!polisSoy.ok) throw new Error(polisSoy.error);
  if (polisSoy.effect.olaySecim !== "soy_kac") throw new Error("polis soy_kac secim yanlis");
  if (polisSoy.effect.netKazanc !== market.netKazanc) throw new Error("polis soy_kac kazanc yanlis");
  player = await loadPlayer(db, userId);
  if (player.kasa !== kasaSoyOnce + market.netKazanc) throw new Error("polis soy_kac kasa yanlis");

  Math.random = () => 0.1;
  const polisYakalaSession = {
    olayId: "polis903",
    jobKey: "market",
    olayTipi: "polis_baskini",
    basladiMs: Date.now(),
    bitisMs: Date.now() + 300000,
    devletDusus: 6,
    icraatToplam: 2,
  };
  await run(db, `UPDATE players SET job_olay_json = ?, hapis_bitis_at = 0 WHERE user_id = ?`, [
    JSON.stringify(polisYakalaSession),
    userId,
  ]);
  player = await loadPlayer(db, userId);
  const polisYakala = await jobOlaySonuc(db, userId, player, {
    savunuldu: false,
    olayId: "polis903",
    secim: "soy_kac",
  });
  Math.random = origRandom2;
  if (!polisYakala.ok) throw new Error(polisYakala.error);
  if (!polisYakala.effect.hapisGiris) throw new Error("polis soy_kac yakalanma hapis yok");
  if (polisYakala.effect.olaySecim !== "soy_kac_yakalandi") throw new Error("polis yakalanma secim yanlis");

  console.log("OK polis baskini testleri gecti");
  console.log(JSON.stringify({ kasa: player.kasa, puan: player.puan, effect: firsat.effect }, null, 2));
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
