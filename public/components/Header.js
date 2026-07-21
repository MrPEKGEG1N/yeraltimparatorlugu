/**
 * Header — statü barı (İcraat, SMS, Devlet, Saygınlık, Güç, Kasa)
 */
(function (global) {
  'use strict';

  function getHTML() {
    return ''
      + '<button type="button" class="ml-hamburger" id="hamburgerBtn" aria-label="Menü" onclick="toggleSidebar()">☰</button>'
      + '<div class="ml-header-left stats-bar">'
      + '<button type="button" class="ml-btn-liderlik" onclick="ekranDegistir(\'liderlik\')">'
      + '<span class="ml-btn-liderlik-ikon" aria-hidden="true">🏆</span>'
      + '<span class="ml-btn-liderlik-txt" data-i18n="header.leaderboard">Liderlik Tablosu</span>'
      + '</button>'
      + '<div class="ml-stat-chip"><span>⏳</span><span class="ml-stat-label">İcraat:</span><span class="ml-stat-val icraat-vurgu" id="icraat" title="Saatte +25 icraat hakkı eklenir">25</span></div>'
      + '<div class="ml-stat-chip"><span>📱</span><span class="ml-stat-label">SMS:</span><span class="ml-stat-val" id="smsHakki">50</span></div>'
      + '<div class="ml-stat-chip"><span>🏛️</span><span class="ml-stat-label">Devlet:</span><span class="ml-stat-val" id="devletIliskisi">100</span></div>'
      + '<div class="ml-stat-chip"><span>🕶️</span><span class="ml-stat-label">Saygınlık:</span><span class="ml-stat-val" id="puan">1.500</span></div>'
      + '<div class="ml-stat-chip"><span>⚔️</span><span class="ml-stat-label">Güç:</span><span class="ml-stat-val" id="guc">500</span></div>'
      + '<div class="ml-stat-chip"><span>💵</span><span class="ml-stat-label">Kasa:</span><span class="ml-stat-val kasa-val" id="kasa">10.000 🪙</span></div>'
      + '<span class="gizli" id="onlineSayisi">0</span>'
      + '<span class="gizli" id="bankaUst">0 🪙</span>'
      + '</div>'
      + '<div class="ml-header-right">'
      + '<button type="button" class="ml-profil-btn" id="headerProfilBtn" onclick="ekranDegistir(\'profilim\')" title="Profilim">'
      + '<span>👤</span><span class="reis-etiket" id="reisEtiket"></span>'
      + '</button>'
      + '<button type="button" class="ml-btn ml-btn-ghost" onclick="ekranDegistir(\'sehirTarihi\')">📜 ŞEHİR TARİHİ</button>'
      + '<button type="button" class="ml-btn ml-btn-ghost" onclick="cikisYap()">ÇIKIŞ</button>'
      + '</div>';
  }

  global.HeaderComponent = { getHTML: getHTML };
})(window);
