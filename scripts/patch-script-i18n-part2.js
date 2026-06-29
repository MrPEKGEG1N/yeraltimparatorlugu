const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "public", "script.js");
let s = fs.readFileSync(file, "utf8");

const reps = [
  ["'>Ödülü Al</button>'", ">' + escHtml(t('game.tasks.claimReward')) + '</button>'"],
  ["'>Başarısız</span>'", ">' + escHtml(t('game.tasks.failed')) + '</span>'"],
  ["'>Teslim edildi</span>'", ">' + escHtml(t('game.tasks.delivered')) + '</span>'"],
  ["'>Devam</span>'", ">' + escHtml(t('game.tasks.inProgressShort')) + '</span>'"],
  ["'>Kota doldu</span>'", ">' + escHtml(t('game.tasks.quotaFull')) + '</span>'"],
  ["'>Kabul Et</button>'", ">' + escHtml(t('game.tasks.accept')) + '</button>'"],
  ["'<span class=\"gg-ozet-etiket\">Kabul edilen</span> '", "'<span class=\"gg-ozet-etiket\">' + escHtml(t('game.tasks.acceptedLabel')) + '</span> '"],
  ["'<span class=\"gg-hucre gg-adet\">Adet</span>'", "'<span class=\"gg-hucre gg-adet\">' + escHtml(t('game.tasks.colQty')) + '</span>'"],
  ["'<span class=\"gg-hucre gg-aksiyon\">Aksiyon</span>'", "'<span class=\"gg-hucre gg-aksiyon\">' + escHtml(t('game.tasks.colAction')) + '</span>'"],
  ["'>[ 👑 MAKAMA ÇÖK — 1 İCRAAT ]</button>'", ">' + escHtml(t('game.boss.seizeSeat')) + '</button>'"],
  ["'>[ ✍️ YAZDIR ]</button>'", ">' + escHtml(t('game.boss.publish')) + '</button>'"],
  ["'>[ 🤝 TANI ]</button>'", ">' + escHtml(t('game.loyalty.recognize')) + '</button>'"],
  ["'>[ ❌ REDDET ]</button>'", ">' + escHtml(t('game.loyalty.reject')) + '</button>'"],
  ["'<h4>TANIYANLAR</h4>'", "'<h4>' + escHtml(t('game.loyalty.recognizers')) + '</h4>'"],
  ["'<h4>TANIMAYANLAR</h4>'", "'<h4>' + escHtml(t('game.loyalty.rejecters')) + '</h4>'"],
  ["baslik: 'SADAKAT YEMİNİ',", "baslik: t('game.sehre.loyaltyTitle'),"],
  ["motto: 'Kılıcımız değil, sözümüz keskindir; biat eden asla yarı yolda kalmaz.',", "motto: t('game.sehre.loyaltyMotto'),"],
  ["metinler: ['Babanıza Sadakat Yemini edin, rahat edin. Söz sahibi babanın sözü aşağıdadır.'],", "metinler: [t('game.sehre.loyaltyText')],"],
  ["baslik: 'SÖZÜNÜ GEÇİR',", "baslik: t('game.sehre.wordTitle'),"],
  ["motto: 'Söz bitince, icraat başlar. Şimdi herkes ayağını denk alsın.',", "motto: t('game.sehre.wordMotto'),"],
  ["'Bu alemde en büyük söz sahibi babadır. Hepiniz sözünü dinleyeceksiniz!'", "t('game.sehre.wordText')"],
  ["'+ '<h2>ŞEHRE HÜKMET</h2>'", "'+ '<h2>' + escHtml(t('game.sehre.title')) + '</h2>'"],
  ["'+ '<p class=\"sh-baslik-alt\">Tahtın üç kapısı — söz, sadakat ve liman.</p>'", "'+ '<p class=\"sh-baslik-alt\">' + escHtml(t('game.sehre.subtitle')) + '</p>'"],
  ["'+ '<div class=\"sh-kart-icerik\"><h3>SÖZÜNÜ GEÇİR</h3>'", "'+ '<div class=\"sh-kart-icerik\"><h3>' + escHtml(t('game.sehre.wordTitle')) + '</h3>'"],
  ["'+ '<p class=\"sh-kart-aciklama\">Alemde en büyük söz burada konur; herkes dinler.</p>'", "'+ '<p class=\"sh-kart-aciklama\">' + escHtml(t('game.sehre.wordDesc')) + '</p>'"],
  ["'+ '<div class=\"sh-kart-icerik\"><h3>SADAKAT YEMİNİ</h3>'", "'+ '<div class=\"sh-kart-icerik\"><h3>' + escHtml(t('game.sehre.loyaltyTitle')) + '</h3>'"],
  ["'+ '<p class=\"sh-kart-aciklama\">Babaya biat eden asla yarı yolda kalmaz.</p>'", "'+ '<p class=\"sh-kart-aciklama\">' + escHtml(t('game.sehre.loyaltyDesc')) + '</p>'"],
  ["'+ '<div class=\"sh-kart-icerik\"><h3>LİMAN İŞLETMELERİ</h3>'", "'+ '<div class=\"sh-kart-icerik\"><h3>' + escHtml(t('game.sehre.portsTitle')) + '</h3>'"],
  ["'+ '<p class=\"sh-kart-aciklama\">İstanbul, İzmir ve Hatay — saatlik dev gelir.</p>'", "'+ '<p class=\"sh-kart-aciklama\">' + escHtml(t('game.sehre.portsDesc')) + '</p>'"],
  ["'+ '<p class=\"sh-alt-not\">Makam veya liman ele geçirmek için 1 İcraat gerekir. Kazanan rakibin saygınlığının %5\\'ini alır.</p>'", "'+ '<p class=\"sh-alt-not\">' + escHtml(t('game.sehre.note')) + '</p>'"],
  ["{ key: 'ekip', tip: 'korumaEkibi', label: 'Ekip Kirala' }", "{ key: 'ekip', tip: 'korumaEkibi', label: t('screen.korumaEkibi') }"],
  ["{ key: 'silah', tip: 'silahlan', label: 'Silahlan' }", "{ key: 'silah', tip: 'silahlan', label: t('screen.silahlan') }"],
  ["return '<span class=\"sh-kart-sahip sh-kart-sahip--benim\">👑 ' + benim + '/3 liman sizde</span>';", "return '<span class=\"sh-kart-sahip sh-kart-sahip--benim\">👑 ' + escHtml(t('game.sehre.portsYours', { n: benim })) + '</span>';"],
  ["return '<span class=\"sh-kart-sahip\">' + dolu + '/3 liman dolu</span>';", "return '<span class=\"sh-kart-sahip\">' + escHtml(t('game.sehre.portsOccupied', { n: dolu })) + '</span>';"],
  ["masterFramePlaqueGuncelle('profilim', 'PROFİL');", "masterFramePlaqueGuncelle('profilim', t('game.screen.profilVisit'));"],
  ["onclick=\"icerikRaporlaAc(this)\">Raporla</button>'", "onclick=\"icerikRaporlaAc(this)\">' + escHtml(t('game.report.btn')) + '</button>'"],
  ["onclick=\"icerikRaporlaGonder(this)\">Gönder</button>'", "onclick=\"icerikRaporlaGonder(this)\">' + escHtml(t('game.report.send')) + '</button>'"],
  ["onclick=\"icerikRaporlaKapat(this)\">İptal</button>'", "onclick=\"icerikRaporlaKapat(this)\">' + escHtml(t('game.report.cancel')) + '</button>'"],
  ["'+ '<h3 class=\"gy-asama-baslik\">GELİŞİM AŞAMALARI</h3>'", "'+ '<h3 class=\"gy-asama-baslik\">' + escHtml(t('game.gy.stagesTitle')) + '</h3>'"],
  ["'>TÜM AŞAMALARI GÖR</button>'", ">' + escHtml(t('game.gy.showAllStages')) + '</button>'"],
  ["if (btn) btn.textContent = guvenliYerAsamaGenis ? 'DAHA AZ GÖSTER' : 'TÜM AŞAMALARI GÖR';", "if (btn) btn.textContent = guvenliYerAsamaGenis ? t('game.gy.showLess') : t('game.gy.showAllStages');"],
  ["'+ '<div class=\"gy-hero-seviye\" id=\"guvenliYerHeroSeviye\">ÜS SEVİYESİ —</div>'", "'+ '<div class=\"gy-hero-seviye\" id=\"guvenliYerHeroSeviye\">' + escHtml(t('game.gy.baseLevel')) + '</div>'"],
  ["'+ '<h4 class=\"gy-onizleme-baslik\">SEVİYE ÖNİZLEME</h4>'", "'+ '<h4 class=\"gy-onizleme-baslik\">' + escHtml(t('game.gy.previewTitle')) + '</h4>'"],
  ["'+ '<span class=\"gy-perk-baslik\">DAHA GÜÇLÜ</span><span class=\"gy-perk-alt\">SAVUNMA</span></div>'", "'+ '<span class=\"gy-perk-baslik\">' + escHtml(t('game.gy.perk.stronger')) + '</span><span class=\"gy-perk-alt\">' + escHtml(t('game.gy.perk.defense')) + '</span></div>'"],
  ["'+ '<span class=\"gy-perk-baslik\">GÜÇ</span><span class=\"gy-perk-alt\">ARTIŞI</span></div>'", "'+ '<span class=\"gy-perk-baslik\">' + escHtml(t('game.gy.perk.power')) + '</span><span class=\"gy-perk-alt\">' + escHtml(t('game.gy.perk.increase')) + '</span></div>'"],
  ["'+ '<span class=\"gy-perk-baslik\">PRESTİJ</span><span class=\"gy-perk-alt\">KAZANCI</span></div>'", "'+ '<span class=\"gy-perk-baslik\">' + escHtml(t('game.gy.perk.prestige')) + '</span><span class=\"gy-perk-alt\">' + escHtml(t('game.gy.perk.earnings')) + '</span></div>'"],
  ["'+ '<span class=\"gy-perk-baslik\">YENİ</span><span class=\"gy-perk-alt\">ÖZELLİKLER</span></div>'", "'+ '<span class=\"gy-perk-baslik\">' + escHtml(t('game.gy.perk.new')) + '</span><span class=\"gy-perk-alt\">' + escHtml(t('game.gy.perk.features')) + '</span></div>'"],
  ["img.alt = 'Güvenli Yer — Seviye ' + goster;", "img.alt = t('game.gy.altLevel', { n: goster });"],
  ["heroSev.textContent = 'ÜS SEVİYESİ ' + mevcut + ' / 15';", "heroSev.textContent = t('game.gy.baseLevelN', { n: mevcut });"],
  ["el.innerHTML = html || '<p class=\"gy-yukleniyor\">Aşama yok</p>';", "el.innerHTML = html || '<p class=\"gy-yukleniyor\">' + escHtml(t('game.gy.noStages')) + '</p>';"],
  ["var html = '<h4 class=\"gy-kasa-baslik\">GİZLİ KASALAR</h4>", "var html = '<h4 class=\"gy-kasa-baslik\">' + escHtml(t('game.gy.vaultsTitle')) + '</h4>"],
  ["var html = '<h3 class=\"gy-durum-baslik\">ÜS DURUMU</h3>'", "var html = '<h3 class=\"gy-durum-baslik\">' + escHtml(t('game.gy.statusTitle')) + '</h3>'"],
  ["'+ '<small>Seviye</small>'", "'+ '<small>' + escHtml(t('game.gy.stat.level')) + '</small>'"],
  ["'+ '<small>Normal Güç</small>'", "'+ '<small>' + escHtml(t('game.gy.stat.normalPower')) + '</small>'"],
  ["'+ '<small>Bonus Güç</small>'", "'+ '<small>' + escHtml(t('game.gy.stat.bonusPower')) + '</small>'"],
  ["'+ '<small>Toplam Güç</small>'", "'+ '<small>' + escHtml(t('game.gy.stat.totalPower')) + '</small>'"],
  ["'+ '<small>Kasadaki Nakit</small>'", "'+ '<small>' + escHtml(t('game.gy.stat.cash')) + '</small>'"],
  ["'+ '<small>Gizli Kasa Koruması</small>'", "'+ '<small>' + escHtml(t('game.gy.stat.vaultProtection')) + '</small>'"],
  ["'+ '<h4>Sonraki: ' + escHtml(gyKisaAd(sonraki)) + '</h4>'", "'+ '<h4>' + escHtml(t('game.gy.next', { name: gyKisaAd(sonraki) })) + '</h4>'"],
  ["'+ '<div class=\"gy-yukselt-satir\"><span>Güç Kazancı</span>'", "'+ '<div class=\"gy-yukselt-satir\"><span>' + escHtml(t('game.gy.powerGain')) + '</span>'"],
  ["'+ '<div class=\"gy-yukselt-satir\"><span>Maliyet</span>'", "'+ '<div class=\"gy-yukselt-satir\"><span>' + escHtml(t('game.gy.cost')) + '</span>'"],
  ["'+ '<span>MEVCUT <b>'", "'+ '<span>' + escHtml(t('game.gy.current')) + ' <b>'"],
  ["'+ '<span>SONRAKİ <b>'", "'+ '<span>' + escHtml(t('game.gy.after')) + ' <b>'"],
  ["'>ÜSSÜ GELİŞTİR</button>'", ">' + escHtml(t('game.gy.upgradeBtn')) + '</button>'"],
  ["html += '<div class=\"gy-tamamlandi\">Üssün tam kapasiteye ulaştı.</div>';", "html += '<div class=\"gy-tamamlandi\">' + escHtml(t('game.gy.maxLevel')) + '</div>';"],
];

reps.forEach(function (pair) {
  if (!s.includes(pair[0])) {
    console.warn("MISS:", pair[0].slice(0, 50));
    return;
  }
  s = s.split(pair[0]).join(pair[1]);
  console.log("OK:", pair[0].slice(0, 40));
});

// GY_KISA_AD -> function
const gyOld = `var GY_KISA_AD = {
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
  stratejik_bunker: 'Stratejik Bunker',
  bunker_girisi: 'Bunker Girişi'
};

function gyGorselYolu(seviye) {`;

const gyNew = `function gyAsamaEtiket(id) {
  var k = 'game.gy.stage.' + id;
  var v = t(k);
  return v !== k ? v : id;
}

function gyGorselYolu(seviye) {`;

if (s.includes(gyOld)) {
  s = s.replace(gyOld, gyNew);
  s = s.replace("return GY_KISA_AD[modul.id] || modul.ad || '';", "return gyAsamaEtiket(modul.id) || modul.ad || '';");
  console.log("OK: GY_KISA_AD");
}

// masterFramePlaque + remove ML_EKRAN
const plaqueOld = `function masterFramePlaqueGuncelle(tip, altBaslik) {
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
}`;

const plaqueNew = `function masterFramePlaqueGuncelle(tip, altBaslik) {
  var el = document.getElementById('masterFramePlaque');
  if (!el) return;
  if (altBaslik) {
    el.textContent = altBaslik;
    return;
  }
  if (tip && String(tip).indexOf('mafya_') === 0) {
    var mod = String(tip).replace('mafya_', '');
    el.textContent = typeof mafyaTitle === 'function' ? mafyaTitle(mod) : t('screen.mafya');
    return;
  }
  if (typeof screenTitle === 'function') {
    el.textContent = screenTitle(tip);
    return;
  }
  if (typeof I18n !== 'undefined' && I18n.screenTitle) {
    el.textContent = I18n.screenTitle(tip);
    return;
  }
  el.textContent = String(tip || '').replace(/_/g, ' ').toUpperCase();
}`;

if (s.includes(plaqueOld)) {
  s = s.replace(plaqueOld, plaqueNew);
  console.log("OK: plaque");
}

const mlBlock = s.match(/var ML_EKRAN_BASLIKLARI = \{[\s\S]*?\};\n\n/);
if (mlBlock) {
  s = s.replace(mlBlock[0], "");
  console.log("OK: removed ML_EKRAN_BASLIKLARI");
}

fs.writeFileSync(file, s, "utf8");
console.log("Part 2 done");
