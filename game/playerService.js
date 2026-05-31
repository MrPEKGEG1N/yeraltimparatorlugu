const { run, get, all } = require("../db/database");
const { HIRE, JOBS, COUNCIL, ICRAAT_MAX, ICRAAT_REGEN_SEC } = require("./catalog");
const {
  processLimanIncome,
  limanCok,
  babaCok,
  babaDerkiKaydet,
  sadakatOy,
  dusmanaCok,
  getLimanDurumu,
  getBabaDurumu,
  sanitizeDunyaForClient,
  LIMAN_SAATLIK,
} = require("./worldService");
const { processSectorIncome, sektorPanel, mekanAl, mekanDevret } = require("./sectorService");
const { karaListeSenkronize } = require("./karaListeService");
const { logStatHareket } = require("./statService");
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
} = require("./messagingService");
const {
  rusvetMiktari,
  getDevletIliskisi,
  devletDusur,
  hapisKontrol,
  rusvetVer,
} = require("./devletService");
const {
  getIstihbarat,
  elemanAl,
  oyuncuGucunuOgren,
} = require("./istihbaratService");
const {
  getBanka,
  paraYatir,
  paraCek,
} = require("./bankaService");
const {
  savasIlanEt,
  savasaKatil,
  savaslariListele,
} = require("./mafyaSavasService");
const { isKatil, isGerceklestir } = require("./mafyaIsService");
const { eviGetir, hibeEt, seviyeYukselt } = require("./mafyaEviService");
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
} = require("./mafiaService");

function rowToPlayer(row) {
  return {
    kasa: row.kasa,
    guc: row.guc,
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
    grup: row.grup,
    lakap: row.lakap || "Mafya",
    profilAciklama: row.profil_aciklama || "",
    dostlar: row.dostlar || "",
    dusmanlar: row.dusmanlar || "",
    userId: row.user_id,
  };
}

function applyIcraatRegen(player) {
  const now = Math.floor(Date.now() / 1000);
  if (player.icraat >= ICRAAT_MAX) {
    player.last_icraat_at = now;
    return player;
  }
  const elapsed = now - player.last_icraat_at;
  const ticks = Math.floor(elapsed / ICRAAT_REGEN_SEC);
  if (ticks <= 0) return player;

  const add = Math.min(ticks, ICRAAT_MAX - player.icraat);
  player.icraat += add;
  player.last_icraat_at += add * ICRAAT_REGEN_SEC;
  return player;
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

  const now = Math.floor(Date.now() / 1000);
  const lastSeen = row.last_seen_at || 0;
  const offlineHours = lastSeen > 0 ? Math.floor((now - lastSeen) / 3600) : 0;

  let player = applyIcraatRegen(rowToPlayer(row));
  const raw = await get(db, "SELECT icraat, last_icraat_at FROM players WHERE user_id = ?", [
    userId,
  ]);
  if (player.icraat !== raw.icraat || player.last_icraat_at !== raw.last_icraat_at) {
    await savePlayer(db, userId, player);
  }
  player = await processLimanIncome(db, userId, player);
  player = await processSectorIncome(db, userId, player);

  let offlineWelcome = null;
  if (offlineHours >= 1) {
    const limanlar = await getLimanDurumu(db);
    const sahipLiman = limanlar.filter((l) => l.sahipUserId === userId).length;
    const { saatlikKazanc } = await sektorPanel(db, userId);
    const saatlik = sahipLiman * LIMAN_SAATLIK + (saatlikKazanc || 0);
    const income = Math.floor(offlineHours * saatlik);
    if (income > 0) {
      player.kasa += income;
      await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
    }
    offlineWelcome = { hours: offlineHours, income, saatlik };
  }
  player.offlineWelcome = offlineWelcome;

  await run(db, `UPDATE players SET last_seen_at = ? WHERE user_id = ?`, [now, userId]);

  return player;
}

async function savePlayer(db, userId, player) {
  await run(
    db,
    `UPDATE players SET
      kasa = ?, guc = ?, puan = ?, icraat = ?,
      liman_istanbul = ?, last_icraat_at = ?
     WHERE user_id = ?`,
    [
      player.kasa,
      player.guc,
      player.puan,
      player.icraat,
      player.limanlar && player.limanlar.istanbul ? 1 : 0,
      player.last_icraat_at,
      userId,
    ]
  );
  return player;
}

async function publicPlayerFull(db, userId, player) {
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
  const limanSaatlik = sahipLimanlar.length * LIMAN_SAATLIK;
  const devletIliskisi = await getDevletIliskisi(db, userId);
  const smsHakki = await getSmsHakki(db, userId);
  const okunmamisMesaj = (await okunmamisSayisi(db, userId)) > 0;
  const rusvet = rusvetMiktari(player.puan);
  const istihbaratEleman = await getIstihbarat(db, userId);
  const bankaBakiye = await getBanka(db, userId);
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
  return {
    userId,
    kasa: player.kasa,
    guc: player.guc,
    puan: player.puan,
    icraat: player.icraat,
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
    devletIliskisi,
    smsHakki,
    saatlikKazanc: limanSaatlik + sektorSaatlik,
    sektorSahiplik: sahiplik,
    rusvet,
    mafyaBildirim,
    okunmamisMesaj,
    mekanlar: MEKANLAR,
    dunya: sanitizeDunyaForClient({ limanlar, baba }),
    sehirEfsane: !!(kara && kara.sehir_efsane),
    istihbaratEleman,
    bankaBakiye,
    karaListede: !!(kara && kara.kara_listede),
    sehirBanner,
    yeniProfilZiyaret: ziyaretRow?.n || 0,
    offlineWelcome: player.offlineWelcome || null,
    yeniGazeteHaber,
  };
}

function publicPlayer(player) {
  return {
    kasa: player.kasa,
    guc: player.guc,
    puan: player.puan,
    icraat: player.icraat,
    limanlar: player.limanlar,
    reisAdi: player.reisAdi,
    username: player.username,
    grup: player.grup,
  };
}

async function performAction(db, userId, action, key, adet = 1, extra = {}) {
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
    const item = HIRE[key];
    if (!item) return { ok: false, error: "Geçersiz satın alma." };
    const miktar = Math.min(999, Math.max(1, parseInt(adet, 10) || 1));
    const toplamMaliyet = item.maliyet * miktar;
    const toplamGuc = item.guc * miktar;
    if (player.kasa < toplamMaliyet) {
      return {
        ok: false,
        error: `Kasanda yeterli nakit yok! ${miktar} adet için ${toplamMaliyet.toLocaleString("tr-TR")} TL gerekir.`,
      };
    }
    player.kasa -= toplamMaliyet;
    player.guc += toplamGuc;
    await savePlayer(db, userId, player);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "hire", unvan: item.unvan, guc: toplamGuc, adet: miktar, toplamMaliyet },
    };
  }

  if (action === "job") {
    const hapis = await hapisKontrol(db, userId);
    if (!hapis.ok) return hapis;
    const job = JOBS[key];
    if (!job) return { ok: false, error: "Geçersiz iş." };
    if (player.guc < job.minGuc) {
      return {
        ok: false,
        error: `Gücün yetersiz! En az ${job.minGuc.toLocaleString("tr-TR")} güce ihtiyacın var.`,
      };
    }
    if (player.icraat < job.icraat) {
      return { ok: false, error: "Yeterli İcraat Hakkın kalmadı! Biraz bekle." };
    }
    player.icraat -= job.icraat;
    player.kasa += job.netKazanc;
    player.puan += job.puan;
    // Decrease state relations when performing actions
    await devletDusur(db, userId, Math.min(5, job.icraat + 2));
    await savePlayer(db, userId, player);
    await logStatHareket(db, userId, "sayginlik", job.puan);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "job",
        isAdi: job.isAdi,
        netKazanc: job.netKazanc,
        icraat: job.icraat,
        gorselKey: job.gorselKey,
      },
    };
  }

  if (action === "liman_cok") {
    const sonuc = await limanCok(db, userId, player, key);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "liman_cok", mesaj: sonuc.mesaj, limanId: key },
    };
  }

  if (action === "baba_cok") {
    const sonuc = await babaCok(db, userId, player, key);
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
    const sonuc = await dusmanaCok(db, userId, player, extra.hedef || key);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: {
        type: "dusmana_cok",
        mesaj: sonuc.mesaj,
        kazandi: sonuc.kazandi,
        ...(sonuc.effect || {}),
      },
    };
  }

  if (action === "mekan_al") {
    const [sektor, mekanKey] = String(key || "").split(":");
    const sonuc = await mekanAl(db, userId, player, sektor, mekanKey);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
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
      effect: { type: "rusvet", mesaj: `Devlet ilişkin ${sonuc.devletIliskisi} oldu.`, odenen: sonuc.odenen },
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
    player.grup = sonuc.isim + " Mafya Grubu";
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
      effect: { type: "istihbarat_al", elemanSayisi: sonuc.elemanSayisi, odenen: sonuc.odenen },
    };
  }

  if (action === "istihbarat_spy") {
    const sonuc = await oyuncuGucunuOgren(db, userId, extra.hedef);
    if (!sonuc.ok) return sonuc;
    return {
      ok: true,
      effect: { type: "istihbarat_spy", ...sonuc },
    };
  }

  if (action === "banka_yatir") {
    const sonuc = await paraYatir(db, userId, player);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "banka_yatir", yatirilan: sonuc.yatirilan, toplam: sonuc.toplam },
    };
  }

  if (action === "banka_cek") {
    const sonuc = await paraCek(db, userId, player);
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
    const adet = parseInt(extra.adet, 10) || 1;
    if (!hedefAdi) return { ok: false, error: "Dost reis adı gerekli." };
    if (!sektor || !mekanKey) return { ok: false, error: "Devredilecek mekan seç." };

    const hedef = await get(
      db,
      `SELECT id, reis_adi FROM users WHERE LOWER(reis_adi) = LOWER(?) OR LOWER(username) = LOWER(?)`,
      [hedefAdi, hedefAdi]
    );
    if (!hedef) return { ok: false, error: "Bu isimde oyuncu bulunamadı." };
    if (hedef.id === userId) return { ok: false, error: "Kendine mekan devredemezsin." };

    const sonuc = await mekanDevret(db, userId, hedef.id, sektor, mekanKey, adet);
    if (!sonuc.ok) return sonuc;
    player = await loadPlayer(db, userId);
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mekan_devri", mesaj: sonuc.mesaj },
    };
  }

  if (action === "mafya_savas_ilan") {
    const grup = await kullaniciGrubu(db, userId);
    const benLiderim = !!grup && grup.lider_user_id === userId;
    if (!grup || !benLiderim) {
      return { ok: false, error: "Sadece grup lideri savaş ilan edebilir." };
    }

    // Lider, hedef gurup adını yazarak savaş ilan edebilsin
    const hedefAd = String(extra.hedefGrupAdi || extra.hedef || "").trim();
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
    return sonuc;
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
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
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
    return {
      ok: true,
      player: await publicPlayerFull(db, userId, player),
      effect: { type: "mafya_evi", mesaj: "Mafya Evi seviyesi yükseltildi!" },
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
