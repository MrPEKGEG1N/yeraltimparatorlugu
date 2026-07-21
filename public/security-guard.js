/** Hile / bot / konsol / otomasyon koruması — production */
(function (global) {
  var prod =
    global.location &&
    global.location.hostname !== "localhost" &&
    global.location.hostname !== "127.0.0.1";

  if (!prod) return;

  var devtoolsAcik = false;
  var sonUyari = 0;
  var ihlalSayaci = 0;
  var bildirimZaman = Object.create(null);
  var tikZamanlari = [];
  var sonTikKonum = null;
  var noop = function () {};

  var I18N = {
    devtools: ["Geliştirici araçları tespit edildi. Hile girişimleri kayıt altına alınır.", "Developer tools detected. Cheat attempts are logged."],
    console: ["Konsol kullanımı yasak. Hile girişimleri kayıt altına alınır.", "Console use is blocked. Cheat attempts are logged."],
    botClick: ["Otomatik tıklama / bot yazılımı tespit edildi.", "Automated clicking or bot software detected."],
    untrusted: ["Güvenilmeyen otomasyon girişimi engellendi.", "Untrusted automation attempt blocked."],
    webdriver: ["Otomasyon tarayıcısı (bot) tespit edildi.", "Automation browser (bot) detected."],
    macro: ["Makro / Micromouse benzeri davranış tespit edildi.", "Macro / auto-clicker behavior detected."],
    tamper: ["Oyun koduna müdahale tespit edildi.", "Game code tampering detected."],
    repeat: ["Tekrarlayan hile girişimi! İşlemler izleniyor.", "Repeated cheat attempt! Actions are being monitored."],
  };

  function metin(key) {
    if (typeof t === "function") {
      var val = t("game.security." + key);
      if (val && val !== "game.security." + key) return val;
    }
    var row = I18N[key];
    if (!row) return key;
    var lang = typeof I18n !== "undefined" && I18n.getLang ? I18n.getLang() : "tr";
    return lang === "en" || lang === "en-US" ? row[1] : row[0];
  }

  function oyunAlani(el) {
    return el && el.closest && (el.closest("#masterLayout") || el.closest("#authEkran"));
  }

  function sunucuyaBildir(tip, detay) {
    var simdi = Date.now();
    var anahtar = String(tip || "unknown");
    if (bildirimZaman[anahtar] && simdi - bildirimZaman[anahtar] < 30000) return;
    bildirimZaman[anahtar] = simdi;
    try {
      var headers = { "Content-Type": "application/json" };
      if (typeof guvenlikMeta !== "undefined") {
        Object.assign(headers, guvenlikMeta.securityHeaders());
      }
      fetch("/api/security/report", {
        method: "POST",
        credentials: "include",
        headers: headers,
        body: JSON.stringify({ type: anahtar, detail: detay || {} }),
      }).catch(noop);
    } catch (_) {}
  }

  function inlineUyari(mesaj) {
    try {
      var eski = document.getElementById("yiGuvenlikUyari");
      if (eski) eski.remove();
      var div = document.createElement("div");
      div.id = "yiGuvenlikUyari";
      div.setAttribute("role", "alert");
      div.style.cssText =
        "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100001;" +
        "max-width:min(92vw,420px);padding:12px 18px;border-radius:8px;" +
        "background:linear-gradient(180deg,#8b0000,#5a0000);color:#fff;" +
        "font-family:Oswald,sans-serif;font-size:14px;font-weight:600;text-align:center;" +
        "border:1px solid rgba(255,120,120,0.5);box-shadow:0 8px 28px rgba(0,0,0,0.55);";
      div.textContent = mesaj;
      document.body.appendChild(div);
      setTimeout(function () {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 4500);
    } catch (_) {}
  }

  function uyariGoster(key, ciddi) {
    var simdi = Date.now();
    if (simdi - sonUyari < 2500) return;
    sonUyari = simdi;
    ihlalSayaci += 1;
    var mesaj = ihlalSayaci >= 3 ? metin("repeat") : metin(key);
    if (typeof toast === "function") toast(mesaj, "hata");
    else inlineUyari(mesaj);
    sunucuyaBildir(key, { count: ihlalSayaci, ciddi: !!ciddi });
    if (ciddi || ihlalSayaci >= 5) {
      global.__yiGuvenlikUyari = true;
    }
  }

  function devtoolsKontrol() {
    var threshold = 140;
    var acik =
      global.outerWidth - global.innerWidth > threshold ||
      global.outerHeight - global.innerHeight > threshold;
    if (acik && !devtoolsAcik) uyariGoster("devtools", true);
    devtoolsAcik = acik;
  }

  function konsolKilitle() {
    var tuzak = function () {
      uyariGoster("console", true);
      return noop;
    };
    var yontemler = ["log", "debug", "info", "warn", "error", "clear", "dir", "dirxml", "table", "trace", "group", "groupCollapsed", "groupEnd", "profile", "profileEnd", "time", "timeEnd", "count", "assert"];
    yontemler.forEach(function (m) {
      try {
        Object.defineProperty(console, m, {
          configurable: false,
          get: tuzak,
          set: noop,
        });
      } catch (_) {
        try {
          console[m] = function () {
            uyariGoster("console", true);
          };
        } catch (__) {}
      }
    });
  }

  function klavyeEngelle(e) {
    var key = String(e.key || "").toLowerCase();
    var kod = e.keyCode || e.which;
    if (key === "f12" || kod === 123) {
      e.preventDefault();
      e.stopImmediatePropagation();
      uyariGoster("devtools", true);
      return false;
    }
    if (e.ctrlKey && e.shiftKey && (key === "i" || key === "j" || key === "c" || key === "k")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      uyariGoster("devtools", true);
      return false;
    }
    if (e.metaKey && e.altKey && (key === "i" || key === "j" || key === "c")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      uyariGoster("devtools", true);
      return false;
    }
    if (e.ctrlKey && key === "u") {
      e.preventDefault();
      e.stopImmediatePropagation();
      uyariGoster("tamper", false);
      return false;
    }
  }

  function guvenilmeyenGirdi(e) {
    if (!oyunAlani(e.target)) return;
    if (e.isTrusted === false) {
      e.preventDefault();
      e.stopImmediatePropagation();
      uyariGoster("untrusted", true);
      return false;
    }
  }

  function makroTikAnaliz(e) {
    if (!oyunAlani(e.target)) return;
    var simdi = Date.now();
    var x = e.clientX;
    var y = e.clientY;

    if (sonTikKonum && sonTikKonum.x === x && sonTikKonum.y === y && simdi - sonTikKonum.t < 120) {
      uyariGoster("macro", true);
    }
    sonTikKonum = { x: x, y: y, t: simdi };

    tikZamanlari.push(simdi);
    if (tikZamanlari.length > 10) tikZamanlari.shift();
    if (tikZamanlari.length < 6) return;

    var araliklar = [];
    for (var i = 1; i < tikZamanlari.length; i++) {
      araliklar.push(tikZamanlari[i] - tikZamanlari[i - 1]);
    }
    var ort = araliklar.reduce(function (a, b) {
      return a + b;
    }, 0) / araliklar.length;
    if (ort < 40 || ort > 800) return;

    var duzenli = araliklar.every(function (ms) {
      return Math.abs(ms - ort) < 12;
    });
    if (duzenli) uyariGoster("botClick", true);
  }

  function fonksiyonKoru(isim) {
    var orig = global[isim];
    if (typeof orig !== "function") return;
    var wrapped = function () {
      if (global.__yiGuvenlikUyari && String(isim) !== "apiFetch") {
        uyariGoster("tamper", true);
        if (isim === "sunucuAksiyon") return null;
      }
      if (global.__yiGuvenlikUyari && isim === "apiFetch") {
        var url = arguments[0];
        if (String(url || "").indexOf("/api/security/report") < 0) {
          uyariGoster("tamper", true);
          return Promise.reject(new Error("security_block"));
        }
      }
      return orig.apply(this, arguments);
    };
    try {
      Object.defineProperty(global, isim, {
        configurable: false,
        writable: false,
        value: wrapped,
      });
    } catch (_) {
      global[isim] = wrapped;
    }
  }

  konsolKilitle();
  devtoolsKontrol();

  global.addEventListener("resize", devtoolsKontrol, true);
  setInterval(devtoolsKontrol, 1200);

  global.addEventListener("contextmenu", function (e) {
    if (oyunAlani(e.target)) {
      e.preventDefault();
    }
  }, true);

  global.addEventListener("keydown", klavyeEngelle, true);
  global.addEventListener("click", guvenilmeyenGirdi, true);
  global.addEventListener("mousedown", guvenilmeyenGirdi, true);
  global.addEventListener("pointerdown", guvenilmeyenGirdi, true);
  global.addEventListener("touchstart", guvenilmeyenGirdi, true);
  global.addEventListener("click", makroTikAnaliz, true);

  if (global.navigator && global.navigator.webdriver) {
    uyariGoster("webdriver", true);
  }

  ["apiFetch", "sunucuAksiyon"].forEach(fonksiyonKoru);

  try {
    Object.defineProperty(global, "eval", {
      configurable: false,
      writable: false,
      value: function () {
        uyariGoster("tamper", true);
        throw new Error("eval blocked");
      },
    });
  } catch (_) {}

  global.__yiGuvenlik = {
    ihlal: function () {
      return ihlalSayaci;
    },
  };
})(window);
