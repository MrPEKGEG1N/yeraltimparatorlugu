const { run, get, all } = require("../db/database");
const { logSecurityEvent } = require("./securityService");
const { listCanliAktivite, listOyuncuAktiviteLog, mapAktiviteAlanlari } = require("./aktiviteService");
const { SECTOR_KEYS, MEKANLAR } = require("./sectorsCatalog");
const { ensureUserBase, adminSeviyeAyarla, baseOzeti } = require("./guvenliYerService");
const { MAX_SEVIYE, seviyeBul } = require("./guvenliYerCatalog");
const { ELEMAN_GUC } = require("./istihbaratService");
const { meslekGetir, yetenekleriGetir, yetenekleriKaydet } = require("./meslekService");
const { turBul, maxCalisanHesapla, depoKapasiteHesapla } = require("./sirketCatalog");
const { sehirBul } = require("./turkiyeSefirlikCatalog");
const { ensureGunlukGorevTables } = require("./gunlukGorevService");
const { paketTanim } = require("./premiumService");
const { HIRE } = require("./catalog");
const { gecerliProfilResmi } = require("./profilPortreler");
const { clampAvukatIliskisi, AVUKAT_ILISKI_MAX } = require("./devletService");
const { syncBonusGuc } = require("./bonusGucService");

const SEKTOR_ETIKET = { yeralti: "Yeraltı", silah: "Silah", paket: "Paket" };

function listMekanSablonu() {
  const liste = [];
  for (const sektor of SECTOR_KEYS) {
    const mekanlar = MEKANLAR[sektor] || {};
    for (const mekanKey of Object.keys(mekanlar)) {
      const m = mekanlar[mekanKey];
      liste.push({
        sektor,
        mekanKey,
        sektorLabel: SEKTOR_ETIKET[sektor] || sektor,
        ad: m.ad,
        saatlik: m.saatlik,
        sayginlik: m.sayginlik,
      });
    }
  }
  return liste;
}

async function getPlayerMekanlar(db, userId) {
  const rows = await all(
    db,
    `SELECT sektor, mekan_key, adet FROM sektor_sahiplik WHERE user_id = ? ORDER BY sektor, mekan_key`,
    [userId]
  );
  const adetMap = {};
  let toplam = 0;
  for (const r of rows) {
    const k = `${r.sektor}:${r.mekan_key}`;
    adetMap[k] = r.adet || 0;
    toplam += r.adet || 0;
  }
  const mekanlar = listMekanSablonu().map((m) => ({
    ...m,
    adet: adetMap[`${m.sektor}:${m.mekanKey}`] || 0,
  }));
  return { mekanlar, toplam };
}

function fmtTs(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}

async function getDashboard(db) {
  const { ensureBorsaTables } = require("./borsaService");
  await ensureBorsaTables(db).catch(() => {});
  const row = await get(
    db,
    `SELECT
      (SELECT COUNT(*) FROM users) AS toplam_oyuncu,
      (SELECT COUNT(*) FROM users WHERE banned = 1) AS banli,
      (SELECT COUNT(*) FROM users WHERE is_admin = 1) AS admin_sayisi,
      (SELECT COUNT(*) FROM players WHERE last_seen_at > strftime('%s','now') - 900) AS online_15dk,
      (SELECT COUNT(*) FROM security_events WHERE created_at > strftime('%s','now') - 86400) AS olay_24s,
      (SELECT COUNT(*) FROM oyuncu_mesajlari WHERE created_at > strftime('%s','now') - 86400) AS mesaj_24s,
      (SELECT COUNT(*) FROM mafya_gruplari) AS mafya_grup,
      (SELECT COUNT(*) FROM icerik_raporlari WHERE created_at > strftime('%s','now') - 86400) AS rapor_24s,
      (SELECT COUNT(*) FROM oyuncu_gorus_onerileri WHERE created_at > strftime('%s','now') - 86400) AS gorus_24s,
      (SELECT COUNT(DISTINCT user_id) FROM borsa_portfoy WHERE adet > 0) AS borsa_yatirimci,
      (SELECT COUNT(*) FROM borsa_emirleri WHERE durum = 'beklemede') AS borsa_bekleyen_emir,
      (SELECT COALESCE(SUM(p.adet * s.fiyat), 0) FROM borsa_portfoy p JOIN borsa_sirketleri s ON s.id = p.sirket_id) AS borsa_portfoy_deger,
      (SELECT COUNT(*) FROM borsa_islem_log WHERE created_at > strftime('%s','now') - 86400) AS borsa_islem_24s`
  );
  return row || {};
}

async function searchPlayers(db, q, limit = 200) {
  const raw = String(q || "").trim();
  const cap = Math.min(500, Math.max(1, limit));

  if (!raw) {
    return all(
      db,
      `SELECT u.id, u.username, u.reis_adi, u.lakap, u.grup, u.banned, u.is_admin,
              u.visitor_id, u.son_ip, u.user_agent, u.last_login_at, u.created_at,
              p.kasa, p.guc, p.puan, p.icraat, p.sms_hakki, p.last_seen_at, p.kara_listede,
              p.aktif_ekran, p.son_aksiyon, p.son_aksiyon_detay, p.son_aksiyon_at,
              COALESCE(bh.yatirilan_miktar, 0) AS banka_bakiye,
              COALESCE(bh.banka_hakki, 20) AS banka_hakki,
              COALESCE(bh.faiz_bekleyen, 0) AS faiz_bekleyen,
              (SELECT COALESCE(SUM(adet), 0) FROM sektor_sahiplik s WHERE s.user_id = u.id) AS mekan_toplam,
              COALESCE(ub.base_seviye, 1) AS guvenli_yer_seviye,
              COALESCE(i.eleman_sayisi, 0) AS istihbarat_eleman,
              (SELECT COALESCE(SUM(p.adet * s.fiyat), 0) FROM borsa_portfoy p JOIN borsa_sirketleri s ON s.id = p.sirket_id WHERE p.user_id = u.id) AS borsa_deger
       FROM users u
       JOIN players p ON p.user_id = u.id
       LEFT JOIN banka_hesaplari bh ON bh.user_id = u.id
       LEFT JOIN user_base ub ON ub.user_id = u.id
       LEFT JOIN istihbarat i ON i.user_id = u.id
       ORDER BY p.puan DESC
       LIMIT ?`,
      [cap]
    );
  }

  const like = `%${raw}%`;
  return all(
    db,
    `SELECT u.id, u.username, u.reis_adi, u.lakap, u.grup, u.banned, u.is_admin,
            u.visitor_id, u.son_ip, u.user_agent, u.last_login_at, u.created_at,
            p.kasa, p.guc, p.puan, p.icraat, p.sms_hakki, p.last_seen_at, p.kara_listede,
            p.aktif_ekran, p.son_aksiyon, p.son_aksiyon_detay, p.son_aksiyon_at,
            COALESCE(bh.yatirilan_miktar, 0) AS banka_bakiye,
            COALESCE(bh.banka_hakki, 20) AS banka_hakki,
            COALESCE(bh.faiz_bekleyen, 0) AS faiz_bekleyen,
            (SELECT COALESCE(SUM(adet), 0) FROM sektor_sahiplik s WHERE s.user_id = u.id) AS mekan_toplam,
            COALESCE(ub.base_seviye, 1) AS guvenli_yer_seviye,
            COALESCE(i.eleman_sayisi, 0) AS istihbarat_eleman,
            (SELECT COALESCE(SUM(p.adet * s.fiyat), 0) FROM borsa_portfoy p JOIN borsa_sirketleri s ON s.id = p.sirket_id WHERE p.user_id = u.id) AS borsa_deger
     FROM users u
     JOIN players p ON p.user_id = u.id
     LEFT JOIN banka_hesaplari bh ON bh.user_id = u.id
     LEFT JOIN user_base ub ON ub.user_id = u.id
     LEFT JOIN istihbarat i ON i.user_id = u.id
     WHERE u.username LIKE ? COLLATE NOCASE
        OR u.reis_adi LIKE ? COLLATE NOCASE
        OR CAST(u.id AS TEXT) = ?
     ORDER BY p.puan DESC
     LIMIT ?`,
    [like, like, raw, Math.min(80, cap)]
  );
}

async function adminSirketOzetGetir(db, userId) {
  const sahip = await get(
    db,
    `SELECT id, isim, tur_id, kasa, kapasite_seviye, depo_seviye FROM oyuncu_sirketleri WHERE sahip_user_id = ?`,
    [userId]
  );
  if (!sahip) return null;
  const tur = turBul(sahip.tur_id);
  if (!tur) return null;
  const calisan = await get(
    db,
    `SELECT COUNT(*) AS n FROM sirket_calisanlari WHERE sirket_id = ?`,
    [sahip.id]
  );
  const stok = await get(
    db,
    `SELECT COALESCE(SUM(miktar), 0) AS n FROM sirket_stok WHERE sirket_id = ?`,
    [sahip.id]
  );
  return {
    yonetim: {
      isim: sahip.isim,
      turAd: tur.ad,
      kasa: sahip.kasa || 0,
      calisanSayisi: calisan?.n || 0,
      maxCalisan: maxCalisanHesapla(tur, sahip.kapasite_seviye || 0),
      stokDolu: Math.floor(stok?.n || 0),
      depoKapasite: depoKapasiteHesapla(tur, sahip.depo_seviye || 0),
    },
  };
}

function adminSefirlikOzetOlustur(sehirKontroller, sehirHakimiyetSahip) {
  const sahipSet = new Set(sehirHakimiyetSahip || []);
  const sehirler = [];
  const gordu = new Set();
  for (const s of sehirKontroller || []) {
    const meta = sehirBul(s.sehir_id);
    gordu.add(s.sehir_id);
    sehirler.push({
      id: s.sehir_id,
      ad: meta ? meta.ad : s.sehir_id,
      benimKontrol: s.kontrol,
      benSahibim: sahipSet.has(s.sehir_id),
      liderReis: null,
      tier: meta ? meta.tier : null,
    });
  }
  for (const sid of sahipSet) {
    if (gordu.has(sid)) continue;
    const meta = sehirBul(sid);
    sehirler.push({
      id: sid,
      ad: meta ? meta.ad : sid,
      benimKontrol: 0,
      benSahibim: true,
      liderReis: null,
      tier: meta ? meta.tier : null,
    });
  }
  const toplamKontrol = (sehirKontroller || []).reduce((t, s) => t + (s.kontrol || 0), 0);
  return {
    ozet: { toplamKontrol, sahipSayisi: sahipSet.size },
    sehirler,
  };
}

function settledDbValue(result, fallback, label) {
  if (result.status === "fulfilled") return result.value;
  console.warn(`[admin] ${label} yuklenemedi:`, result.reason?.message || result.reason);
  return fallback;
}

async function collectPlayerExtra(db, userId) {
  try {
    await ensureGunlukGorevTables(db);
  } catch (err) {
    console.warn("[admin] gunluk gorev tablolari:", err.message);
  }

  const settled = await Promise.allSettled([
    get(db, `SELECT * FROM players WHERE user_id = ?`, [userId]),
    get(db, `SELECT * FROM banka_hesaplari WHERE user_id = ?`, [userId]),
    ensureUserBase(db, userId),
    all(
      db,
      `SELECT item_key, adet, fiyat_adet FROM oyuncu_kiralama WHERE user_id = ? AND adet > 0 ORDER BY item_key`,
      [userId]
    ),
    all(
      db,
      `SELECT liman_id, last_income_hour FROM liman_sahiplik WHERE owner_user_id = ? ORDER BY liman_id`,
      [userId]
    ),
    all(
      db,
      `SELECT makam, baba_derki FROM baba_makamlari WHERE owner_user_id = ? ORDER BY makam`,
      [userId]
    ),
    all(db, `SELECT makam, oy FROM sadakat_oylari WHERE user_id = ? ORDER BY makam`, [userId]),
    all(
      db,
      `SELECT id, gun_key, slot, gorev_id, kabul_edildi, durum, ilerleme, odul_alindi, bitis_zamani
       FROM gunluk_gorev_atama WHERE user_id = ? ORDER BY gun_key DESC, slot LIMIT 24`,
      [userId]
    ),
    all(
      db,
      `SELECT b.id, b.grup_id, b.durum, g.isim AS grup_adi
       FROM mafya_basvurulari b
       JOIN mafya_gruplari g ON g.id = b.grup_id
       WHERE b.user_id = ?
       ORDER BY b.id DESC`,
      [userId]
    ),
    all(
      db,
      `SELECT ik.is_id, mi.is_turu, mi.durum, mi.baslangic_zamani, mg.isim AS grup_adi
       FROM mafya_is_katilim ik
       JOIN mafya_isleri mi ON mi.id = ik.is_id
       JOIN mafya_gruplari mg ON mg.id = mi.grup_id
       WHERE ik.user_id = ?
       ORDER BY mi.baslangic_zamani DESC
       LIMIT 20`,
      [userId]
    ),
    all(
      db,
      `SELECT sk.savas_id, sk.grup_id, ms.durum, ms.savas_zamani,
              sg.isim AS saldiran_isim, hg.isim AS hedef_isim
       FROM mafya_savas_katilim sk
       JOIN mafya_savaslar ms ON ms.id = sk.savas_id
       JOIN mafya_gruplari sg ON sg.id = ms.saldiran_grup_id
       JOIN mafya_gruplari hg ON hg.id = ms.hedef_grup_id
       WHERE sk.user_id = ?
       ORDER BY ms.savas_zamani DESC
       LIMIT 20`,
      [userId]
    ),
    all(
      db,
      `SELECT id, haber, created_at, aktif FROM medya_haberleri WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [userId]
    ),
    all(
      db,
      `SELECT tip, delta, created_at FROM stat_hareketleri WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    ),
    all(
      db,
      `SELECT sehir_id, kontrol, son_aksiyon_at FROM sehir_kontrol WHERE user_id = ? AND kontrol > 0 ORDER BY kontrol DESC`,
      [userId]
    ),
    all(
      db,
      `SELECT id, baslangic, bitis, onceki_user_id FROM sehir_hukumranlik WHERE user_id = ? ORDER BY baslangic DESC LIMIT 12`,
      [userId]
    ),
    all(db, `SELECT sehir_id FROM sehir_hakimiyet WHERE sahip_user_id = ? ORDER BY sehir_id`, [userId]),
    get(db, `SELECT COUNT(*) AS n FROM profil_ziyaretleri WHERE target_user_id = ?`, [userId]),
    get(
      db,
      `SELECT
        (SELECT COUNT(*) FROM oyuncu_mesajlari WHERE to_user_id = ?) AS alinan,
        (SELECT COUNT(*) FROM oyuncu_mesajlari WHERE from_user_id = ?) AS gonderilen,
        (SELECT COUNT(*) FROM mafya_sohbet WHERE user_id = ?) AS sohbet,
        (SELECT COUNT(*) FROM mafya_grup_mesajlari WHERE from_user_id = ?) AS grup_mesaj`,
      [userId, userId, userId, userId]
    ),
    all(
      db,
      `SELECT id, hedef_tip, sebep, created_at, raporlayan_user_id
       FROM icerik_raporlari WHERE hedef_user_id = ?
       ORDER BY created_at DESC LIMIT 15`,
      [userId]
    ),
  ]);

  const playerRow = settledDbValue(settled[0], null, "players");
  const bankaRow = settledDbValue(settled[1], null, "banka");
  const userBaseRow = settledDbValue(settled[2], null, "user_base");
  const envanter = settledDbValue(settled[3], [], "envanter");
  const limanlar = settledDbValue(settled[4], [], "limanlar");
  const babaMakamlari = settledDbValue(settled[5], [], "baba_makamlari");
  const sadakatOylari = settledDbValue(settled[6], [], "sadakat_oylari");
  const gunlukGorevRows = settledDbValue(settled[7], [], "gunluk_gorevler");
  const mafyaBasvurulari = settledDbValue(settled[8], [], "mafya_basvurulari");
  const mafyaIsKatilimlari = settledDbValue(settled[9], [], "mafya_isleri");
  const mafyaSavasKatilimlari = settledDbValue(settled[10], [], "mafya_savaslari");
  const medyaHaberleri = settledDbValue(settled[11], [], "medya_haberleri");
  const statHareketleri = settledDbValue(settled[12], [], "stat_hareketleri");
  const sehirKontroller = settledDbValue(settled[13], [], "sehir_kontrol");
  const sehirHukumranliklar = settledDbValue(settled[14], [], "sehir_hukumranlik");
  const sehirHakimiyetSahip = settledDbValue(settled[15], [], "sehir_hakimiyet");
  const profilZiyaret = settledDbValue(settled[16], { n: 0 }, "profil_ziyaretleri");
  const mesajOzet = settledDbValue(settled[17], null, "mesaj_sayilari");
  const icerikRaporlari = settledDbValue(settled[18], [], "icerik_raporlari");

  let sirketPanel = null;
  let sefirlikOzet = null;
  try {
    sirketPanel = await adminSirketOzetGetir(db, userId);
  } catch (err) {
    console.warn("[admin] sirket ozeti:", err.message);
  }
  try {
    sefirlikOzet = adminSefirlikOzetOlustur(sehirKontroller, sehirHakimiyetSahip);
  } catch (err) {
    console.warn("[admin] sefirlik ozeti:", err.message);
  }

  return {
    playerRow,
    banka: bankaRow,
    userBase: userBaseRow,
    guvenliYerFull: userBaseRow ? baseOzeti(userBaseRow) : null,
    profil: playerRow
      ? {
          aciklama: playerRow.profil_aciklama || "",
          resim: playerRow.profil_resmi || "",
          dostlar: playerRow.dostlar || "",
          dusmanlar: playerRow.dusmanlar || "",
        }
      : null,
    ekonomi: playerRow
      ? {
          bonusGuc: playerRow.bonus_guc || 0,
          devletIliskisi: playerRow.devlet_iliskisi,
          limanIstanbul: playerRow.liman_istanbul || 0,
          lastIcraatAt: fmtTs(playerRow.last_icraat_at),
          lastUcBonusHour: playerRow.last_uc_bonus_hour,
          lastSmsDay: playerRow.last_sms_day,
          yetenekMaasAntrenmanPuani: playerRow.yetenek_maas_antrenman_puani || 0,
        }
      : null,
    sehirMeta: playerRow
      ? {
          sehreHukmetSayisi: playerRow.sehre_hukmet_sayisi || 0,
          sehirEfsane: !!playerRow.sehir_efsane,
          aktifHukumranlikId: playerRow.aktif_hukumranlik_id,
        }
      : null,
    envanter,
    limanlar,
    babaMakamlari,
    sadakatOylari,
    gunlukGorevler: (gunlukGorevRows || []).map((g) => ({
      id: g.id,
      gunKey: g.gun_key,
      slot: g.slot,
      gorevId: g.gorev_id,
      kabulEdildi: !!g.kabul_edildi,
      durum: g.durum,
      ilerleme: g.ilerleme,
      odulAlindi: !!g.odul_alindi,
      bitisZamani: g.bitis_zamani ? fmtTs(g.bitis_zamani) : null,
    })),
    mafyaBasvurulari: (mafyaBasvurulari || []).map((b) => ({
      id: b.id,
      grupId: b.grup_id,
      grupAdi: b.grup_adi,
      durum: b.durum,
    })),
    mafyaIsleri: (mafyaIsKatilimlari || []).map((i) => ({
      isId: i.is_id,
      isTuru: i.is_turu,
      durum: i.durum,
      grupAdi: i.grup_adi,
      baslangic: fmtTs(i.baslangic_zamani),
    })),
    mafyaSavaslari: (mafyaSavasKatilimlari || []).map((s) => ({
      savasId: s.savas_id,
      grupId: s.grup_id,
      durum: s.durum,
      saldiran: s.saldiran_isim,
      hedef: s.hedef_isim,
      savasZamani: fmtTs(s.savas_zamani),
    })),
    medyaHaberleri: (medyaHaberleri || []).map((h) => ({
      id: h.id,
      haber: h.haber,
      aktif: !!h.aktif,
      at: fmtTs(h.created_at),
    })),
    statHareketleri: (statHareketleri || []).map((s) => ({
      tip: s.tip,
      delta: s.delta,
      at: fmtTs(s.created_at),
    })),
    sehirKontroller: (sehirKontroller || []).map((s) => ({
      sehirId: s.sehir_id,
      kontrol: s.kontrol,
      sonAksiyon: fmtTs(s.son_aksiyon_at),
    })),
    sehirHukumranliklar: (sehirHukumranliklar || []).map((h) => ({
      id: h.id,
      baslangic: fmtTs(h.baslangic),
      bitis: h.bitis ? fmtTs(h.bitis) : null,
      oncekiUserId: h.onceki_user_id,
    })),
    sehirHakimiyetSahip: (sehirHakimiyetSahip || []).map((s) => s.sehir_id),
    profilZiyaretSayisi: profilZiyaret?.n || 0,
    mesajSayilari: mesajOzet || { alinan: 0, gonderilen: 0, sohbet: 0, grup_mesaj: 0 },
    icerikRaporlari: (icerikRaporlari || []).map((r) => ({
      id: r.id,
      tip: r.hedef_tip,
      sebep: r.sebep,
      raporlayanUserId: r.raporlayan_user_id,
      at: fmtTs(r.created_at),
    })),
    sirketPanel,
    sefirlikOzet,
  };
}

function mapPlayerExportSnapshot(detail, extra) {
  const u = { ...detail.user };
  delete u.password_hash;
  return {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    oyuncuId: u.id,
    kullanici: {
      id: u.id,
      username: u.username,
      reisAdi: u.reis_adi,
      lakap: u.lakap,
      grup: u.grup,
      banned: !!u.banned,
      isAdmin: !!u.is_admin,
      visitorId: u.visitor_id,
      sonIp: u.son_ip,
      userAgent: u.user_agent,
      tokenVersion: u.token_version,
      createdAt: fmtTs(u.created_at),
      lastLoginAt: fmtTs(u.last_login_at),
    },
    istatistikler: mapPlayerRow(u),
    mekanlar: detail.mekanlar,
    mekanToplam: detail.mekanToplam,
    guvenliYer: detail.guvenliYer,
    guvenliYerFull: extra.guvenliYerFull,
    userBase: extra.userBase,
    banka: extra.banka,
    yetenekler: detail.yetenekler,
    aktifMeslek: detail.aktifMeslek,
    sirketCalisan: detail.sirketCalisan,
    sahipSirket: detail.sahipSirket,
    sirketPanel: extra.sirketPanel,
    mafyaUyelik: detail.uyelik
      ? {
          grupId: detail.uyelik.grup_id,
          isim: detail.uyelik.isim,
          rutbe: detail.uyelik.rutbe,
        }
      : null,
    mafyaBasvurulari: extra.mafyaBasvurulari,
    mafyaIsleri: extra.mafyaIsleri,
    mafyaSavaslari: extra.mafyaSavaslari,
    profil: extra.profil,
    ekonomi: extra.ekonomi,
    sehirMeta: extra.sehirMeta,
    sefirlikOzet: extra.sefirlikOzet,
    sehirKontroller: extra.sehirKontroller,
    sehirHukimiyetSahip: extra.sehirHakimiyetSahip,
    sehirHukumranliklar: extra.sehirHukumranliklar,
    envanter: extra.envanter,
    limanlar: extra.limanlar,
    babaMakamlari: extra.babaMakamlari,
    sadakatOylari: extra.sadakatOylari,
    gunlukGorevler: extra.gunlukGorevler,
    medyaHaberleri: extra.medyaHaberleri,
    statHareketleri: extra.statHareketleri,
    mesajSayilari: extra.mesajSayilari,
    profilZiyaretSayisi: extra.profilZiyaretSayisi,
    icerikRaporlari: extra.icerikRaporlari,
    istihbaratEleman: detail.istihbaratEleman,
    borsa: detail.borsa || null,
    aktiviteLog: detail.aktiviteLog,
    fingerprints: detail.fingerprints,
    securityEvents: detail.events,
  };
}

async function exportPlayerSnapshot(db, userId) {
  const detail = await getPlayerDetail(db, userId);
  if (!detail) return null;
  return mapPlayerExportSnapshot(detail, detail.extra || {});
}

async function exportAllPlayers(db, q = "", limit = 500) {
  const rows = await searchPlayers(db, q, limit);
  const oyuncular = [];
  for (const row of rows) {
    const snap = await exportPlayerSnapshot(db, row.id);
    if (snap) oyuncular.push(snap);
  }
  return {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    filtre: String(q || "").trim() || null,
    oyuncuSayisi: oyuncular.length,
    oyuncular,
  };
}

async function getPlayerDetail(db, userId) {
  const user = await get(
    db,
    `SELECT u.*, p.kasa, p.guc, p.puan, p.icraat, p.last_seen_at, p.kara_listede, p.sms_hakki,
            p.bonus_guc, p.devlet_iliskisi, p.profil_aciklama, p.profil_resmi, p.dostlar, p.dusmanlar,
            p.sehre_hukmet_sayisi, p.sehir_efsane, p.liman_istanbul, p.elmas, p.premium_paket,
            p.aktif_ekran, p.son_aksiyon, p.son_aksiyon_detay, p.son_aksiyon_at,
            COALESCE(bh.yatirilan_miktar, 0) AS banka_bakiye,
            COALESCE(bh.banka_hakki, 20) AS banka_hakki,
            COALESCE(bh.faiz_bekleyen, 0) AS faiz_bekleyen
     FROM users u
     JOIN players p ON p.user_id = u.id
     LEFT JOIN banka_hesaplari bh ON bh.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );
  if (!user) return null;

  const fingerprints = await all(
    db,
    `SELECT visitor_id, son_ip, user_agent, first_seen, last_seen
     FROM user_fingerprints WHERE user_id = ?
     ORDER BY last_seen DESC LIMIT 20`,
    [userId]
  );

  const events = await all(
    db,
    `SELECT event_type, detail, ip, created_at
     FROM security_events WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 30`,
    [userId]
  );

  const uyelik = await get(
    db,
    `SELECT mg.isim, mg.id AS grup_id, mu.rutbe
     FROM mafya_uyeleri mu
     JOIN mafya_gruplari mg ON mg.id = mu.grup_id
     WHERE mu.user_id = ?`,
    [userId]
  );

  let aktiviteLog = [];
  try {
    aktiviteLog = await listOyuncuAktiviteLog(db, userId, 40);
  } catch (err) {
    console.warn("[admin] aktivite log", userId, err.message);
  }
  const mekan = await getPlayerMekanlar(db, userId);
  let baseRow = null;
  try {
    baseRow = await ensureUserBase(db, userId);
  } catch (err) {
    console.warn("[admin] user_base", userId, err.message);
  }
  const guvenliYer = baseRow ? baseOzeti(baseRow) : { baseSeviye: 1, ad: "", gucBonus: 0 };
  let istihbaratEleman = 0;
  try {
    const istihbaratRow = await get(db, `SELECT eleman_sayisi FROM istihbarat WHERE user_id = ?`, [userId]);
    istihbaratEleman = istihbaratRow ? istihbaratRow.eleman_sayisi || 0 : 0;
  } catch (err) {
    console.warn("[admin] istihbarat", userId, err.message);
  }
  let yetenekler = null;
  let aktifMeslek = null;
  try {
    yetenekler = await yetenekleriGetir(db, userId);
  } catch (err) {
    console.warn("[admin] yetenekler", userId, err.message);
  }
  try {
    aktifMeslek = await meslekGetir(db, userId);
  } catch (err) {
    console.warn("[admin] meslek", userId, err.message);
  }
  const sirketCalisan = await get(
    db,
    `SELECT c.gunluk_maas, c.pozisyon_id, s.isim AS sirket_adi, s.tur_id
     FROM sirket_calisanlari c
     JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
     WHERE c.user_id = ?`,
    [userId]
  );
  const sahipSirket = await get(
    db,
    `SELECT id, isim, tur_id, kasa, ise_alim_acik, kapasite_seviye, depo_seviye FROM oyuncu_sirketleri WHERE sahip_user_id = ?`,
    [userId]
  );

  let extra = {};
  try {
    extra = await collectPlayerExtra(db, userId);
  } catch (err) {
    console.error("[admin] collectPlayerExtra", userId, err);
    extra = { loadError: err.message || "Ek veri yuklenemedi." };
  }
  const { oyuncuBorsaGetir } = require("./borsaService");
  const borsa = await oyuncuBorsaGetir(db, userId).catch((err) => {
    console.warn("[admin] borsa", userId, err.message);
    return null;
  });

  return {
    user,
    fingerprints,
    events,
    uyelik,
    aktiviteLog,
    mekanlar: mekan.mekanlar,
    mekanToplam: mekan.toplam,
    guvenliYer,
    istihbaratEleman,
    yetenekler,
    aktifMeslek,
    sirketCalisan,
    sahipSirket,
    extra,
    borsa,
  };
}

async function invalidateSessions(db, userId) {
  await run(db, `UPDATE users SET token_version = token_version + 1 WHERE id = ?`, [userId]);
}

async function banPlayer(db, adminId, userId, reason = "") {
  if (userId === adminId) return { ok: false, error: "Kendini banlayamazsın." };
  const target = await get(db, `SELECT is_admin, banned FROM users WHERE id = ?`, [userId]);
  if (!target) return { ok: false, error: "Oyuncu bulunamadı." };
  if (target.is_admin) return { ok: false, error: "Yönetici hesabı banlanamaz." };

  await run(db, `UPDATE users SET banned = 1 WHERE id = ?`, [userId]);
  await invalidateSessions(db, userId);
  await logSecurityEvent(db, userId, "admin_ban", { adminId, reason });
  return { ok: true, mesaj: "Oyuncu banlandı ve oturumu sonlandırıldı." };
}

async function unbanPlayer(db, adminId, userId) {
  await run(db, `UPDATE users SET banned = 0, failed_login_count = 0 WHERE id = ?`, [userId]);
  await logSecurityEvent(db, userId, "admin_unban", { adminId });
  return { ok: true, mesaj: "Ban kaldırıldı." };
}

async function kickPlayer(db, adminId, userId) {
  if (userId === adminId) return { ok: false, error: "Kendinin oturumunu sonlandıramazsın." };
  const target = await get(db, `SELECT is_admin FROM users WHERE id = ?`, [userId]);
  if (!target) return { ok: false, error: "Oyuncu bulunamadı." };
  if (target.is_admin) return { ok: false, error: "Yönetici oturumu sonlandırılamaz." };
  await invalidateSessions(db, userId);
  await logSecurityEvent(db, userId, "admin_kick", { adminId });
  return { ok: true, mesaj: "Aktif oturum sonlandırıldı." };
}

async function updatePlayerMekanlar(db, adminId, userId, items) {
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, error: "Güncellenecek mekan yok." };
  }
  const player = await get(db, `SELECT user_id FROM players WHERE user_id = ?`, [userId]);
  if (!player) return { ok: false, error: "Oyuncu bulunamadı." };

  const sablon = listMekanSablonu();
  const gecerli = new Set(sablon.map((m) => `${m.sektor}:${m.mekanKey}`));
  const patch = [];

  for (const item of items) {
    const sektor = String(item.sektor || "").trim();
    const mekanKey = String(item.mekanKey || item.mekan_key || "").trim();
    const key = `${sektor}:${mekanKey}`;
    if (!gecerli.has(key)) return { ok: false, error: `Geçersiz mekan: ${key}` };
    const adet = parseInt(item.adet, 10);
    if (Number.isNaN(adet) || adet < 0) return { ok: false, error: `${mekanKey} adedi geçersiz.` };
    patch.push({ sektor, mekanKey, adet });
  }

  for (const { sektor, mekanKey, adet } of patch) {
    if (adet === 0) {
      await run(
        db,
        `DELETE FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
        [userId, sektor, mekanKey]
      );
    } else {
      const row = await get(
        db,
        `SELECT adet FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
        [userId, sektor, mekanKey]
      );
      if (row) {
        await run(
          db,
          `UPDATE sektor_sahiplik SET adet = ? WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
          [adet, userId, sektor, mekanKey]
        );
      } else {
        await run(
          db,
          `INSERT INTO sektor_sahiplik (user_id, sektor, mekan_key, adet, last_income_hour)
           VALUES (?, ?, ?, ?, NULL)`,
          [userId, sektor, mekanKey, adet]
        );
      }
    }
  }

  await logSecurityEvent(db, userId, "admin_mekan_edit", { adminId, patch });
  return { ok: true, mesaj: "Mekan adetleri güncellendi." };
}

async function updatePlayerGuvenliYer(db, adminId, userId, baseSeviye) {
  const player = await get(db, `SELECT user_id FROM players WHERE user_id = ?`, [userId]);
  if (!player) return { ok: false, error: "Oyuncu bulunamadı." };
  const s = parseInt(baseSeviye, 10);
  if (Number.isNaN(s) || s < 1 || s > MAX_SEVIYE) {
    return { ok: false, error: `Güvenli Yer seviyesi 1-${MAX_SEVIYE} arasında olmalı.` };
  }
  const sonuc = await adminSeviyeAyarla(db, userId, s);
  await logSecurityEvent(db, userId, "admin_guvenli_yer", { adminId, baseSeviye: s });
  return { ok: true, mesaj: `Güvenli Yer seviye ${s} olarak ayarlandı.`, guvenliYer: sonuc.base };
}

async function updatePlayerIstihbarat(db, adminId, userId, elemanSayisi) {
  const player = await get(db, `SELECT user_id FROM players WHERE user_id = ?`, [userId]);
  if (!player) return { ok: false, error: "Oyuncu bulunamadı." };
  const n = parseInt(elemanSayisi, 10);
  if (Number.isNaN(n) || n < 0 || n > 100000) {
    return { ok: false, error: "İstihbarat eleman sayısı 0-100000 arasında olmalı." };
  }
  await run(db, `INSERT OR REPLACE INTO istihbarat (user_id, eleman_sayisi) VALUES (?, ?)`, [userId, n]);
  await logSecurityEvent(db, userId, "admin_istihbarat", { adminId, elemanSayisi: n });
  return { ok: true, mesaj: `İstihbarat eleman sayısı ${n} olarak ayarlandı.`, istihbaratEleman: n };
}

async function listMafyaGruplari(db, q, limit = 100) {
  const raw = String(q || "").trim();
  const cap = Math.min(200, Math.max(1, limit));
  const base = `
    SELECT g.id, g.isim, g.aciklama, g.created_at, g.lider_user_id,
           ul.reis_adi AS lider_reis, ul.username AS lider_username,
           (SELECT COUNT(*) FROM mafya_uyeleri mu WHERE mu.grup_id = g.id) AS uye_sayisi,
           (SELECT COUNT(*) FROM mafya_basvurulari mb WHERE mb.grup_id = g.id AND mb.durum = 'beklemede') AS bekleyen_basvuru,
           COALESCE(me.seviye, 1) AS ev_seviye,
           COALESCE(me.birikmis_para, 0) AS ev_birikim,
           (SELECT COUNT(*) FROM mafya_savaslar ms
            WHERE ms.durum IN ('bekliyor', 'aktif')
              AND (ms.saldiran_grup_id = g.id OR ms.hedef_grup_id = g.id)) AS aktif_savas
    FROM mafya_gruplari g
    JOIN users ul ON ul.id = g.lider_user_id
    LEFT JOIN mafya_evi me ON me.grup_id = g.id`;

  if (!raw) {
    return all(db, `${base} ORDER BY uye_sayisi DESC, g.isim LIMIT ?`, [cap]);
  }
  const like = `%${raw}%`;
  return all(
    db,
    `${base}
     WHERE g.isim LIKE ? COLLATE NOCASE
        OR g.aciklama LIKE ? COLLATE NOCASE
        OR ul.reis_adi LIKE ? COLLATE NOCASE
        OR CAST(g.id AS TEXT) = ?
     ORDER BY g.isim
     LIMIT ?`,
    [like, like, like, raw, cap]
  );
}

async function getMafyaGrupDetail(db, grupId) {
  const grup = await get(
    db,
    `SELECT g.id, g.isim, g.aciklama, g.created_at, g.lider_user_id,
            ul.reis_adi AS lider_reis, ul.username AS lider_username
     FROM mafya_gruplari g
     JOIN users ul ON ul.id = g.lider_user_id
     WHERE g.id = ?`,
    [grupId]
  );
  if (!grup) return null;

  const uyeler = await all(
    db,
    `SELECT m.user_id, m.rutbe, u.reis_adi, u.username, p.puan, p.guc, p.last_seen_at,
            COALESCE(i.eleman_sayisi, 0) AS istihbarat_eleman
     FROM mafya_uyeleri m
     JOIN users u ON u.id = m.user_id
     JOIN players p ON p.user_id = m.user_id
     LEFT JOIN istihbarat i ON i.user_id = m.user_id
     WHERE m.grup_id = ?
     ORDER BY p.puan DESC`,
    [grupId]
  );

  const basvurular = await all(
    db,
    `SELECT b.id, b.user_id, u.reis_adi, u.username, b.durum
     FROM mafya_basvurulari b
     JOIN users u ON u.id = b.user_id
     WHERE b.grup_id = ? AND b.durum = 'beklemede'
     ORDER BY b.id DESC`,
    [grupId]
  );

  const evi = await get(db, `SELECT seviye, birikmis_para FROM mafya_evi WHERE grup_id = ?`, [grupId]);

  const savaslar = await all(
    db,
    `SELECT ms.id, ms.durum, ms.baslangic_zamani, ms.savas_zamani, ms.kazanan_grup_id,
            sg.isim AS saldiran_isim, hg.isim AS hedef_isim,
            ms.saldiran_grup_id, ms.hedef_grup_id
     FROM mafya_savaslar ms
     JOIN mafya_gruplari sg ON sg.id = ms.saldiran_grup_id
     JOIN mafya_gruplari hg ON hg.id = ms.hedef_grup_id
     WHERE ms.saldiran_grup_id = ? OR ms.hedef_grup_id = ?
     ORDER BY ms.baslangic_zamani DESC
     LIMIT 15`,
    [grupId, grupId]
  );

  return { grup, uyeler, basvurular, evi, savaslar };
}

function mapMafyaGrupRow(r) {
  return {
    id: r.id,
    isim: r.isim,
    aciklama: r.aciklama,
    liderUserId: r.lider_user_id,
    liderReis: r.lider_reis,
    liderUsername: r.lider_username,
    uyeSayisi: r.uye_sayisi || 0,
    bekleyenBasvuru: r.bekleyen_basvuru || 0,
    evSeviye: r.ev_seviye || 1,
    evBirikim: r.ev_birikim || 0,
    aktifSavas: r.aktif_savas || 0,
    createdAt: fmtTs(r.created_at),
  };
}

function mapMafyaGrupDetail(detail) {
  const g = detail.grup;
  const evi = detail.evi || { seviye: 1, birikmis_para: 0 };
  return {
    grup: {
      id: g.id,
      isim: g.isim,
      aciklama: g.aciklama,
      liderUserId: g.lider_user_id,
      liderReis: g.lider_reis,
      liderUsername: g.lider_username,
      createdAt: fmtTs(g.created_at),
    },
    evi: {
      seviye: evi.seviye || 1,
      birikmisPara: evi.birikmis_para || 0,
    },
    uyeler: detail.uyeler.map((u) => ({
      userId: u.user_id,
      reisAdi: u.reis_adi,
      username: u.username,
      rutbe: u.rutbe,
      puan: u.puan,
      guc: u.guc,
      istihbaratEleman: u.istihbarat_eleman || 0,
      lastSeen: fmtTs(u.last_seen_at),
    })),
    basvurular: detail.basvurular.map((b) => ({
      id: b.id,
      userId: b.user_id,
      reisAdi: b.reis_adi,
      username: b.username,
      durum: b.durum,
    })),
    savaslar: detail.savaslar.map((s) => ({
      id: s.id,
      durum: s.durum,
      saldiranGrupId: s.saldiran_grup_id,
      hedefGrupId: s.hedef_grup_id,
      saldiranIsim: s.saldiran_isim,
      hedefIsim: s.hedef_isim,
      kazananGrupId: s.kazanan_grup_id,
      baslangic: fmtTs(s.baslangic_zamani),
      savasZamani: fmtTs(s.savas_zamani),
    })),
  };
}

async function updatePlayerStats(db, adminId, userId, patch) {
  return updatePlayerFull(db, adminId, userId, { oyuncu: patch });
}

function parseNonNegInt(val, label, max = 2_000_000_000) {
  if (val === undefined || val === null || val === "") return null;
  const n = parseInt(val, 10);
  if (Number.isNaN(n) || n < 0 || n > max) {
    throw new Error(`${label} geçersiz (0–${max}).`);
  }
  return n;
}

function parseBool01(val) {
  if (val === undefined || val === null || val === "") return null;
  if (val === true || val === 1 || val === "1" || val === "true") return 1;
  if (val === false || val === 0 || val === "0" || val === "false") return 0;
  throw new Error("Geçersiz boolean değer.");
}

async function ensureBankaRowAdmin(db, userId) {
  let row = await get(db, `SELECT user_id FROM banka_hesaplari WHERE user_id = ?`, [userId]);
  if (row) return;
  const now = Math.floor(Date.now() / 1000);
  await run(
    db,
    `INSERT INTO banka_hesaplari (user_id, yatirilan_miktar, banka_hakki, last_banka_hak_at)
     VALUES (?, 0, 20, ?)`,
    [userId, now]
  );
}

async function adminUpdateBanka(db, userId, patch) {
  if (!patch || typeof patch !== "object") return;
  await ensureBankaRowAdmin(db, userId);
  const fields = [];
  const params = [];
  const yatirilan = parseNonNegInt(patch.yatirilanMiktar, "Banka yatırımı");
  const hak = parseNonNegInt(patch.bankaHakki, "Banka hakkı", 9999);
  const faiz = parseNonNegInt(patch.faizBekleyen, "Faiz bekleyen");
  if (yatirilan != null) {
    fields.push("yatirilan_miktar = ?");
    params.push(yatirilan);
  }
  if (hak != null) {
    fields.push("banka_hakki = ?");
    params.push(hak);
  }
  if (faiz != null) {
    fields.push("faiz_bekleyen = ?");
    params.push(faiz);
  }
  if (!fields.length) return;
  params.push(userId);
  await run(db, `UPDATE banka_hesaplari SET ${fields.join(", ")} WHERE user_id = ?`, params);
}

async function adminUpdateGuvenliYerModuller(db, userId, patch) {
  if (!patch || typeof patch !== "object") return false;
  await ensureUserBase(db, userId);
  const map = {
    baseSeviye: { col: "base_seviye", max: MAX_SEVIYE },
    buildingLvl: { col: "building_lvl", max: 99 },
    wallLvl: { col: "wall_lvl", max: 99 },
    gardenLvl: { col: "garden_lvl", max: 99 },
    energyWall: { col: "energy_wall", max: 99 },
    undergroundLvl: { col: "underground_lvl", max: 99 },
    secretOrders: { col: "secret_orders", max: 99 },
    hasTower: { col: "has_tower", bool: true },
    helipad: { col: "helipad", bool: true },
    bunkerLvl: { col: "bunker_lvl", max: 99 },
    bunkerEntrance: { col: "bunker_entrance", bool: true },
    kasaGumus: { col: "kasa_gumus", bool: true },
    kasaAltin: { col: "kasa_altin", bool: true },
  };
  const fields = [];
  const params = [];
  for (const [key, spec] of Object.entries(map)) {
    if (patch[key] === undefined) continue;
    if (spec.bool) {
      fields.push(`${spec.col} = ?`);
      params.push(parseBool01(patch[key]));
    } else {
      const n = parseNonNegInt(patch[key], key, spec.max);
      if (n != null) {
        fields.push(`${spec.col} = ?`);
        params.push(n);
      }
    }
  }
  if (!fields.length) return false;
  fields.push("updated_at = strftime('%s','now')");
  params.push(userId);
  await run(db, `UPDATE user_base SET ${fields.join(", ")} WHERE user_id = ?`, params);
  return true;
}

async function adminUpdateEnvanter(db, userId, items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const key = String(item.itemKey || item.item_key || "").trim();
    if (!key) continue;
    if (!HIRE[key]) throw new Error(`Geçersiz envanter anahtarı: ${key}`);
    const adet = parseNonNegInt(item.adet, key, 1_000_000);
    if (adet == null) continue;
    if (adet === 0) {
      await run(db, `DELETE FROM oyuncu_kiralama WHERE user_id = ? AND item_key = ?`, [userId, key]);
    } else {
      await run(
        db,
        `INSERT INTO oyuncu_kiralama (user_id, item_key, adet, fiyat_adet) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, item_key) DO UPDATE SET adet = excluded.adet, fiyat_adet = excluded.fiyat_adet`,
        [userId, key, adet, adet]
      );
    }
  }
}

async function updatePlayerFull(db, adminId, userId, body) {
  if (adminId === userId && body?.kullanici?.isAdmin === 0) {
    return { ok: false, error: "Kendi yönetici yetkini kaldıramazsın." };
  }

  const user = await get(db, `SELECT id, is_admin FROM users WHERE id = ?`, [userId]);
  const player = await get(db, `SELECT user_id FROM players WHERE user_id = ?`, [userId]);
  if (!user || !player) return { ok: false, error: "Oyuncu bulunamadı." };

  const patch = body || {};
  const guncellenen = [];

  try {
    if (patch.kullanici && typeof patch.kullanici === "object") {
      const k = patch.kullanici;
      const uFields = [];
      const uParams = [];
      if (k.reisAdi !== undefined) {
        const name = String(k.reisAdi).trim().slice(0, 24);
        if (!name) return { ok: false, error: "Reis adı boş olamaz." };
        uFields.push("reis_adi = ?");
        uParams.push(name);
      }
      if (k.lakap !== undefined) {
        uFields.push("lakap = ?");
        uParams.push(String(k.lakap).trim().slice(0, 32));
      }
      if (k.grup !== undefined) {
        uFields.push("grup = ?");
        uParams.push(String(k.grup).trim().slice(0, 48));
      }
      if (k.kayitUlkesi !== undefined) {
        uFields.push("kayit_ulkesi = ?");
        uParams.push(String(k.kayitUlkesi).trim().slice(0, 16));
      }
      if (k.oyunDili !== undefined) {
        uFields.push("oyun_dili = ?");
        uParams.push(String(k.oyunDili).trim().slice(0, 16));
      }
      if (k.isAdmin !== undefined && adminId !== userId) {
        uFields.push("is_admin = ?");
        uParams.push(parseBool01(k.isAdmin));
      }
      if (uFields.length) {
        uParams.push(userId);
        await run(db, `UPDATE users SET ${uFields.join(", ")} WHERE id = ?`, uParams);
        guncellenen.push("kullanici");
      }
    }

    if (patch.oyuncu && typeof patch.oyuncu === "object") {
      const o = patch.oyuncu;
      const pFields = [];
      const pParams = [];
      const numMap = [
        ["kasa", o.kasa],
        ["guc", o.guc],
        ["puan", o.puan],
        ["icraat", o.icraat],
        ["sms_hakki", o.smsHakki],
        ["elmas", o.elmas],
        ["premium_paket", o.premiumPaket],
        ["bonus_guc", o.bonusGuc],
        ["devlet_iliskisi", o.devletIliskisi],
        ["sehre_hukmet_sayisi", o.sehreHukmetSayisi],
        ["liman_istanbul", o.limanIstanbul],
      ];
      for (const [col, val] of numMap) {
        if (val === undefined || val === null || val === "") continue;
        const max = col === "devlet_iliskisi" ? AVUKAT_ILISKI_MAX : 2_000_000_000;
        const n = parseNonNegInt(val, col, max);
        if (n != null) {
          const finalVal = col === "devlet_iliskisi" ? clampAvukatIliskisi(n) : n;
          pFields.push(`${col} = ?`);
          pParams.push(finalVal);
        }
      }
      const boolMap = [
        ["kara_listede", o.karaListede],
        ["sehir_efsane", o.sehirEfsane],
      ];
      for (const [col, val] of boolMap) {
        if (val === undefined) continue;
        pFields.push(`${col} = ?`);
        pParams.push(parseBool01(val));
      }
      if (o.profilAciklama !== undefined) {
        pFields.push("profil_aciklama = ?");
        pParams.push(String(o.profilAciklama).slice(0, 12000));
      }
      if (o.profilResmi !== undefined) {
        const raw = String(o.profilResmi).trim();
        if (raw === "") {
          pFields.push("profil_resmi = ?");
          pParams.push("");
        } else {
          const portre = gecerliProfilResmi(raw);
          if (!portre) return { ok: false, error: "Geçersiz profil resmi anahtarı." };
          pFields.push("profil_resmi = ?");
          pParams.push(portre);
        }
      }
      if (o.dostlar !== undefined) {
        pFields.push("dostlar = ?");
        pParams.push(String(o.dostlar).trim().slice(0, 24));
      }
      if (o.dusmanlar !== undefined) {
        pFields.push("dusmanlar = ?");
        pParams.push(String(o.dusmanlar).trim().slice(0, 24));
      }
      if (o.premiumPaket !== undefined) {
        const rawPaket = String(o.premiumPaket).trim();
        if (rawPaket && !paketTanim(rawPaket)) {
          return { ok: false, error: "Geçersiz premium paket." };
        }
        pFields.push("premium_paket = ?");
        pParams.push(rawPaket);
      }
      if (pFields.length) {
        pParams.push(userId);
        await run(db, `UPDATE players SET ${pFields.join(", ")} WHERE user_id = ?`, pParams);
        guncellenen.push("oyuncu");
      }
    }

    if (patch.yetenekler && typeof patch.yetenekler === "object") {
      await yetenekleriKaydet(db, userId, patch.yetenekler);
      guncellenen.push("yetenekler");
    }

    if (patch.banka) {
      await adminUpdateBanka(db, userId, patch.banka);
      guncellenen.push("banka");
    }

    if (patch.guvenliYer && typeof patch.guvenliYer === "object") {
      const gy = patch.guvenliYer;
      const onlyBase =
        gy.baseSeviye !== undefined &&
        Object.keys(gy).length === 1;
      if (onlyBase) {
        await updatePlayerGuvenliYer(db, adminId, userId, gy.baseSeviye);
      } else {
        const gyChanged = await adminUpdateGuvenliYerModuller(db, userId, gy);
        if (gyChanged) await syncBonusGuc(db, userId);
      }
      guncellenen.push("guvenliYer");
    }

    if (patch.istihbarat && patch.istihbarat.elemanSayisi !== undefined) {
      await updatePlayerIstihbarat(db, adminId, userId, patch.istihbarat.elemanSayisi);
      guncellenen.push("istihbarat");
    }

    if (patch.mekanlar) {
      const mekanSonuc = await updatePlayerMekanlar(db, adminId, userId, patch.mekanlar);
      if (!mekanSonuc.ok) return mekanSonuc;
      guncellenen.push("mekanlar");
    }

    if (patch.envanter) {
      await adminUpdateEnvanter(db, userId, patch.envanter);
      guncellenen.push("envanter");
    }
  } catch (err) {
    return { ok: false, error: err.message || "Güncelleme başarısız." };
  }

  if (!guncellenen.length) return { ok: false, error: "Güncellenecek alan yok." };

  await logSecurityEvent(db, userId, "admin_player_full_edit", {
    adminId,
    bolumler: guncellenen,
  });

  return {
    ok: true,
    mesaj: "Oyuncu verileri güncellendi.",
    guncellenen,
  };
}

async function getMultiAccountClusters(db) {
  const byVisitor = await all(
    db,
    `SELECT f.visitor_id AS anahtar, 'visitor' AS tip,
            COUNT(DISTINCT f.user_id) AS hesap_sayisi,
            GROUP_CONCAT(DISTINCT u.reis_adi) AS isimler,
            GROUP_CONCAT(DISTINCT f.user_id) AS user_ids,
            MAX(f.last_seen) AS son_gorulme
     FROM user_fingerprints f
     JOIN users u ON u.id = f.user_id
     WHERE f.visitor_id != ''
     GROUP BY f.visitor_id
     HAVING hesap_sayisi > 1
     ORDER BY hesap_sayisi DESC, son_gorulme DESC
     LIMIT 60`
  );

  const byIp = await all(
    db,
    `SELECT f.son_ip AS anahtar, 'ip' AS tip,
            COUNT(DISTINCT f.user_id) AS hesap_sayisi,
            GROUP_CONCAT(DISTINCT u.reis_adi) AS isimler,
            GROUP_CONCAT(DISTINCT f.user_id) AS user_ids,
            MAX(f.last_seen) AS son_gorulme
     FROM user_fingerprints f
     JOIN users u ON u.id = f.user_id
     WHERE f.son_ip != ''
       AND f.son_ip NOT IN ('127.0.0.1', '::1', '0.0.0.0')
     GROUP BY f.son_ip
     HAVING hesap_sayisi > 1
     ORDER BY hesap_sayisi DESC, son_gorulme DESC
     LIMIT 60`
  );

  const linkedPairs = await all(
    db,
    `SELECT se.id, se.detail, se.created_at, se.ip,
            u.reis_adi AS oyuncu
     FROM security_events se
     LEFT JOIN users u ON u.id = se.user_id
     WHERE se.event_type = 'alt_account_block'
     ORDER BY se.created_at DESC
     LIMIT 40`
  );

  return { byVisitor, byIp, linkedPairs };
}

async function listInboxMessages(db, { q = "", limit = 60 } = {}) {
  const raw = String(q || "").trim();
  const params = [];
  let where = "1=1";
  if (raw) {
    where += ` AND (m.icerik LIKE ? COLLATE NOCASE OR m.konu LIKE ? COLLATE NOCASE
      OR fu.reis_adi LIKE ? COLLATE NOCASE OR tu.reis_adi LIKE ? COLLATE NOCASE)`;
    const like = `%${raw}%`;
    params.push(like, like, like, like);
  }
  params.push(Math.min(100, Math.max(1, limit)));
  return all(
    db,
    `SELECT m.id, m.tip, m.konu, m.icerik, m.okundu, m.created_at, m.grup_id, m.grup_mesaj_id,
            fu.reis_adi AS gonderen, fu.id AS gonderen_id,
            tu.reis_adi AS alici, tu.id AS alici_id
     FROM oyuncu_mesajlari m
     LEFT JOIN users fu ON fu.id = m.from_user_id
     JOIN users tu ON tu.id = m.to_user_id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT ?`,
    params
  );
}

async function listMafyaSohbet(db, limit = 60) {
  return all(
    db,
    `SELECT s.id, s.mesaj, s.created_at, u.id AS user_id, u.reis_adi
     FROM mafya_sohbet s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [Math.min(100, limit)]
  );
}

async function listGrupMesajlari(db, limit = 60) {
  return all(
    db,
    `SELECT g.id, g.icerik, g.created_at, g.grup_id,
            u.id AS user_id, u.reis_adi, mg.isim AS grup_adi
     FROM mafya_grup_mesajlari g
     JOIN users u ON u.id = g.from_user_id
     JOIN mafya_gruplari mg ON mg.id = g.grup_id
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [Math.min(100, limit)]
  );
}

async function deleteInboxMessage(db, adminId, messageId) {
  const row = await get(db, `SELECT id FROM oyuncu_mesajlari WHERE id = ?`, [messageId]);
  if (!row) return { ok: false, error: "Mesaj bulunamadı." };
  await run(db, `DELETE FROM oyuncu_mesajlari WHERE id = ?`, [messageId]);
  await logSecurityEvent(db, adminId, "admin_msg_delete_inbox", { messageId });
  return { ok: true };
}

async function deleteMafyaSohbet(db, adminId, messageId) {
  const row = await get(db, `SELECT id FROM mafya_sohbet WHERE id = ?`, [messageId]);
  if (!row) return { ok: false, error: "Mesaj bulunamadı." };
  await run(db, `DELETE FROM mafya_sohbet WHERE id = ?`, [messageId]);
  await logSecurityEvent(db, adminId, "admin_msg_delete_sohbet", { messageId });
  return { ok: true };
}

async function deleteGrupMesaj(db, adminId, messageId) {
  const row = await get(db, `SELECT id, grup_id FROM mafya_grup_mesajlari WHERE id = ?`, [messageId]);
  if (!row) return { ok: false, error: "Grup mesajı bulunamadı." };
  await run(db, `DELETE FROM mafya_grup_mesajlari WHERE id = ?`, [messageId]);
  await run(db, `DELETE FROM oyuncu_mesajlari WHERE grup_mesaj_id = ?`, [messageId]);
  await logSecurityEvent(db, adminId, "admin_msg_delete_grup", { messageId, grupId: row.grup_id });
  return { ok: true };
}

async function purgeUserMessages(db, adminId, userId) {
  const sent = await run(db, `DELETE FROM oyuncu_mesajlari WHERE from_user_id = ?`, [userId]);
  const recv = await run(db, `DELETE FROM oyuncu_mesajlari WHERE to_user_id = ?`, [userId]);
  const sohbet = await run(db, `DELETE FROM mafya_sohbet WHERE user_id = ?`, [userId]);
  const grup = await run(db, `DELETE FROM mafya_grup_mesajlari WHERE from_user_id = ?`, [userId]);
  await logSecurityEvent(db, userId, "admin_purge_messages", {
    adminId,
    silinen: {
      gonderilen: sent.changes,
      alinan: recv.changes,
      sohbet: sohbet.changes,
      grup: grup.changes,
    },
  });
  return {
    ok: true,
    mesaj: `Mesajlar temizlendi (gönderilen: ${sent.changes}, alınan: ${recv.changes}, sohbet: ${sohbet.changes}, grup: ${grup.changes}).`,
  };
}

async function listSecurityEvents(db, limit = 80) {
  return all(
    db,
    `SELECT se.id, se.event_type, se.detail, se.ip, se.created_at, u.reis_adi, u.username
     FROM security_events se
     LEFT JOIN users u ON u.id = se.user_id
     ORDER BY se.created_at DESC
     LIMIT ?`,
    [Math.min(150, limit)]
  );
}

function mapPlayerRow(r) {
  return {
    id: r.id,
    username: r.username,
    reisAdi: r.reis_adi,
    lakap: r.lakap,
    grup: r.grup,
    banned: !!r.banned,
    isAdmin: !!r.is_admin,
    visitorId: r.visitor_id,
    sonIp: r.son_ip,
    kasa: r.kasa,
    bankaBakiye: r.banka_bakiye || 0,
    borsaPortfoyDeger: r.borsa_deger || 0,
    bankaHakki: r.banka_hakki != null ? r.banka_hakki : 20,
    faizBekleyen: r.faiz_bekleyen || 0,
    toplamVarlik: (r.kasa || 0) + (r.banka_bakiye || 0) + (r.borsa_deger || 0),
    guc: r.guc,
    puan: r.puan,
    icraat: r.icraat,
    smsHakki: r.sms_hakki,
    elmas: r.elmas || 0,
    mekanToplam: r.mekan_toplam || 0,
    guvenliYerSeviye: r.guvenli_yer_seviye || 1,
    guvenliYerAd: seviyeBul(r.guvenli_yer_seviye || 1).ad,
    istihbaratEleman: r.istihbarat_eleman || 0,
    istihbaratGuc: (r.istihbarat_eleman || 0) * ELEMAN_GUC,
    karaListede: !!r.kara_listede,
    lastSeen: fmtTs(r.last_seen_at),
    lastLogin: fmtTs(r.last_login_at),
    ...mapAktiviteAlanlari(r),
  };
}

async function listIcerikRaporlari(db, limit = 100) {
  const { raporlariListele, mapRaporRow } = require("./raporService");
  const rows = await raporlariListele(db, limit);
  return rows.map(mapRaporRow);
}

async function listGorusOnerileri(db, limit = 100) {
  const { gorusOnerileriListele, mapGorusOneriRow } = require("./gorusOneriService");
  const rows = await gorusOnerileriListele(db, limit);
  return rows.map(mapGorusOneriRow);
}

module.exports = {
  fmtTs,
  getDashboard,
  searchPlayers,
  getPlayerDetail,
  exportPlayerSnapshot,
  exportAllPlayers,
  banPlayer,
  unbanPlayer,
  kickPlayer,
  updatePlayerStats,
  updatePlayerFull,
  updatePlayerMekanlar,
  updatePlayerGuvenliYer,
  updatePlayerIstihbarat,
  listMafyaGruplari,
  getMafyaGrupDetail,
  mapMafyaGrupRow,
  mapMafyaGrupDetail,
  listMekanSablonu,
  getMultiAccountClusters,
  listInboxMessages,
  listMafyaSohbet,
  listGrupMesajlari,
  deleteInboxMessage,
  deleteMafyaSohbet,
  deleteGrupMesaj,
  purgeUserMessages,
  listSecurityEvents,
  listCanliAktivite,
  listIcerikRaporlari,
  listGorusOnerileri,
  mapPlayerRow,
};
