/** Geçersiz / test piyango çekiliş kayıtlarını temizle */
const path = require("path");
const { openDb, run, all } = require("../db/database");

async function main() {
  const db = await openDb(path.join(__dirname, "..", "db", "oyun.db"));
  await run(
    db,
    `DELETE FROM kumarhane_piyango_bilet
     WHERE cekilis_id IN (
       SELECT id FROM kumarhane_piyango_cekilis
       WHERE durum = 'tamam' AND (havuz_toplam = 0 OR havuz_toplam IS NULL OR sayilar IS NULL)
     )`
  );
  const silinen = await run(
    db,
    `DELETE FROM kumarhane_piyango_cekilis
     WHERE durum = 'tamam' AND (havuz_toplam = 0 OR havuz_toplam IS NULL OR sayilar IS NULL)`
  );
  const kalan = await all(db, `SELECT id, donem, durum, sayilar, havuz_toplam FROM kumarhane_piyango_cekilis`);
  console.log("Silinen çekiliş:", silinen?.changes || 0);
  console.log("Kalan:", JSON.stringify(kalan, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
