const express = require("express");
const { createRequireAuth } = require("../middleware/auth");
const { get, run, all } = require("../db/database");
const {
  loadPlayer,
  performAction,
  publicPlayerFull,
  mesajlariGetir,
  mafyaSohbetListe,
} = require("../game/playerService");
const { tumMesajlariOkundu } = require("../game/messagingService");
const { getLeaderboard, getGrupLeaderboard, getOyuncuSira, getGrupSira, kayitliOyuncuAdiDogrula } = require("../game/leaderboardService");
const { mafyaPanel, grupAra, kullaniciGrubu } = require("../game/mafiaService");
const { savaslariListele } = require("../game/mafyaSavasService");
const { haberleriGetir } = require("../game/medyaService");
const { isPanel } = require("../game/mafyaIsService");
const { eviGetir, hibeGecmisiGetir } = require("../game/mafyaEviService");
const { karaListeyiGetir, karaListeSenkronize } = require("../game/karaListeService");
const { saygiDuvariniGetir, sehirTarihiniGetir } = require("../game/saygiDuvariService");
const { getGazetePanel, gazeteOkunduIsaretle } = require("../game/sehirGazeteService");
const { ICRAAT_MAX, ICRAAT_REGEN_SEC, ICRAAT_SAATLIK_BONUS } = require("../game/catalog");
const { temizGrupAdi } = require("../game/grupAdi");
const { oyuncuIsDurumuMetni } = require("../game/isDurumuService");
const { gecerliProfilResmi } = require("../game/profilPortreler");
const { panelGetir } = require("../game/gunlukGorevService");
const { panelGetir: guvenliYerPanelGetir } = require("../game/guvenliYerService");
const {
  panelGetir: sefirlikPanelGetir,
  kontrolTopla,
  ihaleGir,
  sehreSaldir,
} = require("../game/turkiyeSefirlikService");
const { panelGetir: meslekPanelGetir } = require("../game/meslekService");
const { panelGetir: sirketPanelGetir } = require("../game/sirketService");
const { sanitizeProfilAciklama } = require("../game/profilAciklamaSanitize");
const { kaydetAktivite, aksiyonDetayOlustur } = require("../game/aktiviteService");
const { raporGonder } = require("../game/raporService");
const { gorusOneriGonder } = require("../game/gorusOneriService");
const {
  ensureBildirimTables,
  vapidPublicKey,
  configureWebPush,
  tercihleriGetir,
  tercihleriKaydet,
  pushAbonelikEkle,
  pushAbonelikSil,
  bildirimleriGetir,
  okunmamisBildirimSayisi,
  bildirimleriOkundu,
  bildirimleriSil,
  bildirimTestGonder,
  bildirimSistemDurumu,
} = require("../game/bildirimService");
const {
  attachClientMeta,
  createBannedCheck,
  createFingerprintRefresh,
  createActionGuard,
  ipRateLimit,
} = require("../middleware/security");

function createGameRouter(db) {
  const router = express.Router();
  const requireAuth = createRequireAuth(db);

  router.use(requireAuth);
  router.use(attachClientMeta);
  router.use(createBannedCheck(db));
  router.use(createFingerprintRefresh(db));
  router.use(ipRateLimit({ windowMs: 60_000, max: 120 }));

  router.get("/player", async (req, res) => {
    try {
      const player = await loadPlayer(db, req.user.id);
      res.json(await publicPlayerFull(db, req.user.id, player, req.clientMeta || null));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Oyuncu verisi yüklenemedi." });
    }
  });

  router.get("/leaderboard", async (req, res) => {
    try {
      const tip = req.query.tip || "oyuncu";
      if (tip === "grup") {
        const liste = await getGrupLeaderboard(db);
        return res.json({ ok: true, tip: "grup", liste });
      }
      const liste = await getLeaderboard(db, req.user.id);
      res.json({ ok: true, tip: "oyuncu", liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Liderlik tablosu yüklenemedi." });
    }
  });

  router.get("/mafya/ara", async (req, res) => {
    try {
      const liste = await grupAra(db, req.query.q || "");
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Arama başarısız." });
    }
  });

  router.get("/mafya", async (req, res) => {
    try {
      const panel = await mafyaPanel(db, req.user.id);
      res.json({ ok: true, ...panel });
    } catch (err) {
      console.error("mafya panel:", err);
      res.status(500).json({ ok: false, error: "Mafya verisi yüklenemedi: " + err.message });
    }
  });

  router.get("/mesajlar", async (req, res) => {
    try {
      const liste = await mesajlariGetir(db, req.user.id);
      await tumMesajlariOkundu(db, req.user.id);
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Mesajlar yüklenemedi." });
    }
  });

  router.get("/sohbet", async (req, res) => {
    try {
      const liste = await mafyaSohbetListe(db);
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Sohbet yüklenemedi." });
    }
  });

  router.get("/profile/:userId", async (req, res) => {
    try {
      const targetId =
        req.params.userId === "me" ? req.user.id : parseInt(req.params.userId, 10);
      if (!targetId) return res.status(400).json({ ok: false, error: "Geçersiz oyuncu." });

      const p = await get(
        db,
        `SELECT u.id, u.reis_adi, u.grup, u.lakap, u.created_at, u.kayit_ulkesi, u.oyun_dili, pl.puan, pl.guc,
                pl.profil_aciklama, pl.dostlar, pl.dusmanlar, pl.sehir_efsane,
                pl.kara_listede, pl.icraat, pl.last_icraat_at, pl.profil_resmi
         FROM users u
         JOIN players pl ON pl.user_id = u.id
         WHERE u.id = ?`,
        [targetId]
      );
      if (!p) return res.status(404).json({ ok: false, error: "Oyuncu bulunamadı." });

      if (req.user.id !== targetId) {
        await run(
          db,
          `INSERT INTO profil_ziyaretleri (target_user_id, viewer_user_id, created_at)
           VALUES (?, ?, strftime('%s','now'))
           ON CONFLICT(target_user_id, viewer_user_id) DO UPDATE SET created_at = excluded.created_at`,
          [targetId, req.user.id]
        );
      }

      const ziyaretler = await all(
        db,
        `SELECT u.reis_adi
         FROM profil_ziyaretleri z
         JOIN users u ON u.id = z.viewer_user_id
         WHERE z.target_user_id = ?
         ORDER BY z.created_at DESC
         LIMIT 20`,
        [targetId]
      );

      const kendiProfili = req.user.id === targetId;
      const kayitTarihi = p.created_at
        ? new Date(p.created_at * 1000).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
        : "—";

      const sira = await getOyuncuSira(db, targetId);
      const grupSira = await getGrupSira(db, targetId, p.grup);
      const grupUyelik = await kullaniciGrubu(db, targetId);
      const isDurumu = await oyuncuIsDurumuMetni(db, targetId);

      let saatlikKazanc = null;
      let icraatGoster = null;
      let lastIcraatAtGoster = null;
      let yetenekler = null;
      let aktifMeslek = null;
      if (kendiProfili) {
        const player = await loadPlayer(db, targetId);
        const full = await publicPlayerFull(db, targetId, player);
        saatlikKazanc = full.saatlikKazanc;
        icraatGoster = full.icraat;
        lastIcraatAtGoster = full.lastIcraatAt;
        yetenekler = full.yetenekler;
        aktifMeslek = full.aktifMeslek;
      }

      res.json({
        ok: true,
        profil: {
          userId: p.id,
          oyuncuAdi: p.reis_adi,
          lakap: p.lakap || "Mafya",
          grup: temizGrupAdi(grupUyelik?.isim || p.grup),
          grupId: grupUyelik?.id || null,
          puan: p.puan,
          guc: kendiProfili ? p.guc : null,
          sira,
          grupSira,
          saatlikKazanc,
          icraat: icraatGoster,
          lastIcraatAt: lastIcraatAtGoster,
          icraatRegenSec: kendiProfili ? ICRAAT_REGEN_SEC : null,
          icraatSaatlikBonus: kendiProfili ? ICRAAT_SAATLIK_BONUS : null,
          aciklama: p.profil_aciklama || "",
          dostlar: p.dostlar || "",
          dusmanlar: p.dusmanlar || "",
          profilResmi: p.profil_resmi || "",
          sehirEfsane: !!(p.sehir_efsane),
          karaListede: !!(p.kara_listede),
          kayitTarihi,
          kayitUlkesi: p.kayit_ulkesi || "",
          oyunDili: p.oyun_dili || "tr",
          ziyaretler: ziyaretler.map((x) => x.reis_adi),
          yetenekler,
          aktifMeslek,
          isDurumu,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Profil yüklenemedi." });
    }
  });

  router.post("/profile", async (req, res) => {
    try {
      const body = req.body || {};
      const portre = body.profilResmi != null ? gecerliProfilResmi(body.profilResmi) : null;
      if (body.profilResmi != null && !portre) {
        return res.status(400).json({ ok: false, error: "Geçersiz profil resmi." });
      }

      const sadeceResim =
        portre &&
        body.aciklama === undefined &&
        body.dostlar === undefined &&
        body.dusmanlar === undefined;

      if (sadeceResim) {
        await run(db, `UPDATE players SET profil_resmi = ? WHERE user_id = ?`, [
          portre,
          req.user.id,
        ]);
      } else {
        const aciklama = sanitizeProfilAciklama(body.aciklama);
        const dostKontrol = await kayitliOyuncuAdiDogrula(db, body.dostlar);
        if (!dostKontrol.ok) {
          return res.status(400).json({ ok: false, error: dostKontrol.error });
        }
        const dusmanKontrol = await kayitliOyuncuAdiDogrula(db, body.dusmanlar);
        if (!dusmanKontrol.ok) {
          return res.status(400).json({ ok: false, error: dusmanKontrol.error });
        }
        const dostlar = dostKontrol.value;
        const dusmanlar = dusmanKontrol.value;
        if (portre) {
          await run(
            db,
            `UPDATE players SET profil_aciklama = ?, dostlar = ?, dusmanlar = ?, profil_resmi = ? WHERE user_id = ?`,
            [aciklama, dostlar, dusmanlar, portre, req.user.id]
          );
        } else {
          await run(
            db,
            `UPDATE players SET profil_aciklama = ?, dostlar = ?, dusmanlar = ? WHERE user_id = ?`,
            [aciklama, dostlar, dusmanlar, req.user.id]
          );
        }
      }
      const player = await loadPlayer(db, req.user.id);
      const full = await publicPlayerFull(db, req.user.id, player);
      res.json({ ok: true, player: full });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Profil kaydedilemedi." });
    }
  });

  router.post("/rapor", async (req, res) => {
    const body = req.body || {};
    try {
      const sonuc = await raporGonder(db, req.user.id, {
        tip: body.tip,
        hedefUserId: body.hedefUserId,
        hedefGrupId: body.hedefGrupId,
        sebep: body.sebep,
      });
      if (!sonuc.ok) return res.status(400).json(sonuc);
      res.json(sonuc);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Rapor gönderilemedi." });
    }
  });

  router.post("/gorus-oneri", async (req, res) => {
    const body = req.body || {};
    try {
      const sonuc = await gorusOneriGonder(db, req.user.id, body.mesaj);
      if (!sonuc.ok) return res.status(400).json(sonuc);
      res.json(sonuc);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Görüş gönderilemedi." });
    }
  });

  router.post("/activity", async (req, res) => {
    const body = req.body || {};
    try {
      await kaydetAktivite(db, req.user.id, {
        ekran: body.ekran,
        aksiyon: body.aksiyon,
        detay: body.detay,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Aktivite kaydedilemedi." });
    }
  });

  router.post("/action", createActionGuard(db), async (req, res) => {
    const body = req.body || {};
    const { action, key, adet, aktifEkran, ...extra } = body;
    if (!action) {
      return res.status(400).json({ ok: false, error: "Aksiyon belirtilmedi." });
    }
    try {
      const result = await performAction(db, req.user.id, action, key, adet, {
        ...extra,
        _securityMeta: req.clientMeta || {},
      });
      if (!result.ok) return res.status(400).json(result);
      try {
        const { schedulePlayerSnapshotPersist } = require("../game/oyuncuSnapshotPersist");
        schedulePlayerSnapshotPersist(db, req.user.id);
      } catch (_) {}
      try {
        await kaydetAktivite(db, req.user.id, {
          ekran: aktifEkran || "",
          aksiyon: action,
          detay: aksiyonDetayOlustur(action, key, adet, extra, result),
        });
      } catch (aktErr) {
        console.warn("Aktivite kaydı atlandı:", aktErr.message);
      }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Sunucu hatası." });
    }
  });

  router.get("/mafya/savaslar", async (req, res) => {
    try {
      const grup = await kullaniciGrubu(db, req.user.id);
      if (!grup) {
        return res.json({ ok: true, savaslar: [] });
      }
      const savaslar = await savaslariListele(db, grup.id);
      res.json({ ok: true, savaslar });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Savaşlar yüklenemedi." });
    }
  });

  router.get("/gorevler", async (req, res) => {
    try {
      const panel = await panelGetir(db, req.user.id);
      res.json(panel);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Günlük görevler yüklenemedi." });
    }
  });

  router.get("/guvenli-yer", async (req, res) => {
    try {
      const player = await loadPlayer(db, req.user.id);
      const panel = await guvenliYerPanelGetir(db, req.user.id, player);
      res.json(panel);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Güvenli Yer yüklenemedi." });
    }
  });

  router.get("/sefirlik/panel", async (req, res) => {
    try {
      const panel = await sefirlikPanelGetir(db, req.user.id);
      res.json(panel);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Türkiye Sefirliği yüklenemedi." });
    }
  });

  router.get("/meslek/panel", async (req, res) => {
    try {
      const panel = await meslekPanelGetir(db, req.user.id);
      res.json(panel);
    } catch (err) {
      console.error("[meslek/panel]", err?.message || err);
      res.status(500).json({ ok: false, error: "Meslek paneli yüklenemedi." });
    }
  });

  router.get("/sirket/panel", async (req, res) => {
    try {
      const panel = await sirketPanelGetir(db, req.user.id);
      res.json(panel);
    } catch (err) {
      console.error("[sirket/panel]", err?.message || err);
      res.status(500).json({ ok: false, error: "Şirket paneli yüklenemedi." });
    }
  });

  router.get("/mafya/isler", async (req, res) => {
    try {
      const grup = await kullaniciGrubu(db, req.user.id);
      if (!grup) return res.json({ ok: true, panel: await isPanel(db, null) });
      const panel = await isPanel(db, grup.id);
      res.json({ ok: true, panel });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Mafya işleri yüklenemedi." });
    }
  });

  router.get("/mafya/evi", async (req, res) => {
    try {
      const grup = await kullaniciGrubu(db, req.user.id);
      if (!grup) return res.json({ ok: false, error: "Mafya grubu üyesi değilsin." });
      const ev = await eviGetir(db, grup.id);
      res.json({ ok: true, ev, benLiderim: grup.lider_user_id === req.user.id, grupAdi: grup.isim });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Mafya evi yüklenemedi." });
    }
  });

  router.get("/mafya/evi/hibeler", async (req, res) => {
    try {
      const grup = await kullaniciGrubu(db, req.user.id);
      if (!grup) return res.json({ ok: false, error: "Mafya grubu üyesi değilsin." });
      const hibeler = await hibeGecmisiGetir(db, grup.id);
      res.json({ ok: true, hibeler });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Hibe geçmişi yüklenemedi." });
    }
  });

  router.get("/medya/haberler", async (req, res) => {
    try {
      const haberler = await haberleriGetir(db);
      res.json({ ok: true, haberler });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Haberler yüklenemedi." });
    }
  });

  router.get("/kara-liste", async (req, res) => {
    try {
      await karaListeSenkronize(db);
      const liste = await karaListeyiGetir(db);
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Kara liste yüklenemedi." });
    }
  });

  router.get("/saygi-duvari", async (req, res) => {
    try {
      const liste = await saygiDuvariniGetir(db);
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Saygı duvarı yüklenemedi." });
    }
  });

  router.post("/profile/ziyaret-okundu", async (req, res) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      await run(db, `UPDATE players SET profil_ziyaret_okundu_at = ? WHERE user_id = ?`, [
        now,
        req.user.id,
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "İşlem başarısız." });
    }
  });

  router.get("/gazete", async (req, res) => {
    try {
      const panel = await getGazetePanel(db, req.user.id);
      res.json({ ok: true, ...panel });
    } catch (err) {
      console.error("[gazete]", err?.message || err);
      res.status(500).json({ ok: false, error: "Gazete yüklenemedi." });
    }
  });

  router.post("/gazete/okundu", async (req, res) => {
    try {
      const sonId = await gazeteOkunduIsaretle(db, req.user.id);
      res.json({ ok: true, sonHaberId: sonId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "İşlem başarısız." });
    }
  });

  router.get("/sehir-tarihi", async (req, res) => {
    try {
      const { reconcileHukumBaslangicFromImageSeeds } = require("../game/oyuncuRestoreService");
      await reconcileHukumBaslangicFromImageSeeds(db);
      const liste = await sehirTarihiniGetir(db);
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Şehir tarihi yüklenemedi." });
    }
  });

  router.get("/mafya/grup/:grupId", async (req, res) => {
    try {
      const grupId = parseInt(req.params.grupId, 10);
      if (!grupId) return res.status(400).json({ ok: false, error: "Geçersiz grup." });

      const { grupProfil } = require("../game/mafiaService");
      const profil = await grupProfil(db, grupId, req.user.id);
      if (!profil) return res.status(404).json({ ok: false, error: "Grup bulunamadı." });

      res.json({ ok: true, grup: profil });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Grup bilgileri yüklenemedi." });
    }
  });

  router.get("/sabotaj/panel", async (req, res) => {
    try {
      const { panelGetir } = require("../game/sabotajService");
      const panel = await panelGetir(db, req.user.id);
      res.json(panel);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Sabotaj paneli yüklenemedi." });
    }
  });

  router.get("/borsa/panel", async (req, res) => {
    try {
      const { panelGetir } = require("../game/borsaService");
      const panel = await panelGetir(db, req.user.id);
      res.json(panel);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Borsa paneli yüklenemedi." });
    }
  });

  router.get("/kumarhane/panel", async (req, res) => {
    try {
      const { panelGetir } = require("../game/kumarhaneService");
      const { masaDurumuGetir, PVP_MIN_BAHIS } = require("../game/kumarhaneMasaService");
      const { panelVerisiGetir } = require("../game/kumarhanePiyangoService");
      const panel = await panelGetir(db, req.user.id);
      const oyunId = String(req.query.oyunId || "");
      panel.pvpMinBahis = PVP_MIN_BAHIS;
      if (oyunId) panel.pvpMasa = await masaDurumuGetir(db, req.user.id, oyunId);
      panel.piyango = await panelVerisiGetir(db, req.user.id);
      res.json(panel);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Kumarhane paneli yüklenemedi." });
    }
  });

  router.get("/oyuncu/rakipler", async (req, res) => {
    try {
      const { rakipListele } = require("../game/worldService");
      const liste = await rakipListele(db, req.user.id, 5);
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Rakip listesi yüklenemedi." });
    }
  });

  router.get("/oyuncu/ara", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) return res.status(400).json({ ok: false, error: "Düşman adını yaz." });

      const row = await get(
        db,
        `SELECT u.id, u.reis_adi, u.lakap, u.grup, p.puan
         FROM users u
         JOIN players p ON p.user_id = u.id
         WHERE LOWER(u.reis_adi) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
        [q, q]
      );
      if (!row) return res.json({ ok: false, error: "Oyuncu bulunamadı. Reis adını doğru yaz." });
      if (row.id === req.user.id) {
        return res.json({ ok: false, error: "Kendini düşman olarak arayamazsın Reis!" });
      }

      res.json({
        ok: true,
        oyuncu: {
          userId: row.id,
          reisAdi: row.reis_adi,
          lakap: row.lakap || "Mafya",
          grup: temizGrupAdi(row.grup),
          puan: row.puan,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Arama başarısız." });
    }
  });

  router.get("/bildirim/vapid", (req, res) => {
    const key = vapidPublicKey();
    if (!key) return res.status(503).json({ ok: false, error: "Push bildirimleri kullanılamıyor." });
    res.json({ ok: true, publicKey: key });
  });

  router.get("/bildirim", async (req, res) => {
    try {
      await ensureBildirimTables(db);
      const liste = await bildirimleriGetir(db, req.user.id, 50);
      const okunmamis = await okunmamisBildirimSayisi(db, req.user.id);
      const tercih = await tercihleriGetir(db, req.user.id);
      res.json({
        ok: true,
        liste,
        okunmamis,
        tercihler: tercih.tercihler,
        turler: tercih.turler,
        vapidPublicKey: vapidPublicKey(),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Bildirimler yüklenemedi." });
    }
  });

  router.post("/bildirim/tercihler", async (req, res) => {
    try {
      const sonuc = await tercihleriKaydet(db, req.user.id, req.body || {});
      res.json({ ok: true, ...sonuc });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Tercihler kaydedilemedi." });
    }
  });

  router.post("/bildirim/subscribe", async (req, res) => {
    try {
      const sonuc = await pushAbonelikEkle(
        db,
        req.user.id,
        req.body || {},
        req.headers["user-agent"] || ""
      );
      if (!sonuc.ok) return res.status(400).json(sonuc);
      res.json(sonuc);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Abonelik kaydedilemedi." });
    }
  });

  router.post("/bildirim/unsubscribe", async (req, res) => {
    try {
      const sonuc = await pushAbonelikSil(db, req.user.id, req.body?.endpoint || null);
      res.json(sonuc);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Abonelik silinemedi." });
    }
  });

  router.post("/bildirim/okundu", async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
      await bildirimleriOkundu(db, req.user.id, ids);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "İşlem başarısız." });
    }
  });

  router.post("/bildirim/sil", async (req, res) => {
    try {
      const body = req.body || {};
      const sonuc = await bildirimleriSil(db, req.user.id, {
        ids: body.ids,
        tumu: !!body.tumu,
      });
      if (!sonuc.ok) return res.status(400).json(sonuc);
      const okunmamis = await okunmamisBildirimSayisi(db, req.user.id);
      const liste = await bildirimleriGetir(db, req.user.id, 50);
      res.json({ ok: true, okunmamis, liste, ...sonuc });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Bildirim silinemedi." });
    }
  });

  router.post("/bildirim/test", async (req, res) => {
    try {
      const sonuc = await bildirimTestGonder(db, req.user.id);
      if (sonuc.skipped === "bildirim_kapali") {
        return res.status(400).json({ ok: false, error: "Tüm bildirimler kapalı. Ayarlardan açabilirsin." });
      }
      if (sonuc.skipped === "tercih_kapali") {
        return res.status(400).json({ ok: false, error: "Bu bildirim türü kapalı." });
      }
      if (!sonuc.ok) {
        return res.status(500).json({ ok: false, error: "Test bildirimi gönderilemedi." });
      }
      const sistem = await bildirimSistemDurumu(db);
      res.json({
        ok: true,
        mesaj: "Test bildirimi gönderildi.",
        id: sonuc.id,
        sistem,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Test bildirimi gönderilemedi." });
    }
  });

  return router;
}

module.exports = { createGameRouter };
