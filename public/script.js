// ========================
// OYUNCU VERİSİ (sunucudan senkron)
// ========================
var oyuncuKasa = 10000;
var oyuncuGuc = 500;
var oyuncuBonusGuc = 0;
var oyuncuToplamGuc = 500;
var oyuncuPuan = 1500;
var oyuncuIcraat = 25;
var oyuncuLastIcraatAt = 0;
var oyuncuIcraatRegenSec = 3600;
var oyuncuIcraatSaatlikBonus = 25;
var oyuncuProfilResmi = '';
var limanlar = { istanbul: false, izmir: false, hatay: false };
var sunucuBagli = false;
var aksiyonBekliyor = false;
var aktifReisAdi = 'Reis';
var dunyaState = { limanlar: [], baba: { makamlar: {}, sadakat: { taniyanlar: [], tanimayanlar: [] } } };
var mafyaBildirim = false;
var okunmamisMesaj = false;
var oyuncuDevlet = 100;
var oyuncuSms = 50;
var oyuncuElmas = 0;
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
var aktiviteBekleyenTimer = null;
var aktiviteHeartbeatTimer = null;
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
var meslekBildirim = false;

function hosgeldinAcikMi() {
  var modal = document.getElementById('hosgeldinModal');
  return !!(modal && !modal.classList.contains('gizli'));
}

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
  if (typeof I18n !== 'undefined' && I18n.getLang) {
    o.headers['X-Game-Lang'] = I18n.getLang();
  }
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

function oyuncuUlkeBayrak(kod) {
  return typeof I18n !== 'undefined' && I18n.countryFlag ? I18n.countryFlag(kod) : '';
}

function oyuncuUlkeEtiket(kod) {
  return typeof I18n !== 'undefined' && I18n.countryLabel ? I18n.countryLabel(kod) : (kod || '');
}

function oyuncuDilMeta(kod) {
  if (typeof I18n !== 'undefined' && I18n.langMeta) return I18n.langMeta(kod) || {};
  return {};
}

function oyuncuLocaleChipHtml(kayitUlkesi, oyunDili) {
  if (!kayitUlkesi && !oyunDili) return '';
  var bits = '';
  if (kayitUlkesi) {
    bits += '<span class="lt-locale-chip" title="' + escHtml(oyuncuUlkeEtiket(kayitUlkesi)) + '">' + oyuncuUlkeBayrak(kayitUlkesi) + '</span>';
  }
  if (oyunDili) {
    var dm = oyuncuDilMeta(oyunDili);
    bits += '<span class="lt-locale-chip lt-locale-chip--lang" title="' + escHtml(dm.label || oyunDili) + '">' + (dm.flag || '🌐') + '</span>';
  }
  return '<span class="lt-locale">' + bits + '</span>';
}

function profilLocaleMetinHtml(kayitUlkesi, oyunDili) {
  if (kayitUlkesi) {
    return oyuncuUlkeBayrak(kayitUlkesi) + ' ' + escHtml(oyuncuUlkeEtiket(kayitUlkesi));
  }
  return '—';
}

function profilDilMetinHtml(oyunDili) {
  if (!oyunDili) return '—';
  var dm = oyuncuDilMeta(oyunDili);
  return (dm.flag || '') + ' ' + escHtml(dm.label || oyunDili);
}

function profilLocaleAlanGuncelle(p) {
  p = p || {};
  var ulkeEl = document.getElementById('profilKayitUlke');
  if (ulkeEl) ulkeEl.innerHTML = profilLocaleMetinHtml(p.kayitUlkesi, p.oyunDili);
  var dilEl = document.getElementById('profilOyunDili');
  if (dilEl) dilEl.innerHTML = profilDilMetinHtml(p.oyunDili);
  var ulkeDetay = document.getElementById('profilKayitUlkeDetay');
  if (ulkeDetay) ulkeDetay.innerHTML = profilLocaleMetinHtml(p.kayitUlkesi, p.oyunDili);
  var dilDetay = document.getElementById('profilOyunDiliDetay');
  if (dilDetay) dilDetay.innerHTML = profilDilMetinHtml(p.oyunDili);
}

function oyuncuUygula(p, secenekler) {
  secenekler = secenekler || {};
  if (p.userId != null) window.__benimUserId = p.userId;
  oyuncuKasa = p.kasa;
  oyuncuGuc = p.guc;
  oyuncuBonusGuc = p.bonusGuc != null ? p.bonusGuc : 0;
  oyuncuToplamGuc = p.toplamGuc != null ? p.toplamGuc : oyuncuGuc + oyuncuBonusGuc;
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
  oyuncuElmas = p.elmas != null ? p.elmas : 0;
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
  meslekBildirim = !!p.meslekBildirim;
  if (p.meslekGelirBilgi && p.meslekGelirBilgi.gelir > 0 && !secenekler.poll) {
    var mg = p.meslekGelirBilgi;
    toast(t('game.toast.jobSalaryPaid', { amount: fmt(mg.gelir), days: mg.gun > 1 ? t('game.days', { n: mg.gun }) : '' }), 'basari');
  }
  if (p.sirketMaasBilgi && p.sirketMaasBilgi.gelir > 0 && !secenekler.poll) {
    var sm = p.sirketMaasBilgi;
    var maasAntrenmanNot = sm.maasAntrenmanPuani > 0 ? t('game.toast.trainingPoints', { n: sm.maasAntrenmanPuani }) : '';
    toast(t('game.toast.companySalaryPaid', { company: sm.sirketAdi || t('game.toast.jobFallback'), amount: fmt(sm.gelir), days: sm.gun > 1 ? t('game.days', { n: sm.gun }) : '', training: maasAntrenmanNot }), 'basari');
  } else if (p.sirketMaasBilgi && p.sirketMaasBilgi.odemeYapilamadi && !secenekler.poll) {
    toast(tr(p.sirketMaasBilgi.mesaj) || t('game.toast.companySalaryFailed'), 'hata');
  }
  if (p.sirketGelirBilgi && p.sirketGelirBilgi.gelir > 0 && !secenekler.poll) {
    var sg = p.sirketGelirBilgi;
    toast(t('game.toast.companyReport', { company: sg.sirketAdi || '', amount: fmt(sg.gelir), days: sg.gun > 1 ? t('game.days', { n: sg.gun }) : '' }), 'basari');
  }
  if (p.yetenekler) oyuncuYetenekler = p.yetenekler;
  if (p.yetenekOzeti) oyuncuYetenekOzeti = p.yetenekOzeti;
  if (p.aktifMeslek !== undefined) oyuncuAktifMeslek = p.aktifMeslek;
  if (typeof meslekYetenekleriGuncelle === 'function') {
    meslekYetenekleriGuncelle(p.yetenekler, p.aktifMeslek, p.yetenekOzeti, {
      poll: !!secenekler.poll,
      atlaCiz: !!secenekler.meslekCizmeAtla,
      maasAntrenmanPuani: p.maasAntrenmanPuani
    });
  }
  mafyaMenuYanip();
  profilMenuYanip();
  gazeteMenuYanip();
  meslekMenuYanip();
  gunlukGorevBildirimGuncelle();
  sehirBannerGuncelle();
  mesajMenuYanip();
  if (typeof window.bildirimOyuncuGuncelle === "function") {
    window.bildirimOyuncuGuncelle(p.okunmamisBildirim || 0);
  }
  arayuzGuncelle();
  icraatRegenPollBaslat();
  // ÖNEMLİ: Otomatik ekran yeniden çizimi, kullanıcı ekranını bozuyordu
  // (Düşmana Çök sonucu kaybolması, Mafya ekranlarının kendi kendine değişmesi vb.)
  // Bu yüzden aktif ekranı kendiliğinden yeniden çizme.
  // Liderlik ekranı kullanıcı tab/sekme değiştirmedikçe yeniden çizilmez.
  profilOyuncuAdiUcretGuncelle();
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
    el.innerHTML = '';
    return;
  }
  el.classList.remove('gizli');
  if (sehirBannerState.tip === 'tek' && sehirBannerState.reisAdi) {
    el.className = 'city-ruler-banner city-ruler-banner--reign';
    var isimHtml = sehirBannerState.reisUserId
      ? oyuncuLink(sehirBannerState.reisUserId, sehirBannerState.reisAdi)
      : escHtml(sehirBannerState.reisAdi);
    el.innerHTML = '<div class="city-ruler-banner__shine" aria-hidden="true"></div>'
      + '<div class="city-ruler-banner__frame">'
      + '<span class="city-ruler-banner__gem city-ruler-banner__gem--l" aria-hidden="true"></span>'
      + '<div class="city-ruler-banner__content">'
      + '<span class="city-ruler-banner__crown" aria-hidden="true">👑</span>'
      + '<span class="city-ruler-banner__label city-ruler-banner__gold">' + escHtml(t('game.banner.rulerLabel')) + '</span>'
      + '<span class="city-ruler-banner__divider" aria-hidden="true"></span>'
      + '<span class="city-ruler-banner__name city-ruler-banner__gold">' + isimHtml + '</span>'
      + '</div>'
      + '<span class="city-ruler-banner__gem city-ruler-banner__gem--r" aria-hidden="true"></span>'
      + '</div>';
  } else {
    el.className = 'city-ruler-banner city-ruler-banner--vacant';
    el.innerHTML = '<div class="city-ruler-banner__shine" aria-hidden="true"></div>'
      + '<div class="city-ruler-banner__frame">'
      + '<span class="city-ruler-banner__gem city-ruler-banner__gem--l" aria-hidden="true"></span>'
      + '<div class="city-ruler-banner__content">'
      + '<span class="city-ruler-banner__crown" aria-hidden="true">👑</span>'
      + '<span class="city-ruler-banner__vacant city-ruler-banner__gold">' + escHtml(t('game.banner.noRuler')) + '</span>'
      + '</div>'
      + '<span class="city-ruler-banner__gem city-ruler-banner__gem--r" aria-hidden="true"></span>'
      + '</div>';
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
      ul.innerHTML = '<li style="color:#888;">' + escHtml(t('game.empty.noLegends')) + '</li>';
      return;
    }
    ul.innerHTML = data.liste.map(function(o) {
      var cls = o.efsane ? ' class="isim-efsane"' : '';
      var gunTxt = (o.gun > 0 ? o.gun : 1) + t('game.daysUnit');
      return '<li' + cls + ' onclick="oyuncuProfilGoster(' + o.userId + ')">' + o.reisAdi + ' <span style="color:#888;">(' + gunTxt + ')</span></li>';
    }).join('');
  } catch (_) {
    ul.innerHTML = '<li style="color:#888;">—</li>';
  }
}

async function sunucudanYukle(secenekler) {
  secenekler = secenekler || {};
  var res = await apiFetch('/api/player');
  if (res.status === 401) {
    if (secenekler.poll) throw new Error('Oturum kapalı');
    if (secenekler.bootstrap) throw new Error('AUTH_BOOTSTRAP_FAIL');
    cikisYap();
    throw new Error('Oturum kapalı');
  }
  if (!res.ok) throw new Error('Oyuncu yüklenemedi');
  var p = await res.json();
  oyuncuUygula(p, secenekler);
  sunucuBagli = true;
  aktiviteHeartbeatBaslat();
}

function aktiviteBildir(ekran, aksiyon, detay) {
  if (!sunucuBagli) return;
  var ekranKey = ekran || aktifEkran || '';
  if (aktiviteBekleyenTimer) clearTimeout(aktiviteBekleyenTimer);
  var gecikme = aksiyon ? 0 : 350;
  aktiviteBekleyenTimer = setTimeout(function() {
    apiFetch('/api/activity', {
      method: 'POST',
      body: {
        ekran: ekranKey,
        aksiyon: aksiyon || '',
        detay: detay || ''
      }
    }).catch(function() {});
  }, gecikme);
}

function aktiviteHeartbeatBaslat() {
  if (aktiviteHeartbeatTimer) return;
  aktiviteHeartbeatTimer = setInterval(function() {
    if (!sunucuBagli) return;
    aktiviteBildir(aktifEkran, 'heartbeat');
  }, 60000);
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
    payload.aktifEkran = aktifEkran || '';
    var res = await apiFetch('/api/action', { method: 'POST', body: payload });
    if (res.status === 401) { cikisYap(); return null; }
    var data = await res.json().catch(function() { return {}; });
    if (res.status === 404) {
      toast(t('game.toast.apiNotFound'), 'hata');
      return null;
    }
    if (!res.ok || !data.ok) {
      var errMsg = tr(data.error) || t('game.error.actionRejected', { status: res.status });
      if (errMsg.indexOf('Zayıf hamle') >= 0) sesCal('zayif');
      if (!extra || !extra.sessizHata) toast(errMsg, 'hata');
      else return { hata: true, mesaj: errMsg, error: errMsg };
      return null;
    }
    if (data.player) oyuncuUygula(data.player, { meslekCizmeAtla: aktifEkran === 'meslekler' });
    if (data.effect && data.effect.gazeteHaber) {
      yeniGazeteHaber = true;
      gazeteMenuYanip();
      if (aktifEkran === 'gazete') {
        var icGazete = document.getElementById('anaIcerik');
        if (icGazete && typeof gazeteEkranCiz === 'function') gazeteEkranCiz(icGazete);
      }
    }
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
    if (aktifEkran === 'turkiyeSefirlik' && data.effect && data.effect.sehir) {
      sefirlikSehirGuncelle(data.effect.sehir);
    } else if (aktifEkran === 'turkiyeSefirlik') {
      await sefirlikYukle();
    }
    if (aktifEkran === 'meslekler' && typeof meslekYukle === 'function') {
      await meslekYukle();
    }
    if (aktifEkran === 'borsa' && typeof borsaPanelYukle === 'function') {
      await borsaPanelYukle(true);
    }
    if (aktifEkran === 'kumarhane' && typeof kumarhanePanelYukle === 'function') {
      await kumarhanePanelYukle(true);
    }
    if (window.TutorialEngine && typeof TutorialEngine.tryAutoResume === 'function') {
      TutorialEngine.tryAutoResume(action);
    }
    return data.effect;
  } catch (e) {
    toast(t('game.toast.serverConnectionFailed'), 'hata');
    return null;
  } finally {
    aksiyonBekliyor = false;
  }
}

// ========================
// GÖRSELLER — yerel (/public/images)
// ========================
var GORSEL_VERSIYON = '124';
var profilLiderlikOyunculari = [];
var profilAktifSekme = 'karakter';
var oyuncuYetenekler = null;
var oyuncuYetenekOzeti = null;
var oyuncuAktifMeslek = null;

function temizGrupAdi(grup) {
  if (!grup) return '';
  var s = String(grup).trim();
  if (!s || s === 'Sokakların Hakimi') return '';
  if (s === 'Bağımsız Reis') return s;
  return s.replace(/\s+Mafya+a*\s+G[uü]?rubu$/i, '').trim();
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
  var locale = oyuncuLocaleChipHtml(r.kayitUlkesi, r.oyunDili);
  if (r.bot || !r.userId) {
    return '<span class="lt-name-txt">' + escHtml(r.isim) + locale + tag + '</span>';
  }
  return '<button type="button" class="oyuncu-link lt-name-txt" onclick="oyuncuProfilGoster(' + r.userId + ')">' + escHtml(r.isim) + locale + tag + '</button>';
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
  if (!gid || !ad || ad === 'Bağımsız Reis') {
    return '<span class="lt-group-txt"></span>';
  }
  return '<button type="button" class="oyuncu-link lt-group-txt" onclick="mafyaGrupGoster(' + gid + ')">' + escHtml(ad) + '</button>';
}

function mafyaGrupLink(grupId, isim) {
  if (!grupId) return escHtml(isim || '');
  return '<button type="button" class="oyuncu-link lt-group-txt" onclick="mafyaGrupGoster(' + grupId + ')">' + escHtml(isim || '') + '</button>';
}

function mafyaSampiyonRozetleriHTML(sampiyonluklar) {
  if (!sampiyonluklar || !sampiyonluklar.length) return '';
  var html = '<div class="mafya-sampiyon-rozetler">';
  sampiyonluklar.forEach(function(s) {
    html += '<div class="mafya-sampiyon-rozet" title="' + escHtml(s.ayEtiket + t('game.champion.badgeTitle')) + '">'
      + '<img class="mafya-sampiyon-rozet-kupa" src="' + GAZETE_AYLIK_KUPA + '" alt="" loading="lazy" onerror="imgFallback(this)">'
      + '<div class="mafya-sampiyon-rozet-metin">'
      + '<strong>' + escHtml(t('game.champion.badge')) + '</strong>'
      + '<span>' + escHtml(s.ayEtiket) + '</span>'
      + '</div></div>';
  });
  html += '</div>';
  return html;
}

var MEDYA_BANNER = '/images/is/medya_banner.png?v=' + GORSEL_VERSIYON;
var GAZETE_SAYFA_GORSEL = '/images/gazete/gazete-sayfa.png?v=' + GORSEL_VERSIYON;
var GAZETE_AYLIK_KUPA = '/images/gazete/aylik-sampiyon-kupa.png?v=2';
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
var mafyaGrupQuill = null;
var profilAktifHiza = 'left';
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
  istanbul: { img: 'liman_istanbul' },
  izmir:    { img: 'liman_izmir' },
  hatay:    { img: 'liman_hatay' }
};

function limanMeta(id) {
  var base = LIMAN_META[id] || { img: 'liman_istanbul' };
  return {
    ad: t('game.liman.' + id + '.ad'),
    aciklama: t('game.liman.' + id + '.desc'),
    img: base.img
  };
}

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
  var bonusGucEl = document.getElementById('bonusGuc');
  if (bonusGucEl) bonusGucEl.innerText = fmt(oyuncuBonusGuc);
  var puanEl = document.getElementById('puan');
  if (puanEl) puanEl.innerText = fmt(oyuncuPuan);
  var icraatEl = document.getElementById('icraat');
  if (icraatEl) {
    icraatEl.innerText = fmt(oyuncuIcraat);
  }
  var chipIcraat = document.getElementById('chipIcraat');
  if (chipIcraat) {
    chipIcraat.setAttribute('data-tip', t('game.icraat.tip', { n: oyuncuIcraatSaatlikBonus }));
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
  var elmasEl = document.getElementById('elmas');
  if (elmasEl) elmasEl.innerText = fmt(oyuncuElmas);
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
  var root = document.getElementById('masterLayout');
  if (menu) {
    menu.classList.add('acik');
    mobilAltMenuYuvayaAl(menu);
  }
  if (btn) btn.classList.add('aktif-menu');
  if (root) root.classList.add('ml-alt-acik');
}

function mesajGonderenBaslik(m) {
  if (m.gonderenEtiketi) return t('game.sender.prefix') + m.gonderenEtiketi;
  if (m.tip === 'mafya_grup') {
    return t('game.sender.mafiaGroup') + (m.gonderenAdi || m.konu || '?');
  }
  if (m.tip === 'saldiri') {
    return t('game.sender.system') + (m.konu ? ' — ' + m.konu : '');
  }
  return t('game.sender.prefix') + (m.gonderenAdi || m.konu || 'Sistem');
}

function gazeteMenuYanip() {
  var btn = document.getElementById('gazeteMenuBtn');
  if (btn) btn.classList.toggle('gazete-yanip', yeniGazeteHaber);
}

function meslekMenuYanip() {
  var btn = document.getElementById('meslekMenuBtn');
  if (btn) btn.classList.toggle('meslek-yanip', meslekBildirim);
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
    else if (metin === 'Süresiz' || metin === t('game.duration.unlimited')) cls += ' gg-sure--onizleme-suresiz';
    else if (metin === 'Gün sonu' || metin === t('game.duration.endOfDay')) cls += ' gg-sure--onizleme-gunsonu';
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

var mobilAltMenuKayit = Object.create(null);

function mobilAltMenuYuvayaAl(menu) {
  if (!menu || window.innerWidth > 768) return;
  var root = document.getElementById('masterLayout');
  if (!root || menu.parentElement === root) return;
  if (!mobilAltMenuKayit[menu.id]) mobilAltMenuKayit[menu.id] = menu.parentElement;
  menu.classList.add('ml-alt-menu--mobil');
  root.appendChild(menu);
}

function mobilAltMenuYuvayaGeri(menu) {
  if (!menu || !mobilAltMenuKayit[menu.id]) return;
  menu.classList.remove('ml-alt-menu--mobil');
  mobilAltMenuKayit[menu.id].appendChild(menu);
}

function mobilAltMenuKapat() {
  var root = document.getElementById('masterLayout');
  var list = document.querySelectorAll('.ml-alt-menu.acik');
  for (var i = 0; i < list.length; i++) {
    list[i].classList.remove('acik');
    mobilAltMenuYuvayaGeri(list[i]);
  }
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
  var mobil = window.innerWidth <= 768;
  if (mobil) {
    var diger = document.querySelectorAll('.ml-alt-menu.acik');
    for (var i = 0; i < diger.length; i++) {
      if (diger[i].id !== id) {
        diger[i].classList.remove('acik');
        mobilAltMenuYuvayaGeri(diger[i]);
      }
    }
  }
  var yeniAcik = !acik;
  menu.classList.toggle('acik', yeniAcik);
  if (btn) btn.classList.toggle('aktif-menu', yeniAcik);
  if (mobil) {
    if (yeniAcik) {
      mobilAltMenuYuvayaAl(menu);
      mobilMenuOgeyeKaydir(btn);
    } else {
      mobilAltMenuYuvayaGeri(menu);
    }
  }
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
    t('game.jobComplete', { boss: aktifReisAdi, job: isAdi });
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
  if (!isimler || !isimler.length) return '<p class="sy-liste-bos">' + escHtml(t('game.empty.noOne')) + '</p>';
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
    + '<div class="sy-baba-satir"><span class="sy-etiket">' + escHtml(t('game.boss.yourBoss')) + '</span>';

  if (babaAd) {
    html += '<span class="sy-baba-ad">' + escHtml(babaAd) + '</span>';
  } else {
    html += '<span class="sy-baba-ad sy-baba-ad--bos">' + escHtml(t('game.empty.noBoss')) + '</span>';
  }

  html += '</div>';

  var metinler = opts.metinler || [];
  for (var i = 0; i < metinler.length; i++) {
    html += '<p class="sy-cagri">' + metinler[i] + '</p>';
  }

  html += '<div class="sy-ayrac" aria-hidden="true"><span>✦</span></div>'
    + '<div class="sy-derki-blok"><span class="sy-derki-etiket">' + escHtml(t('game.boss.saysLabel')) + '</span>';

  if (benim) {
    html += '<textarea id="babaDerki-' + makam + '" placeholder="' + escHtml(t('game.boss.wordPlaceholder')) + '" maxlength="500">'
      + escHtml(m.babaDerki || '') + '</textarea>'
      + '<button type="button" class="btn-is mavi-btn sy-yazdir-btn" onclick="babaDerkiKaydet(\'' + makam + '\')">' + escHtml(t('game.boss.publish')) + '</button>';
  } else {
    html += '<p class="sy-derki-metin">' + (m.babaDerki ? escHtml(m.babaDerki) : '—') + '</p>';
  }

  html += '</div>'
    + '<button type="button" class="sy-makam-btn" onclick="babaCok(\'' + makam + '\')">' + escHtml(t('game.boss.seizeSeat')) + '</button>';

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
    + '<button type="button" class="sy-oy-btn sy-oy-btn--tani" onclick="sadakatOy(\'tani\')">' + escHtml(t('game.loyalty.recognize')) + '</button>'
    + '<button type="button" class="sy-oy-btn sy-oy-btn--red" onclick="sadakatOy(\'red\')">' + escHtml(t('game.loyalty.reject')) + '</button>'
    + '</div>'
    + '<div class="sy-listeler">'
    + '<div class="sy-liste-kart sy-liste-kart--tani">'
    + '<div class="sy-liste-baslik"><h4>' + escHtml(t('game.loyalty.recognizers')) + '</h4><span class="sy-liste-sayi">' + taniyanSayi + '</span></div>'
    + taniyanHtml
    + '</div>'
    + '<div class="sy-liste-kart sy-liste-kart--red">'
    + '<div class="sy-liste-baslik"><h4>' + escHtml(t('game.loyalty.rejecters')) + '</h4><span class="sy-liste-sayi">' + tanimayanSayi + '</span></div>'
    + tanimayanHtml
    + '</div></div>';

  return babaMakamSayfaHTML({
    makam: 'sadakat_yemini',
    mod: 'sadakat',
    ikon: '🦅',
    baslik: t('game.sehre.loyaltyTitle'),
    motto: t('game.sehre.loyaltyMotto'),
    metinler: [t('game.sehre.loyaltyText')],
    altIcerik: altIcerik
  });
}

function sozunuGecirHTML() {
  return babaMakamSayfaHTML({
    makam: 'sozunu_gecir',
    mod: 'soz',
    ikon: '📿',
    baslik: t('game.sehre.wordTitle'),
    motto: t('game.sehre.wordMotto'),
    metinler: [
      t('game.sehre.wordText')
    ]
  });
}

function sehreHukmetSahipEtiket(m) {
  if (m.sahipAdi) {
    var benim = m.sahipAdi === aktifReisAdi;
    return '<span class="sh-kart-sahip' + (benim ? ' sh-kart-sahip--benim' : '') + '">👑 ' + escHtml(m.sahipAdi) + '</span>';
  }
  return '<span class="sh-kart-sahip sh-kart-sahip--bos">' + escHtml(t('game.empty.emptySeat')) + '</span>';
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
    return '<span class="sh-kart-sahip sh-kart-sahip--benim">👑 ' + escHtml(t('game.sehre.portsYours', { n: benim })) + '</span>';
  }
  if (dolu > 0) {
    return '<span class="sh-kart-sahip">' + escHtml(t('game.sehre.portsOccupied', { n: dolu })) + '</span>';
  }
  return '<span class="sh-kart-sahip sh-kart-sahip--bos">' + escHtml(t('game.sehre.portsAvailable')) + '</span>';
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
    + '<h2>' + escHtml(t('game.sehre.title')) + '</h2>'
    + '<p class="sh-baslik-alt">' + escHtml(t('game.sehre.subtitle')) + '</p>'
    + '</div></div>'
    + '<div class="sh-kartlar">'
    + '<button type="button" class="sh-kart sh-kart--soz" onclick="ekranDegistir(\'baba_soz\')">'
    + '<span class="sh-kart-ikon" aria-hidden="true">📿</span>'
    + '<div class="sh-kart-icerik"><h3>' + escHtml(t('game.sehre.wordTitle')) + '</h3>'
    + '<p class="sh-kart-aciklama">' + escHtml(t('game.sehre.wordDesc')) + '</p>'
    + sehreHukmetSahipEtiket(soz)
    + '</div></button>'
    + '<button type="button" class="sh-kart sh-kart--sadakat" onclick="ekranDegistir(\'baba_sadakat\')">'
    + '<span class="sh-kart-ikon" aria-hidden="true">⚔️</span>'
    + '<div class="sh-kart-icerik"><h3>' + escHtml(t('game.sehre.loyaltyTitle')) + '</h3>'
    + '<p class="sh-kart-aciklama">' + escHtml(t('game.sehre.loyaltyDesc')) + '</p>'
    + sehreHukmetSahipEtiket(sadakat)
    + '</div></button>'
    + '<button type="button" class="sh-kart sh-kart--liman" onclick="ekranDegistir(\'liman\')">'
    + '<span class="sh-kart-ikon" aria-hidden="true">🚢</span>'
    + '<div class="sh-kart-icerik"><h3>' + escHtml(t('game.sehre.portsTitle')) + '</h3>'
    + '<p class="sh-kart-aciklama">' + escHtml(t('game.sehre.portsDesc')) + '</p>'
    + sehreHukmetLimanOzet()
    + '</div></button>'
    + '</div>'
    + '<p class="sh-alt-not">' + escHtml(t('game.sehre.note')) + '</p>'
    + '</div></div>';
}

function vizuelMenuGorselSrc(trPath) {
  var lang = (typeof I18n !== 'undefined' && I18n.getLang) ? I18n.getLang() : 'tr';
  if (lang === 'tr') return trPath;
  var parts = String(trPath || '').split('?');
  var path = parts[0];
  var qs = parts.length > 1 ? '?' + parts[1] : '';
  var dot = path.lastIndexOf('.');
  if (dot < 0) return trPath;
  return path.slice(0, dot) + '.' + lang.split('-')[0] + path.slice(dot) + qs;
}

function vizuelMenuGorselFallback(img) {
  if (!img) return;
  var fb = img.getAttribute('data-fallback');
  if (!fb || img.getAttribute('data-fallback-used') === '1') return;
  img.setAttribute('data-fallback-used', '1');
  img.src = fb;
}

function vizuelMenuHubHTML(mod, imgSrc, alt, zones) {
  var lang = (typeof I18n !== 'undefined' && I18n.getLang) ? I18n.getLang() : 'tr';
  var i18nMode = lang !== 'tr';
  var gorsel = vizuelMenuGorselSrc(imgSrc);
  var html = '<div class="vizuel-menu-hub vizuel-menu--' + mod + '">'
    + (i18nMode
      ? '<p class="vizuel-menu-ipucu">' + escHtml(t('game.hub.visualMenuHint')) + '</p>'
      : '')
    + '<div class="vizuel-menu-wrap' + (i18nMode ? ' vizuel-menu-wrap--i18n' : '') + '">'
    + '<img class="vizuel-menu-img" src="' + gorsel + '" data-fallback="' + escHtml(imgSrc) + '" alt="' + escHtml(alt) + '" onerror="vizuelMenuGorselFallback(this)">';
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    html += '<button type="button" class="vizuel-menu-zone vizuel-menu-zone--' + z.key + '"'
      + ' onclick="ekranDegistir(\'' + z.tip + '\')" aria-label="' + escHtml(z.label) + '">';
    if (i18nMode) {
      html += '<span class="vizuel-menu-zone-etiket">' + escHtml(z.label) + '</span>'
        + (z.desc ? '<span class="vizuel-menu-zone-alt">' + escHtml(z.desc) + '</span>' : '');
    }
    html += '</button>';
  }
  return html + '</div></div>';
}

function guclenHubHTML() {
  return vizuelMenuHubHTML('guclen', '/images/guclen/guclen-menu.png?v=101', t('game.hub.guclenSubtitle'), [
    { key: 'ekip', tip: 'korumaEkibi', label: t('screen.korumaEkibi'), desc: t('game.hub.guclen.ekipDesc') },
    { key: 'silah', tip: 'silahlan', label: t('screen.silahlan'), desc: t('game.hub.guclen.silahDesc') },
    { key: 'luks', tip: 'luksYasam', label: t('screen.luksYasam'), desc: t('game.hub.guclen.luksDesc') }
  ]);
}

function buyumeHubHTML() {
  return vizuelMenuHubHTML('buyume', '/images/buyume/buyume-menu.png?v=101', t('game.hub.buyumeSubtitle'), [
    { key: 'mahalle', tip: 'mahalle', label: t('screen.mahalle'), desc: t('game.hub.buyume.mahalleDesc') },
    { key: 'semt', tip: 'semt', label: t('screen.semt'), desc: t('game.hub.buyume.semtDesc') },
    { key: 'sehir', tip: 'sehir', label: t('screen.sehir'), desc: t('game.hub.buyume.sehirDesc') }
  ]);
}

function mekanHubHTML() {
  return vizuelMenuHubHTML('mekan', '/images/mekan/mekan-menu.png?v=101', t('game.hub.mekanSubtitle'), [
    { key: 'yeralti', tip: 'sektor_yeralti', label: t('screen.sektor_yeralti'), desc: t('game.hub.mekan.yeraltiDesc') },
    { key: 'silah', tip: 'sektor_silah', label: t('screen.sektor_silah'), desc: t('game.hub.mekan.silahDesc') },
    { key: 'paket', tip: 'sektor_paket', label: t('screen.sektor_paket'), desc: t('game.hub.mekan.paketDesc') }
  ]);
}

var gunlukGorevPanel = null;

function gunlukGorevlerHTML() {
  return '<div class="gunluk-gorevler-sayfa">' +
    '<div class="gunluk-gorevler-kart">' +
    '<div class="gunluk-gorevler-kart-baslik">' +
    '<div class="gg-kart-baslik-sol">' +
    '<h3 class="gg-kart-baslik">' + escHtml(t('game.tasks.board')) + '</h3>' +
    '<p class="gunluk-gorevler-aciklama">' + t('game.tasks.desc') + '</p>' +
    '</div>' +
    '<div class="gunluk-gorevler-ozet" id="gunlukGorevOzet">' + escHtml(t('game.loading')) + '</div>' +
    '</div>' +
    '<div class="gunluk-gorevler-tablo" id="gunlukGorevlerTablo">' +
    '<div class="gunluk-gorev-satir gunluk-gorev-satir--baslik">' +
    '<span class="gg-hucre gg-no">#</span>' +
    '<span class="gg-hucre gg-gorev">' + escHtml(t('game.tasks.colTask')) + '</span>' +
    '<span class="gg-hucre gg-adet">' + escHtml(t('game.tasks.colQty')) + '</span>' +
    '<span class="gg-hucre gg-odul">' + escHtml(t('game.tasks.colReward')) + '</span>' +
    '<span class="gg-hucre gg-sure">' + escHtml(t('game.tasks.colDuration')) + '</span>' +
    '<span class="gg-hucre gg-aksiyon">' + escHtml(t('game.tasks.colAction')) + '</span>' +
    '</div>' +
    '<div class="gunluk-gorevler-govde" id="gunlukGorevSatirlari">' +
    '<p class="gunluk-gorev-yukleniyor">' + escHtml(t('game.loadingTasks')) + '</p>' +
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
    return '<button type="button" class="gunluk-gorev-odul" data-slot="' + g.slot + '" onclick="gunlukGorevOdulAl(' + g.slot + ')">' + escHtml(t('game.tasks.claimReward')) + '</button>';
  }
  if (g.durum === 'teslim_edildi') {
    return '<span class="gg-durum gg-durum--teslim">' + escHtml(t('game.tasks.delivered')) + '</span>';
  }
  if (g.durum === 'basarisiz') {
    return '<span class="gg-durum gg-durum--basarisiz">' + escHtml(t('game.tasks.failed')) + '</span>';
  }
  if (g.durum === 'iptal') {
    return '<span class="gg-durum gg-durum--iptal">—</span>';
  }
  if (g.kabulEdildi) {
    return '<span class="gg-durum gg-durum--aktif">' + escHtml(t('game.tasks.inProgressShort')) + '</span>';
  }
  if (gunlukGorevPanel && gunlukGorevPanel.kabulSayisi >= gunlukGorevPanel.kabulLimit) {
    return '<span class="gg-durum gg-durum--iptal">' + escHtml(t('game.tasks.quotaFull')) + '</span>';
  }
  return '<button type="button" class="gunluk-gorev-kabul" data-slot="' + g.slot + '" onclick="gunlukGorevKabul(' + g.slot + ')">' + escHtml(t('game.tasks.accept')) + '</button>';
}

function gunlukGorevlerCiz() {
  var ic = document.getElementById('gunlukGorevSatirlari');
  var ozet = document.getElementById('gunlukGorevOzet');
  var aciklama = document.querySelector('.gunluk-gorevler-aciklama');
  if (!ic || !gunlukGorevPanel) return;
  if (aciklama) {
    var katsayi = gunlukGorevPanel.sayginlikKatsayi;
    var olcekNotu = (katsayi != null)
      ? '<br><span class="gunluk-gorev-olcek-notu">' + t('game.tasks.scaleNote', { katsayi: (Math.round(katsayi * 10) / 10).toFixed(1) }) + '</span>'
      : '';
    aciklama.innerHTML = t('game.tasks.desc') + olcekNotu;
  }
  if (ozet) {
    ozet.innerHTML = '<span class="gg-ozet-etiket">' + escHtml(t('game.tasks.acceptedLabel')) + '</span> ' +
      '<span class="gg-ozet-sayi">' + gunlukGorevPanel.kabulSayisi + ' / ' + gunlukGorevPanel.kabulLimit + '</span>';
  }
  if (!gunlukGorevPanel.gorevler || !gunlukGorevPanel.gorevler.length) {
    ic.innerHTML = '<p class="gunluk-gorev-bos">' + escHtml(t('game.empty.noTasksToday')) + '</p>';
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
  if (ic) ic.innerHTML = '<p class="gunluk-gorev-yukleniyor">' + escHtml(t('game.loadingTasks')) + '</p>';
  try {
    var res = await apiFetch('/api/gorevler');
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      if (ic) ic.innerHTML = '<p class="gunluk-gorev-bos">' + escHtml(tr(data.error) || t('game.error.tasksLoadFailed')) + '</p>';
      return;
    }
    gunlukGorevPanel = data;
    gunlukGorevBildirim = !!data.gunlukGorevBildirim;
    gunlukGorevlerCiz();
  } catch (_) {
    if (ic) ic.innerHTML = '<p class="gunluk-gorev-bos">' + escHtml(t('game.error.connectionFailed')) + '</p>';
  }
}

async function gunlukGorevKabul(slot) {
  var ef = await sunucuAksiyon('gorev_kabul', slot);
  if (!ef) return;
  toast(t('game.toast.taskAccepted', { duration: (ef.gorev && ef.gorev.sureMetni ? ef.gorev.sureMetni : '—') }), 'basari');
  await gunlukGorevlerYukle();
}

async function gunlukGorevOdulAl(slot) {
  var ef = await sunucuAksiyon('gorev_odul_al', slot);
  if (!ef) return;
  toast(t('game.toast.rewardClaimed', { reward: (ef.odulMetni || '') }), 'basari');
  await gunlukGorevlerYukle();
}

// ========================
// GÜVENLİ YER — premium dashboard
// ========================
var guvenliYerPanel = null;
var guvenliYerOnizlemeSeviye = null;
var guvenliYerAsamaGenis = false;

function gyAsamaEtiket(id) {
  var k = 'game.gy.stage.' + id;
  var v = t(k);
  return v !== k ? v : id;
}

function gyGorselYolu(seviye) {
  var n = Math.max(1, Math.min(15, parseInt(seviye, 10) || 1));
  return '/images/guvenli-yer/levels/seviye-' + String(n).padStart(2, '0') + '.png';
}

function gyKisaAd(modul) {
  if (!modul) return '';
  return gyAsamaEtiket(modul.id) || modul.ad || '';
}

function gyVaultAd(k) {
  if (!k) return '';
  var key = 'game.gy.vault.' + (k.id || '') + '.name';
  var v = t(key);
  return v !== key ? v : (k.ad || '');
}

function gyVaultAciklama(k) {
  if (!k) return '';
  var key = 'game.gy.vault.' + (k.id || '') + '.desc';
  var v = t(key);
  return v !== key ? v : (k.aciklama || '');
}

function gyVaultKilitNedeni(k) {
  if (!k || !k.kilitli) return '';
  var baseSev = (guvenliYerPanel && guvenliYerPanel.base && guvenliYerPanel.base.baseSeviye) || 1;
  var nedeni = '';
  if (k.minBaseSeviye && k.minBaseSeviye > baseSev) {
    nedeni = t('game.gy.vault.lockBaseLevel', { level: k.minBaseSeviye });
  }
  if (k.onkosul) {
    var kasalar = (guvenliYerPanel && guvenliYerPanel.kasalar) || [];
    var onceki = null;
    for (var i = 0; i < kasalar.length; i++) {
      if (kasalar[i].id === k.onkosul) { onceki = kasalar[i]; break; }
    }
    if (onceki && !onceki.sahip) {
      nedeni = t('game.gy.vault.lockPrerequisite', { name: gyVaultAd(onceki) });
    }
  }
  return nedeni || t('game.gy.vaultLocked');
}

function guvenliYerHTML() {
  return '<div class="gy-dashboard">'
    + '<div class="gy-dash-grid">'
    + '<aside class="gy-asama-panel">'
    + '<h3 class="gy-asama-baslik">' + escHtml(t('game.gy.stagesTitle')) + '</h3>'
    + '<div class="gy-asama-liste" id="guvenliYerAsamalar"><p class="gy-yukleniyor">…</p></div>'
    + '<button type="button" class="gy-asama-tumunu" id="guvenliYerAsamaToggle" onclick="guvenliYerAsamaToggle()">' + escHtml(t('game.gy.showAllStages')) + '</button>'
    + '</aside>'
    + '<main class="gy-hero">'
    + '<div class="gy-hero-frame" id="guvenliYerKanvasWrap">'
    + '<div class="gy-katman-sahne" id="guvenliYerSahne"></div>'
    + '<div class="gy-hero-overlay">'
    + '<div class="gy-hero-seviye" id="guvenliYerHeroSeviye">' + escHtml(t('game.gy.baseLevel')) + '</div>'
    + '</div></div>'
    + '<div class="gy-kasa-satir" id="guvenliYerKasalar"><p class="gy-yukleniyor">…</p></div>'
    + '</main>'
    + '<aside class="gy-durum-panel" id="guvenliYerPanel"><p class="gy-yukleniyor">' + escHtml(t('game.loading')) + '</p></aside>'
    + '</div>'
    + '<section class="gy-onizleme-bar">'
    + '<h4 class="gy-onizleme-baslik">' + escHtml(t('game.gy.previewTitle')) + '</h4>'
    + '<div class="gy-onizleme-track" id="guvenliYerOnizleme"></div>'
    + '</section>'
    + '<footer class="gy-footer-perks">'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">🛡️</div>'
    + '<span class="gy-perk-baslik">' + escHtml(t('game.gy.perk.stronger')) + '</span><span class="gy-perk-alt">' + escHtml(t('game.gy.perk.defense')) + '</span></div>'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">💪</div>'
    + '<span class="gy-perk-baslik">' + escHtml(t('game.gy.perk.power')) + '</span><span class="gy-perk-alt">' + escHtml(t('game.gy.perk.increase')) + '</span></div>'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">⭐</div>'
    + '<span class="gy-perk-baslik">' + escHtml(t('game.gy.perk.prestige')) + '</span><span class="gy-perk-alt">' + escHtml(t('game.gy.perk.earnings')) + '</span></div>'
    + '<div class="gy-perk"><div class="gy-perk-ikon-wrap" aria-hidden="true">🔓</div>'
    + '<span class="gy-perk-baslik">' + escHtml(t('game.gy.perk.new')) + '</span><span class="gy-perk-alt">' + escHtml(t('game.gy.perk.features')) + '</span></div>'
    + '</footer></div>';
}

function guvenliYerAsamaToggle() {
  guvenliYerAsamaGenis = !guvenliYerAsamaGenis;
  var btn = document.getElementById('guvenliYerAsamaToggle');
  if (btn) btn.textContent = guvenliYerAsamaGenis ? t('game.gy.showLess') : t('game.gy.showAllStages');
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
  img.alt = t('game.gy.altLevel', { n: goster });
  img.draggable = false;
  sahn.appendChild(img);

  if (heroSev) {
    heroSev.textContent = t('game.gy.baseLevelN', { n: mevcut });
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
  el.innerHTML = html || '<p class="gy-yukleniyor">' + escHtml(t('game.gy.noStages')) + '</p>';
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

function guvenliYerKasalarCiz() {
  var el = document.getElementById('guvenliYerKasalar');
  if (!el || !guvenliYerPanel) return;
  var kasalar = guvenliYerPanel.kasalar || [];
  if (!kasalar.length) {
    el.innerHTML = '';
    return;
  }
  var html = '<h4 class="gy-kasa-baslik">' + escHtml(t('game.gy.vaultsTitle')) + '</h4><div class="gy-kasa-grid">';
  kasalar.forEach(function(k) {
    var cls = 'gy-kasa-kart';
    if (k.sahip) cls += ' gy-kasa-kart--sahip';
    else if (k.kilitli) cls += ' gy-kasa-kart--kilit';
    html += '<div class="' + cls + '">'
      + '<div class="gy-kasa-gorsel"><img src="' + k.gorsel + '?v=' + GORSEL_VERSIYON + '" alt="' + escHtml(gyVaultAd(k)) + '" onerror="imgFallback(this)"></div>'
      + '<div class="gy-kasa-metin"><strong>' + escHtml(gyVaultAd(k)) + '</strong>'
      + '<span>' + escHtml(gyVaultAciklama(k)) + '</span>'
      + '<span class="gy-kasa-bonus">' + escHtml(t('game.gy.vaultProtection', { pct: Math.round((k.korumaOrani || 0) * 100) })) + '</span></div>';
    if (k.sahip) {
      html += '<div class="gy-kasa-durum gy-kasa-durum--sahip">' + escHtml(t('game.gy.vaultActive', { pct: Math.round((k.korumaOrani || 0) * 100) })) + '</div>';
    } else if (k.kilitli) {
      html += '<div class="gy-kasa-durum gy-kasa-durum--kilit">🔒 ' + escHtml(gyVaultKilitNedeni(k)) + '</div>';
    } else {
      var disabled = !k.yeterliPara ? ' disabled' : '';
      html += '<div class="gy-kasa-alt">'
        + '<span class="gy-kasa-fiyat">' + fmt(k.maliyet) + ' TL</span>'
        + '<button type="button" class="gy-kasa-btn"' + disabled + ' onclick="guvenliYerKasaAl(\'' + k.id + '\')">' + escHtml(t('game.gy.vaultBuy')) + '</button>'
        + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function guvenliYerPanelCiz() {
  var panel = document.getElementById('guvenliYerPanel');
  if (!panel || !guvenliYerPanel) return;
  var b = guvenliYerPanel.base || {};
  var sonraki = guvenliYerPanel.sonraki;
  var mevcutGuc = oyuncuGuc;
  var bonus = oyuncuBonusGuc || b.gucBonus || 0;
  var toplamGucDeger = oyuncuToplamGuc || mevcutGuc + bonus;

  var html = '<h3 class="gy-durum-baslik">' + escHtml(t('game.gy.statusTitle')) + '</h3>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">🏠</span><div class="gy-stat-metin">'
    + '<small>' + escHtml(t('game.gy.stat.level')) + '</small><b>' + (b.baseSeviye || 1) + ' / 15</b></div></div>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">⚔️</span><div class="gy-stat-metin">'
    + '<small>' + escHtml(t('game.gy.stat.normalPower')) + '</small><b>' + fmt(mevcutGuc) + '</b></div></div>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">🛡️</span><div class="gy-stat-metin">'
    + '<small>' + escHtml(t('game.gy.stat.bonusPower')) + '</small><b class="gy-yesil">' + fmt(bonus) + '</b></div></div>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">💪</span><div class="gy-stat-metin">'
    + '<small>' + escHtml(t('game.gy.stat.totalPower')) + '</small><b>' + fmt(toplamGucDeger) + '</b></div></div>'
    + '<div class="gy-stat-kart"><span class="gy-stat-ikon">💵</span><div class="gy-stat-metin">'
    + '<small>' + escHtml(t('game.gy.stat.cash')) + '</small><b class="gy-yesil">' + fmt(oyuncuKasa) + ' TL</b></div></div>';
  if (b.kasaKorumaOrani > 0) {
    html += '<div class="gy-stat-kart"><span class="gy-stat-ikon">🔒</span><div class="gy-stat-metin">'
      + '<small>' + escHtml(t('game.gy.stat.vaultProtection')) + '</small><b class="gy-yesil">' + escHtml(t('game.gy.stat.cashPct', { pct: Math.round(b.kasaKorumaOrani * 100) })) + '</b></div></div>';
  }

  if (sonraki) {
    var disabled = !sonraki.yeterliPara ? ' disabled' : '';
    var sonrakiGuc = toplamGucDeger + (sonraki.gucBonus || 0);
    html += '<div class="gy-yukselt-kart">'
      + '<h4>' + escHtml(t('game.gy.next', { name: gyKisaAd(sonraki) })) + '</h4>'
      + '<p style="margin:0 0 8px;color:#888;font-size:12px;">' + escHtml(tr(sonraki.aciklama)) + '</p>'
      + '<div class="gy-yukselt-satir"><span>' + escHtml(t('game.gy.powerGain')) + '</span><b class="gy-arti">+' + fmt(sonraki.gucBonus || 0) + '</b></div>'
      + '<div class="gy-yukselt-satir"><span>' + escHtml(t('game.gy.cost')) + '</span><b>' + fmt(sonraki.maliyet) + ' TL</b></div>'
      + '<div class="gy-guc-karsilastir">'
      + '<span>' + escHtml(t('game.gy.current')) + ' <b>' + fmt(toplamGucDeger) + '</b></span>'
      + '<span class="gy-ok">→</span>'
      + '<span>' + escHtml(t('game.gy.after')) + ' <b>' + fmt(sonrakiGuc) + '</b></span>'
      + '</div>'
      + '<button type="button" class="gy-gelistir-btn" id="guvenliYerGelistirBtn"' + disabled
      + ' onclick="guvenliYerGelistir()">' + escHtml(t('game.gy.upgradeBtn')) + '</button>'
      + '</div>';
  } else {
    html += '<div class="gy-tamamlandi">' + escHtml(t('game.gy.maxLevel')) + '</div>';
  }
  panel.innerHTML = html;
}

function guvenliYerTumunuCiz() {
  guvenliYerPanelCiz();
  guvenliYerAsamalarCiz();
  guvenliYerOnizlemeCiz();
  guvenliYerKasalarCiz();
  renderBase();
}

async function guvenliYerKasaAl(kasaId) {
  var ef = await sunucuAksiyon('guvenli_yer_kasa_al', null, null, { kasaId: kasaId });
  if (!ef) return;
  toast(tr(ef.mesaj) || t('game.toast.vaultPurchased'), 'basari');
  if (ef.panel) {
    guvenliYerPanel = ef.panel;
    guvenliYerTumunuCiz();
  } else {
    await guvenliYerYukle();
  }
}

async function guvenliYerYukle() {
  var panel = document.getElementById('guvenliYerPanel');
  if (panel) panel.innerHTML = '<p class="gy-yukleniyor">' + escHtml(t('game.loading')) + '</p>';
  try {
    var res = await apiFetch('/api/guvenli-yer');
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.ok) {
      if (panel) panel.innerHTML = '<p style="color:#c66;">' + escHtml(tr(data.error) || t('game.error.loadFailed')) + '</p>';
      return;
    }
    guvenliYerPanel = data;
    guvenliYerOnizlemeSeviye = null;
    guvenliYerTumunuCiz();
  } catch (_) {
    if (panel) panel.innerHTML = '<p style="color:#c66;">' + escHtml(t('game.error.connectionFailed')) + '</p>';
  }
}

async function guvenliYerGelistir() {
  var btn = document.getElementById('guvenliYerGelistirBtn');
  if (btn) btn.disabled = true;
  var ef = await sunucuAksiyon('guvenli_yer_gelistir');
  if (btn && guvenliYerPanel && guvenliYerPanel.sonraki) btn.disabled = !guvenliYerPanel.sonraki.yeterliPara;
  if (!ef) return;
  toast(tr(ef.mesaj) || t('game.toast.baseUpgraded'), 'basari');
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
    + '<h2>' + escHtml(t('game.intel.title')) + '</h2>'
    + '<p class="istih-baslik-alt">' + escHtml(t('game.intel.subtitle')) + '</p>'
    + '</header>'
    + '<section class="istih-kart">'
    + '<div class="istih-kart-sekme">' + escHtml(t('game.intel.agentsTab')) + '</div>'
    + '<div class="istih-eleman-govde">'
    + '<div class="istih-ajan-portre"><img src="/images/istihbarat/istihbarat-ajan.png?v=102" alt="' + escHtml(t('game.intel.agentAlt')) + '"></div>'
    + '<div class="istih-eleman-icerik">'
    + '<h3>' + escHtml(t('game.intel.agentsTitle')) + '</h3>'
    + '<ul class="istih-stat-list">'
    + '<li>' + escHtml(t('game.intel.currentAgents')) + ' <b id="istihbaratElemanSayi">' + istihbaratEleman + '</b></li>'
    + '<li>' + escHtml(t('game.intel.unitCost')) + ' <b id="istihbaratBirimMaliyet">' + fmt(istihbaratBirimMaliyetHesap(istihbaratEleman)) + ' TL</b></li>'
    + '<li class="istih-zam-not">' + escHtml(t('game.intel.priceNote')) + '</li>'
    + '<li>' + escHtml(t('game.intel.unitPower')) + ' <b>+' + ISTIHBARAT_ELEMAN_GUC + '</b></li>'
    + '</ul>'
    + '<div class="istih-adet-satir"><label for="adet-istihbarat">' + escHtml(t('game.intel.qtyLabel')) + '</label>'
    + '<input type="number" id="adet-istihbarat" class="istih-adet-input" value="1" min="1" max="100"></div>'
    + '<button type="button" class="istih-btn istih-btn--yesil" onclick="istihbaratAl()">' + escHtml(t('game.intel.hireBtn')) + '</button>'
    + '</div></div></section>'
    + '<section class="istih-kart">'
    + '<div class="istih-kart-sekme">' + escHtml(t('game.intel.rivalTab')) + '</div>'
    + '<p class="istih-rakip-aciklama">' + escHtml(t('game.intel.rivalDesc')) + '</p>'
    + '<div class="istih-rakip-satir">'
    + '<input type="text" id="istihbaratHedef" class="istih-hedef-input" placeholder="' + escHtml(t('game.intel.rivalPlaceholder')) + '" maxlength="24" autocomplete="off">'
    + '<button type="button" class="istih-btn istih-btn--mavi" onclick="istihbaratSpy()">' + escHtml(t('game.intel.learnPower')) + '</button>'
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
    + '<img class="dusman-panel-img" src="/images/dusman/dusman-panel.png?v=' + GORSEL_VERSIYON + '" alt="' + escHtml(t('game.enemy.alt')) + '">'
    + '<div class="dusman-panel-input-ortu" aria-hidden="true"></div>'
    + '<input type="text" id="dusmanHedef" class="dusman-panel-input" placeholder="' + escHtml(t('game.enemy.placeholder')) + '" maxlength="24" autocomplete="off">'
    + '<button type="button" id="dusmanAraBtn" class="dusman-panel-btn" onclick="dusmanAra()" aria-label="' + escHtml(t('game.enemy.searchLabel')) + '"></button>'
    + '</div>'
    + '<div id="dusmanSonuc" class="dusman-sonuc-alt"></div>'
    + '<div class="dusman-guc-alan is-kart">'
    + '<h3 class="bolum-baslik">' + escHtml(t('game.enemy.powerTitle')) + '</h3>'
    + '<p class="dusman-guc-aciklama">' + escHtml(t('game.enemy.powerDesc')) + '</p>'
    + '<button type="button" class="btn-is mavi-btn" onclick="dusmanRakipAra()">' + escHtml(t('game.enemy.findRivals')) + '</button>'
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
    + '<p>🏷️ ' + escHtml(o.lakap || 'Mafya') + ' &nbsp;|&nbsp; ' + escHtml(t('game.enemy.respect')) + ' <b>' + fmt(o.puan || 0) + '</b></p>'
    + (o.grup ? '<p>' + escHtml(t('game.enemy.group')) + ' ' + escHtml(o.grup) + '</p>' : '')
    + '<div class="dusman-hedef-aksiyon">'
    + '<button type="button" class="btn-is kirmizi-btn" onclick="dusmanaSaldir()">' + escHtml(t('game.enemy.attack')) + '</button>'
    + '<button type="button" class="btn-is mavi-btn" onclick="oyuncuProfilGoster(' + o.userId + ')">' + escHtml(t('game.enemy.profile')) + '</button>'
    + '</div></div>';
}

async function dusmanRakipAra() {
  var kutu = document.getElementById('dusmanRakipKutu');
  if (!kutu) return;
  kutu.classList.remove('gizli');
  kutu.innerHTML = '<p style="color:#888;text-align:center;padding:12px;">' + escHtml(t('game.enemy.searching')) + '</p>';
  try {
    var res = await apiFetch('/api/oyuncu/rakipler');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) {
      kutu.innerHTML = '<div class="dusman-rakip-kart"><p style="color:#c66;text-align:center;">' + escHtml(tr(data.error) || t('game.error.rivalNotFound')) + '</p></div>';
      return;
    }
    dusmanRakipListesi = data.liste || [];
    dusmanRakipKutuCiz();
  } catch (_) {
    kutu.innerHTML = '<div class="dusman-rakip-kart"><p style="color:#c66;text-align:center;">' + escHtml(t('game.toast.connectionError')) + '</p></div>';
  }
}

function dusmanRakipKutuCiz() {
  var kutu = document.getElementById('dusmanRakipKutu');
  if (!kutu) return;
  if (!dusmanRakipListesi.length) {
    kutu.innerHTML = '<div class="dusman-rakip-kart">'
      + '<p style="color:#888;text-align:center;">' + escHtml(t('game.enemy.noRivalsInRange')) + '</p>'
      + '<div class="dusman-hedef-aksiyon">'
      + '<button type="button" class="btn-is" onclick="dusmanRakipAra()">' + escHtml(t('game.enemy.change')) + '</button>'
      + '<button type="button" class="btn-is koyu-btn" onclick="dusmanRakipKapat()">' + escHtml(t('game.enemy.close')) + '</button>'
      + '</div></div>';
    return;
  }
  var html = '<div class="dusman-rakip-kart">'
    + '<h3 class="bolum-baslik">' + escHtml(t('game.enemy.suitableRivals')) + '</h3>'
    + '<p class="dusman-guc-aciklama">' + escHtml(t('game.enemy.hiddenPowerNote')) + '</p>';
  dusmanRakipListesi.forEach(function(o) {
    html += '<div class="dusman-rakip-satir">'
      + '<div class="dusman-rakip-bilgi"><b>' + escHtml(o.reisAdi) + '</b>'
      + '<span class="dusman-rakip-meta">🏷️ ' + escHtml(o.lakap || 'Mafya')
      + (o.grup ? ' · 🕶️ ' + escHtml(o.grup) : '')
      + ' · ' + fmt(o.puan || 0) + escHtml(t('game.enemy.respectShort')) + '</span></div>'
      + '<button type="button" class="btn-is kirmizi-btn" onclick="dusmanaSaldirId(' + o.userId + ')">' + escHtml(t('game.enemy.attack')) + '</button>'
      + '</div>';
  });
  html += '<div class="dusman-hedef-aksiyon">'
    + '<button type="button" class="btn-is" onclick="dusmanRakipAra()">' + escHtml(t('game.enemy.change')) + '</button>'
    + '<button type="button" class="btn-is koyu-btn" onclick="dusmanRakipKapat()">' + escHtml(t('game.enemy.close')) + '</button>'
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
    toast(t('game.toast.enterEnemyName'), 'hata');
    input.focus();
    return;
  }
  if (btn) btn.disabled = true;
  sonuc.innerHTML = '<p style="color:#888;text-align:center;padding:12px;">' + escHtml(t('game.enemy.searchingOne')) + '</p>';
  try {
    var res = await apiFetch('/api/oyuncu/ara?q=' + encodeURIComponent(ad));
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.oyuncu) {
      dusmanBulunanHedef = null;
      sonuc.innerHTML = '<div class="saldiri-sonuc" style="color:#c66;">❌ ' + escHtml(tr(data.error) || t('game.error.playerNotFound')) + '</div>';
      return;
    }
    dusmanBulunanHedef = data.oyuncu;
    input.value = data.oyuncu.reisAdi;
    sonuc.innerHTML = dusmanHedefKartHTML(data.oyuncu);
  } catch (_) {
    dusmanBulunanHedef = null;
    sonuc.innerHTML = '<div class="saldiri-sonuc" style="color:#c66;">' + escHtml(t('game.toast.connectionError')) + '</div>';
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
    var calcTus = calcTuslar[i];
    var cls = 'banka-calc-tus' + (calcTus.k === 'sil' ? ' banka-calc-tus--sil' : '');
    calcHtml += '<button type="button" class="' + cls + '" onclick="bankaCalcTus(\'' + calcTus.k + '\')">' + calcTus.l + '</button>';
  }
  return '<div class="banka-sayfa">'
    + '<div class="banka-bakiye-kart">'
    + '<span class="banka-bakiye-etiket">' + escHtml(t('game.bank.accountLabel')) + '</span>'
    + '<span class="banka-bakiye-tutar" id="bankaBakiyeGoster">💰 ' + fmt(bankaBakiye) + ' TL</span>'
    + '<span class="banka-kasa-not">' + escHtml(t('game.bank.cashNote')) + ' <b>' + fmt(oyuncuKasa) + ' TL</b></span>'
    + '<span class="banka-kasa-not">' + escHtml(t('game.bank.rightsNote')) + ' <b style="color:#ffd76a;">' + fmt(bankaHakki) + '</b> <span style="color:#777;">' + escHtml(t('game.bank.rightsHelp')) + '</span></span>'
    + '</div>'
    + '<div class="banka-bilgi-kart">'
    + '<p>' + t('game.bank.interestInfo') + '</p>'
    + '<p style="margin-top:8px;color:#888;">' + escHtml(t('game.bank.limitInfo')) + '</p>'
    + '</div>'
    + '<div class="banka-islem-ust">'
    + '<div class="banka-kart banka-kart--yatir">'
    + '<h3>' + escHtml(t('game.bank.depositTitle')) + '</h3>'
    + '<p>' + escHtml(t('game.bank.depositDesc')) + '</p>'
    + '<label for="bankaYatirMiktar">' + escHtml(t('game.bank.depositLabel')) + '</label>'
    + '<input type="text" id="bankaYatirMiktar" class="banka-miktar-input" inputmode="numeric" autocomplete="off" placeholder="0" value="' + yatirVars + '">'
    + '<button type="button" id="bankaYatirBtn" class="banka-btn-yatir" onclick="bankaYatir()">' + escHtml(t('game.bank.depositBtn')) + '</button>'
    + '</div>'
    + '<div class="banka-hesap-makinesi">'
    + '<div class="banka-calc-ekran" id="bankaCalcEkran">0</div>'
    + '<div class="banka-calc-grid">' + calcHtml + '</div>'
    + '</div></div>'
    + '<div class="banka-kart banka-kart--cek">'
    + '<h3>' + escHtml(t('game.bank.withdrawTitle')) + '</h3>'
    + '<p>' + escHtml(t('game.bank.withdrawDesc')) + '</p>'
    + '<label for="bankaCekMiktar">' + escHtml(t('game.bank.withdrawLabel')) + '</label>'
    + '<input type="text" id="bankaCekMiktar" class="banka-miktar-input" inputmode="numeric" autocomplete="off" placeholder="0" value="' + cekVars + '">'
    + '<button type="button" id="bankaCekBtn" class="banka-btn-cek" onclick="bankaCek()">' + escHtml(t('game.bank.withdrawBtn')) + '</button>'
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
    return '<p class="elit-fiyat-uyari">' + t('game.elitePriceNote') + '</p>';
  }
  return ELIT_FIYAT_NOTU;
}

function elitFiyatEkranTazele() {
  var ic = document.getElementById('anaIcerik');
  if (!ic || !aktifEkran) return;
  if (aktifEkran === 'sektor_yeralti') sektorEkranCiz(ic, 'yeralti', t('screen.sektor_yeralti'));
  else if (aktifEkran === 'sektor_silah') sektorEkranCiz(ic, 'silah', t('screen.sektor_silah'));
  else if (aktifEkran === 'sektor_paket') sektorEkranCiz(ic, 'paket', t('screen.sektor_paket'));
  else if (aktifEkran === 'korumaEkibi') guclenAltEkranCiz('korumaEkibi', ic);
  else if (aktifEkran === 'silahlan') guclenAltEkranCiz('silahlan', ic);
  else if (aktifEkran === 'luksYasam') guclenAltEkranCiz('luksYasam', ic);
}

async function guclenAltEkranCiz(tip, ic) {
  ic.innerHTML = '<p style="color:#888;">' + escHtml(t('game.loading')) + '</p>';
  await elitFiyatDurumSenkronize();
  if (aktifEkran !== tip) return;
  if (tip === 'korumaEkibi') {
    ic.innerHTML = '<h2>' + escHtml(t('game.hire.korumaTitle')) + '</h2><p>' + escHtml(t('game.hire.korumaQuote')) + '</p>'
      + elitFiyatNotuHTML()
      + guclenKartlariCiz(['delikanli', 'bodyguard', 'profesyonel', 'harekat'], koruyucuGorseller, 'vesikalik-resim', '#28a745', t('game.hire.hireMan'));
    return;
  }
  if (tip === 'silahlan') {
    ic.innerHTML = '<h2>' + escHtml(t('game.hire.silahTitle')) + '</h2><p>' + escHtml(t('game.hire.silahQuote')) + '</p>'
      + elitFiyatNotuHTML()
      + guclenKartlariCiz(['tabanca', 'pompali', 'ak47', 'agir_silah', 'sniper'], silahGorseller, 'vesikalik-resim', '#00e5ff', t('game.hire.buyWeapon'), 'mavi-btn');
    return;
  }
  if (tip === 'luksYasam') {
    ic.innerHTML = '<h2>' + escHtml(t('game.hire.luksTitle')) + '</h2><p>' + escHtml(t('game.hire.luksQuote')) + '</p>'
      + elitFiyatNotuHTML()
      + guclenKartlariCiz(['saat', 'motorsiklet', 'araba', 'yat', 'helikopter', 'jet'], luksGorseller, 'luks-resim', '#b8942a', t('game.hire.buyLuxury'), 'kirmizi-btn');
  }
}

function guclenKartHTML(key, img, imgCls, baslik, alinti, bazMaliyet, guc, gucRenk, btnLabel, btnCls) {
  var sahip = kiralamaEnvanter[key] || 0;
  var maliyetTxt = typeof bazMaliyet === 'number' ? elitFiyatGosterHtml(bazMaliyet) : bazMaliyet;
  return '<div class="is-kart"><div class="is-yapi">'
    + '<img src="' + img + '" class="' + imgCls + '" alt="" loading="lazy" onerror="imgFallback(this)">'
    + '<div class="is-detay"><h3>' + baslik + '</h3><p>💬 ' + alinti + '</p>'
    + '<p>' + escHtml(t('game.hire.owned')) + ' <b style="color:#ffd700;">' + sahip + escHtml(t('game.hire.units')) + '</b></p>'
    + '<p>' + escHtml(t('game.hire.unitPrice')) + ' ' + maliyetTxt + ' &nbsp;|&nbsp; ' + escHtml(t('game.hire.unitPower')) + ' <b style="color:' + gucRenk + ';">' + guc + '</b></p>'
    + '<div class="adet-satir"><label for="adet-' + key + '">' + escHtml(t('game.hire.qty')) + '</label>'
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

var ELIT_FIYAT_NOTU = '<p style="color:#fff;font-size:13px;margin:12px 0 16px;">' + t('game.elitePriceDefault') + '</p>';
var HUKUM_SAVUNMA_METIN = t('game.rulerDefenseNote');
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
    html += guclenKartHTML(k, gorseller[k], imgCls, t('game.hire.item.' + k + '.title'), t('game.hire.item.' + k + '.quote'), bazFiyat, '+' + fmt(info.guc), gucRenk, btnLabel, btnCls);
  }
  return html;
}

var HIRE_BILGI = {
  delikanli: { maliyet: 500, guc: 50 },
  bodyguard: { maliyet: 2000, guc: 250 },
  profesyonel: { maliyet: 8000, guc: 1100 },
  harekat: { maliyet: 30000, guc: 4500 },
  tabanca: { maliyet: 1200, guc: 100 },
  pompali: { maliyet: 4500, guc: 450 },
  ak47: { maliyet: 15000, guc: 1800 },
  agir_silah: { maliyet: 45000, guc: 6000 },
  sniper: { maliyet: 55000, guc: 7500 },
  saat: { maliyet: 15000, guc: 2500 },
  motorsiklet: { maliyet: 75000, guc: 15000 },
  araba: { maliyet: 350000, guc: 80000 },
  yat: { maliyet: 2500000, guc: 600000 },
  helikopter: { maliyet: 8000000, guc: 2000000 },
  jet: { maliyet: 45000000, guc: 10000000 }
};

function isKartHTML(img, baslik, kazanc, icraat, guc, onclick) {
  return '<div class="is-kart"><div class="is-yapi">'
    + '<img src="' + img + '" class="vesikalik-resim" onerror="imgFallback(this)">'
    + '<div class="is-detay"><h3>' + baslik + '</h3>'
    + '<p>' + escHtml(t('game.job.netGain')) + ' <b style="color:#28a745;">' + kazanc + '</b></p>'
    + '<p style="color:#00e5ff;font-weight:600;">' + t('game.job.requiredLine', { icraat: icraat, guc: guc }) + '</p>'
    + '<button class="btn-is" onclick="' + onclick + '">' + escHtml(t('game.job.doIt')) + '</button>'
    + '</div></div></div>';
}

function buyumeIsKart(key, imgKey, kazanc, icraat, guc) {
  return isKartHTML(
    isGorselleri[imgKey],
    t('game.buyume.job.' + key + '.title'),
    kazanc,
    icraat + t('game.job.actionUnit'),
    guc + t('game.job.powerUnit'),
    "isYap('" + key + "')"
  );
}

function limanKartHTML(id) {
  var meta = limanMeta(id);
  var lim = limanBul(id);
  var benim = lim.sahipAdi === aktifReisAdi;
  var sahipTxt = lim.sahipAdi
    ? escHtml(t('game.port.owner')) + ' <b style="color:#b8942a;">' + escHtml(lim.sahipAdi) + '</b>'
    : escHtml(t('game.port.unowned'));
  var btnMetin = benim ? escHtml(t('game.port.yours')) : escHtml(t('game.port.seize'));
  var btnCls = benim ? ' kirmizi-btn' : '';
  var onclick = benim ? 'toast(t(\'game.toast.portAlreadyYours\'), \'altin\')' : 'limanCok(\'' + id + '\')';
  return '<div class="liman-kart"><div class="is-yapi">'
    + '<img src="' + isGorselleri[meta.img] + '" class="vesikalik-resim" style="border-color:#b8942a;" onerror="imgFallback(this)">'
    + '<div class="is-detay"><h3>⚓ ' + escHtml(meta.ad) + '</h3>'
    + '<p>' + escHtml(meta.aciklama) + '</p>'
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
    + '<span class="md-mekan-secim-etiket">' + escHtml(t('game.transfer.venueLabel')) + '</span>'
    + '<input type="hidden" id="mekanDevriMekan" value="">'
    + '<div class="md-mekan-grid">';

  items.forEach(function(it) {
    var ad = it.m ? it.m.ad : it.sk;
    var img = (it.m && it.m.gorsel && mekanGorseller[it.m.gorsel]) ? mekanGorseller[it.m.gorsel] : FALLBACK;
    html += '<button type="button" class="md-mekan-kart" data-sk="' + escHtml(it.sk) + '" data-adet="' + it.adet + '" onclick="mekanDevriMekanSec(this)">'
      + '<span class="md-mekan-kart-img"><img src="' + img + '" alt="" loading="lazy" onerror="imgFallback(this)"></span>'
      + '<span class="md-mekan-kart-ad">' + escHtml(ad) + '</span>'
      + '<span class="md-mekan-kart-adet">' + it.adet + escHtml(t('game.transfer.qtyUnits')) + '</span>'
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
  if (diff < 60) return t('game.time.justNow');
  if (diff < 3600) return Math.floor(diff / 60) + t('game.time.minAgo');
  if (diff < 86400) return Math.floor(diff / 3600) + t('game.time.hourAgo');
  return new Date(ts * 1000).toLocaleDateString(typeof I18n !== 'undefined' && I18n.dateLocale ? I18n.dateLocale() : 'tr-TR', { day: 'numeric', month: 'short' });
}

function avukatHTML() {
  var r = rusvetBilgi || { min: 10, max: 50, onerilen: 30 };
  var iliski = Math.min(AVUKAT_ILISKI_MAX, oyuncuDevlet != null ? oyuncuDevlet : 100);
  var iliskiYuzde = Math.min(100, Math.round((iliski / AVUKAT_ILISKI_MAX) * 100));
  var dolguCls = iliski < 50 ? ' av-iliski-dolgu--dusuk' : (iliski >= AVUKAT_ILISKI_MAX ? ' av-iliski-dolgu--max' : '');
  var onerilen = r.onerilen || r.min || 10;
  var maksimumda = iliski >= AVUKAT_ILISKI_MAX;
  var rusvetPanel = '<div class="av-panel av-panel--rusvet">'
    + '<div class="av-panel-baslik"><span class="av-panel-ikon" aria-hidden="true">💵</span><h3>' + escHtml(t('game.lawyer.bribeTitle')) + '</h3></div>';
  if (maksimumda) {
    rusvetPanel += '<p class="av-rusvet-max">' + escHtml(t('game.lawyer.bribeMax', { max: AVUKAT_ILISKI_MAX })) + '</p>';
  } else {
    rusvetPanel += '<div class="av-rusvet-oneri"><span class="av-rusvet-oneri-etiket">' + escHtml(t('game.lawyer.recommended')) + '</span>'
      + '<span class="av-rusvet-oneri-tutar">' + fmt(onerilen) + ' TL</span></div>'
      + '<p class="av-rusvet-aralik">' + escHtml(t('game.lawyer.range', { min: fmt(r.min), max: fmt(r.max), inc: RUSVET_ARTIS_MAX })) + '</p>'
      + '<div class="av-alan"><label for="rusvetMiktar">' + escHtml(t('game.lawyer.bribeLabel')) + '</label>'
      + '<input type="number" id="rusvetMiktar" class="av-input" value="' + onerilen + '" min="' + r.min + '" max="' + r.max + '"></div>'
      + '<button type="button" class="av-btn" onclick="rusvetVer()">' + escHtml(t('game.lawyer.bribeBtn')) + '</button>';
  }
  rusvetPanel += '</div>';

  return '<div class="av-sayfa"><div class="av-cerceve">'
    + '<div class="av-banner">'
    + '<img src="' + devletGorseller.yetkili + '" alt="' + escHtml(t('game.lawyer.lawyerAlt')) + '" onerror="imgFallback(this)">'
    + '<div class="av-banner-ortu"></div>'
    + '<div class="av-baslik-wrap">'
    + '<h2>' + escHtml(t('game.lawyer.screenTitle')) + '</h2>'
    + '<p class="av-motto">' + escHtml(t('game.lawyer.motto')) + '</p>'
    + '</div></div>'
    + '<div class="av-govde">'
    + '<p class="av-giris">' + escHtml(t('game.lawyer.intro')) + '</p>'
    + '<div class="av-uyari">' + t('game.lawyer.warning', { inc: RUSVET_ARTIS_MAX, max: AVUKAT_ILISKI_MAX }) + '</div>'
    + '<div class="av-iliski-kutu">'
    + '<div class="av-iliski-ust">'
    + '<span class="av-iliski-etiket">' + escHtml(t('game.lawyer.currentRelation')) + '</span>'
    + '<span class="av-iliski-deger">' + iliski + ' <span>/ ' + AVUKAT_ILISKI_MAX + '</span></span>'
    + '</div>'
    + '<div class="av-iliski-cubuk"><div class="av-iliski-dolgu' + dolguCls + '" style="width:' + iliskiYuzde + '%"></div></div>'
    + '</div>'
    + '<div class="av-paneller">'
    + '<div class="av-panel av-panel--avukat">'
    + '<div class="av-panel-baslik"><span class="av-panel-ikon" aria-hidden="true">⚖️</span><h3>' + escHtml(t('game.lawyer.yourLawyer')) + '</h3></div>'
    + '<div class="av-portre"><img src="' + devletGorseller.yetkili + '" alt="" onerror="imgFallback(this)"></div>'
    + '<p class="av-portre-ad">' + escHtml(t('game.lawyer.lawyerName')) + '</p>'
    + '<p class="av-portre-aciklama">' + escHtml(t('game.lawyer.lawyerDesc')) + '</p>'
    + '</div>'
    + rusvetPanel
    + '</div></div></div></div>';
}

function medyaHTML() {
  return '<div class="med-sayfa"><div class="med-cerceve">'
    + '<div class="med-banner">'
    + '<img src="' + MEDYA_BANNER + '" alt="' + escHtml(t('game.media.bannerAlt')) + '" onerror="imgFallback(this)">'
    + '<div class="med-banner-ortu"></div>'
    + '<div class="med-baslik-wrap">'
    + '<span class="med-baslik-ikon" aria-hidden="true">📰</span>'
    + '<h2>' + escHtml(t('game.media.screenTitle')) + '</h2>'
    + '<p class="med-motto">' + escHtml(t('game.media.motto')) + '</p>'
    + '</div></div>'
    + '<div class="med-govde">'
    + '<p class="med-giris">' + escHtml(t('game.media.intro')) + '</p>'
    + '<div class="med-paneller">'
    + '<div class="med-panel med-panel--yayin">'
    + '<div class="med-panel-baslik"><span class="med-panel-ikon" aria-hidden="true">📢</span><h3>' + escHtml(t('game.media.publishTitle')) + '</h3></div>'
    + '<div class="med-meta">'
    + '<span class="med-meta-etiket">' + escHtml(t('game.media.cost')) + '</span><strong>100.000 TL</strong>'
    + '<span class="med-meta-etiket">' + escHtml(t('game.media.duration')) + '</span><span>' + escHtml(t('game.media.durationValue')) + '</span>'
    + '</div>'
    + '<div class="med-alan"><label for="medyaHaber">' + escHtml(t('game.media.newsLabel')) + '</label>'
    + '<textarea id="medyaHaber" class="med-textarea" rows="4" placeholder="' + escHtml(t('game.media.newsPlaceholder')) + '" maxlength="200"></textarea></div>'
    + '<button type="button" class="med-btn" onclick="medyaHaberYayinla()">' + escHtml(t('game.media.publishBtn')) + '</button>'
    + '<div id="medyaSonuc" class="med-sonuc gizli"></div>'
    + '</div>'
    + '<div class="med-panel med-panel--haberler">'
    + '<div class="med-panel-baslik"><span class="med-panel-ikon" aria-hidden="true">📋</span><h3>' + escHtml(t('game.media.recentTitle')) + '</h3></div>'
    + '<div id="medyaHaberlerListesi" class="med-haber-liste"></div>'
    + '</div></div></div></div></div>';
}

function mekanDevriHTML() {
  var mekanSay = mekanDevriMekanSayisi();
  var mekanGrid = mekanDevriMekanGridHTML();
  var altMetin = mekanSay > 0
    ? t('game.transfer.portfolio', { n: mekanSay })
    : t('game.transfer.noVenues');

  var mekanPanel = '<div class="md-panel md-panel--mekan">'
    + '<div class="md-panel-baslik"><span class="md-panel-ikon" aria-hidden="true">🔄</span><h3>' + escHtml(t('game.transfer.venuePanel')) + '</h3></div>';

  if (mekanSay < 1) {
    mekanPanel += '<p class="md-bos-uyari">' + escHtml(t('game.transfer.noVenuesWarning')) + '</p>';
  }

  mekanPanel += '<div class="md-alan"><label for="mekanDevriHedef">' + escHtml(t('game.transfer.allyLabel')) + '</label>'
    + '<input type="text" id="mekanDevriHedef" placeholder="' + escHtml(t('game.transfer.allyPlaceholder')) + '" maxlength="24"' + (mekanSay < 1 ? ' disabled' : '') + '></div>';

  if (mekanGrid) {
    mekanPanel += mekanGrid;
  }

  mekanPanel += '<div class="md-alan md-alan--adet"><label for="mekanDevriAdet">' + escHtml(t('game.transfer.qtyLabel')) + '</label>'
    + '<input type="number" id="mekanDevriAdet" value="1" min="1" max="999"' + (mekanSay < 1 ? ' disabled' : '') + '></div>'
    + '<button type="button" class="md-btn md-btn--mavi"' + (mekanSay < 1 ? ' disabled' : ' onclick="mekanDevret()"') + '>' + escHtml(t('game.transfer.transferBtn')) + '</button>'
    + '<div id="mekanDevriSonuc" class="md-sonuc gizli"></div></div>';

  return '<div class="md-sayfa"><div class="md-cerceve">'
    + '<div class="md-banner">'
    + '<img src="' + ARKA_PLAN_GORSEL + '" alt="" onerror="imgFallback(this)">'
    + '<div class="md-banner-ortu" aria-hidden="true"></div>'
    + '<div class="md-baslik-wrap">'
    + '<span class="md-baslik-ikon" aria-hidden="true">🔄</span>'
    + '<h2>' + escHtml(t('game.transfer.title')) + '</h2>'
    + '<p class="md-baslik-alt">' + escHtml(t('game.transfer.subtitle')) + '</p>'
    + '</div></div>'
    + '<div class="md-govde">'
    + '<p class="md-giris">' + escHtml(altMetin) + '</p>'
    + '<div class="md-paneller">'
    + mekanPanel
    + '<div class="md-panel md-panel--para">'
    + '<div class="md-panel-baslik"><span class="md-panel-ikon" aria-hidden="true">💸</span><h3>' + escHtml(t('game.transfer.sendMoneyTitle')) + '</h3></div>'
    + '<div class="md-alan"><label for="paraGonderHedef">' + escHtml(t('game.transfer.buyerLabel')) + '</label>'
    + '<input type="text" id="paraGonderHedef" placeholder="' + escHtml(t('game.transfer.buyerPlaceholder')) + '" maxlength="24"></div>'
    + '<div class="md-alan"><label for="paraGonderMiktar">' + escHtml(t('game.transfer.amountLabel')) + '</label>'
    + '<input type="number" id="paraGonderMiktar" value="100000" min="1" max="999999999"></div>'
    + '<button type="button" class="md-btn md-btn--yesil" onclick="paraGonder()">' + escHtml(t('game.transfer.sendBtn')) + '</button>'
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
    if (kalan > 5) return;
    var simdi = Date.now();
    if (simdi - icraatSonRegenPoll < 2500) return;
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

function profilHizaAracHtml() {
  return '<div id="profilHizaArac" class="profil-hiza-arac">'
    + '<span class="profil-hiza-etiket">' + escHtml(t('game.profil.alignLabel')) + '</span>'
    + '<button type="button" class="profil-hiza-btn aktif" data-hiza="left" title="' + escHtml(t('game.profil.alignLeftTitle')) + '">' + escHtml(t('game.profil.alignLeft')) + '</button>'
    + '<button type="button" class="profil-hiza-btn" data-hiza="center" title="' + escHtml(t('game.profil.alignCenterTitle')) + '">' + escHtml(t('game.profil.alignCenter')) + '</button>'
    + '<button type="button" class="profil-hiza-btn" data-hiza="right" title="' + escHtml(t('game.profil.alignRightTitle')) + '">' + escHtml(t('game.profil.alignRight')) + '</button>'
    + '</div>';
}

function profilHizaButonlariGuncelle(hiza) {
  profilAktifHiza = hiza || 'left';
  document.querySelectorAll('.profil-hiza-btn').forEach(function(btn) {
    btn.classList.toggle('aktif', btn.getAttribute('data-hiza') === profilAktifHiza);
  });
}

function profilHizaUygula(hiza) {
  profilHizaButonlariGuncelle(hiza);
  var mKodAlani = document.getElementById('mafyaGrupAciklamaKodAlani');
  var mKod = document.getElementById('mafyaGrupAciklamaKod');
  if (mKodAlani && mKod && !mKodAlani.classList.contains('gizli')) {
    mafyaGrupAciklamaOnizlemeGuncelle(
      typeof profilFFormat !== 'undefined'
        ? profilFFormat.profilHizaEkle(mKod.value, hiza)
        : mKod.value
    );
    return;
  }
  var kodAlani = document.getElementById('profilAciklamaKodAlani');
  var kod = document.getElementById('profilAciklamaKod');
  if (kodAlani && kod && !kodAlani.classList.contains('gizli')) {
    profilAciklamaOnizlemeGuncelle(
      typeof profilFFormat !== 'undefined'
        ? profilFFormat.profilHizaEkle(kod.value, hiza)
        : kod.value
    );
    return;
  }
  if (mafyaGrupQuill) {
    var mUzunluk = mafyaGrupQuill.getLength();
    var mDeger = hiza === 'left' ? false : hiza;
    mafyaGrupQuill.formatLine(0, mUzunluk, 'align', mDeger);
    return;
  }
  if (profilQuill) {
    var uzunluk = profilQuill.getLength();
    var deger = hiza === 'left' ? false : hiza;
    profilQuill.formatLine(0, uzunluk, 'align', deger);
  }
}

function profilHizaAracBagla() {
  if (window.__profilHizaBagli) return;
  window.__profilHizaBagli = true;
  document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.profil-hiza-btn');
    if (!btn) return;
    var profilArac = document.getElementById('profilHizaArac');
    var mafyaArac = document.getElementById('mafyaGrupHizaArac');
    var inProfil = profilArac && profilArac.contains(btn);
    var inMafya = mafyaArac && mafyaArac.contains(btn);
    if (!inProfil && !inMafya) return;
    e.preventDefault();
    profilHizaUygula(btn.getAttribute('data-hiza'));
  });
}

function profilQuillToolbarHtml() {
  return '<div id="profilAciklamaToolbar">'
    + '<span class="ql-formats">'
    + '<button type="button" class="ql-bold" title="' + escHtml(t('game.profil.bold')) + '"></button>'
    + '<button type="button" class="ql-italic" title="' + escHtml(t('game.profil.italic')) + '"></button>'
    + '<button type="button" class="ql-undo" title="' + escHtml(t('game.profil.undo')) + '"></button>'
    + '</span>'
    + '<span class="ql-formats">'
    + '<button type="button" class="ql-align" value="" title="' + escHtml(t('game.profil.alignLeftTitle')) + '"></button>'
    + '<button type="button" class="ql-align" value="center" title="' + escHtml(t('game.profil.alignCenterTitle')) + '"></button>'
    + '<button type="button" class="ql-align" value="right" title="' + escHtml(t('game.profil.alignRightTitle')) + '"></button>'
    + '</span>'
    + '<span class="ql-formats"><select class="ql-color" title="' + escHtml(t('game.profil.textColor')) + '"></select></span>'
    + '<span class="ql-formats"><select class="ql-size" title="' + escHtml(t('game.profil.fontSize')) + '">'
    + '<option value="10px">' + escHtml(t('game.profil.sizeSmall')) + '</option>'
    + '<option value="14px" selected>' + escHtml(t('game.profil.sizeNormal')) + '</option>'
    + '<option value="18px">' + escHtml(t('game.profil.sizeLarge')) + '</option>'
    + '<option value="24px">' + escHtml(t('game.profil.sizeXLarge')) + '</option>'
    + '</select></span>'
    + '<span class="ql-formats"><select class="ql-font" title="' + escHtml(t('game.profil.fontFamily')) + '">'
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
  profilHizaAracBagla();
  if (typeof Quill === 'undefined') return;
  if (!document.getElementById('profilAciklamaWrap')) return;

  profilQuill = null;
  profilQuillDomSifirla();

  if (!document.getElementById('profilAciklamaEditor')) return;

  profilQuill = new Quill('#profilAciklamaEditor', {
    theme: 'snow',
    placeholder: t('game.profil.descPlaceholder'),
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
  profilQuill.on('text-change', function() {
    if (!profilQuill) return;
    var html = profilQuill.root.innerHTML || '';
    if (typeof profilFFormat !== 'undefined' && profilFFormat.profilAciklamaFFormatMi(html)) {
      profilAciklamaModuUygula(profilFFormat.htmlToPlainText(html));
    }
  });
}

function profilAciklamaAl() {
  var kod = document.getElementById('profilAciklamaKod');
  var kodAlani = document.getElementById('profilAciklamaKodAlani');
  if (kod && kodAlani && !kodAlani.classList.contains('gizli')) {
    var govde = kod.value.trim();
    return typeof profilFFormat !== 'undefined'
      ? profilFFormat.profilHizaEkle(govde, profilAktifHiza)
      : govde;
  }
  if (!profilQuill) return '';
  var html = profilQuill.root.innerHTML || '';
  if (html === '<p><br></p>' || html === '<p></p>') return '';
  if (typeof profilFFormat !== 'undefined' && profilFFormat.profilAciklamaFFormatMi(html)) {
    return profilFFormat.htmlToPlainText(html).trim();
  }
  return html;
}

function profilAciklamaGosterUygula(html, hedefId) {
  var el = document.getElementById(hedefId || 'profilAciklamaGoster');
  if (!el) return;
  if (!html || !String(html).trim()) {
    el.textContent = '—';
    return;
  }
  var s = String(html).trim();
  if (typeof profilFFormat !== 'undefined') {
    var fHtml = profilFFormat.fFormatToHtml(s);
    if (fHtml) {
      el.innerHTML = fHtml;
      return;
    }
  }
  if (s.indexOf('<') < 0) {
    el.textContent = s;
    return;
  }
  el.innerHTML = s;
}

function profilAciklamaOnizlemeGuncelle(kaynak) {
  var oniz = document.getElementById('profilAciklamaOnizleme');
  if (!oniz || oniz.classList.contains('gizli')) return;
  profilAciklamaGosterUygula(kaynak != null ? kaynak : profilAciklamaAl(), 'profilAciklamaOnizleme');
}

function profilAciklamaModuUygula(html) {
  var kodAlani = document.getElementById('profilAciklamaKodAlani');
  var quillWrap = document.getElementById('profilAciklamaWrap');
  var onizBaslik = document.getElementById('profilAciklamaOnizlemeBaslik');
  var oniz = document.getElementById('profilAciklamaOnizleme');
  var kod = document.getElementById('profilAciklamaKod');
  var s = String(html || '').trim();
  var fMi = typeof profilFFormat !== 'undefined' && profilFFormat.profilAciklamaFFormatMi(s);

  if (fMi && kodAlani && kod) {
    kodAlani.classList.remove('gizli');
    if (quillWrap) quillWrap.classList.add('gizli');
    if (onizBaslik) onizBaslik.classList.remove('gizli');
    if (oniz) oniz.classList.remove('gizli');
    var parsed = typeof profilFFormat !== 'undefined'
      ? profilFFormat.profilHizaAyikla(s)
      : { hiza: 'left', body: profilFFormat ? profilFFormat.htmlToPlainText(s) : s };
    kod.value = typeof profilFFormat !== 'undefined'
      ? profilFFormat.htmlToPlainText(parsed.body)
      : parsed.body;
    profilHizaButonlariGuncelle(parsed.hiza);
    if (!kod.dataset.bagli) {
      kod.dataset.bagli = '1';
      kod.addEventListener('input', function() {
        profilAciklamaOnizlemeGuncelle(
          profilFFormat.profilHizaEkle(kod.value, profilAktifHiza)
        );
      });
    }
    profilAciklamaOnizlemeGuncelle(profilFFormat.profilHizaEkle(kod.value, parsed.hiza));
    return;
  }

  if (kodAlani) kodAlani.classList.add('gizli');
  if (quillWrap) quillWrap.classList.remove('gizli');
  if (onizBaslik) onizBaslik.classList.add('gizli');
  if (oniz) oniz.classList.add('gizli');

  if (!profilQuill) return;
  if (!s) {
    profilQuill.setText('');
    return;
  }
  if (s.indexOf('<') < 0) {
    profilQuill.setText(s);
    return;
  }
  profilQuill.root.innerHTML = s;
}

function profilAciklamaYaz(html) {
  profilAciklamaModuUygula(html);
}

function mafyaAciklamaListeMetin(html) {
  if (!html || !String(html).trim()) return '—';
  var s = String(html).trim();
  if (typeof profilFFormat !== 'undefined' && profilFFormat.profilAciklamaFFormatMi(s)) {
    return profilFFormat.htmlToPlainText(s).replace(/\s+/g, ' ').trim().slice(0, 160);
  }
  if (s.indexOf('<') < 0) return s.slice(0, 160);
  var tmp = document.createElement('div');
  tmp.innerHTML = s;
  return (tmp.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function mafyaGrupQuillToolbarHtml() {
  return '<div id="mafyaGrupAciklamaToolbar">'
    + '<span class="ql-formats">'
    + '<button type="button" class="ql-bold" title="' + escHtml(t('game.profil.bold')) + '"></button>'
    + '<button type="button" class="ql-italic" title="' + escHtml(t('game.profil.italic')) + '"></button>'
    + '<button type="button" class="ql-undo" title="' + escHtml(t('game.profil.undo')) + '"></button>'
    + '</span>'
    + '<span class="ql-formats">'
    + '<button type="button" class="ql-align" value="" title="' + escHtml(t('game.profil.alignLeftTitle')) + '"></button>'
    + '<button type="button" class="ql-align" value="center" title="' + escHtml(t('game.profil.alignCenterTitle')) + '"></button>'
    + '<button type="button" class="ql-align" value="right" title="' + escHtml(t('game.profil.alignRightTitle')) + '"></button>'
    + '</span>'
    + '<span class="ql-formats"><select class="ql-color" title="' + escHtml(t('game.profil.textColor')) + '"></select></span>'
    + '<span class="ql-formats"><select class="ql-size" title="' + escHtml(t('game.profil.fontSize')) + '">'
    + '<option value="10px">' + escHtml(t('game.profil.sizeSmall')) + '</option>'
    + '<option value="14px" selected>' + escHtml(t('game.profil.sizeNormal')) + '</option>'
    + '<option value="18px">' + escHtml(t('game.profil.sizeLarge')) + '</option>'
    + '<option value="24px">' + escHtml(t('game.profil.sizeXLarge')) + '</option>'
    + '</select></span>'
    + '<span class="ql-formats"><select class="ql-font" title="' + escHtml(t('game.profil.fontFamily')) + '">'
    + '<option selected>Sans</option>'
    + '<option value="roboto">Roboto</option>'
    + '<option value="oswald">Oswald</option>'
    + '<option value="cinzel">Cinzel</option>'
    + '<option value="serif">Serif</option>'
    + '<option value="monospace">Monospace</option>'
    + '</select></span>'
    + '</div>'
    + '<div id="mafyaGrupAciklamaEditor"></div>';
}

function mafyaGrupAciklamaEditorHtml() {
  return '<p class="profil-alan-not">' + escHtml(t('game.profil.asciiNote')) + '</p>'
    + profilHizaAracHtml().replace('id="profilHizaArac"', 'id="mafyaGrupHizaArac"')
    + '<div id="mafyaGrupAciklamaKodAlani" class="gizli">'
    + '<textarea id="mafyaGrupAciklamaKod" class="profil-kod-textarea" spellcheck="false" rows="10" '
    + 'placeholder="[f f=&quot;Lucida Console&quot;][f s=03][f c=#ff0000]...[/f][/f][/f]"></textarea>'
    + '</div>'
    + '<div id="mafyaGrupAciklamaWrap" class="profil-quill-wrap">'
    + mafyaGrupQuillToolbarHtml()
    + '</div>'
    + '<label id="mafyaGrupAciklamaOnizlemeBaslik" class="profil-onizleme-baslik gizli">' + escHtml(t('game.profil.preview')) + '</label>'
    + '<div id="mafyaGrupAciklamaOnizleme" class="profil-aciklama-metin profil-aciklama-html gizli">—</div>'
    + '<div class="mafya-btn-satir" style="margin-top:10px;">'
    + '<button type="button" class="btn-is" onclick="mafyaGrupAciklamaKaydet()">' + escHtml(t('game.profil.save')) + '</button>'
    + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaGrupAciklamaIptal()">' + escHtml(t('game.profil.cancel')) + '</button>'
    + '</div>';
}

function mafyaGrupQuillYokEt() {
  mafyaGrupQuill = null;
}

function mafyaGrupQuillBaslat() {
  profilQuillKayitlari();
  profilHizaAracBagla();
  if (typeof Quill === 'undefined') return;
  if (!document.getElementById('mafyaGrupAciklamaWrap')) return;
  mafyaGrupQuill = null;
  var wrap = document.getElementById('mafyaGrupAciklamaWrap');
  wrap.innerHTML = mafyaGrupQuillToolbarHtml();
  if (!document.getElementById('mafyaGrupAciklamaEditor')) return;
  mafyaGrupQuill = new Quill('#mafyaGrupAciklamaEditor', {
    theme: 'snow',
    placeholder: t('game.profil.mafiaDescPlaceholder'),
    modules: {
      toolbar: {
        container: '#mafyaGrupAciklamaToolbar',
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
  mafyaGrupQuill.on('text-change', function() {
    if (!mafyaGrupQuill) return;
    var html = mafyaGrupQuill.root.innerHTML || '';
    if (typeof profilFFormat !== 'undefined' && profilFFormat.profilAciklamaFFormatMi(html)) {
      mafyaGrupAciklamaModuUygula(profilFFormat.htmlToPlainText(html));
    }
  });
}

function mafyaGrupAciklamaAl() {
  var kod = document.getElementById('mafyaGrupAciklamaKod');
  var kodAlani = document.getElementById('mafyaGrupAciklamaKodAlani');
  if (kod && kodAlani && !kodAlani.classList.contains('gizli')) {
    var govde = kod.value.trim();
    return typeof profilFFormat !== 'undefined'
      ? profilFFormat.profilHizaEkle(govde, profilAktifHiza)
      : govde;
  }
  if (!mafyaGrupQuill) return '';
  var html = mafyaGrupQuill.root.innerHTML || '';
  if (!html || html === '<p><br></p>') return '';
  if (typeof profilFFormat !== 'undefined' && profilFFormat.profilAciklamaFFormatMi(html)) {
    return profilFFormat.htmlToPlainText(html).trim();
  }
  return html;
}

function mafyaGrupAciklamaOnizlemeGuncelle(kaynak) {
  var oniz = document.getElementById('mafyaGrupAciklamaOnizleme');
  if (!oniz || oniz.classList.contains('gizli')) return;
  profilAciklamaGosterUygula(kaynak != null ? kaynak : mafyaGrupAciklamaAl(), 'mafyaGrupAciklamaOnizleme');
}

function mafyaGrupAciklamaModuUygula(html) {
  var kodAlani = document.getElementById('mafyaGrupAciklamaKodAlani');
  var quillWrap = document.getElementById('mafyaGrupAciklamaWrap');
  var onizBaslik = document.getElementById('mafyaGrupAciklamaOnizlemeBaslik');
  var oniz = document.getElementById('mafyaGrupAciklamaOnizleme');
  var kod = document.getElementById('mafyaGrupAciklamaKod');
  var s = String(html || '').trim();
  var fMi = typeof profilFFormat !== 'undefined' && profilFFormat.profilAciklamaFFormatMi(s);

  if (fMi && kodAlani && kod) {
    kodAlani.classList.remove('gizli');
    if (quillWrap) quillWrap.classList.add('gizli');
    if (onizBaslik) onizBaslik.classList.remove('gizli');
    if (oniz) oniz.classList.remove('gizli');
    var parsed = typeof profilFFormat !== 'undefined'
      ? profilFFormat.profilHizaAyikla(s)
      : { hiza: 'left', body: s };
    kod.value = typeof profilFFormat !== 'undefined'
      ? profilFFormat.htmlToPlainText(parsed.body)
      : s;
    profilHizaButonlariGuncelle(parsed.hiza || 'left');
    kod.oninput = function() {
      mafyaGrupAciklamaOnizlemeGuncelle(
        typeof profilFFormat !== 'undefined'
          ? profilFFormat.profilHizaEkle(kod.value, profilAktifHiza)
          : kod.value
      );
    };
    mafyaGrupAciklamaOnizlemeGuncelle(profilFFormat.profilHizaEkle(kod.value, parsed.hiza));
    mafyaGrupQuillYokEt();
    return;
  }

  if (kodAlani) kodAlani.classList.add('gizli');
  if (onizBaslik) onizBaslik.classList.add('gizli');
  if (oniz) oniz.classList.add('gizli');
  if (quillWrap) quillWrap.classList.remove('gizli');
  mafyaGrupQuillBaslat();
  if (!mafyaGrupQuill) return;
  if (!s) {
    mafyaGrupQuill.setText('');
    return;
  }
  if (s.indexOf('<') < 0) {
    mafyaGrupQuill.setText(s);
    return;
  }
  mafyaGrupQuill.root.innerHTML = s;
}

function mafyaGrupAciklamaGoster(html) {
  var el = document.getElementById('mafyaGrupAciklamaGoster');
  if (!el) return;
  el.classList.toggle('mafya-grup-aciklama-bos', !html || !String(html).trim());
  if (!html || !String(html).trim()) {
    el.textContent = t('game.empty.noDescription');
    return;
  }
  profilAciklamaGosterUygula(html, 'mafyaGrupAciklamaGoster');
}

async function profilLiderlikOyunculariYukle() {
  try {
    var res = await apiFetch('/api/leaderboard?tip=oyuncu');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) {
      profilLiderlikOyunculari = [];
      profilDostDusmanDatalistGuncelle();
      return;
    }
    profilLiderlikOyunculari = (data.liste || []).map(function(o) {
      return { isim: o.isim, username: o.username, userId: o.userId };
    });
    profilDostDusmanDatalistGuncelle();
  } catch (_) {
    profilLiderlikOyunculari = [];
    profilDostDusmanDatalistGuncelle();
  }
}

function profilLiderlikIsimEsles(ad) {
  if (!ad) return null;
  var lower = String(ad).trim().toLowerCase();
  if (!lower) return null;
  for (var i = 0; i < profilLiderlikOyunculari.length; i++) {
    var o = profilLiderlikOyunculari[i];
    if (o.isim && o.isim.toLowerCase() === lower) return o;
    if (o.username && o.username.toLowerCase() === lower) return o;
  }
  return null;
}

function profilDostDusmanDatalistGuncelle() {
  var list = document.getElementById('profilLiderlikIsimListesi');
  if (!list) return;
  var html = '';
  profilLiderlikOyunculari.forEach(function(o) {
    if (o.isim) html += '<option value="' + escHtml(o.isim) + '"></option>';
  });
  list.innerHTML = html;
}

function profilDostDusmanGosterHtml(ad) {
  if (!ad) return '';
  var esles = profilLiderlikIsimEsles(ad);
  if (esles && esles.userId) return oyuncuLink(esles.userId, esles.isim || ad);
  return escHtml(ad);
}

function profilYetenekEtiket(key) {
  var k = 'game.profil.skill.' + key;
  var v = t(k);
  return v !== k ? v : key;
}

function profilYetenekBarHTML(key, deger, meta) {
  deger = deger || 0;
  meta = meta || null;
  var yuzde = meta && meta.yuzde != null ? meta.yuzde : 0;
  var kademeHtml = meta && meta.kademe
    ? '<span class="profil-yetenek-kademe">' + escHtml(meta.kademe) + '</span>'
    : '';
  var sonrakiHtml = meta && meta.sonrakiEsik
    ? '<span class="profil-yetenek-sonraki">' + escHtml(t('game.profil.nextTier')) + ' ' + meta.sonrakiEsik + '</span>'
    : '';
  return '<div class="profil-yetenek-kart">'
    + '<h4>' + escHtml(profilYetenekEtiket(key)) + '</h4>'
    + '<div class="profil-yetenek-deger" id="profilYetenek_' + key + '">' + deger + kademeHtml + '</div>'
    + '<div class="profil-yetenek-bar"><i style="width:' + yuzde + '%"></i></div>'
    + sonrakiHtml
    + '</div>';
}

function profilYetenekleriPanelHTML(yetenekler, aktifMeslek, ozet) {
  yetenekler = yetenekler || oyuncuYetenekler || { guc: 8, zeka: 8, dayaniklilik: 8, beceri: 8 };
  ozet = ozet || oyuncuYetenekOzeti;
  var statMap = {};
  if (ozet && ozet.statlar) {
    ozet.statlar.forEach(function (s) { statMap[s.key] = s; });
  }
  var html = '<div class="profil-yetenekler-wrap">'
    + '<p class="profil-alan-not">' + escHtml(t('game.profil.skillsNote')) + '</p>'
    + '<div class="profil-yetenek-grid">'
    + profilYetenekBarHTML('guc', yetenekler.guc, statMap.guc)
    + profilYetenekBarHTML('zeka', yetenekler.zeka, statMap.zeka)
    + profilYetenekBarHTML('dayaniklilik', yetenekler.dayaniklilik, statMap.dayaniklilik)
    + profilYetenekBarHTML('beceri', yetenekler.beceri, statMap.beceri)
    + '</div>';
  if (aktifMeslek) {
    html += '<div class="profil-meslek-kart" id="profilAktifMeslekKart">'
      + '<h4>' + escHtml(t('game.profil.activeJob')) + '</h4>'
      + '<p><b id="profilMeslekIsyeri">' + escHtml(aktifMeslek.isyeriAd) + '</b> — <span id="profilMeslekUnvan">' + escHtml(aktifMeslek.unvan) + '</span></p>'
      + '<p>' + escHtml(t('game.profil.dailySalary')) + ' <b id="profilMeslekMaas">' + fmt(aktifMeslek.gunlukGelir) + ' TL</b></p>'
      + '</div>';
  } else {
    html += '<div class="profil-meslek-kart" id="profilAktifMeslekKart" style="border-color:rgba(140,140,140,.35);background:rgba(0,0,0,.25);">'
      + '<h4 style="color:#aaa;">' + escHtml(t('game.profil.noJob')) + '</h4>'
      + '<p>' + t('game.profil.noJobHint') + '</p>'
      + '</div>';
  }
  html += '</div>';
  return html;
}

function profilSekmeDegistir(sekme) {
  profilAktifSekme = sekme === 'yetenekler' ? 'yetenekler' : 'karakter';
  var wrap = document.querySelector('.profil-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('.profil-sekme').forEach(function(btn) {
    var s = btn.getAttribute('data-sekme') || '';
    btn.classList.toggle('aktif', s === profilAktifSekme);
  });
  var karakter = document.getElementById('profilSekmeKarakter');
  var yetenekler = document.getElementById('profilSekmeYetenekler');
  if (karakter) karakter.classList.toggle('gizli', profilAktifSekme !== 'karakter');
  if (yetenekler) yetenekler.classList.toggle('gizli', profilAktifSekme !== 'yetenekler');
}

function profilYetenekleriGuncelle(yetenekler, aktifMeslek, ozet) {
  if (yetenekler) oyuncuYetenekler = yetenekler;
  if (ozet) oyuncuYetenekOzeti = ozet;
  if (aktifMeslek !== undefined) oyuncuAktifMeslek = aktifMeslek;
  if (!yetenekler) return;
  ['guc', 'zeka', 'dayaniklilik', 'beceri'].forEach(function(k) {
    var el = document.getElementById('profilYetenek_' + k);
    if (el) el.textContent = yetenekler[k] || 0;
  });
  var yetenekPanel = document.getElementById('profilSekmeYetenekler');
  if (yetenekPanel && yetenekPanel.querySelector('.profil-yetenekler-wrap')) {
    yetenekPanel.innerHTML = profilYetenekleriPanelHTML(yetenekler, aktifMeslek, ozet || oyuncuYetenekOzeti);
  }
}

function profilEkranSablonu(opts) {
  opts = opts || {};
  var ad = opts.oyuncuAdi || 'Reis';
  var isimCls = 'profil-isim-script' + (opts.sehirEfsane ? ' isim-efsane' : '');
  var userId = opts.userId || window.__benimUserId || 'me';
  var avatarUrl = profilResmiUrl(userId, opts.profilResmi);
  var avatarCls = profilResmiOzelMi(avatarUrl) ? ' profil-avatar-ozel' : '';

  var metaHtml = '<span id="profilKayitTarihiWrap">' + escHtml(t('game.profil.registered')) + ' <span id="profilKayitTarihi">' + escHtml(opts.kayitTarihi || '—') + '</span></span>'
    + '<span id="profilKayitUlkeWrap">' + escHtml(t('game.profil.regCountry')) + ' <span id="profilKayitUlke">' + profilLocaleMetinHtml(opts.kayitUlkesi) + '</span></span>'
    + '<span id="profilOyunDiliWrap">' + escHtml(t('game.profil.gameLang')) + ' <span id="profilOyunDili">' + profilDilMetinHtml(opts.oyunDili) + '</span></span>';
  if (opts.sehirEfsane) {
    metaHtml += '<span class="profil-rozet efsane">' + escHtml(t('game.profil.legendBadge')) + '</span>';
  }
  if (opts.karaListede) {
    metaHtml += '<span class="profil-rozet kara">' + escHtml(t('game.profil.blacklistBadge')) + '</span>';
  }

  var ozetHtml = '<div class="profil-ozet-hucre"><span>' + escHtml(t('game.profil.player')) + '</span><strong id="profilOzOyuncu">' + escHtml(ad) + '</strong></div>'
    + '<div class="profil-ozet-hucre"><span>🏷️ Lakap</span><strong id="profilOzLakap">' + escHtml(opts.lakap || 'Mafya') + '</strong></div>';
  if (opts.guc != null) {
    ozetHtml += '<div class="profil-ozet-hucre"><span>' + escHtml(t('game.profil.power')) + '</span><strong id="profilOzGuc">' + fmt(opts.guc) + '</strong></div>';
    if (opts.bonusGuc > 0) {
      ozetHtml += '<div class="profil-ozet-hucre"><span>' + escHtml(t('game.profil.bonusPower')) + '</span><strong id="profilOzBonusGuc">' + fmt(opts.bonusGuc) + '</strong></div>';
      ozetHtml += '<div class="profil-ozet-hucre"><span>' + escHtml(t('game.profil.totalPower')) + '</span><strong id="profilOzToplamGuc">' + fmt(opts.toplamGuc != null ? opts.toplamGuc : opts.guc + opts.bonusGuc) + '</strong></div>';
    }
  } else {
    ozetHtml += '<div class="profil-ozet-hucre"><span>' + escHtml(t('game.profil.power')) + '</span><strong id="profilOzGuc">—</strong></div>';
  }
  if (opts.saatlik != null) {
    ozetHtml += '<div class="profil-ozet-hucre"><span>' + escHtml(t('game.profil.hourlyIncome')) + '</span><strong class="yesil" id="profilOzSaatlik">' + fmt(opts.saatlik) + ' TL</strong></div>';
  } else {
    ozetHtml += '<div class="profil-ozet-hucre"><span>' + escHtml(t('game.profil.hourlyIncome')) + '</span><strong class="yesil" id="profilOzSaatlik">—</strong></div>';
  }

  var detayHtml = '<dl class="profil-detay-liste">'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.playerName')) + '</dt><dd id="profilOyuncuIsmiDetay">' + escHtml(opts.oyuncuAdi || ad) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.company')) + '</dt><dd id="profilSirketDetay">' + profilSirketDetayHTML(opts.isDurumu, opts.userId || userId) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.respect')) + '</dt><dd id="profilPuanDetay">' + fmt(opts.puan || 0) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.rank')) + '</dt><dd id="profilSiraDetay">' + (opts.sira != null ? fmt(opts.sira) : '—') + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.groupRank')) + '</dt><dd id="profilGrupSiraDetay">' + profilGrupSiraDetayHTML(opts.grupSira, opts.grup, opts.grupId) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.regCountry')) + '</dt><dd id="profilKayitUlkeDetay">' + profilLocaleMetinHtml(opts.kayitUlkesi) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.gameLang')) + '</dt><dd id="profilOyunDiliDetay">' + profilDilMetinHtml(opts.oyunDili) + '</dd></div>'
    + '<div class="profil-detay-satir"><dt>' + escHtml(t('game.profil.actionRegen')) + '</dt><dd id="profilIcraatKalan">' + (opts.icraatKalan || '—') + '</dd></div>'
    + '</dl>';

  var formHtml;
  if (opts.duzenlenebilir) {
    var adDegistirUcret = Math.floor((opts.saatlik || 0) * 5);
    formHtml = '<div class="profil-form">'
      + '<div class="profil-adi-degistir">'
      + '<label for="profilYeniOyuncuAdi">' + escHtml(t('game.profil.changeName')) + '</label>'
      + '<div class="profil-adi-degistir-satir">'
      + '<input type="text" id="profilYeniOyuncuAdi" maxlength="24" placeholder="' + escHtml(t('game.profil.newNamePlaceholder')) + '" autocomplete="nickname">'
      + '<button type="button" class="profil-adi-degistir-btn" onclick="profilOyuncuAdiDegistir()">'
      + '<span id="profilOyuncuAdiUcret">' + fmt(adDegistirUcret) + ' TL</span>'
      + '</button></div></div>'
      + '<label>' + escHtml(t('game.profil.addDescription')) + '</label>'
      + '<p class="profil-alan-not">' + escHtml(t('game.profil.asciiNote')) + '</p>'
      + profilHizaAracHtml()
      + '<div id="profilAciklamaKodAlani" class="gizli">'
      + '<textarea id="profilAciklamaKod" class="profil-kod-textarea" spellcheck="false" rows="14" '
      + 'placeholder="[f f=&quot;Lucida Console&quot;][f s=03][f c=#ff0000]...[/f][/f][/f]"></textarea>'
      + '</div>'
      + '<div id="profilAciklamaWrap" class="profil-quill-wrap">'
      + profilQuillToolbarHtml()
      + '</div>'
      + '<label id="profilAciklamaOnizlemeBaslik" class="profil-onizleme-baslik gizli">' + escHtml(t('game.profil.preview')) + '</label>'
      + '<div id="profilAciklamaOnizleme" class="profil-aciklama-metin profil-aciklama-html gizli">—</div>'
      + '<div class="profil-form-ikili">'
      + '<datalist id="profilLiderlikIsimListesi"></datalist>'
      + '<div>' + '<label for="profilDostlar">' + escHtml(t('game.profil.friends')) + '</label>'
      + '<input type="text" id="profilDostlar" list="profilLiderlikIsimListesi" maxlength="24" placeholder="' + escHtml(t('game.profil.playerNamePlaceholder')) + '" autocomplete="off">'
      + '<small class="profil-alan-not">' + escHtml(t('game.profil.leaderboardHint')) + '</small></div>'
      + '<div>' + '<label for="profilDusmanlar">' + escHtml(t('game.profil.enemies')) + '</label>'
      + '<input type="text" id="profilDusmanlar" list="profilLiderlikIsimListesi" maxlength="24" placeholder="' + escHtml(t('game.profil.playerNamePlaceholder')) + '" autocomplete="off">'
      + '<small class="profil-alan-not">' + escHtml(t('game.profil.leaderboardHint')) + '</small></div>'
      + '</div></div>';
  } else {
    formHtml = '<div class="profil-form">'
      + (opts.ziyaretciModu
        ? '<div class="profil-aciklama-baslik-satir"><label>' + escHtml(t('game.profil.description')) + '</label>'
          + icerikRaporlaAlaniHTML({ tip: 'profil', hedefUserId: userId })
          + '</div>'
        : '<label>' + escHtml(t('game.profil.description')) + '</label>')
      + '<div id="profilAciklamaGoster" class="profil-aciklama-metin profil-aciklama-html">—</div>'
      + '<div class="profil-form-ikili">'
      + '<div><label>' + escHtml(t('game.profil.friends')) + '</label><p class="profil-aciklama-metin">' + profilDostDusmanGosterHtml(opts.dostlar) + '</p></div>'
      + '<div><label>' + escHtml(t('game.profil.enemies')) + '</label><p class="profil-aciklama-metin">' + profilDostDusmanGosterHtml(opts.dusmanlar) + '</p></div>'
      + '</div></div>';
  }

  var resimBtn = opts.duzenlenebilir
    ? '<button type="button" class="profil-resim-btn" onclick="profilResmiSecModal()">' + escHtml(t('game.profil.changePhoto')) + '</button>'
    : '';

  var altBtn = '';
  if (opts.duzenlenebilir) {
    altBtn = '<div class="profil-alt-butonlar">'
      + '<button type="button" class="profil-alt-btn kirmizi" onclick="profilKaydet()">' + escHtml(t('game.profil.saveProfile')) + '</button>'
      + '<button type="button" class="profil-alt-btn koyu" onclick="sifreDegistirModal()">' + escHtml(t('game.profil.changePassword')) + '</button>'
      + '<button type="button" class="profil-alt-btn koyu" onclick="cikisYap()">' + escHtml(t('game.profil.logout')) + '</button>'
      + '</div>'
      + '<div id="sifreAlan" class="gizli profil-sifre-kutu">'
      + '<label for="eskiSifre">' + escHtml(t('game.profil.currentPassword')) + '</label>'
      + '<input type="password" id="eskiSifre" class="dusman-input">'
      + '<label for="yeniSifre">' + escHtml(t('game.profil.newPassword')) + '</label>'
      + '<input type="password" id="yeniSifre" class="dusman-input">'
      + '<button type="button" class="profil-alt-btn kirmizi" onclick="sifreKaydet()">' + escHtml(t('game.profil.savePassword')) + '</button>'
      + '</div>';
  } else if (opts.ziyaretciModu && opts.oyuncuAdi) {
    var hedefAdEsc = String(opts.oyuncuAdi).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    altBtn = '<div class="profil-ziyaret-aksiyon">'
      + '<div class="profil-alt-butonlar">'
      + '<button type="button" class="profil-alt-btn kirmizi" onclick="profilZiyaretSaldir(\'' + hedefAdEsc + '\')">' + escHtml(t('game.profil.attack')) + '</button>'
      + '<button type="button" class="profil-alt-btn koyu" onclick="profilZiyaretIstihbarat(\'' + hedefAdEsc + '\')">' + escHtml(t('game.profil.sendIntel')) + '</button>'
      + '<button type="button" class="profil-alt-btn mavi" onclick="profilZiyaretMesajAc()">' + escHtml(t('game.profil.sendMessage')) + '</button>'
      + '</div>'
      + '<div id="profilSaldirSonuc" class="profil-saldir-sonuc"></div>'
      + '<div id="profilZiyaretMesajAlani" class="gizli profil-ziyaret-mesaj">'
      + '<label for="profilZiyaretMesajMetin">' + escHtml(t('game.profil.yourMessage')) + '</label>'
      + '<textarea id="profilZiyaretMesajMetin" class="profil-ziyaret-textarea" rows="4" maxlength="500" placeholder="' + escHtml(t('game.profil.messagePlaceholder')) + '"></textarea>'
      + '<button type="button" class="profil-alt-btn kirmizi" onclick="profilZiyaretMesajGonder()">' + escHtml(t('game.profil.sendMessageBtn')) + '</button>'
      + '</div></div>';
  }

  var sekmelerHtml = '<div class="profil-sekmeler">';
  if (opts.duzenlenebilir) {
    sekmelerHtml += '<button type="button" class="profil-sekme aktif" data-sekme="karakter" onclick="profilSekmeDegistir(\'karakter\')">' + escHtml(t('game.profil.characterTab')) + '</button>'
      + '<button type="button" class="profil-sekme" data-sekme="yetenekler" onclick="profilSekmeDegistir(\'yetenekler\')">Yetenekler</button>';
  } else {
    sekmelerHtml += '<span class="profil-sekme aktif">' + escHtml(t('game.profil.characterTab')) + '</span>';
  }
  sekmelerHtml += '</div>';

  var yeteneklerSekmeHtml = opts.duzenlenebilir
    ? '<div id="profilSekmeYetenekler" class="profil-kart gizli">' + profilYetenekleriPanelHTML(opts.yetenekler, opts.aktifMeslek) + '</div>'
    : '';

  return '<div class="profil-wrap" data-profil-user="' + escHtml(String(userId)) + '" data-profil-hedef-adi="' + escHtml(opts.oyuncuAdi || '') + '" data-profil-resmi="' + escHtml(opts.profilResmi || '') + '">'
    + sekmelerHtml
    + '<div id="profilSekmeKarakter" class="profil-kart">'
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
    + '</div>'
    + yeteneklerSekmeHtml
    + '</div>';
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
      + '<h3>' + escHtml(t('game.profil.selectPhoto')) + '</h3>'
      + '<p id="profilResimModalAciklama">' + escHtml(t('game.profil.selectPortrait')) + '</p>'
      + '<div class="profil-resim-sekmeler">'
      + '<button type="button" class="profil-resim-sekme aktif" data-sekme="kadin" onclick="profilResimSekmeDegistir(\'kadin\')">' + escHtml(t('game.profil.female')) + '</button>'
      + '<button type="button" class="profil-resim-sekme" data-sekme="erkek" onclick="profilResimSekmeDegistir(\'erkek\')">' + escHtml(t('game.profil.male')) + '</button>'
      + '</div>'
      + '<div id="profilResimGridKadin" class="profil-resim-grid"></div>'
      + '<div id="profilResimGridErkek" class="profil-resim-grid gizli"></div>'
      + '<button type="button" class="profil-resim-modal-kapat" onclick="profilResmiModalKapat()">' + escHtml(t('game.welcome.close')) + '</button>'
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
      toast(tr(data.error) || t('game.toast.profilePhotoSaveFailed'), 'hata');
      return;
    }
    oyuncuUygula(data.player);
    kayitliKey = (data.player && data.player.profilResmi) || key;
  } catch (_) {
    toast(t('game.toast.profilePhotoConnectionError'), 'hata');
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
  toast(t('game.toast.profilePhotoUpdated'), 'basari');
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function oyuncuLink(userId, isim) {
  if (!userId || !isim) return escHtml(isim || '—');
  return '<button type="button" class="oyuncu-link-btn" onclick="oyuncuProfilGoster(' + userId + ')">' + escHtml(isim) + '</button>';
}

function profilGrupSiraDetayHTML(grupSira, grup, grupId) {
  if (grupSira == null && !grup) return '—';
  var siraHtml = grupSira != null ? fmt(grupSira) : '—';
  if (!grup || !grupId) return siraHtml;
  return siraHtml + ' · ' + mafyaGrupLink(grupId, grup);
}

function profilGrupSiraDetayGuncelle(grupSira, grup, grupId) {
  var el = document.getElementById('profilGrupSiraDetay');
  if (el) el.innerHTML = profilGrupSiraDetayHTML(grupSira, grup, grupId);
}

function profilSirketDetayHTML(isDurumu, profilUserId) {
  if (!isDurumu) return '—';
  if (typeof isDurumu === 'string') return escHtml(isDurumu || '—');
  if (isDurumu.tip === 'yok') return '—';
  if (isDurumu.tip === 'npc') return escHtml(isDurumu.metin || '—');
  if (!isDurumu.sirketId || !isDurumu.sirketAdi) return escHtml(isDurumu.metin || '—');

  var turAd = escHtml(isDurumu.turAd || t('game.profil.company'));
  var sirketAd = escHtml(isDurumu.sirketAdi);
  var rol = escHtml(isDurumu.rolMetni || '');
  var kendiProfil = String(profilUserId || '') === String(window.__benimUserId || '');
  var sahipMi = isDurumu.tip === 'sahip';
  var tikFn = sahipMi && kendiProfil
    ? 'meslekSirketimAc()'
    : 'profilSirketDetayAc(' + isDurumu.sirketId + ')';
  var sirketLink = '<button type="button" class="oyuncu-link-btn" onclick="' + tikFn + '">' + sirketAd + '</button>';
  return turAd + ' · ' + sirketLink + ' ' + rol;
}

function profilSirketDetayGuncelle(isDurumu, profilUserId) {
  var el = document.getElementById('profilSirketDetay');
  if (el) el.innerHTML = profilSirketDetayHTML(isDurumu, profilUserId);
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

function gazeteLimanAdi(limanId, limanAdFallback) {
  if (limanId) {
    var key = 'game.liman.' + limanId + '.ad';
    var val = t(key);
    if (val !== key) return val;
  }
  var fromAd = gazeteLimanIdFromAd(limanAdFallback);
  if (fromAd) return gazeteLimanAdi(fromAd);
  return limanAdFallback || t('game.gazete.portLabel');
}

function gazeteLimanIdFromAd(ad) {
  var s = String(ad || '').toLowerCase();
  if (s.indexOf('istanbul') >= 0) return 'istanbul';
  if (s.indexOf('izmir') >= 0) return 'izmir';
  if (s.indexOf('hatay') >= 0) return 'hatay';
  return null;
}

function gazeteMakamAdi(ad) {
  if (ad === 'Sözünü Geçir') return t('screen.baba_soz');
  if (ad === 'Sadakat Yemini') return t('screen.baba_sadakat');
  return ad;
}

function gazeteAyEtiket(yil, ay) {
  var monthKey = 'game.month.' + (ay || 1);
  var monthName = t(monthKey);
  if (monthName === monthKey) monthName = String(ay || '');
  return monthName + ' ' + (yil || '');
}

function gazeteTarihUstLokal() {
  var lang = (typeof I18N !== 'undefined' && I18N.getLang) ? I18N.getLang() : 'tr';
  var locale = lang === 'tr' ? 'tr-TR' : (lang === 'de' ? 'de-DE' : 'en-US');
  var now = new Date();
  var tz = 'Europe/Istanbul';
  var tarih = now.toLocaleDateString(locale, { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' });
  var gun = now.toLocaleDateString(locale, { timeZone: tz, weekday: 'long' });
  var saat = now.toLocaleTimeString(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return (tarih + ', ' + gun + ', ' + saat).toUpperCase();
}

function gazeteMansetPortOzet(limanDurumu) {
  var istanbul = null;
  (limanDurumu || []).forEach(function(l) {
    if (l.limanId === 'istanbul') istanbul = l;
  });
  if (!istanbul) istanbul = (limanDurumu || [])[0];
  var sahipAd = istanbul && istanbul.sahipAdi;
  var sahipId = istanbul && istanbul.userId;
  if (!sahipAd) return t('game.gazete.manset.portTension');
  var idx = ((sahipId || 0) + Math.floor(Date.now() / 86400000)) % 3;
  return t('game.gazete.manset.liman' + idx, { name: sahipAd });
}

function gazeteMansetBaslikLokal(manset) {
  if (!manset) return { baslik: t('game.gazete.headlineDefault'), baslik2: null };
  if (manset.tip === 'devir' && manset.eskiHakim && manset.hukumdar) {
    return {
      baslik: t('game.gazete.manset.devirTitle', { old: manset.eskiHakim, new: manset.hukumdar }),
      baslik2: t('game.gazete.manset.devirTitle2', { name: manset.hukumdar })
    };
  }
  if (manset.tip === 'hukumdar' && manset.hukumdar) {
    return { baslik: t('game.gazete.manset.hukumdarTitle', { name: manset.hukumdar }), baslik2: null };
  }
  return { baslik: t('game.gazete.manset.vacuumTitle'), baslik2: null };
}

function gazeteMansetOzetLokal(manset, limanDurumu) {
  if (!manset) return '';
  if (manset.tip === 'belirsiz' && !manset.hukumdar) {
    return t('game.gazete.manset.vacuumSummary');
  }
  var portLine = gazeteMansetPortOzet(limanDurumu);
  if (manset.yeniDevir && manset.eskiHakim && manset.hukumdar) {
    return t('game.gazete.manset.devirSummary', { old: manset.eskiHakim, new: manset.hukumdar }) + ' ' + portLine;
  }
  return portLine;
}

function gazeteSampiyonLokal(s) {
  if (!s || !s.grupId) return { baslik: '', ozet: '', ticker: '' };
  var ayEtiket = s.ayEtiket;
  if (s.yil && s.ay) ayEtiket = gazeteAyEtiket(s.yil, s.ay);
  var guc = fmt(s.toplamGuc || 0);
  return {
    baslik: t('game.gazete.monthly.title', { month: ayEtiket }),
    ozet: t('game.gazete.monthly.summary', { name: s.isim, month: ayEtiket, power: guc }),
    ticker: t('game.gazete.monthly.ticker', {
      title: t('game.gazete.monthly.tickerTitle'),
      name: s.isim,
      month: ayEtiket,
      power: guc
    })
  };
}

function gazeteSirketTurAd(s) {
  if (s.turId) {
    var k = t('sirket.tur.' + s.turId);
    if (k !== 'sirket.tur.' + s.turId) return k;
  }
  return s.turAd || '';
}

function gazeteHaberCevir(metin) {
  if (!metin) return '';
  if (typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'tr') return String(metin);
  var s = String(metin).trim();
  var viaTr = tr(s);
  if (viaTr && viaTr !== s) return viaTr;
  var m;
  if ((m = s.match(/^Sokakların Tek Hakimi: (.+?) Hükmü Sürüyor!$/))) {
    return t('game.gazete.news.rulerContinues', { name: m[1] });
  }
  if ((m = s.match(/^Taht El Değiştirdi: (.+?)'in Saltanatı Sona Erdi, Yeni Devir (.+?) ile Başlıyor!$/))) {
    return t('game.gazete.news.throneChange', { old: m[1], new: m[2] });
  }
  if ((m = s.match(/^Şehrin Sokaklarında Yeni Bir İsim: (.+?) Zirveye Yerleşti!$/))) {
    return t('game.gazete.news.newRuler', { name: m[1] });
  }
  if ((m = s.match(/^(.+?),\s*(.+?)\s+mekanını\s+(.+?)'den aldı\.?$/))) {
    var limanId = gazeteLimanIdFromAd(m[2]);
    return t('game.gazete.news.portTaken', { winner: m[1], port: limanId ? gazeteLimanAdi(limanId) : m[2], loser: m[3] });
  }
  if ((m = s.match(/^(.+?),\s*(.+?)\s+mekanını ele geçirdi\.?$/))) {
    limanId = gazeteLimanIdFromAd(m[2]);
    return t('game.gazete.news.portCaptured', { winner: m[1], port: limanId ? gazeteLimanAdi(limanId) : m[2] });
  }
  if ((m = s.match(/^(.+?),\s*(.+?)\s+makamını\s+(.+?)'den aldı\.?$/))) {
    return t('game.gazete.news.seatTaken', { winner: m[1], seat: gazeteMakamAdi(m[2]), loser: m[3] });
  }
  if ((m = s.match(/^(.+?),\s*(.+?)\s+makamını ele geçirdi\.?$/))) {
    return t('game.gazete.news.seatCaptured', { winner: m[1], seat: gazeteMakamAdi(m[2]) });
  }
  if ((m = s.match(/^\[(.+?)\] Mafya Gr[uü]bu, \[(.+?)\] Mafya Gr[uü]buna savaş açtı\./))) {
    return t('game.gazete.news.mafiaWarDeclared', { attacker: m[1], defender: m[2] });
  }
  if ((m = s.match(/^\[(.+?)\], \[(.+?)\]'a sahayı dar etti\./))) {
    return t('game.gazete.news.mafiaWarWinAttacker', { winner: m[1], loser: m[2] });
  }
  if ((m = s.match(/^\[(.+?)\], gölgesi kendinden büyük işlere kalkışmanın bedelini ödedi\. \[(.+?)\], rakibine geçit vermedi\./))) {
    return t('game.gazete.news.mafiaWarWinDefender', { attacker: m[1], defender: m[2] });
  }
  if ((m = s.match(/^AYIN EN GÜÇLÜ MAFYA GRUBU: \[(.+?)\] — (.+?) döneminde şehrin en güçlü ailesi seçildi\. \(Toplam Güç: (.+?)\)$/))) {
    return t('game.gazete.monthly.ticker', {
      title: t('game.gazete.monthly.tickerTitle'),
      name: m[1],
      month: m[2],
      power: m[3]
    });
  }
  if ((m = s.match(/^(.+?) oyuncusu (.+?) Sabotaja Uğradı\.$/))) {
    return t('game.gazete.news.sabotajVictim', { victim: m[1], category: m[2] });
  }
  if ((m = s.match(/^(.+?), (.+?)'e karşı BAŞARISIZ bir sabotaj gerçekleştirdi\.$/))) {
    return t('game.gazete.news.sabotajFail', { attacker: m[1], target: m[2] });
  }
  if ((m = s.match(/^(.+?) - (.+?) ye karşı BAŞARISIZ bir sabotaj gerçekleştirdi\.$/))) {
    return t('game.gazete.news.sabotajFail', { attacker: m[1], target: m[2] });
  }
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
    ? fmt(r.miktar || 0) + t('game.gazete.respectUnit')
    : '+ ' + fmt(r.miktar || 0);
  var avatarUrl = profilResmiUrl(r.userId, r.profilResmi);
  var avatarCls = profilResmiOzelMi(avatarUrl) ? ' gazete-avatar-img--ozel' : '';
  return '<div class="gazete-lider-satir' + (i === 0 ? ' gazete-lider-satir--bir' : '') + '">'
    + '<span class="gazete-sira">' + crown + (i + 1) + '</span>'
    + '<span class="gazete-avatar"><img class="gazete-avatar-img' + avatarCls + '" src="' + escHtml(avatarUrl) + '" alt="" loading="lazy" onerror="imgFallback(this)"></span>'
    + '<span class="gazete-isim">' + oyuncuLink(r.userId, r.isim) + '</span>'
    + '<span class="gazete-artis">' + artis + ' <span class="gazete-yukari">▲</span></span></div>';
}

function gazeteGereksinimMetin(gereksinim) {
  if (!gereksinim) return '—';
  var etiket = { guc: t('game.profil.skill.guc'), zeka: t('game.profil.skill.zeka'), dayaniklilik: t('game.profil.skill.dayaniklilik'), beceri: t('game.profil.skill.beceri') };
  return Object.keys(gereksinim).map(function(k) {
    return (etiket[k] || k) + ' ' + gereksinim[k];
  }).join(' · ');
}

function gazeteIsIlanlariHTML(isIlanlari) {
  isIlanlari = isIlanlari || {};
  var ilanlar = isIlanlari.ilanlar || [];
  var html = '';
  if (isIlanlari.sahipSirket && !isIlanlari.sahipSirket.iseAlimAcik) {
    html += '<div class="gazete-is-patron-cta">';
    html += '<strong>👔 ' + escHtml(isIlanlari.sahipSirket.isim) + '</strong> — ' + escHtml(t('game.gazete.jobClosed'));
    html += ' <button type="button" class="gazete-is-patron-btn" onclick="meslekSirketimAc()">' + escHtml(t('game.gazete.postJob')) + '</button>';
    html += '</div>';
  }
  if (!ilanlar.length) {
    html += '<p class="gazete-bos">' + t('game.gazete.noJobListings') + '</p>';
    return html;
  }
  if (isIlanlari.engelNedeni) {
    html += '<p class="gazete-is-uyari">' + escHtml(tr(isIlanlari.engelNedeni)) + '</p>';
  }
  ilanlar.forEach(function(s) {
    var basvuruGoster = !s.benimSirketim && !s.kadroDolu && isIlanlari.basvuruYapabilir;
    var sirketAdBtn;
    if (s.benimSirketim) {
      sirketAdBtn = '<button type="button" class="gazete-is-sirket-btn" onclick="meslekSirketimAc()">' + escHtml(s.isim) + '</button>';
    } else if (basvuruGoster) {
      sirketAdBtn = '<button type="button" class="gazete-is-sirket-btn" onclick="gazeteIsKartToggle(' + s.id + ')">' + escHtml(s.isim) + '</button>';
    } else {
      sirketAdBtn = '<strong class="gazete-is-sirket-ad">' + escHtml(s.isim) + '</strong>';
    }
    html += '<article class="gazete-is-kart" id="gazeteIsKart_' + s.id + '">';
    html += '<header class="gazete-is-kart-bas">';
    html += '<span class="gazete-is-emoji" aria-hidden="true">' + escHtml(s.turEmoji || '🏢') + '</span>';
    html += '<div class="gazete-is-kart-ozet">';
    html += sirketAdBtn;
    html += '<span class="gazete-is-meta">' + escHtml(gazeteSirketTurAd(s))
      + ' · ' + escHtml(t('game.gazete.bossLabel')) + ' ' + oyuncuLink(s.sahipUserId, s.sahipAdi)
      + ' · ' + s.calisanSayisi + '/' + s.maxCalisan + escHtml(t('game.gazete.workerLabel')) + '</span>';
    if (s.aciklama) html += '<p class="gazete-is-aciklama">' + escHtml(s.aciklama) + '</p>';
    if (basvuruGoster) {
      html += '<span class="gazete-is-tikla-not">' + escHtml(t('game.gazete.clickToApply')) + '</span>';
    }
    html += '</div></header>';
    if (s.kadroDolu) {
      html += '<p class="gazete-is-durum">' + escHtml(t('game.gazete.rosterFull')) + '</p>';
    } else if (!s.benimSirketim && !isIlanlari.basvuruYapabilir) {
      html += '<p class="gazete-is-durum">' + escHtml(tr(isIlanlari.engelNedeni) || t('game.gazete.cannotApply')) + '</p>';
    } else if (basvuruGoster) {
      html += '<div class="gazete-is-pozisyonlar" id="gazeteIsPoz_' + s.id + '">';
      (s.pozisyonlar || []).forEach(function(p) {
        var pozIdEsc = String(p.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += '<div class="gazete-is-poz' + (p.uygun ? '' : ' gazete-is-poz--kapali') + '">';
        html += '<div class="gazete-is-poz-bas"><strong>' + escHtml(p.unvan) + '</strong>';
        html += '<span class="gazete-is-maas">' + fmt(p.varsayilanMaas) + escHtml(t('game.gazete.perDay')) + '</span></div>';
        html += '<span class="gazete-is-gereksinim">' + escHtml(gazeteGereksinimMetin(p.gereksinim)) + '</span>';
        if (p.basvuruYapildi) {
          html += '<span class="gazete-is-etiket-basvuru">' + escHtml(t('game.gazete.applied')) + '</span>';
        } else if (s.basvuruYapildi) {
          html += '<span class="gazete-is-etiket-basvuru">' + escHtml(t('game.gazete.applied')) + '</span>';
        } else if (p.uygun) {
          html += '<button type="button" class="gazete-is-btn" onclick="gazeteIsBasvur('
            + s.id + ',\'' + pozIdEsc + '\')">' + escHtml(t('game.gazete.apply')) + '</button>';
        } else {
          html += '<span class="gazete-is-etiket-yetersiz">' + escHtml(t('game.gazete.insufficientSkill')) + '</span>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</article>';
  });
  return html;
}

async function gazeteIsBasvur(sirketId, pozisyonId) {
  var ef = await sunucuAksiyon('sirket_basvur', null, null, { sirketId: sirketId, pozisyonId: pozisyonId });
  if (ef === null) return;
  toast(tr(ef.mesaj) || t('game.toast.applicationSent'), 'basari');
  var ic = document.getElementById('anaIcerik');
  if (ic && aktifEkran === 'gazete') gazeteEkranCiz(ic);
}

function gazeteIsKartToggle(sirketId) {
  var kart = document.getElementById('gazeteIsKart_' + sirketId);
  if (!kart) return;
  var acik = kart.classList.toggle('gazete-is-kart--acik');
  if (acik) {
    var poz = document.getElementById('gazeteIsPoz_' + sirketId);
    if (poz) poz.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
window.gazeteIsBasvur = gazeteIsBasvur;
window.gazeteIsKartToggle = gazeteIsKartToggle;

async function gazeteEkranCiz(ic) {
  ic.innerHTML = '<div class="gazete-wrap"><p class="gazete-yukleniyor">' + escHtml(t('game.loadingNewspaper')) + '</p></div>';
  try {
    var res = await apiFetch('/api/gazete');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || t('game.error.loadFailed'));

    yeniGazeteHaber = false;
    gazeteMenuYanip();
    apiFetch('/api/gazete/okundu', { method: 'POST', body: {} }).catch(function() {});

    var oyuncular = gazeteOyuncuListesi(data);
    var sampiyon = data.aylikMafyaSampiyon;
    var sampiyonLokal = gazeteSampiyonLokal(sampiyon);
    var tickerItems = (data.sonDakika || []).map(function(item) {
      return '<span>' + metindeIsimLinkleri(gazeteHaberCevir(item), oyuncular) + '</span>';
    });
    if (sampiyon && sampiyon.grupId) {
      tickerItems.unshift('<span>🏆 ' + escHtml(sampiyonLokal.baslik) + ': ' + mafyaGrupLink(sampiyon.grupId, sampiyon.isim) + '</span>');
    }
    var tickerInner = tickerItems.join('<span class="gazete-ticker-dot"> • </span>');
    if (!tickerInner) tickerInner = '<span>' + escHtml(t('game.gazete.tickerSilent')) + '</span>';
    var ticker = '<div class="gazete-ticker-ic">' + tickerInner + '<span class="gazete-ticker-dot"> • </span>' + tickerInner + '</div>';

    var liderHtml = '';
    (data.sayginlikLiderleri || []).forEach(function(r, i) {
      liderHtml += gazeteLiderSatir(r, i);
    });
    if (!liderHtml) liderHtml = '<p class="gazete-bos">' + escHtml(t('game.empty.noData')) + '</p>';

    var efsaneHtml = '';
    (data.efsaneler24 || []).forEach(function(r, i) {
      var etiket = r.fallback
        ? fmt(r.miktar || 0) + t('game.gazete.respectUnit')
        : '+' + fmt(r.miktar || 0) + t('game.gazete.respectGain');
      efsaneHtml += '<p class="gazete-efsane-satir"><b>' + (i + 1) + '.</b> '
        + oyuncuLink(r.userId, r.isim)
        + ' <span class="gazete-yesil">(' + etiket + ')</span></p>';
    });
    if (!efsaneHtml) efsaneHtml = '<p class="gazete-bos">' + escHtml(t('game.empty.noLegends')) + '</p>';

    var manseHtml = '';
    (data.yeraltiManse || []).forEach(function(h) {
      manseHtml += '<p><b class="gazete-yazar">' + oyuncuLink(h.userId, h.yazar) + ':</b> '
        + metindeIsimLinkleri(h.metin, oyuncular) + '</p>';
    });
    if (!manseHtml) manseHtml = '<p class="gazete-bos">' + escHtml(t('game.gazete.noPrivateAds')) + '</p>';

    var isIlanlariHtml = gazeteIsIlanlariHTML(data.isIlanlari);

    var hakimiyetHtml = '';
    (data.hakimiyetSatirlari || []).forEach(function(h) {
      if (h.tip === 'hukumdar') {
        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.rulerFull') + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.rulerFullSuffix')) + '</p>';
      } else if (h.tip === 'bos') {
        hakimiyetHtml += '<p class="gazete-hakim-satir">' + escHtml(t('game.gazete.dominanceVacuum')) + '</p>';
      } else if (h.tip === 'liman' && h.userId) {
        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(gazeteLimanAdi(h.limanId, h.limanAd)) + ': ' + oyuncuLink(h.userId, h.oyuncuAdi) + escHtml(t('game.gazete.controlledBy')) + '</p>';
      } else if (h.tip === 'liman_bos') {
        hakimiyetHtml += '<p class="gazete-hakim-satir">⚓ ' + escHtml(gazeteLimanAdi(h.limanId, h.limanAd)) + escHtml(t('game.gazete.portUnowned')) + '</p>';
      } else if (h.tip === 'kontrol') {
        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.portControlled') + oyuncuLink(h.userId, h.oyuncuAdi) + t('game.gazete.portRules') + '</p>';
      } else if (h.tip === 'degisim' && h.kazananAdi) {
        hakimiyetHtml += '<p class="gazete-hakim-satir">' + t('game.gazete.balanceChanged') + oyuncuLink(h.kazananUserId, h.kazananAdi);
        if (h.kaybedenAdi) {
          hakimiyetHtml += t('game.gazete.tookBack') + oyuncuLink(h.kaybedenUserId, h.kaybedenAdi) + t('game.gazete.tookBackSuffix');
        } else {
          hakimiyetHtml += t('game.gazete.showedForce');
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
    var mansetBasliklar = gazeteMansetBaslikLokal(manset);
    var mansetImg = isGorselleri.liman_istanbul || FALLBACK;
    var mansetOzet = metindeIsimLinkleri(gazeteMansetOzetLokal(manset, data.limanDurumu), oyuncular);
    var mansetBaslikHtml = '<h2 class="gazete-manset-baslik">' + metindeIsimLinkleri(mansetBasliklar.baslik, oyuncular) + '</h2>';
    if (mansetBasliklar.baslik2) {
      mansetBaslikHtml += '<h2 class="gazete-manset-baslik gazete-manset-baslik-2">'
        + metindeIsimLinkleri(mansetBasliklar.baslik2, oyuncular) + '</h2>';
    }

    var sampiyonHtml = '';
    if (sampiyon && sampiyon.grupId) {
      sampiyonHtml = '<section class="gazete-aylik-sampiyon">'
        + '<div class="gazete-aylik-sampiyon-rozet" aria-hidden="true">'
        + '<img class="gazete-aylik-sampiyon-kupa" src="' + GAZETE_AYLIK_KUPA + '" alt="" loading="lazy" onerror="imgFallback(this)">'
        + '</div>'
        + '<div class="gazete-aylik-sampiyon-icerik">'
        + '<span class="gazete-aylik-sampiyon-etiket">' + escHtml(t('game.gazete.monthlyReport')) + '</span>'
        + '<h3 class="gazete-aylik-sampiyon-baslik">' + escHtml(sampiyonLokal.baslik) + '</h3>'
        + '<p class="gazete-aylik-sampiyon-grup">' + mafyaGrupLink(sampiyon.grupId, sampiyon.isim) + '</p>'
        + '<p class="gazete-aylik-sampiyon-ozet">' + metindeIsimLinkleri(sampiyonLokal.ozet, oyuncular) + '</p>'
        + '</div></section>';
    }

    if (aktifEkran !== 'gazete') return;
    ic.innerHTML = '<div class="gazete-wrap">'
      + '<div class="gazete-hero">'
      + '<div class="gazete-hero-ic">'
      + '<div class="gazete-hero-ust">'
      + '<div class="gazete-tarih gazete-tarih-sol">' + escHtml(gazeteTarihUstLokal()) + '</div>'
      + '<p class="gazete-alinti-ust"><em>' + escHtml(t('game.gazete.quote')) + '</em></p>'
      + '</div>'
      + '<div class="gazete-hero-orta">'
      + '<h1 class="gazete-ana-baslik">' + escHtml(t('game.gazete.heroTitle')) + '</h1>'
      + '<p class="gazete-alt-baslik">' + escHtml(t('game.gazete.subtitle')) + '</p>'
      + '</div></div></div>'
      + '<div class="gazete-ticker">'
      + '<span class="gazete-ticker-etiket">' + escHtml(t('game.gazete.breaking')) + '</span>'
      + '<div class="gazete-ticker-kaydir">' + ticker + '</div></div>'
      + sampiyonHtml
      + '<div class="gazete-govde">'
      + '<article class="gazete-manset">'
      + '<div class="gazete-manset-sol">'
      + '<span class="gazete-etiket">' + escHtml(t('game.gazete.mafiaHeadline')) + '</span>'
      + mansetBaslikHtml
      + '<p class="gazete-manset-metin">' + mansetOzet + '</p>'
      + '<span class="gazete-devam">' + t('game.gazete.readMore') + '</span>'
      + '</div>'
      + '<div class="gazete-manset-sag">'
      + '<img src="' + mansetImg + '" class="gazete-manset-img" alt="' + escHtml(t('game.gazete.headlineAlt')) + '" onerror="imgFallback(this)">'
      + '</div></article>'
      + '<aside class="gazete-yan">'
      + '<h3 class="gazete-yan-baslik">' + escHtml(t('game.gazete.topRespect')) + '</h3>'
      + liderHtml
      + '</aside></div>'
      + '<section class="gazete-is-ilanlari">'
      + '<h3 class="gazete-is-ilanlari-baslik">' + escHtml(t('game.gazete.jobListings')) + '</h3>'
      + '<p class="gazete-is-ilanlari-not">' + escHtml(t('game.gazete.jobListingsNote')) + '</p>'
      + isIlanlariHtml
      + '</section>'
      + '<div class="gazete-alt-uc">'
      + '<div class="gazete-kutu"><h4>' + escHtml(t('game.gazete.dominance')) + '</h4>' + hakimiyetHtml + '</div>'
      + '<div class="gazete-kutu gazete-kutu-kirmizi"><h4>' + t('game.gazete.undergroundHeadlines') + '</h4>' + manseHtml + '</div>'
      + '<div class="gazete-kutu"><h4>' + escHtml(t('game.gazete.legends24h')) + '</h4>' + efsaneHtml + '</div>'
      + '</div>'
      + '<div class="gazete-dekor" aria-hidden="true"></div>'
      + '</div>';
  } catch (e) {
    if (aktifEkran === 'gazete') {
      ic.innerHTML = '<h2>' + escHtml(t('game.gazete.title')) + '</h2><p style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p>';
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
function masterFramePlaqueGuncelle(tip, altBaslik) {
  var el = document.getElementById('masterFramePlaque');
  if (!el) return;
  if (altBaslik) {
    el.textContent = altBaslik;
    return;
  }
  if (tip && String(tip).indexOf('mafya_') === 0) {
    var mod = String(tip).replace('mafya_', '');
    el.textContent = typeof mafyaTitle === 'function' ? mafyaTitle(mod) : t('screen.mafya');
    return;
  }
  if (typeof screenTitle === 'function') {
    el.textContent = screenTitle(tip);
    return;
  }
  if (typeof I18n !== 'undefined' && I18n.screenTitle) {
    el.textContent = I18n.screenTitle(tip);
    return;
  }
  el.textContent = String(tip || '').replace(/_/g, ' ').toUpperCase();
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
  aktiviteBildir(tip, 'ekran_goruntule');
  masterFramePlaqueGuncelle(tip);
  sehirBannerGuncelle();
  sidebarMenuAktif(tip);
  var ic = document.getElementById('anaIcerik');
  if (tip === 'liderlik') {
    ic.innerHTML = '<p style="color:#888;text-align:center;">' + escHtml(t('game.loading')) + '</p>';
    liderlikTablosuCiz(ic);
    return;
  }

  if (tip === 'profilim') {
    profilAktifSekme = 'karakter';
    profilZiyaretOkundu();
    ic.innerHTML = profilEkranSablonu({
      duzenlenebilir: true,
      userId: window.__benimUserId || 'me',
      profilResmi: oyuncuProfilResmi,
      oyuncuAdi: aktifReisAdi,
      lakap: aktifLakap,
      guc: oyuncuGuc,
      bonusGuc: oyuncuBonusGuc,
      toplamGuc: oyuncuToplamGuc,
      puan: oyuncuPuan,
      saatlik: saatlikKazanc,
      karaListede: karaListede,
      sehirEfsane: sehirEfsane,
      yetenekler: oyuncuYetenekler,
      aktifMeslek: oyuncuAktifMeslek,
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

  if (tip === 'turkiyeSefirlik') {
    ic.innerHTML = sefirlikHTML();
    sefirlikYukle();
    return;
  }

  if (tip === 'meslekler') {
    if (!ic) return;
    if (typeof meslekHTML !== 'function') {
      ic.innerHTML = '<p style="color:#f08080;text-align:center;padding:24px;">' + escHtml(t('game.loadingModuleFailed')) + '</p>';
      return;
    }
    ic.innerHTML = meslekHTML();
    meslekYukle();
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

  if (tip === 'sektor_yeralti') { sektorEkranCiz(ic, 'yeralti', t('screen.sektor_yeralti')); return; }
  if (tip === 'sektor_silah') { sektorEkranCiz(ic, 'silah', t('screen.sektor_silah')); return; }
  if (tip === 'sektor_paket') { sektorEkranCiz(ic, 'paket', t('screen.sektor_paket')); return; }

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
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.mahalleTitle')) + '</h2><p>' + escHtml(t('game.buyume.mahalleQuote')) + '</p>'
      + buyumeIsKart('market', 'market', '+800 TL', '1', '300')
      + buyumeIsKart('tamirhane', 'tamirhane', '+1.450 TL', '1', '600')
      + buyumeIsKart('esnafa_guvence', 'koruma', '+2.700 TL', '2', '1.200')
      + buyumeIsKart('zar_salonu', 'kumarhane', '+4.300 TL', '2', '2.500');
    return;
  }

  if (tip === 'semt') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.semtTitle')) + '</h2><p>' + escHtml(t('game.buyume.semtQuote')) + '</p>'
      + buyumeIsKart('gece_kulubu', 'gece_kulubu', '+11.500 TL', '3', '6.000')
      + buyumeIsKart('kumarhane_agi', 'kumarhane_agi', '+17.000 TL', '3', '8.000')
      + buyumeIsKart('kara_para', 'kara_para', '+24.000 TL', '4', '10.000')
      + buyumeIsKart('semt_galeri', 'galeri', '+30.000 TL', '4', '12.000');
    return;
  }

  if (tip === 'sehir') {
    ic.innerHTML = '<h2>' + escHtml(t('game.buyume.sehirTitle')) + '</h2><p>' + escHtml(t('game.buyume.sehirQuote')) + '</p>'
      + buyumeIsKart('lojistik', 'lojistik', '+43.000 TL', '5', '15.000')
      + buyumeIsKart('gumruk', 'gumruk', '+76.000 TL', '6', '25.000')
      + buyumeIsKart('belediye', 'belediye', '+115.000 TL', '8', '40.000')
      + buyumeIsKart('buyuk_holding', 'holding', '+190.000 TL', '10', '55.000');
    return;
  }

  if (tip === 'liman') {
    ic.innerHTML = '<h2>' + escHtml(t('game.sehre.portsTitle')) + '</h2>'
      + '<p>' + escHtml(t('game.liman.quote')) + '</p>'
      + HUKUM_SAVUNMA_NOTU
      + '<p class="liman-gelir-notu">' + t('game.liman.incomeNote') + '</p>'
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

  if (tip === 'sabotaj') {
    if (typeof sabotajEkranAc === 'function') {
      sabotajEkranAc(ic);
    } else {
      ic.innerHTML = '<p style="color:#c66;">' + escHtml(t('game.error.loadFailed')) + '</p>';
    }
    return;
  }

  if (tip === 'borsa') {
    if (typeof borsaEkranAc === 'function') {
      borsaEkranAc(ic);
    } else {
      ic.innerHTML = '<p style="color:#c66;">' + escHtml(t('game.error.loadFailed')) + '</p>';
    }
    return;
  }

  if (tip === 'kumarhane') {
    if (typeof kumarhaneEkranAc === 'function') {
      kumarhaneEkranAc(ic);
    } else {
      ic.innerHTML = '<p style="color:#c66;">' + escHtml(t('game.error.loadFailed')) + '</p>';
    }
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
  ic.innerHTML = '<div class="st-sayfa"><div class="st-cerceve"><div class="st-banner">'
    + '<div class="st-banner-ikon" aria-hidden="true">📜</div>'
    + '<h2>' + escHtml(t('screen.sehirTarihi')) + '</h2>'
    + '<p class="st-banner-alt">' + escHtml(t('game.history.subtitle')) + '</p>'
    + '</div><div class="st-govde"><p class="st-bos">' + escHtml(t('game.loading')) + '</p></div></div></div>';
  if (!sunucuBagli) {
    ic.innerHTML = '<div class="st-sayfa"><div class="st-cerceve"><div class="st-govde"><p class="st-bos" style="color:#c66;">'
      + escHtml(t('game.error.serverOffline')) + '</p></div></div></div>';
    return;
  }
  try {
    var res = await apiFetch('/api/sehir-tarihi');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || t('game.error.loadFailed'));
    var liste = data.liste || [];
    var html = '<div class="st-sayfa"><div class="st-cerceve">'
      + '<div class="st-banner">'
      + '<div class="st-banner-ikon" aria-hidden="true">📜</div>'
      + '<h2>' + escHtml(t('screen.sehirTarihi')) + '</h2>'
      + '<p class="st-banner-alt">' + escHtml(t('game.history.subtitle')) + '</p>'
      + '</div><div class="st-govde">'
      + '<p class="st-baslik-satir">' + escHtml(t('game.history.rulersHeading')) + '</p>';
    if (!liste.length) {
      html += '<p class="st-bos">' + escHtml(t('game.empty.noRulers')) + '</p>';
    } else {
      html += '<div class="st-zaman-cizgi">';
      liste.forEach(function(k) {
        var gun = hukumGunSayisi(k.baslangic, k.bitis, k.aktif);
        if (!gun && k.gunSayisi > 0) gun = k.gunSayisi;
        var gunTxt = gun + t('game.daysUnit');
        var isimHtml = k.userId ? oyuncuLink(k.userId, k.hukumdarAdi) : escHtml(k.hukumdarAdi);
        var cls = 'st-donem' + (k.aktif ? ' st-donem--aktif' : '');
        html += '<article class="' + cls + '">'
          + '<span class="st-donem-nokta" aria-hidden="true"></span>'
          + '<div class="st-donem-ana">'
          + '<span class="st-donem-isim">' + isimHtml + '</span>'
          + '<span class="st-donem-ok" aria-hidden="true">→</span>'
          + '<span class="st-donem-gun">' + escHtml(gunTxt) + '</span>';
        if (k.aktif) {
          html += '<span class="st-donem-rozet">' + escHtml(t('game.history.activeBadge')) + '</span>';
        }
        html += '</div><div class="st-donem-detay">';
        if (k.oncekiReisAdi) {
          var oncekiHtml = k.oncekiReisUserId ? oyuncuLink(k.oncekiReisUserId, k.oncekiReisAdi) : escHtml(k.oncekiReisAdi);
          html += '<span>' + escHtml(t('game.history.tookFrom')) + ' <b>' + oncekiHtml + '</b></span>';
        } else {
          html += '<span>' + escHtml(t('game.history.tookFrom')) + ' <b>—</b></span>';
        }
        if (k.aktif) {
          html += '<span>' + escHtml(t('game.history.lostTo')) + ' <b>' + escHtml(t('game.history.stillRuling')) + '</b></span>';
        } else if (k.yeniReisAdi) {
          var yeniHtml = k.yeniReisUserId ? oyuncuLink(k.yeniReisUserId, k.yeniReisAdi) : escHtml(k.yeniReisAdi);
          html += '<span>' + escHtml(t('game.history.lostTo')) + ' <b>' + yeniHtml + '</b></span>';
        } else {
          html += '<span>' + escHtml(t('game.history.lostTo')) + ' <b>—</b></span>';
        }
        html += '</div>'
          + '<p class="st-donem-tarih">' + escHtml(k.baslangicMetin || profilTrTarih(k.baslangic));
        if (k.bitisMetin || k.bitis) {
          html += ' — ' + escHtml(k.bitisMetin || profilTrTarih(k.bitis));
        }
        html += '</p></article>';
      });
      html += '</div>';
    }
    html += '</div></div></div>';
    ic.innerHTML = html;
  } catch (e) {
    ic.innerHTML = '<div class="st-sayfa"><div class="st-cerceve"><div class="st-govde"><p class="st-bos" style="color:#c66;">'
      + escHtml(e.message || t('game.error.loadFailed')) + '</p></div></div></div>';
  }
}

function karaListeSayfaHTML() {
  return '<div class="kl-sayfa"><div class="kl-cerceve">'
    + '<div class="kl-banner"><div class="kl-banner-ortu"></div>'
    + '<div class="kl-baslik-wrap">'
    + '<span class="kl-baslik-ikon" aria-hidden="true">💀</span>'
    + '<h2>' + escHtml(t('game.blacklist.title')) + '</h2>'
    + '<p class="kl-motto">' + escHtml(t('game.blacklist.motto')) + '</p>'
    + '</div></div>'
    + '<div class="kl-govde">'
    + '<div class="kl-hukumdar-kutu">'
    + t('game.blacklist.rulerLine')
    + '</div>'
    + '<p class="kl-aciklama">' + escHtml(t('game.blacklist.note')) + '</p>'
    + '<div class="kl-tablo-wrap">'
    + '<div class="kl-tablo-baslik"><span>' + escHtml(t('game.blacklist.colPlayer')) + '</span><span>' + escHtml(t('game.blacklist.colGroup')) + '</span><span>' + escHtml(t('game.blacklist.colRespect')) + '</span></div>'
    + '<div id="klListe" class="kl-tablo-govde"><p class="kl-yukleniyor">' + escHtml(t('game.loading')) + '</p></div>'
    + '</div></div></div></div>';
}

function klGrupLinkHtml(grup, grupId) {
  return ltGrupLinkHtml(grup, grupId, null);
}

function karaListeSatirlariHTML(liste) {
  if (!liste.length) {
    return '<p class="kl-bos">' + escHtml(t('game.blacklist.empty')) + '</p>';
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
    if (kapaliEl) kapaliEl.innerHTML = '<p class="kl-hata">' + escHtml(t('game.error.serverOffline')) + '</p>';
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
    if (hataEl) hataEl.innerHTML = '<p class="kl-hata">' + escHtml(e.message || t('game.error.loadFailed')) + '</p>';
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
  toast(t('game.toast.purchaseSuccess', { title: ef.unvan, count: ef.adet > 1 ? ' x' + ef.adet : '', power: fmt(ef.guc) }), 'basari');
  if (aktifEkran === 'korumaEkibi' || aktifEkran === 'silahlan' || aktifEkran === 'luksYasam') {
    ekranDegistir(aktifEkran);
  }
}

async function isYap(key) {
  var ef = await sunucuAksiyon('job', key);
  if (!ef) return;
  pencereAc(ef.isAdi, ef.netKazanc, ef.icraat, isGorselleri[ef.gorselKey] || FALLBACK, ef.devletDusus, ef.yeniDevletIliski);
  if (ef.devletDusus) {
    toast(t('game.toast.lawyerRelationDrop', { points: ef.devletDusus }), 'uyari');
  }
}

async function limanCok(id) {
  var lim = limanBul(id);
  if (lim.sahipAdi === aktifReisAdi) {
    toast(t('game.toast.portAlreadyYoursBoss'), 'altin');
    return;
  }
  var ef = await sunucuAksiyon('liman_cok', id);
  if (ef === null) return;
  sesCal('saldiri');
  toast(tr(ef && ef.mesaj) || t('game.toast.portCaptured'), 'basari');
  ekranDegistir('liman');
}

async function babaCok(makam) {
  var ef = await sunucuAksiyon('baba_cok', makam);
  if (!ef) return;
  sesCal('saldiri');
  toast(tr(ef.mesaj), 'basari');
  ekranDegistir(makam === 'sadakat_yemini' ? 'baba_sadakat' : 'baba_soz');
}

async function babaDerkiKaydet(makam) {
  var el = document.getElementById('babaDerki-' + makam);
  var ef = await sunucuAksiyon('baba_derki', makam, null, { metin: el ? el.value : '' });
  if (ef) toast(t('game.toast.bossWordSaved'), 'basari');
}

async function sadakatOy(oy) {
  var ef = await sunucuAksiyon('sadakat_oy', oy);
  if (ef) {
    toast(oy === 'tani' ? t('game.toast.loyaltySworn') : t('game.toast.loyaltyRejected'), 'basari');
    ekranDegistir('baba_sadakat');
  }
}

async function dusmanaSaldir(hedefAdi) {
  var hedef = document.getElementById('dusmanHedef');
  var ad = hedefAdi || (hedef && hedef.value.trim()) || (dusmanBulunanHedef && dusmanBulunanHedef.reisAdi) || '';
  if (!ad) {
    toast(t('game.toast.searchEnemyFirst'), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('dusmana_cok', null, null, { hedef: ad });
  if (ef === null) return;
  sesCal('saldiri');
  var box = document.getElementById('dusmanSonuc');
  if (box && ef.mesaj) {
    box.innerHTML = '<div class="saldiri-sonuc"></div>';
    box.firstChild.textContent = tr(ef.mesaj);
  } else {
    toast(tr(ef.mesaj) || t('game.toast.attackComplete'), ef.kazandi ? 'basari' : 'hata');
  }
  dusmanBulunanHedef = null;
}

async function istihbaratAl() {
  var ef = await sunucuAksiyon('istihbarat_al', null, adetOku('istihbarat'));
  if (ef === null) return;
  toast(t('game.toast.agentsHired', { count: ef.elemanSayisi, amount: fmt(ef.odenen) }), 'basari');
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
    toast(t('game.toast.enterTarget'), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('istihbarat_spy', null, null, { hedef });
  if (ef === null) return;
  if (ef.basari) {
    if (ef.guc !== null) {
      istihbaratSonucGoster(
        escHtml(tr(ef.mesaj)) + '<span class="istih-sonuc-guc">⚔️ ' + escHtml(t('game.profil.power')) + ': ' + fmt(ef.guc) + '</span>',
        'basari'
      );
    } else {
      istihbaratSonucGoster(escHtml(tr(ef.mesaj)), 'uyari');
    }
  } else {
    istihbaratSonucGoster(escHtml(tr(ef.mesaj)), 'hata');
  }
}

async function bankaYatir() {
  var miktar = bankaMiktarOku('bankaYatirMiktar');
  if (miktar < 1) {
    toast(t('game.toast.invalidAmount'), 'hata');
    return;
  }
  var btn = document.getElementById('bankaYatirBtn');
  if (btn) btn.disabled = true;
  var ef = await sunucuAksiyon('banka_yatir', null, null, { miktar: miktar });
  if (btn) btn.disabled = false;
  if (ef === null) return;
  sesCal('para');
  toast(t('game.toast.deposited', { amount: fmt(ef.yatirilan), total: fmt(ef.toplam) }), 'basari');
  ekranDegistir('banka');
}

async function bankaCek() {
  var miktar = bankaMiktarOku('bankaCekMiktar');
  if (miktar < 1) {
    toast(t('game.toast.invalidAmount'), 'hata');
    return;
  }
  var btn = document.getElementById('bankaCekBtn');
  if (btn) btn.disabled = true;
  var ef = await sunucuAksiyon('banka_cek', null, null, { miktar: miktar });
  if (btn) btn.disabled = false;
  if (ef === null) return;
  sesCal('para');
  toast(t('game.toast.withdrawn', { amount: fmt(ef.cekilen) }), 'basari');
  ekranDegistir('banka');
}

async function mekanDevret() {
  var hedef = (document.getElementById('mekanDevriHedef') || {}).value.trim();
  var sk = (document.getElementById('mekanDevriMekan') || {}).value;
  var adet = parseInt((document.getElementById('mekanDevriAdet') || {}).value, 10) || 1;
  if (!hedef) { toast(t('game.toast.enterAllyBoss'), 'hata'); return; }
  if (!sk) { toast(t('game.toast.selectVenue'), 'hata'); return; }
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
    sonucDiv.innerHTML = '✅ ' + escHtml(tr(ef.mesaj) || t('game.toast.venueTransferred'));
  }
  toast(tr(ef.mesaj) || t('game.toast.venueTransferred'), 'basari');
}

async function paraGonder() {
  var hedef = (document.getElementById('paraGonderHedef') || {}).value.trim();
  var miktar = parseInt((document.getElementById('paraGonderMiktar') || {}).value, 10) || 0;
  if (!hedef) { toast(t('game.toast.enterBuyerBoss'), 'hata'); return; }
  if (miktar < 1) { toast(t('game.toast.invalidAmount'), 'hata'); return; }
  var ef = await sunucuAksiyon('para_gonder', null, null, {
    hedef: hedef,
    miktar: miktar
  });
  if (ef === null) return;
  var sonucDiv = document.getElementById('paraGonderSonuc');
  if (sonucDiv) {
    sonucDiv.classList.remove('gizli');
    sonucDiv.className = 'md-sonuc md-sonuc--basari';
    sonucDiv.innerHTML = '✅ ' + escHtml(tr(ef.mesaj) || t('game.toast.moneySent', { amount: fmt(miktar) }));
  }
  toast(tr(ef.mesaj) || t('game.toast.moneySent', { amount: fmt(miktar) }), 'basari');
}

async function medyaHaberYayinla() {
  var haber = document.getElementById('medyaHaber').value.trim();
  if (!haber || haber.length < 5) {
    toast(t('game.toast.newsTooShort'), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('medya_haber', null, null, { haber });
  if (ef === null) return;
  var sonucDiv = document.getElementById('medyaSonuc');
  if (!sonucDiv) return;
  sonucDiv.classList.remove('gizli');
  sonucDiv.className = 'med-sonuc med-sonuc--basari';
  sonucDiv.innerHTML = '✅ ' + escHtml(tr(ef.mesaj) || t('game.toast.newsPublished'));
  document.getElementById('medyaHaber').value = '';
  medyaHaberleriYukle();
}

async function medyaHaberleriYukle() {
  try {
    var res = await apiFetch('/api/medya/haberler');
    var data = await res.json();
    var box = document.getElementById('medyaHaberlerListesi');
    if (!data.ok || !data.haberler || !data.haberler.length) {
      if (box) box.innerHTML = '<p class="med-haber-bos">' + escHtml(t('game.empty.noNews')) + '</p>';
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
  mobilAltMenuKapat();
  aktifEkran = 'mafya';
  aktiviteBildir('mafya:' + mod, 'ekran_goruntule');
  masterFramePlaqueGuncelle('mafya', typeof mafyaTitle === 'function' ? mafyaTitle(mod) : (typeof I18n !== 'undefined' && I18n.mafyaTitle ? I18n.mafyaTitle(mod) : t('screen.mafya')));
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
    box.innerHTML = '<p class="mafya-uyelik-uyari">' + escHtml(t('game.mafya.alreadyMember')) + '</p>';
    return;
  }
  if (mod === 'olustur') {
    box.innerHTML = '<div class="mafya-form is-kart">'
      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.createTitle')) + '</h3>'
      + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.createDesc')) + '</p>'
      + '<input type="text" id="mafyaIsim" placeholder="' + escHtml(t('game.mafya.groupNamePlaceholder')) + '" maxlength="32">'
      + '<button type="button" class="btn-is" onclick="mafyaOlusturAdim1()">' + escHtml(t('game.mafya.createBtn')) + '</button>'
      + '<div id="mafyaAciklamaAlan" class="gizli"><label>' + escHtml(t('game.mafya.descLabel')) + '</label>'
      + '<textarea id="mafyaAciklama" rows="3" maxlength="200" placeholder="' + escHtml(t('game.mafya.descPlaceholder')) + '"></textarea>'
      + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaOlusturAdim2()">' + escHtml(t('game.mafya.createGroupFinalBtn')) + '</button></div></div>'
      + '<div id="mafyaGurupListeEk" class="mafya-grup-liste" style="margin-top:16px;"></div>';
    mafyaTumGuruplariGoster('mafyaGurupListeEk');
    return;
  }
  if (mod === 'katil') {
    box.innerHTML = '<div class="mafya-form is-kart">'
      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.joinTitle')) + '</h3>'
      + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.joinDesc')) + '</p>'
      + '<input type="text" id="mafyaAra" placeholder="' + escHtml(t('game.mafya.searchPlaceholder')) + '">'
      + '<button type="button" class="btn-is mavi-btn" onclick="mafyaAra()">' + escHtml(t('game.mafya.searchBtn')) + '</button>'
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
  box.innerHTML = '<p class="mafya-yukleniyor">' + escHtml(t('game.loading')) + '</p>';
  if (!sunucuBagli) { box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">' + escHtml(t('game.error.serverOffline')) + '</p>'; return; }
  try {
    var res = await apiFetch('/api/mafya/isler');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.panel) throw new Error(data.error || t('game.error.loadFailed'));
    var panel = data.panel;
    if (!panel.grup) {
      box.innerHTML = '<div class="mafya-isler-wrap"><h2>' + escHtml(t('game.mafya.jobsTitle')) + '</h2><p class="mafya-metin">' + escHtml(t('game.mafya.jobsNeedMember')) + '</p></div>';
      return;
    }
    var aktif = panel.aktifIs;
    var aktifKey = aktif ? aktif.isTuru : null;
    var html = '<div class="mafya-isler-wrap"><h2>' + escHtml(t('game.mafya.jobsTitle')) + '</h2>'
      + '<p>' + escHtml(t('game.mafya.jobsQuote')) + '</p>'
      + '<div class="is-kart mafya-isler-ozet">'
      + '<p><b>' + escHtml(t('game.mafya.groupOnline')) + '</b> ' + panel.grup.onlineSayisi + ' / ' + panel.grup.uyeSayisi + '</p>'
      + (aktif ? ('<p><b>' + escHtml(t('game.mafya.activePrep')) + '</b> ' + escHtml(tr(aktif.isTuru)) + '</p>') : '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.noActivePrep')) + '</p>')
      + '</div>';

    (panel.isler || []).forEach(function(isDef) {
      var img = mafyaIsGorseller[isDef.gorselKey] || FALLBACK;
      var aktifMi = aktifKey === isDef.key;
      html += '<div class="is-kart"><div class="is-yapi">'
        + '<img src="' + img + '" class="vesikalik-resim" onerror="imgFallback(this)">'
        + '<div class="is-detay"><h3>' + escHtml(tr(isDef.ad)) + '</h3>'
        + '<p>' + escHtml(t('game.mafya.reqOnline')) + ' <b>' + isDef.minOnline + '</b>' + escHtml(t('game.mafya.onlineMembers')) + ' &nbsp;|&nbsp; ' + escHtml(t('game.mafya.eachMinPower')) + ' <b>' + fmt(isDef.minGuc) + '</b>' + escHtml(t('game.mafya.powerWord')) + '</p>'
        + '<p>' + escHtml(t('game.mafya.earnPerPerson')) + ' <b style="color:#28a745;">' + fmt(isDef.kazancKisi) + ' TL</b> &nbsp;|&nbsp; ' + escHtml(t('game.mafya.respectGain')) + ' <b>+' + isDef.sayginlikKisi + '</b> &nbsp;|&nbsp; ' + escHtml(t('game.mafya.icraatCost')) + ' <b>' + isDef.icraat + '</b></p>'
        + '<button class="btn-is" onclick="mafyaIsKatil(\'' + isDef.key + '\')">' + escHtml(t('game.mafya.joinHeist')) + '</button>';
      if (aktifMi) {
        html += '<button class="btn-is kirmizi-btn" style="margin-left:8px;" onclick="mafyaIsGerceklestir(' + aktif.id + ')">' + escHtml(t('game.mafya.executeHeist')) + '</button>';
      }
      html += '</div></div>';

      if (aktifMi) {
        var list = panel.katilanlar || [];
        html += '<div class="mafya-metin" style="margin-top:10px;"><b>' + escHtml(t('game.mafya.participants')) + '</b> '
          + (list.length ? list.map(function(k) { return (k.online ? '🟢 ' : '⚫ ') + k.reisAdi; }).join(' , ') : escHtml(t('game.empty.noneYet')))
          + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<div class="mafya-isler-wrap"><h2>' + escHtml(t('game.mafya.jobsTitle')) + '</h2><p class="mafya-bos-metin" style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p></div>';
  }
}

async function mafyaIsKatil(key) {
  var ef = await sunucuAksiyon('mafya_is_katil', key, null, { isTuru: key });
  if (ef === null) return;
  toast(t('game.toast.joinedHeist'), 'basari');
  mafyaAltEkran('isler');
}

async function mafyaIsGerceklestir(isId) {
  if (!confirm(t('game.confirm.heist'))) return;
  var ef = await sunucuAksiyon('mafya_is_gerceklestir', String(isId), null, { isId: isId });
  if (ef === null) return;
  sesCal('saldiri');
  toast(tr(ef.mesaj) || t('game.toast.heistComplete'), 'basari');
  mafyaAltEkran('isler');
}

async function mafyaEviCiz(box) {
  box.innerHTML = '<p style="color:#888;">' + escHtml(t('game.loading')) + '</p>';
  if (!sunucuBagli) { box.innerHTML = '<p style="color:#c00;">' + escHtml(t('game.error.serverOffline')) + '</p>'; return; }
  try {
    var res = await apiFetch('/api/mafya/evi');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.ev) throw new Error(data.error || t('game.error.loadFailed'));
    var ev = data.ev;
    var s = ev.seviye || 1;
    var img = mafyaEviGorseller['seviye' + Math.min(10, s)] || FALLBACK;
    var html = '<h2>' + escHtml(t('game.mafya.houseTitle')) + '</h2>'
      + '<p>' + escHtml(t('game.mafya.houseQuote')) + '</p>'
      + '<div class="mafya-evi-sahne"><img src="' + img + '" alt="' + escHtml(t('game.mafya.houseAlt')) + '" onerror="imgFallback(this)"></div>'
      + '<div class="mafya-evi-alt is-kart"><h3>' + escHtml(data.grupAdi || t('screen.mafya')) + ' — ' + escHtml(t('game.mafya.levelWord')) + s + '</h3>'
      + '<p>' + escHtml(t('game.mafya.capacity')) + ' <b>' + ev.kapasite + '</b>' + escHtml(t('game.mafya.membersWord')) + '</p>'
      + '<p>' + escHtml(t('game.mafya.accumulation')) + ' <b style="color:#b8942a;">' + fmt(ev.birikmisPara) + ' TL</b></p>'
      + '<p>' + escHtml(t('game.mafya.nextLevelCost')) + ' <b>' + fmt(ev.sonrakiMaliyet) + ' TL</b> ' + escHtml(t('game.mafya.remaining')) + ' ' + fmt(ev.kalan) + ' TL)</p>'
      + '</div>';

    html += '<div class="is-kart mafya-evi-alt" style="max-width:520px;margin:0 auto;">'
      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.donation')) + '</h3>'
      + '<input type="number" id="mafyaHibe" class="dusman-input" placeholder="' + escHtml(t('game.mafya.donatePlaceholder')) + '" style="width:100%;margin-bottom:8px;">'
      + '<button class="btn-is" onclick="mafyaEviHibe()">' + escHtml(t('game.mafya.donateBtn')) + '</button>';
    if (data.benLiderim) {
      html += '<button class="btn-is kirmizi-btn" style="margin-left:8px;" onclick="mafyaEviSeviye()">' + escHtml(t('game.mafya.levelUpBtn')) + '</button>';
    }
    html += '</div>';
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<h2>' + escHtml(t('game.mafya.houseTitle')) + '</h2><p style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p>';
  }
}

async function mafyaEviHibe() {
  var el = document.getElementById('mafyaHibe');
  var miktar = el ? parseInt(el.value, 10) : 0;
  if (!miktar || miktar < 1) { toast(t('game.toast.enterDonationAmount'), 'hata'); return; }
  var ef = await sunucuAksiyon('mafya_evi_hibe', null, null, { miktar: miktar });
  if (ef === null) return;
  toast(t('game.toast.donationDone'), 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaEviSeviye() {
  var ef = await sunucuAksiyon('mafya_evi_seviye');
  if (ef === null) return;
  toast(t('game.toast.levelUp'), 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaSavaslarCiz(box) {
  box.innerHTML = '<p style="color:#888;">' + escHtml(t('game.loading')) + '</p>';
  if (!sunucuBagli) {
    box.innerHTML = '<p style="color:#c00;">' + escHtml(t('game.error.serverOffline')) + '</p>';
    return;
  }
  try {
    var mafyaRes = await apiFetch('/api/mafya');
    var mafyaData = await mafyaRes.json().catch(function() { return {}; });
    var res = await apiFetch('/api/mafya/savaslar');
    var data = await res.json();
    if (!data.ok || !data.savaslar) {
      box.innerHTML = '<p style="color:#fff;">' + escHtml(t('game.empty.noWar')) + '</p>';
      return;
    }
    var html = '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="' + escHtml(t('game.mafya.warsBannerAlt')) + '"></div>'
      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.warsTitle')) + '</h3>';
    if (mafyaData && mafyaData.uyelik && mafyaData.uyelik.benLiderim) {
      html += '<div class="is-kart" style="padding:14px;max-width:520px;margin:0 auto 14px;">'
        + '<p style="color:#888;margin-bottom:8px;">' + escHtml(t('game.mafya.warsDesc')) + '</p>'
        + '<input type="text" id="mafyaSavasHedef" class="dusman-input" placeholder="' + escHtml(t('game.mafya.warsTargetPlaceholder')) + '" style="width:100%;margin-bottom:8px;">'
        + '<button class="btn-is kirmizi-btn" onclick="mafyaSavasIlan()">' + escHtml(t('game.mafya.declareWar')) + '</button>'
        + '</div>';
    }
    data.savaslar.forEach(function(s) {
      var durum = s.durum === 'bekliyor' ? t('game.mafya.warWaiting') : s.durum === 'aktif' ? t('game.mafya.warActive') : t('game.mafya.warDone');
      var kalanSaat = Math.max(0, Math.ceil((s.savas_zamani - Date.now()) / (1000 * 60 * 60)));
      html += '<div class="is-kart"><p><b>' + durum + '</b></p>'
        + '<p>' + escHtml(t('game.mafya.warAttacker')) + ' <b>' + escHtml(s.saldiran_grup_adi || s.saldiran_grup_id) + '</b> | ' + escHtml(t('game.mafya.warTarget')) + ' <b>' + escHtml(s.hedef_grup_adi || s.hedef_grup_id) + '</b></p>'
        + '<p>' + escHtml(t('game.mafya.warParticipants')) + ' ' + s.saldiran_katilim + t('game.mafya.warTargetSide') + s.hedef_katilim + '</p>';
      if (s.durum === 'bekliyor') {
        html += '<p style="color:#888;">' + escHtml(t('game.mafya.warStartsIn')) + ' <b>' + kalanSaat + '</b>' + escHtml(t('game.mafya.warHours')) + '</p>';
        html += '<button class="btn-is" onclick="mafyaSavasaKatil(' + s.id + ')">' + escHtml(t('game.mafya.joinWar')) + '</button>';
      }
      html += '</div>';
    });
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<p style="color:#c00;">' + escHtml(t('game.mafya.warsLoadFailed')) + '</p>';
  }
}

async function mafyaSavasIlan() {
  var el = document.getElementById('mafyaSavasHedef');
  var hedef = el ? el.value.trim() : '';
  if (!hedef) { toast(t('game.toast.enterTargetGroup'), 'hata'); return; }
  var ef = await sunucuAksiyon('mafya_savas_ilan', null, null, { hedefGurupAdi: hedef });
  if (ef === null) return;
  toast(tr(ef.mesaj) || t('game.toast.warDeclared'), 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaSavasaKatil(savasId) {
  var ef = await sunucuAksiyon('mafya_savas_katil', null, null, { savasId: savasId });
  if (ef === null) return;
  toast(tr(ef.mesaj) || t('game.toast.joinedWar'), 'basari');
  mafyaMenuSec('gurubum');
}

function mafyaGurupListesiHTML(gruplar, basvuruModu) {
  if (!gruplar || !gruplar.length) {
    return '<p class="mafya-bos-metin">' + escHtml(t('game.empty.noMafiaGroup')) + '</p>';
  }
  var html = '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.existingGroups')) + '</h3>';
  gruplar.forEach(function(g) {
    html += '<div class="is-kart"><b><button type="button" class="btn-is mavi-btn" style="margin:0;padding:4px 12px;" onclick="mafyaGrupGoster(' + g.id + ')">' + escHtml(g.isim) + '</button></b>';
    if (g.lider_adi) html += '<p class="mafya-metin-dim" style="margin-top:8px;">' + escHtml(t('game.mafya.leaderLabel')) + ' <b style="color:#e8dcc0;">' + escHtml(g.lider_adi) + '</b></p>';
    if (g.uye_sayisi != null) html += '<p class="mafya-metin-dim">' + g.uye_sayisi + escHtml(t('game.mafya.membersCount')) + '</p>';
    html += '<p>' + escHtml(mafyaAciklamaListeMetin(g.aciklama)) + '</p>';
    if (basvuruModu) {
      html += '<button class="btn-is" onclick="mafyaBasvur(' + g.id + ')">' + escHtml(t('game.mafya.applyBtn')) + '</button>';
    }
    html += '</div>';
  });
  return html;
}

async function mafyaGurubumCiz(box) {
  box.innerHTML = '<p class="mafya-yukleniyor">' + escHtml(t('game.loading')) + '</p>';
  if (!sunucuBagli) {
    box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">' + t('game.error.serverOfflineHelp') + '</p>';
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
      box.innerHTML = '<p class="mafya-bos-metin" style="color:#fff;font-weight:700;">' + escHtml(t('game.empty.notMafiaMember')) + '</p>';
      return;
    }

    var html = '<div class="mafya-gurubum-wrap">'
      + '<div class="is-kart mafya-grup-ust">'
      + '<button type="button" class="btn-is mavi-btn mafya-grup-isim-btn" onclick="mafyaGrupGoster(' + data.uyelik.id + ')">' + escHtml(data.uyelik.isim) + '</button>'
      + mafyaSampiyonRozetleriHTML(data.sampiyonluklar)
      + '<div class="mafya-grup-aciklama-alan">'
      + '<h4 class="mafya-grup-aciklama-baslik">' + escHtml(t('game.mafya.groupDescTitle')) + '</h4>'
      + '<div class="mafya-grup-aciklama-kutu">'
      + '<div id="mafyaGrupAciklamaGoster" class="mafya-grup-aciklama profil-aciklama-metin profil-aciklama-html">—</div>'
      + '<div id="mafyaGrupAciklamaEditorAlan" class="gizli">' + mafyaGrupAciklamaEditorHtml() + '</div>'
      + '</div></div>';
    if (data.uyelik.benLiderim) {
      html += '<div class="mafya-btn-satir">'
        + '<button type="button" class="btn-is" onclick="mafyaGrupIsimDegistir()">' + escHtml(t('game.mafya.renameBtn')) + '</button>'
        + '<button type="button" class="btn-is" onclick="mafyaGrupAciklamaDegistir()">' + escHtml(t('game.mafya.editDescBtn')) + '</button>'
        + '</div>';
    }
    html += '</div>';

    if (evData.ok && evData.ev) {
      html += mafyaEviBolumHTML(evData.ev, evData.grupAdi || data.uyelik.isim, !!evData.benLiderim);
    }

    html += mafyaSavasBolumHTML(data, savasData);

    html += '<div class="tablo-container mafya-uyeler-tablo">'
      + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.membersTitle')) + '</h3>'
      + '<div class="tablo-izgara tablo-baslik-satir"><span>' + escHtml(t('game.mafya.colName')) + '</span><span>' + escHtml(t('game.mafya.colRank')) + '</span><span>' + escHtml(t('game.mafya.colRespect')) + '</span><span>' + escHtml(t('game.mafya.colOffline')) + '</span><span></span><span></span></div>';
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
        html += '<button type="button" class="btn-is" style="padding:4px 8px;font-size:11px;" onclick="mafyaRutbe(' + u.user_id + ')">' + escHtml(t('game.mafya.editRank')) + '</button> '
          + '<button type="button" class="btn-is mavi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaDevret(' + u.user_id + ')">' + escHtml(t('game.mafya.transferCrown')) + '</button>';
      } else html += '—';
      html += '</span><span>';
      if (liderSatir) {
        html += '<button type="button" class="btn-is kirmizi-btn" style="padding:4px 8px;font-size:11px;" onclick="mafyaCikar(' + u.user_id + ')">' + escHtml(t('game.mafya.kick')) + '</button>';
      } else html += '—';
      html += '</span></div>';
    });
    html += '</div>';
    if (data.uyelik.benLiderim) {
      html += '<div class="mafya-basvurular">';
      if (data.basvurular && data.basvurular.length) {
        html += '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.applications')) + '</h3>';
        data.basvurular.forEach(function(b) {
          html += '<p class="mafya-basvuru-satir">' + b.reis_adi
            + ' <button type="button" class="btn-is" onclick="mafyaKabul(' + b.id + ')">' + escHtml(t('game.mafya.accept')) + '</button> '
            + '<button type="button" class="btn-is kirmizi-btn" onclick="mafyaRed(' + b.id + ')">' + escHtml(t('game.mafya.reject')) + '</button></p>';
        });
      }
      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaDagit()">' + escHtml(t('game.mafya.disbandBtn')) + '</button></div></div>';
    } else {
      html += '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is kirmizi-btn" onclick="mafyaCik()">' + escHtml(t('game.mafya.leaveBtn')) + '</button></div>';
    }
    html += '<div class="mafya-grup-mesaj-alan">'
      + '<button type="button" class="btn-is mavi-btn mafya-grup-mesaj-btn" onclick="mafyaGrupMesajModal()">' + escHtml(t('game.mafya.groupMsgBtn')) + '</button>'
      + '</div></div>';
    box.innerHTML = html;
    window.__mafyaGrupAciklamaHtml = data.uyelik.aciklama || '';
    mafyaGrupAciklamaGoster(window.__mafyaGrupAciklamaHtml);
  } catch (e) {
    var msg = e.message || t('game.error.connectionFailed');
    if (msg.indexOf('404') >= 0) {
      msg = t('game.mafya.api404');
    }
    box.innerHTML = '<p class="mafya-bos-metin" style="color:#c00;">' + escHtml(msg) + '</p>'
      + '<p class="mafya-metin-dim">' + t('game.mafya.serverHelp') + '</p>';
  }
}

function mafyaEviBolumHTML(ev, grupAdi, benLiderim) {
  var s = ev.seviye || 1;
  var img = mafyaEviGorseller['seviye' + Math.min(10, s)] || FALLBACK;
  var html = '<div class="is-kart mafya-bolum">'
    + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.houseLevel')) + '</h3>'
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
    + '<button class="btn-is" onclick="mafyaEviHibe()">' + escHtml(t('game.mafya.donateBtn')) + '</button>';
  if (benLiderim) {
    html += '<button class="btn-is kirmizi-btn" onclick="mafyaEviSeviye()">' + escHtml(t('game.mafya.levelUpBtn')) + '</button>';
  }
  html += '<button type="button" class="btn-is mavi-btn" onclick="mafyaHibeGecmisiGoster()">' + escHtml(t('game.mafya.viewDonations')) + '</button>'
    + '</div>'
    + '<div id="mafyaHibeGecmisi" class="gizli mafya-hibe-tablo" style="margin-top:12px;"></div>'
    + '</div></div>';
  return html;
}

function mafyaSavasBolumHTML(mafyaData, savasData) {
  var html = '<div class="is-kart mafya-bolum">'
    + '<div class="mafya-savas-hero"><img class="mafya-savas-banner" src="/images/mafya/savas-banner.png?v=' + GORSEL_VERSIYON + '" alt="' + escHtml(t('game.mafya.warDeclareBannerAlt')) + '"></div>'
    + '<h3 class="bolum-baslik">' + escHtml(t('game.mafya.warDeclareTitle')) + '</h3>';
  if (mafyaData && mafyaData.uyelik && mafyaData.uyelik.benLiderim) {
    html += '<div class="mafya-savas-ilan-alan">'
      + '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.warsDesc')) + '</p>'
      + '<input type="text" id="mafyaSavasHedef" class="dusman-input" placeholder="' + escHtml(t('game.mafya.warsTargetPlaceholder')) + '">'
      + '<div class="mafya-btn-satir"><button class="btn-is kirmizi-btn" onclick="mafyaSavasIlan()">' + escHtml(t('game.mafya.declareWar')) + '</button></div>'
      + '</div>';
  }
  if (!savasData.ok || !savasData.savaslar || !savasData.savaslar.length) {
    html += '<p class="mafya-metin-dim">' + escHtml(t('game.empty.noWar')) + '</p></div>';
    return html;
  }
  savasData.savaslar.forEach(function(s) {
    var durum = s.durum === 'bekliyor' ? t('game.mafya.warWaiting') : s.durum === 'aktif' ? t('game.mafya.warActive') : t('game.mafya.warDone');
    var kalanSaat = Math.max(0, Math.ceil((s.savas_zamani - Date.now()) / (1000 * 60 * 60)));
    html += '<div class="mafya-savas-kart"><p><b>' + durum + '</b></p>'
      + '<p>' + escHtml(t('game.mafya.warAttacker')) + ' <b>' + escHtml(s.saldiran_grup_adi || s.saldiran_grup_id) + '</b></p>'
      + '<p>' + escHtml(t('game.mafya.warTarget')) + ' <b>' + escHtml(s.hedef_grup_adi || s.hedef_grup_id) + '</b></p>'
      + '<p>' + escHtml(t('game.mafya.warParticipants')) + ' <b>' + s.saldiran_katilim + '</b>' + escHtml(t('game.mafya.warTargetSide')) + '<b>' + s.hedef_katilim + '</b></p>';
    if (s.durum === 'bekliyor') {
      html += '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.warStartsIn')) + ' <b>' + kalanSaat + '</b>' + escHtml(t('game.mafya.warHours')) + '</p>'
        + '<button class="btn-is" onclick="mafyaSavasaKatil(' + s.id + ')">' + escHtml(t('game.mafya.joinWar')) + '</button>';
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
  box.innerHTML = '<p class="mafya-metin-dim">' + escHtml(t('game.loading')) + '</p>';
  try {
    var res = await apiFetch('/api/mafya/evi/hibeler');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || t('game.error.loadFailed'));
    var liste = data.hibeler || [];
    if (!liste.length) {
      box.innerHTML = '<p class="mafya-metin-dim">' + escHtml(t('game.empty.noDonationLog')) + '</p>';
      return;
    }
    var html = '<div class="tablo-container"><div class="tablo-izgara tablo-baslik-satir"><span>' + escHtml(t('game.mafya.donorCol')) + '</span><span>' + escHtml(t('game.mafya.dateCol')) + '</span><span>' + escHtml(t('game.mafya.amountCol')) + '</span></div>';
    liste.forEach(function(h) {
      html += '<div class="tablo-izgara"><span>' + escHtml(h.reisAdi) + '</span><span>' + escHtml(h.tarih) + '</span><span>' + fmt(h.miktar) + ' TL</span></div>';
    });
    html += '</div>';
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = '<p style="color:#c00;">' + (e.message || t('game.error.loadFailed')) + '</p>';
  }
}

function mafyaGrupIsimDegistir() {
  var yeni = prompt(t('game.mafya.promptNewName'));
  if (!yeni || !yeni.trim()) return;
  sunucuAksiyon('mafya_grup_isim_degistir', null, null, { isim: yeni.trim() }).then(function(ef) {
    if (ef !== null) {
      toast(t('game.toast.groupNameUpdated'), 'basari');
      mafyaMenuSec('gurubum');
    }
  });
}

function mafyaGrupAciklamaDegistir() {
  var goster = document.getElementById('mafyaGrupAciklamaGoster');
  var editor = document.getElementById('mafyaGrupAciklamaEditorAlan');
  if (!goster || !editor) return;
  goster.classList.add('gizli');
  editor.classList.remove('gizli');
  mafyaGrupAciklamaModuUygula(window.__mafyaGrupAciklamaHtml || '');
}

async function mafyaGrupAciklamaKaydet() {
  var aciklama = mafyaGrupAciklamaAl();
  var ef = await sunucuAksiyon('mafya_grup_aciklama_degistir', null, null, { aciklama: aciklama });
  if (ef === null) return;
  window.__mafyaGrupAciklamaHtml = aciklama;
  toast(t('game.toast.groupDescUpdated'), 'basari');
  mafyaMenuSec('gurubum');
}

function mafyaGrupAciklamaIptal() {
  mafyaGrupQuillYokEt();
  var goster = document.getElementById('mafyaGrupAciklamaGoster');
  var editor = document.getElementById('mafyaGrupAciklamaEditorAlan');
  if (editor) editor.classList.add('gizli');
  if (goster) {
    goster.classList.remove('gizli');
    mafyaGrupAciklamaGoster(window.__mafyaGrupAciklamaHtml || '');
  }
}

function mafyaOlusturAdim1() {
  var isim = document.getElementById('mafyaIsim');
  if (!isim || isim.value.trim().length < 2) {
    toast(t('game.toast.enterGroupName'), 'hata');
    return;
  }
  document.getElementById('mafyaAciklamaAlan').classList.remove('gizli');
}

async function mafyaOlusturAdim2() {
  var isim = document.getElementById('mafyaIsim').value.trim();
  var acik = document.getElementById('mafyaAciklama').value.trim();
  var ef = await sunucuAksiyon('mafya_olustur', null, null, { isim: isim, aciklama: acik });
  if (ef === null) return;
  toast(t('game.toast.mafiaGroupCreated'), 'basari');
  mafyaMenuSec('gurubum');
}

async function mafyaAra() {
  var q = document.getElementById('mafyaAra').value.trim();
  var res = await apiFetch('/api/mafya/ara?q=' + encodeURIComponent(q));
  var data = await res.json();
  var box = document.getElementById('mafyaAraSonuc');
  if (!data.liste || !data.liste.length) {
    box.innerHTML = '<p class="mafya-metin-dim">' + escHtml(t('game.mafya.noResults')) + '</p>';
    return;
  }
  var html = '';
  data.liste.forEach(function(g) {
    html += '<div class="is-kart" style="text-align:center;padding:14px;margin-top:10px;"><b><button type="button" class="btn-is mavi-btn" style="margin:0;padding:4px 12px;" onclick="mafyaGrupGoster(' + g.id + ')">' + escHtml(g.isim) + '</button></b>'
      + '<p class="mafya-metin-dim" style="margin-top:8px;">' + escHtml(t('game.mafya.leaderLabel')) + ' <b style="color:#e8dcc0;">' + escHtml(g.lider_adi) + '</b></p>'
      + '<p class="mafya-metin">' + escHtml(mafyaAciklamaListeMetin(g.aciklama)) + '</p>'
      + '<button class="btn-is" onclick="mafyaBasvur(' + g.id + ')">' + escHtml(t('game.mafya.applyBtn')) + '</button></div>';
  });
  box.innerHTML = html;
}

async function mafyaBasvur(grupId) {
  var ef = await sunucuAksiyon('mafya_basvur', String(grupId));
  if (ef === null) return;
  toast(t('game.toast.applicationSent'), 'basari');
}

async function mafyaGrupGoster(grupId) {
  try {
    var res = await apiFetch('/api/mafya/grup/' + grupId);
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.grup) {
      toast(tr(data.error) || t('game.toast.groupInfoFailed'), 'hata');
      return;
    }
    var g = data.grup;
    var evSeviye = g.evSeviye || 1;
    var evImg = mafyaEviGorseller['seviye' + Math.min(10, evSeviye)] || FALLBACK;
    var html = '<div class="mafya-gurubum-wrap"><div class="is-kart mafya-grup-ust" style="max-width:640px;margin:0 auto;">'
      + '<h2 class="bolum-baslik" style="margin-bottom:12px;">' + escHtml(g.isim) + '</h2>'
      + mafyaSampiyonRozetleriHTML(g.sampiyonluklar)
      + '<div class="mafya-grup-aciklama-alan">'
      + '<div class="profil-aciklama-baslik-satir">'
      + '<h4 class="mafya-grup-aciklama-baslik">' + escHtml(t('game.mafya.groupDescTitle')) + '</h4>'
      + (!g.benimGrubum ? icerikRaporlaAlaniHTML({ tip: 'mafya_grup', hedefGrupId: g.id }) : '')
      + '</div>'
      + '<div class="mafya-grup-aciklama-kutu"><div id="mafyaGrupProfilAciklama" class="mafya-grup-aciklama profil-aciklama-metin profil-aciklama-html">—</div></div>'
      + '</div>'
      + '<div class="mafya-evi-sahne mafya-grup-profil-ev"><img src="' + evImg + '" alt="' + escHtml(t('game.mafya.houseAlt')) + '" onerror="imgFallback(this)"></div>'
      + '<p class="mafya-stat"><b>' + escHtml(t('game.mafya.houseLevel')) + '</b> ' + escHtml(t('game.mafya.levelWord')) + evSeviye + ' (' + escHtml(t('game.mafya.capacity')) + ' ' + (g.evKapasite || '—') + ')</p>'
      + '<p class="mafya-stat"><b>' + escHtml(t('game.mafya.memberBonus')) + '</b> +' + fmt(g.evUyeGucBonusu || 0) + '</p>'
      + '<p class="mafya-stat"><b>' + escHtml(t('game.mafya.memberCount')) + '</b> ' + g.uyeSayisi + '</p>'
      + '<p class="mafya-stat"><b>' + escHtml(t('game.mafya.totalRespect')) + '</b> <span class="uye-puan">' + fmt(g.toplamSayginlik) + '</span></p>'
      + '<div class="mafya-alt-aksiyon"><button type="button" class="btn-is" onclick="mafyaMenuSec(\'gurubum\')">' + escHtml(t('game.mafya.backBtn')) + '</button></div>'
      + '</div></div>';
    document.getElementById('anaIcerik').innerHTML = html;
    var acikEl = document.getElementById('mafyaGrupProfilAciklama');
    if (acikEl) {
      if (!g.aciklama || !String(g.aciklama).trim()) {
        acikEl.textContent = t('game.empty.noDescription');
        acikEl.classList.add('mafya-grup-aciklama-bos');
      } else {
        profilAciklamaGosterUygula(g.aciklama, 'mafyaGrupProfilAciklama');
      }
    }
  } catch (_) {
    toast(t('game.toast.groupInfoFailed'), 'hata');
  }
}

async function mafyaGrupMesajModal() {
  var metin = prompt(t('game.mafya.promptGroupMsg'));
  if (!metin || !metin.trim()) return;
  var ef = await sunucuAksiyon('mafya_grup_mesaj', null, null, { metin: metin.trim() });
  if (ef !== null) {
    toast(t('game.toast.groupMessageSent'), 'basari');
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
  var rutbe = prompt(t('game.mafya.promptNewRank'));
  if (!rutbe) return;
  await sunucuAksiyon('mafya_rutbe', null, null, { hedefUserId: userId, rutbe: rutbe });
  mafyaAltEkran('gurubum');
}

async function mafyaCikar(userId) {
  if (!confirm(t('game.confirm.kickMember'))) return;
  await sunucuAksiyon('mafya_cikar', String(userId));
  mafyaAltEkran('gurubum');
}

async function mafyaDevret(userId) {
  if (!confirm(t('game.confirm.transferLeadership'))) return;
  await sunucuAksiyon('mafya_devret', String(userId));
  mafyaAltEkran('gurubum');
}

async function mafyaDagit() {
  if (!confirm(t('game.confirm.disbandGroup'))) return;
  await sunucuAksiyon('mafya_dagit');
  mafyaMenuSec('olustur');
}

async function mafyaCik() {
  if (!confirm(t('game.confirm.leaveGroup'))) return;
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
      + '<div class="lt-tab-floating">' + escHtml(t('game.leaderboard.tabTitle')) + '</div>'
      + '<div class="lt-side-tabs">'
      + ltTab('oyuncu', t('game.leaderboard.tabPeople'), oyuncuAktif)
      + ltTab('grup', t('game.leaderboard.tabGroups'), !oyuncuAktif)
      + '</div></div>'
      + '<div class="lt-head">'
      + '<div class="lt-head-row"><div class="lt-head-icon">' + headIcon + '</div>'
      + '<div class="lt-head-title">' + escHtml(t('game.leaderboard.headTitle')) + '</div></div>'
      + '<div class="lt-head-quote">' + escHtml(t('game.leaderboard.quote')) + '</div>'
      + '</div>';

    if (oyuncuAktif) {
      html += '<div class="lt-colbar"><span>' + escHtml(t('game.leaderboard.colRank')) + '</span><span>' + escHtml(t('game.leaderboard.colName')) + '</span><span>' + escHtml(t('game.leaderboard.colGroup')) + '</span><span>' + escHtml(t('game.leaderboard.colRespect')) + '</span></div>'
        + '<div class="lt-list">';
      if (!liste.length) {
        html += '<p class="lt-empty">' + escHtml(t('game.empty.noRanking')) + '</p>';
      } else {
        liste.forEach(function(r, i) {
          var cls = 'lt-row' + (r.benim ? ' me' : '');
          html += '<div class="' + cls + '">'
            + '<div class="lt-medal-wrap"><div class="lt-medal ' + ltMedalClass(i) + '">' + (i + 1) + '</div></div>'
            + '<div class="lt-cap"><span class="lt-icon pistol"></span>' + ltIsimHtml(r) + '</div>'
            + '<div class="lt-cap center lt-group-cap">' + ltGrupLinkHtml(r.grup, r.grupId, grupMap) + '</div>'
            + '<div class="lt-cap right lt-pts-cap"><span class="lt-icon coin"></span>'
            + '<span class="lt-pts-txt">' + fmt(r.puan) + '<span class="lt-lbl">' + escHtml(t('game.leaderboard.points')) + '</span></span></div>'
            + '</div>';
        });
      }
      html += '</div>';
    } else {
      html += '<div class="lt-colbar lt-colbar--grup"><span>' + escHtml(t('game.leaderboard.colRank')) + '</span><span>' + escHtml(t('game.leaderboard.colGroup')) + '</span><span>' + escHtml(t('game.leaderboard.colTotalRespect')) + '</span><span>' + escHtml(t('game.leaderboard.colInfo')) + '</span></div>'
        + '<div class="lt-list">';
      if (!liste.length) {
        html += '<p class="lt-empty">' + escHtml(t('game.empty.noGroupRanking')) + '</p>';
      } else {
        liste.forEach(function(r, i) {
          var statTxt = t('game.leaderboard.groupStat', { level: r.evSeviye || 1, members: r.uyeSayisi || 0, wars: r.kazanilanSavas || 0 });
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

    html += '<div class="lt-foot">' + escHtml(t('game.leaderboard.footer')) + '</div>'
      + '</div></div>';
    if (ic && aktifEkran === 'liderlik') ic.innerHTML = html;
  });
}

function profilZiyaretleriHTML(ziyaretler) {
  var zHtml = '<h3 class="profil-ziyaretler-baslik">' + escHtml(t('game.profil.visitsTitle')) + '</h3><ul class="profil-ziyaret-liste">';
  if (ziyaretler && ziyaretler.length) {
    ziyaretler.forEach(function(n) { zHtml += '<li>' + escHtml(n) + '</li>'; });
  } else {
    zHtml += '<li class="bos">' + escHtml(t('game.empty.noVisits')) + '</li>';
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
  var grupId = p.grupId || null;
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
    if ((grupSira == null || !grupId) && p.grup) {
      var gRes = await apiFetch('/api/leaderboard?tip=grup');
      var gData = await gRes.json().catch(function() { return {}; });
      if (gRes.ok && gData.ok && gData.liste) {
        var grupAdi = temizGrupAdi(p.grup);
        for (var j = 0; j < gData.liste.length; j++) {
          if (temizGrupAdi(gData.liste[j].isim) === grupAdi) {
            if (grupSira == null) grupSira = j + 1;
            if (!grupId) grupId = gData.liste[j].grupId;
            break;
          }
        }
      }
    }
  } catch (_) {}
  return { sira: sira, grupSira: grupSira, grupId: grupId };
}

async function profilSiralamaAlanlariGuncelle(p) {
  var yedek = await profilSiralamaYedek(p);
  if (p.sira == null) p.sira = yedek.sira;
  if (p.grupSira == null) p.grupSira = yedek.grupSira;
  if (!p.grupId) p.grupId = yedek.grupId;
  profilAlanGuncelle('profilPuanDetay', fmt(p.puan || 0));
  profilAlanGuncelle('profilSiraDetay', p.sira != null ? fmt(p.sira) : '—');
  profilGrupSiraDetayGuncelle(p.grupSira, p.grup, p.grupId);
}

async function profilYukle() {
  try {
    await profilLiderlikOyunculariYukle();
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
    profilLocaleAlanGuncelle(p);
    profilAlanGuncelle('profilOzOyuncu', p.oyuncuAdi || aktifReisAdi);
    profilAlanGuncelle('profilOzLakap', p.lakap || 'Mafya');
    profilAlanGuncelle('profilOyuncuIsmiDetay', p.oyuncuAdi || aktifReisAdi);
    profilSirketDetayGuncelle(p.isDurumu, p.userId);
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
    profilYetenekleriGuncelle(p.yetenekler, p.aktifMeslek, p.yetenekOzeti);
    arayuzGuncelle();
    profilIcraatTimerBaslat(
      p.icraat != null ? p.icraat : oyuncuIcraat,
      p.lastIcraatAt != null ? p.lastIcraatAt : oyuncuLastIcraatAt,
      p.icraatRegenSec || oyuncuIcraatRegenSec,
      p.icraatSaatlikBonus || oyuncuIcraatSaatlikBonus
    );
  } catch (_) {}
}

function icerikRaporlaAlaniHTML(opts) {
  opts = opts || {};
  return '<div class="icerik-rapor-wrap" data-rapor-tip="' + escHtml(opts.tip || 'profil') + '"'
    + ' data-rapor-hedef-user="' + escHtml(String(opts.hedefUserId || '')) + '"'
    + ' data-rapor-hedef-grup="' + escHtml(String(opts.hedefGrupId || '')) + '">'
    + '<button type="button" class="icerik-rapor-btn" onclick="icerikRaporlaAc(this)">' + escHtml(t('game.report.btn')) + '</button>'
    + '<div class="icerik-rapor-panel gizli">'
    + '<p class="icerik-rapor-baslik">' + escHtml(t('game.report.title')) + '</p>'
    + '<textarea class="icerik-rapor-textarea" rows="4" maxlength="500" placeholder="' + escHtml(t('game.report.placeholder')) + '"></textarea>'
    + '<div class="icerik-rapor-aksiyon">'
    + '<button type="button" class="icerik-rapor-gonder-btn" onclick="icerikRaporlaGonder(this)">' + escHtml(t('game.report.send')) + '</button>'
    + '<button type="button" class="icerik-rapor-iptal-btn" onclick="icerikRaporlaKapat(this)">' + escHtml(t('game.report.cancel')) + '</button>'
    + '</div></div></div>';
}

function icerikRaporlaAc(btn) {
  var wrap = btn && btn.closest ? btn.closest('.icerik-rapor-wrap') : null;
  if (!wrap) return;
  var panel = wrap.querySelector('.icerik-rapor-panel');
  if (panel) panel.classList.remove('gizli');
  btn.classList.add('gizli');
  var ta = panel && panel.querySelector('.icerik-rapor-textarea');
  if (ta) ta.focus();
}

function icerikRaporlaKapat(btn) {
  var wrap = btn && btn.closest ? btn.closest('.icerik-rapor-wrap') : null;
  if (!wrap) return;
  var panel = wrap.querySelector('.icerik-rapor-panel');
  var raporBtn = wrap.querySelector('.icerik-rapor-btn');
  if (panel) {
    panel.classList.add('gizli');
    var ta = panel.querySelector('.icerik-rapor-textarea');
    if (ta) ta.value = '';
  }
  if (raporBtn) raporBtn.classList.remove('gizli');
}

async function icerikRaporlaGonder(btn) {
  var wrap = btn && btn.closest ? btn.closest('.icerik-rapor-wrap') : null;
  if (!wrap) return;
  var tip = wrap.getAttribute('data-rapor-tip');
  var hedefUserId = wrap.getAttribute('data-rapor-hedef-user');
  var hedefGrupId = wrap.getAttribute('data-rapor-hedef-grup');
  var ta = wrap.querySelector('.icerik-rapor-textarea');
  var sebep = ta ? ta.value.trim() : '';
  if (!sebep) {
    toast(t('game.toast.enterReason'), 'hata');
    return;
  }
  btn.disabled = true;
  try {
    var res = await apiFetch('/api/rapor', {
      method: 'POST',
      body: {
        tip: tip,
        hedefUserId: hedefUserId || null,
        hedefGrupId: hedefGrupId || null,
        sebep: sebep
      }
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) {
      toast(tr(data.error) || t('game.toast.reportFailed'), 'hata');
      return;
    }
    toast(tr(data.mesaj) || t('game.toast.reportSent'), 'basari');
    icerikRaporlaKapat(btn);
  } catch (_) {
    toast(t('game.toast.connectionError'), 'hata');
  } finally {
    btn.disabled = false;
  }
}

function profilOyuncuAdiUcretGuncelle() {
  var el = document.getElementById('profilOyuncuAdiUcret');
  if (!el) return;
  el.textContent = fmt(Math.floor((saatlikKazanc || 0) * 5)) + ' TL';
}

async function profilOyuncuAdiDegistir() {
  var input = document.getElementById('profilYeniOyuncuAdi');
  var yeni = input ? input.value.trim() : '';
  if (!yeni) {
    toast(t('game.toast.enterNewName'), 'hata');
    return;
  }
  if (yeni.toLowerCase() === String(aktifReisAdi || '').toLowerCase()) {
    toast(t('game.toast.sameName'), 'hata');
    return;
  }
  var ucret = Math.floor((saatlikKazanc || 0) * 5);
  if (!confirm(t('game.confirm.rename', { amount: fmt(ucret), name: yeni }))) return;
  var ef = await sunucuAksiyon('oyuncu_adi_degistir', null, null, { yeniAd: yeni });
  if (!ef) return;
  if (input) input.value = '';
  if (ef.mesaj) toast(tr(ef.mesaj), 'basari');
  profilAlanGuncelle('profilOzOyuncu', aktifReisAdi);
  profilAlanGuncelle('profilOyuncuIsmiDetay', aktifReisAdi);
  profilOyuncuAdiUcretGuncelle();
}

async function profilKaydet() {
  var aciklama = profilAciklamaAl();
  var dostlar = ((document.getElementById('profilDostlar') || {}).value || '').trim();
  var dusmanlar = ((document.getElementById('profilDusmanlar') || {}).value || '').trim();
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
      toast(tr(data.error) || t('game.toast.profileSaveFailed'), 'hata');
      return;
    }
    oyuncuUygula(data.player);
    profilAciklamaModuUygula(
      data.player && data.player.profilAciklama != null ? data.player.profilAciklama : aciklama
    );
    var avatar = document.getElementById('profilAvatar');
    if (avatar && oyuncuProfilResmi) {
      avatar.src = profilPortreUrlFromKey(oyuncuProfilResmi);
      avatar.classList.add('profil-avatar-ozel');
    }
    if (wrap && oyuncuProfilResmi) wrap.setAttribute('data-profil-resmi', oyuncuProfilResmi);
    toast(t('game.toast.profileSaved'), 'basari');
  } catch (_) {
    toast(t('game.toast.profileSaveConnectionError'), 'hata');
  }
}

async function profilZiyaretSaldir(reisAdi) {
  if (!reisAdi) return;
  if (String(reisAdi).toLowerCase() === String(aktifReisAdi || '').toLowerCase()) {
    profilSaldirSonucGoster(t('game.profil.attackSelf'), 'hata');
    return;
  }
  if (!confirm(t('game.confirm.attackPlayer', { name: reisAdi }))) return;
  var sonucEl = document.getElementById('profilSaldirSonuc');
  if (sonucEl) {
    sonucEl.innerHTML = '<div class="saldiri-sonuc saldiri-sonuc--bekliyor">' + escHtml(t('game.profil.attackPending')) + '</div>';
  }
  var ef = await sunucuAksiyon('dusmana_cok', null, null, { hedef: reisAdi, sessizHata: true });
  if (ef === null) {
    if (sonucEl && !sonucEl.textContent.trim()) sonucEl.innerHTML = '';
    return;
  }
  if (ef.hata) {
    profilSaldirSonucGoster(tr(ef.mesaj || ef.error) || t('game.toast.attackFailed'), 'hata');
    return;
  }
  sesCal('saldiri');
  profilSaldirSonucGoster(tr(ef.mesaj) || t('game.toast.attackComplete'), ef.kazandi ? 'basari' : 'kayip');
}

function profilSaldirSonucGoster(mesaj, tip) {
  var el = document.getElementById('profilSaldirSonuc');
  if (!el) return;
  var tipCls =
    tip === 'basari'
      ? ' saldiri-sonuc--basari'
      : tip === 'hata'
        ? ' saldiri-sonuc--hata'
        : tip === 'kayip'
          ? ' saldiri-sonuc--kayip'
          : '';
  el.innerHTML =
    '<div class="saldiri-sonuc' +
    tipCls +
    '">' +
    escHtml(String(mesaj || '')).replace(/\n/g, '<br>') +
    '</div>';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function profilIstihbaratSonucGoster(html, tip) {
  var el = document.getElementById('profilSaldirSonuc');
  if (!el) return;
  var tipCls =
    tip === 'basari'
      ? ' saldiri-sonuc--basari'
      : tip === 'hata'
        ? ' saldiri-sonuc--hata'
        : ' saldiri-sonuc--kayip';
  el.innerHTML = '<div class="saldiri-sonuc' + tipCls + '">' + html + '</div>';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function profilZiyaretIstihbarat(reisAdi) {
  if (!reisAdi) return;
  if (String(reisAdi).toLowerCase() === String(aktifReisAdi || '').toLowerCase()) {
    profilSaldirSonucGoster(t('game.profil.intelSelf'), 'hata');
    return;
  }
  var sonucEl = document.getElementById('profilSaldirSonuc');
  if (sonucEl) {
    sonucEl.innerHTML = '<div class="saldiri-sonuc saldiri-sonuc--bekliyor">' + escHtml(t('game.profil.intelSending')) + '</div>';
  }
  var ef = await sunucuAksiyon('istihbarat_spy', null, null, { hedef: reisAdi, sessizHata: true });
  if (ef === null) {
    if (sonucEl && !sonucEl.textContent.trim()) sonucEl.innerHTML = '';
    return;
  }
  if (ef.hata) {
    profilSaldirSonucGoster(tr(ef.mesaj || ef.error) || t('game.toast.intelFailed'), 'hata');
    return;
  }
  if (ef.basari) {
    if (ef.guc !== null && ef.guc !== undefined) {
      profilIstihbaratSonucGoster(
        escHtml(ef.mesaj) + '<span class="istih-sonuc-guc">⚔️ ' + escHtml(t('game.profil.power')) + ': ' + fmt(ef.guc) + '</span>',
        'basari'
      );
    } else {
      profilIstihbaratSonucGoster(escHtml(tr(ef.mesaj)), 'kayip');
    }
  } else {
    profilIstihbaratSonucGoster(escHtml(tr(ef.mesaj) || t('game.toast.intelUnavailable')), 'hata');
  }
}

function profilZiyaretMesajAc() {
  var alan = document.getElementById('profilZiyaretMesajAlani');
  if (!alan) return;
  alan.classList.toggle('gizli');
  if (!alan.classList.contains('gizli')) {
    var metin = document.getElementById('profilZiyaretMesajMetin');
    if (metin) metin.focus();
  }
}

async function profilZiyaretMesajGonder() {
  var wrap = document.querySelector('.profil-wrap[data-profil-hedef-adi]');
  var hedef = wrap ? wrap.getAttribute('data-profil-hedef-adi') : '';
  var metinEl = document.getElementById('profilZiyaretMesajMetin');
  var metin = metinEl ? metinEl.value.trim() : '';
  if (!hedef || !metin) {
    toast(t('game.toast.messageRequired'), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('mesaj_gonder', null, null, { hedef: hedef, metin: metin });
  if (ef === null) return;
  toast(t('game.toast.messageSent'), 'basari');
  if (metinEl) metinEl.value = '';
  var alan = document.getElementById('profilZiyaretMesajAlani');
  if (alan) alan.classList.add('gizli');
}

async function oyuncuProfilGoster(userId) {
  profilIcraatTimerDurdur();
  profilQuillYokEt();
  aktifEkran = 'profil_ziyaret';
  masterFramePlaqueGuncelle('profilim', t('game.screen.profilVisit'));
  var ic = document.getElementById('anaIcerik');
  ic.innerHTML = '<div class="profil-wrap"><p style="color:#888;padding:24px;text-align:center;">' + escHtml(t('game.loading')) + '</p></div>';
  try {
    await profilLiderlikOyunculariYukle();
    var res = await apiFetch('/api/profile/' + encodeURIComponent(String(userId)));
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok || !data.profil) throw new Error(data.error || t('game.error.profileLoadFailed'));
    var p = data.profil;
    ic.innerHTML = profilEkranSablonu({
      duzenlenebilir: false,
      ziyaretciModu: String(p.userId) !== String(window.__benimUserId),
      userId: p.userId,
      profilResmi: p.profilResmi,
      oyuncuAdi: p.oyuncuAdi,
      lakap: p.lakap,
      guc: p.guc,
      puan: p.puan,
      sira: p.sira,
      grupSira: p.grupSira,
      grup: p.grup,
      grupId: p.grupId,
      aciklama: p.aciklama,
      dostlar: p.dostlar,
      dusmanlar: p.dusmanlar,
      kayitTarihi: p.kayitTarihi,
      kayitUlkesi: p.kayitUlkesi,
      oyunDili: p.oyunDili,
      sehirEfsane: p.sehirEfsane,
      karaListede: p.karaListede,
      isDurumu: p.isDurumu
    });
    await profilSiralamaAlanlariGuncelle(p);
    profilLocaleAlanGuncelle(p);
    profilAciklamaGosterUygula(p.aciklama);
    var z = document.getElementById('profilZiyaretlerBox');
    if (z) z.innerHTML = profilZiyaretleriHTML(p.ziyaretler);
  } catch (e) {
    ic.innerHTML = '<div class="profil-wrap"><p style="color:#c00;padding:24px;">' + escHtml(e.message || t('game.error.loadFailed')) + '</p></div>';
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
  ic.innerHTML = '<h2>🏢 ' + baslik + '</h2><p style="color:#888;">' + escHtml(t('game.loading')) + '</p>';
  elitFiyatDurumSenkronize().then(function() {
    if (aktifEkran !== 'sektor_' + sektor) return;
    sektorEkranCizIcerik(ic, sektor, baslik);
  });
}

function sektorEkranCizIcerik(ic, sektor, baslik) {
  var mekanlar = sektorMekanlar(sektor);
  var html = '<h2>🏢 ' + baslik + '</h2><p>' + escHtml(t('game.sektor.quote')) + '</p>' + elitFiyatNotuHTML();
  if (!Object.keys(mekanlar).length) {
    ic.innerHTML = html + '<p style="color:#888;">' + escHtml(t('game.loadingSector')) + '</p>';
    sunucudanYukle().then(function() {
      if (aktifEkran === 'sektor_' + sektor) sektorEkranCizIcerik(ic, sektor, baslik);
    }).catch(function() {
      ic.innerHTML = html + '<p style="color:#c00;">' + escHtml(t('game.sektor.listFailed')) + '</p>';
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
      + '<div class="is-detay"><h3>' + escHtml(tr(m.ad)) + '</h3><p style="color:#888;">' + escHtml(tr(m.aciklama)) + '</p>'
      + '<p>' + escHtml(t('game.sektor.buyPrice')) + ' ' + elitFiyatGosterHtml(bazFiyat) + ' &nbsp;|&nbsp; ' + escHtml(t('game.sektor.owner')) + ' <b>' + adet + '</b>' + escHtml(t('game.sektor.unitWord')) + '</p>'
      + '<p>' + escHtml(t('game.sektor.hourlyReturn')) + ' <b style="color:#28a745;">' + fmt(m.saatlik) + ' TL</b>' + escHtml(t('game.sektor.perUnit')) + '</p>'
      + '<p>' + escHtml(t('game.sektor.respectLabel')) + ' <b>+' + m.sayginlik + '</b>' + escHtml(t('game.sektor.respectFixed')) + '</p>'
      + '<div style="margin-top:8px;">'
      + '<input type="number" id="mekanAdetGir_' + sektor + '_' + key + '" placeholder="' + escHtml(t('game.sektor.qtyPlaceholder')) + '" value="1" min="1" max="999" style="width:60px;padding:4px;margin-right:8px;background:#222;color:#ffd700;border:1px solid #555;">'
      + '<button class="btn-is" onclick="mekanAl(\'' + sektor + '\', \'' + key + '\')">' + escHtml(t('game.sektor.buyBtn')) + '</button>'
      + '</div>'
      + '</div></div></div>';
  });
  ic.innerHTML = html;
}

async function mekanAl(sektor, key) {
  var idStr = 'mekanAdetGir_' + sektor + '_' + key;
  var adetInput = document.getElementById(idStr);
  if (!adetInput) {
    toast(t('game.toast.quantityInputMissing'), 'hata');
    return;
  }
  var adet = parseInt(String(adetInput.value || '').trim(), 10);
  if (!adet || adet < 1) adet = 1;
  if (adet > 999) adet = 999;
  var ef = await sunucuAksiyon('mekan_al', sektor + ':' + key, adet, { adet: adet });
  if (ef) toast(tr(ef.mesaj) || t('game.toast.venuePurchased'), 'basari');
  ekranDegistir('sektor_' + sektor);
}

async function rusvetVer() {
  var el = document.getElementById('rusvetMiktar');
  var miktar = el ? parseInt(el.value, 10) : rusvetBilgi.onerilen;
  if (!miktar || miktar < 1) { toast(t('game.toast.invalidBribe'), 'hata'); return; }
  var ef = await sunucuAksiyon('rusvet_ver', null, null, { miktar: miktar });
  if (ef) toast(tr(ef.mesaj) || t('game.toast.bribeGiven'), 'basari');
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
      toast(tr(data.error) || t('game.toast.passwordUnchanged'), 'hata');
      return;
    }
    toast(t('game.toast.passwordUpdated'), 'basari');
    document.getElementById('sifreAlan').classList.add('gizli');
  } catch (_) {
    toast(t('game.toast.serverError'), 'hata');
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
  if (tip === 'saldiri') return '<span class="sb-mesaj-etiket sb-mesaj-etiket--alarm">' + escHtml(t('game.chat.labelAlarm')) + '</span>';
  if (tip === 'mafya_grup') return '<span class="sb-mesaj-etiket">' + escHtml(t('game.chat.labelGroup')) + '</span>';
  return '<span class="sb-mesaj-etiket">' + escHtml(t('game.chat.labelPrivate')) + '</span>';
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
    html += '<button type="button" class="sb-btn sb-btn--gri sb-btn-kucuk" onclick="mesajCevapla(' + m.id + ', \'' + String(m.gonderenAdi || '').replace(/'/g, "\\'") + '\')">' + escHtml(t('game.chat.reply')) + '</button>';
  }
  if (m.tip === 'mafya_grup') {
    html += '<button type="button" class="sb-btn sb-btn--gri sb-btn-kucuk" onclick="mesajCevapla(' + m.id + ', \'Mafya Grubu\')">' + escHtml(t('game.chat.reply')) + '</button>';
  }
  html += '<button type="button" class="sb-btn sb-btn--kirmizi sb-btn-kucuk" onclick="mesajSil(' + m.id + ')">' + escHtml(t('game.chat.delete')) + '</button>'
    + '</div></article>';
  return html;
}

function mesajKutusuGovdeHTML(liste) {
  var listeHtml = '';
  if (!liste || !liste.length) {
    listeHtml = '<p class="sb-mesaj-bos">' + escHtml(t('game.empty.noMessages')) + '</p>';
  } else {
    liste.forEach(function(m) { listeHtml += sbMesajKartHTML(m); });
  }
  return '<p class="sb-giris">' + escHtml(t('game.chat.inboxIntro')) + '</p>'
    + '<div class="sb-paneller">'
    + '<div class="sb-panel sb-panel--gonder">'
    + '<div class="sb-panel-baslik"><span class="sb-panel-ikon" aria-hidden="true">📤</span><h3>' + escHtml(t('game.chat.sendMessageTitle')) + '</h3></div>'
    + '<div class="sb-alan"><label for="mesajHedef">' + escHtml(t('game.chat.recipient')) + '</label>'
    + '<input type="text" id="mesajHedef" class="sb-input" placeholder="' + escHtml(t('game.chat.playerPlaceholder')) + '" maxlength="24"></div>'
    + '<div class="sb-alan"><label for="mesajMetin">' + escHtml(t('game.profil.yourMessage')) + '</label>'
    + '<textarea id="mesajMetin" class="sb-textarea" rows="3" placeholder="' + escHtml(t('game.profil.messagePlaceholder')) + '" maxlength="500"></textarea></div>'
    + '<button type="button" class="sb-btn sb-btn--mavi" onclick="mesajGonder()">' + escHtml(t('game.chat.sendMessageBtn')) + '</button>'
    + '</div>'
    + '<div class="sb-panel sb-panel--liste">'
    + '<div class="sb-panel-baslik"><span class="sb-panel-ikon" aria-hidden="true">📥</span><h3>' + escHtml(t('game.chat.incomingTitle')) + '</h3></div>'
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
  if (!satirlar) satirlar = '<p class="sb-mesaj-bos">' + escHtml(t('game.chat.salonEmpty')) + '</p>';
  return '<p class="sb-giris">' + t('game.chat.mafiaLoungeIntro') + '</p>'
    + '<div class="sb-meta-bar"><span>' + escHtml(t('game.chat.smsRemaining')) + '</span><strong id="sbSmsGoster">' + fmt(oyuncuSms || 0) + '</strong></div>'
    + '<div class="sb-sohbet-liste" id="sohbetListe">' + satirlar + '</div>'
    + '<div class="sb-panel sb-panel--yaz">'
    + '<div class="sb-panel-baslik"><span class="sb-panel-ikon" aria-hidden="true">✍️</span><h3>' + escHtml(t('game.chat.writeToLounge')) + '</h3></div>'
    + '<div class="sb-alan"><label for="mafyaSohbetMetin">' + escHtml(t('game.profil.yourMessage')) + '</label>'
    + '<textarea id="mafyaSohbetMetin" class="sb-textarea" rows="3" placeholder="' + escHtml(t('game.chat.mafiaChatPlaceholder')) + '" maxlength="400"></textarea></div>'
    + '<button type="button" class="sb-btn sb-btn--yesil" onclick="mafyaSohbetGonder()">' + escHtml(t('game.chat.sendChatBtn')) + '</button>'
    + '</div>';
}

async function mesajKutusuCiz(ic) {
  ic.innerHTML = sbSayfaKabuk(
    sohbetGorseller.mesajKutu,
    '📬',
    escHtml(t('game.chat.inboxTitle')),
    escHtml(t('game.chat.inboxQuote')),
    '<p class="sb-durum">' + escHtml(t('game.loading')) + '</p>'
  );
  if (!sunucuBagli) {
    if (aktifEkran !== 'mesajKutusu') return;
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mesajKutu,
      '📬',
      escHtml(t('game.chat.inboxTitle')),
      escHtml(t('game.chat.inboxQuote')),
      '<p class="sb-durum sb-durum--hata">' + t('game.error.serverOfflineLogin') + '</p>'
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
      escHtml(t('game.chat.inboxTitle')),
      escHtml(t('game.chat.inboxQuote')),
      mesajKutusuGovdeHTML(data.liste)
    );
  } catch (e) {
    if (aktifEkran !== 'mesajKutusu') return;
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mesajKutu,
      '📬',
      escHtml(t('game.chat.inboxTitle')),
      escHtml(t('game.chat.inboxQuote')),
      '<p class="sb-durum sb-durum--hata">' + escHtml(t('game.chat.messagesLoadFailed')) + ' ' + escHtml(e.message || t('game.error.connectionFailed')) + '</p>'
      + '<p class="sb-durum" style="margin-top:10px;">' + escHtml(t('game.chat.serverHint')) + '</p>'
    );
  }
}

async function mesajGonder() {
  var hedef = document.getElementById('mesajHedef').value.trim();
  var metin = document.getElementById('mesajMetin').value.trim();
  if (!hedef || !metin) { toast(t('game.toast.targetAndMessageRequired'), 'hata'); return; }
  var ef = await sunucuAksiyon('mesaj_gonder', null, null, { hedef: hedef, metin: metin });
  if (ef !== null) {
    toast(t('game.toast.messageSent'), 'basari');
    sohbetMenuAc();
    ekranDegistir('mesajKutusu');
  }
}

async function mesajSil(id) {
  await sunucuAksiyon('mesaj_sil', String(id));
  ekranDegistir('mesajKutusu');
}

function mesajCevapla(id, ad) {
  var metin = prompt(t('game.chat.replyPrompt', { name: ad }));
  if (!metin) return;
  sunucuAksiyon('mesaj_cevapla', String(id), null, { metin: metin }).then(function(ef) {
    if (ef !== null) ekranDegistir('mesajKutusu');
  });
}

async function mafyaSohbetCiz(ic) {
  ic.innerHTML = sbSayfaKabuk(
    sohbetGorseller.mafyaMasa,
    '',
    escHtml(t('game.chat.mafiaChatTitle')),
    escHtml(t('game.chat.mafiaChatQuote')),
    '<p class="sb-durum">' + escHtml(t('game.loadingChat')) + '</p>'
  );
  if (!sunucuBagli) {
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mafyaMasa,
      '',
      escHtml(t('game.chat.mafiaChatTitle')),
      escHtml(t('game.chat.mafiaChatQuote')),
      '<p class="sb-durum sb-durum--hata">' + t('game.error.serverOfflineShort') + '</p>'
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
      escHtml(t('game.chat.mafiaChatTitle')),
      escHtml(t('game.chat.mafiaChatQuote')),
      mafyaSohbetGovdeHTML(data.liste)
    );
    var liste = document.getElementById('sohbetListe');
    if (liste) liste.scrollTop = liste.scrollHeight;
  } catch (e) {
    ic.innerHTML = sbSayfaKabuk(
      sohbetGorseller.mafyaMasa,
      '',
      escHtml(t('game.chat.mafiaChatTitle')),
      escHtml(t('game.chat.mafiaChatQuote')),
      '<p class="sb-durum sb-durum--hata">' + escHtml(t('game.chat.chatLoadFailed')) + ' ' + escHtml(e.message || t('game.error.connectionFailed')) + '</p>'
      + '<p class="sb-durum" style="margin-top:10px;">' + escHtml(t('game.chat.serverHintShort')) + '</p>'
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
    yuk.innerHTML = t('auth.loadingEmpire');
  }
  var yukTimeout = setTimeout(function () {
    if (yuk && !yuk.classList.contains('gizli')) {
      sunucuBagli = false;
      yuk.innerHTML =
        t('game.error.serverOfflineSession')
        + '<br><br><button type="button" onclick="location.reload()" style="margin-top:12px;padding:10px 18px;cursor:pointer;background:#8b1e1e;color:#fff;border:none;border-radius:6px;font-weight:600">' + escHtml(t('auth.rules.close')) + '</button>';
    }
  }, 15000);
  try {
    var health = await fetch('/api/health', { credentials: 'include' });
    if (!health.ok) throw new Error(t('game.error.connectionFailed'));
    await sunucudanYukle({ bootstrap: true });
    clearTimeout(yukTimeout);
    if (yuk) yuk.classList.add('gizli');
    sesUiGuncelle();
    if (sesAyar.acik) muzikBaslat();
    else muzikDurdur();
    guncelleBgIsim();
    statTooltipBagla();
    mobilNavBagla();
    if (typeof window.bildirimBaslat === "function") window.bildirimBaslat();
    ekranDegistir('liderlik');
    if (window.TutorialEngine) {
      if (window.__yeniKayitOlundu) {
        TutorialEngine.reset();
        window.__yeniKayitOlundu = false;
      }
      if (!TutorialEngine.isComplete()) {
        var tutorialBekle = function () {
          if (hosgeldinAcikMi()) {
            setTimeout(tutorialBekle, 400);
            return;
          }
          TutorialEngine.open({ force: true, navigate: false });
        };
        setTimeout(tutorialBekle, 600);
      }
    }
  } catch (e) {
    clearTimeout(yukTimeout);
    sunucuBagli = false;
    if (e && e.message === 'AUTH_BOOTSTRAP_FAIL') {
      document.getElementById('masterLayout').classList.add('gizli');
      if (typeof authEkraniniGoster === 'function') authEkraniniGoster();
      if (typeof authHataGoster === 'function') {
        authHataGoster(t('auth.sessionSaveFailed'));
      }
      if (yuk) yuk.classList.add('gizli');
      return;
    }
    if (yuk) {
      yuk.innerHTML =
        t('game.error.serverOfflineSession')
        + '<br><br><button type="button" onclick="cikisYap()" style="margin-top:12px;padding:10px 18px;cursor:pointer;background:#1a1624;color:#c5a059;border:1px solid #c5a059;border-radius:6px;font-weight:600">' + escHtml(t('game.error.returnToLogin')) + '</button>';
    }
  }
}

window.ekranDegistir = ekranDegistir;
