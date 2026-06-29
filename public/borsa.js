/* global apiFetch, sunucuAksiyon, t, escHtml, fmt, toast, oyuncuKasa */

var borsaPanelVeri = null;
var borsaAktifSekme = 'piyasa';
var borsaYenileTimer = null;

function borsaDegisimHTML(degisim) {
  var n = Number(degisim) || 0;
  var cls = n > 0 ? 'br-degisim--artis' : (n < 0 ? 'br-degisim--dusus' : 'br-degisim--notr');
  var isaret = n > 0 ? '+' : '';
  return '<span class="br-degisim ' + cls + '">' + isaret + n.toFixed(1) + '%</span>';
}

function borsaKarZararHTML(tutar) {
  var n = Number(tutar) || 0;
  var cls = n >= 0 ? 'br-kz--kar' : 'br-kz--zarar';
  var isaret = n >= 0 ? '+' : '';
  return '<span class="br-kz ' + cls + '">' + isaret + fmt(n) + ' TL</span>';
}

function borsaSonucGoster(html, tip) {
  var el = document.getElementById('borsaSonuc');
  if (!el) return;
  el.className = 'br-sonuc br-sonuc--' + (tip || 'uyari');
  el.innerHTML = html;
  el.classList.remove('gizli');
}

function borsaOzetVeri() {
  return (borsaPanelVeri && borsaPanelVeri.ozet) || {};
}

function borsaKullanilabilirKasa() {
  var oz = borsaOzetVeri();
  if (oz.kullanilabilirKasa != null) return Number(oz.kullanilabilirKasa) || 0;
  return Number(oyuncuKasa) || 0;
}

function borsaOzetGuncelle() {
  if (!borsaPanelVeri) return;
  var oz = borsaOzetVeri();
  var kasaEl = document.getElementById('borsaKasaGoster');
  var degerEl = document.getElementById('borsaToplamDeger');
  var kzEl = document.getElementById('borsaToplamKZ');
  var pozEl = document.getElementById('borsaPozisyonSayisi');
  var emirEl = document.getElementById('borsaEmirSayisi');
  var kasaGoster = oz.kasa != null ? oz.kasa : oyuncuKasa;
  if (kasaEl) {
    kasaEl.innerHTML = fmt(kasaGoster) + ' TL'
      + (oz.bekleyenAlMaliyet > 0
        ? '<span class="br-ozet-alt">' + escHtml(t('game.borsa.reservedCash', { n: fmt(oz.bekleyenAlMaliyet) })) + '</span>'
        : '');
  }
  if (degerEl) degerEl.textContent = fmt(oz.toplamDeger || 0) + ' TL';
  if (kzEl) kzEl.innerHTML = borsaKarZararHTML(oz.karZarar || 0);
  if (pozEl) pozEl.textContent = String(oz.pozisyonSayisi || 0);
  if (emirEl) emirEl.textContent = String(oz.emirSayisi || 0);
  borsaSekmeBadgeleriGuncelle();
}

function borsaSekmeBadgeleriGuncelle() {
  var oz = borsaOzetVeri();
  var emirBadge = document.getElementById('borsaEmirBadge');
  var portBadge = document.getElementById('borsaPortfoyBadge');
  var emirSay = oz.emirSayisi || 0;
  var pozSay = oz.pozisyonSayisi || 0;
  if (emirBadge) {
    emirBadge.textContent = String(emirSay);
    emirBadge.classList.toggle('gizli', emirSay <= 0);
  }
  if (portBadge) {
    portBadge.textContent = String(pozSay);
    portBadge.classList.toggle('gizli', pozSay <= 0);
  }
}

function borsaMaxAlinabilir(fiyat) {
  var f = Number(fiyat) || 0;
  if (f <= 0) return 0;
  return Math.floor(borsaKullanilabilirKasa() / f);
}

function borsaSatilabilirAdet(sirketId) {
  var s = (borsaPanelVeri.sirketler || []).find(function(x) { return x.id === sirketId; });
  if (s && s.satilabilirAdet != null) return Number(s.satilabilirAdet) || 0;
  var port = (borsaPanelVeri.portfoy || []).find(function(p) { return p.sirketId === sirketId; });
  if (port && port.satilabilirAdet != null) return Number(port.satilabilirAdet) || 0;
  return port ? Number(port.adet) || 0 : 0;
}

function borsaLimitSatirHTML(sirketId, guncelFiyat, satilabilirAdet) {
  var satMax = Math.max(0, Number(satilabilirAdet) || 0);
  return '<div class="br-islem-baslik">' + escHtml(t('game.borsa.limitSection')) + '</div>'
    + '<div class="br-islem-satir br-islem-satir--limit">'
    + '<label class="br-input-etiket">' + escHtml(t('game.borsa.colTargetPrice')) + '</label>'
    + '<input type="number" id="borsaEmirFiyat_' + sirketId + '" class="br-fiyat-input" min="10" step="1" value="' + guncelFiyat + '" inputmode="numeric" placeholder="' + escHtml(t('game.borsa.pricePlaceholder')) + '">'
    + '<label class="br-input-etiket">' + escHtml(t('game.borsa.colShares')) + '</label>'
    + '<input type="number" id="borsaEmirAdet_' + sirketId + '" class="br-adet-input" min="1"' + (satMax > 0 ? (' max="' + satMax + '"') : '') + ' value="1" inputmode="numeric">'
    + '<div class="br-islem-butonlar">'
    + '<button type="button" class="br-btn br-btn--al" onclick="borsaEmirVer(\'' + sirketId + '\', \'al\')">' + escHtml(t('game.borsa.orderBuy')) + '</button>'
    + (satMax > 0
      ? '<button type="button" class="br-btn br-btn--sat" onclick="borsaEmirVer(\'' + sirketId + '\', \'sat\')">' + escHtml(t('game.borsa.orderSell')) + '</button>'
      : '')
    + '</div></div>';
}

function borsaPiyasaKartHTML(s) {
  var port = (borsaPanelVeri.portfoy || []).find(function(p) { return p.sirketId === s.id; });
  var elde = port ? port.adet : (s.elde || 0);
  var satilabilir = s.satilabilirAdet != null ? s.satilabilirAdet : borsaSatilabilirAdet(s.id);
  var maxAl = borsaMaxAlinabilir(s.fiyat);
  var bekleyenSat = s.bekleyenSatAdet || (port && port.bekleyenSatAdet) || 0;

  return '<article class="br-hisse">'
    + '<div class="br-hisse-ust">'
    + '<div class="br-hisse-kimlik">'
    + '<span class="br-ticker">' + escHtml(s.id) + '</span>'
    + '<div class="br-ad"><b>' + escHtml(s.ad) + '</b><span class="br-sektor">' + escHtml(s.sektor) + '</span></div>'
    + '</div>'
    + '<div class="br-hisse-chips">'
    + '<span class="br-chip br-chip--temettu">% ' + (s.temettuYuzde || 0) + ' ' + escHtml(t('game.borsa.colDividend')) + '</span>'
    + (elde > 0 ? '<span class="br-chip br-chip--elde">' + escHtml(t('game.borsa.owned', { n: fmt(elde) })) + '</span>' : '')
    + (bekleyenSat > 0 ? '<span class="br-chip br-chip--bekleyen">' + escHtml(t('game.borsa.pendingSellShares', { n: fmt(bekleyenSat) })) + '</span>' : '')
    + '</div>'
    + '<div class="br-hisse-fiyat">'
    + '<div class="br-fiyat">' + fmt(s.fiyat) + ' <small>TL</small></div>'
    + borsaDegisimHTML(s.degisim)
    + '</div>'
    + '</div>'
    + (s.aciklama ? '<p class="br-hisse-aciklama">' + escHtml(s.aciklama) + '</p>' : '')
    + '<div class="br-hisse-alt">'
    + '<div class="br-islem-kolon">'
    + '<div class="br-islem-baslik">' + escHtml(t('game.borsa.instantTrade')) + '</div>'
    + '<div class="br-islem-satir">'
    + '<input type="number" id="borsaAlAdet_' + s.id + '" class="br-adet-input" min="1" value="1" inputmode="numeric" placeholder="' + escHtml(t('game.borsa.amountPlaceholder')) + '">'
    + '<span class="br-max-hint">' + escHtml(t('game.borsa.maxShort', { n: fmt(maxAl) })) + '</span>'
    + '<div class="br-islem-butonlar">'
    + '<button type="button" class="br-btn br-btn--al" onclick="borsaAl(\'' + s.id + '\')">' + escHtml(t('game.borsa.buy')) + '</button>'
    + (satilabilir > 0
      ? '<button type="button" class="br-btn br-btn--sat" onclick="borsaSat(\'' + s.id + '\')">' + escHtml(t('game.borsa.sell')) + '</button>'
      : '')
    + '</div></div>'
    + (satilabilir <= 0 && elde > 0
      ? '<p class="br-mini-uyari">' + escHtml(t('game.borsa.noSellableShares')) + '</p>'
      : '')
    + '</div>'
    + '<div class="br-islem-kolon br-islem-kolon--limit">'
    + borsaLimitSatirHTML(s.id, s.fiyat, satilabilir)
    + '</div>'
    + '</div>'
    + '</article>';
}

function borsaPiyasaCiz() {
  var govde = document.getElementById('borsaSekmeIcerik');
  if (!govde || !borsaPanelVeri) return;
  var sirketler = borsaPanelVeri.sirketler || [];
  var html = '<p class="br-ipucu">' + escHtml(t('game.borsa.marketHint')) + '</p>'
    + '<div class="br-hisse-liste">';
  sirketler.forEach(function(s) { html += borsaPiyasaKartHTML(s); });
  html += '</div>';
  govde.innerHTML = html;
}

function borsaPortfoySatirHTML(p) {
  var satilabilir = p.satilabilirAdet != null ? p.satilabilirAdet : p.adet;
  return '<tr>'
    + '<td class="br-ticker">' + escHtml(p.sirketId) + '</td>'
    + '<td class="br-ad"><b>' + escHtml(p.ad) + '</b><span class="br-sektor">' + escHtml(p.sektor) + '</span></td>'
    + '<td>' + fmt(p.adet) + '</td>'
    + '<td>' + fmt(p.ortalamaMaliyet) + ' TL</td>'
    + '<td>' + fmt(p.fiyat) + ' TL</td>'
    + '<td>' + fmt(p.deger) + ' TL</td>'
    + '<td>' + borsaKarZararHTML(p.karZarar) + '</td>'
    + '<td class="br-islem">'
    + '<div class="br-islem-satir">'
    + '<input type="number" id="borsaSatAdetPf_' + p.sirketId + '" class="br-adet-input" min="1" max="' + satilabilir + '" value="1" inputmode="numeric">'
    + '<button type="button" class="br-btn br-btn--sat" onclick="borsaSat(\'' + p.sirketId + '\', true)">' + escHtml(t('game.borsa.sell')) + '</button>'
    + '</div>'
    + borsaLimitSatirHTML(p.sirketId, p.fiyat, satilabilir)
    + '</td></tr>';
}

function borsaPortfoyCiz() {
  var govde = document.getElementById('borsaSekmeIcerik');
  if (!govde || !borsaPanelVeri) return;
  var portfoy = borsaPanelVeri.portfoy || [];
  if (!portfoy.length) {
    govde.innerHTML = '<p class="br-bos">' + escHtml(t('game.borsa.emptyPortfolio')) + '</p>';
    return;
  }
  var html = '<div class="br-tablo-wrap"><table class="br-tablo br-tablo--portfoy">'
    + '<thead><tr>'
    + '<th>' + escHtml(t('game.borsa.colTicker')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colCompany')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colShares')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colAvgCost')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colPrice')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colValue')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colPL')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colTrade')) + '</th>'
    + '</tr></thead><tbody>';
  portfoy.forEach(function(p) { html += borsaPortfoySatirHTML(p); });
  html += '</tbody></table></div>';
  govde.innerHTML = html;
}

function borsaEmirSatirHTML(e) {
  var turMetin = e.tur === 'sat' ? t('game.borsa.orderTypeSell') : t('game.borsa.orderTypeBuy');
  var turCls = e.tur === 'sat' ? 'br-emir-tur--sat' : 'br-emir-tur--al';
  return '<tr>'
    + '<td class="br-ticker">' + escHtml(e.sirketId) + '</td>'
    + '<td class="br-ad"><b>' + escHtml(e.ad) + '</b></td>'
    + '<td><span class="br-emir-tur ' + turCls + '">' + escHtml(turMetin) + '</span></td>'
    + '<td>' + fmt(e.adet) + '</td>'
    + '<td class="br-fiyat">' + fmt(e.hedefFiyat) + ' TL</td>'
    + '<td>' + fmt(e.guncelFiyat) + ' TL</td>'
    + '<td><span class="br-emir-durum">' + escHtml(t('game.borsa.orderPending')) + '</span></td>'
    + '<td class="br-islem">'
    + '<button type="button" class="br-btn br-btn--iptal" onclick="borsaEmirIptal(' + e.id + ')">' + escHtml(t('game.borsa.cancelOrder')) + '</button>'
    + '</td>'
    + '</tr>';
}

function borsaEmirlerCiz() {
  var govde = document.getElementById('borsaSekmeIcerik');
  if (!govde || !borsaPanelVeri) return;
  var emirler = borsaPanelVeri.emirler || [];
  if (!emirler.length) {
    govde.innerHTML = '<p class="br-bos">' + escHtml(t('game.borsa.emptyOrders')) + '</p>';
    return;
  }
  var html = '<p class="br-ipucu">' + escHtml(t('game.borsa.ordersHint')) + '</p>'
    + '<div class="br-tablo-wrap"><table class="br-tablo br-tablo--emirler">'
    + '<thead><tr>'
    + '<th>' + escHtml(t('game.borsa.colTicker')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colCompany')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colOrderType')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colShares')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colTargetPrice')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colPrice')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colStatus')) + '</th>'
    + '<th>' + escHtml(t('game.borsa.colTrade')) + '</th>'
    + '</tr></thead><tbody>';
  emirler.forEach(function(e) { html += borsaEmirSatirHTML(e); });
  html += '</tbody></table></div>';
  govde.innerHTML = html;
}

function borsaSekmeIcerikCiz() {
  if (borsaAktifSekme === 'portfoy') borsaPortfoyCiz();
  else if (borsaAktifSekme === 'emirler') borsaEmirlerCiz();
  else borsaPiyasaCiz();
}

function borsaSekmeDegistir(sekme) {
  borsaAktifSekme = sekme;
  document.querySelectorAll('#borsaSekmeler .br-sekme').forEach(function(btn) {
    btn.classList.toggle('br-sekme--aktif', btn.getAttribute('data-sekme') === sekme);
  });
  borsaSekmeIcerikCiz();
}

function borsaYenileBaslat() {
  if (borsaYenileTimer) clearInterval(borsaYenileTimer);
  borsaYenileTimer = setInterval(function() {
    if (typeof aktifEkran !== 'undefined' && aktifEkran === 'borsa') {
      borsaPanelYukle(true);
    }
  }, 60000);
}

function borsaPanelHTML() {
  return '<div class="br-sayfa"><div class="br-cerceve">'
    + '<header class="br-banner">'
    + '<h2>📈 ' + escHtml(t('screen.borsa')) + '</h2>'
    + '<p class="br-banner-alt">' + escHtml(t('game.borsa.subtitle')) + '</p>'
    + '</header>'
    + '<div class="br-ozet-satir">'
    + '<div class="br-ozet-kutu"><div class="br-ozet-etiket">' + escHtml(t('game.borsa.cash')) + '</div>'
    + '<div class="br-ozet-deger" id="borsaKasaGoster">—</div></div>'
    + '<div class="br-ozet-kutu"><div class="br-ozet-etiket">' + escHtml(t('game.borsa.portfolioValue')) + '</div>'
    + '<div class="br-ozet-deger br-ozet-deger--altin" id="borsaToplamDeger">—</div></div>'
    + '<div class="br-ozet-kutu"><div class="br-ozet-etiket">' + escHtml(t('game.borsa.totalPL')) + '</div>'
    + '<div class="br-ozet-deger" id="borsaToplamKZ">—</div></div>'
    + '<div class="br-ozet-kutu"><div class="br-ozet-etiket">' + escHtml(t('game.borsa.positions')) + '</div>'
    + '<div class="br-ozet-deger" id="borsaPozisyonSayisi">0</div></div>'
    + '<div class="br-ozet-kutu"><div class="br-ozet-etiket">' + escHtml(t('game.borsa.tabOrders')) + '</div>'
    + '<div class="br-ozet-deger" id="borsaEmirSayisi">0</div></div>'
    + '</div>'
    + '<p class="br-temettu-not">' + escHtml(t('game.borsa.dividendNote')) + '</p>'
    + '<div class="br-sekmeler" id="borsaSekmeler">'
    + '<button type="button" class="br-sekme br-sekme--aktif" data-sekme="piyasa" onclick="borsaSekmeDegistir(\'piyasa\')">' + escHtml(t('game.borsa.tabMarket')) + '</button>'
    + '<button type="button" class="br-sekme" data-sekme="portfoy" onclick="borsaSekmeDegistir(\'portfoy\')">' + escHtml(t('game.borsa.tabPortfolio')) + ' <span id="borsaPortfoyBadge" class="br-sekme-badge gizli">0</span></button>'
    + '<button type="button" class="br-sekme" data-sekme="emirler" onclick="borsaSekmeDegistir(\'emirler\')">' + escHtml(t('game.borsa.tabOrders')) + ' <span id="borsaEmirBadge" class="br-sekme-badge gizli">0</span></button>'
    + '</div>'
    + '<div class="br-sekme-icerik" id="borsaSekmeIcerik"><p style="color:#888;text-align:center;">' + escHtml(t('game.loading')) + '</p></div>'
    + '<div id="borsaSonuc" class="br-sonuc gizli"></div>'
    + '</div></div>';
}

async function borsaPanelYukle(sessiz) {
  try {
    var res = await apiFetch('/api/borsa/panel');
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.ok) throw new Error(data.error || t('game.error.loadFailed'));
    borsaPanelVeri = data;
    borsaOzetGuncelle();
    borsaSekmeIcerikCiz();
  } catch (e) {
    if (!sessiz) borsaSonucGoster(escHtml(e.message || t('game.error.loadFailed')), 'hata');
  }
}

function borsaEkranBagla() {
  borsaAktifSekme = 'piyasa';
  borsaPanelYukle();
  borsaYenileBaslat();
}

function borsaEkranAc(ic) {
  ic.innerHTML = borsaPanelHTML();
  borsaEkranBagla();
}

async function borsaAl(sirketId) {
  var el = document.getElementById('borsaAlAdet_' + sirketId);
  var adet = el ? Math.floor(Number(el.value) || 0) : 0;
  if (adet <= 0) {
    borsaSonucGoster(escHtml(t('game.borsa.invalidAmount')), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('borsa_al', null, adet, { sirketId: sirketId, adet: adet });
  if (!ef) return;
  if (ef.mesaj) {
    borsaSonucGoster(escHtml(ef.mesaj), 'ok');
    if (typeof toast === 'function') toast(ef.mesaj, 'ok');
  }
}

async function borsaSat(sirketId, portfoyModu) {
  var el = document.getElementById(portfoyModu ? ('borsaSatAdetPf_' + sirketId) : ('borsaSatAdet_' + sirketId));
  if (!el && !portfoyModu) el = document.getElementById('borsaAlAdet_' + sirketId);
  var adet = el ? Math.floor(Number(el.value) || 0) : 0;
  if (adet <= 0) {
    borsaSonucGoster(escHtml(t('game.borsa.invalidAmount')), 'hata');
    return;
  }
  var satilabilir = borsaSatilabilirAdet(sirketId);
  if (adet > satilabilir) {
    borsaSonucGoster(escHtml(t('game.borsa.maxSellOrder', { n: fmt(satilabilir) })), 'hata');
    return;
  }
  var ef = await sunucuAksiyon('borsa_sat', null, adet, { sirketId: sirketId, adet: adet });
  if (!ef) return;
  if (ef.mesaj) {
    borsaSonucGoster(escHtml(ef.mesaj), 'ok');
    if (typeof toast === 'function') toast(ef.mesaj, 'ok');
  }
}

async function borsaEmirVer(sirketId, tur) {
  var adetEl = document.getElementById('borsaEmirAdet_' + sirketId);
  var fiyatEl = document.getElementById('borsaEmirFiyat_' + sirketId);
  var adet = adetEl ? Math.floor(Number(adetEl.value) || 0) : 0;
  var hedefFiyat = fiyatEl ? Math.floor(Number(fiyatEl.value) || 0) : 0;
  if (adet <= 0) {
    borsaSonucGoster(escHtml(t('game.borsa.invalidAmount')), 'hata');
    return;
  }
  if (hedefFiyat < 10) {
    borsaSonucGoster(escHtml(t('game.borsa.invalidPrice')), 'hata');
    return;
  }
  if (tur === 'sat') {
    var satilabilir = borsaSatilabilirAdet(sirketId);
    if (satilabilir <= 0) {
      borsaSonucGoster(escHtml(t('game.borsa.noSellableShares')), 'hata');
      return;
    }
    if (adet > satilabilir) {
      borsaSonucGoster(escHtml(t('game.borsa.maxSellOrder', { n: fmt(satilabilir) })), 'hata');
      return;
    }
  }
  var ef = await sunucuAksiyon('borsa_emir', null, adet, {
    sirketId: sirketId,
    tur: tur,
    adet: adet,
    hedefFiyat: hedefFiyat
  });
  if (!ef) return;
  if (ef.mesaj) {
    borsaSonucGoster(escHtml(ef.mesaj), 'ok');
    if (typeof toast === 'function') toast(ef.mesaj, 'ok');
  }
  if (ef.emirDurum === 'beklemede') {
    borsaAktifSekme = 'emirler';
    document.querySelectorAll('#borsaSekmeler .br-sekme').forEach(function(btn) {
      btn.classList.toggle('br-sekme--aktif', btn.getAttribute('data-sekme') === 'emirler');
    });
  }
  await borsaPanelYukle(true);
}

async function borsaEmirIptal(emirId) {
  var ef = await sunucuAksiyon('borsa_emir_iptal', null, null, { emirId: emirId });
  if (!ef) return;
  if (ef.mesaj) {
    borsaSonucGoster(escHtml(ef.mesaj), 'ok');
    if (typeof toast === 'function') toast(ef.mesaj, 'ok');
  }
  await borsaPanelYukle(true);
}
