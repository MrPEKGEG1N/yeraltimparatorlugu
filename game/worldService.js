const { get, all, run } = require("../db/database");
const { saldiriMesajiEkle } = require("./messagingService");
const { devletDusur, hapisKontrol } = require("./devletService");
const { sehreHukmetGuncelle, kaybedenHukumdariKontrol } = require("./karaListeService");
const { ZAYIF_HAMLE_MSG } = require("./saygiDuvariService");
const { limanHaberEkle, makamHaberEkle } = require("./sehirGazeteService");
const { logStatHareket } = require("./statService");
const {
  LIMAN_IDS,
  BABA_MAKAMLAR,
  LIMAN_SAATLIK,
  LIMAN_UC_BONUS,
} = require("./worldConstants");

function turkeyHourStamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
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
  await ensureWorldRows(db);
  const hourKey = turkeyHourStamp();
  const owned = await all(
    db,
    `SELECT liman_id, last_income_hour FROM liman_sahiplik WHERE owner_user_id = ?`,
    [userId]
  );
  if (!owned.length) return player;

  let toplam = 0;
  for (const row of owned) {
    if (row.last_income_hour === hourKey) continue;
    toplam += LIMAN_SAATLIK;
    await run(
      db,
      `UPDATE liman_sahiplik SET last_income_hour = ? WHERE liman_id = ? AND owner_user_id = ?`,
      [hourKey, row.liman_id, userId]
    );
  }
  if (owned.length === 3) {
    const bonusRow = await get(db, `SELECT last_uc_bonus_hour FROM players WHERE user_id = ?`, [
      userId,
    ]);
    if (bonusRow && bonusRow.last_uc_bonus_hour !== hourKey) {
      toplam += LIMAN_UC_BONUS;
      await run(db, `UPDATE players SET last_uc_bonus_hour = ? WHERE user_id = ?`, [
        hourKey,
        userId,
      ]);
    }
  }
  if (toplam > 0) {
    player.kasa += toplam;
    await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  }
  return player;
}

async function limanCok(db, attackerId, attacker, limanId) {
  if (!LIMAN_IDS.includes(limanId)) {
    return { ok: false, error: "Geçersiz liman." };
  }
  const hapis = await hapisKontrol(db, attackerId);
  if (!hapis.ok) return hapis;
  if (attacker.icraat < 1) {
    return { ok: false, error: "Liman baskını için 1 İcraat Hakkı gerekir!" };
  }
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
  const sahipGuc = liman.sahip_guc || 0;
  if (liman.owner_user_id && attacker.guc <= sahipGuc) {
    return { ok: false, error: ZAYIF_HAMLE_MSG };
  }
  const eskiSahip = liman.owner_user_id;
  attacker.icraat -= 1;
  await devletDusur(db, attackerId, 4);
  await run(
    db,
    `UPDATE liman_sahiplik SET owner_user_id = ?, last_income_hour = NULL WHERE liman_id = ?`,
    [attackerId, limanId]
  );
  await run(db, `UPDATE players SET icraat = ? WHERE user_id = ?`, [attacker.icraat, attackerId]);
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
    await limanHaberEkle(db, limanId, attackerId, eskiSahip || null);
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

async function babaCok(db, attackerId, attacker, makam) {
  if (!BABA_MAKAMLAR.includes(makam)) {
    return { ok: false, error: "Geçersiz makam." };
  }
  const hapis = await hapisKontrol(db, attackerId);
  if (!hapis.ok) return hapis;
  if (attacker.icraat < 1) {
    return { ok: false, error: "Makam baskını için 1 İcraat Hakkı gerekir!" };
  }
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
  const sahipGuc = row.sahip_guc || 0;
  if (row.owner_user_id && attacker.guc <= sahipGuc) {
    return { ok: false, error: ZAYIF_HAMLE_MSG };
  }
  const eskiSahip = row.owner_user_id;
  attacker.icraat -= 1;
  await devletDusur(db, attackerId, 5);
  await run(db, `UPDATE baba_makamlari SET owner_user_id = ? WHERE makam = ?`, [
    attackerId,
    makam,
  ]);
  await run(db, `UPDATE players SET icraat = ? WHERE user_id = ?`, [attacker.icraat, attackerId]);
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

async function dusmanaCok(db, attackerId, attacker, hedefAd) {
  const hapis = await hapisKontrol(db, attackerId);
  if (!hapis.ok) return hapis;
  if (attacker.icraat < 1) {
    return { ok: false, error: "Saldırı için 1 İcraat Hakkı gerekir!" };
  }
  const hedef = await get(
    db,
    `SELECT u.id, u.reis_adi, u.username, p.kasa, p.puan, p.guc
     FROM users u
     JOIN players p ON p.user_id = u.id
     WHERE LOWER(u.reis_adi) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
    [hedefAd.trim(), hedefAd.trim()]
  );
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı. Reis adını doğru yaz." };
  if (hedef.id === attackerId) return { ok: false, error: "Kendine saldıramazsın Reis!" };
  if (attacker.guc <= hedef.guc) {
    return { ok: false, error: ZAYIF_HAMLE_MSG };
  }

  const saldiranRow = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [attackerId]);
  const saldiranAdi = saldiranRow.reis_adi;
  const oncekiPuan = attacker.puan;
  const oncekiGuc = attacker.guc;

  attacker.icraat -= 1;
  await devletDusur(db, attackerId, 3);

  if (attacker.guc > hedef.guc) {
    const paraKazanc = Math.floor(hedef.kasa * 0.1);
    const puanKazanc = Math.floor(hedef.puan * 0.1);
    const gucDususSald = Math.floor(attacker.guc * 0.1);
    const gucDususHedef = Math.floor(hedef.guc * 0.1);

    attacker.kasa += paraKazanc;
    attacker.puan += puanKazanc;
    attacker.guc -= gucDususSald;

    const hedefKasa = Math.max(0, hedef.kasa - paraKazanc);
    const hedefPuan = Math.max(0, hedef.puan - puanKazanc);
    const hedefGuc = Math.max(0, hedef.guc - gucDususHedef);

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

    await logStatHareket(db, attackerId, "sayginlik", puanKazanc);
    await logStatHareket(db, hedef.id, "sayginlik", -puanKazanc);

    const detay =
      `Emrinle çatışma başladı! Biz daha güçlü olduğumuz için onları indirdik!\n` +
      `Çatışma sonucunda düşmandan ${paraKazanc.toLocaleString("tr-TR")} TL hasılat ve ${puanKazanc} Saygınlık kazandık.\n` +
      `Saldırı sonunda ${oncekiPuan.toLocaleString("tr-TR")} olan Saygınlığın ${attacker.puan.toLocaleString("tr-TR")} oldu.\n` +
      `Saldırı sonunda ${oncekiGuc.toLocaleString("tr-TR")} olan Gücün ${attacker.guc.toLocaleString("tr-TR")} oldu.`;

    return {
      ok: true,
      kazandi: true,
      mesaj: detay,
      effect: {
        paraKazanc,
        puanKazanc,
        oncekiPuan,
        yeniPuan: attacker.puan,
        oncekiGuc,
        yeniGuc: attacker.guc,
        hedefAdi: hedef.reis_adi,
      },
    };
  }

  const gucDususSald = Math.floor(attacker.guc * 0.1);
  const gucDususHedef = Math.floor(hedef.guc * 0.1);
  attacker.guc = Math.max(0, attacker.guc - gucDususSald);
  const hedefGuc = Math.max(0, hedef.guc - gucDususHedef);

  await run(db, `UPDATE players SET guc=?, icraat=? WHERE user_id=?`, [
    attacker.guc,
    attacker.icraat,
    attackerId,
  ]);
  await run(db, `UPDATE players SET guc=? WHERE user_id=?`, [hedefGuc, hedef.id]);

  const detayKayip =
    `Emrinle çatışma başladı! ${hedef.reis_adi} seni ezip geçti!\n` +
    `Saldırı sonunda ${oncekiPuan.toLocaleString("tr-TR")} olan Saygınlığın ${attacker.puan.toLocaleString("tr-TR")} oldu.\n` +
    `Saldırı sonunda ${oncekiGuc.toLocaleString("tr-TR")} olan Gücün ${attacker.guc.toLocaleString("tr-TR")} oldu.`;

  return {
    ok: true,
    kazandi: false,
    mesaj: detayKayip,
    effect: {
      oncekiPuan,
      yeniPuan: attacker.puan,
      oncekiGuc,
      yeniGuc: attacker.guc,
      hedefAdi: hedef.reis_adi,
    },
  };
}

module.exports = {
  ensureWorldRows,
  LIMAN_IDS,
  BABA_MAKAMLAR,
  LIMAN_SAATLIK,
  LIMAN_UC_BONUS,
  getLimanDurumu,
  getBabaDurumu,
  sanitizeDunyaForClient,
  processLimanIncome,
  limanCok,
  babaCok,
  babaDerkiKaydet,
  sadakatOy,
  dusmanaCok,
};
