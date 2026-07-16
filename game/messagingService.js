const { run, get, all } = require("../db/database");

const SMS_GUNLUK = 50;

async function ensureMessagingTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_davetleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER NOT NULL,
      davet_eden_user_id INTEGER NOT NULL,
      davet_edilen_user_id INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'beklemede',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (davet_eden_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (davet_edilen_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_grup_mesajlari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grup_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      parent_id INTEGER,
      icerik TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  for (const [col, def] of [
    ["grup_id", "INTEGER"],
    ["grup_mesaj_id", "INTEGER"],
    ["davet_id", "INTEGER"],
  ]) {
    try {
      await run(db, `ALTER TABLE oyuncu_mesajlari ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
}

function turkeyDayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function ensureSmsReset(db, userId, row) {
  const { getPremiumBonuses } = require("./premiumService");
  const premium = await getPremiumBonuses(db, userId);
  const gunlukEkle = premium.smsGunluk;
  const day = turkeyDayKey();
  if (!row.last_sms_day) {
    const baslangic = row.sms_hakki != null ? row.sms_hakki : gunlukEkle;
    await run(db, `UPDATE players SET last_sms_day = ?, sms_hakki = ? WHERE user_id = ?`, [
      day,
      baslangic,
      userId,
    ]);
    return premium.smsSinirsiz ? 999999 : baslangic;
  }
  if (row.last_sms_day === day) {
    return premium.smsSinirsiz ? 999999 : row.sms_hakki;
  }
  const kalanHak = row.sms_hakki || 0;
  const yeniHak = premium.smsSinirsiz ? 999999 : kalanHak + gunlukEkle;
  await run(
    db,
    `UPDATE players SET sms_hakki = ?, last_sms_day = ? WHERE user_id = ?`,
    [yeniHak, day, userId]
  );
  return yeniHak;
}

async function getSmsHakki(db, userId) {
  const row = await get(
    db,
    `SELECT sms_hakki, last_sms_day FROM players WHERE user_id = ?`,
    [userId]
  );
  if (!row) return SMS_GUNLUK;
  return ensureSmsReset(db, userId, row);
}

async function smsHarca(db, userId) {
  const { getPremiumBonuses } = require("./premiumService");
  const premium = await getPremiumBonuses(db, userId);
  if (premium.smsSinirsiz) return { ok: true, kalan: 999999 };
  const hak = await getSmsHakki(db, userId);
  if (hak < 1) return { ok: false, error: "SMS hakkın kalmadı! Yarın yenilenir." };
  await run(db, `UPDATE players SET sms_hakki = sms_hakki - 1 WHERE user_id = ?`, [userId]);
  return { ok: true, kalan: hak - 1 };
}

async function saldiriMesajiEkle(
  db,
  hedefUserId,
  kurbanAdi,
  saldiranAdi,
  paraKaybi,
  puanKaybi
) {
  await ensureMessagingTables(db);
  const paraStr = paraKaybi.toLocaleString("tr-TR");
  const icerik =
    puanKaybi > 0
      ? `Alarm çalıyor! ${saldiranAdi} mekanını talan etti. Kasanın dibini gördüler, ${paraStr} TL'ni alıp gittiler; yetmedi, ${puanKaybi} saygınlığını ayaklar altına aldılar. Sokaklarda adın geçiyor, hemen bir şeyler yapmazsan bu işin sonu kötü!`
      : `Alarm çalıyor! ${saldiranAdi} üzerine çöktü. ${paraStr} TL'ni alıp gittiler. Kasanda pek bir şey kalmadığı için saygınlığına dokunamadılar — ama sokaklar konuşuyor!`;
  const saldiran = await get(
    db,
    `SELECT id FROM users WHERE LOWER(reis_adi) = LOWER(?)`,
    [saldiranAdi]
  );
  await run(
    db,
    `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
     VALUES (?, ?, 'saldiri', ?, ?, 0, strftime('%s','now'))`,
    [hedefUserId, saldiran?.id || null, "Saldırı - " + saldiranAdi, icerik]
  );
  const { bildirimGonder } = require("./bildirimService");
  await bildirimGonder(db, hedefUserId, "saldiri", {
    baslik: "Saldırıya Uğradın",
    icerik: `${saldiranAdi} saldırdı. ${paraStr} TL kaybettin${puanKaybi > 0 ? `, ${puanKaybi} saygınlık gitti` : ""}.`,
    url: "/?ekran=mesajKutusu",
  });
}

async function ozelMesajGonder(db, fromUserId, hedefAd, metin) {
  const sms = await smsHarca(db, fromUserId);
  if (!sms.ok) return sms;

  const hedef = await get(
    db,
    `SELECT id, reis_adi FROM users WHERE LOWER(reis_adi)=LOWER(?) OR LOWER(username)=LOWER(?)`,
    [hedefAd.trim(), hedefAd.trim()]
  );
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı." };
  if (hedef.id === fromUserId) return { ok: false, error: "Kendine mesaj atamazsın." };

  const gonderen = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [fromUserId]);
  const temiz = String(metin || "").trim().slice(0, 500);
  if (!temiz) return { ok: false, error: "Mesaj boş olamaz." };

  await run(
    db,
    `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
     VALUES (?, ?, 'ozel', ?, ?, 0, strftime('%s','now'))`,
    [hedef.id, fromUserId, gonderen.reis_adi, temiz]
  );
  return { ok: true };
}

async function tumMesajlariOkundu(db, userId) {
  await run(db, `UPDATE oyuncu_mesajlari SET okundu = 1 WHERE to_user_id = ? AND okundu = 0`, [
    userId,
  ]);
}

async function mesajlariGetir(db, userId) {
  await ensureMessagingTables(db);
  const rows = await all(
    db,
    `SELECT m.id, m.tip, m.konu, m.icerik, m.okundu, m.created_at, m.grup_id, m.grup_mesaj_id, m.davet_id,
            m.from_user_id,
            fu.reis_adi AS gonderen_adi,
            fp.profil_resmi AS gonderen_profil_resmi
     FROM oyuncu_mesajlari m
     LEFT JOIN users fu ON fu.id = m.from_user_id
     LEFT JOIN players fp ON fp.user_id = m.from_user_id
     WHERE m.to_user_id = ?
     ORDER BY m.created_at DESC
     LIMIT 80`,
    [userId]
  );

  const profilCache = new Map();
  async function gonderenProfilCoz(fromId, gonderenAdi, profilResmi, tip, konu) {
    let uid = fromId || null;
    let pr = profilResmi || "";

    if (!uid && gonderenAdi && gonderenAdi !== "Sistem" && gonderenAdi !== "—") {
      const cacheKey = gonderenAdi.toLowerCase();
      if (profilCache.has(cacheKey)) {
        const hit = profilCache.get(cacheKey);
        uid = hit.userId;
        pr = pr || hit.profilResmi || "";
      } else {
        const u = await get(
          db,
          `SELECT u.id AS user_id, p.profil_resmi
           FROM users u
           LEFT JOIN players p ON p.user_id = u.id
           WHERE LOWER(u.reis_adi) = LOWER(?)`,
          [gonderenAdi]
        );
        if (u) {
          uid = u.user_id;
          pr = pr || u.profil_resmi || "";
          profilCache.set(cacheKey, { userId: uid, profilResmi: pr });
        }
      }
    }

    if (!uid && tip === "saldiri" && konu) {
      const match = String(konu).match(/^Saldırı\s*-\s*(.+)$/i);
      const saldiranAd = match ? match[1].trim() : "";
      if (saldiranAd) {
        const cacheKey = saldiranAd.toLowerCase();
        if (profilCache.has(cacheKey)) {
          const hit = profilCache.get(cacheKey);
          uid = hit.userId;
          pr = pr || hit.profilResmi || "";
        } else {
          const u = await get(
            db,
            `SELECT u.id AS user_id, p.profil_resmi
             FROM users u
             LEFT JOIN players p ON p.user_id = u.id
             WHERE LOWER(u.reis_adi) = LOWER(?)`,
            [saldiranAd]
          );
          if (u) {
            uid = u.user_id;
            pr = pr || u.profil_resmi || "";
            profilCache.set(cacheKey, { userId: uid, profilResmi: pr });
          }
        }
      }
    }

    return { userId: uid, profilResmi: pr };
  }

  const liste = [];
  for (const r of rows) {
    const gonderenAdi =
      r.gonderen_adi || (r.tip === "saldiri" ? "Sistem" : "—");
    const profil = await gonderenProfilCoz(
      r.from_user_id,
      gonderenAdi,
      r.gonderen_profil_resmi,
      r.tip,
      r.konu
    );
    let gonderenEtiketi = gonderenAdi;
    if (r.tip === "mafya_grup") {
      gonderenEtiketi = "Mafya Grubu - " + (r.gonderen_adi || "Üye");
    } else if (r.tip === "saldiri") {
      gonderenEtiketi = "Sistem";
    } else if (r.tip === "mafya_davet") {
      gonderenEtiketi = "Mafya Daveti";
    }
    let davetAktif = false;
    if (r.tip === "mafya_davet" && r.davet_id) {
      const davet = await get(
        db,
        `SELECT durum FROM mafya_davetleri WHERE id = ? AND davet_edilen_user_id = ?`,
        [r.davet_id, userId]
      );
      davetAktif = !!(davet && davet.durum === "beklemede");
    }
    liste.push({
      id: r.id,
      tip: r.tip,
      konu: r.konu,
      icerik: r.icerik,
      okundu: !!r.okundu,
      grupId: r.grup_id || null,
      grupMesajId: r.grup_mesaj_id || null,
      davetId: r.davet_id || null,
      davetAktif,
      gonderenAdi,
      gonderenUserId: profil.userId,
      profilResmi: profil.profilResmi,
      gonderenEtiketi,
      tarih: new Date(r.created_at * 1000).toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
      }),
    });
  }
  return liste;
}

async function mesajOkundu(db, userId, mesajId) {
  await run(
    db,
    `UPDATE oyuncu_mesajlari SET okundu = 1 WHERE id = ? AND to_user_id = ?`,
    [mesajId, userId]
  );
}

async function mesajSil(db, userId, mesajId) {
  await run(db, `DELETE FROM oyuncu_mesajlari WHERE id = ? AND to_user_id = ?`, [
    mesajId,
    userId,
  ]);
  return { ok: true };
}

async function mesajCevapla(db, userId, mesajId, metin) {
  const orig = await get(
    db,
    `SELECT from_user_id, konu, tip, grup_id, grup_mesaj_id FROM oyuncu_mesajlari WHERE id = ? AND to_user_id = ?`,
    [mesajId, userId]
  );
  if (!orig) {
    return { ok: false, error: "Bu mesaja cevap verilemez." };
  }
  if (orig.tip === "mafya_grup" && orig.grup_id) {
    return mafyaGrupMesajGonder(db, userId, metin, orig.grup_id, orig.grup_mesaj_id);
  }
  if (!orig.from_user_id) {
    return { ok: false, error: "Bu mesaja cevap verilemez." };
  }
  const hedef = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [orig.from_user_id]);
  return ozelMesajGonder(db, userId, hedef.reis_adi, metin);
}

async function okunmamisSayisi(db, userId) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM oyuncu_mesajlari WHERE to_user_id = ? AND okundu = 0`,
    [userId]
  );
  return row ? row.n : 0;
}

async function mafyaSohbetListe(db, limit = 60) {
  const rows = await all(
    db,
    `SELECT s.id, s.user_id, s.mesaj, s.created_at, u.reis_adi, p.profil_resmi, p.premium_paket
     FROM mafya_sohbet s
     JOIN users u ON u.id = s.user_id
     JOIN players p ON p.user_id = s.user_id
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [limit]
  );
  // En yeni mesaj en üstte (ORDER BY created_at DESC)
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    reisAdi: r.reis_adi,
    profilResmi: r.profil_resmi || "",
    premiumPaket: r.premium_paket || "",
    mesaj: r.mesaj,
    tarih: new Date(r.created_at * 1000).toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
    }),
  }));
}

async function mafyaGrupMesajGonder(db, userId, metin, grupIdOverride, parentMesajId) {
  await ensureMessagingTables(db);
  const temiz = String(metin || "").trim().slice(0, 500);
  if (!temiz) return { ok: false, error: "Mesaj boş olamaz." };

  let grupId = grupIdOverride;
  if (!grupId) {
    const uyelik = await get(
      db,
      `SELECT grup_id FROM mafya_uyeleri WHERE user_id = ?`,
      [userId]
    );
    if (!uyelik) return { ok: false, error: "Mafya grubuna üye değilsin." };
    grupId = uyelik.grup_id;
  } else {
    const uye = await get(
      db,
      `SELECT 1 FROM mafya_uyeleri WHERE grup_id = ? AND user_id = ?`,
      [grupId, userId]
    );
    if (!uye) return { ok: false, error: "Bu gruba mesaj gönderemezsin." };
  }

  const gonderen = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [userId]);
  const grup = await get(db, `SELECT isim, lider_user_id FROM mafya_gruplari WHERE id = ?`, [grupId]);
  if (!grup) return { ok: false, error: "Grup bulunamadı." };

  const ins = await run(
    db,
    `INSERT INTO mafya_grup_mesajlari (grup_id, from_user_id, parent_id, icerik, created_at)
     VALUES (?, ?, ?, ?, strftime('%s','now'))`,
    [grupId, userId, parentMesajId || null, temiz]
  );
  const grupMesajId = ins.lastID;
  const konu = "Mafya Grubu - " + (gonderen.reis_adi || "Üye");
  const icerik = temiz;

  const senderId = Number(userId);
  const uyeler = await all(
    db,
    `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`,
    [grupId]
  );
  const aliciIds = new Set([senderId]);
  for (const u of uyeler) aliciIds.add(Number(u.user_id));
  if (grup.lider_user_id != null) aliciIds.add(Number(grup.lider_user_id));

  for (const aliciId of aliciIds) {
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, grup_id, grup_mesaj_id, created_at)
       VALUES (?, ?, 'mafya_grup', ?, ?, 0, ?, ?, strftime('%s','now'))`,
      [aliciId, senderId, konu, icerik, grupId, grupMesajId]
    );
  }
  return { ok: true, grupMesajId, aliciSayisi: aliciIds.size };
}

async function mafyaSohbetGonder(db, userId, metin) {
  const sms = await smsHarca(db, userId);
  if (!sms.ok) return sms;
  const temiz = String(metin || "").trim().slice(0, 400);
  if (!temiz) return { ok: false, error: "Mesaj boş olamaz." };
  await run(
    db,
    `INSERT INTO mafya_sohbet (user_id, mesaj, created_at) VALUES (?, ?, strftime('%s','now'))`,
    [userId, temiz]
  );
  return { ok: true };
}

async function sabotajMesajiEkle(
  db,
  { hedefUserId, saldiranUserId, hedefAdi, saldiranAdi, turAdi, basari, ozet, hedefOzet, kazanilanPara }
) {
  await ensureMessagingTables(db);
  const kurbanMetin = hedefOzet || ozet;
  if (basari) {
    const icerik =
      `Gölgelerden bir saldırı! ${turAdi} operasyonu başarıyla tamamlandı. ` +
      `Kim yaptı bilinmiyor ama zarar açık: ${kurbanMetin}. Hemen önlem al!`;
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
       VALUES (?, NULL, 'sabotaj', ?, ?, 0, strftime('%s','now'))`,
      [hedefUserId, "Sabotaj — Gizli Saldırı", icerik]
    );
    const saldiranIcerik =
      `${hedefAdi} hedefine ${turAdi} sabotajın başarılı oldu. ${ozet}` +
      (kazanilanPara > 0 ? ` Kasana ${kazanilanPara.toLocaleString("tr-TR")} TL eklendi.` : "");
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
       VALUES (?, NULL, 'sabotaj', ?, ?, 0, strftime('%s','now'))`,
      [saldiranUserId, "Sabotaj — Başarılı", saldiranIcerik]
    );
  } else {
    const hedefIcerik =
      `${saldiranAdi} seni ${turAdi} ile sabote etmeye kalktı ama planı tutmadı. Sokaklar konuşuyor!`;
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
       VALUES (?, ?, 'sabotaj', ?, ?, 0, strftime('%s','now'))`,
      [hedefUserId, saldiranUserId, "Sabotaj — Girişim", hedefIcerik]
    );
    const saldiranIcerik = `${hedefAdi} hedefine ${turAdi} tutmadı. Plan ifşa oldu.`;
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
       VALUES (?, NULL, 'sabotaj', ?, ?, 0, strftime('%s','now'))`,
      [saldiranUserId, "Sabotaj — Başarısız", saldiranIcerik]
    );
  }
}

async function mafyaSavasSonucMesajlari(db, { kazananGrupId, kaybedenGrupId, kazananAd, kaybedenAd }) {
  await ensureMessagingTables(db);
  const kazananUyeler = await all(
    db,
    `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`,
    [kazananGrupId]
  );
  const kaybedenUyeler = await all(
    db,
    `SELECT user_id FROM mafya_uyeleri WHERE grup_id = ?`,
    [kaybedenGrupId]
  );
  const kazananIcerik = `[${kaybedenAd}] Mafya Grubuna karşı savaşı kazandınız! Sokakları ve Mekanları onlara dar ederek kimin daha güçlü olduğunu gösterdiniz.`;
  const kaybedenIcerik = `[${kazananAd}] Mafya Grubuna karşı savaşı kaybettiniz. Sokaklar ve Mekanlardaki adamlarımız talan edildi! Tedbirleri arttırmalı ve güçlenip intikam almalıyız!`;

  for (const u of kazananUyeler) {
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
       VALUES (?, NULL, 'mafya_savas', ?, ?, 0, strftime('%s','now'))`,
      [u.user_id, "Mafya Savaşı — Zafer", kazananIcerik]
    );
  }
  for (const u of kaybedenUyeler) {
    await run(
      db,
      `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
       VALUES (?, NULL, 'mafya_savas', ?, ?, 0, strftime('%s','now'))`,
      [u.user_id, "Mafya Savaşı — Yenilgi", kaybedenIcerik]
    );
  }
}

module.exports = {
  SMS_GUNLUK,
  turkeyDayKey,
  getSmsHakki,
  ensureMessagingTables,
  saldiriMesajiEkle,
  sabotajMesajiEkle,
  mafyaSavasSonucMesajlari,
  ozelMesajGonder,
  tumMesajlariOkundu,
  mesajlariGetir,
  mesajOkundu,
  mesajSil,
  mesajCevapla,
  okunmamisSayisi,
  mafyaSohbetListe,
  mafyaSohbetGonder,
  mafyaGrupMesajGonder,
};
