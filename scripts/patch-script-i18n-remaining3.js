const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "public", "script.js");
let s = fs.readFileSync(file, "utf8");
let n = 0;
function R(a, b) { if (s.includes(a)) { s = s.split(a).join(b); n++; } }

// profilEkranSablonu
R("'+ '<div class=\"profil-detay-satir\"><dt>Oyuncu İsmi</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.playerName')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Şirket</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.company')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Saygınlık</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.respect')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Sıralama</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.rank')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Mafya Grubu Sıralaması</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.groupRank')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>İcraat Hakkı Yenilenmesine</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.actionRegen')) + '</dt>");
R("'+ '<label for=\"profilYeniOyuncuAdi\">Oyuncu Adı Değiştir</label>'", "'+ '<label for=\"profilYeniOyuncuAdi\">' + escHtml(t('game.profil.changeName')) + '</label>'");
R("'+ '<label>Açıklama Ekle</label>'", "'+ '<label>' + escHtml(t('game.profil.addDescription')) + '</label>'");
R("'+ '<div><label for=\"profilDusmanlar\">Düşmanlar</label>'", "'+ '<div><label for=\"profilDusmanlar\">' + escHtml(t('game.profil.enemies')) + '</label>'");
R("'+ '<div><label>Düşmanlar</label>", "'+ '<div><label>' + escHtml(t('game.profil.enemies')) + '</label>");
R("'+ '<label for=\"eskiSifre\">Mevcut şifre</label>'", "'+ '<label for=\"eskiSifre\">' + escHtml(t('game.profil.currentPassword')) + '</label>'");
R("'+ '<label for=\"yeniSifre\">Yeni şifre</label>'", "'+ '<label for=\"yeniSifre\">' + escHtml(t('game.profil.newPassword')) + '</label>'");
R("'+ '<label for=\"profilZiyaretMesajMetin\">Mesajın</label>'", "'+ '<label for=\"profilZiyaretMesajMetin\">' + escHtml(t('game.profil.yourMessage')) + '</label>'");
R("isDurumu.turAd || 'Şirket'", "isDurumu.turAd || t('game.profil.company')");

// buyume + liman
R(`  if (tip === 'mahalle') {
    ic.innerHTML = '<h2>🏡 MAHALLE İŞLERİ</h2><p>"Küçük işlerle sermaye yap."</p>'
      + isKartHTML(isGorselleri.market, '🛒 Köşedeki Marketi Haraca Bağla', '+800 TL', '1 İcraat', '300 Güç', "isYap('market')")
      + isKartHTML(isGorselleri.tamirhane, '🔧 Kaçak Otomobil Tamirhanesi', '+1.500 TL', '1 İcraat', '600 Güç', "isYap('tamirhane')")
      + isKartHTML(isGorselleri.koruma, '🛡️ Esnafa Güvence Sağla', '+2.800 TL', '2 İcraat', '1.200 Güç', "isYap('esnafa_guvence')")
      + isKartHTML(isGorselleri.kumarhane, '🎲 Gizli Yeraltı Zar Salonu Aç', '+4.500 TL', '2 İcraat', '2.500 Güç', "isYap('zar_salonu')");
    return;
  }`, `  if (tip === 'mahalle') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.mahalleTitle')) + '</h2><p>' + escHtml(t('game.buyume.mahalleQuote')) + '</p>'
      + buyumeIsKart('market', 'market', '+800 TL', '1', '300')
      + buyumeIsKart('tamirhane', 'tamirhane', '+1.500 TL', '1', '600')
      + buyumeIsKart('esnafa_guvence', 'koruma', '+2.800 TL', '2', '1.200')
      + buyumeIsKart('zar_salonu', 'kumarhane', '+4.500 TL', '2', '2.500');
    return;
  }`);
R(`  if (tip === 'semt') {
    ic.innerHTML = '<h2>🏢 SEMT İŞLERİ</h2><p>"Semtte söz sahibi ol."</p>'
      + isKartHTML(isGorselleri.gece_kulubu, '🏢 Lüks Gece Kulübü Güvenliği', '+12.000 TL', '3 İcraat', '6.000 Güç', "isYap('gece_kulubu')")
      + isKartHTML(isGorselleri.kumarhane_agi, '🎰 Semtin Kumarhane Ağını Ele Geçir', '+18.000 TL', '3 İcraat', '8.000 Güç', "isYap('kumarhane_agi')")
      + isKartHTML(isGorselleri.kara_para, '💰 Kara Para Aklamanın Yolunu Aç', '+25.000 TL', '4 İcraat', '10.000 Güç', "isYap('kara_para')")
      + isKartHTML(isGorselleri.galeri, '🖼️ Semt Galerisine Çök', '+32.000 TL', '4 İcraat', '12.000 Güç', "isYap('semt_galeri')");
    return;
  }`, `  if (tip === 'semt') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.semtTitle')) + '</h2><p>' + escHtml(t('game.buyume.semtQuote')) + '</p>'
      + buyumeIsKart('gece_kulubu', 'gece_kulubu', '+12.000 TL', '3', '6.000')
      + buyumeIsKart('kumarhane_agi', 'kumarhane_agi', '+18.000 TL', '3', '8.000')
      + buyumeIsKart('kara_para', 'kara_para', '+25.000 TL', '4', '10.000')
      + buyumeIsKart('semt_galeri', 'galeri', '+32.000 TL', '4', '12.000');
    return;
  }`);
R(`  if (tip === 'sehir') {
    ic.innerHTML = '<h2>🌆 ŞEHİR İŞLERİ</h2><p>"Şehrin zirvesindekiler ihaleleri yönetir."</p>'
      + isKartHTML(isGorselleri.lojistik, '🏗️ Büyük Lojistik İhalesini Al', '+45.000 TL', '5 İcraat', '15.000 Güç', "isYap('lojistik')")
      + isKartHTML(isGorselleri.gumruk, '🚢 Gümrük Müdürünü Satın Al', '+80.000 TL', '6 İcraat', '25.000 Güç', "isYap('gumruk')")
      + isKartHTML(isGorselleri.belediye, '🏛️ Belediye İhalesine El At', '+120.000 TL', '8 İcraat', '40.000 Güç', "isYap('belediye')")
      + isKartHTML(isGorselleri.holding, '🏢 Büyük Holdinge Güvence Sağla', '+200.000 TL', '10 İcraat', '55.000 Güç', "isYap('buyuk_holding')");
    return;
  }`, `  if (tip === 'sehir') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.sehirTitle')) + '</h2><p>' + escHtml(t('game.profil.noJobHint')) + '</p>'
      + buyumeIsKart('lojistik', 'lojistik', '+45.000 TL', '5', '15.000')
      + buyumeIsKart('gumruk', 'gumruk', '+80.000 TL', '6', '25.000')
      + buyumeIsKart('belediye', 'belediye', '+120.000 TL', '8', '40.000')
      + buyumeIsKart('buyuk_holding', 'holding', '+200.000 TL', '10', '55.000');
    return;
  }`);

// fix sehir quote - I made a mistake above using noJobHint - fix in output
s = s.replace(
  "ic.innerHTML = '<h2>' + escHtml(t('game.buyume.sehirTitle')) + '</h2><p>' + escHtml(t('game.profil.noJobHint')) + '</p>'",
  "ic.innerHTML = '<h2>' + escHtml(t('game.buyume.sehirTitle')) + '</h2><p>' + escHtml(t('game.buyume.sehirQuote')) + '</p>'"
);

R(`  if (tip === 'liman') {
    ic.innerHTML = '<h2>🚢 LİMAN İŞLETMELERİ</h2>'
      + '<p>"Boğazdan Akdeniz\\'e — güçlü olan limanı alır. Saatlik gelir sahibine otomatik işler."</p>'
      + HUKUM_SAVUNMA_NOTU
      + '<p class="liman-gelir-notu">⏱️ Türkiye saatiyle her saat başı liman başına <b>100.000 TL</b> kazanırsın. '
      + '<b>Üç limanı birden elinde tutarsan saatlik toplam 500.000 TL kazanırsın!</b></p>'
      + limanKartHTML('istanbul') + limanKartHTML('izmir') + limanKartHTML('hatay');
    return;
  }`, `  if (tip === 'liman') {
    ic.innerHTML = '<h2>' + escHtml(t('game.sehre.portsTitle')) + '</h2>'
      + '<p>' + escHtml(t('game.liman.quote')) + '</p>'
      + HUKUM_SAVUNMA_NOTU
      + '<p class="liman-gelir-notu">' + t('game.liman.incomeNote') + '</p>'
      + limanKartHTML('istanbul') + limanKartHTML('izmir') + limanKartHTML('hatay');
    return;
  }`);

// gazete hakimiyet + hero
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">👑 <strong>Şehre Hükmeden:</strong> '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' — üç liman ve makamlar onun elinde.</p>';`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.rulerFull') + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.rulerFullSuffix')) + '</p>';`);
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(h.limanAd || 'Liman') + ': '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrolünde.</p>';`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(h.limanAd || t('game.gazete.portLabel')) + ': '
          + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.controlledBy')) + '</p>';`);
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">👤 Şu an Liman Bölgesini '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrol ediyor. Sokaklar onun kurallarıyla yönetiliyor.</p>';`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.portControlled') + oyuncuLink(h.userId, h.oyuncuAdi) + t('game.gazete.portRules') + '</p>';`);
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">❌ Bölgede dengeler değişti '
          + oyuncuLink(h.kazananUserId, h.kazananAdi);`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.balanceChanged') + oyuncuLink(h.kazananUserId, h.kazananAdi);`);

R(`      + '<p class="gazete-alinti-ust"><em>"Bu şehirde adalet değil, güç konuşur."</em></p>'`, `      + '<p class="gazete-alinti-ust"><em>' + escHtml(t('game.gazete.quote')) + '</em></p>'`);
R(`      + '<h1 class="gazete-ana-baslik">MEDYA HABER</h1>'`, `      + '<h1 class="gazete-ana-baslik">' + escHtml(t('game.gazete.heroTitle')) + '</h1>'`);
R(`      + '<p class="gazete-alt-baslik">YERALTI DÜNYASININ GAZETESİ</p>'`, `      + '<p class="gazete-alt-baslik">' + escHtml(t('game.gazete.subtitle')) + '</p>'`);
R(`      + '<span class="gazete-ticker-etiket">SON DAKİKA</span>'`, `      + '<span class="gazete-ticker-etiket">' + escHtml(t('game.gazete.breaking')) + '</span>'`);
R(`      + '<span class="gazete-etiket">ŞU MAFYANIN MANŞETİ</span>'`, `      + '<span class="gazete-etiket">' + escHtml(t('game.gazete.mafiaHeadline')) + '</span>'`);
R(`      + '<span class="gazete-devam">HABERİN DEVAMI &gt;</span>'`, `      + '<span class="gazete-devam">' + t('game.gazete.readMore') + '</span>'`);
R(`      + '<h3 class="gazete-yan-baslik">EN ÇOK SAYGINLIK KAZANANLAR</h3>'`, `      + '<h3 class="gazete-yan-baslik">' + escHtml(t('game.gazete.topRespect')) + '</h3>'`);
R(`      + '<h3 class="gazete-is-ilanlari-baslik">İŞ İLANLARI</h3>'`, `      + '<h3 class="gazete-is-ilanlari-baslik">' + escHtml(t('game.gazete.jobListings')) + '</h3>'`);
R(`      + '<p class="gazete-is-ilanlari-not">Şirket sahipleri ilan açtığında burada listelenir — pozisyona tıklayıp başvurabilirsin.</p>'`, `      + '<p class="gazete-is-ilanlari-not">' + escHtml(t('game.gazete.jobListingsNote')) + '</p>'`);
R(`      + '<div class="gazete-kutu"><h4>ŞEHRİN HAKİMİYETİ</h4>'`, `      + '<div class="gazete-kutu"><h4>' + escHtml(t('game.gazete.dominance')) + '</h4>'`);
R(`      + '<div class="gazete-kutu gazete-kutu-kirmizi"><h4>YERALTI MANŞETLERİ <small>(Özel İlanlar)</small></h4>'`, `      + '<div class="gazete-kutu gazete-kutu-kirmizi"><h4>' + t('game.gazete.undergroundHeadlines') + '</h4>'`);
R(`      + '<div class="gazete-kutu"><h4>SON 24 SAATİN EFSANELERİ</h4>'`, `      + '<div class="gazete-kutu"><h4>' + escHtml(t('game.gazete.legends24h')) + '</h4>'`);
R(`        + '<span class="gazete-aylik-sampiyon-etiket">AYLIK RAPOR</span>'`, `        + '<span class="gazete-aylik-sampiyon-etiket">' + escHtml(t('game.gazete.monthlyReport')) + '</span>'`);
R(`    ? fmt(r.miktar || 0) + ' Saygınlık'`, `    ? fmt(r.miktar || 0) + t('game.gazete.respectUnit')`);
R(`        : '+' + fmt(r.miktar || 0) + ' Saygınlık';`, `        : '+' + fmt(r.miktar || 0) + t('game.gazete.respectGain');`);

// sehir tarihi
R(`    var html = '<h2>📜 ŞEHİR TARİHİ</h2>'
      + '<h3 style="margin:16px 0 10px;color:#b8942a;">ŞEHRE HÜKMEDENLERİN İSİMLERİ:</h3>';`, `    var html = '<h2>📜 ' + escHtml(t('screen.sehirTarihi').toUpperCase()) + '</h2>'
      + '<h3 style="margin:16px 0 10px;color:#b8942a;">' + escHtml(t('game.history.rulersHeading')) + '</h3>';`);
R(`        + '<p>📅 Başlangıç: ' + basTxt + '</p>';`, `        + '<p>' + escHtml(t('game.history.start')) + ' ' + basTxt + '</p>';`);

// displayed load errors
R("|| 'Yüklenemedi'", "|| t('game.error.loadFailed')");
R("data.error || 'Yüklenemedi'", "data.error || t('game.error.loadFailed')");

fs.writeFileSync(file, s, "utf8");
console.log("Applied", n, "replacements in batch 3");
