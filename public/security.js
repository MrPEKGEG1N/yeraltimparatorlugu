/** Cihaz parmak izi + güvenlik meta — auth.js ve script.js'den önce yüklenir */
(function (global) {
  var visitorId = null;
  var fpReady = null;

  function initFingerprint() {
    if (fpReady) return fpReady;
    if (typeof FingerprintJS === "undefined") {
      fpReady = Promise.resolve(null);
      return fpReady;
    }
    fpReady = FingerprintJS.load()
      .then(function (fp) {
        return fp.get();
      })
      .then(function (result) {
        visitorId = result.visitorId || null;
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

  function securityHeaders() {
    var h = {};
    if (visitorId) h["X-Visitor-Id"] = visitorId;
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
    securityHeaders: securityHeaders,
    actionMeta: actionMeta,
  };

  initFingerprint();
})(window);
