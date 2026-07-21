(function () {
  var bildirimPanelAcik = false;
  var bildirimSekme = "liste";
  var bildirimTercihler = { bildirimAktif: true, pushAktif: true };
  var bildirimTurler = {};
  var bildirimListe = [];
  var okunmamisBildirim = 0;
  var swKayit = null;
  var vapidPublicKey = null;

  function bi(key, vars, fallback) {
    if (typeof t === "function") {
      var val = t(key, vars);
      if (val && val !== key) return val;
    }
    if (!fallback) return key;
    if (!vars || typeof vars !== "object") return fallback;
    var out = String(fallback);
    Object.keys(vars).forEach(function (k) {
      out = out.split("{" + k + "}").join(String(vars[k]));
    });
    return out;
  }

  function escHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function bildirimFmtZaman(ts) {
    if (!ts) return "";
    var lang = typeof I18N !== "undefined" && I18N.getLang ? I18N.getLang() : "tr";
    var locale = lang === "tr" ? "tr-TR" : "en-US";
    return new Date(ts * 1000).toLocaleString(locale, { timeZone: "Europe/Istanbul" });
  }

  function bildirimAktifMi() {
    return bildirimTercihler.bildirimAktif !== false;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function bildirimApi(url, opts) {
    opts = opts || {};
    opts.credentials = "include";
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (typeof guvenlikMeta !== "undefined") {
      Object.assign(opts.headers, guvenlikMeta.securityHeaders());
    }
    if (opts.body && typeof opts.body === "object") opts.body = JSON.stringify(opts.body);
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (d) {
        return { ok: r.ok && d.ok !== false, data: d, status: r.status };
      });
    });
  }

  function bildirimBtnDurumGuncelle() {
    var btn = document.getElementById("bildirimBtn");
    if (!btn) return;
    if (!bildirimAktifMi()) {
      btn.textContent = "🔕";
      btn.title = bi("bildirim.btn.off", null, "Bildirimler kapalı");
      btn.classList.add("bildirim-btn--kapali");
    } else {
      btn.innerHTML = '🔔<span id="bildirimBadge" class="bildirim-badge gizli">0</span>';
      btn.title = bi("bildirim.btn.on", null, "Bildirimler");
      btn.classList.remove("bildirim-btn--kapali");
      bildirimBadgeGuncelle();
    }
  }

  function bildirimBadgeGuncelle() {
    var badge = document.getElementById("bildirimBadge");
    if (!badge) return;
    if (!bildirimAktifMi() || okunmamisBildirim <= 0) {
      badge.classList.add("gizli");
      return;
    }
    badge.textContent = okunmamisBildirim > 99 ? "99+" : String(okunmamisBildirim);
    badge.classList.remove("gizli");
  }

  function bildirimTercihKaydet(patch) {
    return bildirimApi("/api/bildirim/tercihler", { method: "POST", body: patch }).then(function (res) {
      if (res.ok && res.data.tercihler) {
        bildirimTercihler = res.data.tercihler;
        bildirimBtnDurumGuncelle();
      }
      return res;
    });
  }

  function bildirimListeHTML() {
    if (!bildirimAktifMi()) {
      return '<p class="bildirim-bos">' + escHtml(bi("bildirim.list.off", null, "Bildirimler kapalı. Ayarlar sekmesinden açabilirsin.")) + "</p>";
    }
    if (!bildirimListe.length) {
      return '<p class="bildirim-bos">' + escHtml(bi("bildirim.list.empty", null, "Henüz bildirim yok.")) + "</p>";
    }
    var html =
      '<div class="bildirim-liste-ust">' +
      '<button type="button" class="bildirim-tumunu-sil" data-bildirim-sil="tumu">' +
      escHtml(bi("bildirim.deleteAll", null, "Tümünü sil")) +
      "</button></div>";
    html += bildirimListe
      .map(function (b) {
        return (
          '<div class="bildirim-oge' +
          (b.okundu ? "" : " okunmamis") +
          '" data-bildirim-id="' +
          b.id +
          '">' +
          '<div class="bildirim-oge-ust">' +
          '<p class="bildirim-oge-baslik">' +
          escHtml(b.baslik) +
          "</p>" +
          '<button type="button" class="bildirim-sil-btn" data-bildirim-sil="' +
          b.id +
          '" title="' +
          escHtml(bi("bildirim.deleteOne", null, "Sil")) +
          '" aria-label="' +
          escHtml(bi("bildirim.deleteOne", null, "Sil")) +
          '">×</button>' +
          "</div>" +
          '<p class="bildirim-oge-metin">' +
          escHtml(b.icerik) +
          "</p>" +
          '<p class="bildirim-oge-zaman">' +
          escHtml(bildirimFmtZaman(b.at)) +
          "</p></div>"
        );
      })
      .join("");
    return html;
  }

  function bildirimListeBagla() {
    var icerik = document.getElementById("bildirimIcerik");
    if (!icerik) return;
    icerik.querySelectorAll("[data-bildirim-sil]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var val = btn.getAttribute("data-bildirim-sil");
        if (val === "tumu") {
          bildirimSilTumu();
        } else {
          bildirimSilTek(parseInt(val, 10));
        }
      });
    });
  }

  function bildirimSilUygula(res) {
    if (!res.ok) {
      if (typeof toast === "function") {
        toast(tr(res.data.error) || bi("bildirim.deleteFail", null, "Bildirim silinemedi."), "hata");
      }
      return;
    }
    if (res.data.liste) bildirimListe = res.data.liste;
    okunmamisBildirim = res.data.okunmamis || 0;
    bildirimBadgeGuncelle();
    bildirimPanelCiz();
  }

  function bildirimSilTek(id) {
    if (!id) return;
    bildirimApi("/api/bildirim/sil", { method: "POST", body: { ids: [id] } }).then(bildirimSilUygula);
  }

  function bildirimSilTumu() {
    if (!bildirimListe.length) return;
    bildirimApi("/api/bildirim/sil", { method: "POST", body: { tumu: true } }).then(bildirimSilUygula);
  }

  function bildirimTercihHTML() {
    var anaAcik = bildirimAktifMi();
    var pushAcik = bildirimTercihler.pushAktif !== false;
    var keys = Object.keys(bildirimTurler || {});
    var html =
      '<div class="bildirim-ayar-grup">' +
      '<label class="bildirim-tercih bildirim-tercih--ana">' +
      "<span><strong>" +
      escHtml(bi("bildirim.master", null, "Tüm bildirimler")) +
      "</strong><small>" +
      escHtml(bi("bildirim.masterHint", null, "Oyun içi uyarılar ve zil rozeti")) +
      "</small></span>" +
      '<input type="checkbox" id="bildirimAnaAcik"' +
      (anaAcik ? " checked" : "") +
      "></label>" +
      '<label class="bildirim-tercih bildirim-tercih--ana">' +
      "<span><strong>" +
      escHtml(bi("bildirim.push", null, "Tarayıcı bildirimleri")) +
      "</strong><small>" +
      escHtml(bi("bildirim.pushHint", null, "Oyun kapalıyken masaüstü / mobil uyarı")) +
      "</small></span>" +
      '<input type="checkbox" id="bildirimPushAcik"' +
      (pushAcik ? " checked" : "") +
      (anaAcik ? "" : " disabled") +
      "></label>" +
      '<p class="bildirim-push-durum" id="bildirimPushDurum">…</p>' +
      '<button type="button" id="bildirimPushAcBtn" class="bildirim-push-btn gizli">' +
      escHtml(bi("bildirim.pushEnable", null, "🔔 Tarayıcı izni ver")) +
      "</button>" +
      "</div>";

    if (anaAcik) {
      html += '<div class="bildirim-ayar-grup bildirim-ayar-grup--turler"><p class="bildirim-ayar-baslik">' +
        escHtml(bi("bildirim.typesTitle", null, "Bildirim türleri")) +
        "</p>";
      keys.forEach(function (k) {
        var checked = bildirimTercihler[k] !== false ? " checked" : "";
        html +=
          '<label class="bildirim-tercih"><span>' +
          escHtml(bi("bildirim.tur." + k, null, bildirimTurler[k] || k)) +
          '</span><input type="checkbox" data-bildirim-tur="' +
          escHtml(k) +
          '"' +
          checked +
          "></label>";
      });
      html += "</div>";
    }

    html +=
      '<button type="button" id="bildirimTestBtn" class="bildirim-test-btn"' +
      (anaAcik ? "" : " disabled") +
      ">" +
      escHtml(bi("bildirim.testBtn", null, "🧪 Test bildirimi gönder")) +
      "</button>" +
      '<p class="bildirim-test-not" id="bildirimTestNot"></p>';
    return html;
  }

  function bildirimTercihBagla() {
    var icerik = document.getElementById("bildirimIcerik");
    if (!icerik) return;

    var ana = document.getElementById("bildirimAnaAcik");
    if (ana) {
      ana.addEventListener("change", function () {
        var acik = ana.checked;
        bildirimTercihKaydet({ bildirimAktif: acik }).then(function () {
          if (!acik) bildirimTercihKaydet({ pushAktif: false });
          bildirimPanelCiz();
        });
      });
    }

    var pushToggle = document.getElementById("bildirimPushAcik");
    if (pushToggle) {
      pushToggle.addEventListener("change", function () {
        if (!pushToggle.checked) {
          bildirimPushKapat();
          return;
        }
        if (Notification.permission === "granted") {
          bildirimPushAboneOl().then(function () {
            bildirimTercihKaydet({ pushAktif: true }).then(function () {
              bildirimPanelCiz();
            });
          });
          return;
        }
        bildirimPushAc();
      });
    }

    icerik.querySelectorAll("[data-bildirim-tur]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var patch = {};
        patch[inp.getAttribute("data-bildirim-tur")] = inp.checked;
        bildirimTercihKaydet(patch);
      });
    });

    var pushBtn = document.getElementById("bildirimPushAcBtn");
    if (pushBtn) pushBtn.addEventListener("click", bildirimPushAc);

    var testBtn = document.getElementById("bildirimTestBtn");
    if (testBtn) testBtn.addEventListener("click", bildirimTestGonder);
  }

  function bildirimPushDurumGuncelle() {
    var el = document.getElementById("bildirimPushDurum");
    var btn = document.getElementById("bildirimPushAcBtn");
    var pushToggle = document.getElementById("bildirimPushAcik");
    if (!el) return;

    if (!bildirimAktifMi()) {
      el.textContent = bi("bildirim.push.needMaster", null, "Önce tüm bildirimleri aç.");
      if (btn) btn.classList.add("gizli");
      if (pushToggle) pushToggle.disabled = true;
      return;
    }

    if (pushToggle) pushToggle.disabled = false;

    if (!("Notification" in window)) {
      el.textContent = bi("bildirim.push.unsupported", null, "Bu tarayıcı bildirimleri desteklemiyor.");
      if (btn) btn.classList.add("gizli");
      if (pushToggle) pushToggle.disabled = true;
      return;
    }

    if (bildirimTercihler.pushAktif === false) {
      el.textContent = bi("bildirim.push.off", null, "Tarayıcı bildirimleri kapalı.");
      if (btn) btn.classList.add("gizli");
      return;
    }

    if (Notification.permission === "granted") {
      el.textContent = bi("bildirim.push.on", null, "Tarayıcı bildirimleri açık.");
      if (btn) btn.classList.add("gizli");
      if (pushToggle) pushToggle.checked = true;
      return;
    }

    if (Notification.permission === "denied") {
      el.textContent = bi(
        "bildirim.push.denied",
        null,
        "Bildirim izni reddedildi. Tarayıcı ayarlarından bu site için izin ver."
      );
      if (btn) btn.classList.add("gizli");
      if (pushToggle) {
        pushToggle.checked = false;
        pushToggle.disabled = true;
      }
      return;
    }

    el.textContent = bi("bildirim.push.prompt", null, "Anlık uyarı için tarayıcı izni gerekir.");
    if (btn) {
      btn.classList.remove("gizli");
      btn.disabled = false;
    }
    if (pushToggle) pushToggle.checked = false;
  }

  function bildirimPanelCiz() {
    var icerik = document.getElementById("bildirimIcerik");
    if (!icerik) return;
    if (bildirimSekme === "liste") {
      icerik.innerHTML = bildirimListeHTML();
      bildirimListeBagla();
    } else {
      icerik.innerHTML = bildirimTercihHTML();
      bildirimPushDurumGuncelle();
      bildirimTercihBagla();
    }
    bildirimBtnDurumGuncelle();
  }

  function bildirimSwKaydet() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(function (reg) {
        swKayit = reg;
        return reg;
      })
      .catch(function () {
        return null;
      });
  }

  function bildirimPushAboneOl() {
    if (!swKayit || !vapidPublicKey || !("PushManager" in window)) return Promise.resolve(false);
    return swKayit.pushManager
      .getSubscription()
      .then(function (sub) {
        if (sub) return sub;
        return swKayit.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      })
      .then(function (sub) {
        if (!sub) return false;
        var json = sub.toJSON();
        return bildirimApi("/api/bildirim/subscribe", {
          method: "POST",
          body: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          },
        }).then(function (r) {
          return r.ok;
        });
      })
      .catch(function () {
        return false;
      });
  }

  /** İzin granted ise her girişte aboneliği sunucuya yeniden kaydet (DB kaybı / VAPID sonrası). */
  function bildirimPushYenidenKaydet() {
    if (!bildirimAktifMi()) return Promise.resolve(false);
    if (bildirimTercihler.pushAktif === false) return Promise.resolve(false);
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return Promise.resolve(false);
    }
    return bildirimSwKaydet().then(function (reg) {
      if (!reg || !vapidPublicKey) return false;
      return bildirimPushAboneOl();
    });
  }

  function bildirimPushKapat() {
    var done = function () {
      return bildirimTercihKaydet({ pushAktif: false }).then(function () {
        bildirimPanelCiz();
      });
    };
    if (!swKayit || !("PushManager" in window)) return done();
    return swKayit.pushManager
      .getSubscription()
      .then(function (sub) {
        if (!sub) return done();
        var endpoint = sub.endpoint;
        return sub
          .unsubscribe()
          .then(function () {
            return bildirimApi("/api/bildirim/unsubscribe", {
              method: "POST",
              body: { endpoint: endpoint },
            });
          })
          .then(done);
      })
      .catch(done);
  }

  function bildirimPushOtomatikBaslat() {
    if (!bildirimAktifMi()) return;
    if (bildirimTercihler.pushAktif === false) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      bildirimPushYenidenKaydet();
      return;
    }
    if (Notification.permission === "denied") return;
    if (window.__bildirimPushOtomatikBagli) return;
    window.__bildirimPushOtomatikBagli = true;

    var dene = function () {
      document.removeEventListener("click", dene, true);
      document.removeEventListener("keydown", dene, true);
      if (!bildirimAktifMi() || bildirimTercihler.pushAktif === false) return;
      if (Notification.permission === "granted") {
        bildirimPushYenidenKaydet();
        return;
      }
      if (Notification.permission !== "default") return;
      bildirimPushAc();
    };
    document.addEventListener("click", dene, true);
    document.addEventListener("keydown", dene, true);
  }

  function bildirimPushAc() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(function (perm) {
      if (perm === "granted") {
        bildirimPushAboneOl().then(function (ok) {
          return bildirimTercihKaydet({ pushAktif: true }).then(function () {
            bildirimPushDurumGuncelle();
            if (ok && typeof toast === "function") {
              toast(bi("bildirim.push.enabledToast", null, "Tarayıcı bildirimleri açıldı."));
            }
          });
        });
      } else {
        bildirimTercihKaydet({ pushAktif: false }).then(function () {
          bildirimPushDurumGuncelle();
        });
      }
    });
  }

  function bildirimTestGonder() {
    var not = document.getElementById("bildirimTestNot");
    if (not) not.textContent = bi("bildirim.test.sending", null, "Gönderiliyor…");
    bildirimApi("/api/bildirim/test", { method: "POST", body: {} }).then(function (res) {
      if (!not) return;
      if (res.ok) {
        not.textContent = bi("bildirim.test.ok", null, "Test bildirimi gönderildi. Zil listesini kontrol et.");
        if (typeof toast === "function") toast(bi("bildirim.test.okShort", null, "Test bildirimi gönderildi."));
        bildirimYukle();
        return;
      }
      not.textContent = tr(res.data.error) || bi("bildirim.test.fail", null, "Test bildirimi gönderilemedi.");
    });
  }

  function bildirimYukle() {
    return bildirimApi("/api/bildirim").then(function (res) {
      if (!res.ok) return;
      bildirimListe = res.data.liste || [];
      okunmamisBildirim = bildirimAktifMi() ? res.data.okunmamis || 0 : 0;
      if (res.data.tercihler) bildirimTercihler = res.data.tercihler;
      if (res.data.turler) bildirimTurler = res.data.turler;
      if (res.data.vapidPublicKey) vapidPublicKey = res.data.vapidPublicKey;
      bildirimBtnDurumGuncelle();
      if (bildirimPanelAcik) bildirimPanelCiz();
    });
  }

  function bildirimPanelToggle() {
    var panel = document.getElementById("bildirimPanel");
    if (!panel) return;
    bildirimPanelAcik = !bildirimPanelAcik;
    panel.classList.toggle("gizli", !bildirimPanelAcik);
    if (bildirimPanelAcik) {
      bildirimSekme = "liste";
      document.querySelectorAll(".bildirim-sekme").forEach(function (b) {
        b.classList.toggle("aktif", b.getAttribute("data-sekme") === "liste");
      });
      bildirimYukle().then(function () {
        bildirimPanelCiz();
        if (bildirimAktifMi() && okunmamisBildirim > 0) {
          bildirimApi("/api/bildirim/okundu", { method: "POST", body: {} }).then(function () {
            okunmamisBildirim = 0;
            bildirimBadgeGuncelle();
            bildirimListe.forEach(function (b) {
              b.okundu = true;
            });
            bildirimPanelCiz();
          });
        }
      });
    }
  }

  function bildirimBaslat() {
    var btn = document.getElementById("bildirimBtn");
    var panel = document.getElementById("bildirimPanel");
    if (!btn || !panel) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      bildirimPanelToggle();
    });

    var kapat = document.getElementById("bildirimKapatBtn");
    if (kapat) {
      kapat.addEventListener("click", function (e) {
        e.stopPropagation();
        bildirimPanelAcik = false;
        panel.classList.add("gizli");
      });
    }

    document.querySelectorAll(".bildirim-sekme").forEach(function (b) {
      b.addEventListener("click", function () {
        bildirimSekme = b.getAttribute("data-sekme");
        document.querySelectorAll(".bildirim-sekme").forEach(function (x) {
          x.classList.toggle("aktif", x === b);
        });
        bildirimPanelCiz();
      });
    });

    document.addEventListener("click", function (e) {
      if (!bildirimPanelAcik) return;
      var kok = document.getElementById("bildirimKontrol");
      if (kok && !kok.contains(e.target)) {
        bildirimPanelAcik = false;
        panel.classList.add("gizli");
      }
    });

    bildirimSwKaydet()
      .then(function () {
        return bildirimApi("/api/bildirim/vapid").then(function (res) {
          if (res.ok && res.data.publicKey) vapidPublicKey = res.data.publicKey;
        });
      })
      .then(function () {
        return bildirimYukle();
      })
      .then(function () {
        bildirimPushOtomatikBaslat();
        if (typeof window.bildirimCapacitorPushBaslat === "function") {
          window.bildirimCapacitorPushBaslat();
        }
      });
  }

  window.bildirimOyuncuGuncelle = function (sayi) {
    if (!bildirimAktifMi()) {
      okunmamisBildirim = 0;
      bildirimBtnDurumGuncelle();
      return;
    }
    var onceki = okunmamisBildirim;
    okunmamisBildirim = sayi || 0;
    bildirimBadgeGuncelle();
    if (okunmamisBildirim > onceki && typeof toast === "function") {
      bildirimYukle().then(function () {
        var son = bildirimListe[0];
        if (son && !son.okundu) toast(son.baslik + " — " + son.icerik);
      });
    }
  };

  window.bildirimBaslat = bildirimBaslat;
})();
