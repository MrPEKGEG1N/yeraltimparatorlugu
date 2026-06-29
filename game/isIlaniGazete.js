const { run, get, all } = require("../db/database");
const { turBul } = require("./sirketCatalog");

async function ensureGazeteTable(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sehir_gazete (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesaj TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );
}

function zamanDamgasi(ts) {
  const t = ts ? new Date(ts * 1000) : new Date();
  return t.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isIlaniMesaji(sirketAdi, sahipAdi, turAd) {
  const sirket = String(sirketAdi || "Şirket").trim();
  const sahip = String(sahipAdi || "Patron").trim();
  const tur = String(turAd || "işletme").trim();
  return `İş İlanı: [${sahip}], [${sirket}] (${tur}) için çalışan arıyor. Başvurular Şehir Gazetesi İş İlanları bölümünde.`;
}

async function isIlaniHaberEkle(db, sirketAdi, sahipAdi, turAd, ts) {
  await ensureGazeteTable(db);
  const mesajGovde = isIlaniMesaji(sirketAdi, sahipAdi, turAd);
  const damga = zamanDamgasi(ts);
  const full = `${damga} — ${mesajGovde}`;
  await run(db, `INSERT INTO sehir_gazete (mesaj, created_at) VALUES (?, ?)`, [
    full,
    ts || Math.floor(Date.now() / 1000),
  ]);
  return mesajGovde;
}

async function isIlaniGazeteVarMi(db, sirketAdi, sinceTs) {
  const sirket = String(sirketAdi || "").trim();
  if (!sirket) return true;
  const row = await get(
    db,
    `SELECT id FROM sehir_gazete
     WHERE mesaj LIKE ? AND created_at >= ?
     LIMIT 1`,
    [`%[${sirket}]%`, sinceTs]
  );
  return !!row;
}

/** Açık ilanları gazetede yoksa son 7 gün için haber oluşturur (eski açık ilanlar). */
async function acikIlanlariGazeteSenkron(db) {
  await ensureGazeteTable(db);
  const since = Math.floor(Date.now() / 1000) - 86400 * 7;
  const rows = await all(
    db,
    `SELECT s.isim, s.tur_id, u.reis_adi
     FROM oyuncu_sirketleri s
     JOIN users u ON u.id = s.sahip_user_id
     WHERE s.ise_alim_acik = 1`
  );
  for (const row of rows || []) {
    const varMi = await isIlaniGazeteVarMi(db, row.isim, since);
    if (varMi) continue;
    const tur = turBul(row.tur_id);
    await isIlaniHaberEkle(db, row.isim, row.reis_adi, tur?.ad || "şirket");
  }
}

function iseAlimAcikMi(deger) {
  return Number(deger) === 1;
}

module.exports = {
  isIlaniHaberEkle,
  isIlaniGazeteVarMi,
  acikIlanlariGazeteSenkron,
  iseAlimAcikMi,
  isIlaniMesaji,
};
