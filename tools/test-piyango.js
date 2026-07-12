/** Kumarhane piyango — havuz, büyük ödül ve devir testi */
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
    jackpotBirikimAyarla,
    jackpotBirikimGetir,
    buyukOdulToplam,
    BILET_UCRET,
    HAVUZ_ODUL_ORANI,
  } = require("../game/kumarhanePiyangoService");
  const { chipGuncelle, chipGetir } = require("../game/kumarhaneService");

  await jackpotBirikimAyarla(db, 0);
  await chipGuncelle(db, user.id, 2_000_000);

  const cekilis = await get(
    db,
    `SELECT id FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
  );
  if (!cekilis) throw new Error("Aktif çekiliş yok");

  const bilet = await biletAl(db, user.id, [2, 4, 6, 8, 10, 12]);
  if (!bilet.ok) throw new Error(bilet.error);

  const panel = await panelVerisiGetir(db, user.id);
  const beklenen = havuzOdulHesapla(panel.toplamBilet);
  if (panel.donemOdul !== beklenen.buyukOdul) {
    throw new Error(`Dönem ödülü uyuşmuyor: ${panel.donemOdul} !== ${beklenen.buyukOdul}`);
  }
  if (panel.buyukOdul !== panel.devredenOdul + beklenen.buyukOdul) {
    throw new Error(
      `Büyük ödül uyuşmuyor: ${panel.buyukOdul} !== ${panel.devredenOdul + beklenen.buyukOdul}`
    );
  }

  const devredenMiktar = 450_000;
  await jackpotBirikimAyarla(db, devredenMiktar);
  const panelDevir = await panelVerisiGetir(db, user.id);
  const odulToplam = await buyukOdulToplam(db, cekilis.id);
  if (panelDevir.devredenOdul !== devredenMiktar) {
    throw new Error(`Devreden ödül uyuşmuyor: ${panelDevir.devredenOdul} !== ${devredenMiktar}`);
  }
  if (panelDevir.buyukOdul !== odulToplam.buyukOdul) {
    throw new Error(`Devirli büyük ödül uyuşmuyor: ${panelDevir.buyukOdul} !== ${odulToplam.buyukOdul}`);
  }
  if (panelDevir.buyukOdul <= devredenMiktar) {
    throw new Error("Devreden varken büyük ödül sıfır veya eksik görünüyor");
  }

  const bilet2 = await biletAl(db, user.id, [1, 3, 5, 7, 9, 11]);
  if (!bilet2.ok) throw new Error(bilet2.error);
  const panel2 = bilet2.piyango;
  if (panel2.buyukOdul <= panelDevir.buyukOdul) {
    throw new Error("Yeni bilet sonrası büyük ödül artmadı");
  }

  await jackpotBirikimAyarla(db, 0);
  const chip = await chipGetir(db, user.id);
  console.log(
    "OK piyango havuz+devir — buyukOdul:",
    panel2.buyukOdul,
    "devreden:",
    panel2.devredenOdul,
    "donem:",
    panel2.donemOdul,
    "chip:",
    chip
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
