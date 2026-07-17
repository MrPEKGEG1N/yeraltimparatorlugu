const crypto = require("crypto");
const { run, get } = require("../db/database");
const { chipGetir, chipGuncelle, ensureKumarhaneTables, logEkle } = require("./kumarhaneService");
const { enforceNoAltAccount } = require("./securityService");
const { zarAt } = require("./kumarhane/barbut");

const PVP_OYUNLAR = new Set(["barbut", "rus_ruleti"]);
const PVP_MIN_BAHIS = 10_000;
const PVP_MAX_BAHIS = 5_000_000;
const ONLINE_SN = 120;

async function ensureMasaTables(db) {
  await ensureKumarhaneTables(db);
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS kumarhane_pvp_masa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oyun_id TEXT NOT NULL,
      oyuncu1_id INTEGER NOT NULL,
      rakip_id INTEGER,
      bahis INTEGER NOT NULL DEFAULT ${PVP_MIN_BAHIS},
      onerilen_bahis INTEGER,
      onerilen_kim INTEGER,
      durum TEXT NOT NULL DEFAULT 'bekleme',
      hazir1 INTEGER NOT NULL DEFAULT 0,
      hazir2 INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL DEFAULT '{}',
      sonuc_json TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (oyuncu1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (rakip_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_kumarhane_pvp_oyun ON kumarhane_pvp_masa(oyun_id, durum)`
  );
}

function simdi() {
  return Math.floor(Date.now() / 1000);
}

async function oyuncuOnlineMi(db, userId) {
  const row = await get(db, `SELECT last_seen_at FROM players WHERE user_id = ?`, [userId]);
  return (row?.last_seen_at || 0) >= simdi() - ONLINE_SN;
}

async function oyuncuBilgi(db, userId) {
  if (!userId) return null;
  const row = await get(
    db,
    `SELECT u.id, u.reis_adi, u.lakap, p.last_seen_at
     FROM users u
     JOIN players p ON p.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );
  if (!row) return null;
  return {
    id: row.id,
    ad: row.reis_adi,
    lakap: row.lakap || "Mafya",
    online: (row.last_seen_at || 0) >= simdi() - ONLINE_SN,
  };
}

async function masaSatirGetir(db, masaId) {
  return get(db, `SELECT * FROM kumarhane_pvp_masa WHERE id = ?`, [masaId]);
}

async function aktifMasaGetir(db, userId) {
  await ensureMasaTables(db);
  return get(
    db,
    `SELECT * FROM kumarhane_pvp_masa
     WHERE oyuncu1_id = ? OR rakip_id = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [userId, userId]
  );
}

function parseState(row) {
  try {
    return JSON.parse(row?.state_json || "{}");
  } catch (_) {
    return {};
  }
}

function parseSonuc(row) {
  try {
    return row?.sonuc_json ? JSON.parse(row.sonuc_json) : null;
  } catch (_) {
    return null;
  }
}

async function masaOzeti(db, row, viewerId) {
  const p1 = await oyuncuBilgi(db, row.oyuncu1_id);
  const p2 = await oyuncuBilgi(db, row.rakip_id);
  const benOyuncu1 = row.oyuncu1_id === viewerId;
  const onayBekliyor =
    row.durum === "bahis_onay" && row.onerilen_kim && row.onerilen_kim !== viewerId;
  return {
    id: row.id,
    oyunId: row.oyun_id,
    durum: row.durum,
    bahis: row.bahis,
    pot: row.rakip_id ? row.bahis * 2 : row.bahis,
    minBahis: PVP_MIN_BAHIS,
    oyuncu1: p1,
    oyuncu2: p2,
    ben: benOyuncu1 ? 1 : 2,
    hazir1: !!row.hazir1,
    hazir2: !!row.hazir2,
    benHazir: benOyuncu1 ? !!row.hazir1 : !!row.hazir2,
    rakipHazir: benOyuncu1 ? !!row.hazir2 : !!row.hazir1,
    onerilenBahis: row.onerilen_bahis || null,
    onerilenKim: row.onerilen_kim || null,
    onayBekliyor,
    oyunState: parseState(row),
    sonuc: parseSonuc(row),
    ikisiHazir: !!row.rakip_id && !!row.hazir1 && !!row.hazir2 && row.durum !== "bahis_onay",
  };
}

async function bildirimGonder(db, userId, baslik, icerik) {
  const { bildirimGonder: gonder } = require("./bildirimService");
  await gonder(db, userId, "kumarhane_pvp", {
    baslik,
    icerik,
    url: "/?ekran=kumarhane",
  }).catch(() => {});
}

async function masayaOtur(db, userId, oyunId, securityMeta = {}) {
  await ensureMasaTables(db);
  if (!PVP_OYUNLAR.has(oyunId)) {
    return { ok: false, error: "Bu oyun için masa bulunamadı." };
  }
  if (!(await oyuncuOnlineMi(db, userId))) {
    return { ok: false, error: "Oyuncuya karşı oynamak için online olmalısın." };
  }

  const mevcut = await aktifMasaGetir(db, userId);
  if (mevcut) {
    if (mevcut.oyun_id !== oyunId) {
      return { ok: false, error: "Başka bir masada oturuyorsun. Önce masadan kalk." };
    }
    return { ok: true, masa: await masaOzeti(db, mevcut, userId) };
  }

  const now = simdi();
  const acik = await get(
    db,
    `SELECT m.* FROM kumarhane_pvp_masa m
     JOIN players p ON p.user_id = m.oyuncu1_id
     WHERE m.oyun_id = ? AND m.rakip_id IS NULL AND m.oyuncu1_id != ?
       AND m.durum IN ('bekleme', 'hazirlik', 'bahis_onay')
       AND p.last_seen_at >= ?
     ORDER BY m.updated_at ASC LIMIT 1`,
    [oyunId, userId, now - ONLINE_SN]
  );

  if (acik) {
    const altCheck = await enforceNoAltAccount(db, userId, acik.oyuncu1_id, "kumarhane_masa", securityMeta);
    if (!altCheck.ok) return altCheck;
    if (!(await oyuncuOnlineMi(db, acik.oyuncu1_id))) {
      return { ok: false, error: "Masa sahibi artık online değil." };
    }
    await run(
      db,
      `UPDATE kumarhane_pvp_masa
       SET rakip_id = ?, durum = 'hazirlik', hazir1 = 0, hazir2 = 0, updated_at = ?
       WHERE id = ?`,
      [userId, now, acik.id]
    );
    const host = await oyuncuBilgi(db, acik.oyuncu1_id);
    const guest = await oyuncuBilgi(db, userId);
    await bildirimGonder(
      db,
      acik.oyuncu1_id,
      "Kumarhane Masası",
      `${guest?.ad || "Rakip"} ${oyunId === "barbut" ? "Barbut" : "Rus Ruleti"} masasına oturdu.`
    );
    const row = await masaSatirGetir(db, acik.id);
    return { ok: true, masa: await masaOzeti(db, row, userId), mesaj: `${host?.ad || "Rakip"} masasına oturdun.` };
  }

  const ins = await run(
    db,
    `INSERT INTO kumarhane_pvp_masa (oyun_id, oyuncu1_id, bahis, durum, updated_at, created_at)
     VALUES (?, ?, ?, 'bekleme', ?, ?)`,
    [oyunId, userId, PVP_MIN_BAHIS, now, now]
  );
  const row = await masaSatirGetir(db, ins.lastID);
  return {
    ok: true,
    masa: await masaOzeti(db, row, userId),
    mesaj: "Masaya oturdun — rakip bekleniyor.",
  };
}

async function masadanKalk(db, userId) {
  await ensureMasaTables(db);
  const masa = await aktifMasaGetir(db, userId);
  if (!masa) return { ok: false, error: "Aktif masan yok." };

  const now = simdi();
  if (masa.oyuncu1_id === userId) {
    if (masa.rakip_id) {
      await bildirimGonder(db, masa.rakip_id, "Kumarhane Masası", "Rakibin masadan ayrıldı.");
    }
    await run(db, `DELETE FROM kumarhane_pvp_masa WHERE id = ?`, [masa.id]);
  } else {
    await run(
      db,
      `UPDATE kumarhane_pvp_masa
       SET rakip_id = NULL, durum = 'bekleme', hazir1 = 0, hazir2 = 0,
           onerilen_bahis = NULL, onerilen_kim = NULL, state_json = '{}', sonuc_json = NULL, updated_at = ?
       WHERE id = ?`,
      [now, masa.id]
    );
    await bildirimGonder(db, masa.oyuncu1_id, "Kumarhane Masası", "Rakibin masadan ayrıldı.");
  }
  return { ok: true, mesaj: "Masadan kalktın." };
}

async function bahisOner(db, userId, miktar) {
  await ensureMasaTables(db);
  const masa = await aktifMasaGetir(db, userId);
  if (!masa || !masa.rakip_id) return { ok: false, error: "Bahis değiştirmek için masada rakip olmalı." };
  if (masa.durum === "oyun") return { ok: false, error: "Oyun devam ederken bahis değiştirilemez." };

  const bahis = parseInt(miktar, 10);
  if (!Number.isFinite(bahis) || bahis < PVP_MIN_BAHIS) {
    return { ok: false, error: `Oyuncuya karşı minimum bahis ${PVP_MIN_BAHIS.toLocaleString("tr-TR")} çiptir.` };
  }
  if (bahis > PVP_MAX_BAHIS) {
    return { ok: false, error: "Bahis çok yüksek." };
  }
  if (bahis === masa.bahis) return { ok: false, error: "Zaten bu bahisle oynuyorsunuz." };

  const chip = await chipGetir(db, userId);
  if (chip < bahis) {
    return { ok: false, error: `Yeterli çipin yok! ${bahis.toLocaleString("tr-TR")} çip gerekir.` };
  }

  const rakipId = masa.oyuncu1_id === userId ? masa.rakip_id : masa.oyuncu1_id;
  const rakipChip = await chipGetir(db, rakipId);
  if (rakipChip < bahis) {
    return { ok: false, error: "Rakibin bu bahis için yeterli çipi yok." };
  }

  const now = simdi();
  await run(
    db,
    `UPDATE kumarhane_pvp_masa
     SET onerilen_bahis = ?, onerilen_kim = ?, durum = 'bahis_onay', hazir1 = 0, hazir2 = 0, updated_at = ?
     WHERE id = ?`,
    [bahis, userId, now, masa.id]
  );

  const ben = await oyuncuBilgi(db, userId);
  await bildirimGonder(
    db,
    rakipId,
    "Bahis Onayı",
    `${ben?.ad || "Rakip"} bahisi ${bahis.toLocaleString("tr-TR")} çipe çekmek istiyor.`
  );

  const row = await masaSatirGetir(db, masa.id);
  return {
    ok: true,
    masa: await masaOzeti(db, row, userId),
    mesaj: `Bahis teklifi gönderildi: ${bahis.toLocaleString("tr-TR")} çip.`,
  };
}

async function bahisCevap(db, userId, kabul) {
  await ensureMasaTables(db);
  const masa = await aktifMasaGetir(db, userId);
  if (!masa || masa.durum !== "bahis_onay") {
    return { ok: false, error: "Bekleyen bahis teklifi yok." };
  }
  if (masa.onerilen_kim === userId) {
    return { ok: false, error: "Kendi teklifini onaylayamazsın." };
  }

  const now = simdi();
  if (!kabul) {
    await run(
      db,
      `UPDATE kumarhane_pvp_masa
       SET durum = 'hazirlik', onerilen_bahis = NULL, onerilen_kim = NULL, updated_at = ?
       WHERE id = ?`,
      [now, masa.id]
    );
    if (masa.onerilen_kim) {
      await bildirimGonder(db, masa.onerilen_kim, "Bahis Reddedildi", "Rakibin bahis teklifini reddetti.");
    }
    const row = await masaSatirGetir(db, masa.id);
    return { ok: true, masa: await masaOzeti(db, row, userId), mesaj: "Bahis teklifi reddedildi." };
  }

  const yeniBahis = masa.onerilen_bahis;
  for (const uid of [masa.oyuncu1_id, masa.rakip_id]) {
    const chip = await chipGetir(db, uid);
    if (chip < yeniBahis) {
      return { ok: false, error: "Taraflardan birinin çipi yeni bahsi karşılamıyor." };
    }
  }

  await run(
    db,
    `UPDATE kumarhane_pvp_masa
     SET bahis = ?, durum = 'hazirlik', onerilen_bahis = NULL, onerilen_kim = NULL,
         hazir1 = 0, hazir2 = 0, updated_at = ?
     WHERE id = ?`,
    [yeniBahis, now, masa.id]
  );

  if (masa.onerilen_kim) {
    await bildirimGonder(
      db,
      masa.onerilen_kim,
      "Bahis Onaylandı",
      `Yeni bahis: ${yeniBahis.toLocaleString("tr-TR")} çip. Hazır ver.`
    );
  }

  const row = await masaSatirGetir(db, masa.id);
  return {
    ok: true,
    masa: await masaOzeti(db, row, userId),
    mesaj: `Bahis ${yeniBahis.toLocaleString("tr-TR")} çip olarak güncellendi.`,
  };
}

async function hazirToggle(db, userId) {
  await ensureMasaTables(db);
  const masa = await aktifMasaGetir(db, userId);
  if (!masa || !masa.rakip_id) return { ok: false, error: "Hazır olmak için masada rakip gerekir." };
  if (masa.durum === "bahis_onay") {
    return { ok: false, error: "Önce bahis teklifini sonuçlandır." };
  }
  if (masa.durum === "oyun") return { ok: false, error: "Oyun devam ediyor." };

  const bahis = masa.bahis;
  const chip = await chipGetir(db, userId);
  if (chip < bahis) {
    return { ok: false, error: `Hazır olmak için ${bahis.toLocaleString("tr-TR")} çip gerekir.` };
  }

  const ben1 = masa.oyuncu1_id === userId;
  const alan = ben1 ? "hazir1" : "hazir2";
  const mevcut = ben1 ? masa.hazir1 : masa.hazir2;
  const yeni = mevcut ? 0 : 1;

  await run(
    db,
    `UPDATE kumarhane_pvp_masa SET ${alan} = ?, durum = 'hazirlik', updated_at = ? WHERE id = ?`,
    [yeni, simdi(), masa.id]
  );

  const row = await masaSatirGetir(db, masa.id);
  return {
    ok: true,
    masa: await masaOzeti(db, row, userId),
    mesaj: yeni ? "Hazırsın." : "Hazır durumunu kaldırdın.",
  };
}

async function potTahsil(db, masa) {
  const bahis = masa.bahis;
  const allIn = {};
  for (const uid of [masa.oyuncu1_id, masa.rakip_id]) {
    const chip = await chipGetir(db, uid);
    allIn[uid] = bahis > 0 && chip === bahis;
    const ok = await chipGuncelle(db, uid, -bahis);
    if (!ok) {
      return { ok: false, error: "Çip tahsil edilemedi — yetersiz bakiye." };
    }
  }
  return { ok: true, allIn };
}

async function pvpAllInRozetIsle(db, allInMap, kazananId, kaybedenId) {
  if (!kazananId || !kaybedenId || !allInMap) return;
  try {
    const { basariRozetArtir } = require("./basariRozetService");
    if (allInMap[kazananId]) await basariRozetArtir(db, kazananId, "casino_allin_win", 1);
    if (allInMap[kaybedenId]) await basariRozetArtir(db, kaybedenId, "casino_allin_bust", 1);
  } catch (err) {
    console.warn("[kumarhane-pvp] all-in rozet:", err?.message || err);
  }
}

function barbutPvpSonuc() {
  let z1a;
  let z1b;
  let z2a;
  let z2b;
  let t1;
  let t2;
  let guard = 0;
  do {
    [z1a, z1b] = zarAt();
    [z2a, z2b] = zarAt();
    t1 = z1a + z1b;
    t2 = z2a + z2b;
    guard += 1;
  } while (t1 === t2 && guard < 20);
  return {
    oyuncu1: { z1: z1a, z2: z1b, toplam: t1 },
    oyuncu2: { z1: z2a, z2: z2b, toplam: t2 },
    beraberlik: t1 === t2,
  };
}

async function masaOyna(db, userId, securityMeta = {}) {
  await ensureMasaTables(db);
  const masa = await aktifMasaGetir(db, userId);
  if (!masa || !masa.rakip_id) return { ok: false, error: "Oynamak için masada rakip gerekir." };
  if (masa.durum === "bahis_onay") {
    return { ok: false, error: "Önce bahis teklifini sonuçlandır." };
  }
  const sonucKapat = masa.durum === "sonuc";
  const rusDevam = masa.durum === "oyun" && masa.oyun_id === "rus_ruleti";
  if (!sonucKapat && !rusDevam && (!masa.hazir1 || !masa.hazir2)) {
    return { ok: false, error: "Her iki oyuncu da hazır olmalı." };
  }

  const rakipId = masa.oyuncu1_id === userId ? masa.rakip_id : masa.oyuncu1_id;
  const altCheck = await enforceNoAltAccount(db, userId, rakipId, "kumarhane_pvp_oyna", securityMeta);
  if (!altCheck.ok) return altCheck;

  if (!(await oyuncuOnlineMi(db, userId)) || !(await oyuncuOnlineMi(db, rakipId))) {
    return { ok: false, error: "Oyuncuya karşı oyun için her iki taraf da online olmalı." };
  }

  if (masa.oyun_id === "barbut") {
    return barbutOyna(db, masa, userId);
  }
  if (masa.oyun_id === "rus_ruleti") {
    return rusOyna(db, masa, userId);
  }
  return { ok: false, error: "Geçersiz masa oyunu." };
}

async function barbutOyna(db, masa, userId) {
  const now = simdi();
  if (masa.durum === "sonuc") {
    await run(
      db,
      `UPDATE kumarhane_pvp_masa
       SET durum = 'hazirlik', sonuc_json = NULL, state_json = '{}', hazir1 = 0, hazir2 = 0, updated_at = ?
       WHERE id = ?`,
      [now, masa.id]
    );
    const row = await masaSatirGetir(db, masa.id);
    return { ok: true, masa: await masaOzeti(db, row, userId), mesaj: "Yeni tur için hazır olun." };
  }

  const tahsil = await potTahsil(db, masa);
  if (!tahsil.ok) return tahsil;

  const duel = barbutPvpSonuc();
  let kazananId;
  let mesaj;
  if (duel.beraberlik) {
    kazananId = null;
    await chipGuncelle(db, masa.oyuncu1_id, masa.bahis);
    await chipGuncelle(db, masa.rakip_id, masa.bahis);
    mesaj = `Berabere (${duel.oyuncu1.toplam}-${duel.oyuncu2.toplam}) — bahisler iade.`;
  } else if (duel.oyuncu1.toplam > duel.oyuncu2.toplam) {
    kazananId = masa.oyuncu1_id;
    await chipGuncelle(db, kazananId, masa.bahis * 2);
    const k = await oyuncuBilgi(db, kazananId);
    mesaj = `${k?.ad || "Oyuncu 1"} kazandı (${duel.oyuncu1.toplam} - ${duel.oyuncu2.toplam}).`;
  } else {
    kazananId = masa.rakip_id;
    await chipGuncelle(db, kazananId, masa.bahis * 2);
    const k = await oyuncuBilgi(db, kazananId);
    mesaj = `${k?.ad || "Oyuncu 2"} kazandı (${duel.oyuncu2.toplam} - ${duel.oyuncu1.toplam}).`;
  }

  const pot = masa.bahis * 2;
  const gorunum = {
    tur: "barbut_pvp",
    oyuncu1: duel.oyuncu1,
    oyuncu2: duel.oyuncu2,
    kazananId,
    pot,
  };

  await run(
    db,
    `UPDATE kumarhane_pvp_masa
     SET durum = 'sonuc', hazir1 = 0, hazir2 = 0, sonuc_json = ?, state_json = '{}', updated_at = ?
     WHERE id = ?`,
    [JSON.stringify(gorunum), now, masa.id]
  );

  const p1 = await oyuncuBilgi(db, masa.oyuncu1_id);
  const p2 = await oyuncuBilgi(db, masa.rakip_id);
  gorunum.oyuncu1.ad = p1?.ad;
  gorunum.oyuncu2.ad = p2?.ad;

  if (kazananId) {
    await logEkle(db, kazananId, "barbut_pvp", masa.bahis, pot, gorunum);
    const kaybedenId = kazananId === masa.oyuncu1_id ? masa.rakip_id : masa.oyuncu1_id;
    await pvpAllInRozetIsle(db, tahsil.allIn, kazananId, kaybedenId);
    await bildirimGonder(
      db,
      kaybedenId,
      "Barbut Kaybı",
      `Masadaki ${pot.toLocaleString("tr-TR")} çipi rakibin aldı.`
    );
    await bildirimGonder(
      db,
      kazananId,
      "Barbut Zaferi",
      `Ortadaki ${pot.toLocaleString("tr-TR")} çip senin oldu!`
    );
  }

  const row = await masaSatirGetir(db, masa.id);
  return {
    ok: true,
    masa: await masaOzeti(db, row, userId),
    gorunum,
    mesaj,
    kazananId,
    pot,
    chip: await chipGetir(db, userId),
  };
}

async function rusOyna(db, masa, userId) {
  const state = parseState(masa);
  const now = simdi();

  if (masa.durum === "sonuc") {
    await run(
      db,
      `UPDATE kumarhane_pvp_masa
       SET durum = 'hazirlik', sonuc_json = NULL, state_json = '{}', hazir1 = 0, hazir2 = 0, updated_at = ?
       WHERE id = ?`,
      [now, masa.id]
    );
    const row = await masaSatirGetir(db, masa.id);
    return { ok: true, masa: await masaOzeti(db, row, userId), mesaj: "Yeni tur için hazır olun." };
  }

  let mermi = state.mermi;
  let tetikSayisi = state.tetikSayisi || 0;
  let siradaki = state.siradaki;

  if (masa.durum !== "oyun") {
    const tahsil = await potTahsil(db, masa);
    if (!tahsil.ok) return tahsil;
    mermi = crypto.randomInt(1, 7);
    siradaki = masa.oyuncu1_id;
    tetikSayisi = 0;
    await run(
      db,
      `UPDATE kumarhane_pvp_masa SET durum = 'oyun', state_json = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify({ mermi, siradaki, tetikSayisi, allIn: tahsil.allIn || {} }), now, masa.id]
    );
  }

  if (siradaki !== userId) {
    return { ok: false, error: "Sıra rakibinde." };
  }

  const tetik = crypto.randomInt(1, 7);
  tetikSayisi += 1;
  const bang = tetik === mermi;
  const rakipId = masa.oyuncu1_id === userId ? masa.rakip_id : masa.oyuncu1_id;
  const pot = masa.bahis * 2;

  if (bang) {
    const kazananId = rakipId;
    await chipGuncelle(db, kazananId, pot);
    const kazanan = await oyuncuBilgi(db, kazananId);
    const kaybeden = await oyuncuBilgi(db, userId);
    const gorunum = {
      tur: "rus_pvp",
      mermi,
      tetik,
      hayatta: false,
      vuranId: userId,
      kazananId,
      pot,
      tetikSayisi,
    };
    await run(
      db,
      `UPDATE kumarhane_pvp_masa
       SET durum = 'sonuc', sonuc_json = ?, state_json = '{}', hazir1 = 0, hazir2 = 0, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(gorunum), now, masa.id]
    );
    await logEkle(db, kazananId, "rus_ruleti_pvp", masa.bahis, pot, gorunum);
    await pvpAllInRozetIsle(db, state.allIn || {}, kazananId, userId);
    await bildirimGonder(db, userId, "Rus Ruleti", "BANG! Ortadaki potu rakibin aldı.");
    await bildirimGonder(
      db,
      kazananId,
      "Rus Ruleti Zaferi",
      `${kaybeden?.ad || "Rakip"} elendi — ${pot.toLocaleString("tr-TR")} çip senin!`
    );
    const row = await masaSatirGetir(db, masa.id);
    return {
      ok: true,
      masa: await masaOzeti(db, row, userId),
      gorunum,
      mesaj: `BANG! ${kazanan?.ad || "Rakip"} ortadaki ${pot.toLocaleString("tr-TR")} çipi aldı.`,
      kazananId,
      pot,
      chip: await chipGetir(db, userId),
    };
  }

  const yeniState = {
    mermi,
    siradaki: rakipId,
    tetikSayisi,
    sonTetik: tetik,
    sonVuran: userId,
    allIn: state.allIn || {},
  };
  await run(
    db,
    `UPDATE kumarhane_pvp_masa SET state_json = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(yeniState), now, masa.id]
  );

  const row = await masaSatirGetir(db, masa.id);
  return {
    ok: true,
    masa: await masaOzeti(db, row, userId),
    gorunum: {
      tur: "rus_pvp",
      mermi: null,
      tetik,
      hayatta: true,
      vuranId: userId,
      tetikSayisi,
      siradaki: rakipId,
    },
    mesaj: `Tetik ${tetik}. yuvada — boş. Sıra rakibinde.`,
    chip: await chipGetir(db, userId),
  };
}

async function masaDurumuGetir(db, userId, oyunId) {
  await ensureMasaTables(db);
  const masa = await aktifMasaGetir(db, userId);
  if (!masa) return null;
  if (oyunId && masa.oyun_id !== oyunId) return null;
  return masaOzeti(db, masa, userId);
}

module.exports = {
  PVP_MIN_BAHIS,
  PVP_OYUNLAR,
  ensureMasaTables,
  masayaOtur,
  masadanKalk,
  bahisOner,
  bahisCevap,
  hazirToggle,
  masaOyna,
  masaDurumuGetir,
};
