/**
 * Mobil tarayıcıda tam ekran / immersive mod.
 * iOS Safari'de requestFullscreen çalışmaz; gerçek tam ekran = Ana Ekrana Ekle (PWA).
 */
(function () {
  "use strict";

  var MOBILE_MQ = window.matchMedia("(max-width: 768px), (pointer: coarse)");
  var immersiveForced = false;

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function isStandalone() {
    if (window.navigator.standalone === true) return true;
    try {
      return window.matchMedia("(display-mode: standalone)").matches;
    } catch (_) {
      return false;
    }
  }

  function isIosDevice() {
    var ua = navigator.userAgent || "";
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function isIosSafariBrowser() {
    if (!isIosDevice() || isStandalone()) return false;
    var ua = navigator.userAgent || "";
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }

  function setAppVh() {
    var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-vh", h + "px");
  }

  function nudgeBrowserChrome() {
    if (!isMobile() || isStandalone()) return;
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
    if (isIosSafariBrowser()) return Promise.reject(new Error("ios-safari"));
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
    if (!aktif) {
      if (typeof window.toast === "function") {
        window.toast(
          mobileLabel("game.mobile.immersiveOff", "Tam ekran modu kapatıldı"),
          "altin"
        );
      }
      return;
    }
    if (isIosSafariBrowser()) {
      if (typeof window.toast === "function") {
        window.toast(
          mobileLabel(
            "game.mobile.iosToast",
            "Safari çubukları gizlenemez — Ana Ekrana Ekle ile tam ekran"
          ),
          "altin"
        );
      }
      return;
    }
    if (typeof window.toast === "function") {
      window.toast(
        mobileLabel(
          "game.mobile.immersiveOn",
          "Tam ekran modu açık — oyun alanı genişletildi"
        ),
        "altin"
      );
    }
  }

  function showIosInstallModal() {
    var modal = document.getElementById("mobilTamEkranModal");
    if (!modal) return;
    if (typeof window.I18n !== "undefined" && window.I18n.apply) {
      window.I18n.apply(modal);
    }
    modal.classList.remove("gizli");
  }

  function hideIosInstallModal() {
    var modal = document.getElementById("mobilTamEkranModal");
    if (modal) modal.classList.add("gizli");
    try {
      sessionStorage.setItem("yi_ios_fs_hint", "1");
    } catch (_) {}
  }

  function maybeShowIosInstallModal() {
    if (!isIosSafariBrowser()) return;
    try {
      if (sessionStorage.getItem("yi_ios_fs_hint") === "1") return;
    } catch (_) {}
    showIosInstallModal();
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
    if (immersiveForced && !isIosSafariBrowser()) {
      setTimeout(nudgeBrowserChrome, 150);
      setTimeout(nudgeBrowserChrome, 450);
    }
  }

  function restoreImmersivePreference() {
    if (isIosSafariBrowser()) return;
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
    if (isIosSafariBrowser()) {
      btn.textContent = "📲";
    } else {
      btn.textContent = aktif ? "✕" : "⛶";
    }
    btn.classList.toggle("ml-mobile-fs-btn--aktif", aktif);
    var label = isIosSafariBrowser()
      ? mobileLabel("game.mobile.iosBtn", "Ana Ekrana Ekle rehberi")
      : aktif
        ? mobileLabel("game.mobile.exitFullscreen", "Tam ekrandan çık")
        : mobileLabel("game.mobile.fullscreen", "Tam ekran");
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }

  function toggleGameFullscreen() {
    if (!isMobile()) return;

    if (isIosSafariBrowser()) {
      if (isImmersiveActive()) {
        applyImmersiveForced(false);
        updateFullscreenBtn();
        showImmersiveToast(false);
        return;
      }
      applyImmersiveForced(true);
      updateFullscreenBtn();
      showImmersiveToast(true);
      maybeShowIosInstallModal();
      return;
    }

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
    syncMobileUiClass();
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

  function syncMobileUiClass() {
    document.documentElement.classList.toggle("ml-mobile-ui", isMobile());
    var header = document.getElementById("headerStatsBar");
    if (header && isMobile()) {
      header.classList.remove("ml-header-tools-open");
    }
  }

  function bindHeaderToolsDrawer() {
    var header = document.getElementById("headerStatsBar");
    var tab = document.getElementById("mlHeaderToolsTab");
    var drawer = header ? header.querySelector(".ml-header-right") : null;
    if (!header || !tab || header.dataset.toolsDrawer) return;
    header.dataset.toolsDrawer = "1";

    var startX = 0;
    var startY = 0;
    var tracking = false;

    function isOpen() {
      return header.classList.contains("ml-header-tools-open");
    }

    function setOpen(open) {
      header.classList.toggle("ml-header-tools-open", !!open);
      tab.setAttribute("aria-expanded", open ? "true" : "false");
      tab.textContent = open ? "✕" : "☰";
      tab.title = open
        ? mobileLabel("game.mobile.headerToolsClose", "Kapat")
        : mobileLabel("game.mobile.headerToolsHint", "Menüyü aç");
    }

    setOpen(false);

    function onTouchStart(e) {
      if (!isMobile() || e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }

    function onTouchEnd(e) {
      if (!tracking || !isMobile()) return;
      tracking = false;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      var onStats = e.target.closest && e.target.closest(".stats-bar");
      var onTab = e.target.closest && e.target.closest(".ml-header-tools-tab");
      var onDrawer = e.target.closest && e.target.closest(".ml-header-right");

      if (dx > 0 && !isOpen()) {
        if (onTab || startX < 36) {
          setOpen(true);
          return;
        }
        if (onStats) {
          var bar = header.querySelector(".stats-bar");
          if (bar && bar.scrollLeft <= 3) setOpen(true);
        }
        return;
      }

      if (dx < 0 && isOpen() && (onDrawer || onTab || onStats)) {
        setOpen(false);
      }
    }

    tab.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!isOpen());
    });

    header.addEventListener("touchstart", onTouchStart, { passive: true });
    header.addEventListener("touchend", onTouchEnd, { passive: true });

    if (drawer) {
      drawer.addEventListener("click", function (e) {
        if (e.target.closest("button") && !e.target.closest(".lang-picker-btn")) {
          setOpen(false);
        }
      });
    }

    document.addEventListener("click", function (e) {
      if (!isOpen() || !isMobile()) return;
      if (e.target.closest("#mlHeaderToolsTab")) return;
      if (e.target.closest(".ml-header-right")) return;
      if (e.target.closest(".lang-picker-menu")) return;
      setOpen(false);
    });
  }

  function bindChromeButtons() {
    var geri = document.getElementById("mlMobileGeriBtn");
    var fs = document.getElementById("mlMobileFullscreenHdrBtn");
    var modalKapat = document.getElementById("mobilTamEkranModalKapat");
    var modal = document.getElementById("mobilTamEkranModal");

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
    if (modalKapat && !modalKapat.dataset.bound) {
      modalKapat.dataset.bound = "1";
      modalKapat.addEventListener("click", hideIosInstallModal);
    }
    if (modal && !modal.dataset.bound) {
      modal.dataset.bound = "1";
      modal.addEventListener("click", function (e) {
        if (e.target === modal) hideIosInstallModal();
      });
    }
  }

  function init() {
    bindChromeButtons();
    syncMobileUiClass();
    bindHeaderToolsDrawer();
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
    updateFullscreenBtn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  MOBILE_MQ.addEventListener("change", function () {
    touchBound = false;
    var header = document.getElementById("headerStatsBar");
    if (header) delete header.dataset.toolsDrawer;
    init();
  });
})();
