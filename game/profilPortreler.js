const KADIN_PORTRELER = Array.from({ length: 11 }, (_, i) =>
  `kadin-${String(i + 1).padStart(2, "0")}`
);
const ERKEK_PORTRELER = Array.from({ length: 22 }, (_, i) =>
  `erkek-${String(i + 1).padStart(2, "0")}`
);
const PROFIL_PORTRELER = [...KADIN_PORTRELER, ...ERKEK_PORTRELER];

function normalizeProfilResmi(key) {
  const k = String(key || "").trim();
  const eski = k.match(/^portre-(\d{2})$/);
  if (eski) return `kadin-${eski[1]}`;
  return k;
}

function rastgeleProfilResmi() {
  const i = Math.floor(Math.random() * PROFIL_PORTRELER.length);
  return PROFIL_PORTRELER[i];
}

function gecerliProfilResmi(key) {
  const k = normalizeProfilResmi(key);
  return PROFIL_PORTRELER.includes(k) ? k : null;
}

module.exports = {
  KADIN_PORTRELER,
  ERKEK_PORTRELER,
  PROFIL_PORTRELER,
  normalizeProfilResmi,
  rastgeleProfilResmi,
  gecerliProfilResmi,
};
