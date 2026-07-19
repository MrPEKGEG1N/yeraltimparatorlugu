const crypto = require("crypto");
const { run, get } = require("../db/database");
const { JOBS } = require("./catalog");
const { icraatHarca } = require("./icraatService");
const { toplamGuc } = require("./gucService");
const {
  rastgeleAvukatDususu,
  clampAvukatIliskisi,
  getDevletIliskisi,
} = require("./devletService");
const { logStatHareket } = require("./statService");
const { gorevOlayIsle } = require("./gunlukGorevService");

const DIRECT_SUCCESS_CHANCE = 0.6;
const SOKAK_EXTRA_ICRAAT = 1;
const FIRSAT_EXTRA_ICRAAT = 2;
const MUHBIR_EXTRA_ICRAAT = 1;
const TEKNIK_EXTRA_ICRAAT = 1;
const SOKAK_TIMER_MS = 30000;
const FAIL_PARA_ORANI = 0.4;
const GRACE_MS = 2500;
const FIRSAT_BONUS_MIN = 20;
const FIRSAT_BONUS_MAX = 50;
const FIRSAT_BEKLE_MS = 5 * 60 * 1000;
const MUHBIR_RUSVET_ORANI = 0.5;
const MUHBIR_GUC_KAYIP_ORANI = 0.01;
const MUHBIR_ICRAAT_KAYIP = 1;
const MUHBIR_TIMER_MS = SOKAK_TIMER_MS;
const TEKNIK_YARIM_ORANI = 0.5;
const TEKNIK_KIR_YAKALANMA = 0.5;
const POLIS_EXTRA_ICRAAT = 1;
const POLIS_SOY_KAC_YAKALANMA = 0.5;
const SECIMLI_OLAY_TIPLERI = new Set(["muhbir", "teknik_ariza", "polis_baskini"]);

function secimliOlayMi(tip) {
  return SECIMLI_OLAY_TIPLERI.has(tip);
}

function jsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function rastgeleFirsatBonusu() {
  return FIRSAT_BONUS_MIN + Math.floor(Math.random() * (FIRSAT_BONUS_MAX - FIRSAT_BONUS_MIN + 1));
}

const FIRSAT_OLAY_ORANI = 0.125; // olay havuzunda %12.5 (onceki %25'in yarisi)
const DIGER_OLAY_ORANI = (1 - FIRSAT_OLAY_ORANI) / 4;

function olayTipiSec() {
  const r = Math.random();
  if (r < DIGER_OLAY_ORANI) return "sokak_kavgasi";
  if (r < DIGER_OLAY_ORANI + FIRSAT_OLAY_ORANI) return "sansli_firsat";
  if (r < DIGER_OLAY_ORANI * 2 + FIRSAT_OLAY_ORANI) return "muhbir";
  if (r < DIGER_OLAY_ORANI * 3 + FIRSAT_OLAY_ORANI) return "teknik_ariza";
  return "polis_baskini";
}

async function ensureJobOlay(db) {
  try {
    await run(db, `ALTER TABLE players ADD COLUMN job_olay_json TEXT DEFAULT ''`);
  } catch (_) {}
}

async function jobOlayOku(db, userId) {
  await ensureJobOlay(db);
  const row = await get(db, `SELECT job_olay_json FROM players WHERE user_id = ?`, [userId]);
  const raw = jsonParse(row?.job_olay_json, null);
  if (!raw || !raw.olayId) return null;
  return raw;
}

async function jobOlayYaz(db, userId, session) {
  await ensureJobOlay(db);
  const val = session ? JSON.stringify(session) : "";
  await run(db, `UPDATE players SET job_olay_json = ? WHERE user_id = ?`, [val, userId]);
}

async function jobOlayTemizle(db, userId) {
  await jobOlayYaz(db, userId, null);
}

function olaySuresiDoldu(session) {
  if (!session || !session.bitisMs) return false;
  return Date.now() > session.bitisMs + GRACE_MS;
}

async function jobOdulleriUygula(db, userId, player, job, opts) {
  const netKazanc = Math.max(0, Math.floor(opts.netKazanc ?? job.netKazanc));
  const puan = Math.max(0, Math.floor((opts.puan ?? job.puan) + (opts.bonusPuan || 0)));
  const devletDusus = opts.devletDusus ?? rastgeleAvukatDususu(5, 10);
  const mevcutDevlet = await getDevletIliskisi(db, userId);
  const yeniDevletIliski = clampAvukatIliskisi(mevcutDevlet - devletDusus);

  player.kasa += netKazanc;
  player.puan += puan;
  await run(
    db,
    `UPDATE players SET kasa = ?, puan = ?, devlet_iliskisi = ? WHERE user_id = ?`,
    [player.kasa, player.puan, yeniDevletIliski, userId]
  );
  if (puan > 0) await logStatHareket(db, userId, "sayginlik", puan);

  const gorevSonuc = await gorevOlayIsle(db, userId, "is_yap", { jobKey: opts.jobKey });

  return {
    netKazanc,
    puan,
    devletDusus,
    yeniDevletIliski,
    gorevSonuc,
    paraKaybi: opts.paraKaybi || 0,
    bonusPuan: opts.bonusPuan || 0,
    kazancBonusYuzde: opts.kazancBonusYuzde || 0,
    savunuldu: !!opts.savunuldu,
    muhbirSecim: opts.muhbirSecim || opts.olaySecim || "",
    olaySecim: opts.olaySecim || opts.muhbirSecim || "",
    gucKaybi: opts.gucKaybi || 0,
    icraatKaybi: opts.icraatKaybi || 0,
  };
}

function jobEffectFromSonuc(job, sonuc, icraatToplam) {
  return {
    type: "job",
    isAdi: job.isAdi,
    netKazanc: sonuc.netKazanc,
    icraat: icraatToplam,
    puan: sonuc.puan,
    gorselKey: job.gorselKey,
    devletDusus: sonuc.devletDusus,
    yeniDevletIliski: sonuc.yeniDevletIliski,
    savunuldu: sonuc.savunuldu,
    paraKaybi: sonuc.paraKaybi,
    bonusPuan: sonuc.bonusPuan,
    kazancBonusYuzde: sonuc.kazancBonusYuzde || 0,
    muhbirSecim: sonuc.muhbirSecim || sonuc.olaySecim || "",
    olaySecim: sonuc.olaySecim || sonuc.muhbirSecim || "",
    gucKaybi: sonuc.gucKaybi || 0,
    icraatKaybi: sonuc.icraatKaybi || 0,
  };
}

function jobOlayEffectFromSession(job, session) {
  const base = {
    type: "job_olay",
    olayId: session.olayId,
    olayTipi: session.olayTipi,
    gorselKey: job.gorselKey,
    isAdi: job.isAdi,
    netKazanc: job.netKazanc,
    icraatToplam: session.icraatToplam,
    jobKey: session.jobKey,
    bitisTs: session.bitisMs,
  };
  if (session.olayTipi === "sokak_kavgasi") {
    return {
      ...base,
      sureSn: SOKAK_TIMER_MS / 1000,
      ekstraIcraat: SOKAK_EXTRA_ICRAAT,
    };
  }
  if (
    session.olayTipi === "muhbir" ||
    session.olayTipi === "teknik_ariza" ||
    session.olayTipi === "polis_baskini"
  ) {
    const ekstraIcraat =
      session.olayTipi === "teknik_ariza"
        ? TEKNIK_EXTRA_ICRAAT
        : session.olayTipi === "polis_baskini"
          ? POLIS_EXTRA_ICRAAT
          : MUHBIR_EXTRA_ICRAAT;
    return {
      ...base,
      sureSn: SOKAK_TIMER_MS / 1000,
      ekstraIcraat,
    };
  }
  return {
    ...base,
    ekstraIcraat: FIRSAT_EXTRA_ICRAAT,
    kazancBonusYuzde: session.bonusYuzde,
  };
}

async function bekleyenOlayTemizle(db, userId, player) {
  const bekleyen = await jobOlayOku(db, userId);
  if (!bekleyen) return { durum: "yok" };
  if (!olaySuresiDoldu(bekleyen)) return { durum: "bekliyor", session: bekleyen };

  if (secimliOlayMi(bekleyen.olayTipi)) {
    const job = JOBS[bekleyen.jobKey];
    if (job && player) {
      const sonuc = await olayYakalandiHapis(db, userId, player, job, bekleyen, "yakalandi");
      await jobOlayTemizle(db, userId);
      return {
        durum: "hapis",
        effect: sonuc.effect,
        gorevSonuc: sonuc.gorevSonuc,
        yeniDevletIliski: sonuc.yeniDevletIliski,
      };
    }
    try {
      const { hapseGir } = require("./hapishaneService");
      await hapseGir(db, userId);
    } catch (_) {}
  }
  await jobOlayTemizle(db, userId);
  return { durum: "temizlendi" };
}

async function olayYakalandiHapis(db, userId, player, job, session, olaySecim) {
  const sonuc = await jobOdulleriUygula(db, userId, player, job, {
    jobKey: session.jobKey,
    netKazanc: 0,
    puan: job.puan,
    paraKaybi: job.netKazanc,
    savunuldu: false,
    devletDusus: session.devletDusus,
    olaySecim: olaySecim || "yakalandi",
    muhbirSecim: olaySecim === "yakalandi" ? "yakalandi" : olaySecim,
  });
  try {
    const { hapseGir } = require("./hapishaneService");
    await hapseGir(db, userId);
  } catch (_) {}
  return {
    ok: true,
    effect: {
      ...jobEffectFromSonuc(job, sonuc, session.icraatToplam),
      olayTipi: session.olayTipi,
      hapisGiris: true,
      olaySecim: olaySecim || "yakalandi",
      muhbirSecim: olaySecim === "yakalandi" ? "yakalandi" : olaySecim,
    },
    gorevSonuc: sonuc.gorevSonuc,
    yeniDevletIliski: sonuc.yeniDevletIliski,
  };
}

async function muhbirYakalandi(db, userId, player, job, session) {
  return olayYakalandiHapis(db, userId, player, job, session, "yakalandi");
}

async function jobBaslat(db, userId, player, jobKey) {
  const job = JOBS[jobKey];
  if (!job) return { ok: false, error: "Geçersiz iş." };
  if (player.guc < job.minGuc && toplamGuc(player) < job.minGuc) {
    return {
      ok: false,
      error: `Gücün yetersiz! En az ${job.minGuc.toLocaleString("tr-TR")} güce ihtiyacın var.`,
    };
  }

  const bekleyenDurum = await bekleyenOlayTemizle(db, userId, player);
  if (bekleyenDurum.durum === "bekliyor") {
    return { ok: false, error: "Önce bekleyen icraat olayını tamamlamalısın." };
  }
  if (bekleyenDurum.durum === "hapis") {
    return {
      ok: true,
      effect: bekleyenDurum.effect,
      gorevSonuc: bekleyenDurum.gorevSonuc,
      yeniDevletIliski: bekleyenDurum.yeniDevletIliski,
    };
  }

  const icraatSonuc = await icraatHarca(db, userId, job.icraat);
  if (!icraatSonuc.ok) return icraatSonuc;
  player.icraat = icraatSonuc.icraat;

  if (Math.random() < DIRECT_SUCCESS_CHANCE) {
    const sonuc = await jobOdulleriUygula(db, userId, player, job, { jobKey });
    return {
      ok: true,
      effect: jobEffectFromSonuc(job, sonuc, job.icraat),
      gorevSonuc: sonuc.gorevSonuc,
      yeniDevletIliski: sonuc.yeniDevletIliski,
    };
  }

  const olayTipi = olayTipiSec();
  const ekstraMaliyet =
    olayTipi === "sansli_firsat"
      ? FIRSAT_EXTRA_ICRAAT
      : olayTipi === "teknik_ariza"
        ? TEKNIK_EXTRA_ICRAAT
        : olayTipi === "muhbir"
          ? MUHBIR_EXTRA_ICRAAT
          : olayTipi === "polis_baskini"
            ? POLIS_EXTRA_ICRAAT
            : SOKAK_EXTRA_ICRAAT;
  const ekstraIcraat = await icraatHarca(db, userId, ekstraMaliyet);
  if (!ekstraIcraat.ok) {
    if (olayTipi === "sokak_kavgasi") {
      const kayip = Math.floor(job.netKazanc * FAIL_PARA_ORANI);
      const sonuc = await jobOdulleriUygula(db, userId, player, job, {
        jobKey,
        netKazanc: job.netKazanc - kayip,
        puan: job.puan,
        paraKaybi: kayip,
        savunuldu: false,
      });
      return {
        ok: true,
        effect: jobEffectFromSonuc(job, sonuc, job.icraat),
        gorevSonuc: sonuc.gorevSonuc,
        yeniDevletIliski: sonuc.yeniDevletIliski,
      };
    }
    const sonuc = await jobOdulleriUygula(db, userId, player, job, { jobKey });
    return {
      ok: true,
      effect: jobEffectFromSonuc(job, sonuc, job.icraat),
      gorevSonuc: sonuc.gorevSonuc,
      yeniDevletIliski: sonuc.yeniDevletIliski,
    };
  }
  player.icraat = ekstraIcraat.icraat;

  const olayId = crypto.randomBytes(8).toString("hex");
  const basladiMs = Date.now();
  const session = {
    olayId,
    jobKey,
    olayTipi,
    basladiMs,
    devletDusus: rastgeleAvukatDususu(5, 10),
    icraatToplam: job.icraat + ekstraMaliyet,
  };

  if (olayTipi === "sokak_kavgasi") {
    session.bitisMs = basladiMs + SOKAK_TIMER_MS;
  } else if (secimliOlayMi(olayTipi)) {
    session.bitisMs = basladiMs + SOKAK_TIMER_MS;
  } else {
    session.bonusYuzde = rastgeleFirsatBonusu();
    session.bitisMs = basladiMs + FIRSAT_BEKLE_MS;
  }

  await jobOlayYaz(db, userId, session);

  return {
    ok: true,
    effect: jobOlayEffectFromSession(job, session),
    gorevSonuc: null,
    yeniDevletIliski: null,
  };
}

async function jobOlaySonuc(db, userId, player, { savunuldu, olayId, secim }) {
  const session = await jobOlayOku(db, userId);
  if (!session) return { ok: false, error: "Bekleyen icraat olayı yok." };
  if (olayId && session.olayId !== olayId) {
    return { ok: false, error: "Geçersiz olay." };
  }

  const job = JOBS[session.jobKey];
  if (!job) {
    await jobOlayTemizle(db, userId);
    return { ok: false, error: "İş bulunamadı." };
  }

  let netKazanc = job.netKazanc;
  let bonusPuan = 0;
  let paraKaybi = 0;
  let kazancBonusYuzde = 0;
  let basarili = false;
  let muhbirSecim = "";
  let olaySecim = "";
  let gucKaybi = 0;
  let icraatKaybi = 0;

  if (session.olayTipi === "sansli_firsat") {
    if (!savunuldu) {
      return { ok: false, error: "Şanslı fırsatı kabul etmelisin." };
    }
    kazancBonusYuzde = session.bonusYuzde || FIRSAT_BONUS_MIN;
    netKazanc = Math.floor(job.netKazanc * (1 + kazancBonusYuzde / 100));
    basarili = true;
  } else if (session.olayTipi === "muhbir") {
    const simdi = Date.now();
    const tercih = secim === "kac" ? "kac" : secim === "rusvet" ? "rusvet" : "";
    if (!tercih) {
      if (simdi <= session.bitisMs) {
        return { ok: false, error: "Kaçmak için 30 saniye içinde bir seçenek belirlemelisin." };
      }
      await jobOlayTemizle(db, userId);
      return muhbirYakalandi(db, userId, player, job, session);
    }
    muhbirSecim = tercih;
    olaySecim = tercih;
    basarili = true;
    if (tercih === "rusvet") {
      paraKaybi = Math.floor(job.netKazanc * MUHBIR_RUSVET_ORANI);
      netKazanc = job.netKazanc - paraKaybi;
    } else {
      netKazanc = job.netKazanc;
      gucKaybi = Math.max(1, Math.floor((player.guc || 0) * MUHBIR_GUC_KAYIP_ORANI));
      icraatKaybi = MUHBIR_ICRAAT_KAYIP;
    }
  } else if (session.olayTipi === "teknik_ariza") {
    const simdi = Date.now();
    const tercih = secim === "kir" ? "kir" : secim === "tamir" ? "tamir" : "";
    if (!tercih) {
      if (simdi <= session.bitisMs) {
        return { ok: false, error: "Kilitli kapı için 30 saniye içinde bir seçenek belirlemelisin." };
      }
      await jobOlayTemizle(db, userId);
      return olayYakalandiHapis(db, userId, player, job, session, "yakalandi");
    }
    basarili = true;
    if (tercih === "tamir") {
      olaySecim = "tamir";
      paraKaybi = Math.floor(job.netKazanc * TEKNIK_YARIM_ORANI);
      netKazanc = job.netKazanc - paraKaybi;
    } else {
      if (Math.random() < TEKNIK_KIR_YAKALANMA) {
        await jobOlayTemizle(db, userId);
        return olayYakalandiHapis(db, userId, player, job, session, "kir_yakalandi");
      }
      olaySecim = "kir";
      netKazanc = job.netKazanc;
    }
  } else if (session.olayTipi === "polis_baskini") {
    const simdi = Date.now();
    const tercih = secim === "soy_kac" ? "soy_kac" : secim === "kac" ? "kac" : "";
    if (!tercih) {
      if (simdi <= session.bitisMs) {
        return { ok: false, error: "Polis baskınında 30 saniye içinde bir seçenek belirlemelisin." };
      }
      await jobOlayTemizle(db, userId);
      return olayYakalandiHapis(db, userId, player, job, session, "yakalandi");
    }
    basarili = true;
    olaySecim = tercih;
    if (tercih === "kac") {
      netKazanc = 0;
      paraKaybi = job.netKazanc;
    } else if (Math.random() < POLIS_SOY_KAC_YAKALANMA) {
      await jobOlayTemizle(db, userId);
      return olayYakalandiHapis(db, userId, player, job, session, "soy_kac_yakalandi");
    } else {
      netKazanc = job.netKazanc;
    }
  } else {
    const simdi = Date.now();
    basarili = !!savunuldu && simdi <= session.bitisMs + GRACE_MS;
    if (basarili) {
      bonusPuan = Math.max(1, Math.ceil(job.puan * 0.5));
    } else {
      paraKaybi = Math.floor(job.netKazanc * FAIL_PARA_ORANI);
      netKazanc = job.netKazanc - paraKaybi;
    }
  }

  await jobOlayTemizle(db, userId);

  const sonuc = await jobOdulleriUygula(db, userId, player, job, {
    jobKey: session.jobKey,
    netKazanc,
    puan: job.puan,
    bonusPuan,
    paraKaybi,
    kazancBonusYuzde,
    savunuldu: basarili,
    devletDusus: session.devletDusus,
    muhbirSecim,
    olaySecim,
    gucKaybi,
    icraatKaybi,
  });

  if (muhbirSecim === "kac" && (gucKaybi > 0 || icraatKaybi > 0)) {
    const yeniGuc = Math.max(0, (player.guc || 0) - gucKaybi);
    const yeniIcraat = Math.max(0, (player.icraat || 0) - icraatKaybi);
    player.guc = yeniGuc;
    player.icraat = yeniIcraat;
    await run(db, `UPDATE players SET guc = ?, icraat = ? WHERE user_id = ?`, [
      yeniGuc,
      yeniIcraat,
      userId,
    ]);
    sonuc.gucKaybi = gucKaybi;
    sonuc.icraatKaybi = icraatKaybi;
    sonuc.muhbirSecim = muhbirSecim;
  } else if (muhbirSecim === "rusvet") {
    sonuc.muhbirSecim = muhbirSecim;
    sonuc.olaySecim = olaySecim || muhbirSecim;
  } else if (olaySecim === "tamir" || olaySecim === "kir" || olaySecim === "soy_kac" || olaySecim === "kac") {
    sonuc.olaySecim = olaySecim;
  }

  return {
    ok: true,
    effect: {
      ...jobEffectFromSonuc(job, sonuc, session.icraatToplam),
      olayTipi: session.olayTipi,
    },
    gorevSonuc: sonuc.gorevSonuc,
    yeniDevletIliski: sonuc.yeniDevletIliski,
  };
}

module.exports = {
  jobBaslat,
  jobOlaySonuc,
  jobOlayOku,
  DIRECT_SUCCESS_CHANCE,
  SOKAK_TIMER_MS,
};
