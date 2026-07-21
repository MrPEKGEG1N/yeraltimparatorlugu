/** Cihaz parmak izi + güvenlik meta — auth.js ve script.js'den önce yüklenir */
(function (global) {
  var visitorId = null;
  var fpReady = null;
  var FP_SRC =
    "https://openfpcdn.io/fingerprintjs/v4/iife.min.js";
  var FP_INTEGRITY =
    "sha384-5avMhvpLsSAQTjeA8jxoWrSoqXS7YdhfzhCBJgHSaPnekisyX6C5pw+6EsLH87Sc";

  function fingerprintScriptYukle() {
    if (typeof FingerprintJS !== "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = FP_SRC;
      s.async = true;
      s.integrity = FP_INTEGRITY;
      s.crossOrigin = "anonymous";
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("fp_load_fail"));
      };
      document.head.appendChild(s);
    });
  }

  function initFingerprint() {
    if (fpReady) return fpReady;
    fpReady = fingerprintScriptYukle()
      .then(function () {
        if (typeof FingerprintJS === "undefined") return null;
        return FingerprintJS.load();
      })
      .then(function (fp) {
        if (!fp) return null;
        return fp.get();
      })
      .then(function (result) {
        visitorId = result && result.visitorId ? result.visitorId : null;
        return visitorId;
      })
      .catch(function () {
        return null;
      });
    return fpReady;
  }

  function getVisitorId() {
    return visitorId;
  }

  function getVisitorIdAsync() {
    return initFingerprint();
  }

  function getCsrfToken() {
    try {
      var m = document.cookie.match(/(?:^|;\s*)yi_csrf=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : "";
    } catch (_) {
      return "";
    }
  }

  function securityHeaders() {
    var h = {};
    if (visitorId) h["X-Visitor-Id"] = visitorId;
    var csrf = getCsrfToken();
    if (csrf) h["X-CSRF-Token"] = csrf;
    return h;
  }

  function actionMeta() {
    return {
      clientTs: Date.now(),
      visitorId: visitorId || null,
    };
  }

  global.guvenlikMeta = {
    init: initFingerprint,
    getVisitorId: getVisitorId,
    getVisitorIdAsync: getVisitorIdAsync,
    getCsrfToken: getCsrfToken,
    securityHeaders: securityHeaders,
    actionMeta: actionMeta,
  };
})(window);
