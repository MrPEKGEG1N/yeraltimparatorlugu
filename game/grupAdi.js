/** Grup adından gereksiz "Mafya Grubu / Gurubu" sonekini kaldırır. */
const GRUP_SONEK_RE = /\s+Mafya+a*\s+G[uü]?rubu$/i;

function temizGrupAdi(grup) {
  if (!grup) return grup;
  const s = String(grup).trim();
  if (s === "Bağımsız Reis") return s;
  return s.replace(GRUP_SONEK_RE, "").trim();
}

module.exports = { temizGrupAdi, GRUP_SONEK_RE };
