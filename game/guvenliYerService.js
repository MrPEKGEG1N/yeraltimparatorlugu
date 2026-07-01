const { run, get } = require("../db/database");
const { logStatHareket } = require("./statService");
const { syncBonusGuc } = require("./bonusGucService");
const {
  BASE_GENISLIK,
  BASE_YUKSEKLIK,
  MAX_SEVIYE,
  SEVIYELER,
  MODUL_ALAN,
  KASALAR,
  KASA_ABONELIK_SN,
  kasaBul,
  kasaAktifMi,
  kasaKorumaOrani,
  seviyeGorselYolu,
  seviyeBul,
  sonrakiSeviye,
  toplamGucBonusu,
  nowSec,
} = require("./guvenliYerCatalog");

async function migrateGuvenliYerKasalar(db) {
  for (const [col, def] of [
    ["kasa_gumus", "INTEGER NOT NULL DEFAULT 0"],
    ["kasa_altin", "INTEGER NOT NULL DEFAULT 0"],
    ["kasa_gumus_bitis", "INTEGER NOT NULL DEFAULT 0"],
    ["kasa_altin_bitis", "INTEGER NOT NULL DEFAULT 0"],
  ]) {
    try {
      await run(db, `ALTER TABLE user_base ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
  const gecis = nowSec() + KASA_ABONELIK_SN;
  await run(
    db,
    `UPDATE user_base SET kasa_gumus_bitis = ? WHERE kasa_gumus = 1 AND COALESCE(kasa_gumus_bitis, 0) = 0`,
    [gecis]
  );
  await run(
    db,
    `UPDATE user_base SET kasa_altin_bitis = ? WHERE kasa_altin = 1 AND COALESCE(kasa_altin_bitis, 0) = 0`,
    [gecis]
  );
}

async function ensureUserBaseTable(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS user_base (
      user_id INTEGER PRIMARY KEY,
      base_seviye INTEGER NOT NULL DEFAULT 1,
      building_lvl INTEGER NOT NULL DEFAULT 0,
      wall_lvl INTEGER NOT NULL DEFAULT 0,
      garden_lvl INTEGER NOT NULL DEFAULT 0,
      energy_wall INTEGER NOT NULL DEFAULT 0,
      underground_lvl INTEGER NOT NULL DEFAULT 0,
      secret_orders INTEGER NOT NULL DEFAULT 0,
      has_tower INTEGER NOT NULL DEFAULT 0,
      helipad INTEGER NOT NULL DEFAULT 0,
      bunker_lvl INTEGER NOT NULL DEFAULT 0,
      bunker_entrance INTEGER NOT NULL DEFAULT 0,
      kasa_gumus INTEGER NOT NULL DEFAULT 0,
      kasa_altin INTEGER NOT NULL DEFAULT 0,
      kasa_gumus_bitis INTEGER NOT NULL DEFAULT 0,
      kasa_altin_bitis INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await migrateGuvenliYerKasalar(db);
}

async function ensureUserBase(db, userId) {
  await ensureUserBaseTable(db);
  let row = await get(db, `SELECT * FROM user_base WHERE user_id = ?`, [userId]);
  if (row) return row;
  await run(db, `INSERT INTO user_base (user_id) VALUES (?)`, [userId]);
  row = await get(db, `SELECT * FROM user_base WHERE user_id = ?`, [userId]);
  return row;
}

function baseOzeti(row) {
  const s = Math.max(1, Math.min(MAX_SEVIYE, row.base_seviye || 1));
  const mevcut = seviyeBul(s);
  return {
    baseSeviye: s,
    ad: mevcut.ad,
    buildingLvl: row.building_lvl,
    wallLvl: row.wall_lvl,
    gardenLvl: row.garden_lvl,
    energyWall: row.energy_wall,
    undergroundLvl: row.underground_lvl,
    secretOrders: row.secret_orders,
    hasTower: row.has_tower,
    helipad: row.helipad,
    bunkerLvl: row.bunker_lvl,
    bunkerEntrance: row.bunker_entrance,
    kasaGumus: kasaAktifMi(row, kasaBul("gumus")),
    kasaAltin: kasaAktifMi(row, kasaBul("altin")),
    kasaGumusBitis: row.kasa_gumus_bitis || 0,
    kasaAltinBitis: row.kasa_altin_bitis || 0,
    kasaKorumaOrani: kasaKorumaOrani(row),
    gucBonus: toplamGucBonusu(s),
  };
}

function kasaPanelOzeti(row, player) {
  const baseSev = Math.max(1, row.base_seviye || 1);
  const elmas = player.elmas || 0;
  return KASALAR.map((k) => {
    const aktif = kasaAktifMi(row, k);
    const bitisAt = Number(row[k.bitisAlan] || 0);
    let kilitli = false;
    let kilitNedeni = "";
    if (!aktif && k.minBaseSeviye > baseSev) {
      kilitli = true;
      kilitNedeni = `Üs seviyesi ${k.minBaseSeviye}+ gerekir`;
    }
    if (!aktif && k.onkosul) {
      const onceki = kasaBul(k.onkosul);
      if (onceki && !kasaAktifMi(row, onceki)) {
        kilitli = true;
        kilitNedeni = `Önce ${onceki.ad} gerekir`;
      }
    }
    return {
      id: k.id,
      ad: k.ad,
      aciklama: k.aciklama,
      elmasMaliyet: k.elmasMaliyet,
      abonelikGun: k.abonelikGun,
      korumaOrani: k.korumaOrani,
      gorsel: k.gorsel,
      minBaseSeviye: k.minBaseSeviye,
      onkosul: k.onkosul,
      aktif,
      bitisAt: aktif ? bitisAt : 0,
      suresiDolmus: !aktif && bitisAt > 0,
      kilitli,
      kilitNedeni,
      yeterliElmas: elmas >= k.elmasMaliyet,
    };
  });
}

async function panelGetir(db, userId, player) {
  const row = await ensureUserBase(db, userId);
  const s = Math.max(1, Math.min(MAX_SEVIYE, row.base_seviye || 1));
  const sonraki = sonrakiSeviye(s);

  return {
    ok: true,
    genislik: BASE_GENISLIK,
    yukseklik: BASE_YUKSEKLIK,
    gorselSrc: seviyeGorselYolu(s),
    base: baseOzeti(row),
    sonraki: sonraki
      ? {
          id: sonraki.id,
          seviye: sonraki.seviye,
          ad: sonraki.ad,
          aciklama: sonraki.aciklama,
          maliyet: sonraki.maliyet,
          gucBonus: sonraki.gucBonus,
          gorselSrc: seviyeGorselYolu(sonraki.seviye),
          yeterliPara: player.kasa >= sonraki.maliyet,
        }
      : null,
    moduller: SEVIYELER.map((m) => ({
      id: m.id,
      seviye: m.seviye,
      ad: m.ad,
      aciklama: m.aciklama,
      maliyet: m.maliyet,
      gucBonus: m.gucBonus,
      acik: m.seviye <= s,
      gorselSrc: seviyeGorselYolu(m.seviye),
    })),
    kasalar: kasaPanelOzeti(row, player),
  };
}

async function gelistir(db, userId, player) {
  const row = await ensureUserBase(db, userId);
  const s = Math.max(1, Math.min(MAX_SEVIYE, row.base_seviye || 1));
  const sonraki = sonrakiSeviye(s);
  if (!sonraki) return { ok: false, error: "Üssün zaten maksimum seviyede." };
  if (sonraki.maliyet > 0 && player.kasa < sonraki.maliyet) {
    return { ok: false, error: "Kasanda yeterli nakit yok!" };
  }

  if (sonraki.maliyet > 0) {
    player.kasa -= sonraki.maliyet;
    await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
    await logStatHareket(db, userId, "kasa", -sonraki.maliyet, "guvenli_yer");
  }

  const alan = MODUL_ALAN[sonraki.id];
  const sets = ["base_seviye = ?", "updated_at = strftime('%s','now')"];
  const params = [sonraki.seviye];
  if (alan) sets.push(`${alan} = 1`);
  params.push(userId);
  await run(db, `UPDATE user_base SET ${sets.join(", ")} WHERE user_id = ?`, params);

  if (sonraki.gucBonus > 0) {
    const bonusSync = await syncBonusGuc(db, userId);
    player.bonus_guc = bonusSync.toplam;
    await logStatHareket(db, userId, "bonus_guc", sonraki.gucBonus, "guvenli_yer");
  }

  const guncel = await ensureUserBase(db, userId);
  return {
    ok: true,
    seviye: sonraki,
    base: baseOzeti(guncel),
    gorselSrc: seviyeGorselYolu(sonraki.seviye),
    mesaj: `Seviye ${sonraki.seviye}: ${sonraki.ad} tamamlandı!`,
  };
}

async function kasaSatinAl(db, userId, player, kasaId) {
  const kasa = kasaBul(String(kasaId || "").trim());
  if (!kasa) return { ok: false, error: "Geçersiz kasa." };

  const row = await ensureUserBase(db, userId);
  const aktif = kasaAktifMi(row, kasa);

  const baseSev = Math.max(1, row.base_seviye || 1);
  if (!aktif && kasa.minBaseSeviye > baseSev) {
    return { ok: false, error: `Üs seviyesi en az ${kasa.minBaseSeviye} olmalı.` };
  }
  if (!aktif && kasa.onkosul) {
    const onceki = kasaBul(kasa.onkosul);
    if (onceki && !kasaAktifMi(row, onceki)) {
      return { ok: false, error: `Önce ${onceki.ad} satın almalısın.` };
    }
  }

  const elmasRow = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
  const elmas = elmasRow?.elmas || 0;
  if (elmas < kasa.elmasMaliyet) {
    return {
      ok: false,
      error: `Yeterli elmasın yok! ${kasa.elmasMaliyet.toLocaleString("tr-TR")} elmas gerekir.`,
    };
  }

  const now = nowSec();
  const mevcutBitis = Number(row[kasa.bitisAlan] || 0);
  const baslangic = aktif && mevcutBitis > now ? mevcutBitis : now;
  const yeniBitis = baslangic + KASA_ABONELIK_SN;

  await run(db, `UPDATE players SET elmas = elmas - ? WHERE user_id = ?`, [kasa.elmasMaliyet, userId]);
  player.elmas = elmas - kasa.elmasMaliyet;
  await run(
    db,
    `UPDATE user_base SET ${kasa.alan} = 1, ${kasa.bitisAlan} = ?, updated_at = strftime('%s','now') WHERE user_id = ?`,
    [yeniBitis, userId]
  );

  const guncel = await ensureUserBase(db, userId);
  const korumaYuzde = Math.round(kasa.korumaOrani * 100);
  const bitisTarih = new Date(yeniBitis * 1000).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const yenileme = aktif ? " süre uzatıldı" : " aktif edildi";
  return {
    ok: true,
    kasa,
    base: baseOzeti(guncel),
    bitisAt: yeniBitis,
    mesaj: `${kasa.ad}${yenileme}! %${korumaYuzde} nakit koruması ${kasa.abonelikGun} gün geçerli (bitiş: ${bitisTarih}).`,
  };
}

async function adminSeviyeAyarla(db, userId, seviye) {
  const s = Math.max(1, Math.min(MAX_SEVIYE, parseInt(seviye, 10) || 1));
  await ensureUserBase(db, userId);
  await run(
    db,
    `UPDATE user_base SET
      building_lvl = 0, wall_lvl = 0, garden_lvl = 0, energy_wall = 0,
      underground_lvl = 0, secret_orders = 0, has_tower = 0, helipad = 0,
      bunker_lvl = 0, bunker_entrance = 0,
      base_seviye = ?, updated_at = strftime('%s','now')
     WHERE user_id = ?`,
    [s, userId]
  );
  for (const mod of SEVIYELER) {
    if (mod.seviye > s) break;
    const alan = MODUL_ALAN[mod.id];
    if (!alan) continue;
    await run(db, `UPDATE user_base SET ${alan} = 1 WHERE user_id = ?`, [userId]);
  }
  const bonusSync = await syncBonusGuc(db, userId);
  await run(db, `UPDATE players SET bonus_guc = ? WHERE user_id = ?`, [bonusSync.toplam, userId]);
  const row = await ensureUserBase(db, userId);
  return { ok: true, base: baseOzeti(row) };
}

async function migrateGuvenliYerBonusGuc(db) {
  const { migrateTumBonusGuc } = require("./bonusGucService");
  await migrateTumBonusGuc(db);
}

module.exports = {
  ensureUserBaseTable,
  ensureUserBase,
  panelGetir,
  gelistir,
  kasaSatinAl,
  baseOzeti,
  adminSeviyeAyarla,
  migrateGuvenliYerBonusGuc,
};
