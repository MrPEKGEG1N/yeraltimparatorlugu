const { run, get, all } = require("../db/database");

const LIMAN_ADLARI = {
  istanbul: "İstanbul Limanı",
  izmir: "İzmir Limanı",
  hatay: "Hatay Limanı",
};

const MAKAM_ADLARI = {
  sozunu_gecir: "Sözünü Geçir",
  sadakat_yemini: "Sadakat Yemini",
};

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

async function gazeteEkle(db, mesaj, ts) {
  await ensureGazeteTable(db);
  const damga = zamanDamgasi(ts);
  const temiz = String(mesaj || "").slice(0, 380);
  if (!temiz) return;
  const full = `${damga} — ${temiz}`;
  await run(db, `INSERT INTO sehir_gazete (mesaj, created_at) VALUES (?, ?)`, [
    full,
    ts || Math.floor(Date.now() / 1000),
  ]);
}

async function gazeteyiGetir(db, limit = 30) {
  await ensureGazeteTable(db);
  return all(
    db,
    `SELECT mesaj, created_at FROM sehir_gazete ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

async function getSehirBanner(db) {
  const { getLimanDurumu, getBabaDurumu } = require("./worldService");
  const limanlar = await getLimanDurumu(db);
  const baba = await getBabaDurumu(db);
  const owners = new Set();
  limanlar.forEach((l) => {
    if (l.sahipUserId) owners.add(l.sahipUserId);
  });
  Object.values(baba.makamlar || {}).forEach((m) => {
    if (m.sahipUserId) owners.add(m.sahipUserId);
  });

  if (owners.size !== 1) {
    return { tip: "belirsiz", reisAdi: null };
  }
  const uid = [...owners][0];
  const u = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [uid]);
  return { tip: "tek", reisAdi: u?.reis_adi || "Bilinmeyen" };
}

async function gunlukHaberUret(db) {
  await ensureGazeteTable(db);
  const now = Math.floor(Date.now() / 1000);
  const son24 = now - 86400;
  const son = await get(
    db,
    `SELECT id FROM sehir_gazete WHERE mesaj LIKE '%Hükmü Sürüyor%' AND created_at > ? LIMIT 1`,
    [son24]
  );
  if (son) return;

  const kara = await get(
    db,
    `SELECT u.reis_adi FROM players p JOIN users u ON u.id = p.user_id WHERE p.kara_listede = 1 LIMIT 1`
  );
  if (kara?.reis_adi) {
    await gazeteEkle(db, `Sokakların Tek Hakimi: ${kara.reis_adi} Hükmü Sürüyor!`);
  }
}

async function limanHaberEkle(db, limanId, kazananId, kaybedenId) {
  const limanAd = LIMAN_ADLARI[limanId] || limanId;
  const kazanan = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [kazananId]);
  if (!kaybedenId) {
    await gazeteEkle(db, `${kazanan.reis_adi}, ${limanAd} mekanını ele geçirdi.`);
    return;
  }
  const kaybeden = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [kaybedenId]);
  await gazeteEkle(
    db,
    `${kazanan.reis_adi}, ${limanAd} mekanını ${kaybeden.reis_adi}'den aldı.`
  );
}

async function makamHaberEkle(db, makam, kazananId, kaybedenId) {
  const makamAd = MAKAM_ADLARI[makam] || makam;
  const kazanan = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [kazananId]);
  if (!kaybedenId) {
    await gazeteEkle(db, `${kazanan.reis_adi}, ${makamAd} makamını ele geçirdi.`);
    return;
  }
  const kaybeden = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [kaybedenId]);
  await gazeteEkle(
    db,
    `${kazanan.reis_adi}, ${makamAd} makamını ${kaybeden.reis_adi}'den aldı.`
  );
}

async function mafyaSavasIlanHaber(db, saldiranAd, hedefAd) {
  await gazeteEkle(
    db,
    `[${saldiranAd}], [${hedefAd}]'ye karşı savaş açtı. Eski defterler açılıyor, kimin ayakta kalacağını zaman gösterecek.`
  );
}

async function mafyaSavasSonucHaber(db, kazananAd, kaybedenAd, saldiranAd) {
  const kazananSaldiran = kazananAd === saldiranAd;
  if (kazananSaldiran) {
    await gazeteEkle(
      db,
      `[${kazananAd}], [${kaybedenAd}]'a sahayı dar etti. Rakibini dize getiren [${kazananAd}], sokaklardaki ağırlığını bir kez daha kanıtladı.`
    );
  } else {
    await gazeteEkle(
      db,
      `[${saldiranAd}], gölgesi kendinden büyük işlere kalkışmanın bedelini ödedi. [${kazananAd}], rakibine geçit vermedi.`
    );
  }
}

function haberMetniTemizle(mesaj) {
  const s = String(mesaj || "");
  const idx = s.indexOf(" — ");
  return idx >= 0 ? s.slice(idx + 3) : s;
}

async function userIdByReisAdi(db, ad) {
  if (!ad) return null;
  const row = await get(db, `SELECT id FROM users WHERE LOWER(reis_adi) = LOWER(?)`, [
    String(ad).trim(),
  ]);
  return row?.id || null;
}

async function oyuncuLinkleriTopla(db, metinler) {
  const isimler = new Set();
  for (const metin of metinler) {
    const s = String(metin || "");
    for (const m of s.matchAll(/\[([^\]]+)\]/g)) {
      const ad = m[1]?.trim();
      if (ad) isimler.add(ad);
    }
    const aldi = s.match(/^(.+?),\s*.+?\s+mekanını\s+(.+?)'den aldı\.?$/);
    if (aldi) {
      isimler.add(aldi[1].trim());
      isimler.add(aldi[2].trim());
    }
    const ele = s.match(/^(.+?),\s*.+?\s+mekanını ele geçirdi\.?$/);
    if (ele) isimler.add(ele[1].trim());
    const makamAldi = s.match(/^(.+?),\s*.+?\s+makamını\s+(.+?)'den aldı\.?$/);
    if (makamAldi) {
      isimler.add(makamAldi[1].trim());
      isimler.add(makamAldi[2].trim());
    }
    const makamEle = s.match(/^(.+?),\s*.+?\s+makamını ele geçirdi\.?$/);
    if (makamEle) isimler.add(makamEle[1].trim());
    const virgul = s.match(/^([^,]{2,40}),\s/);
    if (virgul) isimler.add(virgul[1].trim());
  }
  const linkler = [];
  for (const isim of isimler) {
    const userId = await userIdByReisAdi(db, isim);
    if (userId) linkler.push({ isim, userId });
  }
  return linkler;
}

function gazeteTarihUst() {
  const now = new Date();
  const tarih = now.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const gun = now.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
  });
  const saat = now.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${tarih.toUpperCase()}, ${gun.toUpperCase()}, ${saat}`;
}

function isminHali(ad) {
  if (!ad) return "";
  return /[aeıioöuüAEIİOÖUÜ]$/.test(String(ad).trim()) ? `${ad}'nın` : `${ad}'ın`;
}

const LIMAN_MANSET_SABLONLARI = [
  (ad) => `Kasalar Taşacak: Liman Bölgesi ${isminHali(ad)} Yönetiminde, Gelirler Rekor Kırıyor.`,
  (ad) => `Rakiplerine Fırsat Yok: ${ad} Limanı Tahkim Etti, Racon Artık Liman Rıhtımlarında Kesiliyor.`,
  (ad) => `Denizler Artık Onun: ${isminHali(ad)} Limandaki Hükmü Şehri Besliyor.`,
];

function limanMansetOzet(ad, userId) {
  if (!ad) {
    return "Liman hatlarında tansiyon yükseliyor. Kontrolü ele geçiren isim, kasaları doldurmaya devam ediyor.";
  }
  const idx = ((userId || 0) + Math.floor(Date.now() / 86400000)) % LIMAN_MANSET_SABLONLARI.length;
  return LIMAN_MANSET_SABLONLARI[idx](ad);
}

async function getAktifHukumranlik(db, userId) {
  const { ensureSaygiTables } = require("./saygiDuvariService");
  await ensureSaygiTables(db);
  return get(
    db,
    `SELECT h.baslangic, h.onceki_user_id, u.reis_adi AS onceki_adi
     FROM sehir_hukumranlik h
     LEFT JOIN users u ON u.id = h.onceki_user_id
     WHERE h.user_id = ? AND h.bitis IS NULL
     ORDER BY h.id DESC LIMIT 1`,
    [userId]
  );
}

async function hukumdarMansetOlustur(db, hukumdar, hukumdarUserId) {
  if (!hukumdar || !hukumdarUserId) {
    return {
      baslik: "ŞEHİRDE GÜÇ BOŞLUĞU VAR!",
      baslik2: null,
      ozet: "Henüz tek hükümdar yok. Limanlar ve makamlar boş veya parçalı — fırsat kapıda, ama kan da akabilir.",
      tip: "belirsiz",
      yeniDevir: false,
    };
  }

  const hukum = await getAktifHukumranlik(db, hukumdarUserId);
  const now = Math.floor(Date.now() / 1000);
  const yeniDevir =
    hukum?.onceki_user_id &&
    hukum?.onceki_adi &&
    now - (hukum.baslangic || 0) < 86400 * 3;

  if (yeniDevir) {
    return {
      baslik: `Taht El Değiştirdi: ${hukum.onceki_adi}'in Saltanatı Sona Erdi, Yeni Devir ${hukumdar} ile Başlıyor!`,
      baslik2: `Şehrin Sokaklarında Yeni Bir İsim: ${hukumdar} Zirveye Yerleşti!`,
      ozet: null,
      tip: "devir",
      yeniDevir: true,
      eskiHakim: hukum.onceki_adi,
      eskiHakimUserId: hukum.onceki_user_id,
    };
  }

  return {
    baslik: `Sokakların Tek Hakimi: ${hukumdar} Hükmü Sürüyor!`,
    baslik2: null,
    ozet: null,
    tip: "hukumdar",
    yeniDevir: false,
  };
}

async function hukumdarDegisimHaberleri(db, eskiAd, yeniAd) {
  if (!eskiAd || !yeniAd || eskiAd === yeniAd) return;
  await gazeteEkle(
    db,
    `Taht El Değiştirdi: ${eskiAd}'in Saltanatı Sona Erdi, Yeni Devir ${yeniAd} ile Başlıyor!`
  );
  await gazeteEkle(db, `Şehrin Sokaklarında Yeni Bir İsim: ${yeniAd} Zirveye Yerleşti!`);
}

async function getSonHaberId(db) {
  await ensureGazeteTable(db);
  const row = await get(db, `SELECT id FROM sehir_gazete ORDER BY id DESC LIMIT 1`);
  return row?.id || 0;
}

async function gazeteOkunduIsaretle(db, userId) {
  const sonId = await getSonHaberId(db);
  await run(db, `UPDATE players SET gazete_okundu_id = ? WHERE user_id = ?`, [sonId, userId]);
  return sonId;
}

async function yeniGazeteVarMi(db, userId) {
  const sonId = await getSonHaberId(db);
  const row = await get(db, `SELECT gazete_okundu_id FROM players WHERE user_id = ?`, [userId]);
  return sonId > (row?.gazete_okundu_id || 0);
}

async function getGazetePanel(db, userId) {
  await ensureGazeteTable(db);
  const { karaListeSenkronize } = require("./karaListeService");
  await karaListeSenkronize(db);
  await gunlukHaberUret(db);

  const { getLimanDurumu } = require("./worldService");
  const { son24SaatSayginlik } = require("./statService");
  const { haberleriGetir } = require("./medyaService");

  const haberler = await all(
    db,
    `SELECT id, mesaj, created_at FROM sehir_gazete ORDER BY created_at DESC LIMIT 30`
  );
  const sonHaberId = haberler[0]?.id || 0;
  const yeniHaber = await yeniGazeteVarMi(db, userId);
  const tarihUst = gazeteTarihUst();

  const sonDakika = haberler.slice(0, 6).map((h) => haberMetniTemizle(h.mesaj));

  const kara = await get(
    db,
    `SELECT u.id AS user_id, u.reis_adi FROM players p JOIN users u ON u.id = p.user_id WHERE p.kara_listede = 1 LIMIT 1`
  );
  const hukumdar = kara?.reis_adi || null;
  const hukumdarUserId = kara?.user_id || null;

  const limanHaber = haberler.find((h) => /liman|Liman|İstanbul|İzmir|Hatay/.test(h.mesaj));

  const mansetTpl = await hukumdarMansetOlustur(db, hukumdar, hukumdarUserId);
  const limanlar = await getLimanDurumu(db);
  const limanDurumu = limanlar.map((l) => ({
    limanId: l.limanId,
    limanAd: LIMAN_ADLARI[l.limanId] || l.limanId,
    sahipAdi: l.sahipAdi || null,
    userId: l.sahipUserId || null,
  }));

  const istanbulLiman = limanDurumu.find((l) => l.limanId === "istanbul") || limanDurumu[0];
  const limanSahibi = istanbulLiman?.sahipAdi || hukumdar;
  const limanSahipId = istanbulLiman?.userId || hukumdarUserId;

  let mansetOzet = limanMansetOzet(limanSahibi, limanSahipId);
  if (mansetTpl.yeniDevir && mansetTpl.eskiHakim) {
    mansetOzet =
      `${mansetTpl.eskiHakim} dönemi kapandı. ${hukumdar} liman ve makamlarda söz sahibi olmaya başladı. ` +
      limanMansetOzet(limanSahibi, limanSahipId);
  }

  const sayginlikHam = await son24SaatSayginlik(db, 5);
  const sayginlikLiderleri = sayginlikHam.map((r) => ({
    userId: r.user_id,
    isim: r.isim,
    miktar: Math.abs(r.toplam || 0),
    fallback: !!r.fallback,
  }));

  const hakimiyetSatirlari = [];

  if (hukumdar && hukumdarUserId) {
    hakimiyetSatirlari.push({
      tip: "hukumdar",
      metin: `${hukumdar} şehre hükmediyor. Üç liman, Sözünü Geçir ve Sadakat Yemini makamları onun elinde.`,
      oyuncuAdi: hukumdar,
      userId: hukumdarUserId,
    });
  } else {
    hakimiyetSatirlari.push({
      tip: "bos",
      metin: "Şehirde tek hükümdar yok. Limanlar ve makamlar için mücadele sürüyor.",
      oyuncuAdi: null,
      userId: null,
    });
  }

  limanDurumu.forEach((l) => {
    if (l.sahipAdi && l.userId) {
      hakimiyetSatirlari.push({
        tip: "liman",
        metin: `${l.limanAd} ${l.sahipAdi} kontrolünde.`,
        oyuncuAdi: l.sahipAdi,
        userId: l.userId,
        limanAd: l.limanAd,
      });
    } else {
      hakimiyetSatirlari.push({
        tip: "liman_bos",
        metin: `${l.limanAd} şu an sahipsiz.`,
        oyuncuAdi: null,
        userId: null,
        limanAd: l.limanAd,
      });
    }
  });

  if (limanHaber) {
    const temiz = haberMetniTemizle(limanHaber.mesaj);
    const aldiMatch = temiz.match(/^(.+?),\s*(.+?)\s+mekanını\s+(.+?)'den aldı\.?$/);
    const eleMatch = temiz.match(/^(.+?),\s*(.+?)\s+mekanını ele geçirdi\.?$/);
    if (aldiMatch) {
      const kazananId = await userIdByReisAdi(db, aldiMatch[1]);
      const kaybedenId = await userIdByReisAdi(db, aldiMatch[3]);
      hakimiyetSatirlari.push({
        tip: "degisim",
        metin: "Bölgede dengeler değişti.",
        kazananAdi: aldiMatch[1],
        kazananUserId: kazananId,
        kaybedenAdi: aldiMatch[3],
        kaybedenUserId: kaybedenId,
      });
    } else if (eleMatch) {
      const kazananId = await userIdByReisAdi(db, eleMatch[1]);
      hakimiyetSatirlari.push({
        tip: "degisim",
        metin: "Yeni bir güç limanda boy gösterdi.",
        kazananAdi: eleMatch[1],
        kazananUserId: kazananId,
        kaybedenAdi: null,
        kaybedenUserId: null,
      });
    }
  }

  let sehirHakimiyeti = hukumdar
    ? `Şehre hükmeden: ${hukumdar}.`
    : "Şehirde tek hükümdar yok.";
  limanDurumu.forEach((l) => {
    if (l.sahipAdi) sehirHakimiyeti += ` ${l.limanAd}: ${l.sahipAdi}.`;
    else sehirHakimiyeti += ` ${l.limanAd}: sahipsiz.`;
  });

  const medyaHaberler = await haberleriGetir(db);
  const yeraltiManse = medyaHaberler.slice(0, 5).map((h) => ({
    userId: h.user_id,
    yazar: h.reis_adi,
    metin: h.haber,
  }));

  const efsaneler24 = sayginlikLiderleri.slice(0, 3);

  const oyuncuLinkleri = await oyuncuLinkleriTopla(db, [
    ...sonDakika,
    mansetTpl.baslik,
    mansetTpl.baslik2,
    mansetOzet,
    sehirHakimiyeti,
    ...yeraltiManse.map((h) => h.metin),
    ...hakimiyetSatirlari.map((h) => h.metin),
  ]);

  return {
    tarihUst,
    sonDakika,
    manset: {
      baslik: mansetTpl.baslik,
      baslik2: mansetTpl.baslik2,
      ozet: mansetOzet,
      tip: mansetTpl.tip,
      yeniDevir: mansetTpl.yeniDevir,
      hukumdar,
      hukumdarUserId,
      eskiHakim: mansetTpl.eskiHakim || null,
      eskiHakimUserId: mansetTpl.eskiHakimUserId || null,
    },
    sayginlikLiderleri,
    limanDurumu,
    hakimiyetSatirlari,
    sehirHakimiyeti,
    yeraltiManse,
    efsaneler24,
    oyuncuLinkleri,
    arsiv: haberler.map((h) => ({ id: h.id, mesaj: h.mesaj, created_at: h.created_at })),
    sonHaberId,
    yeniHaber,
  };
}

module.exports = {
  ensureGazeteTable,
  gazeteEkle,
  gazeteyiGetir,
  getSehirBanner,
  gunlukHaberUret,
  limanHaberEkle,
  makamHaberEkle,
  mafyaSavasIlanHaber,
  mafyaSavasSonucHaber,
  hukumdarDegisimHaberleri,
  zamanDamgasi,
  getGazetePanel,
  gazeteOkunduIsaretle,
  yeniGazeteVarMi,
  getSonHaberId,
};
