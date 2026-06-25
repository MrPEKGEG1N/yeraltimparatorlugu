/** Dünya sabitleri — döngüsel require önlemek için ayrı modül */
const LIMAN_IDS = ["istanbul", "izmir", "hatay"];
const BABA_MAKAMLAR = ["sozunu_gecir", "sadakat_yemini"];
const LIMAN_SAATLIK = 100_000;
/** Üç liman tek oyuncuda: 3×100.000 + 200.000 = 500.000 TL/saat */
const LIMAN_UC_BONUS = 200_000;

function limanSaatlikToplam(limanSayisi) {
  const n = Math.min(LIMAN_IDS.length, Math.max(0, Number(limanSayisi) || 0));
  let toplam = n * LIMAN_SAATLIK;
  if (n >= LIMAN_IDS.length) toplam += LIMAN_UC_BONUS;
  return toplam;
}

module.exports = {
  LIMAN_IDS,
  BABA_MAKAMLAR,
  LIMAN_SAATLIK,
  LIMAN_UC_BONUS,
  limanSaatlikToplam,
};
