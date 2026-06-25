const { get } = require("../db/database");

/** Şehre hükmeden veya en yüksek saygınlıklı oyuncu için sektör/güç alımlarında x2 fiyat */
async function elitFiyatDurumu(db, userId) {
  const { sehreHukmediyorMu } = require("./karaListeService");
  const uid = Number(userId);
  const sehreHukmeden = await sehreHukmediyorMu(db, uid);
  const top = await get(
    db,
    `SELECT user_id FROM players ORDER BY puan DESC, user_id ASC LIMIT 1`
  );
  const enYuksekSayginlik = top ? Number(top.user_id) === uid : false;
  const kara = await get(db, `SELECT kara_listede FROM players WHERE user_id = ?`, [uid]);
  const karaListede = !!kara?.kara_listede;
  const elit = sehreHukmeden || enYuksekSayginlik || karaListede;
  return {
    fiyatCarpani: elit ? 2 : 1,
    elitFiyatX2: elit,
    sehreHukmeden,
    enYuksekSayginlik,
    karaListede,
  };
}

async function elitFiyatCarpani(db, userId) {
  const d = await elitFiyatDurumu(db, userId);
  return d.fiyatCarpani;
}

module.exports = { elitFiyatCarpani, elitFiyatDurumu };
