const { get } = require("../db/database");
const { meslekGetir } = require("./meslekService");
const { turBul } = require("./sirketCatalog");

function isyeriLocative(ad) {
  const clean = String(ad || "").trim();
  if (!clean) return "";
  const vowels = "aeıioöuü";
  const last = clean.slice(-1).toLocaleLowerCase("tr-TR");
  if (vowels.includes(last)) return clean + "de";
  return clean + "'de";
}

function sirketOzet(row, tip, rolMetni) {
  const tur = turBul(row.tur_id);
  const turAd = tur ? tur.ad : "Şirket";
  const sirketAdi = row.isim || row.sirket_adi || "—";
  return {
    tip,
    metin: `${turAd} · ${sirketAdi} ${rolMetni}`,
    sirketId: row.id,
    sirketAdi,
    turAd,
    turEmoji: tur ? tur.emoji : "🏢",
    rolMetni,
  };
}

async function oyuncuIsDurumuMetni(db, userId) {
  const sahip = await get(
    db,
    `SELECT id, isim, tur_id FROM oyuncu_sirketleri WHERE sahip_user_id = ?`,
    [userId]
  );
  if (sahip) {
    return sirketOzet(sahip, "sahip", "Sahibi");
  }

  const calisan = await get(
    db,
    `SELECT s.id, s.isim, s.tur_id
     FROM sirket_calisanlari c
     JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
     WHERE c.user_id = ?`,
    [userId]
  );
  if (calisan) {
    return sirketOzet(calisan, "calisan", "Çalışanı");
  }

  const meslek = await meslekGetir(db, userId);
  if (meslek) {
    const yer = isyeriLocative(meslek.isyeriAd);
    return {
      tip: "npc",
      metin: `NPC ${yer} Çalışıyor`,
      isyeriAd: meslek.isyeriAd,
      unvan: meslek.unvan,
    };
  }

  return { tip: "yok", metin: "—" };
}

module.exports = { oyuncuIsDurumuMetni };
