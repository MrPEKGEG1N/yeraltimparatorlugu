const { run, get, all } = require("../db/database");
const { logSecurityEvent } = require("./securityService");
const { listCanliAktivite, listOyuncuAktiviteLog, mapAktiviteAlanlari } = require("./aktiviteService");
const { SECTOR_KEYS, MEKANLAR } = require("./sectorsCatalog");
const { ensureUserBase, adminSeviyeAyarla, baseOzeti } = require("./guvenliYerService");
const { MAX_SEVIYE, seviyeBul } = require("./guvenliYerCatalog");
const { ELEMAN_GUC } = require("./istihbaratService");

const SEKTOR_ETIKET = { yeralti: "Yeraltı", silah: "Silah", paket: "Paket" };

function listMekanSablonu() {
  const liste = [];
  for (const sektor of SECTOR_KEYS) {
    const mekanlar = MEKANLAR[sektor] || {};
    for (const mekanKey of Object.keys(mekanlar)) {
      const m = mekanlar[mekanKey];
      liste.push({
        sektor,
        mekanKey,
        sektorLabel: SEKTOR_ETIKET[sektor] || sektor,
        ad: m.ad,
        saatlik: m.saatlik,
        sayginlik: m.sayginlik,
      });
    }
  }
  return liste;
}

async function getPlayerMekanlar(db, userId) {
  const rows = await all(
    db,
    `SELECT sektor, mekan_key, adet FROM sektor_sahiplik WHERE user_id = ? ORDER BY sektor, mekan_key`,
    [userId]
  );
  const adetMap = {};
  let toplam = 0;
  for (const r of rows) {
    const k = `${r.sektor}:${r.mekan_key}`;
    adetMap[k] = r.adet || 0;
    toplam += r.adet || 0;
  }
  const mekanlar = listMekanSablonu().map((m) => ({
    ...m,
    adet: adetMap[`${m.sektor}:${m.mekanKey}`] || 0,
  }));
  return { mekanlar, toplam };
}

function fmtTs(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}

async function getDashboard(db) {
  const row = await get(
    db,
    `SELECT
      (SELECT COUNT(*) FROM users) AS toplam_oyuncu,
      (SELECT COUNT(*) FROM users WHERE banned = 1) AS banli,
      (SELECT COUNT(*) FROM users WHERE is_admin = 1) AS admin_sayisi,
      (SELECT COUNT(*) FROM players WHERE last_seen_at > strftime('%s','now') - 900) AS online_15dk,
      (SELECT COUNT(*) FROM security_events WHERE created_at > strftime('%s','now') - 86400) AS olay_24s,
      (SELECT COUNT(*) FROM oyuncu_mesajlari WHERE created_at > strftime('%s','now') - 86400) AS mesaj_24s,
      (SELECT COUNT(*) FROM mafya_gruplari) AS mafya_grup`
  );
  return row || {};
}

async function searchPlayers(db, q, limit = 200) {
  const raw = String(q || "").trim();
  const cap = Math.min(500, Math.max(1, limit));

  if (!raw) {
    return all(
      db,
      `SELECT u.id, u.username, u.reis_adi, u.lakap, u.grup, u.banned, u.is_admin,
              u.visitor_id, u.son_ip, u.user_agent, u.last_login_at, u.created_at,
              p.kasa, p.guc, p.puan, p.icraat, p.sms_hakki, p.last_seen_at, p.kara_listede,
              p.aktif_ekran, p.son_aksiyon, p.son_aksiyon_detay, p.son_aksiyon_at,
              (SELECT COALESCE(SUM(adet), 0) FROM sektor_sahiplik s WHERE s.user_id = u.id) AS mekan_toplam,
              COALESCE(ub.base_seviye, 1) AS guvenli_yer_seviye,
              COALESCE(i.eleman_sayisi, 0) AS istihbarat_eleman
       FROM users u
       JOIN players p ON p.user_id = u.id
       LEFT JOIN user_base ub ON ub.user_id = u.id
       LEFT JOIN istihbarat i ON i.user_id = u.id
       ORDER BY p.puan DESC
       LIMIT ?`,
      [cap]
    );
  }

  const like = `%${raw}%`;
  return all(
    db,
    `SELECT u.id, u.username, u.reis_adi, u.lakap, u.grup, u.banned, u.is_admin,
            u.visitor_id, u.son_ip, u.user_agent, u.last_login_at, u.created_at,
            p.kasa, p.guc, p.puan, p.icraat, p.sms_hakki, p.last_seen_at, p.kara_listede,
            p.aktif_ekran, p.son_aksiyon, p.son_aksiyon_detay, p.son_aksiyon_at,
            (SELECT COALESCE(SUM(adet), 0) FROM sektor_sahiplik s WHERE s.user_id = u.id) AS mekan_toplam,
            COALESCE(ub.base_seviye, 1) AS guvenli_yer_seviye,
            COALESCE(i.eleman_sayisi, 0) AS istihbarat_eleman
     FROM users u
     JOIN players p ON p.user_id = u.id
     LEFT JOIN user_base ub ON ub.user_id = u.id
     LEFT JOIN istihbarat i ON i.user_id = u.id
     WHERE u.username LIKE ? COLLATE NOCASE
        OR u.reis_adi LIKE ? COLLATE NOCASE
        OR CAST(u.id AS TEXT) = ?
     ORDER BY p.puan DESC
     LIMIT ?`,
    [like, like, raw, Math.min(80, cap)]
  );
}

async function getPlayerDetail(db, userId) {
  const user = await get(
    db,
    `SELECT u.*, p.kasa, p.guc, p.puan, p.icraat, p.last_seen_at, p.kara_listede, p.sms_hakki,
            p.aktif_ekran, p.son_aksiyon, p.son_aksiyon_detay, p.son_aksiyon_at
     FROM users u
     JOIN players p ON p.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );
  if (!user) return null;

  const fingerprints = await all(
    db,
    `SELECT visitor_id, son_ip, user_agent, first_seen, last_seen
     FROM user_fingerprints WHERE user_id = ?
     ORDER BY last_seen DESC LIMIT 20`,
    [userId]
  );

  const events = await all(
    db,
    `SELECT event_type, detail, ip, created_at
     FROM security_events WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 30`,
    [userId]
  );

  const uyelik = await get(
    db,
    `SELECT mg.isim, mg.id AS grup_id, mu.rutbe
     FROM mafya_uyeleri mu
     JOIN mafya_gruplari mg ON mg.id = mu.grup_id
     WHERE mu.user_id = ?`,
    [userId]
  );

  const aktiviteLog = await listOyuncuAktiviteLog(db, userId, 40);
  const mekan = await getPlayerMekanlar(db, userId);
  const baseRow = await ensureUserBase(db, userId);
  const guvenliYer = baseOzeti(baseRow);
  const istihbaratRow = await get(db, `SELECT eleman_sayisi FROM istihbarat WHERE user_id = ?`, [userId]);
  const istihbaratEleman = istihbaratRow ? istihbaratRow.eleman_sayisi || 0 : 0;

  return {
    user,
    fingerprints,
    events,
    uyelik,
    aktiviteLog,
    mekanlar: mekan.mekanlar,
    mekanToplam: mekan.toplam,
    guvenliYer,
    istihbaratEleman,
  };
}

async function invalidateSessions(db, userId) {
  await run(db, `UPDATE users SET token_version = token_version + 1 WHERE id = ?`, [userId]);
}

async function banPlayer(db, adminId, userId, reason = "") {
  if (userId === adminId) return { ok: false, error: "Kendini banlayamazsın." };
  const target = await get(db, `SELECT is_admin, banned FROM users WHERE id = ?`, [userId]);
  if (!target) return { ok: false, error: "Oyuncu bulunamadı." };
  if (target.is_admin) return { ok: false, error: "Yönetici hesabı banlanamaz." };

  await run(db, `UPDATE users SET banned = 1 WHERE id = ?`, [userId]);
  await invalidateSessions(db, userId);
  await logSecurityEvent(db, userId, "admin_ban", { adminId, reason });
  return { ok: true, mesaj: "Oyuncu banlandı ve oturumu sonlandırıldı." };
}

async function unbanPlayer(db, adminId, userId) {
  await run(db, `UPDATE users SET banned = 0, failed_login_count = 0 WHERE id = ?`, [userId]);
  await logSecurityEvent(db, userId, "admin_unban", { adminId });
  return { ok: true, mesaj: "Ban kaldırıldı." };
}

async function kickPlayer(db, adminId, userId) {
  if (userId === adminId) return { ok: false, error: "Kendinin oturumunu sonlandıramazsın." };
  const target = await get(db, `SELECT is_admin FROM users WHERE id = ?`, [userId]);
  if (!target) return { ok: false, error: "Oyuncu bulunamadı." };
  if (target.is_admin) return { ok: false, error: "Yönetici oturumu sonlandırılamaz." };
  await invalidateSessions(db, userId);
  await logSecurityEvent(db, userId, "admin_kick", { adminId });
  return { ok: true, mesaj: "Aktif oturum sonlandırıldı." };
}

async function updatePlayerMekanlar(db, adminId, userId, items) {
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, error: "Güncellenecek mekan yok." };
  }
  const player = await get(db, `SELECT user_id FROM players WHERE user_id = ?`, [userId]);
  if (!player) return { ok: false, error: "Oyuncu bulunamadı." };

  const sablon = listMekanSablonu();
  const gecerli = new Set(sablon.map((m) => `${m.sektor}:${m.mekanKey}`));
  const patch = [];

  for (const item of items) {
    const sektor = String(item.sektor || "").trim();
    const mekanKey = String(item.mekanKey || item.mekan_key || "").trim();
    const key = `${sektor}:${mekanKey}`;
    if (!gecerli.has(key)) return { ok: false, error: `Geçersiz mekan: ${key}` };
    const adet = parseInt(item.adet, 10);
    if (Number.isNaN(adet) || adet < 0) return { ok: false, error: `${mekanKey} adedi geçersiz.` };
    patch.push({ sektor, mekanKey, adet });
  }

  for (const { sektor, mekanKey, adet } of patch) {
    if (adet === 0) {
      await run(
        db,
        `DELETE FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
        [userId, sektor, mekanKey]
      );
    } else {
      const row = await get(
        db,
        `SELECT adet FROM sektor_sahiplik WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
        [userId, sektor, mekanKey]
      );
      if (row) {
        await run(
          db,
          `UPDATE sektor_sahiplik SET adet = ? WHERE user_id = ? AND sektor = ? AND mekan_key = ?`,
          [adet, userId, sektor, mekanKey]
        );
      } else {
        await run(
          db,
          `INSERT INTO sektor_sahiplik (user_id, sektor, mekan_key, adet, last_income_hour)
           VALUES (?, ?, ?, ?, NULL)`,
          [userId, sektor, mekanKey, adet]
        );
      }
    }
  }

  await logSecurityEvent(db, userId, "admin_mekan_edit", { adminId, patch });
  return { ok: true, mesaj: "Mekan adetleri güncellendi." };
}

async function updatePlayerGuvenliYer(db, adminId, userId, baseSeviye) {
  const player = await get(db, `SELECT user_id FROM players WHERE user_id = ?`, [userId]);
  if (!player) return { ok: false, error: "Oyuncu bulunamadı." };
  const s = parseInt(baseSeviye, 10);
  if (Number.isNaN(s) || s < 1 || s > MAX_SEVIYE) {
    return { ok: false, error: `Güvenli Yer seviyesi 1-${MAX_SEVIYE} arasında olmalı.` };
  }
  const sonuc = await adminSeviyeAyarla(db, userId, s);
  await logSecurityEvent(db, userId, "admin_guvenli_yer", { adminId, baseSeviye: s });
  return { ok: true, mesaj: `Güvenli Yer seviye ${s} olarak ayarlandı.`, guvenliYer: sonuc.base };
}

async function updatePlayerIstihbarat(db, adminId, userId, elemanSayisi) {
  const player = await get(db, `SELECT user_id FROM players WHERE user_id = ?`, [userId]);
  if (!player) return { ok: false, error: "Oyuncu bulunamadı." };
  const n = parseInt(elemanSayisi, 10);
  if (Number.isNaN(n) || n < 0 || n > 100000) {
    return { ok: false, error: "İstihbarat eleman sayısı 0-100000 arasında olmalı." };
  }
  await run(db, `INSERT OR REPLACE INTO istihbarat (user_id, eleman_sayisi) VALUES (?, ?)`, [userId, n]);
  await logSecurityEvent(db, userId, "admin_istihbarat", { adminId, elemanSayisi: n });
  return { ok: true, mesaj: `İstihbarat eleman sayısı ${n} olarak ayarlandı.`, istihbaratEleman: n };
}

async function listMafyaGruplari(db, q, limit = 100) {
  const raw = String(q || "").trim();
  const cap = Math.min(200, Math.max(1, limit));
  const base = `
    SELECT g.id, g.isim, g.aciklama, g.created_at, g.lider_user_id,
           ul.reis_adi AS lider_reis, ul.username AS lider_username,
           (SELECT COUNT(*) FROM mafya_uyeleri mu WHERE mu.grup_id = g.id) AS uye_sayisi,
           (SELECT COUNT(*) FROM mafya_basvurulari mb WHERE mb.grup_id = g.id AND mb.durum = 'beklemede') AS bekleyen_basvuru,
           COALESCE(me.seviye, 1) AS ev_seviye,
           COALESCE(me.birikmis_para, 0) AS ev_birikim,
           (SELECT COUNT(*) FROM mafya_savaslar ms
            WHERE ms.durum IN ('bekliyor', 'aktif')
              AND (ms.saldiran_grup_id = g.id OR ms.hedef_grup_id = g.id)) AS aktif_savas
    FROM mafya_gruplari g
    JOIN users ul ON ul.id = g.lider_user_id
    LEFT JOIN mafya_evi me ON me.grup_id = g.id`;

  if (!raw) {
    return all(db, `${base} ORDER BY uye_sayisi DESC, g.isim LIMIT ?`, [cap]);
  }
  const like = `%${raw}%`;
  return all(
    db,
    `${base}
     WHERE g.isim LIKE ? COLLATE NOCASE
        OR g.aciklama LIKE ? COLLATE NOCASE
        OR ul.reis_adi LIKE ? COLLATE NOCASE
        OR CAST(g.id AS TEXT) = ?
     ORDER BY g.isim
     LIMIT ?`,
    [like, like, like, raw, cap]
  );
}

async function getMafyaGrupDetail(db, grupId) {
  const grup = await get(
    db,
    `SELECT g.id, g.isim, g.aciklama, g.created_at, g.lider_user_id,
            ul.reis_adi AS lider_reis, ul.username AS lider_username
     FROM mafya_gruplari g
     JOIN users ul ON ul.id = g.lider_user_id
     WHERE g.id = ?`,
    [grupId]
  );
  if (!grup) return null;

  const uyeler = await all(
    db,
    `SELECT m.user_id, m.rutbe, u.reis_adi, u.username, p.puan, p.guc, p.last_seen_at,
            COALESCE(i.eleman_sayisi, 0) AS istihbarat_eleman
     FROM mafya_uyeleri m
     JOIN users u ON u.id = m.user_id
     JOIN players p ON p.user_id = m.user_id
     LEFT JOIN istihbarat i ON i.user_id = m.user_id
     WHERE m.grup_id = ?
     ORDER BY p.puan DESC`,
    [grupId]
  );

  const basvurular = await all(
    db,
    `SELECT b.id, b.user_id, u.reis_adi, u.username, b.durum
     FROM mafya_basvurulari b
     JOIN users u ON u.id = b.user_id
     WHERE b.grup_id = ? AND b.durum = 'beklemede'
     ORDER BY b.id DESC`,
    [grupId]
  );

  const evi = await get(db, `SELECT seviye, birikmis_para FROM mafya_evi WHERE grup_id = ?`, [grupId]);

  const savaslar = await all(
    db,
    `SELECT ms.id, ms.durum, ms.baslangic_zamani, ms.savas_zamani, ms.kazanan_grup_id,
            sg.isim AS saldiran_isim, hg.isim AS hedef_isim,
            ms.saldiran_grup_id, ms.hedef_grup_id
     FROM mafya_savaslar ms
     JOIN mafya_gruplari sg ON sg.id = ms.saldiran_grup_id
     JOIN mafya_gruplari hg ON hg.id = ms.hedef_grup_id
     WHERE ms.saldiran_grup_id = ? OR ms.hedef_grup_id = ?
     ORDER BY ms.baslangic_zamani DESC
     LIMIT 15`,
    [grupId, grupId]
  );

  return { grup, uyeler, basvurular, evi, savaslar };
}

function mapMafyaGrupRow(r) {
  return {
    id: r.id,
    isim: r.isim,
    aciklama: r.aciklama,
    liderUserId: r.lider_user_id,
    liderReis: r.lider_reis,
    liderUsername: r.lider_username,
    uyeSayisi: r.uye_sayisi || 0,
    bekleyenBasvuru: r.bekleyen_basvuru || 0,
    evSeviye: r.ev_seviye || 1,
    evBirikim: r.ev_birikim || 0,
    aktifSavas: r.aktif_savas || 0,
    createdAt: fmtTs(r.created_at),
  };
}

function mapMafyaGrupDetail(detail) {
  const g = detail.grup;
  const evi = detail.evi || { seviye: 1, birikmis_para: 0 };
  return {
    grup: {
      id: g.id,
      isim: g.isim,
      aciklama: g.aciklama,
      liderUserId: g.lider_user_id,
      liderReis: g.lider_reis,
      liderUsername: g.lider_username,
      createdAt: fmtTs(g.created_at),
    },
    evi: {
      seviye: evi.seviye || 1,
      birikmisPara: evi.birikmis_para || 0,
    },
    uyeler: detail.uyeler.map((u) => ({
      userId: u.user_id,
      reisAdi: u.reis_adi,
      username: u.username,
      rutbe: u.rutbe,
      puan: u.puan,
      guc: u.guc,
      istihbaratEleman: u.istihbarat_eleman || 0,
      lastSeen: fmtTs(u.last_seen_at),
    })),
    basvurular: detail.basvurular.map((b) => ({
      id: b.id,
      userId: b.user_id,
      reisAdi: b.reis_adi,
      username: b.username,
      durum: b.durum,
    })),
    savaslar: detail.savaslar.map((s) => ({
      id: s.id,
      durum: s.durum,
      saldiranGrupId: s.saldiran_grup_id,
      hedefGrupId: s.hedef_grup_id,
      saldiranIsim: s.saldiran_isim,
      hedefIsim: s.hedef_isim,
      kazananGrupId: s.kazanan_grup_id,
      baslangic: fmtTs(s.baslangic_zamani),
      savasZamani: fmtTs(s.savas_zamani),
    })),
  };
}

async function updatePlayerStats(db, adminId, userId, patch) {
  const fields = [];
  const params = [];
  for (const [col, val] of [
    ["kasa", patch.kasa],
    ["guc", patch.guc],
    ["puan", patch.puan],
    ["icraat", patch.icraat],
    ["sms_hakki", patch.sms_hakki],
  ]) {
    if (val === undefined || val === null || val === "") continue;
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n < 0) return { ok: false, error: `${col} geçersiz.` };
    fields.push(`${col} = ?`);
    params.push(n);
  }
  if (!fields.length) return { ok: false, error: "Güncellenecek alan yok." };
  params.push(userId);
  await run(db, `UPDATE players SET ${fields.join(", ")} WHERE user_id = ?`, params);
  await logSecurityEvent(db, userId, "admin_stat_edit", { adminId, patch });
  return { ok: true, mesaj: "Oyuncu istatistikleri güncellendi." };
}

async function getMultiAccountClusters(db) {
  const byVisitor = await all(
    db,
    `SELECT f.visitor_id AS anahtar, 'visitor' AS tip,
            COUNT(DISTINCT f.user_id) AS hesap_sayisi,
            GROUP_CONCAT(DISTINCT u.reis_adi) AS isimler,
            GROUP_CONCAT(DISTINCT f.user_id) AS user_ids,
            MAX(f.last_seen) AS son_gorulme
     FROM user_fingerprints f
     JOIN users u ON u.id = f.user_id
     WHERE f.visitor_id != ''
     GROUP BY f.visitor_id
     HAVING hesap_sayisi > 1
     ORDER BY hesap_sayisi DESC, son_gorulme DESC
     LIMIT 60`
  );

  const byIp = await all(
    db,
    `SELECT f.son_ip AS anahtar, 'ip' AS tip,
            COUNT(DISTINCT f.user_id) AS hesap_sayisi,
            GROUP_CONCAT(DISTINCT u.reis_adi) AS isimler,
            GROUP_CONCAT(DISTINCT f.user_id) AS user_ids,
            MAX(f.last_seen) AS son_gorulme
     FROM user_fingerprints f
     JOIN users u ON u.id = f.user_id
     WHERE f.son_ip != ''
       AND f.son_ip NOT IN ('127.0.0.1', '::1', '0.0.0.0')
     GROUP BY f.son_ip
     HAVING hesap_sayisi > 1
     ORDER BY hesap_sayisi DESC, son_gorulme DESC
     LIMIT 60`
  );

  const linkedPairs = await all(
    db,
    `SELECT se.id, se.detail, se.created_at, se.ip,
            u.reis_adi AS oyuncu
     FROM security_events se
     LEFT JOIN users u ON u.id = se.user_id
     WHERE se.event_type = 'alt_account_block'
     ORDER BY se.created_at DESC
     LIMIT 40`
  );

  return { byVisitor, byIp, linkedPairs };
}

async function listInboxMessages(db, { q = "", limit = 60 } = {}) {
  const raw = String(q || "").trim();
  const params = [];
  let where = "1=1";
  if (raw) {
    where += ` AND (m.icerik LIKE ? COLLATE NOCASE OR m.konu LIKE ? COLLATE NOCASE
      OR fu.reis_adi LIKE ? COLLATE NOCASE OR tu.reis_adi LIKE ? COLLATE NOCASE)`;
    const like = `%${raw}%`;
    params.push(like, like, like, like);
  }
  params.push(Math.min(100, Math.max(1, limit)));
  return all(
    db,
    `SELECT m.id, m.tip, m.konu, m.icerik, m.okundu, m.created_at, m.grup_id, m.grup_mesaj_id,
            fu.reis_adi AS gonderen, fu.id AS gonderen_id,
            tu.reis_adi AS alici, tu.id AS alici_id
     FROM oyuncu_mesajlari m
     LEFT JOIN users fu ON fu.id = m.from_user_id
     JOIN users tu ON tu.id = m.to_user_id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT ?`,
    params
  );
}

async function listMafyaSohbet(db, limit = 60) {
  return all(
    db,
    `SELECT s.id, s.mesaj, s.created_at, u.id AS user_id, u.reis_adi
     FROM mafya_sohbet s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [Math.min(100, limit)]
  );
}

async function listGrupMesajlari(db, limit = 60) {
  return all(
    db,
    `SELECT g.id, g.icerik, g.created_at, g.grup_id,
            u.id AS user_id, u.reis_adi, mg.isim AS grup_adi
     FROM mafya_grup_mesajlari g
     JOIN users u ON u.id = g.from_user_id
     JOIN mafya_gruplari mg ON mg.id = g.grup_id
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [Math.min(100, limit)]
  );
}

async function deleteInboxMessage(db, adminId, messageId) {
  const row = await get(db, `SELECT id FROM oyuncu_mesajlari WHERE id = ?`, [messageId]);
  if (!row) return { ok: false, error: "Mesaj bulunamadı." };
  await run(db, `DELETE FROM oyuncu_mesajlari WHERE id = ?`, [messageId]);
  await logSecurityEvent(db, adminId, "admin_msg_delete_inbox", { messageId });
  return { ok: true };
}

async function deleteMafyaSohbet(db, adminId, messageId) {
  const row = await get(db, `SELECT id FROM mafya_sohbet WHERE id = ?`, [messageId]);
  if (!row) return { ok: false, error: "Mesaj bulunamadı." };
  await run(db, `DELETE FROM mafya_sohbet WHERE id = ?`, [messageId]);
  await logSecurityEvent(db, adminId, "admin_msg_delete_sohbet", { messageId });
  return { ok: true };
}

async function deleteGrupMesaj(db, adminId, messageId) {
  const row = await get(db, `SELECT id, grup_id FROM mafya_grup_mesajlari WHERE id = ?`, [messageId]);
  if (!row) return { ok: false, error: "Grup mesajı bulunamadı." };
  await run(db, `DELETE FROM mafya_grup_mesajlari WHERE id = ?`, [messageId]);
  await run(db, `DELETE FROM oyuncu_mesajlari WHERE grup_mesaj_id = ?`, [messageId]);
  await logSecurityEvent(db, adminId, "admin_msg_delete_grup", { messageId, grupId: row.grup_id });
  return { ok: true };
}

async function purgeUserMessages(db, adminId, userId) {
  const sent = await run(db, `DELETE FROM oyuncu_mesajlari WHERE from_user_id = ?`, [userId]);
  const recv = await run(db, `DELETE FROM oyuncu_mesajlari WHERE to_user_id = ?`, [userId]);
  const sohbet = await run(db, `DELETE FROM mafya_sohbet WHERE user_id = ?`, [userId]);
  const grup = await run(db, `DELETE FROM mafya_grup_mesajlari WHERE from_user_id = ?`, [userId]);
  await logSecurityEvent(db, userId, "admin_purge_messages", {
    adminId,
    silinen: {
      gonderilen: sent.changes,
      alinan: recv.changes,
      sohbet: sohbet.changes,
      grup: grup.changes,
    },
  });
  return {
    ok: true,
    mesaj: `Mesajlar temizlendi (gönderilen: ${sent.changes}, alınan: ${recv.changes}, sohbet: ${sohbet.changes}, grup: ${grup.changes}).`,
  };
}

async function listSecurityEvents(db, limit = 80) {
  return all(
    db,
    `SELECT se.id, se.event_type, se.detail, se.ip, se.created_at, u.reis_adi, u.username
     FROM security_events se
     LEFT JOIN users u ON u.id = se.user_id
     ORDER BY se.created_at DESC
     LIMIT ?`,
    [Math.min(150, limit)]
  );
}

function mapPlayerRow(r) {
  return {
    id: r.id,
    username: r.username,
    reisAdi: r.reis_adi,
    lakap: r.lakap,
    grup: r.grup,
    banned: !!r.banned,
    isAdmin: !!r.is_admin,
    visitorId: r.visitor_id,
    sonIp: r.son_ip,
    kasa: r.kasa,
    guc: r.guc,
    puan: r.puan,
    icraat: r.icraat,
    smsHakki: r.sms_hakki,
    mekanToplam: r.mekan_toplam || 0,
    guvenliYerSeviye: r.guvenli_yer_seviye || 1,
    guvenliYerAd: seviyeBul(r.guvenli_yer_seviye || 1).ad,
    istihbaratEleman: r.istihbarat_eleman || 0,
    istihbaratGuc: (r.istihbarat_eleman || 0) * ELEMAN_GUC,
    karaListede: !!r.kara_listede,
    lastSeen: fmtTs(r.last_seen_at),
    lastLogin: fmtTs(r.last_login_at),
    ...mapAktiviteAlanlari(r),
  };
}

module.exports = {
  fmtTs,
  getDashboard,
  searchPlayers,
  getPlayerDetail,
  banPlayer,
  unbanPlayer,
  kickPlayer,
  updatePlayerStats,
  updatePlayerMekanlar,
  updatePlayerGuvenliYer,
  updatePlayerIstihbarat,
  listMafyaGruplari,
  getMafyaGrupDetail,
  mapMafyaGrupRow,
  mapMafyaGrupDetail,
  listMekanSablonu,
  getMultiAccountClusters,
  listInboxMessages,
  listMafyaSohbet,
  listGrupMesajlari,
  deleteInboxMessage,
  deleteMafyaSohbet,
  deleteGrupMesaj,
  purgeUserMessages,
  listSecurityEvents,
  listCanliAktivite,
  mapPlayerRow,
};
