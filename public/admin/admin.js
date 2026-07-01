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

  function indirDosya(url, filename) {
    fetch(url, { credentials: "include" })
      .then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () {
            return { error: "HTTP " + r.status };
          }).then(function (j) {
            throw new Error((j && j.error) || "İndirme başarısız");
          });
        }
        return r.blob();
      })
      .then(function (blob) {
        var a = document.createElement("a");
        var href = URL.createObjectURL(blob);
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(href);
        }, 500);
        toast("Dosya indirildi.");
      })
      .catch(function (e) {
        toast(e.message || "İndirme başarısız", true);
      });
  }

  function listeHtml(items, formatter, bosMetin) {
    if (!items || !items.length) {
      return "<p style='color:#6b7280;font-size:12px;margin:0'>" + esc(bosMetin || "—") + "</p>";
    }
    return (
      "<ul style='font-size:12px;color:#9ca3af;padding-left:18px;margin:0;max-height:180px;overflow-y:auto'>" +
      items.map(formatter).join("") +
      "</ul>"
    );
  }

  function oyuncuDetayEkstraHtml(res) {
    var o = res.data.oyuncu || {};
    var profil = res.data.profil || {};
    var ekonomi = res.data.ekonomi || {};
    var sehirMeta = res.data.sehirMeta || {};
    var mafya = res.data.mafya;
    var sef = res.data.sefirlikOzet || {};
    var ms = res.data.mesajSayilari || {};
    var gyFull = res.data.guvenliYerFull || {};
    var sirketPanel = res.data.sirketPanel;
    var yonetim = sirketPanel && sirketPanel.yonetim ? sirketPanel.yonetim : null;

    var mafyaMetin = mafya
      ? esc(mafya.isim) + " · " + esc(mafya.rutbe || "üye")
      : "—";
    var sefMetin = sef.ozet
      ? fmt(sef.ozet.toplamKontrol || 0) + " toplam kontrol · " + fmt(sef.ozet.sahipSayisi || 0) + " şehir sahibi"
      : "—";

    var events = (res.data.events || [])
      .map(function (e) {
        return "<li style='margin-bottom:4px'><span style='color:#6b7280'>" + esc(e.at) + "</span> · " +
          esc(e.type) + (e.detail ? " — " + esc(e.detail) : "") + "</li>";
      })
      .join("");

    return (
      "<p class='baslik-altin'>Ek Bilgiler</p>" +
      "<div class='detay-grid'>" +
      info("Lakap", o.lakap || "—") +
      info("Grup", o.grup || "—") +
      info("Kayıt", o.createdAt || "—") +
      info("Bonus Güç", fmt(ekonomi.bonusGuc || o.bonusGuc || 0)) +
      info("Devlet İlişkisi", fmt(o.devletIliskisi != null ? o.devletIliskisi : ekonomi.devletIliskisi || 0)) +
      info("Kara Liste", o.karaListede ? "Evet" : "Hayır") +
      info("Şehir Efsanesi", o.sehirEfsane ? "Evet" : "Hayır") +
      info("Şehre Hükmet", fmt(sehirMeta.sehreHukmetSayisi || o.sehreHukmetSayisi || 0)) +
      info("Liman İstanbul", fmt(ekonomi.limanIstanbul || o.limanIstanbul || 0)) +
      info("Profil Ziyaret", fmt(res.data.profilZiyaretSayisi || 0)) +
      "</div>" +
      "<p class='baslik-altin'>Profil & Sosyal</p>" +
      "<div class='detay-grid'>" +
      info("Açıklama", profil.aciklama || "—") +
      info("Dostlar", profil.dostlar || "—") +
      info("Düşmanlar", profil.dusmanlar || "—") +
      info("Profil Resmi", profil.resim || "—") +
      "</div>" +
      "<p class='baslik-altin'>Mafya & Dünya</p>" +
      "<div class='detay-grid'>" +
      info("Mafya Üyeliği", mafyaMetin) +
      info("Sefirlik Özeti", sefMetin) +
      info("Mesaj (Alınan)", fmt(ms.alinan || 0)) +
      info("Mesaj (Gönderilen)", fmt(ms.gonderilen || 0)) +
      info("Mafya Sohbet", fmt(ms.sohbet || 0)) +
      info("Grup Mesajı", fmt(ms.grup_mesaj || 0)) +
      "</div>" +
      listeHtml(res.data.mafyaBasvurulari, function (b) {
        return "<li>" + esc(b.grupAdi) + " · " + esc(b.durum) + "</li>";
      }, "Mafya başvurusu yok") +
      listeHtml(res.data.mafyaIsleri, function (i) {
        return "<li>" + esc(i.grupAdi) + " · " + esc(i.isTuru) + " · " + esc(i.durum) + " · " + esc(i.baslangic) + "</li>";
      }, "Mafya işi yok") +
      listeHtml(res.data.mafyaSavaslari, function (s) {
        return "<li>" + esc(s.saldiran) + " vs " + esc(s.hedef) + " · " + esc(s.durum) + " · " + esc(s.savasZamani) + "</li>";
      }, "Mafya savaşı yok") +
      "<p class='baslik-altin'>Envanter & Liman</p>" +
      listeHtml(res.data.envanter, function (e) {
        return "<li>" + esc(e.item_key) + " × " + fmt(e.adet) + "</li>";
      }, "Envanter boş") +
      listeHtml(res.data.limanlar, function (l) {
        return "<li>" + esc(l.liman_id) + "</li>";
      }, "Liman sahipliği yok") +
      listeHtml(res.data.babaMakamlari, function (b) {
        return "<li>" + esc(b.makam) + (b.baba_derki ? " — " + esc(b.baba_derki) : "") + "</li>";
      }, "Baba makamı yok") +
      borsaDetayHtml(res.data.borsa) +
      "<p class='baslik-altin'>Sefirlik & Şehir</p>" +
      listeHtml(res.data.sehirKontroller, function (s) {
        return "<li>" + esc(s.sehirId) + " · %" + fmt(s.kontrol) + "</li>";
      }, "Şehir kontrolü yok") +
      listeHtml(res.data.sehirHukimiyetSahip, function (sid) {
        return "<li>Sahip: " + esc(sid) + "</li>";
      }, "Şehir sahipliği yok") +
      listeHtml(res.data.sehirHukumranliklar, function (h) {
        return "<li>#" + h.id + " · " + esc(h.baslangic) + (h.bitis ? " → " + esc(h.bitis) : " (aktif)") + "</li>";
      }, "Hükümet kaydı yok") +
      "<p class='baslik-altin'>Günlük Görevler</p>" +
      listeHtml(res.data.gunlukGorevler, function (g) {
        return "<li>" + esc(g.gunKey) + " S" + g.slot + " · " + esc(g.gorevId) + " · " + esc(g.durum) +
          " · %" + fmt(g.ilerleme) + "</li>";
      }, "Günlük görev yok") +
      "<p class='baslik-altin'>Medya & Stat</p>" +
      listeHtml(res.data.medyaHaberleri, function (h) {
        return "<li>" + esc(h.at) + " · " + esc(h.haber) + (h.aktif ? "" : " (pasif)") + "</li>";
      }, "Medya haberi yok") +
      listeHtml(res.data.statHareketleri, function (s) {
        return "<li>" + esc(s.at) + " · " + esc(s.tip) + " " + (s.delta >= 0 ? "+" : "") + fmt(s.delta) + "</li>";
      }, "Stat hareketi yok") +
      (yonetim
        ? "<p class='baslik-altin'>Şirket Yönetimi</p><div class='detay-grid'>" +
          info("Şirket", yonetim.isim || "—") +
          info("Tür", yonetim.turAd || "—") +
          info("Kasa", fmt(yonetim.kasa || 0) + " TL") +
          info("Çalışan", fmt((yonetim.calisanlar || []).length) + "/" + fmt(yonetim.maxCalisan || 0)) +
          info("Stok Dolu", fmt(yonetim.stokDolu || 0) + "/" + fmt(yonetim.depoKapasite || 0)) +
          "</div>"
        : "") +
      "<p class='baslik-altin'>Güvenli Yer Modülleri</p>" +
      "<div class='detay-grid'>" +
      info("Bina", fmt(gyFull.buildingLvl || 0)) +
      info("Duvar", fmt(gyFull.wallLvl || 0)) +
      info("Bahçe", fmt(gyFull.gardenLvl || 0)) +
      info("Yeraltı", fmt(gyFull.undergroundLvl || 0)) +
      info("Bunker", fmt(gyFull.bunkerLvl || 0)) +
      info("Gümüş Kasa", gyFull.kasaGumus ? "Var" : "Yok") +
      info("Altın Kasa", gyFull.kasaAltin ? "Var" : "Yok") +
      "</div>" +
      "<p class='baslik-altin'>Güvenlik Olayları</p><ul style='max-height:160px;overflow-y:auto;padding-left:18px;font-size:12px;color:#9ca3af'>" +
      (events || "<li style='color:#6b7280'>Kayıt yok</li>") + "</ul>"
    );
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
      raporlar: "İçerik Raporları",
      gorusOneriler: "Görüş ve Öneriler",
      borsa: "Borsa",
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
        statKart("Rapor (24s)", s.rapor_24s, "🚩") +
        statKart("Görüş (24s)", s.gorus_24s, "💡") +
        statKart("Yönetici", s.admin_sayisi, "👑") +
        statKart("Borsa Yatırımcı", s.borsa_yatirimci, "📈") +
        statKart("Bekleyen Emir", s.borsa_bekleyen_emir, "⏳") +
        statKart("Portföy Değeri", fmt(s.borsa_portfoy_deger), "💹") +
        statKart("Borsa İşlem (24s)", s.borsa_islem_24s, "🔄");
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
      tb.innerHTML = '<tr><td colspan="15" style="text-align:center;color:#6b7280;padding:16px">Sonuç yok.</td></tr>';
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
          "</td><td style='color:#c5a059'>" + fmt(o.kasa) +
          "</td><td style='color:#93c5fd'>" + fmt(o.bankaBakiye) +
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

  function oyuncuAra(sessiz) {
    var q = document.getElementById("oyuncuAra").value.trim();
    var tb = document.getElementById("oyuncuTablo");
    if (tb && !sessiz) {
      tb.innerHTML = '<tr><td colspan="15" style="text-align:center;color:#6b7280;padding:16px">Yükleniyor…</td></tr>';
    }
    api("/api/admin/oyuncular?q=" + encodeURIComponent(q)).then(function (res) {
      if (!res.ok) {
        if (tb) {
          tb.innerHTML =
            '<tr><td colspan="15" style="text-align:center;color:#f87171;padding:16px">' +
            esc(res.data.error || "Liste yüklenemedi") +
            "</td></tr>";
        }
        if (!sessiz) toast(res.data.error || "Arama hatası", true);
        return;
      }
      oyuncuTabloCiz(res.data.liste || []);
      if (!sessiz) document.getElementById("oyuncuDetay").classList.add("hidden");
    }).catch(function () {
      if (tb) {
        tb.innerHTML =
          '<tr><td colspan="15" style="text-align:center;color:#f87171;padding:16px">Liste isteği başarısız</td></tr>';
      }
    });
  }

  function oyuncuDetayYukle(id, sessiz) {
    seciliOyuncuId = id;
    var el = document.getElementById("oyuncuDetay");
    if (!el) return;
    el.classList.remove("hidden");
    if (!sessiz) {
      el.innerHTML = "<p style='color:#9ca3af;padding:12px'>Detay yükleniyor…</p>";
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    api("/api/admin/oyuncular/" + id).then(function (res) {
      if (!res.ok) {
        if (!sessiz) toast(res.data.error || "Detay yüklenemedi", true);
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
      var yt = res.data.yetenekler || {};
      var yetenekMetin = "Güç " + fmt(yt.guc || 0) + " · Zeka " + fmt(yt.zeka || 0) +
        " · Dayanıklılık " + fmt(yt.dayaniklilik || 0) + " · Beceri " + fmt(yt.beceri || 0);
      var meslek = res.data.aktifMeslek;
      var meslekMetin = meslek
        ? (meslek.isyeriAd || "") + " — " + (meslek.unvan || "") + " (" + fmt(meslek.gunlukGelir) + " TL/gün)"
        : "—";
      var sirketCalisan = res.data.sirketCalisan;
      var sirketCalisanMetin = sirketCalisan
        ? (sirketCalisan.sirket_adi || "") + " · " + fmt(sirketCalisan.gunluk_maas) + " TL/gün"
        : "—";
      var sahipSirket = res.data.sahipSirket;
      var sahipSirketMetin = sahipSirket
        ? (sahipSirket.isim || "") + " · kasa " + fmt(sahipSirket.kasa || 0) + " TL"
        : "—";
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
      var profil = res.data.profil || {};
      var ekonomi = res.data.ekonomi || {};
      var banka = res.data.banka || {};
      var gyFull = res.data.guvenliYerFull || {};
      var hireSablon = res.data.hireSablon || [];
      var bankaYatirilan = banka.yatirilan_miktar != null ? banka.yatirilan_miktar : (o.bankaBakiye || 0);
      var bankaHakkiVal = banka.banka_hakki != null ? banka.banka_hakki : (o.bankaHakki || 20);
      var bankaFaiz = banka.faiz_bekleyen != null ? banka.faiz_bekleyen : (o.faizBekleyen || 0);
      el.innerHTML =
        "<h3 style='margin:0 0 4px;color:#fff'>" + esc(o.reisAdi) + "</h3>" +
        "<p style='color:#6b7280;margin:0 0 12px'>@" + esc(o.username) + " · ID " + o.id + "</p>" +
        aktiviteSatir +
        "<div class='aksiyon-satir'>" +
        btn("Banla", "ban", "admin-btn-kirmizi") +
        btn("Banı Kaldır", "unban", "admin-btn-gri") +
        btn("Oturumu Kes", "kick", "admin-btn-gri") +
        btn("Mesajları Sil", "purge-msg", "admin-btn-gri") +
        '<button type="button" id="oyuncuIndirBtn" class="admin-btn admin-btn-altin">⬇ Veriyi İndir</button>' +
        "</div>" +
        "<div class='detay-grid'>" +
        info("Toplam Varlık", fmt(o.toplamVarlik != null ? o.toplamVarlik : (o.kasa || 0) + (o.bankaBakiye || 0) + (o.borsaPortfoyDeger || 0)) + " TL") +
        info("NPC Meslek", meslekMetin) +
        info("Şirket Çalışanı", sirketCalisanMetin) +
        info("Şirket Sahibi", sahipSirketMetin) +
        info("Son Görülme", o.lastSeen || "—") +
        info("Son IP", o.sonIp || "—") +
        "</div>" +
        oyuncuDetayEkstraHtml(res) +
        '<form id="oyuncuTamForm" class="admin-oyuncu-form">' +
        sectionTitle("Hesap") +
        '<div class="detay-grid">' +
        inputText("reisAdi", o.reisAdi, "Reis adı", { maxlength: 24 }) +
        inputText("lakap", o.lakap || "", "Lakap", { maxlength: 32 }) +
        inputText("grup", o.grup || "", "Grup", { maxlength: 48 }) +
        inputText("kayitUlkesi", o.kayitUlkesi || "", "Kayıt ülkesi", { maxlength: 16 }) +
        inputText("oyunDili", o.oyunDili || "", "Oyun dili", { maxlength: 16 }) +
        "</div>" +
        inputCheck("isAdmin", o.isAdmin, "Yönetici hesabı") +
        sectionTitle("Temel istatistikler") +
        '<div class="detay-grid" style="grid-template-columns:repeat(4,1fr)">' +
        inputStat("kasa", o.kasa, "Kasa") +
        inputStat("guc", o.guc, "Güç") +
        inputStat("puan", o.puan, "Saygınlık") +
        inputStat("icraat", o.icraat, "İcraat") +
        inputStat("sms_hakki", o.smsHakki, "SMS") +
        inputStat("elmas", o.elmas || 0, "Elmas") +
        inputStat("bonusGuc", o.bonusGuc || ekonomi.bonusGuc || 0, "Bonus güç") +
        inputStat("devletIliskisi", o.devletIliskisi != null ? o.devletIliskisi : (ekonomi.devletIliskisi || 0), "Avukat ilişkisi") +
        inputStat("sehreHukmetSayisi", o.sehreHukmetSayisi || 0, "Şehre hükmet") +
        "</div>" +
        '<div style="display:flex;flex-wrap:wrap;gap:12px 18px;margin:8px 0">' +
        inputCheck("karaListede", o.karaListede, "Kara listede") +
        inputCheck("sehirEfsane", o.sehirEfsane, "Şehir efsanesi") +
        inputCheck("limanIstanbul", !!(ekonomi.limanIstanbul || o.limanIstanbul), "İstanbul limanı") +
        "</div>" +
        sectionTitle("Yetenekler") +
        '<div class="detay-grid" style="grid-template-columns:repeat(4,1fr)">' +
        inputStat("yetenek_guc", yt.guc || 0, "Güç") +
        inputStat("yetenek_zeka", yt.zeka || 0, "Zeka") +
        inputStat("yetenek_dayaniklilik", yt.dayaniklilik || 0, "Dayanıklılık") +
        inputStat("yetenek_beceri", yt.beceri || 0, "Beceri") +
        "</div>" +
        sectionTitle("Banka") +
        '<div class="detay-grid" style="grid-template-columns:repeat(3,1fr)">' +
        inputStat("bankaYatirilan", bankaYatirilan, "Yatırılan") +
        inputStat("bankaHakki", bankaHakkiVal, "Banka hakkı") +
        inputStat("bankaFaiz", bankaFaiz, "Faiz bekleyen") +
        "</div>" +
        sectionTitle("Profil") +
        '<div class="detay-grid">' +
        inputText("profilResmi", profil.resim || "", "Profil resmi anahtarı", { placeholder: "erkek-01" }) +
        inputText("dostlar", profil.dostlar || "", "Dostlar") +
        inputText("dusmanlar", profil.dusmanlar || "", "Düşmanlar") +
        "</div>" +
        '<div style="margin-top:8px"><label style="display:block;font-size:11px;color:#9ca3af;margin-bottom:4px">Profil açıklaması</label>' +
        '<textarea name="profilAciklama" class="admin-input" rows="4" style="width:100%;resize:vertical">' +
        esc(profil.aciklama || "") + "</textarea></div>" +
        sectionTitle("Güvenli Yer") +
        '<div class="detay-grid" style="grid-template-columns:repeat(4,1fr)">' +
        inputStat("gyBaseSeviye", gySeviye, "Üs seviyesi") +
        inputStat("gyBuilding", gyFull.buildingLvl || 0, "Bina") +
        inputStat("gyWall", gyFull.wallLvl || 0, "Duvar") +
        inputStat("gyGarden", gyFull.gardenLvl || 0, "Bahçe") +
        inputStat("gyUnderground", gyFull.undergroundLvl || 0, "Yeraltı") +
        inputStat("gyBunker", gyFull.bunkerLvl || 0, "Bunker") +
        "</div>" +
        '<div style="display:flex;flex-wrap:wrap;gap:12px 18px;margin:8px 0">' +
        inputCheck("gyKasaGumus", !!gyFull.kasaGumus, "Gümüş kasa") +
        inputCheck("gyKasaAltin", !!gyFull.kasaAltin, "Altın kasa") +
        "</div>" +
        sectionTitle("İstihbarat") +
        '<div style="max-width:200px">' + inputStat("istEleman", istEleman, "Eleman sayısı") + "</div>" +
        sectionTitle("Mekan adetleri") +
        "<div class='admin-tablo-wrap' style='max-height:280px;overflow:auto;margin-bottom:10px'>" +
        "<table class='admin-tablo'><thead><tr><th>Sektör</th><th>Mekan</th><th>Adet</th></tr></thead>" +
        "<tbody>" + (mekanSatirlari || "<tr><td colspan='3' style='color:#6b7280'>Mekan yok</td></tr>") + "</tbody></table></div>" +
        sectionTitle("Koruma / silah envanteri") +
        "<div class='admin-tablo-wrap' style='max-height:320px;overflow:auto;margin-bottom:10px'>" +
        "<table class='admin-tablo'><thead><tr><th>Anahtar</th><th>Ünvan</th><th>Adet</th></tr></thead>" +
        "<tbody>" + (oyuncuEnvanterSatirlari(hireSablon, res.data.envanter) || "<tr><td colspan='3' style='color:#6b7280'>—</td></tr>") +
        "</tbody></table></div>" +
        '<button type="submit" class="admin-btn admin-btn-altin" style="width:100%;min-height:44px;margin-top:8px">Tüm Değişiklikleri Kaydet</button>' +
        "</form>" +
        "<p class='baslik-altin'>Son aktiviteler</p><ul style='max-height:200px;overflow-y:auto;padding-left:18px'>" +
        (log || "<li style='color:#6b7280'>Henüz kayıt yok</li>") + "</ul>" +
        "<p class='baslik-altin'>Parmak izi</p><ul>" + (fp || "<li style='color:#6b7280'>Yok</li>") + "</ul>";

      el.querySelectorAll("[data-action]").forEach(function (b) {
        b.addEventListener("click", function () {
          oyuncuAksiyon(b.getAttribute("data-action"));
        });
      });
      var tamForm = document.getElementById("oyuncuTamForm");
      if (tamForm) {
        tamForm.addEventListener("submit", function (e) {
          e.preventDefault();
          var body = oyuncuFormVerisiTopla(el);
          if (!body) return;
          api("/api/admin/oyuncular/" + id, { method: "PATCH", body: body }).then(function (r) {
            toast(r.data.mesaj || r.data.error || "Tamam", !r.ok);
            if (r.ok) {
              oyuncuDetayYukle(id, true);
              oyuncuAra(true);
            }
          });
        });
      }
      var indirBtn = document.getElementById("oyuncuIndirBtn");
      if (indirBtn) {
        indirBtn.addEventListener("click", function () {
          var safeName = String(o.username || id).replace(/[^a-zA-Z0-9_-]/g, "_");
          indirDosya("/api/admin/oyuncular/" + id + "/export", "oyuncu-" + safeName + "-" + id + ".json");
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

  function inputText(name, val, label, opts) {
    opts = opts || {};
    var baslik = '<label style="display:block;font-size:11px;color:#9ca3af;margin-bottom:4px">' + esc(label) + "</label>";
    var attrs = 'name="' + name + '" class="admin-input" value="' + esc(val == null ? "" : val) + '"';
    if (opts.maxlength) attrs += ' maxlength="' + opts.maxlength + '"';
    if (opts.placeholder) attrs += ' placeholder="' + esc(opts.placeholder) + '"';
    return "<div>" + baslik + "<input " + attrs + "></div>";
  }

  function inputCheck(name, checked, label) {
    return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#d1d5db;margin:4px 0">' +
      '<input type="checkbox" name="' + name + '" ' + (checked ? "checked" : "") + "> " + esc(label) + "</label>";
  }

  function sectionTitle(text) {
    return "<p class='baslik-altin' style='margin-top:18px'>" + esc(text) + "</p>";
  }

  function oyuncuEnvanterSatirlari(hireSablon, envanter) {
    var adetMap = {};
    (envanter || []).forEach(function (e) {
      adetMap[e.item_key] = e.adet || 0;
    });
    return (hireSablon || []).map(function (h) {
      var adet = adetMap[h.key] || 0;
      return "<tr><td style='font-size:12px;color:#9ca3af'>" + esc(h.key) +
        "</td><td>" + esc(h.unvan) +
        '</td><td><input type="number" min="0" class="admin-input envanter-adet-input" style="width:88px;padding:6px 8px" ' +
        'data-item="' + esc(h.key) + '" value="' + adet + '"></td></tr>';
    }).join("");
  }

  function oyuncuFormVerisiTopla(el) {
    var form = el.querySelector("#oyuncuTamForm");
    if (!form) return null;
    function val(name) {
      var inp = form.querySelector('[name="' + name + '"]');
      return inp ? inp.value : "";
    }
    function checked(name) {
      var inp = form.querySelector('[name="' + name + '"]');
      return !!(inp && inp.checked);
    }
    var envanter = [];
    form.querySelectorAll(".envanter-adet-input").forEach(function (inp) {
      envanter.push({ itemKey: inp.getAttribute("data-item"), adet: inp.value });
    });
    var mekanlar = [];
    form.querySelectorAll(".mekan-adet-input").forEach(function (inp) {
      mekanlar.push({
        sektor: inp.getAttribute("data-sektor"),
        mekanKey: inp.getAttribute("data-mekan"),
        adet: inp.value,
      });
    });
    return {
      kullanici: {
        reisAdi: val("reisAdi"),
        lakap: val("lakap"),
        grup: val("grup"),
        kayitUlkesi: val("kayitUlkesi"),
        oyunDili: val("oyunDili"),
        isAdmin: checked("isAdmin") ? 1 : 0,
      },
      oyuncu: {
        kasa: val("kasa"),
        guc: val("guc"),
        puan: val("puan"),
        icraat: val("icraat"),
        smsHakki: val("sms_hakki"),
        elmas: val("elmas"),
        bonusGuc: val("bonusGuc"),
        devletIliskisi: val("devletIliskisi"),
        sehreHukmetSayisi: val("sehreHukmetSayisi"),
        limanIstanbul: checked("limanIstanbul") ? 1 : 0,
        karaListede: checked("karaListede"),
        sehirEfsane: checked("sehirEfsane"),
        profilAciklama: val("profilAciklama"),
        profilResmi: val("profilResmi"),
        dostlar: val("dostlar"),
        dusmanlar: val("dusmanlar"),
      },
      yetenekler: {
        guc: val("yetenek_guc"),
        zeka: val("yetenek_zeka"),
        dayaniklilik: val("yetenek_dayaniklilik"),
        beceri: val("yetenek_beceri"),
      },
      banka: {
        yatirilanMiktar: val("bankaYatirilan"),
        bankaHakki: val("bankaHakki"),
        faizBekleyen: val("bankaFaiz"),
      },
      guvenliYer: {
        baseSeviye: val("gyBaseSeviye"),
        buildingLvl: val("gyBuilding"),
        wallLvl: val("gyWall"),
        gardenLvl: val("gyGarden"),
        undergroundLvl: val("gyUnderground"),
        bunkerLvl: val("gyBunker"),
        kasaGumus: checked("gyKasaGumus"),
        kasaAltin: checked("gyKasaAltin"),
      },
      istihbarat: { elemanSayisi: val("istEleman") },
      mekanlar: mekanlar,
      envanter: envanter,
    };
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

  function yukleGorusOneriler() {
    var tb = document.getElementById("gorusOneriTablo");
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:16px">Yükleniyor…</td></tr>';
    api("/api/admin/gorus-oneriler").then(function (res) {
      if (!res.ok) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#f87171;padding:16px">' + esc(res.data.error || "Yüklenemedi") + "</td></tr>";
        return;
      }
      var liste = res.data.liste || [];
      if (!liste.length) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:16px">Henüz görüş yok.</td></tr>';
        return;
      }
      tb.innerHTML = liste.map(function (g) {
        return "<tr><td>" + g.id + "</td><td style='white-space:nowrap;font-size:12px'>" + esc(g.at) +
          "</td><td><b>" + esc(g.oyuncuAdi) + "</b><br><span style='font-size:11px;color:#6b7280'>@" + esc(g.oyuncuUsername) +
          "</span></td><td style='max-width:480px;white-space:pre-wrap;font-size:12px'>" + esc(g.mesaj) +
          '</td><td><button type="button" class="admin-btn admin-btn-gri gorus-oyuncu-btn" data-uid="' + g.userId +
          '" style="min-height:32px;padding:4px 10px">Oyuncu</button></td></tr>';
      }).join("");
      tb.querySelectorAll(".gorus-oyuncu-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktifNav("oyuncular");
          oyuncuDetayYukle(parseInt(btn.getAttribute("data-uid"), 10));
        });
      });
    });
  }

  function yukleRaporlar() {
    var tb = document.getElementById("raporTablo");
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:16px">Yükleniyor…</td></tr>';
    api("/api/admin/raporlar").then(function (res) {
      if (!res.ok) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f87171;padding:16px">' + esc(res.data.error || "Yüklenemedi") + "</td></tr>";
        return;
      }
      var liste = res.data.liste || [];
      if (!liste.length) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:16px">Henüz rapor yok.</td></tr>';
        return;
      }
      tb.innerHTML = liste.map(function (r) {
        var hedefBtn = "";
        if (r.hedefUserId) {
          hedefBtn = '<button type="button" class="admin-btn admin-btn-altin rapor-hedef-btn" data-uid="' + r.hedefUserId + '" style="min-height:32px;padding:4px 10px">' + esc(r.hedefBaslik) + "</button>";
        } else {
          hedefBtn = esc(r.hedefBaslik || "—");
        }
        return "<tr><td>" + r.id + "</td><td style='white-space:nowrap;font-size:12px'>" + esc(r.at) +
          "</td><td><b>" + esc(r.raporlayanAdi) + "</b><br><span style='font-size:11px;color:#6b7280'>@" + esc(r.raporlayanUsername) +
          "</span></td><td>" + esc(r.tipLabel) + "</td><td>" + hedefBtn +
          "</td><td style='max-width:320px;white-space:pre-wrap;font-size:12px'>" + esc(r.sebep) +
          '</td><td><button type="button" class="admin-btn admin-btn-gri rapor-raporlayan-btn" data-uid="' + r.raporlayanId +
          '" style="min-height:32px;padding:4px 10px">Raporlayan</button></td></tr>';
      }).join("");
      tb.querySelectorAll(".rapor-hedef-btn, .rapor-raporlayan-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktifNav("oyuncular");
          oyuncuDetayYukle(parseInt(btn.getAttribute("data-uid"), 10));
        });
      });
    });
  }

  function borsaDetayHtml(borsa) {
    var pozLen = borsa && borsa.pozisyonlar ? borsa.pozisyonlar.length : 0;
    var emirLen = borsa && borsa.emirler ? borsa.emirler.length : 0;
    var islemLen = borsa && borsa.sonIslemler ? borsa.sonIslemler.length : 0;
    if (!borsa || (!pozLen && !emirLen && !islemLen)) {
      return "<p class='baslik-altin'>Borsa</p><p style='color:#6b7280;font-size:13px'>Portföy veya emir yok.</p>";
    }
    var oz = borsa.ozet || {};
    var pozisyonlar = borsa.pozisyonlar || [];
    var emirler = borsa.emirler || [];
    var islemler = borsa.sonIslemler || [];
    var pozSatir = pozisyonlar.map(function (p) {
      return "<tr><td>" + esc(p.sirketId) + "</td><td>" + esc(p.ad) + "</td><td>" + fmt(p.adet) +
        "</td><td>" + fmt(p.fiyat) + " TL</td><td>" + fmt(p.deger) + " TL</td><td>" + fmt(p.karZarar) + " TL</td></tr>";
    }).join("");
    var emirSatir = emirler.map(function (e) {
      return "<tr><td>" + e.id + "</td><td>" + esc(e.sirketId) + "</td><td>" + esc(e.tur) +
        "</td><td>" + fmt(e.adet) + "</td><td>" + fmt(e.hedefFiyat) + " TL</td><td>" + fmt(e.guncelFiyat) + " TL</td></tr>";
    }).join("");
    return (
      "<p class='baslik-altin'>Borsa</p>" +
      "<div class='detay-grid'>" +
      info("Portföy Değeri", fmt(oz.toplamDeger || 0) + " TL") +
      info("Portföy K/Z", fmt(oz.karZarar || 0) + " TL") +
      info("Pozisyon", fmt(oz.pozisyonSayisi || 0)) +
      info("Bekleyen Emir", fmt(oz.emirSayisi || 0)) +
      "</div>" +
      "<div class='admin-tablo-wrap' style='max-height:220px;overflow:auto;margin:10px 0'>" +
      "<table class='admin-tablo'><thead><tr><th>Kod</th><th>Hisse</th><th>Adet</th><th>Fiyat</th><th>Değer</th><th>K/Z</th></tr></thead>" +
      "<tbody>" + (pozSatir || "<tr><td colspan='6' style='color:#6b7280'>Pozisyon yok</td></tr>") + "</tbody></table></div>" +
      "<p class='baslik-altin' style='margin-top:12px'>Bekleyen Emirler</p>" +
      "<div class='admin-tablo-wrap' style='max-height:180px;overflow:auto;margin-bottom:10px'>" +
      "<table class='admin-tablo'><thead><tr><th>ID</th><th>Kod</th><th>Tür</th><th>Adet</th><th>Hedef</th><th>Güncel</th></tr></thead>" +
      "<tbody>" + (emirSatir || "<tr><td colspan='6' style='color:#6b7280'>Emir yok</td></tr>") + "</tbody></table></div>" +
      listeHtml(islemler, function (l) {
        return "<li>" + esc(l.tur) + " · " + esc(l.ad) + " · " + fmt(l.adet) + " @ " + fmt(l.fiyat) +
          " TL = " + fmt(l.toplam) + " TL</li>";
      }, "Son işlem yok")
    );
  }

  function yukleBorsa() {
    api("/api/admin/borsa").then(function (res) {
      if (!res.ok) {
        toast(res.data.error || "Borsa verisi yüklenemedi", true);
        return;
      }
      var stats = res.data.stats || {};
      var statEl = document.getElementById("borsaStatGrid");
      if (statEl) {
        statEl.innerHTML =
          statKart("Yatırımcı", stats.yatirimci_sayisi, "👥") +
          statKart("Bekleyen Emir", stats.bekleyen_emir, "⏳") +
          statKart("Toplam Portföy", fmt(stats.toplam_portfoy_deger), "💹") +
          statKart("İşlem (24s)", stats.islem_24s, "🔄");
      }
      var sirketler = res.data.sirketler || [];
      var sEl = document.getElementById("borsaSirketTablo");
      if (sEl) {
        sEl.innerHTML = sirketler.map(function (s) {
          var deg = Number(s.degisim) || 0;
          var degCls = deg >= 0 ? "color:#4ade80" : "color:#f87171";
          return "<tr><td><b>" + esc(s.id) + "</b></td><td>" + esc(s.ad) + "</td><td>" + esc(s.sektor) +
            "</td><td style='color:#c5a059'>" + fmt(s.fiyat) + " TL</td><td style='" + degCls + "'>" +
            (deg >= 0 ? "+" : "") + deg.toFixed(1) + "%</td><td>%" + fmt(s.temettuYuzde) +
            "</td><td>" + (s.volatilite != null ? (Number(s.volatilite) * 100).toFixed(1) + "%" : "—") + "</td></tr>";
        }).join("") || "<tr><td colspan='7' style='color:#6b7280'>Hisse yok</td></tr>";
      }
      var emirler = res.data.sonEmirler || [];
      var eEl = document.getElementById("borsaEmirTablo");
      if (eEl) {
        eEl.innerHTML = emirler.map(function (e) {
          return "<tr><td>" + e.id + "</td><td><button type='button' class='admin-btn admin-btn-gri borsa-oyuncu-btn' data-uid='" +
            e.userId + "' style='min-height:30px;padding:4px 8px;font-size:11px'>" + esc(e.reisAdi || e.userId) +
            "</button></td><td>" + esc(e.tur) + "</td><td>" + esc(e.sirketAd) + "</td><td>" + fmt(e.adet) +
            "</td><td>" + fmt(e.hedefFiyat) + " TL</td><td>" + esc(e.durum) + "</td><td>" +
            (e.createdAt ? new Date(e.createdAt * 1000).toLocaleString("tr-TR") : "—") + "</td></tr>";
        }).join("") || "<tr><td colspan='8' style='color:#6b7280'>Emir kaydı yok</td></tr>";
        eEl.querySelectorAll(".borsa-oyuncu-btn").forEach(function (btn) {
          btn.addEventListener("click", function () {
            aktifNav("oyuncular");
            oyuncuDetayYukle(parseInt(btn.getAttribute("data-uid"), 10));
          });
        });
      }
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
        if (tab === "raporlar") yukleRaporlar();
        if (tab === "gorusOneriler") yukleGorusOneriler();
        if (tab === "borsa") yukleBorsa();
        if (tab === "guvenlik") yukleGuvenlik();
      });
    });
    document.getElementById("oyuncuAraBtn").addEventListener("click", oyuncuAra);
    var tumIndirBtn = document.getElementById("tumOyuncularIndirBtn");
    if (tumIndirBtn) {
      tumIndirBtn.addEventListener("click", function () {
        var q = (document.getElementById("oyuncuAra") || {}).value || "";
        var url = "/api/admin/oyuncular/export" + (q.trim() ? "?q=" + encodeURIComponent(q.trim()) : "");
        indirDosya(url, "oyuncular-export-" + Date.now() + ".json");
      });
    }
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
