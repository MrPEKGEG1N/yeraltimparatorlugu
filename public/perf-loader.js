/** Geç yüklenecek modül ve CSS paketleri — ilk açılışı hızlandırır */
(function (global) {
  var MODULLER = {
    borsa: { js: "/borsa.js?v=9", css: "/borsa.css?v=4" },
    kumarhane: { js: "/kumarhane.js?v=29", css: "/kumarhane.css?v=24" },
    meslek: { js: "/meslek.js?v=29", css: "/meslek.css?v=20" },
    sefirlik: { js: "/sefirlik.js?v=3", css: "/sefirlik.css?v=1" },
    sabotaj: { js: "/sabotaj.js?v=6", css: "/sabotaj.css?v=4" },
    quill: {
      js: "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js",
      css: "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css",
      integrity: "sha384-QUJ+ckWz1M+a7w0UfG1sEn4pPrbQwSxGm/1TIPyioqXBrwuT9l4f9gdHWLDLbVWI",
    },
  };

  var yuklenen = Object.create(null);
  var cssYuklenen = Object.create(null);

  function cssYukle(href) {
    if (!href || cssYuklenen[href]) return cssYuklenen[href];
    cssYuklenen[href] = new Promise(function (resolve, reject) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = function () {
        resolve();
      };
      link.onerror = function () {
        reject(new Error("css_fail"));
      };
      document.head.appendChild(link);
    });
    return cssYuklenen[href];
  }

  function jsYukle(src, integrity) {
    if (!src || yuklenen[src]) return yuklenen[src];
    yuklenen[src] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      if (integrity) {
        s.integrity = integrity;
        s.crossOrigin = "anonymous";
      }
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("js_fail"));
      };
      document.head.appendChild(s);
    });
    return yuklenen[src];
  }

  function yiModulYukle(ad) {
    var mod = MODULLER[ad];
    if (!mod) return Promise.reject(new Error("unknown_module"));
    var anahtar = "mod:" + ad;
    if (yuklenen[anahtar]) return yuklenen[anahtar];

    yuklenen[anahtar] = Promise.all([
      mod.css ? cssYukle(mod.css) : Promise.resolve(),
      jsYukle(mod.js, mod.integrity),
    ]).then(function () {
      return ad;
    });

    return yuklenen[anahtar];
  }

  function yiModulOncedenYukle(liste) {
    if (!liste || !liste.length) return;
    liste.forEach(function (ad) {
      yiModulYukle(ad).catch(function () {});
    });
  }

  global.yiModulYukle = yiModulYukle;
  global.yiModulOncedenYukle = yiModulOncedenYukle;
})(window);
