const { run, get, all } = require("../db/database");

const CANLI_PENCERE_SEC = 600;
const LOG_TUTMA_GUN = 7;
const LOG_KULLANICI_LIMIT = 80;

const EKRAN_ETIKETLERI = {
  liderlik: "Liderlik Tablosu",
  profilim: "Profilim",
  profil_ziyaret: "Profil Ziyareti",
  guvenliYer: "Güvenli Yer",
  gunlukGorevler: "Günlük Görevler",
  guclen: "Güçlen/Silahlan",
  korumaEkibi: "Koruma Ekibi",
  silahlan: "Silahlanma",
  luksYasam: "Lüks Yaşam",
  sporSalonu: "Spor Salonu",
  buyume: "İcraat İşleri",
  mekan: "Mekan Sahibi",
  mahalle: "Mahalle İşleri",
  semt: "Semt İşleri",
  sehir: "Şehir İşleri",
  sektor_yeralti: "Yeraltı Sektörü",
  sektor_silah: "Silah Sektörü",
  sektor_paket: "Paket Sektörü",
  mekan_devri: "Mekan Devri",
  istihbarat: "İstihbarat",
  banka: "Banka",
  medya: "Medya",
  gazete: "Gazete",
  sehreHukmet: "Şehre Hükmet",
  baba_soz: "Sözünü Geçir",
  baba_sadakat: "Sadakat Yemini",
  liman: "Liman İşletmeleri",
  mesajKutusu: "Mesaj Kutusu",
  mafyaSohbet: "Mafya Sohbetleri",
  dusmanaCok: "Düşmana Çök",
  sabotaj: "Sabotaj",
  borsa: "Borsa",
  kumarhane: "Kumarhane",
  karaListe: "Kara Liste",
  devletIliskisi: "Avukat",
  sehirTarihi: "Şehir Tarihi",
  turkiyeSefirlik: "Türkiye Sefirliği",
  turkiyeSefirlik: "Türkiye Sefirliği",
  mafya: "Mafya Grubu",
  "mafya:olustur": "Mafya Grubu Oluştur",
  "mafya:katil": "Mafyaya Katıl",
  "mafya:gurubum": "Mafya Grubum",
  "mafya:savaslar": "Mafya Savaşları",
  "mafya:isler": "Mafya İşleri",
  "mafya:evi": "Mafya Evi",
};

const MAFYA_MODLARI = {
  olustur: "Mafya Grubu Oluştur",
  katil: "Mafyaya Katıl",
  gurubum: "Mafya Grubum",
  savaslar: "Mafya Savaşları",
  isler: "Mafya İşleri",
  evi: "Mafya Evi",
};

const AKSiyON_ETIKETLERI = {
  ekran_goruntule: "Ekran görüntülendi",
  heartbeat: "Sayfada aktif",
  hire: "Koruma / ekip işe aldı",
  job: "İş yaptı",
  liman_cok: "Limandan çöktü",
  baba_cok: "Babadan çöktü",
  baba_derki: "Baba sözü kullandı",
  sadakat_oy: "Sadakat oyu kullandı",
  dusmana_cok: "Düşmana çöktü",
  sabotaj_baslat: "Sabotaj başlattı",
  sabotaj_iptal: "Sabotaj iptal etti",
  borsa_al: "Borsadan hisse aldı",
  borsa_sat: "Borsada hisse sattı",
  borsa_emir: "Borsada emir verdi",
  borsa_emir_iptal: "Borsa emrini iptal etti",
  kumarhane_chip_al: "Kumarhanede çip aldı",
  kumarhane_chip_sat: "Kumarhanede çip bozdurdu",
  kumarhane_oyna: "Kumarhanede oynadı",
  kumarhane_masa_katil: "Kumarhane masasına oturdu",
  kumarhane_masa_ayril: "Kumarhane masasından kalktı",
  kumarhane_masa_bahis_oner: "Kumarhane bahis teklifi gönderdi",
  kumarhane_masa_bahis_cevap: "Kumarhane bahis teklifine yanıt verdi",
  kumarhane_masa_hazir: "Kumarhane masasında hazır oldu",
  kumarhane_masa_oyna: "Kumarhane masasında oynadı",
  kumarhane_piyango_bilet: "Piyango bileti aldı",
  mekan_al: "Mekan aldı",
  rusvet_ver: "Rüşvet verdi",
  mesaj_gonder: "Mesaj gönderdi",
  mesaj_sil: "Mesaj sildi",
  mesaj_cevapla: "Mesaja cevap verdi",
  mafya_grup_mesaj: "Grup mesajı yazdı",
  mafya_sohbet: "Mafya sohbetine yazdı",
  mafya_olustur: "Mafya grubu kurdu",
  mafya_basvur: "Mafyaya başvurdu",
  mafya_kabul: "Mafya başvurusu kabul etti",
  mafya_red: "Mafya başvurusu reddetti",
  mafya_rutbe: "Mafya rütbesi değiştirdi",
  mafya_cikar: "Mafyadan üye çıkardı",
  mafya_devret: "Mafya liderliğini devretti",
  mafya_dagit: "Mafya grubunu dağıttı",
  mafya_cik: "Mafyadan ayrıldı",
  istihbarat_al: "İstihbarat aldı",
  istihbarat_spy: "Casusluk yaptı",
  gorev_kabul: "Günlük görev kabul etti",
  gorev_odul_al: "Görev ödülü aldı",
  gorev_elmas_tamamla: "Elmasla görev teslim etti",
  banka_yatir: "Bankaya yatırdı",
  banka_cek: "Bankadan çekti",
  mekan_devri: "Mekan devri yaptı",
  para_gonder: "Para gönderdi",
  mafya_savas_ilan: "Mafya savaşı ilan etti",
  mafya_savas_katil: "Mafya savaşına katıldı",
  mafya_is_katil: "Mafya işine katıldı",
  mafya_is_gerceklestir: "Mafya işi gerçekleştirdi",
  mafya_evi_hibe: "Mafya evine hibe yaptı",
  mafya_evi_seviye: "Mafya evi yükseltti",
  mafya_grup_isim_degistir: "Grup adını değiştirdi",
  mafya_grup_aciklama_degistir: "Grup açıklamasını değiştirdi",
  medya_haber: "Medya haberi yayınladı",
  guvenli_yer_gelistir: "Güvenli yeri geliştirdi",
  guvenli_yer_kasa_al: "Güvenli yer kasası aldı",
  sefirlik_kontrol: "Şehirde kontrol topladı",
  sefirlik_ihale: "Şehir ihalesine girdi",
  sefirlik_saldir: "Şehre saldırdı",
  meslek_mulakat: "Meslek mülakatına girdi",
  meslek_istifa: "Mesleğinden istifa etti",
  yetenek_antrenman: "Yetenek antrenmanı yaptı",
  maas_antrenman_kullan: "Maaş antrenman puanını kullandı",
  sirket_olustur: "Şirket kurdu",
  sirket_yatir: "Şirket kasasına para yatırdı",
  sirket_cek: "Şirket kasasından para çekti",
  sirket_basvur: "Şirkete başvurdu",
  sirket_basvuru_kabul: "Şirkete çalışan aldı",
  sirket_istifa: "Şirket işinden istifa etti",
  sirket_egitim: "Çalışanına eğitim verdi",
  sirket_malzeme_al: "Şirket için malzeme satın aldı",
  sirket_upgrade: "Şirket binasını yükseltti",
  sirket_reklam: "Şirket reklam kampanyasını güncelledi",
  sirket_fiyat: "Şirket satış fiyatını ayarladı",
};

function fmtTs(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}

function ekranEtiketi(ekran) {
  const k = String(ekran || "").trim();
  if (!k) return "—";
  if (EKRAN_ETIKETLERI[k]) return EKRAN_ETIKETLERI[k];
  if (k.startsWith("mafya:")) {
    const mod = k.slice(6);
    return MAFYA_MODLARI[mod] ? `Mafya — ${MAFYA_MODLARI[mod]}` : `Mafya — ${mod}`;
  }
  if (k.startsWith("sektor_")) {
    return EKRAN_ETIKETLERI[k] || k.replace("sektor_", "Sektör: ");
  }
  return k;
}

function aksiyonEtiketi(aksiyon) {
  const k = String(aksiyon || "").trim();
  if (!k) return "—";
  return AKSiyON_ETIKETLERI[k] || k;
}

function mafyaEkranAnahtari(mod) {
  return mod ? `mafya:${mod}` : "mafya";
}

async function ensureAktiviteSchema(db) {
  const cols = [
    ["aktif_ekran", "TEXT NOT NULL DEFAULT ''"],
    ["son_aksiyon", "TEXT NOT NULL DEFAULT ''"],
    ["son_aksiyon_detay", "TEXT NOT NULL DEFAULT ''"],
    ["son_aksiyon_at", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of cols) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {
      /* sütun zaten var */
    }
  }

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS oyuncu_aktivite_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ekran TEXT NOT NULL DEFAULT '',
      aksiyon TEXT NOT NULL DEFAULT '',
      detay TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_oyuncu_aktivite_log_user
     ON oyuncu_aktivite_log(user_id, created_at DESC)`
  );
}

function aksiyonDetayOlustur(action, key, adet, extra, result) {
  const parcalar = [];
  if (key) parcalar.push(String(key));
  if (adet != null && adet !== "") parcalar.push(`adet: ${adet}`);
  if (extra && extra.hedef) parcalar.push(`hedef: ${extra.hedef}`);
  if (extra && extra.mesaj && String(extra.mesaj).length <= 60) {
    parcalar.push(String(extra.mesaj).slice(0, 60));
  }
  if (result && result.effect) {
    if (result.effect.kazanc != null) parcalar.push(`+${result.effect.kazanc}₺`);
    if (result.effect.mesaj) parcalar.push(String(result.effect.mesaj).slice(0, 80));
  }
  return parcalar.join(" · ").slice(0, 200);
}

async function kaydetAktivite(db, userId, { ekran, aksiyon, detay } = {}) {
  const uid = parseInt(userId, 10);
  if (!uid) return { ok: false };

  const simdi = Math.floor(Date.now() / 1000);
  const ekranKey = String(ekran || "").trim().slice(0, 80);
  const aksiyonKey = String(aksiyon || "").trim().slice(0, 80);
  const detayStr = String(detay || "").trim().slice(0, 200);

  const mevcut = await get(
    db,
    `SELECT aktif_ekran, son_aksiyon FROM players WHERE user_id = ?`,
    [uid]
  );
  if (!mevcut) return { ok: false };

  const ekranDegisti = ekranKey && ekranKey !== (mevcut.aktif_ekran || "");
  const aksiyonVar = !!aksiyonKey && aksiyonKey !== "heartbeat";

  if (!ekranDegisti && !aksiyonVar) {
    if (ekranKey) {
      await run(db, `UPDATE players SET aktif_ekran = ? WHERE user_id = ?`, [ekranKey, uid]);
    }
    return { ok: true, skipped: true };
  }

  const guncelAksiyon = aksiyonVar ? aksiyonKey : ekranDegisti ? "ekran_goruntule" : aksiyonKey;
  const guncelDetay = detayStr || (ekranDegisti ? ekranEtiketi(ekranKey) : "");

  await run(
    db,
    `UPDATE players SET
      aktif_ekran = ?,
      son_aksiyon = ?,
      son_aksiyon_detay = ?,
      son_aksiyon_at = ?
     WHERE user_id = ?`,
    [ekranKey || mevcut.aktif_ekran || "", guncelAksiyon, guncelDetay, simdi, uid]
  );

  await run(
    db,
    `INSERT INTO oyuncu_aktivite_log (user_id, ekran, aksiyon, detay, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid, ekranKey || mevcut.aktif_ekran || "", guncelAksiyon, guncelDetay, simdi]
  );

  const eski = simdi - LOG_TUTMA_GUN * 86400;
  await run(
    db,
    `DELETE FROM oyuncu_aktivite_log
     WHERE user_id = ? AND id NOT IN (
       SELECT id FROM oyuncu_aktivite_log
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?
     )`,
    [uid, uid, LOG_KULLANICI_LIMIT]
  );
  await run(db, `DELETE FROM oyuncu_aktivite_log WHERE created_at < ?`, [eski]);

  return { ok: true };
}

async function listCanliAktivite(db, limit = 100) {
  const cap = Math.min(200, Math.max(1, limit));
  const since = Math.floor(Date.now() / 1000) - CANLI_PENCERE_SEC;
  const rows = await all(
    db,
    `SELECT u.id, u.username, u.reis_adi, u.banned, u.is_admin,
            p.last_seen_at, p.aktif_ekran, p.son_aksiyon, p.son_aksiyon_detay, p.son_aksiyon_at
     FROM users u
     JOIN players p ON p.user_id = u.id
     WHERE p.last_seen_at >= ?
     ORDER BY p.son_aksiyon_at DESC, p.last_seen_at DESC
     LIMIT ?`,
    [since, cap]
  );
  return rows.map(formatCanliSatir);
}

async function listOyuncuAktiviteLog(db, userId, limit = 40) {
  const cap = Math.min(80, Math.max(1, limit));
  const rows = await all(
    db,
    `SELECT ekran, aksiyon, detay, created_at
     FROM oyuncu_aktivite_log
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, cap]
  );
  return rows.map((r) => ({
    ekran: r.ekran,
    ekranLabel: ekranEtiketi(r.ekran),
    aksiyon: r.aksiyon,
    aksiyonLabel: aksiyonEtiketi(r.aksiyon),
    detay: r.detay || "",
    at: fmtTs(r.created_at),
    atTs: r.created_at,
  }));
}

function formatCanliSatir(r) {
  const simdi = Math.floor(Date.now() / 1000);
  const online = (r.last_seen_at || 0) >= simdi - 120;
  return {
    id: r.id,
    username: r.username,
    reisAdi: r.reis_adi,
    banned: !!r.banned,
    isAdmin: !!r.is_admin,
    aktifEkran: r.aktif_ekran || "",
    aktifEkranLabel: ekranEtiketi(r.aktif_ekran),
    sonAksiyon: r.son_aksiyon || "",
    sonAksiyonLabel: aksiyonEtiketi(r.son_aksiyon),
    sonAksiyonDetay: r.son_aksiyon_detay || "",
    sonAksiyonAt: fmtTs(r.son_aksiyon_at),
    lastSeen: fmtTs(r.last_seen_at),
    online,
  };
}

function mapAktiviteAlanlari(r) {
  const simdi = Math.floor(Date.now() / 1000);
  return {
    aktifEkran: r.aktif_ekran || "",
    aktifEkranLabel: ekranEtiketi(r.aktif_ekran),
    sonAksiyon: r.son_aksiyon || "",
    sonAksiyonLabel: aksiyonEtiketi(r.son_aksiyon),
    sonAksiyonDetay: r.son_aksiyon_detay || "",
    sonAksiyonAt: fmtTs(r.son_aksiyon_at),
    online: (r.last_seen_at || 0) >= simdi - CANLI_PENCERE_SEC,
  };
}

module.exports = {
  CANLI_PENCERE_SEC,
  ensureAktiviteSchema,
  kaydetAktivite,
  aksiyonDetayOlustur,
  listCanliAktivite,
  listOyuncuAktiviteLog,
  ekranEtiketi,
  aksiyonEtiketi,
  mafyaEkranAnahtari,
  mapAktiviteAlanlari,
  formatCanliSatir,
};
