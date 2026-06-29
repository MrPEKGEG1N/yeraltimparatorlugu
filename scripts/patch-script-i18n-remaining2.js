const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "public", "script.js");
let s = fs.readFileSync(file, "utf8");

function rep(from, to) {
  if (!s.includes(from)) return false;
  s = s.split(from).join(to);
  return true;
}

let n = 0;
function R(a, b) { if (rep(a, b)) n++; }

// profil yetenek
R("var PROFIL_YETENEK_ETIKET = {\n  guc: 'Güç',\n  zeka: 'Zeka',\n  dayaniklilik: 'Dayanıklılık',\n  beceri: 'Beceri'\n};", "function profilYetenekEtiket(key) {\n  var k = 'game.profil.skill.' + key;\n  var v = t(k);\n  return v !== k ? v : key;\n}");
R("escHtml(PROFIL_YETENEK_ETIKET[key] || key)", "escHtml(profilYetenekEtiket(key))");
R("'Sonraki kademe: ' + meta.sonrakiEsik", "t('game.profil.nextTier') + ' ' + meta.sonrakiEsik");
R("'+ '<p class=\"profil-alan-not\">Yetenekler sınırsız gelişir: iş maaşı, antrenman ve şirket eğitimi. Çubuk mevcut kademe ilerlemesini gösterir.</p>'", "'+ '<p class=\"profil-alan-not\">' + escHtml(t('game.profil.skillsNote')) + '</p>'");
R("'+ '<h4>💼 Aktif Meslek</h4>'", "'+ '<h4>' + escHtml(t('game.profil.activeJob')) + '</h4>'");
R("'+ '<p>Günlük maaş: <b id=\"profilMeslekMaas\">'", "'+ '<p>' + escHtml(t('game.profil.dailySalary')) + ' <b id=\"profilMeslekMaas\">'");
R("'+ '<h4 style=\"color:#aaa;\">Meslek yok</h4>'", "'+ '<h4 style=\"color:#aaa;\">' + escHtml(t('game.profil.noJob')) + '</h4>'");
R("'+ '<p>Menüden <b>Meslekler</b> bölümüne giderek iş başvurusu yapabilirsin.</p>'", "'+ '<p>' + t('game.profil.noJobHint') + '</p>'");

// profilEkranSablonu meta/ozet/detay
R("var metaHtml = '<span id=\"profilKayitTarihiWrap\">Kayıt: <span id=\"profilKayitTarihi\">'", "var metaHtml = '<span id=\"profilKayitTarihiWrap\">' + escHtml(t('game.profil.registered')) + ' <span id=\"profilKayitTarihi\">'");
R("metaHtml += '<span class=\"profil-rozet efsane\">👑 Şehir tarihine işlenmiş efsane.</span>';", "metaHtml += '<span class=\"profil-rozet efsane\">' + escHtml(t('game.profil.legendBadge')) + '</span>';");
R("metaHtml += '<span class=\"profil-rozet kara\">💀 Kara Liste: Liman/makam alındığında rakibin saygınlığının %5\\'i ödül</span>';", "metaHtml += '<span class=\"profil-rozet kara\">' + escHtml(t('game.profil.blacklistBadge')) + '</span>';");
R("var ozetHtml = '<div class=\"profil-ozet-hucre\"><span>👑 Oyuncu</span>", "var ozetHtml = '<div class=\"profil-ozet-hucre\"><span>' + escHtml(t('game.profil.player')) + '</span>");
R("'+ '<div class=\"profil-ozet-hucre\"><span>🏷️ Lakap</span>", "'+ '<div class=\"profil-ozet-hucre\"><span>' + escHtml(t('game.profil.nickname')) + '</span>");
R("ozetHtml += '<div class=\"profil-ozet-hucre\"><span>⚔️ Güç</span>", "ozetHtml += '<div class=\"profil-ozet-hucre\"><span>' + escHtml(t('game.profil.power')) + '</span>");
R("ozetHtml += '<div class=\"profil-ozet-hucre\"><span>🛡️ Bonus Güç</span>", "ozetHtml += '<div class=\"profil-ozet-hucre\"><span>' + escHtml(t('game.profil.bonusPower')) + '</span>");
R("ozetHtml += '<div class=\"profil-ozet-hucre\"><span>💪 Toplam Güç</span>", "ozetHtml += '<div class=\"profil-ozet-hucre\"><span>' + escHtml(t('game.profil.totalPower')) + '</span>");
R("ozetHtml += '<div class=\"profil-ozet-hucre\"><span>✦ Saatlik Kazanç</span>", "ozetHtml += '<div class=\"profil-ozet-hucre\"><span>' + escHtml(t('game.profil.hourlyIncome')) + '</span>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Oyuncu İsmi</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.playerName')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Şirket</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.company')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Saygınlık</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.respect')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Sıralama</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.rank')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>Mafya Grubu Sıralaması</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.groupRank')) + '</dt>");
R("'+ '<div class=\"profil-detay-satir\"><dt>İcraat Hakkı Yenilenmesine</dt>", "'+ '<div class=\"profil-detay-satir\"><dt>' + escHtml(t('game.profil.actionRegen')) + '</dt>");

// profil form
R("'+ '<label for=\"profilYeniOyuncuAdi\">Oyuncu Adı Değiştir</label>'", "'+ '<label for=\"profilYeniOyuncuAdi\">' + escHtml(t('game.profil.changeName')) + '</label>'");
R("placeholder=\"Yeni adın...\"", "placeholder=\"' + escHtml(t('game.profil.newNamePlaceholder')) + '\"");
R("'+ '<label>Açıklama Ekle</label>'", "'+ '<label>' + escHtml(t('game.profil.addDescription')) + '</label>'");
R("'+ '<div><label for=\"profilDostlar\">Dostlar</label>'", "'+ '<div><label for=\"profilDostlar\">' + escHtml(t('game.profil.friends')) + '</label>'");
R("placeholder=\"Kayıtlı oyuncu adı yaz...\"", "placeholder=\"' + escHtml(t('game.profil.playerNamePlaceholder')) + '\"");
R("Liderlik tablosundan seçebilir veya geçerli oyuncu adı yazabilirsin.", "' + escHtml(t('game.profil.leaderboardHint')) + '");
R("'+ '<div><label for=\"profilDusmanlar\">Düşmanlar</label>'", "'+ '<div><label for=\"profilDusmanlar\">' + escHtml(t('game.profil.enemies')) + '</label>'");
R("? '<div class=\"profil-aciklama-baslik-satir\"><label>Açıklama</label>'", "? '<div class=\"profil-aciklama-baslik-satir\"><label>' + escHtml(t('game.profil.description')) + '</label>'");
R(": '<label>Açıklama</label>')", ": '<label>' + escHtml(t('game.profil.description')) + '</label>')");
R("'+ '<div><label>Dostlar</label>", "'+ '<div><label>' + escHtml(t('game.profil.friends')) + '</label>");
R("'+ '<div><label>Düşmanlar</label>", "'+ '<div><label>' + escHtml(t('game.profil.enemies')) + '</label>");
R("onclick=\"profilResmiSecModal()\">Resmi Değiştir</button>'", "onclick=\"profilResmiSecModal()\">' + escHtml(t('game.profil.changePhoto')) + '</button>'");
R("onclick=\"profilKaydet()\">👤 Profili Kaydet</button>'", "onclick=\"profilKaydet()\">' + escHtml(t('game.profil.saveProfile')) + '</button>'");
R("onclick=\"sifreDegistirModal()\">🔐 Şifre Değiştir</button>'", "onclick=\"sifreDegistirModal()\">' + escHtml(t('game.profil.changePassword')) + '</button>'");
R("onclick=\"cikisYap()\">↪ Oyundan Çık</button>'", "onclick=\"cikisYap()\">' + escHtml(t('game.profil.logout')) + '</button>'");
R("'+ '<label for=\"eskiSifre\">Mevcut şifre</label>'", "'+ '<label for=\"eskiSifre\">' + escHtml(t('game.profil.currentPassword')) + '</label>'");
R("'+ '<label for=\"yeniSifre\">Yeni şifre</label>'", "'+ '<label for=\"yeniSifre\">' + escHtml(t('game.profil.newPassword')) + '</label>'");
R("onclick=\"sifreKaydet()\">Kaydet</button>'", "onclick=\"sifreKaydet()\">' + escHtml(t('game.profil.savePassword')) + '</button>'");
R("onclick=\"profilZiyaretSaldir", "onclick=\"profilZiyaretSaldir"); // noop anchor
R("')\">⚔️ Saldır</button>'", "')\">' + escHtml(t('game.profil.attack')) + '</button>'");
R("')\">🕵️ İstihbarat Gönder</button>'", "')\">' + escHtml(t('game.profil.sendIntel')) + '</button>'");
R("onclick=\"profilZiyaretMesajAc()\">📨 Mesaj Gönder</button>'", "onclick=\"profilZiyaretMesajAc()\">' + escHtml(t('game.profil.sendMessage')) + '</button>'");
R("'+ '<label for=\"profilZiyaretMesajMetin\">Mesajın</label>'", "'+ '<label for=\"profilZiyaretMesajMetin\">' + escHtml(t('game.profil.yourMessage')) + '</label>'");
R("placeholder=\"Mesajını yaz...\"", "placeholder=\"' + escHtml(t('game.profil.messagePlaceholder')) + '\"");
R("onclick=\"profilZiyaretMesajGonder()\">📤 Gönder</button>'", "onclick=\"profilZiyaretMesajGonder()\">' + escHtml(t('game.profil.sendMessageBtn')) + '</button>'");

// sehir tarihi
R("var html = '<h2>📜 ŞEHİR TARİHİ</h2>'\n      + '<h3 style=\"margin:16px 0 10px;color:#b8942a;\">ŞEHRE HÜKMEDENLERİN İSİMLERİ:</h3>';", "var html = '<h2>📜 ' + escHtml(t('screen.sehirTarihi').toUpperCase()) + '</h2>'\n      + '<h3 style=\"margin:16px 0 10px;color:#b8942a;\">' + escHtml(t('game.history.rulersHeading')) + '</h3>';");
R("+ (k.aktif ? ' (Şu an · ' + gunTxt + ')' : ' · ' + gunTxt)", "+ (k.aktif ? t('game.history.currentDuration', { days: gunTxt }) : t('game.history.durationSep') + gunTxt)");
R("'+ '<p>📅 Başlangıç: ' + basTxt + '</p>';", "'+ '<p>' + escHtml(t('game.history.start')) + ' ' + basTxt + '</p>';");
R("html += '<p>📅 Bitiş: <b>Devam ediyor</b></p>';", "html += '<p>' + t('game.history.endOngoing') + '</p>';");
R("html += '<p>📅 Bitiş: ' + bitTxt + '</p>';", "html += '<p>' + escHtml(t('game.history.end')) + ' ' + bitTxt + '</p>';");
R("html += '<p>⏳ Süre: <b>' + gunTxt + '</b></p>';", "html += '<p>' + escHtml(t('game.history.duration')) + ' <b>' + gunTxt + '</b></p>';");
R("html += '<p>🔄 Kimden aldı: <b>' + k.oncekiReisAdi + '</b></p>';", "html += '<p>' + escHtml(t('game.history.tookFrom')) + ' <b>' + k.oncekiReisAdi + '</b></p>';");
R("html += '<p>💀 Kaybeden: <b>' + k.kaybedenReisAdi + '</b></p>';", "html += '<p>' + escHtml(t('game.history.loser')) + ' <b>' + k.kaybedenReisAdi + '</b></p>';");
R("ic.innerHTML = '<h2>📜 ŞEHİR TARİHİ</h2><p style=\"color:#c00;\">'", "ic.innerHTML = '<h2>📜 ' + escHtml(t('screen.sehirTarihi').toUpperCase()) + '</h2><p style=\"color:#c00;\">'");

// gazete
R("if (!tickerInner) tickerInner = '<span>Sokaklar sessiz... henüz son dakika haberi yok.</span>';", "if (!tickerInner) tickerInner = '<span>' + escHtml(t('game.gazete.tickerSilent')) + '</span>';");
R("? fmt(r.miktar || 0) + ' Saygınlık'\n    : '+ ' + fmt(r.miktar || 0);", "? fmt(r.miktar || 0) + t('game.gazete.respectUnit')\n    : '+ ' + fmt(r.miktar || 0);");
R("? fmt(r.miktar || 0) + ' Saygınlık'\n        : '+' + fmt(r.miktar || 0) + ' Saygınlık';", "? fmt(r.miktar || 0) + t('game.gazete.respectGain')\n        : '+' + fmt(r.miktar || 0) + t('game.gazete.respectGain');");
R("if (!manseHtml) manseHtml = '<p class=\"gazete-bos\">Özel ilan yok.</p>';", "if (!manseHtml) manseHtml = '<p class=\"gazete-bos\">' + escHtml(t('game.gazete.noPrivateAds')) + '</p>';");
R("hakimiyetHtml += '<p class=\"gazete-hakim-satir\">👑 <strong>Şehre Hükmeden:</strong> '\n          + oyuncuLink(h.userId, h.oyuncuAdi) + ' — üç liman ve makamlar onun elinde.</p>';", "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">' + t('game.gazete.rulerFull') + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.rulerFullSuffix')) + '</p>';");
R("hakimiyetHtml += '<p class=\"gazete-hakim-satir\">⚓ ' + escHtml(h.limanAd || 'Liman') + ': '\n          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrolünde.</p>';", "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">⚓ ' + escHtml(h.limanAd || t('game.gazete.portLabel')) + ': '\n          + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.controlledBy')) + '</p>';");
R("hakimiyetHtml += '<p class=\"gazete-hakim-satir\">⚓ ' + escHtml(h.limanAd || 'Liman') + ' sahipsiz.</p>';", "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">⚓ ' + escHtml(h.limanAd || t('game.gazete.portLabel')) + escHtml(t('game.gazete.portUnowned')) + '</p>';");
R("hakimiyetHtml += '<p class=\"gazete-hakim-satir\">👤 Şu an Liman Bölgesini '\n          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrol ediyor. Sokaklar onun kurallarıyla yönetiliyor.</p>';", "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">' + t('game.gazete.portControlled') + oyuncuLink(h.userId, h.oyuncuAdi) + t('game.gazete.portRules') + '</p>';");
R("hakimiyetHtml += '<p class=\"gazete-hakim-satir\">❌ Bölgede dengeler değişti '\n          + oyuncuLink(h.kazananUserId, h.kazananAdi);", "hakimiyetHtml += '<p class=\"gazete-hakim-satir\">' + t('game.gazete.balanceChanged') + oyuncuLink(h.kazananUserId, h.kazananAdi);");
R("hakimiyetHtml += ', bölgeyi ' + oyuncuLink(h.kaybedenUserId, h.kaybedenAdi) + \"'den geri aldı.\";", "hakimiyetHtml += t('game.gazete.tookBack') + oyuncuLink(h.kaybedenUserId, h.kaybedenAdi) + t('game.gazete.tookBackSuffix');");
R("hakimiyetHtml += ' limanda boy gösterdi.';", "hakimiyetHtml += t('game.gazete.showedForce');");
R("var mansetBaslikHtml = '<h2 class=\"gazete-manset-baslik\">' + metindeIsimLinkleri(manset.baslik || 'MANŞET', oyuncular) + '</h2>';", "var mansetBaslikHtml = '<h2 class=\"gazete-manset-baslik\">' + metindeIsimLinkleri(manset.baslik || t('game.gazete.headlineDefault'), oyuncular) + '</h2>';");
R("'+ '<span class=\"gazete-aylik-sampiyon-etiket\">AYLIK RAPOR</span>'", "'+ '<span class=\"gazete-aylik-sampiyon-etiket\">' + escHtml(t('game.gazete.monthlyReport')) + '</span>'");
R("'+ '<p class=\"gazete-alinti-ust\"><em>\"Bu şehirde adalet değil, güç konuşur.\"</em></p>'", "'+ '<p class=\"gazete-alinti-ust\"><em>' + escHtml(t('game.gazete.quote')) + '</em></p>'");
R("'+ '<h1 class=\"gazete-ana-baslik\">MEDYA HABER</h1>'", "'+ '<h1 class=\"gazete-ana-baslik\">' + escHtml(t('game.gazete.heroTitle')) + '</h1>'");
R("'+ '<p class=\"gazete-alt-baslik\">YERALTI DÜNYASININ GAZETESİ</p>'", "'+ '<p class=\"gazete-alt-baslik\">' + escHtml(t('game.gazete.subtitle')) + '</p>'");
R("'+ '<span class=\"gazete-ticker-etiket\">SON DAKİKA</span>'", "'+ '<span class=\"gazete-ticker-etiket\">' + escHtml(t('game.gazete.breaking')) + '</span>'");
R("'+ '<span class=\"gazete-etiket\">ŞU MAFYANIN MANŞETİ</span>'", "'+ '<span class=\"gazete-etiket\">' + escHtml(t('game.gazete.mafiaHeadline')) + '</span>'");
R("'+ '<span class=\"gazete-devam\">HABERİN DEVAMI &gt;</span>'", "'+ '<span class=\"gazete-devam\">' + t('game.gazete.readMore') + '</span>'");
R("alt=\"Manşet\"", "alt=\"' + escHtml(t('game.gazete.headlineAlt')) + '\"");
R("'+ '<h3 class=\"gazete-yan-baslik\">EN ÇOK SAYGINLIK KAZANANLAR</h3>'", "'+ '<h3 class=\"gazete-yan-baslik\">' + escHtml(t('game.gazete.topRespect')) + '</h3>'");
R("'+ '<h3 class=\"gazete-is-ilanlari-baslik\">İŞ İLANLARI</h3>'", "'+ '<h3 class=\"gazete-is-ilanlari-baslik\">' + escHtml(t('game.gazete.jobListings')) + '</h3>'");
R("'+ '<p class=\"gazete-is-ilanlari-not\">Şirket sahipleri ilan açtığında burada listelenir — pozisyona tıklayıp başvurabilirsin.</p>'", "'+ '<p class=\"gazete-is-ilanlari-not\">' + escHtml(t('game.gazete.jobListingsNote')) + '</p>'");
R("'+ '<div class=\"gazete-kutu\"><h4>ŞEHRİN HAKİMİYETİ</h4>'", "'+ '<div class=\"gazete-kutu\"><h4>' + escHtml(t('game.gazete.dominance')) + '</h4>'");
R("'+ '<div class=\"gazete-kutu gazete-kutu-kirmizi\"><h4>YERALTI MANŞETLERİ <small>(Özel İlanlar)</small></h4>'", "'+ '<div class=\"gazete-kutu gazete-kutu-kirmizi\"><h4>' + t('game.gazete.undergroundHeadlines') + '</h4>'");
R("'+ '<div class=\"gazete-kutu\"><h4>SON 24 SAATİN EFSANELERİ</h4>'", "'+ '<div class=\"gazete-kutu\"><h4>' + escHtml(t('game.gazete.legends24h')) + '</h4>'");
R("ic.innerHTML = '<h2>📰 GAZETE</h2><p style=\"color:#c00;\">'", "ic.innerHTML = '<h2>' + escHtml(t('game.gazete.title')) + '</h2><p style=\"color:#c00;\">'");

// gazete job listings
R("html += '<strong>👔 ' + escHtml(isIlanlari.sahipSirket.isim) + '</strong> — iş ilanın kapalı.';", "html += '<strong>👔 ' + escHtml(isIlanlari.sahipSirket.isim) + '</strong> — ' + escHtml(t('game.gazete.jobClosed'));");
R("html += ' <button type=\"button\" class=\"gazete-is-patron-btn\" onclick=\"meslekSirketimAc()\">📰 İlan Ver</button>';", "html += ' <button type=\"button\" class=\"gazete-is-patron-btn\" onclick=\"meslekSirketimAc()\">' + escHtml(t('game.gazete.postJob')) + '</button>';");
R("html += '<p class=\"gazete-bos\">Açık iş ilanı yok. Şirket sahipleri Meslekler → Şirketim sekmesinden <b>İlan Ver</b> ile gazeteye düşürür.</p>';", "html += '<p class=\"gazete-bos\">' + t('game.gazete.noJobListings') + '</p>';");
R("+ ' · Patron: ' + oyuncuLink", "+ ' · ' + escHtml(t('game.gazete.bossLabel')) + ' ' + oyuncuLink");
R("+ ' · ' + s.calisanSayisi + '/' + s.maxCalisan + ' çalışan</span>';", "+ ' · ' + s.calisanSayisi + '/' + s.maxCalisan + escHtml(t('game.gazete.workerLabel')) + '</span>';");
R("html += '<span class=\"gazete-is-tikla-not\">Başvurmak için şirket adına tıkla, pozisyon seç.</span>';", "html += '<span class=\"gazete-is-tikla-not\">' + escHtml(t('game.gazete.clickToApply')) + '</span>';");
R("html += '<p class=\"gazete-is-durum\">Kadro dolu.</p>';", "html += '<p class=\"gazete-is-durum\">' + escHtml(t('game.gazete.rosterFull')) + '</p>';");
R("isIlanlari.engelNedeni || 'Başvuru yapamazsın.'", "isIlanlari.engelNedeni || t('game.gazete.cannotApply')");
R("+ fmt(p.varsayilanMaas) + ' TL/gün</span></div>';", "+ fmt(p.varsayilanMaas) + escHtml(t('game.gazete.perDay')) + '</span></div>';");
R("html += '<span class=\"gazete-is-etiket-basvuru\">✓ Başvuru yapıldı</span>';", "html += '<span class=\"gazete-is-etiket-basvuru\">' + escHtml(t('game.gazete.applied')) + '</span>';");
R("+ s.id + ',\\'' + pozIdEsc + '\\')\">Başvur</button>';", "+ s.id + ',\\'' + pozIdEsc + '\\')\">' + escHtml(t('game.gazete.apply')) + '</button>';");
R("html += '<span class=\"gazete-is-etiket-yetersiz\">Yetersiz yetenek</span>';", "html += '<span class=\"gazete-is-etiket-yetersiz\">' + escHtml(t('game.gazete.insufficientSkill')) + '</span>';");
R("var etiket = { guc: 'Güç', zeka: 'Zeka', dayaniklilik: 'Dayanıklılık', beceri: 'Beceri' };", "var etiket = { guc: t('game.profil.skill.guc'), zeka: t('game.profil.skill.zeka'), dayaniklilik: t('game.profil.skill.dayaniklilik'), beceri: t('game.profil.skill.beceri') };");

// mafya - bulk t() keys
R("box.innerHTML = '<p class=\"mafya-uyelik-uyari\">Zaten bir mafya gurubuna üyesin!</p>';", "box.innerHTML = '<p class=\"mafya-uyelik-uyari\">' + escHtml(t('game.mafya.alreadyMember')) + '</p>';");
R("'+ '<h3 class=\"bolum-baslik\">Mafya Grubu Oluştur</h3>'", "'+ '<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.createTitle')) + '</h3>'");
R("'+ '<p class=\"mafya-metin-dim\">Grubunu kur, üyelerini topla, şehirde söz sahibi ol.</p>'", "'+ '<p class=\"mafya-metin-dim\">' + escHtml(t('game.mafya.createDesc')) + '</p>'");
R("placeholder=\"Grup adı\"", "placeholder=\"' + escHtml(t('game.mafya.groupNamePlaceholder')) + '\"");
R("onclick=\"mafyaOlusturAdim1()\">[ OLUŞTUR ]</button>'", "onclick=\"mafyaOlusturAdim1()\">' + escHtml(t('game.mafya.createBtn')) + '</button>'");
R("'+ '<div id=\"mafyaAciklamaAlan\" class=\"gizli\"><label>Açıklama:</label>'", "'+ '<div id=\"mafyaAciklamaAlan\" class=\"gizli\"><label>' + escHtml(t('game.mafya.descLabel')) + '</label>'");
R("placeholder=\"Grubun hakkında...\"", "placeholder=\"' + escHtml(t('game.mafya.descPlaceholder')) + '\"");
R("onclick=\"mafyaOlusturAdim2()\">[ GRUBU KUR ]</button>", "onclick=\"mafyaOlusturAdim2()\">' + escHtml(t('game.mafya.createGroupFinalBtn')) + '</button>");
R("'+ '<h3 class=\"bolum-baslik\">Mafya Grubuna Katıl</h3>'", "'+ '<h3 class=\"bolum-baslik\">' + escHtml(t('game.mafya.joinTitle')) + '</h3>'");
R("'+ '<p class=\"mafya-metin-dim\">Mevcut bir gruba başvur veya listeden seç.</p>'", "'+ '<p class=\"mafya-metin-dim\">' + escHtml(t('game.mafya.joinDesc')) + '</p>'");
R("placeholder=\"Grup adı yaz\"", "placeholder=\"' + escHtml(t('game.mafya.searchPlaceholder')) + '\"");
R("onclick=\"mafyaAra()\">[ ARA ]</button>'", "onclick=\"mafyaAra()\">' + escHtml(t('game.mafya.searchBtn')) + '</button>'");

// chat
R("'MESAJ KUTUSU',\n    '\"Gizli yazışmalar, alarmlar ve grup mesajları burada.\"'", "t('game.chat.inboxTitle'),\n    t('game.chat.inboxQuote')");
R("'MAFYA SOHBETLERİ',\n    '\"Sokakların genel salonu — herkes duyar.\"'", "t('game.chat.mafiaChatTitle'),\n    t('game.chat.mafiaChatQuote')");
R("return '<p class=\"sb-giris\">Özel mesajlar, saldırı alarmları ve mafya grubu yazışmaları burada toplanır.</p>'", "return '<p class=\"sb-giris\">' + escHtml(t('game.chat.inboxIntro')) + '</p>'");
R("'+ '<div class=\"sb-panel-baslik\"><span class=\"sb-panel-ikon\" aria-hidden=\"true\">📤</span><h3>MESAJ GÖNDER</h3></div>'", "'+ '<div class=\"sb-panel-baslik\"><span class=\"sb-panel-ikon\" aria-hidden=\"true\">📤</span><h3>' + escHtml(t('game.chat.sendMessageTitle')) + '</h3></div>'");
R("'+ '<div class=\"sb-alan\"><label for=\"mesajHedef\">Alıcı reis adı</label>'", "'+ '<div class=\"sb-alan\"><label for=\"mesajHedef\">' + escHtml(t('game.chat.recipient')) + '</label>'");
R("placeholder=\"Oyuncu adı...\"", "placeholder=\"' + escHtml(t('game.chat.playerPlaceholder')) + '\"");
R("'+ '<div class=\"sb-alan\"><label for=\"mesajMetin\">Mesajın</label>'", "'+ '<div class=\"sb-alan\"><label for=\"mesajMetin\">' + escHtml(t('game.profil.yourMessage')) + '</label>'");
R("placeholder=\"Mesajını yaz...\"", "placeholder=\"' + escHtml(t('game.chat.sendPlaceholder')) + '\"");
R("onclick=\"mesajGonder()\">[ 📤 MESAJI GÖNDER ]</button>'", "onclick=\"mesajGonder()\">' + escHtml(t('game.chat.sendMessageBtn')) + '</button>'");
R("'+ '<div class=\"sb-panel-baslik\"><span class=\"sb-panel-ikon\" aria-hidden=\"true\">📥</span><h3>GELEN MESAJLAR</h3></div>'", "'+ '<div class=\"sb-panel-baslik\"><span class=\"sb-panel-ikon\" aria-hidden=\"true\">📥</span><h3>' + escHtml(t('game.chat.incomingTitle')) + '</h3></div>'");
R("onclick=\"mesajCevapla(' + m.id + ", "onclick=\"mesajCevapla(' + m.id + "); // noop
R("')\">Cevapla</button>';", "')\">' + escHtml(t('game.chat.reply')) + '</button>';");
R("onclick=\"mesajSil(' + m.id + ')\">Sil</button>'", "onclick=\"mesajSil(' + m.id + ')\">' + escHtml(t('game.chat.delete')) + '</button>'");
R("if (!satirlar) satirlar = '<p class=\"sb-mesaj-bos\">Salon sessiz — ilk sözü sen söyle.</p>';", "if (!satirlar) satirlar = '<p class=\"sb-mesaj-bos\">' + escHtml(t('game.chat.salonEmpty')) + '</p>';");
R("return '<p class=\"sb-giris\">Genel yeraltı salonu — herkes görür. Her mesaj <strong>1 SMS</strong> hakkı harcar.</p>'", "return '<p class=\"sb-giris\">' + t('game.chat.mafiaLoungeIntro') + '</p>'");
R("'+ '<div class=\"sb-meta-bar\"><span>📱 Kalan SMS:</span>", "'+ '<div class=\"sb-meta-bar\"><span>' + escHtml(t('game.chat.smsRemaining')) + '</span>");
R("'+ '<div class=\"sb-panel-baslik\"><span class=\"sb-panel-ikon\" aria-hidden=\"true\">✍️</span><h3>SALONA YAZ</h3></div>'", "'+ '<div class=\"sb-panel-baslik\"><span class=\"sb-panel-ikon\" aria-hidden=\"true\">✍️</span><h3>' + escHtml(t('game.chat.writeToLounge')) + '</h3></div>'");
R("placeholder=\"Mafyayla sohbet et...\"", "placeholder=\"' + escHtml(t('game.chat.mafiaChatPlaceholder')) + '\"");
R("onclick=\"mafyaSohbetGonder()\">[ 💬 GÖNDER ]</button>'", "onclick=\"mafyaSohbetGonder()\">' + escHtml(t('game.chat.sendChatBtn')) + '</button>'");
R("'<p class=\"sb-durum sb-durum--hata\">Mesajlar yüklenemedi: '", "'<p class=\"sb-durum sb-durum--hata\">' + escHtml(t('game.chat.messagesLoadFailed')) + ' '");
R("'<p class=\"sb-durum sb-durum--hata\">Sohbet yüklenemedi: '", "'<p class=\"sb-durum sb-durum--hata\">' + escHtml(t('game.chat.chatLoadFailed')) + ' '");

fs.writeFileSync(file, s, "utf8");
console.log("Applied", n, "replacements");
