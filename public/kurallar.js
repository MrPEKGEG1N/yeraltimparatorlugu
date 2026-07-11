/** Giriş ekranı — kullanım şartları, gizlilik, topluluk kuralları */
(function () {
  var KURAL_I18N = {
    kullanim: "auth.rules.terms",
    gizlilik: "auth.rules.privacy",
    topluluk: "auth.rules.community",
  };

  var veri = null;
  var yukleniyor = null;
  var aktifKuralKey = null;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function baslikMetni(key) {
    if (typeof t === "function") {
      return t(KURAL_I18N[key] || "auth.rules.modalDefault");
    }
    var fallback = { kullanim: "Kullanım Şartları", gizlilik: "Gizlilik Politikası", topluluk: "Topluluk Kuralları" };
    return fallback[key] || "Kurallar";
  }

  function yukleniyorMetni() {
    return typeof t === "function" ? t("auth.rules.loading") : "Yükleniyor…";
  }

  function hostAdresi() {
    return window.location.host || "yeraltimparatorlugu.com";
  }

  function metinHostuDuzenle(text) {
    var host = hostAdresi();
    return String(text || "")
      .replace(/yeraltimparatorlugu-production\.up\.railway\.app/g, host)
      .replace(/destek@yeraltimparatorlugu-production\.up\.railway\.app/g, "destek@" + host);
  }

  function jsonHostuDuzenle(json) {
    if (!json || typeof json !== "object") return json;
    Object.keys(json).forEach(function (key) {
      var sections = json[key];
      if (!Array.isArray(sections)) return;
      sections.forEach(function (section) {
        if (!section || !Array.isArray(section.body)) return;
        section.body = section.body.map(metinHostuDuzenle);
      });
    });
    return json;
  }

  function maddeHtml(section) {
    var html = "<h3>" + escapeHtml(section.title) + "</h3>";
    if (!section.body || !section.body.length) return html;
    var listLike = section.body.length > 2 && section.body.every(function (line) {
      return line.length < 120 && !line.endsWith(".");
    });
    if (listLike) {
      html += "<ul>";
      section.body.forEach(function (line) {
        html += "<li>" + escapeHtml(line) + "</li>";
      });
      html += "</ul>";
    } else {
      section.body.forEach(function (line) {
        html += "<p>" + escapeHtml(line) + "</p>";
      });
    }
    return html;
  }

  function icerikHtml(key) {
    if (!veri || !veri[key]) return "<p>" + escapeHtml(yuklenemediMetni()) + "</p>";
    var sections = veri[key];
    var html = "";
    sections.forEach(function (section, i) {
      if (i === 0 && section.body && section.body.length === 1 && /güncelleme|guncelleme/i.test(section.body[0])) {
        html += "<p class=\"kurallar-meta\">" + escapeHtml(section.body[0]) + "</p>";
        return;
      }
      html += maddeHtml(section);
    });
    return html;
  }

  function veriYukle() {
    if (veri) return Promise.resolve(veri);
    if (yukleniyor) return yukleniyor;
    yukleniyor = fetch("/kurallar/kurallar.json?v=1", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("kurallar json");
        return res.json();
      })
      .then(function (json) {
        veri = jsonHostuDuzenle(json);
        return veri;
      })
      .catch(function () {
        veri = {};
        return veri;
      });
    return yukleniyor;
  }

  function modalKapat() {
    var modal = document.getElementById("kurallarModal");
    if (!modal) return;
    modal.classList.add("gizli");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    aktifKuralKey = null;
  }

  function modalAc(key) {
    var modal = document.getElementById("kurallarModal");
    var baslik = document.getElementById("kurallarBaslik");
    var icerik = document.getElementById("kurallarIcerik");
    if (!modal || !baslik || !icerik) return;
    aktifKuralKey = key;
    baslik.textContent = baslikMetni(key);
    icerik.innerHTML = "<p>" + escapeHtml(yukleniyorMetni()) + "</p>";
    modal.classList.remove("gizli");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    veriYukle().then(function () {
      icerik.innerHTML = icerikHtml(key);
    });
  }

  function tuslariBagla() {
    document.querySelectorAll("[data-kural]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.getAttribute("data-kural");
        if (key) modalAc(key);
      });
    });

    var kapat = document.getElementById("kurallarKapat");
    var ortu = document.querySelector(".kurallar-modal-ortu");
    if (kapat) kapat.addEventListener("click", modalKapat);
    if (ortu) ortu.addEventListener("click", modalKapat);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var modal = document.getElementById("kurallarModal");
        if (modal && !modal.classList.contains("gizli")) modalKapat();
      }
    });

    document.addEventListener("yi:langchange", function () {
      var modal = document.getElementById("kurallarModal");
      if (!modal || modal.classList.contains("gizli") || !aktifKuralKey) return;
      var baslik = document.getElementById("kurallarBaslik");
      if (baslik) baslik.textContent = baslikMetni(aktifKuralKey);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tuslariBagla);
  } else {
    tuslariBagla();
  }

  window.kurallarModalAc = modalAc;
})();
