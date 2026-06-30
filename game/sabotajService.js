const { run, get, all } = require("../db/database");
const { hapisKontrol } = require("./devletService");
const { enforceNoAltAccount } = require("./securityService");
const { icraatHarca } = require("./icraatService");
const { yetenekleriGetir, yetenekleriKaydet } = require("./meslekService");
const { gucKaybiOranliUygula } = require("./gucService");
const { logStatHareket } = require("./statService");
const { ensureBorsaTables } = require("./borsaService");
const { sabotajMesajiEkle } = require("./messagingService");
const {
  SABOTAJ_MIN_PUAN,
  SABOTAJ_MAX_SEVIYE_FARK,
  SABOTAJ_HEDEF_BEKLEME_SN,
  sabotajTurBul,
  sabotajAsamaBul,
  sabotajKataloguClient,
  sabotajKategoriAdi,
} = require("./sabotajCatalog");
const { YETENEK_ANAHTARLAR } = require("./yetenekCatalog");

function sabotajSaldiriGucu(yetenekler, istihbarat, baseSeviye) {
  const y = yetenekler || {};
  const raw =
    (y.zeka || 0) * 0.45 +
    (y.beceri || 0) * 0.3 +
    (y.dayaniklilik || 0) * 0.15 +
    (y.guc || 0) * 0.1 +
    (istihbarat || 0) * 2 +
    (baseSeviye || 1);
  return Math.max(1, Math.round(raw / 1.5));
}

function sabotajSavunmaGucu(yetenekler, bonusGuc, istihbarat, baseSeviye) {
  const y = yetenekler || {};
  const raw =
    (y.dayaniklilik || 0) * 0.6 +
    (y.guc || 0) * 0.2 +
    (y.zeka || 0) * 0.15 +
    (y.beceri || 0) * 0.05 +
    (bonusGuc || 0) * 0.02 +
    (istihbarat || 0) +
    (baseSeviye || 1);
  return Math.max(1, Math.round(raw));
}

function basariSansHesapla(saldiriGucu, savunmaGucu) {
  const oran = saldiriGucu / Math.max(1, savunmaGucu);
  const yuzde = 50 + (oran - 1) * 22;
  return Math.max(12, Math.min(88, Math.round(yuzde)));
}

async function ensureSabotajTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sabotaj_isleri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saldiran_id INTEGER NOT NULL,
      hedef_id INTEGER NOT NULL,
      tur_id TEXT NOT NULL,
      asama INTEGER NOT NULL,
      baslangic INTEGER NOT NULL,
      bitis INTEGER NOT NULL,
      durum TEXT NOT NULL DEFAULT 'aktif',
      basari INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (saldiran_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hedef_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sabotaj_aktif ON sabotaj_isleri(saldiran_id, durum)`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_sabotaj_bitis ON sabotaj_isleri(durum, bitis)`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sabotaj_cooldown (
      saldiran_id INTEGER NOT NULL,
      hedef_id INTEGER NOT NULL,
      son_sabotaj INTEGER NOT NULL,
      PRIMARY KEY (saldiran_id, hedef_id)
    )`
  );
}

async function oyuncuSabotajVerisi(db, userId) {
  const yetenekler = await yetenekleriGetir(db, userId);
  const row = await get(
    db,
    `SELECT p.bonus_guc,
            COALESCE((SELECT eleman_sayisi FROM istihbarat WHERE user_id = p.user_id), 0) AS istihbarat,
            COALESCE(ub.base_seviye, 1) AS base_seviye
     FROM players p
     LEFT JOIN user_base ub ON ub.user_id = p.user_id
     WHERE p.user_id = ?`,
    [userId]
  );
  const istihbarat = row?.istihbarat || 0;
  const baseSeviye = row?.base_seviye || 1;
  const bonusGuc = row?.bonus_guc || 0;
  return {
    yetenekler,
    istihbarat,
    baseSeviye,
    saldiriGucu: sabotajSaldiriGucu(yetenekler, istihbarat, baseSeviye),
    savunmaGucu: sabotajSavunmaGucu(yetenekler, bonusGuc, istihbarat, baseSeviye),
  };
}

async function aktifSabotajGetir(db, userId) {
  await ensureSabotajTables(db);
  const row = await get(
    db,
    `SELECT s.*, u.reis_adi AS hedef_adi
     FROM sabotaj_isleri s
     JOIN users u ON u.id = s.hedef_id
     WHERE s.saldiran_id = ? AND s.durum = 'aktif'
     ORDER BY s.id DESC LIMIT 1`,
    [userId]
  );
  if (!row) return null;
  const tur = sabotajTurBul(row.tur_id);
  return {
    id: row.id,
    turId: row.tur_id,
    turAdi: tur ? tur.ad : row.tur_id,
    asama: row.asama,
    hedefId: row.hedef_id,
    hedefAdi: row.hedef_adi,
    baslangic: row.baslangic,
    bitis: row.bitis,
    kalanSn: Math.max(0, row.bitis - Math.floor(Date.now() / 1000)),
  };
}

async function panelGetir(db, userId) {
  await ensureSabotajTables(db);
  const player = await get(db, `SELECT puan FROM players WHERE user_id = ?`, [userId]);
  const veri = await oyuncuSabotajVerisi(db, userId);
  const aktifIs = await aktifSabotajGetir(db, userId);
  return {
    ok: true,
    ...sabotajKataloguClient(),
    puan: player?.puan || 0,
    saldiriGucu: veri.saldiriGucu,
    savunmaGucu: veri.savunmaGucu,
    aktifIs,
  };
}

async function hedefCoz(db, hedefAd, saldiranId) {
  const hedef = await get(
    db,
    `SELECT u.id, u.reis_adi, p.puan, p.kasa, p.guc, p.icraat, p.sms_hakki, p.devlet_iliskisi,
            COALESCE(p.bonus_guc, 0) AS bonus_guc,
            COALESCE((SELECT eleman_sayisi FROM istihbarat WHERE user_id = u.id), 0) AS istihbarat,
            COALESCE(ub.base_seviye, 1) AS base_seviye
     FROM users u
     JOIN players p ON p.user_id = u.id
     LEFT JOIN user_base ub ON ub.user_id = u.id
     WHERE LOWER(u.reis_adi) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
    [hedefAd.trim(), hedefAd.trim()]
  );
  if (!hedef) return { ok: false, error: "Oyuncu bulunamadı. Reis adını doğru yaz." };
  if (hedef.id === saldiranId) return { ok: false, error: "Kendine sabotaj yapamazsın Reis!" };
  return { ok: true, hedef };
}

async function cooldownKontrol(db, saldiranId, hedefId) {
  const row = await get(
    db,
    `SELECT son_sabotaj FROM sabotaj_cooldown WHERE saldiran_id = ? AND hedef_id = ?`,
    [saldiranId, hedefId]
  );
  if (!row) return { ok: true };
  const now = Math.floor(Date.now() / 1000);
  const gecen = now - row.son_sabotaj;
  if (gecen >= SABOTAJ_HEDEF_BEKLEME_SN) return { ok: true };
  const kalanGun = Math.ceil((SABOTAJ_HEDEF_BEKLEME_SN - gecen) / 86400);
  return {
    ok: false,
    error: `Bu oyuncuya ${kalanGun} gün daha sabotaj yapamazsın.`,
  };
}

async function sabotajBaslat(db, saldiranId, player, hedefAd, turId, asama, securityMeta = {}) {
  await ensureSabotajTables(db);
  const hapis = await hapisKontrol(db, saldiranId);
  if (!hapis.ok) return hapis;

  if ((player.puan || 0) < SABOTAJ_MIN_PUAN) {
    return {
      ok: false,
      error: `Sabotaj için en az ${SABOTAJ_MIN_PUAN.toLocaleString("tr-TR")} saygınlık gerekir.`,
    };
  }

  const aktif = await get(
    db,
    `SELECT id FROM sabotaj_isleri WHERE saldiran_id = ? AND durum = 'aktif' LIMIT 1`,
    [saldiranId]
  );
  if (aktif) {
    return { ok: false, error: "Zaten devam eden bir sabotajın var. Önce onu bitir veya iptal et." };
  }

  const tur = sabotajTurBul(turId);
  if (!tur) return { ok: false, error: "Geçersiz sabotaj türü." };
  const plan = sabotajAsamaBul(tur, parseInt(asama, 10));
  if (!plan) return { ok: false, error: "Geçersiz plan seviyesi." };

  const hedefSonuc = await hedefCoz(db, hedefAd, saldiranId);
  if (!hedefSonuc.ok) return hedefSonuc;
  const hedef = hedefSonuc.hedef;

  const altCheck = await enforceNoAltAccount(db, saldiranId, hedef.id, "sabotaj_baslat", securityMeta);
  if (!altCheck.ok) return altCheck;

  const saldiranBase = await get(
    db,
    `SELECT COALESCE(ub.base_seviye, 1) AS base_seviye FROM user_base ub WHERE user_id = ?`,
    [saldiranId]
  );
  const saldiranSev = saldiranBase?.base_seviye || 1;
  const hedefSev = hedef.base_seviye || 1;
  if (Math.abs(saldiranSev - hedefSev) > SABOTAJ_MAX_SEVIYE_FARK) {
    return {
      ok: false,
      error: `Güvenli yer seviyesi farkı en fazla ${SABOTAJ_MAX_SEVIYE_FARK} olabilir.`,
    };
  }

  const cd = await cooldownKontrol(db, saldiranId, hedef.id);
  if (!cd.ok) return cd;

  if (player.kasa < plan.kasaMaliyet) {
    return {
      ok: false,
      error: `Kasanda yeterli nakit yok! ${plan.kasaMaliyet.toLocaleString("tr-TR")} TL gerekir.`,
    };
  }

  const icraatSonuc = await icraatHarca(db, saldiranId, plan.icraat);
  if (!icraatSonuc.ok) {
    return { ok: false, error: `Sabotaj için ${plan.icraat} icraat hakkı gerekir!` };
  }
  player.icraat = icraatSonuc.icraat;
  player.kasa -= plan.kasaMaliyet;

  const now = Math.floor(Date.now() / 1000);
  const bitis = now + plan.sureSn;

  await run(db, `UPDATE players SET kasa = ?, icraat = ? WHERE user_id = ?`, [
    player.kasa,
    player.icraat,
    saldiranId,
  ]);

  const ins = await run(
    db,
    `INSERT INTO sabotaj_isleri (saldiran_id, hedef_id, tur_id, asama, baslangic, bitis, durum)
     VALUES (?, ?, ?, ?, ?, ?, 'aktif')`,
    [saldiranId, hedef.id, tur.id, plan.seviye, now, bitis]
  );

  await run(
    db,
    `INSERT OR REPLACE INTO sabotaj_cooldown (saldiran_id, hedef_id, son_sabotaj) VALUES (?, ?, ?)`,
    [saldiranId, hedef.id, now]
  );

  const saldiran = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [saldiranId]);

  return {
    ok: true,
    isId: ins.lastID,
    mesaj:
      `${tur.ad} (${plan.etiket}) planı ${hedef.reis_adi} hedefine gönderildi. ` +
      `${Math.ceil(plan.sureSn / 60)} dakika içinde sonuçlanacak.`,
    aktifIs: {
      id: ins.lastID,
      turId: tur.id,
      turAdi: tur.ad,
      asama: plan.seviye,
      hedefAdi: hedef.reis_adi,
      baslangic: now,
      bitis,
      kalanSn: plan.sureSn,
    },
    saldiranAdi: saldiran?.reis_adi,
  };
}

async function sabotajIptal(db, saldiranId) {
  await ensureSabotajTables(db);
  const row = await get(
    db,
    `SELECT id, tur_id FROM sabotaj_isleri WHERE saldiran_id = ? AND durum = 'aktif' ORDER BY id DESC LIMIT 1`,
    [saldiranId]
  );
  if (!row) return { ok: false, error: "İptal edilecek aktif sabotaj yok." };
  await run(db, `UPDATE sabotaj_isleri SET durum = 'iptal', basari = 0 WHERE id = ?`, [row.id]);
  return { ok: true, mesaj: "Sabotaj planı iptal edildi. Aynı türü tekrar başlatamazsın." };
}

async function etkiUygula(db, hedefId, saldiranId, tur, plan) {
  const hedef = await get(
    db,
    `SELECT kasa, puan, guc, icraat, sms_hakki, devlet_iliskisi,
            COALESCE(bonus_guc, 0) AS bonus_guc,
            yetenek_guc, yetenek_zeka, yetenek_dayaniklilik, yetenek_beceri
     FROM players WHERE user_id = ?`,
    [hedefId]
  );
  if (!hedef) return { ozet: "Hedef bulunamadı.", kazanilanPara: 0 };

  const etki = plan.etkiDeger;
  let ozet = "";
  let hedefOzet = "";
  let kazanilanPara = 0;

  switch (tur.etkiTip) {
    case "kasa_oran": {
      const kayip = Math.max(0, Math.floor(hedef.kasa * etki));
      const yeni = Math.max(0, hedef.kasa - kayip);
      await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [yeni, hedefId]);
      if (saldiranId && kayip > 0) {
        await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [kayip, saldiranId]);
        kazanilanPara = kayip;
      }
      hedefOzet = `${kayip.toLocaleString("tr-TR")} TL kasa kaybı`;
      ozet =
        hedefOzet +
        (kazanilanPara > 0 ? `; kasana ${kazanilanPara.toLocaleString("tr-TR")} TL eklendi` : "");
      break;
    }
    case "banka_oran": {
      const banka = await get(
        db,
        `SELECT yatirilan_miktar FROM banka_hesaplari WHERE user_id = ?`,
        [hedefId]
      );
      const miktar = banka?.yatirilan_miktar || 0;
      const kayip = Math.max(0, Math.floor(miktar * etki));
      const yeni = Math.max(0, miktar - kayip);
      if (banka) {
        await run(db, `UPDATE banka_hesaplari SET yatirilan_miktar = ? WHERE user_id = ?`, [
          yeni,
          hedefId,
        ]);
      }
      if (saldiranId && kayip > 0) {
        await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [kayip, saldiranId]);
        kazanilanPara = kayip;
      }
      hedefOzet = `${kayip.toLocaleString("tr-TR")} TL banka yatırımı kaybı`;
      ozet =
        hedefOzet +
        (kazanilanPara > 0 ? `; kasana ${kazanilanPara.toLocaleString("tr-TR")} TL eklendi` : "");
      break;
    }
    case "borsa_oran": {
      await ensureBorsaTables(db);
      const pozisyonlar = await all(
        db,
        `SELECT p.sirket_id, p.adet, s.fiyat
         FROM borsa_portfoy p
         JOIN borsa_sirketleri s ON s.id = p.sirket_id
         WHERE p.user_id = ? AND p.adet > 0`,
        [hedefId]
      );
      if (!pozisyonlar.length) {
        hedefOzet = "Portföyde hisse yok";
        ozet = hedefOzet;
        break;
      }
      let toplamKayipTL = 0;
      for (const p of pozisyonlar) {
        const kayipAdet = Math.max(0, Math.floor(p.adet * etki));
        if (kayipAdet <= 0) continue;
        const kayipTL = kayipAdet * p.fiyat;
        toplamKayipTL += kayipTL;
        const yeniAdet = p.adet - kayipAdet;
        if (yeniAdet <= 0) {
          await run(db, `DELETE FROM borsa_portfoy WHERE user_id = ? AND sirket_id = ?`, [
            hedefId,
            p.sirket_id,
          ]);
        } else {
          await run(db, `UPDATE borsa_portfoy SET adet = ? WHERE user_id = ? AND sirket_id = ?`, [
            yeniAdet,
            hedefId,
            p.sirket_id,
          ]);
        }
      }
      if (saldiranId && toplamKayipTL > 0) {
        await run(db, `UPDATE players SET kasa = kasa + ? WHERE user_id = ?`, [
          toplamKayipTL,
          saldiranId,
        ]);
        kazanilanPara = toplamKayipTL;
      }
      hedefOzet =
        toplamKayipTL > 0
          ? `${toplamKayipTL.toLocaleString("tr-TR")} TL hisse portföyü kaybı`
          : "Portföyde kaybedilecek hisse yok";
      ozet =
        hedefOzet +
        (kazanilanPara > 0 ? `; kasana ${kazanilanPara.toLocaleString("tr-TR")} TL eklendi` : "");
      break;
    }
    case "puan_oran": {
      const kayip = Math.max(0, Math.floor(hedef.puan * etki));
      const yeni = Math.max(0, hedef.puan - kayip);
      await run(db, `UPDATE players SET puan = ? WHERE user_id = ?`, [yeni, hedefId]);
      if (kayip > 0) await logStatHareket(db, hedefId, "sayginlik", -kayip);
      hedefOzet = `${kayip.toLocaleString("tr-TR")} saygınlık kaybı`;
      ozet = hedefOzet;
      break;
    }
    case "icraat_dus": {
      const yeni = Math.max(0, (hedef.icraat || 0) - Math.floor(etki));
      await run(db, `UPDATE players SET icraat = ? WHERE user_id = ?`, [yeni, hedefId]);
      hedefOzet = `${Math.floor(etki)} icraat kaybı`;
      ozet = hedefOzet;
      break;
    }
    case "avukat_dus": {
      const yeni = Math.max(0, (hedef.devlet_iliskisi || 0) - Math.floor(etki));
      await run(db, `UPDATE players SET devlet_iliskisi = ? WHERE user_id = ?`, [yeni, hedefId]);
      hedefOzet = `${Math.floor(etki)} avukat ilişkisi kaybı`;
      ozet = hedefOzet;
      break;
    }
    case "sms_oran": {
      const kayip = Math.max(0, Math.floor((hedef.sms_hakki || 0) * etki));
      const yeni = Math.max(0, (hedef.sms_hakki || 0) - kayip);
      await run(db, `UPDATE players SET sms_hakki = ? WHERE user_id = ?`, [yeni, hedefId]);
      hedefOzet = `${kayip} SMS hakkı kaybı`;
      ozet = hedefOzet;
      break;
    }
    case "guc_oran": {
      await gucKaybiOranliUygula(db, hedefId, hedef, etki);
      hedefOzet = `%${Math.round(etki * 100)} güç kaybı`;
      ozet = hedefOzet;
      break;
    }
    case "yetenek_oran": {
      const yetenekler = {
        guc: hedef.yetenek_guc,
        zeka: hedef.yetenek_zeka,
        dayaniklilik: hedef.yetenek_dayaniklilik,
        beceri: hedef.yetenek_beceri,
      };
      for (const key of YETENEK_ANAHTARLAR) {
        const kayip = Math.max(1, Math.floor((yetenekler[key] || 0) * etki));
        yetenekler[key] = Math.max(0, (yetenekler[key] || 0) - kayip);
      }
      await yetenekleriKaydet(db, hedefId, yetenekler);
      hedefOzet = `%${Math.round(etki * 100)} yetenek kaybı`;
      ozet = hedefOzet;
      break;
    }
    default:
      hedefOzet = "Bilinmeyen etki";
      ozet = hedefOzet;
  }

  return { ozet, hedefOzet, kazanilanPara };
}

async function sabotajGazeteHaberleri(db, { basari, saldiranAdi, hedefAdi, kategoriId }) {
  const { gazeteEkle } = require("./sehirGazeteService");
  if (!saldiranAdi || !hedefAdi) return;
  if (basari) {
    const kat = sabotajKategoriAdi(kategoriId);
    await gazeteEkle(db, `${hedefAdi} oyuncusu ${kat} Sabotaja Uğradı.`);
  } else {
    await gazeteEkle(
      db,
      `${saldiranAdi}, ${hedefAdi}'e karşı BAŞARISIZ bir sabotaj gerçekleştirdi.`
    );
  }
}

async function sabotajSonuclandir(db, is) {
  const tur = sabotajTurBul(is.tur_id);
  const plan = sabotajAsamaBul(tur, is.asama);
  if (!tur || !plan) {
    await run(db, `UPDATE sabotaj_isleri SET durum = 'tamamlandi', basari = 0 WHERE id = ?`, [is.id]);
    return;
  }

  const saldiranVeri = await oyuncuSabotajVerisi(db, is.saldiran_id);
  const hedefRow = await get(
    db,
    `SELECT p.bonus_guc,
            COALESCE((SELECT eleman_sayisi FROM istihbarat WHERE user_id = p.user_id), 0) AS istihbarat,
            COALESCE(ub.base_seviye, 1) AS base_seviye
     FROM players p
     LEFT JOIN user_base ub ON ub.user_id = p.user_id
     WHERE p.user_id = ?`,
    [is.hedef_id]
  );
  const hedefYetenek = await yetenekleriGetir(db, is.hedef_id);
  const savunma = sabotajSavunmaGucu(
    hedefYetenek,
    hedefRow?.bonus_guc || 0,
    hedefRow?.istihbarat || 0,
    hedefRow?.base_seviye || 1
  );
  const sans = basariSansHesapla(saldiranVeri.saldiriGucu, savunma);
  const basari = Math.random() * 100 < sans;

  const saldiran = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [is.saldiran_id]);
  const hedef = await get(db, `SELECT reis_adi FROM users WHERE id = ?`, [is.hedef_id]);

  let ozet = "";
  let hedefOzet = "";
  let kazanilanPara = 0;
  if (basari) {
    const etki = await etkiUygula(db, is.hedef_id, is.saldiran_id, tur, plan);
    ozet = etki.ozet;
    hedefOzet = etki.hedefOzet || etki.ozet;
    kazanilanPara = etki.kazanilanPara || 0;
  }

  await run(db, `UPDATE sabotaj_isleri SET durum = 'tamamlandi', basari = ? WHERE id = ?`, [
    basari ? 1 : 0,
    is.id,
  ]);

  await sabotajMesajiEkle(db, {
    hedefUserId: is.hedef_id,
    saldiranUserId: is.saldiran_id,
    hedefAdi: hedef?.reis_adi,
    saldiranAdi: saldiran?.reis_adi,
    turAdi: tur.ad,
    basari,
    ozet,
    hedefOzet,
    kazanilanPara,
  });

  const { bildirimGonder } = require("./bildirimService");
  if (basari) {
    await bildirimGonder(db, is.hedef_id, "sabotaj", {
      baslik: "Sabotaja Uğradın",
      icerik: `Bilinmeyen bir düzen ${tur.ad} saldırısıyla sana zarar verdi. ${hedefOzet}`,
      url: "/?ekran=mesajKutusu",
    });
    await bildirimGonder(db, is.saldiran_id, "sabotaj", {
      baslik: "Sabotaj Başarılı",
      icerik:
        `${hedef?.reis_adi} hedefine ${tur.ad} başarıyla uygulandı. ${ozet}` +
        (kazanilanPara > 0 ? ` Kasana +${kazanilanPara.toLocaleString("tr-TR")} TL eklendi.` : ""),
      url: "/?ekran=sabotaj",
    });
  } else {
    await bildirimGonder(db, is.hedef_id, "sabotaj", {
      baslik: "Sabotaj Girişimi",
      icerik: `${saldiran?.reis_adi} seni ${tur.ad} ile sabote etmeye çalıştı ama başarısız oldu.`,
      url: "/?ekran=mesajKutusu",
    });
    await bildirimGonder(db, is.saldiran_id, "sabotaj", {
      baslik: "Sabotaj Başarısız",
      icerik: `${hedef?.reis_adi} hedefine ${tur.ad} tutmadı.`,
      url: "/?ekran=sabotaj",
    });
  }

  await sabotajGazeteHaberleri(db, {
    basari,
    saldiranAdi: saldiran?.reis_adi,
    hedefAdi: hedef?.reis_adi,
    kategoriId: tur.kategori,
  });
}

async function sabotajKuyrukIsle(db) {
  await ensureSabotajTables(db);
  const now = Math.floor(Date.now() / 1000);
  const bekleyen = await all(
    db,
    `SELECT * FROM sabotaj_isleri WHERE durum = 'aktif' AND bitis <= ? ORDER BY bitis ASC LIMIT 20`,
    [now]
  );
  for (const is of bekleyen) {
    try {
      await sabotajSonuclandir(db, is);
    } catch (err) {
      console.error("Sabotaj sonuçlandırma hatası:", err);
    }
  }
}

module.exports = {
  ensureSabotajTables,
  sabotajSaldiriGucu,
  sabotajSavunmaGucu,
  basariSansHesapla,
  panelGetir,
  sabotajBaslat,
  sabotajIptal,
  sabotajKuyrukIsle,
};
