const { run, get } = require("../db/database");
const { logStatHareket } = require("./statService");
const {
  BASE_GENISLIK,
  BASE_YUKSEKLIK,
  MAX_SEVIYE,
  SEVIYELER,
  MODUL_ALAN,
  seviyeGorselYolu,
  seviyeBul,
  sonrakiSeviye,
  toplamGucBonusu,
} = require("./guvenliYerCatalog");

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
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
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
    gucBonus: toplamGucBonusu(s),
  };
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
    const yeniBonus = toplamGucBonusu(sonraki.seviye);
    player.bonus_guc = yeniBonus;
    await run(db, `UPDATE players SET bonus_guc = ? WHERE user_id = ?`, [yeniBonus, userId]);
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
  const bonus = toplamGucBonusu(s);
  await run(db, `UPDATE players SET bonus_guc = ? WHERE user_id = ?`, [bonus, userId]);
  const row = await ensureUserBase(db, userId);
  return { ok: true, base: baseOzeti(row) };
}

async function migrateGuvenliYerBonusGuc(db) {
  const { all, run: dbRun } = require("../db/database");
  const rows = await all(
    db,
    `SELECT ub.user_id, ub.base_seviye, p.guc, COALESCE(p.bonus_guc, 0) AS bonus_guc
     FROM user_base ub
     JOIN players p ON p.user_id = ub.user_id`
  );
  for (const r of rows) {
    const expected = toplamGucBonusu(r.base_seviye);
    const currentBonus = r.bonus_guc || 0;
    if (expected <= currentBonus) continue;
    const delta = expected - currentBonus;
    const newGuc = Math.max(0, (r.guc || 0) - delta);
    await dbRun(db, `UPDATE players SET bonus_guc = ?, guc = ? WHERE user_id = ?`, [
      expected,
      newGuc,
      r.user_id,
    ]);
  }
}

module.exports = {
  ensureUserBaseTable,
  ensureUserBase,
  panelGetir,
  gelistir,
  baseOzeti,
  adminSeviyeAyarla,
  migrateGuvenliYerBonusGuc,
};
