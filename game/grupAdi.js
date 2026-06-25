/** Grup adından gereksiz "Mafya Grubu / Gurubu" sonekini kaldırır. */
const GRUP_SONEK_RE = /\s+Mafya+a*\s+G[uü]?rubu$/i;
const GRUP_YER_TUTUCU = new Set(["Sokakların Hakimi"]);

function temizGrupAdi(grup) {
  if (!grup) return "";
  const s = String(grup).trim();
  if (!s || GRUP_YER_TUTUCU.has(s)) return "";
  if (s === "Bağımsız Reis") return s;
  return s.replace(GRUP_SONEK_RE, "").trim();
}

function gercekGrupAdi(grup, grupId) {
  if (!grupId) return "";
  return temizGrupAdi(grup);
}

module.exports = { temizGrupAdi, gercekGrupAdi, GRUP_SONEK_RE, GRUP_YER_TUTUCU };
