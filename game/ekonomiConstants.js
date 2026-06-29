/**
 * Oyun geneli ekonomi ölçeği — meslek maliyetleri buna göre ayarlanır.
 * Referans: başlangıç kasa 10.000 TL, giriş meslek ~1.500/gün, liman 100.000/saat (endgame).
 * ZORLUK_ORANI 0.75 → maliyetler ~%33 daha yüksek (kolay ilerleme yok).
 */

const ZORLUK_ORANI = 0.75;
const MESLEK_MALIYET_CARPAN = Math.round((1 / ZORLUK_ORANI) * 100) / 100;

const BASLANGIC_KASA = 10_000;
const REFERANS_GUNLUK_GELIR = 1_500;
const ORTA_GUNLUK_GELIR = 2_500;

/** Antrenman Merkezi — taban 100.000 TL; stat yükseldikçe maliyet artar (kolay ilerleme yok) */
const ANTRENMAN_MIN_MALIYET = 100_000;
const ANTRENMAN_BAZ_MALIYET = 90_000;
const ANTRENMAN_STAT_CARPAN = 1_250;
const ANTRENMAN_YUKSEK_ESIK = 50;
const ANTRENMAN_YUKSEK_CARPAN = 2_500;
const GUNLUK_ANTRENMAN_LIMIT = 4;

module.exports = {
  ZORLUK_ORANI,
  MESLEK_MALIYET_CARPAN,
  BASLANGIC_KASA,
  REFERANS_GUNLUK_GELIR,
  ORTA_GUNLUK_GELIR,
  ANTRENMAN_MIN_MALIYET,
  ANTRENMAN_BAZ_MALIYET,
  ANTRENMAN_STAT_CARPAN,
  ANTRENMAN_YUKSEK_ESIK,
  ANTRENMAN_YUKSEK_CARPAN,
  GUNLUK_ANTRENMAN_LIMIT,
};
