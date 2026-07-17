const { run, get } = require("../db/database");
const {
  VIP_ERKEK_PORTRELER,
  VIP_KADIN_PORTRELER,
  normalizeProfilResmi,
  rastgeleProfilResmi,
  gecerliProfilResmi,
} = require("./profilPortreler");

const VIP_PORTRE_SET = new Set([...VIP_ERKEK_PORTRELER, ...VIP_KADIN_PORTRELER]);

/** Paket → üyelik boyunca + kalıcı hediye koleksiyon havuzu */
const PAKET_HEDIYE_KOLEKSIYONLARI = {
  tetikci: ["operasyon"],
  racon: ["operasyon", "mafya"],
  baron: ["elmas", "mafya", "kral", "ihtisam", "karanlik", "aslan", "operasyon", "vip"],
};

const PAKET_SIRA_LOCAL = { tetikci: 1, racon: 2, baron: 3 };

function paketUyelikKoleksiyonlari(paketId) {
  return PAKET_HEDIYE_KOLEKSIYONLARI[String(paketId || "").trim()] || [];
}

function vipPortreMi(key) {
  const k = normalizeProfilResmi(key);
  return VIP_PORTRE_SET.has(k);
}

function vipKoleksiyonu(key) {
  const k = normalizeProfilResmi(key || "");
  if (!vipPortreMi(k)) return "";
  if (/^vip-(erkek|kadin)-vip-\d{2}$/.test(k)) return "vip";
  if (k.includes("-operasyon-")) return "operasyon";
  if (k.includes("-aslan-")) return "aslan";
  if (k.includes("-karanlik-")) return "karanlik";
  if (k.includes("-ihtisam-")) return "ihtisam";
  if (k.includes("-kral-")) return "kral";
  if (k.includes("-mafya-")) return "mafya";
  return "elmas";
}

async function ensureVipPortreColumns(db) {
  for (const [col, def] of [
    ["vip_portre_sahip", "TEXT NOT NULL DEFAULT '[]'"],
    ["vip_portre_hediye", "TEXT NOT NULL DEFAULT '{}'"],
  ]) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
}

function parseJson(raw, fallback) {
  try {
    const v = JSON.parse(raw || "");
    return v != null ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

function hediyeKrediSay(rawVal) {
  if (typeof rawVal === "number" && Number.isFinite(rawVal)) return Math.max(0, Math.floor(rawVal));
  if (rawVal === "available" || rawVal === true) return 1;
  return 0;
}

function normalizeHediyeDurum(raw) {
  const obj = parseJson(raw, {});
  const out = {};
  for (const id of Object.keys(PAKET_HEDIYE_KOLEKSIYONLARI)) {
    out[id] = hediyeKrediSay(obj[id]);
  }
  return out;
}

function normalizeSahip(raw) {
  const arr = parseJson(raw, []);
  if (!Array.isArray(arr)) return [];
  const set = new Set();
  for (const item of arr) {
    const k = gecerliProfilResmi(item);
    if (k && vipPortreMi(k)) set.add(k);
  }
  return [...set];
}

async function getVipPortreDurum(db, userId) {
  await ensureVipPortreColumns(db);
  const { getPremiumStatus } = require("./premiumService");
  // Önce üyelik süresini kontrol et; bitmişse sahiplenilmemiş VIP portreyi temizle
  await getPremiumStatus(db, userId);
  await vipPortreUyelikBitinceTemizle(db, userId);

  const row = await get(
    db,
    `SELECT vip_portre_sahip, vip_portre_hediye, profil_resmi FROM players WHERE user_id = ?`,
    [userId]
  );
  const premium = await getPremiumStatus(db, userId);
  const sahip = normalizeSahip(row?.vip_portre_sahip);
  const hediye = normalizeHediyeDurum(row?.vip_portre_hediye);
  return {
    sahip,
    hediye,
    premiumAktif: !!(premium.paket && premium.kalanSn > 0),
    premiumPaket: premium.paket || "",
    profilResmi: normalizeProfilResmi(row?.profil_resmi || ""),
  };
}

function hediyeHavuzuKoleksiyonlari(hediye) {
  const set = new Set();
  for (const [paketId, kredi] of Object.entries(hediye || {})) {
    if (hediyeKrediSay(kredi) <= 0) continue;
    (PAKET_HEDIYE_KOLEKSIYONLARI[paketId] || []).forEach((k) => set.add(k));
  }
  return [...set];
}

function paketHediyeIcinUygunMu(paketId, koleksiyon) {
  return (PAKET_HEDIYE_KOLEKSIYONLARI[paketId] || []).includes(koleksiyon);
}

/** Hangi unused paket hakkı bu koleksiyonu kapsıyor? En yüksek paket öncelikli. */
function hediyeHakkiSec(hediye, koleksiyon) {
  const adaylar = Object.keys(PAKET_HEDIYE_KOLEKSIYONLARI)
    .filter(
      (id) => hediyeKrediSay(hediye[id]) > 0 && paketHediyeIcinUygunMu(id, koleksiyon)
    )
    .sort((a, b) => (PAKET_SIRA_LOCAL[b] || 0) - (PAKET_SIRA_LOCAL[a] || 0));
  return adaylar[0] || null;
}

function vipPortreKullanabilirMi(durum, key) {
  const k = normalizeProfilResmi(key);
  if (!vipPortreMi(k)) return { ok: true, key: k };
  if (durum.sahip.includes(k)) return { ok: true, key: k, kalici: true };
  if (durum.premiumAktif) {
    const koleksiyon = vipKoleksiyonu(k);
    const acik = paketUyelikKoleksiyonlari(durum.premiumPaket);
    if (acik.includes(koleksiyon)) return { ok: true, key: k, uyelik: true };
  }
  return {
    ok: false,
    error:
      "Bu V.I.P portre kilitli. Paketinin açtığı koleksiyonlardan seçebilirsin.",
  };
}

/** Her paket satın alımı / uzatmada +1 kalıcı hediye hakkı */
async function vipPortreHediyeHakkiAc(db, userId, paketId) {
  const id = String(paketId || "").trim();
  if (!PAKET_HEDIYE_KOLEKSIYONLARI[id]) return;

  await ensureVipPortreColumns(db);
  const row = await get(db, `SELECT vip_portre_hediye FROM players WHERE user_id = ?`, [userId]);
  const hediye = normalizeHediyeDurum(row?.vip_portre_hediye);
  hediye[id] = (hediye[id] || 0) + 1;
  await run(db, `UPDATE players SET vip_portre_hediye = ? WHERE user_id = ?`, [
    JSON.stringify(hediye),
    userId,
  ]);
}

async function vipPortreKaliciSec(db, userId, key) {
  const portre = gecerliProfilResmi(key);
  if (!portre || !vipPortreMi(portre)) {
    return { ok: false, error: "Geçersiz V.I.P portre." };
  }
  const durum = await getVipPortreDurum(db, userId);
  if (durum.sahip.includes(portre)) {
    return { ok: true, zaten: true, sahip: durum.sahip, key: portre };
  }
  const koleksiyon = vipKoleksiyonu(portre);
  const paketHak = hediyeHakkiSec(durum.hediye, koleksiyon);
  if (!paketHak) {
    return {
      ok: false,
      error:
        "Bu koleksiyondan kalıcı resim seçme hakkın yok. Paket hediyeni kontrol et.",
    };
  }
  const sahip = [...durum.sahip, portre];
  const hediye = { ...durum.hediye };
  hediye[paketHak] = Math.max(0, (hediye[paketHak] || 0) - 1);
  await run(
    db,
    `UPDATE players SET vip_portre_sahip = ?, vip_portre_hediye = ? WHERE user_id = ?`,
    [JSON.stringify(sahip), JSON.stringify(hediye), userId]
  );
  return { ok: true, sahip, hediye, key: portre, paketHak };
}

async function vipPortreEquipKontrol(db, userId, key, opts = {}) {
  const portre = gecerliProfilResmi(key);
  if (!portre) return { ok: false, error: "Geçersiz profil resmi." };
  if (!vipPortreMi(portre)) return { ok: true, key: portre };

  let kaliciYapildi = false;
  if (opts.kaliciSec) {
    const once = await getVipPortreDurum(db, userId);
    const zaten = once.sahip.includes(portre);
    const sec = await vipPortreKaliciSec(db, userId, portre);
    if (!sec.ok) return sec;
    kaliciYapildi = !zaten && !sec.zaten;
  }

  const guncel = await getVipPortreDurum(db, userId);
  const izin = vipPortreKullanabilirMi(guncel, portre);
  if (!izin.ok) return izin;
  return {
    ok: true,
    key: portre,
    kaliciYapildi,
    sahip: guncel.sahip,
    hediye: guncel.hediye,
  };
}

function vipPortreUyelikDisindaMi(key, sahip, premiumAktif, paket) {
  const mevcut = normalizeProfilResmi(key || "");
  if (!vipPortreMi(mevcut)) return false;
  if (sahip.includes(mevcut)) return false;
  if (premiumAktif) {
    const koleksiyon = vipKoleksiyonu(mevcut);
    if (paketUyelikKoleksiyonlari(paket).includes(koleksiyon)) return false;
  }
  return true;
}

/** Üyelik bitince veya paketin kapsadığı koleksiyon dışında kalınca sahiplenilmemiş VIP'i klasik portreye çevir */
async function vipPortreUyelikBitinceTemizle(db, userId) {
  await ensureVipPortreColumns(db);
  try {
    const { ensureSagKol } = require("./sagKolService");
    await ensureSagKol(db);
  } catch (_) {}
  const row = await get(
    db,
    `SELECT vip_portre_sahip, profil_resmi, sag_kol_profil_resmi, premium_paket, premium_paket_bitis FROM players WHERE user_id = ?`,
    [userId]
  );
  const simdi = Math.floor(Date.now() / 1000);
  const paket = String(row?.premium_paket || "").trim();
  const bitis = Number(row?.premium_paket_bitis || 0);
  const premiumAktif = !!(paket && bitis > simdi);
  const sahip = normalizeSahip(row?.vip_portre_sahip);

  let yeni = null;
  const mevcut = normalizeProfilResmi(row?.profil_resmi || "");
  if (vipPortreUyelikDisindaMi(mevcut, sahip, premiumAktif, paket)) {
    yeni = rastgeleProfilResmi();
    await run(db, `UPDATE players SET profil_resmi = ? WHERE user_id = ?`, [yeni, userId]);
  }

  const sagKol = normalizeProfilResmi(row?.sag_kol_profil_resmi || "");
  if (vipPortreUyelikDisindaMi(sagKol, sahip, premiumAktif, paket)) {
    await run(db, `UPDATE players SET sag_kol_profil_resmi = '' WHERE user_id = ?`, [userId]);
  }

  return yeni;
}

function vipPortreClientOzet(durum) {
  const uyelikKoleksiyonlari = durum.premiumAktif
    ? paketUyelikKoleksiyonlari(durum.premiumPaket)
    : [];
  return {
    vipPortreSahip: durum.sahip || [],
    vipPortreHediye: durum.hediye || {},
    vipPortreHediyeKoleksiyonlari: hediyeHavuzuKoleksiyonlari(durum.hediye || {}),
    vipPortreUyelikAcik: !!durum.premiumAktif,
    vipPortreUyelikKoleksiyonlari: uyelikKoleksiyonlari,
    vipPortrePremiumPaket: durum.premiumPaket || "",
  };
}

module.exports = {
  PAKET_HEDIYE_KOLEKSIYONLARI,
  paketUyelikKoleksiyonlari,
  vipPortreMi,
  vipKoleksiyonu,
  ensureVipPortreColumns,
  getVipPortreDurum,
  vipPortreHediyeHakkiAc,
  vipPortreKaliciSec,
  vipPortreEquipKontrol,
  vipPortreUyelikBitinceTemizle,
  vipPortreClientOzet,
  vipPortreKullanabilirMi,
  hediyeHavuzuKoleksiyonlari,
};
