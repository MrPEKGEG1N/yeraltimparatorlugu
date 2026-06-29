const express = require("express");
const rateLimit = require("express-rate-limit");
const { createRequireAdmin } = require("../middleware/auth");
const {
  getDashboard,
  searchPlayers,
  getPlayerDetail,
  exportPlayerSnapshot,
  exportAllPlayers,
  banPlayer,
  unbanPlayer,
  kickPlayer,
  updatePlayerStats,
  updatePlayerMekanlar,
  updatePlayerGuvenliYer,
  updatePlayerIstihbarat,
  listMafyaGruplari,
  getMafyaGrupDetail,
  mapMafyaGrupRow,
  mapMafyaGrupDetail,
  getMultiAccountClusters,
  listInboxMessages,
  listMafyaSohbet,
  listGrupMesajlari,
  deleteInboxMessage,
  deleteMafyaSohbet,
  deleteGrupMesaj,
  purgeUserMessages,
  listSecurityEvents,
  listCanliAktivite,
  listIcerikRaporlari,
  mapPlayerRow,
  fmtTs,
} = require("../game/adminService");

function createAdminRouter(db) {
  const router = express.Router();
  const requireAdmin = createRequireAdmin(db);

  const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Çok fazla yönetim isteği." },
  });

  router.use(requireAdmin);
  router.use(adminLimiter);

  router.get("/me", (req, res) => {
    res.json({
      ok: true,
      admin: {
        id: req.user.id,
        username: req.user.username,
        reisAdi: req.user.reisAdi,
      },
    });
  });

  router.get("/dashboard", async (req, res) => {
    try {
      const stats = await getDashboard(db);
      res.json({ ok: true, stats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Panel verisi yüklenemedi." });
    }
  });

  router.get("/borsa", async (req, res) => {
    try {
      const { adminBorsaOzet } = require("../game/borsaService");
      const data = await adminBorsaOzet(db);
      res.json({ ok: true, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Borsa verisi yüklenemedi." });
    }
  });

  router.get("/oyuncular/export", async (req, res) => {
    try {
      const q = req.query.q || "";
      const limit = parseInt(req.query.limit, 10) || 500;
      const data = await exportAllPlayers(db, q, limit);
      const filename = `oyuncular-export-${Date.now()}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Toplu dışa aktarma başarısız." });
    }
  });

  router.get("/oyuncular", async (req, res) => {
    try {
      const q = req.query.q || "";
      const rows = await searchPlayers(db, q);
      res.json({ ok: true, liste: rows.map(mapPlayerRow) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Arama başarısız." });
    }
  });

  router.get("/oyuncular/:id/export", async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const data = await exportPlayerSnapshot(db, userId);
      if (!data) return res.status(404).json({ ok: false, error: "Oyuncu bulunamadı." });
      const safeName = String(data.kullanici?.username || userId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `oyuncu-${safeName}-${userId}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Dışa aktarma başarısız." });
    }
  });

  router.get("/oyuncular/:id", async (req, res) => {
    try {
      const detail = await getPlayerDetail(db, parseInt(req.params.id, 10));
      if (!detail) return res.status(404).json({ ok: false, error: "Oyuncu bulunamadı." });
      const extra = detail.extra || {};
      res.json({
        ok: true,
        oyuncu: {
          ...mapPlayerRow(detail.user),
          userAgent: detail.user.user_agent,
          createdAt: fmtTs(detail.user.created_at),
          lakap: detail.user.lakap,
          grup: detail.user.grup,
          smsHakki: detail.user.sms_hakki,
          mekanToplam: detail.mekanToplam,
          guvenliYer: detail.guvenliYer,
          istihbaratEleman: detail.istihbaratEleman,
          bonusGuc: detail.user.bonus_guc || 0,
          devletIliskisi: detail.user.devlet_iliskisi,
          karaListede: !!detail.user.kara_listede,
          sehirEfsane: !!detail.user.sehir_efsane,
          sehreHukmetSayisi: detail.user.sehre_hukmet_sayisi || 0,
          limanIstanbul: detail.user.liman_istanbul || 0,
        },
        yetenekler: detail.yetenekler || null,
        aktifMeslek: detail.aktifMeslek || null,
        sirketCalisan: detail.sirketCalisan || null,
        sahipSirket: detail.sahipSirket || null,
        sirketPanel: extra.sirketPanel || null,
        mekanlar: detail.mekanlar || [],
        guvenliYer: detail.guvenliYer,
        guvenliYerFull: extra.guvenliYerFull || null,
        istihbaratEleman: detail.istihbaratEleman,
        profil: extra.profil || null,
        ekonomi: extra.ekonomi || null,
        sehirMeta: extra.sehirMeta || null,
        sefirlikOzet: extra.sefirlikOzet || null,
        sehirKontroller: extra.sehirKontroller || [],
        sehirHukimiyetSahip: extra.sehirHakimiyetSahip || [],
        sehirHukumranliklar: extra.sehirHukumranliklar || [],
        envanter: extra.envanter || [],
        limanlar: extra.limanlar || [],
        babaMakamlari: extra.babaMakamlari || [],
        sadakatOylari: extra.sadakatOylari || [],
        gunlukGorevler: extra.gunlukGorevler || [],
        mafyaBasvurulari: extra.mafyaBasvurulari || [],
        mafyaIsleri: extra.mafyaIsleri || [],
        mafyaSavaslari: extra.mafyaSavaslari || [],
        medyaHaberleri: extra.medyaHaberleri || [],
        statHareketleri: extra.statHareketleri || [],
        mesajSayilari: extra.mesajSayilari || null,
        profilZiyaretSayisi: extra.profilZiyaretSayisi || 0,
        icerikRaporlari: extra.icerikRaporlari || [],
        banka: extra.banka || null,
        fingerprints: detail.fingerprints.map((f) => ({
          visitorId: f.visitor_id,
          ip: f.son_ip,
          userAgent: f.user_agent,
          firstSeen: fmtTs(f.first_seen),
          lastSeen: fmtTs(f.last_seen),
        })),
        events: detail.events.map((e) => ({
          type: e.event_type,
          detail: e.detail,
          ip: e.ip,
          at: fmtTs(e.created_at),
        })),
        mafya: detail.uyelik
          ? { grupId: detail.uyelik.grup_id, isim: detail.uyelik.isim, rutbe: detail.uyelik.rutbe }
          : null,
        borsa: detail.borsa || null,
        aktiviteLog: detail.aktiviteLog || [],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Detay yüklenemedi." });
    }
  });

  router.post("/oyuncular/:id/ban", async (req, res) => {
    try {
      const result = await banPlayer(
        db,
        req.user.id,
        parseInt(req.params.id, 10),
        req.body?.reason || ""
      );
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Ban işlemi başarısız." });
    }
  });

  router.post("/oyuncular/:id/unban", async (req, res) => {
    try {
      const result = await unbanPlayer(db, req.user.id, parseInt(req.params.id, 10));
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Ban kaldırma başarısız." });
    }
  });

  router.post("/oyuncular/:id/kick", async (req, res) => {
    try {
      const result = await kickPlayer(db, req.user.id, parseInt(req.params.id, 10));
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Oturum sonlandırma başarısız." });
    }
  });

  router.patch("/oyuncular/:id/stats", async (req, res) => {
    try {
      const result = await updatePlayerStats(
        db,
        req.user.id,
        parseInt(req.params.id, 10),
        req.body || {}
      );
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "İstatistik güncellenemedi." });
    }
  });

  router.patch("/oyuncular/:id/mekanlar", async (req, res) => {
    try {
      const result = await updatePlayerMekanlar(
        db,
        req.user.id,
        parseInt(req.params.id, 10),
        req.body?.mekanlar || []
      );
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Mekanlar güncellenemedi." });
    }
  });

  router.patch("/oyuncular/:id/guvenli-yer", async (req, res) => {
    try {
      const result = await updatePlayerGuvenliYer(
        db,
        req.user.id,
        parseInt(req.params.id, 10),
        req.body?.baseSeviye
      );
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Güvenli Yer güncellenemedi." });
    }
  });

  router.patch("/oyuncular/:id/istihbarat", async (req, res) => {
    try {
      const result = await updatePlayerIstihbarat(
        db,
        req.user.id,
        parseInt(req.params.id, 10),
        req.body?.elemanSayisi
      );
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "İstihbarat güncellenemedi." });
    }
  });

  router.get("/mafya-gruplari", async (req, res) => {
    try {
      const rows = await listMafyaGruplari(db, req.query.q || "");
      res.json({ ok: true, liste: rows.map(mapMafyaGrupRow) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Mafya grupları yüklenemedi." });
    }
  });

  router.get("/mafya-gruplari/:id", async (req, res) => {
    try {
      const detail = await getMafyaGrupDetail(db, parseInt(req.params.id, 10));
      if (!detail) return res.status(404).json({ ok: false, error: "Grup bulunamadı." });
      res.json({ ok: true, ...mapMafyaGrupDetail(detail) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Grup detayı yüklenemedi." });
    }
  });

  router.post("/oyuncular/:id/mesaj-temizle", async (req, res) => {
    try {
      const result = await purgeUserMessages(db, req.user.id, parseInt(req.params.id, 10));
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Mesaj temizleme başarısız." });
    }
  });

  router.get("/multi-hesap", async (req, res) => {
    try {
      const data = await getMultiAccountClusters(db);
      res.json({ ok: true, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Multi-hesap listesi yüklenemedi." });
    }
  });

  router.get("/mesajlar/kutu", async (req, res) => {
    try {
      const rows = await listInboxMessages(db, { q: req.query.q, limit: 80 });
      res.json({
        ok: true,
        liste: rows.map((r) => ({
          id: r.id,
          tip: r.tip,
          konu: r.konu,
          icerik: r.icerik,
          okundu: !!r.okundu,
          gonderen: r.gonderen || "Sistem",
          gonderenId: r.gonderen_id,
          alici: r.alici,
          aliciId: r.alici_id,
          at: fmtTs(r.created_at),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Mesajlar yüklenemedi." });
    }
  });

  router.get("/mesajlar/sohbet", async (req, res) => {
    try {
      const rows = await listMafyaSohbet(db, 80);
      res.json({
        ok: true,
        liste: rows.map((r) => ({
          id: r.id,
          mesaj: r.mesaj,
          reisAdi: r.reis_adi,
          userId: r.user_id,
          at: fmtTs(r.created_at),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Sohbet yüklenemedi." });
    }
  });

  router.get("/mesajlar/grup", async (req, res) => {
    try {
      const rows = await listGrupMesajlari(db, 80);
      res.json({
        ok: true,
        liste: rows.map((r) => ({
          id: r.id,
          icerik: r.icerik,
          reisAdi: r.reis_adi,
          userId: r.user_id,
          grupAdi: r.grup_adi,
          grupId: r.grup_id,
          at: fmtTs(r.created_at),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Grup mesajları yüklenemedi." });
    }
  });

  router.delete("/mesajlar/kutu/:id", async (req, res) => {
    try {
      const result = await deleteInboxMessage(db, req.user.id, parseInt(req.params.id, 10));
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Silinemedi." });
    }
  });

  router.delete("/mesajlar/sohbet/:id", async (req, res) => {
    try {
      const result = await deleteMafyaSohbet(db, req.user.id, parseInt(req.params.id, 10));
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Silinemedi." });
    }
  });

  router.delete("/mesajlar/grup/:id", async (req, res) => {
    try {
      const result = await deleteGrupMesaj(db, req.user.id, parseInt(req.params.id, 10));
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Silinemedi." });
    }
  });

  router.get("/raporlar", async (req, res) => {
    try {
      const liste = await listIcerikRaporlari(db, 150);
      res.json({
        ok: true,
        liste: liste.map((r) => ({
          ...r,
          at: fmtTs(r.at),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Raporlar yüklenemedi." });
    }
  });

  router.get("/guvenlik", async (req, res) => {
    try {
      const events = await listSecurityEvents(db, 100);
      res.json({
        ok: true,
        liste: events.map((e) => ({
          id: e.id,
          type: e.event_type,
          detail: e.detail,
          ip: e.ip,
          reisAdi: e.reis_adi,
          username: e.username,
          at: fmtTs(e.created_at),
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Güvenlik günlüğü yüklenemedi." });
    }
  });

  router.get("/aktivite", async (req, res) => {
    try {
      const liste = await listCanliAktivite(db, parseInt(req.query.limit, 10) || 100);
      res.json({ ok: true, liste });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Canlı aktivite yüklenemedi." });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
