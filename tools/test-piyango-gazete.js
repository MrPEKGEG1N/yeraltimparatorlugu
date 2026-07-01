/** Piyango günlük gazete önizleme — günde bir kez */
const path = require("path");
const { openDb, get, all } = require("../db/database");

async function main() {
  const dbPath = path.join(__dirname, "..", "db", "oyun.db");
  const db = await openDb(dbPath);

  const { gunlukPiyangoGazeteHaber } = require("../game/kumarhanePiyangoService");
  const { istanbulGunKey } = require("../game/turkiyeSaati");

  const onceki = await all(
    db,
    `SELECT id, mesaj FROM sehir_gazete WHERE mesaj LIKE '%Kumarhane Piyangosu%' ORDER BY id DESC LIMIT 5`
  );

  await gunlukPiyangoGazeteHaber(db);
  const sonraki1 = await all(
    db,
    `SELECT id, mesaj FROM sehir_gazete WHERE mesaj LIKE '%Kumarhane Piyangosu%' ORDER BY id DESC LIMIT 5`
  );

  const cekilis = await get(
    db,
    `SELECT id, piyango_gazete_gun FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
  );
  if (!cekilis) throw new Error("Açık çekiliş yok");

  const gunKey = istanbulGunKey();
  if (cekilis.piyango_gazete_gun !== gunKey) {
    throw new Error(`piyango_gazete_gun güncellenmedi: ${cekilis.piyango_gazete_gun} !== ${gunKey}`);
  }

  const yeniSayi = sonraki1.length - onceki.length;
  if (yeniSayi !== 1) {
    throw new Error(`İlk çağrıda 1 haber bekleniyordu, fark: ${yeniSayi}`);
  }

  await gunlukPiyangoGazeteHaber(db);
  const sonraki2 = await all(
    db,
    `SELECT id, mesaj FROM sehir_gazete WHERE mesaj LIKE '%Kumarhane Piyangosu%' ORDER BY id DESC LIMIT 5`
  );
  if (sonraki2.length !== sonraki1.length) {
    throw new Error("Aynı gün ikinci çağrı yinelenen haber ekledi");
  }

  const son = sonraki2[0];
  if (!son?.mesaj?.includes("Büyük ödül") || !son?.mesaj?.includes("Havuz")) {
    throw new Error("Haber metni eksik: " + (son?.mesaj || ""));
  }

  console.log("OK piyango gazete —", son.mesaj.slice(0, 80) + "...");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
