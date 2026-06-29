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

// mafyaGurubumCiz
R(`      + '<h4 class="mafya-grup-aciklama-baslik">📜 Grup Açıklaması</h4>'`, `      + '<h4 class="mafya-grup-aciklama-baslik">' + escHtml(t('game.mafya.groupDescTitle')) + '</h4>'`);
R(`        + '<button type="button" class="btn-is" onclick="mafyaGrupIsimDegistir()">[ ✎ AD DEĞİŞTİR ]</button>'
        + '<button type="button" class="btn-is" onclick="mafyaGrupAciklamaDegistir()">[ ✎ AÇIKLAMA DEĞİŞTİR ]</button>'`, `        + '<button type="button" class="btn-is" onclick="mafyaGrupIsimDegistir()">' + escHtml(t('game.mafya.renameBtn')) + '</button>'
        + '<button type="button" class="btn-is" onclick="mafyaGrupAciklamaDegistir()">' + escHtml(t('game.mafya.editDescBtn')) + '</button>'`);
R(`      + '<h3 class="bolum-baslik">👥 Üyeler</h3>'
      + '<div class="tablo-izgara tablo-baslik-satir"><span>İSİM</span><span>RÜTBE</span><span>SAYGINLIK</span><span>OFFLINE</span><span></span><span></span></div>';`, `      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.membersTitle')) + '</h3>'
      + '<div class="tablo-izgara tablo-baslik-satir"><span>' + escHtml(t('game.mafya.colName')) + '</span><span>' + escHtml(t('game.mafya.colRank')) + '</span><span>' + escHtml(t('game.mafya.colRespect')) + '</span><span>' + escHtml(t('game.mafya.colOffline')) + '</span><span></span><span></span></div>';`);
R(`        html += '<button type="button" class="btn-is" style="padding:4px 8px;font-size:11px;" onclick="mafyaRutbe(' + u.user_id + ')">✎ Rütbe</button> '
          + '<button type="button" class="btn-is mavi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaDevret(' + u.user_id + ')">👑 Devret</button>';`, `        html += '<button type="button" class="btn-is" style="padding:4px 8px;font-size:11px;" onclick="mafyaRutbe(' + u.user_id + ')">' + escHtml(t('game.mafya.editRank')) + '</button> '
          + '<button type="button" class="btn-is mavi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaDevret(' + u.user_id + ')">' + escHtml(t('game.mafya.transferCrown')) + '</button>';`);
R(`        html += '<button type="button" class="btn-is kirmizi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaCikar(' + u.user_id + ')">Çıkar</button>';`, `        html += '<button type="button" class="btn-is kirmizi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaCikar(' + u.user_id + ')">' + escHtml(t('game.mafya.kick')) + '</button>';`);
R(`        html += '<h3 class="bolum-baslik">📩 Başvurular</h3>';`, `        html += '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.applications')) + '</h3>';`);
R(`            + ' <button type="button" class="btn-is" onclick="mafyaKabul(' + b.id + ')">Kabul</button> '
            + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaRed(' + b.id + ')">Red</button></p>';`, `            + ' <button type="button" class="btn-is" onclick="mafyaKabul(' + b.id + ')">' + escHtml(t('game.mafya.accept')) + '</button> '
            + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaRed(' + b.id + ')">' + escHtml(t('game.mafya.reject')) + '</button></p>';`);
R(`      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaDagit()">[ 💥 MAFYA GURUBUNU DAĞIT ]</button></div></div>';`, `      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaDagit()">' + escHtml(t('game.mafya.disbandBtn')) + '</button></div></div>';`);
R(`      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaCik()">[ 🚪 GRUPTAN ÇIK — 1.000.000 TL ]</button></div>';`, `      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaCik()">' + escHtml(t('game.mafya.leaveBtn')) + '</button></div>';`);
R(`      + '<button type="button" class="btn-is mavi-btn mafya-grup-mesaj-btn" onclick="mafyaGrupMesajModal()">[ 📨 MAFYA GURUBUNA MESAJ GÖNDER ]</button>'`, `      + '<button type="button" class="btn-is mavi-btn mafya-grup-mesaj-btn" onclick="mafyaGrupMesajModal()">' + escHtml(t('game.mafya.groupMsgBtn')) + '</button>'`);
R(`    var msg = e.message || 'Bağlantı hatası';
    if (msg.indexOf('404') >= 0) {
      msg = 'Mafya API bulunamadı (HTTP 404). Oyunu Live Server ile değil; npm start ile http://localhost:3000 üzerinden aç.';
    }
    box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">' + msg + '</p>'
      + '<p class="mafya-metin-dim">Terminal: <b>npm start</b> → tarayıcı: <b>http://localhost:3000</b> → <b>Ctrl+F5</b></p>';`, `    var msg = e.message || t('game.error.connectionFailed');
    if (msg.indexOf('404') >= 0) {
      msg = t('game.mafya.api404');
    }
    box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">' + escHtml(msg) + '</p>'
      + '<p class="mafya-metin-dim">' + t('game.mafya.serverHelp') + '</p>';`);

// mafyaEviBolumHTML
R(`    + '<h3 class="bolum-baslik">🏠 Mafya Evi</h3>'
    + '<p class="mafya-metin-dim">Seviye yükseldikçe üye kapasitesi artar (her seviye +3) ve tüm üyelere bonus güç verilir.</p>'
    + '<div class="mafya-evi-sahne"><img src="' + img + '" alt="Mafya Evi" onerror="imgFallback(this)"></div>'
    + '<div class="mafya-evi-alt"><h3>' + escHtml(grupAdi) + ' — Seviye ' + s + '</h3>'
    + '<p class="mafya-stat">👥 Kapasite: <b>' + ev.kapasite + '</b> üye</p>'
    + '<p class="mafya-stat">⚔️ Üye bonus gücü: <b>+' + fmt(ev.uyeGucBonusu || 0) + '</b> (tüm üyelere)</p>'
    + '<p class="mafya-metin-dim">Sonraki seviyede: <b>+' + fmt(ev.sonrakiUyeGucBonusu || 0) + '</b> (+' + fmt(ev.sonrakiBonusArtisi || 0) + ' artış)</p>'
    + '<p class="mafya-stat mafya-stat-altin">💰 Birikim: <b>' + fmt(ev.birikmisPara) + ' TL</b></p>'
    + '<p class="mafya-stat">⬆️ Sonraki seviye: <b>' + fmt(ev.sonrakiMaliyet) + ' TL</b> <span class="mafya-metin-dim">(Kalan: ' + fmt(ev.kalan) + ' TL)</span></p>'
    + '</div>'
    + '<div class="mafya-hibe-alan">'
    + '<h4 class="bolum-baslik">Hibe</h4>'
    + '<input type="number" id="mafyaHibe" class="dusman-input" placeholder="Hibe miktarı">'
    + '<div class="mafya-btn-satir">'
    + '<button class="btn-is" onclick="mafyaEviHibe()">[ 💸 HİBE ET ]</button>';`, `    + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.houseLevel')) + '</h3>'
    + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.houseBonusNote')) + '</p>'
    + '<div class="mafya-evi-sahne"><img src="' + img + '" alt="' + escHtml(t('game.mafya.houseAlt')) + '" onerror="imgFallback(this)"></div>'
    + '<div class="mafya-evi-alt"><h3>' + escHtml(grupAdi) + ' — ' + escHtml(t('game.mafya.levelWord')) + s + '</h3>'
    + '<p class="mafya-stat">' + escHtml(t('game.mafya.capacity')) + ' <b>' + ev.kapasite + '</b>' + escHtml(t('game.mafya.membersWord')) + '</p>'
    + '<p class="mafya-stat">' + escHtml(t('game.mafya.memberBonus')) + ' <b>+' + fmt(ev.uyeGucBonusu || 0) + '</b>' + escHtml(t('game.mafya.allMembers')) + '</p>'
    + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.nextBonus')) + ' <b>+' + fmt(ev.sonrakiUyeGucBonusu || 0) + '</b> (+' + fmt(ev.sonrakiBonusArtisi || 0) + escHtml(t('game.mafya.bonusIncrease')) + ')</p>'
    + '<p class="mafya-stat mafya-stat-altin">' + escHtml(t('game.mafya.accumulation')) + ' <b>' + fmt(ev.birikmisPara) + ' TL</b></p>'
    + '<p class="mafya-stat">' + escHtml(t('game.mafya.nextLevelShort')) + ' <b>' + fmt(ev.sonrakiMaliyet) + ' TL</b> <span class="mafya-metin-dim">' + escHtml(t('game.mafya.remaining')) + ' ' + fmt(ev.kalan) + ' TL)</span></p>'
    + '</div>'
    + '<div class="mafya-hibe-alan">'
    + '<h4 class="bolum-baslik">' + escHtml(t('game.mafya.donation')) + '</h4>'
    + '<input type="number" id="mafyaHibe" class="dusman-input" placeholder="' + escHtml(t('game.mafya.donatePlaceholder')) + '">'
    + '<div class="mafya-btn-satir">'
    + '<button class="btn-is" onclick="mafyaEviHibe()">' + escHtml(t('game.mafya.donateBtn')) + '</button>';`);
R(`    html += '<button class="btn-is kirmizi-btn" onclick="mafyaEviSeviye()">[ ⬆️ SEVİYE YÜKSELT ]</button>';
  }
  html += '<button type="button" class="btn-is mavi-btn" onclick="mafyaHibeGecmisiGoster()">[ 📋 HİBE MİKTARI GÖRÜNTÜLE ]</button>'`, `    html += '<button class="btn-is kirmizi-btn" onclick="mafyaEviSeviye()">' + escHtml(t('game.mafya.levelUpBtn')) + '</button>';
  }
  html += '<button type="button" class="btn-is mavi-btn" onclick="mafyaHibeGecmisiGoster()">' + escHtml(t('game.mafya.viewDonations')) + '</button>'`);

// mafyaSavasBolumHTML
R(`    + '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="Mafya Savaşı İlanı"></div>'
    + '<h3 class="bolum-baslik">⚔️ Mafya Savaşı İlanı</h3>';
  if (mafyaData && mafyaData.uyelik && mafyaData.uyelik.benLiderim) {
    html += '<div class="mafya-savas-ilan-alan">'
      + '<p class="mafya-metin-dim">Rakip mafya grubu adını yaz ve savaş ilan et.</p>'
      + '<input type="text" id="mafyaSavasHedef" class="dusman-input" placeholder="Rakip Mafya Grubu Adı">'
      + '<div class="mafya-btn-satir"><button class="btn-is kirmizi-btn" onclick="mafyaSavasIlan()">[ ⚔️ MAFYA SAVAŞI İLAN ET ]</button></div>'
      + '</div>';
  }`, `    + '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="' + escHtml(t('game.mafya.warDeclareBannerAlt')) + '"></div>'
    + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.warDeclareTitle')) + '</h3>';
  if (mafyaData && mafyaData.uyelik && mafyaData.uyelik.benLiderim) {
    html += '<div class="mafya-savas-ilan-alan">'
      + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.warsDesc')) + '</p>'
      + '<input type="text" id="mafyaSavasHedef" class="dusman-input" placeholder="' + escHtml(t('game.mafya.warsTargetPlaceholder')) + '">'
      + '<div class="mafya-btn-satir"><button class="btn-is kirmizi-btn" onclick="mafyaSavasIlan()">' + escHtml(t('game.mafya.declareWar')) + '</button></div>'
      + '</div>';
  }`);
R(`    var durum = s.durum === 'bekliyor' ? '⏳ Bekliyor' : s.durum === 'aktif' ? '⚔️ Aktif' : '✅ Tamamlandı';
    var kalanSaat = Math.max(0, Math.ceil((s.savas_zamani - Date.now()) / (1000 * 60 * 60)));
    html += '<div class="mafya-savas-kart"><p><b>' + durum + '</b></p>'
      + '<p>Saldıran: <b>' + escHtml(s.saldiran_grup_adi || s.saldiran_grup_id) + '</b></p>'
      + '<p>Hedef: <b>' + escHtml(s.hedef_grup_adi || s.hedef_grup_id) + '</b></p>'
      + '<p>Katılımcılar: Saldıran <b>' + s.saldiran_katilim + '</b> | Hedef <b>' + s.hedef_katilim + '</b></p>';
    if (s.durum === 'bekliyor') {
      html += '<p class="mafya-metin-dim">Başlamasına kalan: <b>' + kalanSaat + '</b> saat</p>'
        + '<button class="btn-is" onclick="mafyaSavasaKatil(' + s.id + ')">[ ⚔️ KATIL ]</button>';
    }`, `    var durum = s.durum === 'bekliyor' ? t('game.mafya.warWaiting') : s.durum === 'aktif' ? t('game.mafya.warActive') : t('game.mafya.warDone');
    var kalanSaat = Math.max(0, Math.ceil((s.savas_zamani - Date.now()) / (1000 * 60 * 60)));
    html += '<div class="mafya-savas-kart"><p><b>' + durum + '</b></p>'
      + '<p>' + escHtml(t('game.mafya.warAttacker')) + ' <b>' + escHtml(s.saldiran_grup_adi || s.saldiran_grup_id) + '</b></p>'
      + '<p>' + escHtml(t('game.mafya.warTarget')) + ' <b>' + escHtml(s.hedef_grup_adi || s.hedef_grup_id) + '</b></p>'
      + '<p>' + escHtml(t('game.mafya.warParticipants')) + ' <b>' + s.saldiran_katilim + '</b>' + escHtml(t('game.mafya.warTargetSide')) + '<b>' + s.hedef_katilim + '</b></p>';
    if (s.durum === 'bekliyor') {
      html += '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.warStartsIn')) + ' <b>' + kalanSaat + '</b>' + escHtml(t('game.mafya.warHours')) + '</p>'
        + '<button class="btn-is" onclick="mafyaSavasaKatil(' + s.id + ')">' + escHtml(t('game.mafya.joinWar')) + '</button>';
    }`);

// mafyaHibeGecmisiGoster table headers
R(`    var html = '<div class="tablo-container"><div class="tablo-izgara tablo-baslik-satir"><span>HİBE EDEN</span><span>TARİH</span><span>MİKTAR</span></div>';`, `    var html = '<div class="tablo-container"><div class="tablo-izgara tablo-baslik-satir"><span>' + escHtml(t('game.mafya.donorCol')) + '</span><span>' + escHtml(t('game.mafya.dateCol')) + '</span><span>' + escHtml(t('game.mafya.amountCol')) + '</span></div>';`);

// istihbarat power label
R(`escHtml(tr(ef.mesaj)) + '<span class="istih-sonuc-guc">⚔️ Güç: ' + fmt(ef.guc) + '</span>'`, `escHtml(tr(ef.mesaj)) + '<span class="istih-sonuc-guc">⚔️ ' + escHtml(t('game.profil.power')) + ': ' + fmt(ef.guc) + '</span>'`);

// gazete isIlanlari engelNedeni - server string
R(`    html += '<p class="gazete-is-uyari">' + escHtml(isIlanlari.engelNedeni) + '</p>';`, `    html += '<p class="gazete-is-uyari">' + escHtml(tr(isIlanlari.engelNedeni)) + '</p>';`);
R(`      html += '<p class="gazete-is-durum">' + escHtml(isIlanlari.engelNedeni || t('game.gazete.cannotApply')) + '</p>';`, `      html += '<p class="gazete-is-durum">' + escHtml(tr(isIlanlari.engelNedeni) || t('game.gazete.cannotApply')) + '</p>';`);

fs.writeFileSync(file, s, "utf8");
console.log("Applied", n, "replacements in batch 4 (part 2)");
