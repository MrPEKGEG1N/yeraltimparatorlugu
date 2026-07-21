/** Auth form submit/Enter yakalama — inline script CSP uyumu için ayrı dosya */
(function () {
  function authAktifMi() {
    var auth = document.getElementById("authEkran");
    return auth && !auth.classList.contains("gizli");
  }
  function authFormIcinde(el) {
    return el && el.closest && (el.closest("#authForm") || el.closest("#authEkran"));
  }
  function authGonderCagir() {
    if (typeof window.authGonderIslem === "function") {
      window.authGonderIslem();
    }
  }
  document.addEventListener(
    "submit",
    function (e) {
      if (!authAktifMi()) return;
      if (!authFormIcinde(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      authGonderCagir();
      return false;
    },
    true
  );
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Enter") return;
      if (!authAktifMi()) return;
      if (!authFormIcinde(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      authGonderCagir();
    },
    true
  );
})();
