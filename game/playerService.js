const { run, get, all } = require("../db/database");
const { HIRE, JOBS, COUNCIL } = require("./catalog");
const {
  ICRAAT_REGEN_SEC,
  ICRAAT_SAATLIK_BONUS,
  syncIcraatRegen,
  icraatHarca,
} = require("./icraatService");
const { temizGrupAdi } = require("./grupAdi");
const { limanSaatlikToplam } = require("./worldConstants");
const { toplamGuc } = require("./gucService");
const {
  limanCok,
  babaCok,
  babaDerkiKaydet,
  sadakatOy,
  dusmanaCok,
  getLimanDurumu,
  getBabaDurumu,
  sanitizeDunyaForClient,
} = require("./worldService");
const { sektorPanel, mekanAl, mekanDevret } = require("./sectorService");
const { processSaatlikGelir, oyuncuSaatlikKazanc } = require("./saatlikGelirService");
const { karaListeSenkronize } = require("./karaListeService");
const { paketListesi, getPremiumBonuses, premiumSatinAl, elmasPaketListesi, elmasPaketSatinAl, icraatPaketPanel, icraatPaketSatinAl } = require("./premiumService");
const { logStatHareket } = require("./statService");
const { gelistir: guvenliYerGelistir, panelGetir: guvenliYerPanelGetir, kasaSatinAl: guvenliYerKasaSatinAl } = require("./guvenliYerService");
const { panelGetir: sabotajPanelGetir, sabotajBaslat, sabotajIptal } = require("./sabotajService");
const { hisseAl: borsaHisseAl, hisseSat: borsaHisseSat, emirEkle: borsaEmirEkle, emirIptal: borsaEmirIptal } = require("./borsaService");
const {
  chipGetir: kumarhaneChipGetir,
  chipAl: kumarhaneChipAl,
  chipSat: kumarhaneChipSat,
  oyunOyna: kumarhaneOyunOyna,
} = require("./kumarhaneService");
const { biletAl: kumarhanePiyangoBiletAl } = require("./kumarhanePiyangoService");
const {
  masayaOtur: kumarhaneMasayaOtur,
  masadanKalk: kumarhaneMasadanKalk,
  bahisOner: kumarhaneMasaBahisOner,
  bahisCevap: kumarhaneMasaBahisCevap,
  hazirToggle: kumarhaneMasaHazir,
  masaOyna: kumarhaneMasaOyna,
  masaDurumuGetir: kumarhaneMasaDurumuGetir,
} = require("./kumarhaneMasaService");
const { kontrolTopla: sefirlikKontrolTopla, ihaleGir: sefirlikIhaleGir, sehreSaldir: sefirlikSehreSaldir } = require("./turkiyeSefirlikService");
const {
  panelGetir: meslekPanelGetir,
  processMeslekGeliri,
  mulakatBasvur,
  istifaEt,
  yetenekleriGetir,
  meslekGetir,
} = require("./meslekService");
const { antrenmanYap, yetenekOzeti, maasAntrenmanPuaniGetir, maasAntrenmanKullan } = require("./yetenekService");
const {
  panelGetir: sirketPanelGetir,
  processSirketEkonomisi,
  olustur: sirketOlustur,
  yatir: sirketYatir,
  cek: sirketCek,
  iseAlimToggle: sirketIseAlimToggle,
  basvur: sirketBasvur,
  basvuruKabul: sirketBasvuruKabul,
  basvuruRed: sirketBasvuruRed,
  maasGuncelle: sirketMaasGuncelle,
  istenCikar: sirketIstenCikar,
  kapat: sirketKapat,
  istifaEt: sirketIstifaEt,
  zamTalepEt: sirketZamTalepEt,
  zamTalepOnayla: sirketZamTalepOnayla,
  zamTalepReddet: sirketZamTalepReddet,
  egitimVer: sirketEgitimVer,
  malzemeAl: sirketMalzemeAl,
  upgrade: sirketUpgrade,
  reklamAyarla: sirketReklamAyarla,
  fiyatAyarla: sirketFiyatAyarla,
  calisanGetir,
  meslekMenuBildirimVarMi,
} = require("./sirketService");
const { getSehirBanner, gunlukHaberUret, yeniGazeteVarMi } = require("./sehirGazeteService");
const { MEKANLAR, mekanTanim, sonrakiFiyat } = require("./sectorsCatalog");
const {
  getSmsHakki,
  ozelMesajGonder,
  mesajlariGetir,
  mesajSil,
  mesajCevapla,
  okunmamisSayisi,
  mafyaSohbetListe,
  mafyaSohbetGonder,
  mafyaGrupMesajGonder,
} = require("./messagingService");
const {
  rusvetMiktari,
  getDevletIliskisi,
  devletDusur,
  hapisKontrol,
  rastgeleAvukatDususu,
  clampAvukatIliskisi,
  rusvetVer,
} = require("./devletService");
const {
  getIstihbarat,
  elemanAl,
  oyuncuGucunuOgren,
  birimMaliyetHesapla,
} = require("./istihbaratService");
const {
  getBanka,
  getBankaPanel,
  paraYatir,
  paraCek,
} = require("./bankaService");
const { getKiralamaEnvanter, getKiralamaFiyatEnvanter, kiralamaSatinAl } = require("./kiralamaService");
const { gorevKabul, gorevOdulAl, gorevElmasTamamla, gorevOlayIsle, gunlukGorevBildirimVarMi } = require("./gunlukGorevService");
const { okunmamisBildirimSayisi, ensureTercihler } = require("./bildirimService");

async function aksiyonOyuncuYaniti(db, userId, _player, gorevSonuc = null) {
  const fresh = await loadPlayer(db, userId);
  const full = await publicPlayerFull(db, userId, fresh);
  if (gorevSonuc && gorevSonuc.yeniTamamlanan > 0) {
    full.gunlukGorevBildirim = true;
  }
  return full;
}
const {
  savasIlanEt,
  savasaKatil,
  savaslariListele,
} = require("./mafyaSavasService");
const { isKatil, isGerceklestir } = require("./mafyaIsService");
const { eviGetir, hibeEt, seviyeYukselt, hibeGecmisiGetir } = require("./mafyaEviService");
const { elitFiyatCarpani, elitFiyatDurumu } = require("./elitFiyatService");
const { enforceNoAltAccount, withTransaction } = require("./securityService");
const {
  haberYayinla,
  haberleriGetir,
} = require("./medyaService");
const {
  mafyaPanel,
  kullaniciGrubu,
  grupOlustur,
  grupAra,
  basvur,
  basvuruKabul,
  basvuruRed,
  rutbeDegistir,
  uyeCikar,
  liderlikDevret,
  gurupDagit,
  guruptanCik,
  bekleyenBasvuruSayisi,
  grupIsimDegistir,
  grupAciklamaDegistir,
} = require("./mafiaService");

function rowToPlayer(row) {
  return {
    kasa: row.kasa,
    guc: row.guc,
    bonus_guc: row.bonus_guc || 0,
    puan: row.puan,
    icraat: row.icraat,
    limanlar: {
      istanbul: !!row.liman_istanbul,
      izmir: false,
      hatay: false,
    },
    last_icraat_at: row.last_icraat_at,
    reisAdi: row.reis_adi,
    username: row.username,
    grup: temizGrupAdi(row.grup),
    lakap: row.lakap || "Mafya",
    profilAciklama: row.profil_aciklama || "",
    dostlar: row.dostlar || "",
    dusmanlar: row.dusmanlar || "",
    profilResmi: row.profil_resmi || "",
    userId: row.user_id,
    elmas: row.elmas || 0,
  };
}


async function loadPlayer(db, userId) {
  const row = await get(
    db,
    `SELECT p.*, u.reis_adi, u.username, u.grup, u.lakap
     FROM players p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?`,
    [userId]
  );
  if (!row) throw new Error("Oyuncu bulunamadı");

  await ensureTercihler(db, userId);

  const now = Math.floor(Date.now() / 1000);
  const lastSeen = row.last_seen_at || 0;
  const offlineHours = lastSeen > 0 ? Math.floor((now - lastSeen) / 3600) : 0;

  const icraatSync = await syncIcraatRegen(db, userId);
  let player = rowToPlayer(row);
  player.icraat = icraatSync.icraat;
  player.last_icraat_at = icraatSync.last_icraat_at;
  const saatlikSonuc = await processSaatlikGelir(db, userId, player);
  player = saatlikSonuc.player;
  const saatlikGelir = saatlikSonuc.gelir;
  if (saatlikGelir > 0) {
    const { bildirimGonder } = require("./bildirimService");
    bildirimGonder(db, userId, "saatlik_gelir", {
      baslik: "Saatlik Gelirin Hesabına Yattı",
      icerik: `${saatlikGelir.toLocaleString("tr-TR")} TL kasana eklendi.`,
      url: "/?ekran=mekan",
    }).catch(() => {});
  }
  try {
    player.meslekGelirBilgi = await processMeslekGeliri(db, userId, player);
  } catch (_) {
    player.meslekGelirBilgi = { gelir: 0, gun: 0 };
  }
  try {
    const sirketEk = await processSirketEkonomisi(db, userId, player);
    player.sirketGelirBilgi = sirketEk.sirketGelirBilgi;
    player.sirketMaasBilgi = sirketEk.sirketMaasBilgi;
  } catch (_) {
    player.sirketGelirBilgi = { gelir: 0, gun: 0 };
    player.sirketMaasBilgi = { gelir: 0, gun: 0 };
  }

  let offlineWelcome = null;
  if (offlineHours >= 1 && saatlikGelir > 0) {
    offlineWelcome = {
      hours: saatlikSonuc.saat,
      income: saatlikGelir,
      saatlik: saatlikSonuc.saatlik,
    };
  }
  player.offlineWelcome = offlineWelcome;

  await run(db, `UPDATE players SET last_seen_at = ? WHERE user_id = ?`, [now, userId]);

  return player;
}

const OYUNCU_ADI_MAX = 24;

async function oyuncuAdiDegistir(db, userId, player, yeniAd) {
  const temiz = String(yeniAd || "").trim();
  if (!temiz || temiz.length > OYUNCU_ADI_MAX) {
    return { ok: false, error: `Oyuncu adı 1-${OYUNCU_ADI_MAX} karakter olmalı.` };
  }
  if (temiz.toLowerCase() === String(player.reisAdi || "").toLowerCase()) {
    return { ok: false, error: "Zaten bu ismi kullanıyorsun." };
  }

  const saatlik = await oyuncuSaatlikKazanc(db, userId);
  const ucret = Math.floor(saatlik * 5);
  if (ucret < 1) {
    return { ok: false, error: "Ad değiştirmek için yeterli kazancın yok." };
  }
  if (player.kasa < ucret) {
    return {
      ok: false,
      error: "Kasan yetersiz. Gerekli: " + ucret.toLocaleString("tr-TR") + " TL",
    };
  }

  const varMi = await get(
    db,
    `SELECT id FROM users WHERE (LOWER(reis_adi) = LOWER(?) OR LOWER(username) = LOWER(?)) AND id <> ?`,
    [temiz, temiz, userId]
  );
  if (varMi) {
    return { ok: false, error: "Bu isim zaten kullanılıyor." };
  }

  try {
    await withTransaction(db, async () => {
      const guncelle = await run(
        db,
        `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
        [ucret, userId, ucret]
      );
      if (!guncelle.changes) throw new Error("Kasan yetersiz.");
      await run(db, `UPDATE users SET reis_adi = ? WHERE id = ?`, [temiz, userId]);
    });
  } catch (err) {
    return { ok: false, error: err.message || "İsim değiştirilemedi." };
  }

  return { ok: true, yeniAd: temiz, ucret };
}

async function savePlayer(db, userId, player) {
  await run(
    db,
    `UPDATE players SET
      kasa = ?, guc = ?, puan = ?, icraat = ?,
      liman_istanbul = ?
     WHERE user_id = ?`,
    [
      player.kasa,
      player.guc,
      player.puan,
      player.icraat,
      player.limanlar && player.limanlar.istanbul ? 1 : 0,
      userId,
    ]
  );
  return player;
}

async function publicPlayerFull(db, userId, player) {
  const icraatSync = await syncIcraatRegen(db, userId);
  player.icraat = icraatSync.icraat;
  player.last_icraat_at = icraatSync.last_icraat_at;

  await karaListeSenkronize(db);
  try {
    await gunlukHaberUret(db);
  } catch (_) {}
  const sehirBanner = await getSehirBanner(db);
  const limanlar = await getLimanDurumu(db);
  const baba = await getBabaDurumu(db);
  let mafyaBildirim = (await bekleyenBasvuruSayisi(db, userId)) > 0;
  // Bekleyen mafya savaşı varsa (katılmadıysa) menü yansın
  try {
    const uyelik = await get(
      db,
      `SELECT grup_id FROM mafya_uyeleri WHERE user_id = ?`,
      [userId]
    );
    if (uyelik?.grup_id) {
      const row = await get(
        db,
        `SELECT COUNT(*) AS n
         FROM mafya_savaslar s
         WHERE s.durum = 'bekliyor'
           AND (s.saldiran_grup_id = ? OR s.hedef_grup_id = ?)
           AND NOT EXISTS (
             SELECT 1 FROM mafya_savas_katilim k
             WHERE k.savas_id = s.id AND k.user_id = ?
           )`,
        [uyelik.grup_id, uyelik.grup_id, userId]
      );
      if ((row?.n || 0) > 0) mafyaBildirim = true;
    }
  } catch (_) {}
  const sahipLimanlar = limanlar.filter((l) => l.sahipUserId === userId).map((l) => l.limanId);
  const { sahiplik, saatlikKazanc: sektorSaatlik } = await sektorPanel(db, userId);
  const limanSaatlik = limanSaatlikToplam(sahipLimanlar.length);
  const premium = await getPremiumBonuses(db, userId);
  const saatlikKazancToplam = await oyuncuSaatlikKazanc(db, userId);
  const devletIliskisi = await getDevletIliskisi(db, userId);
  const smsHakki = await getSmsHakki(db, userId);
  const okunmamisMesaj = (await okunmamisSayisi(db, userId)) > 0;
  const rusvet = rusvetMiktari(player.puan);
  const istihbaratEleman = await getIstihbarat(db, userId);
  const bankaBakiye = await getBanka(db, userId);
  const bankaPanel = await getBankaPanel(db, userId);
  let kumarhaneChip = 0;
  try {
    kumarhaneChip = await kumarhaneChipGetir(db, userId);
  } catch (_) {}
  const kiralamaEnvanter = await getKiralamaEnvanter(db, userId);
  const kiralamaFiyatEnvanter = await getKiralamaFiyatEnvanter(db, userId);
  const kara = await get(
    db,
    `SELECT kara_listede, sehir_efsane, profil_ziyaret_okundu_at FROM players WHERE user_id = ?`,
    [userId]
  );
  const ziyaretRow = await get(
    db,
    `SELECT COUNT(*) AS n FROM profil_ziyaretleri
     WHERE target_user_id = ? AND viewer_user_id <> ?
       AND created_at > COALESCE(?, 0)`,
    [userId, userId, kara?.profil_ziyaret_okundu_at || 0]
  );
  let yeniGazeteHaber = false;
  try {
    yeniGazeteHaber = await yeniGazeteVarMi(db, userId);
  } catch (_) {}
  const now = Math.floor(Date.now() / 1000);
  const onlineRow = await get(
    db,
    `SELECT COUNT(*) AS n FROM players WHERE last_seen_at >= ?`,
    [now - 300]
  );
  const fiyatCarpani = await elitFiyatCarpani(db, userId);
  const elitDurum = await elitFiyatDurumu(db, userId);
  let gunlukGorevBildirim = false;
  try {
    gunlukGorevBildirim = await gunlukGorevBildirimVarMi(db, userId);
  } catch (_) {}
  let okunmamisBildirim = 0;
  try {
    okunmamisBildirim = await okunmamisBildirimSayisi(db, userId);
  } catch (_) {}
  let meslekBildirim = false;
  try {
    meslekBildirim = await meslekMenuBildirimVarMi(db, userId);
  } catch (_) {}
  let yetenekler = null;
  let yetenekOzetiData = null;
  let aktifMeslek = null;
  let aktifSirketCalisan = null;
  let maasAntrenmanPuani = 0;
  try {
    yetenekler = await yetenekleriGetir(db, userId);
    yetenekOzetiData = yetenekOzeti(yetenekler);
    aktifMeslek = await meslekGetir(db, userId);
    aktifSirketCalisan = await calisanGetir(db, userId);
    maasAntrenmanPuani = await maasAntrenmanPuaniGetir(db, userId);
  } catch (_) {}
  return {
    userId,
    kasa: player.kasa,
    guc: player.guc,
    bonusGuc: player.bonus_guc || 0,
    toplamGuc: toplamGuc(player),
    puan: player.puan,
    icraat: player.icraat,
    lastIcraatAt: player.last_icraat_at,
    icraatRegenSec: ICRAAT_REGEN_SEC,
    icraatSaatlikBonus: premium.icraatSaatlik,
    premiumPaket: premium.paket,
    premiumBonuses: {
      smsSinirsiz: premium.smsSinirsiz,
      bankaHakSinirsiz: premium.bankaHakSinirsiz,
      faizOran: premium.faizOran,
      mekanGelirBonus: premium.mekanGelirBonus,
      prestijRozet: premium.prestijRozet,
      prestijEtiket: premium.prestijEtiket,
    },
    premiumMagaza: paketListesi(),
    elmasPaketler: elmasPaketListesi(),
    icraatPaket: await icraatPaketPanel(db, userId),
    limanlar: {
      istanbul: sahipLimanlar.includes("istanbul"),
      izmir: sahipLimanlar.includes("izmir"),
      hatay: sahipLimanlar.includes("hatay"),
    },
    reisAdi: player.reisAdi,
    username: player.username,
    grup: player.grup,
    lakap: player.lakap || "Mafya",
    profilAciklama: player.profilAciklama || "",
    dostlar: player.dostlar || "",
    dusmanlar: player.dusmanlar || "",
    profilResmi: player.profilResmi || "",
    devletIliskisi,
    smsHakki: premium.smsSinirsiz ? 999999 : smsHakki,
    smsSinirsiz: premium.smsSinirsiz,
    saatlikKazanc: saatlikKazancToplam,
    oyuncuAdiDegistirUcret: Math.floor(saatlikKazancToplam * 5),
    sektorSahiplik: sahiplik,
    rusvet,
    mafyaBildirim,
    okunmamisMesaj,
    mekanlar: MEKANLAR,
    dunya: sanitizeDunyaForClient({ limanlar, baba }),
    sehirEfsane: !!(kara && kara.sehir_efsane),
    istihbaratEleman,
    istihbaratBirimMaliyet: birimMaliyetHesapla(istihbaratEleman),
    bankaBakiye,
    bankaHakki: bankaPanel.bankaHakki,
    bankaHakSinirsiz: bankaPanel.bankaHakSinirsiz,
    faizOran: bankaPanel.faizOran,
    faizBekleyen: bankaPanel.faizBekleyen,
    elmas: player.elmas || 0,
    kumarhaneChip,
    kiralamaEnvanter,
    kiralamaFiyatEnvanter,
    karaListede: !!(kara && kara.kara_listede),
    sehirBanner,
    yeniProfilZiyaret: ziyaretRow?.n || 0,
    offlineWelcome: player.offlineWelcome || null,
    yeniGazeteHaber,
    meslekBildirim,
    onlineSayisi: onlineRow?.n || 1,
    fiyatCarpani,
    elitFiyatX2: elitDurum.elitFiyatX2,
    sehreHukmeden: elitDurum.sehreHukmeden,
    enYuksekSayginlik: elitDurum.enYuksekSayginlik,
    gunlukGorevBildirim,
    okunmamisBildirim,
    yetenekler,
    yetenekOzeti: yetenekOzetiData,
    maasAntrenmanPuani,
    aktifMeslek,
    aktifSirketCalisan,
    meslekGelirBilgi: player.meslekGelirBilgi || null,
    sirketGelirBilgi: player.sirketGelirBilgi || null,
    sirketMaasBilgi: player.sirketMaasBilgi || null,
  };
}

function publicPlayer(player) {
  return {
    kasa: player.kasa,
    guc: player.guc,
    bonusGuc: player.bonus_guc || 0,
    toplamGuc: toplamGuc(player),
    puan: player.puan,
    icraat: player.icraat,
    limanlar: player.limanlar,
    reisAdi: player.reisAdi,
    username: player.username,
    grup: player.grup,
  };
}

async function performAction(db, userId, action, key, adet = 1, extra = {}) {
  const securityMeta = extra._securityMeta || {};
  const aliases = {
    port: "liman_cok",
    attack: "dusmana_cok",
    saldiri: "dusmana_cok",
    rusvetVer: "rusvet_ver",
    limanCok: "liman_cok",
    babaCok: "baba_cok",
  };
  action = aliases[action] || action;

  let player = await loadPlayer(db, userId);

  if (action === "hire") {
    const sonuc = await kiralamaSatinAl(db, userId, player, key, adet);
    if (!sonuc.ok) return sonuc;
    const gorevSonuc = await gorevOlayIsle(db, userId, "esya_al", {
      hireKey: key,
      adet: sonuc.adet || adet,
    });
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await aksiyonOyuncuYaniti(db, userId, player, gorevSonuc),
      effect: {
        type: "hire",
        unvan: sonuc.unvan,
        guc: sonuc.guc,
        adet: sonuc.adet,
        toplamMaliyet: sonuc.toplamMaliyet,
        yeniSahip: sonuc.yeniSahip,
      },
    };
  }

  if (action === "job") {
    const hapis = await hapisKontrol(db, userId);
    if (!hapis.ok) return hapis;
    const job = JOBS[key];
    if (!job) return { ok: false, error: "Geçersiz iş." };
    if (player.guc < job.minGuc && toplamGuc(player) < job.minGuc) {
      return {
        ok: false,
        error: `Gücün yetersiz! En az ${job.minGuc.toLocaleString("tr-TR")} güce ihtiyacın var.`,
      };
    }
    const icraatSonuc = await icraatHarca(db, userId, job.icraat);
    if (!icraatSonuc.ok) return icraatSonuc;
    player.icraat = icraatSonuc.icraat;
    player.kasa += job.netKazanc;
    player.puan += job.puan;
    const devletDusus = rastgeleAvukatDususu(5, 10);
    const mevcutDevlet = await getDevletIliskisi(db, userId);
    const yeniDevletIliski = clampAvukatIliskisi(mevcutDevlet - devletDusus);
    await run(
      db,
      `UPDATE players SET kasa = ?, puan = ?, devlet_iliskisi = ? WHERE user_id = ?`,
      [player.kasa, player.puan, yeniDevletIliski, userId]
    );
    await logStatHareket(db, userId, "sayginlik", job.puan);
    const gorevSonuc = await gorevOlayIsle(db, userId, "is_yap", { jobKey: key });
    const full = await aksiyonOyuncuYaniti(db, userId, player, gorevSonuc);
    full.devletIliskisi = yeniDevletIliski;
    return {
      ok: true,
      player: full,
      effect: {
        type: "job",
        isAdi: job.isAdi,
        netKazanc: job.netKazanc,
        icraat: job.icraat,
        gorselKey: job.gorselKey,
        devletDusus,
        yeniDevletIliski,
      },
    };
  }

  if (action === "liman_cok") {
    const sonuc = await limanCok(db, userId, player, key, securityMeta);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "liman_cok", mesaj: sonuc.mesaj, limanId: key },
    };
  }

  if (action === "baba_cok") {
    const sonuc = await babaCok(db, userId, player, key, securityMeta);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "baba_cok", mesaj: sonuc.mesaj, makam: key },
    };
  }

  if (action === "baba_derki") {
    const sonuc = await babaDerkiKaydet(db, userId, key, extra.metin);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "baba_derki" },
    };
  }

  if (action === "sadakat_oy") {
    const sonuc = await sadakatOy(db, userId, key);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sadakat_oy" },
    };
  }

  if (action === "dusmana_cok") {
    const sonuc = await dusmanaCok(db, userId, player, extra.hedef || key, securityMeta);
    if (!sonuc.ok) return sonuc;
    let gorevSonuc = null;
    if (sonuc.kazandi) {
      gorevSonuc = await gorevOlayIsle(db, userId, "saldiri_kazan", {
        hedefUserId: sonuc.hedefUserId,
      });
    }
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await aksiyonOyuncuYaniti(db, userId, player, gorevSonuc),
      effect: {
        type: "dusmana_cok",
        mesaj: sonuc.mesaj,
        kazandi: sonuc.kazandi,
        ...(sonuc.effect || {}),
      },
    };
  }

  if (action === "sabotaj_baslat") {
    const sonuc = await sabotajBaslat(
      db,
      userId,
      player,
      extra.hedef,
      extra.turId,
      extra.asama,
      securityMeta
    );
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "sabotaj_baslat",
        mesaj: sonuc.mesaj,
        aktifIs: sonuc.aktifIs,
      },
    };
  }

  if (action === "sabotaj_iptal") {
    const sonuc = await sabotajIptal(db, userId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sabotaj_iptal", mesaj: sonuc.mesaj },
    };
  }

  if (action === "borsa_al") {
    const sonuc = await borsaHisseAl(db, userId, player, extra.sirketId, adet ?? extra.adet);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "borsa_al", mesaj: sonuc.mesaj, sirketId: sonuc.sirketId, adet: sonuc.adet },
    };
  }

  if (action === "borsa_sat") {
    const sonuc = await borsaHisseSat(db, userId, player, extra.sirketId, adet ?? extra.adet);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "borsa_sat", mesaj: sonuc.mesaj, sirketId: sonuc.sirketId, adet: sonuc.adet },
    };
  }

  if (action === "borsa_emir") {
    const sonuc = await borsaEmirEkle(
      db,
      userId,
      player,
      extra.sirketId ?? extra.sirket_id,
      extra.tur,
      adet ?? extra.adet,
      extra.hedefFiyat ?? extra.hedef_fiyat ?? extra.fiyat
    );
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "borsa_emir",
        mesaj: sonuc.mesaj,
        sirketId: sonuc.sirketId,
        tur: sonuc.tur,
        adet: sonuc.adet,
        hedefFiyat: sonuc.hedefFiyat,
        emirDurum: sonuc.emirDurum,
      },
    };
  }

  if (action === "borsa_emir_iptal") {
    const sonuc = await borsaEmirIptal(db, userId, extra.emirId ?? extra.emir_id);
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "borsa_emir_iptal", mesaj: sonuc.mesaj, emirId: sonuc.emirId },
    };
  }

  if (action === "kumarhane_chip_al") {
    const sonuc = await kumarhaneChipAl(db, userId, player, adet ?? extra.miktar);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "kumarhane_chip_al", mesaj: sonuc.mesaj, chip: sonuc.chip },
    };
  }

  if (action === "kumarhane_chip_sat") {
    const sonuc = await kumarhaneChipSat(db, userId, player, adet ?? extra.miktar);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "kumarhane_chip_sat", mesaj: sonuc.mesaj, chip: sonuc.chip },
    };
  }

  if (action === "kumarhane_oyna") {
    const sonuc = await kumarhaneOyunOyna(db, userId, { ...extra, bahis: extra.bahis ?? adet });
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "kumarhane_oyna",
        mesaj: sonuc.mesaj,
        oyunId: sonuc.oyunId,
        bitti: sonuc.bitti,
        gorunum: sonuc.gorunum,
        chip: sonuc.chip,
        kazanc: sonuc.kazanc,
        net: sonuc.net,
      },
    };
  }

  if (action === "kumarhane_piyango_bilet") {
    const odeme = extra.odeme === "elmas" ? "elmas" : "chip";
    const sonuc = await kumarhanePiyangoBiletAl(db, userId, extra.sayilar || extra.numbers, { odeme });
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "kumarhane_piyango_bilet",
        mesaj: sonuc.mesaj,
        chip: sonuc.chip,
        elmas: sonuc.elmas,
        piyango: sonuc.piyango,
      },
    };
  }

  if (action === "kumarhane_masa_katil") {
    const sonuc = await kumarhaneMasayaOtur(db, userId, extra.oyunId, securityMeta);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "kumarhane_masa", mesaj: sonuc.mesaj, masa: sonuc.masa, chip: await kumarhaneChipGetir(db, userId) },
    };
  }

  if (action === "kumarhane_masa_ayril") {
    const sonuc = await kumarhaneMasadanKalk(db, userId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "kumarhane_masa", mesaj: sonuc.mesaj, masa: null, chip: await kumarhaneChipGetir(db, userId) },
    };
  }

  if (action === "kumarhane_masa_bahis_oner") {
    const sonuc = await kumarhaneMasaBahisOner(db, userId, extra.miktar ?? adet);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "kumarhane_masa", mesaj: sonuc.mesaj, masa: sonuc.masa, chip: await kumarhaneChipGetir(db, userId) },
    };
  }

  if (action === "kumarhane_masa_bahis_cevap") {
    const sonuc = await kumarhaneMasaBahisCevap(db, userId, !!extra.kabul);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "kumarhane_masa", mesaj: sonuc.mesaj, masa: sonuc.masa, chip: await kumarhaneChipGetir(db, userId) },
    };
  }

  if (action === "kumarhane_masa_hazir") {
    const sonuc = await kumarhaneMasaHazir(db, userId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "kumarhane_masa", mesaj: sonuc.mesaj, masa: sonuc.masa, chip: await kumarhaneChipGetir(db, userId) },
    };
  }

  if (action === "kumarhane_masa_oyna") {
    const sonuc = await kumarhaneMasaOyna(db, userId, securityMeta);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "kumarhane_masa_oyna",
        mesaj: sonuc.mesaj,
        masa: sonuc.masa,
        gorunum: sonuc.gorunum,
        kazananId: sonuc.kazananId,
        pot: sonuc.pot,
        chip: sonuc.chip ?? (await kumarhaneChipGetir(db, userId)),
      },
    };
  }

  if (action === "mekan_al") {
    const [sektor, mekanKey] = String(key || "").split(":");
    const miktar = Math.min(999, Math.max(1, parseInt(adet ?? extra.adet, 10) || 1));
    const sonuc = await mekanAl(db, userId, player, sektor, mekanKey, miktar);
    if (!sonuc.ok) return sonuc;
    const gorevSonuc = await gorevOlayIsle(db, userId, "sektor_al", { adet: miktar });
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await aksiyonOyuncuYaniti(db, userId, player, gorevSonuc),
      effect: { type: "mekan_al", mesaj: sonuc.mesaj },
    };
  }

  if (action === "rusvet_ver") {
    const sonuc = await rusvetVer(db, userId, player, extra.miktar);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "rusvet", mesaj: sonuc.mesaj || `Devlet ilişkin ${sonuc.devletIliskisi} oldu.`, odenen: sonuc.odenen },
    };
  }

  if (action === "mesaj_gonder") {
    const sonuc = await ozelMesajGonder(db, userId, extra.hedef || key, extra.metin);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mesaj_gonder" },
    };
  }

  if (action === "mesaj_sil") {
    await mesajSil(db, userId, parseInt(key, 10));
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mesaj_sil" },
    };
  }

  if (action === "mesaj_cevapla") {
    const sonuc = await mesajCevapla(db, userId, parseInt(key, 10), extra.metin);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mesaj_cevapla" },
    };
  }

  if (action === "mafya_grup_mesaj") {
    const sonuc = await mafyaGrupMesajGonder(db, userId, extra.metin);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    try {
      return {
        ok: true,
        player: await publicPlayerFull(db, userId, player),
        effect: { type: "mafya_grup_mesaj" },
      };
    } catch (err) {
      console.error("mafya_grup_mesaj player sync:", err);
      return { ok: true, effect: { type: "mafya_grup_mesaj" } };
    }
  }

  if (action === "mafya_sohbet") {
    const sonuc = await mafyaSohbetGonder(db, userId, extra.metin);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mafya_sohbet" },
    };
  }

  if (action === "mafya_olustur") {
    const sonuc = await grupOlustur(db, userId, extra.isim, extra.aciklama);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    player.grup = sonuc.isim;
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_basvur") {
    const sonuc = await basvur(db, userId, parseInt(key, 10));
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_kabul") {
    const sonuc = await basvuruKabul(db, userId, parseInt(key, 10));
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_red") {
    const sonuc = await basvuruRed(db, userId, parseInt(key, 10));
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_rutbe") {
    const sonuc = await rutbeDegistir(db, userId, parseInt(extra.hedefUserId, 10), extra.rutbe);
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_cikar") {
    const sonuc = await uyeCikar(db, userId, parseInt(key, 10));
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_devret") {
    const sonuc = await liderlikDevret(db, userId, parseInt(key, 10));
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_dagit") {
    const sonuc = await gurupDagit(db, userId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    player.grup = "Bağımsız Reis";
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "mafya_cik") {
    const sonuc = await guruptanCik(db, userId, player);
    if (!sonuc.ok) return sonuc;
    player = sonuc.player;
    player.grup = "Bağımsız Reis";
    return { ok: true, player: await publicPlayerFull(db, userId, player) };
  }

  if (action === "istihbarat_al") {
    const sonuc = await elemanAl(db, userId, player, adet);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "istihbarat_al",
        elemanSayisi: sonuc.elemanSayisi,
        odenen: sonuc.odenen,
        sonrakiBirimMaliyet: sonuc.sonrakiBirimMaliyet,
      },
    };
  }

  if (action === "istihbarat_spy") {
    const sonuc = await oyuncuGucunuOgren(db, userId, extra.hedef);
    if (!sonuc.ok) return sonuc;
    let gorevSonuc = null;
    if (sonuc.basari && sonuc.hedefUserId) {
      gorevSonuc = await gorevOlayIsle(db, userId, "istihbarat_basari", {
        hedefUserId: sonuc.hedefUserId,
      });
    }
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await aksiyonOyuncuYaniti(db, userId, player, gorevSonuc),
      effect: { type: "istihbarat_spy", ...sonuc },
    };
  }

  if (action === "gorev_kabul") {
    const sonuc = await gorevKabul(db, userId, key);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "gorev_kabul", gorev: sonuc.gorev, kabulSayisi: sonuc.kabulSayisi },
    };
  }

  if (action === "gorev_odul_al") {
    const sonuc = await gorevOdulAl(db, userId, key, player);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "gorev_odul_al", odulMetni: sonuc.odulMetni, gorev: sonuc.gorev },
    };
  }

  if (action === "gorev_elmas_tamamla") {
    const sonuc = await gorevElmasTamamla(db, userId, key, player);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "gorev_elmas_tamamla",
        mesaj: sonuc.mesaj,
        odulMetni: sonuc.odulMetni,
        maliyet: sonuc.maliyet,
        gorev: sonuc.gorev,
      },
    };
  }

  if (action === "banka_yatir") {
    const yatirMiktari = parseInt(extra.miktar, 10) || 0;
    const sonuc = await paraYatir(db, userId, player, yatirMiktari);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "banka_yatir", yatirilan: sonuc.yatirilan, toplam: sonuc.toplam },
    };
  }

  if (action === "banka_cek") {
    const cekMiktari = parseInt(extra.miktar, 10) || 0;
    const sonuc = await paraCek(db, userId, player, cekMiktari);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "banka_cek", cekilen: sonuc.cekilen, yeniKasa: sonuc.yeniKasa },
    };
  }

  if (action === "mekan_devri") {
    const hedefAdi = String(extra.hedef || "").trim();
    const sektor = String(extra.sektor || "").trim();
    const mekanKey = String(extra.mekanKey || "").trim();
    const miktar = Math.min(999, Math.max(1, parseInt(adet ?? extra.adet, 10) || 1));
    if (!hedefAdi) return { ok: false, error: "Dost reis adı gerekli." };
    if (!sektor || !mekanKey) return { ok: false, error: "Devredilecek mekan seç." };

    const hedef = await get(
      db,
      `SELECT id, reis_adi FROM users WHERE LOWER(reis_adi) = LOWER(?) OR LOWER(username) = LOWER(?)`,
      [hedefAdi, hedefAdi]
    );
    if (!hedef) return { ok: false, error: "Bu isimde oyuncu bulunamadı." };
    if (hedef.id === userId) return { ok: false, error: "Kendine mekan devredemezsin." };

    const altCheck = await enforceNoAltAccount(db, userId, hedef.id, "mekan_devri", securityMeta);
    if (!altCheck.ok) return altCheck;

    const sonuc = await mekanDevret(db, userId, hedef.id, sektor, mekanKey, miktar);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mekan_devri", mesaj: sonuc.mesaj },
    };
  }

  if (action === "para_gonder") {
    const hedefAdi = String(extra.hedef || "").trim();
    const gonderMiktari = parseInt(extra.miktar, 10) || 0;
    if (!hedefAdi) return { ok: false, error: "Alıcı reis adı gerekli." };
    if (gonderMiktari < 1) return { ok: false, error: "Geçerli bir miktar gir." };
    if (player.kasa < gonderMiktari) return { ok: false, error: "Yeterli paran yok." };

    const hedef = await get(
      db,
      `SELECT id, reis_adi FROM users WHERE LOWER(reis_adi) = LOWER(?) OR LOWER(username) = LOWER(?)`,
      [hedefAdi, hedefAdi]
    );
    if (!hedef) return { ok: false, error: "Bu isimde oyuncu bulunamadı." };
    if (hedef.id === userId) return { ok: false, error: "Kendine para gönderemezsin." };

    const altCheck = await enforceNoAltAccount(db, userId, hedef.id, "para_gonder", securityMeta);
    if (!altCheck.ok) return altCheck;

    try {
      await withTransaction(db, async () => {
        const kaynak = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [userId]);
        if (!kaynak || kaynak.kasa < gonderMiktari) {
          throw new Error("Yeterli paran yok.");
        }
        const guncelle = await run(
          db,
          `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
          [gonderMiktari, userId, gonderMiktari]
        );
        if (!guncelle.changes) throw new Error("Yeterli paran yok.");
        await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [
          gonderMiktari,
          hedef.id,
        ]);
      });
    } catch (err) {
      return { ok: false, error: err.message || "Para transferi başarısız." };
    }

    player = await loadPlayer(db, userId);

    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "para_gonder", mesaj: hedef.reis_adi + " isimli oyuncuya " + gonderMiktari.toLocaleString("tr-TR") + " TL gönderildi." },
    };
  }

  if (action === "mafya_savas_ilan") {
    const grup = await kullaniciGrubu(db, userId);
    const benLiderim = !!grup && grup.lider_user_id === userId;
    if (!grup || !benLiderim) {
      return { ok: false, error: "Sadece grup lideri savaş ilan edebilir." };
    }

    // Lider, hedef gurup adını yazarak savaş ilan edebilsin
    const hedefAd = String(extra.hedefGurupAdi || extra.hedefGrupAdi || extra.hedef || "").trim();
    if (!hedefAd) return { ok: false, error: "Hedef mafya grubu adı gerekli." };

    // Üye sayısı şartı: iki tarafta da en az 3 üye
    const benimUye = await get(
      db,
      `SELECT COUNT(*) AS n FROM mafya_uyeleri WHERE grup_id = ?`,
      [grup.id]
    );
    if ((benimUye?.n || 0) < 3) {
      return { ok: false, error: "Savaş ilan etmek için grubunda en az 3 üye olmalı." };
    }

    const hedefGrup = await get(
      db,
      `SELECT id, isim FROM mafya_gruplari WHERE LOWER(isim) = LOWER(?)`,
      [hedefAd]
    );
    if (!hedefGrup) return { ok: false, error: "Bu isimde mafya grubu bulunamadı." };
    if (hedefGrup.id === grup.id) return { ok: false, error: "Kendi grubuna savaş ilan edemezsin." };

    const hedefUye = await get(
      db,
      `SELECT COUNT(*) AS n FROM mafya_uyeleri WHERE grup_id = ?`,
      [hedefGrup.id]
    );
    if ((hedefUye?.n || 0) < 3) {
      return { ok: false, error: "Hedef grubun en az 3 üyesi olmalı (savaş ilan edilemez)." };
    }

    const sonuc = await savasIlanEt(db, grup.id, hedefGrup.id);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mafya_savas", mesaj: sonuc.mesaj },
    };
  }

  if (action === "mafya_savas_katil") {
    const savasId = extra.savasId;
    const grup = await kullaniciGrubu(db, userId);
    if (!grup) {
      return { ok: false, error: "Mafya grubu üyesi değilsin." };
    }
    
    const sonuc = await savasaKatil(db, savasId, userId, grup.id);
    return sonuc;
  }

  if (action === "mafya_is_katil") {
    const grup = await kullaniciGrubu(db, userId);
    if (!grup) return { ok: false, error: "Mafya grubu üyesi değilsin." };
    const sonuc = await isKatil(db, userId, grup.id, String(extra.isTuru || extra.key || key || ""));
    return sonuc;
  }

  if (action === "mafya_is_gerceklestir") {
    const grup = await kullaniciGrubu(db, userId);
    if (!grup) return { ok: false, error: "Mafya grubu üyesi değilsin." };
    const isId = parseInt(extra.isId || key, 10);
    const sonuc = await isGerceklestir(db, grup.id, isId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    const gorevSonuc = {
      yeniTamamlanan:
        (sonuc.gorevTamamlananByUser && sonuc.gorevTamamlananByUser[userId]) || 0,
    };
    return {
      ok: true,
      player: await aksiyonOyuncuYaniti(db, userId, player, gorevSonuc),
      effect: { type: "mafya_is", mesaj: sonuc.mesaj },
    };
  }

  if (action === "mafya_evi_hibe") {
    const grup = await kullaniciGrubu(db, userId);
    if (!grup) return { ok: false, error: "Mafya grubu üyesi değilsin." };
    const sonuc = await hibeEt(db, userId, player, grup.id, extra.miktar);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mafya_evi", mesaj: "Hibe yapıldı." },
    };
  }

  if (action === "mafya_evi_seviye") {
    const grup = await kullaniciGrubu(db, userId);
    if (!grup) return { ok: false, error: "Mafya grubu üyesi değilsin." };
    if (grup.lider_user_id !== userId) return { ok: false, error: "Sadece Mafya Lideri seviye yükseltebilir." };
    const sonuc = await seviyeYukselt(db, grup.id);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    const bonusMsg = sonuc.uyeGucBonusu
      ? ` Tüm üyelere +${sonuc.uyeGucBonusu.toLocaleString("tr-TR")} bonus güç.`
      : "";
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mafya_evi", mesaj: "Mafya Evi seviyesi yükseltildi!" + bonusMsg },
    };
  }

  if (action === "oyuncu_adi_degistir") {
    const yeniAd = extra.yeniAd || extra.reisAdi || extra.isim || "";
    const sonuc = await oyuncuAdiDegistir(db, userId, player, yeniAd);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "oyuncu_adi_degistir",
        mesaj: "Oyuncu adın " + sonuc.yeniAd + " olarak güncellendi.",
      },
    };
  }

  if (action === "mafya_grup_isim_degistir") {
    const yeniIsim = String(extra.isim || extra.yeniIsim || "").trim();
    const sonuc = await grupIsimDegistir(db, userId, yeniIsim);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mafya_grup", mesaj: "Mafya Grubu adı güncellendi: " + sonuc.isim },
    };
  }

  if (action === "mafya_grup_aciklama_degistir") {
    const yeniAciklama = String(extra.aciklama || extra.yeniAciklama || "").trim();
    const sonuc = await grupAciklamaDegistir(db, userId, yeniAciklama);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mafya_grup", mesaj: "Mafya Grubu açıklaması güncellendi." },
    };
  }

  if (action === "medya_haber") {
    const haber = extra.haber;
    if (!haber || haber.length < 5) {
      return { ok: false, error: "Haber metni çok kısa." };
    }
    if (haber.length > 200) {
      return { ok: false, error: "Haber metni çok uzun (max 200 karakter)." };
    }
    
    const sonuc = await haberYayinla(db, userId, player, haber);
    if (!sonuc.ok) return sonuc;
    
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "medya_haber", mesaj: sonuc.mesaj },
    };
  }

  if (action === "guvenli_yer_gelistir") {
    const sonuc = await guvenliYerGelistir(db, userId, player);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    const panel = await guvenliYerPanelGetir(db, userId, player);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "guvenli_yer_gelistir", mesaj: sonuc.mesaj, panel },
    };
  }

  if (action === "guvenli_yer_kasa_al") {
    const sonuc = await guvenliYerKasaSatinAl(db, userId, player, extra.kasaId || extra.kasa);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    const panel = await guvenliYerPanelGetir(db, userId, player);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "guvenli_yer_kasa_al", mesaj: sonuc.mesaj, panel },
    };
  }

  if (action === "sefirlik_kontrol") {
    const sonuc = await sefirlikKontrolTopla(db, userId, player, extra.sehirId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sefirlik_kontrol", mesaj: sonuc.mesaj, sehir: sonuc.sehir },
    };
  }

  if (action === "sefirlik_ihale") {
    const sonuc = await sefirlikIhaleGir(db, userId, player, extra.sehirId, extra.teklif);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sefirlik_ihale", mesaj: sonuc.mesaj, sehir: sonuc.sehir },
    };
  }

  if (action === "sefirlik_saldir") {
    const sonuc = await sefirlikSehreSaldir(db, userId, player, extra.sehirId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sefirlik_saldir", mesaj: sonuc.mesaj, sehir: sonuc.sehir, kazandi: sonuc.kazandi },
    };
  }

  if (action === "meslek_mulakat") {
    const sonuc = await mulakatBasvur(db, userId, extra.meslekId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "meslek_mulakat", ...sonuc },
    };
  }

  if (action === "meslek_istifa") {
    const sonuc = await istifaEt(db, userId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "meslek_istifa", mesaj: sonuc.mesaj },
    };
  }

  if (action === "yetenek_antrenman") {
    const sonuc = await antrenmanYap(db, userId, player, extra.yetenek);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "yetenek_antrenman", ...sonuc },
    };
  }

  if (action === "maas_antrenman_kullan") {
    const sonuc = await maasAntrenmanKullan(db, userId, extra.yetenek);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "maas_antrenman_kullan", ...sonuc },
    };
  }

  if (action === "sirket_olustur") {
    const sonuc = await sirketOlustur(db, userId, player, extra.turId, extra.isim, extra.aciklama);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_olustur", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_yatir") {
    const sonuc = await sirketYatir(db, userId, player, extra.miktar);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_yatir", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_cek") {
    const sonuc = await sirketCek(db, userId, player, extra.miktar);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_cek", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_ise_alim") {
    const sonuc = await sirketIseAlimToggle(db, userId, !!extra.acik);
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_ise_alim", mesaj: sonuc.mesaj, gazeteHaber: !!sonuc.gazeteHaber },
    };
  }

  if (action === "sirket_basvur") {
    const sonuc = await sirketBasvur(db, userId, extra.sirketId, extra.pozisyonId);
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player), effect: { type: "sirket_basvur", mesaj: sonuc.mesaj } };
  }

  if (action === "sirket_basvuru_kabul") {
    const sonuc = await sirketBasvuruKabul(db, userId, extra.basvuruId, extra.gunlukMaas);
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player), effect: { type: "sirket_basvuru_kabul", mesaj: sonuc.mesaj } };
  }

  if (action === "sirket_basvuru_red") {
    const sonuc = await sirketBasvuruRed(db, userId, extra.basvuruId);
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player), effect: { type: "sirket_basvuru_red", mesaj: sonuc.mesaj } };
  }

  if (action === "sirket_maas_guncelle") {
    const sonuc = await sirketMaasGuncelle(db, userId, extra.calisanUserId, extra.gunlukMaas);
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player), effect: { type: "sirket_maas_guncelle", mesaj: sonuc.mesaj } };
  }

  if (action === "sirket_isten_cikar") {
    const sonuc = await sirketIstenCikar(db, userId, extra.calisanUserId);
    if (!sonuc.ok) return sonuc;
    return { ok: true, player: await publicPlayerFull(db, userId, player), effect: { type: "sirket_isten_cikar", mesaj: sonuc.mesaj } };
  }

  if (action === "sirket_istifa") {
    const sonuc = await sirketIstifaEt(db, userId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_istifa", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_zam_talep") {
    const sonuc = await sirketZamTalepEt(db, userId, extra.talepMaas);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_zam_talep", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_zam_onayla") {
    const sonuc = await sirketZamTalepOnayla(db, userId, extra.talepId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_zam_onayla", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_zam_reddet") {
    const sonuc = await sirketZamTalepReddet(db, userId, extra.talepId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_zam_reddet", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_kapat") {
    const sonuc = await sirketKapat(db, userId, player);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_kapat", mesaj: sonuc.mesaj, iadeKasa: sonuc.iadeKasa || 0 },
    };
  }

  if (action === "sirket_egitim") {
    const sonuc = await sirketEgitimVer(db, userId, player, extra.calisanUserId, extra.yetenek);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_egitim", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_malzeme_al") {
    const sonuc = await sirketMalzemeAl(db, userId, extra.malzemeId, extra.miktar);
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_malzeme_al", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_upgrade") {
    const sonuc = await sirketUpgrade(db, userId, extra.tipId);
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_upgrade", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_reklam") {
    const sonuc = await sirketReklamAyarla(db, userId, extra.seviye);
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_reklam", mesaj: sonuc.mesaj },
    };
  }

  if (action === "sirket_fiyat") {
    const sonuc = await sirketFiyatAyarla(db, userId, extra.carpan);
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "sirket_fiyat", mesaj: sonuc.mesaj },
    };
  }

  if (action === "premium_satin_al") {
    const sonuc = await premiumSatinAl(db, userId, key);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      mesaj: sonuc.mesaj,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "premium_satin_al", paket: sonuc.paket, mesaj: sonuc.mesaj },
    };
  }

  if (action === "elmas_satin_al") {
    const sonuc = await elmasPaketSatinAl(db, userId, key);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      mesaj: sonuc.mesaj,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "elmas_satin_al", paket: sonuc.paket, elmas: sonuc.toplamElmas },
    };
  }

  if (action === "icraat_paket_satin_al") {
    const sonuc = await icraatPaketSatinAl(db, userId);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      mesaj: sonuc.mesaj,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "icraat_paket_satin_al", mesaj: sonuc.mesaj, icraatPaket: sonuc.icraatPaket },
    };
  }

  return { ok: false, error: "Bilinmeyen aksiyon." };
}

module.exports = {
  loadPlayer,
  performAction,
  publicPlayer,
  publicPlayerFull,
  savePlayer,
  mesajlariGetir,
  mafyaSohbetListe,
  mekanTanim,
  sonrakiFiyat,
};
