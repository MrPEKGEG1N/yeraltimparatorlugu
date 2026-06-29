/**
 * MasterLayout — ana şablon (Header + Sidebar + içerik alanı)
 */
(function (global) {
  'use strict';

  var PLAQUE_TITLES = {
    liderlik: 'LİDERLİK TABLOSU',
    profilim: 'PROFİLİM',
    guvenliYer: 'GÜVENLİ YER',
    gunlukGorevler: 'GÜNLÜK GÖREVLER',
    guclen: 'GÜÇLENME',
    korumaEkibi: 'EKİP KİRALA',
    silahlan: 'SİLAHLAN',
    luksYasam: 'LÜKS YAŞAM',
    buyume: 'BÜYÜME ADIMLARI',
    mekan: 'SEKTÖRLER',
    mahalle: 'MAHALLE İŞLERİ',
    semt: 'SEMT İŞLERİ',
    sehir: 'ŞEHİR İŞLERİ',
    sektor_yeralti: 'YERALTI SEKTÖRÜ',
    sektor_silah: 'SİLAH SEKTÖRÜ',
    sektor_paket: 'PAKET SEKTÖRÜ',
    mekan_devri: 'MEKAN DEVRİ',
    istihbarat: 'İSTİHBARAT',
    banka: 'BANKA',
    medya: 'MEDYA',
    gazete: 'ŞEHİR GAZETESİ',
    sehreHukmet: 'ŞEHRE HÜKMET',
    baba_soz: 'SÖZÜNÜ GEÇİR',
    baba_sadakat: 'SADAKAT YEMİNİ',
    liman: 'LİMAN İŞLETMELERİ',
    mesajKutusu: 'MESAJ KUTUSU',
    mafyaSohbet: 'MAFYA SOHBETİ',
    dusmanaCok: 'DÜŞMANA ÇÖK',
    sabotaj: 'SABOTAJ',
    borsa: 'BORSA',
    kumarhane: 'KUMARHANE',
    karaListe: 'KARA LİSTE',
    devletIliskisi: 'AVUKAT',
    sehirTarihi: 'ŞEHİR TARİHİ',
    turkiyeSefirlik: 'TÜRKİYE SEFİRLİĞİ',
    meslekler: 'MESLEKLER',
    mafya: 'MAFYA'
  };

  function root() {
    return document.getElementById('masterLayout');
  }

  function mount() {
    var el = root();
    if (!el || el.dataset.mounted === '1') return;
    if (!global.HeaderComponent || !global.SidebarComponent) return;

    el.innerHTML = ''
      + '<div class="ml-sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar(false)"></div>'
      + '<header class="ml-header" id="headerStatsBar">' + global.HeaderComponent.getHTML() + '</header>'
      + '<div class="ml-body">'
      + '<nav class="ml-sidebar mafia-border mafia-border-panel" id="sidebarMenu">' + global.SidebarComponent.getHTML() + '</nav>'
      + '<main class="ml-main-content">'
      + '<div class="ml-content-frame mafia-border mafia-border-panel" id="masterContentFrame">'
      + '<div class="ml-plaque gizli" id="masterFramePlaque"></div>'
      + '<div id="sehirBanner" class="ml-sehir-banner gizli"></div>'
      + '<div id="anaIcerik" class="ml-content-slot"></div>'
      + '</div>'
      + '</main>'
      + '</div>';

    el.dataset.mounted = '1';
  }

  function toggleSidebar(acik) {
    var menu = document.getElementById('sidebarMenu');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (!menu) return;
    var yeni = typeof acik === 'boolean' ? acik : !menu.classList.contains('ml-sidebar-open');
    menu.classList.toggle('ml-sidebar-open', yeni);
    if (backdrop) backdrop.classList.toggle('ml-backdrop-open', yeni);
    if (root()) root().classList.toggle('ml-mobile-nav-open', yeni);
  }

  function setPlaque(tip) {
    var plaque = document.getElementById('masterFramePlaque');
    if (!plaque) return;
    var baslik = '';
    if (typeof global.screenTitle === 'function') baslik = global.screenTitle(tip);
    else if (typeof global.I18n !== 'undefined' && global.I18n.screenTitle) baslik = global.I18n.screenTitle(tip);
    else baslik = PLAQUE_TITLES[tip] || '';
    if (tip && tip.indexOf('sektor_') === 0 && !baslik) baslik = PLAQUE_TITLES[tip] || PLAQUE_TITLES.mekan || '';
    if (baslik) {
      plaque.textContent = baslik;
      plaque.classList.remove('gizli');
    } else {
      plaque.textContent = '';
      plaque.classList.add('gizli');
    }
  }

  function setActiveMenu(tip) {
    var btns = document.querySelectorAll('#masterLayout .ml-menu-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('aktif-menu');
    if (tip === 'profilim') {
      var p = document.getElementById('profilMenuBtn');
      if (p) p.classList.add('aktif-menu');
    }
  }

  function onScreenChange(tip) {
    if (global.innerWidth <= 768) toggleSidebar(false);
    setPlaque(tip);
    setActiveMenu(tip);
  }

  function init() {
    mount();
    global.addEventListener('resize', function () {
      if (global.innerWidth > 768) toggleSidebar(false);
    });
  }

  global.MasterLayout = {
    mount: mount,
    init: init,
    toggleSidebar: toggleSidebar,
    setPlaque: setPlaque,
    setActiveMenu: setActiveMenu,
    onScreenChange: onScreenChange
  };

  global.toggleSidebar = toggleSidebar;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
