const { run, get } = require("../db/database");
const { icraatHarca, syncIcraatRegen } = require("./icraatService");
const { gecerliProfilResmi } = require("./profilPortreler");
const { vipPortreEquipKontrol } = require("./vipPortreService");
const {
  SAG_KOL_BASLANGIC,
  SAG_KOL_MAX,
  SAG_KOL_ANTRENMAN_SURE_SN,
  SAG_KOL_ICRAAT,
  SAG_KOL_SATIN_AL_FIYAT,
  SAG_KOL_SAGLIK_MAX,
  SAG_KOL_SAGLIK_HASAR,
  SAG_KOL_SAGLIK_IYILESME,
  SAG_KOL_HASTANE_MALIYET_ORAN,
  SAG_KOL_HASTANE_FULL_CARPAN,
  SAG_KOL_VIP_IYILESME_ELMAS,
  SAG_KOL_VIP_FULL_ELMAS,
  ANTRENMAN_KAZANC,
  YETENEK_ANAHTARLAR,
  YETENEK_ETIKET,
  sagKolAntrenmanMaliyetTam,
  sagKolYetenekleriNormalize,
  sagKolOzeti,
  sagKolSeviyeAtlamaMi,
  sagKolMaxaUlastiMi,
  sagKolRutbeFromDeger,
} = require("./sagKolCatalog");

function jsonParse(raw, fallback) {
  try {
    if (raw == null || raw === "") return fallback;
    if (typeof raw === "object") return raw;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function simdiSn() {
  return Math.floor(Date.now() / 1000);
}

async function ensureSagKol(db) {
  const cols = [
    ["sag_kol_guc", `INTEGER NOT NULL DEFAULT ${SAG_KOL_BASLANGIC}`],
    ["sag_kol_zeka", `INTEGER NOT NULL DEFAULT ${SAG_KOL_BASLANGIC}`],
    ["sag_kol_dayaniklilik", `INTEGER NOT NULL DEFAULT ${SAG_KOL_BASLANGIC}`],
    ["sag_kol_beceri", `INTEGER NOT NULL DEFAULT ${SAG_KOL_BASLANGIC}`],
    ["sag_kol_antrenman_json", "TEXT DEFAULT ''"],
    ["sag_kol_gunluk_json", "TEXT DEFAULT '{}'"],
    ["sag_kol_gunluk_gun", "TEXT DEFAULT ''"],
    ["sag_kol_profil_resmi", "TEXT DEFAULT ''"],
    ["sag_kol_sahip", "INTEGER NOT NULL DEFAULT 0"],
    ["sag_kol_saglik", `INTEGER NOT NULL DEFAULT ${SAG_KOL_SAGLIK_MAX}`],
  ];
  for (const [col, def] of cols) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
  // Daha önce kullanmış oyunculara sahiplik ver (yeni hesaplara otomatik verilmez)
  try {
    await run(
      db,
      `UPDATE players SET sag_kol_sahip = 1
       WHERE COALESCE(sag_kol_sahip, 0) = 0
         AND (
           COALESCE(sag_kol_guc, 1) > 1
           OR COALESCE(sag_kol_zeka, 1) > 1
           OR COALESCE(sag_kol_dayaniklilik, 1) > 1
           OR COALESCE(sag_kol_beceri, 1) > 1
           OR (COALESCE(sag_kol_antrenman_json, '') != '' AND sag_kol_antrenman_json IS NOT NULL)
           OR (COALESCE(sag_kol_profil_resmi, '') != '' AND sag_kol_profil_resmi IS NOT NULL)
         )`
    );
  } catch (_) {}
}

async function sagKolSahipMi(db, userId) {
  await ensureSagKol(db);
  const row = await get(db, `SELECT sag_kol_sahip FROM players WHERE user_id = ?`, [userId]);
  return !!Number(row?.sag_kol_sahip || 0);
}

async function satinAl(db, userId, player) {
  await ensureSagKol(db);
  if (await sagKolSahipMi(db, userId)) {
    return { ok: false, error: "Zaten bir sağ kolun var." };
  }
  const fiyat = SAG_KOL_SATIN_AL_FIYAT;
  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ?, sag_kol_sahip = 1, sag_kol_saglik = ?
     WHERE user_id = ? AND kasa >= ? AND COALESCE(sag_kol_sahip, 0) = 0`,
    [fiyat, SAG_KOL_SAGLIK_MAX, userId, fiyat]
  );
  if (!deduct?.changes) {
    const row = await get(db, `SELECT kasa, sag_kol_sahip FROM players WHERE user_id = ?`, [userId]);
    if (Number(row?.sag_kol_sahip || 0)) {
      return { ok: false, error: "Zaten bir sağ kolun var." };
    }
    return {
      ok: false,
      error: `Sağ kol satın almak için ${fiyat.toLocaleString("tr-TR")} TL gerekli.`,
    };
  }
  if (player) player.kasa = (player.kasa || 0) - fiyat;
  const panel = await panelGetir(db, userId);
  return {
    ok: true,
    mesaj: "Sağ kolunu satın aldın! Artık eğitebilirsin.",
    fiyat,
    sahip: true,
    panel,
  };
}

async function sagKolYetenekleriOku(db, userId) {
  await ensureSagKol(db);
  const row = await get(
    db,
    `SELECT sag_kol_guc, sag_kol_zeka, sag_kol_dayaniklilik, sag_kol_beceri
     FROM players WHERE user_id = ?`,
    [userId]
  );
  return sagKolYetenekleriNormalize({
    guc: row?.sag_kol_guc,
    zeka: row?.sag_kol_zeka,
    dayaniklilik: row?.sag_kol_dayaniklilik,
    beceri: row?.sag_kol_beceri,
  });
}

async function sagKolYetenekleriYaz(db, userId, yetenekler) {
  await ensureSagKol(db);
  const y = sagKolYetenekleriNormalize(yetenekler);
  await run(
    db,
    `UPDATE players SET sag_kol_guc=?, sag_kol_zeka=?, sag_kol_dayaniklilik=?, sag_kol_beceri=?
     WHERE user_id = ?`,
    [y.guc, y.zeka, y.dayaniklilik, y.beceri, userId]
  );
  return y;
}

async function aktifAntrenmanOku(db, userId) {
  await ensureSagKol(db);
  const row = await get(db, `SELECT sag_kol_antrenman_json FROM players WHERE user_id = ?`, [userId]);
  const raw = jsonParse(row?.sag_kol_antrenman_json, null);
  if (!raw || !raw.bitisTs) return null;
  const now = simdiSn();
  const kalanSaniye = Math.max(0, raw.bitisTs - now);
  return {
    yetenek: raw.yetenek,
    yetenekAd: YETENEK_ETIKET[raw.yetenek] || raw.yetenek,
    basladiTs: raw.basladiTs,
    bitisTs: raw.bitisTs,
    kazanc: raw.kazanc || ANTRENMAN_KAZANC,
    tlMaliyet: raw.tlMaliyet || 0,
    seviyeAtlama: !!raw.seviyeAtlama,
    kalanSaniye,
    tamamlanabilir: kalanSaniye <= 0,
    sureSn: SAG_KOL_ANTRENMAN_SURE_SN,
  };
}

async function aktifAntrenmanYaz(db, userId, session) {
  await ensureSagKol(db);
  const val = session ? JSON.stringify(session) : "";
  await run(db, `UPDATE players SET sag_kol_antrenman_json = ? WHERE user_id = ?`, [val, userId]);
}

async function profilResmiOku(db, userId) {
  await ensureSagKol(db);
  const row = await get(db, `SELECT sag_kol_profil_resmi FROM players WHERE user_id = ?`, [userId]);
  return gecerliProfilResmi(row?.sag_kol_profil_resmi) || "";
}

async function saglikOku(db, userId) {
  await ensureSagKol(db);
  const row = await get(db, `SELECT sag_kol_saglik, sag_kol_sahip FROM players WHERE user_id = ?`, [userId]);
  if (!Number(row?.sag_kol_sahip || 0)) {
    return { sahip: false, saglik: 0, saglikMax: SAG_KOL_SAGLIK_MAX, aktif: false, hastanelik: false };
  }
  const raw = row?.sag_kol_saglik;
  const saglik =
    raw == null || raw === ""
      ? SAG_KOL_SAGLIK_MAX
      : Math.max(0, Math.min(SAG_KOL_SAGLIK_MAX, Math.floor(Number(raw))));
  if (Number.isNaN(saglik)) {
    return {
      sahip: true,
      saglik: SAG_KOL_SAGLIK_MAX,
      saglikMax: SAG_KOL_SAGLIK_MAX,
      aktif: true,
      hastanelik: false,
    };
  }
  return {
    sahip: true,
    saglik,
    saglikMax: SAG_KOL_SAGLIK_MAX,
    aktif: saglik > 0,
    hastanelik: saglik <= 0,
  };
}

/** Savaş sonrası sağ kol canı düşür (sahip değilse no-op) */
async function saglikAzalt(db, userId, miktar = SAG_KOL_SAGLIK_HASAR) {
  await ensureSagKol(db);
  if (!(await sagKolSahipMi(db, userId))) {
    return { ok: true, sahip: false, saglik: 0, azaltildi: 0 };
  }
  const onceki = await saglikOku(db, userId);
  const hasar = Math.max(0, Math.floor(Number(miktar) || 0));
  const yeni = Math.max(0, onceki.saglik - hasar);
  await run(db, `UPDATE players SET sag_kol_saglik = ? WHERE user_id = ?`, [yeni, userId]);
  return {
    ok: true,
    sahip: true,
    saglik: yeni,
    saglikMax: SAG_KOL_SAGLIK_MAX,
    azaltildi: onceki.saglik - yeni,
    onceki: onceki.saglik,
    hastanelik: yeni <= 0,
    aktif: yeni > 0,
  };
}

async function hastaneSaatlikKazanc(db, userId) {
  const { oyuncuSaatlikKazanc } = require("./saatlikGelirService");
  return Math.max(0, Math.floor(Number(await oyuncuSaatlikKazanc(db, userId)) || 0));
}

async function hastaneIyilestirMaliyet(db, userId, opts = {}) {
  const saatlik = await hastaneSaatlikKazanc(db, userId);
  const full = !!opts.full;
  if (full) {
    return Math.max(1, Math.floor(saatlik * SAG_KOL_HASTANE_FULL_CARPAN));
  }
  return Math.max(1, Math.floor(saatlik * SAG_KOL_HASTANE_MALIYET_ORAN));
}

/**
 * Yeraltı hastanesi (TL) veya V.I.P (elmas):
 * - can > 0: +10
 * - can = 0: full 150 taburcu
 * opts.vip → elmas (3 / 35), aksi halde TL (saatlik %10 / 2.5×)
 */
async function hastaneIyilestir(db, userId, player, opts = {}) {
  await ensureSagKol(db);
  if (!(await sagKolSahipMi(db, userId))) {
    return { ok: false, error: "Önce sağ kol satın almalısın." };
  }
  const durum = await saglikOku(db, userId);
  if (durum.saglik >= SAG_KOL_SAGLIK_MAX) {
    return { ok: false, error: "Sağ kolun zaten tam sağlıklı." };
  }

  const vip = !!opts.vip;
  // VIP: opts.full ile her zaman full (35 elmas); can=0 zaten taburcu
  const fullCikis = (vip && !!opts.full) || durum.saglik <= 0 || durum.hastanelik;
  const yeniSaglik = fullCikis
    ? SAG_KOL_SAGLIK_MAX
    : Math.min(SAG_KOL_SAGLIK_MAX, durum.saglik + SAG_KOL_SAGLIK_IYILESME);

  if (vip) {
    const maliyetElmas = fullCikis ? SAG_KOL_VIP_FULL_ELMAS : SAG_KOL_VIP_IYILESME_ELMAS;
    const elmas = Math.max(0, Math.floor(Number(player?.elmas) || 0));
    if (elmas < maliyetElmas) {
      return {
        ok: false,
        error: `Yeterli elmasın yok! ${maliyetElmas} elmas gerekir.`,
      };
    }
    const deduct = await run(
      db,
      `UPDATE players SET elmas = elmas - ?, sag_kol_saglik = ?
       WHERE user_id = ? AND elmas >= ? AND COALESCE(sag_kol_sahip, 0) = 1`,
      [maliyetElmas, yeniSaglik, userId, maliyetElmas]
    );
    if (!deduct?.changes) {
      return {
        ok: false,
        error: `Yeterli elmasın yok! ${maliyetElmas} elmas gerekir.`,
      };
    }
    if (player) player.elmas = elmas - maliyetElmas;
    const yeni = await saglikOku(db, userId);
    const panel = await panelGetir(db, userId);
    const mesaj = fullCikis
      ? `VIP hastane: Sağ kol taburcu! Sağlık ${yeni.saglik}/${SAG_KOL_SAGLIK_MAX}.`
      : `VIP hastane: Sağ kol +${SAG_KOL_SAGLIK_IYILESME} sağlık (${yeni.saglik}/${SAG_KOL_SAGLIK_MAX}).`;
    return {
      ok: true,
      mesaj,
      vip: true,
      maliyetElmas,
      fullCikis,
      iyilesme: fullCikis ? SAG_KOL_SAGLIK_MAX - durum.saglik : SAG_KOL_SAGLIK_IYILESME,
      saglik: yeni.saglik,
      saglikMax: SAG_KOL_SAGLIK_MAX,
      hastanelik: yeni.hastanelik,
      aktif: yeni.aktif,
      panel,
    };
  }

  const maliyet = await hastaneIyilestirMaliyet(db, userId, { full: fullCikis });
  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ?, sag_kol_saglik = ?
     WHERE user_id = ? AND kasa >= ? AND COALESCE(sag_kol_sahip, 0) = 1`,
    [maliyet, yeniSaglik, userId, maliyet]
  );
  if (!deduct?.changes) {
    return {
      ok: false,
      error: `Tedavi için ${maliyet.toLocaleString("tr-TR")} TL gerekli.`,
    };
  }
  if (player) player.kasa = (player.kasa || 0) - maliyet;
  const yeni = await saglikOku(db, userId);
  const panel = await panelGetir(db, userId);
  const mesaj = fullCikis
    ? `Sağ kol hastaneden çıktı! Sağlık ${yeni.saglik}/${SAG_KOL_SAGLIK_MAX}.`
    : `Sağ kol +${SAG_KOL_SAGLIK_IYILESME} sağlık kazandı (${yeni.saglik}/${SAG_KOL_SAGLIK_MAX}).`;
  return {
    ok: true,
    mesaj,
    vip: false,
    maliyet,
    fullCikis,
    iyilesme: fullCikis ? SAG_KOL_SAGLIK_MAX - durum.saglik : SAG_KOL_SAGLIK_IYILESME,
    saglik: yeni.saglik,
    saglikMax: SAG_KOL_SAGLIK_MAX,
    hastanelik: yeni.hastanelik,
    aktif: yeni.aktif,
    panel,
  };
}

async function panelGetir(db, userId) {
  const sahip = await sagKolSahipMi(db, userId);
  if (!sahip) {
    return {
      sahip: false,
      satinAlFiyat: SAG_KOL_SATIN_AL_FIYAT,
      yetenekler: null,
      ozet: null,
      aktifAntrenman: null,
      profilResmi: "",
      rutbeId: null,
      rutbeAd: null,
      saglik: 0,
      saglikMax: SAG_KOL_SAGLIK_MAX,
      aktif: false,
      hastanelik: false,
      hastaneMaliyet: 0,
      vipIyilesmeElmas: SAG_KOL_VIP_IYILESME_ELMAS,
      vipFullElmas: SAG_KOL_VIP_FULL_ELMAS,
      elmas: 0,
    };
  }
  const yetenekler = await sagKolYetenekleriOku(db, userId);
  const ozet = sagKolOzeti(yetenekler);
  const aktifAntrenman = await aktifAntrenmanOku(db, userId);
  const icraatSync = await syncIcraatRegen(db, userId);
  const profilResmi = await profilResmiOku(db, userId);
  const saglikDurum = await saglikOku(db, userId);
  const elmasRow = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
  let hastaneMaliyet = 0;
  try {
    hastaneMaliyet = await hastaneIyilestirMaliyet(db, userId, {
      full: saglikDurum.hastanelik || saglikDurum.saglik <= 0,
    });
  } catch (_) {}
  const fullCikis = saglikDurum.hastanelik || saglikDurum.saglik <= 0;
  const statMaliyet = {};
  for (const key of YETENEK_ANAHTARLAR) {
    statMaliyet[key] = sagKolAntrenmanMaliyetTam(yetenekler[key]);
  }
  return {
    sahip: true,
    satinAlFiyat: SAG_KOL_SATIN_AL_FIYAT,
    yetenekler,
    ozet,
    aktifAntrenman,
    antrenmanSureDk: SAG_KOL_ANTRENMAN_SURE_SN / 60,
    icraatMaliyet: SAG_KOL_ICRAAT,
    icraat: icraatSync.icraat,
    statMaliyet,
    maliyetCarpan: 1.5,
    profilResmi,
    rutbe: ozet.rutbe,
    rutbeId: ozet.rutbeId,
    rutbeAd: ozet.rutbeAd,
    saglik: saglikDurum.saglik,
    saglikMax: saglikDurum.saglikMax,
    aktif: saglikDurum.aktif,
    hastanelik: saglikDurum.hastanelik,
    hastaneMaliyet,
    hastaneFullCikis: fullCikis,
    iyilesmeMiktar: SAG_KOL_SAGLIK_IYILESME,
    vipIyilesmeElmas: SAG_KOL_VIP_IYILESME_ELMAS,
    vipFullElmas: SAG_KOL_VIP_FULL_ELMAS,
    vipMaliyetElmas: fullCikis ? SAG_KOL_VIP_FULL_ELMAS : SAG_KOL_VIP_IYILESME_ELMAS,
    elmas: Math.max(0, Math.floor(Number(elmasRow?.elmas) || 0)),
  };
}

/** Rakip profilinde gösterilen: yalnızca portre + rütbe (yetenek/maliyet yok) */
async function ziyaretciOzeti(db, userId) {
  const sahip = await sagKolSahipMi(db, userId);
  if (!sahip) {
    return { sahip: false };
  }
  const yetenekler = await sagKolYetenekleriOku(db, userId);
  const ozet = sagKolOzeti(yetenekler);
  const profilResmi = await profilResmiOku(db, userId);
  const saglikDurum = await saglikOku(db, userId);
  return {
    sahip: true,
    profilResmi,
    rutbeId: ozet.rutbeId,
    rutbeAd: ozet.rutbeAd,
    rutbeIcon: ozet.rutbeIcon || "",
    rutbeler: ozet.rutbeler || [],
    saglik: saglikDurum.saglik,
    saglikMax: saglikDurum.saglikMax,
    aktif: saglikDurum.aktif,
    hastanelik: saglikDurum.hastanelik,
    ozet: {
      rutbeId: ozet.rutbeId,
      rutbeAd: ozet.rutbeAd,
      rutbeIcon: ozet.rutbeIcon || "",
      rutbeler: ozet.rutbeler || [],
    },
  };
}

async function profilResmiKaydet(db, userId, profilResmi, opts = {}) {
  await ensureSagKol(db);
  if (!(await sagKolSahipMi(db, userId))) {
    return { ok: false, error: "Önce sağ kol satın almalısın." };
  }
  const portre = gecerliProfilResmi(profilResmi);
  if (!portre) return { ok: false, error: "Geçersiz profil resmi." };

  const izin = await vipPortreEquipKontrol(db, userId, portre, {
    kaliciSec: !!opts.kaliciSec,
  });
  if (!izin.ok) return izin;

  await run(db, `UPDATE players SET sag_kol_profil_resmi = ? WHERE user_id = ?`, [portre, userId]);
  const panel = await panelGetir(db, userId);
  return {
    ok: true,
    profilResmi: portre,
    panel,
    kaliciYapildi: !!izin.kaliciYapildi,
  };
}

async function antrenmanBaslat(db, userId, player, yetenekKey) {
  if (!(await sagKolSahipMi(db, userId))) {
    return { ok: false, error: "Önce sağ kol satın almalısın." };
  }
  const saglikDurum = await saglikOku(db, userId);
  if (saglikDurum.hastanelik || saglikDurum.saglik <= 0) {
    return {
      ok: false,
      error: "Sağ kolun hastanelik. Spor salonuna giremez, önce tedavi et.",
    };
  }
  if (!YETENEK_ANAHTARLAR.includes(yetenekKey)) {
    return { ok: false, error: "Geçersiz yetenek." };
  }

  const mevcutOturum = await aktifAntrenmanOku(db, userId);
  if (mevcutOturum) {
    if (mevcutOturum.tamamlanabilir) {
      return {
        ok: false,
        error: "Sağ kol antrenmanını önce tamamlamalısın.",
        tamamlanabilir: true,
        aktifAntrenman: mevcutOturum,
      };
    }
    const dk = Math.ceil(mevcutOturum.kalanSaniye / 60);
    return {
      ok: false,
      error: `Sağ kol antrenmanı devam ediyor. ${dk} dakika sonra yeni antrenman başlatabilirsin.`,
      aktifAntrenman: mevcutOturum,
    };
  }

  const yetenekler = await sagKolYetenekleriOku(db, userId);
  const mevcut = yetenekler[yetenekKey];
  if (sagKolMaxaUlastiMi(mevcut)) {
    return { ok: false, error: "Bu yetenek en yüksek seviyede." };
  }
  const seviyeAtlama = sagKolSeviyeAtlamaMi(mevcut);
  const tl = sagKolAntrenmanMaliyetTam(mevcut);
  if (tl == null || tl <= 0) {
    return { ok: false, error: "Antrenman maliyeti hesaplanamadı." };
  }

  const icraatSonuc = await icraatHarca(db, userId, SAG_KOL_ICRAAT);
  if (!icraatSonuc.ok) return icraatSonuc;
  player.icraat = icraatSonuc.icraat;

  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
    [tl, userId, tl]
  );
  if (!deduct?.changes) {
    return { ok: false, error: `Sağ kol antrenmanı için ${tl.toLocaleString("tr-TR")} TL gerekli.` };
  }
  player.kasa = (player.kasa || 0) - tl;

  const now = simdiSn();
  const session = {
    yetenek: yetenekKey,
    basladiTs: now,
    bitisTs: now + SAG_KOL_ANTRENMAN_SURE_SN,
    kazanc: ANTRENMAN_KAZANC,
    tlMaliyet: tl,
    seviyeAtlama: !!seviyeAtlama,
  };
  await aktifAntrenmanYaz(db, userId, session);

  const etiket = YETENEK_ETIKET[yetenekKey] || yetenekKey;
  const aktifAntrenman = await aktifAntrenmanOku(db, userId);
  const mesaj = seviyeAtlama
    ? `Sağ kol ${etiket} seviye atlama antrenmanı başladı! 1,5 saat sonra tamamlanacak.`
    : `Sağ kol ${etiket} antrenmanı başladı! 1,5 saat sonra +${ANTRENMAN_KAZANC} kazanacak.`;
  return {
    ok: true,
    mesaj,
    basladi: true,
    yetenek: yetenekKey,
    tlMaliyet: tl,
    seviyeAtlama: !!seviyeAtlama,
    aktifAntrenman,
  };
}

async function antrenmanTamamla(db, userId) {
  if (!(await sagKolSahipMi(db, userId))) {
    return { ok: false, error: "Önce sağ kol satın almalısın." };
  }
  const oturum = await aktifAntrenmanOku(db, userId);
  if (!oturum) {
    return { ok: false, error: "Tamamlanacak sağ kol antrenmanı yok." };
  }
  if (!oturum.tamamlanabilir) {
    const dk = Math.ceil(oturum.kalanSaniye / 60);
    const sn = oturum.kalanSaniye % 60;
    return {
      ok: false,
      error: `Sağ kol antrenmanı henüz bitmedi. ${dk} dk ${sn} sn kaldı.`,
      aktifAntrenman: oturum,
    };
  }

  const yetenekler = await sagKolYetenekleriOku(db, userId);
  const key = oturum.yetenek;
  const onceki = yetenekler[key] || SAG_KOL_BASLANGIC;
  const kazanc = oturum.kazanc || ANTRENMAN_KAZANC;
  const seviyeAtlama = !!oturum.seviyeAtlama || sagKolSeviyeAtlamaMi(onceki);
  yetenekler[key] = Math.min(SAG_KOL_MAX, onceki + kazanc);
  const normalized = await sagKolYetenekleriYaz(db, userId, yetenekler);
  await aktifAntrenmanYaz(db, userId, null);

  const etiket = YETENEK_ETIKET[key] || key;
  const yeniRutbe = sagKolRutbeFromDeger(normalized[key]);
  const mesaj = seviyeAtlama
    ? `Sağ kol ${etiket} seviye atladı! Yeni rütbe: ${yeniRutbe.ad} (${normalized[key]}).`
    : `Sağ kol ${etiket} +${kazanc}! Antrenman tamamlandı.`;
  return {
    ok: true,
    mesaj,
    tamamlandi: true,
    yetenek: key,
    yetenekKazanc: kazanc,
    yeniDeger: normalized[key],
    seviyeAtlama,
    rutbeAd: yeniRutbe.ad,
    yetenekler: normalized,
    ozet: sagKolOzeti(normalized),
  };
}

module.exports = {
  ensureSagKol,
  sagKolSahipMi,
  satinAl,
  sagKolYetenekleriOku,
  sagKolYetenekleriYaz,
  aktifAntrenmanOku,
  saglikOku,
  saglikAzalt,
  hastaneIyilestir,
  hastaneIyilestirMaliyet,
  panelGetir,
  ziyaretciOzeti,
  profilResmiOku,
  profilResmiKaydet,
  antrenmanBaslat,
  antrenmanTamamla,
};
