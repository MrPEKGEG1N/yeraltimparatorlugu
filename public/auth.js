/** Giriş / kayıt ekranı — oyun script.js'den önce yüklenir */
var authModu = "giris";
var aktifKullanici = null;

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

function authSekmeDegistir(mod) {
  authModu = mod;
  document.getElementById("sekmeGiris").classList.toggle("aktif-sekme", mod === "giris");
  document.getElementById("sekmeKayit").classList.toggle("aktif-sekme", mod === "kayit");
  document.getElementById("reisAdiAlan").classList.toggle("gizli", mod === "giris");
  document.getElementById("lakapAlan").classList.toggle("gizli", mod === "giris");
  document.getElementById("authGonder").textContent =
    mod === "giris" ? "[ ⚔️ GİRİŞ YAP ]" : "[ 👑 REİS OL ]";
  authHataGoster("");
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
  document.getElementById("authEkran").classList.add("gizli");
  document.getElementById("masterLayout").classList.remove("gizli");
  yukleniyorGoster("⏳ İMPARATORLUK YÜKLENİYOR...");
  var etiket = document.getElementById("reisEtiket");
  if (etiket) etiket.textContent = "🕶️ " + (user.reisAdi || user.username);
  if (typeof oyunuBaslat === "function") oyunuBaslat();
}

function authEkraniniGoster() {
  aktifKullanici = null;
  document.getElementById("masterLayout").classList.add("gizli");
  document.getElementById("authEkran").classList.remove("gizli");
  yukleniyorGizle();
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
  var username = (params.get("username") || "").trim();
  var password = params.get("password") || "";
  if (!username || !password) return false;

  authUrlTemizle();
  var reisAdi = (params.get("reisAdi") || "").trim();
  var kayit = !!reisAdi;
  if (kayit) authSekmeDegistir("kayit");

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

async function cikisYap() {
  try {
    await fetch("/api/auth/logout", apiOpts("POST"));
  } catch (_) {}
  if (typeof hosgeldinBuOturum !== "undefined") hosgeldinBuOturum = false;
  if (typeof muzikDurdur === "function") muzikDurdur();
  authEkraniniGoster();
  authSekmeDegistir("giris");
  document.getElementById("authForm").reset();
}

document.getElementById("sekmeGiris").addEventListener("click", function () {
  authSekmeDegistir("giris");
});
document.getElementById("sekmeKayit").addEventListener("click", function () {
  authSekmeDegistir("kayit");
});

document.getElementById("authForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  authHataGoster("");
  var btn = document.getElementById("authGonder");
  btn.disabled = true;
  yukleniyorGoster("⏳ GİRİŞ YAPILIYOR...");

  if (typeof guvenlikMeta !== "undefined") {
    try { await guvenlikMeta.getVisitorIdAsync(); } catch (_) {}
  }

  var body = {
    username: document.getElementById("username").value.trim(),
    password: document.getElementById("password").value,
    website: document.getElementById("authHoneypot")?.value || "",
  };
  if (authModu === "kayit") {
    body.reisAdi = document.getElementById("reisAdi").value.trim();
    body.lakap = document.getElementById("lakap").value;
  }

  var url = authModu === "kayit" ? "/api/auth/register" : "/api/auth/login";

  try {
    var res = await fetch(url, apiOpts("POST", body));
    var data = await res.json();
    if (!data.ok) {
      yukleniyorGizle();
      authHataGoster(data.error || "İşlem başarısız.");
      return;
    }
    authUrlTemizle();
    oyunuGoster(data.user);
  } catch {
    yukleniyorGizle();
    authHataGoster("Sunucuya bağlanılamadı. Terminalde npm start çalıştırın.");
  } finally {
    btn.disabled = false;
  }
});

(async function authBaslat() {
  yukleniyorGoster("⏳ İMPARATORLUK YÜKLENİYOR...");
  try {
    if (await urlParamGirisDene()) return;
    var yuklendi = await oturumKontrol();
    if (!yuklendi) authEkraniniGoster();
  } catch {
    authEkraniniGoster();
    authHataGoster("Bağlantı hatası. Sunucunun çalıştığından emin olun.");
  }
})();
