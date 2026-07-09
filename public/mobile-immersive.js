/**
 * Mobil tarayıcıda (Safari / Chrome) üst-alt adres çubuklarını gizlemeye yardımcı olur.
 * Oyun alanı sabit kalır; yalnızca belge 1px kaydırılarak tarayıcı minimal UI moduna geçer.
 */
(function () {
  "use strict";

  var MOBILE_MQ = window.matchMedia("(max-width: 768px), (pointer: coarse)");

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

  function tryFullscreen() {
    var el = document.documentElement;
    var fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.webkitEnterFullscreen ||
      el.msRequestFullscreen;
    if (!fn) return;
    try {
      var p = fn.call(el);
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (_) {}
  }

  function layoutVisible() {
    var layout = document.getElementById("masterLayout");
    return layout && !layout.classList.contains("gizli");
  }

  function refreshImmersive() {
    if (!isMobile()) return;
    document.documentElement.classList.toggle("mobile-immersive", layoutVisible());
    setAppVh();
    if (layoutVisible()) nudgeBrowserChrome();
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
        tryFullscreen();
        layout.removeEventListener("touchstart", once);
      },
      { passive: true }
    );
  }

  function init() {
    if (!isMobile()) return;

    setAppVh();
    refreshImmersive();

    window.addEventListener("resize", refreshImmersive);
    window.addEventListener("orientationchange", function () {
      setTimeout(refreshImmersive, 300);
    });
    window.addEventListener("pageshow", refreshImmersive);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        setAppVh();
      });
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
})();
