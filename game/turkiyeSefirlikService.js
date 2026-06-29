const { run, get, all } = require("../db/database");
const { icraatHarca } = require("./icraatService");
const { toplamGuc, savunmaGucu, gucKaybiOranliUygula } = require("./gucService");
const { kullaniciGrubu } = require("./mafiaService");
const {
  SEHIRLER,
  TIER_ETIKET,
  SAHIP_ESIK,
  LIDER_ESIK,
  KONTROL_COOLDOWN_SEC,
  SALDIRI_KONTROL_KAZANC,
  sehirBul,
} = require("./turkiyeSefirlikCatalog");

const ZAYIF_HAMLE_MSG =
  "Zayıf hamle! Rakibin gücünün en az %10'u kadar güce sahip olmalısın.";

async function ensureSefirlikTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sehir_hakimiyet (
      sehir_id TEXT PRIMARY KEY,
      bos_kontrol INTEGER NOT NULL DEFAULT 100,
      sahip_user_id INTEGER,
      sahip_grup_id INTEGER,
      sahip_oldu_at INTEGER,
      son_olay TEXT NOT NULL DEFAULT '',
      son_olay_at INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (sahip_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (sahip_grup_id) REFERENCES mafya_gruplari(id) ON DELETE SET NULL
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sehir_kontrol (
      sehir_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      kontrol INTEGER NOT NULL DEFAULT 0,
      son_aksiyon_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (sehir_id, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(db, `CREATE INDEX IF NOT EXISTS idx_sehir_kontrol_user ON sehir_kontrol(user_id)`);

  for (const s of SEHIRLER) {
    await run(db, `INSERT OR IGNORE INTO sehir_hakimiyet (sehir_id, bos_kontrol) VALUES (?, 100)`, [
      s.id,
    ]);
  }
}

async function getKontrolRow(db, sehirId, userId) {
  return get(
    db,
    `SELECT kontrol, son_aksiyon_at FROM sehir_kontrol WHERE sehir_id = ? AND user_id = ?`,
    [sehirId, userId]
  );
}

async function addKontrol(db, sehirId, userId, miktar) {
  const hak = await get(db, `SELECT bos_kontrol, sahip_user_id FROM sehir_hakimiyet WHERE sehir_id = ?`, [
    sehirId,
  ]);
  if (!hak) return { ok: false, error: "Şehir bulunamadı." };

  let kalan = Math.max(0, parseInt(miktar, 10) || 0);
  if (kalan <= 0) return { ok: true, eklenen: 0 };

  const bos = hak.bos_kontrol || 0;
  const bostan = Math.min(kalan, bos);
  if (bostan > 0) {
    await run(db, `UPDATE sehir_hakimiyet SET bos_kontrol = bos_kontrol - ? WHERE sehir_id = ?`, [
      bostan,
      sehirId,
    ]);
    kalan -= bostan;
  }

  const mevcut = await getKontrolRow(db, sehirId, userId);
  const onceki = mevcut ? mevcut.kontrol : 0;
  let yeni = onceki + bostan;

  if (kalan > 0 && hak.sahip_user_id && hak.sahip_user_id !== userId) {
    const sahipRow = await getKontrolRow(db, sehirId, hak.sahip_user_id);
    const sahipK = sahipRow ? sahipRow.kontrol : 0;
    const cal = Math.min(kalan, Math.max(0, sahipK - 20));
    if (cal > 0) {
      await run(
        db,
        `UPDATE sehir_kontrol SET kontrol = MAX(0, kontrol - ?) WHERE sehir_id = ? AND user_id = ?`,
        [cal, sehirId, hak.sahip_user_id]
      );
      yeni += cal;
      kalan -= cal;
    }
  }

  const eklenenToplam = yeni - onceki;
  const simdi = Math.floor(Date.now() / 1000);
  if (mevcut) {
    await run(
      db,
      `UPDATE sehir_kontrol SET kontrol = ?, son_aksiyon_at = ? WHERE sehir_id = ? AND user_id = ?`,
      [yeni, simdi, sehirId, userId]
    );
  } else {
    await run(
      db,
      `INSERT INTO sehir_kontrol (sehir_id, user_id, kontrol, son_aksiyon_at) VALUES (?, ?, ?, ?)`,
      [sehirId, userId, yeni, simdi]
    );
  }

  await syncSahiplik(db, sehirId, userId);
  return { ok: true, eklenen: eklenenToplam, yeniKontrol: yeni };
}

async function transferKontrol(db, sehirId, fromUserId, toUserId, miktar) {
  const fromRow = await getKontrolRow(db, sehirId, fromUserId);
  const fromK = fromRow ? fromRow.kontrol : 0;
  const aktar = Math.min(fromK, Math.max(0, parseInt(miktar, 10) || 0));
  if (aktar <= 0) return 0;

  await run(
    db,
    `UPDATE sehir_kontrol SET kontrol = MAX(0, kontrol - ?) WHERE sehir_id = ? AND user_id = ?`,
    [aktar, sehirId, fromUserId]
  );

  const toRow = await getKontrolRow(db, sehirId, toUserId);
  const toK = toRow ? toRow.kontrol : 0;
  const simdi = Math.floor(Date.now() / 1000);
  if (toRow) {
    await run(
      db,
      `UPDATE sehir_kontrol SET kontrol = ?, son_aksiyon_at = ? WHERE sehir_id = ? AND user_id = ?`,
      [toK + aktar, simdi, sehirId, toUserId]
    );
  } else {
    await run(
      db,
      `INSERT INTO sehir_kontrol (sehir_id, user_id, kontrol, son_aksiyon_at) VALUES (?, ?, ?, ?)`,
      [sehirId, toUserId, aktar, simdi]
    );
  }

  await syncSahiplik(db, sehirId, toUserId);
  if (fromUserId) await syncSahiplik(db, sehirId, fromUserId);
  return aktar;
}

async function syncSahiplik(db, sehirId, userId) {
  const row = await getKontrolRow(db, sehirId, userId);
  const k = row ? row.kontrol : 0;
  const hak = await get(db, `SELECT sahip_user_id FROM sehir_hakimiyet WHERE sehir_id = ?`, [sehirId]);
  if (!hak) return;

  if (k >= SAHIP_ESIK) {
    const grup = await kullaniciGrubu(db, userId);
    await run(
      db,
      `UPDATE sehir_hakimiyet SET
        sahip_user_id = ?,
        sahip_grup_id = ?,
        sahip_oldu_at = COALESCE(sahip_oldu_at, strftime('%s','now')),
        son_olay = ?,
        son_olay_at = strftime('%s','now')
       WHERE sehir_id = ?`,
      [userId, grup ? grup.id : null, `${await reisAdi(db, userId)} şehir sefirliğini ele geçirdi.`, sehirId]
    );
    return;
  }

  if (hak.sahip_user_id === userId && k < LIDER_ESIK) {
    await run(
      db,
      `UPDATE sehir_hakimiyet SET
        sahip_user_id = NULL,
        sahip_grup_id = NULL,
        sahip_oldu_at = NULL,
        son_olay = ?,
        son_olay_at = strftime('%s','now')
       WHERE sehir_id = ?`,
      [`${await reisAdi(db, userId)} sefirliği kaybetti.`, sehirId]
    );
  }
}

async function reisAdi(db, userId) {
  const u = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [userId]);
  return u ? u.reis_adi : "Bilinmeyen";
}

async function tierKontrol(db, userId, sehir) {
  if (sehir.tier < 3) return { ok: true };
  const grup = await kullaniciGrubu(db, userId);
  if (!grup) {
    return {
      ok: false,
      error: `${sehir.ad} stratejik şehirdir. Önce bir mafya grubuna katılmalısın.`,
    };
  }
  return { ok: true };
}

async function liderBul(db, sehirId) {
  const hak = await get(
    db,
    `SELECT h.sahip_user_id, u.reis_adi AS sahip_reis
     FROM sehir_hakimiyet h
     LEFT JOIN users u ON u.id = h.sahip_user_id
     WHERE h.sehir_id = ?`,
    [sehirId]
  );
  if (hak && hak.sahip_user_id) {
    const row = await get(
      db,
      `SELECT p.guc, COALESCE(p.bonus_guc, 0) AS bonus_guc, p.kara_listede
       FROM players p WHERE p.user_id = ?`,
      [hak.sahip_user_id]
    );
    const kRow = await getKontrolRow(db, sehirId, hak.sahip_user_id);
    return {
      userId: hak.sahip_user_id,
      reisAdi: hak.sahip_reis,
      kontrol: kRow ? kRow.kontrol : SAHIP_ESIK,
      player: row,
      sahip: true,
    };
  }

  const top = await get(
    db,
    `SELECT sk.user_id, sk.kontrol, u.reis_adi,
            p.guc, COALESCE(p.bonus_guc, 0) AS bonus_guc, p.kara_listede
     FROM sehir_kontrol sk
     JOIN users u ON u.id = sk.user_id
     JOIN players p ON p.user_id = sk.user_id
     WHERE sk.sehir_id = ?
     ORDER BY sk.kontrol DESC
     LIMIT 1`,
    [sehirId]
  );
  if (!top || top.kontrol < 1) return null;
  return {
    userId: top.user_id,
    reisAdi: top.reis_adi,
    kontrol: top.kontrol,
    player: top,
    sahip: false,
  };
}

async function sehirOzet(db, sehirId, userId) {
  const sehir = sehirBul(sehirId);
  if (!sehir) return null;

  const hak = await get(db, `SELECT * FROM sehir_hakimiyet WHERE sehir_id = ?`, [sehirId]);
  const benim = await getKontrolRow(db, sehirId, userId);
  const lider = await liderBul(db, sehirId);

  let sahipReis = null;
  let sahipGrup = null;
  if (hak && hak.sahip_user_id) {
    const u = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [hak.sahip_user_id]);
    sahipReis = u ? u.reis_adi : null;
    if (hak.sahip_grup_id) {
      const g = await get(db, `SELECT isim FROM mafya_gruplari WHERE id = ?`, [hak.sahip_grup_id]);
      sahipGrup = g ? g.isim : null;
    }
  }

  const rakipler = await all(
    db,
    `SELECT sk.kontrol, u.reis_adi, sk.user_id
     FROM sehir_kontrol sk
     JOIN users u ON u.id = sk.user_id
     WHERE sk.sehir_id = ? AND sk.kontrol > 0
     ORDER BY sk.kontrol DESC
     LIMIT 5`,
    [sehirId]
  );

  const simdi = Math.floor(Date.now() / 1000);
  const cooldown = benim && benim.son_aksiyon_at
    ? Math.max(0, KONTROL_COOLDOWN_SEC - (simdi - benim.son_aksiyon_at))
    : 0;

  return {
    id: sehir.id,
    ad: sehir.ad,
    tier: sehir.tier,
    tierLabel: TIER_ETIKET[sehir.tier] || "",
    x: sehir.x,
    y: sehir.y,
    bosKontrol: hak ? hak.bos_kontrol : 100,
    benimKontrol: benim ? benim.kontrol : 0,
    sahipUserId: hak ? hak.sahip_user_id : null,
    sahipReis,
    sahipGrup,
    liderReis: lider ? lider.reisAdi : null,
    liderKontrol: lider ? lider.kontrol : 0,
    sonOlay: hak ? hak.son_olay : "",
    kontrolMaliyet: sehir.kontrolMaliyet,
    ihaleMin: sehir.ihaleMin,
    kontrolKazanc: sehir.kontrolKazanc,
    cooldownSec: cooldown,
    rakipler: rakipler.map((r) => ({
      userId: r.user_id,
      reisAdi: r.reis_adi,
      kontrol: r.kontrol,
      benim: r.user_id === userId,
    })),
    benSahibim: hak && hak.sahip_user_id === userId,
  };
}

async function panelGetir(db, userId) {
  await ensureSefirlikTables(db);
  const sehirler = [];
  for (const s of SEHIRLER) {
    sehirler.push(await sehirOzet(db, s.id, userId));
  }
  const sahipSayisi = sehirler.filter((s) => s.benSahibim).length;
  const toplamKontrol = sehirler.reduce((t, s) => t + (s.benimKontrol || 0), 0);
  return {
    ok: true,
    sehirler,
    ozet: { sahipSayisi, toplamKontrol, sehirSayisi: SEHIRLER.length },
  };
}

async function kontrolTopla(db, userId, player, sehirId) {
  const sehir = sehirBul(sehirId);
  if (!sehir) return { ok: false, error: "Geçersiz şehir." };

  const tierOk = await tierKontrol(db, userId, sehir);
  if (!tierOk.ok) return tierOk;

  const benim = await getKontrolRow(db, sehirId, userId);
  const simdi = Math.floor(Date.now() / 1000);
  if (benim && benim.son_aksiyon_at && simdi - benim.son_aksiyon_at < KONTROL_COOLDOWN_SEC) {
    const kalan = KONTROL_COOLDOWN_SEC - (simdi - benim.son_aksiyon_at);
    return { ok: false, error: `Bu şehirde tekrar kontrol toplamak için ${Math.ceil(kalan / 60)} dk bekle.` };
  }

  if (player.kasa < sehir.kontrolMaliyet) {
    return {
      ok: false,
      error: `Kasanda ${sehir.kontrolMaliyet.toLocaleString("tr-TR")} TL gerekir.`,
    };
  }

  const icraatSonuc = await icraatHarca(db, userId, 1);
  if (!icraatSonuc.ok) return { ok: false, error: "Kontrol toplamak için 1 İcraat Hakkı gerekir!" };
  player.icraat = icraatSonuc.icraat;

  player.kasa -= sehir.kontrolMaliyet;
  await run(db, `UPDATE players SET kasa = ?, icraat = ? WHERE user_id = ?`, [
    player.kasa,
    player.icraat,
    userId,
  ]);

  const sonuc = await addKontrol(db, sehirId, userId, sehir.kontrolKazanc);
  await run(
    db,
    `UPDATE sehir_hakimiyet SET son_olay = ?, son_olay_at = strftime('%s','now') WHERE sehir_id = ?`,
    [`${await reisAdi(db, userId)} ${sehir.ad}'da kontrol topladı (+${sehir.kontrolKazanc}).`, sehirId]
  );

  const detay = await sehirOzet(db, sehirId, userId);
  return {
    ok: true,
    mesaj: `${sehir.ad}: +${sonuc.eklenen || sehir.kontrolKazanc} kontrol. Toplam: %${detay.benimKontrol}`,
    sehir: detay,
  };
}

async function ihaleGir(db, userId, player, sehirId, teklif) {
  const sehir = sehirBul(sehirId);
  if (!sehir) return { ok: false, error: "Geçersiz şehir." };

  const tierOk = await tierKontrol(db, userId, sehir);
  if (!tierOk.ok) return tierOk;

  const miktar = parseInt(teklif, 10);
  if (Number.isNaN(miktar) || miktar < sehir.ihaleMin) {
    return {
      ok: false,
      error: `Minimum ihale teklifi ${sehir.ihaleMin.toLocaleString("tr-TR")} TL.`,
    };
  }

  if (player.kasa < miktar) {
    return { ok: false, error: "Kasanda yeterli nakit yok." };
  }

  player.kasa -= miktar;
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);

  const kazanc = Math.min(25, Math.floor(miktar / 50_000) * 3);
  const sonuc = await addKontrol(db, sehirId, userId, kazanc);
  await run(
    db,
    `UPDATE sehir_hakimiyet SET son_olay = ?, son_olay_at = strftime('%s','now') WHERE sehir_id = ?`,
    [
      `${await reisAdi(db, userId)} ${sehir.ad} ihalesine ${miktar.toLocaleString("tr-TR")} TL verdi.`,
      sehirId,
    ]
  );

  const detay = await sehirOzet(db, sehirId, userId);
  return {
    ok: true,
    mesaj: `${sehir.ad} ihalesi: +${sonuc.eklenen || kazanc} kontrol.`,
    sehir: detay,
  };
}

async function sehreSaldir(db, userId, player, sehirId) {
  const sehir = sehirBul(sehirId);
  if (!sehir) return { ok: false, error: "Geçersiz şehir." };

  const tierOk = await tierKontrol(db, userId, sehir);
  if (!tierOk.ok) return tierOk;

  const lider = await liderBul(db, sehirId);
  if (!lider) {
    return { ok: false, error: `${sehir.ad} boş — önce kontrol topla veya ihaleye gir.` };
  }
  if (lider.userId === userId) {
    return { ok: false, error: "Zaten bu şehirde lidersin." };
  }

  const saldiranToplam = toplamGuc(player);
  const hedefSavunma = savunmaGucu(lider.player);

  if (saldiranToplam < hedefSavunma * 0.1) {
    return { ok: false, error: ZAYIF_HAMLE_MSG };
  }
  if (saldiranToplam <= hedefSavunma) {
    return {
      ok: false,
      error: `${lider.reisAdi} senden güçlü! Önce güçlen veya daha fazla kontrol topla.`,
    };
  }

  const icraatSonuc = await icraatHarca(db, userId, 1);
  if (!icraatSonuc.ok) return { ok: false, error: "Saldırı için 1 İcraat Hakkı gerekir!" };
  player.icraat = icraatSonuc.icraat;

  const aktar = await transferKontrol(db, sehirId, lider.userId, userId, SALDIRI_KONTROL_KAZANC);
  const saldSync = await gucKaybiOranliUygula(db, userId, player, 0.05);
  player.guc = saldSync.guc;
  player.bonus_guc = saldSync.bonus_guc;

  await run(db, `UPDATE players SET guc = ?, icraat = ? WHERE user_id = ?`, [
    player.guc,
    player.icraat,
    userId,
  ]);

  const mesaj =
    aktar > 0
      ? `${sehir.ad}: ${lider.reisAdi}'den %${aktar} kontrol ele geçirdin!`
      : `${sehir.ad}: Saldırı başarılı ama rakipten kontrol alınamadı.`;

  await run(
    db,
    `UPDATE sehir_hakimiyet SET son_olay = ?, son_olay_at = strftime('%s','now') WHERE sehir_id = ?`,
    [`${await reisAdi(db, userId)} → ${lider.reisAdi} (${sehir.ad} saldırısı)`, sehirId]
  );

  const detay = await sehirOzet(db, sehirId, userId);
  return { ok: true, kazandi: true, mesaj, sehir: detay };
}

module.exports = {
  ensureSefirlikTables,
  panelGetir,
  sehirOzet,
  kontrolTopla,
  ihaleGir,
  sehreSaldir,
};
