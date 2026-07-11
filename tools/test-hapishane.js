#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { initDatabase, run, get } = require("../db/database");
const { loadPlayer } = require("../game/playerService");
const {
  hapseGir,
  gardiyanRusveti,
  oyuncuHapistenCikar,
  oyuncuHapistenElmaslaCikar,
  hapishanePanel,
  hapisKontrol,
  ELMAS_CIKIS,
} = require("../game/hapishaneService");
const { oyuncuSaatlikKazanc } = require("../game/saatlikGelirService");

const TEST_DB = path.join(__dirname, ".hapishane-test.db");

async function main() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  process.env.DATABASE_PATH = TEST_DB;
  process.env.NODE_ENV = "test";

  const db = await initDatabase();
  const U1 = 9001;
  const U2 = 9002;
  await run(db, `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi) VALUES (?, 'hap1', 'x', 'Hap1')`, [U1]);
  await run(db, `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi) VALUES (?, 'hap2', 'x', 'Hap2')`, [U2]);
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas, hapis_bitis_at)
     VALUES (?, 100000, 5000, 1000, 10, 100, 10, 0),
            (?, 200000, 3000, 800, 10, 100, 0, 0)`,
    [U1, U2]
  );

  let p1 = await loadPlayer(db, U1);
  const giris = await hapseGir(db, U1);
  if (!giris.ok || giris.zaten || giris.kayip !== 20000) throw new Error("hapse giris basarisiz " + JSON.stringify(giris));
  p1 = await loadPlayer(db, U1);
  if (p1.kasa !== 80000) throw new Error("kasa kaybi yanlis " + p1.kasa);

  const blok = await hapisKontrol(db, U1);
  if (blok.ok) throw new Error("hapis kontrol bloklamadi");

  const bedel = Math.max(500, Math.floor((await oyuncuSaatlikKazanc(db, U1)) * 3));
  p1 = await loadPlayer(db, U1);
  const rusvet = await gardiyanRusveti(db, U1, p1);
  if (!rusvet.ok) throw new Error(rusvet.error);
  if (rusvet.odenen !== bedel) throw new Error("rusvet bedeli yanlis");

  await hapseGir(db, U2);
  let p2 = await loadPlayer(db, U2);
  const kurtarici = await loadPlayer(db, U1);
  kurtarici.kasa = 500000;
  const hedefBedel = Math.max(500, Math.floor((await oyuncuSaatlikKazanc(db, U2)) * 3));
  const kurtar = await oyuncuHapistenCikar(db, U1, kurtarici, "Hap2");
  if (!kurtar.ok) throw new Error(kurtar.error);
  if (kurtar.odenen !== hedefBedel) throw new Error("kurtarma bedeli yanlis");

  await hapseGir(db, U2);
  kurtarici.elmas = 20;
  const elmasKurtar = await oyuncuHapistenElmaslaCikar(db, U1, kurtarici, "Hap2");
  if (!elmasKurtar.ok) throw new Error(elmasKurtar.error);
  if (elmasKurtar.harcananElmas !== ELMAS_CIKIS) throw new Error("elmas kurtarma bedeli yanlis");

  const panel = await hapishanePanel(db, U1);
  if (panel.mahkumSayisi < 0) throw new Error("panel hatali");

  console.log("OK hapishane testleri gecti");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
