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
      + '<button type="button" class="ml-menu-btn mafia-cell aktif-menu" id="profilMenuBtn" onclick="ekranDegistir(\'profilim\')">👤 Profilim</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="guvenliYerMenuBtn" onclick="ekranDegistir(\'guvenliYer\')">🏠 Güvenli Yer</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="guclenMenuBtn" onclick="ekranDegistir(\'guclen\')">💪 Güçlen</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="buyumeMenuBtn" onclick="ekranDegistir(\'buyume\')">⭐ Büyüme Adımları</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="mekanMenuBtn" onclick="ekranDegistir(\'mekan\')">🏢 Mekan Sahibi</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="mekanDevriMenuBtn" onclick="ekranDegistir(\'mekan_devri\')">🔄 Mekan Devri</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'istihbarat\')">🕵️ İstihbarat</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'banka\')">🏦 Banka</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'medya\')">📰 Medya</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="gazeteMenuBtn" onclick="ekranDegistir(\'gazete\')">📰 Gazete Oku</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="babaMenuBtn" onclick="ekranDegistir(\'sehreHukmet\')">👑 Şehre Hükmet</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="toggleMenu(\'sohbetMenu\', this)" id="sohbetMenuBtn">💬 Sohbet</button>'
      + '<div id="sohbetMenu" class="ml-alt-menu">'
      + '<button type="button" class="mafia-cell" id="mesajKutuBtn" onclick="ekranDegistir(\'mesajKutusu\')">📬 Mesaj Kutusu</button>'
      + '<button type="button" class="mafia-cell" onclick="ekranDegistir(\'mafyaSohbet\')">🕶️ Mafya Sohbetleri</button>'
      + '</div>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'dusmanaCok\')">🎯 Düşmana Çök</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'karaListe\')">💀 Kara Liste</button>'
      + '<button type="button" class="ml-menu-btn mafia-cell" id="mafyaMenuBtn" onclick="toggleMenu(\'mafyaMenu\', this)">🕶️ Mafya Grubu</button>'
      + '<div id="mafyaMenu" class="ml-alt-menu">'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'olustur\')">Mafya Grubu Oluştur</button>'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'katil\')">Mafya Grubuna Katıl</button>'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'gurubum\')">Mafya Grubum</button>'
      + '<button type="button" class="mafia-cell" onclick="mafyaMenuSec(\'isler\')">Mafya İşleri</button>'
      + '</div>'
      + '<button type="button" class="ml-menu-btn mafia-cell" onclick="ekranDegistir(\'devletIliskisi\')">⚖️ Avukat</button>'
      + '</div>';
  }

  global.SidebarComponent = { getHTML: getHTML };
})(window);
