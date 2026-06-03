// ========================
// OYUNCU VERİSİ (sunucudan senkron)
// ========================
var oyuncuKasa = 10000;
var oyuncuGuc = 500;
var oyuncuPuan = 1500;
var oyuncuIcraat = 25;
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
var mekanTanimlari = {};
var aktifEkran = '';
var aktifLakap = 'Mafya';
var istihbaratEleman = 0;
var bankaBakiye = 0;
var sehirBannerState = { tip: 'belirsiz', reisAdi: null };
var yeniProfilZiyaret = 0;
var sesAyar = {
  acik: localStorage.getItem('sesAcik') !== '0',
  seviye: parseFloat(localStorage.getItem('sesSeviye') || '0.7', 10)
};
var sesAudioCtx = null;
var sesCache = {};
var SES_DOSYALARI = {
  para: '/sounds/para-sesi.wav?v=22',
  saldiri: '/sounds/saldiri-sesi.wav?v=22'
};
var liderlikModu = 'oyuncu';
var hosgeldinBuOturum = false;
var yeniGazeteHaber = false;

function hosgeldinGoster(w) {
  if (!w || w.hours < 1 || hosgeldinBuOturum) return;
  var modal = document.getElementById('hosgeldinModal');
  var saatEl = document.getElementById('raconSaat');
  var kazancEl = document.getElementById('raconKazanc');
  if (!modal || !saatEl || !kazancEl) return;
  hosgeldinBuOturum = true;
  var saat = w.hours || 0;
  var gelir = w.income || 0;
  saatEl.textContent = String(saat) + ' Saat';
  kazancEl.textContent = fmt(gelir) + ' TL';
  modal.classList.remove('gizli');
  if (gelir > 0) sesCal('para');
}

function hosgeldinKapat() {
  var modal = document.getElementById('hosgeldinModal');
  if (modal) modal.classList.add('gizli');
}

function apiFetch(url, opts) {
  var o = opts || {};
  o.credentials = 'include';
  if (o.body && typeof o.body === 'object' && !(o.headers && o.headers['Content-Type'])) {
    o.headers = Object.assign({}, o.headers, { 'Content-Type': 'application/json' });
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
  limanlar = p.limanlar || { istanbul: false, izmir: false, hatay: false };
  if (p.reisAdi) aktifReisAdi = p.reisAdi;
  if (p.lakap) aktifLakap = p.lakap;
  if (p.dunya) dunyaState = p.dunya;
  mafyaBildirim = !!p.mafyaBildirim;
  okunmamisMesaj = !!p.okunmamisMesaj;
  oyuncuDevlet = p.devletIliskisi != null ? p.devletIliskisi : 100;
  oyuncuSms = p.smsHakki != null ? p.smsHakki : 50;
  saatlikKazanc = p.saatlikKazanc || 0;
  sektorSahiplik = p.sektorSahiplik || {};
  rusvetBilgi = p.rusvet || rusvetBilgi;
  mekanTanimlari = p.mekanlar || {};
  istihbaratEleman = p.istihbaratEleman || 0;
  bankaBakiye = p.bankaBakiye || 0;
  karaListede = !!p.karaListede;
  sehirEfsane = !!p.sehirEfsane;
  if (p.sehirBanner) sehirBannerState = p.sehirBanner;
  yeniProfilZiyaret = p.yeniProfilZiyaret || 0;
  if (!secenekler.poll && p.offlineWelcome && p.offlineWelcome.hours >= 1) {
    hosgeldinGoster(p.offlineWelcome);
  }
  yeniGazeteHaber = !!p.yeniGazeteHaber;
  mafyaMenuYanip();
  profilMenuYanip();
  gazeteMenuYanip();
  sehirBannerGuncelle();
  mesajMenuYanip();
  arayuzGuncelle();
  // ÖNEMLİ: Otomatik ekran yeniden çizimi, kullanıcı ekranını bozuyordu
  // (Düşmana Çök sonucu kaybolması, Mafya ekranlarının kendi kendine değişmesi vb.)
  // Bu yüzden aktif ekranı kendiliğinden yeniden çizme.
  if (aktifEkran === 'liderlik') {
    var ic = document.getElementById('anaIcerik');
    if (ic) liderlikTablosuCiz(ic);
  }
  guncelleBgIsim();
  saygiDuvariYukle();
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
  if (sehirBannerState.tip === 'tek' && sehirBannerState.reisAdi) {
    el.className = 'sehir-banner tek';
    el.textContent = "ŞEHİR ŞU AN '" + sehirBannerState.reisAdi + "' TARAFINDAN YÖNETİLİYOR";
    el.classList.remove('gizli');
  } else {
    el.className = 'sehir-banner belirsiz';
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
      return '<li' + cls + ' onclick="oyuncuProfilGoster(' + o.userId + ')">' + o.reisAdi + ' <span style="color:#888;">(' + o.gun + ' gün)</span></li>';
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
    oyuncuUygula(data.player);
    if (data.player && data.player.kasa < oncekiKasa) sesCal('para');
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
var GORSEL_VERSIYON = '13';
var MEDYA_BANNER = '/images/is/medya_banner.png?v=' + GORSEL_VERSIYON;
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
  mafyaMasa: '/images/sohbet/mafya_masa.png?v=' + GORSEL_VERSIYON
};

var profilGorseller = {
  takimElbise: yerelGorsel('profil', 'takim_elbise')
};

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

function arayuzGuncelle() {
  document.getElementById('kasa').innerText = fmt(oyuncuKasa) + ' TL';
  document.getElementById('guc').innerText = fmt(oyuncuGuc);
  document.getElementById('puan').innerText = fmt(oyuncuPuan);
  var icraatEl = document.getElementById('icraat');
  icraatEl.innerText = oyuncuIcraat;
  icraatEl.title = 'Saatte +25 hak kazanılır. (İş yaparken harcarsın)';
  var smsEl = document.getElementById('smsHakki');
  var devEl = document.getElementById('devletIliskisi');
  if (smsEl) smsEl.innerText = oyuncuSms;
  if (devEl) {
    devEl.innerText = oyuncuDevlet;
    devEl.style.color = oyuncuDevlet < 5 ? '#cc0000' : '#fff';
  }
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

function gazeteMenuYanip() {
  var btn = document.getElementById('gazeteMenuBtn');
  if (btn) btn.classList.toggle('gazete-yanip', yeniGazeteHaber);
}

function toggleMenu(id, btn) {
  var menu = document.getElementById(id);
  var acik = menu.classList.contains('acik');
  menu.classList.toggle('acik', !acik);
  if (btn) btn.classList.toggle('aktif-menu', !acik);
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

function pencereAc(isAdi, netKazanc, icraat, gorselUrl) {
  sesCal('saldiri');
  document.getElementById('modalResim').src = gorselUrl || isGorselleri.varsayilan;
  document.getElementById('modalTebrik').innerHTML =
    aktifReisAdi + ' Reis! <span style="color:#b8942a;">' + isAdi + '</span> başarıyla tamamlandı.';
  document.getElementById('modalPara').innerText = '+' + fmt(netKazanc) + ' TL';
  document.getElementById('modalIcraat').innerText = icraat > 0 ? '-' + icraat + ' Hak' : '—';
  document.getElementById('soygunModal').classList.add('acik');
}

function pencereKapat() {
  document.getElementById('soygunModal').classList.remove('acik');
}

var FALLBACK = isGorselleri.varsayilan;

function imgFallback(el) {
  if (el && el.src !== FALLBACK) el.src = FALLBACK;
}

function guclenKartHTML(key, img, imgCls, baslik, alinti, maliyet, guc, gucRenk, btnLabel, btnCls) {
  return '<div class="is-kart"><div class="is-yapi">'
    + '<img src="' + img + '" class="' + imgCls + '" alt="" loading="lazy" onerror="imgFallback(this)">'
    + '<div class="is-detay"><h3>' + baslik + '</h3><p>💬 ' + alinti + '</p>'
    + '<p>💵 Birim: <b>' + maliyet + '</b> &nbsp;|&nbsp; ⚔️ Birim güç: <b style="color:' + gucRenk + ';">' + guc + '</b></p>'
    + '<div class="adet-satir"><label for="adet-' + key + '">📦 Adet</label>'
    + '<input type="number" id="adet-' + key + '" class="adet-input" value="1" min="1" max="999"></div>'
    + '<button type="button" class="btn-is ' + (btnCls || '') + '" onclick="adamKirala(\'' + key + '\')">[ ' + btnLabel + ' ]</button>'
    + '</div></div></div>';
}

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

function babaMakamEkran(makam, baslik, govdeMetin) {
  var m = makamBul(makam);
  var babaAd = m.sahipAdi;
  var benim = !!(babaAd && babaAd === aktifReisAdi);
  var isimParca = babaAd
    ? '<b style="color:#b8942a;">' + babaAd + '</b>'
    : '<span style="color:#888;">Henüz baba yok</span>';
  var metin = govdeMetin.replace(/\[BABA\]/g, isimParca);

  var html = '<div class="baba-hero"><img src="' + ARKA_PLAN_GORSEL + '" alt="" onerror="imgFallback(this)"></div>'
    + '<div class="is-kart baba-kart-icerik"><h3>' + baslik + '</h3>'
    + '<div class="baba-metin-blok">' + metin + '</div>'
    + '<div class="baba-derki-kutu"><b>Babanız derki;</b>';
  if (benim) {
    html += '<textarea id="babaDerki-' + makam + '" placeholder="Sözünü yaz...">' + (m.babaDerki || '') + '</textarea>'
      + '<button class="btn-is mavi-btn" style="margin-top:8px;" onclick="babaDerkiKaydet(\'' + makam + '\')">[ ✍️ YAZDIR ]</button>';
  } else {
    html += '<p class="baba-derki-goster">' + (m.babaDerki ? m.babaDerki : '—') + '</p>';
  }
  html += '</div>';
  if (makamBos(m) || !benim) {
    html += '<button class="btn-savas" style="margin-top:14px;" onclick="babaCok(\'' + makam + '\')">[ 👑 MAKAMA ÇÖK — 1 İCRAAT ]</button>';
  } else {
    html += '<p style="margin-top:14px;color:#b8942a;font-weight:600;">👑 Bu makamın sahibi sensin Reis.</p>';
  }
  html += '</div>';
  return html;
}

function mekanDevriSecenekleri() {
  var html = '<option value="">— Mekan seç —</option>';
  Object.keys(sektorSahiplik || {}).forEach(function(sk) {
    var s = sektorSahiplik[sk];
    if (!s || !s.adet) return;
    var parts = sk.split(':');
    if (parts.length < 2) return;
    var sektor = parts[0];
    var key = parts[1];
    var m = (mekanTanimlari[sektor] && mekanTanimlari[sektor][key]) || null;
    if (!m && typeof MEKANLAR_VERI !== 'undefined' && MEKANLAR_VERI[sektor]) {
      m = MEKANLAR_VERI[sektor][key];
    }
    var ad = m ? m.ad : sk;
    html += '<option value="' + sk + '">' + ad + ' (' + s.adet + ' adet)</option>';
  });
  return html;
}

function profilEkranSablonu(opts) {
  opts = opts || {};
  var ad = opts.oyuncuAdi || 'Reis';
  var adBaslik = opts.sehirEfsane ? '<span class="isim-efsane">' + ad + '</span>' : ad;
  var gucKart = opts.guc != null
    ? '<div class="is-kart"><p>⚔️ Güç</p><h3>' + fmt(opts.guc) + '</h3></div>'
    : '';
  var saatlikKart = opts.saatlik != null
    ? '<div class="is-kart"><p>⏱️ Saatlik Kazanç</p><h3 style="color:#28a745;">' + fmt(opts.saatlik) + ' TL</h3></div>'
    : '';
  var kara = opts.karaListede ? '<p style="color:#fff;"><b>💀 Kara Liste Ödülü:</b> 24 Saatlik Gelir</p>' : '';
  var efsane = opts.sehirEfsane ? '<p style="color:#b8942a;">👑 Şehir tarihine işlenmiş efsane.</p>' : '';

  var dostlarBlok;
  var dusmanlarBlok;
  if (opts.duzenlenebilir) {
    dostlarBlok = '<div class="profil-liste-kolon"><label>Dostlar</label>'
      + '<input type="text" id="profilDostlar" class="dusman-input" placeholder="Virgülle ayır" style="width:100%;margin-bottom:8px;">'
      + '<ul id="profilDostlarListe" class="profil-isim-listesi"></ul></div>';
    dusmanlarBlok = '<div class="profil-liste-kolon"><label>Düşmanlar</label>'
      + '<input type="text" id="profilDusmanlar" class="dusman-input" placeholder="Virgülle ayır" style="width:100%;margin-bottom:8px;">'
      + '<ul id="profilDusmanlarListe" class="profil-isim-listesi"></ul></div>';
  } else {
    dostlarBlok = '<div class="profil-liste-kolon"><label>Dostlar</label>'
      + '<ul class="profil-isim-listesi">' + isimListesiHTML(isimListesiParse(opts.dostlar), '—') + '</ul></div>';
    dusmanlarBlok = '<div class="profil-liste-kolon"><label>Düşmanlar</label>'
      + '<ul class="profil-isim-listesi">' + isimListesiHTML(isimListesiParse(opts.dusmanlar), '—') + '</ul></div>';
  }

  var aciklama = opts.duzenlenebilir
    ? '<p><label>Açıklama</label><textarea id="profilAciklama" class="dusman-input" rows="3" style="width:100%;"></textarea></p>'
    : '<p><b>📝 Açıklama:</b> ' + (opts.aciklama || '—') + '</p>';

  var html = '<h2>' + (opts.baslik || '👤 PROFİL') + '</h2>'
    + '<div class="profil-ozet" style="max-width:820px;margin:0 auto 20px;">'
    + '<div class="is-kart"><p>🕶️ Oyuncu</p><h3>' + adBaslik + '</h3></div>'
    + '<div class="is-kart"><p>🏷️ Lakap</p><h3>' + (opts.lakap || 'Mafya') + '</h3></div>'
    + gucKart
    + '<div class="is-kart"><p>🕶️ Saygınlık</p><h3>' + fmt(opts.puan || 0) + '</h3></div>'
    + saatlikKart
    + '</div>'
    + '<div class="is-kart" style="max-width:820px;margin:0 auto;">'
    + '<h3 class="bolum-baslik">Profil Bilgileri</h3>'
    + '<p id="profilKayitTarihiWrap"><b>📅 Kayıt:</b> <span id="profilKayitTarihi">' + (opts.kayitTarihi || '—') + '</span></p>'
    + efsane + kara + aciklama
    + '<div class="profil-dost-dusman">' + dostlarBlok + dusmanlarBlok + '</div>';
  if (opts.duzenlenebilir) {
    html += '<button class="btn-is mavi-btn" style="margin-top:14px;" onclick="profilKaydet()">[ 👤 PROFİLİ KAYDET ]</button>'
      + '<div style="text-align:center;margin:20px 0;">'
      + '<button class="btn-is mavi-btn" onclick="sifreDegistirModal()">[ 🔐 ŞİFRE DEĞİŞTİR ]</button></div>'
      + '<div id="sifreAlan" class="gizli is-kart" style="max-width:400px;margin:0 auto;">'
      + '<p><label>Mevcut şifre</label><input type="password" id="eskiSifre" class="dusman-input" style="width:100%;margin:6px 0;"></p>'
      + '<p><label>Yeni şifre</label><input type="password" id="yeniSifre" class="dusman-input" style="width:100%;margin:6px 0;"></p>'
      + '<button class="btn-is" onclick="sifreKaydet()">[ KAYDET ]</button></div>'
      + '<div id="profilZiyaretlerBox" class="is-kart" style="margin-top:14px;"></div>';
  }
  html += '</div>';
  return html;
}

function profilListeleriGuncelle() {
  var d = document.getElementById('profilDostlar');
  var x = document.getElementById('profilDusmanlar');
  var dl = document.getElementById('profilDostlarListe');
  var xl = document.getElementById('profilDusmanlarListe');
  if (dl && d) dl.innerHTML = isimListesiHTML(isimListesiParse(d.value), 'Henüz yok');
  if (xl && x) xl.innerHTML = isimListesiHTML(isimListesiParse(x.value), 'Henüz yok');
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
      var artis = r.fallback
        ? fmt(r.miktar || 0) + ' Saygınlık'
        : '▲ +' + fmt(r.miktar || 0);
      liderHtml += '<div class="gazete-lider-satir">'
        + '<span class="gazete-sira">' + (i + 1) + '</span>'
        + '<span class="gazete-isim">' + oyuncuLink(r.userId, r.isim) + '</span>'
        + '<span class="gazete-artis">' + artis + '</span></div>';
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

    ic.innerHTML = '<div class="gazete-wrap">'
      + '<div class="gazete-hero" style="background-image:url(\'/images/gazete-sayfa-bg.png?v=23\')">'
      + '<div class="gazete-hero-ic">'
      + '<div class="gazete-hero-ust">'
      + '<div class="gazete-tarih gazete-tarih-sol">' + escHtml(data.tarihUst || '') + '</div>'
      + '<div class="gazete-hero-orta">'
      + '<h1 class="gazete-ana-baslik">MEDYA HABER</h1>'
      + '<p class="gazete-alt-baslik">YERALTI DÜNYASININ GAZETESİ</p>'
      + '<p class="gazete-alinti"><em>"Bu şehirde adalet değil, güç konuşur."</em></p>'
      + '</div></div></div></div>'
      + '<div class="gazete-ticker">' + ticker + '</div>'
      + '<div class="gazete-govde">'
      + '<article class="gazete-manset">'
      + '<span class="gazete-etiket">ŞU MAFYANIN MANŞETİ</span>'
      + mansetBaslikHtml
      + '<img src="' + mansetImg + '" class="gazete-manset-img" alt="Liman" onerror="imgFallback(this)">'
      + '<p class="gazete-manset-metin">' + mansetOzet + '</p>'
      + '<span class="gazete-devam">HABERİN DEVAMI &gt;</span>'
      + '</article>'
      + '<aside class="gazete-yan">'
      + '<h3 class="gazete-yan-baslik">EN ÇOK SAYGINLIK KAZANANLAR</h3>'
      + liderHtml
      + '</aside></div>'
      + '<div class="gazete-alt-uc">'
      + '<div class="gazete-kutu"><h4>ŞEHRİN HAKİMİYETİ</h4>' + hakimiyetHtml + '</div>'
      + '<div class="gazete-kutu gazete-kutu-kirmizi"><h4>YERALTI MANŞETLERİ <small>(Özel İlanlar)</small></h4>' + manseHtml + '</div>'
      + '<div class="gazete-kutu"><h4>SON 24 SAATİN EFSANELERİ</h4>' + efsaneHtml + '</div>'
      + '</div></div>';
  } catch (e) {
    ic.innerHTML = '<h2>📰 GAZETE</h2><p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
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

function sesToggle() {
  sesAyar.acik = !sesAyar.acik;
  localStorage.setItem('sesAcik', sesAyar.acik ? '1' : '0');
  var btn = document.getElementById('sesAcKapa');
  if (btn) btn.textContent = sesAyar.acik ? '🔊' : '🔇';
}

function sesSeviyeDegistir(val) {
  sesAyar.seviye = Math.max(0, Math.min(1, val / 100));
  localStorage.setItem('sesSeviye', String(sesAyar.seviye));
}

// ========================
// EKRAN DEĞİŞTİR
// ========================
function ekranDegistir(tip) {
  aktifEkran = tip;
  var ic = document.getElementById('anaIcerik');

  if (tip === 'liderlik') {
    ic.innerHTML = '<h2>🏆 SÖZÜ GEÇENLER — LİDERLİK TABLOSU</h2>'
      + '<p>"Yeraltı dünyasında her şey saygınlık ile ölçülür."</p><p style="color:#888;">Yükleniyor...</p>';
    liderlikTablosuCiz(ic);
    return;
  }

  if (tip === 'profilim') {
    profilZiyaretOkundu();
    ic.innerHTML = profilEkranSablonu({
      baslik: '👤 PROFİLİM',
      duzenlenebilir: true,
      oyuncuAdi: aktifReisAdi,
      lakap: aktifLakap,
      guc: oyuncuGuc,
      puan: oyuncuPuan,
      saatlik: saatlikKazanc,
      karaListede: karaListede,
      sehirEfsane: sehirEfsane
    });
    profilYukle();
    return;
  }

  if (tip === 'devletIliskisi') {
    var r = rusvetBilgi;
    ic.innerHTML = '<h2>🏛️ DEVLET İLİŞKİSİ</h2>'
      + '<p>Devletle olan ilişkin <b>5</b>\'in altına düşerse hapse girer ve İcraata çıkamazsın. İcraat yapabilmen için devletle aranı iyi tutmalısın. Vereceğin rüşvet Saygınlığın arttıkça yükselir.</p>'
      + '<p style="color:#b8942a;">Mevcut Devlet İlişkin: <b>' + oyuncuDevlet + '</b>/600</p>'
      + '<div class="devlet-yapi">'
      + '<div class="devlet-resim-kutu"><img src="' + devletGorseller.yetkili + '" alt="" onerror="imgFallback(this)">'
      + '<p style="margin-top:8px;"><b>Devlet Yetkilisi</b></p>'
      + '<p style="color:#888;font-size:13px;">Devlet adamlarının rüşvet alması hoş olmasa da senin işlerini yürütmen için devlet ilişkilerin çok önemli.</p></div>'
      + '<div class="is-kart" style="flex:1;min-width:240px;">'
      + '<p>Rüşvet miktarı (TL):</p>'
      + '<p style="font-size:22px;color:#b8942a;font-weight:700;">' + fmt(r.onerilen || r.min) + ' TL</p>'
      + '<p style="color:#666;font-size:12px;">Aralık (Saygınlığa göre): ' + fmt(r.min) + ' – ' + fmt(r.max) + ' TL</p>'
      + '<input type="number" id="rusvetMiktar" class="dusman-input" value="' + (r.onerilen || r.min) + '" min="' + r.min + '" max="' + r.max + '">'
      + '<button class="btn-is kirmizi-btn" style="margin-top:10px;" onclick="rusvetVer()">[ 💵 RÜŞVET VER ]</button></div></div>';
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

  if (tip === 'korumaEkibi') {
    ic.innerHTML = '<h2>👥 KORUMA EKİBİ VE TETİKÇİLER</h2><p>"Arkanı sağlama al Reis."</p>'
      + guclenKartHTML('delikanli', koruyucuGorseller.delikanli, 'vesikalik-resim', '🪖 Mahalle Delikanlısı', '"Sokağın gözü kulağı."', '500 TL', '+50', '#28a745', '🪙 ADAMI KİRALA')
      + guclenKartHTML('bodyguard', koruyucuGorseller.bodyguard, 'vesikalik-resim', '💪 BodyGuard Tut', '"Giriş çıkışları tutan duvar."', '2.000 TL', '+250', '#28a745', '🪙 ADAMI KİRALA')
      + guclenKartHTML('profesyonel', koruyucuGorseller.profesyonel, 'vesikalik-resim', '🕶️ Profesyonel Koruma', '"Takım elbiseli yakın koruma."', '8.000 TL', '+1.100', '#28a745', '🪙 ADAMI KİRALA')
      + guclenKartHTML('harekat', koruyucuGorseller.harekat, 'vesikalik-resim', '🦅 Özel Harekat Emeklisi', '"Operasyonların gizli beyni."', '30.000 TL', '+4.500', '#28a745', '🪙 ADAMI KİRALA');
    return;
  }

  if (tip === 'silahlan') {
    ic.innerHTML = '<h2>🔫 CEPHANELİK VE SİLAHLANMA</h2><p>"Sözün bittiği yerde silahlar konuşur."</p>'
      + guclenKartHTML('tabanca', silahGorseller.tabanca, 'vesikalik-resim', '🔫 Baretta Tabanca', '"Yakın mesafe vazgeçilmezi."', '1.200 TL', '+100', '#00e5ff', '🔫 SİLAHI SATIN AL', 'mavi-btn')
      + guclenKartHTML('pompali', silahGorseller.pompali, 'vesikalik-resim', '💥 Taktik Pompalı Tüfek', '"Barikatları dağıtan gürültü."', '4.500 TL', '+450', '#00e5ff', '🔫 SİLAHI SATIN AL', 'mavi-btn')
      + guclenKartHTML('ak47', silahGorseller.ak47, 'vesikalik-resim', '🔥 Gaddar Keleş (AK-47)', '"Yeraltının simgesi."', '15.000 TL', '+1.800', '#00e5ff', '🔫 SİLAHI SATIN AL', 'mavi-btn')
      + guclenKartHTML('agir_silah', silahGorseller.agir_silah, 'vesikalik-resim', '⚡ Görünmez Gölge', '"Ağır silah kasası."', '45.000 TL', '+6.000', '#00e5ff', '🔫 SİLAHI SATIN AL', 'mavi-btn')
      + guclenKartHTML('sniper', silahGorseller.sniper, 'vesikalik-resim', '🎯 AWM Keskin Nişancı', '"Uzun menzil hakimiyeti."', '55.000 TL', '+7.500', '#00e5ff', '🔫 SİLAHI SATIN AL', 'mavi-btn');
    return;
  }

  if (tip === 'luksYasam') {
    ic.innerHTML = '<h2>💎 LÜKS YAŞAM</h2><p>"Lüks harcamalar ağırlığını artırır."</p>'
      + guclenKartHTML('saat', luksGorseller.saat, 'luks-resim', '⌚ Lüks Kol Saati', '"Prestij abidesi."', '15.000 TL', '+2.500', '#b8942a', '💎 SATIN AL', 'kirmizi-btn')
      + guclenKartHTML('motorsiklet', luksGorseller.motorsiklet, 'luks-resim', '🏍️ Klasik Özel Motorsiklet', '"Sokağın hakimine yakışan hız."', '75.000 TL', '+15.000', '#b8942a', '💎 SATIN AL', 'kirmizi-btn')
      + guclenKartHTML('araba', luksGorseller.araba, 'luks-resim', '🏎️ İtalyan Spor Araba', '"Prestij ve hız."', '350.000 TL', '+80.000', '#b8942a', '💎 SATIN AL', 'kirmizi-btn')
      + guclenKartHTML('yat', luksGorseller.yat, 'luks-resim', '🛥️ Süper Lüks Yat', '"Deniz sarayı."', '2.500.000 TL', '+600.000', '#b8942a', '💎 SATIN AL', 'kirmizi-btn')
      + guclenKartHTML('helikopter', luksGorseller.helikopter, 'luks-resim', '🚁 Özel Taktik Helikopter', '"Havadan operasyon."', '8.000.000 TL', '+2.000.000', '#b8942a', '💎 SATIN AL', 'kirmizi-btn')
      + guclenKartHTML('jet', luksGorseller.jet, 'luks-resim', '🛩️ Özel Jet', '"Dünyanın her yerine ulaşım."', '45.000.000 TL', '+10.000.000', '#b8942a', '💎 SATIN AL', 'kirmizi-btn');
    return;
  }

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
      + '<p class="liman-gelir-notu">⏱️ Türkiye saatiyle her saat başı liman başına <b>10.000.000 TL</b> kazanırsın. '
      + '<b>Üç limanı birden elinde tutarsan saatlik 50.000.000 TL kazanırsın!</b></p>'
      + limanKartHTML('istanbul') + limanKartHTML('izmir') + limanKartHTML('hatay');
    return;
  }

  if (tip === 'baba_soz') {
    ic.innerHTML = '<h2>📿 SÖZÜNÜ GEÇİR</h2>'
      + babaMakamEkran('sozunu_gecir', '📿 Sözünü Geçir',
        '<p>Söz bitince, icraat başlar. Şimdi herkes ayağını denk alsın.</p>'
        + '<p>Bu alemde en büyük söz sahibi [BABA] babadır. Hepiniz sözünü dinleyeceksiniz!</p>'
        + '<p><b>Babanız derki;</b> (aşağıda)</p>');
    return;
  }

  if (tip === 'baba_sadakat') {
    var sad = (dunyaState.baba && dunyaState.baba.sadakat) || { taniyanlar: [], tanimayanlar: [] };
    ic.innerHTML = '<h2>⚔️ SADAKAT YEMİNİ</h2>'
      + babaMakamEkran('sadakat_yemini', '⚔️ Sadakat Yemini',
        '<p>Kılıcımız değil, sözümüz keskindir; biat eden asla yarı yolda kalmaz.</p>'
        + '<p>Babanız [BABA]. Babanıza Sadakat Yemini edin rahat edin.</p>'
        + '<p><b>Babanız derki;</b> (aşağıda)</p>')
      + '<div style="margin-top:16px;text-align:center;">'
      + '<button class="btn-is" onclick="sadakatOy(\'tani\')">[ ✅ BABANI TANI ]</button> '
      + '<button class="btn-is kirmizi-btn" onclick="sadakatOy(\'red\')">[ ❌ BABANI REDDET ]</button></div>'
      + '<div class="sadakat-listeler"><div class="sadakat-kolon"><h4>TANIYANLAR</h4><p>'
      + (sad.taniyanlar.length ? sad.taniyanlar.join(', ') : '—') + '</p></div>'
      + '<div class="sadakat-kolon"><h4>TANIMAYANLAR</h4><p>'
      + (sad.tanimayanlar.length ? sad.tanimayanlar.join(', ') : '—') + '</p></div></div>';
    return;
  }

  if (tip === 'dusmanaCok') {
    ic.innerHTML = '<div class="dusman-ust">'
      + '<img src="' + ozelGorseller.catisma + '" alt="Çatışma" onerror="imgFallback(this)">'
      + '<p style="margin-top:16px;font-size:17px;font-weight:600;">Düşmanın adını yaz ve ona kim olduğunu göster..!</p>'
      + '<div class="dusman-form">'
      + '<input type="text" id="dusmanHedef" class="dusman-input" placeholder="Düşman Adını Yaz.." maxlength="24">'
      + '<button class="btn-is kirmizi-btn" onclick="dusmanaSaldir()">[ ⚔️ SALDIR ]</button></div>'
      + '<p class="dusman-kural-uyari">1 İcraat harcanır. Rakibin gücünü bilmiyorsan önce istihbarat gönder. Güçlüysen kazanırsın.</p>'
      + '<div id="saldiriSonuc" class="saldiri-sonuc gizli"></div>'
      + '</div>';
    return;
  }

  if (tip === 'istihbarat') {
    ic.innerHTML = '<h2>🕵️ İSTİHBARAT</h2>'
      + '<p>"Bilgi güçtür. Rakiplerinin gücünü öğrenmek için istihbarat elemanları al."</p>'
      + '<div class="is-kart"><h3 class="bolum-baslik">İstihbarat Elemanları</h3>'
      + '<p>🕵️ Mevcut Eleman: <b style="color:#b8942a;">' + istihbaratEleman + '</b></p>'
      + '<p>💵 Birim Maliyet: <b>50.000 TL</b> | ⚔️ Birim Güç: <b>+100</b></p>'
      + '<div class="adet-satir"><label for="adet-istihbarat">📦 Adet</label>'
      + '<input type="number" id="adet-istihbarat" class="adet-input" value="1" min="1" max="100"></div>'
      + '<button class="btn-is" onclick="istihbaratAl()">[ 🕵️ ELEMAN AL ]</button></div>'
      + '<div class="is-kart" style="margin-top:16px;"><h3 class="bolum-baslik">Rakip İstihbaratı</h3>'
      + '<p>Rakip oyuncunun gücünü öğrenmek için adını yaz.</p>'
      + '<input type="text" id="istihbaratHedef" class="dusman-input" placeholder="Rakip reis adı..." maxlength="24" style="width:100%;margin:8px 0;">'
      + '<button class="btn-is mavi-btn" onclick="istihbaratSpy()">[ 🔍 GÜCÜ ÖĞREN ]</button></div>'
      + '<div id="istihbaratSonuc" class="saldiri-sonuc gizli"></div>';
    return;
  }

  if (tip === 'banka') {
    ic.innerHTML = '<h2>🏦 BANKA</h2>'
      + '<p>"Paranı güvene al. İstediğin miktarı yatırıp istediğin miktarı çekebilirsin."</p>'
      + '<div class="is-kart" style="text-align:center;max-width:520px;margin:0 auto 14px;"><h3 class="bolum-baslik">Banka Hesabı</h3>'
      + '<p style="font-size:24px;color:#ffd700;margin:16px 0;">💰 ' + fmt(bankaBakiye) + ' TL</p></div>'
      + '<div class="is-kart" style="max-width:520px;margin:0 auto;"><h3 class="bolum-baslik">Para Yatır</h3>'
      + '<p>Kasandaki parasını istediğin miktarda yatırabilirsin.</p>'
      + '<label>Yatırılacak Miktar (TL):</label>'
      + '<input type="number" id="bankaYatirMiktar" min="1" max="' + oyuncuKasa + '" value="' + Math.floor(oyuncuKasa / 2) + '" style="width:100%;margin:8px 0;">'
      + '<button class="btn-is" onclick="bankaYatir()">[ 💰 YATIR ]</button></div>'
      + '<div class="is-kart" style="max-width:520px;margin:16px auto 0;"><h3 class="bolum-baslik">Para Çek</h3>'
      + '<p>Bankadaki parasını istediğin miktarda çekebilirsin.</p>'
      + '<label>Çekilecek Miktar (TL):</label>'
      + '<input type="number" id="bankaCekMiktar" min="1" max="' + bankaBakiye + '" value="' + Math.floor(bankaBakiye / 2) + '" style="width:100%;margin:8px 0;">'
      + '<button class="btn-is kirmizi-btn" onclick="bankaCek()">[ 💸 ÇEK ]</button></div>';
    return;
  }

  if (tip === 'gazete') {
    gazeteEkranCiz(ic);
    return;
  }

  if (tip === 'mekan_devri') {
    var mekanOpts = mekanDevriSecenekleri();
    ic.innerHTML = '<h2>🔄 MEKAN DEVRİ & PARA GÖNDERME</h2>'
      + '<p>"Mekanlarını dostlarına devret veya para gönder."</p>'
      + '<div class="is-kart" style="max-width:560px;margin:0 auto;"><h3 class="bolum-baslik">Mekan Devret</h3>'
      + '<p><label>Dost reis adı</label>'
      + '<input type="text" id="mekanDevriHedef" class="dusman-input" placeholder="Dost reis adı..." maxlength="24" style="width:100%;margin:6px 0 12px;"></p>'
      + '<p><label>Devredilecek mekan</label>'
      + '<select id="mekanDevriMekan" class="dusman-input" style="width:100%;margin:6px 0 12px;">' + mekanOpts + '</select></p>'
      + '<p><label>Adet</label>'
      + '<input type="number" id="mekanDevriAdet" class="dusman-input" value="1" min="1" max="999" style="width:100%;margin:6px 0 12px;"></p>'
      + '<button class="btn-is mavi-btn" onclick="mekanDevret()">[ 🔄 DEVRET ]</button>'
      + '<div id="mekanDevriSonuc" class="saldiri-sonuc gizli" style="margin-top:12px;"></div></div>'
      + '<div class="is-kart" style="max-width:560px;margin:16px auto 0;"><h3 class="bolum-baslik">Para Gönder</h3>'
      + '<p><label>Alıcı reis adı</label>'
      + '<input type="text" id="paraGonderHedef" class="dusman-input" placeholder="Alıcı reis adı..." maxlength="24" style="width:100%;margin:6px 0 12px;"></p>'
      + '<p><label>Gönderilecek Miktar (TL)</label>'
      + '<input type="number" id="paraGonderMiktar" class="dusman-input" value="100000" min="1" max="999999999" style="width:100%;margin:6px 0 12px;"></p>'
      + '<button class="btn-is" onclick="paraGonder()">[ 💸 PARA GÖNDER ]</button>'
      + '<div id="paraGonderSonuc" class="saldiri-sonuc gizli" style="margin-top:12px;"></div></div>';
    return;
  }

  if (tip === 'medya') {
    ic.innerHTML = '<div class="medya-hero"><img src="' + MEDYA_BANNER + '" alt="Medya Merkezi" onerror="imgFallback(this)"></div>'
      + '<h2>📰 MEDYA</h2>'
      + '<p>"Haberleri kontrol et, propaganda yap, rakiplerini aşağıla."</p>'
      + '<div class="is-kart"><h3 class="bolum-baslik">Haber Yayınla</h3>'
      + '<p>💵 Maliyet: <b>100.000 TL</b> | Haber 24 saat görünür.</p>'
      + '<textarea id="medyaHaber" class="dusman-input" rows="3" style="width:100%;margin:8px 0;" placeholder="Haber metni yaz..." maxlength="200"></textarea>'
      + '<button class="btn-is" onclick="medyaHaberYayinla()">[ 📰 HABER YAYINLA ]</button></div>'
      + '<div id="medyaSonuc" class="saldiri-sonuc gizli"></div>'
      + '<div class="is-kart" style="margin-top:16px;"><h3 class="bolum-baslik">Son Haberler</h3>'
      + '<div id="medyaHaberlerListesi" style="margin-top:12px;"></div></div>';
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
      html += '<div class="is-kart" style="margin-bottom:12px;">'
        + '<p><b' + adCls + '>👑 ' + k.hukumdarAdi + (k.aktif ? ' (Şu an)' : '') + '</b></p>'
        + '<p>📅 Başlangıç: ' + (k.baslangicMetin || '—') + '</p>';
      if (!k.aktif && k.bitisMetin) html += '<p>📅 Bitiş: ' + k.bitisMetin + '</p>';
      html += '<p>⏳ Süre: <b>' + k.gunSayisi + ' gün</b></p>';
      if (k.oncekiReisAdi) html += '<p>🔄 Kimden aldı: <b>' + k.oncekiReisAdi + '</b></p>';
      if (k.kaybedenReisAdi && !k.aktif) html += '<p>💀 Kaybeden: <b>' + k.kaybedenReisAdi + '</b></p>';
      html += '</div>';
    });
    ic.innerHTML = html;
  } catch (e) {
    ic.innerHTML = '<h2>📜 ŞEHİR TARİHİ</h2><p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
  }
}

async function karaListeCiz(ic) {
  ic.innerHTML = '<h2>💀 KARA LİSTE</h2><p>"Şehre hükmeden reis burada görünür."</p><p style="color:#888;">Yükleniyor...</p>';
  if (!sunucuBagli) {
    ic.innerHTML = '<h2>💀 KARA LİSTE</h2><p style="color:#c00;">Sunucu kapalı.</p>';
    return;
  }
  try {
    var res = await apiFetch('/api/kara-liste');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    var liste = data.liste || [];
    if (!liste.length) {
      ic.innerHTML = '<h2>💀 KARA LİSTE</h2><p>Şu an kara listede kimse yok.</p>';
      return;
    }
    var html = '<h2>💀 KARA LİSTE</h2><p>"Şehre hükmeden reis burada görünür."</p>';
    html += '<div class="tablo-container"><div class="tablo-izgara tablo-baslik-satir" style="grid-template-columns:60px 1fr 180px 180px;">'
      + '<span>#</span><span>OYUNCU</span><span>MAFYA GRUBU</span><span>SAYGINLIK</span></div>';
    liste.forEach(function(r, i) {
      html += '<div class="tablo-izgara" style="grid-template-columns:60px 1fr 180px 180px;">'
        + '<span>#' + (i + 1) + '</span><span>' + oyuncuLink(r.user_id, r.reis_adi) + '</span><span>' + (r.grup || '—') + '</span><span>' + fmt(r.puan || 0) + '</span></div>';
    });
    html += '</div>';
    ic.innerHTML = html;
  } catch (e) {
    ic.innerHTML = '<h2>💀 KARA LİSTE</h2><p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
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
}

async function isYap(key) {
  var ef = await sunucuAksiyon('job', key);
  if (!ef) return;
  pencereAc(ef.isAdi, ef.netKazanc, ef.icraat, isGorselleri[ef.gorselKey] || FALLBACK);
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

async function dusmanaSaldir() {
  var hedef = document.getElementById('dusmanHedef');
  if (!hedef || !hedef.value.trim()) {
    toast('Düşman adını yaz!', 'hata');
    return;
  }
  var ef = await sunucuAksiyon('dusmana_cok', null, null, { hedef: hedef.value.trim() });
  if (ef === null) return;
  sesCal('saldiri');
  var box = document.getElementById('saldiriSonuc');
  if (box && ef.mesaj) {
    box.classList.remove('gizli');
    box.innerText = ef.mesaj;
  } else {
    toast(ef.mesaj || 'Saldırı tamamlandı.', ef.kazandi ? 'basari' : 'hata');
  }
}

async function istihbaratAl() {
  var ef = await sunucuAksiyon('istihbarat_al', null, adetOku('istihbarat'));
  if (ef === null) return;
  toast('🕵️ ' + ef.elemanSayisi + ' eleman alındı! — ' + fmt(ef.odenen) + ' TL', 'basari');
  istihbaratEleman = ef.elemanSayisi;
  ekranDegistir('istihbarat');
}

async function istihbaratSpy() {
  var hedef = document.getElementById('istihbaratHedef').value.trim();
  if (!hedef) {
    toast('Hedef gir.', 'hata');
    return;
  }
  var ef = await sunucuAksiyon('istihbarat_spy', null, null, { hedef });
  if (ef === null) return;
  var sonucDiv = document.getElementById('istihbaratSonuc');
  sonucDiv.classList.remove('gizli');
  if (ef.basari) {
    if (ef.guc !== null) {
      sonucDiv.innerHTML = '<p style="color:#090;">✅ ' + ef.mesaj + '<br>Güç: ' + fmt(ef.guc) + '</p>';
    } else {
      sonucDiv.innerHTML = '<p style="color:#fa0;">⚠️ ' + ef.mesaj + '</p>';
    }
  } else {
    sonucDiv.innerHTML = '<p style="color:#c00;">❌ ' + ef.mesaj + '</p>';
  }
}

async function bankaYatir() {
  var miktar = parseInt(document.getElementById('bankaYatirMiktar').value, 10) || 0;
  if (miktar < 1) {
    toast('Geçerli bir miktar gir.', 'hata');
    return;
  }
  var ef = await sunucuAksiyon('banka_yatir', null, null, { miktar: miktar });
  if (ef === null) return;
  sesCal('para');
  toast('💰 ' + fmt(ef.yatirilan) + ' TL yatırıldı! — Toplam: ' + fmt(ef.toplam) + ' TL', 'basari');
  bankaBakiye = ef.toplam;
  ekranDegistir('banka');
}

async function bankaCek() {
  var miktar = parseInt(document.getElementById('bankaCekMiktar').value, 10) || 0;
  if (miktar < 1) {
    toast('Geçerli bir miktar gir.', 'hata');
    return;
  }
  var ef = await sunucuAksiyon('banka_cek', null, null, { miktar: miktar });
  if (ef === null) return;
  sesCal('para');
  toast('💸 ' + fmt(ef.cekilen) + ' TL çekildi!', 'basari');
  bankaBakiye = 0;
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
    sonucDiv.innerHTML = '<p style="color:#090;">✅ ' + (ef.mesaj || 'Mekan devredildi.') + '</p>';
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
    sonucDiv.innerHTML = '<p style="color:#090;">✅ ' + (ef.mesaj || fmt(miktar) + ' TL gönderildi.') + '</p>';
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
  sonucDiv.classList.remove('gizli');
  if (ef.ok) {
    sonucDiv.innerHTML = '<p style="color:#090;">✅ ' + ef.mesaj + '</p>';
    document.getElementById('medyaHaber').value = '';
    medyaHaberleriYukle();
  } else {
    sonucDiv.innerHTML = '<p style="color:#c00;">❌ ' + ef.mesaj + '</p>';
  }
}

async function medyaHaberleriYukle() {
  try {
    var res = await apiFetch('/api/medya/haberler');
    var data = await res.json();
    var box = document.getElementById('medyaHaberlerListesi');
    if (!data.ok || !data.haberler || !data.haberler.length) {
      if (box) box.innerHTML = '<p style="color:#888;">Henüz haber yok.</p>';
      return;
    }
    var html = '';
    data.haberler.forEach(function(h) {
      html += '<div class="is-kart" style="padding:12px;"><p style="color:#b8942a;font-weight:600;">' + h.reis_adi + '</p>'
        + '<p style="color:#ddd;">' + h.haber + '</p></div>';
    });
    if (box) box.innerHTML = html;
  } catch (e) {
    console.error(e);
  }
}

function mafyaMenuSec(mod) {
  aktifEkran = 'mafya';
  var ic = document.getElementById('anaIcerik');
  ic.innerHTML = '<h2>🕶️ MAFYA GRUBU</h2><div id="mafyaAltIcerik" class="mafya-alt-icerik"></div>';
  mafyaAltEkran(mod);
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

function mafyaAltEkran(mod) {
  var box = document.getElementById('mafyaAltIcerik');
  if (!box) return;
  if (mod === 'olustur') {
    box.innerHTML = '<div class="mafya-form is-kart">'
      + '<h3 class="bolum-baslik">Mafya Grubu Oluştur</h3>'
      + '<input type="text" id="mafyaIsim" placeholder="Grup adı" maxlength="32">'
      + '<button type="button" class="btn-is" onclick="mafyaOlusturAdim1()">[ OLUŞTUR ]</button>'
      + '<div id="mafyaAciklamaAlan" class="gizli"><label>Açıklama:</label>'
      + '<textarea id="mafyaAciklama" rows="3" maxlength="200" placeholder="Grubun hakkında..."></textarea>'
      + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaOlusturAdim2()">[ GRUBU KUR ]</button></div></div>'
      + '<div id="mafyaGurupListeEk" style="margin-top:16px;"></div>';
    mafyaTumGuruplariGoster('mafyaGurupListeEk');
    return;
  }
  if (mod === 'katil') {
    box.innerHTML = '<div class="mafya-form is-kart">'
      + '<h3 class="bolum-baslik">Mafya Grubuna Katıl</h3>'
      + '<input type="text" id="mafyaAra" placeholder="Grup adı yaz">'
      + '<button type="button" class="btn-is mavi-btn" onclick="mafyaAra()">[ ARA ]</button>'
      + '<div id="mafyaAraSonuc" style="margin-top:14px;"></div></div>'
      + '<div id="mafyaGurupListeEk" style="margin-top:16px;"></div>';
    mafyaTumGuruplariGoster('mafyaGurupListeEk');
    return;
  }
  if (mod === 'gurubum') {
    mafyaGurubumCiz(box);
  }
  if (mod === 'savaslar') {
    mafyaSavaslarCiz(box);
  }
  if (mod === 'isler') {
    mafyaIslerCiz(box);
  }
  if (mod === 'evi') {
    mafyaEviCiz(box);
  }
}

async function mafyaIslerCiz(box) {
  box.innerHTML = '<p style="color:#888;">Yükleniyor...</p>';
  if (!sunucuBagli) { box.innerHTML = '<p style="color:#c00;">Sunucu kapalı.</p>'; return; }
  try {
    var res = await apiFetch('/api/mafya/isler');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.panel) throw new Error(data.error || 'Yüklenemedi');
    var panel = data.panel;
    if (!panel.grup) {
      box.innerHTML = '<h2>💼 MAFYA İŞLERİ</h2><p style="color:#888;">Mafya grubuna üye olmadan bu işleri yapamazsın.</p>';
      return;
    }
    var aktif = panel.aktifIs;
    var aktifKey = aktif ? aktif.isTuru : null;
    var html = '<h2>💼 MAFYA İŞLERİ</h2>'
      + '<p>"Online üyelerle birlikte soyguna hazırlan, şartlar tutunca soygunu gerçekleştir."</p>'
      + '<div class="is-kart" style="padding:12px;max-width:720px;margin:0 auto 12px;">'
      + '<p><b>Grup Online:</b> ' + panel.grup.onlineSayisi + ' / ' + panel.grup.uyeSayisi + '</p>'
      + (aktif ? ('<p style="color:#b8942a;"><b>Aktif Hazırlık:</b> ' + aktif.isTuru + '</p>') : '<p style="color:#666;">Aktif hazırlık yok.</p>')
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
        html += '<div style="margin-top:10px;color:#ddd;"><b>Katılanlar:</b> '
          + (list.length ? list.map(function(k) { return (k.online ? '🟢 ' : '⚫ ') + k.reisAdi; }).join(' , ') : 'Henüz yok.')
          + '</div>';
      }
      html += '</div>';
    });
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<h2>💼 MAFYA İŞLERİ</h2><p style="color:#c00;">' + (e.message || 'Yüklenemedi') + '</p>';
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
  mafyaAltEkran('evi');
}

async function mafyaEviSeviye() {
  var ef = await sunucuAksiyon('mafya_evi_seviye');
  if (ef === null) return;
  toast('Seviye yükseltildi!', 'basari');
  mafyaAltEkran('evi');
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
    var html = '<h3 class="bolum-baslik">Mafya Savaşları</h3>';
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
  mafyaAltEkran('savaslar');
}

async function mafyaSavasaKatil(savasId) {
  var ef = await sunucuAksiyon('mafya_savas_katil', null, null, { savasId: savasId });
  if (ef === null) return;
  toast(ef.mesaj || 'Savaşa katıldın!', 'basari');
  mafyaAltEkran('savaslar');
}

function mafyaGurupListesiHTML(gruplar, basvuruModu) {
  if (!gruplar || !gruplar.length) {
    return '<p style="color:#666;margin-top:12px;">Henüz kurulmuş Mafya Grubu yok. İlk sen kur Reis!</p>';
  }
  var html = '<h3 class="bolum-baslik">Mevcut Mafya Grupları</h3>';
  gruplar.forEach(function(g) {
    html += '<div class="is-kart" style="padding:14px;"><b><button class="btn-is mavi-btn" style="margin:0;padding:4px 8px;" onclick="mafyaGrupGoster(' + g.id + ')">' + g.isim + '</button></b>';
    if (g.lider_adi) html += ' <span style="color:#888;">— Lider: ' + g.lider_adi + '</span>';
    html += '<p style="color:#777;font-size:13px;margin:8px 0;">' + (g.aciklama || '—') + '</p>';
    if (basvuruModu) {
      html += '<button class="btn-is" onclick="mafyaBasvur(' + g.id + ')">[ BAŞVUR ]</button>';
    }
    html += '</div>';
  });
  return html;
}

async function mafyaGurubumCiz(box) {
  box.innerHTML = '<p style="color:#888;">Yükleniyor...</p>';
  if (!sunucuBagli) {
    box.innerHTML = '<p style="color:#c00;">Sunucu kapalı. Terminalde <b>npm start</b> çalıştır, ardından <b>http://localhost:3000</b> aç.</p>';
    return;
  }
  try {
    var res = await apiFetch('/api/mafya');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || ('HTTP ' + res.status));
    }
    mafyaBildirim = !!(data.basvurular && data.basvurular.length) || !!data.bekleyenBasvuru;
    mafyaMenuYanip();

    if (!data.uyelik) {
      box.innerHTML = '<p style="color:#fff;font-weight:700;">Henüz Mafya Grubu Üyesi Değilsin!</p>';
      return;
    }

    var html = '<div class="is-kart"><h3 style="color:#ffd700;font-size:20px;text-shadow:0 0 8px rgba(255,215,0,0.4);">' + data.uyelik.isim + '</h3>'
      + '<p style="color:#c9a961;">' + (data.uyelik.aciklama || '') + '</p></div>'
      + '<div class="tablo-container mafya-uyeler-tablo" style="margin-top:16px;">'
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
      html += '<div class="tablo-izgara"><span style="color:#e0e0e0;">' + u.reis_adi + '</span><span style="color:#c9a961;">' + u.rutbe + '</span><span style="color:#ffd700;">' + fmt(u.puan) + '</span><span style="color:' + offlineColor + ';">' + offlineStr + '</span><span>';
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
      html += '<div style="margin-top:20px;">';
      if (data.basvurular && data.basvurular.length) {
        html += '<h3 class="bolum-baslik" style="color:#ffd700;">📩 Başvurular</h3>';
        data.basvurular.forEach(function(b) {
          html += '<p style="margin-bottom:8px;color:#e0e0e0;">' + b.reis_adi
            + ' <button type="button" class="btn-is" onclick="mafyaKabul(' + b.id + ')">Kabul</button> '
            + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaRed(' + b.id + ')">Red</button></p>';
        });
      }
      html += '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaDagit()">[ 💥 MAFYA GURUBUNU DAĞIT ]</button></div>';
    } else {
      html += '<button type="button" class="btn-is kirmizi-btn" style="margin-top:20px;" onclick="mafyaCik()">[ 🚪 GRUPTAN ÇIK — 1.000.000 TL ]</button>';
    }
    box.innerHTML = html;
  } catch (e) {
    var msg = e.message || 'Bağlantı hatası';
    if (msg.indexOf('404') >= 0) {
      msg = 'Mafya API bulunamadı (HTTP 404). Oyunu Live Server ile değil; npm start ile http://localhost:3000 üzerinden aç.';
    }
    box.innerHTML = '<p style="color:#c00;">' + msg + '</p>'
      + '<p style="color:#888;margin-top:8px;">Terminal: <b>npm start</b> → tarayıcı: <b>http://localhost:3000</b> → <b>Ctrl+F5</b></p>';
  }
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
    box.innerHTML = '<p style="color:#888;">Sonuç yok.</p>';
    return;
  }
  var html = '';
  data.liste.forEach(function(g) {
    html += '<div class="is-kart" style="padding:12px;"><b>' + g.isim + '</b> — ' + g.lider_adi
      + '<p style="color:#666;font-size:12px;">' + g.aciklama + '</p>'
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
  var response = await fetch('/api/mafya/grup/' + grupId);
  if (!response.ok) {
    toast('Grup bilgileri alınamadı.', 'hata');
    return;
  }
  var data = await response.json();
  if (!data.ok) {
    toast(data.error || 'Hata', 'hata');
    return;
  }

  var grup = data.grup;
  var html = '<div style="padding:20px;">';
  html += '<h2 style="color:#ffd700;margin-bottom:16px;">' + grup.isim + '</h2>';
  
  html += '<div style="margin-bottom:20px;">';
  html += '<h3 style="color:#c9a961;">🏠 Mafya Evi</h3>';
  html += '<p style="color:#ddd;margin:8px 0;"><strong>Seviye:</strong> ' + (grup.evi_seviyesi || 0) + '</p>';
  html += '<p style="color:#ddd;margin:8px 0;"><strong>Kasasında:</strong> ₺ ' + (grup.kasa || 0).toLocaleString() + '</p>';
  html += '</div>';

  html += '<div style="margin-bottom:20px;">';
  html += '<h3 style="color:#c9a961;">👥 Üyeler (' + (grup.uyeler ? grup.uyeler.length : 0) + ')</h3>';
  if (grup.uyeler && grup.uyeler.length) {
    html += '<div style="max-height:300px;overflow-y:auto;">';
    grup.uyeler.forEach(function(u) {
      html += '<div style="padding:8px;border-bottom:1px solid #333;color:#ddd;">';
      html += '<strong>' + u.reis_adi + '</strong> <span style="color:#888;">(' + (u.rutbe || 'Üye') + ')</span>';
      html += '<br/><span style="color:#777;font-size:12px;">Saygınlık: <span style="color:#ffd700;">' + (u.saygınlık || 0) + '</span></span>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<p style="color:#777;">Henüz üye yok.</p>';
  }
  html += '</div>';

  html += '</div>';

  document.getElementById('oyunEkrani').innerHTML = html;
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
  if (!res.ok) return { liste: [], tip: mod };
  var data = await res.json();
  return { liste: data.liste || [], tip: data.tip || mod };
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
    var oyuncuAktif = mod !== 'grup';
    var html = '<div class="liderlik-ust">'
      + '<div><h2>🏆 SÖZÜ GEÇENLER — LİDERLİK TABLOSU</h2>'
      + '<p>"Yeraltı dünyasında her şey saygınlık ile ölçülür."</p></div>'
      + '<div class="liderlik-sekmeler">'
      + '<button type="button" class="liderlik-sekme' + (oyuncuAktif ? ' aktif' : '') + '" onclick="liderlikModDegistir(\'oyuncu\')">👤 Kişiler</button>'
      + '<button type="button" class="liderlik-sekme' + (!oyuncuAktif ? ' aktif' : '') + '" onclick="liderlikModDegistir(\'grup\')">🕶️ Mafya Grupları</button>'
      + '</div></div><div class="tablo-container">';

    if (oyuncuAktif) {
      html += '<div class="tablo-izgara tablo-baslik-satir"><span>SIRA</span><span>İSİM</span><span>MAFYA GRUBU</span><span>SAYGINLIK</span><span>ŞEHRE HÜKMET</span></div>';
      liste.forEach(function(r, i) {
        var cls = r.benim ? 'oyuncu-satir' : '';
        var isimCell = r.bot || !r.userId
          ? r.isim
          : '<button class="btn-is mavi-btn" style="margin:0;padding:4px 8px;font-size:12px;" onclick="oyuncuProfilGoster(' + r.userId + ')">' + r.isim + '</button>';
        html += '<div class="tablo-izgara ' + cls + '"><span>#' + (i + 1) + '</span><span>' + isimCell + '</span>'
          + '<span>' + r.grup + '</span><span>' + fmt(r.puan) + ' Puan</span><span>' + (r.sehreHukmetSayisi || 0) + 'x</span></div>';
      });
    } else {
      html += '<div class="tablo-izgara tablo-baslik-satir" style="grid-template-columns:50px 1.2fr 120px 80px 80px 100px;">'
        + '<span>SIRA</span><span>MAFYA GRUBU</span><span>SAYGINLIK</span><span>EV SEV.</span><span>ÜYE</span><span>SAVAŞ</span></div>';
      if (!liste.length) html += '<p style="padding:12px;color:#888;">Henüz mafya grubu yok.</p>';
      liste.forEach(function(r, i) {
        html += '<div class="tablo-izgara" style="grid-template-columns:50px 1.2fr 120px 80px 80px 100px;">'
          + '<span>#' + (i + 1) + '</span><span><b style="color:#b8942a;">' + r.isim + '</b></span>'
          + '<span>' + fmt(r.toplamPuan || 0) + '</span><span>' + (r.evSeviye || 1) + '</span>'
          + '<span>' + (r.uyeSayisi || 0) + '</span><span>' + (r.kazanilanSavas || 0) + '</span></div>';
      });
    }
    html += '</div>';
    if (ic) ic.innerHTML = html;
  });
}

async function profilYukle() {
  try {
    var res = await apiFetch('/api/profile/' + encodeURIComponent(String(window.__benimUserId || 'me')));
    if (!res.ok) return;
    var data = await res.json();
    if (!data.ok || !data.profil) return;
    var p = data.profil;
    var a = document.getElementById('profilAciklama');
    var d = document.getElementById('profilDostlar');
    var x = document.getElementById('profilDusmanlar');
    if (a) a.value = p.aciklama || '';
    if (d) {
      d.value = p.dostlar || '';
      d.oninput = profilListeleriGuncelle;
    }
    if (x) {
      x.value = p.dusmanlar || '';
      x.oninput = profilListeleriGuncelle;
    }
    profilListeleriGuncelle();
    var kt = document.getElementById('profilKayitTarihi');
    if (kt) kt.textContent = p.kayitTarihi || '—';
    var z = document.getElementById('profilZiyaretlerBox');
    if (z) {
      var zHtml = '<h3 class="bolum-baslik">Profil Ziyaretleri</h3><ul class="profil-isim-listesi">';
      if (p.ziyaretler && p.ziyaretler.length) {
        p.ziyaretler.forEach(function(n) { zHtml += '<li>' + n + '</li>'; });
      } else {
        zHtml += '<li style="color:#666;">Henüz ziyaret yok.</li>';
      }
      zHtml += '</ul>';
      z.innerHTML = zHtml;
    }
  } catch (_) {}
}

async function profilKaydet() {
  var aciklama = (document.getElementById('profilAciklama') || {}).value || '';
  var dostlar = (document.getElementById('profilDostlar') || {}).value || '';
  var dusmanlar = (document.getElementById('profilDusmanlar') || {}).value || '';
  try {
    var res = await apiFetch('/api/profile', {
      method: 'POST',
      body: { aciklama: aciklama, dostlar: dostlar, dusmanlar: dusmanlar }
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) {
      toast(data.error || 'Profil kaydedilemedi.', 'hata');
      return;
    }
    oyuncuUygula(data.player);
    toast('Profil bilgileri kaydedildi.', 'basari');
  } catch (_) {
    toast('Profil kaydı sırasında bağlantı hatası.', 'hata');
  }
}

async function oyuncuProfilGoster(userId) {
  aktifEkran = 'profil_ziyaret';
  var ic = document.getElementById('anaIcerik');
  ic.innerHTML = '<h2>👤 PROFİL</h2><p style="color:#888;">Yükleniyor...</p>';
  try {
    var res = await apiFetch('/api/profile/' + encodeURIComponent(String(userId)));
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.profil) throw new Error(data.error || 'Profil alınamadı.');
    var p = data.profil;
    ic.innerHTML = profilEkranSablonu({
      baslik: '👤 ' + p.oyuncuAdi,
      duzenlenebilir: false,
      oyuncuAdi: p.oyuncuAdi,
      lakap: p.lakap,
      guc: p.guc,
      puan: p.puan,
      aciklama: p.aciklama,
      dostlar: p.dostlar,
      dusmanlar: p.dusmanlar,
      kayitTarihi: p.kayitTarihi,
      sehirEfsane: p.sehirEfsane
    });
  } catch (e) {
    ic.innerHTML = '<h2>👤 PROFİL</h2><p style="color:#c00;">' + (e.message || 'Profil yüklenemedi.') + '</p>';
  }
}

setInterval(function() {
  if (!sunucuBagli) return;
  sunucudanYukle({ poll: true }).then(function() {
    var ic = document.getElementById('anaIcerik');
    if (ic && ic.innerHTML.includes('SÖZÜ GEÇENLER')) liderlikTablosuCiz(ic);
    if (ic && aktifEkran === 'gazete' && yeniGazeteHaber) gazeteEkranCiz(ic);
  }).catch(function() {});
}, 15000);

function sektorMekanlar(sektor) {
  var m = mekanTanimlari[sektor];
  if (m && Object.keys(m).length) return m;
  if (typeof MEKANLAR_VERI !== 'undefined' && MEKANLAR_VERI[sektor]) return MEKANLAR_VERI[sektor];
  return {};
}

function sektorEkranCiz(ic, sektor, baslik) {
  var mekanlar = sektorMekanlar(sektor);
  var html = '<h2>🏢 ' + baslik + '</h2><p>"Her alımda fiyat %5 artar; saatlik getiri sabit kalır."</p>';
  if (!Object.keys(mekanlar).length) {
    ic.innerHTML = html + '<p style="color:#888;">Sektör yükleniyor...</p>';
    sunucudanYukle().then(function() {
      if (aktifEkran === 'sektor_' + sektor) sektorEkranCiz(ic, sektor, baslik);
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
    var fiyat = Math.floor(m.fiyat * Math.pow(1.05, adet));
    var img = mekanGorseller[m.gorsel] || FALLBACK;
    html += '<div class="is-kart"><div class="is-yapi">'
      + '<img src="' + img + '" class="vesikalik-resim" onerror="imgFallback(this)">'
      + '<div class="is-detay"><h3>' + m.ad + '</h3><p style="color:#888;">' + m.aciklama + '</p>'
      + '<p>💵 Alış: <b>' + fmt(fiyat) + ' TL</b> &nbsp;|&nbsp; Sahip: <b>' + adet + '</b> adet</p>'
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
  const idStr = 'mekanAdetGir_' + sektor + '_' + key;
  const adetInput = document.getElementById(idStr);
  if (!adetInput) {
    console.error('Input element not found:', idStr);
    toast('Adet giriş alanı bulunamadı. Sayfayı yenile.', 'hata');
    return;
  }
  const adet = parseInt(adetInput.value, 10) || 1;
  console.log('mekanAl:', { sektor, key, adet });
  var ef = await sunucuAksiyon('mekan_al', sektor + ':' + key, null, { adet });
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

async function mesajKutusuCiz(ic) {
  ic.innerHTML = '<h2>📬 MESAJ KUTUSU</h2><p style="color:#888;">Yükleniyor...</p>';
  if (!sunucuBagli) {
    ic.innerHTML = '<h2>📬 MESAJ KUTUSU</h2><p style="color:#c00;">Sunucu kapalı. Terminalde <b>npm start</b> çalıştır, ardından <b>http://localhost:3000</b> adresinden gir.</p>';
    return;
  }
  try {
    var res = await apiFetch('/api/mesajlar');
    if (res.status === 401) { cikisYap(); return; }
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    okunmamisMesaj = false;
    mesajMenuYanip();
    var html = '<h2>📬 MESAJ KUTUSU</h2>'
      + '<div class="is-kart" style="margin:0 auto 16px;max-width:520px;">'
      + '<h3 class="bolum-baslik">Mesaj Gönder</h3>'
      + '<input type="text" id="mesajHedef" class="dusman-input" placeholder="Oyuncu adı" style="width:100%;margin-bottom:8px;">'
      + '<textarea id="mesajMetin" class="dusman-input" rows="3" placeholder="Mesajın..." style="width:100%;"></textarea>'
      + '<button class="btn-is mavi-btn" style="margin-top:8px;" onclick="mesajGonder()">[ 📤 MESAJI GÖNDER ]</button></div>';
    if (!data.liste || !data.liste.length) {
      html += '<p style="color:#666;">Henüz mesaj yok.</p>';
    } else {
      data.liste.forEach(function(m) {
        var alarmCls = m.tip === 'saldiri' ? ' mesaj-alarm' : '';
        html += '<div class="mesaj-kutu-item' + alarmCls + '"><p><b>' + (m.gonderenAdi || 'Sistem') + '</b> — <span style="color:#666;font-size:12px;">' + m.tarih + '</span></p>'
          + '<div class="mesaj-icerik-kutu">' + m.icerik + '</div>';
        if (m.tip === 'ozel' && m.gonderenAdi !== 'Sistem') {
          html += '<button class="btn-is" onclick="mesajCevapla(' + m.id + ', \'' + m.gonderenAdi.replace(/'/g, '') + '\')">Cevapla</button> ';
        }
        html += '<button class="btn-is kirmizi-btn" onclick="mesajSil(' + m.id + ')">Sil</button></div>';
      });
    }
    ic.innerHTML = html;
  } catch (e) {
    ic.innerHTML = '<h2>📬 MESAJ KUTUSU</h2><p style="color:#c00;">Mesajlar yüklenemedi: ' + (e.message || 'Bağlantı hatası') + '</p>'
      + '<p style="color:#888;margin-top:8px;">Proje klasöründe <b>npm start</b> çalışıyor olmalı; adres <b>http://localhost:3000</b> olmalı (dosyayı doğrudan açma).</p>';
  }
}

async function mesajGonder() {
  var hedef = document.getElementById('mesajHedef').value.trim();
  var metin = document.getElementById('mesajMetin').value.trim();
  if (!hedef || !metin) { toast('Hedef ve mesaj gerekli.', 'hata'); return; }
  var ef = await sunucuAksiyon('mesaj_gonder', null, null, { hedef: hedef, metin: metin });
  if (ef !== null) {
    toast('Mesaj gönderildi.', 'basari');
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
  ic.innerHTML = '<p style="color:#888;">Sohbet yükleniyor...</p>';
  if (!sunucuBagli) {
    ic.innerHTML = '<h2>🕶️ MAFYA SOHBETLERİ</h2><p style="color:#c00;">Sunucu kapalı. <b>npm start</b> sonra <b>http://localhost:3000</b></p>';
    return;
  }
  try {
    var res = await apiFetch('/api/sohbet');
    if (res.status === 401) { cikisYap(); return; }
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    var html = '<div class="sohbet-ust-gorsel"><img src="' + sohbetGorseller.mafyaMasa + '" alt="Mafya"></div>'
      + '<h2>🕶️ MAFYA SOHBETLERİ</h2><p>Genel salon — herkes görür. Her mesaj 1 SMS hakkı harcar.</p>'
      + '<div id="sohbetListe" style="max-height:360px;overflow-y:auto;margin:16px 0;">';
    (data.liste || []).forEach(function(s) {
      html += '<div class="sohbet-satir"><span class="isim">' + s.reisAdi + '</span>'
        + '<span class="metin">' + s.mesaj + '</span><span class="tarih">' + s.tarih + '</span></div>';
    });
    html += '</div><div class="is-kart"><textarea id="mafyaSohbetMetin" rows="2" class="dusman-input" style="width:100%;" placeholder="Mafyayla Sohbet..."></textarea>'
      + '<button class="btn-is" style="margin-top:8px;" onclick="mafyaSohbetGonder()">[ GÖNDER ]</button></div>';
    ic.innerHTML = html;
    var liste = document.getElementById('sohbetListe');
    if (liste) liste.scrollTop = liste.scrollHeight;
  } catch (e) {
    ic.innerHTML = '<h2>🕶️ MAFYA SOHBETLERİ</h2><p style="color:#c00;">Sohbet yüklenemedi: ' + (e.message || 'Bağlantı hatası') + '</p>'
      + '<p style="color:#888;margin-top:8px;"><b>npm start</b> ile sunucuyu başlat; oyunu tarayıcıda <b>http://localhost:3000</b> üzerinden aç.</p>';
  }
}

async function mafyaSohbetGonder() {
  var el = document.getElementById('mafyaSohbetMetin');
  var metin = el ? el.value.trim() : '';
  if (!metin) return;
  var ef = await sunucuAksiyon('mafya_sohbet', null, null, { metin: metin });
  if (ef !== null) ekranDegistir('mafyaSohbet');
}

async function oyunuBaslat() {
  try {
    var health = await fetch('/api/health', { credentials: 'include' });
    if (!health.ok) throw new Error('API yanıt vermedi');
    await sunucudanYukle();
    sunucuBagli = true;
    document.getElementById('yukleniyor').classList.add('gizli');
    var sesBtn = document.getElementById('sesAcKapa');
    var sesSl = document.getElementById('sesSeviye');
    if (sesBtn) sesBtn.textContent = sesAyar.acik ? '🔊' : '🔇';
    if (sesSl) sesSl.value = Math.round(sesAyar.seviye * 100);
    guncelleBgIsim();
    ekranDegistir('profilim');
  } catch (e) {
    sunucuBagli = false;
    document.getElementById('yukleniyor').innerHTML =
      '❌ Sunucu kapalı veya oturum geçersiz.<br><br>Proje klasöründe <b>npm start</b> çalıştır, ardından <b>http://localhost:3000</b> adresinden gir (dosyayı doğrudan açma).';
  }
}
