const { run, get, all } = require("../db/database");
const {
  SIRKET_TURLERI,
  EGITIM_MALIYET,
  EGITIM_KAZANC,
  EGITIM_SLOT_BAZ,
  MAX_GUNLUK_TELAFI,
  MAX_UPGRADE_SEVIYE,
  MAX_GUNLUK_MAAS,
  MIN_GUNLUK_MAAS,
  UPGRADE_TIPLERI,
  REKLAM_SEVIYELERI,
  turBul,
  pozisyonBul,
  malzemeBul,
  upgradeMaliyet,
  maxCalisanHesapla,
  depoKapasiteHesapla,
  personelOdasiBonuslari,
  birimBasinaMalzemeMaliyet,
  turMalzemeListesi,
} = require("./sirketCatalog");
const {
  istanbulGunKey,
  maasGunKey,
  maasSaatiGeldiMi,
  MAAS_RAPOR_SAATI,
  yetenekleriGetir,
  yetenekleriKaydet,
  yetenekUygunMu,
} = require("./meslekService");
const {
  isIlaniHaberEkle,
  iseAlimAcikMi,
} = require("./isIlaniGazete");
const { maasAntrenmanPuaniEkle } = require("./yetenekService");

function gunFarki(baslangic, bitis) {
  const a = new Date(baslangic + "T12:00:00");
  const b = new Date(bitis + "T12:00:00");
  const fark = Math.floor((b - a) / 86400000);
  return Math.max(1, fark);
}

function sanitizeAciklama(text) {
  return String(text || "")
    .trim()
    .slice(0, 240)
    .replace(/<[^>]*>/g, "");
}

function sanitizeIsim(text) {
  return String(text || "")
    .trim()
    .slice(0, 48)
    .replace(/<[^>]*>/g, "");
}

async function ensureSirketTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_sirketleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sahip_user_id INTEGER NOT NULL UNIQUE,
      tur_id TEXT NOT NULL,
      isim TEXT NOT NULL,
      aciklama TEXT NOT NULL DEFAULT '',
      kasa INTEGER NOT NULL DEFAULT 0,
      ise_alim_acik INTEGER NOT NULL DEFAULT 0,
      son_gelir_gunu TEXT,
      kapasite_seviye INTEGER NOT NULL DEFAULT 0,
      depo_seviye INTEGER NOT NULL DEFAULT 0,
      personel_odasi_seviye INTEGER NOT NULL DEFAULT 0,
      reklam_seviye INTEGER NOT NULL DEFAULT 0,
      fiyat_carpani REAL NOT NULL DEFAULT 1.0,
      yildiz INTEGER NOT NULL DEFAULT 0,
      populerlik INTEGER NOT NULL DEFAULT 0,
      son_egitim_gunu TEXT,
      egitim_slot_kullanim INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (sahip_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  const cols = [
    ["aciklama", "TEXT NOT NULL DEFAULT ''"],
    ["ise_alim_acik", "INTEGER NOT NULL DEFAULT 0"],
    ["son_gelir_gunu", "TEXT"],
    ["kapasite_seviye", "INTEGER NOT NULL DEFAULT 0"],
    ["depo_seviye", "INTEGER NOT NULL DEFAULT 0"],
    ["personel_odasi_seviye", "INTEGER NOT NULL DEFAULT 0"],
    ["reklam_seviye", "INTEGER NOT NULL DEFAULT 0"],
    ["fiyat_carpani", "REAL NOT NULL DEFAULT 1.0"],
    ["yildiz", "INTEGER NOT NULL DEFAULT 0"],
    ["populerlik", "INTEGER NOT NULL DEFAULT 0"],
    ["son_egitim_gunu", "TEXT"],
    ["egitim_slot_kullanim", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of cols) {
    try {
      await run(db, `ALTER TABLE oyuncu_sirketleri ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sirket_calisanlari (
      user_id INTEGER PRIMARY KEY,
      sirket_id INTEGER NOT NULL,
      pozisyon_id TEXT NOT NULL,
      gunluk_maas INTEGER NOT NULL DEFAULT 2000,
      ise_baslama INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      son_maas_gunu TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sirket_id) REFERENCES oyuncu_sirketleri(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sirket_basvurulari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sirket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      pozisyon_id TEXT NOT NULL,
      basvuru_zamani INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(sirket_id, user_id),
      FOREIGN KEY (sirket_id) REFERENCES oyuncu_sirketleri(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sirket_stok (
      sirket_id INTEGER NOT NULL,
      malzeme_id TEXT NOT NULL,
      miktar REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (sirket_id, malzeme_id),
      FOREIGN KEY (sirket_id) REFERENCES oyuncu_sirketleri(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sirket_gunluk_rapor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sirket_id INTEGER NOT NULL,
      gun TEXT NOT NULL,
      satis_adet INTEGER NOT NULL DEFAULT 0,
      brut_gelir INTEGER NOT NULL DEFAULT 0,
      malzeme_maliyet INTEGER NOT NULL DEFAULT 0,
      maas_gider INTEGER NOT NULL DEFAULT 0,
      reklam_gider INTEGER NOT NULL DEFAULT 0,
      net_kar INTEGER NOT NULL DEFAULT 0,
      notlar TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (sirket_id) REFERENCES oyuncu_sirketleri(id) ON DELETE CASCADE
    )`
  );

  try {
    await run(db, `ALTER TABLE sirket_basvurulari ADD COLUMN basvuru_zamani INTEGER`);
  } catch (_) {}
  try {
    await run(db, `ALTER TABLE sirket_basvurulari ADD COLUMN created_at INTEGER`);
  } catch (_) {}
  try {
    await run(
      db,
      `UPDATE sirket_basvurulari SET basvuru_zamani = created_at WHERE basvuru_zamani IS NULL AND created_at IS NOT NULL`
    );
  } catch (_) {}
  try {
    await run(
      db,
      `UPDATE sirket_basvurulari SET basvuru_zamani = strftime('%s','now') WHERE basvuru_zamani IS NULL`
    );
  } catch (_) {}
  try {
    await run(
      db,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_sirket_basvuru_user ON sirket_basvurulari(sirket_id, user_id)`
    );
  } catch (_) {}

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sirket_istifa_bildirimleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sirket_id INTEGER NOT NULL,
      sahip_user_id INTEGER NOT NULL,
      calisan_user_id INTEGER NOT NULL,
      reis_adi TEXT NOT NULL DEFAULT '',
      unvan TEXT NOT NULL DEFAULT '',
      istifa_zamani INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      okundu INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (sirket_id) REFERENCES oyuncu_sirketleri(id) ON DELETE CASCADE,
      FOREIGN KEY (sahip_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (calisan_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sirket_zam_talepleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sirket_id INTEGER NOT NULL,
      sahip_user_id INTEGER NOT NULL,
      calisan_user_id INTEGER NOT NULL,
      mevcut_maas INTEGER NOT NULL,
      talep_maas INTEGER NOT NULL,
      talep_zamani INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      okundu INTEGER NOT NULL DEFAULT 0,
      UNIQUE(calisan_user_id),
      FOREIGN KEY (sirket_id) REFERENCES oyuncu_sirketleri(id) ON DELETE CASCADE,
      FOREIGN KEY (sahip_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (calisan_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
}

async function sirketGetir(db, sirketId) {
  return get(db, `SELECT * FROM oyuncu_sirketleri WHERE id = ?`, [sirketId]);
}

async function sahipSirketGetir(db, userId) {
  return get(db, `SELECT * FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [userId]);
}

async function stokHaritasi(db, sirketId) {
  const rows = await all(db, `SELECT malzeme_id, miktar FROM sirket_stok WHERE sirket_id = ?`, [
    sirketId,
  ]);
  const map = {};
  for (const r of rows || []) map[r.malzeme_id] = r.miktar;
  return map;
}

async function stokToplam(db, sirketId) {
  const row = await get(
    db,
    `SELECT COALESCE(SUM(miktar), 0) AS toplam FROM sirket_stok WHERE sirket_id = ?`,
    [sirketId]
  );
  return row?.toplam || 0;
}

async function stokGuncelle(db, sirketId, malzemeId, delta) {
  const mevcut = await get(
    db,
    `SELECT miktar FROM sirket_stok WHERE sirket_id = ? AND malzeme_id = ?`,
    [sirketId, malzemeId]
  );
  const yeni = Math.max(0, (mevcut?.miktar || 0) + delta);
  if (mevcut) {
    await run(
      db,
      `UPDATE sirket_stok SET miktar = ? WHERE sirket_id = ? AND malzeme_id = ?`,
      [yeni, sirketId, malzemeId]
    );
  } else if (yeni > 0) {
    await run(
      db,
      `INSERT INTO sirket_stok (sirket_id, malzeme_id, miktar) VALUES (?, ?, ?)`,
      [sirketId, malzemeId, yeni]
    );
  }
  return yeni;
}

async function calisanlariGetir(db, sirketId) {
  const rows = await all(
    db,
    `SELECT c.*, u.username AS reis_adi
     FROM sirket_calisanlari c
     JOIN users u ON u.id = c.user_id
     WHERE c.sirket_id = ?
     ORDER BY c.ise_baslama ASC`,
    [sirketId]
  );
  return rows || [];
}

function verimlilikHesapla(yetenekler, pozisyon) {
  if (!pozisyon || !pozisyon.gereksinim) return 70;
  let toplamOran = 0;
  let sayac = 0;
  for (const [key, min] of Object.entries(pozisyon.gereksinim)) {
    const mevcut = yetenekler[key] ?? 0;
    const oran = min > 0 ? mevcut / min : 1;
    toplamOran += Math.min(1.6, Math.max(0.4, oran));
    sayac++;
  }
  const ort = sayac ? toplamOran / sayac : 1;
  return Math.min(150, Math.max(50, Math.floor(ort * 100)));
}

async function calisanDetay(db, row, tur) {
  const poz = pozisyonBul(tur.id, row.pozisyon_id);
  const yetenekler = await yetenekleriGetir(db, row.user_id);
  const verimlilik = verimlilikHesapla(yetenekler, poz);
  return {
    userId: row.user_id,
    reisAdi: row.reis_adi,
    pozisyonId: row.pozisyon_id,
    unvan: poz ? poz.unvan : row.pozisyon_id,
    gunlukMaas: row.gunluk_maas,
    verimlilik,
    yetenekKazanc: poz ? poz.yetenekKazanc : {},
    ozel: poz ? poz.ozel : null,
  };
}

function uretimKapasitesi(sirket, tur, calisanDetaylar) {
  const po = personelOdasiBonuslari(sirket.personel_odasi_seviye || 0);
  let kapasite = 0;
  let mudur = 0;
  for (const c of calisanDetaylar) {
    const poz = pozisyonBul(tur.id, c.pozisyonId);
    if (!poz) continue;
    if (poz.ozel === "mudur") mudur++;
    kapasite += (poz.uretimBonus || 1) * (c.verimlilik / 100) * 6;
  }
  if (!calisanDetaylar.length) return 0;
  kapasite *= 1 + (po.verimBonus || 0) / 100;
  kapasite *= 1 + mudur * 0.1;
  return Math.floor(Math.max(0, kapasite));
}

function stokSatisLimiti(tur, stokMap) {
  if (!tur.malzemeler || !tur.malzemeler.length) return 0;
  let limit = Infinity;
  for (const m of tur.malzemeler) {
    const stok = stokMap[m.id] || 0;
    const tuketim = m.birimTuketim || 1;
    limit = Math.min(limit, Math.floor(stok / tuketim));
  }
  return limit === Infinity ? 0 : Math.max(0, limit);
}

function talepHesapla(sirket, tur, calisanDetaylar) {
  const reklam = REKLAM_SEVIYELERI[sirket.reklam_seviye] || REKLAM_SEVIYELERI[0];
  let talep = (tur.bazCalisan || 3) * 4 + (sirket.populerlik || 0) * 0.4;
  talep *= 1 + (reklam.musteriBonus || 0);
  const pazarlamaci = calisanDetaylar.filter((c) => c.ozel === "pazarlamaci").length;
  talep *= 1 + pazarlamaci * 0.15;
  talep *= 0.85 + (sirket.yildiz || 0) * 0.05;
  return Math.floor(Math.max(0, talep));
}

async function malzemeTuket(db, sirketId, tur, adet) {
  if (adet <= 0) return 0;
  let maliyet = 0;
  for (const m of tur.malzemeler || []) {
    const tanim = malzemeBul(m.id);
    const miktar = (m.birimTuketim || 1) * adet;
    await stokGuncelle(db, sirketId, m.id, -miktar);
    if (tanim) maliyet += Math.floor(tanim.birimFiyat * miktar);
  }
  return maliyet;
}

async function sirketGunlukOperasyon(db, sirket, tur, gunSayisi) {
  const calisanRows = await calisanlariGetir(db, sirket.id);
  const calisanDetaylar = [];
  for (const row of calisanRows) {
    calisanDetaylar.push(await calisanDetay(db, row, tur));
  }

  const stokMap = await stokHaritasi(db, sirket.id);
  const bugun = maasGunKey();
  const reklam = REKLAM_SEVIYELERI[sirket.reklam_seviye] || REKLAM_SEVIYELERI[0];
  const fiyatCarpani = Math.min(2, Math.max(0.5, sirket.fiyat_carpani || 1));
  const birimFiyat = Math.floor((tur.birimSatisFiyati || 500) * fiyatCarpani);

  let toplamNet = 0;
  let toplamSatis = 0;
  let toplamBrut = 0;

  for (let g = 0; g < gunSayisi; g++) {
    const kapasite = uretimKapasitesi(sirket, tur, calisanDetaylar);
    const stokLimit = stokSatisLimiti(tur, stokMap);
    const talep = talepHesapla(sirket, tur, calisanDetaylar);
    const satisAdet = Math.min(kapasite, stokLimit, talep);

    const malzemeMaliyet = await malzemeTuket(db, sirket.id, tur, satisAdet);
    for (const m of tur.malzemeler || []) {
      const row = await get(
        db,
        `SELECT miktar FROM sirket_stok WHERE sirket_id = ? AND malzeme_id = ?`,
        [sirket.id, m.id]
      );
      stokMap[m.id] = row?.miktar || 0;
    }

    const brutGelir = satisAdet * birimFiyat;
    const maasGider = calisanRows.reduce((s, c) => s + (c.gunluk_maas || 0), 0);
    const reklamGider = reklam.gunlukMaliyet || 0;
    /** Rapor net kâr (maaş gideri dahil); kasa artışı maaş hariç — maaşlar calisanMaasOde ile oyuncuya gider */
    const netKar = brutGelir - maasGider - reklamGider;
    const kasaArtis = brutGelir - reklamGider;

    let notlar = "";
    if (satisAdet === 0 && calisanDetaylar.length > 0) {
      if (stokLimit <= 0) notlar = "Stok yetersiz — malzeme satın al.";
      else if (kapasite <= 0) notlar = "Üretim kapasitesi düşük.";
      else notlar = "Şehir müşterisi talebi zayıf — reklam veya fiyat ayarla.";
    } else if (satisAdet > 0) {
      notlar = `${satisAdet} müşteri alışveriş yaptı (NPC talep).`;
    }

    sirket.kasa = Math.max(-500000, (sirket.kasa || 0) + kasaArtis);
    sirket.populerlik = Math.max(0, (sirket.populerlik || 0) + Math.floor(satisAdet / 5));
    if (netKar > 0) sirket.yildiz = Math.min(5, (sirket.yildiz || 0) + (netKar > maasGider ? 0.02 : 0));
    else if (netKar < 0) sirket.yildiz = Math.max(0, (sirket.yildiz || 0) - 0.05);
    sirket.yildiz = Math.round((sirket.yildiz || 0) * 10) / 10;

    await run(
      db,
      `INSERT INTO sirket_gunluk_rapor
        (sirket_id, gun, satis_adet, brut_gelir, malzeme_maliyet, maas_gider, reklam_gider, net_kar, notlar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sirket.id,
        bugun,
        satisAdet,
        brutGelir,
        malzemeMaliyet,
        maasGider,
        reklamGider,
        netKar,
        notlar,
      ]
    );

    toplamNet += netKar;
    toplamSatis += satisAdet;
    toplamBrut += brutGelir;
  }

  await run(
    db,
    `UPDATE oyuncu_sirketleri SET
      kasa = ?, populerlik = ?, yildiz = ?, son_gelir_gunu = ?
     WHERE id = ?`,
    [Math.floor(sirket.kasa), Math.floor(sirket.populerlik), sirket.yildiz, bugun, sirket.id]
  );

  return { toplamNet, toplamSatis, toplamBrut, gun: gunSayisi };
}

async function sirketGunleriIsle(db, sirketId) {
  if (!maasSaatiGeldiMi()) {
    return { gelir: 0, gun: 0, bekliyor: true, maasSaati: MAAS_RAPOR_SAATI };
  }

  const sirket = await sirketGetir(db, sirketId);
  if (!sirket) return { gelir: 0, gun: 0 };
  const tur = turBul(sirket.tur_id);
  if (!tur) return { gelir: 0, gun: 0 };

  const bugun = maasGunKey();
  if (sirket.son_gelir_gunu === bugun) return { gelir: 0, gun: 0 };

  let gun = 1;
  if (sirket.son_gelir_gunu) {
    gun = Math.min(MAX_GUNLUK_TELAFI, gunFarki(sirket.son_gelir_gunu, bugun));
  }

  const sonuc = await sirketGunlukOperasyon(db, sirket, tur, gun);
  if (sonuc.gun > 0) {
    const { bildirimGonder } = require("./bildirimService");
    bildirimGonder(db, sirket.sahip_user_id, "sirket_raporu", {
      baslik: "Şirket Raporu Çıktı",
      icerik: `${sirket.isim}: günlük rapor hazır (${(sonuc.toplamNet || 0).toLocaleString("tr-TR")} TL net).`,
      url: "/?ekran=meslekler",
    }).catch(() => {});
  }
  return { gelir: sonuc.toplamNet, gun: sonuc.gun, satis: sonuc.toplamSatis };
}

async function calisanMaasOde(db, userId, player, opts = {}) {
  const skipSirketIslem = !!opts.skipSirketIslem;

  if (!maasSaatiGeldiMi()) {
    return { gelir: 0, gun: 0, bekliyor: true, maasSaati: MAAS_RAPOR_SAATI };
  }

  const emp = await get(
    db,
    `SELECT c.*, s.isim AS sirket_adi, s.kasa AS sirket_kasa, s.id AS sirket_id, s.tur_id
     FROM sirket_calisanlari c
     JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
     WHERE c.user_id = ?`,
    [userId]
  );
  if (!emp) return { gelir: 0, gun: 0 };

  if (!skipSirketIslem) {
    await sirketGunleriIsle(db, emp.sirket_id);
  }

  const bugun = maasGunKey();
  if (emp.son_maas_gunu === bugun) return { gelir: 0, gun: 0 };

  let gun = 1;
  if (emp.son_maas_gunu) {
    gun = Math.min(MAX_GUNLUK_TELAFI, gunFarki(emp.son_maas_gunu, bugun));
  }

  const tur = turBul(emp.tur_id);
  const poz = tur ? pozisyonBul(tur.id, emp.pozisyon_id) : null;
  const maas = emp.gunluk_maas * gun;
  const sirket = await sirketGetir(db, emp.sirket_id);

  if (!sirket || sirket.kasa < maas) {
    return {
      gelir: 0,
      gun: 0,
      odemeYapilamadi: true,
      mesaj: `${emp.sirket_adi} kasasında yeterli para yok — maaşın ödenemedi.`,
      sirketAdi: emp.sirket_adi,
    };
  }

  if (!player) {
    const kasaRow = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [userId]);
    player = { kasa: kasaRow?.kasa ?? 0 };
  }

  await run(db, `UPDATE oyuncu_sirketleri SET kasa = kasa - ? WHERE id = ?`, [maas, emp.sirket_id]);
  player.kasa += maas;
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);

  const maasAntrenmanPuani = await maasAntrenmanPuaniEkle(db, userId, gun);
  await run(db, `UPDATE sirket_calisanlari SET son_maas_gunu = ? WHERE user_id = ?`, [
    bugun,
    userId,
  ]);

  if (maas > 0) {
    const { bildirimGonder } = require("./bildirimService");
    bildirimGonder(db, userId, "is_maasi", {
      baslik: "İş Maaşın Yattı",
      icerik: `${emp.sirket_adi} — ${poz ? poz.unvan : "çalışan"}: ${maas.toLocaleString("tr-TR")} TL kasana yattı.`,
      url: "/?ekran=meslekler",
    }).catch(() => {});
  }

  return {
    gelir: maas,
    gun,
    oyuncuKasaya: maas > 0,
    sirketAdi: emp.sirket_adi,
    unvan: poz ? poz.unvan : emp.pozisyon_id,
    maasAntrenmanPuani,
  };
}

async function processSirketEkonomisi(db, userId, player) {
  await ensureSirketTables(db);
  const sahip = await sahipSirketGetir(db, userId);
  let sirketGelirBilgi = { gelir: 0, gun: 0 };
  if (sahip) {
    const islem = await sirketGunleriIsle(db, sahip.id);
    sirketGelirBilgi = {
      gelir: islem.gelir,
      gun: islem.gun,
      sirketAdi: sahip.isim,
      satis: islem.satis || 0,
      sirketKasasi: true,
    };
  }
  const sirketMaasBilgi = await calisanMaasOde(db, userId, player);
  return { sirketGelirBilgi, sirketMaasBilgi };
}

function pozisyonOzet(poz, yetenekler) {
  const kontrol = yetenekUygunMu(yetenekler, poz.gereksinim);
  return {
    id: poz.id,
    unvan: poz.unvan,
    varsayilanMaas: poz.varsayilanMaas,
    gereksinim: poz.gereksinim,
    uygun: kontrol.uygun,
    eksikler: kontrol.eksikler,
    seviye: poz.seviye,
  };
}

async function gunlukRaporlar(db, sirketId, limit = 7) {
  return all(
    db,
    `SELECT * FROM sirket_gunluk_rapor WHERE sirket_id = ? ORDER BY id DESC LIMIT ?`,
    [sirketId, limit]
  );
}

async function tahminHesapla(db, sirket, tur) {
  const calisanRows = await calisanlariGetir(db, sirket.id);
  const calisanDetaylar = [];
  for (const row of calisanRows) {
    calisanDetaylar.push(await calisanDetay(db, row, tur));
  }
  const stokMap = await stokHaritasi(db, sirket.id);
  const kapasite = uretimKapasitesi(sirket, tur, calisanDetaylar);
  const stokLimit = stokSatisLimiti(tur, stokMap);
  const talep = talepHesapla(sirket, tur, calisanDetaylar);
  const satisAdet = Math.min(kapasite, stokLimit, talep);
  const fiyatCarpani = Math.min(2, Math.max(0.5, sirket.fiyat_carpani || 1));
  const birimFiyat = Math.floor((tur.birimSatisFiyati || 500) * fiyatCarpani);
  const reklam = REKLAM_SEVIYELERI[sirket.reklam_seviye] || REKLAM_SEVIYELERI[0];
  const brut = satisAdet * birimFiyat;
  const maas = calisanRows.reduce((s, c) => s + (c.gunluk_maas || 0), 0);
  const net = brut - maas - (reklam.gunlukMaliyet || 0);
  return {
    satisAdet,
    brutGelir: brut,
    netTahmin: net,
    kapasite,
    stokLimit,
    talep,
  };
}

async function benimBasvuruHaritasi(db, userId) {
  const rows = await all(
    db,
    `SELECT sirket_id, pozisyon_id FROM sirket_basvurulari WHERE user_id = ?`,
    [userId]
  );
  const map = {};
  for (const r of rows || []) map[r.sirket_id] = r.pozisyon_id;
  return map;
}

async function bekleyenSirketBasvuruSayisi(db, userId) {
  const sahip = await sahipSirketGetir(db, userId);
  if (!sahip) return 0;
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM sirket_basvurulari WHERE sirket_id = ?`,
    [sahip.id]
  );
  return row?.n || 0;
}

async function meslekSirketBildirimEkle(db, userId) {
  await run(db, `UPDATE players SET meslek_sirket_bildirim = 1 WHERE user_id = ?`, [userId]);
}

async function meslekSirketBildirimVarMi(db, userId) {
  const row = await get(db, `SELECT meslek_sirket_bildirim FROM players WHERE user_id = ?`, [userId]);
  return !!(row?.meslek_sirket_bildirim);
}

async function meslekSirketBildirimTemizle(db, userId) {
  await run(db, `UPDATE players SET meslek_sirket_bildirim = 0 WHERE user_id = ?`, [userId]);
}

async function meslekMenuBildirimVarMi(db, userId) {
  if ((await bekleyenSirketBasvuruSayisi(db, userId)) > 0) return true;
  if (await meslekSirketBildirimVarMi(db, userId)) return true;
  if ((await okunmamisIstifaBildirimSayisi(db, userId)) > 0) return true;
  if ((await bekleyenZamTalepSayisi(db, userId)) > 0) return true;
  return false;
}

async function okunmamisIstifaBildirimSayisi(db, sahipUserId) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM sirket_istifa_bildirimleri WHERE sahip_user_id = ? AND okundu = 0`,
    [sahipUserId]
  );
  return row?.n || 0;
}

async function sonIstifalarGetir(db, sirketId, limit = 15) {
  const rows = await all(
    db,
    `SELECT id, calisan_user_id, reis_adi, unvan, istifa_zamani, okundu
     FROM sirket_istifa_bildirimleri
     WHERE sirket_id = ?
     ORDER BY istifa_zamani DESC
     LIMIT ?`,
    [sirketId, limit]
  );
  return (rows || []).map((r) => ({
    id: r.id,
    calisanUserId: r.calisan_user_id,
    reisAdi: r.reis_adi,
    unvan: r.unvan,
    istifaZamani: r.istifa_zamani,
    okundu: !!r.okundu,
  }));
}

async function istifaBildirimEkle(db, sirketId, sahipUserId, calisanUserId, reisAdi, unvan) {
  await run(
    db,
    `INSERT INTO sirket_istifa_bildirimleri
      (sirket_id, sahip_user_id, calisan_user_id, reis_adi, unvan, istifa_zamani, okundu)
     VALUES (?, ?, ?, ?, ?, strftime('%s','now'), 0)`,
    [sirketId, sahipUserId, calisanUserId, reisAdi || "", unvan || ""]
  );
}

async function istifaBildirimleriOkundu(db, sahipUserId, sirketId) {
  await run(
    db,
    `UPDATE sirket_istifa_bildirimleri SET okundu = 1
     WHERE sahip_user_id = ? AND sirket_id = ? AND okundu = 0`,
    [sahipUserId, sirketId]
  );
}

async function bekleyenZamTalepSayisi(db, sahipUserId) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS n FROM sirket_zam_talepleri WHERE sahip_user_id = ?`,
    [sahipUserId]
  );
  return row?.n || 0;
}

async function zamTalepleriGetir(db, sirketId) {
  const rows = await all(
    db,
    `SELECT z.*, u.reis_adi
     FROM sirket_zam_talepleri z
     JOIN users u ON u.id = z.calisan_user_id
     WHERE z.sirket_id = ?
     ORDER BY z.talep_zamani DESC`,
    [sirketId]
  );
  return (rows || []).map((r) => ({
    id: r.id,
    calisanUserId: r.calisan_user_id,
    reisAdi: r.reis_adi,
    mevcutMaas: r.mevcut_maas,
    talepMaas: r.talep_maas,
    talepZamani: r.talep_zamani,
    okundu: !!r.okundu,
  }));
}

async function calisanZamTalebiGetir(db, userId) {
  const row = await get(
    db,
    `SELECT id, mevcut_maas, talep_maas, talep_zamani
     FROM sirket_zam_talepleri WHERE calisan_user_id = ?`,
    [userId]
  );
  if (!row) return null;
  return {
    id: row.id,
    mevcutMaas: row.mevcut_maas,
    talepMaas: row.talep_maas,
    talepZamani: row.talep_zamani,
  };
}

async function zamTalepleriOkundu(db, sahipUserId, sirketId) {
  await run(
    db,
    `UPDATE sirket_zam_talepleri SET okundu = 1
     WHERE sahip_user_id = ? AND sirket_id = ? AND okundu = 0`,
    [sahipUserId, sirketId]
  );
}

async function zamTalepEt(db, userId, talepMaas) {
  await ensureSirketTables(db);
  const emp = await get(
    db,
    `SELECT c.*, s.id AS sirket_id, s.sahip_user_id, s.isim AS sirket_adi
     FROM sirket_calisanlari c
     JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
     WHERE c.user_id = ?`,
    [userId]
  );
  if (!emp) return { ok: false, error: "Bir şirkette çalışmıyorsun." };

  const mevcut = emp.gunluk_maas || 0;
  if (mevcut >= MAX_GUNLUK_MAAS) {
    return {
      ok: false,
      error: `Günlük maaşın zaten maksimum (${MAX_GUNLUK_MAAS.toLocaleString("tr-TR")} TL).`,
    };
  }

  const raw = Math.floor(Number(talepMaas) || 0);
  if (!Number.isFinite(raw) || raw < MIN_GUNLUK_MAAS) {
    return { ok: false, error: `Geçerli bir maaş gir (en az ${MIN_GUNLUK_MAAS.toLocaleString("tr-TR")} TL).` };
  }
  if (raw > MAX_GUNLUK_MAAS) {
    return {
      ok: false,
      error: `Günlük maaş en fazla ${MAX_GUNLUK_MAAS.toLocaleString("tr-TR")} TL olabilir.`,
    };
  }
  const talep = raw;
  if (talep <= mevcut) {
    return { ok: false, error: `Talep edilen maaş mevcut günlük maaştan (${mevcut.toLocaleString("tr-TR")} TL) yüksek olmalı.` };
  }

  const mevcutTalep = await get(
    db,
    `SELECT id FROM sirket_zam_talepleri WHERE calisan_user_id = ?`,
    [userId]
  );
  if (mevcutTalep) {
    await run(
      db,
      `UPDATE sirket_zam_talepleri
       SET mevcut_maas = ?, talep_maas = ?, talep_zamani = strftime('%s','now'), okundu = 0
       WHERE calisan_user_id = ?`,
      [mevcut, talep, userId]
    );
  } else {
    await run(
      db,
      `INSERT INTO sirket_zam_talepleri
        (sirket_id, sahip_user_id, calisan_user_id, mevcut_maas, talep_maas, talep_zamani, okundu)
       VALUES (?, ?, ?, ?, ?, strftime('%s','now'), 0)`,
      [emp.sirket_id, emp.sahip_user_id, userId, mevcut, talep]
    );
  }

  await meslekSirketBildirimEkle(db, emp.sahip_user_id);
  return {
    ok: true,
    mesaj: `${emp.sirket_adi} patronuna günlük ${talep.toLocaleString("tr-TR")} TL zam talebi gönderildi.`,
  };
}

async function zamTalepOnayla(db, userId, talepId) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };

  const talep = await get(
    db,
    `SELECT * FROM sirket_zam_talepleri WHERE id = ? AND sirket_id = ?`,
    [talepId, sirket.id]
  );
  if (!talep) return { ok: false, error: "Zam talebi bulunamadı." };

  const maas = Math.min(MAX_GUNLUK_MAAS, Math.max(MIN_GUNLUK_MAAS, talep.talep_maas));
  const sonuc = await run(
    db,
    `UPDATE sirket_calisanlari SET gunluk_maas = ? WHERE sirket_id = ? AND user_id = ?`,
    [maas, sirket.id, talep.calisan_user_id]
  );
  if (!sonuc || sonuc.changes === 0) return { ok: false, error: "Çalışan bulunamadı." };

  await run(db, `DELETE FROM sirket_zam_talepleri WHERE id = ?`, [talepId]);

  const { bildirimGonder } = require("./bildirimService");
  await bildirimGonder(db, talep.calisan_user_id, "zam_onay", {
    baslik: "Zam Talebin Onaylandı",
    icerik: `${sirket.isim} — günlük maaşın ${maas.toLocaleString("tr-TR")} TL oldu.`,
    url: "/?ekran=meslekler",
  });
  await meslekSirketBildirimEkle(db, talep.calisan_user_id);

  return { ok: true, mesaj: `Zam talebi onaylandı. Günlük maaş ${maas.toLocaleString("tr-TR")} TL.` };
}

async function zamTalepReddet(db, userId, talepId) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };

  const talep = await get(
    db,
    `SELECT * FROM sirket_zam_talepleri WHERE id = ? AND sirket_id = ?`,
    [talepId, sirket.id]
  );
  if (!talep) return { ok: false, error: "Zam talebi bulunamadı." };

  await run(db, `DELETE FROM sirket_zam_talepleri WHERE id = ?`, [talepId]);

  const { bildirimGonder } = require("./bildirimService");
  await bildirimGonder(db, talep.calisan_user_id, "zam_red", {
    baslik: "Zam Talebin Reddedildi",
    icerik: `${sirket.isim} patronu zam talebini reddetti.`,
    url: "/?ekran=meslekler",
  });
  await meslekSirketBildirimEkle(db, talep.calisan_user_id);

  return { ok: true, mesaj: "Zam talebi reddedildi." };
}

async function panelGetir(db, userId) {
  await ensureSirketTables(db);
  const yetenekler = await yetenekleriGetir(db, userId);
  const basvuruHaritasi = await benimBasvuruHaritasi(db, userId);
  const bekleyenSirketBasvuru = await bekleyenSirketBasvuruSayisi(db, userId);

  const turler = SIRKET_TURLERI.map((t) => ({
    id: t.id,
    ad: t.ad,
    emoji: t.emoji,
    aciklama: t.aciklama,
    kurulusUcreti: t.kurulusUcreti,
    urunAd: t.urunAd,
    birimSatisFiyati: t.birimSatisFiyati,
    malzemeler: turMalzemeListesi(t),
    pozisyonSayisi: t.pozisyonlar.length,
  }));

  const emp = await get(
    db,
    `SELECT c.*, s.isim AS sirket_adi, s.tur_id, u.username AS sahip_adi
     FROM sirket_calisanlari c
     JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
     JOIN users u ON u.id = s.sahip_user_id
     WHERE c.user_id = ?`,
    [userId]
  );

  let aktifCalisan = null;
  if (emp) {
    const tur = turBul(emp.tur_id);
    const poz = tur ? pozisyonBul(tur.id, emp.pozisyon_id) : null;
    aktifCalisan = {
      sirketAdi: emp.sirket_adi,
      sahipAdi: emp.sahip_adi,
      unvan: poz ? poz.unvan : emp.pozisyon_id,
      gunlukMaas: emp.gunluk_maas,
      zamTalebi: await calisanZamTalebiGetir(db, userId),
    };
  }

  const acikRows = await all(
    db,
    `SELECT s.*, u.username AS sahip_adi,
      (SELECT COUNT(*) FROM sirket_calisanlari c WHERE c.sirket_id = s.id) AS calisan_sayisi
     FROM oyuncu_sirketleri s
     JOIN users u ON u.id = s.sahip_user_id
     WHERE s.ise_alim_acik = 1
     ORDER BY s.id DESC`
  );

  const acikSirketler = [];
  for (const row of acikRows || []) {
    const tur = turBul(row.tur_id);
    if (!tur) continue;
    const maxCalisan = maxCalisanHesapla(tur, row.kapasite_seviye || 0);
    acikSirketler.push({
      id: row.id,
      isim: row.isim,
      aciklama: row.aciklama,
      turAd: tur.ad,
      turEmoji: tur.emoji,
      sahipAdi: row.sahip_adi,
      calisanSayisi: row.calisan_sayisi,
      maxCalisan,
      bosKoltuk: maxCalisan - row.calisan_sayisi,
      benimSirketim: row.sahip_user_id === userId,
      basvuruYapildi: !!basvuruHaritasi[row.id],
      basvuruPozisyonId: basvuruHaritasi[row.id] || null,
      pozisyonlar: (tur.pozisyonlar || []).map((p) => ({
        ...pozisyonOzet(p, yetenekler),
        basvuruYapildi: basvuruHaritasi[row.id] === p.id,
      })),
    });
  }

  const sahip = await sahipSirketGetir(db, userId);
  let yonetim = null;
  if (sahip) {
    const tur = turBul(sahip.tur_id);
    if (tur) {
      const calisanRows = await calisanlariGetir(db, sahip.id);
      const calisanlar = [];
      for (const row of calisanRows) {
        calisanlar.push(await calisanDetay(db, row, tur));
      }
      const maxCalisan = maxCalisanHesapla(tur, sahip.kapasite_seviye || 0);
      const depoKapasite = depoKapasiteHesapla(tur, sahip.depo_seviye || 0);
      const stokMap = await stokHaritasi(db, sahip.id);
      const stokDolu = await stokToplam(db, sahip.id);
      const po = personelOdasiBonuslari(sahip.personel_odasi_seviye || 0);
      const egitimSlot = EGITIM_SLOT_BAZ + (po.egitimSlotBonus || 0);
      const bugun = istanbulGunKey();
      const egitimKullanim =
        sahip.son_egitim_gunu === bugun ? sahip.egitim_slot_kullanim || 0 : 0;
      const tahmin = await tahminHesapla(db, sahip, tur);
      const raporlar = await gunlukRaporlar(db, sahip.id, 7);
      const basvuruRows = await all(
        db,
        `SELECT b.*, u.reis_adi AS reis_adi
         FROM sirket_basvurulari b
         JOIN users u ON u.id = b.user_id
         WHERE b.sirket_id = ?
         ORDER BY COALESCE(b.basvuru_zamani, b.created_at, 0) DESC`,
        [sahip.id]
      );
      const basvurular = (basvuruRows || []).map((b) => {
        const poz = pozisyonBul(tur.id, b.pozisyon_id);
        return {
          id: b.id,
          reisAdi: b.reis_adi,
          unvan: poz ? poz.unvan : b.pozisyon_id,
          varsayilanMaas: poz ? poz.varsayilanMaas : 2000,
        };
      });
      const okunmamisIstifa = await okunmamisIstifaBildirimSayisi(db, userId);
      const sonIstifalar = await sonIstifalarGetir(db, sahip.id);
      const zamTalepleri = await zamTalepleriGetir(db, sahip.id);
      const bekleyenZam = zamTalepleri.length;

      yonetim = {
        id: sahip.id,
        isim: sahip.isim,
        aciklama: sahip.aciklama,
        turId: tur.id,
        turAd: tur.ad,
        turEmoji: tur.emoji,
        turAciklama: tur.aciklama,
        urunAd: tur.urunAd,
        kasa: sahip.kasa,
        iseAlimAcik: iseAlimAcikMi(sahip.ise_alim_acik),
        maxCalisan,
        calisanlar,
        basvurular,
        okunmamisIstifa,
        sonIstifalar,
        zamTalepleri,
        bekleyenZam,
        gunlukGelirTahmin: tahmin.netTahmin,
        gunlukMaasToplam: calisanRows.reduce((s, c) => s + (c.gunluk_maas || 0), 0),
        kapasiteSeviye: sahip.kapasite_seviye || 0,
        depoSeviye: sahip.depo_seviye || 0,
        personelOdasiSeviye: sahip.personel_odasi_seviye || 0,
        reklamSeviye: sahip.reklam_seviye || 0,
        fiyatCarpani: sahip.fiyat_carpani || 1,
        yildiz: sahip.yildiz || 0,
        populerlik: sahip.populerlik || 0,
        depoKapasite,
        stokDolu: Math.floor(stokDolu),
        stok: turMalzemeListesi(tur).map((m) => ({
          ...m,
          miktar: Math.floor(stokMap[m.id] || 0),
        })),
        birimSatisFiyati: tur.birimSatisFiyati,
        efektifBirimFiyat: Math.floor(
          (tur.birimSatisFiyati || 500) *
            Math.min(2, Math.max(0.5, sahip.fiyat_carpani || 1))
        ),
        birimMalzemeMaliyet: birimBasinaMalzemeMaliyet(tur),
        tahmin,
        upgradeTipleri: Object.values(UPGRADE_TIPLERI).map((tip) => ({
          id: tip.id,
          ad: tip.ad,
          emoji: tip.emoji,
          aciklama: tip.aciklama,
          mevcutSeviye:
            tip.id === "kapasite"
              ? sahip.kapasite_seviye || 0
              : tip.id === "depo"
                ? sahip.depo_seviye || 0
                : sahip.personel_odasi_seviye || 0,
          maxSeviye: MAX_UPGRADE_SEVIYE,
          maliyet: upgradeMaliyet(
            tur,
            tip.id,
            tip.id === "kapasite"
              ? sahip.kapasite_seviye || 0
              : tip.id === "depo"
                ? sahip.depo_seviye || 0
                : sahip.personel_odasi_seviye || 0
          ),
        })),
        reklamSecenekleri: REKLAM_SEVIYELERI,
        egitimSlot,
        egitimKullanim,
        egitimMaliyet: EGITIM_MALIYET,
        raporlar: (raporlar || []).map((r) => ({
          gun: r.gun,
          satisAdet: r.satis_adet,
          brutGelir: r.brut_gelir,
          malzemeMaliyet: r.malzeme_maliyet,
          maasGider: r.maas_gider,
          reklamGider: r.reklam_gider,
          netKar: r.net_kar,
          notlar: r.notlar,
        })),
      };
    }
  }

  const basvuruSonucBildirim = await meslekSirketBildirimVarMi(db, userId);
  if (basvuruSonucBildirim) {
    await meslekSirketBildirimTemizle(db, userId);
  }

  if (sahip) {
    const okunmamisIstifaSay = await okunmamisIstifaBildirimSayisi(db, userId);
    if (okunmamisIstifaSay > 0) {
      await istifaBildirimleriOkundu(db, userId, sahip.id);
    }
    const bekleyenZamSay = await bekleyenZamTalepSayisi(db, userId);
    if (bekleyenZamSay > 0) {
      await zamTalepleriOkundu(db, userId, sahip.id);
    }
  }

  return { ok: true, turler, acikSirketler, aktifCalisan, yonetim, bekleyenSirketBasvuru, meslekMenuBildirim: bekleyenSirketBasvuru > 0 };
}

async function calisanGetir(db, userId) {
  const emp = await get(db, `SELECT * FROM sirket_calisanlari WHERE user_id = ?`, [userId]);
  return emp || null;
}

async function olustur(db, userId, player, turId, isim, aciklama) {
  await ensureSirketTables(db);
  const tur = turBul(turId);
  if (!tur) return { ok: false, error: "Geçersiz şirket türü." };

  const mevcut = await sahipSirketGetir(db, userId);
  if (mevcut) return { ok: false, error: "Zaten bir şirketin var." };

  const npcIs = await get(db, `SELECT user_id FROM oyuncu_meslek WHERE user_id = ?`, [userId]);
  if (npcIs) return { ok: false, error: "NPC işindesin. Önce istifa et." };

  const calisan = await calisanGetir(db, userId);
  if (calisan) return { ok: false, error: "Başka bir şirkette çalışıyorsun." };

  const temizIsim = sanitizeIsim(isim);
  if (temizIsim.length < 3) return { ok: false, error: "Şirket adı en az 3 karakter olmalı." };

  if (player.kasa < tur.kurulusUcreti) {
    return { ok: false, error: `Kuruluş için ${tur.kurulusUcreti} TL gerekli.` };
  }

  player.kasa -= tur.kurulusUcreti;
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);

  const bugun = maasGunKey();
  await run(
    db,
    `INSERT INTO oyuncu_sirketleri
      (sahip_user_id, tur_id, isim, aciklama, kasa, son_gelir_gunu)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [userId, tur.id, temizIsim, sanitizeAciklama(aciklama), bugun]
  );

  const sirket = await sahipSirketGetir(db, userId);
  for (const m of tur.malzemeler || []) {
    await stokGuncelle(db, sirket.id, m.id, 0);
  }

  return {
    ok: true,
    mesaj: `${tur.emoji} ${temizIsim} kuruldu! Malzeme stoku al, çalışan işe al, günlük satışa başla.`,
  };
}

async function yatir(db, userId, player, miktar) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const tutar = Math.floor(Number(miktar) || 0);
  if (tutar < 100) return { ok: false, error: "En az 100 TL yatırabilirsin." };
  if (tutar > 999_999_999) return { ok: false, error: "Tek seferde en fazla 999.999.999 TL yatırabilirsin." };

  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
    [tutar, userId, tutar]
  );
  if (!deduct?.changes) return { ok: false, error: "Yeterli paran yok." };

  await run(db, `UPDATE oyuncu_sirketleri SET kasa = kasa + ? WHERE id = ?`, [tutar, sirket.id]);
  player.kasa -= tutar;
  return { ok: true, mesaj: `${tutar} TL şirket kasasına yatırıldı.` };
}

async function cek(db, userId, player, miktar) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const tutar = Math.floor(Number(miktar) || 0);
  if (tutar < 100) return { ok: false, error: "En az 100 TL çekebilirsin." };
  if (tutar > 999_999_999) return { ok: false, error: "Tek seferde en fazla 999.999.999 TL çekebilirsin." };

  const deduct = await run(
    db,
    `UPDATE oyuncu_sirketleri SET kasa = kasa - ? WHERE id = ? AND kasa >= ?`,
    [tutar, sirket.id, tutar]
  );
  if (!deduct?.changes) return { ok: false, error: "Şirket kasasında yeterli para yok." };

  await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [tutar, userId]);
  player.kasa += tutar;
  return { ok: true, mesaj: `${tutar} TL şirket kasasından çekildi.` };
}

async function iseAlimToggle(db, userId, acik) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const onceAcik = iseAlimAcikMi(sirket.ise_alim_acik);
  await run(db, `UPDATE oyuncu_sirketleri SET ise_alim_acik = ? WHERE id = ?`, [
    acik ? 1 : 0,
    sirket.id,
  ]);

  let gazeteHaber = false;
  if (acik) {
    const u = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [userId]);
    const tur = turBul(sirket.tur_id);
    await isIlaniHaberEkle(db, sirket.isim, u?.reis_adi || "Patron", tur?.ad || "şirket");
    gazeteHaber = true;
  }

  return {
    ok: true,
    mesaj: acik
      ? onceAcik
        ? "İş ilanın zaten açıktı — gazetede yenilendi."
        : "İş ilanın Şehir Gazetesi'nde yayında! Oyuncular gazeteden başvurabilir."
      : "İş ilanları kapatıldı — gazete ve ilan listesinden kalktı.",
    gazeteHaber,
  };
}

async function basvur(db, userId, sirketId, pozisyonId) {
  await ensureSirketTables(db);
  const sirket = await sirketGetir(db, sirketId);
  if (!sirket || !iseAlimAcikMi(sirket.ise_alim_acik)) {
    return { ok: false, error: "Bu şirket işe alım yapmıyor." };
  }

  const tur = turBul(sirket.tur_id);
  const poz = pozisyonBul(sirket.tur_id, pozisyonId);
  if (!tur || !poz) return { ok: false, error: "Geçersiz pozisyon." };

  if (sirket.sahip_user_id === userId) return { ok: false, error: "Kendi şirketine başvuramazsın." };

  const npcIs = await get(db, `SELECT user_id FROM oyuncu_meslek WHERE user_id = ?`, [userId]);
  if (npcIs) return { ok: false, error: "NPC işindesin. Önce istifa et." };

  const calisan = await calisanGetir(db, userId);
  if (calisan) return { ok: false, error: "Zaten bir şirkette çalışıyorsun." };

  const yetenekler = await yetenekleriGetir(db, userId);
  const kontrol = yetenekUygunMu(yetenekler, poz.gereksinim);
  if (!kontrol.uygun) return { ok: false, error: "Yeteneklerin bu pozisyon için yetersiz." };

  const calisanSayisi = await get(
    db,
    `SELECT COUNT(*) AS n FROM sirket_calisanlari WHERE sirket_id = ?`,
    [sirketId]
  );
  const maxCalisan = maxCalisanHesapla(tur, sirket.kapasite_seviye || 0);
  if ((calisanSayisi?.n || 0) >= maxCalisan) return { ok: false, error: "Şirket kadrosu dolu." };

  await run(db, `DELETE FROM sirket_basvurulari WHERE sirket_id = ? AND user_id = ?`, [
    sirketId,
    userId,
  ]);
  await run(
    db,
    `INSERT INTO sirket_basvurulari (sirket_id, user_id, pozisyon_id, basvuru_zamani, created_at)
     VALUES (?, ?, ?, strftime('%s','now'), strftime('%s','now'))`,
    [sirketId, userId, pozisyonId]
  );

  return { ok: true, mesaj: `${sirket.isim} — ${poz.unvan} pozisyonuna başvurun alındı.` };
}

async function basvuruKabul(db, userId, basvuruId, gunlukMaas) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };

  const basvuru = await get(
    db,
    `SELECT b.*, u.username FROM sirket_basvurulari b JOIN users u ON u.id = b.user_id WHERE b.id = ? AND b.sirket_id = ?`,
    [basvuruId, sirket.id]
  );
  if (!basvuru) return { ok: false, error: "Başvuru bulunamadı." };

  const tur = turBul(sirket.tur_id);
  const poz = pozisyonBul(sirket.tur_id, basvuru.pozisyon_id);
  if (!tur || !poz) return { ok: false, error: "Geçersiz pozisyon." };

  const calisanSayisi = await get(
    db,
    `SELECT COUNT(*) AS n FROM sirket_calisanlari WHERE sirket_id = ?`,
    [sirket.id]
  );
  const maxCalisan = maxCalisanHesapla(tur, sirket.kapasite_seviye || 0);
  if ((calisanSayisi?.n || 0) >= maxCalisan) return { ok: false, error: "Kadro dolu." };

  const maas = Math.min(MAX_GUNLUK_MAAS, Math.max(MIN_GUNLUK_MAAS, Math.floor(Number(gunlukMaas) || poz.varsayilanMaas)));

  const npcIs = await get(db, `SELECT user_id FROM oyuncu_meslek WHERE user_id = ?`, [
    basvuru.user_id,
  ]);
  if (npcIs) return { ok: false, error: "Adayın NPC işi var." };

  const mevcutCalisan = await calisanGetir(db, basvuru.user_id);
  if (mevcutCalisan) return { ok: false, error: "Aday başka şirkette çalışıyor." };

  const adayYetenek = await yetenekleriGetir(db, basvuru.user_id);
  const yetenekKontrol = yetenekUygunMu(adayYetenek, poz.gereksinim);
  if (!yetenekKontrol.uygun) {
    return { ok: false, error: "Adayın yetenekleri artık bu pozisyon için yetersiz." };
  }

  const bugun = maasGunKey();
  await run(
    db,
    `INSERT INTO sirket_calisanlari (user_id, sirket_id, pozisyon_id, gunluk_maas, son_maas_gunu)
     VALUES (?, ?, ?, ?, ?)`,
    [basvuru.user_id, sirket.id, basvuru.pozisyon_id, maas, bugun]
  );
  await run(db, `DELETE FROM sirket_basvurulari WHERE id = ?`, [basvuruId]);
  await meslekSirketBildirimEkle(db, basvuru.user_id);
  const { bildirimGonder } = require("./bildirimService");
  await bildirimGonder(db, basvuru.user_id, "ise_alindi", {
    baslik: "İşe Alındın",
    icerik: `${sirket.isim} — ${poz.unvan} pozisyonuna alındın (${maas.toLocaleString("tr-TR")} TL/gün).`,
    url: "/?ekran=meslekler",
  });

  return {
    ok: true,
    mesaj: `${basvuru.username} ${poz.unvan} olarak işe alındı (${maas} TL/gün).`,
  };
}

async function basvuruRed(db, userId, basvuruId) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const basvuru = await get(
    db,
    `SELECT id, user_id FROM sirket_basvurulari WHERE id = ? AND sirket_id = ?`,
    [basvuruId, sirket.id]
  );
  if (!basvuru) return { ok: false, error: "Başvuru bulunamadı." };
  await run(db, `DELETE FROM sirket_basvurulari WHERE id = ?`, [basvuruId]);
  await meslekSirketBildirimEkle(db, basvuru.user_id);
  return { ok: true, mesaj: "Başvuru reddedildi." };
}

async function maasGuncelle(db, userId, calisanUserId, gunlukMaas) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const maas = Math.min(MAX_GUNLUK_MAAS, Math.max(MIN_GUNLUK_MAAS, Math.floor(Number(gunlukMaas) || 0)));
  const sonuc = await run(
    db,
    `UPDATE sirket_calisanlari SET gunluk_maas = ? WHERE sirket_id = ? AND user_id = ?`,
    [maas, sirket.id, calisanUserId]
  );
  if (!sonuc || sonuc.changes === 0) return { ok: false, error: "Çalışan bulunamadı." };
  return { ok: true, mesaj: `Günlük maaş ${maas} TL olarak güncellendi.` };
}

async function istenCikar(db, userId, calisanUserId) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const sonuc = await run(
    db,
    `DELETE FROM sirket_calisanlari WHERE sirket_id = ? AND user_id = ?`,
    [sirket.id, calisanUserId]
  );
  if (!sonuc || sonuc.changes === 0) return { ok: false, error: "Çalışan bulunamadı." };
  await run(db, `DELETE FROM sirket_zam_talepleri WHERE calisan_user_id = ?`, [calisanUserId]);
  const { bildirimGonder } = require("./bildirimService");
  await bildirimGonder(db, calisanUserId, "isten_atildi", {
    baslik: "İşten Atıldın",
    icerik: `${sirket.isim} şirketinden işten çıkarıldın.`,
    url: "/?ekran=meslekler",
  });
  return { ok: true, mesaj: "Çalışan işten çıkarıldı." };
}

async function kapat(db, userId, player) {
  await ensureSirketTables(db);
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };

  const calisanlar = await calisanlariGetir(db, sirket.id);
  const kasa = Math.max(0, parseInt(sirket.kasa, 10) || 0);
  const isim = sirket.isim;
  const { bildirimGonder } = require("./bildirimService");

  for (const c of calisanlar) {
    await bildirimGonder(db, c.user_id, "sirket_kapandi", {
      baslik: "Şirket Kapatıldı",
      icerik: `${isim} şirketi patron tarafından kapatıldı. İşin sona erdi.`,
      url: "/?ekran=meslekler",
    });
    await meslekSirketBildirimEkle(db, c.user_id);
  }

  await run(db, `DELETE FROM oyuncu_sirketleri WHERE id = ?`, [sirket.id]);

  if (kasa > 0) {
    await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [kasa, userId]);
    player.kasa = (player.kasa || 0) + kasa;
  }

  const mesaj =
    kasa > 0
      ? `${isim} kapatıldı. Şirket kasasındaki ${kasa.toLocaleString("tr-TR")} TL hesabına aktarıldı.`
      : `${isim} kapatıldı.`;

  return { ok: true, mesaj, iadeKasa: kasa };
}

async function istifaEt(db, userId) {
  const emp = await get(
    db,
    `SELECT c.*, s.isim AS sirket_adi, s.tur_id, s.id AS sirket_id, s.sahip_user_id, u.reis_adi
     FROM sirket_calisanlari c
     JOIN oyuncu_sirketleri s ON s.id = c.sirket_id
     JOIN users u ON u.id = c.user_id
     WHERE c.user_id = ?`,
    [userId]
  );
  if (!emp) return { ok: false, error: "Bir şirkette çalışmıyorsun." };
  const tur = turBul(emp.tur_id);
  const poz = tur ? pozisyonBul(tur.id, emp.pozisyon_id) : null;
  const unvan = poz ? poz.unvan : "görev";
  await run(db, `DELETE FROM sirket_calisanlari WHERE user_id = ?`, [userId]);
  await run(db, `DELETE FROM sirket_zam_talepleri WHERE calisan_user_id = ?`, [userId]);
  await istifaBildirimEkle(
    db,
    emp.sirket_id,
    emp.sahip_user_id,
    userId,
    emp.reis_adi,
    unvan
  );
  await meslekSirketBildirimEkle(db, emp.sahip_user_id);
  return {
    ok: true,
    mesaj: `${emp.sirket_adi} — ${unvan} işinden ayrıldın.`,
  };
}

async function egitimVer(db, userId, player, calisanUserId, yetenek) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const gecerli = ["guc", "zeka", "dayaniklilik", "beceri"];
  if (!gecerli.includes(yetenek)) return { ok: false, error: "Geçersiz yetenek." };

  const calisan = await get(
    db,
    `SELECT user_id FROM sirket_calisanlari WHERE sirket_id = ? AND user_id = ?`,
    [sirket.id, calisanUserId]
  );
  if (!calisan) return { ok: false, error: "Bu kişi senin şirketinde değil." };

  const tur = turBul(sirket.tur_id);
  const po = personelOdasiBonuslari(sirket.personel_odasi_seviye || 0);
  const slotLimit = EGITIM_SLOT_BAZ + (po.egitimSlotBonus || 0);
  const bugun = istanbulGunKey();
  let kullanim = sirket.son_egitim_gunu === bugun ? sirket.egitim_slot_kullanim || 0 : 0;
  if (kullanim >= slotLimit) {
    return { ok: false, error: `Günlük eğitim slotu doldu (${slotLimit}/gün). Personel odasını yükselt.` };
  }

  if (sirket.kasa < EGITIM_MALIYET) {
    return { ok: false, error: `Eğitim için kasada ${EGITIM_MALIYET} TL gerekli.` };
  }

  await run(db, `UPDATE oyuncu_sirketleri SET kasa = kasa - ? WHERE id = ?`, [
    EGITIM_MALIYET,
    sirket.id,
  ]);
  kullanim += 1;
  await run(
    db,
    `UPDATE oyuncu_sirketleri SET son_egitim_gunu = ?, egitim_slot_kullanim = ? WHERE id = ?`,
    [bugun, kullanim, sirket.id]
  );

  const yetenekler = await yetenekleriGetir(db, calisanUserId);
  yetenekler[yetenek] = (yetenekler[yetenek] || 0) + EGITIM_KAZANC;
  await yetenekleriKaydet(db, calisanUserId, yetenekler);

  return {
    ok: true,
    mesaj: `Eğitim verildi: +${EGITIM_KAZANC} ${yetenek} (${EGITIM_MALIYET} TL).`,
  };
}

async function malzemeAl(db, userId, malzemeId, miktar) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const tur = turBul(sirket.tur_id);
  if (!tur) return { ok: false, error: "Şirket türü geçersiz." };

  const tanim = malzemeBul(malzemeId);
  const turMal = (tur.malzemeler || []).find((m) => m.id === malzemeId);
  if (!tanim || !turMal) return { ok: false, error: "Bu malzeme şirket türüne uygun değil." };

  const adet = Math.floor(Number(miktar) || 0);
  if (adet < 1) return { ok: false, error: "En az 1 birim almalısın." };
  if (adet > 5000) return { ok: false, error: "Tek seferde en fazla 5000 birim." };

  const depoKapasite = depoKapasiteHesapla(tur, sirket.depo_seviye || 0);
  const stokDolu = await stokToplam(db, sirket.id);
  if (stokDolu + adet > depoKapasite) {
    return {
      ok: false,
      error: `Depo dolu (${Math.floor(stokDolu)}/${depoKapasite}). Depo yükselt veya stok tüket.`,
    };
  }

  const maliyet = tanim.birimFiyat * adet;
  if (sirket.kasa < maliyet) {
    return { ok: false, error: `Malzeme maliyeti ${maliyet} TL — kasada yeterli para yok.` };
  }

  await run(db, `UPDATE oyuncu_sirketleri SET kasa = kasa - ? WHERE id = ?`, [maliyet, sirket.id]);
  await stokGuncelle(db, sirket.id, malzemeId, adet);

  return {
    ok: true,
    mesaj: `${adet}× ${tanim.ad} satın alındı (${maliyet} TL).`,
  };
}

async function upgrade(db, userId, tipId) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const tur = turBul(sirket.tur_id);
  const tip = UPGRADE_TIPLERI[tipId];
  if (!tur || !tip) return { ok: false, error: "Geçersiz yükseltme." };

  const kolon =
    tipId === "kapasite"
      ? "kapasite_seviye"
      : tipId === "depo"
        ? "depo_seviye"
        : tipId === "personel_odasi"
          ? "personel_odasi_seviye"
          : null;
  if (!kolon) return { ok: false, error: "Geçersiz yükseltme türü." };

  const mevcut = sirket[kolon] || 0;
  if (mevcut >= MAX_UPGRADE_SEVIYE) return { ok: false, error: "Maksimum seviyeye ulaşıldı." };

  const maliyet = upgradeMaliyet(tur, tipId, mevcut);
  if (maliyet == null) return { ok: false, error: "Yükseltme hesaplanamadı." };
  if (sirket.kasa < maliyet) return { ok: false, error: `Yükseltme ${maliyet} TL — yetersiz kasa.` };

  await run(
    db,
    `UPDATE oyuncu_sirketleri SET kasa = kasa - ?, ${kolon} = ? WHERE id = ?`,
    [maliyet, mevcut + 1, sirket.id]
  );

  return {
    ok: true,
    mesaj: `${tip.emoji} ${tip.ad} seviye ${mevcut + 1} oldu (${maliyet} TL).`,
  };
}

async function reklamAyarla(db, userId, seviye) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const sv = Math.min(5, Math.max(0, Math.floor(Number(seviye) || 0)));
  const sec = REKLAM_SEVIYELERI[sv];
  if (!sec) return { ok: false, error: "Geçersiz reklam seviyesi." };

  await run(db, `UPDATE oyuncu_sirketleri SET reklam_seviye = ? WHERE id = ?`, [sv, sirket.id]);
  return {
    ok: true,
    mesaj:
      sv === 0
        ? "Reklam kampanyası kapatıldı."
        : `${sec.ad} aktif (günlük ${sec.gunlukMaliyet} TL).`,
  };
}

async function fiyatAyarla(db, userId, carpan) {
  const sirket = await sahipSirketGetir(db, userId);
  if (!sirket) return { ok: false, error: "Şirketin yok." };
  const c = Math.min(2, Math.max(0.5, Number(carpan) || 1));
  await run(db, `UPDATE oyuncu_sirketleri SET fiyat_carpani = ? WHERE id = ?`, [c, sirket.id]);
  const yuzde = Math.round((c - 1) * 100);
  const metin = yuzde === 0 ? "standart" : yuzde > 0 ? `%${yuzde} pahalı` : `%${Math.abs(yuzde)} indirimli`;
  return { ok: true, mesaj: `Satış fiyatı ${metin} olarak ayarlandı.` };
}

async function isIlanlariGetir(db, userId) {
  await ensureSirketTables(db);
  const yetenekler = await yetenekleriGetir(db, userId);
  const basvuruHaritasi = await benimBasvuruHaritasi(db, userId);

  const npcIs = await get(db, `SELECT user_id FROM oyuncu_meslek WHERE user_id = ?`, [userId]);
  const calisan = await calisanGetir(db, userId);
  const sahipSirket = await sahipSirketGetir(db, userId);

  let engelNedeni = null;
  if (npcIs) engelNedeni = "NPC işindesin. Önce istifa et.";
  else if (calisan) engelNedeni = "Zaten bir şirkette çalışıyorsun.";

  const acikRows = await all(
    db,
    `SELECT s.*, u.username AS sahip_adi, u.reis_adi AS sahip_reis_adi,
      (SELECT COUNT(*) FROM sirket_calisanlari c WHERE c.sirket_id = s.id) AS calisan_sayisi
     FROM oyuncu_sirketleri s
     JOIN users u ON u.id = s.sahip_user_id
     WHERE s.ise_alim_acik = 1
     ORDER BY s.id DESC`
  );

  const ilanlar = [];
  for (const row of acikRows || []) {
    const tur = turBul(row.tur_id);
    if (!tur) continue;
    const maxCalisan = maxCalisanHesapla(tur, row.kapasite_seviye || 0);
    const calisanSayisi = row.calisan_sayisi || 0;
    ilanlar.push({
      id: row.id,
      isim: row.isim,
      aciklama: row.aciklama || "",
      turId: tur.id,
      turAd: tur.ad,
      turEmoji: tur.emoji,
      sahipAdi: row.sahip_reis_adi || row.sahip_adi,
      sahipUserId: row.sahip_user_id,
      calisanSayisi,
      maxCalisan,
      bosKoltuk: maxCalisan - calisanSayisi,
      kadroDolu: calisanSayisi >= maxCalisan,
      benimSirketim: row.sahip_user_id === userId,
      basvuruYapildi: !!basvuruHaritasi[row.id],
      basvuruPozisyonId: basvuruHaritasi[row.id] || null,
      pozisyonlar: (tur.pozisyonlar || []).map((p) => ({
        ...pozisyonOzet(p, yetenekler),
        basvuruYapildi: basvuruHaritasi[row.id] === p.id,
      })),
    });
  }

  return {
    ilanlar,
    basvuruYapabilir: !engelNedeni,
    engelNedeni,
    sahipSirketim: !!sahipSirket,
    sahipSirket: sahipSirket
      ? {
          id: sahipSirket.id,
          isim: sahipSirket.isim,
          iseAlimAcik: iseAlimAcikMi(sahipSirket.ise_alim_acik),
        }
      : null,
  };
}

module.exports = {
  ensureSirketTables,
  panelGetir,
  processSirketEkonomisi,
  sirketGunleriIsle,
  calisanMaasOde,
  calisanGetir,
  olustur,
  yatir,
  cek,
  iseAlimToggle,
  basvur,
  basvuruKabul,
  basvuruRed,
  maasGuncelle,
  istenCikar,
  kapat,
  istifaEt,
  zamTalepEt,
  zamTalepOnayla,
  zamTalepReddet,
  egitimVer,
  malzemeAl,
  upgrade,
  reklamAyarla,
  fiyatAyarla,
  isIlanlariGetir,
  bekleyenSirketBasvuruSayisi,
  meslekMenuBildirimVarMi,
};
