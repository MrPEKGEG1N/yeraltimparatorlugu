/* global apiFetch, sunucuAksiyon, t, escHtml, fmt, toastGoster */

var sabotajPanelVeri = null;
var sabotajAktifKategori = 'siber';
var sabotajSayacTimer = null;

function sabotajEtkiMetni(etkiTip) {
  var map = {
    kasa_oran: t('game.sabotaj.effect.cash'),
    banka_oran: t('game.sabotaj.effect.bank'),
    borsa_oran: t('game.sabotaj.effect.stocks'),
    puan_oran: t('game.sabotaj.effect.respect'),
    icraat_dus: t('game.sabotaj.effect.icraat'),
    avukat_dus: t('game.sabotaj.effect.lawyer'),
    sms_oran: t('game.sabotaj.effect.sms'),
    guc_oran: t('game.sabotaj.effect.power'),
    yetenek_oran: t('game.sabotaj.effect.stats')
  };
  return map[etkiTip] || etkiTip;
}

function sabotajHedefKaybiMetni(etkiTip, etkiDeger) {
  var p = (etkiDeger || 0) * 100;
  var pct = (p > 0 && p < 1) ? (p.toFixed(1).replace(/\.0$/, '') + '%') : (Math.round(p) + '%');
  var map = {
    kasa_oran: t('game.sabotaj.lossCash', { pct: pct }),
    banka_oran: t('game.sabotaj.lossBank', { pct: pct }),
    borsa_oran: t('game.sabotaj.lossStocks', { pct: pct }),
    puan_oran: t('game.sabotaj.lossRespect', { pct: pct }),
    icraat_dus: t('game.sabotaj.lossIcraat', { n: Math.floor(etkiDeger || 0) }),
    avukat_dus: t('game.sabotaj.lossLawyer', { n: Math.floor(etkiDeger || 0) }),
    sms_oran: t('game.sabotaj.lossSms', { pct: pct }),
    guc_oran: t('game.sabotaj.lossPower', { pct: pct }),
    yetenek_oran: t('game.sabotaj.lossStats', { pct: pct })
  };
  return map[etkiTip] || '—';
}

function sabotajSureMetin(sn) {
  if (sn >= 3600) return Math.round(sn / 3600) + t('game.sabotaj.hourUnit');
  return Math.ceil(sn / 60) + t('game.sabotaj.minuteUnit');
}

function sabotajKalanMetin(sn) {
  if (sn <= 0) return t('game.sabotaj.finishing');
  var dk = Math.floor(sn / 60);
  var s = sn % 60;
  if (dk > 0) return dk + t('game.sabotaj.minuteUnit') + ' ' + s + t('game.sabotaj.secondUnit');
  return s + t('game.sabotaj.secondUnit');
}

function sabotajSonucGoster(html, tip) {
  var el = document.getElementById('sabotajSonuc');
  if (!el) return;
  el.className = 'sb-sonuc sb-sonuc--' + (tip || 'uyari');
  el.innerHTML = html;
  el.classList.remove('gizli');
}

function sabotajTurKartHTML(tur) {
  var hedefInput = document.getElementById('sabotajHedef');
  var aktifVar = sabotajPanelVeri && sabotajPanelVeri.aktifIs;
  var html = '<article class="sb-tur-kart">'
    + '<h4>' + escHtml(tur.ad) + '</h4>'
    + '<span class="sb-tur-karakter">' + escHtml(tur.karakter) + '</span>'
    + '<p class="sb-tur-aciklama">' + escHtml(tur.aciklama) + '</p>'
    + '<p class="sb-tur-aciklama"><b>' + escHtml(sabotajEtkiMetni(tur.etkiTip)) + '</b></p>'
    + '<div class="sb-plan-satir">';
  tur.asamalar.forEach(function(plan) {
    var disabled = aktifVar ? ' disabled' : '';
    html += '<button type="button" class="sb-plan-btn"' + disabled
      + ' onclick="sabotajBaslat(\'' + tur.id + '\',' + plan.seviye + ')">'
      + escHtml(plan.etiket)
      + '<span class="sb-plan-maliyet sb-plan-maliyet--ucret">'
      + escHtml(t('game.sabotaj.planCost')) + ' ' + fmtMoney(plan.kasaMaliyet) + ' · '
      + plan.icraat + ' ' + t('game.sabotaj.icraatShort')
      + ' · ' + sabotajSureMetin(plan.sureSn)
      + '</span>'
      + '<span class="sb-plan-maliyet sb-plan-maliyet--hedef">'
      + escHtml(t('game.sabotaj.targetLoss')) + ' ' + escHtml(plan.hedefKaybi || sabotajHedefKaybiMetni(tur.etkiTip, plan.etkiDeger))
      + (plan.paraSanaGecer ? ' · ' + escHtml(t('game.sabotaj.stealToYou')) : '')
      + '</span></button>';
  });
  html += '</div></article>';
  return html;
}

function sabotajSekmeIcerikCiz() {
  var govde = document.getElementById('sabotajSekmeIcerik');
  if (!govde || !sabotajPanelVeri) return;
  var kat = (sabotajPanelVeri.kategoriler || []).find(function(k) { return k.id === sabotajAktifKategori; });
  var turler = (sabotajPanelVeri.turler || []).filter(function(tur) { return tur.kategori === sabotajAktifKategori; });
  var html = '';
  if (kat) {
    html += '<p class="sb-kat-aciklama">' + escHtml(kat.ikon + ' ' + kat.aciklama) + '</p>';
  }
  html += '<div class="sb-tur-grid">';
  turler.forEach(function(tur) { html += sabotajTurKartHTML(tur); });
  html += '</div>';
  govde.innerHTML = html;
}

function sabotajSekmeDegistir(katId) {
  sabotajAktifKategori = katId;
  document.querySelectorAll('#sabotajSekmeler .sb-sekme').forEach(function(btn) {
    btn.classList.toggle('sb-sekme--aktif', btn.getAttribute('data-kat') === katId);
  });
  sabotajSekmeIcerikCiz();
}

function sabotajAktifKartGuncelle() {
  var kutu = document.getElementById('sabotajAktifKart');
  if (!kutu || !sabotajPanelVeri) return;
  var aktif = sabotajPanelVeri.aktifIs;
  if (!aktif) {
    kutu.classList.add('gizli');
    kutu.innerHTML = '';
    return;
  }
  kutu.classList.remove('gizli');
  kutu.innerHTML = '<h3>⏳ ' + escHtml(t('game.sabotaj.activeTitle')) + '</h3>'
    + '<p><b>' + escHtml(aktif.turAdi) + '</b> → ' + escHtml(aktif.hedefAdi) + '</p>'
    + '<p>' + escHtml(t('game.sabotaj.remaining')) + ' <b id="sabotajKalanTxt">' + escHtml(sabotajKalanMetin(aktif.kalanSn)) + '</b></p>'
    + '<button type="button" class="sb-iptal-btn" onclick="sabotajIptal()">' + escHtml(t('game.sabotaj.cancel')) + '</button>';
}

function sabotajSayacBaslat() {
  if (sabotajSayacTimer) clearInterval(sabotajSayacTimer);
  sabotajSayacTimer = setInterval(function() {
    if (!sabotajPanelVeri || !sabotajPanelVeri.aktifIs) return;
    var a = sabotajPanelVeri.aktifIs;
    if (a.kalanSn > 0) {
      a.kalanSn -= 1;
      var el = document.getElementById('sabotajKalanTxt');
      if (el) el.textContent = sabotajKalanMetin(a.kalanSn);
    } else {
      sabotajPanelYukle(true);
    }
  }, 1000);
}

function sabotajPanelHTML() {
  var bannerSrc = '/images/sabotaj/sabotaj-banner.png?v=1';
  return '<div class="sb-sayfa"><div class="sb-cerceve">'
    + '<div class="sb-hero">'
    + '<img class="sb-hero-img" src="' + bannerSrc + '" alt="' + escHtml(t('screen.sabotaj')) + '" onerror="imgFallback(this)">'
    + '<div class="sb-hero-ortu" aria-hidden="true"></div>'
    + '<header class="sb-hero-baslik">'
    + '<h2>💣 ' + escHtml(t('screen.sabotaj')) + '</h2>'
    + '<p class="sb-banner-alt">' + escHtml(t('game.sabotaj.subtitle')) + '</p>'
    + '</header></div>'
    + '<div class="sb-guc-satir">'
    + '<div class="sb-guc-kutu"><div class="sb-guc-etiket">' + escHtml(t('game.sabotaj.attackPower')) + '</div>'
    + '<div class="sb-guc-deger" id="sabotajSaldiriGuc">—</div></div>'
    + '<div class="sb-guc-kutu sb-guc-kutu--savunma"><div class="sb-guc-etiket">' + escHtml(t('game.sabotaj.defensePower')) + '</div>'
    + '<div class="sb-guc-deger" id="sabotajSavunmaGuc">—</div></div>'
    + '</div>'
    + '<div class="sb-guc-ipucu">'
    + '<p><b>' + escHtml(t('game.sabotaj.attackPower')) + ' ↑</b> ' + escHtml(t('game.sabotaj.attackBoostTip')) + '</p>'
    + '<p><b>' + escHtml(t('game.sabotaj.defensePower')) + ' ↑</b> ' + escHtml(t('game.sabotaj.defenseBoostTip')) + '</p>'
    + '</div>'
    + '<div class="sb-hedef-alan">'
    + '<p class="sb-kat-aciklama">' + escHtml(t('game.sabotaj.targetHint')) + '</p>'
    + '<div class="sb-hedef-satir">'
    + '<input type="text" id="sabotajHedef" class="sb-hedef-input" maxlength="24" autocomplete="off" placeholder="' + escHtml(t('game.sabotaj.targetPlaceholder')) + '">'
    + '</div></div>'
    + '<div id="sabotajAktifKart" class="sb-aktif-kart gizli"></div>'
    + '<div class="sb-sekmeler" id="sabotajSekmeler"></div>'
    + '<div class="sb-sekme-icerik" id="sabotajSekmeIcerik"><p style="color:#888;text-align:center;">' + escHtml(t('game.loading')) + '</p></div>'
    + '<div id="sabotajSonuc" class="sb-sonuc gizli"></div>'
    + '</div></div>';
}

async function sabotajPanelYukle(sessiz) {
  try {
    var res = await apiFetch('/api/sabotaj/panel');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || t('game.error.loadFailed'));
    sabotajPanelVeri = data;
    var salEl = document.getElementById('sabotajSaldiriGuc');
    var savEl = document.getElementById('sabotajSavunmaGuc');
    if (salEl) salEl.textContent = String(data.saldiriGucu || 0);
    if (savEl) savEl.textContent = String(data.savunmaGucu || 0);
    var sekmeler = document.getElementById('sabotajSekmeler');
    if (sekmeler && !sekmeler.childElementCount) {
      (data.kategoriler || []).forEach(function(kat) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sb-sekme' + (kat.id === sabotajAktifKategori ? ' sb-sekme--aktif' : '');
        btn.setAttribute('data-kat', kat.id);
        btn.textContent = kat.ikon + ' ' + kat.ad;
        btn.onclick = function() { sabotajSekmeDegistir(kat.id); };
        sekmeler.appendChild(btn);
      });
    }
    sabotajAktifKartGuncelle();
    sabotajSekmeIcerikCiz();
    sabotajSayacBaslat();
    if (!sessiz && (data.puan || 0) < (data.minPuan || 500)) {
      sabotajSonucGoster(escHtml(t('game.sabotaj.minPuanWarn', { min: fmt(data.minPuan) })), 'uyari');
    }
  } catch (e) {
    if (!sessiz) sabotajSonucGoster(escHtml(e.message || t('game.error.loadFailed')), 'hata');
  }
}

function sabotajEkranBagla() {
  sabotajAktifKategori = 'siber';
  sabotajPanelYukle();
  var input = document.getElementById('sabotajHedef');
  if (input) {
    setTimeout(function() { input.focus(); }, 60);
  }
}

async function sabotajBaslat(turId, asama) {
  var hedefEl = document.getElementById('sabotajHedef');
  var hedef = hedefEl ? hedefEl.value.trim() : '';
  if (!hedef) {
    sabotajSonucGoster(escHtml(t('game.sabotaj.needTarget')), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('sabotaj_baslat', null, null, { hedef: hedef, turId: turId, asama: asama });
  if (!ef) return;
  if (ef.mesaj) sabotajSonucGoster(escHtml(ef.mesaj), 'ok');
  await sabotajPanelYukle(true);
}

async function sabotajIptal() {
  var ef = await sunucuAksiyon('sabotaj_iptal');
  if (!ef) return;
  if (ef.mesaj) sabotajSonucGoster(escHtml(ef.mesaj), 'uyari');
  await sabotajPanelYukle(true);
}

function sabotajEkranAc(ic) {
  ic.innerHTML = sabotajPanelHTML();
  sabotajEkranBagla();
}
