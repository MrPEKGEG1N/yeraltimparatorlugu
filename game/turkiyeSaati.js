/** Türkiye saati — maaş/rapor 21:00, takvim günü gece yarısı */

const MAAS_RAPOR_SAATI = 21;
const MAAS_RAPOR_DAKIKA_PENCERE = 5;

function turkeyNowParts(tarih) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
    .formatToParts(tarih || new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10) || 0,
    minute: parseInt(parts.minute, 10) || 0,
  };
}

function gunKeyEkle(dayKey, gun) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + gun));
  return dt.toISOString().slice(0, 10);
}

/** Takvim günü (antrenman, eğitim slotu vb.) */
function istanbulGunKey(tarih) {
  return turkeyNowParts(tarih).dayKey;
}

/**
 * Maaş/rapor dönemi: 21:00–ertesi gün 20:59 arası aynı anahtar.
 * 21:00 öncesi → bir önceki günün anahtarı.
 */
function maasGunKey(tarih) {
  const parts = turkeyNowParts(tarih);
  if (parts.hour >= MAAS_RAPOR_SAATI) return parts.dayKey;
  return gunKeyEkle(parts.dayKey, -1);
}

function maasSaatiGeldiMi(tarih) {
  return turkeyNowParts(tarih).hour >= MAAS_RAPOR_SAATI;
}

/** Sunucu cron — 21:00–21:05 arası tek seferlik toplu işlem */
function maasCronPenceresiMi(tarih) {
  const parts = turkeyNowParts(tarih);
  return parts.hour === MAAS_RAPOR_SAATI && parts.minute <= MAAS_RAPOR_DAKIKA_PENCERE;
}

/** İstanbul saat diliminde YYYY-MM-DDTHH anahtarı (saatlik gelir işareti). */
function istanbulHourKey(tarih) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(tarih || new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}`;
}

function parseIstanbulHourKey(key) {
  const m = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:00:00+03:00`).getTime();
}

/** İstanbul takvim günü 00:00 — unix saniye */
function istanbulGunBaslangicUnix(dayKey) {
  return Math.floor(new Date(`${dayKey}T00:00:00+03:00`).getTime() / 1000);
}

/**
 * Son ödeme saatinden bu yana kaç tam saatlik gelir yatmalı.
 * İlk ödeme (lastHourKey yok) = 1 saat; aynı saat = 0.
 */
function kacirilanSaatSayisi(lastHourKey, currentHourKey) {
  if (!lastHourKey) return 1;
  if (lastHourKey === currentHourKey) return 0;
  const from = parseIstanbulHourKey(lastHourKey);
  const to = parseIstanbulHourKey(currentHourKey);
  if (from == null || to == null) return 1;
  const diff = Math.round((to - from) / 3600000);
  if (diff <= 0) return 0;
  return diff;
}

module.exports = {
  MAAS_RAPOR_SAATI,
  MAAS_RAPOR_DAKIKA_PENCERE,
  turkeyNowParts,
  istanbulGunKey,
  istanbulHourKey,
  parseIstanbulHourKey,
  kacirilanSaatSayisi,
  maasGunKey,
  maasSaatiGeldiMi,
  maasCronPenceresiMi,
  gunKeyEkle,
  istanbulGunBaslangicUnix,
};
