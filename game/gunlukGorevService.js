const { run, get, all } = require("../db/database");
const { turkeyDayKey } = require("./messagingService");
const { logStatHareket } = require("./statService");
const { ICRAAT_MAX, syncIcraatRegen } = require("./icraatService");
const {
  GUNLUK_SLOT_SAYISI,
  MAX_KABUL,
  gorevBul,
  gunlukGorevSecimi,
  gunlukDagilimHesapla,
  sayginlikKatsayiHesapla,
  gorevOlcekle,
  odulMetni,
  ELMAS_GOREV_TESLIM,
  isMahalleIsi,
  isSemtIsi,
  isSehirIsi,
  esyaYuksekSeviye,
} = require("./gunlukGorevCatalog");

const SURELI_MIN_DK = 60;
const SURELI_MAX_DK = 90;

async function ensureGunlukGorevTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS gunluk_gorev_atama (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      gun_key TEXT NOT NULL,
      slot INTEGER NOT NULL,
      gorev_id TEXT NOT NULL,
      kabul_edildi INTEGER NOT NULL DEFAULT 0,
      kabul_zamani INTEGER,
      sure_limiti_var INTEGER NOT NULL DEFAULT 0,
      bitis_zamani INTEGER,
      ilerleme INTEGER NOT NULL DEFAULT 0,
      durum TEXT NOT NULL DEFAULT 'panoda',
      odul_alindi INTEGER NOT NULL DEFAULT 0,
      extra_data TEXT NOT NULL DEFAULT '{}',
      onizleme_sure_metni TEXT,
      onizleme_sure_dk INTEGER,
      UNIQUE(user_id, gun_key, slot)
    )`
  );
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN onizleme_sure_metni TEXT`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN onizleme_sure_dk INTEGER`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN hedef_adet_olcekli INTEGER`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN odul_puan_olcekli INTEGER`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN odul_icraat_olcekli INTEGER`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN odul_kasa_olcekli INTEGER`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN sayginlik_katsayi REAL`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE gunluk_gorev_atama ADD COLUMN elmas_ekstra INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_gunluk_gorev_user_gun ON gunluk_gorev_atama(user_id, gun_key)`
  );
}

function onizlemeSeed(row) {
  return `${row.user_id}:${row.gun_key}:${row.slot}:${row.gorev_id}`;
}

function onizlemeSureHesapla(def, seed) {
  if (!def.sureAlabilir) {
    return { metin: "Süresiz", dk: null };
  }
  let h = 0;
  const s = String(seed || def.id || "");
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  h = Math.abs(h);
  if (h % 2 === 1) {
    return { metin: "Gün sonu", dk: null };
  }
  const span = SURELI_MAX_DK - SURELI_MIN_DK + 1;
  const dk = SURELI_MIN_DK + (h % span);
  return { metin: `${dk} dk`, dk };
}

function onizlemeMetniGetir(row, def) {
  if (!def) return "—";
  if (!def.sureAlabilir) return "Süresiz";
  const metin = row.onizleme_sure_metni;
  if (metin && metin !== "—") return metin;
  return onizlemeSureHesapla(def, onizlemeSeed(row)).metin;
}

async function onizlemeKaydiniSenkronize(db, row, def) {
  const oniz = onizlemeSureHesapla(def, onizlemeSeed(row));
  if (row.onizleme_sure_metni === oniz.metin && row.onizleme_sure_dk === oniz.dk) {
    return oniz;
  }
  await run(
    db,
    `UPDATE gunluk_gorev_atama SET onizleme_sure_metni = ?, onizleme_sure_dk = ? WHERE id = ?`,
    [oniz.metin, oniz.dk, row.id]
  );
  row.onizleme_sure_metni = oniz.metin;
  row.onizleme_sure_dk = oniz.dk;
  return oniz;
}

async function onizlemeEksikleriTamamla(db, rows) {
  for (const row of rows) {
    const def = gorevBul(row.gorev_id);
    if (!def) continue;
    await onizlemeKaydiniSenkronize(db, row, def);
  }
}

function parseExtra(row) {
  try {
    return JSON.parse(row.extra_data || "{}");
  } catch (_) {
    return {};
  }
}

function sureMetniOlustur(row, def) {
  if (!row.kabul_edildi) {
    return onizlemeMetniGetir(row, def);
  }
  if (!def.sureAlabilir) return "Süresiz";
  if (!row.sure_limiti_var) return "Gün sonu";
  if (row.durum === "tamamlandi" || row.durum === "teslim_edildi") return "Tamamlandı";
  if (row.durum === "basarisiz") return "Süre doldu";
  if (!row.bitis_zamani) return "Süreli";
  const kalanSn = row.bitis_zamani - Math.floor(Date.now() / 1000);
  if (kalanSn <= 0) return "Süre doldu";
  const dk = Math.ceil(kalanSn / 60);
  return `${dk} dk`;
}

function olcekliVeriFromRow(row) {
  return {
    katsayi: row.sayginlik_katsayi || 1,
    hedefAdet: row.hedef_adet_olcekli,
    odul: {
      puan: row.odul_puan_olcekli || 0,
      icraat: row.odul_icraat_olcekli || 0,
      kasa: row.odul_kasa_olcekli || 0,
    },
  };
}

function olcekliVeriHazirMi(row) {
  return row.hedef_adet_olcekli != null && row.hedef_adet_olcekli > 0;
}

async function olcekliVeriGaranti(db, row, def) {
  if (olcekliVeriHazirMi(row)) return olcekliVeriFromRow(row);
  const playerRow = await get(db, `SELECT puan FROM players WHERE user_id = ?`, [row.user_id]);
  const olcek = gorevOlcekle(def, playerRow ? playerRow.puan : 1500);
  await run(
    db,
    `UPDATE gunluk_gorev_atama
     SET hedef_adet_olcekli = ?, odul_puan_olcekli = ?, odul_icraat_olcekli = ?, odul_kasa_olcekli = ?, sayginlik_katsayi = ?
     WHERE id = ?`,
    [olcek.hedefAdet, olcek.odul.puan, olcek.odul.icraat, olcek.odul.kasa, olcek.katsayi, row.id]
  );
  row.hedef_adet_olcekli = olcek.hedefAdet;
  row.odul_puan_olcekli = olcek.odul.puan;
  row.odul_icraat_olcekli = olcek.odul.icraat;
  row.odul_kasa_olcekli = olcek.odul.kasa;
  row.sayginlik_katsayi = olcek.katsayi;
  return olcek;
}

async function satirDonustur(db, row) {
  const def = gorevBul(row.gorev_id);
  if (!def) return null;
  const olcek = await olcekliVeriGaranti(db, row, def);
  return {
    slot: row.slot,
    gorevId: row.gorev_id,
    ad: def.ad,
    zorluk: def.zorluk,
    hedefAdet: olcek.hedefAdet,
    ilerleme: row.ilerleme,
    odul: olcek.odul,
    odulMetni: odulMetni(olcek.odul),
    sayginlikKatsayi: olcek.katsayi,
    durum: row.durum,
    kabulEdildi: !!row.kabul_edildi,
    sureMetni: sureMetniOlustur(row, def),
    bitisZamani: row.bitis_zamani || null,
    odulAlindi: !!row.odul_alindi,
    elmasEkstra: !!row.elmas_ekstra,
  };
}

async function tamamlananGorevSayisi(db, userId) {
  const gunKey = turkeyDayKey();
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM gunluk_gorev_atama
     WHERE user_id = ? AND gun_key = ? AND durum = 'tamamlandi'`,
    [userId, gunKey]
  );
  return row ? row.n : 0;
}

async function gunlukGorevBildirimVarMi(db, userId) {
  await ensureGunlukGorevTables(db);
  await suresiDolanlariKontrol(db, userId);
  return (await tamamlananGorevSayisi(db, userId)) > 0;
}

async function gunlukSatirlariGetir(db, userId, gunKey) {
  return all(
    db,
    `SELECT * FROM gunluk_gorev_atama
     WHERE user_id = ? AND gun_key = ?
     ORDER BY slot ASC`,
    [userId, gunKey]
  );
}

async function kabulSayisi(db, userId, gunKey) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM gunluk_gorev_atama
     WHERE user_id = ? AND gun_key = ? AND kabul_edildi = 1 AND COALESCE(elmas_ekstra, 0) = 0`,
    [userId, gunKey]
  );
  return row ? row.n : 0;
}

async function gunlukAtamaOlustur(db, userId, gunKey) {
  const playerRow = await get(db, `SELECT puan FROM players WHERE user_id = ?`, [userId]);
  const puan = playerRow ? playerRow.puan : 1500;
  const secim = gunlukGorevSecimi(puan);
  for (let slot = 1; slot <= GUNLUK_SLOT_SAYISI; slot++) {
    const gorevId = secim[slot - 1];
    const def = gorevBul(gorevId);
    const oniz = def
      ? onizlemeSureHesapla(def, `${userId}:${gunKey}:${slot}:${gorevId}`)
      : { metin: "—", dk: null };
    const olcek = def ? gorevOlcekle(def, puan) : { hedefAdet: 1, odul: { puan: 0, icraat: 0, kasa: 0 }, katsayi: 1 };
    await run(
      db,
      `INSERT INTO gunluk_gorev_atama (
         user_id, gun_key, slot, gorev_id, durum, onizleme_sure_metni, onizleme_sure_dk,
         hedef_adet_olcekli, odul_puan_olcekli, odul_icraat_olcekli, odul_kasa_olcekli, sayginlik_katsayi
       )
       VALUES (?, ?, ?, ?, 'panoda', ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, gunKey, slot, gorevId, oniz.metin, oniz.dk,
        olcek.hedefAdet, olcek.odul.puan, olcek.odul.icraat, olcek.odul.kasa, olcek.katsayi,
      ]
    );
  }
}

async function ensureGunlukAtama(db, userId) {
  await ensureGunlukGorevTables(db);
  const gunKey = turkeyDayKey();
  let rows = await gunlukSatirlariGetir(db, userId, gunKey);
  if (rows.length >= GUNLUK_SLOT_SAYISI) {
    await onizlemeEksikleriTamamla(db, rows);
    return gunlukSatirlariGetir(db, userId, gunKey);
  }

  const yeniGun = true;
  if (rows.length > 0) {
    await run(
      db,
      `DELETE FROM gunluk_gorev_atama WHERE user_id = ? AND gun_key = ?`,
      [userId, gunKey]
    );
  }
  await gunlukAtamaOlustur(db, userId, gunKey);
  rows = await gunlukSatirlariGetir(db, userId, gunKey);
  await onizlemeEksikleriTamamla(db, rows);
  if (yeniGun) {
    const { bildirimGonder } = require("./bildirimService");
    bildirimGonder(db, userId, "gunluk_gorev", {
      baslik: "Günlük Görevler Yenilendi",
      icerik: "Yeni günlük görevler panonda seni bekliyor.",
      url: "/?ekran=gunlukGorevler",
    }).catch(() => {});
  }
  return rows;
}

async function suresiDolanlariKontrol(db, userId) {
  const gunKey = turkeyDayKey();
  const now = Math.floor(Date.now() / 1000);
  const rows = await all(
    db,
    `SELECT * FROM gunluk_gorev_atama
     WHERE user_id = ? AND gun_key = ?
       AND kabul_edildi = 1
       AND durum = 'aktif'
       AND sure_limiti_var = 1
       AND bitis_zamani IS NOT NULL
       AND bitis_zamani <= ?`,
    [userId, gunKey, now]
  );
  for (const row of rows) {
    const def = gorevBul(row.gorev_id);
    if (!def) continue;
    const olcek = await olcekliVeriGaranti(db, row, def);
    if (row.ilerleme >= olcek.hedefAdet) {
      await run(db, `UPDATE gunluk_gorev_atama SET durum = 'tamamlandi' WHERE id = ?`, [row.id]);
    } else {
      await run(db, `UPDATE gunluk_gorev_atama SET durum = 'basarisiz' WHERE id = ?`, [row.id]);
    }
  }
}

async function panelGetir(db, userId) {
  await suresiDolanlariKontrol(db, userId);
  const gunKey = turkeyDayKey();
  const rows = await ensureGunlukAtama(db, userId);
  const kabul = await kabulSayisi(db, userId, gunKey);
  const tamamlanan = await tamamlananGorevSayisi(db, userId);
  const gorevler = [];
  for (const row of rows) {
    const g = await satirDonustur(db, row);
    if (g) gorevler.push(g);
  }
  const playerRow = await get(db, `SELECT puan, elmas FROM players WHERE user_id = ?`, [userId]);
  const sayginlik = playerRow ? playerRow.puan : 1500;
  const sayginlikKatsayi = sayginlikKatsayiHesapla(sayginlik);
  const zorlukDagilimi = gunlukDagilimHesapla(sayginlik);
  return {
    ok: true,
    gunKey,
    kabulLimit: MAX_KABUL,
    kabulSayisi: kabul,
    tamamlananSayisi: tamamlanan,
    gunlukGorevBildirim: tamamlanan > 0,
    sayginlik,
    sayginlikKatsayi,
    zorlukDagilimi,
    elmasGorevTeslim: ELMAS_GOREV_TESLIM,
    oyuncuElmas: playerRow?.elmas || 0,
    gorevler,
  };
}

function kabulSuresiUygula(def, row, now) {
  if (!def.sureAlabilir) {
    return { sure_limiti_var: 0, bitis_zamani: null };
  }
  if (row.onizleme_sure_dk) {
    return { sure_limiti_var: 1, bitis_zamani: now + row.onizleme_sure_dk * 60 };
  }
  return { sure_limiti_var: 0, bitis_zamani: null };
}

async function gorevKabul(db, userId, slot) {
  await ensureGunlukGorevTables(db);
  await suresiDolanlariKontrol(db, userId);
  const gunKey = turkeyDayKey();
  const slotNo = parseInt(slot, 10);
  if (!slotNo || slotNo < 1 || slotNo > GUNLUK_SLOT_SAYISI) {
    return { ok: false, error: "Geçersiz görev slotu." };
  }

  const kabul = await kabulSayisi(db, userId, gunKey);
  const ucretsizKotaDolu = kabul >= MAX_KABUL;

  const row = await get(
    db,
    `SELECT * FROM gunluk_gorev_atama WHERE user_id = ? AND gun_key = ? AND slot = ?`,
    [userId, gunKey, slotNo]
  );
  if (!row) return { ok: false, error: "Görev bulunamadı." };
  if (row.kabul_edildi) return { ok: false, error: "Bu görevi zaten kabul ettin." };
  if (row.durum !== "panoda" && row.durum !== "iptal") {
    return { ok: false, error: "Bu görev artık kabul edilemez." };
  }

  const def = gorevBul(row.gorev_id);
  if (!def) return { ok: false, error: "Görev tanımı bulunamadı." };

  const oniz = await onizlemeKaydiniSenkronize(db, row, def);
  row.onizleme_sure_metni = oniz.metin;
  row.onizleme_sure_dk = oniz.dk;

  const now = Math.floor(Date.now() / 1000);
  const sure = kabulSuresiUygula(def, row, now);
  const elmasEkstra = ucretsizKotaDolu ? 1 : 0;
  await run(
    db,
    `UPDATE gunluk_gorev_atama
     SET kabul_edildi = 1, kabul_zamani = ?, sure_limiti_var = ?, bitis_zamani = ?,
         durum = 'aktif', elmas_ekstra = ?
     WHERE id = ?`,
    [now, sure.sure_limiti_var, sure.bitis_zamani, elmasEkstra, row.id]
  );

  const guncel = await get(db, `SELECT * FROM gunluk_gorev_atama WHERE id = ?`, [row.id]);
  return {
    ok: true,
    gorev: await satirDonustur(db, guncel),
    kabulSayisi: kabul,
    elmasEkstra: !!elmasEkstra,
  };
}

async function ilerlemeArtir(db, row, def, artis, extraGuncelle = null) {
  if (row.durum !== "aktif") return;
  const olcek = await olcekliVeriGaranti(db, row, def);
  const yeni = Math.min(olcek.hedefAdet, row.ilerleme + artis);
  const yeniDurum = yeni >= olcek.hedefAdet ? "tamamlandi" : "aktif";
  if (extraGuncelle) {
    await run(
      db,
      `UPDATE gunluk_gorev_atama SET ilerleme = ?, durum = ?, extra_data = ? WHERE id = ?`,
      [yeni, yeniDurum, JSON.stringify(extraGuncelle), row.id]
    );
  } else {
    await run(
      db,
      `UPDATE gunluk_gorev_atama SET ilerleme = ?, durum = ? WHERE id = ?`,
      [yeni, yeniDurum, row.id]
    );
  }
}

function hedefKayitliMi(extra, hedefUserId) {
  const hedefId = Number(hedefUserId);
  if (!hedefId) return false;
  return (extra.hedefler || []).some((id) => Number(id) === hedefId);
}

function hedefEkle(extra, hedefUserId) {
  const hedefId = Number(hedefUserId);
  const mevcut = (extra.hedefler || []).map((id) => Number(id)).filter(Boolean);
  if (!hedefId || mevcut.includes(hedefId)) return { hedefler: mevcut };
  return { hedefler: [...mevcut, hedefId] };
}

async function olayUyuyorMu(def, olay, meta, extra) {
  switch (def.tur) {
    case "saldiri":
      return olay === "saldiri_kazan";
    case "saldiri_farkli":
      if (olay !== "saldiri_kazan" || !meta.hedefUserId) return false;
      return !hedefKayitliMi(extra, meta.hedefUserId);
    case "is_mahalle":
      return olay === "is_yap" && isMahalleIsi(meta.jobKey);
    case "is_semt":
      return olay === "is_yap" && isSemtIsi(meta.jobKey);
    case "is_sehir":
      return olay === "is_yap" && isSehirIsi(meta.jobKey);
    case "is_mahalle_semt":
      return olay === "is_yap" && (isMahalleIsi(meta.jobKey) || isSemtIsi(meta.jobKey));
    case "esya":
      return olay === "esya_al";
    case "esya_yuksek":
      return olay === "esya_al" && esyaYuksekSeviye(meta.hireKey);
    case "sektor":
      return olay === "sektor_al";
    case "istihbarat":
      if (olay !== "istihbarat_basari" || !meta.hedefUserId) return false;
      return !hedefKayitliMi(extra, meta.hedefUserId);
    case "mafya_isi":
      return olay === "mafya_is";
    default:
      return false;
  }
}

async function gorevOlayIsle(db, userId, olay, meta = {}) {
  await ensureGunlukGorevTables(db);
  await suresiDolanlariKontrol(db, userId);
  const gunKey = turkeyDayKey();
  const rows = await all(
    db,
    `SELECT * FROM gunluk_gorev_atama
     WHERE user_id = ? AND gun_key = ? AND kabul_edildi = 1 AND durum = 'aktif'`,
    [userId, gunKey]
  );
  let yeniTamamlanan = 0;
  for (const row of rows) {
    const def = gorevBul(row.gorev_id);
    if (!def) continue;
    const extra = parseExtra(row);
    const uyuyor = await olayUyuyorMu(def, olay, meta, extra);
    if (!uyuyor) continue;

    let artis = meta.adet || 1;
    let yeniExtra = null;
    if (
      (def.tur === "saldiri_farkli" || def.tur === "istihbarat") &&
      meta.hedefUserId
    ) {
      yeniExtra = hedefEkle(extra, meta.hedefUserId);
      artis = 1;
    }
    const oncekiDurum = row.durum;
    const oncekiIlerleme = row.ilerleme;
    await ilerlemeArtir(db, row, def, artis, yeniExtra);
    const olcek = await olcekliVeriGaranti(db, row, def);
    const yeniIlerleme = Math.min(olcek.hedefAdet, oncekiIlerleme + artis);
    if (oncekiDurum === "aktif" && yeniIlerleme >= olcek.hedefAdet) {
      yeniTamamlanan += 1;
    }
  }
  return { yeniTamamlanan };
}

async function gorevOdulUygula(db, userId, player, row, olcek) {
  player.kasa += olcek.odul.kasa || 0;
  player.puan += olcek.odul.puan || 0;
  if (olcek.odul.icraat) {
    const icraatSync = await syncIcraatRegen(db, userId);
    player.icraat = Math.min(ICRAAT_MAX, icraatSync.icraat + olcek.odul.icraat);
  }
  await run(
    db,
    `UPDATE players SET kasa = ?, puan = ?, icraat = ? WHERE user_id = ?`,
    [player.kasa, player.puan, player.icraat, userId]
  );
  if (olcek.odul.puan) {
    await logStatHareket(db, userId, "sayginlik", olcek.odul.puan);
  }
  await run(
    db,
    `UPDATE gunluk_gorev_atama SET durum = 'teslim_edildi', odul_alindi = 1 WHERE id = ?`,
    [row.id]
  );
}

async function gorevElmasTamamla(db, userId, slot, player) {
  await ensureGunlukGorevTables(db);
  await suresiDolanlariKontrol(db, userId);
  const gunKey = turkeyDayKey();
  const slotNo = parseInt(slot, 10);
  if (!slotNo || slotNo < 1 || slotNo > GUNLUK_SLOT_SAYISI) {
    return { ok: false, error: "Geçersiz görev slotu." };
  }

  const row = await get(
    db,
    `SELECT * FROM gunluk_gorev_atama WHERE user_id = ? AND gun_key = ? AND slot = ?`,
    [userId, gunKey, slotNo]
  );
  if (!row) return { ok: false, error: "Görev bulunamadı." };
  if (row.odul_alindi || row.durum === "teslim_edildi") {
    return { ok: false, error: "Bu görev zaten teslim edildi." };
  }
  if (row.durum === "basarisiz") {
    return { ok: false, error: "Başarısız görev elmasla tamamlanamaz." };
  }
  if (!(row.durum === "aktif" && row.kabul_edildi && row.elmas_ekstra)) {
    return { ok: false, error: "Bu görev elmasla teslim edilemez." };
  }

  const def = gorevBul(row.gorev_id);
  if (!def) return { ok: false, error: "Görev tanımı bulunamadı." };

  const olcek = await olcekliVeriGaranti(db, row, def);
  const maliyet = ELMAS_GOREV_TESLIM;

  const elmasRow = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
  const elmas = elmasRow?.elmas || 0;
  if (elmas < maliyet) {
    return {
      ok: false,
      error: `Yeterli elmasın yok! ${maliyet.toLocaleString("tr-TR")} elmas gerekir.`,
    };
  }

  await run(
    db,
    `UPDATE gunluk_gorev_atama SET ilerleme = ?, durum = 'tamamlandi' WHERE id = ?`,
    [olcek.hedefAdet, row.id]
  );
  row.ilerleme = olcek.hedefAdet;
  row.durum = "tamamlandi";

  await run(db, `UPDATE players SET elmas = elmas - ? WHERE user_id = ?`, [maliyet, userId]);
  player.elmas = elmas - maliyet;

  await gorevOdulUygula(db, userId, player, row, olcek);

  const guncel = await get(db, `SELECT * FROM gunluk_gorev_atama WHERE id = ?`, [row.id]);
  return {
    ok: true,
    maliyet,
    odul: olcek.odul,
    odulMetni: odulMetni(olcek.odul),
    gorev: await satirDonustur(db, guncel),
    mesaj: `Görev 1 elmasla teslim edildi! ${odulMetni(olcek.odul)} kazandın.`,
  };
}

async function gorevOdulAl(db, userId, slot, player) {
  await suresiDolanlariKontrol(db, userId);
  const gunKey = turkeyDayKey();
  const slotNo = parseInt(slot, 10);
  const row = await get(
    db,
    `SELECT * FROM gunluk_gorev_atama
     WHERE user_id = ? AND gun_key = ? AND slot = ?`,
    [userId, gunKey, slotNo]
  );
  if (!row) return { ok: false, error: "Görev bulunamadı." };
  if (row.durum !== "tamamlandi") {
    return { ok: false, error: "Bu görev henüz tamamlanmadı veya ödül alınamaz." };
  }
  if (row.odul_alindi) return { ok: false, error: "Ödül zaten alındı." };

  const def = gorevBul(row.gorev_id);
  if (!def) return { ok: false, error: "Görev tanımı bulunamadı." };

  const olcek = await olcekliVeriGaranti(db, row, def);

  if (row.elmas_ekstra) {
    const maliyet = ELMAS_GOREV_TESLIM;
    const elmasRow = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [userId]);
    const elmas = elmasRow?.elmas || 0;
    if (elmas < maliyet) {
      return {
        ok: false,
        error: `Teslim için ${maliyet} elmas gerekir.`,
      };
    }
    await run(db, `UPDATE players SET elmas = elmas - ? WHERE user_id = ?`, [maliyet, userId]);
    player.elmas = elmas - maliyet;
  }

  await gorevOdulUygula(db, userId, player, row, olcek);

  return {
    ok: true,
    odul: olcek.odul,
    odulMetni: odulMetni(olcek.odul),
    gorev: await satirDonustur(db, { ...row, durum: "teslim_edildi", odul_alindi: 1 }),
  };
}

module.exports = {
  ensureGunlukGorevTables,
  panelGetir,
  gorevKabul,
  gorevOdulAl,
  gorevElmasTamamla,
  gorevOlayIsle,
  suresiDolanlariKontrol,
  gunlukGorevBildirimVarMi,
  tamamlananGorevSayisi,
};
