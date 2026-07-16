const path = require("path");
process.env.DATABASE_PATH = path.join(__dirname, "..", "db", "oyun.db");

const { initDatabase, get } = require("../db/database");
const { updatePlayerFull, getPlayerDetail } = require("../game/adminService");

async function main() {
  const db = await initDatabase();
  const admin = await get(db, "SELECT id FROM users WHERE is_admin = 1 LIMIT 1");
  const players = await get(db, "SELECT user_id FROM players LIMIT 1");
  // pick a few players
  const { all } = require("../db/database");
  const rows = await all(db, "SELECT user_id, elmas FROM players ORDER BY user_id");

  for (const row of rows.slice(0, 5)) {
    const uid = row.user_id;
    const detail = await getPlayerDetail(db, uid);
    const before = row.elmas || 0;
    const body = {
      kullanici: {
        reisAdi: detail.user.reis_adi,
        lakap: detail.user.lakap || "",
        grup: detail.user.grup || "",
        kayitUlkesi: detail.user.kayit_ulkesi || "TR",
        oyunDili: detail.user.oyun_dili || "tr",
        isAdmin: detail.user.is_admin ? 1 : 0,
      },
      oyuncu: {
        kasa: detail.user.kasa,
        guc: detail.user.guc,
        puan: detail.user.puan,
        icraat: detail.user.icraat,
        smsHakki: detail.user.sms_hakki,
        elmas: before + 5,
        premiumPaket: detail.user.premium_paket || "",
        bonusGuc: detail.user.bonus_guc || 0,
        devletIliskisi: detail.user.devlet_iliskisi ?? 100,
        sehreHukmetSayisi: detail.user.sehre_hukmet_sayisi || 0,
        limanIstanbul: detail.user.liman_istanbul || 0,
        karaListede: !!detail.user.kara_listede,
        sehirEfsane: !!detail.user.sehir_efsane,
        profilAciklama: detail.user.profil_aciklama || "",
        profilResmi: detail.user.profil_resmi || "",
        dostlar: detail.user.dostlar || "",
        dusmanlar: detail.user.dusmanlar || "",
      },
      yetenekler: detail.yetenekler || { guc: 8, zeka: 8, dayaniklilik: 8, beceri: 8 },
      banka: { yatirilanMiktar: 0, bankaHakki: 20, faizBekleyen: 0 },
      guvenliYer: {
        baseSeviye: 1, buildingLvl: 0, wallLvl: 0, gardenLvl: 0,
        undergroundLvl: 0, bunkerLvl: 0, kasaGumus: false, kasaAltin: false,
      },
      istihbarat: { elemanSayisi: detail.istihbaratEleman || 0 },
      // EXACT form behavior: only owned mekanlar from detail
      mekanlar: (detail.mekanlar || []).map((m) => ({
        sektor: m.sektor,
        mekanKey: m.mekanKey || m.mekan_key,
        adet: m.adet,
      })),
      envanter: [],
    };

    const r = await updatePlayerFull(db, admin.id, uid, body);
    const after = await get(db, "SELECT elmas FROM players WHERE user_id = ?", [uid]);
    console.log(
      "uid", uid,
      "mekanCount", body.mekanlar.length,
      "ok", r.ok,
      "err", r.error || "-",
      "elmas", before, "->", after.elmas,
      "guncellenen", (r.guncellenen || []).join(",")
    );
    // rollback elmas
    await require("../db/database").run(db, "UPDATE players SET elmas = ? WHERE user_id = ?", [before, uid]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
