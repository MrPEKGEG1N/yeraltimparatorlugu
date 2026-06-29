const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "public", "script.js");
let s = fs.readFileSync(file, "utf8");
let n = 0;
function sub(re, rep, label) {
  const next = s.replace(re, rep);
  if (next !== s) { n++; if (label) console.log("  ok:", label); s = next; }
  else if (label) console.log("  skip:", label);
}

// Fix broken label syntax from prior patch
s = s.replace(/<\/label>''/g, "</label>'");
s = s.replace(/\+ '' \+ '/g, "+ '");
n++;

// gazete hakimiyet
sub(
  /hakimiyetHtml \+= '<p class="gazete-hakim-satir">👑 <strong>Şehre Hükmeden:<\/strong> '\s+\+ oyuncuLink\(h\.userId, h\.oyuncuAdi\) \+ ' — üç liman ve makamlar onun elinde\.<\/p>';/,
  "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">' + t('game.gazete.rulerFull') + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.rulerFullSuffix')) + '</p>';",
  "gazete hukumdar"
);
sub(
  /hakimiyetHtml \+= '<p class="gazete-hakim-satir">⚓ ' \+ escHtml\(h\.limanAd \|\| 'Liman'\) \+ ': '\s+\+ oyuncuLink\(h\.userId, h\.oyuncuAdi\) \+ ' kontrolünde\.<\/p>';/,
  "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">⚓ ' + escHtml(h.limanAd || t('game.gazete.portLabel')) + ': ' + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.controlledBy')) + '</p>';",
  "gazete liman"
);
sub(
  /hakimiyetHtml \+= '<p class="gazete-hakim-satir">👤 Şu an Liman Bölgesini '\s+\+ oyuncuLink\(h\.userId, h\.oyuncuAdi\) \+ ' kontrol ediyor\. Sokaklar onun kurallarıyla yönetiliyor\.<\/p>';/,
  "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">' + t('game.gazete.portControlled') + oyuncuLink(h.userId, h.oyuncuAdi) + t('game.gazete.portRules') + '</p>';",
  "gazete kontrol"
);
sub(
  /hakimiyetHtml \+= '<p class="gazete-hakim-satir">❌ Bölgede dengeler değişti '\s+\+ oyuncuLink\(h\.kazananUserId, h\.kazananAdi\);/,
  "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">' + t('game.gazete.balanceChanged') + oyuncuLink(h.kazananUserId, h.kazananAdi);",
  "gazete degisim"
);

// ML_MAFYA_BASLIKLARI remove + mafyaMenuSec
sub(
  /var ML_MAFYA_BASLIKLARI = \{[\s\S]*?\};\r?\n\r?\n/,
  "",
  "ML_MAFYA_BASLIKLARI"
);
sub(
  /masterFramePlaqueGuncelle\('mafya', typeof I18n !== 'undefined' && I18n\.mafyaTitle\s+\? I18n\.mafyaTitle\(mod\)\s+: \(ML_MAFYA_BASLIKLARI\[mod\] \|\| 'MAFYA GRUBU'\)\);/,
  "masterFramePlaqueGuncelle('mafya', typeof mafyaTitle === 'function' ? mafyaTitle(mod) : (typeof I18n !== 'undefined' && I18n.mafyaTitle ? I18n.mafyaTitle(mod) : t('screen.mafya')));",
  "mafyaMenuSec plaque"
);

// buyume screens
sub(
  /if \(tip === 'mahalle'\) \{[\s\S]*?return;\s*\}/,
  `if (tip === 'mahalle') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.mahalleTitle')) + '</h2><p>' + escHtml(t('game.buyume.mahalleQuote')) + '</p>'
      + buyumeIsKart('market', 'market', '+800 TL', '1', '300')
      + buyumeIsKart('tamirhane', 'tamirhane', '+1.500 TL', '1', '600')
      + buyumeIsKart('esnafa_guvence', 'koruma', '+2.800 TL', '2', '1.200')
      + buyumeIsKart('zar_salonu', 'kumarhane', '+4.500 TL', '2', '2.500');
    return;
  }`,
  "mahalle"
);
sub(
  /if \(tip === 'semt'\) \{[\s\S]*?return;\s*\}/,
  `if (tip === 'semt') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.semtTitle')) + '</h2><p>' + escHtml(t('game.buyume.semtQuote')) + '</p>'
      + buyumeIsKart('gece_kulubu', 'gece_kulubu', '+12.000 TL', '3', '6.000')
      + buyumeIsKart('kumarhane_agi', 'kumarhane_agi', '+18.000 TL', '3', '8.000')
      + buyumeIsKart('kara_para', 'kara_para', '+25.000 TL', '4', '10.000')
      + buyumeIsKart('semt_galeri', 'galeri', '+32.000 TL', '4', '12.000');
    return;
  }`,
  "semt"
);
sub(
  /if \(tip === 'sehir'\) \{[\s\S]*?return;\s*\}/,
  `if (tip === 'sehir') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.sehirTitle')) + '</h2><p>' + escHtml(t('game.buyume.sehirQuote')) + '</p>'
      + buyumeIsKart('lojistik', 'lojistik', '+45.000 TL', '5', '15.000')
      + buyumeIsKart('gumruk', 'gumruk', '+80.000 TL', '6', '25.000')
      + buyumeIsKart('belediye', 'belediye', '+120.000 TL', '8', '40.000')
      + buyumeIsKart('buyuk_holding', 'holding', '+200.000 TL', '10', '55.000');
    return;
  }`,
  "sehir"
);
sub(
  /if \(tip === 'liman'\) \{[\s\S]*?return;\s*\}/,
  `if (tip === 'liman') {
    ic.innerHTML = '<h2>' + escHtml(t('game.sehre.portsTitle')) + '</h2>'
      + '<p>' + escHtml(t('game.liman.quote')) + '</p>'
      + HUKUM_SAVUNMA_NOTU
      + '<p class="liman-gelir-notu">' + t('game.liman.incomeNote') + '</p>'
      + limanKartHTML('istanbul') + limanKartHTML('izmir') + limanKartHTML('hatay');
    return;
  }`,
  "liman"
);

// sehir tarihi header
sub(
  /var html = '<h2>📜 ŞEHİR TARİHİ<\/h2>'\s+\+ '<h3 style="margin:16px 0 10px;color:#b8942a;">ŞEHRE HÜKMEDENLERİN İSİMLERİ:<\/h3>';/,
  "var html = '<h2>📜 ' + escHtml(t('screen.sehirTarihi').toUpperCase()) + '</h2>'\n      + '<h3 style=\"margin:16px 0 10px;color:#b8942a;\">' + escHtml(t('game.history.rulersHeading')) + '</h3>';",
  "sehir tarihi"
);

// profil skills tab
s = s.replace("onclick=\"profilSekmeDegistir('yetenekler')\">Yetenekler</button>", "onclick=\"profilSekmeDegistir('yetenekler')\">' + escHtml(t('game.profil.skillsTab')) + '</button>");

// liderlik
s = s.replace('<div class="lt-head-title">Sözü Geçenler — Liderlik Tablosu</div>', "'<div class=\"lt-head-title\">' + escHtml(t('game.leaderboard.headTitle')) + '</div>'");
s = s.replace('<span class="lt-lbl">Puan</span>', "'<span class=\"lt-lbl\">' + escHtml(t('game.leaderboard.points')) + '</span>'");

// chat / mesaj
s = s.replace(/<h3>MESAJ GÖNDER<\/h3>/g, "<h3>' + escHtml(t('game.chat.sendMessageTitle')) + '</h3>");
s = s.replace(/<label for="mesajHedef">Alıcı reis adı<\/label>/g, "<label for=\"mesajHedef\">' + escHtml(t('game.chat.recipient')) + '</label>");
s = s.replace(/<label for="mesajMetin">Mesajın<\/label>/g, "<label for=\"mesajMetin\">' + escHtml(t('game.profil.yourMessage')) + '</label>");
s = s.replace(/<h3>GELEN MESAJLAR<\/h3>/g, "<h3>' + escHtml(t('game.chat.incomingTitle')) + '</h3>");
s = s.replace(/<h3>SALONA YAZ<\/h3>/g, "<h3>' + escHtml(t('game.chat.writeToLounge')) + '</h3>");
s = s.replace(/<label for="mafyaSohbetMetin">Mesajın<\/label>/g, "<label for=\"mafyaSohbetMetin\">' + escHtml(t('game.profil.yourMessage')) + '</label>");
s = s.replace('<span>📱 Kalan SMS:</span>', "'<span>' + escHtml(t('game.chat.smsRemaining')) + '</span>'");
s = s.replace(/'MESAJ KUTUSU'/g, "escHtml(t('game.chat.inboxTitle'))");
s = s.replace(/'"Gizli yazışmalar, alarmlar ve grup mesajları burada\."/g, "escHtml(t('game.chat.inboxQuote'))");
s = s.replace(/'MAFYA SOHBETLERİ'/g, "escHtml(t('game.chat.mafiaChatTitle'))");
s = s.replace(/'"Sokakların genel salonu — herkes duyar\."/g, "escHtml(t('game.chat.mafiaChatQuote'))");
s = s.replace(/e\.message \|\| 'Bağlantı hatası'/g, "e.message || t('game.error.connectionFailed')");
s = s.replace('Proje klasöründe <b>npm start</b> çalışıyor olmalı; adres <b>http://localhost:3000</b> olmalı.', "t('game.chat.serverHint')");
s = s.replace('<b>npm start</b> ile sunucuyu başlat; oyunu <b>http://localhost:3000</b> üzerinden aç.', "t('game.chat.serverHintShort')");
s = s.replace(/var metin = prompt\(ad \+ ' adlı oyuncuya cevabın:'\);/, "var metin = prompt(t('game.chat.replyPrompt', { name: ad }));");

// profil load errors
s = s.replace("'Profil alınamadı.'", "t('game.error.profileLoadFailed')");
s = s.replace("'Profil yüklenemedi.'", "t('game.error.loadFailed')");

// istihbarat
s = s.replace("'<div class=\"saldiri-sonuc saldiri-sonuc--bekliyor\">İstihbarat gönderiliyor...</div>'", "'<div class=\"saldiri-sonuc saldiri-sonuc--bekliyor\">' + escHtml(t('game.profil.intelSending')) + '</div>'");
s = s.replace(/⚔️ Güç: /g, "⚔️ ' + escHtml(t('game.profil.power')) + ': ");

// sektor
s = s.replace('<p>"Her alımda fiyat %5 artar; saatlik getiri sabit kalır."</p>', "'<p>' + escHtml(t('game.sektor.quote')) + '</p>'");
s = s.replace('Mekan listesi alınamadı. <b>npm start</b> ile sunucuyu çalıştırıp yeniden giriş yap.', "t('game.sektor.listFailed')");
s = s.replace("+ '<p>💵 Alış: '", "+ '<p>' + escHtml(t('game.sektor.buyPrice')) + ' ");
s = s.replace(" &nbsp;|&nbsp; Sahip: <b>'", " &nbsp;|&nbsp; ' + escHtml(t('game.sektor.owner')) + ' <b>'");
s = s.replace(" adet</p>'", " ' + escHtml(t('game.sektor.unitWord')) + '</p>'");
s = s.replace("+ '<p>⏱️ Saatlik Getiri: '", "+ '<p>' + escHtml(t('game.sektor.hourlyReturn')) + ' ");
s = s.replace(" (adet başı)</p>'", " ' + escHtml(t('game.sektor.perUnit')) + '</p>'");
s = s.replace("+ '<p>🕶️ Saygınlık: '", "+ '<p>' + escHtml(t('game.sektor.respectLabel')) + ' ");
s = s.replace(" (sabit)</p>'", " ' + escHtml(t('game.sektor.respectFixed')) + '</p>'");
s = s.replace('placeholder="Adet"', "'placeholder=\"' + escHtml(t('game.sektor.qtyPlaceholder')) + '\"'");
s = s.replace("[ 🏢 MEKAN AL ]", "' + escHtml(t('game.sektor.buyBtn')) + '");
s = s.replace("+ '<div class=\"is-detay\"><h3>' + m.ad + '</h3><p style=\"color:#888;\">' + m.aciklama + '</p>'", "+ '<div class=\"is-detay\"><h3>' + escHtml(tr(m.ad)) + '</h3><p style=\"color:#888;\">' + escHtml(tr(m.aciklama)) + '</p>'");

// mafya - simple string replaces
const mafyaPairs = [
  ["'<h3 class=\"bolum-baslik\">Mafya Grubu Oluştur</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.createTitle')) + '</h3>'"],
  ["'<p class=\"mafya-metin-dim\">Grubunu kur, üyelerini topla, şehirde söz sahibi ol.</p>'", "'<p class=\"mafya-metin-dim\">' + escHtml(t('game.mafya.createDesc')) + '</p>'"],
  ["'<h3 class=\"bolum-baslik\">Mafya Grubuna Katıl</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.joinTitle')) + '</h3>'"],
  ["'<p class=\"mafya-metin-dim\">Mevcut bir gruba başvur veya listeden seç.</p>'", "'<p class=\"mafya-metin-dim\">' + escHtml(t('game.mafya.joinDesc')) + '</p>'"],
  ["'<label>Açıklama:</label>'", "'<label>' + escHtml(t('game.mafya.descLabel')) + '</label>'"],
  ["'<h2>💼 MAFYA İŞLERİ</h2>'", "'<h2>' + escHtml(t('game.mafya.jobsTitle')) + '</h2>'"],
  ["'<p class=\"mafya-metin\">Mafya grubuna üye olmadan bu işleri yapamazsın.</p>'", "'<p class=\"mafya-metin\">' + escHtml(t('game.mafya.jobsNeedMember')) + '</p>'"],
  ["'\"Online üyelerle birlikte soyguna hazırlan, şartlar tutunca soygunu gerçekleştir.\"'", "escHtml(t('game.mafya.jobsQuote'))"],
  ["'<p><b>Grup Online:</b> '", "'<p><b>' + escHtml(t('game.mafya.groupOnline')) + '</b> '"],
  ["'<p><b>Aktif Hazırlık:</b> '", "'<p><b>' + escHtml(t('game.mafya.activePrep')) + '</b> '"],
  ["'<p class=\"mafya-metin-dim\">Aktif hazırlık yok.</p>'", "'<p class=\"mafya-metin-dim\">' + escHtml(t('game.mafya.noActivePrep')) + '</p>'"],
  ["'<p>👥 Şart: <b>'", "'<p>' + escHtml(t('game.mafya.reqOnline')) + ' <b>'"],
  [" online üye &nbsp;|&nbsp; 🗡️ Her üye min <b>'", "' + escHtml(t('game.mafya.onlineMembers')) + ' &nbsp;|&nbsp; ' + escHtml(t('game.mafya.eachMinPower')) + ' <b>'"],
  [" güç</p>'", "' + escHtml(t('game.mafya.powerWord')) + '</p>'"],
  ["'💵 Kazanç (kişi): '", "escHtml(t('game.mafya.earnPerPerson')) + ' '"],
  ["' &nbsp;|&nbsp; 🕶️ Saygınlık: '", "' &nbsp;|&nbsp; ' + escHtml(t('game.mafya.respectGain')) + ' '"],
  ["'[ 🤝 SOYGUNA KATIL ]'", "escHtml(t('game.mafya.joinHeist'))"],
  ["'[ 💥 SOYGUNU GERÇEKLEŞTİR ]'", "escHtml(t('game.mafya.executeHeist'))"],
  ["'<b>Katılanlar:</b> '", "'<b>' + escHtml(t('game.mafya.participants')) + '</b> '"],
  ["'<h2>🏠 MAFYA EVİ</h2>'", "'<h2>' + escHtml(t('game.mafya.houseTitle')) + '</h2>'"],
  ["'\"Seviye yükseldikçe üye kapasitesi artar (her seviye +3).\"'", "escHtml(t('game.mafya.houseQuote'))"],
  ["'👥 Kapasite: <b>'", "escHtml(t('game.mafya.capacity')) + ' <b>'"],
  [" üye</p>'", "' + escHtml(t('game.mafya.membersWord')) + '</p>'"],
  ["placeholder=\"Hibe miktarı\"", "placeholder=\"' + escHtml(t('game.mafya.donatePlaceholder')) + '\""],
  ["'[ 💸 HİBE ET ]'", "escHtml(t('game.mafya.donateBtn'))"],
  ["'[ ⬆️ SEVİYE YÜKSELT ]'", "escHtml(t('game.mafya.levelUpBtn'))"],
  ["alt=\"Mafya Savaşları\"", "alt=\"' + escHtml(t('game.mafya.warsBannerAlt')) + '\""],
  ["'<h3 class=\"bolum-baslik\">Mafya Savaşları</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.warsTitle')) + '</h3>'"],
  ["'Rakip mafya grubu adını yaz ve savaş ilan et.'", "escHtml(t('game.mafya.warsDesc'))"],
  ["placeholder=\"Rakip Mafya Grubu Adı\"", "placeholder=\"' + escHtml(t('game.mafya.warsTargetPlaceholder')) + '\""],
  ["'[ ⚔️ MAFYA SAVAŞI İLAN ET ]'", "escHtml(t('game.mafya.declareWar'))"],
  ["'? '⏳ Bekliyor' : s.durum === 'aktif' ? '⚔️ Aktif' : '✅ Tamamlandı'", "? t('game.mafya.warWaiting') : s.durum === 'aktif' ? t('game.mafya.warActive') : t('game.mafya.warDone')"],
  ["'Saldıran: <b>'", "escHtml(t('game.mafya.warAttacker')) + ' <b>'"],
  ["' | Hedef: <b>'", "' | ' + escHtml(t('game.mafya.warTarget')) + ' <b>'"],
  ["'Katılımcılar: Salıran '", "escHtml(t('game.mafya.warParticipants')) + ' '"],
  ["' | Hedef '", "t('game.mafya.warTargetSide')"],
  ["'Başlamasına kalan: <b>'", "escHtml(t('game.mafya.warStartsIn')) + ' <b>'"],
  [" saat</p>'", "' + escHtml(t('game.mafya.warHours')) + '</p>'"],
  ["'[ ⚔️ KATIL ]'", "escHtml(t('game.mafya.joinWar'))"],
  ["'Savaşlar yüklenemedi.'", "t('game.mafya.warsLoadFailed')"],
  ["'<h3 class=\"bolum-baslik\">Mevcut Mafya Grupları</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.existingGroups')) + '</h3>'"],
  ["'Lider: <b style=\"color:#e8dcc0;\">'", "escHtml(t('game.mafya.leaderLabel')) + ' <b style=\"color:#e8dcc0;\">'"],
  ["' üye</p>'", "' + escHtml(t('game.mafya.membersCount')) + '</p>'"],
  ["'[ BAŞVUR ]'", "escHtml(t('game.mafya.applyBtn'))"],
  ["'<h4 class=\"mafya-grup-aciklama-baslik\">📜 Grup Açıklaması</h4>'", "'<h4 class=\"mafya-grup-aciklama-baslik\">' + escHtml(t('game.mafya.groupDescTitle')) + '</h4>'"],
  ["'[ ✎ AD DEĞİŞTİR ]'", "escHtml(t('game.mafya.renameBtn'))"],
  ["'[ ✎ AÇIKLAMA DEĞİŞTİR ]'", "escHtml(t('game.mafya.editDescBtn'))"],
  ["'<h3 class=\"bolum-baslik\">👥 Üyeler</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.membersTitle')) + '</h3>'"],
  ["'<span>İSİM</span><span>RÜTBE</span><span>SAYGINLIK</span>'", "'<span>' + escHtml(t('game.mafya.colName')) + '</span><span>' + escHtml(t('game.mafya.colRank')) + '</span><span>' + escHtml(t('game.mafya.colRespect')) + '</span>'"],
  ["'✎ Rütbe</button>'", "escHtml(t('game.mafya.editRank')) + '</button>'"],
  ["'👑 Devret</button>'", "escHtml(t('game.mafya.transferCrown')) + '</button>'"],
  ["'>Çıkar</button>'", ">' + escHtml(t('game.mafya.kick')) + '</button>'"],
  ["'<h3 class=\"bolum-baslik\">📩 Başvurular</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.applications')) + '</h3>'"],
  ["'>Kabul</button>'", ">' + escHtml(t('game.mafya.accept')) + '</button>'"],
  ["'>Red</button>'", ">' + escHtml(t('game.mafya.reject')) + '</button>'"],
  ["'[ 💥 MAFYA GURUBUNU DAĞIT ]'", "escHtml(t('game.mafya.disbandBtn'))"],
  ["'[ 🚪 GRUPTAN ÇIK — 1.000.000 TL ]'", "escHtml(t('game.mafya.leaveBtn'))"],
  ["'[ 📨 MAFYA GURUBUNA MESAJ GÖNDER ]'", "escHtml(t('game.mafya.groupMsgBtn'))"],
  ["e.message || 'Bağlantı hatası'", "e.message || t('game.error.connectionFailed')"],
  ["msg = 'Mafya API bulunamadı (HTTP 404). Oyunu Live Server ile değil; npm start ile http://localhost:3000 üzerinden aç.'", "msg = t('game.mafya.api404')"],
  ["'Terminal: <b>npm start</b> → tarayıcı: <b>http://localhost:3000</b> → <b>Ctrl+F5</b>'", "t('game.mafya.serverHelp')"],
  ["'<h3 class=\"bolum-baslik\">🏠 Mafya Evi</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.houseLevel')) + '</h3>'"],
  ["'Seviye yükseldikçe üye kapasitesi artar (her seviye +3) ve tüm üyelere bonus güç verilir.'", "escHtml(t('game.mafya.houseBonusNote'))"],
  ["' — Seviye '", "' — ' + escHtml(t('game.mafya.levelWord'))"],
  ["'⚔️ Üye bonus gücü: <b>+'", "' + escHtml(t('game.mafya.memberBonus')) + ' <b>+'"],
  ["' (tüm üyelere)</p>'", "' + escHtml(t('game.mafya.allMembers')) + '</p>'"],
  ["'Sonraki seviyede: <b>+'", "escHtml(t('game.mafya.nextBonus')) + ' <b>+'"],
  [" artış)</p>'", "' + escHtml(t('game.mafya.bonusIncrease')) + ')</p>'"],
  ["'💰 Birikim: <b>'", "escHtml(t('game.mafya.accumulation')) + ' <b>'"],
  ["'⬆️ Sonraki seviye: <b>'", "escHtml(t('game.mafya.nextLevelShort')) + ' <b>'"],
  ["'(Kalan: '", "escHtml(t('game.mafya.remaining')) + ' '"],
  ["'<h4 class=\"bolum-baslik\">Hibe</h4>'", "'<h4 class=\"bolum-baslik\">' + escHtml(t('game.mafya.donation')) + '</h4>'"],
  ["'[ 📋 HİBE MİKTARI GÖRÜNTÜLE ]'", "escHtml(t('game.mafya.viewDonations'))"],
  ["alt=\"Mafya Savaşı İlanı\"", "alt=\"' + escHtml(t('game.mafya.warDeclareBannerAlt')) + '\""],
  ["'<h3 class=\"bolum-baslik\">⚔️ Mafya Savaşı İlanı</h3>'", "'<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.warDeclareTitle')) + '</h3>'"],
  ["'Katılımcılar: Saldıran <b>'", "escHtml(t('game.mafya.warParticipants')) + ' <b>'"],
  ["'<span>HİBE EDEN</span><span>TARİH</span><span>MİKTAR</span>'", "'<span>' + escHtml(t('game.mafya.donorCol')) + '</span><span>' + escHtml(t('game.mafya.dateCol')) + '</span><span>' + escHtml(t('game.mafya.amountCol')) + '</span>'"],
  ["'Sonuç yok.'", "t('game.mafya.noResults')"],
  ["'[ ← GERİ ]'", "escHtml(t('game.mafya.backBtn'))"],
  ["'<p class=\"mafya-stat\"><b>⚔️ Üye bonus gücü:</b> +'", "'<p class=\"mafya-stat\"><b>' + escHtml(t('game.mafya.memberBonus')) + '</b> +'"],
  ["'<p class=\"mafya-stat\"><b>👥 Üye Sayısı:</b> '", "'<p class=\"mafya-stat\"><b>' + escHtml(t('game.mafya.memberCount')) + '</b> '"],
  ["'<p class=\"mafya-stat\"><b>🕶️ Toplam Saygınlık:</b> '", "'<p class=\"mafya-stat\"><b>' + escHtml(t('game.mafya.totalRespect')) + '</b> '"],
];
mafyaPairs.forEach(function(p) { if (s.includes(p[0])) { s = s.split(p[0]).join(p[1]); n++; } });

// isDef.ad -> tr
s = s.replace(/\+ '<div class="is-detay"><h3>' \+ isDef\.ad \+ '<\/h3>'/g, "+ '<div class=\"is-detay\"><h3>' + escHtml(tr(isDef.ad)) + '</h3>'");
s = s.replace(/\+ '<p><b>' \+ escHtml\(t\('game\.mafya\.activePrep'\)\) \+ '<\/b> ' \+ aktif\.isTuru \+ '<\/p>'/g, "+ '<p><b>' + escHtml(t('game.mafya.activePrep')) + '</b> ' + escHtml(tr(aktif.isTuru)) + '</p>'");

fs.writeFileSync(file, s, "utf8");
console.log("Final patch applied", n, "changes");
