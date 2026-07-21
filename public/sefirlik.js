/* Turkey Embassy map UI (loads after script.js) */

var sefirlikPanel = null;
var sefirlikSeciliSehirId = null;

function sefirlikHTML() {
  return (
    '<div id="sefirlikKok" class="sef-wrap">' +
    '<p class="sef-yukleniyor">' + escHtml(t('sefirlik.loading')) + '</p></div>'
  );
}

function sefirlikPinSinif(s) {
  var cls = "sef-sehir-pin";
  if (s.benSahibim) cls += " sahip benim";
  else if (s.sahipUserId) cls += " sahip";
  else if (s.benimKontrol > 0) cls += " benim";
  else cls += " bos";
  return cls;
}

function sefirlikHaritaCiz(sehirler) {
  return sehirler
    .map(function (s) {
      var kontrol = s.benimKontrol || 0;
      var etiket = s.sahipReis ? "👑" : kontrol > 0 ? "%" + kontrol : "—";
      return (
        '<button type="button" class="' +
        sefirlikPinSinif(s) +
        (sefirlikSeciliSehirId === s.id ? " aktif" : "") +
        '" style="left:' +
        s.x +
        "%;top:" +
        s.y +
        '%" data-sehir="' +
        s.id +
        '" onclick="sefirlikSehirSec(\'' +
        s.id +
        "')\">" +
        '<span class="pin-ad">' +
        escHtml(s.ad) +
        "</span>" +
        '<span class="pin-kontrol">' +
        escHtml(etiket) +
        "</span></button>"
      );
    })
    .join("");
}

function sefirlikDetayHTML(s) {
  if (!s) {
    return '<div class="sef-detay"><p class="sef-detay-bos">' + escHtml(t('sefirlik.selectCity')) + '</p></div>';
  }

  var rakipler = (s.rakipler || [])
    .filter(function (r) {
      return !r.benim;
    })
    .map(function (r) {
      return "<li>" + escHtml(r.reisAdi) + " — %" + r.kontrol + "</li>";
    })
    .join("");

  var sahipMetin = s.sahipReis
    ? escHtml(s.sahipReis) + (s.sahipGrup ? " (" + escHtml(s.sahipGrup) + ")" : "")
    : s.liderReis
      ? t('sefirlik.leader', { name: escHtml(s.liderReis), pct: s.liderKontrol })
      : t('sefirlik.emptyControl');

  var cooldown =
    s.cooldownSec > 0
      ? '<p class="sef-bilgi" style="color:#fbbf24">' + escHtml(t('sefirlik.cooldown', { min: Math.ceil(s.cooldownSec / 60) })) + '</p>'
      : "";

  return (
    '<div class="sef-detay">' +
    "<h4>" +
    escHtml(s.ad) +
    "</h4>" +
    '<p class="sef-tier">' +
    escHtml(s.tierLabel) +
    "</p>" +
    '<div class="sef-bar-wrap"><div class="sef-bar-etiket"><span>' + escHtml(t('sefirlik.yourControl')) + '</span><span>%' +
    (s.benimKontrol || 0) +
    "</span></div>" +
    '<div class="sef-bar"><i style="width:' +
    Math.min(100, s.benimKontrol || 0) +
    '%"></i></div></div>' +
    '<div class="sef-bar-wrap"><div class="sef-bar-etiket"><span>' + escHtml(t('sefirlik.emptyArea')) + '</span><span>%' +
    (s.bosKontrol || 0) +
    "</span></div>" +
    '<div class="sef-bar bos"><i style="width:' +
    Math.min(100, s.bosKontrol || 0) +
    '%"></i></div></div>' +
    '<p class="sef-bilgi"><b>' + escHtml(t('sefirlik.ambassador')) + '</b> ' +
    sahipMetin +
    "</p>" +
    (s.sonOlay ? '<p class="sef-bilgi">' + escHtml(s.sonOlay) + "</p>" : "") +
    cooldown +
    '<p class="sef-bilgi">' + escHtml(t('sefirlik.controlInfo', {
      cost: fmt(s.kontrolMaliyet),
      gain: s.kontrolKazanc
    })) + '</p>' +
    (rakipler ? '<ul class="sef-rakip-liste">' + rakipler + "</ul>" : "") +
    '<div class="sef-aksiyonlar">' +
    '<button type="button" onclick="sefirlikKontrolTopla(\'' +
    s.id +
    "')" +
    (s.cooldownSec > 0 ? " disabled" : "") +
    ">" + escHtml(t('sefirlik.collectControl', { gain: s.kontrolKazanc })) +
    "</button>" +
    '<div class="sef-ihale-satir"><input type="number" id="sefIhaleInput" min="' +
    s.ihaleMin +
    '" step="50000" placeholder="' + escHtml(t('sefirlik.minPlaceholder', { amount: fmt(s.ihaleMin) })) +
    '"><button type="button" onclick="sefirlikIhale(\'' +
    s.id +
    "')\">" + escHtml(t('sefirlik.auction')) + "</button></div>" +
    '<button type="button" class="kirmizi" onclick="sefirlikSaldir(\'' +
    s.id +
    "')\">" + escHtml(t('sefirlik.attackCity')) + "</button>" +
    "</div></div>"
  );
}

function sefirlikTumunuCiz() {
  var kok = document.getElementById("sefirlikKok");
  if (!kok || !sefirlikPanel) return;

  var sehirler = sefirlikPanel.sehirler || [];
  var ozet = sefirlikPanel.ozet || {};
  var secili = sehirler.find(function (s) {
    return s.id === sefirlikSeciliSehirId;
  });

  kok.innerHTML =
    '<div class="sef-ust">' +
    "<h3>" + escHtml(t('sefirlik.title')) + "</h3>" +
    "<p>" + escHtml(t('sefirlik.description')) + "</p>" +
    '<div class="sef-ozet">' +
    "<span>" + escHtml(t('sefirlik.owned')) + " <b>" +
    (ozet.sahipSayisi || 0) +
    "</b></span>" +
    "<span>" + escHtml(t('sefirlik.totalControl')) + " <b>%" +
    (ozet.toplamKontrol || 0) +
    "</b></span>" +
    "<span>" + escHtml(t('sefirlik.cities')) + " <b>" +
    (ozet.sehirSayisi || 0) +
    "</b></span>" +
    "</div></div>" +
    '<div class="sef-harita-kutu" id="sefHarita">' +
    sefirlikHaritaCiz(sehirler) +
    "</div>" +
    sefirlikDetayHTML(secili || null);
}

async function sefirlikYukle() {
  var kok = document.getElementById("sefirlikKok");
  if (kok) kok.innerHTML = '<p class="sef-yukleniyor">' + escHtml(t('sefirlik.loading')) + '</p>';
  try {
    var res = await apiFetch("/api/sefirlik/panel");
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      if (kok) {
        kok.innerHTML =
          '<p style="color:#c66;padding:20px">' + escHtml(tr(data.error) || t('game.error.loadFailed')) + "</p>";
      }
      return;
    }
    sefirlikPanel = data;
    if (!sefirlikSeciliSehirId && data.sehirler && data.sehirler[0]) {
      sefirlikSeciliSehirId = data.sehirler[0].id;
    }
    sefirlikTumunuCiz();
  } catch (_) {
    if (kok) kok.innerHTML = '<p style="color:#c66;padding:20px">' + escHtml(t('game.error.connectionFailed')) + '</p>';
  }
}

function sefirlikSehirSec(id) {
  sefirlikSeciliSehirId = id;
  sefirlikTumunuCiz();
}

function sefirlikSehirGuncelle(sehir) {
  if (!sefirlikPanel || !sehir) return;
  var liste = sefirlikPanel.sehirler || [];
  for (var i = 0; i < liste.length; i++) {
    if (liste[i].id === sehir.id) {
      liste[i] = sehir;
      break;
    }
  }
  sefirlikPanel.ozet = sefirlikPanel.ozet || {};
  sefirlikPanel.ozet.sahipSayisi = liste.filter(function (s) {
    return s.benSahibim;
  }).length;
  sefirlikPanel.ozet.toplamKontrol = liste.reduce(function (acc, s) {
    return acc + (s.benimKontrol || 0);
  }, 0);
  sefirlikSeciliSehirId = sehir.id;
  sefirlikTumunuCiz();
}

async function sefirlikKontrolTopla(sehirId) {
  var ef = await sunucuAksiyon("sefirlik_kontrol", null, null, { sehirId: sehirId });
  if (!ef) return;
  toast(tr(ef.mesaj) || t('sefirlik.toast.controlDone'), "basari");
  if (ef.sehir) sefirlikSehirGuncelle(ef.sehir);
  else await sefirlikYukle();
}

async function sefirlikIhale(sehirId) {
  var inp = document.getElementById("sefIhaleInput");
  var teklif = inp ? inp.value : "";
  var ef = await sunucuAksiyon("sefirlik_ihale", null, null, { sehirId: sehirId, teklif: teklif });
  if (!ef) return;
  toast(tr(ef.mesaj) || t('sefirlik.toast.auctionDone'), "basari");
  if (ef.sehir) sefirlikSehirGuncelle(ef.sehir);
  else await sefirlikYukle();
}

async function sefirlikSaldir(sehirId) {
  if (!confirm(t('sefirlik.confirmAttack'))) return;
  var ef = await sunucuAksiyon("sefirlik_saldir", null, null, { sehirId: sehirId });
  if (!ef) return;
  toast(tr(ef.mesaj) || t('sefirlik.toast.attackDone'), ef.kazandi ? "basari" : "hata");
  if (ef.sehir) sefirlikSehirGuncelle(ef.sehir);
  else await sefirlikYukle();
}
