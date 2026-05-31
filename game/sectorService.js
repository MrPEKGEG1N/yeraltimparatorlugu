const { run, get, all } = require("../db/database");
const { mekanTanim, sonrakiFiyat } = require("./sectorsCatalog");
const { logStatHareket } = require("./statService");

function turkeyHourStamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
}

async function getSahiplik(db, userId) {
  const rows = await all(
    db,
    `SELECT sektor, mekan_key, adet, last_income_hour FROM sektor_sahiplik WHERE user_id = ?`,
    [userId]
  );
  const map = {};
  rows.forEach((r) => {
    const k = `${r.sektor}:${r.mekan_key}`;
    map[k] = { adet: r.adet, lastIncomeHour: r.last_income_hour };
  });
  return map;
}

function saatlikToplam(sahiplik) {
  let toplam = 0;
  let sayginlik = 0;
  Object.keys(sahiplik).forEach((key) => {
    const [sektor, mekanKey] = key.split(":");
    const m = mekanTanim(sektor, mekanKey);
    if (!m) return;
    const adet = sahiplik[key].adet || 0;
    toplam += m.saatlik * adet;
    sayginlik += m.sayginlik * adet;
  });
  return { toplam, sayginlik };
}

async function processSectorIncome(db, userId, player) {
  const sahiplik = await getSahiplik(db, userId);
  const hourKey = turkeyHourStamp();
  let toplam = 0;

  for (const key of Object.keys(sahiplik)) {
    const row = sahiplik[key];
    if (!row.adet) continue;
    if (row.lastIncomeHour === hourKey) continue;
    const [sektor, mekanKey] = key.split(":");
    const m = mekanTanim(sektor, mekanKey);
    if (!m) continue;
    toplam += m.saatlik * row.adet;
    await run(
      db,
      `UPDATE sektor_sahiplik SET last_income_hour = ? WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
      [hourKey, userId, sektor, mekanKey]
    );
  }

  if (toplam > 0) {
    player.kasa += toplam;
    await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  }
  return player;
}

async function sektorPanel(db, userId) {
  const sahiplik = await getSahiplik(db, userId);
  const { toplam } = saatlikToplam(sahiplik);
  return { sahiplik, saatlikKazanc: toplam };
}

async function mekanAl(db, userId, player, sektor, mekanKey) {
  const m = mekanTanim(sektor, mekanKey);
  if (!m) return { ok: false, error: "Geçersiz mekan." };

  const mevcut = await get(
    db,
    `SELECT adet FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
    [userId, sektor, mekanKey]
  );
  const adet = mevcut ? mevcut.adet : 0;
  const fiyat = sonrakiFiyat(m.fiyat, adet);

  if (player.kasa < fiyat) {
    return {
      ok: false,
      error: `Kasanda yeterli nakit yok! ${fiyat.toLocaleString("tr-TR")} TL gerekir.`,
    };
  }

  player.kasa -= fiyat;
  player.puan += m.sayginlik;

  if (mevcut) {
    await run(
      db,
      `UPDATE sektor_sahiplik SET adet = adet + 1 WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
      [userId, sektor, mekanKey]
    );
  } else {
    await run(
      db,
      `INSERT INTO sektor_sahiplik (user_id, sektor, mekan_key, adet, last_income_hour)
       VALUES (?, ?, ?, 1, NULL)`,
      [userId, sektor, mekanKey]
    );
  }

  await run(db, `UPDATE players SET kasa = ?, puan = ? WHERE user_id = ?`, [
    player.kasa,
    player.puan,
    userId,
  ]);

  await logStatHareket(db, userId, "sayginlik", m.sayginlik);

  return {
    ok: true,
    mesaj: `${m.ad} satın alındı! (+${m.sayginlik} saygınlık)`,
    fiyat,
    yeniAdet: adet + 1,
  };
}

async function mekanDevret(db, fromUserId, toUserId, sektor, mekanKey, adet) {
  const m = mekanTanim(sektor, mekanKey);
  if (!m) return { ok: false, error: "Geçersiz mekan." };

  const miktar = Math.max(1, parseInt(adet, 10) || 1);
  const row = await get(
    db,
    `SELECT adet FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
    [fromUserId, sektor, mekanKey]
  );
  if (!row || row.adet < miktar) {
    return { ok: false, error: `En fazla ${row ? row.adet : 0} adet devredebilirsin.` };
  }

  if (row.adet === miktar) {
    await run(
      db,
      `DELETE FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
      [fromUserId, sektor, mekanKey]
    );
  } else {
    await run(
      db,
      `UPDATE sektor_sahiplik SET adet = adet - ? WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
      [miktar, fromUserId, sektor, mekanKey]
    );
  }

  const hedef = await get(
    db,
    `SELECT adet FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
    [toUserId, sektor, mekanKey]
  );
  if (hedef) {
    await run(
      db,
      `UPDATE sektor_sahiplik SET adet = adet + ? WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
      [miktar, toUserId, sektor, mekanKey]
    );
  } else {
    await run(
      db,
      `INSERT INTO sektor_sahiplik (user_id, sektor, mekan_key, adet, last_income_hour)
       VALUES (?, ?, ?, ?, NULL)`,
      [toUserId, sektor, mekanKey, miktar]
    );
  }

  const hedefAd = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [toUserId]);
  return {
    ok: true,
    mesaj: `${miktar} adet ${m.ad}, ${hedefAd.reis_adi}'a devredildi.`,
  };
}

module.exports = {
  getSahiplik,
  saatlikToplam,
  processSectorIncome,
  sektorPanel,
  mekanAl,
  mekanDevret,
};
