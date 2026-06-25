/** Giriş / kayıt ekranı — script.js'den önce yüklenir; sayfa yenilemesini engeller */
var authModu = "giris";
var aktifKullanici = null;
var authIslemSuruyor = false;
var AUTH_MOD_KEY = "yi_auth_mod";
var AUTH_DRAFT_KEY = "yi_auth_draft";

function authModuKaydet(mod) {
  try {
    sessionStorage.setItem(AUTH_MOD_KEY, mod);
  } catch (_) {}
}

function authTaslakKaydet() {
  try {
    var usernameEl = document.getElementById("username");
    var reisEl = document.getElementById("reisAdi");
    var lakapEl = document.getElementById("lakap");
    sessionStorage.setItem(
      AUTH_DRAFT_KEY,
      JSON.stringify({
        mod: authModu,
        username: usernameEl ? usernameEl.value : "",
        reisAdi: reisEl ? reisEl.value : "",
        lakap: lakapEl ? lakapEl.value : "",
      })
    );
  } catch (_) {}
}

function authTaslakGeriYukle() {
  try {
    var raw = sessionStorage.getItem(AUTH_DRAFT_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    if (d.mod === "kayit" || d.mod === "giris") authSekmeDegistir(d.mod, true);
    var usernameEl = document.getElementById("username");
    var reisEl = document.getElementById("reisAdi");
    var lakapEl = document.getElementById("lakap");
    if (usernameEl && d.username) usernameEl.value = d.username;
    if (reisEl && d.reisAdi) reisEl.value = d.reisAdi;
    if (lakapEl && d.lakap) lakapEl.value = d.lakap;
  } catch (_) {}
}

function authTaslakTemizle() {
  try {
    sessionStorage.removeItem(AUTH_DRAFT_KEY);
  } catch (_) {}
}

function authFormuTemizle() {
  ["username", "password", "reisAdi", "authHoneypot"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  authTaslakTemizle();
}

function authModuGeriYukle() {
  try {
    var saved = sessionStorage.getItem(AUTH_MOD_KEY);
    if (saved === "kayit" || saved === "giris") authSekmeDegistir(saved, true);
  } catch (_) {}
}

function apiOpts(method, body) {
  var opts = { method: method, credentials: "include", headers: {} };
  if (typeof guvenlikMeta !== "undefined") {
    Object.assign(opts.headers, guvenlikMeta.securityHeaders());
  }
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    if (typeof guvenlikMeta !== "undefined" && guvenlikMeta.getVisitorId()) {
      body.visitorId = guvenlikMeta.getVisitorId();
    }
    opts.body = JSON.stringify(body);
  }
  return opts;
}

function authHataGoster(mesaj) {
  var el = document.getElementById("authHata");
  if (!mesaj) {
    el.classList.add("gizli");
    el.textContent = "";
    return;
  }
  el.textContent = mesaj;
  el.classList.remove("gizli");
}

function authSekmeDegistir(mod, sessiz) {
  authModu = mod;
  authModuKaydet(mod);
  document.getElementById("sekmeGiris").classList.toggle("aktif-sekme", mod === "giris");
  document.getElementById("sekmeKayit").classList.toggle("aktif-sekme", mod === "kayit");
  document.getElementById("reisAdiAlan").classList.toggle("gizli", mod === "giris");
  document.getElementById("lakapAlan").classList.toggle("gizli", mod === "giris");
  var kabulAlan = document.getElementById("kurallarKabulAlan");
  if (kabulAlan) kabulAlan.classList.toggle("gizli", mod === "giris");
  var passEl = document.getElementById("password");
  if (passEl) passEl.setAttribute("autocomplete", mod === "kayit" ? "new-password" : "current-password");
  document.getElementById("authGonder").textContent =
    mod === "giris" ? "[ ⚔️ GİRİŞ YAP ]" : "[ 👑 REİS OL ]";
  authHataGoster("");
  if (!sessiz) authTaslakKaydet();
}

function yukleniyorGoster(mesaj) {
  var yuk = document.getElementById("yukleniyor");
  if (!yuk) return;
  yuk.innerHTML = mesaj || "⏳ İMPARATORLUK YÜKLENİYOR...";
  yuk.classList.remove("gizli");
}

function yukleniyorGizle() {
  var yuk = document.getElementById("yukleniyor");
  if (yuk) yuk.classList.add("gizli");
}

function authUrlTemizle() {
  if (!window.location.search) return;
  try {
    window.history.replaceState({}, "", window.location.pathname);
  } catch (_) {}
}

function oyunuGoster(user) {
  aktifKullanici = user;
  window.aktifKullanici = user;
  if (user && user.id != null) window.__benimUserId = user.id;
  document.getElementById("authEkran").classList.add("gizli");
  document.getElementById("masterLayout").classList.remove("gizli");
  if (window.TutorialEngine && typeof TutorialEngine.syncVisibility === "function") {
    TutorialEngine.syncVisibility();
  }
  yukleniyorGoster("⏳ İMPARATORLUK YÜKLENİYOR...");
  var etiket = document.getElementById("reisEtiket");
  if (etiket) etiket.textContent = "🕶️ " + (user.reisAdi || user.username);
  authTaslakTemizle();
  if (typeof oyunuBaslat === "function") {
    oyunuBaslat();
  } else {
    window.__bekleyenOyunUser = user;
  }
}

function authEkraniniGoster() {
  aktifKullanici = null;
  window.aktifKullanici = null;
  window.__benimUserId = null;
  document.getElementById("masterLayout").classList.add("gizli");
  document.getElementById("authEkran").classList.remove("gizli");
  yukleniyorGizle();
  if (window.TutorialEngine && typeof TutorialEngine.syncVisibility === "function") {
    TutorialEngine.syncVisibility();
  }
  authTaslakGeriYukle();
}

async function oturumKontrol() {
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 12000);
    var res = await fetch("/api/auth/me", Object.assign(apiOpts("GET"), { signal: ctrl.signal }));
    clearTimeout(timer);
    if (!res.ok) return false;
    var data = await res.json();
    if (!data.ok) return false;
    aktifKullanici = data.user;
    oyunuGoster(data.user);
    return true;
  } catch {
    return false;
  }
}

async function urlParamGirisDene() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("auth") !== "oto") return false;

  var username = (params.get("username") || "").trim();
  var password = params.get("password") || "";
  if (!username || !password) return false;

  authUrlTemizle();
  var reisAdi = (params.get("reisAdi") || "").trim();
  var kayit = !!reisAdi;
  if (kayit) authSekmeDegistir("kayit", true);

  var userEl = document.getElementById("username");
  var passEl = document.getElementById("password");
  if (userEl) userEl.value = username;
  if (passEl) passEl.value = password;
  if (kayit) {
    var reisEl = document.getElementById("reisAdi");
    var lakapEl = document.getElementById("lakap");
    if (reisEl) reisEl.value = reisAdi;
    if (lakapEl && params.get("lakap")) lakapEl.value = params.get("lakap");
  }

  yukleniyorGoster("⏳ GİRİŞ YAPILIYOR...");

  if (typeof guvenlikMeta !== "undefined") {
    try { await guvenlikMeta.getVisitorIdAsync(); } catch (_) {}
  }

  var body = {
    username: username,
    password: password,
    website: params.get("website") || "",
  };
  if (kayit) {
    body.reisAdi = reisAdi;
    body.lakap = params.get("lakap") || "Mafya";
  }

  try {
    var url = kayit ? "/api/auth/register" : "/api/auth/login";
    var res = await fetch(url, apiOpts("POST", body));
    var data = await res.json();
    if (!data.ok) {
      authEkraniniGoster();
      authHataGoster(data.error || "Giriş başarısız.");
      return false;
    }
    oyunuGoster(data.user);
    return true;
  } catch {
    authEkraniniGoster();
    authHataGoster("Sunucuya bağlanılamadı. Terminalde npm start çalıştırın.");
    return false;
  }
}

async function cikisYap(secenekler) {
  secenekler = secenekler || {};
  try {
    await fetch("/api/auth/logout", apiOpts("POST"));
  } catch (_) {}
  if (typeof hosgeldinBuOturum !== "undefined") hosgeldinBuOturum = false;
  if (typeof muzikDurdur === "function") muzikDurdur();
  if (typeof sunucuBagli !== "undefined") sunucuBagli = false;
  document.getElementById("masterLayout").classList.add("gizli");
  authEkraniniGoster();
  authSekmeDegistir("giris");
  if (secenekler.formuTemizle !== false) authFormuTemizle();
}

async function oturumDogrula() {
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 12000);
    var res = await fetch("/api/auth/me", Object.assign(apiOpts("GET"), { signal: ctrl.signal }));
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    var data = await res.json().catch(function () { return {}; });
    if (!data.ok) return { ok: false };
    return { ok: true, user: data.user };
  } catch {
    return { ok: false };
  }
}

async function authGonderIslem() {
  authHataGoster("");
  if (authIslemSuruyor) return;

  var btn = document.getElementById("authGonder");
  if (!btn || btn.disabled) return;

  var username = document.getElementById("username").value.trim();
  var password = document.getElementById("password").value;
  if (!username || username.length < 3) {
    authHataGoster("Kullanıcı adı en az 3 karakter olmalı.");
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    authHataGoster("Kullanıcı adı yalnızca harf, rakam ve _ içerebilir.");
    return;
  }
  if (!password || password.length < 6) {
    authHataGoster("Şifre en az 6 karakter olmalı.");
    return;
  }

  var body = {
    username: username,
    password: password,
    website: document.getElementById("authHoneypot")?.value || "",
  };
  if (authModu === "kayit") {
    body.reisAdi = document.getElementById("reisAdi").value.trim();
    body.lakap = document.getElementById("lakap").value;
    if (!body.reisAdi) {
      authHataGoster("Reis adını yazmalısın.");
      return;
    }
    var kabul = document.getElementById("kurallarKabul");
    if (!kabul || !kabul.checked) {
      authHataGoster("Kayıt için kuralları okuyup kabul etmelisin.");
      return;
    }
  }

  authTaslakKaydet();

  var eskiBtnText = btn.textContent;
  authIslemSuruyor = true;
  btn.disabled = true;
  btn.textContent = authModu === "kayit" ? "⏳ Kayıt yapılıyor..." : "⏳ Giriş yapılıyor...";

  if (typeof guvenlikMeta !== "undefined") {
    try { await guvenlikMeta.getVisitorIdAsync(); } catch (_) {}
  }

  var url = authModu === "kayit" ? "/api/auth/register" : "/api/auth/login";

  try {
    var res = await fetch(url, apiOpts("POST", body));
    var data = await res.json();
    if (!data.ok) {
      authHataGoster(data.error || "İşlem başarısız.");
      return;
    }
    var oturum = await oturumDogrula();
    if (!oturum.ok) {
      authHataGoster(
        "İşlem tamamlandı ama oturum kaydedilemedi. Çerezlere izin verip aynı bilgilerle tekrar giriş yap."
      );
      return;
    }
    authUrlTemizle();
    if (authModu === "kayit") window.__yeniKayitOlundu = true;
    oyunuGoster(oturum.user || data.user);
  } catch {
    authHataGoster("Sunucuya bağlanılamadı. Terminalde npm start çalıştırın.");
  } finally {
    authIslemSuruyor = false;
    btn.disabled = false;
    btn.textContent = eskiBtnText;
  }
}

function authEnterEngelle(e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  e.stopPropagation();
  authGonderIslem();
}

function authGirisTuslariBagla() {
  if (window.__authTuslariBagli) return;
  window.__authTuslariBagli = true;

  var sekmeGiris = document.getElementById("sekmeGiris");
  var sekmeKayit = document.getElementById("sekmeKayit");
  var wrap = document.getElementById("authForm");

  if (wrap) {
    wrap.addEventListener(
      "submit",
      function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        authGonderIslem();
        return false;
      },
      true
    );
  }

  if (sekmeGiris) {
    sekmeGiris.addEventListener("click", function (e) {
      e.preventDefault();
      authSekmeDegistir("giris");
    });
  }
  if (sekmeKayit) {
    sekmeKayit.addEventListener("click", function (e) {
      e.preventDefault();
      authSekmeDegistir("kayit");
    });
  }
  if (wrap) {
    wrap.addEventListener("keydown", authEnterEngelle);
    wrap.addEventListener("input", function () {
      authTaslakKaydet();
    });
    wrap.addEventListener("change", function () {
      authTaslakKaydet();
    });
  }
}

function authBekleyenOyunuBaslat() {
  if (!window.__bekleyenOyunUser || typeof oyunuBaslat !== "function") return;
  window.__bekleyenOyunUser = null;
  oyunuBaslat();
}

async function authBaslat() {
  if (window.__authBaslatildi) return;
  window.__authBaslatildi = true;

  yukleniyorGoster("⏳ Oturum kontrol ediliyor...");
  var authEl = document.getElementById("authEkran");
  if (authEl) authEl.classList.add("gizli");
  authModuGeriYukle();

  try {
    if (await urlParamGirisDene()) return;
    var yuklendi = await oturumKontrol();
    if (!yuklendi) {
      yukleniyorGizle();
      authEkraniniGoster();
    }
  } catch {
    yukleniyorGizle();
    authEkraniniGoster();
    authHataGoster("Bağlantı hatası. Sunucunun çalıştığından emin olun.");
  }
}

function authDomHazir() {
  authGirisTuslariBagla();
  function basla() {
    authBaslat();
    authBekleyenOyunuBaslat();
  }
  if (document.readyState === "complete") {
    basla();
  } else {
    window.addEventListener("load", basla, { once: true });
  }
}

window.authGonderIslem = authGonderIslem;

window.addEventListener("pageshow", function (e) {
  if (e.persisted && !aktifKullanici) {
    authModuGeriYukle();
    authTaslakGeriYukle();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", authDomHazir);
} else {
  authDomHazir();
}
