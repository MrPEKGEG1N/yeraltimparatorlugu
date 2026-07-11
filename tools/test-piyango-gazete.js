/** Piyango günlük gazete önizleme — günde bir kez */
const path = require("path");
const { openDb, get, all } = require("../db/database");

async function bugunPiyangoHaberleri(db) {
  const { istanbulGunKey } = require("../game/turkiyeSaati");
  const gunKey = istanbulGunKey();
  const gunBaslangic = Math.floor(new Date(`${gunKey}T00:00:00+03:00`).getTime() / 1000);
  return all(
    db,
    `SELECT id, mesaj FROM sehir_gazete
     WHERE mesaj LIKE '%🎟️ Kumarhane Piyangosu%'
       AND created_at >= ?
     ORDER BY id DESC`,
    [gunBaslangic]
  );
}

async function main() {
  const dbPath = path.join(__dirname, "..", "db", "oyun.db");
  const db = await openDb(dbPath);

  const { gunlukPiyangoGazeteHaber } = require("../game/kumarhanePiyangoService");
  const { istanbulGunKey } = require("../game/turkiyeSaati");

  const onceki = await bugunPiyangoHaberleri(db);

  await gunlukPiyangoGazeteHaber(db);
  const sonraki1 = await bugunPiyangoHaberleri(db);

  const cekilis = await get(
    db,
    `SELECT id, piyango_gazete_gun FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
  );
  if (!cekilis) throw new Error("Açık çekiliş yok");

  const gunKey = istanbulGunKey();
  if (cekilis.piyango_gazete_gun !== gunKey) {
    throw new Error(`piyango_gazete_gun güncellenmedi: ${cekilis.piyango_gazete_gun} !== ${gunKey}`);
  }

  if (sonraki1.length < onceki.length) {
    throw new Error("Günlük piyango haberi silindi");
  }
  if (sonraki1.length > onceki.length + 1) {
    throw new Error(`Beklenenden fazla haber eklendi: ${onceki.length} -> ${sonraki1.length}`);
  }
  if (sonraki1.length === 0) {
    throw new Error("Bugün için piyango haberi yok");
  }

  await gunlukPiyangoGazeteHaber(db);
  const sonraki2 = await bugunPiyangoHaberleri(db);
  if (sonraki2.length !== sonraki1.length) {
    throw new Error("Aynı gün ikinci çağrı yinelenen haber ekledi");
  }

  const son = sonraki2[0];
  if (!son?.mesaj?.includes("Büyük ödül")) {
    throw new Error("Haber metni eksik: " + (son?.mesaj || ""));
  }
  if (!son.mesaj.includes("Havuz") && !son.mesaj.includes("Devreden")) {
    throw new Error("Havuz veya devreden bilgisi yok: " + son.mesaj);
  }

  console.log("OK piyango gazete —", son.mesaj.slice(0, 80) + "...");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
