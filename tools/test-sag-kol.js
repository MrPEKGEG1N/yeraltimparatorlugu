#!/usr/bin/env node
const path = require("path");
const fs = require("fs");

const TEST_DB = path.join(__dirname, ".sag-kol-test.db");
for (const p of [TEST_DB, TEST_DB + "-shm", TEST_DB + "-wal"]) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}
process.env.DATABASE_PATH = TEST_DB;
process.env.NODE_ENV = "test";
process.env.SKIP_SUPABASE = "1";

const { initDatabase, run } = require("../db/database");
const {
  SAG_KOL_BASLANGIC,
  SAG_KOL_ANTRENMAN_SURE_SN,
  sagKolAntrenmanMaliyet,
  sagKolAntrenmanMaliyetTam,
  sagKolGenelRutbe,
  sagKolStatIlerleme,
  sagKolSavasEtkileri,
} = require("../game/sagKolCatalog");
const { antrenmanMaliyet } = require("../game/yetenekCatalog");
const {
  ensureSagKol,
  sagKolYetenekleriOku,
  antrenmanBaslat,
  antrenmanTamamla,
  aktifAntrenmanOku,
} = require("../game/sagKolService");
const { etkinSavasParcalari } = require("../game/sagKolGucService");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

async function main() {
  assert(SAG_KOL_BASLANGIC === 1, "başlangıç 1");
  assert(SAG_KOL_ANTRENMAN_SURE_SN === 5400, "1.5 saat = 5400 sn");
  assert(sagKolAntrenmanMaliyet(8) === Math.floor(antrenmanMaliyet(8) * 1.5), "maliyet 1.5x");

  const rutbe0 = sagKolGenelRutbe({ guc: 1, zeka: 1, beceri: 1, dayaniklilik: 1 });
  assert(rutbe0.id === "demir", "başlangıç Demir");

  const iler100 = sagKolStatIlerleme(100);
  assert(iler100.yuzde === 100, "100 = bar dolu");
  assert(iler100.seviyeAtlamaHazir === true, "100 seviye atlama");
  assert(iler100.rutbeAd === "Demir", "100 hâlâ Demir segmenti");

  const maliyet100 = sagKolAntrenmanMaliyetTam(100);
  assert(maliyet100 === sagKolAntrenmanMaliyet(100) * 2, "100→101 maliyet x2");
  assert(sagKolAntrenmanMaliyetTam(99) === sagKolAntrenmanMaliyet(99), "99 normal maliyet");

  const iler101 = sagKolStatIlerleme(101);
  assert(iler101.rutbeAd === "Bronz", "101 Bronz");
  assert(iler101.seviyeAtlamaHazir === false, "101 atlama değil");

  const etk = sagKolSavasEtkileri({ guc: 100, zeka: 100, beceri: 100, dayaniklilik: 100 });
  assert(Math.abs(etk.gucBonusOran - 0.1) < 1e-9, "100 güç = %10");
  assert(Math.abs(etk.zekaKesimOran - 0.15) < 1e-9, "100 zeka = %15 kesim");
  assert(Math.abs(etk.beceriBonusOran - 0.1) < 1e-9, "100 beceri = %10 GY");
  assert(Math.abs(etk.dayaniklilikBonusOran - 0.15) < 1e-9, "100 dayanıklılık = %15 ME");

  const db = await initDatabase();
  const uid = 9401;
  const now = Math.floor(Date.now() / 1000);
  await run(
    db,
    `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi, created_at, last_login_at)
     VALUES (?, 'sagkolt', 'x', 'SagKolT', ?, ?)`,
    [uid, now, now]
  );
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas, profil_resmi, bonus_guc)
     VALUES (?, 5000000, 100, 1000, 20, 50, 0, 'erkek-01', 500)`,
    [uid]
  );
  await ensureSagKol(db);
  await run(db, `UPDATE players SET sag_kol_sahip = 1 WHERE user_id = ?`, [uid]);

  let y = await sagKolYetenekleriOku(db, uid);
  assert(y.guc === 1 && y.zeka === 1 && y.beceri === 1 && y.dayaniklilik === 1, "varsayılan 1");

  const player = { kasa: 5000000, icraat: 20 };
  const basla = await antrenmanBaslat(db, uid, player, "guc");
  assert(basla.ok, basla.error || "başlat");
  assert(basla.aktifAntrenman && basla.aktifAntrenman.sureSn === 5400, "oturum 1.5s");

  // Bitmemişken tamamlanamaz
  const erken = await antrenmanTamamla(db, uid);
  assert(!erken.ok, "erken tamamlanmamalı");

  // Zamanı bitir
  await run(db, `UPDATE players SET sag_kol_antrenman_json = ? WHERE user_id = ?`, [
    JSON.stringify({
      yetenek: "guc",
      basladiTs: now - 6000,
      bitisTs: now - 10,
      kazanc: 1,
      tlMaliyet: basla.tlMaliyet,
    }),
    uid,
  ]);
  const bit = await antrenmanTamamla(db, uid);
  assert(bit.ok, bit.error || "tamamla");
  assert(bit.yeniDeger === 2, "güç 1→2");

  // Seviye atlama maliyeti (100)
  await run(db, `UPDATE players SET sag_kol_guc=100, sag_kol_antrenman_json='', sag_kol_gunluk_json='{}', sag_kol_gunluk_gun='', kasa=50000000, icraat=20 WHERE user_id=?`, [uid]);
  const player2 = { kasa: 50000000, icraat: 20 };
  const beklenen = sagKolAntrenmanMaliyetTam(100);
  const basla100 = await antrenmanBaslat(db, uid, player2, "guc");
  assert(basla100.ok, basla100.error || "100 başlat");
  assert(basla100.seviyeAtlama === true, "seviye atlama bayrağı");
  assert(basla100.tlMaliyet === beklenen, "x2 maliyet alındı");
  assert(!String(basla100.mesaj || "").toLowerCase().includes("x2"), "mesajda x2 yok");

  // Savaş parçaları
  await run(db, `UPDATE players SET sag_kol_sahip=1, sag_kol_saglik=150, sag_kol_guc=100, sag_kol_beceri=100, sag_kol_dayaniklilik=100, sag_kol_zeka=50, sag_kol_antrenman_json='', guc=1000, bonus_guc=0 WHERE user_id=?`, [uid]);
  const p = await etkinSavasParcalari(db, uid);
  assert(p.normal === Math.floor(1000 * 1.1), "normal +%10");
  assert(p.aktif === true, "sağ kol aktif");

  // Hastanelik: tüm sağ kol çarpanları kapalı
  await run(db, `UPDATE players SET sag_kol_saglik=0 WHERE user_id=?`, [uid]);
  const pHastane = await etkinSavasParcalari(db, uid);
  assert(pHastane.aktif === false, "hastanelik pasif");
  assert(pHastane.normal === 1000, "hastanede normal çarpan yok");
  assert(pHastane.etkiler.gucBonusOran === 0, "güç oran 0");
  assert(pHastane.etkiler.zekaKesimOran === 0, "zeka oran 0");

  // Zekâ kesimi: saldıranın zekası rakip bonusunu keser
  await run(db, `UPDATE players SET sag_kol_saglik=150, guc=1000 WHERE user_id=?`, [uid]);
  const { guvenliYerBonusForUser, mafyaEviBonusForUser } = require("../game/bonusGucService");
  const gy = await guvenliYerBonusForUser(db, uid);
  const me = await mafyaEviBonusForUser(db, uid);
  const self = await etkinSavasParcalari(db, uid);
  const kesimli = await etkinSavasParcalari(db, uid, { saldiranZeka: 100 });
  const rawBonus = Math.floor(gy * 1.1) + Math.floor(me * 1.15);
  assert(self.bonus === rawBonus, "kendi bonus kesilmez");
  assert(kesimli.bonus === Math.floor(rawBonus * (1 - 0.15)), "zeka %15 kesim (100)");
  assert(kesimli.toplam === kesimli.normal + kesimli.bonus, "toplam = normal+bonus");

  const { panelGetir, profilResmiKaydet, satinAl, sagKolSahipMi } = require("../game/sagKolService");
  const { SAG_KOL_SATIN_AL_FIYAT } = require("../game/sagKolCatalog");

  // Satın alma kapısı
  await run(db, `UPDATE players SET sag_kol_sahip=0, sag_kol_guc=1, sag_kol_zeka=1, sag_kol_beceri=1, sag_kol_dayaniklilik=1, sag_kol_antrenman_json='', sag_kol_profil_resmi='', kasa=600000 WHERE user_id=?`, [uid]);
  assert(!(await sagKolSahipMi(db, uid)), "sahip değil");
  const panelYok = await panelGetir(db, uid);
  assert(panelYok.sahip === false, "panel sahip false");
  const al = await satinAl(db, uid, { kasa: 600000 });
  assert(al.ok, al.error || "satın al");
  assert(al.fiyat === SAG_KOL_SATIN_AL_FIYAT, "fiyat 500k");
  assert(await sagKolSahipMi(db, uid), "satın sonrası sahip");

  const panel0 = await panelGetir(db, uid);
  assert(panel0.sahip === true, "panel sahip");
  assert(panel0.profilResmi === "", "boş portre varsayılan");
  const kayit = await profilResmiKaydet(db, uid, "erkek-02");
  assert(kayit.ok, kayit.error || "portre kaydet");
  assert(kayit.profilResmi === "erkek-02", "portre key");
  const panel1 = await panelGetir(db, uid);
  assert(panel1.profilResmi === "erkek-02", "panel portre");

  console.log("OK sag-kol");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
