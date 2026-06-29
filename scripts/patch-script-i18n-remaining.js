const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "public", "script.js");
let s = fs.readFileSync(file, "utf8");

const pairs = [
  // profil toolbar / alignment
  ["placeholder: 'Açıklama ekle...'", "placeholder: t('game.profil.descPlaceholder')"],
  ["placeholder: 'Grup açıklaması...'", "placeholder: t('game.profil.mafiaDescPlaceholder')"],
  ["class=\"profil-onizleme-baslik gizli\">Önizleme</label>", "class=\"profil-onizleme-baslik gizli\">' + escHtml(t('game.profil.preview')) + '</label>"],
  ["onclick=\"mafyaGrupAciklamaKaydet()\">[ ✓ KAYDET ]", "onclick=\"mafyaGrupAciklamaKaydet()\">' + escHtml(t('game.profil.save'))"],
  ["onclick=\"mafyaGrupAciklamaIptal()\">[ ✕ İPTAL ]", "onclick=\"mafyaGrupAciklamaIptal()\">' + escHtml(t('game.profil.cancel'))"],
  ["'<p class=\"profil-alan-not\">[f] renk kodlu ASCII sanat için kod alanını kullanın; önizleme altta görünür.</p>'", "'<p class=\"profil-alan-not\">' + escHtml(t('game.profil.asciiNote')) + '</p>'"],

  // PROFIL_YETENEK_ETIKET
  ["var PROFIL_YETENEK_ETIKET = {\n  guc: 'Güç',\n  zeka: 'Zeka',\n  dayaniklilik: 'Dayanıklılık',\n  beceri: 'Beceri'\n};", "function profilYetenekEtiket(key) {\n  var k = 'game.profil.skill.' + key;\n  var v = t(k);\n  return v !== k ? v : key;\n}"],

  ["' + escHtml(PROFIL_YETENEK_ETIKET[key] || key) + '", "' + escHtml(profilYetenekEtiket(key)) + '"],
  ["'Sonraki kademe: '", "t('game.profil.nextTier') + ' '"],
  ["'+ '<p class=\"profil-alan-not\">Yetenekler sınırsız gelişir", "'+ '<p class=\"profil-alan-not\">' + escHtml(t('game.profil.skillsNote'))"],
  ["'<h4>💼 Aktif Meslek</h4>'", "'<h4>' + escHtml(t('game.profil.activeJob')) + '</h4>'"],
  ["'Günlük maaş: '", "escHtml(t('game.profil.dailySalary')) + ' '"],
  ["'<h4 style=\"color:#aaa;\">Meslek yok</h4>'", "'<h4 style=\"color:#aaa;\">' + escHtml(t('game.profil.noJob')) + '</h4>'"],
  ["'Menüden <b>Meslekler</b> bölümüne giderek iş başvurusu yapabilirsin.'", "t('game.profil.noJobHint')"],
  ["'<button type=\"button\" class=\"profil-sekme aktif\" data-sekme=\"karakter\" onclick=\"profilSekmeDegistir(\\'karakter\\')\">Karakter</button>'", "'<button type=\"button\" class=\"profil-sekme aktif\" data-sekme=\"karakter\" onclick=\"profilSekmeDegistir(\\'karakter\\')\">' + escHtml(t('game.profil.characterTab')) + '</button>'"],
  ["'data-sekme=\"yetenekler\" onclick=\"profilSekmeDegistir(\\'yetenekler\\')\">Yetenekler</button>'", "'data-sekme=\"yetenekler\" onclick=\"profilSekmeDegistir(\\'yetenekler\\')\">' + escHtml(t('game.profil.skillsTab')) + '</button>'"],
  ["'<span class=\"profil-sekme aktif\">Karakter</span>'", "'<span class=\"profil-sekme aktif\">' + escHtml(t('game.profil.characterTab')) + '</span>'"],

  // profil modal
  ["'<h3>Profil Resmi Seç</h3>'", "'<h3>' + escHtml(t('game.profil.selectPhoto')) + '</h3>'"],
  ["'<p id=\"profilResimModalAciklama\">Portreni seç:</p>'", "'<p id=\"profilResimModalAciklama\">' + escHtml(t('game.profil.selectPortrait')) + '</p>'"],
  ["onclick=\"profilResimSekmeDegistir(\\'kadin\\')\">Kadın</button>'", "onclick=\"profilResimSekmeDegistir(\\'kadin\\')\">' + escHtml(t('game.profil.female')) + '</button>'"],
  ["onclick=\"profilResimSekmeDegistir(\\'erkek\\')\">Erkek</button>'", "onclick=\"profilResimSekmeDegistir(\\'erkek\\')\">' + escHtml(t('game.profil.male')) + '</button>'"],
  ["onclick=\"profilResmiModalKapat()\">Kapat</button>'", "onclick=\"profilResmiModalKapat()\">' + escHtml(t('game.welcome.close')) + '</button>'"],

  // buyume screens
  ["ic.innerHTML = '<h2>🏡 MAHALLE İŞLERİ</h2><p>\"Küçük işlerle sermaye yap.\"</p>'\n      + isKartHTML(isGorselleri.market, '🛒 Köşedeki Marketi Haraca Bağla', '+800 TL', '1 İcraat', '300 Güç', \"isYap('market')\")\n      + isKartHTML(isGorselleri.tamirhane, '🔧 Kaçak Otomobil Tamirhanesi', '+1.500 TL', '1 İcraat', '600 Güç', \"isYap('tamirhane')\")\n      + isKartHTML(isGorselleri.koruma, '🛡️ Esnafa Güvence Sağla', '+2.800 TL', '2 İcraat', '1.200 Güç', \"isYap('esnafa_guvence')\")\n      + isKartHTML(isGorselleri.kumarhane, '🎲 Gizli Yeraltı Zar Salonu Aç', '+4.500 TL', '2 İcraat', '2.500 Güç', \"isYap('zar_salonu')\");", "ic.innerHTML = '<h2>' + escHtml(t('game.buyume.mahalleTitle')) + '</h2><p>' + escHtml(t('game.buyume.mahalleQuote')) + '</p>'\n      + buyumeIsKart('market', 'market', '+800 TL', '1', '300')\n      + buyumeIsKart('tamirhane', 'tamirhane', '+1.500 TL', '1', '600')\n      + buyumeIsKart('esnafa_guvence', 'koruma', '+2.800 TL', '2', '1.200')\n      + buyumeIsKart('zar_salonu', 'kumarhane', '+4.500 TL', '2', '2.500');"],
  ["ic.innerHTML = '<h2>🏢 SEMT İŞLERİ</h2><p>\"Semtte söz sahibi ol.\"</p>'\n      + isKartHTML(isGorselleri.gece_kulubu, '🏢 Lüks Gece Kulübü Güvenliği', '+12.000 TL', '3 İcraat', '6.000 Güç', \"isYap('gece_kulubu')\")\n      + isKartHTML(isGorselleri.kumarhane_agi, '🎰 Semtin Kumarhane Ağını Ele Geçir', '+18.000 TL', '3 İcraat', '8.000 Güç', \"isYap('kumarhane_agi')\")\n      + isKartHTML(isGorselleri.kara_para, '💰 Kara Para Aklamanın Yolunu Aç', '+25.000 TL', '4 İcraat', '10.000 Güç', \"isYap('kara_para')\")\n      + isKartHTML(isGorselleri.galeri, '🖼️ Semt Galerisine Çök', '+32.000 TL', '4 İcraat', '12.000 Güç', \"isYap('semt_galeri')\");", "ic.innerHTML = '<h2>' + escHtml(t('game.buyume.semtTitle')) + '</h2><p>' + escHtml(t('game.buyume.semtQuote')) + '</p>'\n      + buyumeIsKart('gece_kulubu', 'gece_kulubu', '+12.000 TL', '3', '6.000')\n      + buyumeIsKart('kumarhane_agi', 'kumarhane_agi', '+18.000 TL', '3', '8.000')\n      + buyumeIsKart('kara_para', 'kara_para', '+25.000 TL', '4', '10.000')\n      + buyumeIsKart('semt_galeri', 'galeri', '+32.000 TL', '4', '12.000');"],
  ["ic.innerHTML = '<h2>🌆 ŞEHİR İŞLERİ</h2><p>\"Şehrin zirvesindekiler ihaleleri yönetir.\"</p>'\n      + isKartHTML(isGorselleri.lojistik, '🏗️ Büyük Lojistik İhalesini Al', '+45.000 TL', '5 İcraat', '15.000 Güç', \"isYap('lojistik')\")\n      + isKartHTML(isGorselleri.gumruk, '🚢 Gümrük Müdürünü Satın Al', '+80.000 TL', '6 İcraat', '25.000 Güç', \"isYap('gumruk')\")\n      + isKartHTML(isGorselleri.belediye, '🏛️ Belediye İhalesine El At', '+120.000 TL', '8 İcraat', '40.000 Güç', \"isYap('belediye')\")\n      + isKartHTML(isGorselleri.holding, '🏢 Büyük Holdinge Güvence Sağla', '+200.000 TL', '10 İcraat', '55.000 Güç', \"isYap('buyuk_holding')\");", "ic.innerHTML = '<h2>' + escHtml(t('game.buyume.sehirTitle')) + '</h2><p>' + escHtml(t('game.buyume.sehirQuote')) + '</p>'\n      + buyumeIsKart('lojistik', 'lojistik', '+45.000 TL', '5', '15.000')\n      + buyumeIsKart('gumruk', 'gumruk', '+80.000 TL', '6', '25.000')\n      + buyumeIsKart('belediye', 'belediye', '+120.000 TL', '8', '40.000')\n      + buyumeIsKart('buyuk_holding', 'holding', '+200.000 TL', '10', '55.000');"],
  ["ic.innerHTML = '<h2>🚢 LİMAN İŞLETMELERİ</h2>'\n      + '<p>\"Boğazdan Akdeniz\\'e — güçlü olan limanı alır. Saatlik gelir sahibine otomatik işler.\"</p>'\n      + HUKUM_SAVUNMA_NOTU\n      + '<p class=\"liman-gelir-notu\">⏱️ Türkiye saatiyle her saat başı liman başına <b>100.000 TL</b> kazanırsın. '\n      + '<b>Üç limanı birden elinde tutarsan saatlik toplam 500.000 TL kazanırsın!</b></p>'", "ic.innerHTML = '<h2>' + escHtml(t('game.sehre.portsTitle')) + '</h2>'\n      + '<p>' + escHtml(t('game.liman.quote')) + '</p>'\n      + HUKUM_SAVUNMA_NOTU\n      + '<p class=\"liman-gelir-notu\">' + t('game.liman.incomeNote') + '</p>'"],

  // ML_MAFYA - use mafyaTitle
  ["masterFramePlaqueGuncelle('mafya', typeof I18n !== 'undefined' && I18n.mafyaTitle\n    ? I18n.mafyaTitle(mod)\n    : (ML_MAFYA_BASLIKLARI[mod] || 'MAFYA GRUBU'));", "masterFramePlaqueGuncelle('mafya', typeof mafyaTitle === 'function' ? mafyaTitle(mod) : (typeof I18n !== 'undefined' && I18n.mafyaTitle ? I18n.mafyaTitle(mod) : t('screen.mafya')));"],

  // kara liste
  ["'<h2>KARA LİSTE</h2>'", "'<h2>' + escHtml(t('game.blacklist.title')) + '</h2>'"],
  ["'<p class=\"kl-motto\">\"Şehre hükmeden reis burada görünür.\"</p>'", "'<p class=\"kl-motto\">' + escHtml(t('game.blacklist.motto')) + '</p>'"],
  ["'<p class=\"kl-hukumdar-metin\">Şehir şu an <span class=\"kl-hukumdar-isim\" id=\"klHukumdarIsim\">…</span> tarafından yönetiliyor!</p>'", "t('game.blacklist.rulerLine')"],
  ["'<p class=\"kl-aciklama\">Şehre Hükmet sahibinden Liman, Söz veya Sadakat alındığında kazanan, rakibin saygınlığının %5\\'ini ödül olarak alır.</p>'", "'<p class=\"kl-aciklama\">' + escHtml(t('game.blacklist.note')) + '</p>'"],
  ["'<div class=\"kl-tablo-baslik\"><span>OYUNCU</span><span>MAFYA GRUBU</span><span>SAYGINLIK</span></div>'", "'<div class=\"kl-tablo-baslik\"><span>' + escHtml(t('game.blacklist.colPlayer')) + '</span><span>' + escHtml(t('game.blacklist.colGroup')) + '</span><span>' + escHtml(t('game.blacklist.colRespect')) + '</span></div>'"],
  ["return '<p class=\"kl-bos\">Şu an kara listede kimse yok.</p>';", "return '<p class=\"kl-bos\">' + escHtml(t('game.blacklist.empty')) + '</p>';"],

  // liderlik
  ["'<div class=\"lt-tab-floating\">Liderlik Tablosu</div>'", "'<div class=\"lt-tab-floating\">' + escHtml(t('game.leaderboard.tabTitle')) + '</div>'"],
  ["ltTab('oyuncu', 'Kişiler', oyuncuAktif)", "ltTab('oyuncu', t('game.leaderboard.tabPeople'), oyuncuAktif)"],
  ["ltTab('grup', 'Gruplar', !oyuncuAktif)", "ltTab('grup', t('game.leaderboard.tabGroups'), !oyuncuAktif)"],
  ["'<div class=\"lt-head-title\">Sözü Geçenler — Liderlik Tablosu</div>'", "'<div class=\"lt-head-title\">' + escHtml(t('game.leaderboard.headTitle')) + '</div>'"],
  ["'<div class=\"lt-head-quote\">\"Sokaklar unutur, saygınlık unutmaz.\"</div>'", "'<div class=\"lt-head-quote\">' + escHtml(t('game.leaderboard.quote')) + '</div>'"],
  ["'<div class=\"lt-colbar\"><span>Sıralama No</span><span>İsim</span><span>Grup</span><span>Saygınlık</span></div>'", "'<div class=\"lt-colbar\"><span>' + escHtml(t('game.leaderboard.colRank')) + '</span><span>' + escHtml(t('game.leaderboard.colName')) + '</span><span>' + escHtml(t('game.leaderboard.colGroup')) + '</span><span>' + escHtml(t('game.leaderboard.colRespect')) + '</span></div>'"],
  ["'<span class=\"lt-lbl\">Puan</span>'", "'<span class=\"lt-lbl\">' + escHtml(t('game.leaderboard.points')) + '</span>'"],
  ["'<div class=\"lt-colbar lt-colbar--grup\"><span>Sıralama No</span><span>Grup</span><span>Toplam Saygınlık</span><span>Bilgi</span></div>'", "'<div class=\"lt-colbar lt-colbar--grup\"><span>' + escHtml(t('game.leaderboard.colRank')) + '</span><span>' + escHtml(t('game.leaderboard.colGroup')) + '</span><span>' + escHtml(t('game.leaderboard.colTotalRespect')) + '</span><span>' + escHtml(t('game.leaderboard.colInfo')) + '</span></div>'"],
  ["var statTxt = 'Ev ' + (r.evSeviye || 1) + ' · ' + (r.uyeSayisi || 0) + ' üye · ' + (r.kazanilanSavas || 0) + ' savaş';", "var statTxt = t('game.leaderboard.groupStat', { level: r.evSeviye || 1, members: r.uyeSayisi || 0, wars: r.kazanilanSavas || 0 });"],
  ["'<div class=\"lt-foot\">Sıralama her saldırı ve mekan sonucunda anlık güncellenir.</div>'", "'<div class=\"lt-foot\">' + escHtml(t('game.leaderboard.footer')) + '</div>'"],

  // chat labels
  ["return '<span class=\"sb-mesaj-etiket sb-mesaj-etiket--alarm\">ALARM</span>';", "return '<span class=\"sb-mesaj-etiket sb-mesaj-etiket--alarm\">' + escHtml(t('game.chat.labelAlarm')) + '</span>';"],
  ["return '<span class=\"sb-mesaj-etiket\">GRUP</span>';", "return '<span class=\"sb-mesaj-etiket\">' + escHtml(t('game.chat.labelGroup')) + '</span>';"],
  ["return '<span class=\"sb-mesaj-etiket\">ÖZEL</span>';", "return '<span class=\"sb-mesaj-etiket\">' + escHtml(t('game.chat.labelPrivate')) + '</span>';"],
];

let changed = 0;
for (const [from, to] of pairs) {
  if (s.includes(from)) {
    s = s.split(from).join(to);
    changed++;
  }
}

fs.writeFileSync(file, s, "utf8");
console.log("Applied", changed, "of", pairs.length, "patch pairs");
