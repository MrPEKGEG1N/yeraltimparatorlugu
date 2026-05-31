const { run, get, all } = require("../db/database");

const SMS_GUNLUK = 50;

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
  const day = turkeyDayKey();
  if (row.last_sms_day === day) return row.sms_hakki;
  await run(
    db,
    `UPDATE players SET sms_hakki = ?, last_sms_day = ? WHERE user_id = ?`,
    [SMS_GUNLUK, day, userId]
  );
  return SMS_GUNLUK;
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
  const hak = await getSmsHakki(db, userId);
  if (hak < 1) return { ok: false, error: "SMS hakkın kalmadı! Yarın 50 hak yenilenir." };
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
  const paraStr = paraKaybi.toLocaleString("tr-TR");
  const icerik =
    `Alarm çalıyor! ${saldiranAdi} mekanını talan etti. Kasanın dibini gördüler, ${paraStr} TL'ni alıp gittiler; yetmedi, ${puanKaybi} saygınlığını ayaklar altına aldılar. Sokaklarda adın geçiyor, hemen bir şeyler yapmazsan bu işin sonu kötü!`;
  await run(
    db,
    `INSERT INTO oyuncu_mesajlari (to_user_id, from_user_id, tip, konu, icerik, okundu, created_at)
     VALUES (?, NULL, 'saldiri', 'Alarm! Mekan Talandı', ?, 0, strftime('%s','now'))`,
    [hedefUserId, icerik]
  );
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
  const rows = await all(
    db,
    `SELECT m.id, m.tip, m.konu, m.icerik, m.okundu, m.created_at,
            fu.reis_adi AS gonderen_adi
     FROM oyuncu_mesajlari m
     LEFT JOIN users fu ON fu.id = m.from_user_id
     WHERE m.to_user_id = ?
     ORDER BY m.created_at DESC
     LIMIT 80`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    tip: r.tip,
    konu: r.konu,
    icerik: r.icerik,
    okundu: !!r.okundu,
    gonderenAdi: r.gonderen_adi || (r.tip === "saldiri" ? "Sistem" : "—"),
    tarih: new Date(r.created_at * 1000).toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
    }),
  }));
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
    `SELECT from_user_id, konu FROM oyuncu_mesajlari WHERE id = ? AND to_user_id = ?`,
    [mesajId, userId]
  );
  if (!orig || !orig.from_user_id) {
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
    `SELECT s.id, s.mesaj, s.created_at, u.reis_adi
     FROM mafya_sohbet s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      reisAdi: r.reis_adi,
      mesaj: r.mesaj,
      tarih: new Date(r.created_at * 1000).toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
      }),
    }));
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

module.exports = {
  SMS_GUNLUK,
  getSmsHakki,
  saldiriMesajiEkle,
  ozelMesajGonder,
  tumMesajlariOkundu,
  mesajlariGetir,
  mesajOkundu,
  mesajSil,
  mesajCevapla,
  okunmamisSayisi,
  mafyaSohbetListe,
  mafyaSohbetGonder,
};
