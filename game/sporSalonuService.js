const { run, get } = require("../db/database");
const {
  SALONLAR,
  salonBul,
  salonTlMaliyet,
  salonStatMaliyetMap,
  salonKazancMap,
  YETENEK_ANAHTARLAR,
  YETENEK_ETIKET,
  ANTRENMAN_SURE_SN,
} = require("./sporSalonuCatalog");
const { icraatHarca, syncIcraatRegen } = require("./icraatService");
const { yetenekSatirlariOku, yetenekSatirlariYaz, yetenekOzeti } = require("./yetenekService");

function istanbulGunKey(tarih) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tarih || new Date());
}

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

async function ensureSporSalonu(db) {
  const cols = [
    ["spor_aktif_salon", "TEXT DEFAULT 'mahalle'"],
    ["spor_kayitli_json", "TEXT DEFAULT '[\"mahalle\"]'"],
    ["spor_xp_json", "TEXT DEFAULT '{}'"],
    ["spor_gunluk_json", "TEXT DEFAULT '{}'"],
    ["spor_gunluk_gun", "TEXT DEFAULT ''"],
    ["spor_antrenman_json", "TEXT DEFAULT ''"],
  ];
  for (const [col, def] of cols) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
}

async function aktifAntrenmanOku(db, userId) {
  await ensureSporSalonu(db);
  const row = await get(db, `SELECT spor_antrenman_json FROM players WHERE user_id = ?`, [userId]);
  const raw = jsonParse(row?.spor_antrenman_json, null);
  if (!raw || !raw.bitisTs) return null;
  const now = simdiSn();
  const kalanSaniye = Math.max(0, raw.bitisTs - now);
  const salon = salonBul(raw.salonId);
  return {
    salonId: raw.salonId,
    salonAd: salon?.ad || raw.salonId,
    yetenek: raw.yetenek,
    yetenekAd: YETENEK_ETIKET[raw.yetenek] || raw.yetenek,
    basladiTs: raw.basladiTs,
    bitisTs: raw.bitisTs,
    kazanc: raw.kazanc || 1,
    kalanSaniye,
    tamamlanabilir: kalanSaniye <= 0,
    sureSn: ANTRENMAN_SURE_SN,
  };
}

async function aktifAntrenmanYaz(db, userId, session) {
  await ensureSporSalonu(db);
  const val = session ? JSON.stringify(session) : "";
  await run(db, `UPDATE players SET spor_antrenman_json = ? WHERE user_id = ?`, [val, userId]);
}

async function durumOku(db, userId) {
  await ensureSporSalonu(db);
  const row = await get(
    db,
    `SELECT spor_aktif_salon, spor_kayitli_json, spor_xp_json, spor_gunluk_json, spor_gunluk_gun
     FROM players WHERE user_id = ?`,
    [userId]
  );
  const bugun = istanbulGunKey();
  let gunluk = jsonParse(row?.spor_gunluk_json, {});
  if (row?.spor_gunluk_gun !== bugun) {
    gunluk = {};
  }
  return {
    aktifSalon: row?.spor_aktif_salon || "mahalle",
    kayitli: jsonParse(row?.spor_kayitli_json, ["mahalle"]),
    xp: jsonParse(row?.spor_xp_json, {}),
    gunluk,
    gunlukGun: bugun,
  };
}

function salonKilitDurumu(salon, durum) {
  if (!salon.unlockOnceki) return { acik: true, kalan: 0 };
  const oncekiXp = durum.xp[salon.unlockOnceki] || 0;
  const kalan = Math.max(0, salon.unlockAntrenman - oncekiXp);
  return { acik: kalan === 0, kalan, oncekiId: salon.unlockOnceki };
}

function salonKayitliMi(salonId, durum) {
  return (durum.kayitli || []).includes(salonId);
}

function gunlukKullanim(salonId, durum) {
  return durum.gunluk[salonId] || 0;
}

function panelSalonSatir(salon, durum, yetenekler) {
  const kilit = salonKilitDurumu(salon, durum);
  const kayitli = salonKayitliMi(salon.id, durum);
  const xp = durum.xp[salon.id] || 0;
  const gunluk = gunlukKullanim(salon.id, durum);
  const statMaliyet = salonStatMaliyetMap(salon, yetenekler);
  const tahminiKazanc = salonKazancMap(salon);
  return {
    id: salon.id,
    ad: salon.ad,
    aciklama: salon.aciklama,
    aciklamaDetay: salon.aciklamaDetay || [],
    slogan: salon.slogan || salon.aciklama || "",
    kayitUcret: salon.kayitUcret,
    icraatMaliyet: salon.icraatMaliyet,
    tlCarpan: salon.tlCarpan,
    statMaliyet,
    ortalamaMaliyet: Math.round(
      YETENEK_ANAHTARLAR.reduce((s, k) => s + statMaliyet[k], 0) / YETENEK_ANAHTARLAR.length
    ),
    gunlukLimit: salon.gunlukLimit,
    gunlukKullanilan: gunluk,
    gunlukKalan: Math.max(0, salon.gunlukLimit - gunluk),
    tahminiKazanc,
    statOdak: salon.statOdak || YETENEK_ANAHTARLAR,
    toplamAntrenman: xp,
    acik: kilit.acik,
    kilitKalan: kilit.kalan,
    kilitOnceki: kilit.oncekiId || null,
    kayitli,
    aktif: durum.aktifSalon === salon.id,
    dots: salon.dots,
    tier: salon.tier,
  };
}

async function panelGetir(db, userId) {
  const durum = await durumOku(db, userId);
  const yetenekler = await yetenekSatirlariOku(db, userId);
  const icraatSync = await syncIcraatRegen(db, userId);
  const ozet = yetenekOzeti(yetenekler);
  const aktifAntrenman = await aktifAntrenmanOku(db, userId);
  return {
    aktifSalon: durum.aktifSalon,
    icraat: icraatSync.icraat,
    yetenekler,
    yetenekOzeti: ozet,
    aktifAntrenman,
    antrenmanSureDk: ANTRENMAN_SURE_SN / 60,
    salonlar: SALONLAR.map((s) => panelSalonSatir(s, durum, yetenekler)),
  };
}

async function durumYaz(db, userId, patch) {
  await ensureSporSalonu(db);
  const fields = [];
  const vals = [];
  if (patch.aktifSalon != null) {
    fields.push("spor_aktif_salon = ?");
    vals.push(patch.aktifSalon);
  }
  if (patch.kayitli != null) {
    fields.push("spor_kayitli_json = ?");
    vals.push(JSON.stringify(patch.kayitli));
  }
  if (patch.xp != null) {
    fields.push("spor_xp_json = ?");
    vals.push(JSON.stringify(patch.xp));
  }
  if (patch.gunluk != null) {
    fields.push("spor_gunluk_json = ?");
    vals.push(JSON.stringify(patch.gunluk));
    fields.push("spor_gunluk_gun = ?");
    vals.push(patch.gunlukGun || istanbulGunKey());
  }
  if (!fields.length) return;
  vals.push(userId);
  await run(db, `UPDATE players SET ${fields.join(", ")} WHERE user_id = ?`, vals);
}

async function salonSec(db, userId, salonId) {
  const salon = salonBul(salonId);
  if (!salon) return { ok: false, error: "Geçersiz spor salonu." };
  const durum = await durumOku(db, userId);
  const kilit = salonKilitDurumu(salon, durum);
  if (!kilit.acik) {
    const onceki = salonBul(kilit.onceki);
    return {
      ok: false,
      error: `${onceki?.ad || "Önceki salon"}da ${kilit.kalan} antrenman daha yapmalısın.`,
    };
  }
  if (!salonKayitliMi(salonId, durum)) {
    return { ok: false, error: "Bu salona kayıt olmadan antrenman yapamazsın." };
  }
  await durumYaz(db, userId, { aktifSalon: salonId });
  return { ok: true, mesaj: `${salon.ad} aktif salon olarak seçildi.` };
}

async function salonKayit(db, userId, player, salonId) {
  const salon = salonBul(salonId);
  if (!salon) return { ok: false, error: "Geçersiz spor salonu." };
  const durum = await durumOku(db, userId);
  const kilit = salonKilitDurumu(salon, durum);
  if (!kilit.acik) {
    return { ok: false, error: "Bu salon henüz açılmadı." };
  }
  if (salonKayitliMi(salonId, durum)) {
    return { ok: false, error: "Bu salona zaten kayıtlısın." };
  }
  const ucret = salon.kayitUcret;
  if (ucret > 0) {
    const deduct = await run(
      db,
      `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
      [ucret, userId, ucret]
    );
    if (!deduct?.changes) {
      return { ok: false, error: `Kayıt için ${ucret.toLocaleString("tr-TR")} TL gerekli.` };
    }
    player.kasa = (player.kasa || 0) - ucret;
  }
  const kayitli = [...durum.kayitli, salonId];
  await durumYaz(db, userId, { kayitli, aktifSalon: salonId });
  return {
    ok: true,
    mesaj: `${salon.ad} kaydı tamamlandı${ucret ? ` (−${ucret.toLocaleString("tr-TR")} TL)` : ""}.`,
    salonId,
    ucret,
  };
}

async function antrenmanBaslat(db, userId, player, salonId, yetenekKey) {
  const salon = salonBul(salonId);
  if (!salon) return { ok: false, error: "Geçersiz spor salonu." };
  if (!YETENEK_ANAHTARLAR.includes(yetenekKey)) {
    return { ok: false, error: "Geçersiz yetenek." };
  }

  const mevcutOturum = await aktifAntrenmanOku(db, userId);
  if (mevcutOturum) {
    if (mevcutOturum.tamamlanabilir) {
      return {
        ok: false,
        error: "Devam eden antrenmanı önce tamamlamalısın.",
        tamamlanabilir: true,
        aktifAntrenman: mevcutOturum,
      };
    }
    const dk = Math.ceil(mevcutOturum.kalanSaniye / 60);
    return {
      ok: false,
      error: `Antrenman devam ediyor. ${dk} dakika sonra yeni antrenman başlatabilirsin.`,
      aktifAntrenman: mevcutOturum,
    };
  }

  const durum = await durumOku(db, userId);
  const kilit = salonKilitDurumu(salon, durum);
  if (!kilit.acik) return { ok: false, error: "Bu salon henüz açılmadı." };
  if (!salonKayitliMi(salonId, durum)) {
    return { ok: false, error: "Önce bu salona kayıt olmalısın." };
  }

  const gunluk = gunlukKullanim(salonId, durum);
  if (gunluk >= salon.gunlukLimit) {
    return {
      ok: false,
      error: `Bugünkü antrenman hakkın doldu (${salon.gunlukLimit}/gün). Yarın tekrar dene.`,
    };
  }

  const yetenekler = await yetenekSatirlariOku(db, userId);
  const mevcut = yetenekler[yetenekKey] || 0;
  const tl = salonTlMaliyet(salon, mevcut);
  const kazanc = salon.kazanc || 1;

  const icraatSonuc = await icraatHarca(db, userId, salon.icraatMaliyet);
  if (!icraatSonuc.ok) return icraatSonuc;
  player.icraat = icraatSonuc.icraat;

  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
    [tl, userId, tl]
  );
  if (!deduct?.changes) {
    return { ok: false, error: `Antrenman için ${tl.toLocaleString("tr-TR")} TL gerekli.` };
  }
  player.kasa = (player.kasa || 0) - tl;

  const now = simdiSn();
  const session = {
    salonId,
    yetenek: yetenekKey,
    basladiTs: now,
    bitisTs: now + ANTRENMAN_SURE_SN,
    kazanc,
    tlMaliyet: tl,
  };
  await aktifAntrenmanYaz(db, userId, session);

  const xp = { ...durum.xp, [salonId]: (durum.xp[salonId] || 0) + 1 };
  const gunlukMap = { ...durum.gunluk, [salonId]: gunluk + 1 };
  await durumYaz(db, userId, {
    xp,
    gunluk: gunlukMap,
    gunlukGun: durum.gunlukGun,
    aktifSalon: salonId,
  });

  const etiket = YETENEK_ETIKET[yetenekKey] || yetenekKey;
  const aktifAntrenman = await aktifAntrenmanOku(db, userId);
  return {
    ok: true,
    mesaj: `${etiket} antrenmanı başladı! 30 dakika sonra +${kazanc} kazanacaksın.`,
    basladi: true,
    yetenek: yetenekKey,
    salonId,
    salonAd: salon.ad,
    tlMaliyet: tl,
    kalanGunluk: salon.gunlukLimit - gunluk - 1,
    aktifAntrenman,
  };
}

async function antrenmanTamamla(db, userId, player) {
  const oturum = await aktifAntrenmanOku(db, userId);
  if (!oturum) {
    return { ok: false, error: "Tamamlanacak aktif antrenman yok." };
  }
  if (!oturum.tamamlanabilir) {
    const dk = Math.ceil(oturum.kalanSaniye / 60);
    const sn = oturum.kalanSaniye % 60;
    return {
      ok: false,
      error: `Antrenman henüz bitmedi. ${dk} dk ${sn} sn kaldı.`,
      aktifAntrenman: oturum,
    };
  }

  const yetenekler = await yetenekSatirlariOku(db, userId);
  const key = oturum.yetenek;
  const mevcut = yetenekler[key] || 0;
  const kazanc = oturum.kazanc || 1;
  yetenekler[key] = mevcut + kazanc;
  const normalized = await yetenekSatirlariYaz(db, userId, yetenekler);
  await aktifAntrenmanYaz(db, userId, null);

  const etiket = YETENEK_ETIKET[key] || key;
  return {
    ok: true,
    mesaj: `${etiket} +${kazanc}! Antrenman tamamlandı.`,
    tamamlandi: true,
    yetenek: key,
    yetenekKazanc: kazanc,
    yeniDeger: normalized[key],
    yetenekler: normalized,
    salonId: oturum.salonId,
    salonAd: oturum.salonAd,
  };
}

module.exports = {
  ensureSporSalonu,
  panelGetir,
  salonSec,
  salonKayit,
  antrenmanBaslat,
  antrenmanTamamla,
  antrenmanYap: antrenmanBaslat,
  SALONLAR,
  ANTRENMAN_SURE_SN,
};
