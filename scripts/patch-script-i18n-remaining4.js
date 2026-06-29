const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "public", "script.js");
let s = fs.readFileSync(file, "utf8");
let n = 0;
function R(a, b) {
  if (!s.includes(a)) return;
  s = s.split(a).join(b);
  n++;
}

// profil detay + form labels
R('<div class="profil-detay-satir"><dt>Oyuncu İsmi</dt>', "' + '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.playerName')) + '</dt>");
R('<div class="profil-detay-satir"><dt>Şirket</dt>', "' + '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.company')) + '</dt>");
R('<div class="profil-detay-satir"><dt>Saygınlık</dt>', "' + '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.respect')) + '</dt>");
R('<div class="profil-detay-satir"><dt>Sıralama</dt>', "' + '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.rank')) + '</dt>");
R('<div class="profil-detay-satir"><dt>Mafya Grubu Sıralaması</dt>', "' + '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.groupRank')) + '</dt>");
R('<div class="profil-detay-satir"><dt>İcraat Hakkı Yenilenmesine</dt>', "' + '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.actionRegen')) + '</dt>");
R('<label for="profilYeniOyuncuAdi">Oyuncu Adı Değiştir</label>', "' + '<label for=\"profilYeniOyuncuAdi\">' + escHtml(t('game.profil.changeName')) + '</label>'");
R('<label>Açıklama Ekle</label>', "' + '<label>' + escHtml(t('game.profil.addDescription')) + '</label>'");
R('<label for="profilDostlar">Dostlar</label>', "' + '<label for=\"profilDostlar\">' + escHtml(t('game.profil.friends')) + '</label>'");
R('<label for="profilDusmanlar">Düşmanlar</label>', "' + '<label for=\"profilDusmanlar\">' + escHtml(t('game.profil.enemies')) + '</label>'");
R('<div><label>Dostlar</label>', "' + '<div><label>' + escHtml(t('game.profil.friends')) + '</label>");
R('<div><label>Düşmanlar</label>', "' + '<div><label>' + escHtml(t('game.profil.enemies')) + '</label>");
R('<label for="eskiSifre">Mevcut şifre</label>', "' + '<label for=\"eskiSifre\">' + escHtml(t('game.profil.currentPassword')) + '</label>'");
R('<label for="yeniSifre">Yeni şifre</label>', "' + '<label for=\"yeniSifre\">' + escHtml(t('game.profil.newPassword')) + '</label>'");
R('<label for="profilZiyaretMesajMetin">Mesajın</label>', "' + '<label for=\"profilZiyaretMesajMetin\">' + escHtml(t('game.profil.yourMessage')) + '</label>'");

// gazete hakimiyet
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">👑 <strong>Şehre Hükmeden:</strong> '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' — üç liman ve makamlar onun elinde.</p>';`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.rulerFull') + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.rulerFullSuffix')) + '</p>';`);
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(h.limanAd || 'Liman') + ': '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrolünde.</p>';`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(h.limanAd || t('game.gazete.portLabel')) + ': '
          + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.controlledBy')) + '</p>';`);
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">👤 Şu an Liman Bölgesini '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrol ediyor. Sokaklar onun kurallarıyla yönetiliyor.</p>';`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.portControlled') + oyuncuLink(h.userId, h.oyuncuAdi) + t('game.gazete.portRules') + '</p>';`);
R(`        hakimiyetHtml += '<p class="gazete-hakim-satir">❌ Bölgede dengeler değişti '
          + oyuncuLink(h.kazananUserId, h.kazananAdi);`, `        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.balanceChanged') + oyuncuLink(h.kazananUserId, h.kazananAdi);`);

// buyume + liman screens
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
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.sehirTitle')) + '</h2><p>' + escHtml(t('game.buyume.sehirQuote')) + '</p>'
      + buyumeIsKart('lojistik', 'lojistik', '+45.000 TL', '5', '15.000')
      + buyumeIsKart('gumruk', 'gumruk', '+80.000 TL', '6', '25.000')
      + buyumeIsKart('belediye', 'belediye', '+120.000 TL', '8', '40.000')
      + buyumeIsKart('buyuk_holding', 'holding', '+200.000 TL', '10', '55.000');
    return;
  }`);
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

// sehir tarihi header
R(`    var html = '<h2>📜 ŞEHİR TARİHİ</h2>'
      + '<h3 style="margin:16px 0 10px;color:#b8942a;">ŞEHRE HÜKMEDENLERİN İSİMLERİ:</h3>';`, `    var html = '<h2>📜 ' + escHtml(t('screen.sehirTarihi').toUpperCase()) + '</h2>'
      + '<h3 style="margin:16px 0 10px;color:#b8942a;">' + escHtml(t('game.history.rulersHeading')) + '</h3>';`);

// ML_MAFYA_BASLIKLARI -> mafyaTitle only
R(`var ML_MAFYA_BASLIKLARI = {
  olustur: 'GRUP KUR',
  katil: 'GRUBA KATIL',
  gurubum: 'GRUBUM',
  savaslar: 'MAFYA SAVAŞLARI',
  isler: 'GRUP İŞLERİ',
  evi: 'MAFYA EVİ'
};

`, '');

R(`  masterFramePlaqueGuncelle('mafya', typeof I18n !== 'undefined' && I18n.mafyaTitle
    ? I18n.mafyaTitle(mod)
    : (ML_MAFYA_BASLIKLARI[mod] || 'MAFYA GRUBU'));`, `  masterFramePlaqueGuncelle('mafya', typeof mafyaTitle === 'function'
    ? mafyaTitle(mod)
    : (typeof I18n !== 'undefined' && I18n.mafyaTitle ? I18n.mafyaTitle(mod) : t('screen.mafya')));`);

// mafyaAltEkran olustur/katil
R(`      + '<h3 class="bolum-baslik">Mafya Grubu Oluştur</h3>'
      + '<p class="mafya-metin-dim">Grubunu kur, üyelerini topla, şehirde söz sahibi ol.</p>'`, `      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.createTitle')) + '</h3>'
      + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.createDesc')) + '</p>'`);
R(`      + '<div id="mafyaAciklamaAlan" class="gizli"><label>Açıklama:</label>'`, `      + '<div id="mafyaAciklamaAlan" class="gizli"><label>' + escHtml(t('game.mafya.descLabel')) + '</label>'`);
R(`      + '<h3 class="bolum-baslik">Mafya Grubuna Katıl</h3>'
      + '<p class="mafya-metin-dim">Mevcut bir gruba başvur veya listeden seç.</p>'`, `      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.joinTitle')) + '</h3>'
      + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.joinDesc')) + '</p>'`);

// mafyaIslerCiz
R(`      box.innerHTML = '<div class="mafya-isler-wrap"><h2>💼 MAFYA İŞLERİ</h2><p class="mafya-metin">Mafya grubuna üye olmadan bu işleri yapamazsın.</p></div>';`, `      box.innerHTML = '<div class="mafya-isler-wrap"><h2>' + escHtml(t('game.mafya.jobsTitle')) + '</h2><p class="mafya-metin">' + escHtml(t('game.mafya.jobsNeedMember')) + '</p></div>';`);
R(`    var html = '<div class="mafya-isler-wrap"><h2>💼 MAFYA İŞLERİ</h2>'
      + '<p>"Online üyelerle birlikte soyguna hazırlan, şartlar tutunca soygunu gerçekleştir."</p>'
      + '<div class="is-kart mafya-isler-ozet">'
      + '<p><b>Grup Online:</b> ' + panel.grup.onlineSayisi + ' / ' + panel.grup.uyeSayisi + '</p>'
      + (aktif ? ('<p><b>Aktif Hazırlık:</b> ' + aktif.isTuru + '</p>') : '<p class="mafya-metin-dim">Aktif hazırlık yok.</p>')`, `    var html = '<div class="mafya-isler-wrap"><h2>' + escHtml(t('game.mafya.jobsTitle')) + '</h2>'
      + '<p>' + escHtml(t('game.mafya.jobsQuote')) + '</p>'
      + '<div class="is-kart mafya-isler-ozet">'
      + '<p><b>' + escHtml(t('game.mafya.groupOnline')) + '</b> ' + panel.grup.onlineSayisi + ' / ' + panel.grup.uyeSayisi + '</p>'
      + (aktif ? ('<p><b>' + escHtml(t('game.mafya.activePrep')) + '</b> ' + escHtml(tr(aktif.isTuru)) + '</p>') : '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.noActivePrep')) + '</p>')`);
R(`        + '<div class="is-detay"><h3>' + isDef.ad + '</h3>'
        + '<p>👥 Şart: <b>' + isDef.minOnline + '</b> online üye &nbsp;|&nbsp; 🗡️ Her üye min <b>' + fmt(isDef.minGuc) + '</b> güç</p>'
        + '<p>💵 Kazanç (kişi): <b style="color:#28a745;">' + fmt(isDef.kazancKisi) + ' TL</b> &nbsp;|&nbsp; 🕶️ Saygınlık: <b>+' + isDef.sayginlikKisi + '</b></p>'
        + '<button class="btn-is" onclick="mafyaIsKatil(\\'' + isDef.key + '\\')">[ 🤝 SOYGUNA KATIL ]</button>';`, `        + '<div class="is-detay"><h3>' + escHtml(tr(isDef.ad)) + '</h3>'
        + '<p>' + escHtml(t('game.mafya.reqOnline')) + ' <b>' + isDef.minOnline + '</b>' + escHtml(t('game.mafya.onlineMembers')) + ' &nbsp;|&nbsp; ' + escHtml(t('game.mafya.eachMinPower')) + ' <b>' + fmt(isDef.minGuc) + '</b>' + escHtml(t('game.mafya.powerWord')) + '</p>'
        + '<p>' + escHtml(t('game.mafya.earnPerPerson')) + ' <b style="color:#28a745;">' + fmt(isDef.kazancKisi) + ' TL</b> &nbsp;|&nbsp; ' + escHtml(t('game.mafya.respectGain')) + ' <b>+' + isDef.sayginlikKisi + '</b></p>'
        + '<button class="btn-is" onclick="mafyaIsKatil(\\'' + isDef.key + '\\')">' + escHtml(t('game.mafya.joinHeist')) + '</button>';`);
R(`        html += '<button class="btn-is kirmizi-btn" style="margin-left:8px;" onclick="mafyaIsGerceklestir(' + aktif.id + ')">[ 💥 SOYGUNU GERÇEKLEŞTİR ]</button>';`, `        html += '<button class="btn-is kirmizi-btn" style="margin-left:8px;" onclick="mafyaIsGerceklestir(' + aktif.id + ')">' + escHtml(t('game.mafya.executeHeist')) + '</button>';`);
R(`        html += '<div class="mafya-metin" style="margin-top:10px;"><b>Katılanlar:</b> '`, `        html += '<div class="mafya-metin" style="margin-top:10px;"><b>' + escHtml(t('game.mafya.participants')) + '</b> '`);
R(`    box.innerHTML = '<div class="mafya-isler-wrap"><h2>💼 MAFYA İŞLERİ</h2><p class="mafya-bos-metin" style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p></div>';`, `    box.innerHTML = '<div class="mafya-isler-wrap"><h2>' + escHtml(t('game.mafya.jobsTitle')) + '</h2><p class="mafya-bos-metin" style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p></div>';`);

// mafyaEviCiz
R(`    var html = '<h2>🏠 MAFYA EVİ</h2>'
      + '<p>"Seviye yükseldikçe üye kapasitesi artar (her seviye +3)."</p>'
      + '<div class="mafya-evi-sahne"><img src="' + img + '" alt="Mafya Evi" onerror="imgFallback(this)"></div>'
      + '<div class="mafya-evi-alt is-kart"><h3>' + (data.grupAdi || 'Mafya Grubu') + ' — Seviye ' + s + '</h3>'
      + '<p>👥 Kapasite: <b>' + ev.kapasite + '</b> üye</p>'
      + '<p>💰 Birikim: <b style="color:#b8942a;">' + fmt(ev.birikmisPara) + ' TL</b></p>'
      + '<p>⬆️ Sonraki seviye maliyeti: <b>' + fmt(ev.sonrakiMaliyet) + ' TL</b> (Kalan: ' + fmt(ev.kalan) + ' TL)</p>'
      + '</div>';

    html += '<div class="is-kart mafya-evi-alt" style="max-width:520px;margin:0 auto;">'
      + '<h3 class="bolum-baslik">Hibe</h3>'
      + '<input type="number" id="mafyaHibe" class="dusman-input" placeholder="Hibe miktarı" style="width:100%;margin-bottom:8px;">'
      + '<button class="btn-is" onclick="mafyaEviHibe()">[ 💸 HİBE ET ]</button>';
    if (data.benLiderim) {
      html += '<button class="btn-is kirmizi-btn" style="margin-left:8px;" onclick="mafyaEviSeviye()">[ ⬆️ SEVİYE YÜKSELT ]</button>';
    }`, `    var html = '<h2>' + escHtml(t('game.mafya.houseTitle')) + '</h2>'
      + '<p>' + escHtml(t('game.mafya.houseQuote')) + '</p>'
      + '<div class="mafya-evi-sahne"><img src="' + img + '" alt="' + escHtml(t('game.mafya.houseAlt')) + '" onerror="imgFallback(this)"></div>'
      + '<div class="mafya-evi-alt is-kart"><h3>' + escHtml(data.grupAdi || t('screen.mafya')) + ' — ' + escHtml(t('game.mafya.levelWord')) + s + '</h3>'
      + '<p>' + escHtml(t('game.mafya.capacity')) + ' <b>' + ev.kapasite + '</b>' + escHtml(t('game.mafya.membersWord')) + '</p>'
      + '<p>' + escHtml(t('game.mafya.accumulation')) + ' <b style="color:#b8942a;">' + fmt(ev.birikmisPara) + ' TL</b></p>'
      + '<p>' + escHtml(t('game.mafya.nextLevelCost')) + ' <b>' + fmt(ev.sonrakiMaliyet) + ' TL</b> ' + escHtml(t('game.mafya.remaining')) + ' ' + fmt(ev.kalan) + ' TL)</p>'
      + '</div>';

    html += '<div class="is-kart mafya-evi-alt" style="max-width:520px;margin:0 auto;">'
      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.donation')) + '</h3>'
      + '<input type="number" id="mafyaHibe" class="dusman-input" placeholder="' + escHtml(t('game.mafya.donatePlaceholder')) + '" style="width:100%;margin-bottom:8px;">'
      + '<button class="btn-is" onclick="mafyaEviHibe()">' + escHtml(t('game.mafya.donateBtn')) + '</button>';
    if (data.benLiderim) {
      html += '<button class="btn-is kirmizi-btn" style="margin-left:8px;" onclick="mafyaEviSeviye()">' + escHtml(t('game.mafya.levelUpBtn')) + '</button>';
    }`);
R(`    box.innerHTML = '<h2>🏠 MAFYA EVİ</h2><p style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p>';`, `    box.innerHTML = '<h2>' + escHtml(t('game.mafya.houseTitle')) + '</h2><p style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p>';`);

// mafyaSavaslarCiz
R(`    var html = '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="Mafya Savaşları"></div>'
      + '<h3 class="bolum-baslik">Mafya Savaşları</h3>';
    if (mafyaData && mafyaData.uyelik && mafyaData.uyelik.benLiderim) {
      html += '<div class="is-kart" style="padding:14px;max-width:520px;margin:0 auto 14px;">'
        + '<p style="color:#888;margin-bottom:8px;">Rakip mafya grubu adını yaz ve savaş ilan et.</p>'
        + '<input type="text" id="mafyaSavasHedef" class="dusman-input" placeholder="Rakip Mafya Grubu Adı" style="width:100%;margin-bottom:8px;">'
        + '<button class="btn-is kirmizi-btn" onclick="mafyaSavasIlan()">[ ⚔️ MAFYA SAVAŞI İLAN ET ]</button>'
        + '</div>';
    }
    data.savaslar.forEach(function(s) {
      var durum = s.durum === 'bekliyor' ? '⏳ Bekliyor' : s.durum === 'aktif' ? '⚔️ Aktif' : '✅ Tamamlandı';
      var kalanSaat = Math.max(0, Math.ceil((s.savas_zamani - Date.now()) / (1000 * 60 * 60)));
      html += '<div class="is-kart"><p><b>' + durum + '</b></p>'
        + '<p>Saldıran: <b>' + (s.saldiran_grup_adi || s.saldiran_grup_id) + '</b> | Hedef: <b>' + (s.hedef_grup_adi || s.hedef_grup_id) + '</b></p>'
        + '<p>Katılımcılar: Salıran ' + s.saldiran_katilim + ' | Hedef ' + s.hedef_katilim + '</p>';
      if (s.durum === 'bekliyor') {
        html += '<p style="color:#888;">Başlamasına kalan: <b>' + kalanSaat + '</b> saat</p>';
        html += '<button class="btn-is" onclick="mafyaSavasaKatil(' + s.id + ')">[ ⚔️ KATIL ]</button>';
      }`, `    var html = '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="' + escHtml(t('game.mafya.warsBannerAlt')) + '"></div>'
      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.warsTitle')) + '</h3>';
    if (mafyaData && mafyaData.uyelik && mafyaData.uyelik.benLiderim) {
      html += '<div class="is-kart" style="padding:14px;max-width:520px;margin:0 auto 14px;">'
        + '<p style="color:#888;margin-bottom:8px;">' + escHtml(t('game.mafya.warsDesc')) + '</p>'
        + '<input type="text" id="mafyaSavasHedef" class="dusman-input" placeholder="' + escHtml(t('game.mafya.warsTargetPlaceholder')) + '" style="width:100%;margin-bottom:8px;">'
        + '<button class="btn-is kirmizi-btn" onclick="mafyaSavasIlan()">' + escHtml(t('game.mafya.declareWar')) + '</button>'
        + '</div>';
    }
    data.savaslar.forEach(function(s) {
      var durum = s.durum === 'bekliyor' ? t('game.mafya.warWaiting') : s.durum === 'aktif' ? t('game.mafya.warActive') : t('game.mafya.warDone');
      var kalanSaat = Math.max(0, Math.ceil((s.savas_zamani - Date.now()) / (1000 * 60 * 60)));
      html += '<div class="is-kart"><p><b>' + durum + '</b></p>'
        + '<p>' + escHtml(t('game.mafya.warAttacker')) + ' <b>' + escHtml(s.saldiran_grup_adi || s.saldiran_grup_id) + '</b> | ' + escHtml(t('game.mafya.warTarget')) + ' <b>' + escHtml(s.hedef_grup_adi || s.hedef_grup_id) + '</b></p>'
        + '<p>' + escHtml(t('game.mafya.warParticipants')) + ' ' + s.saldiran_katilim + t('game.mafya.warTargetSide') + s.hedef_katilim + '</p>';
      if (s.durum === 'bekliyor') {
        html += '<p style="color:#888;">' + escHtml(t('game.mafya.warStartsIn')) + ' <b>' + kalanSaat + '</b>' + escHtml(t('game.mafya.warHours')) + '</p>';
        html += '<button class="btn-is" onclick="mafyaSavasaKatil(' + s.id + ')">' + escHtml(t('game.mafya.joinWar')) + '</button>';
      }`);
R(`    box.innerHTML = '<p style="color:#c00;">Savaşlar yüklenemedi.</p>';`, `    box.innerHTML = '<p style="color:#c00;">' + escHtml(t('game.mafya.warsLoadFailed')) + '</p>';`);

// mafyaGurupListesiHTML
R(`  var html = '<h3 class="bolum-baslik">Mevcut Mafya Grupları</h3>';`, `  var html = '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.existingGroups')) + '</h3>';`);
R(`    if (g.lider_adi) html += '<p class="mafya-metin-dim" style="margin-top:8px;">Lider: <b style="color:#e8dcc0;">' + escHtml(g.lider_adi) + '</b></p>';`, `    if (g.lider_adi) html += '<p class="mafya-metin-dim" style="margin-top:8px;">' + escHtml(t('game.mafya.leaderLabel')) + ' <b style="color:#e8dcc0;">' + escHtml(g.lider_adi) + '</b></p>';`);
R(`    if (g.uye_sayisi != null) html += '<p class="mafya-metin-dim">' + g.uye_sayisi + ' üye</p>';`, `    if (g.uye_sayisi != null) html += '<p class="mafya-metin-dim">' + g.uye_sayisi + escHtml(t('game.mafya.membersCount')) + '</p>';`);
R(`      html += '<button class="btn-is" onclick="mafyaBasvur(' + g.id + ')">[ BAŞVUR ]</button>';`, `      html += '<button class="btn-is" onclick="mafyaBasvur(' + g.id + ')">' + escHtml(t('game.mafya.applyBtn')) + '</button>';`);

fs.writeFileSync(file, s, "utf8");
console.log("Applied", n, "replacements in batch 4 (part 1)");
