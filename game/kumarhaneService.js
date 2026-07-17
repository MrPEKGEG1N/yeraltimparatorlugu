const { run, get, all } = require("../db/database");
const {
  CHIP_ORAN,
  KUMAR_MIN_CHIP_ISLEM,
  KUMAR_MAX_CHIP_ISLEM,
  KUMAR_MIN_BAHIS,
  KUMAR_MAX_BAHIS,
  kumarOyunlariGetir,
  oyunBul,
} = require("./kumarhaneCatalog");
const blackjack = require("./kumarhane/blackjack");
const rulet = require("./kumarhane/rulet");
const barbut = require("./kumarhane/barbut");
const rusRuleti = require("./kumarhane/rusRuleti");
const ucKartPoker = require("./kumarhane/ucKartPoker");
const slot = require("./kumarhane/slot");
const atYarisi = require("./kumarhane/atYarisi");
const fiveFinger = require("./kumarhane/fiveFinger");

const OYUN_MODULLERI = {
  blackjack,
  rulet,
  barbut,
  rus_ruleti: rusRuleti,
  uc_kart_poker: ucKartPoker,
  slot,
  at_yarisi: atYarisi,
  five_finger: fiveFinger,
};

let aktifYaris = null;
let yarisBitis = 0;

function yarisDurumuGetir() {
  const now = Date.now();
  if (!aktifYaris || now > yarisBitis) {
    aktifYaris = atYarisi.yarisOlustur();
    yarisBitis = now + 5 * 60 * 1000;
  }
  return { atlar: aktifYaris, kalanSn: Math.max(0, Math.floor((yarisBitis - now) / 1000)) };
}

function parseMiktar(miktar, min, max) {
  const n = parseInt(miktar, 10);
  if (!Number.isFinite(n) || n < min) return { ok: false, error: `En az ${min.toLocaleString("tr-TR")} olmalı.` };
  if (n > max) return { ok: false, error: `En fazla ${max.toLocaleString("tr-TR")} olabilir.` };
  return { ok: true, miktar: n };
}

async function ensureKumarhaneTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_hesap (
      user_id INTEGER PRIMARY KEY,
      chip INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_oturum (
      user_id INTEGER PRIMARY KEY,
      oyun_id TEXT NOT NULL,
      state TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      oyun_id TEXT NOT NULL,
      bahis INTEGER NOT NULL,
      kazanc INTEGER NOT NULL,
      detay TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );
}

async function chipGetir(db, userId) {
  await ensureKumarhaneTables(db);
  const row = await get(db, `SELECT chip FROM kumarhane_hesap WHERE user_id = ?`, [userId]);
  return row?.chip || 0;
}

async function oturumGetir(db, userId) {
  const row = await get(
    db,
    `SELECT oyun_id, state FROM kumarhane_oturum WHERE user_id = ?`,
    [userId]
  );
  if (!row) return null;
  try {
    return { oyunId: row.oyun_id, state: JSON.parse(row.state) };
  } catch (_) {
    return null;
  }
}

async function oturumKaydet(db, userId, oyunId, state) {
  await run(
    db,
    `INSERT INTO kumarhane_oturum (user_id, oyun_id, state, updated_at)
     VALUES (?, ?, ?, strftime('%s','now'))
     ON CONFLICT(user_id) DO UPDATE SET oyun_id = ?, state = ?, updated_at = strftime('%s','now')`,
    [userId, oyunId, JSON.stringify(state), oyunId, JSON.stringify(state)]
  );
}

async function oturumSil(db, userId) {
  await run(db, `DELETE FROM kumarhane_oturum WHERE user_id = ?`, [userId]);
}

async function logEkle(db, userId, oyunId, bahis, kazanc, detay) {
  await run(
    db,
    `INSERT INTO kumarhane_log (user_id, oyun_id, bahis, kazanc, detay) VALUES (?, ?, ?, ?, ?)`,
    [userId, oyunId, bahis, kazanc, JSON.stringify(detay || {})]
  );
}

async function chipGuncelle(db, userId, delta) {
  await ensureKumarhaneTables(db);
  const row = await get(db, `SELECT chip FROM kumarhane_hesap WHERE user_id = ?`, [userId]);
  if (!row) {
    if (delta < 0) return false;
    await run(db, `INSERT INTO kumarhane_hesap (user_id, chip) VALUES (?, ?)`, [userId, delta]);
    return true;
  }
  const res = await run(
    db,
    `UPDATE kumarhane_hesap SET chip = chip + ? WHERE user_id = ? AND chip + ? >= 0`,
    [delta, userId, delta]
  );
  return !!res?.changes;
}

async function panelGetir(db, userId) {
  await ensureKumarhaneTables(db);
  const chip = await chipGetir(db, userId);
  const oturum = await oturumGetir(db, userId);
  const yaris = yarisDurumuGetir();
  let aktifOyun = null;
  if (oturum) {
    const mod = OYUN_MODULLERI[oturum.oyunId];
    aktifOyun = {
      oyunId: oturum.oyunId,
      gorunum: oturum.state?.gorunumCache || oturum.state,
    };
    if (oturum.oyunId === "blackjack" && oturum.state) {
      aktifOyun.gorunum = blackjack.gorunum(oturum.state, true);
    }
    if (oturum.oyunId === "five_finger" && oturum.state) {
      aktifOyun.gorunum = fiveFinger.gorunum(oturum.state);
    }
  }

  return {
    ok: true,
    chip,
    chipOran: CHIP_ORAN,
    minChipIslem: KUMAR_MIN_CHIP_ISLEM,
    maxChipIslem: KUMAR_MAX_CHIP_ISLEM,
    minBahis: KUMAR_MIN_BAHIS,
    maxBahis: KUMAR_MAX_BAHIS,
    oyunlar: kumarOyunlariGetir(),
    aktifOyun,
    yaris,
  };
}

async function chipAl(db, userId, player, miktar) {
  const parsed = parseMiktar(miktar, KUMAR_MIN_CHIP_ISLEM, KUMAR_MAX_CHIP_ISLEM);
  if (!parsed.ok) return parsed;
  const tutar = parsed.miktar;
  if (player.kasa < tutar) {
    return { ok: false, error: `Yeterli paran yok! ${tutar.toLocaleString("tr-TR")} TL gerekir.` };
  }

  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
    [tutar, userId, tutar]
  );
  if (!deduct?.changes) return { ok: false, error: "Yeterli paran yok." };

  const chips = Math.floor(tutar * CHIP_ORAN);
  await chipGuncelle(db, userId, chips);
  player.kasa -= tutar;

  return {
    ok: true,
    mesaj: `${chips.toLocaleString("tr-TR")} çip alındı (${tutar.toLocaleString("tr-TR")} TL).`,
    chip: await chipGetir(db, userId),
    tutar,
  };
}

async function chipSat(db, userId, player, miktar) {
  const parsed = parseMiktar(miktar, KUMAR_MIN_CHIP_ISLEM, KUMAR_MAX_CHIP_ISLEM);
  if (!parsed.ok) return parsed;
  const chips = parsed.miktar;
  const tl = Math.floor(chips / CHIP_ORAN);
  if (tl < 1) return { ok: false, error: "Geçerli çip miktarı gir." };

  const ok = await chipGuncelle(db, userId, -chips);
  if (!ok) return { ok: false, error: "Yeterli çipin yok." };

  await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [tl, userId]);
  player.kasa += tl;

  return {
    ok: true,
    mesaj: `${chips.toLocaleString("tr-TR")} çip bozduruldu — ${tl.toLocaleString("tr-TR")} TL kasaya geçti.`,
    chip: await chipGetir(db, userId),
    tutar: tl,
  };
}

function bahisDogrula(oyun, bahis) {
  const min = oyun?.minBahis || KUMAR_MIN_BAHIS;
  const max = Math.min(oyun?.maxBahis || KUMAR_MAX_BAHIS, KUMAR_MAX_BAHIS);
  return parseMiktar(bahis, min, max);
}

async function oyunOyna(db, userId, payload) {
  await ensureKumarhaneTables(db);
  const oyunId = String(payload?.oyunId || payload?.gameId || "");
  const oyun = oyunBul(oyunId);
  if (!oyun) return { ok: false, error: "Oyun bulunamadı." };

  const mevcut = await oturumGetir(db, userId);
  const aksiyon = String(payload?.aksiyon || payload?.action || "").toLowerCase();

  if (mevcut && (aksiyon === "hit" || aksiyon === "stand" || aksiyon === "double" || aksiyon === "parmak")) {
    return oyunDevamEt(db, userId, mevcut, aksiyon, payload);
  }

  if (mevcut) {
    return { ok: false, error: "Devam eden oyunun var — önce onu bitir." };
  }

  const bahisParsed = bahisDogrula(oyun, payload?.bahis || payload?.bet);
  if (!bahisParsed.ok) return bahisParsed;
  const bahis = bahisParsed.miktar;

  const chip = await chipGetir(db, userId);
  if (chip < bahis) {
    return { ok: false, error: `Yeterli çipin yok! ${bahis.toLocaleString("tr-TR")} çip gerekir.` };
  }

  // All-in: bahis, çekim öncesi tüm çip bakiyesine eşit
  const allIn = bahis > 0 && bahis === chip;

  const chipOk = await chipGuncelle(db, userId, -bahis);
  if (!chipOk) return { ok: false, error: "Çip düşülemedi." };

  let sonuc = null;
  let oturumBekle = false;

  if (oyunId === "blackjack") {
    sonuc = blackjack.baslat(bahis);
    oturumBekle = !sonuc.bitti;
  } else if (oyunId === "five_finger") {
    sonuc = fiveFinger.baslat(bahis);
    oturumBekle = !sonuc.bitti;
  } else if (oyunId === "rulet") {
    sonuc = rulet.oyna(bahis, payload?.bahisTuru || payload?.tur, payload?.deger);
  } else if (oyunId === "barbut") {
    sonuc = barbut.oyna(bahis, payload?.bahisTuru || payload?.tur);
  } else if (oyunId === "rus_ruleti") {
    sonuc = rusRuleti.oyna(bahis);
  } else if (oyunId === "uc_kart_poker") {
    sonuc = ucKartPoker.oyna(bahis);
  } else if (oyunId === "slot") {
    sonuc = slot.oyna(bahis);
  } else if (oyunId === "at_yarisi") {
    const yaris = yarisDurumuGetir();
    sonuc = atYarisi.oyna(bahis, payload?.atNo || payload?.at, yaris.atlar);
  } else {
    await chipGuncelle(db, userId, bahis);
    return { ok: false, error: "Oyun henüz hazır değil." };
  }

  if (sonuc?.ok === false) {
    await chipGuncelle(db, userId, bahis);
    return sonuc;
  }

  if (oturumBekle) {
    const state = { ...(sonuc.state || {}), allIn: !!allIn };
    await oturumKaydet(db, userId, oyunId, state);
    return {
      ok: true,
      bitti: false,
      oyunId,
      gorunum: sonuc.gorunum,
      chip: await chipGetir(db, userId),
      mesaj:
        oyunId === "blackjack"
          ? "Kartlar dağıtıldı — hamleni yap."
          : "Bıçak hazır — güvenli parmağı seç.",
    };
  }

  return oyunSonucIsle(db, userId, oyunId, bahis, sonuc, { allIn });
}

async function oyunDevamEt(db, userId, oturum, aksiyon, payload) {
  const oyunId = oturum.oyunId;
  let sonuc;
  let allIn = !!(oturum.state && oturum.state.allIn);

  if (oyunId === "blackjack") {
    if (aksiyon === "parmak") {
      return { ok: false, error: "Geçersiz blackjack hamlesi." };
    }
    if (aksiyon === "double") {
      const ek = oturum.state.bahis;
      const chip = await chipGetir(db, userId);
      if (chip < ek) return { ok: false, error: "Double için ek çip gerekir." };
      // Kalan tüm çip double'a gidiyorsa all-in say
      if (chip === ek) allIn = true;
      const ok = await chipGuncelle(db, userId, -ek);
      if (!ok) return { ok: false, error: "Double için yeterli çip yok." };
    }
    sonuc = blackjack.devam(oturum.state, aksiyon);
  } else if (oyunId === "five_finger") {
    sonuc = fiveFinger.devam(oturum.state, payload?.parmak || payload?.deger);
  } else {
    return { ok: false, error: "Bu oyun devam hamlesi desteklemiyor." };
  }

  if (!sonuc.ok) return sonuc;

  if (!sonuc.bitti) {
    const state = { ...(sonuc.state || {}), allIn: !!allIn };
    await oturumKaydet(db, userId, oyunId, state);
    return {
      ok: true,
      bitti: false,
      oyunId,
      gorunum: sonuc.gorunum,
      chip: await chipGetir(db, userId),
      mesaj: sonuc.mesaj || "",
    };
  }

  await oturumSil(db, userId);
  const toplamBahis = sonuc.state?.bahis || oturum.state.bahis;
  return oyunSonucIsle(db, userId, oyunId, toplamBahis, sonuc, { allIn });
}

async function oyunSonucIsle(db, userId, oyunId, bahis, sonuc, opts = {}) {
  const kazanc = Math.max(0, Math.floor(sonuc.kazanc || 0));
  if (kazanc > 0) await chipGuncelle(db, userId, kazanc);
  await logEkle(db, userId, oyunId, bahis, kazanc, sonuc.gorunum);

  const net = kazanc - bahis;
  let mesaj = sonuc.mesaj || "";
  if (!mesaj) {
    mesaj = net > 0 ? `Kazandın: +${net.toLocaleString("tr-TR")} çip` : `Kaybettin: ${bahis.toLocaleString("tr-TR")} çip`;
  }

  const allIn = !!(opts.allIn || sonuc?.state?.allIn);
  if (allIn && bahis > 0) {
    try {
      const { basariRozetArtir } = require("./basariRozetService");
      if (net > 0) {
        await basariRozetArtir(db, userId, "casino_allin_win", 1);
      } else if (kazanc === 0) {
        await basariRozetArtir(db, userId, "casino_allin_bust", 1);
      }
    } catch (err) {
      console.warn("[kumarhane] all-in rozet:", err?.message || err);
    }
  }

  return {
    ok: true,
    bitti: true,
    oyunId,
    bahis,
    kazanc,
    net,
    mesaj,
    gorunum: sonuc.gorunum,
    chip: await chipGetir(db, userId),
    allIn: allIn || undefined,
  };
}

module.exports = {
  ensureKumarhaneTables,
  chipGetir,
  chipGuncelle,
  logEkle,
  panelGetir,
  chipAl,
  chipSat,
  oyunOyna,
};
