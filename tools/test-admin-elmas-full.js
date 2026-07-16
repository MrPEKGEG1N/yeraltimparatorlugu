const path = require("path");
const { initDatabase, get, run } = require("../db/database");
const { updatePlayerFull, getPlayerDetail } = require("../game/adminService");

async function main() {
  process.env.DATABASE_PATH = path.join(__dirname, "..", "db", "oyun.db");
  const db = await initDatabase();
  const row = await get(db, `SELECT user_id, elmas, profil_resmi, premium_paket FROM players WHERE user_id = 1`);
  const uid = row.user_id;
  const before = row.elmas || 0;
  const detail = await getPlayerDetail(db, uid);
  const admin = await get(db, `SELECT id FROM users WHERE is_admin = 1 LIMIT 1`);

  // Full form-like payload (as admin panel sends)
  const body = {
    kullanici: {
      reisAdi: detail.user.reis_adi,
      lakap: detail.user.lakap || "Mafya",
      grup: detail.user.grup || "",
      kayitUlkesi: detail.user.kayit_ulkesi || "TR",
      oyunDili: detail.user.oyun_dili || "tr",
      isAdmin: 1,
    },
    oyuncu: {
      kasa: detail.user.kasa,
      guc: detail.user.guc,
      puan: detail.user.puan,
      icraat: detail.user.icraat,
      smsHakki: detail.user.sms_hakki,
      elmas: before + 11,
      // Echoed like API clients / premium form fields — must not break int numMap
      premiumPaket: detail.user.premium_paket || "tetikci",
      bonusGuc: detail.user.bonus_guc || 0,
      devletIliskisi: detail.user.devlet_iliskisi ?? 100,
      sehreHukmetSayisi: detail.user.sehre_hukmet_sayisi || 0,
      limanIstanbul: detail.user.liman_istanbul || 0,
      karaListede: !!detail.user.kara_listede,
      sehirEfsane: !!detail.user.sehir_efsane,
      profilAciklama: detail.user.profil_aciklama || "",
      profilResmi: detail.user.profil_resmi || "vip-erkek-01",
      dostlar: detail.user.dostlar || "",
      dusmanlar: detail.user.dusmanlar || "",
    },
    yetenekler: detail.yetenekler || { guc: 8, zeka: 8, dayaniklilik: 8, beceri: 8 },
    banka: {
      yatirilanMiktar: 0,
      bankaHakki: 20,
      faizBekleyen: 0,
    },
    guvenliYer: {
      baseSeviye: 1,
      buildingLvl: 0,
      wallLvl: 0,
      gardenLvl: 0,
      undergroundLvl: 0,
      bunkerLvl: 0,
      kasaGumus: false,
      kasaAltin: false,
    },
    istihbarat: { elemanSayisi: detail.istihbaratEleman || 0 },
    mekanlar: (detail.mekanlar || []).map((m) => ({
      sektor: m.sektor,
      mekanKey: m.mekan_key || m.mekanKey,
      adet: m.adet,
    })),
    envanter: [],
  };

  console.log("profilResmi", JSON.stringify(body.oyuncu.profilResmi));
  console.log("premiumPaket", JSON.stringify(body.oyuncu.premiumPaket));
  const sonuc = await updatePlayerFull(db, admin.id, uid, body);
  console.log("full update", sonuc);
  const after = await get(db, `SELECT elmas, premium_paket, profil_resmi FROM players WHERE user_id = ?`, [uid]);
  console.log("elmas", before, "->", after.elmas);
  await run(
    db,
    `UPDATE players SET elmas = ?, premium_paket = ?, profil_resmi = ? WHERE user_id = ?`,
    [before, row.premium_paket || detail.user.premium_paket || "", row.profil_resmi || detail.user.profil_resmi || "", uid]
  );
  if (!sonuc.ok) throw new Error(sonuc.error);
  if (after.elmas !== before + 11) throw new Error("elmas not applied");
  console.log("OK full form");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
