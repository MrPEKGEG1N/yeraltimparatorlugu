(function () {
  var seciliOyuncuId = null;
  var aktifMsgTab = "kutu";
  var aktivitePollTimer = null;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("tr-TR");
  }

  function toast(msg, hata) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = hata ? "hata" : "ok";
    el.classList.remove("hidden");
    setTimeout(function () {
      el.classList.add("hidden");
    }, 3500);
  }

  function api(url, opts) {
    opts = opts || {};
    opts.credentials = "include";
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (opts.body && typeof opts.body === "object") opts.body = JSON.stringify(opts.body);

    var timeoutMs = 12000;
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (controller) {
      opts.signal = controller.signal;
      setTimeout(function () {
        try {
          controller.abort();
        } catch (_) {}
      }, timeoutMs);
    }

    return fetch(url, opts)
      .then(function (r) {
        return r
          .json()
          .catch(function () {
            return { ok: false, error: "Sunucu yanıtı okunamadı (HTTP " + r.status + ")." };
          })
          .then(function (data) {
            return { ok: r.ok && data && data.ok !== false, status: r.status, data: data || {} };
          });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          return {
            ok: false,
            status: 0,
            data: { error: "Sunucu yanıt vermedi. npm start çalıştırıp sayfayı yenileyin." },
          };
        }
        return { ok: false, status: 0, data: { error: "Sunucuya bağlanılamadı. npm start çalışıyor mu?" } };
      });
  }

  function yetkisizGoster(mesaj) {
    var metin = document.getElementById("yetkisizMetin");
    if (metin) metin.textContent = mesaj;
    document.getElementById("app").classList.add("hidden");
    document.getElementById("yetkisiz").classList.remove("hidden");
  }

  function panelAc() {
    document.getElementById("yetkisiz").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
  }

  function aktifNav(tab) {
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.classList.toggle("aktif", btn.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.add("hidden");
    });
    var panel = document.getElementById("tab-" + tab);
    if (panel) panel.classList.remove("hidden");
    var baslik = {
      dashboard: "Özet",
      oyuncular: "Oyuncu Yönetimi",
      mafya: "Mafya Grupları",
      aktivite: "Canlı Aktivite",
      multi: "Şüpheli Multi-Hesaplar",
      mesajlar: "Sohbet Kontrol",
      guvenlik: "Güvenlik Günlüğü",
    };
    document.getElementById("sayfaBaslik").textContent = baslik[tab] || tab;
  }

  function yukleDashboard() {
    api("/api/admin/dashboard").then(function (res) {
      if (!res.ok) {
        toast(res.data.error || "Özet yüklenemedi", true);
        return;
      }
      var s = res.data.stats || {};
      document.getElementById("statGrid").innerHTML =
        statKart("Toplam Oyuncu", s.toplam_oyuncu, "👥") +
        statKart("Banlı", s.banli, "🚫") +
        statKart("Son 15 dk Aktif", s.online_15dk, "🟢") +
        statKart("Güvenlik (24s)", s.olay_24s, "⚠️") +
        statKart("Mesaj (24s)", s.mesaj_24s, "💬") +
        statKart("Mafya Grubu", s.mafya_grup, "🔫") +
        statKart("Yönetici", s.admin_sayisi, "👑");
    });
  }

  function statKart(label, val, icon) {
    return (
      '<div class="stat-kart"><p class="etiket">' +
      esc(icon + " " + label) +
      '</p><p class="deger">' +
      esc(fmt(val)) +
      "</p></div>"
    );
  }

  function oyuncuTabloCiz(liste) {
    var tb = document.getElementById("oyuncuTablo");
    if (!liste.length) {
      tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:#6b7280;padding:16px">Sonuç yok.</td></tr>';
      return;
    }
    tb.innerHTML = liste
      .map(function (o) {
        var durum = o.banned
          ? '<span style="color:#f87171">Banlı</span>'
          : o.isAdmin
            ? '<span style="color:#c5a059">Admin</span>'
            : o.online
              ? '<span style="color:#4ade80">Çevrimiçi</span>'
              : '<span style="color:#6b7280">Uzakta</span>';
        var ekran = o.online && o.aktifEkranLabel
          ? '<span style="color:#93c5fd;font-size:12px">' + esc(o.aktifEkranLabel) + "</span>"
          : '<span style="color:#4b5563">—</span>';
        var sonIs = o.online && o.sonAksiyonLabel
          ? '<span style="font-size:12px">' + esc(o.sonAksiyonLabel) + "</span>"
          : '<span style="color:#4b5563">—</span>';
        return (
          "<tr><td>" + o.id + "</td><td><b>" + esc(o.reisAdi) + "</b></td><td>" + esc(o.username) +
          "</td><td>" + fmt(o.smsHakki) + "</td><td>" + fmt(o.mekanToplam) +
          "</td><td title='" + esc(o.guvenliYerAd || "") + "'>" + fmt(o.guvenliYerSeviye) +
          "</td><td title='+" + fmt(o.istihbaratGuc || 0) + " güç'>" + fmt(o.istihbaratEleman) +
          "</td><td>" + ekran + "</td><td>" + sonIs +
          "</td><td>" + fmt(o.guc) + "</td><td style='color:#c5a059'>" + fmt(o.puan) +
          "</td><td>" + durum + '</td><td><button type="button" data-id="' + o.id +
          '" class="detay-btn admin-btn admin-btn-altin" style="min-height:36px;padding:6px 12px">Detay</button></td></tr>'
        );
      })
      .join("");
    tb.querySelectorAll(".detay-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        oyuncuDetayYukle(parseInt(btn.getAttribute("data-id"), 10));
      });
    });
  }

  function oyuncuAra() {
    var q = document.getElementById("oyuncuAra").value.trim();
    var tb = document.getElementById("oyuncuTablo");
    if (tb) tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:#6b7280;padding:16px">Yükleniyor…</td></tr>';
    api("/api/admin/oyuncular?q=" + encodeURIComponent(q)).then(function (res) {
      if (!res.ok) {
        toast(res.data.error || "Arama hatası", true);
        return;
      }
      oyuncuTabloCiz(res.data.liste || []);
      document.getElementById("oyuncuDetay").classList.add("hidden");
    });
  }

  function oyuncuDetayYukle(id) {
    seciliOyuncuId = id;
    var el = document.getElementById("oyuncuDetay");
    if (!el) return;
    el.classList.remove("hidden");
    el.innerHTML = "<p style='color:#9ca3af;padding:12px'>Detay yükleniyor…</p>";
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    api("/api/admin/oyuncular/" + id).then(function (res) {
      if (!res.ok) {
        toast(res.data.error || "Detay yüklenemedi", true);
        el.innerHTML = "<p style='color:#f87171;padding:12px'>" + esc(res.data.error || "Detay yüklenemedi") + "</p>";
        return;
      }
      var o = res.data.oyuncu;
      if (!o) {
        el.innerHTML = "<p style='color:#f87171;padding:12px'>Oyuncu verisi alınamadı.</p>";
        return;
      }
      var fp = (res.data.fingerprints || [])
        .map(function (f) {
          return "<li style='font-size:12px;color:#9ca3af'>" + esc(f.visitorId || "—") + " | " + esc(f.ip) + "</li>";
        })
        .join("");
      var aktiviteSatir = o.aktifEkranLabel
        ? "<p style='color:#93c5fd;font-size:13px;margin:0 0 8px'><b>Şu an:</b> " + esc(o.aktifEkranLabel) +
          (o.sonAksiyonLabel ? " · <b>Son işlem:</b> " + esc(o.sonAksiyonLabel) : "") +
          (o.sonAksiyonDetay ? " — " + esc(o.sonAksiyonDetay) : "") +
          (o.sonAksiyonAt ? " <span style='color:#6b7280'>(" + esc(o.sonAksiyonAt) + ")</span>" : "") +
          "</p>"
        : "";
      var log = (res.data.aktiviteLog || [])
        .map(function (a) {
          return "<li style='font-size:12px;color:#9ca3af;margin-bottom:4px'>" +
            "<span style='color:#6b7280'>" + esc(a.at) + "</span> · " +
            esc(a.ekranLabel || "—") + " · <b style='color:#d1d5db'>" + esc(a.aksiyonLabel || "—") + "</b>" +
            (a.detay ? " — " + esc(a.detay) : "") + "</li>";
        })
        .join("");
      var gy = res.data.guvenliYer || o.guvenliYer || {};
      var gySeviye = gy.baseSeviye || o.guvenliYerSeviye || 1;
      var gyAd = gy.ad || o.guvenliYerAd || "";
      var gyGuc = gy.gucBonus != null ? gy.gucBonus : "";
      var istEleman = res.data.istihbaratEleman != null ? res.data.istihbaratEleman : (o.istihbaratEleman || 0);
      var istGuc = istEleman * 100;
      var mekanlar = res.data.mekanlar || [];
      var mekanSatirlari = mekanlar
        .map(function (m) {
          return (
            "<tr><td style='font-size:12px;color:#9ca3af'>" + esc(m.sektorLabel) +
            "</td><td>" + esc(m.ad) +
            '</td><td><input type="number" min="0" class="admin-input mekan-adet-input" style="width:88px;padding:6px 8px" ' +
            'data-sektor="' + esc(m.sektor) + '" data-mekan="' + esc(m.mekanKey) + '" value="' + (m.adet || 0) + '"></td></tr>'
          );
        })
        .join("");
      el.innerHTML =
        "<h3 style='margin:0 0 4px;color:#fff'>" + esc(o.reisAdi) + "</h3>" +
        "<p style='color:#6b7280;margin:0 0 12px'>@" + esc(o.username) + " · ID " + o.id + "</p>" +
        aktiviteSatir +
        "<div class='aksiyon-satir'>" +
        btn("Banla", "ban", "admin-btn-kirmizi") +
        btn("Banı Kaldır", "unban", "admin-btn-gri") +
        btn("Oturumu Kes", "kick", "admin-btn-gri") +
        btn("Mesajları Sil", "purge-msg", "admin-btn-gri") +
        "</div>" +
        "<div class='detay-grid'>" +
        info("Kasa", fmt(o.kasa)) + info("Güç", fmt(o.guc)) + info("Saygınlık", fmt(o.puan)) +
        info("İcraat", fmt(o.icraat)) + info("SMS Hakkı", fmt(o.smsHakki)) +
        info("Mekan Toplam", fmt(o.mekanToplam)) +
        info("Güvenli Yer", "Seviye " + fmt(gySeviye) + (gyAd ? " — " + esc(gyAd) : "") + (gyGuc !== "" ? " (+" + fmt(gyGuc) + " güç)" : "")) +
        info("İstihbarat", fmt(istEleman) + " eleman (+" + fmt(istGuc) + " güç)") +
        info("Son IP", o.sonIp || "—") +
        "</div>" +
        "<form id='statForm' class='detay-grid' style='grid-template-columns:repeat(5,1fr)'>" +
        inputStat("kasa", o.kasa, "Kasa") + inputStat("guc", o.guc, "Güç") + inputStat("puan", o.puan, "Saygınlık") +
        inputStat("icraat", o.icraat, "İcraat") + inputStat("sms_hakki", o.smsHakki, "SMS") +
        "<button type='submit' class='admin-btn admin-btn-altin' style='grid-column:1/-1'>İstatistik Kaydet</button></form>" +
        "<p class='baslik-altin'>Güvenli Yer</p>" +
        "<div style='display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px'>" +
        "<div><label style='display:block;font-size:11px;color:#9ca3af;margin-bottom:4px'>Seviye (1-15)</label>" +
        '<input id="gySeviyeInput" type="number" min="1" max="15" class="admin-input" style="width:88px;padding:6px 8px" value="' + gySeviye + '"></div>' +
        "<div style='font-size:12px;color:#9ca3af;padding-bottom:8px'>" + esc(gyAd || "") +
        (gyGuc !== "" ? " · +" + fmt(gyGuc) + " güç bonusu" : "") + "</div>" +
        "<button type='button' id='gyKaydetBtn' class='admin-btn admin-btn-altin' style='min-height:38px'>Güvenli Yer Kaydet</button></div>" +
        "<p class='baslik-altin'>İstihbarat</p>" +
        "<div style='display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px'>" +
        "<div><label style='display:block;font-size:11px;color:#9ca3af;margin-bottom:4px'>Eleman sayısı</label>" +
        '<input id="istElemanInput" type="number" min="0" class="admin-input" style="width:120px;padding:6px 8px" value="' + istEleman + '"></div>' +
        "<div style='font-size:12px;color:#9ca3af;padding-bottom:8px'>+" + fmt(istGuc) + " güç bonusu (100/eleman)</div>" +
        "<button type='button' id='istKaydetBtn' class='admin-btn admin-btn-altin' style='min-height:38px'>İstihbarat Kaydet</button></div>" +
        "<p class='baslik-altin'>Mekan adetleri</p>" +
        "<div class='admin-tablo-wrap' style='max-height:320px;overflow:auto;margin-bottom:10px'>" +
        "<table class='admin-tablo'><thead><tr><th>Sektör</th><th>Mekan</th><th>Adet</th></tr></thead>" +
        "<tbody>" + (mekanSatirlari || "<tr><td colspan='3' style='color:#6b7280'>Mekan yok</td></tr>") + "</tbody></table></div>" +
        "<button type='button' id='mekanKaydetBtn' class='admin-btn admin-btn-altin' style='margin-bottom:16px'>Mekan Adetlerini Kaydet</button>" +
        "<p class='baslik-altin'>Son aktiviteler</p><ul style='max-height:200px;overflow-y:auto;padding-left:18px'>" +
        (log || "<li style='color:#6b7280'>Henüz kayıt yok</li>") + "</ul>" +
        "<p class='baslik-altin'>Parmak izi</p><ul>" + (fp || "<li style='color:#6b7280'>Yok</li>") + "</ul>";

      el.querySelectorAll("[data-action]").forEach(function (b) {
        b.addEventListener("click", function () {
          oyuncuAksiyon(b.getAttribute("data-action"));
        });
      });
      var form = document.getElementById("statForm");
      if (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var body = {};
          ["kasa", "guc", "puan", "icraat", "sms_hakki"].forEach(function (k) {
            var inp = form.querySelector('[name="' + k + '"]');
            if (inp && inp.value !== "") body[k] = inp.value;
          });
          api("/api/admin/oyuncular/" + id + "/stats", { method: "PATCH", body: body }).then(function (r) {
            toast(r.data.mesaj || r.data.error || "Tamam", !r.ok);
            if (r.ok) oyuncuDetayYukle(id);
          });
        });
      }
      var mekanBtn = document.getElementById("mekanKaydetBtn");
      if (mekanBtn) {
        mekanBtn.addEventListener("click", function () {
          var items = [];
          el.querySelectorAll(".mekan-adet-input").forEach(function (inp) {
            items.push({
              sektor: inp.getAttribute("data-sektor"),
              mekanKey: inp.getAttribute("data-mekan"),
              adet: inp.value,
            });
          });
          api("/api/admin/oyuncular/" + id + "/mekanlar", { method: "PATCH", body: { mekanlar: items } }).then(function (r) {
            toast(r.data.mesaj || r.data.error || "Tamam", !r.ok);
            if (r.ok) {
              oyuncuDetayYukle(id);
              oyuncuAra();
            }
          });
        });
      }
      var gyBtn = document.getElementById("gyKaydetBtn");
      if (gyBtn) {
        gyBtn.addEventListener("click", function () {
          var inp = document.getElementById("gySeviyeInput");
          var sev = inp ? inp.value : gySeviye;
          api("/api/admin/oyuncular/" + id + "/guvenli-yer", { method: "PATCH", body: { baseSeviye: sev } }).then(function (r) {
            toast(r.data.mesaj || r.data.error || "Tamam", !r.ok);
            if (r.ok) {
              oyuncuDetayYukle(id);
              oyuncuAra();
            }
          });
        });
      }
      var istBtn = document.getElementById("istKaydetBtn");
      if (istBtn) {
        istBtn.addEventListener("click", function () {
          var inp = document.getElementById("istElemanInput");
          var adet = inp ? inp.value : istEleman;
          api("/api/admin/oyuncular/" + id + "/istihbarat", { method: "PATCH", body: { elemanSayisi: adet } }).then(function (r) {
            toast(r.data.mesaj || r.data.error || "Tamam", !r.ok);
            if (r.ok) {
              oyuncuDetayYukle(id);
              oyuncuAra();
            }
          });
        });
      }
    }).catch(function () {
      if (el) el.innerHTML = "<p style='color:#f87171;padding:12px'>Detay isteği başarısız.</p>";
    });
  }

  function btn(label, action, cls) {
    return '<button type="button" data-action="' + action + '" class="admin-btn ' + cls + '">' + esc(label) + "</button>";
  }

  function info(l, v) {
    return '<div class="detay-item"><span>' + esc(l) + "</span>" + esc(v) + "</div>";
  }

  function inputStat(name, val, label) {
    var baslik = label
      ? '<label style="display:block;font-size:11px;color:#9ca3af;margin-bottom:4px">' + esc(label) + "</label>"
      : "";
    return '<div>' + baslik + '<input name="' + name + '" type="number" min="0" class="admin-input" value="' + val + '"></div>';
  }

  function oyuncuAksiyon(action) {
    if (!seciliOyuncuId) return;
    var url = "/api/admin/oyuncular/" + seciliOyuncuId;
    if (action === "ban") {
      var reason = prompt("Ban sebebi (opsiyonel):") || "";
      api(url + "/ban", { method: "POST", body: { reason: reason } }).then(done);
    } else if (action === "unban") api(url + "/unban", { method: "POST" }).then(done);
    else if (action === "kick") api(url + "/kick", { method: "POST" }).then(done);
    else if (action === "purge-msg") {
      if (!confirm("Bu oyuncunun tüm mesajları silinsin mi?")) return;
      api(url + "/mesaj-temizle", { method: "POST" }).then(done);
    }
    function done(r) {
      toast(r.data.mesaj || r.data.error || "İşlem tamam", !r.ok);
      if (r.ok) {
        oyuncuDetayYukle(seciliOyuncuId);
        oyuncuAra();
      }
    }
  }

  function yukleMulti() {
    api("/api/admin/multi-hesap").then(function (res) {
      if (!res.ok) return;
      document.getElementById("multiVisitor").innerHTML = clusterHtml(res.data.byVisitor);
      document.getElementById("multiIp").innerHTML = clusterHtml(res.data.byIp);
      document.getElementById("multiBlocks").innerHTML = (res.data.linkedPairs || [])
        .map(function (b) {
          return '<div class="kart"><b style="color:#fca5a5">' + esc(b.oyuncu || "—") + "</b> · " + esc(b.at) +
            '<p style="font-size:12px;color:#6b7280;margin:8px 0 0">' + esc(b.detail) + "</p></div>";
        })
        .join("") || "<p style='color:#6b7280'>Kayıt yok.</p>";
    });
  }

  function clusterHtml(list) {
    if (!list || !list.length) return "<p style='color:#6b7280'>Şüpheli küme yok.</p>";
    return list
      .map(function (c) {
        return '<div class="kart sari"><b style="color:#fcd34d">' + esc(c.hesap_sayisi) + " hesap</b> · " +
          esc(c.anahtar) + '<p style="margin:8px 0 0">' + esc(c.isimler) + '</p><p style="font-size:12px;color:#6b7280">ID: ' +
          esc(c.user_ids) + "</p></div>";
      })
      .join("");
  }

  function msgTab(sec) {
    aktifMsgTab = sec;
    document.querySelectorAll(".msg-tab").forEach(function (b) {
      var on = b.getAttribute("data-msg") === sec;
      b.className = "msg-tab admin-btn " + (on ? "admin-btn-kirmizi" : "admin-btn-gri");
    });
    document.getElementById("mesajAra").classList.toggle("hidden", sec !== "kutu");
    yukleMesajlar();
  }

  function yukleMesajlar() {
    var q = document.getElementById("mesajAra").value.trim();
    var url = aktifMsgTab === "kutu"
      ? "/api/admin/mesajlar/kutu?q=" + encodeURIComponent(q)
      : aktifMsgTab === "sohbet" ? "/api/admin/mesajlar/sohbet" : "/api/admin/mesajlar/grup";
    api(url).then(function (res) {
      if (!res.ok) return;
      var liste = res.data.liste || [];
      var el = document.getElementById("mesajListe");
      if (!liste.length) {
        el.innerHTML = "<p style='color:#6b7280'>Mesaj yok.</p>";
        return;
      }
      el.innerHTML = liste.map(function (m) {
        var baslik = aktifMsgTab === "kutu"
          ? esc(m.gonderen) + " → " + esc(m.alici)
          : aktifMsgTab === "sohbet" ? esc(m.reisAdi) : esc(m.grupAdi) + " · " + esc(m.reisAdi);
        var delUrl = "/api/admin/mesajlar/" + aktifMsgTab + "/" + m.id;
        var metin = aktifMsgTab === "kutu" ? m.icerik : (m.mesaj || m.icerik);
        return '<div class="kart"><div style="display:flex;justify-content:space-between;gap:8px">' +
          '<div><p style="color:#c5a059;margin:0 0 6px">' + baslik + '</p><p style="margin:0">' + esc(metin) +
          '</p><p style="font-size:11px;color:#6b7280;margin-top:6px">' + esc(m.at) + "</p></div>" +
          '<button type="button" data-del="' + delUrl + '" class="admin-btn admin-btn-gri" style="min-height:36px;align-self:flex-start">Sil</button></div></div>';
      }).join("");
      el.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("Mesaj silinsin mi?")) return;
          api(b.getAttribute("data-del"), { method: "DELETE" }).then(function (r) {
            toast(r.data.mesaj || r.data.error || "Silindi", !r.ok);
            if (r.ok) yukleMesajlar();
          });
        });
      });
    });
  }

  function yukleAktivite() {
    var tb = document.getElementById("aktiviteTablo");
    if (!tb) return;
    api("/api/admin/aktivite").then(function (res) {
      if (!res.ok) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f87171;padding:16px">' +
          esc(res.data.error || "Yüklenemedi") + "</td></tr>";
        return;
      }
      var liste = res.data.liste || [];
      if (!liste.length) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:16px">Şu an aktif oyuncu yok.</td></tr>';
        return;
      }
      tb.innerHTML = liste.map(function (a) {
        var dot = a.online
          ? '<span style="color:#4ade80;font-size:16px" title="Çevrimiçi">●</span>'
          : '<span style="color:#6b7280;font-size:16px" title="Uzakta">○</span>';
        return "<tr><td>" + dot + "</td><td><b>" + esc(a.reisAdi) + "</b><br><span style='font-size:11px;color:#6b7280'>@" +
          esc(a.username) + "</span></td><td style='color:#93c5fd;font-size:12px'>" + esc(a.aktifEkranLabel || "—") +
          "</td><td style='font-size:12px'>" + esc(a.sonAksiyonLabel || "—") +
          "</td><td style='font-size:12px;color:#9ca3af;max-width:200px;word-break:break-word'>" + esc(a.sonAksiyonDetay || "—") +
          "</td><td style='font-size:11px;color:#6b7280;white-space:nowrap'>" + esc(a.sonAksiyonAt || a.lastSeen) +
          '</td><td><button type="button" data-id="' + a.id +
          '" class="aktivite-detay-btn admin-btn admin-btn-altin" style="min-height:32px;padding:4px 10px;font-size:12px">Detay</button></td></tr>';
      }).join("");
      tb.querySelectorAll(".aktivite-detay-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktifNav("oyuncular");
          oyuncuDetayYukle(parseInt(btn.getAttribute("data-id"), 10));
        });
      });
    });
  }

  function aktivitePollBaslat() {
    if (aktivitePollTimer) clearInterval(aktivitePollTimer);
    aktivitePollTimer = setInterval(function () {
      var panel = document.getElementById("tab-aktivite");
      if (panel && !panel.classList.contains("hidden")) yukleAktivite();
    }, 15000);
  }

  function yukleGuvenlik() {
    api("/api/admin/guvenlik").then(function (res) {
      if (!res.ok) return;
      document.getElementById("guvenlikListe").innerHTML = (res.data.liste || []).map(function (e) {
        return '<div class="kart"><code style="color:#fcd34d;font-size:12px">' + esc(e.type) + "</code> · " +
          esc(e.reisAdi || "—") + '<span style="float:right;font-size:11px;color:#6b7280">' + esc(e.at) +
          '</span><p style="font-size:12px;color:#9ca3af;margin:8px 0 0;word-break:break-all">' + esc(e.detail) + "</p></div>";
      }).join("") || "<p style='color:#6b7280'>Kayıt yok.</p>";
    });
  }

  function mafyaTabloCiz(liste) {
    var tb = document.getElementById("mafyaTablo");
    if (!tb) return;
    if (!liste.length) {
      tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:16px">Grup yok.</td></tr>';
      return;
    }
    tb.innerHTML = liste.map(function (g) {
      return "<tr><td>" + g.id + "</td><td><b>" + esc(g.isim) + "</b><br><span style='font-size:11px;color:#6b7280'>" +
        esc(g.aciklama || "") + "</span></td><td>" + esc(g.liderReis) + "<br><span style='font-size:11px;color:#6b7280'>@" +
        esc(g.liderUsername) + "</span></td><td>" + fmt(g.uyeSayisi) + "</td><td>Sev. " + fmt(g.evSeviye) +
        "</td><td>" + fmt(g.bekleyenBasvuru) + "</td><td>" + (g.aktifSavas ? '<span style="color:#f87171">' + fmt(g.aktifSavas) + "</span>" : "0") +
        '</td><td><button type="button" data-id="' + g.id +
        '" class="mafya-detay-btn admin-btn admin-btn-altin" style="min-height:36px;padding:6px 12px">Detay</button></td></tr>';
    }).join("");
    tb.querySelectorAll(".mafya-detay-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mafyaDetayYukle(parseInt(btn.getAttribute("data-id"), 10));
      });
    });
  }

  function mafyaAra() {
    var q = document.getElementById("mafyaAra").value.trim();
    var tb = document.getElementById("mafyaTablo");
    if (tb) tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:16px">Yükleniyor…</td></tr>';
    api("/api/admin/mafya-gruplari?q=" + encodeURIComponent(q)).then(function (res) {
      if (!res.ok) {
        toast(res.data.error || "Mafya listesi yüklenemedi", true);
        return;
      }
      mafyaTabloCiz(res.data.liste || []);
      document.getElementById("mafyaDetay").classList.add("hidden");
    });
  }

  function mafyaDetayYukle(id) {
    var el = document.getElementById("mafyaDetay");
    if (!el) return;
    el.classList.remove("hidden");
    el.innerHTML = "<p style='color:#9ca3af;padding:12px'>Grup detayı yükleniyor…</p>";
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    api("/api/admin/mafya-gruplari/" + id).then(function (res) {
      if (!res.ok) {
        el.innerHTML = "<p style='color:#f87171;padding:12px'>" + esc(res.data.error || "Detay yüklenemedi") + "</p>";
        return;
      }
      var g = res.data.grup || {};
      var ev = res.data.evi || {};
      var uyeler = (res.data.uyeler || []).map(function (u) {
        return "<tr><td><b>" + esc(u.reisAdi) + "</b><br><span style='font-size:11px;color:#6b7280'>@" + esc(u.username) +
          "</span></td><td>" + esc(u.rutbe) + "</td><td>" + fmt(u.puan) + "</td><td>" + fmt(u.guc) +
          "</td><td>" + fmt(u.istihbaratEleman) + "</td><td style='font-size:11px;color:#6b7280'>" + esc(u.lastSeen) +
          '</td><td><button type="button" data-uid="' + u.userId +
          '" class="mafya-uye-detay admin-btn admin-btn-gri" style="min-height:30px;padding:4px 8px;font-size:11px">Oyuncu</button></td></tr>';
      }).join("");
      var basv = (res.data.basvurular || []).map(function (b) {
        return "<li style='font-size:12px;color:#9ca3af'>" + esc(b.reisAdi) + " (@" + esc(b.username) + ")</li>";
      }).join("");
      var savas = (res.data.savaslar || []).map(function (s) {
        return "<li style='font-size:12px;color:#9ca3af;margin-bottom:4px'>" + esc(s.baslangic) + " · " +
          esc(s.saldiranIsim) + " → " + esc(s.hedefIsim) + " · <b style='color:#d1d5db'>" + esc(s.durum) + "</b>" +
          (s.kazananGrupId ? " · Kazanan ID " + s.kazananGrupId : "") + "</li>";
      }).join("");
      el.innerHTML =
        "<h3 style='margin:0 0 4px;color:#fff'>" + esc(g.isim) + "</h3>" +
        "<p style='color:#6b7280;margin:0 0 12px'>ID " + g.id + " · Lider: " + esc(g.liderReis) + " (@" + esc(g.liderUsername) + ")</p>" +
        "<p style='color:#9ca3af;font-size:13px;margin:0 0 12px'>" + esc(g.aciklama || "—") + "</p>" +
        "<div class='detay-grid'>" +
        info("Üye", fmt((res.data.uyeler || []).length)) +
        info("Ev Seviyesi", fmt(ev.seviye || 1)) +
        info("Ev Birikimi", fmt(ev.birikmisPara || 0) + " TL") +
        info("Kuruluş", g.createdAt || "—") +
        "</div>" +
        "<p class='baslik-altin'>Üyeler</p>" +
        "<div class='admin-tablo-wrap' style='max-height:280px;overflow:auto;margin-bottom:12px'>" +
        "<table class='admin-tablo'><thead><tr><th>Reis</th><th>Rütbe</th><th>Saygınlık</th><th>Güç</th><th>İstihbarat</th><th>Son Görülme</th><th></th></tr></thead>" +
        "<tbody>" + (uyeler || "<tr><td colspan='7' style='color:#6b7280'>Üye yok</td></tr>") + "</tbody></table></div>" +
        "<p class='baslik-altin'>Bekleyen başvurular</p><ul style='padding-left:18px;margin:0 0 12px'>" +
        (basv || "<li style='color:#6b7280'>Yok</li>") + "</ul>" +
        "<p class='baslik-altin'>Son savaşlar</p><ul style='padding-left:18px;margin:0'>" +
        (savas || "<li style='color:#6b7280'>Kayıt yok</li>") + "</ul>";
      el.querySelectorAll(".mafya-uye-detay").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktifNav("oyuncular");
          oyuncuDetayYukle(parseInt(btn.getAttribute("data-uid"), 10));
        });
      });
    });
  }

  function bagla() {
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tab");
        aktifNav(tab);
        if (tab === "dashboard") yukleDashboard();
        if (tab === "oyuncular") oyuncuAra();
        if (tab === "mafya") mafyaAra();
        if (tab === "aktivite") yukleAktivite();
        if (tab === "multi") yukleMulti();
        if (tab === "mesajlar") msgTab("kutu");
        if (tab === "guvenlik") yukleGuvenlik();
      });
    });
    document.getElementById("oyuncuAraBtn").addEventListener("click", oyuncuAra);
    document.getElementById("oyuncuAra").addEventListener("keydown", function (e) {
      if (e.key === "Enter") oyuncuAra();
    });
    document.getElementById("mafyaAraBtn").addEventListener("click", mafyaAra);
    document.getElementById("mafyaAra").addEventListener("keydown", function (e) {
      if (e.key === "Enter") mafyaAra();
    });
    document.querySelectorAll(".msg-tab").forEach(function (b) {
      b.addEventListener("click", function () { msgTab(b.getAttribute("data-msg")); });
    });
    document.getElementById("mesajAra").addEventListener("input", function () {
      if (aktifMsgTab === "kutu") yukleMesajlar();
    });
  }

  api("/api/admin/me").then(function (res) {
    if (!res.ok) {
      if (res.status === 401) {
        yetkisizGoster("Önce oyuna giriş yapmalısın. Giriş yaptıktan sonra /admin adresine tekrar gel.");
        return;
      }
      if (res.status === 403) {
        yetkisizGoster("Bu hesabın yönetici yetkisi yok. Yönetici hesabıyla giriş yapmalısın.");
        return;
      }
      yetkisizGoster(res.data.error || "Panele erişilemedi.");
      return;
    }
    panelAc();
    document.getElementById("adminEtiket").textContent =
      (res.data.admin && res.data.admin.reisAdi) || res.data.admin.username || "";
    bagla();
    aktivitePollBaslat();
    aktifNav("dashboard");
    yukleDashboard();
  }).catch(function () {
    yetkisizGoster("Panel başlatılamadı. Sayfayı Ctrl+F5 ile yenileyin.");
  });
})();
