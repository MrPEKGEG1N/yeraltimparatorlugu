const { run, get, all } = require("../db/database");

const AYLAR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function istanbulAy(tarih) {
  const d = tarih || new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const yil = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
  const ay = parseInt(parts.find((p) => p.type === "month")?.value || "0", 10);
  return { yil, ay };
}

function oncekiAy(yil, ay) {
  if (ay <= 1) return { yil: yil - 1, ay: 12 };
  return { yil, ay: ay - 1 };
}

function ayEtiket(yil, ay) {
  const ad = AYLAR[(ay || 1) - 1] || String(ay);
  return `${ad} ${yil}`;
}

async function ensureSampiyonTable(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS mafya_aylik_sampiyon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      yil INTEGER NOT NULL,
      ay INTEGER NOT NULL,
      grup_id INTEGER NOT NULL,
      toplam_guc INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(yil, ay),
      FOREIGN KEY (grup_id) REFERENCES mafya_gruplari(id) ON DELETE CASCADE
    )`
  );
}

async function enGucluMafyaGrubu(db) {
  return get(
    db,
    `SELECT g.id, g.isim,
            COALESCE(SUM(p.guc + COALESCE(p.bonus_guc, 0)), 0) AS toplam_guc,
            COUNT(u.user_id) AS uye_sayisi
     FROM mafya_gruplari g
     JOIN mafya_uyeleri u ON u.grup_id = g.id
     JOIN players p ON p.user_id = u.user_id
     GROUP BY g.id
     HAVING uye_sayisi > 0
     ORDER BY toplam_guc DESC, uye_sayisi DESC, g.id ASC
     LIMIT 1`
  );
}

async function aySonuKontrol(db) {
  await ensureSampiyonTable(db);
  const { yil, ay } = istanbulAy(new Date());
  const hedef = oncekiAy(yil, ay);

  const varMi = await get(
    db,
    `SELECT id FROM mafya_aylik_sampiyon WHERE yil = ? AND ay = ?`,
    [hedef.yil, hedef.ay]
  );
  if (varMi) return null;

  const kazanan = await enGucluMafyaGrubu(db);
  if (!kazanan) return null;

  const ts = Math.floor(Date.now() / 1000);
  await run(
    db,
    `INSERT INTO mafya_aylik_sampiyon (yil, ay, grup_id, toplam_guc, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [hedef.yil, hedef.ay, kazanan.id, kazanan.toplam_guc || 0, ts]
  );

  const etiket = ayEtiket(hedef.yil, hedef.ay);
  const gucStr = Number(kazanan.toplam_guc || 0).toLocaleString("tr-TR");
  const { gazeteEkle } = require("./sehirGazeteService");
  await gazeteEkle(
    db,
    `AYIN EN GÜÇLÜ MAFYA GRUBU: [${kazanan.isim}] — ${etiket} döneminde şehrin en güçlü ailesi seçildi. (Toplam Güç: ${gucStr})`,
    ts
  );

  return {
    yil: hedef.yil,
    ay: hedef.ay,
    ayEtiket: etiket,
    grupId: kazanan.id,
    isim: kazanan.isim,
    toplamGuc: kazanan.toplam_guc || 0,
  };
}

/** Gazetede bu ay boyunca gösterilecek şampiyon (bir önceki ayın kazananı). */
async function getGazeteSampiyonu(db) {
  await aySonuKontrol(db);
  const { yil, ay } = istanbulAy(new Date());
  const hedef = oncekiAy(yil, ay);
  const row = await get(
    db,
    `SELECT s.yil, s.ay, s.toplam_guc, s.grup_id, g.isim
     FROM mafya_aylik_sampiyon s
     JOIN mafya_gruplari g ON g.id = s.grup_id
     WHERE s.yil = ? AND s.ay = ?`,
    [hedef.yil, hedef.ay]
  );
  if (!row) return null;
  const etiket = ayEtiket(row.yil, row.ay);
  const gucStr = Number(row.toplam_guc || 0).toLocaleString("tr-TR");
  return {
    grupId: row.grup_id,
    isim: row.isim,
    yil: row.yil,
    ay: row.ay,
    ayEtiket: etiket,
    toplamGuc: row.toplam_guc || 0,
    baslik: `${etiket} Ayının En Güçlü Mafya Grubu`,
    ozet: `[${row.isim}], ${etiket} sonunda tüm rakiplerini geride bırakarak ayın en güçlü mafya ailesi seçildi. Toplam güç: ${gucStr}.`,
  };
}

async function getGrupSampiyonluklari(db, grupId) {
  await ensureSampiyonTable(db);
  const rows = await all(
    db,
    `SELECT yil, ay, toplam_guc FROM mafya_aylik_sampiyon
     WHERE grup_id = ?
     ORDER BY yil DESC, ay DESC`,
    [grupId]
  );
  return rows.map((r) => ({
    yil: r.yil,
    ay: r.ay,
    ayEtiket: ayEtiket(r.yil, r.ay),
    toplamGuc: r.toplam_guc || 0,
  }));
}

module.exports = {
  ensureSampiyonTable,
  istanbulAy,
  oncekiAy,
  ayEtiket,
  enGucluMafyaGrubu,
  aySonuKontrol,
  getGazeteSampiyonu,
  getGrupSampiyonluklari,
};
