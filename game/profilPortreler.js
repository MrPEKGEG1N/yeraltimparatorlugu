const KADIN_PORTRELER = Array.from({ length: 11 }, (_, i) =>
  `kadin-${String(i + 1).padStart(2, "0")}`
);
const ERKEK_PORTRELER = Array.from({ length: 22 }, (_, i) =>
  `erkek-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_ELMAS_PORTRELER = Array.from({ length: 12 }, (_, i) =>
  `vip-erkek-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_MAFYA_PORTRELER = Array.from({ length: 3 }, (_, i) =>
  `vip-erkek-mafya-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_KRAL_PORTRELER = Array.from({ length: 4 }, (_, i) =>
  `vip-erkek-kral-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_IHTISAM_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-erkek-ihtisam-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_KARANLIK_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-erkek-karanlik-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_ASLAN_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-erkek-aslan-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_OPERASYON_PORTRELER = Array.from({ length: 3 }, (_, i) =>
  `vip-erkek-operasyon-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_VIP_PORTRELER = Array.from({ length: 9 }, (_, i) =>
  `vip-erkek-vip-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_ELMAS_PORTRELER = Array.from({ length: 12 }, (_, i) =>
  `vip-kadin-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_MAFYA_PORTRELER = Array.from({ length: 3 }, (_, i) =>
  `vip-kadin-mafya-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_KRAL_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-kadin-kral-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_IHTISAM_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-kadin-ihtisam-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_KARANLIK_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-kadin-karanlik-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_ASLAN_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-kadin-aslan-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_OPERASYON_PORTRELER = Array.from({ length: 2 }, (_, i) =>
  `vip-kadin-operasyon-${String(i + 1).padStart(2, "0")}`
);
const VIP_KADIN_VIP_PORTRELER = Array.from({ length: 10 }, (_, i) =>
  `vip-kadin-vip-${String(i + 1).padStart(2, "0")}`
);
const VIP_ERKEK_PORTRELER = [
  ...VIP_ERKEK_ELMAS_PORTRELER,
  ...VIP_ERKEK_MAFYA_PORTRELER,
  ...VIP_ERKEK_KRAL_PORTRELER,
  ...VIP_ERKEK_IHTISAM_PORTRELER,
  ...VIP_ERKEK_KARANLIK_PORTRELER,
  ...VIP_ERKEK_ASLAN_PORTRELER,
  ...VIP_ERKEK_OPERASYON_PORTRELER,
  ...VIP_ERKEK_VIP_PORTRELER,
];
const VIP_KADIN_PORTRELER = [
  ...VIP_KADIN_ELMAS_PORTRELER,
  ...VIP_KADIN_MAFYA_PORTRELER,
  ...VIP_KADIN_KRAL_PORTRELER,
  ...VIP_KADIN_IHTISAM_PORTRELER,
  ...VIP_KADIN_KARANLIK_PORTRELER,
  ...VIP_KADIN_ASLAN_PORTRELER,
  ...VIP_KADIN_OPERASYON_PORTRELER,
  ...VIP_KADIN_VIP_PORTRELER,
];
/** @deprecated Eski anahtar uyumu — VIP_ERKEK_PORTRELER kullan */
const PREMIUM_PORTRELER = VIP_ERKEK_PORTRELER;
const PROFIL_PORTRELER = [
  ...KADIN_PORTRELER,
  ...ERKEK_PORTRELER,
  ...VIP_ERKEK_PORTRELER,
  ...VIP_KADIN_PORTRELER,
];

function normalizeProfilResmi(key) {
  const k = String(key || "").trim();
  const eski = k.match(/^portre-(\d{2})$/);
  if (eski) return `kadin-${eski[1]}`;
  const prem = k.match(/^premium-(\d{2})$/);
  if (prem) return `vip-erkek-${prem[1]}`;
  return k;
}

function rastgeleProfilResmi() {
  const klasik = [...KADIN_PORTRELER, ...ERKEK_PORTRELER];
  const i = Math.floor(Math.random() * klasik.length);
  return klasik[i];
}

function gecerliProfilResmi(key) {
  const k = normalizeProfilResmi(key);
  return PROFIL_PORTRELER.includes(k) ? k : null;
}

module.exports = {
  KADIN_PORTRELER,
  ERKEK_PORTRELER,
  VIP_ERKEK_ELMAS_PORTRELER,
  VIP_ERKEK_MAFYA_PORTRELER,
  VIP_ERKEK_KRAL_PORTRELER,
  VIP_ERKEK_IHTISAM_PORTRELER,
  VIP_ERKEK_KARANLIK_PORTRELER,
  VIP_ERKEK_ASLAN_PORTRELER,
  VIP_ERKEK_OPERASYON_PORTRELER,
  VIP_ERKEK_VIP_PORTRELER,
  VIP_KADIN_ELMAS_PORTRELER,
  VIP_KADIN_MAFYA_PORTRELER,
  VIP_KADIN_KRAL_PORTRELER,
  VIP_KADIN_IHTISAM_PORTRELER,
  VIP_KADIN_KARANLIK_PORTRELER,
  VIP_KADIN_ASLAN_PORTRELER,
  VIP_KADIN_OPERASYON_PORTRELER,
  VIP_KADIN_VIP_PORTRELER,
  VIP_ERKEK_PORTRELER,
  VIP_KADIN_PORTRELER,
  PREMIUM_PORTRELER,
  PROFIL_PORTRELER,
  normalizeProfilResmi,
  rastgeleProfilResmi,
  gecerliProfilResmi,
};
