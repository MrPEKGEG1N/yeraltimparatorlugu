/** Eski çekilişten devreden ödülü kurtarma testi */
const path = require("path");
const fs = require("fs");
const { openDb, run, get } = require("../db/database");

async function main() {
  const dbPath = path.join(__dirname, "..", "db", "oyun.db.test-rollover-repair");
  for (const ext of ["", "-shm", "-wal"]) {
    const p = dbPath + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const db = await openDb(dbPath);
  const { ensureKumarhaneTables } = require("../game/kumarhaneService");
  await ensureKumarhaneTables(db);
  await run(db, `INSERT OR IGNORE INTO users (id, username, reis_adi) VALUES (1, 't', 'T')`);

  const { panelVerisiGetir, jackpotBirikimGetir, jackpotBirikimAyarla, BILET_UCRET, HAVUZ_ODUL_ORANI } =
    require("../game/kumarhanePiyangoService");
  await jackpotBirikimAyarla(db, 0);

  const havuz = 3 * BILET_UCRET;
  const beklenen = Math.floor(havuz * HAVUZ_ODUL_ORANI);

  await run(
    db,
    `INSERT INTO kumarhane_piyango_cekilis (donem, sayilar, durum, kazanan_sayisi, havuz_toplam, odul_toplam, cekilis_at)
     VALUES ('2099-01-01T2030', '[1,2,3,4,5,6]', 'tamam', 0, ?, 0, strftime('%s','now'))`,
    [havuz]
  );
  const cekilis = await get(db, `SELECT id FROM kumarhane_piyango_cekilis WHERE donem = '2099-01-01T2030'`);
  for (let i = 0; i < 3; i++) {
    await run(
      db,
      `INSERT INTO kumarhane_piyango_bilet (cekilis_id, user_id, sayilar, ucretsiz) VALUES (?, 1, ?, 0)`,
      [cekilis.id, JSON.stringify([7, 8, 9, 10, 11, 12])]
    );
  }
  await run(db, `INSERT INTO kumarhane_piyango_cekilis (donem, durum) VALUES ('2099-01-03T2030', 'acik')`);

  const panel = await panelVerisiGetir(db, 1);
  const jackpot = await jackpotBirikimGetir(db);
  if (jackpot !== beklenen) throw new Error(`Jackpot onarımı başarısız: ${jackpot} !== ${beklenen}`);
  if (panel.buyukOdul !== beklenen) throw new Error(`Panel buyukOdul: ${panel.buyukOdul} !== ${beklenen}`);
  if (panel.devredenOdul !== beklenen) throw new Error(`Panel devredenOdul: ${panel.devredenOdul}`);

  console.log("OK rollover repair — jackpot:", jackpot, "buyukOdul:", panel.buyukOdul);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
