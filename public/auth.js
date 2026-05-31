/** Giriş / kayıt ekranı — oyun script.js'den önce yüklenir */
var authModu = "giris";
var aktifKullanici = null;

function apiOpts(method, body) {
  var opts = { method: method, credentials: "include", headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
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

function oyunuGoster(user) {
  aktifKullanici = user;
  document.getElementById("authEkran").classList.add("gizli");
  document.getElementById("oyunEkran").classList.remove("gizli");
  var etiket = document.getElementById("reisEtiket");
  if (etiket) etiket.textContent = "🕶️ " + (user.reisAdi || user.username);
  if (typeof oyunuBaslat === "function") oyunuBaslat();
}

function authEkraniniGoster() {
  aktifKullanici = null;
  document.getElementById("oyunEkran").classList.add("gizli");
  document.getElementById("authEkran").classList.remove("gizli");
}

async function oturumKontrol() {
  try {
    var res = await fetch("/api/auth/me", apiOpts("GET"));
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

async function cikisYap() {
  try {
    await fetch("/api/auth/logout", apiOpts("POST"));
  } catch (_) {}
  if (typeof hosgeldinBuOturum !== "undefined") hosgeldinBuOturum = false;
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

  var body = {
    username: document.getElementById("username").value.trim(),
    password: document.getElementById("password").value,
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
      authHataGoster(data.error || "İşlem başarısız.");
      return;
    }
    oyunuGoster(data.user);
  } catch {
    authHataGoster("Sunucuya bağlanılamadı. npm start çalışıyor mu?");
  } finally {
    btn.disabled = false;
  }
});

(async function authBaslat() {
  var yuklendi = await oturumKontrol();
  if (!yuklendi) authEkraniniGoster();
})();
