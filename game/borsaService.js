const { run, get, all } = require("../db/database");
const {
  BORSA_MIN_ISLEM,
  BORSA_ADET_UST_SINIR,
  BORSA_FIYAT_MIN,
  BORSA_FIYAT_MIN_CARPAN,
  BORSA_FIYAT_MAX_CARPAN,
  BORSA_MEAN_REVERT_ORAN,
  BORSA_RASTGELE_CARPAN,
  BORSA_ISLEM_ETKI_MAX,
  BORSA_ISLEM_HACIM_REF,
  BORSA_SIRKETLERI,
  borsaSirketBul,
} = require("./borsaCatalog");

const TEMETTU_GUN = 1;
const TEMETTU_SAAT = 10;

function turkeyNowParts() {
  const now = new Date();
  const trStr = now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" });
  const trDate = new Date(trStr);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
    .formatToParts(now)
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10) || 0,
    minute: parseInt(parts.minute, 10) || 0,
    weekday: trDate.getDay(),
  };
}

function haftaAnahtari() {
  const d = new Date();
  const tr = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const onejan = new Date(tr.getFullYear(), 0, 1);
  const week = Math.ceil(((tr - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${tr.getFullYear()}-H${week}`;
}

function degisimYuzde(fiyat, onceki) {
  if (!onceki || onceki <= 0) return 0;
  return Math.round(((fiyat - onceki) / onceki) * 1000) / 10;
}

function borsaBazFiyat(sirketId, mevcutFiyat) {
  const kat = borsaSirketBul(sirketId);
  return kat?.bazFiyat || mevcutFiyat || BORSA_FIYAT_MIN;
}

function fiyatSinirla(sirketId, fiyat) {
  const baz = borsaBazFiyat(sirketId, fiyat);
  const min = Math.max(BORSA_FIYAT_MIN, Math.floor(baz * BORSA_FIYAT_MIN_CARPAN));
  const max = Math.max(min + 1, Math.floor(baz * BORSA_FIYAT_MAX_CARPAN));
  return Math.min(max, Math.max(min, Math.round(fiyat)));
}

async function fiyatKaydet(db, sirketId, yeniFiyat) {
  const sinirli = fiyatSinirla(sirketId, yeniFiyat);
  const now = Math.floor(Date.now() / 1000);
  await run(
    db,
    `UPDATE borsa_sirketleri SET onceki_fiyat = fiyat, fiyat = ?, guncelleme = ? WHERE id = ?`,
    [sinirli, now, sirketId]
  );
  return sinirli;
}

async function islemFiyatEtkisi(db, sirketId, tur, adet) {
  const row = await get(db, `SELECT fiyat FROM borsa_sirketleri WHERE id = ?`, [sirketId]);
  if (!row) return;
  const fiyat = sayi(row.fiyat);
  if (fiyat <= 0) return;
  const hacim = Math.max(1, sayi(adet));
  const oran = Math.min(BORSA_ISLEM_ETKI_MAX, (hacim / BORSA_ISLEM_HACIM_REF) * BORSA_ISLEM_ETKI_MAX);
  const carp = tur === "al" ? 1 + oran : 1 - oran;
  await fiyatKaydet(db, sirketId, fiyat * carp);
}

async function fiyatlariBazaYakinlastir(db) {
  const tum = await all(db, `SELECT id, fiyat FROM borsa_sirketleri`);
  for (const row of tum) {
    const sinirli = fiyatSinirla(row.id, row.fiyat);
    if (sinirli !== row.fiyat) {
      await fiyatKaydet(db, row.id, sinirli);
    }
  }
}

async function ensureBorsaTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS borsa_sirketleri (
      id TEXT PRIMARY KEY,
      ad TEXT NOT NULL,
      sektor TEXT NOT NULL,
      fiyat INTEGER NOT NULL,
      onceki_fiyat INTEGER NOT NULL,
      temettu_oran REAL NOT NULL,
      volatilite REAL NOT NULL,
      aciklama TEXT NOT NULL DEFAULT '',
      guncelleme INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS borsa_portfoy (
      user_id INTEGER NOT NULL,
      sirket_id TEXT NOT NULL,
      adet INTEGER NOT NULL DEFAULT 0,
      ortalama_maliyet REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, sirket_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS borsa_islem_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sirket_id TEXT NOT NULL,
      tur TEXT NOT NULL,
      adet INTEGER NOT NULL,
      fiyat INTEGER NOT NULL,
      toplam INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS borsa_emirleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sirket_id TEXT NOT NULL,
      tur TEXT NOT NULL,
      adet INTEGER NOT NULL,
      hedef_fiyat INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'beklemede',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_borsa_emirleri_beklemede ON borsa_emirleri(durum, sirket_id)`
  );

  for (const s of BORSA_SIRKETLERI) {
    const mevcut = await get(db, `SELECT id FROM borsa_sirketleri WHERE id = ?`, [s.id]);
    if (!mevcut) {
      await run(
        db,
        `INSERT INTO borsa_sirketleri (id, ad, sektor, fiyat, onceki_fiyat, temettu_oran, volatilite, aciklama)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.ad, s.sektor, s.bazFiyat, s.bazFiyat, s.temettuOran, s.volatilite, s.aciklama]
      );
    }
  }
  await fiyatlariBazaYakinlastir(db);
}

async function panelGetir(db, userId) {
  await ensureBorsaTables(db);
  const kasaRow = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [userId]);
  const kasa = sayi(kasaRow?.kasa);
  const bekleyenAlMaliyet = await bekleyenAlEmirMaliyeti(db, userId, null);
  const sirketler = await all(
    db,
    `SELECT id, ad, sektor, fiyat, onceki_fiyat, temettu_oran, aciklama FROM borsa_sirketleri ORDER BY ad ASC`
  );
  const portfoy = await all(
    db,
    `SELECT p.sirket_id, p.adet, p.ortalama_maliyet, s.ad, s.fiyat, s.sektor
     FROM borsa_portfoy p
     JOIN borsa_sirketleri s ON s.id = p.sirket_id
     WHERE p.user_id = ? AND p.adet > 0`,
    [userId]
  );

  let toplamMaliyet = 0;
  let toplamDeger = 0;
  const portfoyListe = portfoy.map((p) => {
    const deger = p.adet * p.fiyat;
    const maliyet = p.adet * p.ortalama_maliyet;
    toplamDeger += deger;
    toplamMaliyet += maliyet;
    return {
      sirketId: p.sirket_id,
      ad: p.ad,
      sektor: p.sektor,
      adet: p.adet,
      fiyat: p.fiyat,
      ortalamaMaliyet: Math.round(p.ortalama_maliyet),
      deger,
      karZarar: deger - maliyet,
    };
  });

  const emirler = await all(
    db,
    `SELECT e.id, e.sirket_id, e.tur, e.adet, e.hedef_fiyat, e.created_at, s.ad, s.fiyat
     FROM borsa_emirleri e
     JOIN borsa_sirketleri s ON s.id = e.sirket_id
     WHERE e.user_id = ? AND e.durum = 'beklemede'
     ORDER BY e.created_at DESC`,
    [userId]
  );
  const bekleyenSatMap = {};
  for (const row of emirler) {
    if (row.tur !== "sat") continue;
    bekleyenSatMap[row.sirket_id] = (bekleyenSatMap[row.sirket_id] || 0) + sayi(row.adet);
  }

  return {
    ok: true,
    sirketler: sirketler.map((s) => {
      const port = portfoyListe.find((p) => p.sirketId === s.id);
      const elde = sayi(port?.adet);
      const bekleyenSat = sayi(bekleyenSatMap[s.id]);
      return {
        id: s.id,
        ad: s.ad,
        sektor: s.sektor,
        fiyat: s.fiyat,
        oncekiFiyat: s.onceki_fiyat,
        degisim: degisimYuzde(s.fiyat, s.onceki_fiyat),
        temettuOran: s.temettu_oran,
        temettuYuzde: Math.round((s.temettu_oran || 0) * 1000) / 10,
        aciklama: s.aciklama,
        elde,
        bekleyenSatAdet: bekleyenSat,
        satilabilirAdet: Math.max(0, elde - bekleyenSat),
      };
    }),
    portfoy: portfoyListe.map((p) => {
      const bekleyenSat = sayi(bekleyenSatMap[p.sirketId]);
      return {
        ...p,
        bekleyenSatAdet: bekleyenSat,
        satilabilirAdet: Math.max(0, sayi(p.adet) - bekleyenSat),
      };
    }),
    emirler: emirler.map((e) => ({
      id: e.id,
      sirketId: e.sirket_id,
      ad: e.ad,
      tur: e.tur,
      adet: e.adet,
      hedefFiyat: e.hedef_fiyat,
      guncelFiyat: e.fiyat,
      createdAt: e.created_at,
    })),
    ozet: {
      kasa,
      bekleyenAlMaliyet,
      kullanilabilirKasa: Math.max(0, kasa - bekleyenAlMaliyet),
      toplamDeger,
      toplamMaliyet,
      karZarar: toplamDeger - toplamMaliyet,
      pozisyonSayisi: portfoyListe.length,
      emirSayisi: emirler.length,
    },
    minIslem: BORSA_MIN_ISLEM,
  };
}

function sayi(deger, varsayilan = 0) {
  const n = Number(deger);
  return Number.isFinite(n) ? n : varsayilan;
}

async function oyuncuKasaYenile(db, userId, player) {
  const row = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [userId]);
  const kasa = sayi(row?.kasa, sayi(player?.kasa));
  if (player) player.kasa = kasa;
  return kasa;
}

function parseHedefFiyat(fiyat) {
  const hedef = Math.floor(sayi(fiyat, NaN));
  if (!Number.isFinite(hedef) || hedef < BORSA_FIYAT_MIN) {
    return { ok: false, error: "Geçerli hedef fiyat gir." };
  }
  return { ok: true, fiyat: hedef };
}

function parseIslemAdedi(adet) {
  const miktar = Math.floor(sayi(adet, NaN));
  if (!Number.isFinite(miktar) || miktar < BORSA_MIN_ISLEM) {
    return { ok: false, error: "Geçerli hisse adedi gir." };
  }
  if (miktar > BORSA_ADET_UST_SINIR) {
    return { ok: false, error: "Girilen adet çok yüksek." };
  }
  return { ok: true, miktar };
}

async function hisseAl(db, userId, player, sirketId, adet) {
  await ensureBorsaTables(db);
  const parsed = parseIslemAdedi(adet);
  if (!parsed.ok) return parsed;
  const miktar = parsed.miktar;

  const sirket = await get(
    db,
    `SELECT id, ad, fiyat FROM borsa_sirketleri WHERE id = ?`,
    [String(sirketId || "").toUpperCase()]
  );
  if (!sirket) return { ok: false, error: "Hisse bulunamadı." };

  const toplam = miktar * sirket.fiyat;
  const digerAlMaliyet = await bekleyenAlEmirMaliyeti(db, userId, null);
  const guncelKasa = await oyuncuKasaYenile(db, userId, player);
  const kullanilabilirKasa = guncelKasa - digerAlMaliyet;
  if (kullanilabilirKasa < toplam) {
    return {
      ok: false,
      error: `Yeterli paran yok! ${toplam.toLocaleString("tr-TR")} TL gerekir${digerAlMaliyet > 0 ? " (bekleyen alış emirleri dahil)" : ""}.`,
    };
  }

  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
    [toplam, userId, toplam]
  );
  if (!deduct?.changes) {
    return {
      ok: false,
      error:
        digerAlMaliyet > 0
          ? "Yeterli paran yok (bekleyen alış emirleri nakit ayırdı)."
          : "Yeterli paran yok.",
    };
  }

  const mevcut = await get(
    db,
    `SELECT adet, ortalama_maliyet FROM borsa_portfoy WHERE user_id = ? AND sirket_id = ?`,
    [userId, sirket.id]
  );
  let yeniAdet = miktar;
  let ortMaliyet = sirket.fiyat;
  if (mevcut && mevcut.adet > 0) {
    yeniAdet = mevcut.adet + miktar;
    ortMaliyet = (mevcut.adet * mevcut.ortalama_maliyet + miktar * sirket.fiyat) / yeniAdet;
  }

  await run(
    db,
    `INSERT INTO borsa_portfoy (user_id, sirket_id, adet, ortalama_maliyet)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, sirket_id) DO UPDATE SET adet = ?, ortalama_maliyet = ?`,
    [userId, sirket.id, yeniAdet, ortMaliyet, yeniAdet, ortMaliyet]
  );

  await run(
    db,
    `INSERT INTO borsa_islem_log (user_id, sirket_id, tur, adet, fiyat, toplam) VALUES (?, ?, 'al', ?, ?, ?)`,
    [userId, sirket.id, miktar, sirket.fiyat, toplam]
  );

  await islemFiyatEtkisi(db, sirket.id, "al", miktar);

  player.kasa -= toplam;

  return {
    ok: true,
    mesaj: `${miktar.toLocaleString("tr-TR")} adet ${sirket.ad} (${sirket.id}) alındı — ${toplam.toLocaleString("tr-TR")} TL.`,
    sirketId: sirket.id,
    adet: miktar,
    fiyat: sirket.fiyat,
    toplam,
  };
}

async function hisseSat(db, userId, player, sirketId, adet) {
  await ensureBorsaTables(db);
  const parsed = parseIslemAdedi(adet);
  if (!parsed.ok) return parsed;
  const miktar = parsed.miktar;

  const sirket = await get(
    db,
    `SELECT id, ad, fiyat FROM borsa_sirketleri WHERE id = ?`,
    [String(sirketId || "").toUpperCase()]
  );
  if (!sirket) return { ok: false, error: "Hisse bulunamadı." };

  const poz = await get(
    db,
    `SELECT adet FROM borsa_portfoy WHERE user_id = ? AND sirket_id = ?`,
    [userId, sirket.id]
  );
  const elde = sayi(poz?.adet);
  const rezerve = await bekleyenSatEmirAdedi(db, userId, sirket.id, null);
  const satilabilir = Math.max(0, elde - rezerve);
  if (miktar > satilabilir) {
    return {
      ok: false,
      error:
        satilabilir > 0
          ? `En fazla ${satilabilir.toLocaleString("tr-TR")} adet satabilirsin (bekleyen satış emirleri dahil).`
          : "Portföyünde satış emrine ayırabileceğin hisse kalmadı.",
    };
  }

  const toplam = miktar * sirket.fiyat;
  const kalan = elde - miktar;

  if (kalan <= 0) {
    await run(db, `DELETE FROM borsa_portfoy WHERE user_id = ? AND sirket_id = ?`, [
      userId,
      sirket.id,
    ]);
  } else {
    await run(db, `UPDATE borsa_portfoy SET adet = ? WHERE user_id = ? AND sirket_id = ?`, [
      kalan,
      userId,
      sirket.id,
    ]);
  }

  await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [toplam, userId]);
  await run(
    db,
    `INSERT INTO borsa_islem_log (user_id, sirket_id, tur, adet, fiyat, toplam) VALUES (?, ?, 'sat', ?, ?, ?)`,
    [userId, sirket.id, miktar, sirket.fiyat, toplam]
  );

  await islemFiyatEtkisi(db, sirket.id, "sat", miktar);

  player.kasa += toplam;

  return {
    ok: true,
    mesaj: `${miktar.toLocaleString("tr-TR")} adet ${sirket.ad} satıldı — ${toplam.toLocaleString("tr-TR")} TL kasaya geçti.`,
    sirketId: sirket.id,
    adet: miktar,
    fiyat: sirket.fiyat,
    toplam,
  };
}

async function bekleyenSatEmirAdedi(db, userId, sirketId, haricEmirId) {
  const row = await get(
    db,
    `SELECT COALESCE(SUM(adet), 0) AS toplam
     FROM borsa_emirleri
     WHERE user_id = ? AND sirket_id = ? AND tur = 'sat' AND durum = 'beklemede'
       AND (? IS NULL OR id != ?)`,
    [userId, sirketId, haricEmirId ?? null, haricEmirId ?? null]
  );
  return sayi(row?.toplam);
}

async function bekleyenAlEmirMaliyeti(db, userId, haricEmirId) {
  const row = await get(
    db,
    `SELECT COALESCE(SUM(adet * hedef_fiyat), 0) AS toplam
     FROM borsa_emirleri
     WHERE user_id = ? AND tur = 'al' AND durum = 'beklemede'
       AND (? IS NULL OR id != ?)`,
    [userId, haricEmirId ?? null, haricEmirId ?? null]
  );
  return sayi(row?.toplam);
}

async function emirTekCalistir(db, emirId) {
  const emir = await get(
    db,
    `SELECT e.id, e.user_id, e.sirket_id, e.tur, e.adet, e.hedef_fiyat, e.durum, s.fiyat, s.ad
     FROM borsa_emirleri e
     JOIN borsa_sirketleri s ON s.id = e.sirket_id
     WHERE e.id = ?`,
    [emirId]
  );
  if (!emir || emir.durum !== "beklemede") return { ok: false, skipped: "emir_yok" };

  const tetikle =
    emir.tur === "al"
      ? sayi(emir.fiyat) <= sayi(emir.hedef_fiyat)
      : sayi(emir.fiyat) >= sayi(emir.hedef_fiyat);
  if (!tetikle) return { ok: false, skipped: "fiyat_uygun_degil" };

  const kasaRow = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [emir.user_id]);
  if (!kasaRow) return { ok: false, skipped: "oyuncu_yok" };

  const player = { kasa: sayi(kasaRow.kasa) };
  const sonuc =
    emir.tur === "al"
      ? await hisseAl(db, emir.user_id, player, emir.sirket_id, emir.adet)
      : await hisseSat(db, emir.user_id, player, emir.sirket_id, emir.adet);

  if (!sonuc.ok) return sonuc;

  await run(db, `UPDATE borsa_emirleri SET durum = 'gerceklesti' WHERE id = ?`, [emir.id]);

  const { bildirimGonder } = require("./bildirimService");
  const turMetin = emir.tur === "al" ? "Alış" : "Satış";
  await bildirimGonder(db, emir.user_id, "borsa_emir", {
    baslik: "Borsa Emri Gerçekleşti",
    icerik: `${emir.ad} ${turMetin} emri ${sayi(emir.adet).toLocaleString("tr-TR")} adet @ ${sayi(emir.fiyat).toLocaleString("tr-TR")} TL fiyatından işlendi.`,
    url: "/?ekran=borsa",
  }).catch(() => {});

  return { ok: true, gerceklesti: true, mesaj: sonuc.mesaj };
}

async function emirEkle(db, userId, player, sirketId, tur, adet, hedefFiyat) {
  await ensureBorsaTables(db);
  const parsedAdet = parseIslemAdedi(adet);
  if (!parsedAdet.ok) return parsedAdet;
  const parsedFiyat = parseHedefFiyat(hedefFiyat);
  if (!parsedFiyat.ok) return parsedFiyat;

  const turNorm = String(tur || "").toLowerCase() === "sat" ? "sat" : "al";
  const miktar = parsedAdet.miktar;
  const hedef = parsedFiyat.fiyat;

  const sirket = await get(
    db,
    `SELECT id, ad, fiyat FROM borsa_sirketleri WHERE id = ?`,
    [String(sirketId || "").toUpperCase()]
  );
  if (!sirket) return { ok: false, error: "Hisse bulunamadı." };

  if (turNorm === "al") {
    const maliyet = miktar * hedef;
    const digerMaliyet = await bekleyenAlEmirMaliyeti(db, userId, null);
    const guncelKasa = await oyuncuKasaYenile(db, userId, player);
    if (guncelKasa < maliyet + digerMaliyet) {
      return {
        ok: false,
        error: `Emir için yeterli paran yok. Hedef fiyat × adet: ${maliyet.toLocaleString("tr-TR")} TL (bekleyen alış emirleri dahil).`,
      };
    }
  } else {
    const poz = await get(
      db,
      `SELECT adet FROM borsa_portfoy WHERE user_id = ? AND sirket_id = ?`,
      [userId, sirket.id]
    );
    const elde = sayi(poz?.adet);
    const rezerve = await bekleyenSatEmirAdedi(db, userId, sirket.id, null);
    const satilabilir = Math.max(0, elde - rezerve);
    if (miktar > satilabilir) {
      return {
        ok: false,
        error:
          satilabilir > 0
            ? `En fazla ${satilabilir.toLocaleString("tr-TR")} adet satış emri verebilirsin (bekleyen emirler dahil).`
            : "Portföyünde satış emrine ayırabileceğin hisse kalmadı.",
      };
    }
  }

  const insert = await run(
    db,
    `INSERT INTO borsa_emirleri (user_id, sirket_id, tur, adet, hedef_fiyat) VALUES (?, ?, ?, ?, ?)`,
    [userId, sirket.id, turNorm, miktar, hedef]
  );
  const emirId = insert?.lastID;

  let anindaMesaj = "";
  let emirDurum = "beklemede";
  if (emirId) {
    const aninda = await emirTekCalistir(db, emirId);
    if (aninda.ok && aninda.gerceklesti && aninda.mesaj) {
      anindaMesaj = ` ${aninda.mesaj}`;
      emirDurum = "gerceklesti";
    }
  }

  const turMetin = turNorm === "al" ? "Alış" : "Satış";
  return {
    ok: true,
    mesaj: `${miktar.toLocaleString("tr-TR")} adet ${sirket.ad} ${turMetin} emri — hedef ${hedef.toLocaleString("tr-TR")} TL (güncel ${sirket.fiyat.toLocaleString("tr-TR")} TL).${anindaMesaj}`,
    emirId,
    emirDurum,
    sirketId: sirket.id,
    tur: turNorm,
    adet: miktar,
    hedefFiyat: hedef,
  };
}

async function emirIptal(db, userId, emirId) {
  await ensureBorsaTables(db);
  const id = parseInt(emirId, 10);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Geçersiz emir." };

  const emir = await get(
    db,
    `SELECT e.id, e.tur, e.adet, e.hedef_fiyat, s.ad
     FROM borsa_emirleri e
     JOIN borsa_sirketleri s ON s.id = e.sirket_id
     WHERE e.id = ? AND e.user_id = ? AND e.durum = 'beklemede'`,
    [id, userId]
  );
  if (!emir) return { ok: false, error: "Emir bulunamadı veya zaten kapalı." };

  await run(db, `UPDATE borsa_emirleri SET durum = 'iptal' WHERE id = ?`, [id]);

  const turMetin = emir.tur === "al" ? "Alış" : "Satış";
  return {
    ok: true,
    mesaj: `${emir.ad} ${turMetin} emri iptal edildi (${emir.adet} adet @ ${emir.hedef_fiyat.toLocaleString("tr-TR")} TL).`,
    emirId: id,
  };
}

async function emirleriIsle(db) {
  await ensureBorsaTables(db);
  const emirler = await all(
    db,
    `SELECT id FROM borsa_emirleri WHERE durum = 'beklemede' ORDER BY created_at ASC, id ASC`
  );

  let gerceklesen = 0;
  for (const emir of emirler) {
    const sonuc = await emirTekCalistir(db, emir.id);
    if (sonuc.ok && sonuc.gerceklesti) gerceklesen += 1;
  }

  return { ok: true, gerceklesen };
}

async function fiyatGuncelle(db) {
  await ensureBorsaTables(db);
  const sirketler = await all(
    db,
    `SELECT id, fiyat, volatilite FROM borsa_sirketleri`
  );
  for (const s of sirketler) {
    const kat = borsaSirketBul(s.id);
    const baz = borsaBazFiyat(s.id, s.fiyat);
    const vol = kat?.volatilite || s.volatilite || 0.04;
    const fiyat = sayi(s.fiyat) || baz;

    const gapOran = baz > 0 ? (baz - fiyat) / baz : 0;
    const meanRevert = gapOran * BORSA_MEAN_REVERT_ORAN;
    const randomShock = (Math.random() - 0.5) * 2 * vol * BORSA_RASTGELE_CARPAN;
    const degisim = meanRevert + randomShock;
    const yeni = fiyat * (1 + degisim);

    await fiyatKaydet(db, s.id, yeni);
  }
  await emirleriIsle(db);
}

async function temettuIsle(db) {
  const { hour, minute, weekday } = turkeyNowParts();
  if (weekday !== TEMETTU_GUN) return { ok: true, processed: 0, skipped: "gun_degil" };
  if (hour !== TEMETTU_SAAT || minute > 5) return { ok: true, processed: 0, skipped: "saat_degil" };

  const hafta = haftaAnahtari();
  const row = await get(db, `SELECT deger FROM sistem_gunluk WHERE anahtar = ?`, [
    `borsa_temettu_${hafta}`,
  ]);
  if (row?.deger === hafta) return { ok: true, processed: 0, skipped: "zaten_islendi" };

  await ensureBorsaTables(db);
  const pozisyonlar = await all(
    db,
    `SELECT p.user_id, p.adet, s.fiyat, s.temettu_oran, s.ad
     FROM borsa_portfoy p
     JOIN borsa_sirketleri s ON s.id = p.sirket_id
     WHERE p.adet > 0`
  );

  let toplamOdeme = 0;
  const kullaniciOdemeler = {};

  for (const p of pozisyonlar) {
    const deger = p.adet * p.fiyat;
    const odeme = Math.max(0, Math.floor(deger * (p.temettu_oran || 0)));
    if (odeme <= 0) continue;
    kullaniciOdemeler[p.user_id] = (kullaniciOdemeler[p.user_id] || 0) + odeme;
    toplamOdeme += odeme;
  }

  for (const [uid, odeme] of Object.entries(kullaniciOdemeler)) {
    const { bankaDogrudanYatir } = require("./bankaService");
    await bankaDogrudanYatir(db, parseInt(uid, 10), odeme);
    const { bildirimGonder } = require("./bildirimService");
    await bildirimGonder(db, parseInt(uid, 10), "borsa_temettu", {
      baslik: "Borsa Temettüsü",
      icerik: `Haftalık temettü yattı: ${odeme.toLocaleString("tr-TR")} TL banka hesabına eklendi.`,
      url: "/?ekran=borsa",
    }).catch(() => {});
  }

  await run(
    db,
    `INSERT OR REPLACE INTO sistem_gunluk (anahtar, deger, guncelleme) VALUES (?, ?, strftime('%s','now'))`,
    [`borsa_temettu_${hafta}`, hafta]
  );

  return { ok: true, processed: Object.keys(kullaniciOdemeler).length, toplamOdeme, hafta };
}

async function oyuncuBorsaGetir(db, userId) {
  await ensureBorsaTables(db);
  const portfoy = await all(
    db,
    `SELECT p.sirket_id, p.adet, p.ortalama_maliyet, s.ad, s.fiyat
     FROM borsa_portfoy p
     JOIN borsa_sirketleri s ON s.id = p.sirket_id
     WHERE p.user_id = ? AND p.adet > 0
     ORDER BY s.ad ASC`,
    [userId]
  );
  const emirler = await all(
    db,
    `SELECT e.id, e.sirket_id, e.tur, e.adet, e.hedef_fiyat, e.created_at, s.ad, s.fiyat
     FROM borsa_emirleri e
     JOIN borsa_sirketleri s ON s.id = e.sirket_id
     WHERE e.user_id = ? AND e.durum = 'beklemede'
     ORDER BY e.created_at DESC`,
    [userId]
  );
  const islemler = await all(
    db,
    `SELECT l.id, l.sirket_id, l.tur, l.adet, l.fiyat, l.toplam, l.created_at, s.ad
     FROM borsa_islem_log l
     JOIN borsa_sirketleri s ON s.id = l.sirket_id
     WHERE l.user_id = ?
     ORDER BY l.created_at DESC
     LIMIT 20`,
    [userId]
  );

  let toplamDeger = 0;
  let toplamMaliyet = 0;
  const pozisyonlar = portfoy.map((p) => {
    const deger = sayi(p.adet) * sayi(p.fiyat);
    const maliyet = sayi(p.adet) * sayi(p.ortalama_maliyet);
    toplamDeger += deger;
    toplamMaliyet += maliyet;
    return {
      sirketId: p.sirket_id,
      ad: p.ad,
      adet: p.adet,
      fiyat: p.fiyat,
      ortalamaMaliyet: Math.round(p.ortalama_maliyet),
      deger,
      karZarar: deger - maliyet,
    };
  });

  return {
    pozisyonlar,
    emirler: emirler.map((e) => ({
      id: e.id,
      sirketId: e.sirket_id,
      ad: e.ad,
      tur: e.tur,
      adet: e.adet,
      hedefFiyat: e.hedef_fiyat,
      guncelFiyat: e.fiyat,
      createdAt: e.created_at,
    })),
    sonIslemler: islemler.map((l) => ({
      id: l.id,
      sirketId: l.sirket_id,
      ad: l.ad,
      tur: l.tur,
      adet: l.adet,
      fiyat: l.fiyat,
      toplam: l.toplam,
      createdAt: l.created_at,
    })),
    ozet: {
      toplamDeger,
      toplamMaliyet,
      karZarar: toplamDeger - toplamMaliyet,
      pozisyonSayisi: pozisyonlar.length,
      emirSayisi: emirler.length,
    },
  };
}

async function adminBorsaOzet(db) {
  await ensureBorsaTables(db);
  const stats = await get(
    db,
    `SELECT
      (SELECT COUNT(DISTINCT user_id) FROM borsa_portfoy WHERE adet > 0) AS yatirimci_sayisi,
      (SELECT COUNT(*) FROM borsa_emirleri WHERE durum = 'beklemede') AS bekleyen_emir,
      (SELECT COALESCE(SUM(p.adet * s.fiyat), 0) FROM borsa_portfoy p JOIN borsa_sirketleri s ON s.id = p.sirket_id) AS toplam_portfoy_deger,
      (SELECT COUNT(*) FROM borsa_islem_log WHERE created_at > strftime('%s','now') - 86400) AS islem_24s`
  );
  const sirketler = await all(
    db,
    `SELECT id, ad, sektor, fiyat, onceki_fiyat, temettu_oran, volatilite, guncelleme
     FROM borsa_sirketleri ORDER BY ad ASC`
  );
  const sonEmirler = await all(
    db,
    `SELECT e.id, e.user_id, e.tur, e.adet, e.hedef_fiyat, e.durum, e.created_at, s.ad AS sirket_ad, u.reis_adi
     FROM borsa_emirleri e
     JOIN borsa_sirketleri s ON s.id = e.sirket_id
     JOIN users u ON u.id = e.user_id
     ORDER BY e.created_at DESC
     LIMIT 30`
  );
  return {
    stats: stats || {},
    sirketler: sirketler.map((s) => ({
      id: s.id,
      ad: s.ad,
      sektor: s.sektor,
      fiyat: s.fiyat,
      oncekiFiyat: s.onceki_fiyat,
      degisim: degisimYuzde(s.fiyat, s.onceki_fiyat),
      temettuYuzde: Math.round((s.temettu_oran || 0) * 1000) / 10,
      volatilite: s.volatilite,
      guncelleme: s.guncelleme,
    })),
    sonEmirler: sonEmirler.map((e) => ({
      id: e.id,
      userId: e.user_id,
      reisAdi: e.reis_adi,
      sirketAd: e.sirket_ad,
      tur: e.tur,
      adet: e.adet,
      hedefFiyat: e.hedef_fiyat,
      durum: e.durum,
      createdAt: e.created_at,
    })),
  };
}

module.exports = {
  ensureBorsaTables,
  panelGetir,
  hisseAl,
  hisseSat,
  emirEkle,
  emirIptal,
  emirleriIsle,
  fiyatGuncelle,
  temettuIsle,
  oyuncuBorsaGetir,
  adminBorsaOzet,
};
