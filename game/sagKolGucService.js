const { get } = require("../db/database");
const { guvenliYerBonusForUser, mafyaEviBonusForUser } = require("./bonusGucService");
const { sagKolYetenekleriOku, sagKolSahipMi, saglikOku } = require("./sagKolService");
const { sagKolSavasEtkileri } = require("./sagKolCatalog");

/**
 * Sağ kol çarpanlarıyla etkili savaş gücü parçaları.
 * Sağlık 0 ise tüm sağ kol etkileri pasif.
 * Zekâ kesimi saldiranZeka ile rakibe uygulanır (savunmada kendi zekası kullanılmaz).
 */
async function etkinSavasParcalari(db, userId, opts = {}) {
  const row = await get(
    db,
    `SELECT guc, COALESCE(bonus_guc, 0) AS bonus_guc, kara_listede FROM players WHERE user_id = ?`,
    [userId]
  );
  if (!row) {
    return {
      normal: 0,
      gy: 0,
      me: 0,
      bonus: 0,
      toplam: 0,
      aktif: false,
      saglik: 0,
      sagKol: { guc: 1, zeka: 1, dayaniklilik: 1, beceri: 1 },
      etkiler: sagKolSavasEtkileri(null),
    };
  }

  const sahip = await sagKolSahipMi(db, userId);
  const saglikDurum = sahip
    ? await saglikOku(db, userId)
    : { saglik: 0, aktif: false, hastanelik: false };
  const aktif = !!(sahip && saglikDurum.aktif);
  const sk = sahip
    ? await sagKolYetenekleriOku(db, userId)
    : { guc: 1, zeka: 1, dayaniklilik: 1, beceri: 1 };
  const etkiler = aktif
    ? sagKolSavasEtkileri(sk)
    : { gucBonusOran: 0, zekaKesimOran: 0, beceriBonusOran: 0, dayaniklilikBonusOran: 0, yetenekler: sk };
  const guc = Math.max(0, Number(row.guc) || 0);
  const gyRaw = await guvenliYerBonusForUser(db, userId);
  const meRaw = await mafyaEviBonusForUser(db, userId);

  const normal = Math.floor(guc * (1 + etkiler.gucBonusOran));
  let gy = Math.floor(gyRaw * (1 + etkiler.beceriBonusOran));
  let me = Math.floor(meRaw * (1 + etkiler.dayaniklilikBonusOran));
  let bonus = gy + me;

  const saldiranZeka = opts.saldiranZeka;
  if (saldiranZeka != null) {
    const kesim = sagKolSavasEtkileri({ zeka: saldiranZeka, guc: 1, beceri: 1, dayaniklilik: 1 }).zekaKesimOran;
    bonus = Math.max(0, Math.floor(bonus * (1 - kesim)));
    const rawBonus = gy + me;
    if (rawBonus > 0) {
      gy = Math.floor(bonus * (gy / rawBonus));
      me = bonus - gy;
    } else {
      gy = 0;
      me = 0;
    }
  }

  return {
    normal,
    gy,
    me,
    bonus,
    toplam: normal + bonus,
    aktif,
    saglik: saglikDurum.saglik || 0,
    hastanelik: !!saglikDurum.hastanelik,
    sagKol: sk,
    etkiler,
    karaListede: !!row.kara_listede,
  };
}

async function etkinToplamGuc(db, userId, opts = {}) {
  const p = await etkinSavasParcalari(db, userId, opts);
  return p.toplam;
}

async function etkinSavunmaGucu(db, userId, opts = {}) {
  const p = await etkinSavasParcalari(db, userId, opts);
  let t = p.toplam;
  // Liman / baba makamı: sahip her zaman yarı güç
  if (opts.makamYari) t = Math.floor(t * 0.5);
  return t;
}

module.exports = {
  etkinSavasParcalari,
  etkinToplamGuc,
  etkinSavunmaGucu,
};
