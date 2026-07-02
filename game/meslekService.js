const { run, get } = require("../db/database");
const {
  ISYERLERI,
  BASLANGIC_YETENEK,
  MAX_GUNLUK_TELAFI,
  YETENEK_ETIKET,
  isyeriBul,
  meslekBul,
  isyeriMeslekleri,
  mulakatSorulari,
} = require("./meslekCatalog");
const { yetenekleriNormalize } = require("./yetenekCatalog");
const { ensureYetenekAntrenman, antrenmanPanelGetir } = require("./yetenekService");

const {
  istanbulGunKey,
  maasGunKey,
  maasSaatiGeldiMi,
  MAAS_RAPOR_SAATI,
} = require("./turkiyeSaati");

function gunFarki(baslangic, bitis) {
  const a = new Date(baslangic + "T12:00:00");
  const b = new Date(bitis + "T12:00:00");
  const fark = Math.floor((b - a) / 86400000);
  return Math.max(1, fark);
}

async function ensureMeslekTables(db) {
  await ensureYetenekAntrenman(db);
  const cols = [
    ["yetenek_guc", `INTEGER NOT NULL DEFAULT ${BASLANGIC_YETENEK}`],
    ["yetenek_zeka", `INTEGER NOT NULL DEFAULT ${BASLANGIC_YETENEK}`],
    ["yetenek_dayaniklilik", `INTEGER NOT NULL DEFAULT ${BASLANGIC_YETENEK}`],
    ["yetenek_beceri", `INTEGER NOT NULL DEFAULT ${BASLANGIC_YETENEK}`],
  ];
  for (const [col, def] of cols) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }

  await run(
    db,
    `UPDATE players SET
      yetenek_guc = ${BASLANGIC_YETENEK},
      yetenek_zeka = ${BASLANGIC_YETENEK},
      yetenek_dayaniklilik = ${BASLANGIC_YETENEK},
      yetenek_beceri = ${BASLANGIC_YETENEK}
     WHERE yetenek_guc IS NULL OR yetenek_guc < 1
        OR yetenek_zeka IS NULL OR yetenek_zeka < 1
        OR yetenek_dayaniklilik IS NULL OR yetenek_dayaniklilik < 1
        OR yetenek_beceri IS NULL OR yetenek_beceri < 1`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_meslek (
      user_id INTEGER PRIMARY KEY,
      meslek_id TEXT NOT NULL,
      ise_baslama INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      son_gelir_gunu TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
}

async function yetenekleriGetir(db, userId) {
  await ensureMeslekTables(db);
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

async function yetenekleriKaydet(db, userId, yetenekler) {
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

async function meslekGetir(db, userId) {
  await ensureMeslekTables(db);
  const row = await get(
    db,
    `SELECT meslek_id, ise_baslama, son_gelir_gunu FROM oyuncu_meslek WHERE user_id = ?`,
    [userId]
  );
  if (!row) return null;
  const meslek = meslekBul(row.meslek_id);
  if (!meslek) return null;
  const isyeri = isyeriBul(meslek.isyeriId);
  return {
    id: meslek.id,
    unvan: meslek.unvan,
    isyeriId: meslek.isyeriId,
    isyeriAd: isyeri ? isyeri.ad : meslek.isyeriId,
    npc: isyeri ? isyeri.npc : "",
    gunlukGelir: meslek.gunlukGelir,
    yetenekKazanc: meslek.yetenekKazanc,
    iseBaslama: row.ise_baslama,
    sonGelirGunu: row.son_gelir_gunu,
  };
}

function yetenekUygunMu(yetenekler, gereksinim) {
  const eksikler = [];
  for (const [key, min] of Object.entries(gereksinim || {})) {
    const mevcut = yetenekler[key] ?? 0;
    if (mevcut < min) {
      eksikler.push({
        yetenek: key,
        etiket: YETENEK_ETIKET[key] || key,
        min,
        mevcut,
      });
    }
  }
  return { uygun: eksikler.length === 0, eksikler };
}

function meslekOzet(meslek, yetenekler) {
  const kontrol = yetenekUygunMu(yetenekler, meslek.gereksinim);
  return {
    id: meslek.id,
    unvan: meslek.unvan,
    gunlukGelir: meslek.gunlukGelir,
    yetenekKazanc: meslek.yetenekKazanc,
    gereksinim: meslek.gereksinim,
    uygun: kontrol.uygun,
    eksikler: kontrol.eksikler,
    sorular: mulakatSorulari(meslek).map((s) => ({
      ...s,
      mevcut: yetenekler[s.yetenek] ?? 0,
      gecti: (yetenekler[s.yetenek] ?? 0) >= s.min,
    })),
  };
}

async function panelGetir(db, userId) {
  await ensureMeslekTables(db);
  const yetenekler = await yetenekleriGetir(db, userId);
  const aktifMeslek = await meslekGetir(db, userId);

  const isyerleri = ISYERLERI.map((isyeri) => ({
    ...isyeri,
    meslekler: isyeriMeslekleri(isyeri.id).map((m) => meslekOzet(m, yetenekler)),
  }));

  const antrenman = await antrenmanPanelGetir(db, userId, yetenekler);

  return {
    ok: true,
    yetenekler,
    aktifMeslek,
    isyerleri,
    antrenman,
  };
}

async function processMeslekGeliri(db, userId, player) {
  if (!maasSaatiGeldiMi()) {
    return { gelir: 0, gun: 0, bekliyor: true, maasSaati: MAAS_RAPOR_SAATI };
  }

  await ensureMeslekTables(db);
  const emp = await get(
    db,
    `SELECT meslek_id, son_gelir_gunu FROM oyuncu_meslek WHERE user_id = ?`,
    [userId]
  );
  if (!emp) return { gelir: 0, gun: 0 };

  const meslek = meslekBul(emp.meslek_id);
  if (!meslek) return { gelir: 0, gun: 0 };

  const bugun = maasGunKey();
  if (emp.son_gelir_gunu === bugun) return { gelir: 0, gun: 0 };

  let gun = 1;
  if (emp.son_gelir_gunu) {
    gun = Math.min(MAX_GUNLUK_TELAFI, gunFarki(emp.son_gelir_gunu, bugun));
  }

  if (!player) {
    const kasaRow = await get(db, `SELECT kasa FROM players WHERE user_id = ?`, [userId]);
    player = { kasa: kasaRow?.kasa ?? 0 };
  }

  const gelir = meslek.gunlukGelir * gun;
  player.kasa += gelir;

  const yetenekler = await yetenekleriGetir(db, userId);
  for (const [key, val] of Object.entries(meslek.yetenekKazanc || {})) {
    if (yetenekler[key] != null) yetenekler[key] += val * gun;
  }
  await yetenekleriKaydet(db, userId, yetenekler);
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  await run(db, `UPDATE oyuncu_meslek SET son_gelir_gunu = ? WHERE user_id = ?`, [
    bugun,
    userId,
  ]);

  const isyeri = isyeriBul(meslek.isyeriId);
  const sonuc = {
    gelir,
    gun,
    oyuncuKasaya: gelir > 0,
    meslek: {
      unvan: meslek.unvan,
      isyeriAd: isyeri ? isyeri.ad : meslek.isyeriId,
    },
    yetenekKazanc: meslek.yetenekKazanc,
  };
  if (gelir > 0) {
    const { bildirimGonder } = require("./bildirimService");
    bildirimGonder(db, userId, "is_maasi", {
      baslik: "İş Maaşın Yattı",
      icerik: `${meslek.unvan}: ${gelir.toLocaleString("tr-TR")} TL kasana eklendi.`,
      url: "/?ekran=meslekler",
    }).catch(() => {});
  }
  return sonuc;
}

async function mulakatBasvur(db, userId, meslekId) {
  await ensureMeslekTables(db);
  const meslek = meslekBul(meslekId);
  if (!meslek) return { ok: false, error: "Geçersiz pozisyon." };

  const mevcut = await get(db, `SELECT meslek_id FROM oyuncu_meslek WHERE user_id = ?`, [userId]);
  if (mevcut) {
    return {
      ok: false,
      error: "Zaten bir işte çalışıyorsun. Önce istifa etmelisin.",
      aktifMeslekId: mevcut.meslek_id,
    };
  }

  const sirketIs = await get(db, `SELECT user_id FROM sirket_calisanlari WHERE user_id = ?`, [userId]);
  if (sirketIs) {
    return { ok: false, error: "Bir oyuncu şirketinde çalışıyorsun. Önce oradan istifa etmelisin." };
  }

  const sahipSirket = await get(
    db,
    `SELECT id FROM oyuncu_sirketleri WHERE sahip_user_id = ?`,
    [userId]
  );
  if (sahipSirket) {
    return { ok: false, error: "Şirket sahibi iken NPC işine giremezsin." };
  }

  const yetenekler = await yetenekleriGetir(db, userId);
  const kontrol = yetenekUygunMu(yetenekler, meslek.gereksinim);
  const isyeri = isyeriBul(meslek.isyeriId);
  const sorular = mulakatSorulari(meslek).map((s) => ({
    ...s,
    mevcut: yetenekler[s.yetenek] ?? 0,
    gecti: (yetenekler[s.yetenek] ?? 0) >= s.min,
  }));

  if (!kontrol.uygun) {
    return {
      ok: true,
      alindi: false,
      mesaj: "Yeteneklerin bu pozisyon için yetersiz. Bir süre çalışıp geliştirdikten sonra tekrar dene.",
      npc: isyeri ? isyeri.npc : "",
      isyeriAd: isyeri ? isyeri.ad : "",
      unvan: meslek.unvan,
      sorular,
      eksikler: kontrol.eksikler,
    };
  }

  const simdi = Math.floor(Date.now() / 1000);
  const bugun = maasGunKey();
  await run(
    db,
    `INSERT INTO oyuncu_meslek (user_id, meslek_id, ise_baslama, son_gelir_gunu)
     VALUES (?, ?, ?, ?)`,
    [userId, meslek.id, simdi, bugun]
  );

  const { schedulePlayerSnapshotPersist } = require("./oyuncuSnapshotPersist");
  schedulePlayerSnapshotPersist(db, userId);

  return {
    ok: true,
    alindi: true,
    mesaj: `Tebrikler! ${isyeri ? isyeri.ad : ""} bünyesinde ${meslek.unvan} olarak işe alındın.`,
    npc: isyeri ? isyeri.npc : "",
    isyeriAd: isyeri ? isyeri.ad : "",
    unvan: meslek.unvan,
    gunlukGelir: meslek.gunlukGelir,
    yetenekKazanc: meslek.yetenekKazanc,
    sorular,
    meslek: await meslekGetir(db, userId),
  };
}

async function istifaEt(db, userId) {
  await ensureMeslekTables(db);
  const mevcut = await meslekGetir(db, userId);
  if (!mevcut) return { ok: false, error: "Aktif bir işin yok." };

  await run(db, `DELETE FROM oyuncu_meslek WHERE user_id = ?`, [userId]);

  const { schedulePlayerSnapshotPersist } = require("./oyuncuSnapshotPersist");
  schedulePlayerSnapshotPersist(db, userId);

  return {
    ok: true,
    mesaj: `${mevcut.isyeriAd} — ${mevcut.unvan} görevinden ayrıldın.`,
  };
}

module.exports = {
  ensureMeslekTables,
  istanbulGunKey,
  maasGunKey,
  maasSaatiGeldiMi,
  MAAS_RAPOR_SAATI,
  yetenekleriGetir,
  yetenekleriKaydet,
  meslekGetir,
  panelGetir,
  processMeslekGeliri,
  mulakatBasvur,
  istifaEt,
  yetenekUygunMu,
};
