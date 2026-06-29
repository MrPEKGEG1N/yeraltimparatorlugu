self.addEventListener("push", function (event) {
  var data = { title: "Yeraltı İmparatorluğu", body: "", url: "/" };
  try {
    if (event.data) {
      var parsed = event.data.json();
      data.title = parsed.title || data.title;
      data.body = parsed.body || "";
      data.url = parsed.url || "/";
    }
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/images/ui/sm-title-plaque.png",
      badge: "/images/ui/sm-title-plaque.png",
      data: { url: data.url },
      tag: "yi-bildirim",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(self.location.origin) === 0 && "focus" in c) {
          if ("navigate" in c) return c.navigate(url).then(function () { return c.focus(); });
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
