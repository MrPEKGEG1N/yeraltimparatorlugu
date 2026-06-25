const { run, get, all } = require("../db/database");
const { logSecurityEvent } = require("./securityService");

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
      (SELECT COUNT(*) FROM oyuncu_mesajlari WHERE created_at > strftime('%s','now') - 86400) AS mesaj_24s`
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
              p.kasa, p.guc, p.puan, p.icraat, p.last_seen_at, p.kara_listede
       FROM users u
       JOIN players p ON p.user_id = u.id
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
            p.kasa, p.guc, p.puan, p.icraat, p.last_seen_at, p.kara_listede
     FROM users u
     JOIN players p ON p.user_id = u.id
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
    `SELECT u.*, p.kasa, p.guc, p.puan, p.icraat, p.last_seen_at, p.kara_listede, p.sms_hakki
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

  return { user, fingerprints, events, uyelik };
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
    karaListede: !!r.kara_listede,
    lastSeen: fmtTs(r.last_seen_at),
    lastLogin: fmtTs(r.last_login_at),
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
  getMultiAccountClusters,
  listInboxMessages,
  listMafyaSohbet,
  listGrupMesajlari,
  deleteInboxMessage,
  deleteMafyaSohbet,
  deleteGrupMesaj,
  purgeUserMessages,
  listSecurityEvents,
  mapPlayerRow,
};
