const { initDatabase, all } = require("../db/database");
const { getPlayerDetail, mapPlayerRow, fmtTs } = require("../game/adminService");
const { HIRE } = require("../game/catalog");

async function buildAdminPayload(detail) {
  const extra = detail.extra || {};
  return {
    ok: true,
    oyuncu: {
      ...mapPlayerRow(detail.user),
      userAgent: detail.user.user_agent,
      createdAt: fmtTs(detail.user.created_at),
      lakap: detail.user.lakap,
      grup: detail.user.grup,
      smsHakki: detail.user.sms_hakki,
      mekanToplam: detail.mekanToplam,
      guvenliYer: detail.guvenliYer,
      istihbaratEleman: detail.istihbaratEleman,
      bonusGuc: detail.user.bonus_guc || 0,
      devletIliskisi: detail.user.devlet_iliskisi,
      karaListede: !!detail.user.kara_listede,
      sehirEfsane: !!detail.user.sehir_efsane,
      sehreHukmetSayisi: detail.user.sehre_hukmet_sayisi || 0,
      limanIstanbul: detail.user.liman_istanbul || 0,
      elmas: detail.user.elmas || 0,
      premiumPaket: detail.user.premium_paket || "",
      kayitUlkesi: detail.user.kayit_ulkesi || "",
      oyunDili: detail.user.oyun_dili || "",
    },
    borsa: detail.borsa || null,
    mekanlar: detail.mekanlar || [],
    profil: extra.profil || null,
    fingerprints: (detail.fingerprints || []).map((f) => ({
      visitorId: f.visitor_id,
      ip: f.son_ip,
    })),
    hireSablon: Object.entries(HIRE).map(([key, v]) => ({ key, unvan: v.unvan })),
  };
}

(async () => {
  const db = await initDatabase();
  const users = await all(
    db,
    "SELECT id, username FROM users WHERE username IN ('dd1','mrpekgeg1n')"
  );
  for (const u of users) {
    const t0 = Date.now();
    const detail = await getPlayerDetail(db, u.id);
    if (!detail) {
      console.log(u.username, "NOT FOUND");
      continue;
    }
    try {
      const payload = await buildAdminPayload(detail);
      JSON.stringify(payload);
      console.log(u.username, "OK", Date.now() - t0 + "ms");
    } catch (e) {
      console.log(u.username, "SERIALIZE FAIL", e.message);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
