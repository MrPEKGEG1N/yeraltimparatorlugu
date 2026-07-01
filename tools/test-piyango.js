/** Kumarhane piyango — havuz ve ödül testi */
const path = require("path");
const { openDb, get } = require("../db/database");

async function main() {
  const dbPath = path.join(__dirname, "..", "db", "oyun.db");
  const db = await openDb(dbPath);

  const user = await get(db, `SELECT id FROM users LIMIT 1`);
  if (!user) {
    console.error("Test kullanıcısı yok.");
    process.exit(1);
  }

  const {
    panelVerisiGetir,
    biletAl,
    havuzOdulHesapla,
    BILET_UCRET,
    HAVUZ_ODUL_ORANI,
  } = require("../game/kumarhanePiyangoService");
  const { chipGuncelle, chipGetir } = require("../game/kumarhaneService");

  await chipGuncelle(db, user.id, 500_000);

  const bilet = await biletAl(db, user.id, [2, 4, 6, 8, 10, 12]);
  if (!bilet.ok) throw new Error(bilet.error);

  const panel = await panelVerisiGetir(db, user.id);
  const beklenen = havuzOdulHesapla(panel.toplamBilet);
  if (panel.havuzToplam !== beklenen.havuzToplam) {
    throw new Error(`Havuz uyuşmuyor: ${panel.havuzToplam} !== ${beklenen.havuzToplam}`);
  }
  if (panel.buyukOdul !== beklenen.buyukOdul) {
    throw new Error(`Büyük ödül uyuşmuyor: ${panel.buyukOdul} !== ${beklenen.buyukOdul}`);
  }
  if (beklenen.buyukOdul !== Math.floor(panel.toplamBilet * BILET_UCRET * HAVUZ_ODUL_ORANI)) {
    throw new Error("Büyük ödül %90 hesabı hatalı");
  }

  const chip = await chipGetir(db, user.id);
  console.log(
    "OK piyango havuz — bilet:",
    panel.toplamBilet,
    "havuz:",
    panel.havuzToplam,
    "buyukOdul:",
    panel.buyukOdul,
    "chip:",
    chip
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
