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
const EVENT_EXTRA_ICRAAT = 1;
const TIMER_MS = 30000;
const FAIL_PARA_ORANI = 0.4;
const GRACE_MS = 2500;

function jsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
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
    savunuldu: !!opts.savunuldu,
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
  };
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

  const bekleyen = await jobOlayOku(db, userId);
  if (bekleyen) {
    const simdi = Date.now();
    if (simdi > bekleyen.bitisMs + GRACE_MS) {
      await jobOlayTemizle(db, userId);
    } else {
      return { ok: false, error: "Önce bekleyen icraat olayını tamamlamalısın." };
    }
  }

  const icraatSonuc = await icraatHarca(db, userId, job.icraat);
  if (!icraatSonuc.ok) return icraatSonuc;
  player.icraat = icraatSonuc.icraat;

  const direkt = Math.random() < DIRECT_SUCCESS_CHANCE;
  if (direkt) {
    const sonuc = await jobOdulleriUygula(db, userId, player, job, { jobKey });
    return {
      ok: true,
      effect: jobEffectFromSonuc(job, sonuc, job.icraat),
      gorevSonuc: sonuc.gorevSonuc,
      yeniDevletIliski: sonuc.yeniDevletIliski,
    };
  }

  const ekstraIcraat = await icraatHarca(db, userId, EVENT_EXTRA_ICRAAT);
  if (!ekstraIcraat.ok) {
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
  player.icraat = ekstraIcraat.icraat;

  const olayId = crypto.randomBytes(8).toString("hex");
  const basladiMs = Date.now();
  const session = {
    olayId,
    jobKey,
    olayTipi: "sokak_kavgasi",
    basladiMs,
    bitisMs: basladiMs + TIMER_MS,
    devletDusus: rastgeleAvukatDususu(5, 10),
    icraatToplam: job.icraat + EVENT_EXTRA_ICRAAT,
  };
  await jobOlayYaz(db, userId, session);

  return {
    ok: true,
    effect: {
      type: "job_olay",
      olayId,
      olayTipi: session.olayTipi,
      sureSn: TIMER_MS / 1000,
      bitisTs: session.bitisMs,
      gorselKey: job.gorselKey,
      isAdi: job.isAdi,
      netKazanc: job.netKazanc,
      ekstraIcraat: EVENT_EXTRA_ICRAAT,
      icraatToplam: session.icraatToplam,
      jobKey,
    },
    gorevSonuc: null,
    yeniDevletIliski: null,
  };
}

async function jobOlayTemizle(db, userId) {
  await jobOlayYaz(db, userId, null);
}

async function jobOlaySonuc(db, userId, player, { savunuldu, olayId }) {
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

  const simdi = Date.now();
  const zamaninda = !!savunuldu && simdi <= session.bitisMs + GRACE_MS;
  let netKazanc = job.netKazanc;
  let bonusPuan = 0;
  let paraKaybi = 0;

  if (zamaninda) {
    bonusPuan = Math.max(1, Math.ceil(job.puan * 0.5));
  } else {
    paraKaybi = Math.floor(job.netKazanc * FAIL_PARA_ORANI);
    netKazanc = job.netKazanc - paraKaybi;
  }

  await jobOlayTemizle(db, userId);

  const sonuc = await jobOdulleriUygula(db, userId, player, job, {
    jobKey: session.jobKey,
    netKazanc,
    puan: job.puan,
    bonusPuan,
    paraKaybi,
    savunuldu: zamaninda,
    devletDusus: session.devletDusus,
  });

  return {
    ok: true,
    effect: jobEffectFromSonuc(job, sonuc, session.icraatToplam),
    gorevSonuc: sonuc.gorevSonuc,
    yeniDevletIliski: sonuc.yeniDevletIliski,
  };
}

module.exports = {
  jobBaslat,
  jobOlaySonuc,
  jobOlayOku,
  DIRECT_SUCCESS_CHANCE,
  TIMER_MS,
};
