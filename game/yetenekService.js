const { run, get } = require("../db/database");
const {
  YETENEK_ETIKET,
  YETENEK_ANAHTARLAR,
  GUNLUK_ANTRENMAN_LIMIT,
  ANTRENMAN_KAZANC,
  BASLANGIC_YETENEK,
  yetenekleriNormalize,
  yetenekOzeti,
  antrenmanMaliyet,
} = require("./yetenekCatalog");

function istanbulGunKey(tarih) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tarih || new Date());
}

async function ensureYetenekAntrenman(db) {
  const cols = [
    ["yetenek_son_antrenman_gunu", "TEXT"],
    ["yetenek_antrenman_sayisi", "INTEGER NOT NULL DEFAULT 0"],
    ["yetenek_maas_antrenman_puani", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of cols) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
}

async function yetenekSatirlariOku(db, userId) {
  const row = await get(
    db,
    `SELECT yetenek_guc, yetenek_zeka, yetenek_dayaniklilik, yetenek_beceri
     FROM players WHERE user_id = ?`,
    [userId]
  );
  return {
    guc: row?.yetenek_guc ?? BASLANGIC_YETENEK,
    zeka: row?.yetenek_zeka ?? BASLANGIC_YETENEK,
    dayaniklilik: row?.yetenek_dayaniklilik ?? BASLANGIC_YETENEK,
    beceri: row?.yetenek_beceri ?? BASLANGIC_YETENEK,
  };
}

async function yetenekSatirlariYaz(db, userId, yetenekler) {
  const normalized = yetenekleriNormalize(yetenekler);
  await run(
    db,
    `UPDATE players SET
      yetenek_guc = ?,
      yetenek_zeka = ?,
      yetenek_dayaniklilik = ?,
      yetenek_beceri = ?
     WHERE user_id = ?`,
    [normalized.guc, normalized.zeka, normalized.dayaniklilik, normalized.beceri, userId]
  );
  return normalized;
}

async function antrenmanDurumuGetir(db, userId) {
  await ensureYetenekAntrenman(db);
  const bugun = istanbulGunKey();
  const row = await get(
    db,
    `SELECT yetenek_son_antrenman_gunu, yetenek_antrenman_sayisi FROM players WHERE user_id = ?`,
    [userId]
  );
  const kullanilan =
    row?.yetenek_son_antrenman_gunu === bugun ? row.yetenek_antrenman_sayisi || 0 : 0;
  return {
    gunlukLimit: GUNLUK_ANTRENMAN_LIMIT,
    kullanilan,
    kalan: Math.max(0, GUNLUK_ANTRENMAN_LIMIT - kullanilan),
  };
}

async function antrenmanPanelGetir(db, userId, yetenekler) {
  const durum = await antrenmanDurumuGetir(db, userId);
  const ozet = yetenekOzeti(yetenekler);
  const maasAntrenmanPuani = await maasAntrenmanPuaniGetir(db, userId);
  return {
    ...durum,
    kazanc: ANTRENMAN_KAZANC,
    sinirsiz: true,
    statlar: ozet.statlar,
    ortalama: ozet.ortalama,
    genelKademe: ozet.kademe,
    maasAntrenmanPuani,
  };
}

async function maasAntrenmanPuaniGetir(db, userId) {
  await ensureYetenekAntrenman(db);
  const row = await get(
    db,
    `SELECT yetenek_maas_antrenman_puani FROM players WHERE user_id = ?`,
    [userId]
  );
  return row?.yetenek_maas_antrenman_puani || 0;
}

async function maasAntrenmanPuaniEkle(db, userId, miktar) {
  await ensureYetenekAntrenman(db);
  const add = Math.max(0, Math.floor(Number(miktar) || 0));
  if (!add) return 0;
  await run(
    db,
    `UPDATE players SET yetenek_maas_antrenman_puani = COALESCE(yetenek_maas_antrenman_puani, 0) + ? WHERE user_id = ?`,
    [add, userId]
  );
  return add;
}

async function maasAntrenmanKullan(db, userId, yetenekKey) {
  await ensureYetenekAntrenman(db);
  if (!YETENEK_ANAHTARLAR.includes(yetenekKey)) {
    return { ok: false, error: "Geçersiz yetenek." };
  }

  const mevcutPuani = await maasAntrenmanPuaniGetir(db, userId);
  if (mevcutPuani <= 0) {
    return { ok: false, error: "Kullanılabilir maaş antrenman puanın yok." };
  }

  const yetenekler = await yetenekSatirlariOku(db, userId);
  yetenekler[yetenekKey] = (yetenekler[yetenekKey] || 0) + ANTRENMAN_KAZANC;
  const normalized = await yetenekSatirlariYaz(db, userId, yetenekler);

  const sonuc = await run(
    db,
    `UPDATE players SET yetenek_maas_antrenman_puani = yetenek_maas_antrenman_puani - 1
     WHERE user_id = ? AND yetenek_maas_antrenman_puani > 0`,
    [userId]
  );
  if (!sonuc?.changes) {
    return { ok: false, error: "Antrenman puanı kullanılamadı. Tekrar dene." };
  }

  const kalan = mevcutPuani - 1;
  const etiket = YETENEK_ETIKET[yetenekKey] || yetenekKey;
  return {
    ok: true,
    mesaj: `${etiket} +${ANTRENMAN_KAZANC} (maaş antrenman puanı). Kalan puan: ${kalan}`,
    yetenek: yetenekKey,
    yeniDeger: normalized[yetenekKey],
    kalanMaasAntrenmanPuani: kalan,
    yetenekler: normalized,
  };
}

async function antrenmanYap(db, userId, player, yetenekKey) {
  await ensureYetenekAntrenman(db);
  if (!YETENEK_ANAHTARLAR.includes(yetenekKey)) {
    return { ok: false, error: "Geçersiz yetenek." };
  }

  const durum = await antrenmanDurumuGetir(db, userId);
  if (durum.kalan <= 0) {
    return {
      ok: false,
      error: `Günlük antrenman hakkın doldu (${GUNLUK_ANTRENMAN_LIMIT}/gün). Yarın tekrar dene.`,
    };
  }

  const yetenekler = await yetenekSatirlariOku(db, userId);
  const mevcut = yetenekler[yetenekKey] || 0;
  const maliyet = antrenmanMaliyet(mevcut);
  const deduct = await run(
    db,
    `UPDATE players SET kasa = kasa - ? WHERE user_id = ? AND kasa >= ?`,
    [maliyet, userId, maliyet]
  );
  if (!deduct?.changes) {
    const kasaRow = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [userId]);
    if ((kasaRow?.kasa ?? 0) < maliyet) {
      return { ok: false, error: `Antrenman için ${maliyet} TL gerekli.` };
    }
    return { ok: false, error: "Antrenman işlemi tamamlanamadı. Tekrar dene." };
  }

  yetenekler[yetenekKey] = mevcut + ANTRENMAN_KAZANC;
  const normalized = await yetenekSatirlariYaz(db, userId, yetenekler);

  const bugun = istanbulGunKey();
  const yeniSayac = durum.kullanilan + 1;

  await run(
    db,
    `UPDATE players SET yetenek_son_antrenman_gunu = ?, yetenek_antrenman_sayisi = ? WHERE user_id = ?`,
    [bugun, yeniSayac, userId]
  );

  const etiket = YETENEK_ETIKET[yetenekKey] || yetenekKey;
  return {
    ok: true,
    mesaj: `${etiket} +${ANTRENMAN_KAZANC} (${maliyet} TL). Kalan antrenman: ${GUNLUK_ANTRENMAN_LIMIT - yeniSayac}/${GUNLUK_ANTRENMAN_LIMIT}`,
    yetenek: yetenekKey,
    yeniDeger: normalized[yetenekKey],
    maliyet,
    kalanAntrenman: GUNLUK_ANTRENMAN_LIMIT - yeniSayac,
    yetenekler: normalized,
  };
}

module.exports = {
  ensureYetenekAntrenman,
  antrenmanDurumuGetir,
  antrenmanPanelGetir,
  antrenmanYap,
  maasAntrenmanPuaniGetir,
  maasAntrenmanPuaniEkle,
  maasAntrenmanKullan,
  yetenekOzeti,
  yetenekSatirlariOku,
  yetenekSatirlariYaz,
};
