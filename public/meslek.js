/* Meslekler — NPC işleri + oyuncu şirketleri */
var meslekPanel = null;
var sirketPanel = null;
var meslekSekme = "npc";
var meslekGorunum = "harita";
var meslekSeciliIsyeriId = null;
var meslekSeciliMeslekId = null;
var meslekMulakatSonuc = null;
var meslekSeciliSirketId = null;
var meslekHedefSirketId = null;

function meslekYetenekEtiket(key) {
  return t("meslek.yetenek." + key);
}

function meslekHTML() {
  return (
    '<div id="meslekKok" class="meslek-wrap meslek-dashboard">' +
    '<div class="meslek-yukleniyor-kart"><span class="meslek-yuklen-spinner"></span>' +
    '<p class="meslek-yukleniyor">' + escHtml(t("meslek.loading")) + "</p></div></div>"
  );
}

function meslekSekmeHTML() {
  var yonetimEtiket =
    sirketPanel && sirketPanel.yonetim ? t("meslek.tab.myCompany") : t("meslek.tab.createManage");
  var bekleyenBasvuru =
    sirketPanel && sirketPanel.yonetim && sirketPanel.yonetim.basvurular
      ? sirketPanel.yonetim.basvurular.length
      : 0;
  var okunmamisIstifa =
    sirketPanel && sirketPanel.yonetim && sirketPanel.yonetim.okunmamisIstifa
      ? sirketPanel.yonetim.okunmamisIstifa
      : 0;
  var bekleyenZam =
    sirketPanel && sirketPanel.yonetim && sirketPanel.yonetim.bekleyenZam
      ? sirketPanel.yonetim.bekleyenZam
      : 0;
  var yonetimBildirim = bekleyenBasvuru + okunmamisIstifa + bekleyenZam;
  var sekmeler = [
    { id: "npc", ikon: "🏛️", etiket: t("meslek.tab.npcJobs") },
    { id: "sirketler", ikon: "🏢", etiket: t("meslek.tab.playerCompanies") },
    { id: "yonetim", ikon: "👔", etiket: yonetimEtiket, bildirim: yonetimBildirim },
  ];
  var html =
    '<nav class="meslek-sekme-bar" aria-label="' + escHtml(t("meslek.nav.aria")) + '">' +
    '<div class="meslek-nav-ust">' +
    '<span class="meslek-nav-baslik">' + escHtml(t("meslek.nav.title")) + "</span>" +
    '<span class="meslek-nav-alt">' + escHtml(t("meslek.nav.subtitle")) + "</span></div>" +
    '<div class="meslek-sekmeler-cerceve"><div class="meslek-sekmeler">';
  sekmeler.forEach(function (s) {
    html +=
      '<button type="button" class="meslek-sekme' +
      (meslekSekme === s.id ? " aktif" : "") +
      '" onclick="meslekSekmeDegistir(\'' +
      s.id +
      '\')"><span class="meslek-sekme-ikon">' +
      s.ikon +
      '</span><span class="meslek-sekme-metin">' +
      escHtml(s.etiket) +
      (s.bildirim ? ' <span class="meslek-sekme-badge">' + s.bildirim + "</span>" : "") +
      "</span></button>";
  });
  return html + "</div></div></nav>";
}

function meslekBolumBaslik(emoji, baslik) {
  return (
    '<div class="meslek-bolum-baslik">' +
    '<span class="meslek-bolum-cizgi" aria-hidden="true"></span>' +
    "<h4>" +
    emoji +
    " " +
    baslik +
    "</h4>" +
    '<span class="meslek-bolum-cizgi" aria-hidden="true"></span></div>'
  );
}

function meslekHeroHTML(baslik, aciklama, ekstra, geriOnclick) {
  var geri = geriOnclick
    ? '<button type="button" class="meslek-geri" onclick="' +
      geriOnclick +
      '"><span aria-hidden="true">←</span> ' + escHtml(t("meslek.back")) + "</button>"
    : "";
  return (
    '<header class="meslek-hero">' +
    geri +
    '<div class="meslek-hero-govde">' +
    "<h3>" +
    baslik +
    "</h3>" +
    (aciklama ? '<p class="meslek-giris">' + aciklama + "</p>" : "") +
    (ekstra || "") +
    "</div></header>"
  );
}

function meslekMulakatGorselSrc(meslek) {
  if (!meslek || !meslek.mulakatGorsel) return "";
  var v = typeof GORSEL_VERSIYON !== "undefined" ? GORSEL_VERSIYON : "1";
  return "/images/meslek/" + meslek.mulakatGorsel + ".png?v=" + v;
}

function meslekMulakatGorselHTML(meslek) {
  var src = meslekMulakatGorselSrc(meslek);
  if (!src) return "";
  return (
    '<figure class="meslek-mulakat-gorsel-wrap">' +
    '<img class="meslek-mulakat-gorsel" src="' +
    escHtml(src) +
    '" alt="' +
    escHtml(meslek.unvan || "") +
    '" loading="lazy" />' +
    "</figure>"
  );
}

function meslekYetenekBandHTML(yetenekler, antrenman) {
  if (!yetenekler) return "";
  var statlar = antrenman && antrenman.statlar ? antrenman.statlar : null;
  var satir = [
    { key: "guc", cls: "guc" },
    { key: "zeka", cls: "zeka" },
    { key: "dayaniklilik", cls: "day" },
    { key: "beceri", cls: "beceri" },
  ];
  var html =
    '<div class="meslek-yetenek-band">' +
    '<div class="meslek-yetenek-band-ust">' +
    '<span class="meslek-yetenek-band-baslik">' + escHtml(t("meslek.skills.title")) + "</span>";
  if (antrenman && antrenman.genelKademe) {
    html +=
      '<span class="meslek-yetenek-kademe">' +
      escHtml((antrenman.genelKademe.emoji || "") + " " + antrenman.genelKademe.ad) +
      t("meslek.skills.avg", { avg: antrenman.ortalama || 0 }) +
      "</span>";
  }
  html += '</div><div class="meslek-yetenek-pills">';
  satir.forEach(function (s) {
    var meta = statlar ? statlar.find(function (x) { return x.key === s.key; }) : null;
    var deger = meta ? meta.deger : yetenekler[s.key] || 0;
    var yuzde = meta && meta.yuzde != null ? meta.yuzde : 0;
    html +=
      '<div class="meslek-stat-pill meslek-stat-pill--' +
      s.cls +
      '"><span class="meslek-stat-etiket">' +
      (meta ? meta.emoji + " " : "") +
      meslekYetenekEtiket(s.key) +
      '</span><span class="meslek-stat-deger">' +
      deger +
      "</span>";
    if (meta && meta.kademe) {
      html += '<span class="meslek-stat-kademe">' + escHtml(meta.kademe) + "</span>";
    }
    html +=
      '<div class="meslek-stat-bar"><i style="width:' +
      yuzde +
      '%"></i></div></div>';
  });
  html += "</div>";
  if (antrenman) html += meslekAntrenmanHTML(antrenman);
  return html + "</div>";
}

function meslekAntrenmanHTML(antrenman) {
  if (!antrenman || !antrenman.statlar) return "";
  var kalan = antrenman.kalan != null ? antrenman.kalan : 0;
  var limit = antrenman.gunlukLimit || 4;
  var maasPuani = antrenman.maasAntrenmanPuani || 0;
  var html =
    '<div class="meslek-antrenman">' +
    '<div class="meslek-antrenman-ust">' +
    "<h4>" + escHtml(t("meslek.training.title")) + "</h4>" +
    '<span class="meslek-antrenman-hak">' +
    t("meslek.training.dailyQuota") +
    "<b>" +
    kalan +
    "/" +
    limit +
    "</b></span></div>";
  if (maasPuani > 0) {
    html +=
      '<div class="meslek-maas-antrenman">' +
      '<div class="meslek-maas-antrenman-ust">' +
      "<strong>" + escHtml(t("meslek.training.salaryPointsTitle")) + "</strong>" +
      '<span class="meslek-maas-antrenman-rozet">' +
      t("meslek.training.points", { n: maasPuani }) +
      "</span></div>" +
      '<p class="meslek-dim">' + t("meslek.training.salaryDesc") + "</p>" +
      '<div class="meslek-maas-antrenman-grid">';
    antrenman.statlar.forEach(function (s) {
      html +=
        '<button type="button" class="meslek-btn meslek-btn--altin meslek-maas-antrenman-btn" onclick="maasAntrenmanKullan(\'' +
        s.key +
        "')\">+" +
        (antrenman.kazanc || 1) +
        " " +
        escHtml(s.ad) +
        "</button>";
    });
    html += "</div></div>";
  }
  html +=
    '<p class="meslek-dim">' +
    t("meslek.training.dailyDesc", { limit: limit }) +
    "</p>" +
    '<div class="meslek-antrenman-grid">';
  antrenman.statlar.forEach(function (s) {
    var disabled = kalan <= 0;
    html +=
      '<div class="meslek-antrenman-kart meslek-antrenman-kart--' +
      s.key +
      (disabled ? " meslek-antrenman-kart--pasif" : "") +
      '">' +
      '<div class="meslek-antrenman-kart-ust">' +
      "<span>" +
      escHtml(s.emoji + " " + s.ad) +
      "</span>" +
      '<span class="meslek-antrenman-deger">' +
      s.deger +
      (s.sonrakiEsik ? " → " + s.sonrakiEsik : "") +
      "</span></div>" +
      '<p class="meslek-antrenman-aciklama">' +
      escHtml(s.aciklama) +
      (s.kademe ? " · " + s.kademe : "") +
      "</p>" +
      '<div class="meslek-stat-bar meslek-stat-bar--ince"><i style="width:' +
      (s.yuzde || 0) +
      '%"></i></div>' +
      '<button type="button" class="meslek-btn meslek-btn--alt meslek-antrenman-btn"' +
      (disabled ? " disabled" : "") +
      ' onclick="yetenekAntrenman(\'' +
      s.key +
      "')\">" +
      t("meslek.training.trainBtn", { cost: fmt(s.antrenmanMaliyet) }) +
      "</button></div>";
  });
  return html + "</div></div>";
}

function meslekYetenekOzetHTML(yetenekler) {
  return meslekYetenekBandHTML(yetenekler, meslekPanel && meslekPanel.antrenman);
}

function meslekYetenekKazancMetin(kazanc) {
  if (!kazanc) return t("meslek.dash");
  return Object.keys(kazanc)
    .map(function (k) {
      return t("meslek.skillGain", { n: kazanc[k], stat: meslekYetenekEtiket(k) }) + t("meslek.perDay");
    })
    .join(t("meslek.sepComma"));
}

function meslekGereksinimMetin(gereksinim) {
  if (!gereksinim) return t("meslek.dash");
  return Object.keys(gereksinim)
    .map(function (k) {
      return t("meslek.requirement", { stat: meslekYetenekEtiket(k), n: gereksinim[k] });
    })
    .join(t("meslek.sepDot"));
}

function meslekAktifIsHTML(aktif) {
  if (!aktif) return "";
  return (
    '<div class="meslek-aktif-kart meslek-aktif-kart--npc">' +
    '<div class="meslek-aktif-ust">' +
    "<h4>" + escHtml(t("meslek.activeNpc.title")) + "</h4>" +
    '<span class="meslek-aktif-rozet">' + escHtml(t("meslek.activeNpc.badge")) + "</span></div>" +
    "<p><b>" +
    escHtml(aktif.isyeriAd) +
    "</b> — " +
    escHtml(aktif.unvan) +
    "</p>" +
    '<p class="meslek-aktif-maas">' +
    t("meslek.activeNpc.dailySalary", { amount: fmt(aktif.gunlukGelir) }) +
    "</p>" +
    '<p class="meslek-dim">' +
    t("meslek.activeNpc.dailySkill") +
    escHtml(meslekYetenekKazancMetin(aktif.yetenekKazanc)) +
    "</p>" +
    '<p class="meslek-dim">' + t("meslek.activeNpc.payTime") + "</p>" +
    '<button type="button" class="meslek-btn meslek-btn--gri" onclick="meslekIstifa()">' +
    escHtml(t("meslek.activeNpc.resign")) +
    "</button>" +
    "</div>"
  );
}

function meslekSirketCalisanHTML(calisan) {
  if (!calisan) return "";
  var maxMaas = 50000;
  var mevcutMaas = calisan.gunlukMaas || 0;
  var varsayilanTalep = Math.min(maxMaas, Math.max(mevcutMaas + 500, 501));
  var zamHtml = "";
  if (calisan.zamTalebi) {
    zamHtml =
      '<p class="meslek-dim meslek-zam-bekliyor">' +
      t("meslek.activeCo.raisePending", {
        current: fmt(calisan.gunlukMaas),
        requested: fmt(calisan.zamTalebi.talepMaas),
      }) +
      "</p>";
  } else if (mevcutMaas >= maxMaas) {
    zamHtml = '<p class="meslek-dim">' + escHtml(t("meslek.activeCo.raiseMax")) + "</p>";
  } else {
    zamHtml =
      '<input type="number" id="sirketZamTalepInput" class="meslek-input meslek-input--kucuk" value="' +
      varsayilanTalep +
      '" min="' +
      Math.min(maxMaas, mevcutMaas + 1) +
      '" max="' +
      maxMaas +
      '" placeholder="' +
      escHtml(t("meslek.activeCo.raisePlaceholder")) +
      '" />' +
      '<button type="button" class="meslek-btn meslek-btn--altin" onclick="sirketZamTalep()">' +
      escHtml(t("meslek.activeCo.requestRaise")) +
      "</button>";
  }
  return (
    '<div class="meslek-aktif-kart meslek-aktif-kart--sirket">' +
    '<div class="meslek-aktif-ust">' +
    "<h4>" + escHtml(t("meslek.activeCo.title")) + "</h4>" +
    '<span class="meslek-aktif-rozet meslek-aktif-rozet--mavi">' + escHtml(t("meslek.activeCo.badge")) + "</span></div>" +
    "<p><b>" +
    escHtml(calisan.sirketAdi) +
    "</b> — " +
    escHtml(calisan.unvan) +
    "</p>" +
    "<p>" + escHtml(t("meslek.activeCo.boss")) + "<b>" +
    escHtml(calisan.sahipAdi) +
    "</b></p>" +
    '<p class="meslek-aktif-maas">' +
    t("meslek.activeNpc.dailySalary", { amount: fmt(calisan.gunlukMaas) }) +
    "</p>" +
    '<p class="meslek-dim">' + t("meslek.activeCo.salaryNote") + "</p>" +
    '<p class="meslek-dim">' + t("meslek.activeCo.payTime") + "</p>" +
    '<div class="meslek-aktif-aksiyon">' +
    zamHtml +
    '<button type="button" class="meslek-btn meslek-btn--gri" onclick="sirketIstifa()">' +
    escHtml(t("meslek.activeCo.resign")) +
    "</button>" +
    "</div></div>"
  );
}

function meslekRaporlaraKaydir() {
  var el = document.getElementById("meslekGunlukRaporlar");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function meslekBasvurularaKaydir() {
  var el = document.getElementById("meslekBasvurular");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function meslekIstifalaraKaydir() {
  var el = document.getElementById("meslekIstifalar");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function meslekZamTaleplerineKaydir() {
  var el = document.getElementById("meslekZamTalepleri");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function meslekIstifaTarih(ts) {
  if (!ts) return t("meslek.dash");
  try {
    return new Date(ts * 1000).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return t("meslek.dash");
  }
}

function meslekSirketSahipBannerHTML() {
  if (!sirketPanel || !sirketPanel.yonetim) return "";
  var y = sirketPanel.yonetim;
  var raporSay = y.raporlar ? y.raporlar.length : 0;
  var ilanNot = y.iseAlimAcik
    ? t("meslek.banner.listingLive")
    : t("meslek.banner.postListingBefore") +
      '<button type="button" class="meslek-link-btn" onclick="meslekSekmeDegistir(\'yonetim\')">' +
      escHtml(t("meslek.tab.myCompany")) +
      "</button>" +
      t("meslek.banner.postListingAfter");
  return (
    '<div class="meslek-sirket-yonlendir">' +
    t("meslek.banner.hasCompany", { name: escHtml(y.isim) }) +
    ilanNot +
    t("meslek.banner.managementBefore") +
    '<button type="button" class="meslek-link-btn" onclick="meslekSekmeDegistir(\'yonetim\')">' +
    escHtml(t("meslek.tab.myCompany")) +
    "</button>" +
    t("meslek.banner.managementAfter") +
    (raporSay
      ? t("meslek.banner.reportCount", { n: raporSay })
      : t("meslek.banner.firstReport")) +
    "</div>"
  );
}

function meslekIsIlaniPanelHTML(y) {
  var acik = !!y.iseAlimAcik;
  var calisanSay = y.calisanlar ? y.calisanlar.length : 0;
  var bosKoltuk = (y.maxCalisan || 0) - calisanSay;
  return (
    '<section class="meslek-bolum meslek-panel meslek-ilan-panel' +
    (acik ? " meslek-ilan-panel--acik" : "") +
    '">' +
    meslekBolumBaslik("📰", t("meslek.listing.title")) +
    '<div class="meslek-ilan-govde">' +
    '<span class="meslek-ilan-rozet' +
    (acik ? " meslek-ilan-rozet--acik" : " meslek-ilan-rozet--kapali") +
    '">' +
    (acik ? escHtml(t("meslek.listing.badgeOpen")) : escHtml(t("meslek.listing.badgeClosed"))) +
    "</span>" +
    '<p class="meslek-ilan-metin">' +
    (acik
      ? t("meslek.listing.openDesc", { name: escHtml(y.isim) })
      : t("meslek.listing.closedDesc")) +
    "</p>" +
    '<ul class="meslek-ilan-yerler">' +
    "<li>" + escHtml(t("meslek.listing.placeNewspaper")) + "</li>" +
    "<li>" + escHtml(t("meslek.listing.placeCareer")) + "</li>" +
    "</ul>" +
    (bosKoltuk <= 0
      ? '<p class="meslek-ilan-uyari">' +
        escHtml(t("meslek.listing.rosterFull", { current: calisanSay, max: y.maxCalisan })) +
        "</p>"
      : '<p class="meslek-dim">' + t("meslek.listing.openSlots", { n: bosKoltuk }) + "</p>") +
    '<div class="meslek-ilan-aksiyon">' +
    '<button type="button" class="meslek-btn meslek-btn--ilan' +
    (acik ? " meslek-btn--gri" : " meslek-btn--altin") +
    '" onclick="sirketIseAlimToggle()">' +
    escHtml(acik ? t("meslek.listing.closeBtn") : t("meslek.listing.openBtn")) +
    "</button>" +
    (acik ? '<span class="meslek-dim">' + escHtml(t("meslek.listing.closeHint")) + "</span>" : "") +
    (y.basvurular && y.basvurular.length
      ? ' <button type="button" class="meslek-link-btn" onclick="meslekBasvurularaKaydir()">' +
        escHtml(t("meslek.listing.applicationsBtn", { n: y.basvurular.length })) +
        "</button>"
      : "") +
    (y.okunmamisIstifa > 0
      ? ' <button type="button" class="meslek-link-btn meslek-link-btn--uyari" onclick="meslekIstifalaraKaydir()">' +
        escHtml(t("meslek.listing.resignationsBtn", { n: y.okunmamisIstifa })) +
        "</button>"
      : "") +
    (y.bekleyenZam > 0
      ? ' <button type="button" class="meslek-link-btn meslek-link-btn--uyari" onclick="meslekZamTaleplerineKaydir()">' +
        escHtml(t("meslek.listing.raiseRequestsBtn", { n: y.bekleyenZam })) +
        "</button>"
      : "") +
    "</div></div></section>"
  );
}

function meslekBasvurularHTML(y) {
  var html =
    '<section class="meslek-bolum meslek-panel meslek-basvuru-panel" id="meslekBasvurular">' +
    meslekBolumBaslik("📋", t("meslek.applications.title"));
  if (!y.iseAlimAcik) {
    html += '<p class="meslek-dim">' + t("meslek.applications.closed") + "</p>";
  } else if (!y.basvurular || !y.basvurular.length) {
    html += '<p class="meslek-dim">' + t("meslek.applications.empty") + "</p>";
  } else {
    html += '<p class="meslek-dim meslek-basvuru-sayi">' + t("meslek.applications.pending", { n: y.basvurular.length }) + "</p>";
    y.basvurular.forEach(function (b) {
      html +=
        '<div class="meslek-basvuru-kart">' +
        "<p><b>" +
        escHtml(b.reisAdi) +
        "</b> — " +
        escHtml(b.unvan) +
        "</p>" +
        '<div class="meslek-basvuru-aksiyon">' +
        '<input type="number" id="sirketMaas_' +
        b.id +
        '" class="meslek-input meslek-input--kucuk" value="' +
        b.varsayilanMaas +
        '" min="500" max="50000" placeholder="' + escHtml(t("meslek.applications.placeholderSalary")) + '" />' +
        '<button type="button" class="meslek-btn meslek-btn--altin" onclick="sirketBasvuruKabul(' +
        b.id +
        ')">' + escHtml(t("meslek.applications.accept")) + '</button>' +
        '<button type="button" class="meslek-btn meslek-btn--gri" onclick="sirketBasvuruRed(' +
        b.id +
        ')">' + escHtml(t("meslek.applications.reject")) + '</button></div></div>';
    });
  }
  html += "</section>";
  return html;
}

function meslekZamTalepleriHTML(y) {
  var talepler = y.zamTalepleri || [];
  if (!talepler.length) return "";
  var html =
    '<section class="meslek-bolum meslek-panel meslek-zam-panel" id="meslekZamTalepleri">' +
    meslekBolumBaslik("💰", t("meslek.raiseRequests.title"));
  html += '<p class="meslek-dim">' + t("meslek.raiseRequests.pending", { n: talepler.length }) + "</p>";
  talepler.forEach(function (z) {
    var adHtml =
      typeof oyuncuLink === "function"
        ? oyuncuLink(z.calisanUserId, z.reisAdi)
        : escHtml(z.reisAdi);
    html +=
      '<div class="meslek-basvuru-kart' +
      (z.okundu ? "" : " meslek-basvuru-kart--yeni") +
      '">' +
      "<p><b>" +
      adHtml +
      "</b> · <span class=\"meslek-dim\">" +
      meslekIstifaTarih(z.talepZamani) +
      "</span></p>" +
      "<p>" +
      t("meslek.raiseRequests.detail", {
        current: fmt(z.mevcutMaas),
        requested: fmt(z.talepMaas),
      }) +
      "</p>" +
      '<div class="meslek-basvuru-aksiyon">' +
      '<button type="button" class="meslek-btn meslek-btn--altin" onclick="sirketZamOnayla(' +
      z.id +
      ')">' +
      escHtml(t("meslek.raiseRequests.approve")) +
      "</button>" +
      '<button type="button" class="meslek-btn meslek-btn--gri" onclick="sirketZamReddet(' +
      z.id +
      ')">' +
      escHtml(t("meslek.raiseRequests.reject")) +
      "</button></div></div>";
  });
  html += "</section>";
  return html;
}

function meslekIstifalarHTML(y) {
  var kayitlar = y.sonIstifalar || [];
  if (!kayitlar.length) return "";
  var html =
    '<section class="meslek-bolum meslek-panel meslek-istifa-panel" id="meslekIstifalar">' +
    meslekBolumBaslik("🚪", t("meslek.resignations.title"));
  if (y.okunmamisIstifa > 0) {
    html += '<p class="meslek-dim meslek-istifa-yeni-not">' + t("meslek.resignations.newCount", { n: y.okunmamisIstifa }) + "</p>";
  }
  html += '<p class="meslek-dim">' + t("meslek.resignations.listDesc", { n: kayitlar.length }) + "</p>";
  kayitlar.forEach(function (i) {
    var adHtml =
      typeof oyuncuLink === "function"
        ? oyuncuLink(i.calisanUserId, i.reisAdi)
        : escHtml(i.reisAdi);
    html +=
      '<div class="meslek-istifa-kart' +
      (i.okundu ? "" : " meslek-istifa-kart--yeni") +
      '">' +
      "<p><b>" +
      adHtml +
      "</b> — " +
      escHtml(i.unvan) +
      " · <span class=\"meslek-dim\">" +
      meslekIstifaTarih(i.istifaZamani) +
      "</span></p>" +
      '<p class="meslek-istifa-metin">' +
      escHtml(i.okundu ? t("meslek.resignations.read") : t("meslek.resignations.unread")) +
      "</p></div>";
  });
  html += "</section>";
  return html;
}

function meslekSonRaporOzetHTML(y) {
  var raporlar = y.raporlar || [];
  if (!raporlar.length) {
    return (
      '<div class="meslek-son-rapor meslek-son-rapor--bos">' +
      '<span class="meslek-son-rapor-baslik">' + escHtml(t("meslek.reports.latestTitle")) + "</span>" +
      '<p class="meslek-dim">' + t("meslek.reports.latestEmpty") + "</p>" +
      "</div>"
    );
  }
  var son = raporlar[0];
  return (
    '<div class="meslek-son-rapor">' +
    '<div class="meslek-son-rapor-ust">' +
    '<span class="meslek-son-rapor-baslik">' +
    escHtml(t("meslek.reports.latestSummary", { day: son.gun })) +
    "</span>" +
    '<button type="button" class="meslek-btn meslek-btn--mini" onclick="meslekRaporlaraKaydir()">' +
    escHtml(t("meslek.reports.allBtn")) +
    "</button>" +
    "</div>" +
    '<div class="meslek-son-rapor-metrik">' +
    "<span>" +
    t("meslek.reports.sales") +
    "<b>" +
    (son.satisAdet || 0) +
    "</b></span>" +
    "<span>" +
    t("meslek.reports.gross") +
    "<b>" +
    fmt(son.brutGelir) +
    " 🪙</b></span>" +
    "<span>" +
    t("meslek.reports.net") +
    "<b>" +
    fmt(son.netKar) +
    " 🪙</b></span>" +
    "</div>" +
    (son.notlar ? '<p class="meslek-dim meslek-son-rapor-not">' + escHtml(son.notlar) + "</p>" : "") +
    "</div>"
  );
}

function meslekGunlukRaporlarHTML(y) {
  var raporlar = y.raporlar || [];
  var html =
    '<section id="meslekGunlukRaporlar" class="meslek-bolum meslek-panel meslek-rapor-bolum">' +
    meslekBolumBaslik("📊", t("meslek.reports.dailyTitle")) +
    '<p class="meslek-dim">' + t("meslek.reports.dailyDesc") + "</p>";

  if (!raporlar.length) {
    html +=
      '<div class="meslek-rapor-bos">' +
      '<span class="meslek-rapor-bos-ikon" aria-hidden="true">📋</span>' +
      '<p class="meslek-bos-baslik">' + escHtml(t("meslek.reports.emptyTitle")) + "</p>" +
      '<p class="meslek-dim">' + escHtml(t("meslek.reports.emptyDesc")) + "</p>" +
      "</div></section>";
    return html;
  }

  html += meslekSonRaporOzetHTML(y);
  html +=
    '<div class="meslek-rapor-tablo-wrap"><table class="meslek-rapor-tablo">' +
    "<thead><tr><th>" +
    escHtml(t("meslek.reports.colDay")) +
    "</th><th>" +
    escHtml(t("meslek.reports.colSales")) +
    "</th><th>" +
    escHtml(t("meslek.reports.colGross")) +
    "</th><th>" +
    escHtml(t("meslek.reports.colMaterial")) +
    "</th><th>" +
    escHtml(t("meslek.reports.colSalary")) +
    "</th><th>" +
    escHtml(t("meslek.reports.colAd")) +
    "</th><th>" +
    escHtml(t("meslek.reports.colNet")) +
    "</th><th>" +
    escHtml(t("meslek.reports.colNote")) +
    "</th></tr></thead><tbody>";
  raporlar.forEach(function (r) {
    html +=
      "<tr><td>" +
      escHtml(r.gun) +
      "</td><td>" +
      (r.satisAdet || 0) +
      "</td><td>" +
      fmt(r.brutGelir) +
      "</td><td>" +
      fmt(r.malzemeMaliyet) +
      "</td><td>" +
      fmt(r.maasGider) +
      "</td><td>" +
      fmt(r.reklamGider) +
      "</td><td>" +
      fmt(r.netKar) +
      "</td><td>" +
      escHtml(r.notlar || t("meslek.dash")) +
      "</td></tr>";
  });
  html += "</tbody></table></div></section>";
  return html;
}

function meslekHaritaHTML(data) {
  var ustEk =
    meslekSirketSahipBannerHTML() +
    meslekSirketCalisanHTML(sirketPanel && sirketPanel.aktifCalisan) +
    meslekAktifIsHTML(data.aktifMeslek) +
    meslekYetenekOzetHTML(data.yetenekler);
  var html =
    meslekSekmeHTML() +
    meslekHeroHTML(
      t("meslek.hero.npcTitle"),
      t("meslek.hero.npcDesc"),
      ustEk
    ) +
    '<div class="meslek-panel meslek-panel--grid"><div class="meslek-isyeri-grid">';

  (data.isyerleri || []).forEach(function (isyeri) {
    var pozSay = isyeri.meslekler ? isyeri.meslekler.length : 0;
    html +=
      '<button type="button" class="meslek-isyeri-kart" onclick="meslekIsyeriAc(\'' +
      isyeri.id +
      "')\">" +
      '<span class="meslek-isyeri-parlak" aria-hidden="true"></span>' +
      '<span class="meslek-isyeri-emoji">' +
      escHtml(isyeri.emoji || "🏢") +
      "</span>" +
      "<strong>" +
      escHtml(isyeri.ad) +
      "</strong>" +
      '<span class="meslek-isyeri-npc">' +
      escHtml(isyeri.npc) +
      "</span>" +
      '<span class="meslek-isyeri-aciklama">' +
      escHtml(isyeri.aciklama) +
      "</span>" +
      '<span class="meslek-isyeri-sayi">' +
      t("meslek.positions.count", { n: pozSay }) +
      "</span></button>";
  });

  html += "</div></div>";
  return html;
}

function meslekSirketlerHTML() {
  var sp = sirketPanel || {};
  var html =
    meslekSekmeHTML() +
    meslekHeroHTML(
      t("meslek.hero.companiesTitle"),
      t("meslek.hero.companiesDesc"),
      meslekSirketCalisanHTML(sp.aktifCalisan) +
        meslekAktifIsHTML(meslekPanel && meslekPanel.aktifMeslek) +
        meslekYetenekOzetHTML(meslekPanel && meslekPanel.yetenekler)
    );

  if (!sp.acikSirketler || !sp.acikSirketler.length) {
    html +=
      '<div class="meslek-bos-kart"><span class="meslek-bos-ikon">🏭</span>' +
      '<p class="meslek-bos-baslik">' + escHtml(t("meslek.companies.emptyTitle")) + "</p>" +
      '<p class="meslek-dim">' + t("meslek.companies.emptyDesc") + "</p></div>";
    return html;
  }

  html += '<div class="meslek-panel meslek-panel--grid"><div class="meslek-sirket-liste">';
  sp.acikSirketler.forEach(function (s) {
    html +=
      '<div class="meslek-sirket-kart" id="meslekSirketKart_' + s.id + '">' +
      '<div class="meslek-sirket-bas">' +
      "<span class=\"meslek-sirket-emoji\">" +
      escHtml(s.turEmoji || "🏢") +
      "</span>" +
      "<div><strong>" +
      escHtml(s.isim) +
      "</strong>" +
      '<span class="meslek-dim">' +
      escHtml(s.turAd) +
      t("meslek.companies.boss") +
      escHtml(s.sahipAdi) +
      "</span></div>" +
      '<span class="meslek-sirket-kadro">' +
      t("meslek.companies.staff", { current: s.calisanSayisi, max: s.maxCalisan }) +
      "</span></div>";

    if (s.aciklama) {
      html += '<p class="meslek-dim">' + escHtml(s.aciklama) + "</p>";
    }

    if (s.bosKoltuk <= 0) {
      html += '<p class="meslek-dim">' + escHtml(t("meslek.companies.rosterFull")) + "</p>";
    } else if (s.benimSirketim) {
      html += '<p class="meslek-dim">' + escHtml(t("meslek.companies.yours")) + "</p>";
    } else if (sp.aktifCalisan || (meslekPanel && meslekPanel.aktifMeslek)) {
      html += '<p class="meslek-dim">' + escHtml(t("meslek.companies.alreadyWorking")) + "</p>";
    } else {
      html += '<div class="meslek-sirket-pozisyonlar">';
      (s.pozisyonlar || []).forEach(function (p) {
        var cls = p.uygun ? " uygun" : " yetersiz";
        html +=
          '<div class="meslek-pozisyon meslek-pozisyon--kucuk' +
          cls +
          '">' +
          '<div class="meslek-pozisyon-bas">' +
          "<strong>" +
          escHtml(p.unvan) +
          "</strong>" +
          '<span class="meslek-pozisyon-rozet' +
          (p.uygun ? " meslek-pozisyon-rozet--ok" : " meslek-pozisyon-rozet--no") +
          '">' +
          (p.uygun ? escHtml(t("meslek.position.suitable")) : escHtml(t("meslek.position.insufficient"))) +
          "</span></div>" +
          '<span class="meslek-pozisyon-maas">' +
          escHtml(t("meslek.position.salaryPerDay", { amount: fmt(p.varsayilanMaas) })) +
          "</span>" +
          "<p>" + escHtml(t("meslek.position.requirements")) +
          escHtml(meslekGereksinimMetin(p.gereksinim)) +
          "</p>";
        if (p.basvuruYapildi || s.basvuruYapildi) {
          html += '<span class="meslek-btn meslek-btn--gri meslek-btn--pasif">' + escHtml(t("meslek.position.applied")) + "</span>";
        } else {
          html +=
            '<button type="button" class="meslek-btn meslek-btn--altin"' +
            (p.uygun ? "" : " disabled") +
            " onclick=\"sirketBasvur(" +
            s.id +
            ",'" +
            p.id +
            "')\">" + escHtml(t("meslek.position.apply")) + "</button>";
        }
        html += "</div>";
      });
      html += "</div>";
    }
    html += "</div>";
  });
  html += "</div></div>";
  return html;
}

function meslekYonetimHTML() {
  var sp = sirketPanel || {};
  var html = meslekSekmeHTML();

  if (sp.yonetim) {
    var y = sp.yonetim;
    var tahmin = y.tahmin || {};
    html +=
      meslekHeroHTML(
        escHtml(y.turEmoji) + " " + escHtml(y.isim),
        escHtml(y.aciklama || y.turAciklama),
        '<div class="meslek-sirket-ozet meslek-sirket-ozet--genis">' +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.vault", { amount: fmt(y.kasa) }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.roster", {
            current: y.calisanlar ? y.calisanlar.length : 0,
            max: y.maxCalisan,
          }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.stars", { n: y.yildiz || 0 }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.popularity", { n: y.populerlik || 0 }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.warehouse", { used: y.stokDolu || 0, cap: y.depoKapasite }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.netForecast", { amount: fmt(y.gunlukGelirTahmin || 0) }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.salaryTotal", { amount: fmt(y.gunlukMaasToplam || 0) }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.price", { amount: fmt(y.efektifBirimFiyat || 0) }) +
          "</span>" +
          '<span class="meslek-ozet-chip">' +
          t("meslek.manage.training", { used: y.egitimKullanim || 0, slots: y.egitimSlot || 1 }) +
          '</span><button type="button" class="meslek-ozet-chip meslek-ozet-chip--btn" onclick="meslekRaporlaraKaydir()">' +
          escHtml(t("meslek.manage.dailyReportBtn")) +
          "</button></div>" +
          '<p class="meslek-sirket-uretim-notu">' +
          t("meslek.manage.noProduction") +
          "</p>" +
          '<div class="meslek-sirket-aksiyon">' +
          '<input type="number" id="sirketYatirInput" class="meslek-input" min="100" placeholder="' +
          escHtml(t("meslek.manage.depositPlaceholder")) +
          '" />' +
          '<button type="button" class="meslek-btn" onclick="sirketYatir()">' +
          escHtml(t("meslek.manage.depositBtn")) +
          "</button>" +
          '<button type="button" class="meslek-btn meslek-btn--gri" onclick="sirketCek()">' +
          escHtml(t("meslek.manage.withdrawBtn")) +
          "</button>" +
          "</div>"
      );

    html += meslekIsIlaniPanelHTML(y);
    html += meslekBasvurularHTML(y);
    html += meslekZamTalepleriHTML(y);
    html += meslekIstifalarHTML(y);
    html += meslekGunlukRaporlarHTML(y);

    html +=
      '<section class="meslek-bolum meslek-panel">' +
      meslekBolumBaslik("📦", t("meslek.stock.title")) +
      '<p class="meslek-dim">' +
      t("meslek.stock.desc", { cost: fmt(y.birimMalzemeMaliyet || 0) }) +
      "</p>" +
      '<div class="meslek-stok-grid">';
    (y.stok || []).forEach(function (s) {
      html +=
        '<div class="meslek-stok-kart">' +
        "<strong>" +
        escHtml(s.emoji || "📦") +
        " " +
        escHtml(s.ad) +
        "</strong>" +
        "<span>" +
        t("meslek.stock.amount", { n: s.miktar || 0 }) +
        "</span>" +
        "<span>" +
        t("meslek.stock.unitInfo", {
          price: fmt(s.birimFiyat),
          use: s.birimTuketim,
        }) +
        "</span>" +
        '<div class="meslek-stok-al">' +
        '<input type="number" id="sirketStok_' +
        s.id +
        '" class="meslek-input meslek-input--kucuk" min="1" max="5000" placeholder="' +
        escHtml(t("meslek.stock.qtyPlaceholder")) +
        '" />' +
        '<button type="button" class="meslek-btn meslek-btn--mini" onclick="sirketMalzemeAl(\'' +
        s.id +
        "')\">" +
        escHtml(t("meslek.stock.buyBtn")) +
        "</button></div></div>";
    });
    html += "</div></section>";

    html +=
      '<section class="meslek-bolum meslek-panel">' +
      meslekBolumBaslik("🏗️", t("meslek.upgrade.title")) +
      '<div class="meslek-upgrade-grid">';
    (y.upgradeTipleri || []).forEach(function (u) {
      var maxed = u.mevcutSeviye >= u.maxSeviye;
      html +=
        '<div class="meslek-upgrade-kart">' +
        "<strong>" +
        escHtml(u.emoji) +
        " " +
        escHtml(u.ad) +
        "</strong>" +
        "<p>" +
        escHtml(u.aciklama) +
        "</p>" +
        "<span>" +
        t("meslek.upgrade.level", { current: u.mevcutSeviye, max: u.maxSeviye }) +
        "</span>" +
        (maxed
          ? '<span class="meslek-dim">' + escHtml(t("meslek.upgrade.max")) + "</span>"
          : '<button type="button" class="meslek-btn meslek-btn--altin" onclick="sirketUpgrade(\'' +
            u.id +
            "')\">" +
            escHtml(t("meslek.upgrade.btn", { cost: fmt(u.maliyet || 0) })) +
            "</button>") +
        "</div>";
    });
    html += "</div></section>";

    html +=
      '<section class="meslek-bolum meslek-panel">' +
      meslekBolumBaslik("📣", t("meslek.ads.title")) +
      '<div class="meslek-reklam-fiyat">' +
      "<label>" + escHtml(t("meslek.ads.campaignLabel")) + "</label>" +
      '<select id="sirketReklamSelect" class="meslek-input" onchange="sirketReklamDegistir()">';
    (y.reklamSecenekleri || []).forEach(function (r) {
      html +=
        '<option value="' +
        r.id +
        '"' +
        (r.id === y.reklamSeviye ? " selected" : "") +
        ">" +
        escHtml(
          t("meslek.ads.campaignOption", {
            name: r.ad,
            cost: fmt(r.gunlukMaliyet),
            pct: Math.round((r.musteriBonus || 0) * 100),
          })
        ) +
        "</option>";
    });
    html +=
      '</select><div class="meslek-fiyat-ayar">' +
      "<label>" + escHtml(t("meslek.ads.priceLabel")) + "</label>" +
      '<input type="range" id="sirketFiyatRange" min="0.5" max="2" step="0.05" value="' +
      (y.fiyatCarpani || 1) +
      '" oninput="sirketFiyatOnizle(this.value)" />' +
      '<span id="sirketFiyatOnizle">' +
      t("meslek.ads.pricePreview", {
        mult: y.fiyatCarpani || 1,
        price: fmt(y.efektifBirimFiyat || 0),
      }) +
      "</span>" +
      '<button type="button" class="meslek-btn" onclick="sirketFiyatKaydet()">' +
      escHtml(t("meslek.ads.savePrice")) +
      "</button></div></div>" +
      '<div class="meslek-tahmin-kutu">' +
      "<span>" +
      t("meslek.ads.capacity", { n: tahmin.kapasite || 0 }) +
      "</span>" +
      "<span>" +
      t("meslek.ads.stockLimit", { n: tahmin.stokLimit || 0 }) +
      "</span>" +
      "<span>" +
      t("meslek.ads.demand", { n: tahmin.talep || 0 }) +
      "</span>" +
      "<span>" +
      t("meslek.ads.dailySales", {
        n: tahmin.satisAdet || 0,
        unit: y.urunAd || t("meslek.ads.unitDefault"),
      }) +
      "</span></div>" +
      '<p class="meslek-dim meslek-musteri-notu">' +
      t("meslek.ads.customerNote") +
      "</p></section>";

    html +=
      '<section class="meslek-bolum meslek-panel">' +
      meslekBolumBaslik("👥", t("meslek.employees.title"));
    if (!y.calisanlar || !y.calisanlar.length) {
      html += '<p class="meslek-dim">' + t("meslek.employees.empty") + "</p>";
    } else {
      y.calisanlar.forEach(function (c) {
        html +=
          '<div class="meslek-calisan-kart">' +
          '<div class="meslek-calisan-bas">' +
          "<strong>" +
          escHtml(c.reisAdi) +
          "</strong>" +
          "<span>" +
          escHtml(c.unvan) +
          t("meslek.employees.efficiency", { n: c.verimlilik }) +
          "</span></div>" +
          '<div class="meslek-calisan-detay">' +
          "<span>" +
          escHtml(t("meslek.employees.salary", { amount: fmt(c.gunlukMaas) })) +
          "</span>" +
          "<span>" + escHtml(t("meslek.employees.trainingPoint")) + "</span></div>" +
          '<div class="meslek-calisan-aksiyon">' +
          '<input type="number" id="sirketMaasGuncelle_' +
          c.userId +
          '" class="meslek-input meslek-input--kucuk" value="' +
          c.gunlukMaas +
          '" min="500" max="50000" />' +
          '<button type="button" class="meslek-btn" onclick="sirketMaasGuncelle(' +
          c.userId +
          ')">' +
          escHtml(t("meslek.employees.salaryBtn")) +
          "</button>" +
          '<button type="button" class="meslek-btn meslek-btn--gri" onclick="sirketIstenCikar(' +
          c.userId +
          ')">' +
          escHtml(t("meslek.employees.fireBtn")) +
          "</button>" +
          '<span class="meslek-egitim-grup">' +
          '<button type="button" class="meslek-btn meslek-btn--mini" onclick="sirketEgitim(' +
          c.userId +
          ", 'guc')\">" +
          escHtml(t("meslek.employees.trainGuc")) +
          "</button>" +
          '<button type="button" class="meslek-btn meslek-btn--mini" onclick="sirketEgitim(' +
          c.userId +
          ", 'zeka')\">" +
          escHtml(t("meslek.employees.trainZeka")) +
          "</button>" +
          '<button type="button" class="meslek-btn meslek-btn--mini" onclick="sirketEgitim(' +
          c.userId +
          ", 'dayaniklilik')\">" +
          escHtml(t("meslek.employees.trainDay")) +
          "</button>" +
          '<button type="button" class="meslek-btn meslek-btn--mini" onclick="sirketEgitim(' +
          c.userId +
          ", 'beceri')\">" +
          escHtml(t("meslek.employees.trainBeceri")) +
          "</button></span></div></div>";
      });
    }
    html += "</section>";

    html +=
      '<section class="meslek-bolum meslek-panel meslek-kapat-panel">' +
      meslekBolumBaslik("⚠️", t("meslek.close.title")) +
      '<p class="meslek-dim">' +
      t("meslek.close.desc", {
        name: escHtml(y.isim),
        amount: fmt(y.kasa || 0),
        employees: y.calisanlar ? y.calisanlar.length : 0,
      }) +
      "</p>" +
      '<button type="button" class="meslek-btn meslek-btn--tehlike" onclick="sirketKapat()">' +
      escHtml(t("meslek.close.btn")) +
      "</button></section>";
    return html;
  }

  html +=
    meslekHeroHTML(
      t("meslek.hero.createTitle"),
      t("meslek.hero.createDesc")
    ) +
    '<div class="meslek-panel meslek-panel--grid"><div class="meslek-sirket-kur-grid">';

  (sp.turler || []).forEach(function (tur) {
    html +=
      '<div class="meslek-sirket-tur-kart">' +
      "<h4>" +
      escHtml(tur.emoji) +
      " " +
      escHtml(tur.ad) +
      "</h4>" +
      "<p>" +
      escHtml(tur.aciklama) +
      "</p>" +
      '<ul class="meslek-tur-meta">' +
      "<li>" +
      t("meslek.create.setupFee", { amount: fmt(tur.kurulusUcreti) }) +
      "</li>" +
      "<li>" +
      t("meslek.create.product", { name: escHtml(tur.urunAd || t("meslek.dash")) }) +
      "</li>" +
      "<li>" +
      t("meslek.create.unitPrice", { amount: fmt(tur.birimSatisFiyati || 0) }) +
      "</li>" +
      "<li>" +
      t("meslek.create.positions", { n: tur.pozisyonSayisi }) +
      "</li></ul>" +
      '<input type="text" id="sirketIsim_' +
      tur.id +
      '" class="meslek-input" maxlength="32" placeholder="' +
      escHtml(t("meslek.create.namePlaceholder")) +
      '" />' +
      '<input type="text" id="sirketAciklama_' +
      tur.id +
      '" class="meslek-input" maxlength="120" placeholder="' +
      escHtml(t("meslek.create.descPlaceholder")) +
      '" />' +
      '<button type="button" class="meslek-btn meslek-btn--altin" onclick="sirketOlustur(\'' +
      tur.id +
      "')\">" +
      escHtml(t("meslek.create.btn")) +
      "</button></div>";
  });

  html += "</div></div>";
  return html;
}

function meslekIsyeriHTML(isyeri, aktifMeslek) {
  var calisanVar = sirketPanel && sirketPanel.aktifCalisan;
  var html =
    meslekSekmeHTML() +
    meslekHeroHTML(
      escHtml(isyeri.emoji || "🏢") + " " + escHtml(isyeri.ad),
      "<b>" + escHtml(isyeri.npc) + ":</b> " + escHtml(isyeri.aciklama),
      null,
      "meslekHaritayaDon()"
    ) +
    '<div class="meslek-panel"><div class="meslek-pozisyon-liste">';

  (isyeri.meslekler || []).forEach(function (m) {
    var uygunCls = m.uygun ? " uygun" : " yetersiz";
    var disabled = aktifMeslek || calisanVar ? " disabled" : "";
    html +=
      '<div class="meslek-pozisyon' +
      uygunCls +
      '">' +
      '<div class="meslek-pozisyon-bas">' +
      "<strong>" +
      escHtml(m.unvan) +
      "</strong>" +
      '<span class="meslek-pozisyon-rozet' +
      (m.uygun ? " meslek-pozisyon-rozet--ok" : " meslek-pozisyon-rozet--no") +
      '">' +
      (m.uygun ? escHtml(t("meslek.position.suitable")) : escHtml(t("meslek.position.insufficient"))) +
      "</span></div>" +
      '<span class="meslek-pozisyon-maas">' +
      escHtml(t("meslek.position.salaryPerDay", { amount: fmt(m.gunlukGelir) })) +
      "</span>" +
      "<p>" +
      escHtml(t("meslek.position.requirements")) +
      escHtml(meslekGereksinimMetin(m.gereksinim)) +
      "</p>" +
      '<p class="meslek-dim">' +
      escHtml(t("meslek.position.earnings")) +
      escHtml(meslekYetenekKazancMetin(m.yetenekKazanc)) +
      "</p>" +
      '<button type="button" class="meslek-btn meslek-btn--altin"' +
      disabled +
      " onclick=\"meslekMulakatBaslat('" +
      isyeri.id +
      "','" +
      m.id +
      "')\">" +
      escHtml(t("meslek.position.interview")) +
      "</button></div>";
  });

  html += "</div></div>";
  return html;
}

function meslekMulakatHTML(isyeri, meslek) {
  var soruHtml = "";
  (meslek.sorular || []).forEach(function (s, i) {
    var cls = s.gecti ? " gecti" : " kaldi";
    soruHtml +=
      '<div class="meslek-soru' +
      cls +
      '">' +
      '<span class="meslek-soru-no">' +
      (i + 1) +
      ".</span>" +
      '<div class="meslek-soru-metin">' +
      "<p>" +
      escHtml(s.soru) +
      "</p>" +
      "<small>" +
      escHtml(s.etiket) +
      t("meslek.interview.youHave", { current: s.mevcut, min: s.min }) +
      "</small></div>" +
      '<span class="meslek-soru-durum">' +
      (s.gecti ? "✓" : "✗") +
      "</span></div>";
  });

  return (
    meslekSekmeHTML() +
    '<div class="meslek-mulakat">' +
    meslekHeroHTML(
      t("meslek.interview.title", { title: escHtml(meslek.unvan) }),
      t("meslek.interview.evaluating", { npc: escHtml(isyeri.npc) }),
      null,
      "meslekIsyeriAc('" + isyeri.id + "')"
    ) +
    meslekMulakatGorselHTML(meslek) +
    '<div class="meslek-soru-liste">' +
    soruHtml +
    '</div><div class="meslek-mulakat-aksiyon">' +
    '<button type="button" class="meslek-btn meslek-btn--altin" onclick="meslekMulakatGonder()">' +
    escHtml(t("meslek.interview.evaluateBtn")) +
    "</button>" +
    "</div></div>"
  );
}

function meslekSonucHTML(sonuc) {
  var cls = sonuc.alindi ? " meslek-sonuc--ok" : " meslek-sonuc--red";
  var baslik = sonuc.alindi ? t("meslek.result.hired") : t("meslek.result.rejected");
  var detay = "";
  if (sonuc.alindi) {
    detay =
      "<p><b>" +
      escHtml(sonuc.isyeriAd) +
      "</b> — " +
      escHtml(sonuc.unvan) +
      "</p>" +
      "<p>" +
      t("meslek.result.dailySalary", { amount: fmt(sonuc.gunlukGelir) }) +
      "</p>" +
      '<p class="meslek-dim">' +
      t("meslek.result.dailyGain") +
      escHtml(meslekYetenekKazancMetin(sonuc.yetenekKazanc)) +
      "</p>";
  } else if (sonuc.eksikler && sonuc.eksikler.length) {
    detay = '<ul class="meslek-eksik-liste">';
    sonuc.eksikler.forEach(function (e) {
      detay +=
        "<li>" +
        escHtml(t("meslek.result.shortfall", { label: e.etiket, current: e.mevcut, min: e.min })) +
        "</li>";
    });
    detay += "</ul>";
  }

  return (
    meslekSekmeHTML() +
    '<div class="meslek-sonuc' +
    cls +
    '">' +
    "<h3>" +
    escHtml(baslik) +
    "</h3><p>" +
    escHtml(sonuc.mesaj || "") +
    "</p>" +
    detay +
    '<div class="meslek-mulakat-aksiyon">' +
    '<button type="button" class="meslek-btn" onclick="meslekHaritayaDon()">' +
    escHtml(t("meslek.result.backToMap")) +
    "</button>" +
    "</div></div>"
  );
}

function meslekInputOdakta() {
  var kok = document.getElementById("meslekKok");
  if (!kok) return false;
  var ae = document.activeElement;
  if (!ae || !kok.contains(ae)) return false;
  var tag = ae.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function meslekTaslakKaydet() {
  var kok = document.getElementById("meslekKok");
  if (!kok) return {};
  var taslak = {};
  kok.querySelectorAll("input, textarea, select").forEach(function (el) {
    if (!el.id) return;
    taslak[el.id] = el.value;
  });
  return taslak;
}

function meslekTaslakYukle(taslak) {
  if (!taslak) return;
  Object.keys(taslak).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el || taslak[id] == null || taslak[id] === "") return;
    el.value = taslak[id];
    if (id === "sirketFiyatRange") sirketFiyatOnizle(taslak[id]);
  });
}

function meslekTumunuCiz() {
  var kok = document.getElementById("meslekKok");
  if (!kok) return;
  var taslak = meslekInputOdakta() ? meslekTaslakKaydet() : null;

  if (meslekSekme === "sirketler") {
    kok.innerHTML = meslekSirketlerHTML();
    meslekTaslakYukle(taslak);
    return;
  }
  if (meslekSekme === "yonetim") {
    kok.innerHTML = meslekYonetimHTML();
    meslekTaslakYukle(taslak);
    return;
  }

  if (!meslekPanel) return;

  if (meslekGorunum === "mulakat" && meslekSeciliIsyeriId && meslekSeciliMeslekId) {
    var isyeriM = (meslekPanel.isyerleri || []).find(function (i) {
      return i.id === meslekSeciliIsyeriId;
    });
    var meslekM =
      isyeriM &&
      (isyeriM.meslekler || []).find(function (m) {
        return m.id === meslekSeciliMeslekId;
      });
    if (isyeriM && meslekM) {
      kok.innerHTML = meslekMulakatHTML(isyeriM, meslekM);
      meslekTaslakYukle(taslak);
      return;
    }
  }

  if (meslekGorunum === "sonuc" && meslekMulakatSonuc) {
    kok.innerHTML = meslekSonucHTML(meslekMulakatSonuc);
    meslekTaslakYukle(taslak);
    return;
  }

  if (meslekGorunum === "isyeri" && meslekSeciliIsyeriId) {
    var isyeri = (meslekPanel.isyerleri || []).find(function (i) {
      return i.id === meslekSeciliIsyeriId;
    });
    if (isyeri) {
      kok.innerHTML = meslekIsyeriHTML(isyeri, meslekPanel.aktifMeslek);
      meslekTaslakYukle(taslak);
      return;
    }
  }

  kok.innerHTML = meslekHaritaHTML(meslekPanel);
  meslekTaslakYukle(taslak);
}

function meslekSekmeDegistir(sekme) {
  meslekSekme = sekme;
  if (sekme === "npc") {
    meslekGorunum = "harita";
    meslekSeciliIsyeriId = null;
    meslekSeciliMeslekId = null;
  }
  meslekTumunuCiz();
}

function meslekSirketimAc() {
  meslekSekme = "yonetim";
  meslekHedefSirketId = null;
  ekranDegistir("meslekler");
}

function profilSirketDetayAc(sirketId) {
  meslekSekme = "sirketler";
  meslekHedefSirketId = sirketId;
  ekranDegistir("meslekler");
}

function meslekHedefSirketKaydir() {
  if (!meslekHedefSirketId) return;
  var el = document.getElementById("meslekSirketKart_" + meslekHedefSirketId);
  if (el) {
    el.classList.add("meslek-sirket-kart--vurgu");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function () {
      el.classList.remove("meslek-sirket-kart--vurgu");
    }, 2400);
  }
  meslekHedefSirketId = null;
}

async function meslekYukle() {
  var kok = document.getElementById("meslekKok");
  if (!kok) return;
  try {
    var res = await Promise.all([
      apiFetch("/api/meslek/panel"),
      apiFetch("/api/sirket/panel"),
    ]);
    var meslekData = await res[0].json().catch(function () {
      return {};
    });
    var sirketData = await res[1].json().catch(function () {
      return {};
    });
    if (!res[0].ok || !meslekData.ok) throw new Error(meslekData.error || t("meslek.error.panelLoad"));
    if (!res[1].ok || !sirketData.ok) throw new Error(sirketData.error || t("meslek.error.companyPanelLoad"));
    meslekPanel = meslekData;
    sirketPanel = sirketData;
    if (typeof meslekBildirim !== "undefined") {
      meslekBildirim = !!(sirketData.meslekMenuBildirim || (sirketData.bekleyenSirketBasvuru || 0) > 0);
      if (typeof meslekMenuYanip === "function") meslekMenuYanip();
    }
    meslekTumunuCiz();
    meslekHedefSirketKaydir();
  } catch (e) {
    kok.innerHTML = '<p class="meslek-hata">' + escHtml(e.message || t("meslek.error.loadFailed")) + "</p>";
  }
}

function meslekHaritayaDon() {
  meslekSekme = "npc";
  meslekGorunum = "harita";
  meslekSeciliIsyeriId = null;
  meslekSeciliMeslekId = null;
  meslekMulakatSonuc = null;
  meslekTumunuCiz();
}

function meslekIsyeriAc(isyeriId) {
  meslekSekme = "npc";
  meslekSeciliIsyeriId = isyeriId;
  meslekGorunum = "isyeri";
  meslekMulakatSonuc = null;
  meslekTumunuCiz();
}

function meslekMulakatBaslat(isyeriId, meslekId) {
  if (meslekPanel && meslekPanel.aktifMeslek) {
    toast(t("meslek.toast.quitNpcFirst"), "hata");
    return;
  }
  if (sirketPanel && sirketPanel.aktifCalisan) {
    toast(t("meslek.toast.quitCompanyFirst"), "hata");
    return;
  }
  meslekSeciliIsyeriId = isyeriId;
  meslekSeciliMeslekId = meslekId;
  meslekGorunum = "mulakat";
  meslekMulakatSonuc = null;
  meslekTumunuCiz();
}

async function meslekMulakatGonder() {
  if (!meslekSeciliMeslekId) return;
  var ef = await sunucuAksiyon("meslek_mulakat", null, null, { meslekId: meslekSeciliMeslekId });
  if (ef === null) return;
  meslekMulakatSonuc = ef;
  meslekGorunum = "sonuc";
  if (meslekPanel && ef.alindi && ef.meslek) meslekPanel.aktifMeslek = ef.meslek;
  toast(ef.mesaj || (ef.alindi ? t("meslek.toast.hired") : t("meslek.toast.rejected")), ef.alindi ? "basari" : "hata");
  meslekTumunuCiz();
}

async function meslekIstifa() {
  if (!confirm(t("meslek.confirm.quitNpc"))) return;
  var ef = await sunucuAksiyon("meslek_istifa");
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.resigned"), "basari");
  await meslekYukle();
}

async function sirketOlustur(turId) {
  var isimEl = document.getElementById("sirketIsim_" + turId);
  var acikEl = document.getElementById("sirketAciklama_" + turId);
  var isim = isimEl ? isimEl.value : "";
  var aciklama = acikEl ? acikEl.value : "";
  var ef = await sunucuAksiyon("sirket_olustur", null, null, { turId: turId, isim: isim, aciklama: aciklama });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.companyCreated"), "basari");
  meslekSekme = "yonetim";
  await meslekYukle();
}

async function sirketYatir() {
  var el = document.getElementById("sirketYatirInput");
  var miktar = el ? el.value : 0;
  var ef = await sunucuAksiyon("sirket_yatir", null, null, { miktar: miktar });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.deposited"), "basari");
  await meslekYukle();
}

async function sirketCek() {
  var el = document.getElementById("sirketYatirInput");
  var miktar = el ? el.value : 0;
  if (!miktar) {
    toast(t("meslek.toast.enterWithdrawAmount"), "hata");
    return;
  }
  var ef = await sunucuAksiyon("sirket_cek", null, null, { miktar: miktar });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.withdrawn"), "basari");
  await meslekYukle();
}

async function sirketIseAlimToggle() {
  var acik = !(sirketPanel && sirketPanel.yonetim && sirketPanel.yonetim.iseAlimAcik);
  var ef = await sunucuAksiyon("sirket_ise_alim", null, null, { acik: acik });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.updated"), acik ? "basari" : "bilgi");
  if (ef.gazeteHaber) {
    yeniGazeteHaber = true;
    if (typeof gazeteMenuYanip === "function") gazeteMenuYanip();
  }
  await meslekYukle();
}

async function sirketBasvur(sirketId, pozisyonId) {
  if (meslekPanel && meslekPanel.aktifMeslek) {
    toast(t("meslek.toast.inNpcJob"), "hata");
    return;
  }
  var ef = await sunucuAksiyon("sirket_basvur", null, null, { sirketId: sirketId, pozisyonId: pozisyonId });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.applicationSent"), "basari");
  await meslekYukle();
}

async function sirketBasvuruKabul(basvuruId) {
  var el = document.getElementById("sirketMaas_" + basvuruId);
  var maas = el ? el.value : null;
  var ef = await sunucuAksiyon("sirket_basvuru_kabul", null, null, { basvuruId: basvuruId, gunlukMaas: maas });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.employeeHired"), "basari");
  await meslekYukle();
}

async function sirketBasvuruRed(basvuruId) {
  var ef = await sunucuAksiyon("sirket_basvuru_red", null, null, { basvuruId: basvuruId });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.applicationRejected"), "basari");
  await meslekYukle();
}

async function sirketMaasGuncelle(calisanUserId) {
  var el = document.getElementById("sirketMaasGuncelle_" + calisanUserId);
  var maas = el ? el.value : null;
  var ef = await sunucuAksiyon("sirket_maas_guncelle", null, null, { calisanUserId: calisanUserId, gunlukMaas: maas });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.salaryUpdated"), "basari");
  await meslekYukle();
}

async function sirketIstenCikar(calisanUserId) {
  if (!confirm(t("meslek.confirm.fireEmployee"))) return;
  var ef = await sunucuAksiyon("sirket_isten_cikar", null, null, { calisanUserId: calisanUserId });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.employeeRemoved"), "basari");
  await meslekYukle();
}

async function sirketIstifa() {
  if (!confirm(t("meslek.confirm.quitCompany"))) return;
  var ef = await sunucuAksiyon("sirket_istifa");
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.resigned"), "basari");
  await meslekYukle();
}

async function sirketZamTalep() {
  var el = document.getElementById("sirketZamTalepInput");
  var talepMaas = el ? el.value : null;
  if (!talepMaas) {
    toast(t("meslek.toast.enterRaiseAmount"), "hata");
    return;
  }
  var n = Math.floor(Number(talepMaas) || 0);
  if (n > 50000) {
    toast(t("meslek.toast.raiseMax"), "hata");
    return;
  }
  var ef = await sunucuAksiyon("sirket_zam_talep", null, null, { talepMaas: talepMaas });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.raiseRequested"), "basari");
  await meslekYukle();
}

async function sirketZamOnayla(talepId) {
  var ef = await sunucuAksiyon("sirket_zam_onayla", null, null, { talepId: talepId });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.raiseApproved"), "basari");
  await meslekYukle();
}

async function sirketZamReddet(talepId) {
  if (!confirm(t("meslek.confirm.rejectRaise"))) return;
  var ef = await sunucuAksiyon("sirket_zam_reddet", null, null, { talepId: talepId });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.raiseRejected"), "basari");
  await meslekYukle();
}

async function sirketKapat() {
  if (!sirketPanel || !sirketPanel.yonetim) {
    toast(t("meslek.toast.noCompany"), "hata");
    return;
  }
  var y = sirketPanel.yonetim;
  var onay = t("meslek.confirm.closeCompany", {
    name: y.isim,
    amount: fmt(y.kasa || 0),
    employees: y.calisanlar ? y.calisanlar.length : 0,
  });
  if (!confirm(onay)) return;
  var ef = await sunucuAksiyon("sirket_kapat");
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.companyClosed"), "basari");
  meslekSekme = "sirketler";
  await meslekYukle();
}

async function yetenekAntrenman(yetenek) {
  if (!yetenek || ["guc", "zeka", "dayaniklilik", "beceri"].indexOf(yetenek) < 0) return;
  var ef = await sunucuAksiyon("yetenek_antrenman", null, null, { yetenek: yetenek });
  if (ef && ef.mesaj) toast(ef.mesaj, ef.kalanAntrenman != null && ef.kalanAntrenman >= 0 ? "basari" : "ok");
}

async function maasAntrenmanKullan(yetenek) {
  if (!yetenek || ["guc", "zeka", "dayaniklilik", "beceri"].indexOf(yetenek) < 0) return;
  var ef = await sunucuAksiyon("maas_antrenman_kullan", null, null, { yetenek: yetenek });
  if (ef === null) return;
  if (ef.mesaj) toast(ef.mesaj, "basari");
}

async function sirketEgitim(calisanUserId, yetenek) {
  var ef = await sunucuAksiyon("sirket_egitim", null, null, { calisanUserId: calisanUserId, yetenek: yetenek });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.trainingGiven"), "basari");
  await meslekYukle();
}

async function sirketMalzemeAl(malzemeId) {
  var el = document.getElementById("sirketStok_" + malzemeId);
  var miktar = el ? el.value : 0;
  if (!miktar || miktar < 1) {
    toast(t("meslek.toast.enterBuyQty"), "hata");
    return;
  }
  var ef = await sunucuAksiyon("sirket_malzeme_al", null, null, { malzemeId: malzemeId, miktar: miktar });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.materialsBought"), "basari");
  await meslekYukle();
}

async function sirketUpgrade(tipId) {
  var ef = await sunucuAksiyon("sirket_upgrade", null, null, { tipId: tipId });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.upgraded"), "basari");
  await meslekYukle();
}

async function sirketReklamDegistir() {
  var el = document.getElementById("sirketReklamSelect");
  var seviye = el ? el.value : 0;
  var ef = await sunucuAksiyon("sirket_reklam", null, null, { seviye: seviye });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.adUpdated"), "basari");
  await meslekYukle();
}

function sirketFiyatOnizle(val) {
  var el = document.getElementById("sirketFiyatOnizle");
  if (!el || !sirketPanel || !sirketPanel.yonetim) return;
  var baz = sirketPanel.yonetim.birimSatisFiyati || 500;
  var fiyat = Math.floor(baz * parseFloat(val || 1));
  el.textContent = t("meslek.ads.pricePreview", { mult: val, price: fmt(fiyat) });
}

async function sirketFiyatKaydet() {
  var el = document.getElementById("sirketFiyatRange");
  var carpan = el ? el.value : 1;
  var ef = await sunucuAksiyon("sirket_fiyat", null, null, { carpan: carpan });
  if (ef === null) return;
  toast(ef.mesaj || t("meslek.toast.priceUpdated"), "basari");
  await meslekYukle();
}

function meslekYetenekBandGuncelle() {
  var kok = document.getElementById("meslekKok");
  if (!kok || !meslekPanel || !meslekPanel.yetenekler) return;
  var band = kok.querySelector(".meslek-yetenek-band");
  if (!band) return;
  var gecici = document.createElement("div");
  gecici.innerHTML = meslekYetenekOzetHTML(meslekPanel.yetenekler);
  var yeni = gecici.firstElementChild;
  if (yeni) band.replaceWith(yeni);
}

function meslekYetenekleriGuncelle(yetenekler, aktifMeslek, antrenmanOrOzet, secenekler) {
  secenekler = secenekler || {};
  if (yetenekler && meslekPanel) {
    meslekPanel.yetenekler = yetenekler;
    if (antrenmanOrOzet && antrenmanOrOzet.gunlukLimit != null) {
      meslekPanel.antrenman = antrenmanOrOzet;
    } else if (antrenmanOrOzet && antrenmanOrOzet.statlar) {
      meslekPanel.antrenman = Object.assign({}, meslekPanel.antrenman || {}, {
        statlar: antrenmanOrOzet.statlar,
        ortalama: antrenmanOrOzet.ortalama,
        genelKademe: antrenmanOrOzet.kademe,
      });
    } else if (meslekPanel.antrenman && yetenekler) {
      meslekPanel.antrenman.statlar = (meslekPanel.antrenman.statlar || []).map(function (s) {
        return Object.assign({}, s, { deger: yetenekler[s.key] || s.deger });
      });
    }
    if (secenekler.maasAntrenmanPuani != null && meslekPanel.antrenman) {
      meslekPanel.antrenman.maasAntrenmanPuani = secenekler.maasAntrenmanPuani;
    }
  }
  if (aktifMeslek !== undefined && meslekPanel) meslekPanel.aktifMeslek = aktifMeslek;
  if (aktifEkran === "meslekler") {
    if (secenekler.poll || secenekler.atlaCiz) {
      meslekYetenekBandGuncelle();
    } else if (meslekInputOdakta()) {
      meslekYetenekBandGuncelle();
    } else {
      meslekTumunuCiz();
    }
  }
  if (typeof profilYetenekleriGuncelle === "function") {
    var ozet =
      antrenmanOrOzet && antrenmanOrOzet.statlar && antrenmanOrOzet.gunlukLimit == null
        ? antrenmanOrOzet
        : null;
    profilYetenekleriGuncelle(yetenekler, aktifMeslek, ozet);
  }
}

window.meslekHTML = meslekHTML;
window.meslekYukle = meslekYukle;
window.meslekSekmeDegistir = meslekSekmeDegistir;
window.meslekSirketimAc = meslekSirketimAc;
window.profilSirketDetayAc = profilSirketDetayAc;
window.meslekRaporlaraKaydir = meslekRaporlaraKaydir;
window.meslekHaritayaDon = meslekHaritayaDon;
window.meslekIsyeriAc = meslekIsyeriAc;
window.meslekMulakatBaslat = meslekMulakatBaslat;
window.meslekMulakatGonder = meslekMulakatGonder;
window.meslekIstifa = meslekIstifa;
window.yetenekAntrenman = yetenekAntrenman;
window.maasAntrenmanKullan = maasAntrenmanKullan;
window.meslekYetenekleriGuncelle = meslekYetenekleriGuncelle;
window.sirketOlustur = sirketOlustur;
window.sirketYatir = sirketYatir;
window.sirketCek = sirketCek;
window.sirketIseAlimToggle = sirketIseAlimToggle;
window.sirketBasvur = sirketBasvur;
window.sirketBasvuruKabul = sirketBasvuruKabul;
window.sirketBasvuruRed = sirketBasvuruRed;
window.sirketMaasGuncelle = sirketMaasGuncelle;
window.sirketIstenCikar = sirketIstenCikar;
window.sirketIstifa = sirketIstifa;
window.sirketKapat = sirketKapat;
window.sirketEgitim = sirketEgitim;
window.sirketMalzemeAl = sirketMalzemeAl;
window.sirketUpgrade = sirketUpgrade;
window.sirketReklamDegistir = sirketReklamDegistir;
window.sirketFiyatOnizle = sirketFiyatOnizle;
window.sirketFiyatKaydet = sirketFiyatKaydet;
