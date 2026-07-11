const { initDatabase, all } = require("../db/database");
const { getPlayerDetail, mapPlayerRow, fmtTs } = require("../game/adminService");
const { HIRE } = require("../game/catalog");

function buildFullPayload(detail) {
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
      isAdmin: !!detail.user.is_admin,
    },
    yetenekler: detail.yetenekler || null,
    aktifMeslek: detail.aktifMeslek || null,
    sirketCalisan: detail.sirketCalisan || null,
    sahipSirket: detail.sahipSirket || null,
    sirketPanel: extra.sirketPanel || null,
    mekanlar: detail.mekanlar || [],
    guvenliYer: detail.guvenliYer,
    guvenliYerFull: extra.guvenliYerFull || null,
    istihbaratEleman: detail.istihbaratEleman,
    profil: extra.profil || null,
    ekonomi: extra.ekonomi || null,
    sehirMeta: extra.sehirMeta || null,
    sefirlikOzet: extra.sefirlikOzet || null,
    sehirKontroller: extra.sehirKontroller || [],
    sehirHukimiyetSahip: extra.sehirHakimiyetSahip || [],
    sehirHukumranliklar: extra.sehirHukumranliklar || [],
    envanter: extra.envanter || [],
    limanlar: extra.limanlar || [],
    babaMakamlari: extra.babaMakamlari || [],
    sadakatOylari: extra.sadakatOylari || [],
    gunlukGorevler: extra.gunlukGorevler || [],
    mafyaBasvurulari: extra.mafyaBasvurulari || [],
    mafyaIsleri: extra.mafyaIsleri || [],
    mafyaSavaslari: extra.mafyaSavaslari || [],
    medyaHaberleri: extra.medyaHaberleri || [],
    statHareketleri: extra.statHareketleri || [],
    mesajSayilari: extra.mesajSayilari || null,
    profilZiyaretSayisi: extra.profilZiyaretSayisi || 0,
    icerikRaporlari: extra.icerikRaporlari || [],
    banka: extra.banka || null,
    fingerprints: (detail.fingerprints || []).map((f) => ({
      visitorId: f.visitor_id,
      ip: f.son_ip,
      userAgent: f.user_agent,
      firstSeen: fmtTs(f.first_seen),
      lastSeen: fmtTs(f.last_seen),
    })),
    events: (detail.events || []).map((e) => ({
      type: e.event_type,
      detail: e.detail,
      ip: e.ip,
      at: fmtTs(e.created_at),
    })),
    mafya: detail.uyelik
      ? { grupId: detail.uyelik.grup_id, isim: detail.uyelik.isim, rutbe: detail.uyelik.rutbe }
      : null,
    borsa: detail.borsa || null,
    aktiviteLog: detail.aktiviteLog || [],
    hireSablon: Object.entries(HIRE).map(([key, v]) => ({ key, unvan: v.unvan })),
  };
}

(async () => {
  const db = await initDatabase();
  const users = await all(
    db,
    "SELECT id, username FROM users WHERE username IN ('dd1','mrpekgeg1n','deniz')"
  );
  for (const u of users) {
    const detail = await getPlayerDetail(db, u.id);
    const payload = buildFullPayload(detail);
    const json = JSON.stringify(payload);
    console.log(u.username, json.length + " bytes", "mekan", payload.mekanlar.length, "borsa", !!payload.borsa);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
