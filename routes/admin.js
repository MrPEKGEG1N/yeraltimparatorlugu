const express = require("express");
const rateLimit = require("express-rate-limit");
const { createRequireAdmin } = require("../middleware/auth");
const {
  getDashboard,
  searchPlayers,
  getPlayerDetail,
  banPlayer,
  unbanPlayer,
  kickPlayer,
  updatePlayerStats,
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

  router.get("/oyuncular/:id", async (req, res) => {
    try {
      const detail = await getPlayerDetail(db, parseInt(req.params.id, 10));
      if (!detail) return res.status(404).json({ ok: false, error: "Oyuncu bulunamadı." });
      res.json({
        ok: true,
        oyuncu: {
          ...mapPlayerRow(detail.user),
          userAgent: detail.user.user_agent,
          createdAt: fmtTs(detail.user.created_at),
          smsHakki: detail.user.sms_hakki,
        },
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
