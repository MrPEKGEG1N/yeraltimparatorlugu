// ========================
// OYUNCU VERİSİ (sunucudan senkron)
// ========================
var oyuncuKasa = 10000;
var oyuncuGuc = 500;
var oyuncuPuan = 1500;
var oyuncuIcraat = 25;
var oyuncuLastIcraatAt = 0;
var oyuncuIcraatRegenSec = 3600;
var oyuncuIcraatSaatlikBonus = 25;
var oyuncuProfilResmi = '';
var ICRAAT_GOSTERIM_MAX = 25;
var limanlar = { istanbul: false, izmir: false, hatay: false };
var sunucuBagli = false;
var aksiyonBekliyor = false;
var aktifReisAdi = 'Reis';
var dunyaState = { limanlar: [], baba: { makamlar: {}, sadakat: { taniyanlar: [], tanimayanlar: [] } } };
var mafyaBildirim = false;
var okunmamisMesaj = false;
var oyuncuDevlet = 100;
var oyuncuSms = 50;
var saatlikKazanc = 0;
var karaListede = false;
var sehirEfsane = false;
var ZAYIF_HAMLE_MSG = 'Zayıf hamle, büyük rezillik. Geri dur!';
var sektorSahiplik = {};
var rusvetBilgi = { min: 10, max: 50, onerilen: 30 };
var AVUKAT_ILISKI_MAX = 600;
var RUSVET_ARTIS_MAX = 50;
var mekanTanimlari = {};
var aktifEkran = '';
var aktifLakap = 'Mafya';
var istihbaratEleman = 0;
var istihbaratBirimMaliyet = 50000;
var bankaBakiye = 0;
var bankaHakki = 20;
var kiralamaEnvanter = {};
var kiralamaFiyatEnvanter = {};
var elitFiyatX2 = false;
var onlineSayisi = 0;
var icraatRegenPollTimer = null;
var icraatSonRegenPoll = 0;
var sehirBannerState = { tip: 'belirsiz', reisAdi: null };
var yeniProfilZiyaret = 0;
var dusmanBulunanHedef = null;
var dusmanRakipListesi = [];
var bankaCalcAktif = 'yatir';
var sesAyar = {
  acik: localStorage.getItem('sesAcik') !== '0',
  seviye: parseFloat(localStorage.getItem('sesSeviye') || '0.7', 10)
};
var sesAudioCtx = null;
var sesCache = {};
var arkaPlanMuzik = null;
var muzikDinleyiciEklendi = false;
var muzikPlayToken = 0;
var muzikAutoplayHandler = null;
var muzikJsOrphanlari = [];
var SES_DOSYALARI = {
  para: '/sounds/para-sesi.wav?v=22',
  saldiri: '/sounds/saldiri-sesi.wav?v=22',
  muzik: '/sounds/oyun-muzigi.mpeg?v=1'
};
var MUZIK_SEVIYE_ORANI = 0.38;
var liderlikModu = 'oyuncu';
var hosgeldinBuOturum = false;
var yeniGazeteHaber = false;
var gunlukGorevBildirim = false;

function hosgeldinGoster(w) {
  if (!w || w.hours < 1 || hosgeldinBuOturum) return;
  var modal = document.getElementById('hosgeldinModal');
  var saatEl = document.getElementById('raconSaat');
  var kazancEl = document.getElementById('raconKazanc');
  if (!modal || !saatEl || !kazancEl) return;
  hosgeldinBuOturum = true;
  saatEl.textContent = String(w.hours || 0);
  kazancEl.textContent = fmt(w.income || 0);
  document.documentElement.classList.add('racon-modal-acik');
  modal.classList.remove('gizli');
  var devam = document.getElementById('raconDevamBtn');
  if (devam) {
    try {
      devam.focus({ preventScroll: true });
    } catch (_) {
      devam.focus();
    }
  }
  if ((w.income || 0) > 0) sesCal('para');
}

function hosgeldinKapat() {
  var modal = document.getElementById('hosgeldinModal');
  document.documentElement.classList.remove('racon-modal-acik');
  if (modal) modal.classList.add('gizli');
}

(function bindHosgeldinModal() {
  var modal = document.getElementById('hosgeldinModal');
  if (!modal) return;
  modal.addEventListener('click', function (e) {
    if (e.target === modal) hosgeldinKapat();
  });
  var kart = modal.querySelector('.racon-kart');
  if (kart) {
    kart.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && !modal.classList.contains('gizli')) {
      hosgeldinKapat();
    }
  });
})();

function apiFetch(url, opts) {
  var o = opts || {};
  o.credentials = 'include';
  o.headers = Object.assign({}, o.headers || {});
  if (typeof guvenlikMeta !== "undefined") {
    Object.assign(o.headers, guvenlikMeta.securityHeaders());
  }
  if (o.body && typeof o.body === 'object' && !(o.headers && o.headers['Content-Type'])) {
    o.headers['Content-Type'] = 'application/json';
    if (typeof guvenlikMeta !== "undefined" && guvenlikMeta.getVisitorId()) {
      o.body.visitorId = guvenlikMeta.getVisitorId();
    }
    o.body = JSON.stringify(o.body);
  }
  return fetch(url, o);
}

function oyuncuUygula(p, secenekler) {
  secenekler = secenekler || {};
  if (p.userId != null) window.__benimUserId = p.userId;
  oyuncuKasa = p.kasa;
  oyuncuGuc = p.guc;
  oyuncuPuan = p.puan;
  oyuncuIcraat = p.icraat;
  if (p.lastIcraatAt != null) oyuncuLastIcraatAt = p.lastIcraatAt;
  if (p.icraatRegenSec != null) oyuncuIcraatRegenSec = p.icraatRegenSec;
  if (p.icraatSaatlikBonus != null) oyuncuIcraatSaatlikBonus = p.icraatSaatlikBonus;
  if (p.profilResmi != null) oyuncuProfilResmi = p.profilResmi;
  limanlar = p.limanlar || { istanbul: false, izmir: false, hatay: false };
  if (p.reisAdi) aktifReisAdi = p.reisAdi;
  if (p.lakap) aktifLakap = p.lakap;
  if (p.dunya) dunyaState = p.dunya;
  mafyaBildirim = !!p.mafyaBildirim;
  okunmamisMesaj = !!p.okunmamisMesaj;
  oyuncuDevlet = Math.min(AVUKAT_ILISKI_MAX, p.devletIliskisi != null ? p.devletIliskisi : 100);
  oyuncuSms = p.smsHakki != null ? p.smsHakki : 50;
  saatlikKazanc = p.saatlikKazanc || 0;
  sektorSahiplik = p.sektorSahiplik || {};
  rusvetBilgi = p.rusvet || rusvetBilgi;
  mekanTanimlari = p.mekanlar || {};
  istihbaratEleman = p.istihbaratEleman || 0;
  istihbaratBirimMaliyet = p.istihbaratBirimMaliyet || istihbaratBirimMaliyetHesap(istihbaratEleman);
  bankaBakiye = p.bankaBakiye || 0;
  bankaHakki = p.bankaHakki != null ? p.bankaHakki : bankaHakki;
  kiralamaEnvanter = p.kiralamaEnvanter || {};
  kiralamaFiyatEnvanter = p.kiralamaFiyatEnvanter || kiralamaEnvanter;
  elitFiyatX2 = !!(p.elitFiyatX2 || Number(p.fiyatCarpani) >= 2 || p.sehreHukmeden || p.enYuksekSayginlik || p.karaListede);
  onlineSayisi = p.onlineSayisi != null ? p.onlineSayisi : onlineSayisi;
  karaListede = !!p.karaListede;
  sehirEfsane = !!p.sehirEfsane;
  if (p.sehirBanner) sehirBannerState = p.sehirBanner;
  yeniProfilZiyaret = p.yeniProfilZiyaret || 0;
  if (!secenekler.poll && p.offlineWelcome && p.offlineWelcome.hours >= 1) {
    hosgeldinGoster(p.offlineWelcome);
  }
  yeniGazeteHaber = !!p.yeniGazeteHaber;
  gunlukGorevBildirim = !!p.gunlukGorevBildirim;
  mafyaMenuYanip();
  profilMenuYanip();
  gazeteMenuYanip();
  gunlukGorevBildirimGuncelle();
  sehirBannerGuncelle();
  mesajMenuYanip();
  arayuzGuncelle();
  icraatRegenPollBaslat();
  // ÖNEMLİ: Otomatik ekran yeniden çizimi, kullanıcı ekranını bozuyordu
  // (Düşmana Çök sonucu kaybolması, Mafya ekranlarının kendi kendine değişmesi vb.)
  // Bu yüzden aktif ekranı kendiliğinden yeniden çizme.
  // Liderlik ekranı kullanıcı tab/sekme değiştirmedikçe yeniden çizilmez.
  guncelleBgIsim();
  saygiDuvariYukle();
}

async function elitFiyatDurumSenkronize() {
  if (!sunucuBagli) return;
  try {
    var res = await apiFetch('/api/player');
    if (!res.ok) return;
    var p = await res.json();
    elitFiyatX2 = !!(p.elitFiyatX2 || Number(p.fiyatCarpani) >= 2 || p.sehreHukmeden || p.enYuksekSayginlik || p.karaListede);
    karaListede = !!p.karaListede;
  } catch (_) {}
}

function isimListesiParse(metin) {
  if (!metin || !String(metin).trim()) return [];
  return String(metin).split(/[,;\n]+/).map(function(s) { return s.trim(); }).filter(Boolean);
}

function isimListesiHTML(liste, bosMetin) {
  if (!liste.length) return '<li style="color:#666;">' + (bosMetin || '—') + '</li>';
  return liste.map(function(n) { return '<li>' + n + '</li>'; }).join('');
}

function sehirBannerGuncelle() {
  var el = document.getElementById('sehirBanner');
  if (!el) return;
  if (aktifEkran === 'liderlik') {
    el.classList.add('gizli');
    return;
  }
  if (sehirBannerState.tip === 'tek' && sehirBannerState.reisAdi) {
    el.className = 'ml-sehir-banner tek';
    el.textContent = "ŞEHİR ŞU AN '" + sehirBannerState.reisAdi + "' TARAFINDAN YÖNETİLİYOR";
    el.classList.remove('gizli');
  } else {
    el.className = 'ml-sehir-banner belirsiz';
    el.textContent = 'ŞEHRİN SAHİBİ HENÜZ BELLİ DEĞİL';
    el.classList.remove('gizli');
  }
}

function profilMenuYanip() {
  var btn = document.getElementById('profilMenuBtn');
  if (btn) btn.classList.toggle('profil-yanip', yeniProfilZiyaret > 0);
}

async function profilZiyaretOkundu() {
  try {
    await apiFetch('/api/profile/ziyaret-okundu', { method: 'POST', body: {} });
    yeniProfilZiyaret = 0;
    profilMenuYanip();
  } catch (_) {}
}

function guncelleBgIsim() {
  var el = document.getElementById('bgIsimEtiket');
  var ad = aktifReisAdi || 'Reis';
  if (el) {
    el.textContent = ad;
    el.setAttribute('aria-label', ad);
  }
  var etiket = document.getElementById('reisEtiket');
  if (etiket) {
    etiket.textContent = (sehirEfsane ? '' : '🕶️ ') + (aktifReisAdi || 'Reis');
    etiket.classList.toggle('efsane', sehirEfsane);
  }
}

async function saygiDuvariYukle() {
  var ul = document.getElementById('saygiDuvariListe');
  if (!ul || !sunucuBagli) return;
  try {
    var res = await apiFetch('/api/saygi-duvari');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.liste || !data.liste.length) {
      ul.innerHTML = '<li style="color:#888;">Henüz efsane yok.</li>';
      return;
    }
    ul.innerHTML = data.liste.map(function(o) {
      var cls = o.efsane ? ' class="isim-efsane"' : '';
      var gunTxt = (o.gun > 0 ? o.gun : 1) + ' gün';
      return '<li' + cls + ' onclick="oyuncuProfilGoster(' + o.userId + ')">' + o.reisAdi + ' <span style="color:#888;">(' + gunTxt + ')</span></li>';
    }).join('');
  } catch (_) {
    ul.innerHTML = '<li style="color:#888;">—</li>';
  }
}

async function sunucudanYukle(secenekler) {
  var res = await apiFetch('/api/player');
  if (res.status === 401) { cikisYap(); throw new Error('Oturum kapalı'); }
  if (!res.ok) throw new Error('Oyuncu yüklenemedi');
  var p = await res.json();
  oyuncuUygula(p, secenekler);
  sunucuBagli = true;
}

async function sunucuAksiyon(action, key, adet, extra) {
  if (aksiyonBekliyor) return null;
  aksiyonBekliyor = true;
  var oncekiKasa = oyuncuKasa;
  try {
    var payload = { action: action, key: key || null };
    if (adet != null) payload.adet = adet;
    // extra alanlarını eksiksiz gönder (yeni özellikler için gerekli)
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function(k) {
        if (extra[k] !== undefined) payload[k] = extra[k];
      });
    }
    if (typeof guvenlikMeta !== "undefined") {
      var meta = guvenlikMeta.actionMeta();
      payload.clientTs = meta.clientTs;
      if (meta.visitorId) payload.visitorId = meta.visitorId;
    }
    var res = await apiFetch('/api/action', { method: 'POST', body: payload });
    if (res.status === 401) { cikisYap(); return null; }
    var data = await res.json().catch(function() { return {}; });
    if (res.status === 404) {
      toast('API bulunamadı. Terminalde npm start çalıştır, http://localhost:3000 aç.', 'hata');
      return null;
    }
    if (!res.ok || !data.ok) {
      var errMsg = data.error || ('İşlem reddedildi (HTTP ' + res.status + ').');
      if (errMsg.indexOf('Zayıf hamle') >= 0) sesCal('zayif');
      toast(errMsg, 'hata');
      return null;
    }
    if (data.player) oyuncuUygula(data.player);
    if (data.effect && data.effect.yeniDevletIliski != null) {
      oyuncuDevlet = Math.min(AVUKAT_ILISKI_MAX, data.effect.yeniDevletIliski);
      arayuzGuncelle();
    }
    if (data.player && data.player.kasa < oncekiKasa) sesCal('para');
    if (data.effect && data.effect.devletDusus && aktifEkran === 'devletIliskisi') {
      var icDevlet = document.getElementById('icerik');
      if (icDevlet) icDevlet.innerHTML = avukatHTML();
    }
    gunlukGorevMenuYanip();
    if (aktifEkran === 'gunlukGorevler') await gunlukGorevlerYukle();
    if (aktifEkran === 'guvenliYer' && data.effect && data.effect.panel) {
      guvenliYerPanel = data.effect.panel;
      guvenliYerOnizlemeSeviye = null;
      guvenliYerTumunuCiz();
    } else if (aktifEkran === 'guvenliYer') {
      await guvenliYerYukle();
    }
    if (window.TutorialEngine && typeof TutorialEngine.tryAutoResume === 'function') {
      TutorialEngine.tryAutoResume(action);
    }
    return data.effect;
  } catch (e) {
    toast('Sunucuya bağlanılamadı. Terminalde: npm start', 'hata');
    return null;
  } finally {
    aksiyonBekliyor = false;
  }
}

// ========================
// GÖRSELLER — yerel (/public/images)
// ========================
var GORSEL_VERSIYON = '124';

function temizGrupAdi(grup) {
  if (!grup) return '—';
  var s = String(grup).trim();
  if (s === 'Bağımsız Reis') return s;
  return s.replace(/\s+Mafya+a*\s+G[uü]?rubu$/i, '').trim() || '—';
}

function ltMedalClass(i) {
  if (i === 0) return 'r1';
  if (i === 1) return 'r2';
  if (i === 2) return 'r3';
  return '';
}

function ltTab(mod, label, on) {
  var c = 'lt-side-tab' + (on ? ' lt-side-tab--on' : '');
  return '<button type="button" class="' + c + '" onclick="liderlikModDegistir(\'' + mod + '\')">' + label + '</button>';
}

function ltIsimHtml(r) {
  var tag = r.benim ? '<span class="lt-tag">sen</span>' : '';
  if (r.bot || !r.userId) {
    return '<span class="lt-name-txt">' + escHtml(r.isim) + tag + '</span>';
  }
  return '<button type="button" class="oyuncu-link lt-name-txt" onclick="oyuncuProfilGoster(' + r.userId + ')">' + escHtml(r.isim) + tag + '</button>';
}

function ltGrupIsimHtml(r) {
  if (!r.grupId) {
    return '<span class="lt-name-txt">' + escHtml(r.isim) + '</span>';
  }
  return '<button type="button" class="oyuncu-link lt-name-txt" onclick="mafyaGrupGoster(' + r.grupId + ')">' + escHtml(r.isim) + '</button>';
}

function ltGrupLinkHtml(isim, grupId, grupMap) {
  var ad = temizGrupAdi(isim);
  var gid = grupId;
  if (!gid && grupMap && ad) {
    gid = grupMap[ad.toLowerCase()] || grupMap[String(isim || '').trim().toLowerCase()];
  }
  if (!gid || !ad || ad === '—' || ad === 'Bağımsız Reis') {
    return '<span class="lt-group-txt">' + escHtml(ad) + '</span>';
  }
  return '<button type="button" class="oyuncu-link lt-group-txt" onclick="mafyaGrupGoster(' + gid + ')">' + escHtml(ad) + '</button>';
}
var MEDYA_BANNER = '/images/is/medya_banner.png?v=' + GORSEL_VERSIYON;
var GAZETE_SAYFA_GORSEL = '/images/gazete/gazete-sayfa.png?v=' + GORSEL_VERSIYON;
  var ARKA_PLAN_GORSEL = '/images/bg-masa.png?v=' + GORSEL_VERSIYON;

function yerelGorsel(klasor, dosya) {
  return '/images/' + klasor + '/' + dosya + '.jpg?v=' + GORSEL_VERSIYON;
}

function yerelGorselPng(klasor, dosya) {
  return '/images/' + klasor + '/' + dosya + '.png?v=' + GORSEL_VERSIYON;
}

function cdnGorsel(photoId) {
  return 'https://images.unsplash.com/' + photoId + '?w=400&h=300&fit=crop&q=80&v=' + GORSEL_VERSIYON;
}

var koruyucuGorseller = {
  delikanli:   yerelGorselPng('koruma', 'delikanli'),
  bodyguard:   yerelGorselPng('koruma', 'bodyguard'),
  profesyonel: yerelGorselPng('koruma', 'profesyonel'),
  harekat:     yerelGorselPng('koruma', 'harekat')
};

var silahGorseller = {
  tabanca:    yerelGorselPng('silah', 'tabanca'),
  pompali:    yerelGorselPng('silah', 'pompali'),
  ak47:       yerelGorselPng('silah', 'ak47'),
  agir_silah: yerelGorselPng('silah', 'agir_silah'),
  sniper:     yerelGorselPng('silah', 'sniper')
};

var luksGorseller = {
  saat:        yerelGorselPng('luks', 'saat'),
  motorsiklet: yerelGorselPng('luks', 'motorsiklet'),
  araba:       yerelGorselPng('luks', 'araba'),
  yat:         yerelGorselPng('luks', 'yat'),
  helikopter:  yerelGorselPng('luks', 'helikopter'),
  jet:         yerelGorselPng('luks', 'jet')
};

var isGorselleri = {
  market:         yerelGorselPng('is', 'market'),
  tamirhane:      yerelGorselPng('is', 'tamirhane'),
  koruma:         yerelGorselPng('is', 'koruma'),
  kumarhane:      yerelGorselPng('is', 'kumarhane'),
  gece_kulubu:    yerelGorselPng('is', 'gece_kulubu'),
  kumarhane_agi:  yerelGorselPng('is', 'kumarhane_agi'),
  kara_para:      yerelGorselPng('is', 'kara_para'),
  galeri:         yerelGorselPng('is', 'galeri'),
  lojistik:       yerelGorselPng('is', 'lojistik'),
  gumruk:         yerelGorselPng('is', 'gumruk'),
  belediye:       yerelGorselPng('is', 'belediye'),
  holding:        yerelGorselPng('is', 'holding'),
  liman_istanbul: yerelGorselPng('is', 'liman_istanbul'),
  liman_izmir:    yerelGorselPng('is', 'liman_izmir'),
  liman_hatay:    yerelGorselPng('is', 'liman_hatay'),
  medya:          MEDYA_BANNER,
  varsayilan:     yerelGorselPng('koruma', 'profesyonel')
};

var ozelGorseller = {
  catisma: yerelGorselPng('ozel', 'kavga')
};

var mafyaIsGorseller = {
  mafya_oto: yerelGorselPng('mafya', 'oto_galeri'),
  mafya_kuyumcu: yerelGorselPng('mafya', 'kuyumcu'),
  mafya_banka: yerelGorselPng('mafya', 'banka'),
  mafya_darphane: yerelGorselPng('mafya', 'darphane')
};

var mafyaEviGorseller = {
  seviye1: yerelGorselPng('mafya', 'ev1'),
  seviye2: yerelGorselPng('mafya', 'ev2'),
  seviye3: yerelGorselPng('mafya', 'ev3'),
  seviye4: yerelGorselPng('mafya', 'ev4'),
  seviye5: yerelGorselPng('mafya', 'ev5'),
  seviye6: yerelGorselPng('mafya', 'ev6'),
  seviye7: yerelGorselPng('mafya', 'ev7'),
  seviye8: yerelGorselPng('mafya', 'ev8'),
  seviye9: yerelGorselPng('mafya', 'ev9'),
  seviye10: yerelGorselPng('mafya', 'ev10')
};

var sohbetGorseller = {
  mesajKutu: yerelGorselPng('sohbet', 'mesaj_kutusu'),
  mafyaMasa: yerelGorselPng('sohbet', 'mafya_masa')
};

var profilGorseller = {
  varsayilanPortre: yerelGorselPng('profil/portre', 'kadin-02')
};
var profilIcraatTimer = null;
var profilQuill = null;
var profilQuillHazir = false;
var profilResimAktifSekme = 'kadin';
var KADIN_PORTRE_ANAHTARLARI = [
  'kadin-01', 'kadin-02', 'kadin-03', 'kadin-04', 'kadin-05', 'kadin-06',
  'kadin-07', 'kadin-08', 'kadin-09', 'kadin-10', 'kadin-11'
];
var ERKEK_PORTRE_ANAHTARLARI = [
  'erkek-01', 'erkek-02', 'erkek-03', 'erkek-04', 'erkek-05', 'erkek-06',
  'erkek-07', 'erkek-08', 'erkek-09', 'erkek-10', 'erkek-11', 'erkek-12',
  'erkek-13', 'erkek-14', 'erkek-15', 'erkek-16', 'erkek-17', 'erkek-18',
  'erkek-19', 'erkek-20', 'erkek-21', 'erkek-22'
];

var devletGorseller = {
  yetkili: yerelGorsel('devlet', 'yetkili')
};

var mekanGorseller = {
  kahvehane: yerelGorselPng('mekan', 'kahvehane'),
  bar: yerelGorselPng('mekan', 'bar'),
  disco: yerelGorselPng('mekan', 'disco'),
  lunapark: yerelGorselPng('mekan', 'lunapark'),
  kumarhane_mekan: yerelGorselPng('mekan', 'kumarhane_mekan'),
  sokak_arasi: yerelGorselPng('mekan', 'sokak_arasi'),
  sehirler_arasi: yerelGorselPng('mekan', 'sehirler_arasi'),
  kacakcilik: yerelGorselPng('mekan', 'kacakcilik'),
  uluslararasi: yerelGorselPng('mekan', 'uluslararasi'),
  atom: yerelGorselPng('mekan', 'atom'),
  mahalle_teslimat: yerelGorselPng('mekan', 'mahalle_teslimat'),
  sehir_teslimat: yerelGorselPng('mekan', 'sehir_teslimat'),
  ulke_teslimat: yerelGorselPng('mekan', 'ulke_teslimat'),
  ulus_teslimat: yerelGorselPng('mekan', 'ulus_teslimat')
};

var mahalleGorselleri = isGorselleri;
var limanGorseller = isGorselleri;

var LIMAN_META = {
  istanbul: { ad: 'İstanbul Limanı', aciklama: 'Boğazın altın kapısı; konteyner ve kaçak yükün kalbi.', img: 'liman_istanbul' },
  izmir:    { ad: 'İzmir Limanı', aciklama: "Ege'nin ticaret üssü; Avrupa bağlantılı sevkiyat hattı.", img: 'liman_izmir' },
  hatay:    { ad: 'Hatay Limanı', aciklama: "Akdeniz çıkışı; sınır ötesi yüklerin gizli rotası.", img: 'liman_hatay' }
};

// ========================
// YARDIMCI
// ========================
function fmt(sayi) { return sayi.toLocaleString('tr-TR'); }

function statTooltipKonumla(chip, tip) {
  var r = chip.getBoundingClientRect();
  tip.classList.remove('gizli');
  var tipW = tip.offsetWidth;
  var tipH = tip.offsetHeight;
  var left = r.left + r.width / 2;
  var top = r.bottom + 8;
  if (top + tipH > window.innerHeight - 8) top = r.top - tipH - 8;
  if (left - tipW / 2 < 8) left = tipW / 2 + 8;
  if (left + tipW / 2 > window.innerWidth - 8) left = window.innerWidth - tipW / 2 - 8;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function statTooltipBagla() {
  var tip = document.getElementById('statTooltipFloat');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'statTooltipFloat';
    tip.className = 'ml-stat-tooltip-float gizli';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  document.querySelectorAll('#masterLayout .ml-stat-chip--tip').forEach(function(chip) {
    if (chip._tipBound) return;
    chip._tipBound = true;
    chip.addEventListener('mouseenter', function() {
      var text = chip.getAttribute('data-tip');
      if (!text) return;
      tip.textContent = text;
      statTooltipKonumla(chip, tip);
    });
    chip.addEventListener('mouseleave', function() {
      tip.classList.add('gizli');
    });
  });
}

function arayuzGuncelle() {
  var kasaEl = document.getElementById('kasa');
  if (kasaEl) kasaEl.innerText = fmt(oyuncuKasa) + ' TL';
  var gucEl = document.getElementById('guc');
  if (gucEl) gucEl.innerText = fmt(oyuncuGuc);
  var puanEl = document.getElementById('puan');
  if (puanEl) puanEl.innerText = fmt(oyuncuPuan);
  var icraatEl = document.getElementById('icraat');
  if (icraatEl) {
    icraatEl.innerText = fmt(oyuncuIcraat);
  }
  var chipIcraat = document.getElementById('chipIcraat');
  if (chipIcraat) {
    chipIcraat.setAttribute('data-tip', 'Saatlik +' + oyuncuIcraatSaatlikBonus + ' hak kazanılır');
  }
  var smsEl = document.getElementById('smsHakki');
  if (smsEl) smsEl.innerText = fmt(oyuncuSms);
  var devEl = document.getElementById('devletIliskisi');
  if (devEl) {
    devEl.innerText = fmt(oyuncuDevlet);
    devEl.style.color = oyuncuDevlet < 5 ? '#ff6666' : '#ffffff';
  }
  var puanEl2 = document.getElementById('puan');
  if (puanEl2) puanEl2.style.color = '#ffffff';
  var gucEl2 = document.getElementById('guc');
  if (gucEl2) gucEl2.style.color = '#ffffff';
  var kasaEl2 = document.getElementById('kasa');
  if (kasaEl2) kasaEl2.style.color = '#ffffff';
  var bankaEl = document.getElementById('bankaUst');
  if (bankaEl) bankaEl.innerText = fmt(bankaBakiye) + ' TL';
  var onlineEl = document.getElementById('onlineSayisi');
  if (onlineEl) onlineEl.innerText = String(onlineSayisi);
}

function mafyaMenuYanip() {
  var btn = document.getElementById('mafyaMenuBtn');
  if (btn) btn.classList.toggle('mafya-yanip', mafyaBildirim);
}

function mesajMenuYanip() {
  var btn = document.getElementById('mesajKutuBtn');
  var sohbet = document.getElementById('sohbetMenuBtn');
  if (btn) btn.classList.toggle('mesaj-yanip', okunmamisMesaj);
  if (sohbet) sohbet.classList.toggle('mesaj-yanip', okunmamisMesaj);
}

function sohbetMenuAc() {
  var menu = document.getElementById('sohbetMenu');
  var btn = document.getElementById('sohbetMenuBtn');
  if (menu) menu.classList.add('acik');
  if (btn) btn.classList.add('aktif-menu');
}

function mesajGonderenBaslik(m) {
  if (m.gonderenEtiketi) return 'Gönderen: ' + m.gonderenEtiketi;
  if (m.tip === 'mafya_grup') {
    return 'Gönderen: Mafya Grubu - ' + (m.gonderenAdi || m.konu || '?');
  }
  if (m.tip === 'saldiri') {
    return 'Gönderen: Sistem' + (m.konu ? ' — ' + m.konu : '');
  }
  return 'Gönderen: ' + (m.gonderenAdi || m.konu || 'Sistem');
}

function gazeteMenuYanip() {
  var btn = document.getElementById('gazeteMenuBtn');
  if (btn) btn.classList.toggle('gazete-yanip', yeniGazeteHaber);
}

function gunlukGorevMenuYanip() {
  var btn = document.getElementById('gunlukGorevlerMenuBtn');
  if (btn) btn.classList.toggle('gorev-yanip', gunlukGorevBildirim);
}

function gunlukGorevBildirimGuncelle() {
  gunlukGorevMenuYanip();
  var plaque = document.getElementById('masterFramePlaque');
  if (plaque) {
    plaque.classList.toggle('gorev-plaque-yanip', gunlukGorevBildirim && aktifEkran === 'gunlukGorevler');
  }
  var kart = document.querySelector('.gunluk-gorevler-kart');
  if (kart) kart.classList.toggle('gorev-sayfa-yanip', gunlukGorevBildirim && aktifEkran === 'gunlukGorevler');
}

function gunlukGorevSureSinifi(metin, kabulEdildi) {
  var cls = 'gg-hucre gg-sure';
  if (!metin || metin === '—') return cls;
  if (!kabulEdildi) {
    if (metin.indexOf('dk') >= 0) cls += ' gg-sure--onizleme-sureli';
    else if (metin === 'Süresiz') cls += ' gg-sure--onizleme-suresiz';
    else if (metin === 'Gün sonu') cls += ' gg-sure--onizleme-gunsonu';
  }
  return cls;
}

function mobilMenuOgeyeKaydir(btn) {
  if (window.innerWidth > 768 || !btn) return;
  var scroller = btn.closest('.g2-body') || btn.closest('.mafya-sidebar-panel');
  if (!scroller) {
    try { btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (_) {}
    return;
  }
  var li = btn.closest('li') || btn;
  var hedef = li.offsetLeft + li.offsetWidth / 2;
  var sol = Math.max(0, hedef - scroller.clientWidth / 2);
  try {
    scroller.scrollTo({ left: sol, behavior: 'smooth' });
  } catch (_) {
    scroller.scrollLeft = sol;
  }
}

function mobilAltMenuKapat() {
  var root = document.getElementById('masterLayout');
  var list = document.querySelectorAll('.ml-alt-menu.acik');
  for (var i = 0; i < list.length; i++) list[i].classList.remove('acik');
  var sohbetBtn = document.getElementById('sohbetMenuBtn');
  var mafyaBtn = document.getElementById('mafyaMenuBtn');
  if (sohbetBtn) sohbetBtn.classList.remove('aktif-menu');
  if (mafyaBtn) mafyaBtn.classList.remove('aktif-menu');
  if (root) root.classList.remove('ml-alt-acik');
}

function mobilNavBagla() {
  if (window.__mobilNavBagli) return;
  window.__mobilNavBagli = true;
  document.addEventListener('click', function(e) {
    if (window.innerWidth > 768) return;
    if (!document.querySelector('.ml-alt-menu.acik')) return;
    var t = e.target;
    if (t.closest('.ml-alt-menu') || t.closest('#sohbetMenuBtn') || t.closest('#mafyaMenuBtn')) return;
    mobilAltMenuKapat();
  });
}

function toggleMenu(id, btn) {
  var menu = document.getElementById(id);
  if (!menu) return;
  var acik = menu.classList.contains('acik');
  var root = document.getElementById('masterLayout');
  if (window.innerWidth <= 768) {
    var diger = document.querySelectorAll('.ml-alt-menu.acik');
    for (var i = 0; i < diger.length; i++) {
      if (diger[i].id !== id) diger[i].classList.remove('acik');
    }
  }
  menu.classList.toggle('acik', !acik);
  if (btn) btn.classList.toggle('aktif-menu', !acik);
  if (root) {
    var herhangiAcik = document.querySelector('.ml-alt-menu.acik');
    root.classList.toggle('ml-alt-acik', !!herhangiAcik);
  }
}

function limanBul(id) {
  var list = dunyaState.limanlar || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].limanId === id) return list[i];
  }
  return { limanId: id, sahipAdi: null, sahipUserId: null, sahipGuc: 0 };
}

function makamBul(key) {
  var m = (dunyaState.baba && dunyaState.baba.makamlar) || {};
  return m[key] || { sahipAdi: null, sahipUserId: null, sahipGuc: 0, babaDerki: '' };
}

function limanBos(lim) {
  return !lim.sahipAdi && (lim.sahipUserId == null || lim.sahipUserId === undefined);
}

function makamBos(m) {
  return !m.sahipAdi && (m.sahipUserId == null || m.sahipUserId === undefined);
}

// ========================
// TOAST
// ========================
function toast(mesaj, tip) {
  var renkler = { hata: '#cc0000', basari: '#1a7a35', altin: '#b8942a' };
  var renk = renkler[tip] || renkler.altin;
  var div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'bottom:30px', 'right:30px', 'z-index:99999',
    'background:' + renk, 'color:#fff', 'padding:14px 22px',
    'border-radius:6px', 'font-family:Oswald,sans-serif', 'font-size:15px',
    'font-weight:600', 'max-width:360px', 'line-height:1.4',
    'box-shadow:0 4px 20px rgba(0,0,0,0.6)'
  ].join(';');
  div.innerText = mesaj;
  document.body.appendChild(div);
  setTimeout(function() {
    div.style.transition = 'opacity 0.4s';
    div.style.opacity = '0';
    setTimeout(function() { div.remove(); }, 400);
  }, 3200);
}

function pencereAc(isAdi, netKazanc, icraat, gorselUrl, devletDusus, yeniDevletIliski) {
  sesCal('saldiri');
  document.getElementById('modalResim').src = gorselUrl || isGorselleri.varsayilan;
  document.getElementById('modalTebrik').innerHTML =
    aktifReisAdi + ' Reis! <span style="color:#b8942a;">' + isAdi + '</span> başarıyla tamamlandı.';
  document.getElementById('modalPara').innerText = '+' + fmt(netKazanc) + ' TL';
  document.getElementById('modalIcraat').innerText = icraat > 0 ? '-' + icraat + ' Hak' : '—';
  var devSatir = document.getElementById('modalDevletSatir');
  var devEl = document.getElementById('modalDevlet');
  if (devSatir && devEl) {
    if (devletDusus) {
      devSatir.style.display = '';
      var yeni = yeniDevletIliski != null ? yeniDevletIliski : oyuncuDevlet;
      devEl.innerText = '-' + devletDusus + ' (yeni: ' + fmt(yeni) + ')';
    } else {
      devSatir.style.display = 'none';
      devEl.innerText = '';
    }
  }
  document.getElementById('soygunModal').classList.add('acik');
}

function pencereKapat() {
  document.getElementById('soygunModal').classList.remove('acik');
}

var FALLBACK = isGorselleri.varsayilan;

function imgFallback(el) {
  if (el && el.src !== FALLBACK) el.src = FALLBACK;
}

function sadakatIsimListesiHTML(isimler) {
  if (!isimler || !isimler.length) return '<p class="sy-liste-bos">Henüz kimse yok</p>';
  if (isimler.length === 1) return '<p>' + escHtml(isimler[0]) + '</p>';
  var html = '<ul class="sy-isim-listesi">';
  for (var i = 0; i < isimler.length; i++) {
    html += '<li>' + escHtml(isimler[i]) + '</li>';
  }
  return html + '</ul>';
}

function babaMakamSayfaHTML(opts) {
  var makam = opts.makam;
  var m = makamBul(makam);
  var babaAd = m.sahipAdi;
  var benim = !!(babaAd && babaAd === aktifReisAdi);
  var modCls = opts.mod ? ' sy-cerceve--' + opts.mod : '';

  var html = '<div class="sy-sayfa">'
    + '<p class="sy-ust-uyari">' + escHtml(HUKUM_SAVUNMA_METIN) + '</p>'
    + '<div class="sy-cerceve' + modCls + '">'
    + '<div class="sy-banner">'
    + '<img src="' + ARKA_PLAN_GORSEL + '" alt="" onerror="imgFallback(this)">'
    + '<div class="sy-banner-ortu" aria-hidden="true"></div>'
    + '<div class="sy-baslik-wrap">'
    + '<span class="sy-baslik-ikon" aria-hidden="true">' + (opts.ikon || '🦅') + '</span>'
    + '<h2>' + escHtml(opts.baslik || '') + '</h2>'
    + '<p class="sy-motto">' + escHtml(opts.motto || '') + '</p>'
    + '</div></div>'
    + '<div class="sy-govde">'
    + '<div class="sy-baba-satir"><span class="sy-etiket">Babanız</span>';

  if (babaAd) {
    html += '<span class="sy-baba-ad">' + escHtml(babaAd) + '</span>';
  } else {
    html += '<span class="sy-baba-ad sy-baba-ad--bos">Henüz baba yok</span>';
  }

  html += '</div>';

  var metinler = opts.metinler || [];
  for (var i = 0; i < metinler.length; i++) {
    html += '<p class="sy-cagri">' + metinler[i] + '</p>';
  }

  html += '<div class="sy-ayrac" aria-hidden="true"><span>✦</span></div>'
    + '<div class="sy-derki-blok"><span class="sy-derki-etiket">Babanız derki</span>';

  if (benim) {
    html += '<textarea id="babaDerki-' + makam + '" placeholder="Sözünü yaz..." maxlength="500">'
      + escHtml(m.babaDerki || '') + '</textarea>'
      + '<button type="button" class="btn-is mavi-btn sy-yazdir-btn" onclick="babaDerkiKaydet(\'' + makam + '\')">[ ✍️ YAZDIR ]</button>';
  } else {
    html += '<p class="sy-derki-metin">' + (m.babaDerki ? escHtml(m.babaDerki) : '—') + '</p>';
  }

  html += '</div>'
    + '<button type="button" class="sy-makam-btn" onclick="babaCok(\'' + makam + '\')">[ 👑 MAKAMA ÇÖK — 1 İCRAAT ]</button>';

  if (opts.altIcerik) html += opts.altIcerik;

  return html + '</div></div></div>';
}

function sadakatYeminiHTML() {
  var sad = (dunyaState.baba && dunyaState.baba.sadakat) || { taniyanlar: [], tanimayanlar: [] };
  var taniyanHtml = sadakatIsimListesiHTML(sad.taniyanlar);
  var tanimayanHtml = sadakatIsimListesiHTML(sad.tanimayanlar);
  var taniyanSayi = sad.taniyanlar.length;
  var tanimayanSayi = sad.tanimayanlar.length;

  var altIcerik = '<div class="sy-oylar">'
    + '<button type="button" class="sy-oy-btn sy-oy-btn--tani" onclick="sadakatOy(\'tani\')">[ 🤝 TANI ]</button>'
    + '<button type="button" class="sy-oy-btn sy-oy-btn--red" onclick="sadakatOy(\'red\')">[ ❌ REDDET ]</button>'
    + '</div>'
    + '<div class="sy-listeler">'
    + '<div class="sy-liste-kart sy-liste-kart--tani">'
    + '<div class="sy-liste-baslik"><h4>TANIYANLAR</h4><span class="sy-liste-sayi">' + taniyanSayi + '</span></div>'
    + taniyanHtml
    + '</div>'
    + '<div class="sy-liste-kart sy-liste-kart--red">'
    + '<div class="sy-liste-baslik"><h4>TANIMAYANLAR</h4><span class="sy-liste-sayi">' + tanimayanSayi + '</span></div>'
    + tanimayanHtml
    + '</div></div>';

  return babaMakamSayfaHTML({
    makam: 'sadakat_yemini',
    mod: 'sadakat',
    ikon: '🦅',
    baslik: 'SADAKAT YEMİNİ',
    motto: 'Kılıcımız değil, sözümüz keskindir; biat eden asla yarı yolda kalmaz.',
    metinler: ['Babanıza Sadakat Yemini edin, rahat edin. Söz sahibi babanın sözü aşağıdadır.'],
    altIcerik: altIcerik
  });
}

function sozunuGecirHTML() {
  return babaMakamSayfaHTML({
    makam: 'sozunu_gecir',
    mod: 'soz',
    ikon: '📿',
    baslik: 'SÖZÜNÜ GEÇİR',
    motto: 'Söz bitince, icraat başlar. Şimdi herkes ayağını denk alsın.',
    metinler: [
      'Bu alemde en büyük söz sahibi babadır. Hepiniz sözünü dinleyeceksiniz!'
    ]
  });
}

function sehreHukmetSahipEtiket(m) {
  if (m.sahipAdi) {
    var benim = m.sahipAdi === aktifReisAdi;
    return '<span class="sh-kart-sahip' + (benim ? ' sh-kart-sahip--benim' : '') + '">👑 ' + escHtml(m.sahipAdi) + '</span>';
  }
  return '<span class="sh-kart-sahip sh-kart-sahip--bos">Boş makam</span>';
}

function sehreHukmetLimanOzet() {
  var ids = ['istanbul', 'izmir', 'hatay'];
  var benim = 0;
  var dolu = 0;
  for (var i = 0; i < ids.length; i++) {
    var l = limanBul(ids[i]);
    if (l.sahipAdi) dolu++;
    if (l.sahipAdi === aktifReisAdi) benim++;
  }
  if (benim > 0) {
    return '<span class="sh-kart-sahip sh-kart-sahip--benim">👑 ' + benim + '/3 liman sizde</span>';
  }
  if (dolu > 0) {
    return '<span class="sh-kart-sahip">' + dolu + '/3 liman dolu</span>';
  }
  return '<span class="sh-kart-sahip sh-kart-sahip--bos">3 liman müsait</span>';
}

function sehreHukmetHubHTML() {
  var soz = makamBul('sozunu_gecir');
  var sadakat = makamBul('sadakat_yemini');

  return '<div class="sh-hub">'
    + '<p class="sh-ust-uyari">' + escHtml(HUKUM_SAVUNMA_METIN) + '</p>'
    + '<div class="sh-cerceve">'
    + '<div class="sh-banner">'
    + '<img src="' + ARKA_PLAN_GORSEL + '" alt="" onerror="imgFallback(this)">'
    + '<div class="sh-banner-ortu" aria-hidden="true"></div>'
    + '<div class="sh-baslik-wrap">'
    + '<span class="sh-krone" aria-hidden="true">👑</span>'
    + '<h2>ŞEHRE HÜKMET</h2>'
    + '<p class="sh-baslik-alt">Tahtın üç kapısı — söz, sadakat ve liman.</p>'
    + '</div></div>'
    + '<div class="sh-kartlar">'
    + '<button type="button" class="sh-kart sh-kart--soz" onclick="ekranDegistir(\'baba_soz\')">'
    + '<span class="sh-kart-ikon" aria-hidden="true">📿</span>'
    + '<div class="sh-kart-icerik"><h3>SÖZÜNÜ GEÇİR</h3>'
    + '<p class="sh-kart-aciklama">Alemde en büyük söz burada konur; herkes dinler.</p>'
    + sehreHukmetSahipEtiket(soz)
    + '</div></button>'
    + '<button type="button" class="sh-kart sh-kart--sadakat" onclick="ekranDegistir(\'baba_sadakat\')">'
    + '<span class="sh-kart-ikon" aria-hidden="true">⚔️</span>'
    + '<div class="sh-kart-icerik"><h3>SADAKAT YEMİNİ</h3>'
    + '<p class="sh-kart-aciklama">Babaya biat eden asla yarı yolda kalmaz.</p>'
    + sehreHukmetSahipEtiket(sadakat)
    + '</div></button>'
    + '<button type="button" class="sh-kart sh-kart--liman" onclick="ekranDegistir(\'liman\')">'
    + '<span class="sh-kart-ikon" aria-hidden="true">🚢</span>'
    + '<div class="sh-kart-icerik"><h3>LİMAN İŞLETMELERİ</h3>'
    + '<p class="sh-kart-aciklama">İstanbul, İzmir ve Hatay — saatlik dev gelir.</p>'
    + sehreHukmetLimanOzet()
    + '</div></button>'
    + '</div>'
    + '<p class="sh-alt-not">Makam veya liman ele geçirmek için 1 İcraat gerekir. Kazanan rakibin saygınlığının %5\'ini alır.</p>'
    + '</div></div>';
}

function vizuelMenuHubHTML(mod, imgSrc, alt, zones) {
  var html = '<div class="vizuel-menu-hub vizuel-menu--' + mod + '">'
    + '<div class="vizuel-menu-wrap">'
    + '<img class="vizuel-menu-img" src="' + imgSrc + '" alt="' + escHtml(alt) + '">';
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    html += '<button type="button" class="vizuel-menu-zone vizuel-menu-zone--' + z.key + '"'
      + ' onclick="ekranDegistir(\'' + z.tip + '\')" aria-label="' + escHtml(z.label) + '"></button>';
  }
  return html + '</div></div>';
}

function guclenHubHTML() {
  return vizuelMenuHubHTML('guclen', '/images/guclen/guclen-menu.png?v=101', 'Güçlen — sokak dükkanları', [
    { key: 'ekip', tip: 'korumaEkibi', label: 'Ekip Kirala' },
    { key: 'silah', tip: 'silahlan', label: 'Silahlan' },
    { key: 'luks', tip: 'luksYasam', label: 'Lüks Yaşam' }
  ]);
}

function buyumeHubHTML() {
  return vizuelMenuHubHTML('buyume', '/images/buyume/buyume-menu.png?v=101', 'Büyüme Adımları — yol ayrımı', [
    { key: 'mahalle', tip: 'mahalle', label: 'Mahalle İşleri' },
    { key: 'semt', tip: 'semt', label: 'Semt İşleri' },
    { key: 'sehir', tip: 'sehir', label: 'Şehir İşleri' }
  ]);
}

function mekanHubHTML() {
  return vizuelMenuHubHTML('mekan', '/images/mekan/mekan-menu.png?v=101', 'Mekan Sahibi — yeraltı sektörleri', [
    { key: 'yeralti', tip: 'sektor_yeralti', label: 'Yeraltı Sektörü' },
    { key: 'silah', tip: 'sektor_silah', label: 'Silah Sektörü' },
    { key: 'paket', tip: 'sektor_paket', label: 'Paket Sektörü' }
  ]);
}

var gunlukGorevPanel = null;

function gunlukGorevlerHTML() {
  return '<div class="gunluk-gorevler-sayfa">' +
    '<div class="gunluk-gorevler-kart">' +
    '<div class="gunluk-gorevler-kart-baslik">' +
    '<div class="gg-kart-baslik-sol">' +
    '<h3 class="gg-kart-baslik">Görev Panosu</h3>' +
    '<p class="gunluk-gorevler-aciklama">Günde <b>10 görev</b> sunulur · En fazla <b>3</b> tanesini kabul edebilirsin</p>' +
    '</div>' +
    '<div class="gunluk-gorevler-ozet" id="gunlukGorevOzet">Yükleniyor…</div>' +
    '</div>' +
    '<div class="gunluk-gorevler-tablo" id="gunlukGorevlerTablo">' +
    '<div class="gunluk-gorev-satir gunluk-gorev-satir--baslik">' +
    '<span class="gg-hucre gg-no">#</span>' +
    '<span class="gg-hucre gg-gorev">Görev</span>' +
    '<span class="gg-hucre gg-adet">Adet</span>' +
    '<span class="gg-hucre gg-odul">Ödül</span>' +
    '<span class="gg-hucre gg-sure">Süre</span>' +
    '<span class="gg-hucre gg-aksiyon">Aksiyon</span>' +
    '</div>' +
    '<div class="gunluk-gorevler-govde" id="gunlukGorevSatirlari">' +
    '<p class="gunluk-gorev-yukleniyor">Görevler yükleniyor…</p>' +
    '</div></div></div></div>';
}

function gunlukGorevAdetHTML(g) {
  if (!g.kabulEdildi) {
    return '<span class="gg-adet-val">' + g.hedefAdet + '</span>';
  }
  var pct = g.hedefAdet > 0 ? Math.min(100, Math.round((g.ilerleme / g.hedefAdet) * 100)) : 0;
  return '<div class="gg-ilerleme gg-ilerleme--satir">' +
    '<span class="gg-adet-val">' + g.ilerleme + '<span class="gg-adet-ayrac">/</span>' + g.hedefAdet + '</span>' +
    '<span class="gg-ilerleme-cubuk" aria-hidden="true"><span class="gg-ilerleme-dolgu" style="width:' + pct + '%"></span></span>' +
    '</div>';
}

function gunlukGorevAksiyonHTML(g) {
  if (g.durum === 'tamamlandi') {
    return '<button type="button" class="gunluk-gorev-odul" data-slot="' + g.slot + '" onclick="gunlukGorevOdulAl(' + g.slot + ')">Ödülü Al</button>';
  }
  if (g.durum === 'teslim_edildi') {
    return '<span class="gg-durum gg-durum--teslim">Teslim edildi</span>';
  }
  if (g.durum === 'basarisiz') {
    return '<span class="gg-durum gg-durum--basarisiz">Başarısız</span>';
  }
  if (g.durum === 'iptal') {
    return '<span class="gg-durum gg-durum--iptal">—</span>';
  }
  if (g.kabulEdildi) {
    return '<span class="gg-durum gg-durum--aktif">Devam</span>';
  }
  if (gunlukGorevPanel && gunlukGorevPanel.kabulSayisi >= gunlukGorevPanel.kabulLimit) {
    return '<span class="gg-durum gg-durum--iptal">Kota doldu</span>';
  }
  return '<button type="button" class="gunluk-gorev-kabul" data-slot="' + g.slot + '" onclick="gunlukGorevKabul(' + g.slot + ')">Kabul Et</button>';
}

function gunlukGorevlerCiz() {
  var ic = document.getElementById('gunlukGorevSatirlari');
  var ozet = document.getElementById('gunlukGorevOzet');
  if (!ic || !gunlukGorevPanel) return;
  if (ozet) {
    ozet.innerHTML = '<span class="gg-ozet-etiket">Kabul edilen</span> ' +
      '<span class="gg-ozet-sayi">' + gunlukGorevPanel.kabulSayisi + ' / ' + gunlukGorevPanel.kabulLimit + '</span>';
  }
  if (!gunlukGorevPanel.gorevler || !gunlukGorevPanel.gorevler.length) {
    ic.innerHTML = '<p class="gunluk-gorev-bos">Bugün için görev bulunamadı.</p>';
    return;
  }
  var html = '';
  gunlukGorevPanel.gorevler.forEach(function (g) {
    html +=
      '<div class="gunluk-gorev-satir gg-satir--' + g.durum + (g.kabulEdildi ? ' gg-satir--kabul' : '') + (g.durum === 'tamamlandi' ? ' gg-satir--odul-bekliyor' : '') + '" data-slot="' + g.slot + '">' +
      '<span class="gg-hucre gg-no"><span class="gg-no-rozet">' + g.slot + '</span></span>' +
      '<span class="gg-hucre gg-gorev" title="' + escHtml(g.ad) + '">' + escHtml(g.ad) + '</span>' +
      '<span class="gg-hucre gg-adet">' + gunlukGorevAdetHTML(g) + '</span>' +
      '<span class="gg-hucre gg-odul">' + escHtml(g.odulMetni) + '</span>' +
      '<span class="' + gunlukGorevSureSinifi(g.sureMetni, g.kabulEdildi) + '">' + escHtml(g.sureMetni) + '</span>' +
      '<span class="gg-hucre gg-aksiyon">' + gunlukGorevAksiyonHTML(g) + '</span>' +
      '</div>';
  });
  ic.innerHTML = html;
  gunlukGorevBildirimGuncelle();
}

async function gunlukGorevlerYukle() {
  var ic = document.getElementById('gunlukGorevSatirlari');
  if (ic) ic.innerHTML = '<p class="gunluk-gorev-yukleniyor">Görevler yükleniyor…</p>';
  try {
    var res = await apiFetch('/api/gorevler');
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      if (ic) ic.innerHTML = '<p class="gunluk-gorev-bos">' + escHtml(data.error || 'Görevler yüklenemedi.') + '</p>';
      return;
    }
    gunlukGorevPanel = data;
    gunlukGorevBildirim = !!data.gunlukGorevBildirim;
    gunlukGorevlerCiz();
  } catch (_) {
    if (ic) ic.innerHTML = '<p class="gunluk-gorev-bos">Sunucuya bağlanılamadı.</p>';
  }
}

async function gunlukGorevKabul(slot) {
  var ef = await sunucuAksiyon('gorev_kabul', slot);
  if (!ef) return;
  toast('Görev kabul edildi. Süre: ' + (ef.gorev && ef.gorev.sureMetni ? ef.gorev.sureMetni : '—'), 'basari');
  await gunlukGorevlerYukle();
}

async function gunlukGorevOdulAl(slot) {
  var ef = await sunucuAksiyon('gorev_odul_al', slot);
  if (!ef) return;
  toast('Ödül alındı: ' + (ef.odulMetni || ''), 'basari');
  await gunlukGorevlerYukle();
}

// ========================
// GÜVENLİ YER — premium dashboard
// ========================
var guvenliYerPanel = null;
var guvenliYerOnizlemeSeviye = null;
var guvenliYerAsamaGenis = false;

var GY_KISA_AD = {
  bos_arazi: 'Boş Arazi',
  malikane_cit: 'Ahşap Çit',
  tas_duvar: 'Taş Duvar',
  bahce: 'Bahçe',
  guclendirme_5: 'Giriş Kulesi',
  enerji_duvari: 'Enerji Duvarı',
  guclendirme_7: 'Savunma Hattı',
  yeralti_hazirlik: 'Yeraltı Sığınağı',
  gizli_duzenler: 'Gizli Düzenler',
  keskin_nisanci: 'Nişancı Kulesi',
  guclendirme_11: 'Yeraltı Ağı',
  guclendirme_12: 'Lojistik Alanı',
  helikopter_pisti: 'Havaalanı',
  stratejik_bunker: 'Stratejik Bunker',
  bunker_girisi: 'Bunker Girişi'
};

function gyGorselYolu(seviye) {
  var n = Math.max(1, Math.min(15, parseInt(seviye, 10) || 1));
  return '/images/guvenli-yer/levels/seviye-' + String(n).padStart(2, '0') + '.png';
}

function gyKisaAd(modul) {
  if (!modul) return '';
  return GY_KISA_AD[modul.id] || modul.ad || '';
}

function guvenliYerHTML() {
  return '<div class="gy-dashboard">'
    + '<div class="gy-dash-grid">'
    + '<aside class="gy-asama-panel">'
    + '<h3 class="gy-asama-baslik">GELİŞİM AŞAMALARI</h3>'
    + '<div class="gy-asama-liste" id="guvenliYerAsamalar"><p class="gy-yukleniyor">…</p></div>'
    + '<button type="button" class="gy-asama-tumunu" id="guvenliYerAsamaToggle" onclick="guvenliYerAsamaToggle()">TÜM AŞAMALARI GÖR</button>'
    + '</aside>'
    + '<main class="gy-hero">'
    + '<div class="gy-hero-frame" id="guvenliYerKanvasWrap">'
    + '<div class="gy-katman-sahne" id="guvenliYerSahne"></div>'
    + '<div class="gy-hero-overlay">'
    + '<div class="gy-hero-seviye" id="guvenliYerHeroSeviye">ÜS SEVİYESİ —</div>'
    + '</div></div></main>'
    + '<aside class="gy-durum-panel" id="guvenliYerPanel"><p class="gy-yukleniyor">Yükleniyor…</p></aside>'
    + '</div>'
    + '<section class="gy-onizleme-bar">'
    + '<h4 class="gy-onizleme-baslik">SEVİYE ÖNİZLEME</h4>'
    + '<div class="gy-onizleme-track" id="guvenliYerOnizleme"></div>'
    + '</section>'
    + '<footer class="gy-footer-perks">'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">🛡️</div>'
    + '<span class="gy-perk-baslik">DAHA GÜÇLÜ</span><span class="gy-perk-alt">SAVUNMA</span></div>'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">💪</div>'
    + '<span class="gy-perk-baslik">GÜÇ</span><span class="gy-perk-alt">ARTIŞI</span></div>'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">⭐</div>'
    + '<span class="gy-perk-baslik">PRESTİJ</span><span class="gy-perk-alt">KAZANCI</span></div>'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">🔓</div>'
    + '<span class="gy-perk-baslik">YENİ</span><span class="gy-perk-alt">ÖZELLİKLER</span></div>'
    + '</footer></div>';
}

function guvenliYerAsamaToggle() {
  guvenliYerAsamaGenis = !guvenliYerAsamaGenis;
  var btn = document.getElementById('guvenliYerAsamaToggle');
  if (btn) btn.textContent = guvenliYerAsamaGenis ? 'DAHA AZ GÖSTER' : 'TÜM AŞAMALARI GÖR';
  guvenliYerAsamalarCiz();
}

function guvenliYerOnizlemeSec(seviye) {
  if (!guvenliYerPanel) return;
  var s = parseInt(seviye, 10);
  var mevcut = guvenliYerPanel.base.baseSeviye || 1;
  if (s > mevcut + 1) return;
  guvenliYerOnizlemeSeviye = (s === mevcut) ? null : s;
  renderBase();
  guvenliYerOnizlemeCiz();
}

function renderBase() {
  var sahn = document.getElementById('guvenliYerSahne');
  var heroSev = document.getElementById('guvenliYerHeroSeviye');
  if (!sahn || !guvenliYerPanel) return;

  var mevcut = guvenliYerPanel.base.baseSeviye || 1;
  var goster = guvenliYerOnizlemeSeviye || mevcut;
  var src = gyGorselYolu(goster);

  sahn.innerHTML = '';
  var img = document.createElement('img');
  img.className = 'gy-katman';
  img.src = src + '?v=' + GORSEL_VERSIYON;
  img.alt = 'Güvenli Yer — Seviye ' + goster;
  img.draggable = false;
  sahn.appendChild(img);

  if (heroSev) {
    heroSev.textContent = 'ÜS SEVİYESİ ' + mevcut + ' / 15';
  }
}

function guvenliYerAsamalarCiz() {
  var el = document.getElementById('guvenliYerAsamalar');
  if (!el || !guvenliYerPanel) return;
  var mevcut = guvenliYerPanel.base.baseSeviye || 1;
  var sonrakiSev = guvenliYerPanel.sonraki ? guvenliYerPanel.sonraki.seviye : null;
  var moduller = (guvenliYerPanel.moduller || []).filter(function (m) { return m.seviye > 1; });
  var limit = guvenliYerAsamaGenis ? moduller.length : 5;
  var html = '';

  moduller.slice(0, limit).forEach(function (m, idx) {
    var cls = 'gy-asama-item';
    var no = '';
    if (m.acik && m.seviye < mevcut) {
      cls += ' gy-asama-item--tamam';
      no = '✓';
    } else if (m.seviye === sonrakiSev || (m.seviye === mevcut && !sonrakiSev)) {
      cls += ' gy-asama-item--aktif';
      no = String(idx + 1);
    } else if (!m.acik) {
      cls += ' gy-asama-item--kilit';
      no = String(m.seviye);
    } else {
      cls += ' gy-asama-item--tamam';
      no = '✓';
    }
    html += '<div class="' + cls + '">'
      + '<span class="gy-asama-no">' + no + '</span>'
      + '<div class="gy-asama-metin"><strong>' + escHtml(gyKisaAd(m)) + '</strong>'
      + '<span>' + escHtml(m.aciklama) + '</span></div>'
      + (cls.indexOf('kilit') !== -1 ? '<span class="gy-asama-kilit">🔒</span>' : '')
      + '</div>';
  });
  el.innerHTML = html || '<p class="gy-yukleniyor">Aşama yok</p>';
}

function guvenliYerOnizlemeCiz() {
  var el = document.getElementById('guvenliYerOnizleme');
  if (!el || !guvenliYerPanel) return;
  var mevcut = guvenliYerPanel.base.baseSeviye || 1;
  var html = '';
  (guvenliYerPanel.moduller || []).forEach(function (m) {
    var cls = 'gy-onizleme-thumb';
    var rozet = String(m.seviye);
    if (m.seviye <= mevcut) {
      cls += ' gy-onizleme-thumb--tamam';
      rozet = '✓';
    } else if (m.seviye === mevcut + 1) {
      cls += ' gy-onizleme-thumb--mevcut';
    } else {
      cls += ' gy-onizleme-thumb--kilit';
      rozet = '🔒';
    }
    if (guvenliYerOnizlemeSeviye === m.seviye) cls += ' gy-onizleme-thumb--onizleme';
    var src = m.gorselSrc || gyGorselYolu(m.seviye);
    var tikla = m.seviye <= mevcut + 1 ? ' onclick="guvenliYerOnizlemeSec(' + m.seviye + ')"' : '';
    html += '<button type="button" class="' + cls + '"' + tikla + '>'
      + '<img src="' + src + '?v=' + GORSEL_VERSIYON + '" alt="' + escHtml(gyKisaAd(m)) + '">'
      + '<span>' + escHtml(gyKisaAd(m)) + '</span>'
      + '<span class="gy-onizleme-rozet">' + rozet + '</span>'
      + '</button>';
  });
  el.innerHTML = html;
}

function guvenliYerPanelCiz() {
  var panel = document.getElementById('guvenliYerPanel');
  if (!panel || !guvenliYerPanel) return;
  var b = guvenliYerPanel.base || {};
  var sonraki = guvenliYerPanel.sonraki;
  var mevcutGuc = oyuncuGuc;
  var bonus = b.gucBonus || 0;

  var html = '<h3 class="gy-durum-baslik">ÜS DURUMU</h3>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">🏠</span><div class="gy-stat-metin">'
    + '<small>Seviye</small><b>' + (b.baseSeviye || 1) + ' / 15</b></div></div>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">🛡️</span><div class="gy-stat-metin">'
    + '<small>Toplam Güç</small><b>' + fmt(mevcutGuc) + '</b></div></div>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">💵</span><div class="gy-stat-metin">'
    + '<small>Kasadaki Nakit</small><b class="gy-yesil">' + fmt(oyuncuKasa) + ' TL</b></div></div>';

  if (sonraki) {
    var disabled = !sonraki.yeterliPara ? ' disabled' : '';
    var sonrakiGuc = mevcutGuc + (sonraki.gucBonus || 0);
    html += '<div class="gy-yukselt-kart">'
      + '<h4>Sonraki: ' + escHtml(gyKisaAd(sonraki)) + '</h4>'
      + '<p style="margin:0 0 8px;color:#888;font-size:12px;">' + escHtml(sonraki.aciklama) + '</p>'
      + '<div class="gy-yukselt-satir"><span>Güç Kazancı</span><b class="gy-arti">+' + fmt(sonraki.gucBonus || 0) + '</b></div>'
      + '<div class="gy-yukselt-satir"><span>Maliyet</span><b>' + fmt(sonraki.maliyet) + ' TL</b></div>'
      + '<div class="gy-guc-karsilastir">'
      + '<span>MEVCUT <b>' + fmt(mevcutGuc) + '</b></span>'
      + '<span class="gy-ok">→</span>'
      + '<span>SONRAKİ <b>' + fmt(sonrakiGuc) + '</b></span>'
      + '</div>'
      + '<button type="button" class="gy-gelistir-btn" id="guvenliYerGelistirBtn"' + disabled
      + ' onclick="guvenliYerGelistir()">ÜSSÜ GELİŞTİR</button>'
      + '</div>';
  } else {
    html += '<div class="gy-tamamlandi">Üssün tam kapasiteye ulaştı.</div>';
  }
  panel.innerHTML = html;
}

function guvenliYerTumunuCiz() {
  guvenliYerPanelCiz();
  guvenliYerAsamalarCiz();
  guvenliYerOnizlemeCiz();
  renderBase();
}

async function guvenliYerYukle() {
  var panel = document.getElementById('guvenliYerPanel');
  if (panel) panel.innerHTML = '<p class="gy-yukleniyor">Yükleniyor…</p>';
  try {
    var res = await apiFetch('/api/guvenli-yer');
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      if (panel) panel.innerHTML = '<p style="color:#c66;">' + escHtml(data.error || 'Yüklenemedi.') + '</p>';
      return;
    }
    guvenliYerPanel = data;
    guvenliYerOnizlemeSeviye = null;
    guvenliYerTumunuCiz();
  } catch (_) {
    if (panel) panel.innerHTML = '<p style="color:#c66;">Sunucuya bağlanılamadı.</p>';
  }
}

async function guvenliYerGelistir() {
  var btn = document.getElementById('guvenliYerGelistirBtn');
  if (btn) btn.disabled = true;
  var ef = await sunucuAksiyon('guvenli_yer_gelistir');
  if (btn && guvenliYerPanel && guvenliYerPanel.sonraki) btn.disabled = !guvenliYerPanel.sonraki.yeterliPara;
  if (!ef) return;
  toast(ef.mesaj || 'Üs geliştirildi.', 'basari');
  guvenliYerOnizlemeSeviye = null;
  if (ef.panel) {
    guvenliYerPanel = ef.panel;
    guvenliYerTumunuCiz();
  } else {
    await guvenliYerYukle();
  }
}

function guvenliYerResizeBagla() {}

var ISTIHBARAT_ELEMAN_MALIYET = 50000;
var ISTIHBARAT_ELEMAN_GUC = 100;
var ISTIHBARAT_ELEMAN_ZAM = 0.05;

function istihbaratBirimMaliyetHesap(sayi) {
  var n = Math.max(0, parseInt(sayi, 10) || 0);
  return Math.floor(ISTIHBARAT_ELEMAN_MALIYET * Math.pow(1 + ISTIHBARAT_ELEMAN_ZAM, n));
}

function istihbaratPanelHTML() {
  return '<div class="istih-sayfa">'
    + '<div class="istih-cerceve">'
    + '<header class="istih-baslik">'
    + '<div class="istih-baslik-ikon" aria-hidden="true">🕵️</div>'
    + '<h2>İSTİHBARAT</h2>'
    + '<p class="istih-baslik-alt">"Bilgi güçtür. Rakiplerinin gücünü öğrenmek için istihbarat elemanları al!"</p>'
    + '</header>'
    + '<section class="istih-kart">'
    + '<div class="istih-kart-sekme">İstihbarat Elemanları</div>'
    + '<div class="istih-eleman-govde">'
    + '<div class="istih-ajan-portre"><img src="/images/istihbarat/istihbarat-ajan.png?v=102" alt="İstihbarat elemanı"></div>'
    + '<div class="istih-eleman-icerik">'
    + '<h3>İstihbarat Elemanları</h3>'
    + '<ul class="istih-stat-list">'
    + '<li>🕵️ Mevcut Eleman: <b id="istihbaratElemanSayi">' + istihbaratEleman + '</b></li>'
    + '<li>💵 Birim Maliyeti: <b id="istihbaratBirimMaliyet">' + fmt(istihbaratBirimMaliyetHesap(istihbaratEleman)) + ' TL</b></li>'
    + '<li class="istih-zam-not">Her alımda birim fiyat %5 artar.</li>'
    + '<li>⚔️ Birim Güç: <b>+' + ISTIHBARAT_ELEMAN_GUC + '</b></li>'
    + '</ul>'
    + '<div class="istih-adet-satir"><label for="adet-istihbarat">Adet</label>'
    + '<input type="number" id="adet-istihbarat" class="istih-adet-input" value="1" min="1" max="100"></div>'
    + '<button type="button" class="istih-btn istih-btn--yesil" onclick="istihbaratAl()">🕵️ [ ELEMAN AL ]</button>'
    + '</div></div></section>'
    + '<section class="istih-kart">'
    + '<div class="istih-kart-sekme">Rakip İstihbarat</div>'
    + '<p class="istih-rakip-aciklama">Rakip oyuncunun gücünü öğrenmek için adını yaz.</p>'
    + '<div class="istih-rakip-satir">'
    + '<input type="text" id="istihbaratHedef" class="istih-hedef-input" placeholder="Rakip reis adı..." maxlength="24" autocomplete="off">'
    + '<button type="button" class="istih-btn istih-btn--mavi" onclick="istihbaratSpy()">🔍 [ GÜCÜ ÖĞREN ]</button>'
    + '</div></section>'
    + '<div id="istihbaratSonuc" class="istih-sonuc gizli"></div>'
    + '</div></div>';
}

function istihbaratEkranBagla() {
  var input = document.getElementById('istihbaratHedef');
  if (!input) return;
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      istihbaratSpy();
    }
  });
}

function istihbaratSonucGoster(html, tip) {
  var sonucDiv = document.getElementById('istihbaratSonuc');
  if (!sonucDiv) return;
  sonucDiv.className = 'istih-sonuc istih-sonuc--' + (tip || 'uyari');
  sonucDiv.innerHTML = html;
}

function dusmanPanelHTML() {
  return '<div class="dusman-hub">'
    + '<div class="dusman-panel">'
    + '<img class="dusman-panel-img" src="/images/dusman/dusman-panel.png?v=' + GORSEL_VERSIYON + '" alt="Düşmana Çök">'
    + '<div class="dusman-panel-input-ortu" aria-hidden="true"></div>'
    + '<input type="text" id="dusmanHedef" class="dusman-panel-input" placeholder="Düşman Adını Yaz..." maxlength="24" autocomplete="off">'
    + '<button type="button" id="dusmanAraBtn" class="dusman-panel-btn" onclick="dusmanAra()" aria-label="Düşman Ara"></button>'
    + '</div>'
    + '<div id="dusmanSonuc" class="dusman-sonuc-alt"></div>'
    + '<div class="dusman-guc-alan is-kart">'
    + '<h3 class="bolum-baslik">⚔️ Güç Değeri</h3>'
    + '<p class="dusman-guc-aciklama">Gücünün %10\'u ile %150\'si arasındaki rakipleri bul. Rakip güçleri gizlidir.</p>'
    + '<button type="button" class="btn-is mavi-btn" onclick="dusmanRakipAra()">[ 🔍 RAKİP ARA ]</button>'
    + '</div>'
    + '<div id="dusmanRakipKutu" class="gizli dusman-rakip-kutu"></div>'
    + '</div>';
}

function dusmanEkranBagla() {
  var input = document.getElementById('dusmanHedef');
  if (!input) return;
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      dusmanAra();
    }
  });
  setTimeout(function() { input.focus(); }, 60);
}

function dusmanHedefKartHTML(o) {
  return '<div class="dusman-hedef-kart">'
    + '<h3>' + escHtml(o.reisAdi) + '</h3>'
    + '<p>🏷️ ' + escHtml(o.lakap || 'Mafya') + ' &nbsp;|&nbsp; 🕶️ Saygınlık: <b>' + fmt(o.puan || 0) + '</b></p>'
    + (o.grup ? '<p>🕶️ Grup: ' + escHtml(o.grup) + '</p>' : '')
    + '<div class="dusman-hedef-aksiyon">'
    + '<button type="button" class="btn-is kirmizi-btn" onclick="dusmanaSaldir()">[ ⚔️ SALDIR ]</button>'
    + '<button type="button" class="btn-is mavi-btn" onclick="oyuncuProfilGoster(' + o.userId + ')">[ 👤 PROFİL ]</button>'
    + '</div></div>';
}

async function dusmanRakipAra() {
  var kutu = document.getElementById('dusmanRakipKutu');
  if (!kutu) return;
  kutu.classList.remove('gizli');
  kutu.innerHTML = '<p style="color:#888;text-align:center;padding:12px;">Rakipler aranıyor...</p>';
  try {
    var res = await apiFetch('/api/oyuncu/rakipler');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) {
      kutu.innerHTML = '<div class="dusman-rakip-kart"><p style="color:#c66;text-align:center;">' + escHtml(data.error || 'Rakip bulunamadı.') + '</p></div>';
      return;
    }
    dusmanRakipListesi = data.liste || [];
    dusmanRakipKutuCiz();
  } catch (_) {
    kutu.innerHTML = '<div class="dusman-rakip-kart"><p style="color:#c66;text-align:center;">Bağlantı hatası.</p></div>';
  }
}

function dusmanRakipKutuCiz() {
  var kutu = document.getElementById('dusmanRakipKutu');
  if (!kutu) return;
  if (!dusmanRakipListesi.length) {
    kutu.innerHTML = '<div class="dusman-rakip-kart">'
      + '<p style="color:#888;text-align:center;">Bu güç aralığında uygun rakip bulunamadı.</p>'
      + '<div class="dusman-hedef-aksiyon">'
      + '<button type="button" class="btn-is" onclick="dusmanRakipAra()">[ 🔄 DEĞİŞTİR ]</button>'
      + '<button type="button" class="btn-is koyu-btn" onclick="dusmanRakipKapat()">[ ✕ KAPAT ]</button>'
      + '</div></div>';
    return;
  }
  var html = '<div class="dusman-rakip-kart">'
    + '<h3 class="bolum-baslik">Uygun Rakipler</h3>'
    + '<p class="dusman-guc-aciklama">Güç değerleri gizli — sadece isim ve saygınlık görünür.</p>';
  dusmanRakipListesi.forEach(function(o) {
    html += '<div class="dusman-rakip-satir">'
      + '<div class="dusman-rakip-bilgi"><b>' + escHtml(o.reisAdi) + '</b>'
      + '<span class="dusman-rakip-meta">🏷️ ' + escHtml(o.lakap || 'Mafya')
      + (o.grup ? ' · 🕶️ ' + escHtml(o.grup) : '')
      + ' · ' + fmt(o.puan || 0) + ' saygınlık</span></div>'
      + '<button type="button" class="btn-is kirmizi-btn" onclick="dusmanaSaldirId(' + o.userId + ')">[ ⚔️ SALDIR ]</button>'
      + '</div>';
  });
  html += '<div class="dusman-hedef-aksiyon">'
    + '<button type="button" class="btn-is" onclick="dusmanRakipAra()">[ 🔄 DEĞİŞTİR ]</button>'
    + '<button type="button" class="btn-is koyu-btn" onclick="dusmanRakipKapat()">[ ✕ KAPAT ]</button>'
    + '</div></div>';
  kutu.innerHTML = html;
}

function dusmanRakipKapat() {
  var kutu = document.getElementById('dusmanRakipKutu');
  if (kutu) kutu.classList.add('gizli');
  dusmanRakipListesi = [];
}

function dusmanaSaldirId(userId) {
  var ad = '';
  for (var i = 0; i < dusmanRakipListesi.length; i++) {
    if (dusmanRakipListesi[i].userId === userId) {
      ad = dusmanRakipListesi[i].reisAdi;
      break;
    }
  }
  if (!ad && dusmanBulunanHedef && dusmanBulunanHedef.userId === userId) {
    ad = dusmanBulunanHedef.reisAdi;
  }
  dusmanaSaldir(ad);
}

async function dusmanAra() {
  var input = document.getElementById('dusmanHedef');
  var btn = document.getElementById('dusmanAraBtn');
  var sonuc = document.getElementById('dusmanSonuc');
  if (!input || !sonuc) return;
  var ad = input.value.trim();
  if (!ad) {
    toast('Düşman adını yaz!', 'hata');
    input.focus();
    return;
  }
  if (btn) btn.disabled = true;
  sonuc.innerHTML = '<p style="color:#888;text-align:center;padding:12px;">Aranıyor...</p>';
  try {
    var res = await apiFetch('/api/oyuncu/ara?q=' + encodeURIComponent(ad));
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.oyuncu) {
      dusmanBulunanHedef = null;
      sonuc.innerHTML = '<div class="saldiri-sonuc" style="color:#c66;">❌ ' + escHtml(data.error || 'Oyuncu bulunamadı.') + '</div>';
      return;
    }
    dusmanBulunanHedef = data.oyuncu;
    input.value = data.oyuncu.reisAdi;
    sonuc.innerHTML = dusmanHedefKartHTML(data.oyuncu);
  } catch (_) {
    dusmanBulunanHedef = null;
    sonuc.innerHTML = '<div class="saldiri-sonuc" style="color:#c66;">Bağlantı hatası.</div>';
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bankaPanelHTML() {
  var yatirVars = oyuncuKasa > 0 ? String(Math.floor(oyuncuKasa / 2)) : '';
  var cekVars = bankaBakiye > 0 ? String(Math.floor(bankaBakiye / 2)) : '';
  var calcTuslar = [
    { k: '1', l: '1' }, { k: '2', l: '2' }, { k: '3', l: '3' },
    { k: '4', l: '4' }, { k: '5', l: '5' }, { k: '6', l: '6' },
    { k: '7', l: '7' }, { k: '8', l: '8' }, { k: '9', l: '9' },
    { k: '.', l: '.' }, { k: '0', l: '0' }, { k: 'sil', l: '⌫' }
  ];
  var calcHtml = '';
  for (var i = 0; i < calcTuslar.length; i++) {
    var t = calcTuslar[i];
    var cls = 'banka-calc-tus' + (t.k === 'sil' ? ' banka-calc-tus--sil' : '');
    calcHtml += '<button type="button" class="' + cls + '" onclick="bankaCalcTus(\'' + t.k + '\')">' + t.l + '</button>';
  }
  return '<div class="banka-sayfa">'
    + '<div class="banka-bakiye-kart">'
    + '<span class="banka-bakiye-etiket">Banka Hesabı</span>'
    + '<span class="banka-bakiye-tutar" id="bankaBakiyeGoster">💰 ' + fmt(bankaBakiye) + ' TL</span>'
    + '<span class="banka-kasa-not">Kasandaki nakit: <b>' + fmt(oyuncuKasa) + ' TL</b></span>'
    + '<span class="banka-kasa-not">Banka hakkı: <b style="color:#ffd76a;">' + fmt(bankaHakki) + '</b> <span style="color:#777;">(Her 24 saatte +20)</span></span>'
    + '</div>'
    + '<div class="banka-bilgi-kart">'
    + '<p>Saat <b>18:00</b>\'a kadar bankaya yatırılan para faiz işler. Ertesi gün saat <b>10:00</b>\'da miktarın <b>%1</b>\'i kadar faiz kazanırsın. Paranı dilediğin zaman çekebilirsin.</p>'
    + '<p style="margin-top:8px;color:#888;">Günlük para yatırma ve çekme limiti banka hakkınla sınırlıdır (her işlem 1 hak).</p>'
    + '</div>'
    + '<div class="banka-islem-ust">'
    + '<div class="banka-kart banka-kart--yatir">'
    + '<h3>Para Yatır</h3>'
    + '<p>Kazanmak için cesaretini yatır. Kasandaki paran bankaya aktarılır.</p>'
    + '<label for="bankaYatirMiktar">Yatırılacak miktar (TL)</label>'
    + '<input type="text" id="bankaYatirMiktar" class="banka-miktar-input" inputmode="numeric" autocomplete="off" placeholder="0" value="' + yatirVars + '">'
    + '<button type="button" id="bankaYatirBtn" class="banka-btn-yatir" onclick="bankaYatir()">✓ YATIR</button>'
    + '</div>'
    + '<div class="banka-hesap-makinesi">'
    + '<div class="banka-calc-ekran" id="bankaCalcEkran">0</div>'
    + '<div class="banka-calc-grid">' + calcHtml + '</div>'
    + '</div></div>'
    + '<div class="banka-kart banka-kart--cek">'
    + '<h3>Para Çek</h3>'
    + '<p>Sahip olduğun gücü kontrol et. Bankadaki paran kasana geçer.</p>'
    + '<label for="bankaCekMiktar">Çekilecek miktar (TL)</label>'
    + '<input type="text" id="bankaCekMiktar" class="banka-miktar-input" inputmode="numeric" autocomplete="off" placeholder="0" value="' + cekVars + '">'
    + '<button type="button" id="bankaCekBtn" class="banka-btn-cek" onclick="bankaCek()">✕ ÇEK</button>'
    + '</div></div>';
}

function bankaEkranBagla() {
  bankaCalcAktif = 'yatir';
  var yatir = document.getElementById('bankaYatirMiktar');
  var cek = document.getElementById('bankaCekMiktar');
  if (!yatir || !cek) return;
  function odak(tip) {
    bankaCalcAktif = tip;
    bankaCalcEkranGuncelle();
  }
  yatir.addEventListener('focus', function() { odak('yatir'); });
  cek.addEventListener('focus', function() { odak('cek'); });
  yatir.addEventListener('input', function() {
    yatir.value = yatir.value.replace(/\D/g, '');
    bankaCalcEkranGuncelle();
  });
  cek.addEventListener('input', function() {
    cek.value = cek.value.replace(/\D/g, '');
    bankaCalcEkranGuncelle();
  });
  odak('yatir');
}

function bankaCalcEkranGuncelle() {
  var input = document.getElementById(bankaCalcAktif === 'yatir' ? 'bankaYatirMiktar' : 'bankaCekMiktar');
  var ekran = document.getElementById('bankaCalcEkran');
  if (!input || !ekran) return;
  ekran.textContent = input.value || '0';
}

function bankaCalcTus(tus) {
  var input = document.getElementById(bankaCalcAktif === 'yatir' ? 'bankaYatirMiktar' : 'bankaCekMiktar');
  if (!input) return;
  input.focus();
  var v = String(input.value || '');
  if (tus === 'sil') {
    v = v.slice(0, -1);
  } else if (tus === '.') {
    return;
  } else {
    v = (v === '0' ? '' : v) + tus;
  }
  input.value = v;
  bankaCalcEkranGuncelle();
}

function bankaMiktarOku(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  return parseInt(String(el.value || '').replace(/\D/g, ''), 10) || 0;
}

function elitFiyatUygula(bazFiyat) {
  var f = Math.floor(bazFiyat || 0);
  return elitFiyatX2 ? Math.floor(f * 2) : f;
}

function elitFiyatGosterHtml(bazFiyat) {
  var baz = Math.floor(bazFiyat || 0);
  if (!elitFiyatX2) return '<b>' + fmt(baz) + ' TL</b>';
  var uygulanmis = elitFiyatUygula(baz);
  return '<span class="elit-fiyat-wrap">'
    + '<span class="elit-fiyat-normal">' + fmt(baz) + ' TL</span> '
    + '<b class="elit-fiyat-x2-deger">' + fmt(uygulanmis) + ' TL</b> '
    + '<span class="elit-fiyat-badge">x2</span></span>';
}

function elitFiyatNotuHTML() {
  if (elitFiyatX2) {
    return '<p class="elit-fiyat-uyari">⚠️ Şehre Hükmeden veya en yüksek saygınlıklı oyuncu olduğun için alım fiyatların <b>x2</b> uygulanıyor (aşağıdaki fiyatlarda gösterilir).</p>';
  }
  return ELIT_FIYAT_NOTU;
}

function elitFiyatEkranTazele() {
  var ic = document.getElementById('anaIcerik');
  if (!ic || !aktifEkran) return;
  if (aktifEkran === 'sektor_yeralti') sektorEkranCiz(ic, 'yeralti', 'YERALTI SEKTÖRÜ');
  else if (aktifEkran === 'sektor_silah') sektorEkranCiz(ic, 'silah', 'SİLAH SEKTÖRÜ');
  else if (aktifEkran === 'sektor_paket') sektorEkranCiz(ic, 'paket', 'PAKET SEKTÖRÜ');
  else if (aktifEkran === 'korumaEkibi') guclenAltEkranCiz('korumaEkibi', ic);
  else if (aktifEkran === 'silahlan') guclenAltEkranCiz('silahlan', ic);
  else if (aktifEkran === 'luksYasam') guclenAltEkranCiz('luksYasam', ic);
}

async function guclenAltEkranCiz(tip, ic) {
  ic.innerHTML = '<p style="color:#888;">Yükleniyor...</p>';
  await elitFiyatDurumSenkronize();
  if (aktifEkran !== tip) return;
  if (tip === 'korumaEkibi') {
    ic.innerHTML = '<h2>👥 KORUMA EKİBİ VE TETİKÇİLER</h2><p>"Arkanı sağlama al Reis."</p>'
      + elitFiyatNotuHTML()
      + guclenKartlariCiz(['delikanli', 'bodyguard', 'profesyonel', 'harekat'], koruyucuGorseller, 'vesikalik-resim', '#28a745', '🪙 ADAMI KİRALA');
    return;
  }
  if (tip === 'silahlan') {
    ic.innerHTML = '<h2>🔫 CEPHANELİK VE SİLAHLANMA</h2><p>"Sözün bittiği yerde silahlar konuşur."</p>'
      + elitFiyatNotuHTML()
      + guclenKartlariCiz(['tabanca', 'pompali', 'ak47', 'agir_silah', 'sniper'], silahGorseller, 'vesikalik-resim', '#00e5ff', '🔫 SİLAHI SATIN AL', 'mavi-btn');
    return;
  }
  if (tip === 'luksYasam') {
    ic.innerHTML = '<h2>💎 LÜKS YAŞAM</h2><p>"Lüks harcamalar ağırlığını artırır."</p>'
      + elitFiyatNotuHTML()
      + guclenKartlariCiz(['saat', 'motorsiklet', 'araba', 'yat', 'helikopter', 'jet'], luksGorseller, 'luks-resim', '#b8942a', '💎 SATIN AL', 'kirmizi-btn');
  }
}

function guclenKartHTML(key, img, imgCls, baslik, alinti, bazMaliyet, guc, gucRenk, btnLabel, btnCls) {
  var sahip = kiralamaEnvanter[key] || 0;
  var maliyetTxt = typeof bazMaliyet === 'number' ? elitFiyatGosterHtml(bazMaliyet) : bazMaliyet;
  return '<div class="is-kart"><div class="is-yapi">'
    + '<img src="' + img + '" class="' + imgCls + '" alt="" loading="lazy" onerror="imgFallback(this)">'
    + '<div class="is-detay"><h3>' + baslik + '</h3><p>💬 ' + alinti + '</p>'
    + '<p>📦 Sahip: <b style="color:#ffd700;">' + sahip + ' adet</b></p>'
    + '<p>💵 Birim: ' + maliyetTxt + ' &nbsp;|&nbsp; ⚔️ Birim güç: <b style="color:' + gucRenk + ';">' + guc + '</b></p>'
    + '<div class="adet-satir"><label for="adet-' + key + '">📦 Adet</label>'
    + '<input type="number" id="adet-' + key + '" class="adet-input" value="1" min="1" max="999"></div>'
    + '<button type="button" class="btn-is ' + (btnCls || '') + '" onclick="adamKirala(\'' + key + '\')">[ ' + btnLabel + ' ]</button>'
    + '</div></div></div>';
}

function guclenBazBirimFiyat(baz, sahip) {
  return Math.floor(baz * Math.pow(1.01, sahip || 0));
}

function guclenBirimFiyat(baz, sahip) {
  return elitFiyatUygula(guclenBazBirimFiyat(baz, sahip));
}

var ELIT_FIYAT_NOTU = '<p style="color:#fff;font-size:13px;margin:12px 0 16px;">Şehre Hükmet en oyuncuya ve en çok saygınlığı olan oyuncuya sektör ve güç alımlarında x2 fiyat uygulanır!</p>';
var HUKUM_SAVUNMA_METIN = 'Şehre Hükmeden oyuncu saldırı aldığında gücü %50 düşük hesaplanır.';
var HUKUM_SAVUNMA_NOTU = '<p style="color:#fff;font-size:13px;margin:12px 0 16px;">' + HUKUM_SAVUNMA_METIN + '</p>';

function guclenFiyatAdet(key) {
  if (kiralamaFiyatEnvanter && kiralamaFiyatEnvanter[key] != null) {
    return kiralamaFiyatEnvanter[key];
  }
  return kiralamaEnvanter[key] || 0;
}

function guclenKartlariCiz(keys, gorseller, imgCls, gucRenk, btnLabel, btnCls) {
  var html = '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var info = HIRE_BILGI[k];
    if (!info) continue;
    var sahip = kiralamaEnvanter[k] || 0;
    var fiyatAdet = guclenFiyatAdet(k);
    var bazFiyat = guclenBazBirimFiyat(info.maliyet, fiyatAdet);
    html += guclenKartHTML(k, gorseller[k], imgCls, info.baslik, info.alinti, bazFiyat, '+' + fmt(info.guc), gucRenk, btnLabel, btnCls);
  }
  return html;
}

var HIRE_BILGI = {
  delikanli: { maliyet: 500, guc: 50, baslik: '🪖 Mahalle Delikanlısı', alinti: '"Sokağın gözü kulağı."' },
  bodyguard: { maliyet: 2000, guc: 250, baslik: '💪 BodyGuard Tut', alinti: '"Giriş çıkışları tutan duvar."' },
  profesyonel: { maliyet: 8000, guc: 1100, baslik: '🕶️ Profesyonel Koruma', alinti: '"Takım elbiseli yakın koruma."' },
  harekat: { maliyet: 30000, guc: 4500, baslik: '🦅 Özel Harekat Emeklisi', alinti: '"Operasyonların gizli beyni."' },
  tabanca: { maliyet: 1200, guc: 100, baslik: '🔫 Baretta Tabanca', alinti: '"Yakın mesafe vazgeçilmezi."' },
  pompali: { maliyet: 4500, guc: 450, baslik: '💥 Taktik Pompalı Tüfek', alinti: '"Barikatları dağıtan gürültü."' },
  ak47: { maliyet: 15000, guc: 1800, baslik: '🔥 Gaddar Keleş (AK-47)', alinti: '"Yeraltının simgesi."' },
  agir_silah: { maliyet: 45000, guc: 6000, baslik: '⚡ Görünmez Gölge', alinti: '"Ağır silah kasası."' },
  sniper: { maliyet: 55000, guc: 7500, baslik: '🎯 AWM Keskin Nişancı', alinti: '"Uzun menzil hakimiyeti."' },
  saat: { maliyet: 15000, guc: 2500, baslik: '⌚ Lüks Kol Saati', alinti: '"Prestij abidesi."' },
  motorsiklet: { maliyet: 75000, guc: 15000, baslik: '🏍️ Klasik Özel Motorsiklet', alinti: '"Sokağın hakimine yakışan hız."' },
  araba: { maliyet: 350000, guc: 80000, baslik: '🏎️ İtalyan Spor Araba', alinti: '"Prestij ve hız."' },
  yat: { maliyet: 2500000, guc: 600000, baslik: '🛥️ Süper Lüks Yat', alinti: '"Deniz sarayı."' },
  helikopter: { maliyet: 8000000, guc: 2000000, baslik: '🚁 Özel Taktik Helikopter', alinti: '"Havadan operasyon."' },
  jet: { maliyet: 45000000, guc: 10000000, baslik: '🛩️ Özel Jet', alinti: '"Dünyanın her yerine ulaşım."' }
};

function isKartHTML(img, baslik, kazanc, icraat, guc, onclick) {
  return '<div class="is-kart"><div class="is-yapi">'
    + '<img src="' + img + '" class="vesikalik-resim" onerror="imgFallback(this)">'
    + '<div class="is-detay"><h3>' + baslik + '</h3>'
    + '<p>💰 Net Kazanç: <b style="color:#28a745;">' + kazanc + '</b></p>'
    + '<p style="color:#00e5ff;font-weight:600;">⚡ Gereken: ' + icraat + ' &nbsp;|&nbsp; Min. Güç: <b>' + guc + '</b></p>'
    + '<button class="btn-is" onclick="' + onclick + '">[ 💰 İŞİ GERÇEKLEŞTİR ]</button>'
    + '</div></div></div>';
}

function limanKartHTML(id) {
  var meta = LIMAN_META[id];
  var lim = limanBul(id);
  var benim = lim.sahipAdi === aktifReisAdi;
  var sahipTxt = lim.sahipAdi
    ? '👑 Sahip: <b style="color:#b8942a;">' + lim.sahipAdi + '</b>'
    : '⚪ Sahipsiz — güçlü reis alır (1 İcraat)';
  var btnMetin = benim ? '[ 👑 SAHİBİ SİZSİNİZ ]' : '[ ⚔️ LİMANA ÇÖK ]';
  var btnCls = benim ? ' kirmizi-btn' : '';
  var onclick = benim ? 'toast(\'Bu liman zaten sizin!\', \'altin\')' : 'limanCok(\'' + id + '\')';
  return '<div class="liman-kart"><div class="is-yapi">'
    + '<img src="' + isGorselleri[meta.img] + '" class="vesikalik-resim" style="border-color:#b8942a;" onerror="imgFallback(this)">'
    + '<div class="is-detay"><h3>⚓ ' + meta.ad + '</h3>'
    + '<p>' + meta.aciklama + '</p>'
    + '<p style="margin:8px 0;">' + sahipTxt + '</p>'
    + '<button class="btn-savas' + btnCls + '" onclick="' + onclick + '">' + btnMetin + '</button>'
    + '</div></div></div>';
}

function mekanDevriMekanSayisi() {
  var n = 0;
  Object.keys(sektorSahiplik || {}).forEach(function(sk) {
    var s = sektorSahiplik[sk];
    if (s && s.adet) n += s.adet;
  });
  return n;
}

function mekanDevriMekanMeta(sk) {
  var parts = sk.split(':');
  if (parts.length < 2) return null;
  var sektor = parts[0];
  var key = parts[1];
  var m = (mekanTanimlari[sektor] && mekanTanimlari[sektor][key]) || null;
  if (!m && typeof MEKANLAR_VERI !== 'undefined' && MEKANLAR_VERI[sektor]) {
    m = MEKANLAR_VERI[sektor][key];
  }
  return m;
}

function mekanDevriMekanGridHTML() {
  var items = [];
  Object.keys(sektorSahiplik || {}).forEach(function(sk) {
    var s = sektorSahiplik[sk];
    if (!s || !s.adet) return;
    items.push({ sk: sk, adet: s.adet, m: mekanDevriMekanMeta(sk) });
  });
  if (!items.length) return '';

  var html = '<div class="md-mekan-secim">'
    + '<span class="md-mekan-secim-etiket">Devredilecek mekan</span>'
    + '<input type="hidden" id="mekanDevriMekan" value="">'
    + '<div class="md-mekan-grid">';

  items.forEach(function(it) {
    var ad = it.m ? it.m.ad : it.sk;
    var img = (it.m && it.m.gorsel && mekanGorseller[it.m.gorsel]) ? mekanGorseller[it.m.gorsel] : FALLBACK;
    html += '<button type="button" class="md-mekan-kart" data-sk="' + escHtml(it.sk) + '" data-adet="' + it.adet + '" onclick="mekanDevriMekanSec(this)">'
      + '<span class="md-mekan-kart-img"><img src="' + img + '" alt="" loading="lazy" onerror="imgFallback(this)"></span>'
      + '<span class="md-mekan-kart-ad">' + escHtml(ad) + '</span>'
      + '<span class="md-mekan-kart-adet">' + it.adet + ' adet</span>'
      + '</button>';
  });

  return html + '</div></div>';
}

function mekanDevriMekanSec(btn) {
  if (!btn) return;
  var sk = btn.getAttribute('data-sk') || '';
  var adet = parseInt(btn.getAttribute('data-adet'), 10) || 1;
  var hidden = document.getElementById('mekanDevriMekan');
  if (hidden) hidden.value = sk;
  var kartlar = document.querySelectorAll('#masterLayout .md-mekan-kart');
  for (var i = 0; i < kartlar.length; i++) {
    kartlar[i].classList.toggle('md-mekan-kart--secili', kartlar[i] === btn);
  }
  var adetInput = document.getElementById('mekanDevriAdet');
  if (adetInput) {
    adetInput.max = adet;
    if (parseInt(adetInput.value, 10) > adet) adetInput.value = adet;
  }
}

function mekanDevriEkranBagla() {
  var ilk = document.querySelector('#masterLayout .md-mekan-kart');
  if (ilk) mekanDevriMekanSec(ilk);
}

function medyaZamanGoster(ts) {
  if (!ts) return '';
  var now = Math.floor(Date.now() / 1000);
  var diff = now - ts;
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return Math.floor(diff / 60) + ' dk önce';
  if (diff < 86400) return Math.floor(diff / 3600) + ' sa önce';
  return new Date(ts * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function avukatHTML() {
  var r = rusvetBilgi || { min: 10, max: 50, onerilen: 30 };
  var iliski = Math.min(AVUKAT_ILISKI_MAX, oyuncuDevlet != null ? oyuncuDevlet : 100);
  var iliskiYuzde = Math.min(100, Math.round((iliski / AVUKAT_ILISKI_MAX) * 100));
  var dolguCls = iliski < 50 ? ' av-iliski-dolgu--dusuk' : (iliski >= AVUKAT_ILISKI_MAX ? ' av-iliski-dolgu--max' : '');
  var onerilen = r.onerilen || r.min || 10;
  var maksimumda = iliski >= AVUKAT_ILISKI_MAX;
  var rusvetPanel = '<div class="av-panel av-panel--rusvet">'
    + '<div class="av-panel-baslik"><span class="av-panel-ikon" aria-hidden="true">💵</span><h3>RÜŞVET VER</h3></div>';
  if (maksimumda) {
    rusvetPanel += '<p class="av-rusvet-max">Avukat ilişkin maksimum seviyede (' + AVUKAT_ILISKI_MAX + '). Daha fazla rüşvet veremezsin.</p>';
  } else {
    rusvetPanel += '<div class="av-rusvet-oneri"><span class="av-rusvet-oneri-etiket">Önerilen miktar</span>'
      + '<span class="av-rusvet-oneri-tutar">' + fmt(onerilen) + ' TL</span></div>'
      + '<p class="av-rusvet-aralik">Aralık (saygınlığa göre): ' + fmt(r.min) + ' – ' + fmt(r.max) + ' TL · Her rüşvette max +' + RUSVET_ARTIS_MAX + ' ilişki</p>'
      + '<div class="av-alan"><label for="rusvetMiktar">Rüşvet miktarı (TL)</label>'
      + '<input type="number" id="rusvetMiktar" class="av-input" value="' + onerilen + '" min="' + r.min + '" max="' + r.max + '"></div>'
      + '<button type="button" class="av-btn" onclick="rusvetVer()">[ 💵 RÜŞVET VER ]</button>';
  }
  rusvetPanel += '</div>';

  return '<div class="av-sayfa"><div class="av-cerceve">'
    + '<div class="av-banner">'
    + '<img src="' + devletGorseller.yetkili + '" alt="Avukat" onerror="imgFallback(this)">'
    + '<div class="av-banner-ortu"></div>'
    + '<div class="av-baslik-wrap">'
    + '<h2>AVUKAT</h2>'
    + '<p class="av-motto">"Adalet sisteminde doğru avukat, işlerini yürütmen için çok önemli."</p>'
    + '</div></div>'
    + '<div class="av-govde">'
    + '<p class="av-giris">Avukatınla aranı iyi tut — icraat yapabilmek için ilişkinin sağlam kalması gerekir.</p>'
    + '<div class="av-uyari">Avukatınla olan ilişkin <strong>5</strong>\'in altına düşerse hapse girer ve icraata çıkamazsın. Her rüşvette ilişki en fazla <strong>+' + RUSVET_ARTIS_MAX + '</strong> artar; tavan <strong>' + AVUKAT_ILISKI_MAX + '</strong>.</div>'
    + '<div class="av-iliski-kutu">'
    + '<div class="av-iliski-ust">'
    + '<span class="av-iliski-etiket">Mevcut Avukat İlişkisi</span>'
    + '<span class="av-iliski-deger">' + iliski + ' <span>/ ' + AVUKAT_ILISKI_MAX + '</span></span>'
    + '</div>'
    + '<div class="av-iliski-cubuk"><div class="av-iliski-dolgu' + dolguCls + '" style="width:' + iliskiYuzde + '%"></div></div>'
    + '</div>'
    + '<div class="av-paneller">'
    + '<div class="av-panel av-panel--avukat">'
    + '<div class="av-panel-baslik"><span class="av-panel-ikon" aria-hidden="true">⚖️</span><h3>SENİN AVUKATIN</h3></div>'
    + '<div class="av-portre"><img src="' + devletGorseller.yetkili + '" alt="" onerror="imgFallback(this)"></div>'
    + '<p class="av-portre-ad">Avukatın</p>'
    + '<p class="av-portre-aciklama">Dosyalarını kapatır, savcılara ulaşır, seni sokaklarda tutar.</p>'
    + '</div>'
    + rusvetPanel
    + '</div></div></div></div>';
}

function medyaHTML() {
  return '<div class="med-sayfa"><div class="med-cerceve">'
    + '<div class="med-banner">'
    + '<img src="' + MEDYA_BANNER + '" alt="Medya Merkezi" onerror="imgFallback(this)">'
    + '<div class="med-banner-ortu"></div>'
    + '<div class="med-baslik-wrap">'
    + '<span class="med-baslik-ikon" aria-hidden="true">📰</span>'
    + '<h2>MEDYA</h2>'
    + '<p class="med-motto">"Haberleri kontrol et, propaganda yap, rakiplerini aşağıla."</p>'
    + '</div></div>'
    + '<div class="med-govde">'
    + '<p class="med-giris">Yeraltı manşetlerine haber düşür — gazetede 24 saat boyunca görünür.</p>'
    + '<div class="med-paneller">'
    + '<div class="med-panel med-panel--yayin">'
    + '<div class="med-panel-baslik"><span class="med-panel-ikon" aria-hidden="true">📢</span><h3>HABER YAYINLA</h3></div>'
    + '<div class="med-meta">'
    + '<span class="med-meta-etiket">💵 Maliyet</span><strong>100.000 TL</strong>'
    + '<span class="med-meta-etiket">⏱ Süre</span><span>24 saat görünür</span>'
    + '</div>'
    + '<div class="med-alan"><label for="medyaHaber">Haber metni</label>'
    + '<textarea id="medyaHaber" class="med-textarea" rows="4" placeholder="Manşete düşecek haberi yaz..." maxlength="200"></textarea></div>'
    + '<button type="button" class="med-btn" onclick="medyaHaberYayinla()">[ 📰 HABER YAYINLA ]</button>'
    + '<div id="medyaSonuc" class="med-sonuc gizli"></div>'
    + '</div>'
    + '<div class="med-panel med-panel--haberler">'
    + '<div class="med-panel-baslik"><span class="med-panel-ikon" aria-hidden="true">📋</span><h3>SON HABERLER</h3></div>'
    + '<div id="medyaHaberlerListesi" class="med-haber-liste"></div>'
    + '</div></div></div></div></div>';
}

function mekanDevriHTML() {
  var mekanSay = mekanDevriMekanSayisi();
  var mekanGrid = mekanDevriMekanGridHTML();
  var altMetin = mekanSay > 0
    ? 'Portföyünde ' + mekanSay + ' mekan var — görselden seç, dostuna devret.'
    : 'Mekanların yoksa yalnızca para gönderebilirsin.';

  var mekanPanel = '<div class="md-panel md-panel--mekan">'
    + '<div class="md-panel-baslik"><span class="md-panel-ikon" aria-hidden="true">🔄</span><h3>MEKAN DEVRET</h3></div>';

  if (mekanSay < 1) {
    mekanPanel += '<p class="md-bos-uyari">Devredebileceğin mekan bulunmuyor.</p>';
  }

  mekanPanel += '<div class="md-alan"><label for="mekanDevriHedef">Dost reis adı</label>'
    + '<input type="text" id="mekanDevriHedef" placeholder="Dost reis adı..." maxlength="24"' + (mekanSay < 1 ? ' disabled' : '') + '></div>';

  if (mekanGrid) {
    mekanPanel += mekanGrid;
  }

  mekanPanel += '<div class="md-alan md-alan--adet"><label for="mekanDevriAdet">Adet</label>'
    + '<input type="number" id="mekanDevriAdet" value="1" min="1" max="999"' + (mekanSay < 1 ? ' disabled' : '') + '></div>'
    + '<button type="button" class="md-btn md-btn--mavi"' + (mekanSay < 1 ? ' disabled' : ' onclick="mekanDevret()"') + '>[ 🔄 DEVRET ]</button>'
    + '<div id="mekanDevriSonuc" class="md-sonuc gizli"></div></div>';

  return '<div class="md-sayfa"><div class="md-cerceve">'
    + '<div class="md-banner">'
    + '<img src="' + ARKA_PLAN_GORSEL + '" alt="" onerror="imgFallback(this)">'
    + '<div class="md-banner-ortu" aria-hidden="true"></div>'
    + '<div class="md-baslik-wrap">'
    + '<span class="md-baslik-ikon" aria-hidden="true">🔄</span>'
    + '<h2>MEKAN DEVRİ</h2>'
    + '<p class="md-baslik-alt">Elindeki mekanları devret, kasandan para gönder.</p>'
    + '</div></div>'
    + '<div class="md-govde">'
    + '<p class="md-giris">' + escHtml(altMetin) + '</p>'
    + '<div class="md-paneller">'
    + mekanPanel
    + '<div class="md-panel md-panel--para">'
    + '<div class="md-panel-baslik"><span class="md-panel-ikon" aria-hidden="true">💸</span><h3>PARA GÖNDER</h3></div>'
    + '<div class="md-alan"><label for="paraGonderHedef">Alıcı reis adı</label>'
    + '<input type="text" id="paraGonderHedef" placeholder="Alıcı reis adı..." maxlength="24"></div>'
    + '<div class="md-alan"><label for="paraGonderMiktar">Gönderilecek miktar (TL)</label>'
    + '<input type="number" id="paraGonderMiktar" value="100000" min="1" max="999999999"></div>'
    + '<button type="button" class="md-btn md-btn--yesil" onclick="paraGonder()">[ 💸 PARA GÖNDER ]</button>'
    + '<div id="paraGonderSonuc" class="md-sonuc gizli"></div>'
    + '</div></div></div></div></div>';
}

function profilPortreKeyNormalize(key) {
  var k = String(key || '').trim();
  var eski = k.match(/^portre-(\d{2})$/);
  if (eski) return 'kadin-' + eski[1];
  return k;
}

function profilPortreUrlFromKey(key) {
  key = profilPortreKeyNormalize(key);
  if (!key) return profilGorseller.varsayilanPortre;
  return yerelGorselPng('profil/portre', key);
}

function profilPortreSekmesi(key) {
  key = profilPortreKeyNormalize(key);
  if (key.indexOf('erkek-') === 0) return 'erkek';
  return 'kadin';
}

function profilResmiUrl(userId, profilResmiKey) {
  var key = profilResmiKey || '';
  if (!key && (String(userId) === String(window.__benimUserId) || userId === 'me')) {
    key = oyuncuProfilResmi;
  }
  return profilPortreUrlFromKey(key);
}

function profilResmiOzelMi(url) {
  return !!(url && url.indexOf('/profil/portre/') >= 0);
}

function profilSonrakiSaatKalanSn(lastAt, regenSec) {
  regenSec = regenSec || oyuncuIcraatRegenSec || 3600;
  var now = Math.floor(Date.now() / 1000);
  if (lastAt == null || lastAt <= 0) lastAt = now;
  var elapsed = Math.max(0, now - lastAt);
  var mod = elapsed % regenSec;
  if (mod === 0) return elapsed === 0 ? regenSec : 0;
  return regenSec - mod;
}

/** Profilde gösterilecek icraat yenilenme süresi (sn) */
function profilIcraatKalanSn(icraat, lastAt, regenSec, saatlikBonus) {
  regenSec = regenSec || oyuncuIcraatRegenSec || 3600;
  return profilSonrakiSaatKalanSn(lastAt, regenSec);
}

function icraatRegenPollBaslat() {
  if (icraatRegenPollTimer) clearInterval(icraatRegenPollTimer);
  icraatRegenPollTimer = setInterval(function() {
    if (!sunucuBagli) return;
    var kalan = profilSonrakiSaatKalanSn(oyuncuLastIcraatAt, oyuncuIcraatRegenSec);
    if (kalan > 3) return;
    var simdi = Date.now();
    if (simdi - icraatSonRegenPoll < 4000) return;
    icraatSonRegenPoll = simdi;
    sunucudanYukle({ poll: true }).then(function() {
      if (aktifEkran === 'profilim') profilYukle();
    }).catch(function() {});
  }, 1000);
}

function profilSureFormat(sn) {
  var s = Math.max(0, Math.floor(sn || 0));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function profilIcraatTimerDurdur() {
  if (profilIcraatTimer) {
    clearInterval(profilIcraatTimer);
    profilIcraatTimer = null;
  }
}

function profilIcraatTimerBaslat(icraat, lastAt, regenSec, saatlikBonus) {
  profilIcraatTimerDurdur();
  var el = document.getElementById('profilIcraatKalan');
  if (!el) return;
  var sonPoll = 0;
  function guncelle() {
    var kalan = profilIcraatKalanSn(icraat, lastAt, regenSec, saatlikBonus);
    el.textContent = kalan > 0 ? profilSureFormat(kalan) : '00:00:00';
    if (kalan === 0 && sunucuBagli) {
      var simdi = Date.now();
      if (simdi - sonPoll > 4000) {
        sonPoll = simdi;
        sunucudanYukle({ poll: true }).then(function() {
          if (aktifEkran === 'profilim') profilYukle();
        }).catch(function() {});
      }
    }
  }
  guncelle();
  profilIcraatTimer = setInterval(guncelle, 1000);
}

function profilIcraatTimerOyuncudan() {
  profilIcraatTimerBaslat(
    oyuncuIcraat,
    oyuncuLastIcraatAt,
    oyuncuIcraatRegenSec,
    oyuncuIcraatSaatlikBonus
  );
}

function profilQuillToolbarHtml() {
  return '<div id="profilAciklamaToolbar">'
    + '<span class="ql-formats">'
    + '<button type="button" class="ql-bold" title="Kalın"></button>'
    + '<button type="button" class="ql-italic" title="Eğik"></button>'
    + '<button type="button" class="ql-undo" title="Geri Al"></button>'
    + '</span>'
    + '<span class="ql-formats"><select class="ql-color" title="Metin Rengi"></select></span>'
    + '<span class="ql-formats"><select class="ql-size" title="Yazı tipi boyutu">'
    + '<option value="10px">Küçük</option>'
    + '<option value="14px" selected>Normal</option>'
    + '<option value="18px">Büyük</option>'
    + '<option value="24px">Çok Büyük</option>'
    + '</select></span>'
    + '<span class="ql-formats"><select class="ql-font" title="Yazı Tipi">'
    + '<option selected>Sans</option>'
    + '<option value="roboto">Roboto</option>'
    + '<option value="oswald">Oswald</option>'
    + '<option value="cinzel">Cinzel</option>'
    + '<option value="serif">Serif</option>'
    + '<option value="monospace">Monospace</option>'
    + '</select></span>'
    + '</div>'
    + '<div id="profilAciklamaEditor"></div>';
}

function profilQuillDomSifirla() {
  var wrap = document.getElementById('profilAciklamaWrap');
  if (!wrap) return;
  wrap.innerHTML = profilQuillToolbarHtml();
}

function profilQuillKayitlari() {
  if (profilQuillHazir || typeof Quill === 'undefined') return;
  var Font = Quill.import('formats/font');
  Font.whitelist = ['roboto', 'oswald', 'cinzel', 'serif', 'monospace'];
  Quill.register(Font, true);
  var Size = Quill.import('attributors/style/size');
  Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '24px'];
  Quill.register(Size, true);
  profilQuillHazir = true;
}

function profilQuillYokEt() {
  profilQuill = null;
}

function profilQuillBaslat() {
  profilQuillKayitlari();
  if (typeof Quill === 'undefined') return;
  if (!document.getElementById('profilAciklamaWrap')) return;

  profilQuill = null;
  profilQuillDomSifirla();

  if (!document.getElementById('profilAciklamaEditor')) return;

  profilQuill = new Quill('#profilAciklamaEditor', {
    theme: 'snow',
    placeholder: 'Açıklama ekle...',
    modules: {
      toolbar: {
        container: '#profilAciklamaToolbar',
        handlers: {
          undo: function() {
            this.quill.history.undo();
          }
        }
      },
      history: {
        delay: 400,
        maxStack: 100,
        userOnly: true
      }
    }
  });
}

function profilAciklamaAl() {
  if (!profilQuill) return '';
  var html = profilQuill.root.innerHTML || '';
  if (html === '<p><br></p>' || html === '<p></p>') return '';
  return html;
}

function profilAciklamaYaz(html) {
  if (!profilQuill) return;
  if (!html || !String(html).trim()) {
    profilQuill.setText('');
    return;
  }
  var s = String(html).trim();
  if (s.indexOf('<') < 0) {
    profilQuill.setText(s);
    return;
  }
  profilQuill.root.innerHTML = s;
}

function profilAciklamaGosterUygula(html) {
  var el = document.getElementById('profilAciklamaGoster');
  if (!el) return;
  if (!html || !String(html).trim()) {
    el.textContent = '—';
    return;
  }
  var s = String(html).trim();
  if (s.indexOf('<') < 0) {
    el.textContent = s;
    return;
  }
  el.innerHTML = s;
}

function profilEkranSablonu(opts) {
  opts = opts || {};
  var ad = opts.oyuncuAdi || 'Reis';
  var isimCls = 'profil-isim-script' + (opts.sehirEfsane ? ' isim-efsane' : '');
  var userId = opts.userId || window.__benimUserId || 'me';
  var avatarUrl = profilResmiUrl(userId, opts.profilResmi);
  var avatarCls = profilResmiOzelMi(avatarUrl) ? ' profil-avatar-ozel' : '';

  var metaHtml = '<span id="profilKayitTarihiWrap">Kayıt: <span id="profilKayitTarihi">' + escHtml(opts.kayitTarihi || '—') + '</span></span>';
  if (opts.sehirEfsane) {
    metaHtml += '<span class="profil-rozet efsane">👑 Şehir tarihine işlenmiş efsane.</span>';
  }
  if (opts.karaListede) {
    metaHtml += '<span class="profil-rozet kara">💀 Kara Liste: Liman/makam alındığında rakibin saygınlığının %5\'i ödül</span>';
  }

  var ozetHtml = '<div class="profil-ozet-hucre"><span>👑 Oyuncu</span><strong id="profilOzOyuncu">' + escHtml(ad) + '</strong></div>'
    + '<div class="profil-ozet-hucre"><span>🏷️ Lakap</span><strong id="profilOzLakap">' + escHtml(opts.lakap || 'Mafya') + '</strong></div>';
  if (opts.guc != null) {
    ozetHtml += '<div class="profil-ozet-hucre"><span>⚔️ Güç</span><strong id="profilOzGuc">' + fmt(opts.guc) + '</strong></div>';
  } else {
    ozetHtml += '<div class="profil-ozet-hucre"><span>⚔️ Güç</span><strong id="profilOzGuc">—</strong></div>';
  }
  if (opts.saatlik != null) {
    ozetHtml += '<div class="profil-ozet-hucre"><span>✦ Saatlik Kazanç</span><strong class="yesil" id="profilOzSaatlik">' + fmt(opts.saatlik) + ' TL</strong></div>';
  } else {
    ozetHtml += '<div class="profil-ozet-hucre"><span>✦ Saatlik Kazanç</span><strong class="yesil" id="profilOzSaatlik">—</strong></div>';
  }

  var detayHtml = '<dl class="profil-detay-liste">'
    + '<div class="profil-detay-satir"><dt>Oyuncu İsmi</dt><dd id="profilOyuncuIsmiDetay">' + escHtml(opts.oyuncuAdi || ad) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>Saygınlık</dt><dd id="profilPuanDetay">' + fmt(opts.puan || 0) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>Sıralama</dt><dd id="profilSiraDetay">' + (opts.sira != null ? fmt(opts.sira) : '—') + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>Mafya Grubu Sıralaması</dt><dd id="profilGrupSiraDetay">' + (opts.grupSira != null ? fmt(opts.grupSira) : '—') + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>İcraat Hakkı Yenilenmesine</dt><dd id="profilIcraatKalan">' + (opts.icraatKalan || '—') + '</dd></div>'
    + '</dl>';

  var formHtml;
  if (opts.duzenlenebilir) {
    formHtml = '<div class="profil-form">'
      + '<label>Açıklama Ekle</label>'
      + '<div id="profilAciklamaWrap" class="profil-quill-wrap">'
      + profilQuillToolbarHtml()
      + '</div>'
      + '<div class="profil-form-ikili">'
      + '<div><label for="profilDostlar">Dostlar</label>'
      + '<input type="text" id="profilDostlar" placeholder="Virgül ile ayır..."></div>'
      + '<div><label for="profilDusmanlar">Düşmanlar</label>'
      + '<input type="text" id="profilDusmanlar" placeholder="Ali, Veli, etc."></div>'
      + '</div></div>';
  } else {
    formHtml = '<div class="profil-form">'
      + '<label>Açıklama</label>'
      + '<div id="profilAciklamaGoster" class="profil-aciklama-metin profil-aciklama-html">—</div>'
      + '<div class="profil-form-ikili">'
      + '<div><label>Dostlar</label><p class="profil-aciklama-metin">' + escHtml(opts.dostlar || '—') + '</p></div>'
      + '<div><label>Düşmanlar</label><p class="profil-aciklama-metin">' + escHtml(opts.dusmanlar || '—') + '</p></div>'
      + '</div></div>';
  }

  var resimBtn = opts.duzenlenebilir
    ? '<button type="button" class="profil-resim-btn" onclick="profilResmiSecModal()">Resmi Değiştir</button>'
    : '';

  var altBtn = '';
  if (opts.duzenlenebilir) {
    altBtn = '<div class="profil-alt-butonlar">'
      + '<button type="button" class="profil-alt-btn kirmizi" onclick="profilKaydet()">👤 Profili Kaydet</button>'
      + '<button type="button" class="profil-alt-btn koyu" onclick="sifreDegistirModal()">🔐 Şifre Değiştir</button>'
      + '<button type="button" class="profil-alt-btn koyu" onclick="cikisYap()">↪ Oyundan Çık</button>'
      + '</div>'
      + '<div id="sifreAlan" class="gizli profil-sifre-kutu">'
      + '<label for="eskiSifre">Mevcut şifre</label>'
      + '<input type="password" id="eskiSifre" class="dusman-input">'
      + '<label for="yeniSifre">Yeni şifre</label>'
      + '<input type="password" id="yeniSifre" class="dusman-input">'
      + '<button type="button" class="profil-alt-btn kirmizi" onclick="sifreKaydet()">Kaydet</button>'
      + '</div>';
  }

  return '<div class="profil-wrap" data-profil-user="' + escHtml(String(userId)) + '" data-profil-resmi="' + escHtml(opts.profilResmi || '') + '">'
    + '<div class="profil-sekmeler">'
    + '<span class="profil-sekme aktif">Karakter</span>'
    + '</div>'
    + '<div class="profil-kart">'
    + '<div class="profil-ust">'
    + '<div class="profil-sol">'
    + '<h2 class="' + isimCls + '" id="profilIsimBaslik">' + escHtml(ad) + '</h2>'
    + '<div class="profil-avatar-kutu"><img id="profilAvatar" class="' + avatarCls.trim() + '" src="' + escHtml(avatarUrl) + '" alt="' + escHtml(ad) + '"></div>'
    + resimBtn
    + '</div>'
    + '<div class="profil-sag">'
    + '<div class="profil-meta-ust">' + metaHtml + '</div>'
    + '<div class="profil-ozet-bar">' + ozetHtml + '</div>'
    + detayHtml
    + '</div></div>'
    + formHtml
    + '<div id="profilZiyaretlerBox" class="profil-ziyaretler"></div>'
    + altBtn
    + '</div></div>';
}

function profilResimSecenekleri(anahtarlar) {
  return anahtarlar.map(function(key) {
    return { id: key, key: key, url: profilPortreUrlFromKey(key) };
  });
}

function profilResimGridHtml(anahtarlar, aktifKey) {
  var normAktif = profilPortreKeyNormalize(aktifKey);
  return profilResimSecenekleri(anahtarlar).map(function(s) {
    var secili = normAktif === s.key;
    return '<button type="button" class="profil-resim-secenek' + (secili ? ' secili' : '') + '" data-url="' + escHtml(s.url) + '" data-key="' + escHtml(s.key) + '" onclick="profilResmiUygula(this)">'
      + '<img src="' + escHtml(s.url) + '" alt="Portre">'
      + '</button>';
  }).join('');
}

function profilResimSekmeDegistir(sekme) {
  profilResimAktifSekme = sekme === 'erkek' ? 'erkek' : 'kadin';
  var modal = document.getElementById('profilResimModal');
  if (!modal) return;
  modal.querySelectorAll('.profil-resim-sekme').forEach(function(btn) {
    btn.classList.toggle('aktif', btn.getAttribute('data-sekme') === profilResimAktifSekme);
  });
  var kadinGrid = document.getElementById('profilResimGridKadin');
  var erkekGrid = document.getElementById('profilResimGridErkek');
  if (kadinGrid) kadinGrid.classList.toggle('gizli', profilResimAktifSekme !== 'kadin');
  if (erkekGrid) erkekGrid.classList.toggle('gizli', profilResimAktifSekme !== 'erkek');
}

function profilResmiSecModal() {
  var modal = document.getElementById('profilResimModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profilResimModal';
    modal.className = 'gizli';
    modal.innerHTML = '<div class="profil-resim-modal-ic">'
      + '<h3>Profil Resmi Seç</h3>'
      + '<p id="profilResimModalAciklama">Portreni seç:</p>'
      + '<div class="profil-resim-sekmeler">'
      + '<button type="button" class="profil-resim-sekme aktif" data-sekme="kadin" onclick="profilResimSekmeDegistir(\'kadin\')">Kadın</button>'
      + '<button type="button" class="profil-resim-sekme" data-sekme="erkek" onclick="profilResimSekmeDegistir(\'erkek\')">Erkek</button>'
      + '</div>'
      + '<div id="profilResimGridKadin" class="profil-resim-grid"></div>'
      + '<div id="profilResimGridErkek" class="profil-resim-grid gizli"></div>'
      + '<button type="button" class="profil-resim-modal-kapat" onclick="profilResmiModalKapat()">Kapat</button>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) profilResmiModalKapat();
    });
  }

  var wrap = document.querySelector('.profil-wrap');
  var userId = wrap ? wrap.getAttribute('data-profil-user') : (window.__benimUserId || 'me');
  var aktifKey = optsProfilResmiKey(userId);
  var kadinGrid = document.getElementById('profilResimGridKadin');
  var erkekGrid = document.getElementById('profilResimGridErkek');
  if (kadinGrid) kadinGrid.innerHTML = profilResimGridHtml(KADIN_PORTRE_ANAHTARLARI, aktifKey);
  if (erkekGrid) erkekGrid.innerHTML = profilResimGridHtml(ERKEK_PORTRE_ANAHTARLARI, aktifKey);
  profilResimSekmeDegistir(profilPortreSekmesi(aktifKey));
  modal.classList.remove('gizli');
}

function optsProfilResmiKey(userId) {
  if (String(userId) === String(window.__benimUserId) || userId === 'me') return oyuncuProfilResmi;
  var wrap = document.querySelector('.profil-wrap');
  return wrap ? wrap.getAttribute('data-profil-resmi') || '' : '';
}

function profilResmiModalKapat() {
  var modal = document.getElementById('profilResimModal');
  if (modal) modal.classList.add('gizli');
}

async function profilResmiUygula(btn) {
  if (!btn) return;
  var key = btn.getAttribute('data-key');
  if (!key) return;
  var kayitliKey = key;
  try {
    var res = await apiFetch('/api/profile', {
      method: 'POST',
      body: { profilResmi: key }
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) {
      toast(data.error || 'Profil resmi kaydedilemedi.', 'hata');
      return;
    }
    oyuncuUygula(data.player);
    kayitliKey = (data.player && data.player.profilResmi) || key;
  } catch (_) {
    toast('Profil resmi kaydı sırasında bağlantı hatası.', 'hata');
    return;
  }
  var img = document.getElementById('profilAvatar');
  if (img) {
    img.src = profilPortreUrlFromKey(kayitliKey);
    img.classList.add('profil-avatar-ozel');
  }
  var wrap = document.querySelector('.profil-wrap');
  if (wrap) wrap.setAttribute('data-profil-resmi', kayitliKey);
  profilResmiModalKapat();
  toast('Profil resmi güncellendi.', 'basari');
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function oyuncuLink(userId, isim) {
  if (!userId || !isim) return escHtml(isim || '—');
  return '<button type="button" class="oyuncu-link-btn" onclick="oyuncuProfilGoster(' + userId + ')">' + escHtml(isim) + '</button>';
}

function metindeIsimLinkleri(metin, oyuncular) {
  var s = escHtml(metin || '');
  (oyuncular || []).forEach(function(o) {
    if (!o.isim || !o.userId) return;
    var ad = escHtml(o.isim);
    var btn = '<button type="button" class="oyuncu-link-btn" onclick="oyuncuProfilGoster(' + o.userId + ')">' + ad + '</button>';
    s = s.split('[' + ad + ']').join(btn);
    s = s.split(ad).join(btn);
  });
  return s;
}

function gazeteMetindenIsimler(metin, map) {
  var re = /\[([^\]]+)\]/g;
  var m;
  while ((m = re.exec(String(metin || '')))) {
    var isim = m[1].trim();
    if (isim && !map[isim]) map[isim] = { isim: isim, userId: null };
  }
}

function gazeteOyuncuListesi(data) {
  var map = {};
  function ekle(id, isim) {
    if (id && isim && !map[isim]) map[isim] = { userId: id, isim: isim };
  }
  (data.oyuncuLinkleri || []).forEach(function(o) { ekle(o.userId, o.isim); });
  if (data.manset) {
    ekle(data.manset.hukumdarUserId, data.manset.hukumdar);
    ekle(data.manset.eskiHakimUserId, data.manset.eskiHakim);
    gazeteMetindenIsimler(data.manset.ozet, map);
    gazeteMetindenIsimler(data.manset.baslik, map);
    gazeteMetindenIsimler(data.manset.baslik2, map);
  }
  (data.sayginlikLiderleri || []).forEach(function(r) { ekle(r.userId, r.isim); });
  (data.efsaneler24 || []).forEach(function(r) { ekle(r.userId, r.isim); });
  (data.limanDurumu || []).forEach(function(l) { ekle(l.userId, l.sahipAdi); });
  (data.yeraltiManse || []).forEach(function(h) { ekle(h.userId, h.yazar); });
  (data.hakimiyetSatirlari || []).forEach(function(h) {
    ekle(h.userId, h.oyuncuAdi);
    ekle(h.kazananUserId, h.kazananAdi);
    ekle(h.kaybedenUserId, h.kaybedenAdi);
  });
  (data.sonDakika || []).forEach(function(t) { gazeteMetindenIsimler(t, map); });
  return Object.keys(map).map(function(k) { return map[k]; }).filter(function(o) { return o.userId; });
}

function gazeteLiderSatir(r, i) {
  var crown = i === 0 ? '<span class="gazete-kral">👑</span>' : '';
  var artis = r.fallback
    ? fmt(r.miktar || 0) + ' Saygınlık'
    : '+ ' + fmt(r.miktar || 0);
  var avatarUrl = profilResmiUrl(r.userId, r.profilResmi);
  var avatarCls = profilResmiOzelMi(avatarUrl) ? ' gazete-avatar-img--ozel' : '';
  return '<div class="gazete-lider-satir' + (i === 0 ? ' gazete-lider-satir--bir' : '') + '">'
    + '<span class="gazete-sira">' + crown + (i + 1) + '</span>'
    + '<span class="gazete-avatar"><img class="gazete-avatar-img' + avatarCls + '" src="' + escHtml(avatarUrl) + '" alt="" loading="lazy" onerror="imgFallback(this)"></span>'
    + '<span class="gazete-isim">' + oyuncuLink(r.userId, r.isim) + '</span>'
    + '<span class="gazete-artis">' + artis + ' <span class="gazete-yukari">▲</span></span></div>';
}

async function gazeteEkranCiz(ic) {
  ic.innerHTML = '<div class="gazete-wrap"><p class="gazete-yukleniyor">Gazete yükleniyor...</p></div>';
  try {
    var res = await apiFetch('/api/gazete');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || 'Yüklenemedi');

    yeniGazeteHaber = false;
    gazeteMenuYanip();
    apiFetch('/api/gazete/okundu', { method: 'POST', body: {} }).catch(function() {});

    var oyuncular = gazeteOyuncuListesi(data);
    var tickerItems = (data.sonDakika || []).map(function(t) {
      return '<span>' + metindeIsimLinkleri(t, oyuncular) + '</span>';
    });
    var tickerInner = tickerItems.join('<span class="gazete-ticker-dot"> • </span>');
    if (!tickerInner) tickerInner = '<span>Sokaklar sessiz... henüz son dakika haberi yok.</span>';
    var ticker = '<div class="gazete-ticker-ic">' + tickerInner + '<span class="gazete-ticker-dot"> • </span>' + tickerInner + '</div>';

    var liderHtml = '';
    (data.sayginlikLiderleri || []).forEach(function(r, i) {
      liderHtml += gazeteLiderSatir(r, i);
    });
    if (!liderHtml) liderHtml = '<p class="gazete-bos">Henüz veri yok.</p>';

    var efsaneHtml = '';
    (data.efsaneler24 || []).forEach(function(r, i) {
      var etiket = r.fallback
        ? fmt(r.miktar || 0) + ' Saygınlık'
        : '+' + fmt(r.miktar || 0) + ' Saygınlık';
      efsaneHtml += '<p class="gazete-efsane-satir"><b>' + (i + 1) + '.</b> '
        + oyuncuLink(r.userId, r.isim)
        + ' <span class="gazete-yesil">(' + etiket + ')</span></p>';
    });
    if (!efsaneHtml) efsaneHtml = '<p class="gazete-bos">Henüz efsane yok.</p>';

    var manseHtml = '';
    (data.yeraltiManse || []).forEach(function(h) {
      manseHtml += '<p><b class="gazete-yazar">' + oyuncuLink(h.userId, h.yazar) + ':</b> '
        + metindeIsimLinkleri(h.metin, oyuncular) + '</p>';
    });
    if (!manseHtml) manseHtml = '<p class="gazete-bos">Özel ilan yok.</p>';

    var hakimiyetHtml = '';
    (data.hakimiyetSatirlari || []).forEach(function(h) {
      if (h.tip === 'hukumdar') {
        hakimiyetHtml += '<p class="gazete-hakim-satir">👑 <strong>Şehre Hükmeden:</strong> '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' — üç liman ve makamlar onun elinde.</p>';
      } else if (h.tip === 'liman' && h.userId) {
        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(h.limanAd || 'Liman') + ': '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrolünde.</p>';
      } else if (h.tip === 'liman_bos') {
        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(h.limanAd || 'Liman') + ' sahipsiz.</p>';
      } else if (h.tip === 'kontrol') {
        hakimiyetHtml += '<p class="gazete-hakim-satir">👤 Şu an Liman Bölgesini '
          + oyuncuLink(h.userId, h.oyuncuAdi) + ' kontrol ediyor. Sokaklar onun kurallarıyla yönetiliyor.</p>';
      } else if (h.tip === 'degisim' && h.kazananAdi) {
        hakimiyetHtml += '<p class="gazete-hakim-satir">❌ Bölgede dengeler değişti '
          + oyuncuLink(h.kazananUserId, h.kazananAdi);
        if (h.kaybedenAdi) {
          hakimiyetHtml += ', bölgeyi ' + oyuncuLink(h.kaybedenUserId, h.kaybedenAdi) + "'den geri aldı.";
        } else {
          hakimiyetHtml += ' limanda boy gösterdi.';
        }
        hakimiyetHtml += '</p>';
      } else {
        hakimiyetHtml += '<p class="gazete-hakim-satir">' + escHtml(h.metin) + '</p>';
      }
    });
    if (!hakimiyetHtml) {
      hakimiyetHtml = '<p>' + metindeIsimLinkleri(data.sehirHakimiyeti || '—', oyuncular) + '</p>';
    }

    var manset = data.manset || {};
    var mansetImg = isGorselleri.liman_istanbul || FALLBACK;
    var mansetOzet = metindeIsimLinkleri(manset.ozet || '', oyuncular);
    var mansetBaslikHtml = '<h2 class="gazete-manset-baslik">' + metindeIsimLinkleri(manset.baslik || 'MANŞET', oyuncular) + '</h2>';
    if (manset.baslik2) {
      mansetBaslikHtml += '<h2 class="gazete-manset-baslik gazete-manset-baslik-2">'
        + metindeIsimLinkleri(manset.baslik2, oyuncular) + '</h2>';
    }

    if (aktifEkran !== 'gazete') return;
    ic.innerHTML = '<div class="gazete-wrap">'
      + '<div class="gazete-hero">'
      + '<div class="gazete-hero-ic">'
      + '<div class="gazete-hero-ust">'
      + '<div class="gazete-tarih gazete-tarih-sol">' + escHtml(data.tarihUst || '') + '</div>'
      + '<p class="gazete-alinti-ust"><em>"Bu şehirde adalet değil, güç konuşur."</em></p>'
      + '</div>'
      + '<div class="gazete-hero-orta">'
      + '<h1 class="gazete-ana-baslik">MEDYA HABER</h1>'
      + '<p class="gazete-alt-baslik">YERALTI DÜNYASININ GAZETESİ</p>'
      + '</div></div></div>'
      + '<div class="gazete-ticker">'
      + '<span class="gazete-ticker-etiket">SON DAKİKA</span>'
      + '<div class="gazete-ticker-kaydir">' + ticker + '</div></div>'
      + '<div class="gazete-govde">'
      + '<article class="gazete-manset">'
      + '<div class="gazete-manset-sol">'
      + '<span class="gazete-etiket">ŞU MAFYANIN MANŞETİ</span>'
      + mansetBaslikHtml
      + '<p class="gazete-manset-metin">' + mansetOzet + '</p>'
      + '<span class="gazete-devam">HABERİN DEVAMI &gt;</span>'
      + '</div>'
      + '<div class="gazete-manset-sag">'
      + '<img src="' + mansetImg + '" class="gazete-manset-img" alt="Manşet" onerror="imgFallback(this)">'
      + '</div></article>'
      + '<aside class="gazete-yan">'
      + '<h3 class="gazete-yan-baslik">EN ÇOK SAYGINLIK KAZANANLAR</h3>'
      + liderHtml
      + '</aside></div>'
      + '<div class="gazete-alt-uc">'
      + '<div class="gazete-kutu"><h4>ŞEHRİN HAKİMİYETİ</h4>' + hakimiyetHtml + '</div>'
      + '<div class="gazete-kutu gazete-kutu-kirmizi"><h4>YERALTI MANŞETLERİ <small>(Özel İlanlar)</small></h4>' + manseHtml + '</div>'
      + '<div class="gazete-kutu"><h4>SON 24 SAATİN EFSANELERİ</h4>' + efsaneHtml + '</div>'
      + '</div>'
      + '<div class="gazete-dekor" aria-hidden="true"></div>'
      + '</div>';
  } catch (e) {
    if (aktifEkran === 'gazete') {
      ic.innerHTML = '<h2>📰 GAZETE</h2><p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
    }
  }
}

function sesCal(tip) {
  if (!sesAyar.acik) return;
  var dosya = (tip === 'para' || tip === 'hisirti' || tip === 'atm') ? SES_DOSYALARI.para : SES_DOSYALARI.saldiri;
  if (!sesCache[dosya]) {
    sesCache[dosya] = new Audio(dosya);
  }
  var a = sesCache[dosya].cloneNode();
  a.volume = Math.max(0, Math.min(1, sesAyar.seviye));
  a.play().catch(function() {});
}

function muzikHtmlEl() {
  return document.getElementById('arkaPlanMuzik');
}

function muzikOrphanKaydet(a) {
  if (a && muzikJsOrphanlari.indexOf(a) < 0) muzikJsOrphanlari.push(a);
}

function tumMuzikKaynaklariniDurdur() {
  muzikPlayToken++;
  muzikAutoplayDinleyiciyiKaldir();

  var htmlEl = muzikHtmlEl();
  if (htmlEl) {
    try {
      htmlEl.pause();
      htmlEl.currentTime = 0;
      htmlEl.removeAttribute('src');
      htmlEl.load();
    } catch (_) {}
  }

  if (arkaPlanMuzik && arkaPlanMuzik !== htmlEl) {
    try {
      arkaPlanMuzik.pause();
      arkaPlanMuzik.currentTime = 0;
      arkaPlanMuzik.removeAttribute('src');
      arkaPlanMuzik.load();
    } catch (_) {}
  }

  muzikJsOrphanlari.forEach(function (a) {
    try {
      a.pause();
      a.currentTime = 0;
      a.removeAttribute('src');
      a.load();
    } catch (_) {}
  });
  muzikJsOrphanlari = [];
  arkaPlanMuzik = null;
}

function muzikAutoplayDinleyiciyiKaldir() {
  if (muzikAutoplayHandler) {
    document.removeEventListener('click', muzikAutoplayHandler);
    muzikAutoplayHandler = null;
  }
  muzikDinleyiciEklendi = false;
}

function muzikSeviyeGuncelle() {
  var el = arkaPlanMuzik || muzikHtmlEl();
  if (!el) return;
  if (!sesAyar.acik) {
    el.volume = 0;
    el.muted = true;
    return;
  }
  el.muted = false;
  el.volume = Math.max(0, Math.min(1, sesAyar.seviye * MUZIK_SEVIYE_ORANI));
}

function muzikBaslat() {
  if (!sesAyar.acik) {
    tumMuzikKaynaklariniDurdur();
    return;
  }

  var el = muzikHtmlEl();
  if (!el) return;
  arkaPlanMuzik = el;

  if (!el.getAttribute('src')) {
    el.src = SES_DOSYALARI.muzik;
    el.loop = true;
    el.preload = 'auto';
  }

  muzikSeviyeGuncelle();
  if (!el.paused && !el.ended) return;

  var token = muzikPlayToken;
  var playPromise = el.play();
  if (!playPromise || !playPromise.then) return;

  playPromise.then(function () {
    if (!sesAyar.acik || token !== muzikPlayToken) {
      tumMuzikKaynaklariniDurdur();
    }
  }).catch(function () {
    if (!sesAyar.acik || token !== muzikPlayToken) return;
    if (muzikDinleyiciEklendi) return;
    muzikDinleyiciEklendi = true;
    muzikAutoplayHandler = function (e) {
      muzikAutoplayHandler = null;
      muzikDinleyiciEklendi = false;
      if (e && e.target && e.target.closest && e.target.closest('#sesKontrol')) return;
      muzikBaslat();
    };
    document.addEventListener('click', muzikAutoplayHandler, { once: true });
  });
}

function muzikDurdur() {
  tumMuzikKaynaklariniDurdur();
}

function sesUiGuncelle() {
  var btn = document.getElementById('sesAcKapa');
  var sl = document.getElementById('sesSeviye');
  if (btn) btn.textContent = sesAyar.acik ? '🔊' : '🔇';
  if (sl) sl.value = Math.round(sesAyar.seviye * 100);
}

function sesToggle() {
  sesAyar.acik = !sesAyar.acik;
  localStorage.setItem('sesAcik', sesAyar.acik ? '1' : '0');
  sesUiGuncelle();
  if (sesAyar.acik) {
    muzikBaslat();
  } else {
    muzikDurdur();
  }
}

function sesSeviyeDegistir(val) {
  sesAyar.seviye = Math.max(0, Math.min(1, val / 100));
  localStorage.setItem('sesSeviye', String(sesAyar.seviye));
  muzikSeviyeGuncelle();
}

function sesKontroluBagla() {
  var kutu = document.getElementById('sesKontrol');
  var btn = document.getElementById('sesAcKapa');
  var sl = document.getElementById('sesSeviye');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  if (kutu) {
    kutu.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    kutu.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    sesToggle();
  });
  if (sl) {
    sl.addEventListener('input', function (e) {
      e.stopPropagation();
      sesSeviyeDegistir(this.value);
    });
  }
  sesUiGuncelle();
  if (!sesAyar.acik) muzikDurdur();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sesKontroluBagla);
} else {
  sesKontroluBagla();
}

// ========================
// EKRAN DEĞİŞTİR
// ========================
var ML_EKRAN_BASLIKLARI = {
  liderlik: 'LİDERLİK TABLOSU',
  profilim: 'PROFİLİM',
  guvenliYer: 'GÜVENLİ YER',
  gunlukGorevler: 'GÜNLÜK GÖREVLER',
  guclen: 'GÜÇLEN',
  korumaEkibi: 'KORUMA EKİBİ',
  silahlan: 'SİLAHANLANMA',
  luksYasam: 'LÜKS YAŞAM',
  buyume: 'BÜYÜME ADIMLARI',
  mekan: 'MEKAN SAHİBİ',
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
  gazete: 'GAZETE',
  sehreHukmet: 'ŞEHRE HÜKMET',
  baba_soz: 'SÖZÜNÜ GEÇİR',
  baba_sadakat: 'SADAKAT YEMİNİ',
  liman: 'LİMAN İŞLETMELERİ',
  mesajKutusu: 'MESAJ KUTUSU',
  mafyaSohbet: 'MAFYA SOHBETLERİ',
  dusmanaCok: 'DÜŞMANA ÇÖK',
  karaListe: 'KARA LİSTE',
  devletIliskisi: 'AVUKAT',
  sehirTarihi: 'ŞEHİR TARİHİ'
};

var ML_MAFYA_BASLIKLARI = {
  olustur: 'MAFYA GRUBU OLUŞTUR',
  katil: 'MAFYAYA KATIL',
  gurubum: 'MAFYA GRUBUM',
  savaslar: 'MAFYA SAVAŞLARI',
  isler: 'MAFYA İŞLERİ',
  evi: 'MAFYA EVİ'
};

function masterFramePlaqueGuncelle(tip, altBaslik) {
  var el = document.getElementById('masterFramePlaque');
  if (!el) return;
  if (tip === 'baba_sadakat') {
    el.textContent = ML_EKRAN_BASLIKLARI[tip] || 'SADAKAT YEMİNİ';
    return;
  }
  if (altBaslik) {
    el.textContent = altBaslik;
    return;
  }
  if (tip === 'liderlik') {
    el.textContent = 'LİDERLİK TABLOSU';
    return;
  }
  el.textContent = ML_EKRAN_BASLIKLARI[tip]
    || String(tip).replace(/_/g, ' ').toUpperCase();
}

function sidebarMenuAktif(tip) {
  var kok = document.getElementById('sidebarMenu');
  if (!kok) return;
  var btns = kok.querySelectorAll('.ml-menu-item');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('aktif-menu');
  var hedef = null;
  for (var j = 0; j < btns.length; j++) {
    var oc = btns[j].getAttribute('onclick') || '';
    if (oc.indexOf("ekranDegistir('" + tip + "'") !== -1 || oc.indexOf('mafyaMenuSec(') !== -1 && tip === 'mafya') {
      hedef = btns[j];
      break;
    }
  }
  if (!hedef) {
    var altMap = {
      guclen: 'guclenMenuBtn',
      korumaEkibi: 'guclenMenuBtn', silahlan: 'guclenMenuBtn', luksYasam: 'guclenMenuBtn',
      buyume: 'buyumeMenuBtn',
      mahalle: 'buyumeMenuBtn', semt: 'buyumeMenuBtn', sehir: 'buyumeMenuBtn',
      mekan: 'mekanMenuBtn',
      sektor_yeralti: 'mekanMenuBtn', sektor_silah: 'mekanMenuBtn', sektor_paket: 'mekanMenuBtn',
      mekan_devri: 'mekanDevriMenuBtn',
      sehreHukmet: 'babaMenuBtn',
      baba_soz: 'babaMenuBtn', baba_sadakat: 'babaMenuBtn', liman: 'babaMenuBtn',
      mesajKutusu: 'sohbetMenu', mafyaSohbet: 'sohbetMenu'
    };
    var menuId = altMap[tip];
    if (menuId) {
      var altBtn = document.getElementById(menuId);
      if (altBtn) hedef = altBtn;
      else {
        var alt = document.getElementById(menuId);
        if (alt && alt.previousElementSibling) hedef = alt.previousElementSibling;
      }
    }
  }
  if (hedef) {
    hedef.classList.add('aktif-menu');
    mobilMenuOgeyeKaydir(hedef);
  }
}

function ekranDegistir(tip) {
  if (tip !== 'profilim' && tip !== 'profil_ziyaret') profilIcraatTimerDurdur();
  if (tip !== 'profilim') profilQuillYokEt();
  mobilAltMenuKapat();
  var oyunScroll = document.getElementById('oyunEkran');
  if (oyunScroll) oyunScroll.scrollTop = 0;
  aktifEkran = tip;
  masterFramePlaqueGuncelle(tip);
  sehirBannerGuncelle();
  sidebarMenuAktif(tip);
  var ic = document.getElementById('anaIcerik');
  if (tip === 'liderlik') {
    ic.innerHTML = '<p style="color:#888;text-align:center;">Yükleniyor...</p>';
    liderlikTablosuCiz(ic);
    return;
  }

  if (tip === 'profilim') {
    profilZiyaretOkundu();
    ic.innerHTML = profilEkranSablonu({
      duzenlenebilir: true,
      userId: window.__benimUserId || 'me',
      profilResmi: oyuncuProfilResmi,
      oyuncuAdi: aktifReisAdi,
      lakap: aktifLakap,
      guc: oyuncuGuc,
      puan: oyuncuPuan,
      saatlik: saatlikKazanc,
      karaListede: karaListede,
      sehirEfsane: sehirEfsane,
      icraatKalan: profilSureFormat(profilIcraatKalanSn(
        oyuncuIcraat,
        oyuncuLastIcraatAt,
        oyuncuIcraatRegenSec,
        oyuncuIcraatSaatlikBonus
      ))
    });
    profilIcraatTimerOyuncudan();
    profilQuillBaslat();
    profilYukle();
    return;
  }

  if (tip === 'guvenliYer') {
    ic.innerHTML = guvenliYerHTML();
    guvenliYerResizeBagla();
    guvenliYerYukle();
    return;
  }

  if (tip === 'gunlukGorevler') {
    ic.innerHTML = gunlukGorevlerHTML();
    gunlukGorevlerYukle();
    gunlukGorevBildirimGuncelle();
    return;
  }

  if (tip === 'devletIliskisi') {
    ic.innerHTML = avukatHTML();
    return;
  }

  if (tip === 'mesajKutusu') {
    mesajKutusuCiz(ic);
    return;
  }

  if (tip === 'mafyaSohbet') {
    mafyaSohbetCiz(ic);
    return;
  }

  if (tip === 'sektor_yeralti') { sektorEkranCiz(ic, 'yeralti', 'YERALTI SEKTÖRÜ'); return; }
  if (tip === 'sektor_silah') { sektorEkranCiz(ic, 'silah', 'SİLAH SEKTÖRÜ'); return; }
  if (tip === 'sektor_paket') { sektorEkranCiz(ic, 'paket', 'PAKET SEKTÖRÜ'); return; }

  if (tip === 'guclen') {
    ic.innerHTML = guclenHubHTML();
    return;
  }

  if (tip === 'buyume') {
    ic.innerHTML = buyumeHubHTML();
    return;
  }

  if (tip === 'mekan') {
    ic.innerHTML = mekanHubHTML();
    return;
  }

  if (tip === 'sehreHukmet') {
    ic.innerHTML = sehreHukmetHubHTML();
    return;
  }

  if (tip === 'korumaEkibi') { guclenAltEkranCiz('korumaEkibi', ic); return; }
  if (tip === 'silahlan') { guclenAltEkranCiz('silahlan', ic); return; }
  if (tip === 'luksYasam') { guclenAltEkranCiz('luksYasam', ic); return; }

  if (tip === 'mahalle') {
    ic.innerHTML = '<h2>🏡 MAHALLE İŞLERİ</h2><p>"Küçük işlerle sermaye yap."</p>'
      + isKartHTML(isGorselleri.market, '🛒 Köşedeki Marketi Haraca Bağla', '+800 TL', '1 İcraat', '300 Güç', "isYap('market')")
      + isKartHTML(isGorselleri.tamirhane, '🔧 Kaçak Otomobil Tamirhanesi', '+1.500 TL', '1 İcraat', '600 Güç', "isYap('tamirhane')")
      + isKartHTML(isGorselleri.koruma, '🛡️ Esnafa Güvence Sağla', '+2.800 TL', '2 İcraat', '1.200 Güç', "isYap('esnafa_guvence')")
      + isKartHTML(isGorselleri.kumarhane, '🎲 Gizli Yeraltı Zar Salonu Aç', '+4.500 TL', '2 İcraat', '2.500 Güç', "isYap('zar_salonu')");
    return;
  }

  if (tip === 'semt') {
    ic.innerHTML = '<h2>🏢 SEMT İŞLERİ</h2><p>"Semtte söz sahibi ol."</p>'
      + isKartHTML(isGorselleri.gece_kulubu, '🏢 Lüks Gece Kulübü Güvenliği', '+12.000 TL', '3 İcraat', '6.000 Güç', "isYap('gece_kulubu')")
      + isKartHTML(isGorselleri.kumarhane_agi, '🎰 Semtin Kumarhane Ağını Ele Geçir', '+18.000 TL', '3 İcraat', '8.000 Güç', "isYap('kumarhane_agi')")
      + isKartHTML(isGorselleri.kara_para, '💰 Kara Para Aklamanın Yolunu Aç', '+25.000 TL', '4 İcraat', '10.000 Güç', "isYap('kara_para')")
      + isKartHTML(isGorselleri.galeri, '🖼️ Semt Galerisine Çök', '+32.000 TL', '4 İcraat', '12.000 Güç', "isYap('semt_galeri')");
    return;
  }

  if (tip === 'sehir') {
    ic.innerHTML = '<h2>🌆 ŞEHİR İŞLERİ</h2><p>"Şehrin zirvesindekiler ihaleleri yönetir."</p>'
      + isKartHTML(isGorselleri.lojistik, '🏗️ Büyük Lojistik İhalesini Al', '+45.000 TL', '5 İcraat', '15.000 Güç', "isYap('lojistik')")
      + isKartHTML(isGorselleri.gumruk, '🚢 Gümrük Müdürünü Satın Al', '+80.000 TL', '6 İcraat', '25.000 Güç', "isYap('gumruk')")
      + isKartHTML(isGorselleri.belediye, '🏛️ Belediye İhalesine El At', '+120.000 TL', '8 İcraat', '40.000 Güç', "isYap('belediye')")
      + isKartHTML(isGorselleri.holding, '🏢 Büyük Holdinge Güvence Sağla', '+200.000 TL', '10 İcraat', '55.000 Güç', "isYap('buyuk_holding')");
    return;
  }

  if (tip === 'liman') {
    ic.innerHTML = '<h2>🚢 LİMAN İŞLETMELERİ</h2>'
      + '<p>"Boğazdan Akdeniz\'e — güçlü olan limanı alır. Saatlik gelir sahibine otomatik işler."</p>'
      + HUKUM_SAVUNMA_NOTU
      + '<p class="liman-gelir-notu">⏱️ Türkiye saatiyle her saat başı liman başına <b>100.000 TL</b> kazanırsın. '
      + '<b>Üç limanı birden elinde tutarsan saatlik toplam 500.000 TL kazanırsın!</b></p>'
      + limanKartHTML('istanbul') + limanKartHTML('izmir') + limanKartHTML('hatay');
    return;
  }

  if (tip === 'baba_soz') {
    ic.innerHTML = sozunuGecirHTML();
    return;
  }

  if (tip === 'baba_sadakat') {
    ic.innerHTML = sadakatYeminiHTML();
    return;
  }

  if (tip === 'dusmanaCok') {
    dusmanBulunanHedef = null;
    dusmanRakipListesi = [];
    ic.innerHTML = dusmanPanelHTML();
    dusmanEkranBagla();
    return;
  }

  if (tip === 'istihbarat') {
    ic.innerHTML = istihbaratPanelHTML();
    istihbaratEkranBagla();
    return;
  }

  if (tip === 'banka') {
    ic.innerHTML = bankaPanelHTML();
    bankaEkranBagla();
    return;
  }

  if (tip === 'gazete') {
    gazeteEkranCiz(ic);
    return;
  }

  if (tip === 'mekan_devri') {
    ic.innerHTML = mekanDevriHTML();
    mekanDevriEkranBagla();
    return;
  }

  if (tip === 'medya') {
    ic.innerHTML = medyaHTML();
    medyaHaberleriYukle();
    return;
  }

  if (tip === 'mafya') {
    mafyaMenuSec('gurubum');
    return;
  }

  if (tip === 'karaListe') {
    karaListeCiz(ic);
    return;
  }

  if (tip === 'sehirTarihi') {
    sehirTarihiEkranCiz(ic);
    return;
  }
}

function profilTrTarih(ts) {
  if (!ts) return '—';
  var n = Number(ts);
  if (!n) return '—';
  return new Date(n * 1000).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function hukumGunSayisi(baslangic, bitis, aktif) {
  var bas = Number(baslangic);
  if (!bas) return 0;
  var bit = bitis ? Number(bitis) : Math.floor(Date.now() / 1000);
  return Math.max(1, Math.floor(Math.max(0, bit - bas) / 86400) + 1);
}

async function sehirTarihiEkranCiz(ic) {
  ic.innerHTML = '<h2>📜 ŞEHİR TARİHİ</h2><p style="color:#888;">Yükleniyor...</p>';
  if (!sunucuBagli) {
    ic.innerHTML = '<h2>📜 ŞEHİR TARİHİ</h2><p style="color:#c00;">Sunucu kapalı.</p>';
    return;
  }
  try {
    var res = await apiFetch('/api/sehir-tarihi');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || 'Yüklenemedi');
    var liste = data.liste || [];
    var html = '<h2>📜 ŞEHİR TARİHİ</h2>'
      + '<h3 style="margin:16px 0 10px;color:#b8942a;">ŞEHRE HÜKMEDENLERİN İSİMLERİ:</h3>';
    if (!liste.length) {
      html += '<p style="color:#888;">Henüz şehir tarihine işlenmiş hükümdar yok.</p>';
      ic.innerHTML = html;
      return;
    }
    liste.forEach(function(k) {
      var adCls = k.aktif ? ' style="color:#ffd700;font-weight:700;"' : '';
      var basTxt = k.baslangic ? profilTrTarih(k.baslangic) : (k.baslangicMetin || '—');
      var bitTxt = k.bitis ? profilTrTarih(k.bitis) : (k.bitisMetin || '');
      var gun = hukumGunSayisi(k.baslangic, k.bitis, k.aktif);
      if (!gun && k.gunSayisi > 0) gun = k.gunSayisi;
      var gunTxt = gun + ' gün';
      html += '<div class="is-kart" style="margin-bottom:12px;">'
        + '<p><b' + adCls + '>👑 ' + k.hukumdarAdi
        + (k.aktif ? ' (Şu an · ' + gunTxt + ')' : ' · ' + gunTxt) + '</b></p>'
        + '<p>📅 Başlangıç: ' + basTxt + '</p>';
      if (k.aktif) {
        html += '<p>📅 Bitiş: <b>Devam ediyor</b></p>';
      } else if (bitTxt) {
        html += '<p>📅 Bitiş: ' + bitTxt + '</p>';
      }
      html += '<p>⏳ Süre: <b>' + gunTxt + '</b></p>';
      if (k.oncekiReisAdi) html += '<p>🔄 Kimden aldı: <b>' + k.oncekiReisAdi + '</b></p>';
      if (k.kaybedenReisAdi && !k.aktif) html += '<p>💀 Kaybeden: <b>' + k.kaybedenReisAdi + '</b></p>';
      html += '</div>';
    });
    ic.innerHTML = html;
  } catch (e) {
    ic.innerHTML = '<h2>📜 ŞEHİR TARİHİ</h2><p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
  }
}

function karaListeSayfaHTML() {
  return '<div class="kl-sayfa"><div class="kl-cerceve">'
    + '<div class="kl-banner"><div class="kl-banner-ortu"></div>'
    + '<div class="kl-baslik-wrap">'
    + '<span class="kl-baslik-ikon" aria-hidden="true">💀</span>'
    + '<h2>KARA LİSTE</h2>'
    + '<p class="kl-motto">"Şehre hükmeden reis burada görünür."</p>'
    + '</div></div>'
    + '<div class="kl-govde">'
    + '<div class="kl-hukumdar-kutu">'
    + '<p class="kl-hukumdar-metin">Şehir şu an <span class="kl-hukumdar-isim" id="klHukumdarIsim">…</span> tarafından yönetiliyor!</p>'
    + '</div>'
    + '<p class="kl-aciklama">Şehre Hükmet sahibinden Liman, Söz veya Sadakat alındığında kazanan, rakibin saygınlığının %5\'ini ödül olarak alır.</p>'
    + '<div class="kl-tablo-wrap">'
    + '<div class="kl-tablo-baslik"><span>OYUNCU</span><span>MAFYA GRUBU</span><span>SAYGINLIK</span></div>'
    + '<div id="klListe" class="kl-tablo-govde"><p class="kl-yukleniyor">Yükleniyor…</p></div>'
    + '</div></div></div></div>';
}

function klGrupLinkHtml(grup, grupId) {
  return ltGrupLinkHtml(grup, grupId, null);
}

function karaListeSatirlariHTML(liste) {
  if (!liste.length) {
    return '<p class="kl-bos">Şu an kara listede kimse yok.</p>';
  }
  return liste.map(function(r) {
    return '<div class="kl-satir">'
      + '<span class="kl-hucre kl-hucre--oyuncu">' + oyuncuLink(r.user_id, r.reis_adi) + '</span>'
      + '<span class="kl-hucre kl-hucre--grup">' + klGrupLinkHtml(r.grup, r.grup_id) + '</span>'
      + '<span class="kl-hucre kl-hucre--sayginlik">' + fmt(r.puan || 0) + '</span>'
      + '</div>';
  }).join('');
}

async function karaListeCiz(ic) {
  ic.innerHTML = karaListeSayfaHTML();
  if (!sunucuBagli) {
    var kapaliEl = document.getElementById('klListe');
    var hukumdarKapali = document.getElementById('klHukumdarIsim');
    if (hukumdarKapali) hukumdarKapali.textContent = '—';
    if (kapaliEl) kapaliEl.innerHTML = '<p class="kl-hata">Sunucu kapalı.</p>';
    return;
  }
  try {
    var res = await apiFetch('/api/kara-liste');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    var liste = data.liste || [];
    var hukumdarEl = document.getElementById('klHukumdarIsim');
    var listeEl = document.getElementById('klListe');
    if (hukumdarEl) {
      hukumdarEl.innerHTML = liste.length
        ? oyuncuLink(liste[0].user_id, liste[0].reis_adi)
        : '—';
    }
    if (listeEl) listeEl.innerHTML = karaListeSatirlariHTML(liste);
  } catch (e) {
    var hataEl = document.getElementById('klListe');
    var hukumdarHata = document.getElementById('klHukumdarIsim');
    if (hukumdarHata) hukumdarHata.textContent = '—';
    if (hataEl) hataEl.innerHTML = '<p class="kl-hata">' + escHtml(e.message || 'Yüklenemedi') + '</p>';
  }
}

// ========================
// AKSİYONLAR
// ========================
function adetOku(key) {
  var el = document.getElementById('adet-' + key);
  var n = parseInt(el && el.value, 10);
  if (!n || n < 1) return 1;
  return n > 999 ? 999 : n;
}

async function adamKirala(key) {
  var ef = await sunucuAksiyon('hire', key, adetOku(key));
  if (!ef) return;
  toast('⚔️ ' + ef.unvan + (ef.adet > 1 ? ' x' + ef.adet : '') + ' — Güç +' + fmt(ef.guc), 'basari');
  if (aktifEkran === 'korumaEkibi' || aktifEkran === 'silahlan' || aktifEkran === 'luksYasam') {
    ekranDegistir(aktifEkran);
  }
}

async function isYap(key) {
  var ef = await sunucuAksiyon('job', key);
  if (!ef) return;
  pencereAc(ef.isAdi, ef.netKazanc, ef.icraat, isGorselleri[ef.gorselKey] || FALLBACK, ef.devletDusus, ef.yeniDevletIliski);
  if (ef.devletDusus) {
    toast('Avukat ilişkin ' + ef.devletDusus + ' puan düştü.', 'uyari');
  }
}

async function limanCok(id) {
  var lim = limanBul(id);
  if (lim.sahipAdi === aktifReisAdi) {
    toast('Bu liman zaten sizin Reis!', 'altin');
    return;
  }
  var ef = await sunucuAksiyon('liman_cok', id);
  if (ef === null) return;
  sesCal('saldiri');
  toast((ef && ef.mesaj) || 'Liman ele geçirildi!', 'basari');
  ekranDegistir('liman');
}

async function babaCok(makam) {
  var ef = await sunucuAksiyon('baba_cok', makam);
  if (!ef) return;
  sesCal('saldiri');
  toast(ef.mesaj, 'basari');
  ekranDegistir(makam === 'sadakat_yemini' ? 'baba_sadakat' : 'baba_soz');
}

async function babaDerkiKaydet(makam) {
  var el = document.getElementById('babaDerki-' + makam);
  var ef = await sunucuAksiyon('baba_derki', makam, null, { metin: el ? el.value : '' });
  if (ef) toast('Baba sözü kaydedildi.', 'basari');
}

async function sadakatOy(oy) {
  var ef = await sunucuAksiyon('sadakat_oy', oy);
  if (ef) {
    toast(oy === 'tani' ? 'Sadakat yemini ettin.' : 'Reddettin.', 'basari');
    ekranDegistir('baba_sadakat');
  }
}

async function dusmanaSaldir(hedefAdi) {
  var hedef = document.getElementById('dusmanHedef');
  var ad = hedefAdi || (hedef && hedef.value.trim()) || (dusmanBulunanHedef && dusmanBulunanHedef.reisAdi) || '';
  if (!ad) {
    toast('Önce düşman ara!', 'hata');
    return;
  }
  var ef = await sunucuAksiyon('dusmana_cok', null, null, { hedef: ad });
  if (ef === null) return;
  sesCal('saldiri');
  var box = document.getElementById('dusmanSonuc');
  if (box && ef.mesaj) {
    box.innerHTML = '<div class="saldiri-sonuc"></div>';
    box.firstChild.textContent = ef.mesaj;
  } else {
    toast(ef.mesaj || 'Saldırı tamamlandı.', ef.kazandi ? 'basari' : 'hata');
  }
  dusmanBulunanHedef = null;
}

async function istihbaratAl() {
  var ef = await sunucuAksiyon('istihbarat_al', null, adetOku('istihbarat'));
  if (ef === null) return;
  toast('🕵️ ' + ef.elemanSayisi + ' eleman alındı! — ' + fmt(ef.odenen) + ' TL', 'basari');
  istihbaratEleman = ef.elemanSayisi;
  istihbaratBirimMaliyet = ef.sonrakiBirimMaliyet || istihbaratBirimMaliyetHesap(istihbaratEleman);
  var sayiEl = document.getElementById('istihbaratElemanSayi');
  if (sayiEl) sayiEl.textContent = String(ef.elemanSayisi);
  var maliyetEl = document.getElementById('istihbaratBirimMaliyet');
  if (maliyetEl) maliyetEl.textContent = fmt(istihbaratBirimMaliyet) + ' TL';
}

async function istihbaratSpy() {
  var hedef = document.getElementById('istihbaratHedef').value.trim();
  if (!hedef) {
    toast('Hedef gir.', 'hata');
    return;
  }
  var ef = await sunucuAksiyon('istihbarat_spy', null, null, { hedef });
  if (ef === null) return;
  if (ef.basari) {
    if (ef.guc !== null) {
      istihbaratSonucGoster(
        escHtml(ef.mesaj) + '<span class="istih-sonuc-guc">⚔️ Güç: ' + fmt(ef.guc) + '</span>',
        'basari'
      );
    } else {
      istihbaratSonucGoster(escHtml(ef.mesaj), 'uyari');
    }
  } else {
    istihbaratSonucGoster(escHtml(ef.mesaj), 'hata');
  }
}

async function bankaYatir() {
  var miktar = bankaMiktarOku('bankaYatirMiktar');
  if (miktar < 1) {
    toast('Geçerli bir miktar gir.', 'hata');
    return;
  }
  var btn = document.getElementById('bankaYatirBtn');
  if (btn) btn.disabled = true;
  var ef = await sunucuAksiyon('banka_yatir', null, null, { miktar: miktar });
  if (btn) btn.disabled = false;
  if (ef === null) return;
  sesCal('para');
  toast('💰 ' + fmt(ef.yatirilan) + ' TL yatırıldı! — Toplam: ' + fmt(ef.toplam) + ' TL', 'basari');
  ekranDegistir('banka');
}

async function bankaCek() {
  var miktar = bankaMiktarOku('bankaCekMiktar');
  if (miktar < 1) {
    toast('Geçerli bir miktar gir.', 'hata');
    return;
  }
  var btn = document.getElementById('bankaCekBtn');
  if (btn) btn.disabled = true;
  var ef = await sunucuAksiyon('banka_cek', null, null, { miktar: miktar });
  if (btn) btn.disabled = false;
  if (ef === null) return;
  sesCal('para');
  toast('💸 ' + fmt(ef.cekilen) + ' TL çekildi!', 'basari');
  ekranDegistir('banka');
}

async function mekanDevret() {
  var hedef = (document.getElementById('mekanDevriHedef') || {}).value.trim();
  var sk = (document.getElementById('mekanDevriMekan') || {}).value;
  var adet = parseInt((document.getElementById('mekanDevriAdet') || {}).value, 10) || 1;
  if (!hedef) { toast('Dost reis adını yaz.', 'hata'); return; }
  if (!sk) { toast('Devredilecek mekanı seç.', 'hata'); return; }
  var p = sk.split(':');
  var ef = await sunucuAksiyon('mekan_devri', null, null, {
    hedef: hedef,
    sektor: p[0],
    mekanKey: p[1],
    adet: adet
  });
  if (ef === null) return;
  var sonucDiv = document.getElementById('mekanDevriSonuc');
  if (sonucDiv) {
    sonucDiv.classList.remove('gizli');
    sonucDiv.className = 'md-sonuc md-sonuc--basari';
    sonucDiv.innerHTML = '✅ ' + escHtml(ef.mesaj || 'Mekan devredildi.');
  }
  toast(ef.mesaj || 'Mekan devredildi.', 'basari');
}

async function paraGonder() {
  var hedef = (document.getElementById('paraGonderHedef') || {}).value.trim();
  var miktar = parseInt((document.getElementById('paraGonderMiktar') || {}).value, 10) || 0;
  if (!hedef) { toast('Alıcı reis adını yaz.', 'hata'); return; }
  if (miktar < 1) { toast('Geçerli bir miktar gir.', 'hata'); return; }
  var ef = await sunucuAksiyon('para_gonder', null, null, {
    hedef: hedef,
    miktar: miktar
  });
  if (ef === null) return;
  var sonucDiv = document.getElementById('paraGonderSonuc');
  if (sonucDiv) {
    sonucDiv.classList.remove('gizli');
    sonucDiv.className = 'md-sonuc md-sonuc--basari';
    sonucDiv.innerHTML = '✅ ' + escHtml(ef.mesaj || fmt(miktar) + ' TL gönderildi.');
  }
  toast(ef.mesaj || fmt(miktar) + ' TL gönderildi.', 'basari');
}

async function medyaHaberYayinla() {
  var haber = document.getElementById('medyaHaber').value.trim();
  if (!haber || haber.length < 5) {
    toast('Haber metni çok kısa.', 'hata');
    return;
  }
  var ef = await sunucuAksiyon('medya_haber', null, null, { haber });
  if (ef === null) return;
  var sonucDiv = document.getElementById('medyaSonuc');
  if (!sonucDiv) return;
  sonucDiv.classList.remove('gizli');
  sonucDiv.className = 'med-sonuc med-sonuc--basari';
  sonucDiv.innerHTML = '✅ ' + escHtml(ef.mesaj || 'Haber yayınlandı.');
  document.getElementById('medyaHaber').value = '';
  medyaHaberleriYukle();
}

async function medyaHaberleriYukle() {
  try {
    var res = await apiFetch('/api/medya/haberler');
    var data = await res.json();
    var box = document.getElementById('medyaHaberlerListesi');
    if (!data.ok || !data.haberler || !data.haberler.length) {
      if (box) box.innerHTML = '<p class="med-haber-bos">Henüz aktif haber yok — ilk manşeti sen düşür.</p>';
      return;
    }
    var html = '';
    data.haberler.forEach(function(h) {
      var zaman = medyaZamanGoster(h.created_at);
      var avatarUrl = profilResmiUrl(h.user_id, h.profil_resmi);
      var avatarCls = profilResmiOzelMi(avatarUrl) ? ' med-haber-avatar-img--ozel' : '';
      html += '<article class="med-haber-kart">'
        + '<div class="med-haber-ust">'
        + '<div class="med-haber-kaynak"><span class="med-haber-avatar">'
        + '<img class="med-haber-avatar-img' + avatarCls + '" src="' + escHtml(avatarUrl) + '" alt="" loading="lazy" onerror="imgFallback(this)">'
        + '</span>'
        + '<span class="med-haber-reis">' + escHtml(h.reis_adi || 'Anonim') + '</span></div>'
        + (zaman ? '<span class="med-haber-zaman">' + escHtml(zaman) + '</span>' : '')
        + '</div>'
        + '<p class="med-haber-metin">' + escHtml(h.haber) + '</p>'
        + '</article>';
    });
    if (box) box.innerHTML = html;
  } catch (e) {
    console.error(e);
  }
}

async function mafyaMenuSec(mod) {
  aktifEkran = 'mafya';
  masterFramePlaqueGuncelle('mafya', ML_MAFYA_BASLIKLARI[mod] || 'MAFYA GRUBU');
  var ic = document.getElementById('anaIcerik');
  ic.innerHTML = '<div id="mafyaAltIcerik" class="mafya-alt-icerik"></div>';
  var zatenUye = false;
  if ((mod === 'olustur' || mod === 'katil') && sunucuBagli) {
    try {
      var chkRes = await apiFetch('/api/mafya');
      var chkData = await chkRes.json().catch(function() { return {}; });
      if (chkRes.ok && chkData.uyelik) zatenUye = true;
    } catch (_) {}
  }
  mafyaAltEkran(mod, zatenUye);
  mafyaBildirimKontrol();
}

async function mafyaTumGuruplariGoster(hedefId) {
  var box = document.getElementById(hedefId || 'mafyaGurupListeEk');
  if (!box || !sunucuBagli) return;
  try {
    var res = await apiFetch('/api/mafya');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || data.ok === false) return;
    box.innerHTML = mafyaGurupListesiHTML(data.tumGruplar, true);
  } catch (_) {}
}

async function mafyaBildirimKontrol() {
  if (!sunucuBagli) return;
  try {
    var res = await apiFetch('/api/mafya');
    if (!res.ok) return;
    var data = await res.json();
    mafyaBildirim = !!(data.basvurular && data.basvurular.length) || !!data.bekleyenBasvuru;
    mafyaMenuYanip();
  } catch (_) {}
}

function mafyaAltEkran(mod, zatenUye) {
  var box = document.getElementById('mafyaAltIcerik');
  if (!box) return;
  if ((mod === 'olustur' || mod === 'katil') && zatenUye) {
    box.innerHTML = '<p class="mafya-uyelik-uyari">Zaten bir mafya gurubuna üyesin!</p>';
    return;
  }
  if (mod === 'olustur') {
    box.innerHTML = '<div class="mafya-form is-kart">'
      + '<h3 class="bolum-baslik">Mafya Grubu Oluştur</h3>'
      + '<p class="mafya-metin-dim">Grubunu kur, üyelerini topla, şehirde söz sahibi ol.</p>'
      + '<input type="text" id="mafyaIsim" placeholder="Grup adı" maxlength="32">'
      + '<button type="button" class="btn-is" onclick="mafyaOlusturAdim1()">[ OLUŞTUR ]</button>'
      + '<div id="mafyaAciklamaAlan" class="gizli"><label>Açıklama:</label>'
      + '<textarea id="mafyaAciklama" rows="3" maxlength="200" placeholder="Grubun hakkında..."></textarea>'
      + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaOlusturAdim2()">[ GRUBU KUR ]</button></div></div>'
      + '<div id="mafyaGurupListeEk" class="mafya-grup-liste" style="margin-top:16px;"></div>';
    mafyaTumGuruplariGoster('mafyaGurupListeEk');
    return;
  }
  if (mod === 'katil') {
    box.innerHTML = '<div class="mafya-form is-kart">'
      + '<h3 class="bolum-baslik">Mafya Grubuna Katıl</h3>'
      + '<p class="mafya-metin-dim">Mevcut bir gruba başvur veya listeden seç.</p>'
      + '<input type="text" id="mafyaAra" placeholder="Grup adı yaz">'
      + '<button type="button" class="btn-is mavi-btn" onclick="mafyaAra()">[ ARA ]</button>'
      + '<div id="mafyaAraSonuc" style="margin-top:14px;"></div></div>'
      + '<div id="mafyaGurupListeEk" class="mafya-grup-liste" style="margin-top:16px;"></div>';
    mafyaTumGuruplariGoster('mafyaGurupListeEk');
    return;
  }
  if (mod === 'gurubum' || mod === 'evi' || mod === 'savaslar') {
    mafyaGurubumCiz(box);
    return;
  }
  if (mod === 'isler') {
    mafyaIslerCiz(box);
  }
}

async function mafyaIslerCiz(box) {
  box.innerHTML = '<p class="mafya-yukleniyor">Yükleniyor...</p>';
  if (!sunucuBagli) { box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">Sunucu kapalı.</p>'; return; }
  try {
    var res = await apiFetch('/api/mafya/isler');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.panel) throw new Error(data.error || 'Yüklenemedi');
    var panel = data.panel;
    if (!panel.grup) {
      box.innerHTML = '<div class="mafya-isler-wrap"><h2>💼 MAFYA İŞLERİ</h2><p class="mafya-metin">Mafya grubuna üye olmadan bu işleri yapamazsın.</p></div>';
      return;
    }
    var aktif = panel.aktifIs;
    var aktifKey = aktif ? aktif.isTuru : null;
    var html = '<div class="mafya-isler-wrap"><h2>💼 MAFYA İŞLERİ</h2>'
      + '<p>"Online üyelerle birlikte soyguna hazırlan, şartlar tutunca soygunu gerçekleştir."</p>'
      + '<div class="is-kart mafya-isler-ozet">'
      + '<p><b>Grup Online:</b> ' + panel.grup.onlineSayisi + ' / ' + panel.grup.uyeSayisi + '</p>'
      + (aktif ? ('<p><b>Aktif Hazırlık:</b> ' + aktif.isTuru + '</p>') : '<p class="mafya-metin-dim">Aktif hazırlık yok.</p>')
      + '</div>';

    (panel.isler || []).forEach(function(isDef) {
      var img = mafyaIsGorseller[isDef.gorselKey] || FALLBACK;
      var aktifMi = aktifKey === isDef.key;
      html += '<div class="is-kart"><div class="is-yapi">'
        + '<img src="' + img + '" class="vesikalik-resim" onerror="imgFallback(this)">'
        + '<div class="is-detay"><h3>' + isDef.ad + '</h3>'
        + '<p>👥 Şart: <b>' + isDef.minOnline + '</b> online üye &nbsp;|&nbsp; 🗡️ Her üye min <b>' + fmt(isDef.minGuc) + '</b> güç</p>'
        + '<p>💵 Kazanç (kişi): <b style="color:#28a745;">' + fmt(isDef.kazancKisi) + ' TL</b> &nbsp;|&nbsp; 🕶️ Saygınlık: <b>+' + isDef.sayginlikKisi + '</b></p>'
        + '<button class="btn-is" onclick="mafyaIsKatil(\'' + isDef.key + '\')">[ 🤝 SOYGUNA KATIL ]</button>';
      if (aktifMi) {
        html += '<button class="btn-is kirmizi-btn" style="margin-left:8px;" onclick="mafyaIsGerceklestir(' + aktif.id + ')">[ 💥 SOYGUNU GERÇEKLEŞTİR ]</button>';
      }
      html += '</div></div>';

      if (aktifMi) {
        var list = panel.katilanlar || [];
        html += '<div class="mafya-metin" style="margin-top:10px;"><b>Katılanlar:</b> '
          + (list.length ? list.map(function(k) { return (k.online ? '🟢 ' : '⚫ ') + k.reisAdi; }).join(' , ') : 'Henüz yok.')
          + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<div class="mafya-isler-wrap"><h2>💼 MAFYA İŞLERİ</h2><p class="mafya-bos-metin" style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p></div>';
  }
}

async function mafyaIsKatil(key) {
  var ef = await sunucuAksiyon('mafya_is_katil', key, null, { isTuru: key });
  if (ef === null) return;
  toast('Soyguna katıldın.', 'basari');
  mafyaAltEkran('isler');
}

async function mafyaIsGerceklestir(isId) {
  if (!confirm('Soygunu gerçekleştirmek istiyor musun?')) return;
  var ef = await sunucuAksiyon('mafya_is_gerceklestir', String(isId), null, { isId: isId });
  if (ef === null) return;
  sesCal('saldiri');
  toast((ef.mesaj || 'Soygun tamamlandı.'), 'basari');
  mafyaAltEkran('isler');
}

async function mafyaEviCiz(box) {
  box.innerHTML = '<p style="color:#888;">Yükleniyor...</p>';
  if (!sunucuBagli) { box.innerHTML = '<p style="color:#c00;">Sunucu kapalı.</p>'; return; }
  try {
    var res = await apiFetch('/api/mafya/evi');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.ev) throw new Error(data.error || 'Yüklenemedi');
    var ev = data.ev;
    var s = ev.seviye || 1;
    var img = mafyaEviGorseller['seviye' + Math.min(10, s)] || FALLBACK;
    var html = '<h2>🏠 MAFYA EVİ</h2>'
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
    }
    html += '</div>';
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<h2>🏠 MAFYA EVİ</h2><p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
  }
}

async function mafyaEviHibe() {
  var el = document.getElementById('mafyaHibe');
  var miktar = el ? parseInt(el.value, 10) : 0;
  if (!miktar || miktar < 1) { toast('Hibe miktarı gir.', 'hata'); return; }
  var ef = await sunucuAksiyon('mafya_evi_hibe', null, null, { miktar: miktar });
  if (ef === null) return;
  toast('Hibe yapıldı.', 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaEviSeviye() {
  var ef = await sunucuAksiyon('mafya_evi_seviye');
  if (ef === null) return;
  toast('Seviye yükseltildi!', 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaSavaslarCiz(box) {
  box.innerHTML = '<p style="color:#888;">Yükleniyor...</p>';
  if (!sunucuBagli) {
    box.innerHTML = '<p style="color:#c00;">Sunucu kapalı.</p>';
    return;
  }
  try {
    var mafyaRes = await apiFetch('/api/mafya');
    var mafyaData = await mafyaRes.json().catch(function() { return {}; });
    var res = await apiFetch('/api/mafya/savaslar');
    var data = await res.json();
    if (!data.ok || !data.savaslar) {
      box.innerHTML = '<p style="color:#fff;">Henüz savaş yok.</p>';
      return;
    }
    var html = '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="Mafya Savaşları"></div>'
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
      }
      html += '</div>';
    });
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<p style="color:#c00;">Savaşlar yüklenemedi.</p>';
  }
}

async function mafyaSavasIlan() {
  var el = document.getElementById('mafyaSavasHedef');
  var hedef = el ? el.value.trim() : '';
  if (!hedef) { toast('Hedef grup adını yaz.', 'hata'); return; }
  var ef = await sunucuAksiyon('mafya_savas_ilan', null, null, { hedefGurupAdi: hedef });
  if (ef === null) return;
  toast((ef.mesaj || 'Savaş ilan edildi!'), 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaSavasaKatil(savasId) {
  var ef = await sunucuAksiyon('mafya_savas_katil', null, null, { savasId: savasId });
  if (ef === null) return;
  toast(ef.mesaj || 'Savaşa katıldın!', 'basari');
  mafyaMenuSec('gurubum');
}

function mafyaGurupListesiHTML(gruplar, basvuruModu) {
  if (!gruplar || !gruplar.length) {
    return '<p class="mafya-bos-metin">Henüz kurulmuş Mafya Grubu yok. İlk sen kur Reis!</p>';
  }
  var html = '<h3 class="bolum-baslik">Mevcut Mafya Grupları</h3>';
  gruplar.forEach(function(g) {
    html += '<div class="is-kart"><b><button type="button" class="btn-is mavi-btn" style="margin:0;padding:4px 12px;" onclick="mafyaGrupGoster(' + g.id + ')">' + escHtml(g.isim) + '</button></b>';
    if (g.lider_adi) html += '<p class="mafya-metin-dim" style="margin-top:8px;">Lider: <b style="color:#e8dcc0;">' + escHtml(g.lider_adi) + '</b></p>';
    if (g.uye_sayisi != null) html += '<p class="mafya-metin-dim">' + g.uye_sayisi + ' üye</p>';
    html += '<p>' + escHtml(g.aciklama || '—') + '</p>';
    if (basvuruModu) {
      html += '<button class="btn-is" onclick="mafyaBasvur(' + g.id + ')">[ BAŞVUR ]</button>';
    }
    html += '</div>';
  });
  return html;
}

async function mafyaGurubumCiz(box) {
  box.innerHTML = '<p class="mafya-yukleniyor">Yükleniyor...</p>';
  if (!sunucuBagli) {
    box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">Sunucu kapalı. Terminalde <b>npm start</b> çalıştır, ardından <b>http://localhost:3000</b> aç.</p>';
    return;
  }
  try {
    var results = await Promise.all([
      apiFetch('/api/mafya'),
      apiFetch('/api/mafya/evi'),
      apiFetch('/api/mafya/savaslar')
    ]);
    var res = results[0];
    var evRes = results[1];
    var savasRes = results[2];
    var data = await res.json().catch(function() { return {}; });
    var evData = await evRes.json().catch(function() { return {}; });
    var savasData = await savasRes.json().catch(function() { return {}; });
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || ('HTTP ' + res.status));
    }
    mafyaBildirim = !!(data.basvurular && data.basvurular.length) || !!data.bekleyenBasvuru;
    mafyaMenuYanip();

    if (!data.uyelik) {
      box.innerHTML = '<p class="mafya-bos-metin" style="color:#fff;font-weight:700;">Henüz Mafya Grubu Üyesi Değilsin!</p>';
      return;
    }

    var html = '<div class="mafya-gurubum-wrap">'
      + '<div class="is-kart mafya-grup-ust">'
      + '<button type="button" class="btn-is mavi-btn mafya-grup-isim-btn" onclick="mafyaGrupGoster(' + data.uyelik.id + ')">' + escHtml(data.uyelik.isim) + '</button>'
      + '<div class="mafya-grup-aciklama-alan">'
      + '<h4 class="mafya-grup-aciklama-baslik">📜 Grup Açıklaması</h4>'
      + '<div class="mafya-grup-aciklama-kutu"><p class="mafya-grup-aciklama' + (data.uyelik.aciklama ? '' : ' mafya-grup-aciklama-bos') + '">' + escHtml(data.uyelik.aciklama || 'Henüz açıklama eklenmemiş.') + '</p></div>'
      + '</div>';
    if (data.uyelik.benLiderim) {
      html += '<div class="mafya-btn-satir">'
        + '<button type="button" class="btn-is" onclick="mafyaGrupIsimDegistir()">[ ✎ AD DEĞİŞTİR ]</button>'
        + '<button type="button" class="btn-is" onclick="mafyaGrupAciklamaDegistir()">[ ✎ AÇIKLAMA DEĞİŞTİR ]</button>'
        + '</div>';
    }
    html += '</div>';

    if (evData.ok && evData.ev) {
      html += mafyaEviBolumHTML(evData.ev, evData.grupAdi || data.uyelik.isim, !!evData.benLiderim);
    }

    html += mafyaSavasBolumHTML(data, savasData);

    html += '<div class="tablo-container mafya-uyeler-tablo">'
      + '<h3 class="bolum-baslik">👥 Üyeler</h3>'
      + '<div class="tablo-izgara tablo-baslik-satir"><span>İSİM</span><span>RÜTBE</span><span>SAYGINLIK</span><span>OFFLINE</span><span></span><span></span></div>';
    var now = Math.floor(Date.now() / 1000);
    (data.uyeler || []).forEach(function(u) {
      var liderSatir = data.uyelik.benLiderim && u.user_id !== data.uyelik.liderUserId;
      var lastSeenAt = u.last_seen_at || 0;
      var offlineSeconds = lastSeenAt > 0 ? (now - lastSeenAt) : 0;
      var offlineHours = Math.floor(offlineSeconds / 3600);
      var offlineMinutes = Math.floor((offlineSeconds % 3600) / 60);
      var offlineStr = offlineHours > 0 ? (offlineHours + 'h ' + offlineMinutes + 'm') : (offlineMinutes + 'm');
      var offlineColor = offlineHours > 24 ? '#f08080' : (offlineHours > 1 ? '#ffa500' : '#90ee90');
      html += '<div class="tablo-izgara"><span class="uye-isim">' + u.reis_adi + '</span><span class="uye-rutbe">' + u.rutbe + '</span><span class="uye-puan">' + fmt(u.puan) + '</span><span style="color:' + offlineColor + ';">' + offlineStr + '</span><span>';
      if (liderSatir) {
        html += '<button type="button" class="btn-is" style="padding:4px 8px;font-size:11px;" onclick="mafyaRutbe(' + u.user_id + ')">✎ Rütbe</button> '
          + '<button type="button" class="btn-is mavi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaDevret(' + u.user_id + ')">👑 Devret</button>';
      } else html += '—';
      html += '</span><span>';
      if (liderSatir) {
        html += '<button type="button" class="btn-is kirmizi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaCikar(' + u.user_id + ')">Çıkar</button>';
      } else html += '—';
      html += '</span></div>';
    });
    html += '</div>';
    if (data.uyelik.benLiderim) {
      html += '<div class="mafya-basvurular">';
      if (data.basvurular && data.basvurular.length) {
        html += '<h3 class="bolum-baslik">📩 Başvurular</h3>';
        data.basvurular.forEach(function(b) {
          html += '<p class="mafya-basvuru-satir">' + b.reis_adi
            + ' <button type="button" class="btn-is" onclick="mafyaKabul(' + b.id + ')">Kabul</button> '
            + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaRed(' + b.id + ')">Red</button></p>';
        });
      }
      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaDagit()">[ 💥 MAFYA GURUBUNU DAĞIT ]</button></div></div>';
    } else {
      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaCik()">[ 🚪 GRUPTAN ÇIK — 1.000.000 TL ]</button></div>';
    }
    html += '<div class="mafya-grup-mesaj-alan">'
      + '<button type="button" class="btn-is mavi-btn mafya-grup-mesaj-btn" onclick="mafyaGrupMesajModal()">[ 📨 MAFYA GURUBUNA MESAJ GÖNDER ]</button>'
      + '</div></div>';
    box.innerHTML = html;
  } catch (e) {
    var msg = e.message || 'Bağlantı hatası';
    if (msg.indexOf('404') >= 0) {
      msg = 'Mafya API bulunamadı (HTTP 404). Oyunu Live Server ile değil; npm start ile http://localhost:3000 üzerinden aç.';
    }
    box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">' + msg + '</p>'
      + '<p class="mafya-metin-dim">Terminal: <b>npm start</b> → tarayıcı: <b>http://localhost:3000</b> → <b>Ctrl+F5</b></p>';
  }
}

function mafyaEviBolumHTML(ev, grupAdi, benLiderim) {
  var s = ev.seviye || 1;
  var img = mafyaEviGorseller['seviye' + Math.min(10, s)] || FALLBACK;
  var html = '<div class="is-kart mafya-bolum">'
    + '<h3 class="bolum-baslik">🏠 Mafya Evi</h3>'
    + '<p class="mafya-metin-dim">Seviye yükseldikçe üye kapasitesi artar (her seviye +3).</p>'
    + '<div class="mafya-evi-sahne"><img src="' + img + '" alt="Mafya Evi" onerror="imgFallback(this)"></div>'
    + '<div class="mafya-evi-alt"><h3>' + escHtml(grupAdi) + ' — Seviye ' + s + '</h3>'
    + '<p class="mafya-stat">👥 Kapasite: <b>' + ev.kapasite + '</b> üye</p>'
    + '<p class="mafya-stat mafya-stat-altin">💰 Birikim: <b>' + fmt(ev.birikmisPara) + ' TL</b></p>'
    + '<p class="mafya-stat">⬆️ Sonraki seviye: <b>' + fmt(ev.sonrakiMaliyet) + ' TL</b> <span class="mafya-metin-dim">(Kalan: ' + fmt(ev.kalan) + ' TL)</span></p>'
    + '</div>'
    + '<div class="mafya-hibe-alan">'
    + '<h4 class="bolum-baslik">Hibe</h4>'
    + '<input type="number" id="mafyaHibe" class="dusman-input" placeholder="Hibe miktarı">'
    + '<div class="mafya-btn-satir">'
    + '<button class="btn-is" onclick="mafyaEviHibe()">[ 💸 HİBE ET ]</button>';
  if (benLiderim) {
    html += '<button class="btn-is kirmizi-btn" onclick="mafyaEviSeviye()">[ ⬆️ SEVİYE YÜKSELT ]</button>';
  }
  html += '<button type="button" class="btn-is mavi-btn" onclick="mafyaHibeGecmisiGoster()">[ 📋 HİBE MİKTARI GÖRÜNTÜLE ]</button>'
    + '</div>'
    + '<div id="mafyaHibeGecmisi" class="gizli mafya-hibe-tablo" style="margin-top:12px;"></div>'
    + '</div></div>';
  return html;
}

function mafyaSavasBolumHTML(mafyaData, savasData) {
  var html = '<div class="is-kart mafya-bolum">'
    + '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="Mafya Savaşı İlanı"></div>'
    + '<h3 class="bolum-baslik">⚔️ Mafya Savaşı İlanı</h3>';
  if (mafyaData && mafyaData.uyelik && mafyaData.uyelik.benLiderim) {
    html += '<div class="mafya-savas-ilan-alan">'
      + '<p class="mafya-metin-dim">Rakip mafya grubu adını yaz ve savaş ilan et.</p>'
      + '<input type="text" id="mafyaSavasHedef" class="dusman-input" placeholder="Rakip Mafya Grubu Adı">'
      + '<div class="mafya-btn-satir"><button class="btn-is kirmizi-btn" onclick="mafyaSavasIlan()">[ ⚔️ MAFYA SAVAŞI İLAN ET ]</button></div>'
      + '</div>';
  }
  if (!savasData.ok || !savasData.savaslar || !savasData.savaslar.length) {
    html += '<p class="mafya-metin-dim">Henüz savaş yok.</p></div>';
    return html;
  }
  savasData.savaslar.forEach(function(s) {
    var durum = s.durum === 'bekliyor' ? '⏳ Bekliyor' : s.durum === 'aktif' ? '⚔️ Aktif' : '✅ Tamamlandı';
    var kalanSaat = Math.max(0, Math.ceil((s.savas_zamani - Date.now()) / (1000 * 60 * 60)));
    html += '<div class="mafya-savas-kart"><p><b>' + durum + '</b></p>'
      + '<p>Saldıran: <b>' + escHtml(s.saldiran_grup_adi || s.saldiran_grup_id) + '</b></p>'
      + '<p>Hedef: <b>' + escHtml(s.hedef_grup_adi || s.hedef_grup_id) + '</b></p>'
      + '<p>Katılımcılar: Saldıran <b>' + s.saldiran_katilim + '</b> | Hedef <b>' + s.hedef_katilim + '</b></p>';
    if (s.durum === 'bekliyor') {
      html += '<p class="mafya-metin-dim">Başlamasına kalan: <b>' + kalanSaat + '</b> saat</p>'
        + '<button class="btn-is" onclick="mafyaSavasaKatil(' + s.id + ')">[ ⚔️ KATIL ]</button>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

async function mafyaHibeGecmisiGoster() {
  var box = document.getElementById('mafyaHibeGecmisi');
  if (!box) return;
  box.classList.remove('gizli');
  box.innerHTML = '<p class="mafya-metin-dim">Yükleniyor...</p>';
  try {
    var res = await apiFetch('/api/mafya/evi/hibeler');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || 'Yüklenemedi');
    var liste = data.hibeler || [];
    if (!liste.length) {
      box.innerHTML = '<p class="mafya-metin-dim">Henüz hibe kaydı yok.</p>';
      return;
    }
    var html = '<div class="tablo-container"><div class="tablo-izgara tablo-baslik-satir"><span>HİBE EDEN</span><span>TARİH</span><span>MİKTAR</span></div>';
    liste.forEach(function(h) {
      html += '<div class="tablo-izgara"><span>' + escHtml(h.reisAdi) + '</span><span>' + escHtml(h.tarih) + '</span><span>' + fmt(h.miktar) + ' TL</span></div>';
    });
    html += '</div>';
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
  }
}

function mafyaGrupIsimDegistir() {
  var yeni = prompt('Yeni Mafya Grubu adı:');
  if (!yeni || !yeni.trim()) return;
  sunucuAksiyon('mafya_grup_isim_degistir', null, null, { isim: yeni.trim() }).then(function(ef) {
    if (ef !== null) {
      toast('Grup adı güncellendi.', 'basari');
      mafyaMenuSec('gurubum');
    }
  });
}

function mafyaGrupAciklamaDegistir() {
  var yeni = prompt('Yeni Mafya Grubu açıklaması:');
  if (yeni === null) return;
  sunucuAksiyon('mafya_grup_aciklama_degistir', null, null, { aciklama: yeni.trim() }).then(function(ef) {
    if (ef !== null) {
      toast('Grup açıklaması güncellendi.', 'basari');
      mafyaMenuSec('gurubum');
    }
  });
}

function mafyaOlusturAdim1() {
  var isim = document.getElementById('mafyaIsim');
  if (!isim || isim.value.trim().length < 2) {
    toast('Grup adı gir.', 'hata');
    return;
  }
  document.getElementById('mafyaAciklamaAlan').classList.remove('gizli');
}

async function mafyaOlusturAdim2() {
  var isim = document.getElementById('mafyaIsim').value.trim();
  var acik = document.getElementById('mafyaAciklama').value.trim();
  var ef = await sunucuAksiyon('mafya_olustur', null, null, { isim: isim, aciklama: acik });
  if (ef === null) return;
  toast('Mafya Grubu kuruldu!', 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaAra() {
  var q = document.getElementById('mafyaAra').value.trim();
  var res = await apiFetch('/api/mafya/ara?q=' + encodeURIComponent(q));
  var data = await res.json();
  var box = document.getElementById('mafyaAraSonuc');
  if (!data.liste || !data.liste.length) {
    box.innerHTML = '<p class="mafya-metin-dim">Sonuç yok.</p>';
    return;
  }
  var html = '';
  data.liste.forEach(function(g) {
    html += '<div class="is-kart" style="text-align:center;padding:14px;margin-top:10px;"><b><button type="button" class="btn-is mavi-btn" style="margin:0;padding:4px 12px;" onclick="mafyaGrupGoster(' + g.id + ')">' + escHtml(g.isim) + '</button></b>'
      + '<p class="mafya-metin-dim" style="margin-top:8px;">Lider: <b style="color:#e8dcc0;">' + escHtml(g.lider_adi) + '</b></p>'
      + '<p class="mafya-metin">' + escHtml(g.aciklama) + '</p>'
      + '<button class="btn-is" onclick="mafyaBasvur(' + g.id + ')">[ BAŞVUR ]</button></div>';
  });
  box.innerHTML = html;
}

async function mafyaBasvur(grupId) {
  var ef = await sunucuAksiyon('mafya_basvur', String(grupId));
  if (ef === null) return;
  toast('Başvuru gönderildi.', 'basari');
}

async function mafyaGrupGoster(grupId) {
  try {
    var res = await apiFetch('/api/mafya/grup/' + grupId);
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.grup) {
      toast(data.error || 'Grup bilgileri alınamadı.', 'hata');
      return;
    }
    var g = data.grup;
    var evSeviye = g.evSeviye || 1;
    var evImg = mafyaEviGorseller['seviye' + Math.min(10, evSeviye)] || FALLBACK;
    var html = '<div class="mafya-gurubum-wrap"><div class="is-kart mafya-grup-ust" style="max-width:640px;margin:0 auto;">'
      + '<h2 class="bolum-baslik" style="margin-bottom:12px;">' + escHtml(g.isim) + '</h2>'
      + '<div class="mafya-grup-aciklama-alan">'
      + '<h4 class="mafya-grup-aciklama-baslik">📜 Grup Açıklaması</h4>'
      + '<div class="mafya-grup-aciklama-kutu"><p class="mafya-grup-aciklama' + (g.aciklama ? '' : ' mafya-grup-aciklama-bos') + '">' + escHtml(g.aciklama || 'Henüz açıklama eklenmemiş.') + '</p></div>'
      + '</div>'
      + '<div class="mafya-evi-sahne mafya-grup-profil-ev"><img src="' + evImg + '" alt="Mafya Evi" onerror="imgFallback(this)"></div>'
      + '<p class="mafya-stat"><b>🏠 Mafya Evi:</b> Seviye ' + evSeviye + ' (Kapasite: ' + (g.evKapasite || '—') + ')</p>'
      + '<p class="mafya-stat"><b>👥 Üye Sayısı:</b> ' + g.uyeSayisi + '</p>'
      + '<p class="mafya-stat"><b>🕶️ Toplam Saygınlık:</b> <span class="uye-puan">' + fmt(g.toplamSayginlik) + '</span></p>'
      + '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is" onclick="mafyaMenuSec(\'gurubum\')">[ ← GERİ ]</button></div>'
      + '</div></div>';
    document.getElementById('anaIcerik').innerHTML = html;
  } catch (_) {
    toast('Grup bilgileri alınamadı.', 'hata');
  }
}

async function mafyaGrupMesajModal() {
  var metin = prompt('Mafya grubuna gönderilecek mesaj:');
  if (!metin || !metin.trim()) return;
  var ef = await sunucuAksiyon('mafya_grup_mesaj', null, null, { metin: metin.trim() });
  if (ef !== null) {
    toast('Grup mesajı gönderildi.', 'basari');
  }
}


async function mafyaKabul(id) {
  await sunucuAksiyon('mafya_kabul', String(id));
  mafyaAltEkran('gurubum');
}

async function mafyaRed(id) {
  await sunucuAksiyon('mafya_red', String(id));
  mafyaAltEkran('gurubum');
}

async function mafyaRutbe(userId) {
  var rutbe = prompt('Yeni rütbe:');
  if (!rutbe) return;
  await sunucuAksiyon('mafya_rutbe', null, null, { hedefUserId: userId, rutbe: rutbe });
  mafyaAltEkran('gurubum');
}

async function mafyaCikar(userId) {
  if (!confirm('Üyeyi gruptan çıkar?')) return;
  await sunucuAksiyon('mafya_cikar', String(userId));
  mafyaAltEkran('gurubum');
}

async function mafyaDevret(userId) {
  if (!confirm('Liderliği bu üyeye devretmek istiyor musun?')) return;
  await sunucuAksiyon('mafya_devret', String(userId));
  mafyaAltEkran('gurubum');
}

async function mafyaDagit() {
  if (!confirm('Grubu tamamen dağıtmak istediğine emin misin?')) return;
  await sunucuAksiyon('mafya_dagit');
  mafyaMenuSec('olustur');
}

async function mafyaCik() {
  if (!confirm('1.000.000 TL ödeyerek gruptan çık?')) return;
  await sunucuAksiyon('mafya_cik');
  mafyaMenuSec('olustur');
}

async function liderlikYukle(mod) {
  mod = mod || liderlikModu;
  var res = await apiFetch('/api/leaderboard?tip=' + encodeURIComponent(mod === 'grup' ? 'grup' : 'oyuncu'));
  if (!res.ok) return { liste: [], tip: mod, grupMap: {} };
  var data = await res.json();
  var out = { liste: data.liste || [], tip: data.tip || mod, grupMap: {} };
  if (mod !== 'grup') {
    try {
      var gRes = await apiFetch('/api/leaderboard?tip=grup');
      var gData = await gRes.json().catch(function() { return {}; });
      (gData.liste || []).forEach(function(g) {
        if (!g.grupId) return;
        var raw = String(g.isim || '').trim().toLowerCase();
        var clean = temizGrupAdi(g.isim).toLowerCase();
        if (raw) out.grupMap[raw] = g.grupId;
        if (clean) out.grupMap[clean] = g.grupId;
      });
    } catch (_) {}
  }
  return out;
}

function liderlikModDegistir(mod) {
  liderlikModu = mod;
  var ic = document.getElementById('anaIcerik');
  if (ic && aktifEkran === 'liderlik') liderlikTablosuCiz(ic);
}

function liderlikTablosuCiz(ic) {
  liderlikYukle(liderlikModu).then(function(data) {
    var liste = data.liste || [];
    var mod = data.tip || liderlikModu;
    var grupMap = data.grupMap || {};
    var oyuncuAktif = mod !== 'grup';
    var headIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#b8924a" stroke-width="1.5"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/></svg>';
    var html = '<div class="lt-panel" data-lt-ver="' + GORSEL_VERSIYON + '">'
      + '<div class="lt-photo-bg"></div>'
      + '<div class="lt-inner">'
      + '<div class="lt-carved-bar">'
      + '<div class="lt-tab-floating">Liderlik Tablosu</div>'
      + '<div class="lt-side-tabs">'
      + ltTab('oyuncu', 'Kişiler', oyuncuAktif)
      + ltTab('grup', 'Gruplar', !oyuncuAktif)
      + '</div></div>'
      + '<div class="lt-head">'
      + '<div class="lt-head-row"><div class="lt-head-icon">' + headIcon + '</div>'
      + '<div class="lt-head-title">Sözü Geçenler — Liderlik Tablosu</div></div>'
      + '<div class="lt-head-quote">"Sokaklar unutur, saygınlık unutmaz."</div>'
      + '</div>';

    if (oyuncuAktif) {
      html += '<div class="lt-colbar"><span>Sıralama No</span><span>İsim</span><span>Grup</span><span>Saygınlık</span></div>'
        + '<div class="lt-list">';
      if (!liste.length) {
        html += '<p class="lt-empty">Henüz sıralama verisi yok.</p>';
      } else {
        liste.forEach(function(r, i) {
          var cls = 'lt-row' + (r.benim ? ' me' : '');
          html += '<div class="' + cls + '">'
            + '<div class="lt-medal-wrap"><div class="lt-medal ' + ltMedalClass(i) + '">' + (i + 1) + '</div></div>'
            + '<div class="lt-cap"><span class="lt-icon pistol"></span>' + ltIsimHtml(r) + '</div>'
            + '<div class="lt-cap center lt-group-cap">' + ltGrupLinkHtml(r.grup, r.grupId, grupMap) + '</div>'
            + '<div class="lt-cap right lt-pts-cap"><span class="lt-icon coin"></span>'
            + '<span class="lt-pts-txt">' + fmt(r.puan) + '<span class="lt-lbl">Puan</span></span></div>'
            + '</div>';
        });
      }
      html += '</div>';
    } else {
      html += '<div class="lt-colbar lt-colbar--grup"><span>Sıralama No</span><span>Grup</span><span>Toplam Saygınlık</span><span>Bilgi</span></div>'
        + '<div class="lt-list">';
      if (!liste.length) {
        html += '<p class="lt-empty">Henüz grup sıralaması yok.</p>';
      } else {
        liste.forEach(function(r, i) {
          var statTxt = 'Ev ' + (r.evSeviye || 1) + ' · ' + (r.uyeSayisi || 0) + ' üye · ' + (r.kazanilanSavas || 0) + ' savaş';
          html += '<div class="lt-row lt-row--grup' + (i === 0 ? ' me' : '') + '">'
            + '<div class="lt-medal-wrap"><div class="lt-medal ' + ltMedalClass(i) + '">' + (i + 1) + '</div></div>'
            + '<div class="lt-cap"><span class="lt-icon pistol"></span>' + ltGrupIsimHtml(r) + '</div>'
            + '<div class="lt-cap right lt-pts-cap"><span class="lt-icon coin"></span>'
            + '<span class="lt-pts-txt">' + fmt(r.toplamPuan || 0) + '<span class="lt-lbl">Puan</span></span></div>'
            + '<div class="lt-cap center lt-group-cap"><span class="lt-stat-txt">' + statTxt + '</span></div>'
            + '</div>';
        });
      }
      html += '</div>';
    }

    html += '<div class="lt-foot">Sıralama her saldırı ve mekan sonucunda anlık güncellenir.</div>'
      + '</div></div>';
    if (ic && aktifEkran === 'liderlik') ic.innerHTML = html;
  });
}

function profilZiyaretleriHTML(ziyaretler) {
  var zHtml = '<h3 class="profil-ziyaretler-baslik">Profil Ziyaretleri</h3><ul class="profil-ziyaret-liste">';
  if (ziyaretler && ziyaretler.length) {
    ziyaretler.forEach(function(n) { zHtml += '<li>' + escHtml(n) + '</li>'; });
  } else {
    zHtml += '<li class="bos">Henüz ziyaret yok.</li>';
  }
  zHtml += '</ul>';
  return zHtml;
}

function profilAlanGuncelle(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function profilSiralamaYedek(p) {
  var sira = p.sira;
  var grupSira = p.grupSira;
  try {
    if (sira == null) {
      var oRes = await apiFetch('/api/leaderboard?tip=oyuncu');
      var oData = await oRes.json().catch(function() { return {}; });
      if (oRes.ok && oData.ok && oData.liste) {
        var uid = p.userId || window.__benimUserId;
        for (var i = 0; i < oData.liste.length; i++) {
          if (oData.liste[i].userId === uid) {
            sira = i + 1;
            break;
          }
        }
      }
    }
    if (grupSira == null && p.grup) {
      var gRes = await apiFetch('/api/leaderboard?tip=grup');
      var gData = await gRes.json().catch(function() { return {}; });
      if (gRes.ok && gData.ok && gData.liste) {
        var grupAdi = temizGrupAdi(p.grup);
        for (var j = 0; j < gData.liste.length; j++) {
          if (temizGrupAdi(gData.liste[j].isim) === grupAdi) {
            grupSira = j + 1;
            break;
          }
        }
      }
    }
  } catch (_) {}
  return { sira: sira, grupSira: grupSira };
}

async function profilSiralamaAlanlariGuncelle(p) {
  var yedek = await profilSiralamaYedek(p);
  if (p.sira == null) p.sira = yedek.sira;
  if (p.grupSira == null) p.grupSira = yedek.grupSira;
  profilAlanGuncelle('profilPuanDetay', fmt(p.puan || 0));
  profilAlanGuncelle('profilSiraDetay', p.sira != null ? fmt(p.sira) : '—');
  profilAlanGuncelle('profilGrupSiraDetay', p.grupSira != null ? fmt(p.grupSira) : '—');
}

async function profilYukle() {
  try {
    var res = await apiFetch('/api/profile/' + encodeURIComponent(String(window.__benimUserId || 'me')));
    if (!res.ok) return;
    var data = await res.json();
    if (!data.ok || !data.profil) return;
    var p = data.profil;
    await profilSiralamaAlanlariGuncelle(p);

    var d = document.getElementById('profilDostlar');
    var x = document.getElementById('profilDusmanlar');
    profilAciklamaYaz(p.aciklama || '');
    if (d) d.value = p.dostlar || '';
    if (x) x.value = p.dusmanlar || '';

    profilAlanGuncelle('profilKayitTarihi', p.kayitTarihi || '—');
    profilAlanGuncelle('profilOzOyuncu', p.oyuncuAdi || aktifReisAdi);
    profilAlanGuncelle('profilOzLakap', p.lakap || 'Mafya');
    profilAlanGuncelle('profilOyuncuIsmiDetay', p.oyuncuAdi || aktifReisAdi);
    if (p.guc != null) profilAlanGuncelle('profilOzGuc', fmt(p.guc));
    if (p.saatlikKazanc != null) profilAlanGuncelle('profilOzSaatlik', fmt(p.saatlikKazanc) + ' TL');

    var avatar = document.getElementById('profilAvatar');
    if (avatar) {
      var url = profilResmiUrl(p.userId, p.profilResmi);
      avatar.src = url;
      avatar.classList.toggle('profil-avatar-ozel', profilResmiOzelMi(url));
    }
    if (p.profilResmi) oyuncuProfilResmi = profilPortreKeyNormalize(p.profilResmi);
    var wrap = document.querySelector('.profil-wrap');
    if (wrap && p.profilResmi) wrap.setAttribute('data-profil-resmi', p.profilResmi);

    var z = document.getElementById('profilZiyaretlerBox');
    if (z) z.innerHTML = profilZiyaretleriHTML(p.ziyaretler);

    if (p.lastIcraatAt != null) oyuncuLastIcraatAt = p.lastIcraatAt;
    if (p.icraat != null) oyuncuIcraat = p.icraat;
    if (p.icraatRegenSec != null) oyuncuIcraatRegenSec = p.icraatRegenSec;
    if (p.icraatSaatlikBonus != null) oyuncuIcraatSaatlikBonus = p.icraatSaatlikBonus;
    arayuzGuncelle();
    profilIcraatTimerBaslat(
      p.icraat != null ? p.icraat : oyuncuIcraat,
      p.lastIcraatAt != null ? p.lastIcraatAt : oyuncuLastIcraatAt,
      p.icraatRegenSec || oyuncuIcraatRegenSec,
      p.icraatSaatlikBonus || oyuncuIcraatSaatlikBonus
    );
  } catch (_) {}
}

async function profilKaydet() {
  var aciklama = profilAciklamaAl();
  var dostlar = (document.getElementById('profilDostlar') || {}).value || '';
  var dusmanlar = (document.getElementById('profilDusmanlar') || {}).value || '';
  var wrap = document.querySelector('.profil-wrap');
  var profilResmi = oyuncuProfilResmi || (wrap ? wrap.getAttribute('data-profil-resmi') : '') || '';
  try {
    var body = { aciklama: aciklama, dostlar: dostlar, dusmanlar: dusmanlar };
    if (profilResmi) body.profilResmi = profilPortreKeyNormalize(profilResmi);
    var res = await apiFetch('/api/profile', {
      method: 'POST',
      body: body
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) {
      toast(data.error || 'Profil kaydedilemedi.', 'hata');
      return;
    }
    oyuncuUygula(data.player);
    var avatar = document.getElementById('profilAvatar');
    if (avatar && oyuncuProfilResmi) {
      avatar.src = profilPortreUrlFromKey(oyuncuProfilResmi);
      avatar.classList.add('profil-avatar-ozel');
    }
    if (wrap && oyuncuProfilResmi) wrap.setAttribute('data-profil-resmi', oyuncuProfilResmi);
    toast('Profil bilgileri kaydedildi.', 'basari');
  } catch (_) {
    toast('Profil kaydı sırasında bağlantı hatası.', 'hata');
  }
}

async function oyuncuProfilGoster(userId) {
  profilIcraatTimerDurdur();
  profilQuillYokEt();
  aktifEkran = 'profil_ziyaret';
  masterFramePlaqueGuncelle('profilim', 'PROFİL');
  var ic = document.getElementById('anaIcerik');
  ic.innerHTML = '<div class="profil-wrap"><p style="color:#888;padding:24px;text-align:center;">Yükleniyor...</p></div>';
  try {
    var res = await apiFetch('/api/profile/' + encodeURIComponent(String(userId)));
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.profil) throw new Error(data.error || 'Profil alınamadı.');
    var p = data.profil;
    ic.innerHTML = profilEkranSablonu({
      duzenlenebilir: false,
      userId: p.userId,
      profilResmi: p.profilResmi,
      oyuncuAdi: p.oyuncuAdi,
      lakap: p.lakap,
      guc: p.guc,
      puan: p.puan,
      sira: p.sira,
      grupSira: p.grupSira,
      aciklama: p.aciklama,
      dostlar: p.dostlar,
      dusmanlar: p.dusmanlar,
      kayitTarihi: p.kayitTarihi,
      sehirEfsane: p.sehirEfsane,
      karaListede: p.karaListede
    });
    await profilSiralamaAlanlariGuncelle(p);
    profilAciklamaGosterUygula(p.aciklama);
    var z = document.getElementById('profilZiyaretlerBox');
    if (z) z.innerHTML = profilZiyaretleriHTML(p.ziyaretler);
  } catch (e) {
    ic.innerHTML = '<div class="profil-wrap"><p style="color:#c00;padding:24px;">' + escHtml(e.message || 'Profil yüklenemedi.') + '</p></div>';
  }
}

setInterval(function() {
  if (!sunucuBagli) return;
  sunucudanYukle({ poll: true }).then(function() {
    var ic = document.getElementById('anaIcerik');
    if (ic && aktifEkran === 'gazete' && yeniGazeteHaber) gazeteEkranCiz(ic);
  }).catch(function() {});
}, 5000);

function sektorMekanlar(sektor) {
  var m = mekanTanimlari[sektor];
  if (m && Object.keys(m).length) return m;
  if (typeof MEKANLAR_VERI !== 'undefined' && MEKANLAR_VERI[sektor]) return MEKANLAR_VERI[sektor];
  return {};
}

function sektorEkranCiz(ic, sektor, baslik) {
  ic.innerHTML = '<h2>🏢 ' + baslik + '</h2><p style="color:#888;">Yükleniyor...</p>';
  elitFiyatDurumSenkronize().then(function() {
    if (aktifEkran !== 'sektor_' + sektor) return;
    sektorEkranCizIcerik(ic, sektor, baslik);
  });
}

function sektorEkranCizIcerik(ic, sektor, baslik) {
  var mekanlar = sektorMekanlar(sektor);
  var html = '<h2>🏢 ' + baslik + '</h2><p>"Her alımda fiyat %5 artar; saatlik getiri sabit kalır."</p>' + elitFiyatNotuHTML();
  if (!Object.keys(mekanlar).length) {
    ic.innerHTML = html + '<p style="color:#888;">Sektör yükleniyor...</p>';
    sunucudanYukle().then(function() {
      if (aktifEkran === 'sektor_' + sektor) sektorEkranCizIcerik(ic, sektor, baslik);
    }).catch(function() {
      ic.innerHTML = html + '<p style="color:#c00;">Mekan listesi alınamadı. <b>npm start</b> ile sunucuyu çalıştırıp yeniden giriş yap.</p>';
    });
    return;
  }
  Object.keys(mekanlar).forEach(function(key) {
    var m = mekanlar[key];
    var sk = sektor + ':' + key;
    var sahip = sektorSahiplik[sk] || { adet: 0 };
    var adet = sahip.adet || 0;
    var bazFiyat = Math.floor(m.fiyat * Math.pow(1.05, adet));
    var img = mekanGorseller[m.gorsel] || FALLBACK;
    html += '<div class="is-kart"><div class="is-yapi">'
      + '<img src="' + img + '" class="vesikalik-resim" onerror="imgFallback(this)">'
      + '<div class="is-detay"><h3>' + m.ad + '</h3><p style="color:#888;">' + m.aciklama + '</p>'
      + '<p>💵 Alış: ' + elitFiyatGosterHtml(bazFiyat) + ' &nbsp;|&nbsp; Sahip: <b>' + adet + '</b> adet</p>'
      + '<p>⏱️ Saatlik Getiri: <b style="color:#28a745;">' + fmt(m.saatlik) + ' TL</b> (adet başı)</p>'
      + '<p>🕶️ Saygınlık: <b>+' + m.sayginlik + '</b> (sabit)</p>'
      + '<div style="margin-top:8px;">'
      + '<input type="number" id="mekanAdetGir_' + sektor + '_' + key + '" placeholder="Adet" value="1" min="1" max="999" style="width:60px;padding:4px;margin-right:8px;background:#222;color:#ffd700;border:1px solid #555;">'
      + '<button class="btn-is" onclick="mekanAl(\'' + sektor + '\', \'' + key + '\')">[ 🏢 MEKAN AL ]</button>'
      + '</div>'
      + '</div></div></div>';
  });
  ic.innerHTML = html;
}

async function mekanAl(sektor, key) {
  var idStr = 'mekanAdetGir_' + sektor + '_' + key;
  var adetInput = document.getElementById(idStr);
  if (!adetInput) {
    toast('Adet giriş alanı bulunamadı. Sayfayı yenile.', 'hata');
    return;
  }
  var adet = parseInt(String(adetInput.value || '').trim(), 10);
  if (!adet || adet < 1) adet = 1;
  if (adet > 999) adet = 999;
  var ef = await sunucuAksiyon('mekan_al', sektor + ':' + key, adet, { adet: adet });
  if (ef) toast(ef.mesaj || 'Mekan alındı!', 'basari');
  ekranDegistir('sektor_' + sektor);
}

async function rusvetVer() {
  var el = document.getElementById('rusvetMiktar');
  var miktar = el ? parseInt(el.value, 10) : rusvetBilgi.onerilen;
  if (!miktar || miktar < 1) { toast('Rüşvet miktarı geçersiz.', 'hata'); return; }
  var ef = await sunucuAksiyon('rusvet_ver', null, null, { miktar: miktar });
  if (ef) toast(ef.mesaj || 'Rüşvet verildi.', 'basari');
  ekranDegistir('devletIliskisi');
}

function sifreDegistirModal() {
  document.getElementById('sifreAlan').classList.remove('gizli');
}

async function sifreKaydet() {
  var eski = document.getElementById('eskiSifre').value;
  var yeni = document.getElementById('yeniSifre').value;
  try {
    var res = await apiFetch('/api/auth/password', {
      method: 'POST',
      body: { eskiSifre: eski, yeniSifre: yeni }
    });
    var data = await res.json();
    if (!data.ok) {
      toast(data.error || 'Şifre değişmedi.', 'hata');
      return;
    }
    toast('Şifre güncellendi.', 'basari');
    document.getElementById('sifreAlan').classList.add('gizli');
  } catch (_) {
    toast('Sunucu hatası.', 'hata');
  }
}

function sbSayfaKabuk(banner, ikon, baslik, motto, govdeIcerik) {
  return '<div class="sb-sayfa"><div class="sb-cerceve">'
    + '<div class="sb-banner">'
    + '<img src="' + banner + '" alt="" onerror="imgFallback(this)">'
    + '<div class="sb-banner-ortu"></div>'
    + '<div class="sb-baslik-wrap">'
    + (ikon ? '<span class="sb-baslik-ikon" aria-hidden="true">' + ikon + '</span>' : '')
    + '<h2>' + baslik + '</h2>'
    + '<p class="sb-motto">' + motto + '</p>'
    + '</div></div>'
    + '<div class="sb-govde">' + govdeIcerik + '</div>'
    + '</div></div>';
}

function sbMesajAvatarFromMesaj(m) {
  if (m.tip === 'saldiri') {
    var saldiriUid = m.gonderenUserId || m.gonderen_user_id || null;
    var saldiriPr = m.profilResmi || m.profil_resmi || '';
    if (saldiriUid || saldiriPr) {
      var saldiriUrl = profilResmiUrl(saldiriUid, saldiriPr);
      var saldiriCls = profilResmiOzelMi(saldiriUrl) ? ' sb-avatar-img--ozel' : '';
      return '<span class="sb-mesaj-avatar sb-mesaj-avatar--saldiri"><img class="sb-avatar-img' + saldiriCls + '" src="' + escHtml(saldiriUrl) + '" alt="" loading="lazy" onerror="imgFallback(this)"></span>';
    }
    return '<span class="sb-mesaj-avatar sb-mesaj-avatar--sistem" aria-hidden="true">⚠️</span>';
  }
  var uid = m.gonderenUserId || m.gonderen_user_id || null;
  var pr = m.profilResmi || m.profil_resmi || '';
  var url = profilResmiUrl(uid, pr);
  var cls = profilResmiOzelMi(url) ? ' sb-avatar-img--ozel' : '';
  return '<span class="sb-mesaj-avatar"><img class="sb-avatar-img' + cls + '" src="' + escHtml(url) + '" alt="" loading="lazy" onerror="imgFallback(this)"></span>';
}

function sbMesajEtiket(tip) {
  if (tip === 'saldiri') return '<span class="sb-mesaj-etiket sb-mesaj-etiket--alarm">ALARM</span>';
  if (tip === 'mafya_grup') return '<span class="sb-mesaj-etiket">GRUP</span>';
  return '<span class="sb-mesaj-etiket">ÖZEL</span>';
}

function sbMesajKartHTML(m) {
  var tipCls = m.tip === 'saldiri' ? ' sb-mesaj-kart--saldiri' : (m.tip === 'mafya_grup' ? ' sb-mesaj-kart--mafya' : '');
  var baslik = mesajGonderenBaslik(m);
  var html = '<article class="sb-mesaj-kart' + tipCls + '">'
    + '<div class="sb-mesaj-ust">'
    + sbMesajAvatarFromMesaj(m)
    + '<div class="sb-mesaj-meta"><span class="sb-mesaj-gonderen">' + escHtml(baslik) + '</span>'
    + '<span class="sb-mesaj-tarih">' + escHtml(m.tarih || '') + '</span></div>'
    + sbMesajEtiket(m.tip)
    + '</div>'
    + '<div class="sb-mesaj-icerik">' + escHtml(m.icerik) + '</div>'
    + '<div class="sb-mesaj-aksiyonlar">';
  if (m.tip === 'ozel' && m.gonderenAdi !== 'Sistem') {
    html += '<button type="button" class="sb-btn sb-btn--gri sb-btn-kucuk" onclick="mesajCevapla(' + m.id + ', \'' + String(m.gonderenAdi || '').replace(/'/g, "\\'") + '\')">Cevapla</button>';
  }
  if (m.tip === 'mafya_grup') {
    html += '<button type="button" class="sb-btn sb-btn--gri sb-btn-kucuk" onclick="mesajCevapla(' + m.id + ', \'Mafya Grubu\')">Cevapla</button>';
  }
  html += '<button type="button" class="sb-btn sb-btn--kirmizi sb-btn-kucuk" onclick="mesajSil(' + m.id + ')">Sil</button>'
    + '</div></article>';
  return html;
}

function mesajKutusuGovdeHTML(liste) {
  var listeHtml = '';
  if (!liste || !liste.length) {
    listeHtml = '<p class="sb-mesaj-bos">Henüz mesaj yok — dostlarına ilk mesajı sen gönder.</p>';
  } else {
    liste.forEach(function(m) { listeHtml += sbMesajKartHTML(m); });
  }
  return '<p class="sb-giris">Özel mesajlar, saldırı alarmları ve mafya grubu yazışmaları burada toplanır.</p>'
    + '<div class="sb-paneller">'
    + '<div class="sb-panel sb-panel--gonder">'
    + '<div class="sb-panel-baslik"><span class="sb-panel-ikon" aria-hidden="true">📤</span><h3>MESAJ GÖNDER</h3></div>'
    + '<div class="sb-alan"><label for="mesajHedef">Alıcı reis adı</label>'
    + '<input type="text" id="mesajHedef" class="sb-input" placeholder="Oyuncu adı..." maxlength="24"></div>'
    + '<div class="sb-alan"><label for="mesajMetin">Mesajın</label>'
    + '<textarea id="mesajMetin" class="sb-textarea" rows="3" placeholder="Mesajını yaz..." maxlength="500"></textarea></div>'
    + '<button type="button" class="sb-btn sb-btn--mavi" onclick="mesajGonder()">[ 📤 MESAJI GÖNDER ]</button>'
    + '</div>'
    + '<div class="sb-panel sb-panel--liste">'
    + '<div class="sb-panel-baslik"><span class="sb-panel-ikon" aria-hidden="true">📥</span><h3>GELEN MESAJLAR</h3></div>'
    + '<div class="sb-mesaj-liste">' + listeHtml + '</div>'
    + '</div></div>';
}

function mafyaSohbetSatirHTML(s) {
  var avatarUrl = profilResmiUrl(s.userId, s.profilResmi);
  var avatarCls = profilResmiOzelMi(avatarUrl) ? ' sb-avatar-img--ozel' : '';
  return '<div class="sb-sohbet-satir">'
    + '<span class="sb-sohbet-avatar"><img class="sb-avatar-img' + avatarCls + '" src="' + escHtml(avatarUrl) + '" alt="" loading="lazy" onerror="imgFallback(this)"></span>'
    + '<div class="sb-sohbet-govde"><div class="sb-sohbet-ust-satir">'
    + '<span class="sb-sohbet-isim">' + escHtml(s.reisAdi || 'Anonim') + '</span>'
    + '<span class="sb-sohbet-zaman">' + escHtml(s.tarih || '') + '</span>'
    + '</div><p class="sb-sohbet-metin">' + escHtml(s.mesaj) + '</p></div></div>';
}

function mafyaSohbetGovdeHTML(liste) {
  var satirlar = '';
  (liste || []).forEach(function(s) { satirlar += mafyaSohbetSatirHTML(s); });
  if (!satirlar) satirlar = '<p class="sb-mesaj-bos">Salon sessiz — ilk sözü sen söyle.</p>';
  return '<p class="sb-giris">Genel yeraltı salonu — herkes görür. Her mesaj <strong>1 SMS</strong> hakkı harcar.</p>'
    + '<div class="sb-meta-bar"><span>📱 Kalan SMS:</span><strong id="sbSmsGoster">' + fmt(oyuncuSms || 0) + '</strong></div>'
    + '<div class="sb-sohbet-liste" id="sohbetListe">' + satirlar + '</div>'
    + '<div class="sb-panel sb-panel--yaz">'
    + '<div class="sb-panel-baslik"><span class="sb-panel-ikon" aria-hidden="true">✍️</span><h3>SALONA YAZ</h3></div>'
    + '<div class="sb-alan"><label for="mafyaSohbetMetin">Mesajın</label>'
    + '<textarea id="mafyaSohbetMetin" class="sb-textarea" rows="3" placeholder="Mafyayla sohbet et..." maxlength="400"></textarea></div>'
    + '<button type="button" class="sb-btn sb-btn--yesil" onclick="mafyaSohbetGonder()">[ 💬 GÖNDER ]</button>'
    + '</div>';
}

async function mesajKutusuCiz(ic) {
  ic.innerHTML = sbSayfaKabuk(
    sohbetGorseller.mesajKutu,
    '📬',
    'MESAJ KUTUSU',
    '"Gizli yazışmalar, alarmlar ve grup mesajları burada."',
    '<p class="sb-durum">Yükleniyor...</p>'
  );
  if (!sunucuBagli) {
    if (aktifEkran !== 'mesajKutusu') return;
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mesajKutu,
      '📬',
      'MESAJ KUTUSU',
      '"Gizli yazışmalar, alarmlar ve grup mesajları burada."',
      '<p class="sb-durum sb-durum--hata">Sunucu kapalı. Terminalde <b>npm start</b> çalıştır, ardından <b>http://localhost:3000</b> adresinden gir.</p>'
    );
    return;
  }
  try {
    var res = await apiFetch('/api/mesajlar');
    if (res.status === 401) { cikisYap(); return; }
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    if (aktifEkran !== 'mesajKutusu') return;
    okunmamisMesaj = false;
    mesajMenuYanip();
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mesajKutu,
      '📬',
      'MESAJ KUTUSU',
      '"Gizli yazışmalar, alarmlar ve grup mesajları burada."',
      mesajKutusuGovdeHTML(data.liste)
    );
  } catch (e) {
    if (aktifEkran !== 'mesajKutusu') return;
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mesajKutu,
      '📬',
      'MESAJ KUTUSU',
      '"Gizli yazışmalar, alarmlar ve grup mesajları burada."',
      '<p class="sb-durum sb-durum--hata">Mesajlar yüklenemedi: ' + escHtml(e.message || 'Bağlantı hatası') + '</p>'
      + '<p class="sb-durum" style="margin-top:10px;">Proje klasöründe <b>npm start</b> çalışıyor olmalı; adres <b>http://localhost:3000</b> olmalı.</p>'
    );
  }
}

async function mesajGonder() {
  var hedef = document.getElementById('mesajHedef').value.trim();
  var metin = document.getElementById('mesajMetin').value.trim();
  if (!hedef || !metin) { toast('Hedef ve mesaj gerekli.', 'hata'); return; }
  var ef = await sunucuAksiyon('mesaj_gonder', null, null, { hedef: hedef, metin: metin });
  if (ef !== null) {
    toast('Mesaj gönderildi.', 'basari');
    sohbetMenuAc();
    ekranDegistir('mesajKutusu');
  }
}

async function mesajSil(id) {
  await sunucuAksiyon('mesaj_sil', String(id));
  ekranDegistir('mesajKutusu');
}

function mesajCevapla(id, ad) {
  var metin = prompt(ad + ' adlı oyuncuya cevabın:');
  if (!metin) return;
  sunucuAksiyon('mesaj_cevapla', String(id), null, { metin: metin }).then(function(ef) {
    if (ef !== null) ekranDegistir('mesajKutusu');
  });
}

async function mafyaSohbetCiz(ic) {
  ic.innerHTML = sbSayfaKabuk(
    sohbetGorseller.mafyaMasa,
    '',
    'MAFYA SOHBETLERİ',
    '"Sokakların genel salonu — herkes duyar."',
    '<p class="sb-durum">Sohbet yükleniyor...</p>'
  );
  if (!sunucuBagli) {
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mafyaMasa,
      '',
      'MAFYA SOHBETLERİ',
      '"Sokakların genel salonu — herkes duyar."',
      '<p class="sb-durum sb-durum--hata">Sunucu kapalı. <b>npm start</b> sonra <b>http://localhost:3000</b></p>'
    );
    return;
  }
  try {
    var res = await apiFetch('/api/sohbet');
    if (res.status === 401) { cikisYap(); return; }
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mafyaMasa,
      '',
      'MAFYA SOHBETLERİ',
      '"Sokakların genel salonu — herkes duyar."',
      mafyaSohbetGovdeHTML(data.liste)
    );
    var liste = document.getElementById('sohbetListe');
    if (liste) liste.scrollTop = liste.scrollHeight;
  } catch (e) {
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mafyaMasa,
      '',
      'MAFYA SOHBETLERİ',
      '"Sokakların genel salonu — herkes duyar."',
      '<p class="sb-durum sb-durum--hata">Sohbet yüklenemedi: ' + escHtml(e.message || 'Bağlantı hatası') + '</p>'
      + '<p class="sb-durum" style="margin-top:10px;"><b>npm start</b> ile sunucuyu başlat; oyunu <b>http://localhost:3000</b> üzerinden aç.</p>'
    );
  }
}

async function mafyaSohbetGonder() {
  var el = document.getElementById('mafyaSohbetMetin');
  var metin = el ? el.value.trim() : '';
  if (!metin) return;
  var ef = await sunucuAksiyon('mafya_sohbet', null, null, { metin: metin });
  if (ef !== null) ekranDegistir('mafyaSohbet');
}

function egitimAc() {
  if (!window.TutorialEngine) return;
  TutorialEngine.reset();
  TutorialEngine.open({ force: true });
}

async function oyunuBaslat() {
  var yuk = document.getElementById('yukleniyor');
  if (yuk) {
    yuk.classList.remove('gizli');
    yuk.innerHTML = '⏳ İMPARATORLUK YÜKLENİYOR...';
  }
  var yukTimeout = setTimeout(function () {
    if (yuk && !yuk.classList.contains('gizli')) {
      sunucuBagli = false;
      yuk.innerHTML =
        '❌ Sunucu yanıt vermiyor.<br><br>Terminalde <b>npm start</b> çalıştırıp sayfayı yenile (Ctrl+F5).'
        + '<br><br><button type="button" onclick="location.reload()" style="margin-top:12px;padding:10px 18px;cursor:pointer;background:#8b1e1e;color:#fff;border:none;border-radius:6px;font-weight:600">Yenile</button>';
    }
  }, 15000);
  try {
    var health = await fetch('/api/health', { credentials: 'include' });
    if (!health.ok) throw new Error('API yanıt vermedi');
    await sunucudanYukle();
    sunucuBagli = true;
    clearTimeout(yukTimeout);
    if (yuk) yuk.classList.add('gizli');
    sesUiGuncelle();
    if (sesAyar.acik) muzikBaslat();
    else muzikDurdur();
    guncelleBgIsim();
    statTooltipBagla();
    mobilNavBagla();
    ekranDegistir('liderlik');
    if (window.TutorialEngine) {
      if (window.__yeniKayitOlundu) {
        TutorialEngine.reset();
        window.__yeniKayitOlundu = false;
      }
      if (!TutorialEngine.isComplete()) {
        setTimeout(function () {
          TutorialEngine.open({ force: true, navigate: false });
        }, 600);
      }
    }
  } catch (e) {
    clearTimeout(yukTimeout);
    sunucuBagli = false;
    if (yuk) {
      yuk.innerHTML =
        '❌ Sunucu kapalı veya oturum geçersiz.<br><br>Proje klasöründe <b>npm start</b> çalıştır, ardından <b>http://localhost:3000</b> adresinden gir (dosyayı doğrudan açma).'
        + '<br><br><button type="button" onclick="cikisYap()" style="margin-top:12px;padding:10px 18px;cursor:pointer;background:#1a1624;color:#c5a059;border:1px solid #c5a059;border-radius:6px;font-weight:600">Giriş Ekranına Dön</button>';
    }
  }
}

window.ekranDegistir = ekranDegistir;
