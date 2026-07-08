/**
 * Applies i18n t() replacements to public/script.js
 * Run: node scripts/patch-script-i18n.js
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "public", "script.js");
let s = fs.readFileSync(file, "utf8");

function rep(oldStr, newStr, label) {
  if (!s.includes(oldStr)) {
    console.warn("MISSING:", label || oldStr.slice(0, 60));
    return;
  }
  s = s.split(oldStr).join(newStr);
  console.log("OK:", label || oldStr.slice(0, 50));
}

// Banner
rep(
  'el.textContent = "ŞEHİR ŞU AN \'" + sehirBannerState.reisAdi + "\' TARAFINDAN YÖNETİLİYOR";',
  "el.textContent = t('game.banner.ruler', { name: sehirBannerState.reisAdi });",
  "banner ruler"
);
rep(
  "el.textContent = 'ŞEHRİN SAHİBİ HENÜZ BELLİ DEĞİL';",
  "el.textContent = t('game.banner.noRuler');",
  "banner no ruler"
);
rep(
  "var gunTxt = (o.gun > 0 ? o.gun : 1) + ' gün';",
  "var gunTxt = (o.gun > 0 ? o.gun : 1) + t('game.daysUnit');",
  "days unit o"
);

// Champion badge
rep(
  "' ayının en güçlü mafya grubu\">'",
  "' + t('game.champion.badgeTitle') + '\">'",
  "champion title attr"
);
rep(
  "+ '<strong>Ayın En Güçlü Mafya Grubu</strong>'",
  "+ '<strong>' + escHtml(t('game.champion.badge')) + '</strong>'",
  "champion badge"
);

// Message sender
rep("return 'Gönderen: ' + m.gonderenEtiketi;", "return t('game.sender.prefix') + m.gonderenEtiketi;", "sender etiket");
rep("return 'Gönderen: Mafya Grubu - ' + (m.gonderenAdi || m.konu || '?');", "return t('game.sender.mafiaGroup') + (m.gonderenAdi || m.konu || '?');", "sender mafia");
rep("return 'Gönderen: Sistem' + (m.konu ? ' — ' + m.konu : '');", "return t('game.sender.system') + (m.konu ? ' — ' + m.konu : '');", "sender system");
rep("return 'Gönderen: ' + (m.gonderenAdi || m.konu || 'Sistem');", "return t('game.sender.prefix') + (m.gonderenAdi || m.konu || t('game.sender.system').replace('Gönderen: ', '').replace('From: ', ''));", "sender default");

// Actually fix sender default more cleanly - use two step
s = s.replace(
  "return t('game.sender.prefix') + (m.gonderenAdi || m.konu || t('game.sender.system').replace('Gönderen: ', '').replace('From: ', ''));",
  "return t('game.sender.prefix') + (m.gonderenAdi || m.konu || (typeof tr === 'function' ? 'Sistem' : 'Sistem'));"
);
// Better approach for sender default:
rep(
  "return t('game.sender.prefix') + (m.gonderenAdi || m.konu || (typeof tr === 'function' ? 'Sistem' : 'Sistem'));",
  "return t('game.sender.prefix') + (m.gonderenAdi || m.konu || 'Sistem');",
  "sender default fix"
);

// Daily task duration CSS classes - compare against server Turkish, use tr()
rep("else if (metin === 'Süresiz')", "else if (metin === 'Süresiz' || metin === t('game.duration.unlimited'))", "duration unlimited");
rep("else if (metin === 'Gün sonu')", "else if (metin === 'Gün sonu' || metin === t('game.duration.endOfDay'))", "duration eod");

// Job complete toast inner HTML
rep(
  "aktifReisAdi + ' Reis! <span style=\"color:#b8942a;\">' + isAdi + '</span> başarıyla tamamlandı.';",
  "t('game.jobComplete', { boss: aktifReisAdi, job: isAdi });",
  "job complete"
);

// Baba screens
rep("'<span class=\"sy-etiket\">Babanız</span>'", "escHtml(t('game.boss.yourBoss')) + '</span>'", "baba your");
// Fix broken replacement above - do properly
s = s.replace(
  "+ '<div class=\"sy-baba-satir\"><span class=\"sy-etiket\">' + escHtml(t('game.boss.yourBoss')) + '</span>';",
  "+ '<div class=\"sy-baba-satir\"><span class=\"sy-etiket\">' + escHtml(t('game.boss.yourBoss')) + '</span>';"
);
if (!s.includes("game.boss.yourBoss")) {
  rep(
    "+ '<div class=\"sy-baba-satir\"><span class=\"sy-etiket\">Babanız</span>';",
    "+ '<div class=\"sy-baba-satir\"><span class=\"sy-etiket\">' + escHtml(t('game.boss.yourBoss')) + '</span>';",
    "baba your"
  );
}
rep(
  "+ '<div class=\"sy-derki-blok\"><span class=\"sy-derki-etiket\">Babanız derki</span>';",
  "+ '<div class=\"sy-derki-blok\"><span class=\"sy-derki-etiket\">' + escHtml(t('game.boss.saysLabel')) + '</span>';",
  "baba says"
);
rep(
  'placeholder="Sözünü yaz..."',
  "placeholder=\"' + escHtml(t('game.boss.wordPlaceholder')) + '\"",
  "baba placeholder"
);
rep(
  "'[ 👑 MAKAMA ÇÖK — 1 İCRAAT ]'",
  "escHtml(t('game.boss.seizeSeat'))",
  "baba seize"
);

// Sehre hukmet hub
rep(
  "return '<span class=\"sh-kart-sahip sh-kart-sahip--bos\">3 liman müsait</span>';",
  "return '<span class=\"sh-kart-sahip sh-kart-sahip--bos\">' + escHtml(t('game.sehre.portsAvailable')) + '</span>';",
  "ports available"
);

// Hubs
rep(
  "vizuelMenuHubHTML('guclen', '/images/guclen/guclen-menu.png?v=101', 'Güçlen/Silahlan — sokak dükkanları', [",
  "vizuelMenuHubHTML('guclen', '/images/guclen/guclen-menu.png?v=101', t('game.hub.guclenSubtitle'), [",
  "hub guclen"
);
rep(
  "{ key: 'luks', tip: 'luksYasam', label: 'Lüks Yaşam' }",
  "{ key: 'luks', tip: 'luksYasam', label: t('screen.luksYasam') }",
  "hub luks"
);
rep(
  "vizuelMenuHubHTML('buyume', '/images/buyume/buyume-menu.png?v=101', 'İcraat İşleri — yol ayrımı', [",
  "vizuelMenuHubHTML('buyume', '/images/buyume/buyume-menu.png?v=101', t('game.hub.buyumeSubtitle'), [",
  "hub buyume"
);
rep(
  "{ key: 'mahalle', tip: 'mahalle', label: 'Mahalle İşleri' }",
  "{ key: 'mahalle', tip: 'mahalle', label: t('screen.mahalle') }",
  "hub mahalle"
);
rep(
  "{ key: 'semt', tip: 'semt', label: 'Semt İşleri' }",
  "{ key: 'semt', tip: 'semt', label: t('screen.semt') }",
  "hub semt"
);
rep(
  "{ key: 'sehir', tip: 'sehir', label: 'Şehir İşleri' }",
  "{ key: 'sehir', tip: 'sehir', label: t('screen.sehir') }",
  "hub sehir"
);
rep(
  "vizuelMenuHubHTML('mekan', '/images/mekan/mekan-menu.png?v=101', 'Sektörler — yeraltı işletmeleri', [",
  "vizuelMenuHubHTML('mekan', '/images/mekan/mekan-menu.png?v=101', t('game.hub.mekanSubtitle'), [",
  "hub mekan"
);
rep(
  "{ key: 'yeralti', tip: 'sektor_yeralti', label: 'Yeraltı Sektörü' }",
  "{ key: 'yeralti', tip: 'sektor_yeralti', label: t('screen.sektor_yeralti') }",
  "hub yeralti"
);
rep(
  "{ key: 'silah', tip: 'sektor_silah', label: 'Silah Sektörü' }",
  "{ key: 'silah', tip: 'sektor_silah', label: t('screen.sektor_silah') }",
  "hub silah"
);
rep(
  "{ key: 'paket', tip: 'sektor_paket', label: 'Paket Sektörü' }",
  "{ key: 'paket', tip: 'sektor_paket', label: t('screen.sektor_paket') }",
  "hub paket"
);

// Gunluk gorevler HTML
rep("'<h3 class=\"gg-kart-baslik\">Görev Panosu</h3>'", "'<h3 class=\"gg-kart-baslik\">' + escHtml(t('game.tasks.board')) + '</h3>'", "tasks board");
rep(
  "'<p class=\"gunluk-gorevler-aciklama\">Günde <b>10 görev</b> sunulur · En fazla <b>3</b> tanesini kabul edebilirsin</p>'",
  "'<p class=\"gunluk-gorevler-aciklama\">' + t('game.tasks.desc') + '</p>'",
  "tasks desc"
);
rep("'<span class=\"gg-hucre gg-gorev\">Görev</span>'", "'<span class=\"gg-hucre gg-gorev\">' + escHtml(t('game.tasks.colTask')) + '</span>'", "tasks col task");
rep("'<span class=\"gg-hucre gg-odul\">Ödül</span>'", "'<span class=\"gg-hucre gg-odul\">' + escHtml(t('game.tasks.colReward')) + '</span>'", "tasks col reward");
rep("'<span class=\"gg-hucre gg-sure\">Süre</span>'", "'<span class=\"gg-hucre gg-sure\">' + escHtml(t('game.tasks.colDuration')) + '</span>'", "tasks col duration");
rep("'>Ödülü Al</button>'", ">' + escHtml(t('game.tasks.claimReward')) + '</button>'", "claim reward");
rep("'gg-durum--basarisiz'>Başarısız</span>'", "'gg-durum--basarisiz'>' + escHtml(t('game.tasks.failed')) + '</span>'", "task failed");

// Guvenli yer stage names - replace object with function
const gyStageOld = `var GUVENLI_YER_ASAMA_ADLARI = {
  bos_arazi: 'Boş Arazi',
  malikane_cit: 'Ahşap Çit',
  tas_duvar: 'Taş Duvar',
  bahce: 'Bahçe',
  guclendirme_5: 'Giriş Kulesi',
  enerji_duvari: 'Enerji Duvarı',
  guclendirme_7: 'Savunma Hattı',
  yeralti_hazirlik: 'Yeraltı Sığınağı',
  gizli_duzenler: 'Gizli Düzenler',
  keskin_nisanci: 'Nişancı Kulesi',
  guclendirme_11: 'Yeraltı Ağı',
  guclendirme_12: 'Lojistik Alanı',
  helikopter_pisti: 'Havaalanı',
  bunker_girisi: 'Bunker Girişi'
};`;

const gyStageNew = `function guvenliYerAsamaAdi(key) {
  var k = 'game.gy.stage.' + key;
  var v = t(k);
  return v !== k ? v : key;
}`;

if (s.includes(gyStageOld)) {
  s = s.replace(gyStageOld, gyStageNew);
  s = s.replace(/GUVENLI_YER_ASAMA_ADLARI\[(\w+)\]/g, "guvenliYerAsamaAdi($1)");
  s = s.replace(/GUVENLI_YER_ASAMA_ADLARI\[(['"]\w+['"])\]/g, "guvenliYerAsamaAdi($1)");
  console.log("OK: guvenli yer stage names");
} else {
  console.warn("MISSING: guvenli yer stages");
}

// masterFramePlaque - simplify
rep(
  `function masterFramePlaqueGuncelle(tip, altBaslik) {
  var el = document.getElementById('masterFramePlaque');
  if (!el) return;
  if (altBaslik) {
    el.textContent = altBaslik;
    return;
  }
  if (typeof I18n !== 'undefined' && I18n.screenTitle) {
    el.textContent = I18n.screenTitle(tip);
    return;
  }
  if (tip === 'baba_sadakat') {
    el.textContent = ML_EKRAN_BASLIKLARI[tip] || 'SADAKAT YEMİNİ';
    return;
  }
  if (tip === 'liderlik') {
    el.textContent = 'LİDERLİK TABLOSU';
    return;
  }
  el.textContent = ML_EKRAN_BASLIKLARI[tip]
    || String(tip).replace(/_/g, ' ').toUpperCase();
}`,
  `function masterFramePlaqueGuncelle(tip, altBaslik) {
  var el = document.getElementById('masterFramePlaque');
  if (!el) return;
  if (altBaslik) {
    el.textContent = altBaslik;
    return;
  }
  if (tip && tip.indexOf('mafya_') === 0) {
    var mod = tip.replace('mafya_', '');
    el.textContent = typeof mafyaTitle === 'function' ? mafyaTitle(mod) : t('screen.mafya');
    return;
  }
  el.textContent = typeof screenTitle === 'function' ? screenTitle(tip) : (typeof I18n !== 'undefined' && I18n.screenTitle ? I18n.screenTitle(tip) : String(tip || '').replace(/_/g, ' ').toUpperCase());
}`,
  "masterFramePlaque"
);

// Remove ML_EKRAN_BASLIKLARI block if unused - keep ML_MAFYA for now
rep(
  `var ML_EKRAN_BASLIKLARI = {
  liderlik: 'LİDERLİK TABLOSU',
  profilim: 'PROFİLİM',
  guvenliYer: 'GÜVENLİ YER',
  gunlukGorevler: 'GÜNLÜK GÖREVLER',
  guclen: 'GÜÇLENME',
  korumaEkibi: 'KORUMA EKİBİ',
  silahlan: 'SİLAHANLANMA',
  luksYasam: 'LÜKS YAŞAM',
  buyume: 'BÜYÜME ADIMLARI',
  mekan: 'SEKTÖRLER',
  mahalle: 'MAHALLE İŞLERİ',
  semt: 'SEMT İŞLERİ',
  sehir: 'ŞEHİR İŞLERİ',
  sektor_yeralti: 'YERALTI SEKTÖRÜ',
  sektor_silah: 'SİLAH SEKTÖRÜ',
  sektor_paket: 'PAKET SEKTÖRÜ',
  mekan_devri: 'MEKAN DEVRİ',
  istihbarat: 'İSTİHBARAT',
  banka: 'BANKA',
  medya: 'MEDYA',
  gazete: 'ŞEHİR GAZETESİ',
  sehreHukmet: 'ŞEHRE HÜKMET',
  baba_soz: 'SÖZÜNÜ GEÇİR',
  baba_sadakat: 'SADAKAT YEMİNİ',
  liman: 'LİMAN İŞLETMELERİ',
  mesajKutusu: 'MESAJ KUTUSU',
  mafyaSohbet: 'MAFYA SOHBETİ',
  dusmanaCok: 'DÜŞMANA ÇÖK',
  karaListe: 'KARA LİSTE',
  devletIliskisi: 'AVUKAT',
  sehirTarihi: 'ŞEHİR TARİHİ',
  turkiyeSefirlik: 'TÜRKİYE SEFİRLİĞİ',
  meslekler: 'MESLEKLER'
};

`,
  "",
  "remove ML_EKRAN_BASLIKLARI"
);

// Connection errors
rep("if (panel) panel.innerHTML = '<p style=\"color:#c66;\">Sunucuya bağlanılamadı.</p>';", "if (panel) panel.innerHTML = '<p style=\"color:#c66;\">' + escHtml(t('game.error.connectionFailed')) + '</p>';", "gy connection");
rep("sonuc.innerHTML = '<div class=\"saldiri-sonuc\" style=\"color:#c66;\">Bağlantı hatası.</div>';", "sonuc.innerHTML = '<div class=\"saldiri-sonuc\" style=\"color:#c66;\">' + escHtml(t('game.toast.connectionError')) + '</div>';", "dusman connection");
rep("kutu.innerHTML = '<div class=\"dusman-rakip-kart\"><p style=\"color:#c66;text-align:center;\">Bağlantı hatası.</p></div>';", "kutu.innerHTML = '<div class=\"dusman-rakip-kart\"><p style=\"color:#c66;text-align:center;\">' + escHtml(t('game.toast.connectionError')) + '</p></div>';", "dusman rival connection");

// icraat tip
rep(
  "chipIcraat.setAttribute('data-tip', 'Saatlik +' + oyuncuIcraatSaatlikBonus + ' hak kazanılır');",
  "chipIcraat.setAttribute('data-tip', t('game.icraat.tip', { n: oyuncuIcraatSaatlikBonus }));",
  "icraat tip"
);

// Report UI
rep("'>Raporla</button>'", ">' + escHtml(t('game.report.btn')) + '</button>'", "report btn");
rep("'<p class=\"icerik-rapor-baslik\">Uygun görmeme sebebinizi açıklayınız.</p>'", "'<p class=\"icerik-rapor-baslik\">' + escHtml(t('game.report.title')) + '</p>'", "report title");
rep('placeholder="Sebebinizi yazın..."', "placeholder=\"' + escHtml(t('game.report.placeholder')) + '\"", "report placeholder");
rep("'>Gönder</button>'", ">' + escHtml(t('game.report.send')) + '</button>'", "report send");
rep("'>İptal</button>'", ">' + escHtml(t('game.report.cancel')) + '</button>'", "report cancel");

// Profil attack self
rep("profilSaldirSonucGoster('Kendine saldıramazsın Reis!', 'hata');", "profilSaldirSonucGoster(t('game.profil.attackSelf'), 'hata');", "profil attack self");
rep("profilSaldirSonucGoster('Kendine istihbarat gönderemezsin!', 'hata');", "profilSaldirSonucGoster(t('game.profil.intelSelf'), 'hata');", "profil intel self");
rep("sonucEl.innerHTML = '<div class=\"saldiri-sonuc saldiri-sonuc--bekliyor\">Saldırı yapılıyor...</div>';", "sonucEl.innerHTML = '<div class=\"saldiri-sonuc saldiri-sonuc--bekliyor\">' + escHtml(t('game.profil.attackPending')) + '</div>';", "profil attack pending");
rep("var zHtml = '<h3 class=\"profil-ziyaretler-baslik\">Profil Ziyaretleri</h3>", "var zHtml = '<h3 class=\"profil-ziyaretler-baslik\">' + escHtml(t('game.profil.visitsTitle')) + '</h3>", "profil visits");

// Mafya prompts
rep("var yeni = prompt('Yeni Mafya Grubu adı:');", "var yeni = prompt(t('game.mafya.promptNewName'));", "mafya prompt name");
rep("var metin = prompt('Mafya grubuna gönderilecek mesaj:');", "var metin = prompt(t('game.mafya.promptGroupMsg'));", "mafya prompt msg");
rep("var rutbe = prompt('Yeni rütbe:');", "var rutbe = prompt(t('game.mafya.promptNewRank'));", "mafya prompt rank");

// Sector screen titles
rep("sektorEkranCiz(ic, 'yeralti', 'YERALTI SEKTÖRÜ');", "sektorEkranCiz(ic, 'yeralti', t('screen.sektor_yeralti'));", "sector yeralti");
rep("sektorEkranCiz(ic, 'silah', 'SİLAH SEKTÖRÜ');", "sektorEkranCiz(ic, 'silah', t('screen.sektor_silah'));", "sector silah");
rep("sektorEkranCiz(ic, 'paket', 'PAKET SEKTÖRÜ');", "sektorEkranCiz(ic, 'paket', t('screen.sektor_paket'));", "sector paket");

// History gunTxt
rep("var gunTxt = gun + ' gün';", "var gunTxt = gun + t('game.daysUnit');", "history days");

// ELIT and HUKUM notes
rep("var ELIT_FIYAT_NOTU = '<p style=\"color:#fff;font-size:13px;margin:12px 0 16px;\">Şehre Hükmet en oyuncuya ve en çok saygınlığı olan oyuncuya sektör ve güç alımlarında x2 fiyat uygulanır!</p>';", "var ELIT_FIYAT_NOTU = '<p style=\"color:#fff;font-size:13px;margin:12px 0 16px;\">' + t('game.elitePriceDefault') + '</p>';", "elite note");
rep("var HUKUM_SAVUNMA_METIN = 'Şehre hükmeden oyuncu liman, Sözünü Geçir ve Sadakat Yemini saldırılarında savunma gücü %50 hesaplanır. Düşmana Çök ve profilden saldırıda tam güç geçerlidir.';", "var HUKUM_SAVUNMA_METIN = t('game.rulerDefenseNote');", "hukum metin");

fs.writeFileSync(file, s, "utf8");
console.log("Done patching script.js");
