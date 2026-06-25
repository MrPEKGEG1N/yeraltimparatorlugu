/** Giriş ekranı — kullanım şartları, gizlilik, topluluk kuralları */
(function () {
  var BASLIKLAR = {
    kullanim: "Kullanım Şartları",
    gizlilik: "Gizlilik Politikası",
    topluluk: "Topluluk Kuralları",
  };

  var veri = null;
  var yukleniyor = null;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    if (!veri || !veri[key]) return "<p>İçerik yüklenemedi.</p>";
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
        veri = json;
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
  }

  function modalAc(key) {
    var modal = document.getElementById("kurallarModal");
    var baslik = document.getElementById("kurallarBaslik");
    var icerik = document.getElementById("kurallarIcerik");
    if (!modal || !baslik || !icerik) return;
    baslik.textContent = BASLIKLAR[key] || "Kurallar";
    icerik.innerHTML = "<p>Yükleniyor…</p>";
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tuslariBagla);
  } else {
    tuslariBagla();
  }

  window.kurallarModalAc = modalAc;
})();
