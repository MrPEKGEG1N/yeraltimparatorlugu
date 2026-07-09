/**
 * Mobil tarayıcıda tam ekran / immersive mod.
 * iOS Safari'de requestFullscreen çalışmaz; CSS immersive + scroll nudge kullanılır.
 */
(function () {
  "use strict";

  var MOBILE_MQ = window.matchMedia("(max-width: 768px), (pointer: coarse)");
  var immersiveForced = false;

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function setAppVh() {
    var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-vh", h + "px");
  }

  function nudgeBrowserChrome() {
    if (!isMobile()) return;
    try {
      window.scrollTo(0, 1);
      requestAnimationFrame(function () {
        window.scrollTo(0, 0);
      });
    } catch (_) {}
  }

  function fullscreenActive() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.webkitCurrentFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function isImmersiveActive() {
    return fullscreenActive() || immersiveForced;
  }

  function tryFullscreen() {
    var el = document.documentElement;
    var fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.webkitEnterFullscreen ||
      el.msRequestFullscreen;
    if (!fn) return Promise.reject(new Error("no-fs"));
    try {
      var p = fn.call(el);
      if (p && typeof p.then === "function") {
        return p.then(function () {
          if (!fullscreenActive()) return Promise.reject(new Error("fs-not-active"));
        });
      }
      if (!fullscreenActive()) return Promise.reject(new Error("fs-not-active"));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function exitFullscreen() {
    var fn =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.webkitCancelFullScreen ||
      document.msExitFullscreen;
    if (!fn) return Promise.reject(new Error("no-exit"));
    try {
      var p = fn.call(document);
      if (p && typeof p.catch === "function") return p.catch(function () {});
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function mobileLabel(key, fallback) {
    if (typeof window.t === "function") {
      var val = window.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  function showImmersiveToast(aktif) {
    var msg = aktif
      ? mobileLabel(
          "game.mobile.immersiveOn",
          "Tam ekran modu açık — oyun alanı genişletildi"
        )
      : mobileLabel("game.mobile.immersiveOff", "Tam ekran modu kapatıldı");
    if (typeof window.toast === "function") {
      window.toast(msg, "altin");
    }
  }

  function applyImmersiveForced(on) {
    immersiveForced = !!on;
    document.documentElement.classList.toggle(
      "mobile-immersive-forced",
      immersiveForced
    );
    try {
      sessionStorage.setItem("yi_immersive", immersiveForced ? "1" : "0");
    } catch (_) {}
    setAppVh();
    nudgeBrowserChrome();
    if (immersiveForced) {
      setTimeout(nudgeBrowserChrome, 150);
      setTimeout(nudgeBrowserChrome, 450);
    }
  }

  function restoreImmersivePreference() {
    try {
      if (sessionStorage.getItem("yi_immersive") === "1") {
        applyImmersiveForced(true);
      }
    } catch (_) {}
  }

  function updateFullscreenBtn() {
    var btn = document.getElementById("mlMobileFullscreenHdrBtn");
    if (!btn) return;
    var aktif = isImmersiveActive();
    btn.textContent = aktif ? "✕" : "⛶";
    btn.classList.toggle("ml-mobile-fs-btn--aktif", aktif);
    var label = aktif
      ? mobileLabel("game.mobile.exitFullscreen", "Tam ekrandan çık")
      : mobileLabel("game.mobile.fullscreen", "Tam ekran");
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }

  function toggleGameFullscreen() {
    if (!isMobile()) return;

    if (isImmersiveActive()) {
      applyImmersiveForced(false);
      exitFullscreen().catch(function () {});
      updateFullscreenBtn();
      showImmersiveToast(false);
      return;
    }

    tryFullscreen()
      .then(function () {
        updateFullscreenBtn();
        showImmersiveToast(true);
      })
      .catch(function () {
        applyImmersiveForced(true);
        updateFullscreenBtn();
        showImmersiveToast(true);
      });
  }

  window.toggleGameFullscreen = toggleGameFullscreen;

  function layoutVisible() {
    var layout = document.getElementById("masterLayout");
    return layout && !layout.classList.contains("gizli");
  }

  function refreshImmersive() {
    if (!isMobile()) return;
    document.documentElement.classList.toggle(
      "mobile-immersive",
      layoutVisible() || immersiveForced
    );
    setAppVh();
    if (layoutVisible()) nudgeBrowserChrome();
    updateFullscreenBtn();
  }

  var touchBound = false;
  function bindPlayTouch() {
    if (touchBound || !layoutVisible()) return;
    touchBound = true;
    var layout = document.getElementById("masterLayout");
    if (!layout) return;
    layout.addEventListener(
      "touchstart",
      function once() {
        nudgeBrowserChrome();
        layout.removeEventListener("touchstart", once);
      },
      { passive: true }
    );
  }

  function bindChromeButtons() {
    var geri = document.getElementById("mlMobileGeriBtn");
    var fs = document.getElementById("mlMobileFullscreenHdrBtn");
    if (geri && !geri.dataset.bound) {
      geri.dataset.bound = "1";
      geri.addEventListener("click", function () {
        if (typeof window.ekranGeriGit === "function") window.ekranGeriGit();
      });
    }
    if (fs && !fs.dataset.bound) {
      fs.dataset.bound = "1";
      fs.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleGameFullscreen();
      });
    }
  }

  function init() {
    bindChromeButtons();
    restoreImmersivePreference();
    if (!isMobile()) return;

    setAppVh();
    refreshImmersive();

    window.addEventListener("resize", refreshImmersive);
    window.addEventListener("orientationchange", function () {
      setTimeout(function () {
        setAppVh();
        refreshImmersive();
        if (immersiveForced) nudgeBrowserChrome();
      }, 300);
    });
    window.addEventListener("pageshow", refreshImmersive);
    document.addEventListener("fullscreenchange", updateFullscreenBtn);
    document.addEventListener("webkitfullscreenchange", updateFullscreenBtn);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setAppVh);
      window.visualViewport.addEventListener("scroll", setAppVh);
    }

    var layout = document.getElementById("masterLayout");
    if (layout) {
      var obs = new MutationObserver(function () {
        refreshImmersive();
        bindPlayTouch();
      });
      obs.observe(layout, { attributes: true, attributeFilter: ["class"] });
    }

    bindPlayTouch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  MOBILE_MQ.addEventListener("change", function () {
    touchBound = false;
    init();
  });

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(updateFullscreenBtn, 50);
  });
})();
