const path = require("path");
const { openDb, get, all } = require("../db/database");

async function main() {
  const dbPath = process.argv[2] || path.join(__dirname, "..", "db", "oyun.db");
  const db = await openDb(dbPath);

  const meta = await get(db, `SELECT * FROM kumarhane_piyango_meta WHERE id = 1`).catch(() => null);
  console.log("meta:", meta);

  const cekilisler = await all(
    db,
    `SELECT id, donem, durum, kazanan_sayisi, havuz_toplam, odul_toplam, sayilar
     FROM kumarhane_piyango_cekilis ORDER BY id DESC LIMIT 8`
  );
  console.log("cekilisler:", cekilisler);

  const biletler = await all(
    db,
    `SELECT id, cekilis_id, user_id, ucretsiz, sayilar, eslesme, odul FROM kumarhane_piyango_bilet ORDER BY id`
  );
  console.log("biletler:", biletler);

  const user = await get(db, `SELECT id FROM users LIMIT 1`);
  const { panelVerisiGetir, buyukOdulToplam } = require("../game/kumarhanePiyangoService");
  const panel = await panelVerisiGetir(db, user.id);
  console.log("panel:", {
    donem: panel?.donem,
    buyukOdul: panel?.buyukOdul,
    devredenOdul: panel?.devredenOdul,
    donemOdul: panel?.donemOdul,
    toplamBilet: panel?.toplamBilet,
    aktif: panel?.aktif,
  });

  const acik = await get(
    db,
    `SELECT id FROM kumarhane_piyango_cekilis WHERE durum = 'acik' ORDER BY id DESC LIMIT 1`
  );
  if (acik) console.log("buyukOdulToplam:", await buyukOdulToplam(db, acik.id));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
