self.addEventListener("push", function (event) {
  var data = { title: "Yeraltı İmparatorluğu", body: "", url: "/", tur: "", id: "" };
  try {
    if (event.data) {
      var parsed = event.data.json();
      data.title = String(parsed.title || data.title).slice(0, 120);
      data.body = String(parsed.body || "").slice(0, 500);
      data.url = String(parsed.url || "/").slice(0, 200);
      data.tur = String(parsed.tur || "");
      data.id = String(parsed.id || "");
    }
  } catch (_) {
    try {
      var text = event.data && event.data.text ? event.data.text() : "";
      if (text) data.body = String(text).slice(0, 500);
    } catch (__) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/images/ui/sm-title-plaque.png",
      badge: "/images/ui/sm-title-plaque.png",
      data: { url: data.url, tur: data.tur, id: data.id },
      tag: data.id ? "yi-bildirim-" + data.id : "yi-bildirim",
      renotify: true,
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";
  if (url.charAt(0) !== "/" && url.indexOf("http") !== 0) url = "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(self.location.origin) === 0 && "focus" in c) {
          if ("navigate" in c) {
            return c.navigate(url).then(function () {
              return c.focus();
            });
          }
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener("pushsubscriptionchange", function (event) {
  event.waitUntil(
    (async function () {
      try {
        var reg = self.registration;
        var appServerKey = null;
        try {
          var res = await fetch("/api/bildirim/vapid", { credentials: "include" });
          var json = await res.json();
          if (json && json.publicKey) appServerKey = json.publicKey;
        } catch (_) {}
        if (!appServerKey || !reg.pushManager) return;

        function urlBase64ToUint8Array(base64String) {
          var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
          var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
          var raw = atob(base64);
          var arr = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
          return arr;
        }

        var sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(appServerKey),
        });
        var j = sub.toJSON();
        await fetch("/api/bildirim/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: j.endpoint,
            keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
          }),
        });
      } catch (_) {}
    })()
  );
});
