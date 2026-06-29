/**
 * Sidebar — menü (2. görsel: her öğe ornate hücre)
 */
(function (global) {
  'use strict';

  function getHTML() {
    return ''
      + '<div class="ml-sidebar-head mafia-cell">'
      + '<span class="ml-sidebar-star">★</span>'
      + '<span>YERALTI DÜNYASI</span>'
      + '</div>'
      + '<div class="ml-sidebar-nav">'
      + '<button type="button" class="ml-menu-btn mafia-cell aktif-menu" id="profilMenuBtn" onclick="ekranDegistir(\'profilim\')"><span class="ml-menu-emoji" aria-hidden="true">👤</span><span class="ml-menu-label">Profilim</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="guvenliYerMenuBtn" onclick="ekranDegistir(\'guvenliYer\')"><span class="ml-menu-emoji" aria-hidden="true">🏠</span><span class="ml-menu-label">Güvenli Yer</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="gunlukGorevlerMenuBtn" onclick="ekranDegistir(\'gunlukGorevler\')"><span class="ml-menu-emoji" aria-hidden="true">📜</span><span class="ml-menu-label">Günlük Görevler</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="guclenMenuBtn" onclick="ekranDegistir(\'guclen\')"><span class="ml-menu-emoji" aria-hidden="true">💪</span><span class="ml-menu-label">Güçlenme</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="buyumeMenuBtn" onclick="ekranDegistir(\'buyume\')"><span class="ml-menu-emoji" aria-hidden="true">⭐</span><span class="ml-menu-label">Büyüme</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="mekanMenuBtn" onclick="ekranDegistir(\'mekan\')"><span class="ml-menu-emoji" aria-hidden="true">🏢</span><span class="ml-menu-label">Sektörler</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="meslekMenuBtn" onclick="ekranDegistir(\'meslekler\')"><span class="ml-menu-emoji" aria-hidden="true">💼</span><span class="ml-menu-label">Meslekler</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="babaMenuBtn" onclick="ekranDegistir(\'sehreHukmet\')"><span class="ml-menu-emoji" aria-hidden="true">👑</span><span class="ml-menu-label">Şehre Hükmet</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'medya\')"><span class="ml-menu-emoji" aria-hidden="true">📰</span><span class="ml-menu-label">Medya</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="gazeteMenuBtn" onclick="ekranDegistir(\'gazete\')"><span class="ml-menu-emoji" aria-hidden="true">📄</span><span class="ml-menu-label">Şehir Gazetesi</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="mafyaMenuBtn" onclick="toggleMenu(\'mafyaMenu\', this)"><span class="ml-menu-emoji" aria-hidden="true">🕶️</span><span class="ml-menu-label">Mafya</span></button>'
      + '<div id="mafyaMenu" class="ml-alt-menu">'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'olustur\')"><span class="ml-menu-emoji" aria-hidden="true">➕</span><span class="ml-menu-label">Grup Kur</span></button>'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'katil\')"><span class="ml-menu-emoji" aria-hidden="true">🤝</span><span class="ml-menu-label">Gruba Katıl</span></button>'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'gurubum\')"><span class="ml-menu-emoji" aria-hidden="true">👥</span><span class="ml-menu-label">Grubum</span></button>'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'isler\')"><span class="ml-menu-emoji" aria-hidden="true">💼</span><span class="ml-menu-label">Grup İşleri</span></button>'
      + '</div>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="mekanDevriMenuBtn" onclick="ekranDegistir(\'mekan_devri\')"><span class="ml-menu-emoji" aria-hidden="true">🔄</span><span class="ml-menu-label">Mekan Devri</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'istihbarat\')"><span class="ml-menu-emoji" aria-hidden="true">🕵️</span><span class="ml-menu-label">İstihbarat</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'banka\')"><span class="ml-menu-emoji" aria-hidden="true">🏦</span><span class="ml-menu-label">Banka</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="toggleMenu(\'sohbetMenu\', this)" id="sohbetMenuBtn"><span class="ml-menu-emoji" aria-hidden="true">💬</span><span class="ml-menu-label">İletişim</span></button>'
      + '<div id="sohbetMenu" class="ml-alt-menu">'
      + '<button type="button" class="mafia-cell" id="mesajKutuBtn" onclick="ekranDegistir(\'mesajKutusu\')"><span class="ml-menu-emoji" aria-hidden="true">📬</span><span class="ml-menu-label">Mesaj Kutusu</span></button>'
      + '<button type="button" class="mafia-cell" onclick="ekranDegistir(\'mafyaSohbet\')"><span class="ml-menu-emoji" aria-hidden="true">🕶️</span><span class="ml-menu-label">Mafya Sohbeti</span></button>'
      + '</div>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'dusmanaCok\')"><span class="ml-menu-emoji" aria-hidden="true">🎯</span><span class="ml-menu-label">Düşmana Çök</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'karaListe\')"><span class="ml-menu-emoji" aria-hidden="true">💀</span><span class="ml-menu-label">Kara Liste</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'devletIliskisi\')"><span class="ml-menu-emoji" aria-hidden="true">⚖️</span><span class="ml-menu-label">Avukat</span></button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="egitimAc()"><span class="ml-menu-emoji" aria-hidden="true">📖</span><span class="ml-menu-label">Oyun Eğitimi</span></button>'
      + '</div>';
  }

  global.SidebarComponent = { getHTML: getHTML };
})(window);
