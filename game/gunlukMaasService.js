const { run, get, all } = require("../db/database");
const { maasCronPenceresiMi, maasGunKey, maasSaatiGeldiMi } = require("./turkiyeSaati");
const { ensureMeslekTables, processMeslekGeliri } = require("./meslekService");
const {
  ensureSirketTables,
  sirketGunleriIsle,
  calisanMaasOde,
} = require("./sirketService");

async function ensureSistemGunluk(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sistem_gunluk (
      anahtar TEXT PRIMARY KEY,
      deger TEXT,
      guncelleme INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );
}

async function gunlukMaasIsle(db, opts = {}) {
  if (!maasSaatiGeldiMi()) return { ok: true, processed: 0, skipped: "henuz_21_degil" };
  if (!opts.startup && !maasCronPenceresiMi()) {
    return { ok: true, processed: 0, skipped: "pencere_disinda" };
  }

  await ensureMeslekTables(db);
  await ensureSirketTables(db);
  await ensureSistemGunluk(db);

  const gun = maasGunKey();
  const row = await get(db, `SELECT deger FROM sistem_gunluk WHERE anahtar = 'maas_rapor_cron'`);
  if (row?.deger === gun) return { ok: true, processed: 0, skipped: "zaten_islendi", gun };

  let sirketSay = 0;
  let meslekSay = 0;
  let maasSay = 0;
  let oyuncuKasaToplam = 0;

  const sirketler = await all(db, `SELECT id FROM oyuncu_sirketleri`);
  for (const s of sirketler) {
    const sonuc = await sirketGunleriIsle(db, s.id);
    if (sonuc.gun > 0) sirketSay++;
  }

  const meslekler = await all(db, `SELECT user_id FROM oyuncu_meslek`);
  for (const m of meslekler) {
    const sonuc = await processMeslekGeliri(db, m.user_id, null);
    if (sonuc.gelir > 0) {
      meslekSay++;
      oyuncuKasaToplam += sonuc.gelir;
    }
  }

  const calisanlar = await all(db, `SELECT user_id FROM sirket_calisanlari`);
  for (const c of calisanlar) {
    const sonuc = await calisanMaasOde(db, c.user_id, null, { skipSirketIslem: true });
    if (sonuc.gelir > 0) {
      maasSay++;
      oyuncuKasaToplam += sonuc.gelir;
    }
  }

  await run(
    db,
    `INSERT OR REPLACE INTO sistem_gunluk (anahtar, deger, guncelleme) VALUES ('maas_rapor_cron', ?, ?)`,
    [gun, Math.floor(Date.now() / 1000)]
  );

  const processed = sirketSay + meslekSay + maasSay;
  if (processed > 0) {
    console.log(
      `[maas] ${gun} 21:00 — ${sirketSay} şirket raporu (şirket kasası), ${meslekSay} NPC maaşı, ${maasSay} çalışan maaşı → oyuncu kasasına toplam ${oyuncuKasaToplam} TL`
    );
  }

  return { ok: true, processed, gun, sirketSay, meslekSay, maasSay, oyuncuKasaToplam };
}

module.exports = { gunlukMaasIsle };
