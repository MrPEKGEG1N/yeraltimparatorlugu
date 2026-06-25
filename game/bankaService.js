const { run, get, all } = require("../db/database");

const BANKA_HAK_GUNLUK = 20;
const BANKA_HAK_REGEN_SEC = 86400;
const FAIZ_ORAN = 0.01;
const FAIZ_SAAT = 10;
const FAIZ_YATIRIM_SAAT = 18;

function turkeyNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10) || 0,
    minute: parseInt(parts.minute, 10) || 0,
  };
}

async function ensureBankaRow(db, userId) {
  let row = await get(
    db,
    `SELECT user_id, yatirilan_miktar, banka_hakki, last_banka_hak_at, faiz_bekleyen, faiz_gun, faiz_islendi_gun
     FROM banka_hesaplari WHERE user_id = ?`,
    [userId]
  );
  if (!row) {
    const now = Math.floor(Date.now() / 1000);
    await run(
      db,
      `INSERT INTO banka_hesaplari (user_id, yatirilan_miktar, banka_hakki, last_banka_hak_at)
       VALUES (?, 0, ?, ?)`,
      [userId, BANKA_HAK_GUNLUK, now]
    );
    row = await get(
      db,
      `SELECT user_id, yatirilan_miktar, banka_hakki, last_banka_hak_at, faiz_bekleyen, faiz_gun, faiz_islendi_gun
       FROM banka_hesaplari WHERE user_id = ?`,
      [userId]
    );
  }
  return row;
}

async function ensureBankaHak(db, userId, row) {
  const now = Math.floor(Date.now() / 1000);
  let hak = row.banka_hakki ?? BANKA_HAK_GUNLUK;
  const last = row.last_banka_hak_at || now;
  const elapsed = now - last;
  const periods = Math.floor(elapsed / BANKA_HAK_REGEN_SEC);
  if (periods > 0) {
    hak += periods * BANKA_HAK_GUNLUK;
    await run(
      db,
      `UPDATE banka_hesaplari SET banka_hakki = ?, last_banka_hak_at = ? WHERE user_id = ?`,
      [hak, last + periods * BANKA_HAK_REGEN_SEC, userId]
    );
  }
  return hak;
}

async function bankaHakHarca(db, userId) {
  const row = await ensureBankaRow(db, userId);
  const hak = await ensureBankaHak(db, userId, row);
  if (hak < 1) {
    return {
      ok: false,
      error: "Banka hakkın kalmadı! Her 24 saatte +20 hak yenilenir.",
    };
  }
  await run(db, `UPDATE banka_hesaplari SET banka_hakki = banka_hakki - 1 WHERE user_id = ?`, [
    userId,
  ]);
  return { ok: true, kalan: hak - 1 };
}

async function getBanka(db, userId) {
  const row = await ensureBankaRow(db, userId);
  return row ? row.yatirilan_miktar || 0 : 0;
}

async function getBankaPanel(db, userId) {
  const row = await ensureBankaRow(db, userId);
  const hak = await ensureBankaHak(db, userId, row);
  return {
    bakiye: row.yatirilan_miktar || 0,
    bankaHakki: hak,
    faizBekleyen: row.faiz_bekleyen || 0,
  };
}

async function faizYatirimKaydet(db, userId, miktar) {
  const { dayKey, hour } = turkeyNowParts();
  if (hour >= FAIZ_YATIRIM_SAAT) return;

  const row = await ensureBankaRow(db, userId);
  let bekleyen = row.faiz_bekleyen || 0;
  if (row.faiz_gun !== dayKey) {
    bekleyen = 0;
  }
  bekleyen += miktar;
  await run(
    db,
    `UPDATE banka_hesaplari SET faiz_bekleyen = ?, faiz_gun = ? WHERE user_id = ?`,
    [bekleyen, dayKey, userId]
  );
}

async function faizIsle(db) {
  const { dayKey, hour, minute } = turkeyNowParts();
  if (hour !== FAIZ_SAAT || minute > 5) return { processed: 0 };

  const rows = await all(
    db,
    `SELECT user_id, yatirilan_miktar, faiz_bekleyen, faiz_gun, faiz_islendi_gun
     FROM banka_hesaplari WHERE faiz_bekleyen > 0`
  );
  let processed = 0;
  for (const row of rows) {
    if (!row.faiz_gun || row.faiz_islendi_gun === row.faiz_gun) continue;
    const faiz = Math.floor((row.faiz_bekleyen || 0) * FAIZ_ORAN);
    if (faiz < 1) {
      await run(
        db,
        `UPDATE banka_hesaplari SET faiz_bekleyen = 0, faiz_islendi_gun = ? WHERE user_id = ?`,
        [row.faiz_gun, row.user_id]
      );
      continue;
    }
    const yeni = (row.yatirilan_miktar || 0) + faiz;
    await run(
      db,
      `UPDATE banka_hesaplari SET yatirilan_miktar = ?, faiz_bekleyen = 0, faiz_islendi_gun = ? WHERE user_id = ?`,
      [yeni, row.faiz_gun, row.user_id]
    );
    processed++;
  }
  return { processed };
}

async function paraYatir(db, userId, player, yatirMiktari) {
  const hak = await bankaHakHarca(db, userId);
  if (!hak.ok) return hak;

  const yatir = Math.floor(yatirMiktari || 0);
  if (yatir < 1) {
    return { ok: false, error: "Geçerli bir miktar gir." };
  }
  if (player.kasa < yatir) {
    return {
      ok: false,
      error: `Yeterli paran yok. (Kasanda: ${player.kasa.toLocaleString("tr-TR")} TL)`,
    };
  }

  player.kasa -= yatir;
  const row = await ensureBankaRow(db, userId);
  const yeni = (row.yatirilan_miktar || 0) + yatir;

  await run(db, `UPDATE banka_hesaplari SET yatirilan_miktar = ? WHERE user_id = ?`, [yeni, userId]);
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  await faizYatirimKaydet(db, userId, yatir);

  return { ok: true, yatirilan: yatir, toplam: yeni, bankaHakki: hak.kalan };
}

async function paraCek(db, userId, player, cekMiktari) {
  const hak = await bankaHakHarca(db, userId);
  if (!hak.ok) return hak;

  const row = await ensureBankaRow(db, userId);
  const mevcut = row.yatirilan_miktar || 0;
  const cek = Math.floor(cekMiktari || 0);

  if (cek < 1) {
    return { ok: false, error: "Geçerli bir miktar gir." };
  }
  if (mevcut < cek) {
    return {
      ok: false,
      error: `Bankada yeterli para yok. (Bankada: ${mevcut.toLocaleString("tr-TR")} TL)`,
    };
  }

  const kalan = mevcut - cek;
  player.kasa += cek;

  if (kalan > 0) {
    await run(db, `UPDATE banka_hesaplari SET yatirilan_miktar = ? WHERE user_id = ?`, [kalan, userId]);
  } else {
    await run(db, `UPDATE banka_hesaplari SET yatirilan_miktar = 0 WHERE user_id = ?`, [userId]);
  }
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);

  return { ok: true, cekilen: cek, yeniKasa: player.kasa, bankaHakki: hak.kalan };
}

module.exports = {
  BANKA_HAK_GUNLUK,
  getBanka,
  getBankaPanel,
  paraYatir,
  paraCek,
  faizIsle,
};
