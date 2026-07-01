/* global apiFetch, sunucuAksiyon, t, escHtml, fmt, toast, oyuncuKasa, sesCal */

var kumarhanePanelVeri = null;
var kumarhaneAktifOyun = null;
var kumarhaneAnimasyon = false;
var kumarhaneSlotSemboller = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣', '⭐', '🍀', '💰'];
var RULET_SIRASI = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
var RULET_KIRMIZI = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
var RULET_POCKET = 360 / 37;
var ZAR_YUZLER = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
var ZAR_NOKTA_YER = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

function kumarhaneZarDotsHTML(n) {
  var yer = ZAR_NOKTA_YER[n] || ZAR_NOKTA_YER[1];
  var html = '<div class="km-zar-yuz">';
  for (var i = 1; i <= 9; i++) {
    html += '<span class="km-zar-nokta' + (yer.indexOf(i) >= 0 ? ' km-zar-nokta--aktif' : '') + '"></span>';
  }
  return html + '</div>';
}

function kumarhaneZarGoster(el, n) {
  if (!el) return;
  var v = Math.max(1, Math.min(6, parseInt(n, 10) || 1));
  el.setAttribute('data-zar', String(v));
  el.innerHTML = kumarhaneZarDotsHTML(v);
}

function kumarhaneZarKutuHTML(id, baslangic) {
  return '<div class="km-zar-kutu"><div class="km-zar-golge"></div>'
    + '<div class="km-zar" id="' + id + '" data-zar="' + (baslangic || 1) + '">'
    + kumarhaneZarDotsHTML(baslangic || 1) + '</div></div>';
}
var kumarhaneRuletSonAci = 0;
var kumarhaneRuletSeciliSayi = 7;
var kumarhaneOyunModu = { barbut: 'solo', rus_ruleti: 'solo' };
var kumarhaneMasaVeri = null;
var kumarhaneMasaPollTimer = null;
var kumarhanePiyangoSecili = [];
var KUMARHANE_OYUN_KAPAK = {
  blackjack: 'images/kumarhane/blackjack.png',
  rulet: 'images/kumarhane/rulet.png',
  barbut: 'images/kumarhane/barbut.png',
  rus_ruleti: 'images/kumarhane/rus-ruleti.png',
  uc_kart_poker: 'images/kumarhane/uc-kart-poker.png',
  slot: 'images/kumarhane/slot.png',
  at_yarisi: 'images/kumarhane/at-yarisi.png',
  five_finger: 'images/kumarhane/five-finger.png',
  piyango: 'images/kumarhane/piyango.png'
};

function kumarhaneOyunKapakHTML(oyunId, alt, sahne) {
  var src = KUMARHANE_OYUN_KAPAK[oyunId];
  if (!src) return '';
  var cls = 'km-oyun-kapak' + (sahne ? ' km-oyun-kapak--sahne' : '');
  return '<div class="' + cls + '"><img src="' + escHtml(src) + '" alt="' + escHtml(alt || '') + '" loading="lazy" decoding="async"></div>';
}

function kumarhaneOyunMasaHTML(oyunId, icerik) {
  var src = KUMARHANE_OYUN_KAPAK[oyunId];
  if (!src) return icerik;
  return '<div class="km-oyun-masa km-oyun-masa--' + escHtml(oyunId) + '">'
    + '<div class="km-oyun-masa-gorsel" aria-hidden="true">'
    + '<img class="km-oyun-masa-img" src="' + escHtml(src) + '" alt="">'
    + '<div class="km-oyun-masa-perde"></div>'
    + '</div>'
    + '<div class="km-oyun-masa-oyun">' + icerik + '</div>'
    + '</div>';
}

function kumarhaneAktifGorunumKaydet(oyunId, gorunum, chip) {
  if (!kumarhanePanelVeri) kumarhanePanelVeri = {};
  if (chip != null) kumarhanePanelVeri.chip = chip;
  if (gorunum) {
    kumarhanePanelVeri.aktifOyun = { oyunId: oyunId, gorunum: gorunum };
  } else if (kumarhanePanelVeri.aktifOyun && kumarhanePanelVeri.aktifOyun.oyunId === oyunId) {
    kumarhanePanelVeri.aktifOyun = null;
  }
}

function kumarhaneBekle(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function kumarhaneSes(tip) {
  if (typeof sesCal !== 'function') return;
  if (tip === 'kazanc' || tip === 'chip') sesCal('para');
  else if (tip === 'kayip') sesCal('zayif');
  else sesCal('saldiri');
}

function kumarhaneFxGoster(metin, tip) {
  var katman = document.getElementById('kumarhaneFxKatman');
  var yazi = document.getElementById('kumarhaneFxYazi');
  if (!katman || !yazi) return;
  yazi.textContent = metin;
  yazi.className = 'km-fx-yazi km-fx-yazi--' + (tip === 'kazanc' ? 'kazanc' : 'kayip');
  katman.classList.remove('gizli');
  setTimeout(function() { katman.classList.add('gizli'); }, 1200);
}

function kumarhaneChipPulse() {
  var kutu = document.querySelector('#masterLayout #anaIcerik .km-ozet-kutu--chip');
  if (!kutu) return;
  kutu.classList.remove('km-ozet-kutu--pulse');
  void kutu.offsetWidth;
  kutu.classList.add('km-ozet-kutu--pulse');
}

function kumarhaneSonucGoster(html, tip) {
  var el = document.getElementById('kumarhaneSonuc');
  if (!el) return;
  el.className = 'km-sonuc km-sonuc--' + (tip || 'uyari');
  el.innerHTML = html;
  el.classList.remove('gizli');
}

function kumarhaneKartHTML(kart, delayMs) {
  if (!kart || kart === '??') {
    return '<div class="km-kart km-kart--arka km-kart--dagit" style="animation-delay:' + (delayMs || 0) + 'ms">?</div>';
  }
  var kirmizi = kart.indexOf('♥') >= 0 || kart.indexOf('♦') >= 0;
  var rank = kart.replace(/[♠♥♦♣]/g, '');
  var suit = (kart.match(/[♠♥♦♣]/) || [''])[0];
  return '<div class="km-kart km-kart--' + (kirmizi ? 'kirmizi' : 'siyah') + ' km-kart--dagit" style="animation-delay:' + (delayMs || 0) + 'ms">'
    + '<span class="km-kart-rank">' + escHtml(rank) + '</span>'
    + '<span class="km-kart-suit">' + suit + '</span></div>';
}

function kumarhaneKartSiraHTML(kartlar) {
  var html = '<div class="km-kart-sira">';
  (kartlar || []).forEach(function(k, i) {
    html += kumarhaneKartHTML(k, i * 80);
  });
  html += '</div>';
  return html;
}

function kumarhaneOzetGuncelle() {
  if (!kumarhanePanelVeri) return;
  var kasaEl = document.getElementById('kmKasaGoster');
  var chipEl = document.getElementById('kmChipGoster');
  if (kasaEl) kasaEl.textContent = fmt(oyuncuKasa) + ' TL';
  if (chipEl) {
    chipEl.innerHTML = fmt(kumarhanePanelVeri.chip || 0)
      + '<span class="km-chip-yigin"><span class="km-chip-mini"></span><span class="km-chip-mini"></span><span class="km-chip-mini"></span></span>';
  }
}

function kumarhaneBahisInput(id, varsayilan) {
  return '<input type="number" id="' + id + '" class="km-adet-input" min="50" value="' + (varsayilan || 100) + '" inputmode="numeric">';
}

function kumarhaneOyunKartlariHTML() {
  var html = '<div class="km-oyun-grid">';
  (kumarhanePanelVeri.oyunlar || []).forEach(function(oyun) {
    html += '<article class="km-oyun-kart km-oyun-kart--' + oyun.id + '" onclick="kumarhaneOyunAc(\'' + oyun.id + '\')">'
      + kumarhaneOyunKapakHTML(oyun.id, oyun.ad, false)
      + '<div class="km-oyun-kart-ic">'
      + '<h4><span class="km-oyun-ikon-mini" aria-hidden="true">' + escHtml(oyun.ikon) + '</span> ' + escHtml(oyun.ad) + '</h4>'
      + '<p>' + escHtml(oyun.aciklama) + '</p>'
      + '<span class="km-oyun-limit">' + escHtml(t('game.kumarhane.betRange', {
        min: fmt(oyun.minBahis),
        max: fmt(oyun.maxBahis)
      })) + '</span></div></article>';
  });
  html += '</div>';
  return html;
}

function kumarhaneLobiHTML() {
  return '<div class="km-pvp-duyuru" role="note">'
    + '<span class="km-pvp-duyuru-ikon" aria-hidden="true">👥</span>'
    + '<p>' + escHtml(t('game.kumarhane.pvpLobbyNotice')) + '</p>'
    + '</div>'
    + '<div class="km-cip-kart">'
    + '<h3>' + escHtml(t('game.kumarhane.chipsTitle')) + '</h3>'
    + '<p>' + escHtml(t('game.kumarhane.chipsDesc')) + '</p>'
    + '<div class="km-cip-satir">'
    + '<label>' + escHtml(t('game.kumarhane.buyChips')) + '</label>'
    + kumarhaneBahisInput('kmChipAlMiktar', 1000)
    + '<button type="button" class="km-btn km-btn--yesil" onclick="kumarhaneChipAl()">' + escHtml(t('game.kumarhane.chipBuyBtn')) + '</button>'
    + '</div>'
    + '<div class="km-cip-satir">'
    + '<label>' + escHtml(t('game.kumarhane.sellChips')) + '</label>'
    + kumarhaneBahisInput('kmChipSatMiktar', 1000)
    + '<button type="button" class="km-btn km-btn--altin" onclick="kumarhaneChipSat()">' + escHtml(t('game.kumarhane.chipSellBtn')) + '</button>'
    + '</div></div>'
    + '<h3 class="km-bolum-baslik">' + escHtml(t('game.kumarhane.gamesTitle')) + '</h3>'
    + kumarhaneOyunKartlariHTML();
}

function kumarhaneSlotRastgeleSembol() {
  return kumarhaneSlotSemboller[Math.floor(Math.random() * kumarhaneSlotSemboller.length)];
}

function kumarhaneFeltMasaHTML(icerik, tip) {
  return '<div class="km-felt-masa km-felt-masa--' + (tip || 'yesil') + '">'
    + '<div class="km-felt-masa-kenar"><span class="km-felt-masa-isim">' + escHtml(t('screen.kumarhane')) + '</span></div>'
    + '<div class="km-felt-masa-ic">' + icerik + '</div></div>';
}

function kumarhaneBlackjackHTML() {
  var g = (kumarhanePanelVeri.aktifOyun && kumarhanePanelVeri.aktifOyun.oyunId === 'blackjack')
    ? kumarhanePanelVeri.aktifOyun.gorunum : null;
  var html = '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>🃏 Blackjack</h3></div>';
  html += '<div class="km-oyun-sahne km-oyun-sahne--kart">';
  if (g) {
    var masaIcerik = '<div class="km-bj-masa-ic km-bj-oyun">'
      + '<div class="km-bj-zon km-bj-zon--krupiye km-el-panel">'
      + '<div class="km-el-kutu km-el-kutu--krupiye"><div class="km-el-baslik">' + escHtml(t('game.kumarhane.dealer')) + '</div>'
      + kumarhaneKartSiraHTML(g.krupiye)
      + (g.krupiyeToplam != null ? '<div class="km-el-toplam">' + g.krupiyeToplam + '</div>' : '') + '</div></div>'
      + '<div class="km-bj-zon km-bj-zon--oyuncu km-el-panel">'
      + '<div class="km-el-kutu km-el-kutu--oyuncu"><div class="km-el-baslik">' + escHtml(t('game.kumarhane.you')) + '</div>'
      + kumarhaneKartSiraHTML(g.oyuncu)
      + '<div class="km-el-toplam">' + (g.oyuncuToplam || '') + '</div></div></div>'
      + '<div class="km-hamle-satir km-bj-hamle">'
      + '<button type="button" class="km-btn" onclick="kumarhaneHamle(\'hit\')" ' + (kumarhaneAnimasyon ? 'disabled' : '') + '>Hit</button>'
      + '<button type="button" class="km-btn" onclick="kumarhaneHamle(\'stand\')" ' + (kumarhaneAnimasyon ? 'disabled' : '') + '>Stand</button>'
      + '<button type="button" class="km-btn"' + (g.doubleKullanildi || kumarhaneAnimasyon ? ' disabled' : '') + ' onclick="kumarhaneHamle(\'double\')">Double</button>'
      + '</div></div>';
    html += kumarhaneOyunMasaHTML('blackjack', masaIcerik);
  } else {
    html += kumarhaneOyunMasaHTML('blackjack', '<div class="km-bj-bekle km-el-panel">' + escHtml(t('game.kumarhane.deal')) + '…</div>')
      + '<p class="km-ipucu">' + escHtml(t('game.kumarhane.blackjackHint')) + '</p>'
      + '<div class="km-bahis-satir">' + escHtml(t('game.kumarhane.bet')) + ' ' + kumarhaneBahisInput('kmBahis_blackjack', 200)
      + '<button type="button" class="km-btn km-btn--yesil" onclick="kumarhaneBaslat(\'blackjack\')">' + escHtml(t('game.kumarhane.deal')) + '</button></div>';
  }
  html += '</div>';
  return html;
}

function kumarhaneRuletKirmiziMi(n) {
  return RULET_KIRMIZI.indexOf(n) >= 0;
}

function kumarhaneRuletRenkSinifi(n) {
  if (n === 0) return 'yesil';
  return kumarhaneRuletKirmiziMi(n) ? 'kirmizi' : 'siyah';
}

function kumarhaneRuletPolar(cx, cy, r, deg) {
  var rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function kumarhaneRuletCarkSVG() {
  var cx = 150;
  var cy = 150;
  var ro = 142;
  var ri = 92;
  var seg = RULET_POCKET;
  var paths = '';
  var labels = '';
  RULET_SIRASI.forEach(function(n, i) {
    var a0 = i * seg;
    var a1 = a0 + seg;
    var p0o = kumarhaneRuletPolar(cx, cy, ro, a0);
    var p1o = kumarhaneRuletPolar(cx, cy, ro, a1);
    var p0i = kumarhaneRuletPolar(cx, cy, ri, a0);
    var p1i = kumarhaneRuletPolar(cx, cy, ri, a1);
    var large = seg > 180 ? 1 : 0;
    paths += '<path d="M' + p0i.x.toFixed(2) + ',' + p0i.y.toFixed(2)
      + ' L' + p0o.x.toFixed(2) + ',' + p0o.y.toFixed(2)
      + ' A' + ro + ',' + ro + ' 0 ' + large + ' 1 ' + p1o.x.toFixed(2) + ',' + p1o.y.toFixed(2)
      + ' L' + p1i.x.toFixed(2) + ',' + p1i.y.toFixed(2)
      + ' A' + ri + ',' + ri + ' 0 ' + large + ' 0 ' + p0i.x.toFixed(2) + ',' + p0i.y.toFixed(2)
      + ' Z" class="km-rulet-seg km-rulet-seg--' + kumarhaneRuletRenkSinifi(n) + '" data-n="' + n + '"/>';
    var mid = a0 + seg / 2;
    var lp = kumarhaneRuletPolar(cx, cy, (ro + ri) / 2, mid);
    labels += '<text x="' + lp.x.toFixed(1) + '" y="' + (lp.y + 4).toFixed(1)
      + '" class="km-rulet-seg-no">' + n + '</text>';
  });
  return '<svg class="km-rulet-svg" viewBox="0 0 300 300" aria-hidden="true">'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="152" class="km-rulet-dis-halka"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="148" class="km-rulet-ahsap"/>'
    + '<g id="kmRuletCark" class="km-rulet-cark-grup">' + paths + labels + '</g>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="78" class="km-rulet-hub"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="62" class="km-rulet-hub-ic"/>'
    + '</svg>';
}

function kumarhaneRuletTabloHTML() {
  var satirlar = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
  ];
  var hucre = function(n) {
    return '<button type="button" class="km-rulet-hucre km-rulet-hucre--' + kumarhaneRuletRenkSinifi(n) + '" data-n="' + n + '" onclick="kumarhaneRuletSayiSec(' + n + ')">' + n + '</button>';
  };
  var html = '<div class="km-rulet-tablo" id="kmRuletTablo">'
    + '<div class="km-rulet-tablo-sifir">' + hucre(0) + '</div>'
    + '<div class="km-rulet-tablo-grid">';
  satirlar.forEach(function(satir) {
    html += '<div class="km-rulet-tablo-satir">';
    satir.forEach(function(n) { html += hucre(n); });
    html += '</div>';
  });
  return html + '</div></div>';
}

function kumarhaneRuletTabloVurgula(sonuc) {
  document.querySelectorAll('#masterLayout #anaIcerik .km-rulet-hucre').forEach(function(el) {
    el.classList.remove('km-rulet-hucre--kazanan');
  });
  if (sonuc == null) return;
  var hedef = document.querySelector('#masterLayout #anaIcerik .km-rulet-hucre[data-n="' + sonuc + '"]');
  if (hedef) hedef.classList.add('km-rulet-hucre--kazanan');
}

function kumarhaneRuletSayiVurgula(n) {
  document.querySelectorAll('#masterLayout #anaIcerik .km-rulet-hucre').forEach(function(el) {
    el.classList.toggle('km-rulet-hucre--secili', String(el.getAttribute('data-n')) === String(n));
  });
  var etiket = document.getElementById('kmRuletSeciliGoster');
  if (etiket) etiket.textContent = String(n);
}

function kumarhaneRuletSayiSec(n) {
  if (kumarhaneAnimasyon) return;
  var sayi = parseInt(n, 10);
  if (!Number.isFinite(sayi) || sayi < 0 || sayi > 36) return;
  kumarhaneRuletSeciliSayi = sayi;
  kumarhaneRuletSayiVurgula(sayi);
  kumarhaneRuletBahisVurgula('sayi');
  var el = document.getElementById('kmRuletSayi');
  if (el) el.value = String(sayi);
}

function kumarhaneRuletTabloHazirla() {
  kumarhaneRuletSayiVurgula(kumarhaneRuletSeciliSayi);
  var input = document.getElementById('kmRuletSayi');
  if (input && !input.dataset.kmRuletBagli) {
    input.dataset.kmRuletBagli = '1';
    input.addEventListener('change', function() {
      var n = parseInt(input.value, 10);
      if (Number.isFinite(n) && n >= 0 && n <= 36) kumarhaneRuletSayiSec(n);
    });
  }
}

function kumarhaneRuletHedefAci(sonuc) {
  var idx = RULET_SIRASI.indexOf(sonuc);
  if (idx < 0) idx = 0;
  var pocket = idx * RULET_POCKET + RULET_POCKET / 2;
  return (5 + Math.floor(Math.random() * 3)) * 360 + (360 - pocket);
}

function kumarhaneRuletSifirla() {
  var cark = document.getElementById('kmRuletCark');
  var topH = document.getElementById('kmRuletTopHalka');
  if (cark) {
    cark.style.transition = 'none';
    cark.style.transform = 'rotate(' + kumarhaneRuletSonAci + 'deg)';
  }
  if (topH) {
    topH.style.transition = 'none';
    topH.style.transform = 'rotate(' + (-kumarhaneRuletSonAci * 1.25) + 'deg)';
  }
  if (cark) void cark.offsetWidth;
}

function kumarhaneRuletBahisVurgula(tur) {
  document.querySelectorAll('#masterLayout #anaIcerik .km-rulet-btn').forEach(function(btn) {
    btn.classList.remove('km-rulet-btn--secili');
  });
  var sel = document.querySelector('#masterLayout #anaIcerik .km-rulet-btn[data-tur="' + tur + '"]');
  if (sel) sel.classList.add('km-rulet-btn--secili');
  if (tur === 'sayi') {
    kumarhaneRuletSayiVurgula(kumarhaneRuletSeciliSayi);
  } else {
    document.querySelectorAll('#masterLayout #anaIcerik .km-rulet-hucre').forEach(function(el) {
      el.classList.remove('km-rulet-hucre--secili');
    });
  }
}

function kumarhaneRuletHTML() {
  var ruletOyun = '<div class="km-rulet-masa km-rulet-masa--gorsel">'
    + '<div class="km-rulet-layout">'
    + '<div class="km-rulet-sol">'
    + '<div class="km-rulet-cark-wrap">'
    + '<div class="km-rulet-ok"><span class="km-rulet-ok-ic"></span></div>'
    + '<div class="km-rulet-cark-kasa">' + kumarhaneRuletCarkSVG()
    + '<div class="km-rulet-top-halka" id="kmRuletTopHalka"><div class="km-rulet-top" id="kmRuletTop"></div></div>'
    + '<div class="km-rulet-merkez" id="kmRuletMerkez">?</div>'
    + '</div></div>'
    + '<div class="km-rulet-durum" id="kmRuletDurum"></div>'
    + '<div class="km-rulet-sonuc-rozet gizli" id="kmRuletRozet"></div>'
    + '</div>'
    + '<div class="km-rulet-sag">' + kumarhaneRuletTabloHTML()
    + '<p class="km-rulet-tablo-ipucu">' + escHtml(t('game.kumarhane.rouletteTableHint')) + '</p>'
    + '<div class="km-rulet-secili-satir"><span>' + escHtml(t('game.kumarhane.selectedNumber')) + '</span> '
    + '<strong id="kmRuletSeciliGoster">7</strong>'
    + '<button type="button" class="km-btn km-btn--yesil km-rulet-tablo-cevir" onclick="kumarhaneRuletOyna(\'sayi\')">' + escHtml(t('game.kumarhane.spinNumber')) + '</button>'
    + '</div></div>'
    + '</div></div>';
  return '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>🎡 Rulet</h3></div>'
    + '<div class="km-oyun-sahne km-oyun-sahne--rulet">' + kumarhaneOyunMasaHTML('rulet', ruletOyun)
    + '<p class="km-ipucu">' + escHtml(t('game.kumarhane.rouletteHint')) + '</p>'
    + '<div class="km-bahis-satir">' + escHtml(t('game.kumarhane.bet')) + ' ' + kumarhaneBahisInput('kmBahis_rulet', 100) + '</div>'
    + '<div class="km-rulet-grid">'
    + '<button type="button" class="km-rulet-btn km-rulet-btn--kirmizi" data-tur="kirmizi" onclick="kumarhaneRuletOyna(\'kirmizi\')">' + escHtml(t('game.kumarhane.red')) + '</button>'
    + '<button type="button" class="km-rulet-btn km-rulet-btn--siyah" data-tur="siyah" onclick="kumarhaneRuletOyna(\'siyah\')">' + escHtml(t('game.kumarhane.black')) + '</button>'
    + '<button type="button" class="km-rulet-btn" data-tur="tek" onclick="kumarhaneRuletOyna(\'tek\')">' + escHtml(t('game.kumarhane.odd')) + '</button>'
    + '<button type="button" class="km-rulet-btn" data-tur="cift" onclick="kumarhaneRuletOyna(\'cift\')">' + escHtml(t('game.kumarhane.even')) + '</button>'
    + '<button type="button" class="km-rulet-btn" data-tur="dusuk" onclick="kumarhaneRuletOyna(\'dusuk\')">1–18</button>'
    + '<button type="button" class="km-rulet-btn" data-tur="yuksek" onclick="kumarhaneRuletOyna(\'yuksek\')">19–36</button>'
    + '</div>'
    + '<div class="km-bahis-satir">' + escHtml(t('game.kumarhane.luckyNumber')) + ' '
    + '<input type="number" id="kmRuletSayi" class="km-adet-input" min="0" max="36" value="7" inputmode="numeric">'
    + '<button type="button" class="km-btn km-btn--yesil" data-tur="sayi" onclick="kumarhaneRuletOyna(\'sayi\')">' + escHtml(t('game.kumarhane.spin')) + '</button></div>'
    + '<div id="kmRuletSonuc" class="km-mini-sonuc"></div>'
    + '</div>';
}

function kumarhaneModSekmeHTML(oyunId) {
  var mod = kumarhaneOyunModu[oyunId] || 'solo';
  return '<div class="km-mod-sekmeler">'
    + '<button type="button" class="km-mod-sekme' + (mod === 'solo' ? ' km-mod-sekme--aktif' : '') + '" onclick="kumarhaneModDegistir(\'' + oyunId + '\',\'solo\')">' + escHtml(t('game.kumarhane.modeSolo')) + '</button>'
    + '<button type="button" class="km-mod-sekme' + (mod === 'pvp' ? ' km-mod-sekme--aktif' : '') + '" onclick="kumarhaneModDegistir(\'' + oyunId + '\',\'pvp\')">' + escHtml(t('game.kumarhane.modePvp')) + '</button>'
    + '</div>';
}

function kumarhanePvpKoltukHTML(oyuncu, hazir, benMi) {
  if (!oyuncu) {
    return '<div class="km-pvp-koltuk km-pvp-koltuk--bos"><span class="km-pvp-bos">' + escHtml(t('game.kumarhane.seatEmpty')) + '</span></div>';
  }
  return '<div class="km-pvp-koltuk' + (benMi ? ' km-pvp-koltuk--ben' : '') + (hazir ? ' km-pvp-koltuk--hazir' : '') + '">'
    + '<div class="km-pvp-avatar">' + escHtml(oyuncu.lakap ? oyuncu.lakap.charAt(0) : '?') + '</div>'
    + '<div class="km-pvp-ad">' + escHtml(oyuncu.ad) + '</div>'
    + '<span class="km-pvp-online km-pvp-online--' + (oyuncu.online ? 'acik' : 'kapali') + '">' + (oyuncu.online ? '● ' + escHtml(t('game.kumarhane.online')) : '○ ' + escHtml(t('game.kumarhane.offline'))) + '</span>'
    + (hazir ? '<span class="km-pvp-hazir-rozet">' + escHtml(t('game.kumarhane.ready')) + '</span>' : '')
    + '</div>';
}

function kumarhanePvpMasaHTML(oyunId) {
  var m = kumarhaneMasaVeri;
  var html = '<div id="kmPvpMasaWrap" class="km-pvp-wrap">';
  if (!m) {
    html += '<p class="km-ipucu">' + escHtml(t('game.kumarhane.pvpLoading')) + '</p></div>';
    return html;
  }
  var masaIcerik = '';
  if (oyunId === 'barbut') {
    masaIcerik = '<div class="km-pvp-barbut-zarlar km-el-panel" id="kmPvpBarbutZarlar">'
      + kumarhaneZarKutuHTML('kmPvpBarbutZ1', 1) + kumarhaneZarKutuHTML('kmPvpBarbutZ2', 2)
      + '<div class="km-barbut-toplam" id="kmPvpBarbutToplam"></div></div>';
  } else if (oyunId === 'rus_ruleti') {
    masaIcerik = '<div class="km-rus-sahne km-rus-sahne--pvp" id="kmRusSahne">'
      + kumarhaneRusRevolverHTML('kmRusSilindir', true, true)
      + '</div>';
  }
  masaIcerik += '<div class="km-pvp-masa km-el-panel">'
    + kumarhanePvpKoltukHTML(m.oyuncu1, m.hazir1, m.ben === 1)
    + '<div class="km-pvp-pot"><div class="km-pvp-pot-etiket">' + escHtml(t('game.kumarhane.pot')) + '</div>'
    + '<div class="km-pvp-pot-deger">' + fmt(m.pot || 0) + '</div>'
    + '<div class="km-pvp-pot-alt">' + escHtml(t('game.kumarhane.pvpMinBet', { min: fmt(m.minBahis || 10000) })) + '</div></div>'
    + kumarhanePvpKoltukHTML(m.oyuncu2, m.hazir2, m.ben === 2)
    + '</div>';
  html += kumarhaneOyunMasaHTML(oyunId, masaIcerik);

  html += '<div class="km-pvp-bahis-satir">'
    + '<label>' + escHtml(t('game.kumarhane.tableBet')) + '</label>'
    + '<input type="number" id="kmPvpBahis_' + oyunId + '" class="km-adet-input" min="' + (m.minBahis || 10000) + '" value="' + (m.bahis || 10000) + '" inputmode="numeric">'
    + '<button type="button" class="km-btn km-btn--altin" onclick="kumarhaneMasaBahisOner(\'' + oyunId + '\')">' + escHtml(t('game.kumarhane.proposeBet')) + '</button>'
    + '</div>';

  if (m.onayBekliyor && m.onerilenBahis) {
    html += '<div class="km-pvp-onay-kutu"><p>' + escHtml(t('game.kumarhane.betApproval', { n: fmt(m.onerilenBahis) })) + '</p>'
      + '<button type="button" class="km-btn km-btn--yesil" onclick="kumarhaneMasaBahisCevap(true)">' + escHtml(t('game.kumarhane.approve')) + '</button>'
      + '<button type="button" class="km-btn" onclick="kumarhaneMasaBahisCevap(false)">' + escHtml(t('game.kumarhane.reject')) + '</button></div>';
  } else if (m.onerilenBahis && m.onerilenKim && !m.onayBekliyor) {
    html += '<p class="km-ipucu">' + escHtml(t('game.kumarhane.betPending')) + '</p>';
  }

  html += '<div class="km-pvp-aksiyon">'
    + '<button type="button" class="km-btn' + (m.benHazir ? ' km-btn--altin' : ' km-btn--yesil') + '" onclick="kumarhaneMasaHazir()">' + escHtml(m.benHazir ? t('game.kumarhane.unready') : t('game.kumarhane.ready')) + '</button>';

  if (m.ikisiHazir && m.durum !== 'sonuc') {
    if (oyunId === 'barbut') {
      html += '<button type="button" class="km-btn km-btn--yesil" onclick="kumarhaneMasaOyna()">🎲 ' + escHtml(t('game.kumarhane.rollDice')) + '</button>';
    } else if (m.durum === 'oyun' && m.oyunState && m.oyunState.siradaki) {
      var siraBen = (m.ben === 1 && m.oyuncu1 && m.oyunState.siradaki === m.oyuncu1.id)
        || (m.ben === 2 && m.oyuncu2 && m.oyunState.siradaki === m.oyuncu2.id);
      if (siraBen) {
        html += '<button type="button" class="km-btn km-btn--kirmizi" onclick="kumarhaneMasaOyna()">💀 ' + escHtml(t('game.kumarhane.russianPull')) + '</button>';
      } else {
        html += '<span class="km-ipucu">' + escHtml(t('game.kumarhane.waitTurn')) + '</span>';
      }
    } else if (m.durum !== 'oyun') {
      html += '<button type="button" class="km-btn km-btn--kirmizi" onclick="kumarhaneMasaOyna()">💀 ' + escHtml(t('game.kumarhane.russianStart')) + '</button>';
    }
  }

  if (m.durum === 'sonuc' && m.sonuc) {
    html += '<button type="button" class="km-btn" onclick="kumarhaneMasaOyna()">' + escHtml(t('game.kumarhane.newRound')) + '</button>';
  }

  html += '<button type="button" class="km-btn" onclick="kumarhaneMasaAyril()">' + escHtml(t('game.kumarhane.leaveTable')) + '</button>'
    + '</div>';

  if (m.sonuc && m.sonuc.tur === 'barbut_pvp') {
    html += '<div class="km-pvp-sonuc">'
      + '<div>' + escHtml(m.sonuc.oyuncu1.ad || '#1') + ': ' + m.sonuc.oyuncu1.z1 + '+' + m.sonuc.oyuncu1.z2 + '=' + m.sonuc.oyuncu1.toplam + '</div>'
      + '<div>' + escHtml(m.sonuc.oyuncu2.ad || '#2') + ': ' + m.sonuc.oyuncu2.z1 + '+' + m.sonuc.oyuncu2.z2 + '=' + m.sonuc.oyuncu2.toplam + '</div></div>';
  }

  html += '<div id="kmPvpSonuc" class="km-mini-sonuc"></div></div>';
  return html;
}

function kumarhaneBarbutSoloHTML() {
  return kumarhaneOyunMasaHTML('barbut',
    '<div class="km-barbut-masa-ic km-el-panel">'
    + '<div class="km-barbut-zarlar">' + kumarhaneZarKutuHTML('kmBarbutZ1', 1) + kumarhaneZarKutuHTML('kmBarbutZ2', 2) + '</div>'
    + '<div class="km-barbut-toplam" id="kmBarbutToplam"></div></div>'
  )
    + '<p class="km-ipucu">' + escHtml(t('game.kumarhane.crapsHint')) + '</p>'
    + '<div class="km-bahis-satir">' + escHtml(t('game.kumarhane.bet')) + ' ' + kumarhaneBahisInput('kmBahis_barbut', 100) + '</div>'
    + '<div class="km-barbut-grid">'
    + '<button type="button" class="km-barbut-btn" onclick="kumarhaneBarbutOyna(\'pas\')"><b>' + escHtml(t('game.kumarhane.crapsPass')) + '</b><span>7 / 11 · 2.2x</span></button>'
    + '<button type="button" class="km-barbut-btn" onclick="kumarhaneBarbutOyna(\'yedi\')"><b>' + escHtml(t('game.kumarhane.crapsSeven')) + '</b><span>5x</span></button>'
    + '<button type="button" class="km-barbut-btn" onclick="kumarhaneBarbutOyna(\'cift\')"><b>' + escHtml(t('game.kumarhane.crapsDoubles')) + '</b><span>6x</span></button>'
    + '<button type="button" class="km-barbut-btn" onclick="kumarhaneBarbutOyna(\'onbir\')"><b>' + escHtml(t('game.kumarhane.crapsEleven')) + '</b><span>6x</span></button>'
    + '</div><div id="kmBarbutSonuc" class="km-mini-sonuc"></div>';
}

function kumarhaneBarbutHTML() {
  var mod = kumarhaneOyunModu.barbut || 'solo';
  return '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>🎲 ' + escHtml(t('game.kumarhane.craps')) + '</h3></div>'
    + '<div class="km-oyun-sahne km-oyun-sahne--barbut">' + kumarhaneModSekmeHTML('barbut')
    + (mod === 'pvp' ? '<p class="km-ipucu">' + escHtml(t('game.kumarhane.pvpHint')) + '</p>' + kumarhanePvpMasaHTML('barbut') : kumarhaneBarbutSoloHTML())
    + '</div>';
}

function kumarhaneRusRevolverHTML(silindirId, pvp, icMasa) {
  var sid = silindirId || 'kmRusSilindir';
  var yuvalar = '';
  for (var i = 1; i <= 6; i++) {
    yuvalar += '<g class="km-rus-yuva" data-yuva="' + i + '" transform="rotate(' + ((i - 1) * 60) + ') translate(0,-38)">'
      + '<circle class="km-rus-delik" r="9.5"/>'
      + '<circle class="km-rus-mermi gizli" r="4.2"/>'
      + '</g>';
  }
  var rev = '<div class="km-revolver-wrap' + (pvp ? ' km-revolver-wrap--pvp' : '') + '">'
    + '<div class="km-revolver-sahne" id="kmRevolverSahne">'
    + '<div class="km-revolver" id="kmRevolver">'
    + '<svg class="km-revolver-svg" viewBox="0 0 420 240" aria-hidden="true">'
    + '<defs>'
    + '<linearGradient id="kmRusMetal" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#b8b8c4"/><stop offset="45%" stop-color="#686878"/><stop offset="100%" stop-color="#303038"/></linearGradient>'
    + '<linearGradient id="kmRusKabza" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6a4830"/><stop offset="100%" stop-color="#241610"/></linearGradient>'
    + '<radialGradient id="kmRusDelik"><stop offset="0%" stop-color="#050508"/><stop offset="100%" stop-color="#12121a"/></radialGradient>'
    + '<radialGradient id="kmRusFlash"><stop offset="0%" stop-color="#fff8c0"/><stop offset="40%" stop-color="#ff9040"/><stop offset="100%" stop-color="transparent"/></radialGradient>'
    + '</defs>'
    + '<g class="km-rus-govde">'
    + '<path class="km-rus-kabza" d="M28 148 C20 148 12 168 12 196 C12 218 24 228 38 228 L58 228 C68 218 72 198 68 176 L58 148 Z" fill="url(#kmRusKabza)"/>'
    + '<rect class="km-rus-kabza-desen" x="22" y="162" width="40" height="52" rx="6" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>'
    + '<rect x="58" y="118" width="72" height="54" rx="8" fill="url(#kmRusMetal)" stroke="#888" stroke-width="1.5"/>'
    + '<rect x="118" y="126" width="168" height="28" rx="4" fill="url(#kmRusMetal)" stroke="#999" stroke-width="1.2"/>'
    + '<circle cx="286" cy="140" r="6" fill="#080810" stroke="#555"/>'
    + '<line x1="136" y1="140" x2="268" y2="140" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>'
    + '<circle cx="118" cy="145" r="58" fill="url(#kmRusMetal)" stroke="#a8a8b4" stroke-width="4"/>'
    + '<g transform="translate(118,145)"><g id="' + sid + '" class="km-rus-silindir">' + yuvalar + '</g></g>'
    + '<circle cx="118" cy="145" r="14" fill="#555" stroke="#888" stroke-width="2"/>'
    + '<g class="km-rus-nisangah"><path d="M118 78 L124 92 L112 92 Z" fill="#ffd76a" opacity="0.85"/></g>'
    + '<g id="kmRevolverCekirdek" class="km-rus-cekirdek"><rect x="108" y="88" width="20" height="28" rx="4" fill="#999" stroke="#666"/></g>'
    + '<g id="kmRevolverCekic" class="km-rus-cekic"><rect x="112" y="72" width="12" height="20" rx="3" fill="#888" stroke="#555"/></g>'
    + '<path class="km-rus-tetik-koruyucu" d="M52 168 Q52 198 72 198 L88 198 Q96 188 96 172 L96 158 Q88 150 72 150 Q58 150 52 168 Z" fill="none" stroke="#777" stroke-width="3"/>'
    + '<g id="kmRevolverTetik" class="km-rus-tetik"><rect x="68" y="168" width="14" height="26" rx="5" fill="#aaa" stroke="#666"/></g>'
    + '</g>'
    + '<g class="km-revolver-flash"><circle cx="292" cy="140" r="36" fill="url(#kmRusFlash)"/></g>'
    + '<g class="km-revolver-duman"><ellipse cx="300" cy="132" rx="28" ry="20" fill="rgba(180,180,180,0.45)"/></g>'
    + '</svg>'
    + '<div class="km-revolver-vinyet"></div>'
    + '</div>'
    + '<div class="km-revolver-durum" id="kmRusDurum"></div>'
    + '</div>';
  if (icMasa) return rev;
  return '<div class="km-rus-sahne' + (pvp ? ' km-rus-sahne--pvp' : '') + '" id="kmRusSahne">'
    + kumarhaneOyunMasaHTML('rus_ruleti', rev)
    + '</div>';
}

function kumarhaneRusSoloHTML() {
  return kumarhaneRusRevolverHTML('kmRusSilindir')
    + '<p class="km-ipucu">' + escHtml(t('game.kumarhane.russianHint')) + '</p>'
    + '<div class="km-bahis-satir">' + escHtml(t('game.kumarhane.bet')) + ' ' + kumarhaneBahisInput('kmBahis_rus_ruleti', 200) + '</div>'
    + '<button type="button" class="km-btn km-btn--kirmizi km-rus-tetik" id="kmRusTetik" onclick="kumarhaneRusRuletiOyna()">💀 ' + escHtml(t('game.kumarhane.russianPull')) + '</button>'
    + '<div id="kmRusSonuc" class="km-mini-sonuc"></div>';
}

function kumarhaneRusRuletiHTML() {
  var mod = kumarhaneOyunModu.rus_ruleti || 'solo';
  return '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>🔫 ' + escHtml(t('game.kumarhane.russianRoulette')) + '</h3></div>'
    + '<div class="km-oyun-sahne km-oyun-sahne--rus">' + kumarhaneModSekmeHTML('rus_ruleti')
    + (mod === 'pvp' ? '<p class="km-ipucu">' + escHtml(t('game.kumarhane.pvpHint')) + '</p>' + kumarhanePvpMasaHTML('rus_ruleti') : kumarhaneRusSoloHTML())
    + '</div>';
}

function kumarhaneSlotMakaraHTML(sembol, donuyor) {
  var html = '<div class="km-slot-makara">';
  html += '<div class="km-slot-makara-pencere">';
  if (donuyor) {
    html += '<div class="km-slot-makara-ic km-slot-makara-ic--donuyor">';
    for (var i = 0; i < 15; i++) {
      html += '<div class="km-slot-sembol">' + kumarhaneSlotRastgeleSembol() + '</div>';
    }
    html += '</div>';
  } else {
    var orta = sembol || '🍒';
    html += '<div class="km-slot-makara-ic km-slot-makara-ic--durdu">'
      + '<div class="km-slot-sembol km-slot-sembol--ust">' + kumarhaneSlotRastgeleSembol() + '</div>'
      + '<div class="km-slot-sembol km-slot-sembol--orta">' + orta + '</div>'
      + '<div class="km-slot-sembol km-slot-sembol--alt">' + kumarhaneSlotRastgeleSembol() + '</div>'
      + '</div>';
  }
  html += '</div></div>';
  return html;
}

function kumarhaneSlotMakaralarHTML(semboller, spinMask) {
  var defaults = ['🍒', '🍋', '🔔'];
  var html = '';
  for (var i = 0; i < 3; i++) {
    var donuyor = spinMask ? !!spinMask[i] : false;
    html += kumarhaneSlotMakaraHTML((semboller && semboller[i]) || defaults[i], donuyor);
  }
  return html;
}

function kumarhanePokerHTML() {
  return '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>♠️ ' + escHtml(t('game.kumarhane.threeCard')) + '</h3></div>'
    + '<div class="km-oyun-sahne km-oyun-sahne--kart">'
    + kumarhaneOyunMasaHTML('uc_kart_poker',
      '<div id="kmPokerKartlar" class="km-poker-karsilastir km-poker-karsilastir--bos km-el-panel"><div class="km-poker-bekle">' + escHtml(t('game.kumarhane.deal')) + '…</div></div>'
    )
    + '<p class="km-ipucu">' + escHtml(t('game.kumarhane.pokerHint')) + '</p>'
    + '<div class="km-bahis-satir">' + escHtml(t('game.kumarhane.bet')) + ' ' + kumarhaneBahisInput('kmBahis_uc_kart_poker', 150)
    + '<button type="button" class="km-btn km-btn--yesil" onclick="kumarhaneBaslat(\'uc_kart_poker\')">' + escHtml(t('game.kumarhane.deal')) + '</button></div>'
    + '<div id="kmPokerSonuc" class="km-mini-sonuc"></div>'
    + '</div>';
}

function kumarhaneSlotHTML() {
  return '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>🎰 Slot</h3></div>'
    + '<div class="km-oyun-sahne km-oyun-sahne--slot">' + kumarhaneOyunKapakHTML('slot', 'Slot', true)
    + '<div class="km-slot-makine" id="kmSlotMakine">'
    + '<div class="km-slot-kabin-ust"><span class="km-slot-neon">★ JACKPOT ★</span></div>'
    + '<div class="km-slot-led-satir"><span></span><span></span><span></span><span></span><span></span></div>'
    + '<div class="km-slot-ekran">'
    + '<div class="km-slot-payline-etiket">— PAYLINE —</div>'
    + '<div class="km-slot-payline-cizgi km-slot-payline-cizgi--sol"></div>'
    + '<div class="km-slot-payline-cizgi km-slot-payline-cizgi--sag"></div>'
    + '<div class="km-slot-makaralar" id="kmSlotMakaralar">' + kumarhaneSlotMakaralarHTML(['🍒', '🍋', '🔔'], [false, false, false]) + '</div>'
    + '</div>'
    + '<div class="km-slot-kabin-alt">'
    + '<div class="km-slot-kontrol">'
    + '<label class="km-slot-bahis-etiket" for="kmBahis_slot">' + escHtml(t('game.kumarhane.bet')) + '</label>'
    + kumarhaneBahisInput('kmBahis_slot', 100)
    + '<button type="button" class="km-btn km-btn--yesil km-slot-cevir-btn" id="kmSlotBtn" onclick="kumarhaneBaslat(\'slot\')">' + escHtml(t('game.kumarhane.spin')) + '</button>'
    + '</div>'
    + '<div class="km-slot-kol-montaj" id="kmSlotKolMontaj">'
    + '<button type="button" class="km-slot-kol" id="kmSlotKol" aria-label="' + escHtml(t('game.kumarhane.spin')) + '">'
    + '<span class="km-slot-kol-mil" aria-hidden="true"></span>'
    + '<span class="km-slot-kol-top" aria-hidden="true"></span>'
    + '</button>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

function kumarhaneSlotKolBagla() {
  var kol = document.getElementById('kmSlotKol');
  if (!kol || kol.getAttribute('data-bound') === '1') return;
  kol.setAttribute('data-bound', '1');

  var MAX_PULL = 78;
  var THRESHOLD = 44;
  var pulling = false;
  var startY = 0;
  var pullAmount = 0;
  var maxMoved = 0;

  function setPull(px) {
    pullAmount = Math.max(0, Math.min(MAX_PULL, px));
    var aci = (pullAmount / MAX_PULL) * 46;
    kol.style.setProperty('--kol-acisi', String(aci));
    kol.classList.toggle('km-slot-kol--hazir', pullAmount >= THRESHOLD);
  }

  function resetPull() {
    kol.classList.remove('km-slot-kol--hazir', 'km-slot-kol--surukleniyor', 'km-slot-kol--cekilmiş');
    kol.style.setProperty('--kol-acisi', '0');
    pullAmount = 0;
    maxMoved = 0;
  }

  function triggerSpin() {
    if (kumarhaneAnimasyon || kol.disabled) return;
    kol.classList.add('km-slot-kol--cekilmiş');
    kumarhaneBaslat('slot');
    setTimeout(function() {
      if (!kumarhaneAnimasyon) resetPull();
    }, 520);
  }

  function pointerY(e) {
    if (e.touches && e.touches.length) return e.touches[0].clientY;
    return e.clientY;
  }

  kol.addEventListener('pointerdown', function(e) {
    if (kumarhaneAnimasyon || kol.disabled) return;
    pulling = true;
    startY = pointerY(e);
    maxMoved = 0;
    kol.classList.add('km-slot-kol--surukleniyor');
    if (kol.setPointerCapture) kol.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  kol.addEventListener('pointermove', function(e) {
    if (!pulling) return;
    var dy = pointerY(e) - startY;
    if (dy > 0) maxMoved = Math.max(maxMoved, dy);
    setPull(Math.max(0, dy));
  });

  function pointerEnd(e) {
    if (!pulling) return;
    pulling = false;
    kol.classList.remove('km-slot-kol--surukleniyor');
    if (kol.releasePointerCapture && e.pointerId != null) {
      try { kol.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (pullAmount >= THRESHOLD || maxMoved < 8) {
      triggerSpin();
    } else {
      resetPull();
    }
  }

  kol.addEventListener('pointerup', pointerEnd);
  kol.addEventListener('pointercancel', pointerEnd);
}

function kumarhanePistHTML(yaris, kosuyor, kazananNo) {
  var html = '<div class="km-pist"><div class="km-pist-cizgi"></div>';
  (yaris.atlar || []).forEach(function(at) {
    var cls = 'km-pist-satir';
    if (kosuyor) cls += ' km-pist-satir--kosuyor';
    if (kazananNo === at.no) cls += ' km-pist-satir--kazanan';
    var pos = 0;
    if (kosuyor) {
      pos = Math.min(88, at._pos || 0);
    } else if (kazananNo) {
      pos = kazananNo === at.no ? 88 : Math.min(78, at._pos != null ? at._pos : 28 + (at.no * 11) % 42);
    }
    html += '<div class="' + cls + '" data-at="' + at.no + '">'
      + '<span class="km-pist-no">#' + at.no + '</span>'
      + '<div class="km-pist-yol"><span class="km-pist-bitis" aria-hidden="true"></span>'
      + '<span class="km-pist-at" style="left:' + pos + '%">🐎</span></div>'
      + '<span class="km-pist-ad">' + escHtml(at.ad) + ' · ' + at.oran + 'x</span></div>';
  });
  html += '</div>';
  return html;
}

function kumarhaneAtHTML() {
  var yaris = kumarhanePanelVeri.yaris || {};
  var html = '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>🐎 ' + escHtml(t('game.kumarhane.horseRace')) + '</h3></div>';
  html += '<div class="km-oyun-sahne">' + kumarhaneOyunKapakHTML('at_yarisi', t('game.kumarhane.horseRace'), true);
  html += '<p class="km-ipucu">' + escHtml(t('game.kumarhane.horseHint', { sn: yaris.kalanSn || 0 })) + '</p>';
  html += '<div id="kmPistWrap">' + kumarhanePistHTML(yaris, false, null) + '</div>';
  html += '<div class="km-at-liste">';
  (yaris.atlar || []).forEach(function(at) {
    html += '<div class="km-at-satir" id="kmAtSatir_' + at.no + '"><span>#' + at.no + ' ' + escHtml(at.ad) + '</span><span>' + at.oran + 'x</span>'
      + '<button type="button" class="km-btn km-btn--kucuk" onclick="kumarhaneAtOyna(' + at.no + ')">' + escHtml(t('game.kumarhane.bet')) + '</button></div>';
  });
  html += '</div><div class="km-bahis-satir">' + escHtml(t('game.kumarhane.bet')) + ' ' + kumarhaneBahisInput('kmBahis_at_yarisi', 200) + '</div>';
  html += '<div id="kmAtSonuc" class="km-mini-sonuc"></div></div>';
  return html;
}

var KM_FF_PARMak_YUKSEK = { 1: 58, 2: 72, 3: 82, 4: 70, 5: 62 };

function kumarhaneFingerHTML() {
  var g = (kumarhanePanelVeri.aktifOyun && kumarhanePanelVeri.aktifOyun.oyunId === 'five_finger') ? kumarhanePanelVeri.aktifOyun.gorunum : null;
  var html = '<div class="km-oyun-ust"><button type="button" class="km-geri-btn" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button><h3>🔪 Five Finger Fillet</h3></div>';
  html += '<div class="km-oyun-sahne km-oyun-sahne--ff">' + kumarhaneOyunKapakHTML('five_finger', 'Five Finger Fillet', true);
  if (g) {
    html += kumarhaneFeltMasaHTML(
      '<div class="km-ff-ust">'
      + '<div class="km-carpan-rozet">×' + g.carpan + '</div>'
      + '<div class="km-ff-tur">' + escHtml(t('game.kumarhane.ffRound', { tur: g.tur, total: g.toplamTur, mult: g.carpan })) + '</div>'
      + '</div>'
      + '<div class="km-ff-masa" id="kmFfMasa">'
      + '<div class="km-ff-iz" id="kmFfIz" aria-hidden="true"></div>'
      + '<div class="km-ff-kan" id="kmFfKan" aria-hidden="true"></div>'
      + '<div class="km-ff-bicak-wrap" id="kmFfBicakWrap">'
      + '<div class="km-ff-bicak" id="kmFfBicak" aria-hidden="true">'
      + '<span class="km-ff-bicak-sap"></span>'
      + '<span class="km-ff-bicak-bicim"></span>'
      + '<span class="km-ff-bicak-namlu"></span>'
      + '<span class="km-ff-bicak-uc"></span>'
      + '</div></div>'
      + '<div class="km-ff-el-wrap">'
      + '<div class="km-ff-bilek"></div>'
      + '<div class="km-ff-avuc"></div>'
      + '<div class="km-el-gorsel" id="kmElGorsel">',
      'ahsap'
    );
    for (var i = 1; i <= 5; i++) {
      html += '<button type="button" class="km-parmak-slot" data-parmak="' + i + '" style="--parmak-yuk:' + (KM_FF_PARMak_YUKSEK[i] || 70) + 'px" onclick="kumarhaneParmak(' + i + ')">'
        + '<span class="km-parmak-ust"></span>'
        + '<span class="km-parmak-eklem"></span>'
        + '<span class="km-parmak-tirnak"></span>'
        + '<span class="km-parmak-no">' + i + '</span></button>';
    }
    html += '</div></div></div></div></div>';
  } else {
    html += '<p class="km-ipucu">' + escHtml(t('game.kumarhane.ffHint')) + '</p>'
      + kumarhaneFeltMasaHTML('<div class="km-ff-onizleme"><div class="km-ff-bicak-wrap km-ff-bicak-wrap--onizleme"><div class="km-ff-bicak km-ff-bicak--durus"><span class="km-ff-bicak-sap"></span><span class="km-ff-bicak-bicim"></span><span class="km-ff-bicak-namlu"></span><span class="km-ff-bicak-uc"></span></div></div><div class="km-ff-onizleme-el"></div></div>', 'ahsap')
      + '<div class="km-bahis-satir">' + escHtml(t('game.kumarhane.bet')) + ' ' + kumarhaneBahisInput('kmBahis_five_finger', 100)
      + '<button type="button" class="km-btn km-btn--yesil" onclick="kumarhaneBaslat(\'five_finger\')">' + escHtml(t('game.kumarhane.start')) + '</button></div>';
  }
  html += '</div>';
  return html;
}

function kumarhanePiyangoSureFormat(ms) {
  var sn = Math.max(0, Math.floor((ms || 0) / 1000));
  var dk = Math.floor(sn / 60);
  var s = sn % 60;
  if (dk >= 60) {
    var sa = Math.floor(dk / 60);
    dk = dk % 60;
    return sa + 's ' + dk + 'dk';
  }
  return dk + 'dk ' + s + 'sn';
}

function kumarhanePiyangoTopHTML(n, ek) {
  var cls = 'km-py-top' + (ek ? ' ' + ek : '');
  return '<span class="' + cls + '"><span class="km-py-top-isik"></span><span class="km-py-top-rakam">' + n + '</span></span>';
}

function kumarhanePiyangoSeciliSeritGuncelle() {
  var serit = document.getElementById('kmPiyangoSeciliSerit');
  if (!serit) return;
  var p = kumarhanePanelVeri && kumarhanePanelVeri.piyango;
  var slots = (p && p.secimSayisi) || 6;
  var html = '';
  for (var i = 0; i < slots; i++) {
    var n = kumarhanePiyangoSecili[i];
    if (n) html += kumarhanePiyangoTopHTML(n, 'km-py-top--dolu km-py-top--secim');
    else html += '<span class="km-py-top km-py-top--bos"><span class="km-py-top-rakam">?</span></span>';
  }
  serit.innerHTML = html;
  var sayac = document.getElementById('kmPiyangoSecimSayac');
  if (sayac) {
    sayac.textContent = kumarhanePiyangoSecili.length + ' / ' + slots;
  }
}

function kumarhanePiyangoSayiToggle(n) {
  var idx = kumarhanePiyangoSecili.indexOf(n);
  if (idx >= 0) {
    kumarhanePiyangoSecili.splice(idx, 1);
  } else {
    var p = kumarhanePanelVeri && kumarhanePanelVeri.piyango;
    var max = (p && p.secimSayisi) || 6;
    if (kumarhanePiyangoSecili.length >= max) {
      toast(t('game.kumarhane.lotteryMaxPick', { n: max }), 'hata');
      return;
    }
    kumarhanePiyangoSecili.push(n);
    kumarhanePiyangoSecili.sort(function(a, b) { return a - b; });
  }
  kumarhanePiyangoSayiGridGuncelle();
}

function kumarhanePiyangoSayiGridGuncelle() {
  var grid = document.getElementById('kmPiyangoGrid');
  if (!grid) return;
  grid.querySelectorAll('.km-piyango-sayi').forEach(function(btn) {
    var n = parseInt(btn.getAttribute('data-sayi'), 10);
    btn.classList.toggle('km-piyango-sayi--secili', kumarhanePiyangoSecili.indexOf(n) >= 0);
  });
  kumarhanePiyangoSeciliSeritGuncelle();
}

function kumarhanePiyangoBiletKartHTML(b) {
  var html = '<article class="km-py-bilet-kart">';
  html += '<div class="km-py-bilet-ust"><span class="km-py-bilet-etiket">' + escHtml(t('game.kumarhane.lotteryTitle')) + '</span>';
  if (b.ucretsiz && b.eslesme == null) {
    html += '<span class="km-py-bilet-rozet">' + escHtml(t('game.kumarhane.lotteryFreeUsed')) + '</span>';
  }
  html += '</div><div class="km-py-bilet-toplar">';
  (b.sayilar || []).forEach(function(n) {
    var topCls = 'km-py-top--mini';
    if (b.eslesme != null && b.eslesme >= 6) topCls += ' km-py-top--kazanc';
    html += kumarhanePiyangoTopHTML(n, topCls);
  });
  html += '</div>';
  if (b.eslesme != null) {
    html += '<div class="km-py-bilet-sonuc">';
    html += escHtml(t('game.kumarhane.lotteryMatch', { n: b.eslesme }));
    if (b.odul > 0) html += ' · <strong>+' + fmt(b.odul) + '</strong>';
    if (b.teselliHak > 0) {
      html += ' · ' + escHtml(t('game.kumarhane.lotteryConsolation', { n: b.teselliHak }));
    }
    html += '</div>';
  }
  html += '</article>';
  return html;
}

function kumarhanePiyangoHTML() {
  var p = (kumarhanePanelVeri && kumarhanePanelVeri.piyango) || {};
  var maxSayi = p.sayiMax || 25;
  var secim = p.secimSayisi || 6;
  var html = '<div class="km-oyun-sahne km-oyun-sahne--piyango">'
    + '<button type="button" class="km-geri-btn km-py-geri" onclick="kumarhaneLobiDon()">← ' + escHtml(t('game.kumarhane.back')) + '</button>'
    + '<div class="km-py-sahne">'
    + '<div class="km-py-banner">' + kumarhaneOyunKapakHTML('piyango', t('game.kumarhane.lotteryTitle'), false) + '</div>'
    + '<div class="km-py-hero">'
    + '<div class="km-py-neon-cerceve" aria-hidden="true"><span class="km-py-neon-yazi">PIYANGO</span></div>'
    + '<p class="km-py-alt">' + escHtml(t('game.kumarhane.lotteryDesc', { pick: secim, max: maxSayi })) + '</p>'
    + '<div class="km-py-program-rozet"><span class="km-py-program-ikon" aria-hidden="true">🕗</span>'
    + escHtml(p.cekilisProgram || t('game.kumarhane.lotterySchedule')) + '</div>'
    + '</div>'
    + '<div class="km-py-jackpot-satir">'
    + '<div class="km-py-jackpot">'
    + '<span class="km-py-jackpot-etiket">' + escHtml(t('game.kumarhane.lotteryPrize')) + '</span>'
    + '<div class="km-py-jackpot-tutar">' + fmt(p.buyukOdul || 0) + '<small>çip</small></div>'
    + '</div>'
    + '<div class="km-py-sayac-kutu">'
    + '<span class="km-py-sayac-etiket">' + escHtml(t('game.kumarhane.lotteryDrawIn')) + '</span>'
    + '<div class="km-py-sayac-deger" id="kmPiyangoKalan">' + escHtml(kumarhanePiyangoSureFormat(p.kalanMs)) + '</div>'
  + '<div class="km-py-sayac-cizgi" aria-hidden="true"></div>'
    + '</div></div>'
    + '<div class="km-py-istatistik">'
    + '<div class="km-py-stat"><span>' + escHtml(t('game.kumarhane.lotteryTicket')) + '</span><strong>' + fmt(p.biletUcret || 100000) + '</strong></div>'
    + '<div class="km-py-stat"><span>' + escHtml(t('game.kumarhane.lotteryTicketCount')) + '</span><strong>' + fmt(p.toplamBilet || 0) + '</strong></div>';
  if (p.biletHak > 0) {
    html += '<div class="km-py-stat km-py-stat--hak"><span>' + escHtml(t('game.kumarhane.lotteryFreeTickets')) + '</span><strong>' + fmt(p.biletHak) + '</strong></div>';
  }
  html += '</div>'
    + '<div class="km-py-makine">'
    + '<div class="km-py-makine-baslik">'
    + '<span>' + escHtml(t('game.kumarhane.lotteryYourPick')) + '</span>'
    + '<span class="km-py-secim-sayac" id="kmPiyangoSecimSayac">0 / ' + secim + '</span>'
    + '</div>'
    + '<div class="km-py-secili-serit" id="kmPiyangoSeciliSerit">';
  for (var s = 0; s < secim; s++) {
    html += '<span class="km-py-top km-py-top--bos"><span class="km-py-top-rakam">?</span></span>';
  }
  html += '</div>'
    + '<div class="km-py-tambur-etiket">6 / ' + maxSayi + '</div>'
    + '<div class="km-piyango-grid" id="kmPiyangoGrid">';
  for (var i = 1; i <= maxSayi; i++) {
    html += '<button type="button" class="km-piyango-sayi" data-sayi="' + i + '" onclick="kumarhanePiyangoSayiToggle(' + i + ')">'
      + '<span class="km-py-top km-py-top--grid"><span class="km-py-top-isik"></span><span class="km-py-top-rakam">' + i + '</span></span>'
      + '</button>';
  }
  html += '</div></div>'
    + '<div class="km-py-aksiyon">'
    + '<button type="button" class="km-btn km-btn--yesil km-py-btn-al" onclick="kumarhanePiyangoBiletAl()">'
    + '<span class="km-py-btn-ikon" aria-hidden="true">🎟️</span> ' + escHtml(t('game.kumarhane.lotteryBuy')) + '</button>'
    + '<button type="button" class="km-btn km-py-btn-temiz" onclick="kumarhanePiyangoTemizle()">' + escHtml(t('game.kumarhane.lotteryClear')) + '</button>'
    + '</div>';

  if ((p.benimBiletler || []).length) {
    html += '<div class="km-py-bolum"><h4 class="km-py-bolum-baslik">' + escHtml(t('game.kumarhane.lotteryMyTickets')) + '</h4>'
      + '<div class="km-py-bilet-liste">';
    p.benimBiletler.forEach(function(b) {
      html += kumarhanePiyangoBiletKartHTML(b);
    });
    html += '</div></div>';
  }

  if (p.sonCekilis && (p.sonCekilis.sayilar || []).length) {
    html += '<div class="km-py-bolum km-py-bolum--son">'
      + '<h4 class="km-py-bolum-baslik">' + escHtml(t('game.kumarhane.lotteryLastDraw')) + '</h4>'
      + '<div class="km-py-son-tambur">';
    (p.sonCekilis.sayilar || []).forEach(function(n, idx) {
      var ek = idx >= (p.sonCekilis.sayilar.length - 3) ? ' km-py-top--son3' : '';
      html += kumarhanePiyangoTopHTML(n, 'km-py-top--cekilis' + ek);
    });
    html += '</div>';
    if ((p.sonCekilis.kazananlar || []).length) {
      html += '<ul class="km-py-kazanan-liste">';
      p.sonCekilis.kazananlar.forEach(function(k) {
        html += '<li><span class="km-py-kazanan-ad">' + escHtml(k.reisAdi) + '</span>'
          + '<span class="km-py-kazanan-detay">' + escHtml(t('game.kumarhane.lotteryMatch', { n: k.eslesme }));
        if (k.odul > 0) html += ' · +' + fmt(k.odul);
        if (k.teselliHak > 0) html += ' · ' + escHtml(t('game.kumarhane.lotteryConsolation', { n: k.teselliHak }));
        html += '</span></li>';
      });
      html += '</ul>';
    } else {
      html += '<p class="km-py-bos-sonuc">' + escHtml(t('game.kumarhane.lotteryNoWinner')) + '</p>';
    }
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

function kumarhanePiyangoTemizle() {
  kumarhanePiyangoSecili = [];
  kumarhanePiyangoSayiGridGuncelle();
}

async function kumarhanePiyangoBiletAl() {
  var p = kumarhanePanelVeri && kumarhanePanelVeri.piyango;
  var need = (p && p.secimSayisi) || 6;
  if (kumarhanePiyangoSecili.length !== need) {
    toast(t('game.kumarhane.lotteryNeedPick', { n: need }), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('kumarhane_piyango_bilet', null, null, { sayilar: kumarhanePiyangoSecili.slice() });
  if (!ef) return;
  if (ef.chip != null && kumarhanePanelVeri) kumarhanePanelVeri.chip = ef.chip;
  if (ef.piyango && kumarhanePanelVeri) kumarhanePanelVeri.piyango = ef.piyango;
  kumarhanePiyangoSecili = [];
  kumarhaneOzetGuncelle();
  kumarhaneChipPulse();
  kumarhaneSes('chip');
  if (ef.mesaj) {
    kumarhaneSonucGoster(escHtml(ef.mesaj), 'ok');
    toast(ef.mesaj, 'ok');
  }
  kumarhaneIcerikCiz();
  if (kumarhaneAktifOyun === 'piyango') kumarhanePiyangoSayiGridGuncelle();
}

function kumarhanePiyangoSayacBaslat() {
  if (window._kmPiyangoTimer) clearInterval(window._kmPiyangoTimer);
  if (!kumarhanePanelVeri || !kumarhanePanelVeri.piyango) return;
  var bitis = Date.now() + (kumarhanePanelVeri.piyango.kalanMs || 0);
  window._kmPiyangoTimer = setInterval(function() {
    var el = document.getElementById('kmPiyangoKalan');
    if (!el) {
      clearInterval(window._kmPiyangoTimer);
      return;
    }
    var kalan = Math.max(0, bitis - Date.now());
    el.textContent = kumarhanePiyangoSureFormat(kalan);
    if (kalan <= 0) {
      clearInterval(window._kmPiyangoTimer);
      kumarhanePanelYukle(true);
    }
  }, 1000);
}

function kumarhaneOyunIcerikHTML(oyunId) {
  if (oyunId === 'blackjack') return kumarhaneBlackjackHTML();
  if (oyunId === 'rulet') return kumarhaneRuletHTML();
  if (oyunId === 'barbut') return kumarhaneBarbutHTML();
  if (oyunId === 'rus_ruleti') return kumarhaneRusRuletiHTML();
  if (oyunId === 'uc_kart_poker') return kumarhanePokerHTML();
  if (oyunId === 'slot') return kumarhaneSlotHTML();
  if (oyunId === 'at_yarisi') return kumarhaneAtHTML();
  if (oyunId === 'five_finger') return kumarhaneFingerHTML();
  if (oyunId === 'piyango') return kumarhanePiyangoHTML();
  return '<p>' + escHtml(t('game.error.loadFailed')) + '</p>';
}

function kumarhaneIcerikCiz() {
  var govde = document.getElementById('kumarhaneIcerik');
  if (!govde) return;
  if (!kumarhaneAktifOyun) {
    govde.innerHTML = kumarhaneLobiHTML();
    return;
  }
  govde.innerHTML = kumarhaneOyunIcerikHTML(kumarhaneAktifOyun);
  if (kumarhaneAktifOyun === 'rulet') kumarhaneRuletTabloHazirla();
  if (kumarhaneAktifOyun === 'slot') kumarhaneSlotKolBagla();
  if (kumarhaneAktifOyun === 'piyango') {
    kumarhanePiyangoSayiGridGuncelle();
    kumarhanePiyangoSayacBaslat();
  }
}

function kumarhanePanelHTML() {
  return '<div class="km-sayfa"><div class="km-cerceve">'
    + '<div class="km-fx-katman gizli" id="kumarhaneFxKatman"><div class="km-fx-yazi" id="kumarhaneFxYazi"></div></div>'
    + '<header class="km-banner"><div class="km-banner-neon"></div>'
    + '<h2>🎰 ' + escHtml(t('screen.kumarhane')) + '</h2>'
    + '<p class="km-banner-alt">' + escHtml(t('game.kumarhane.subtitle')) + '</p>'
    + '</header>'
    + '<div class="km-ozet-satir">'
    + '<div class="km-ozet-kutu"><div class="km-ozet-etiket">' + escHtml(t('game.kumarhane.cash')) + '</div><div class="km-ozet-deger" id="kmKasaGoster">—</div></div>'
    + '<div class="km-ozet-kutu km-ozet-kutu--chip"><div class="km-ozet-etiket">' + escHtml(t('game.kumarhane.chips')) + '</div><div class="km-ozet-deger km-ozet-deger--altin" id="kmChipGoster">—</div></div>'
    + '</div>'
    + '<div id="kumarhaneIcerik"></div>'
    + '<div id="kumarhaneSonuc" class="km-sonuc gizli"></div>'
    + '</div></div>';
}

async function kumarhanePanelYukle(sessiz) {
  var oncekiAktif = kumarhanePanelVeri && kumarhanePanelVeri.aktifOyun;
  try {
    var res = await apiFetch('/api/kumarhane/panel');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || t('game.error.loadFailed'));
    kumarhanePanelVeri = data;
    if (data.aktifOyun && data.aktifOyun.oyunId) {
      kumarhaneAktifOyun = data.aktifOyun.oyunId;
    } else if (!data.aktifOyun && oncekiAktif && oncekiAktif.gorunum) {
      kumarhanePanelVeri.aktifOyun = oncekiAktif;
    }
    kumarhaneOzetGuncelle();
    kumarhaneIcerikCiz();
  } catch (e) {
    if (oncekiAktif && oncekiAktif.gorunum) {
      if (!kumarhanePanelVeri) kumarhanePanelVeri = {};
      kumarhanePanelVeri.aktifOyun = oncekiAktif;
      kumarhaneAktifOyun = oncekiAktif.oyunId;
      kumarhaneIcerikCiz();
    }
    if (!sessiz) kumarhaneSonucGoster(escHtml(e.message || t('game.error.loadFailed')), 'hata');
  }
}

function kumarhaneEkranBagla() {
  kumarhaneAktifOyun = null;
  kumarhanePanelYukle();
}

function kumarhaneEkranAc(ic) {
  ic.innerHTML = kumarhanePanelHTML();
  kumarhaneEkranBagla();
}

function kumarhaneLobiDon() {
  if (kumarhaneAnimasyon) return;
  kumarhaneMasaPollDurdur();
  if (kumarhaneMasaVeri) kumarhaneMasaAyril(true);
  kumarhaneAktifOyun = null;
  kumarhanePanelYukle(true);
}

function kumarhaneOyunAc(oyunId) {
  if (kumarhaneAnimasyon) return;
  if (oyunId === 'piyango') kumarhanePiyangoSecili = [];
  if (kumarhanePanelVeri && kumarhanePanelVeri.aktifOyun && kumarhanePanelVeri.aktifOyun.oyunId) {
    kumarhaneAktifOyun = kumarhanePanelVeri.aktifOyun.oyunId;
  } else {
    kumarhaneAktifOyun = oyunId;
  }
  kumarhaneIcerikCiz();
  if ((oyunId === 'barbut' || oyunId === 'rus_ruleti') && kumarhaneOyunModu[oyunId] === 'pvp') {
    kumarhaneMasaKatil(oyunId);
  }
  kumarhaneSes('chip');
}

function kumarhaneBahisOku(oyunId) {
  var el = document.getElementById('kmBahis_' + oyunId);
  return el ? parseInt(el.value, 10) || 0 : 0;
}

async function kumarhaneChipAl() {
  var el = document.getElementById('kmChipAlMiktar');
  var miktar = el ? parseInt(el.value, 10) || 0 : 0;
  var ef = await sunucuAksiyon('kumarhane_chip_al', null, miktar);
  if (!ef) return;
  if (ef.mesaj) { kumarhaneSonucGoster(escHtml(ef.mesaj), 'ok'); toast(ef.mesaj, 'ok'); }
  kumarhaneSes('chip');
  kumarhaneChipPulse();
  await kumarhanePanelYukle(true);
}

async function kumarhaneChipSat() {
  var el = document.getElementById('kmChipSatMiktar');
  var miktar = el ? parseInt(el.value, 10) || 0 : 0;
  var ef = await sunucuAksiyon('kumarhane_chip_sat', null, miktar);
  if (!ef) return;
  if (ef.mesaj) { kumarhaneSonucGoster(escHtml(ef.mesaj), 'ok'); toast(ef.mesaj, 'ok'); }
  kumarhaneSes('chip');
  kumarhaneChipPulse();
  await kumarhanePanelYukle(true);
}

function kumarhaneSonucEfekt(ef) {
  if (!ef || ef.net == null) return;
  if (ef.net > 0) {
    kumarhaneFxGoster('+' + fmt(ef.net), 'kazanc');
    kumarhaneSes('kazanc');
  } else if (ef.net < 0) {
    kumarhaneSes('kayip');
  }
  kumarhaneChipPulse();
}

async function kumarhaneSlotSpinAnimasyon(ef) {
  var makaralar = document.getElementById('kmSlotMakaralar');
  var makine = document.getElementById('kmSlotMakine');
  var btn = document.getElementById('kmSlotBtn');
  var kol = document.getElementById('kmSlotKol');
  if (!makaralar) return;
  if (kol) {
    kol.disabled = true;
    kol.classList.add('km-slot-kol--cekilmiş');
  }
  var semboller = (ef && ef.gorunum && ef.gorunum.makara)
    ? ef.gorunum.makara.map(function(m) { return m.g; })
    : ['🍒', '🍋', '🔔'];
  makaralar.innerHTML = kumarhaneSlotMakaralarHTML(semboller, [true, true, true]);
  kumarhaneSes('saldiri');
  await kumarhaneBekle(1100);
  makaralar.innerHTML = kumarhaneSlotMakaralarHTML(semboller, [false, true, true]);
  await kumarhaneBekle(750);
  makaralar.innerHTML = kumarhaneSlotMakaralarHTML(semboller, [false, false, true]);
  await kumarhaneBekle(750);
  makaralar.innerHTML = kumarhaneSlotMakaralarHTML(semboller, [false, false, false]);
  await kumarhaneBekle(350);
  if (ef && ef.net > 0 && makine) makine.classList.add('km-slot-makine--kazanc');
  if (btn) btn.disabled = false;
  if (kol) {
    kol.disabled = false;
    kol.classList.remove('km-slot-kol--cekilmiş', 'km-slot-kol--hazir', 'km-slot-kol--surukleniyor');
    kol.style.setProperty('--kol-acisi', '0');
  }
}

async function kumarhaneRuletSpinAnimasyon(sonuc, renk) {
  var cark = document.getElementById('kmRuletCark');
  var topH = document.getElementById('kmRuletTopHalka');
  var merkez = document.getElementById('kmRuletMerkez');
  var durum = document.getElementById('kmRuletDurum');
  var rozet = document.getElementById('kmRuletRozet');
  var masa = document.querySelector('#masterLayout #anaIcerik .km-rulet-masa');
  if (!cark || sonuc == null) return;
  var sure = 5200;
  var hedef = kumarhaneRuletSonAci + kumarhaneRuletHedefAci(sonuc);
  var topHedef = -(hedef * 1.35 + 220);
  kumarhaneRuletSifirla();
  kumarhaneRuletTabloVurgula(null);
  if (durum) durum.textContent = t('game.kumarhane.rouletteSpinning');
  if (rozet) rozet.classList.add('gizli');
  if (masa) masa.classList.add('km-rulet-masa--donuyor');
  if (merkez) {
    merkez.textContent = '…';
    merkez.className = 'km-rulet-merkez';
  }
  kumarhaneSes('saldiri');
  requestAnimationFrame(function() {
    cark.style.transition = 'transform ' + sure + 'ms cubic-bezier(0.08, 0.82, 0.12, 1)';
    cark.style.transform = 'rotate(' + hedef + 'deg)';
    if (topH) {
      topH.style.transition = 'transform ' + sure + 'ms cubic-bezier(0.06, 0.88, 0.1, 1)';
      topH.style.transform = 'rotate(' + topHedef + 'deg)';
    }
  });
  await kumarhaneBekle(sure + 180);
  kumarhaneRuletSonAci = hedef;
  if (masa) masa.classList.remove('km-rulet-masa--donuyor');
  if (merkez) {
    merkez.textContent = String(sonuc);
    merkez.className = 'km-rulet-merkez km-rulet-merkez--' + (renk || 'siyah');
  }
  if (rozet) {
    rozet.textContent = String(sonuc);
    rozet.className = 'km-rulet-sonuc-rozet km-rulet-sonuc-rozet--' + (renk || 'siyah');
    rozet.classList.remove('gizli');
  }
  kumarhaneRuletTabloVurgula(sonuc);
  if (durum) durum.textContent = t('game.kumarhane.rouletteResult', { n: sonuc });
  if (renk === 'kirmizi' || sonuc > 0) kumarhaneSes('chip');
}

async function kumarhaneBarbutZarAnimasyon(z1, z2, id1, id2, topId) {
  var d1 = document.getElementById(id1 || 'kmBarbutZ1');
  var d2 = document.getElementById(id2 || 'kmBarbutZ2');
  var top = document.getElementById(topId || 'kmBarbutToplam');
  var kutu1 = d1 ? d1.closest('.km-zar-kutu') : null;
  var kutu2 = d2 ? d2.closest('.km-zar-kutu') : null;
  if (!d1 || !d2) return;
  kumarhaneSes('saldiri');
  if (kutu1) kutu1.classList.add('km-zar-kutu--firlat');
  if (kutu2) kutu2.classList.add('km-zar-kutu--firlat');
  for (var i = 0; i < 16; i++) {
    d1.classList.add('km-zar--donuyor');
    d2.classList.add('km-zar--donuyor');
    kumarhaneZarGoster(d1, 1 + Math.floor(Math.random() * 6));
    kumarhaneZarGoster(d2, 1 + Math.floor(Math.random() * 6));
    await kumarhaneBekle(75);
  }
  d1.classList.remove('km-zar--donuyor');
  d2.classList.remove('km-zar--donuyor');
  if (kutu1) kutu1.classList.remove('km-zar-kutu--firlat');
  if (kutu2) kutu2.classList.remove('km-zar-kutu--firlat');
  kumarhaneZarGoster(d1, z1);
  kumarhaneZarGoster(d2, z2);
  d1.classList.add('km-zar--inis');
  d2.classList.add('km-zar--inis');
  await kumarhaneBekle(450);
  d1.classList.remove('km-zar--inis');
  d2.classList.remove('km-zar--inis');
  if (top) {
    top.textContent = (z1 + z2) + ' — ' + z1 + ' + ' + z2;
    top.classList.add('km-barbut-toplam--vurgu');
    setTimeout(function() { top.classList.remove('km-barbut-toplam--vurgu'); }, 800);
  }
}

async function kumarhaneRusRuletiAnimasyon(gorunum) {
  var sil = document.getElementById('kmRusSilindir');
  var rev = document.getElementById('kmRevolver');
  var durum = document.getElementById('kmRusDurum');
  var sahne = document.getElementById('kmRusSahne');
  var cekirdek = document.getElementById('kmRevolverCekirdek');
  var cekic = document.getElementById('kmRevolverCekic');
  var tetik = document.getElementById('kmRevolverTetik');
  if (!sil || !gorunum) return;

  sil.style.transition = 'none';
  sil.style.transform = 'rotate(0deg)';
  void sil.offsetWidth;
  sil.querySelectorAll('.km-rus-yuva').forEach(function(y) {
    y.classList.remove('km-rus-yuva--aktif', 'km-rus-yuva--bos', 'km-rus-yuva--patlama');
    var m = y.querySelector('.km-rus-mermi');
    if (m) m.classList.add('gizli');
  });

  if (durum) {
    durum.textContent = t('game.kumarhane.russianLoading');
    durum.className = 'km-revolver-durum km-revolver-durum--bekle';
  }
  if (rev) rev.classList.remove('km-revolver--bang', 'km-revolver--hayatta', 'km-revolver--bos-tik', 'km-revolver--donuyor');
  if (sahne) sahne.classList.remove('km-rus-sahne--sarsinti', 'km-rus-sahne--kirmizi');
  var flash = rev ? rev.querySelector('.km-revolver-flash') : null;
  var duman = rev ? rev.querySelector('.km-revolver-duman') : null;
  var vinyet = rev ? rev.querySelector('.km-revolver-vinyet') : null;
  if (flash) flash.classList.remove('km-revolver-flash--aktif');
  if (duman) duman.classList.remove('km-revolver-duman--aktif');
  if (vinyet) vinyet.classList.remove('km-revolver-vinyet--aktif');
  if (tetik) tetik.classList.remove('km-rus-tetik--cekildi');
  if (cekirdek) cekirdek.classList.remove('km-rus-cekirdek--cekildi');
  if (cekic) cekic.classList.remove('km-rus-cekic--dus');

  await kumarhaneBekle(700);
  if (durum) durum.textContent = t('game.kumarhane.russianSpinning');
  kumarhaneSes('saldiri');
  var donus = 1440 + (360 - (gorunum.tetik - 1) * 60) % 360 + Math.floor(Math.random() * 40);
  sil.style.transition = 'transform 2.4s cubic-bezier(0.1, 0.78, 0.15, 1)';
  sil.style.transform = 'rotate(' + donus + 'deg)';
  if (rev) rev.classList.add('km-revolver--donuyor');
  await kumarhaneBekle(2100);

  if (durum) durum.textContent = t('game.kumarhane.russianCocking');
  if (cekirdek) cekirdek.classList.add('km-rus-cekirdek--cekildi');
  if (cekic) cekic.classList.add('km-rus-cekic--dus');
  await kumarhaneBekle(550);

  if (durum) durum.textContent = t('game.kumarhane.russianPull');
  if (tetik) tetik.classList.add('km-rus-tetik--cekildi');
  await kumarhaneBekle(420);
  if (rev) rev.classList.remove('km-revolver--donuyor');

  var tetikYuva = sil.querySelector('.km-rus-yuva[data-yuva="' + gorunum.tetik + '"]');
  if (tetikYuva) tetikYuva.classList.add('km-rus-yuva--aktif');

  if (gorunum.hayatta) {
    if (rev) rev.classList.add('km-revolver--bos-tik');
    if (tetikYuva) tetikYuva.classList.add('km-rus-yuva--bos');
    if (durum) durum.className = 'km-revolver-durum km-revolver-durum--hayatta';
    kumarhaneSes('kazanc');
  } else {
    if (rev) rev.classList.add('km-revolver--bang');
    if (sahne) sahne.classList.add('km-rus-sahne--sarsinti', 'km-rus-sahne--kirmizi');
    if (tetikYuva) {
      tetikYuva.classList.add('km-rus-yuva--patlama');
      var mermiEl = tetikYuva.querySelector('.km-rus-mermi');
      if (mermiEl) mermiEl.classList.remove('gizli');
    }
    if (flash) flash.classList.add('km-revolver-flash--aktif');
    if (duman) duman.classList.add('km-revolver-duman--aktif');
    if (vinyet) vinyet.classList.add('km-revolver-vinyet--aktif');
    if (durum) durum.className = 'km-revolver-durum km-revolver-durum--bang';
    kumarhaneSes('kayip');
  }

  if (durum) {
    durum.textContent = gorunum.hayatta
      ? t('game.kumarhane.russianSurvived', { n: gorunum.tetik })
      : t('game.kumarhane.russianBang', { n: gorunum.tetik });
  }
  await kumarhaneBekle(1100);
  if (tetik) tetik.classList.remove('km-rus-tetik--cekildi');
  if (cekirdek) cekirdek.classList.remove('km-rus-cekirdek--cekildi');
  if (cekic) cekic.classList.remove('km-rus-cekic--dus');
}

async function kumarhaneAtYarisKosu(atlar, kazananNo) {
  var wrap = document.getElementById('kmPistWrap');
  if (!wrap || !atlar || !atlar.length || !kazananNo) return;
  var durum = atlar.map(function(a) {
    return { no: a.no, ad: a.ad, oran: a.oran, pos: 0 };
  });
  var bitis = 88;
  return new Promise(function(resolve) {
    var tick = 0;
    var timer = setInterval(function() {
      tick += 1;
      var bitti = true;
      durum.forEach(function(at) {
        if (at.pos >= bitis) return;
        bitti = false;
        var hiz = 1.4 + Math.random() * 2.2;
        if (at.no === kazananNo) hiz *= 1.35 + Math.random() * 0.45;
        else if (tick > 28) hiz *= 0.75;
        if (tick > 34 && at.no === kazananNo) hiz *= 2.2;
        at.pos = Math.min(bitis, at.pos + hiz);
      });
      var yaris = {
        atlar: durum.map(function(a) {
          return { no: a.no, ad: a.ad, oran: a.oran, _pos: a.pos };
        })
      };
      wrap.innerHTML = kumarhanePistHTML(yaris, true, null);
      if (bitti || tick >= 42) {
        clearInterval(timer);
        var son = atlar.map(function(a) {
          var d = durum.find(function(x) { return x.no === a.no; });
          return { no: a.no, ad: a.ad, oran: a.oran, _pos: d ? d.pos : 0 };
        });
        wrap.innerHTML = kumarhanePistHTML({ atlar: son }, false, kazananNo);
        resolve();
      }
    }, 130);
  });
}

async function kumarhaneAtOyna(atNo) {
  if (kumarhaneAnimasyon) return;
  var bahis = kumarhaneBahisOku('at_yarisi');
  kumarhaneAnimasyon = true;
  document.querySelectorAll('#masterLayout #anaIcerik .km-at-satir button').forEach(function(btn) {
    btn.disabled = true;
  });
  var satir = document.getElementById('kmAtSatir_' + atNo);
  if (satir) satir.classList.add('km-at-satir--secili');
  var atlar = ((kumarhanePanelVeri && kumarhanePanelVeri.yaris) || {}).atlar || [];
  var wrap = document.getElementById('kmPistWrap');
  if (wrap) {
    wrap.innerHTML = kumarhanePistHTML({
      atlar: atlar.map(function(a) { return Object.assign({}, a, { _pos: 0 }); })
    }, true, null);
  }
  var ef = await sunucuAksiyon('kumarhane_oyna', null, bahis, { oyunId: 'at_yarisi', bahis: bahis, atNo: atNo });
  if (!ef) {
    kumarhaneAnimasyon = false;
    document.querySelectorAll('#masterLayout #anaIcerik .km-at-satir button').forEach(function(btn) {
      btn.disabled = false;
    });
    return;
  }
  var kazanan = ef.gorunum && ef.gorunum.kazanan;
  if (kazanan) await kumarhaneAtYarisKosu(atlar, kazanan);
  kumarhaneAnimasyon = false;
  document.querySelectorAll('#masterLayout #anaIcerik .km-at-satir button').forEach(function(btn) {
    btn.disabled = false;
  });
  await kumarhaneOyunSonucIsle(ef, 'kmAtSonuc');
}

function kumarhanePokerGoster(gorunum) {
  var box = document.getElementById('kmPokerKartlar');
  if (!box || !gorunum) return;
  box.className = 'km-poker-karsilastir km-poker-karsilastir--masa km-el-panel';
  box.innerHTML = '<div class="km-poker-masa-dizilim">'
    + '<div class="km-el-kutu km-el-kutu--krupiye"><div class="km-el-baslik">' + escHtml(t('game.kumarhane.dealer')) + ' · ' + escHtml(gorunum.krupiyeEl || '') + '</div>'
    + kumarhaneKartSiraHTML(gorunum.krupiye) + '</div>'
    + '<div class="km-poker-vs">VS</div>'
    + '<div class="km-el-kutu km-el-kutu--oyuncu"><div class="km-el-baslik">' + escHtml(t('game.kumarhane.you')) + ' · ' + escHtml(gorunum.oyuncuEl || '') + '</div>'
    + kumarhaneKartSiraHTML(gorunum.oyuncu) + '</div>'
    + '</div>';
}

function kumarhaneParmakEfekt(gorunum, secim) {
  var el = document.getElementById('kmElGorsel');
  var bicakWrap = document.getElementById('kmFfBicakWrap');
  var bicak = document.getElementById('kmFfBicak');
  var iz = document.getElementById('kmFfIz');
  var kan = document.getElementById('kmFfKan');
  var masa = document.getElementById('kmFfMasa');
  if (!el || !gorunum) return;
  var slots = el.querySelectorAll('.km-parmak-slot');
  var hedef = null;
  slots.forEach(function(btn) {
    btn.disabled = true;
    btn.classList.remove('km-parmak-slot--hedef');
    var p = parseInt(btn.getAttribute('data-parmak'), 10);
    if (p === secim) {
      hedef = btn;
      btn.classList.add('km-parmak-slot--hedef');
      btn.classList.add(gorunum.sonuc === 'kayip' ? 'km-parmak-slot--tehlike' : 'km-parmak-slot--guvenli');
    }
  });
  if (bicakWrap && hedef) {
    var rect = hedef.getBoundingClientRect();
    var masaRect = masa ? masa.getBoundingClientRect() : rect;
    var x = rect.left + rect.width / 2 - masaRect.left;
    bicakWrap.style.setProperty('--bicak-hedef', x + 'px');
  }
  if (bicak) {
    bicak.classList.remove('km-ff-bicak--vurus', 'km-ff-bicak--guvenli');
    void bicak.offsetWidth;
    bicak.classList.add(gorunum.sonuc === 'kayip' ? 'km-ff-bicak--vurus' : 'km-ff-bicak--guvenli');
  }
  if (iz) {
    iz.classList.remove('km-ff-iz--aktif');
    void iz.offsetWidth;
    iz.classList.add('km-ff-iz--aktif');
  }
  if (kan && gorunum.sonuc === 'kayip' && hedef) {
    kan.classList.remove('km-ff-kan--aktif');
    void kan.offsetWidth;
    kan.style.setProperty('--kan-x', (hedef.offsetLeft + hedef.offsetWidth / 2) + 'px');
    kan.classList.add('km-ff-kan--aktif');
  }
  if (masa) {
    masa.classList.remove('km-ff-masa--titreme');
    if (gorunum.sonuc === 'kayip') {
      void masa.offsetWidth;
      masa.classList.add('km-ff-masa--titreme');
    }
  }
  if (gorunum.tehlike && gorunum.sonuc === 'kayip') {
    kumarhaneSes('kayip');
  } else if (gorunum.sonuc === 'devam') {
    kumarhaneSes('chip');
  }
}

async function kumarhaneOyunSonucIsle(ef, sonucId) {
  if (!ef) return;
  if (ef.gorunum && (ef.oyunId === 'blackjack' || ef.oyunId === 'five_finger')) {
    kumarhaneAktifGorunumKaydet(ef.oyunId, ef.gorunum, ef.chip);
    kumarhaneAktifOyun = ef.oyunId;
    kumarhaneIcerikCiz();
    await kumarhaneBekle(900);
  }
  kumarhaneSonucEfekt(ef);
  if (ef.mesaj) {
    var tip = ef.net > 0 ? 'ok' : (ef.net < 0 ? 'hata' : 'uyari');
    kumarhaneSonucGoster(escHtml(ef.mesaj), tip);
    toast(ef.mesaj, ef.net > 0 ? 'ok' : 'hata');
  }
  if (sonucId && ef.gorunum) {
    var box = document.getElementById(sonucId);
    if (box) {
      box.className = 'km-mini-sonuc' + (ef.net > 0 ? ' km-mini-sonuc--kazanc' : (ef.net < 0 ? ' km-mini-sonuc--kayip' : ''));
      if (ef.gorunum.sonuc != null) {
        box.textContent = t('game.kumarhane.rouletteResult', { n: ef.gorunum.sonuc });
      } else if (ef.gorunum.kazanan) {
        box.textContent = t('game.kumarhane.horseWinner', { n: ef.gorunum.kazanan });
      }
    }
  }
  kumarhaneAktifGorunumKaydet(ef.oyunId, null);
  await kumarhanePanelYukle(true);
  if (ef.gorunum && ef.gorunum.oyuncu && ef.oyunId === 'uc_kart_poker') {
    kumarhanePokerGoster(ef.gorunum);
  }
}

async function kumarhaneBaslat(oyunId) {
  if (kumarhaneAnimasyon) return;
  var bahis = kumarhaneBahisOku(oyunId);

  if (oyunId === 'slot') {
    kumarhaneAnimasyon = true;
    var btn = document.getElementById('kmSlotBtn');
    var kol = document.getElementById('kmSlotKol');
    var makine = document.getElementById('kmSlotMakine');
    if (btn) btn.disabled = true;
    if (kol) kol.disabled = true;
    if (makine) makine.classList.remove('km-slot-makine--kazanc');
    var ef = await sunucuAksiyon('kumarhane_oyna', null, bahis, { oyunId: oyunId, bahis: bahis });
    if (!ef) {
      var makaralar = document.getElementById('kmSlotMakaralar');
      if (makaralar) makaralar.innerHTML = kumarhaneSlotMakaralarHTML(['🍒', '🍋', '🔔'], [false, false, false]);
      kumarhaneAnimasyon = false;
      if (btn) btn.disabled = false;
      if (kol) {
        kol.disabled = false;
        kol.classList.remove('km-slot-kol--cekilmiş', 'km-slot-kol--hazir');
        kol.style.setProperty('--kol-acisi', '0');
      }
      return;
    }
    await kumarhaneSlotSpinAnimasyon(ef);
    kumarhaneAnimasyon = false;
    await kumarhaneOyunSonucIsle(ef, null);
    return;
  }

  var ef = await sunucuAksiyon('kumarhane_oyna', null, bahis, { oyunId: oyunId, bahis: bahis });
  if (!ef) return;
  if (!ef.bitti) {
    kumarhaneAktifOyun = oyunId;
    kumarhaneAktifGorunumKaydet(oyunId, ef.gorunum, ef.chip);
    kumarhaneIcerikCiz();
    if (ef.mesaj) kumarhaneSonucGoster(escHtml(ef.mesaj), 'uyari');
    kumarhaneSes('chip');
    await kumarhanePanelYukle(true);
    return;
  }
  if (oyunId === 'uc_kart_poker') {
    kumarhanePokerGoster(ef.gorunum);
    await kumarhaneBekle(600);
  }
  await kumarhaneOyunSonucIsle(ef, oyunId === 'uc_kart_poker' ? 'kmPokerSonuc' : null);
}

async function kumarhaneHamle(aksiyon) {
  if (kumarhaneAnimasyon) return;
  kumarhaneAnimasyon = true;
  var ef = await sunucuAksiyon('kumarhane_oyna', null, null, { oyunId: 'blackjack', aksiyon: aksiyon });
  kumarhaneAnimasyon = false;
  if (!ef) return;
  if (!ef.bitti) {
    kumarhaneAktifGorunumKaydet('blackjack', ef.gorunum, ef.chip);
    kumarhaneIcerikCiz();
    if (ef.mesaj) kumarhaneSonucGoster(escHtml(ef.mesaj), 'uyari');
    kumarhaneSes('chip');
    await kumarhanePanelYukle(true);
    return;
  }
  await kumarhaneOyunSonucIsle(ef, null);
}

async function kumarhaneParmak(parmak) {
  if (kumarhaneAnimasyon) return;
  kumarhaneAnimasyon = true;
  var ef = await sunucuAksiyon('kumarhane_oyna', null, null, { oyunId: 'five_finger', aksiyon: 'parmak', parmak: parmak });
  if (ef && ef.gorunum) kumarhaneParmakEfekt(ef.gorunum, parmak);
  await kumarhaneBekle(ef && ef.bitti ? 700 : 400);
  kumarhaneAnimasyon = false;
  if (!ef) return;
  if (!ef.bitti) {
    kumarhaneAktifGorunumKaydet('five_finger', ef.gorunum, ef.chip);
    kumarhaneIcerikCiz();
    if (ef.mesaj) kumarhaneSonucGoster(escHtml(ef.mesaj), 'uyari');
    await kumarhanePanelYukle(true);
    return;
  }
  kumarhaneAktifOyun = 'five_finger';
  await kumarhaneOyunSonucIsle(ef, null);
}

async function kumarhaneRuletOyna(tur) {
  if (kumarhaneAnimasyon) return;
  var bahis = kumarhaneBahisOku('rulet');
  kumarhaneAnimasyon = true;
  kumarhaneRuletBahisVurgula(tur);
  document.querySelectorAll('#masterLayout #anaIcerik .km-rulet-btn, #masterLayout #anaIcerik .km-bahis-satir .km-btn, #masterLayout #anaIcerik .km-rulet-hucre, #masterLayout #anaIcerik .km-rulet-tablo-cevir').forEach(function(btn) {
    btn.disabled = true;
  });
  var extra = { oyunId: 'rulet', bahis: bahis, bahisTuru: tur };
  if (tur === 'sayi') {
    extra.deger = kumarhaneRuletSeciliSayi;
    var el = document.getElementById('kmRuletSayi');
    if (el) el.value = String(kumarhaneRuletSeciliSayi);
  }
  var ef = await sunucuAksiyon('kumarhane_oyna', null, bahis, extra);
  if (!ef) {
    kumarhaneAnimasyon = false;
    document.querySelectorAll('#masterLayout #anaIcerik .km-rulet-btn, #masterLayout #anaIcerik .km-bahis-satir .km-btn, #masterLayout #anaIcerik .km-rulet-hucre, #masterLayout #anaIcerik .km-rulet-tablo-cevir').forEach(function(btn) {
      btn.disabled = false;
    });
    return;
  }
  if (ef.gorunum) await kumarhaneRuletSpinAnimasyon(ef.gorunum.sonuc, ef.gorunum.renk);
  document.querySelectorAll('#masterLayout #anaIcerik .km-rulet-btn, #masterLayout #anaIcerik .km-bahis-satir .km-btn, #masterLayout #anaIcerik .km-rulet-hucre, #masterLayout #anaIcerik .km-rulet-tablo-cevir').forEach(function(btn) {
    btn.disabled = false;
  });
  kumarhaneAnimasyon = false;
  await kumarhaneOyunSonucIsle(ef, 'kmRuletSonuc');
}

async function kumarhaneBarbutOyna(tur) {
  if (kumarhaneAnimasyon) return;
  var bahis = kumarhaneBahisOku('barbut');
  kumarhaneAnimasyon = true;
  document.querySelectorAll('#masterLayout #anaIcerik .km-barbut-btn').forEach(function(btn) { btn.disabled = true; });
  var ef = await sunucuAksiyon('kumarhane_oyna', null, bahis, { oyunId: 'barbut', bahis: bahis, bahisTuru: tur });
  if (!ef) {
    kumarhaneAnimasyon = false;
    document.querySelectorAll('#masterLayout #anaIcerik .km-barbut-btn').forEach(function(btn) { btn.disabled = false; });
    return;
  }
  if (ef.gorunum) await kumarhaneBarbutZarAnimasyon(ef.gorunum.z1, ef.gorunum.z2);
  kumarhaneAnimasyon = false;
  document.querySelectorAll('#masterLayout #anaIcerik .km-barbut-btn').forEach(function(btn) { btn.disabled = false; });
  await kumarhaneOyunSonucIsle(ef, 'kmBarbutSonuc');
}

async function kumarhaneRusRuletiOyna() {
  if (kumarhaneAnimasyon) return;
  var bahis = kumarhaneBahisOku('rus_ruleti');
  kumarhaneAnimasyon = true;
  var tetik = document.getElementById('kmRusTetik');
  if (tetik) tetik.disabled = true;
  var ef = await sunucuAksiyon('kumarhane_oyna', null, bahis, { oyunId: 'rus_ruleti', bahis: bahis });
  if (!ef) {
    kumarhaneAnimasyon = false;
    if (tetik) tetik.disabled = false;
    return;
  }
  if (ef.gorunum) await kumarhaneRusRuletiAnimasyon(ef.gorunum);
  kumarhaneAnimasyon = false;
  if (tetik) tetik.disabled = false;
  await kumarhaneOyunSonucIsle(ef, 'kmRusSonuc');
}

function kumarhaneMasaPollDurdur() {
  if (kumarhaneMasaPollTimer) clearInterval(kumarhaneMasaPollTimer);
  kumarhaneMasaPollTimer = null;
}

function kumarhaneMasaPollBaslat(oyunId) {
  kumarhaneMasaPollDurdur();
  kumarhaneMasaPollTimer = setInterval(function() {
    if (kumarhaneAktifOyun === oyunId && kumarhaneOyunModu[oyunId] === 'pvp') {
      kumarhaneMasaYukle(oyunId, true);
    }
  }, 2500);
}

async function kumarhaneMasaYukle(oyunId, sessiz) {
  try {
    var res = await apiFetch('/api/kumarhane/panel?oyunId=' + encodeURIComponent(oyunId));
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) return;
    kumarhaneMasaVeri = data.pvpMasa || null;
    if (data.chip != null && kumarhanePanelVeri) kumarhanePanelVeri.chip = data.chip;
    var wrap = document.getElementById('kmPvpMasaWrap');
    if (wrap && kumarhaneAktifOyun === oyunId && kumarhaneOyunModu[oyunId] === 'pvp') {
      wrap.outerHTML = kumarhanePvpMasaHTML(oyunId);
    }
    kumarhaneOzetGuncelle();
  } catch (e) {
    if (!sessiz) kumarhaneSonucGoster(escHtml(e.message || t('game.error.loadFailed')), 'hata');
  }
}

function kumarhaneMasaEfektUygula(ef) {
  if (!ef) return;
  if (ef.masa) kumarhaneMasaVeri = ef.masa;
  if (ef.chip != null && kumarhanePanelVeri) kumarhanePanelVeri.chip = ef.chip;
  var benId = window.__benimUserId;
  var kazandim = ef.kazananId != null && benId != null && String(ef.kazananId) === String(benId);
  var kaybettim = ef.kazananId != null && benId != null && String(ef.kazananId) !== String(benId);
  if (ef.mesaj) {
    kumarhaneSonucGoster(escHtml(ef.mesaj), kazandim ? 'ok' : (kaybettim ? 'hata' : 'uyari'));
    toast(ef.mesaj, kazandim ? 'ok' : (kaybettim ? 'hata' : 'uyari'));
  }
  if (ef.pot && kazandim) {
    kumarhaneFxGoster('+' + fmt(ef.pot), 'kazanc');
    kumarhaneChipPulse();
  } else if (ef.pot && kaybettim) {
    kumarhaneFxGoster('-' + fmt(ef.masa && ef.masa.bahis ? ef.masa.bahis : Math.floor(ef.pot / 2)), 'kayip');
    kumarhaneChipPulse();
  }
  kumarhaneOzetGuncelle();
}

async function kumarhaneModDegistir(oyunId, mod) {
  if (kumarhaneAnimasyon) return;
  if (mod === 'solo' && kumarhaneMasaVeri) await kumarhaneMasaAyril(true);
  kumarhaneOyunModu[oyunId] = mod;
  kumarhaneIcerikCiz();
  if (mod === 'pvp') await kumarhaneMasaKatil(oyunId);
  else {
    kumarhaneMasaPollDurdur();
    kumarhaneMasaVeri = null;
  }
}

async function kumarhaneMasaKatil(oyunId) {
  var ef = await sunucuAksiyon('kumarhane_masa_katil', null, null, { oyunId: oyunId });
  if (!ef) return;
  kumarhaneMasaEfektUygula(ef);
  kumarhaneIcerikCiz();
  kumarhaneMasaPollBaslat(oyunId);
}

async function kumarhaneMasaAyril(sessiz) {
  kumarhaneMasaPollDurdur();
  var ef = await sunucuAksiyon('kumarhane_masa_ayril');
  kumarhaneMasaVeri = null;
  if (!sessiz && ef && ef.mesaj) kumarhaneSonucGoster(escHtml(ef.mesaj), 'uyari');
  if (kumarhaneAktifOyun === 'barbut' || kumarhaneAktifOyun === 'rus_ruleti') kumarhaneIcerikCiz();
}

async function kumarhaneMasaBahisOner(oyunId) {
  var el = document.getElementById('kmPvpBahis_' + oyunId);
  var miktar = el ? parseInt(el.value, 10) || 0 : 0;
  var ef = await sunucuAksiyon('kumarhane_masa_bahis_oner', null, miktar);
  if (!ef) return;
  kumarhaneMasaEfektUygula(ef);
  kumarhaneIcerikCiz();
}

async function kumarhaneMasaBahisCevap(kabul) {
  var ef = await sunucuAksiyon('kumarhane_masa_bahis_cevap', null, null, { kabul: kabul });
  if (!ef) return;
  kumarhaneMasaEfektUygula(ef);
  kumarhaneIcerikCiz();
}

async function kumarhaneMasaHazir() {
  var ef = await sunucuAksiyon('kumarhane_masa_hazir');
  if (!ef) return;
  kumarhaneMasaEfektUygula(ef);
  kumarhaneIcerikCiz();
}

async function kumarhaneBarbutPvpAnimasyon(gorunum) {
  if (!gorunum || !gorunum.oyuncu1 || !gorunum.oyuncu2) return;
  var o1 = gorunum.oyuncu1;
  var o2 = gorunum.oyuncu2;
  await kumarhaneBarbutZarAnimasyon(o1.z1, o1.z2, 'kmPvpBarbutZ1', 'kmPvpBarbutZ2', 'kmPvpBarbutToplam');
  var top = document.getElementById('kmPvpBarbutToplam');
  if (top) {
    top.textContent = (o1.ad || '#1') + ' ' + o1.toplam + ' — ' + (o2.ad || '#2') + ' ' + o2.toplam;
  }
  await kumarhaneBekle(400);
}

async function kumarhaneMasaOyna() {
  if (kumarhaneAnimasyon) return;
  kumarhaneAnimasyon = true;
  var ef = await sunucuAksiyon('kumarhane_masa_oyna');
  if (ef && ef.gorunum) {
    if (ef.gorunum.tur === 'barbut_pvp') await kumarhaneBarbutPvpAnimasyon(ef.gorunum);
    if (ef.gorunum.tur === 'rus_pvp') await kumarhaneRusRuletiAnimasyon(ef.gorunum);
  }
  kumarhaneAnimasyon = false;
  if (!ef) return;
  kumarhaneMasaEfektUygula(ef);
  kumarhaneIcerikCiz();
  await kumarhanePanelYukle(true);
}
