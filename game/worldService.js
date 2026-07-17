const { get, all, run } = require("../db/database");
const { enforceNoAltAccount } = require("./securityService");
const { saldiriMesajiEkle } = require("./messagingService");
const { devletDusur, hapisKontrol, rastgeleAvukatDususu } = require("./devletService");
const { sehreHukmetGuncelle, kaybedenHukumdariKontrol } = require("./karaListeService");
const { ZAYIF_HAMLE_MSG } = require("./saygiDuvariService");
const { limanHaberEkle, makamHaberEkle } = require("./sehirGazeteService");
const { logStatHareket } = require("./statService");
const { temizGrupAdi } = require("./grupAdi");
const { kasaKorumaOrani } = require("./guvenliYerCatalog");
const { gucKaybiOranliUygula } = require("./gucService");
const { etkinSavasParcalari, etkinSavunmaGucu } = require("./sagKolGucService");
const { icraatHarca } = require("./icraatService");
const {
  LIMAN_IDS,
  BABA_MAKAMLAR,
  LIMAN_SAATLIK,
  LIMAN_UC_BONUS,
  limanSaatlikToplam,
} = require("./worldConstants");

const SALDIRI_PARA_ORAN = 0.1;
/** Rakip en az: saldıran etkin gücünün −%50'si */
const SALDIRI_MIN_RAKIP_ORAN = 0.5;
/** Rakip en fazla: saldıran etkin gücünün +%150'si (2.5×) */
const SALDIRI_MAX_RAKIP_ORAN = 2.5;
const SALDIRI_GUCSUZ_HEDEF_MSG =
  "Kendinden güçsüz birine saldırmak büyüklüğün şanına yakışmaz!";
const SALDIRI_GUCLU_HEDEF_MSG =
  "Rakibin senden daha güçlü! Gücün yetersiz!\n\n💪 Daha fazla güçlenmen gerekiyor! Silah al, koruma kirala veya lüks eşyalar satın alarak gücünü artır.\n\nSenden daha güçlü birine saldırırsan alemde rezil olursun!";
const SALDIRI_SAYGINLIK_ORAN = 0.01;
const SALDIRI_SAYGINLIK_MIN_KASA = 50000;

function saldiriOdulHesapla(hedefKasa, hedefPuan, korumaOrani = 0) {
  const kasa = Math.max(0, hedefKasa);
  const koruma = Math.max(0, Math.min(1, Number(korumaOrani) || 0));
  const korunanMiktar = Math.floor(kasa * koruma);
  const calinabilirKasa = Math.max(0, kasa - korunanMiktar);
  const paraKazanc = Math.floor(calinabilirKasa * SALDIRI_PARA_ORAN);
  const sayginlikAlinabilir = kasa >= SALDIRI_SAYGINLIK_MIN_KASA;
  const puanKazanc = sayginlikAlinabilir
    ? Math.floor(Math.max(0, hedefPuan) * SALDIRI_SAYGINLIK_ORAN)
    : 0;
  return { paraKazanc, puanKazanc, sayginlikAlinabilir, korunanMiktar };
}

async function ensureWorldRows(db) {
  for (const limanId of LIMAN_IDS) {
    await run(
      db,
      `INSERT OR IGNORE INTO liman_sahiplik (liman_id, owner_user_id, last_income_hour)
       VALUES (?, NULL, NULL)`,
      [limanId]
    );
  }
  for (const makam of BABA_MAKAMLAR) {
    await run(
      db,
      `INSERT OR IGNORE INTO baba_makamlari (makam, owner_user_id, baba_derki)
       VALUES (?, NULL, '')`,
      [makam]
    );
  }
}

async function getLimanDurumu(db) {
  await ensureWorldRows(db);
  const rows = await all(
    db,
    `SELECT l.liman_id, l.owner_user_id, l.last_income_hour, u.reis_adi AS sahip_adi
     FROM liman_sahiplik l
     LEFT JOIN users u ON u.id = l.owner_user_id
     ORDER BY l.liman_id`
  );
  const gucRows = await all(
    db,
    `SELECT l.liman_id, p.guc AS sahip_guc
     FROM liman_sahiplik l
     LEFT JOIN players p ON p.user_id = l.owner_user_id`
  );
  const gucMap = {};
  gucRows.forEach((g) => {
    gucMap[g.liman_id] = g.sahip_guc || 0;
  });
  return rows.map((r) => ({
    limanId: r.liman_id,
    sahipUserId: r.owner_user_id,
    sahipAdi: r.sahip_adi || null,
    sahipGuc: gucMap[r.liman_id] || 0,
    lastIncomeHour: r.last_income_hour,
  }));
}

/** İstemciye rakip gücü gönderilmez */
function sanitizeDunyaForClient(dunya) {
  const limanlar = (dunya.limanlar || []).map((l) => ({
    limanId: l.limanId,
    sahipUserId: l.sahipUserId,
    sahipAdi: l.sahipAdi,
    lastIncomeHour: l.lastIncomeHour,
  }));
  const makamlar = {};
  const raw = (dunya.baba && dunya.baba.makamlar) || {};
  Object.keys(raw).forEach((k) => {
    makamlar[k] = {
      sahipUserId: raw[k].sahipUserId,
      sahipAdi: raw[k].sahipAdi,
      babaDerki: raw[k].babaDerki,
    };
  });
  return {
    limanlar,
    baba: { makamlar, sadakat: dunya.baba?.sadakat || { taniyanlar: [], tanimayanlar: [] } },
  };
}

async function getBabaDurumu(db) {
  await ensureWorldRows(db);
  const rows = await all(
    db,
    `SELECT b.makam, b.owner_user_id, b.baba_derki, u.reis_adi AS sahip_adi, p.guc AS sahip_guc
     FROM baba_makamlari b
     LEFT JOIN users u ON u.id = b.owner_user_id
     LEFT JOIN players p ON p.user_id = b.owner_user_id`
  );
  const sadakatOylar = await all(
    db,
    `SELECT s.user_id, s.oy, u.reis_adi
     FROM sadakat_oylari s
     JOIN users u ON u.id = s.user_id
     WHERE s.makam = 'sadakat_yemini'`
  );
  const makamlar = {};
  rows.forEach((r) => {
    makamlar[r.makam] = {
      sahipUserId: r.owner_user_id,
      sahipAdi: r.sahip_adi || null,
      sahipGuc: r.sahip_guc || 0,
      babaDerki: r.baba_derki || "",
    };
  });
  return {
    makamlar,
    sadakat: {
      taniyanlar: sadakatOylar.filter((o) => o.oy === "tani").map((o) => o.reis_adi),
      tanimayanlar: sadakatOylar.filter((o) => o.oy === "red").map((o) => o.reis_adi),
    },
  };
}

async function processLimanIncome(db, userId, player) {
  const { processSaatlikGelir } = require("./saatlikGelirService");
  return (await processSaatlikGelir(db, userId, player)).player;
}

async function limanSahipSavunmaGucu(db, ownerId, opts = {}) {
  if (!ownerId) return 0;
  return etkinSavunmaGucu(db, ownerId, {
    makamYari: true,
    saldiranZeka: opts.saldiranZeka != null ? opts.saldiranZeka : null,
  });
}

async function limanCok(db, attackerId, attacker, limanId, securityMeta = {}) {
  if (!LIMAN_IDS.includes(limanId)) {
    return { ok: false, error: "Geçersiz liman." };
  }
  const hapis = await hapisKontrol(db, attackerId);
  if (!hapis.ok) return hapis;
  await ensureWorldRows(db);
  const liman = await get(
    db,
    `SELECT l.*, u.reis_adi AS sahip_adi, p.guc AS sahip_guc
     FROM liman_sahiplik l
     LEFT JOIN users u ON u.id = l.owner_user_id
     LEFT JOIN players p ON p.user_id = l.owner_user_id
     WHERE l.liman_id = ?`,
    [limanId]
  );
  if (liman.owner_user_id === attackerId) {
    return { ok: false, error: "Bu liman zaten sizin!" };
  }
  if (liman.owner_user_id) {
    const altCheck = await enforceNoAltAccount(
      db,
      attackerId,
      liman.owner_user_id,
      "liman_cok",
      securityMeta
    );
    if (!altCheck.ok) return altCheck;
  }
  const saldiranParca = await etkinSavasParcalari(db, attackerId);
  const sahipGuc = await limanSahipSavunmaGucu(db, liman.owner_user_id, {
    saldiranZeka: saldiranParca.aktif ? saldiranParca.sagKol.zeka : null,
  });
  if (liman.owner_user_id && saldiranParca.toplam <= sahipGuc) {
    return { ok: false, error: ZAYIF_HAMLE_MSG };
  }
  const icraatSonuc = await icraatHarca(db, attackerId, 1);
  if (!icraatSonuc.ok) {
    return { ok: false, error: "Liman baskını için 1 İcraat Hakkı gerekir!" };
  }
  attacker.icraat = icraatSonuc.icraat;
  const eskiSahip = liman.owner_user_id;
  await devletDusur(db, attackerId, 4);
  await run(
    db,
    `UPDATE liman_sahiplik SET owner_user_id = ?, last_income_hour = NULL WHERE liman_id = ?`,
    [attackerId, limanId]
  );
  const attackerRow = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [attackerId]);
  if (eskiSahip && eskiSahip !== attackerId) {
    try {
      await kaybedenHukumdariKontrol(db, eskiSahip);
    } catch (_) {}
    try {
      const { syncSaatlikGelirSaati } = require("./saatlikGelirService");
      await syncSaatlikGelirSaati(db, eskiSahip);
    } catch (_) {}
  }
  try {
    await sehreHukmetGuncelle(db, attackerId);
  } catch (_) {}
  try {
    await limanHaberEkle(db, limanId, attackerId, eskiSahip || null);
  } catch (_) {}
  try {
    const { basariRozetArtir } = require("./basariRozetService");
    await basariRozetArtir(db, attackerId, "enemy_crush", 100);
  } catch (_) {}
  return {
    ok: true,
    mesaj: liman.owner_user_id
      ? `${liman.sahip_adi} limandan indirildi. Liman artık ${attackerRow.reis_adi}'in!`
      : `Boş liman ele geçirildi! Sahip: ${attackerRow.reis_adi}`,
  };
}

function fmtGuc(n) {
  return Number(n).toLocaleString("tr-TR");
}

async function babaCok(db, attackerId, attacker, makam, securityMeta = {}) {
  if (!BABA_MAKAMLAR.includes(makam)) {
    return { ok: false, error: "Geçersiz makam." };
  }
  const hapis = await hapisKontrol(db, attackerId);
  if (!hapis.ok) return hapis;
  await ensureWorldRows(db);
  const row = await get(
    db,
    `SELECT b.*, u.reis_adi AS sahip_adi, p.guc AS sahip_guc
     FROM baba_makamlari b
     LEFT JOIN users u ON u.id = b.owner_user_id
     LEFT JOIN players p ON p.user_id = b.owner_user_id
     WHERE b.makam = ?`,
    [makam]
  );
  if (row.owner_user_id === attackerId) {
    return { ok: false, error: "Bu makam zaten sizin!" };
  }
  if (row.owner_user_id) {
    const altCheck = await enforceNoAltAccount(
      db,
      attackerId,
      row.owner_user_id,
      "baba_cok",
      securityMeta
    );
    if (!altCheck.ok) return altCheck;
  }
  const saldiranParca = await etkinSavasParcalari(db, attackerId);
  const sahipGuc = await limanSahipSavunmaGucu(db, row.owner_user_id, {
    saldiranZeka: saldiranParca.aktif ? saldiranParca.sagKol.zeka : null,
  });
  if (row.owner_user_id && saldiranParca.toplam <= sahipGuc) {
    return { ok: false, error: ZAYIF_HAMLE_MSG };
  }
  const icraatSonuc = await icraatHarca(db, attackerId, 1);
  if (!icraatSonuc.ok) {
    return { ok: false, error: "Makam baskını için 1 İcraat Hakkı gerekir!" };
  }
  attacker.icraat = icraatSonuc.icraat;
  const eskiSahip = row.owner_user_id;
  await devletDusur(db, attackerId, 5);
  await run(db, `UPDATE baba_makamlari SET owner_user_id = ? WHERE makam = ?`, [
    attackerId,
    makam,
  ]);
  const attackerRow = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [attackerId]);
  if (eskiSahip && eskiSahip !== attackerId) {
    try {
      await kaybedenHukumdariKontrol(db, eskiSahip);
    } catch (_) {}
  }
  try {
    await sehreHukmetGuncelle(db, attackerId);
  } catch (_) {}
  try {
    await makamHaberEkle(db, makam, attackerId, eskiSahip || null);
  } catch (_) {}
  try {
    const { basariRozetArtir } = require("./basariRozetService");
    await basariRozetArtir(db, attackerId, "enemy_crush", 100);
  } catch (_) {}
  return {
    ok: true,
    mesaj: row.owner_user_id
      ? `Makam ${attackerRow.reis_adi}'e geçti!`
      : `Boş makam ele geçirildi! Sahip: ${attackerRow.reis_adi}`,
  };
}

async function babaDerkiKaydet(db, userId, makam, metin) {
  const row = await get(db, `SELECT owner_user_id FROM baba_makamlari WHERE makam = ?`, [makam]);
  if (!row || row.owner_user_id !== userId) {
    return { ok: false, error: "Sadece makam sahibi yazabilir." };
  }
  const temiz = String(metin || "").slice(0, 280);
  await run(db, `UPDATE baba_makamlari SET baba_derki = ? WHERE makam = ?`, [temiz, makam]);
  return { ok: true, babaDerki: temiz };
}

async function sadakatOy(db, userId, oy) {
  if (!["tani", "red"].includes(oy)) {
    return { ok: false, error: "Geçersiz oy." };
  }
  await run(
    db,
    `INSERT INTO sadakat_oylari (user_id, makam, oy) VALUES (?, 'sadakat_yemini', ?)
     ON CONFLICT(user_id, makam) DO UPDATE SET oy = excluded.oy`,
    [userId, oy]
  );
  return { ok: true };
}

async function dusmanaCok(db, attackerId, attacker, hedefAd, securityMeta = {}) {
  const hapis = await hapisKontrol(db, attackerId);
  if (!hapis.ok) return hapis;
  const hedef = await get(
    db,
    `SELECT u.id, u.reis_adi, u.username, p.kasa, p.puan, p.guc,
            COALESCE(p.bonus_guc, 0) AS bonus_guc, p.kara_listede
     FROM users u
     JOIN players p ON p.user_id = u.id
     WHERE LOWER(u.reis_adi) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
    [hedefAd.trim(), hedefAd.trim()]
  );
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı. Reis adını doğru yaz." };
  if (hedef.id === attackerId) return { ok: false, error: "Kendine saldıramazsın Reis!" };

  const altCheck = await enforceNoAltAccount(db, attackerId, hedef.id, "dusmana_cok", securityMeta);
  if (!altCheck.ok) return altCheck;

  const saldiranParca = await etkinSavasParcalari(db, attackerId);
  const hedefParca = await etkinSavasParcalari(db, hedef.id, {
    saldiranZeka: saldiranParca.aktif ? saldiranParca.sagKol.zeka : null,
  });
  const saldiranToplam = saldiranParca.toplam;
  const hedefSavunma = hedefParca.toplam;
  const minHedefGuc = saldiranToplam * SALDIRI_MIN_RAKIP_ORAN;
  const maxHedefGuc = saldiranToplam * SALDIRI_MAX_RAKIP_ORAN;

  if (hedefSavunma < minHedefGuc) {
    return { ok: false, error: SALDIRI_GUCSUZ_HEDEF_MSG };
  }

  if (hedefSavunma > maxHedefGuc) {
    return { ok: false, error: SALDIRI_GUCLU_HEDEF_MSG };
  }

  const icraatSonuc = await icraatHarca(db, attackerId, 1);
  if (!icraatSonuc.ok) {
    return { ok: false, error: "Saldırı için 1 İcraat Hakkı gerekir!" };
  }
  attacker.icraat = icraatSonuc.icraat;

  try {
    const { saglikAzalt } = require("./sagKolService");
    await saglikAzalt(db, attackerId);
    await saglikAzalt(db, hedef.id);
  } catch (_) {}

  const saldiranRow = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [attackerId]);
  const saldiranAdi = saldiranRow.reis_adi;
  const oncekiPuan = attacker.puan;
  const oncekiToplamGuc = saldiranToplam;

  const devletDusus = rastgeleAvukatDususu(5, 10);
  const yeniDevletIliski = await devletDusur(db, attackerId, devletDusus);

  if (saldiranToplam > hedefSavunma) {
    const hedefBase = await get(
      db,
      `SELECT kasa_gumus, kasa_altin, kasa_gumus_bitis, kasa_altin_bitis FROM user_base WHERE user_id = ?`,
      [hedef.id]
    );
    const korumaOrani = kasaKorumaOrani(hedefBase);
    const { paraKazanc, puanKazanc, sayginlikAlinabilir } = saldiriOdulHesapla(
      hedef.kasa,
      hedef.puan,
      korumaOrani
    );

    attacker.kasa += paraKazanc;
    attacker.puan += puanKazanc;

    const saldSync = await gucKaybiOranliUygula(db, attackerId, attacker, 0.1);
    attacker.guc = saldSync.guc;
    attacker.bonus_guc = saldSync.bonus_guc;

    const hedefSync = await gucKaybiOranliUygula(db, hedef.id, hedef, 0.1);
    const hedefGuc = hedefSync.guc;

    const hedefKasa = Math.max(0, hedef.kasa - paraKazanc);
    const hedefPuan = Math.max(0, hedef.puan - puanKazanc);

    await run(db, `UPDATE players SET kasa=?, puan=?, guc=?, icraat=? WHERE user_id=?`, [
      attacker.kasa,
      attacker.puan,
      attacker.guc,
      attacker.icraat,
      attackerId,
    ]);
    await run(db, `UPDATE players SET kasa=?, puan=?, guc=? WHERE user_id=?`, [
      hedefKasa,
      hedefPuan,
      hedefGuc,
      hedef.id,
    ]);

    await saldiriMesajiEkle(
      db,
      hedef.id,
      hedef.reis_adi,
      saldiranAdi,
      paraKazanc,
      puanKazanc
    );

    if (puanKazanc > 0) {
      await logStatHareket(db, attackerId, "sayginlik", puanKazanc);
      await logStatHareket(db, hedef.id, "sayginlik", -puanKazanc);
    }

    const sayginlikMetin = puanKazanc > 0
      ? ` ve ${puanKazanc} Saygınlık kazandık`
      : sayginlikAlinabilir
        ? ""
        : " (rakibin kasası 50.000 TL altında olduğu için saygınlık alınamadı)";

    // Mesaj: savaşla aynı etkin güç (sağ kol + GY + ME); ham guc+bonus değil
    const yeniToplamGuc = (await etkinSavasParcalari(db, attackerId)).toplam;
    const detay =
      `Emrinle çatışma başladı! Biz daha güçlü olduğumuz için onları indirdik!\n` +
      `Çatışma sonucunda düşmandan ${paraKazanc.toLocaleString("tr-TR")} TL hasılat${sayginlikMetin}.\n` +
      `Avukat ilişkin ${devletDusus} puan düştü (${yeniDevletIliski}).\n` +
      `Saldırı sonunda ${oncekiPuan.toLocaleString("tr-TR")} olan Saygınlığın ${attacker.puan.toLocaleString("tr-TR")} oldu.\n` +
      `Saldırı sonunda ${oncekiToplamGuc.toLocaleString("tr-TR")} olan Toplam Gücün ${yeniToplamGuc.toLocaleString("tr-TR")} oldu.`;

    return {
      ok: true,
      kazandi: true,
      hedefUserId: hedef.id,
      mesaj: detay,
      devletDusus,
      yeniDevletIliski,
      effect: {
        paraKazanc,
        puanKazanc,
        oncekiPuan,
        yeniPuan: attacker.puan,
        oncekiGuc: oncekiToplamGuc,
        yeniGuc: yeniToplamGuc,
        hedefAdi: hedef.reis_adi,
      },
    };
  }

  const saldSync = await gucKaybiOranliUygula(db, attackerId, attacker, 0.1);
  attacker.guc = saldSync.guc;
  attacker.bonus_guc = saldSync.bonus_guc;
  const hedefSync = await gucKaybiOranliUygula(db, hedef.id, hedef, 0.1);
  const hedefGuc = hedefSync.guc;

  await run(db, `UPDATE players SET guc=?, icraat=? WHERE user_id=?`, [
    attacker.guc,
    attacker.icraat,
    attackerId,
  ]);
  await run(db, `UPDATE players SET guc=? WHERE user_id=?`, [hedefGuc, hedef.id]);

  const yeniToplamGuc = (await etkinSavasParcalari(db, attackerId)).toplam;
  const detayKayip =
    `Emrinle çatışma başladı! ${hedef.reis_adi} seni ezip geçti!\n` +
    `Avukat ilişkin ${devletDusus} puan düştü (${yeniDevletIliski}).\n` +
    `Saldırı sonunda ${oncekiPuan.toLocaleString("tr-TR")} olan Saygınlığın ${attacker.puan.toLocaleString("tr-TR")} oldu.\n` +
    `Saldırı sonunda ${oncekiToplamGuc.toLocaleString("tr-TR")} olan Toplam Gücün ${yeniToplamGuc.toLocaleString("tr-TR")} oldu.`;

  return {
    ok: true,
    kazandi: false,
    mesaj: detayKayip,
    devletDusus,
    yeniDevletIliski,
    effect: {
      oncekiPuan,
      yeniPuan: attacker.puan,
      oncekiGuc: oncekiToplamGuc,
      yeniGuc: yeniToplamGuc,
      hedefAdi: hedef.reis_adi,
    },
  };
}

async function rakipListele(db, userId, limit = 5) {
  const saldiranParca = await etkinSavasParcalari(db, userId);
  const guc = saldiranParca.toplam;
  if (guc <= 0) return [];

  // Saldırı aralığı: −%50 … +%150 (etkin gücün 0.5× – 2.5×) — dusmanaCok ile birebir
  const minGuc = Math.max(1, Math.floor(guc * SALDIRI_MIN_RAKIP_ORAN));
  const maxGuc = Math.ceil(guc * SALDIRI_MAX_RAKIP_ORAN);
  // Ham guc+bonus, sağ kol / zekâ yüzünden etkin güçten sapabilir → geniş havuz, sonra etkin filtre
  const hamMin = Math.max(1, Math.floor(minGuc * 0.35));
  const hamMax = Math.ceil(maxGuc * 2.5);
  const adayLimit = Math.max(limit * 12, 24);
  const rows = await all(
    db,
    `SELECT u.id AS user_id, u.reis_adi, u.lakap, u.grup, p.puan
     FROM players p
     JOIN users u ON u.id = p.user_id
     WHERE u.id != ?
       AND (p.guc + COALESCE(p.bonus_guc, 0)) >= ? AND (p.guc + COALESCE(p.bonus_guc, 0)) <= ?
     ORDER BY RANDOM()
     LIMIT ?`,
    [userId, hamMin, hamMax, adayLimit]
  );

  const saldiranZeka = saldiranParca.aktif ? saldiranParca.sagKol.zeka : null;
  const out = [];
  for (const r of rows) {
    const hedefParca = await etkinSavasParcalari(db, r.user_id, { saldiranZeka });
    if (hedefParca.toplam < minGuc || hedefParca.toplam > maxGuc) continue;
    out.push({
      userId: r.user_id,
      reisAdi: r.reis_adi,
      lakap: r.lakap || "Mafya",
      grup: temizGrupAdi(r.grup),
      puan: r.puan || 0,
    });
    if (out.length >= limit) break;
  }
  return out;
}

module.exports = {
  ensureWorldRows,
  LIMAN_IDS,
  BABA_MAKAMLAR,
  LIMAN_SAATLIK,
  LIMAN_UC_BONUS,
  limanSaatlikToplam,
  getLimanDurumu,
  getBabaDurumu,
  sanitizeDunyaForClient,
  processLimanIncome,
  limanCok,
  babaCok,
  babaDerkiKaydet,
  sadakatOy,
  dusmanaCok,
  rakipListele,
  saldiriOdulHesapla,
};
