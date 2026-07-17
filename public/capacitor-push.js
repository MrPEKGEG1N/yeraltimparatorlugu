/**
 * Capacitor native push (FCM) — APK içinde oyun/tarayıcı kapalıyken bildirim.
 * Web tarayıcıda no-op. Firebase google-services.json + sunucu FIREBASE_SERVICE_ACCOUNT_* gerekir.
 */
(function () {
  function bi(key, vars, fallback) {
    if (typeof t === "function") {
      var val = t(key, vars);
      if (val && val !== key) return val;
    }
    return fallback || key;
  }

  function isNative() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (_) {
      return false;
    }
  }

  function pushPlugin() {
    try {
      var Cap = window.Capacitor;
      if (!Cap || !Cap.Plugins) return null;
      return Cap.Plugins.PushNotifications || null;
    } catch (_) {
      return null;
    }
  }

  function api(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().catch(function () {
        return { ok: false };
      });
    });
  }

  function tokenKaydet(token) {
    if (!token) return Promise.resolve();
    return api("/api/bildirim/fcm-token", {
      token: token,
      platform: "android",
    });
  }

  function openUrl(url) {
    if (!url) return;
    try {
      if (url.charAt(0) === "/" || url.indexOf(location.origin) === 0) {
        window.location.href = url;
      }
    } catch (_) {}
  }

  async function bildirimCapacitorPushBaslat() {
    if (!isNative()) return;
    var Push = pushPlugin();
    if (!Push) return;

    try {
      var perm = await Push.checkPermissions();
      if (perm.receive !== "granted") {
        perm = await Push.requestPermissions();
      }
      if (perm.receive !== "granted") {
        console.warn("[fcm] bildirim izni verilmedi");
        return;
      }

      await Push.register();

      Push.addListener("registration", function (ev) {
        if (ev && ev.value) tokenKaydet(ev.value);
      });

      Push.addListener("registrationError", function (err) {
        console.warn("[fcm] kayıt hatası", err);
      });

      Push.addListener("pushNotificationActionPerformed", function (ev) {
        var data = (ev && ev.notification && ev.notification.data) || {};
        openUrl(data.url || "/");
      });

      Push.addListener("pushNotificationReceived", function () {
        /* Ön planda da zil listesi poll ile güncellenir */
      });
    } catch (err) {
      console.warn("[fcm] başlatılamadı", err && err.message ? err.message : err);
    }
  }

  window.bildirimCapacitorPushBaslat = bildirimCapacitorPushBaslat;
  window.bildirimCapacitorPushHint = function () {
    return bi(
      "bildirim.push.nativeHint",
      null,
      "Android uygulamasında kapalıyken bildirim için sistem izni gerekir."
    );
  };
})();
