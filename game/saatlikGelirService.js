const { run, get, all } = require("../db/database");
const { istanbulHourKey, kacirilanSaatSayisi } = require("./turkiyeSaati");
const { getLimanDurumu } = require("./worldService");
const { sektorPanel } = require("./sectorService");
const { limanSaatlikToplam } = require("./worldConstants");
const { withTransaction } = require("./securityService");

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

async function oyuncuSaatlikKazanc(db, userId) {
  const limanlar = await getLimanDurumu(db);
  const sahipLiman = limanlar.filter((l) => l.sahipUserId === userId).length;
  const { saatlikKazanc: sektorSaatlik } = await sektorPanel(db, userId);
  return limanSaatlikToplam(sahipLiman) + (sektorSaatlik || 0);
}

async function legacyAssetLastHour(db, userId) {
  const limanRow = await get(
    db,
    `SELECT MAX(last_income_hour) AS h FROM liman_sahiplik WHERE owner_user_id = ?`,
    [userId]
  );
  const sektorRow = await get(
    db,
    `SELECT MAX(last_income_hour) AS h FROM sektor_sahiplik WHERE user_id = ? AND adet > 0`,
    [userId]
  );
  const h1 = limanRow?.h || null;
  const h2 = sektorRow?.h || null;
  if (!h1) return h2;
  if (!h2) return h1;
  return h1 > h2 ? h1 : h2;
}

/** Gelir kaynağı kalmayınca saati ilerlet — boş dönemde birikim olmasın. */
async function syncSaatlikGelirSaati(db, userId) {
  const saatlik = await oyuncuSaatlikKazanc(db, userId);
  if (saatlik > 0) return;
  const hourKey = istanbulHourKey();
  await run(db, `UPDATE players SET last_saatlik_gelir_hour = ? WHERE user_id = ?`, [hourKey, userId]);
}

/**
 * Oyuncunun güncel saatlik kazancını, kaçırılan her tam saat için kasasına yatırır.
 * Online/offline fark etmez; telafi sınırı yoktur.
 */
async function processSaatlikGelir(db, userId, player = null) {
  return withTransaction(db, async () => {
    const hourKey = istanbulHourKey();
    const saatlik = await oyuncuSaatlikKazanc(db, userId);
    const row = await get(db, `SELECT kasa, last_saatlik_gelir_hour FROM players WHERE user_id = ?`, [
      userId,
    ]);
    if (!row) {
      return { player, gelir: 0, saat: 0, saatlik: 0 };
    }

    const lastHour = row.last_saatlik_gelir_hour || (await legacyAssetLastHour(db, userId));
    const saat = kacirilanSaatSayisi(lastHour, hourKey);

    if (saatlik <= 0) {
      if (lastHour !== hourKey) {
        await run(db, `UPDATE players SET last_saatlik_gelir_hour = ? WHERE user_id = ?`, [
          hourKey,
          userId,
        ]);
      }
      return { player, gelir: 0, saat: 0, saatlik: 0 };
    }

    if (!saat) {
      if (!row.last_saatlik_gelir_hour) {
        await run(db, `UPDATE players SET last_saatlik_gelir_hour = ? WHERE user_id = ?`, [
          hourKey,
          userId,
        ]);
      }
      return { player, gelir: 0, saat: 0, saatlik };
    }

    const gelir = saatlik * saat;
    const kasa = player?.kasa ?? row.kasa;
    const yeniKasa = kasa + gelir;
    await run(db, `UPDATE players SET kasa = ?, last_saatlik_gelir_hour = ? WHERE user_id = ?`, [
      yeniKasa,
      hourKey,
      userId,
    ]);
    if (player) player.kasa = yeniKasa;

    return { player, gelir, saat, saatlik };
  });
}

async function saatlikGelirOyunculari(db) {
  return all(
    db,
    `SELECT DISTINCT user_id AS id FROM (
       SELECT owner_user_id AS user_id FROM liman_sahiplik WHERE owner_user_id IS NOT NULL
       UNION
       SELECT user_id FROM sektor_sahiplik WHERE adet > 0
     ) WHERE user_id IS NOT NULL`
  );
}

/** Türkiye saatiyle her yeni saat başında tüm gelirli oyunculara yatırır. */
async function saatlikGelirIsle(db) {
  await ensureSistemGunluk(db);
  const hourKey = istanbulHourKey();
  const row = await get(db, `SELECT deger FROM sistem_gunluk WHERE anahtar = 'saatlik_gelir_cron'`);
  if (row?.deger === hourKey) {
    return { ok: true, skipped: true, hourKey, oyuncuSay: 0, toplamGelir: 0 };
  }

  const oyuncular = await saatlikGelirOyunculari(db);
  let oyuncuSay = 0;
  let toplamGelir = 0;

  for (const o of oyuncular) {
    const sonuc = await processSaatlikGelir(db, o.id, null);
    if (sonuc.gelir > 0) {
      oyuncuSay += 1;
      toplamGelir += sonuc.gelir;
    }
  }

  await run(
    db,
    `INSERT OR REPLACE INTO sistem_gunluk (anahtar, deger, guncelleme) VALUES ('saatlik_gelir_cron', ?, ?)`,
    [hourKey, Math.floor(Date.now() / 1000)]
  );

  if (oyuncuSay > 0) {
    console.log(
      `[saatlik] ${hourKey} — ${oyuncuSay} oyuncuya toplam ${toplamGelir.toLocaleString("tr-TR")} TL`
    );
  }

  return { ok: true, hourKey, oyuncuSay, toplamGelir };
}

module.exports = {
  oyuncuSaatlikKazanc,
  processSaatlikGelir,
  saatlikGelirIsle,
  syncSaatlikGelirSaati,
};
