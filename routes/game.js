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
const { getLeaderboard, getGrupLeaderboard, getOyuncuSira, getGrupSira, BOTLAR } = require("../game/leaderboardService");
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
const { gecerliProfilResmi } = require("../game/profilPortreler");
const { panelGetir } = require("../game/gunlukGorevService");
const { panelGetir: guvenliYerPanelGetir } = require("../game/guvenliYerService");
const { sanitizeProfilAciklama } = require("../game/profilAciklamaSanitize");
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
      res.json(await publicPlayerFull(db, req.user.id, player));
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
        `SELECT u.id, u.reis_adi, u.grup, u.lakap, u.created_at, pl.puan, pl.guc,
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

      let saatlikKazanc = null;
      if (kendiProfili) {
        const player = await loadPlayer(db, targetId);
        const full = await publicPlayerFull(db, targetId, player);
        saatlikKazanc = full.saatlikKazanc;
      }

      res.json({
        ok: true,
        profil: {
          userId: p.id,
          oyuncuAdi: p.reis_adi,
          lakap: p.lakap || "Mafya",
          grup: temizGrupAdi(p.grup),
          puan: p.puan,
          guc: kendiProfili ? p.guc : null,
          sira,
          grupSira,
          saatlikKazanc,
          icraat: kendiProfili ? p.icraat : null,
          lastIcraatAt: kendiProfili ? p.last_icraat_at : null,
          icraatRegenSec: kendiProfili ? ICRAAT_REGEN_SEC : null,
          icraatSaatlikBonus: kendiProfili ? ICRAAT_SAATLIK_BONUS : null,
          aciklama: p.profil_aciklama || "",
          dostlar: p.dostlar || "",
          dusmanlar: p.dusmanlar || "",
          profilResmi: p.profil_resmi || "",
          sehirEfsane: !!(p.sehir_efsane),
          karaListede: !!(p.kara_listede),
          kayitTarihi,
          ziyaretler: ziyaretler.map((x) => x.reis_adi),
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
        const dostlar = String(body.dostlar || "").slice(0, 180);
        const dusmanlar = String(body.dusmanlar || "").slice(0, 180);
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
      res.json({ ok: true, player: await publicPlayerFull(db, req.user.id, player) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Profil kaydedilemedi." });
    }
  });

  router.post("/action", createActionGuard(db), async (req, res) => {
    const body = req.body || {};
    const { action, key, adet, ...extra } = body;
    if (!action) {
      return res.status(400).json({ ok: false, error: "Aksiyon belirtilmedi." });
    }
    try {
      const result = await performAction(db, req.user.id, action, key, adet, {
        ...extra,
        _securityMeta: req.clientMeta || {},
      });
      if (!result.ok) return res.status(400).json(result);
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
      console.error(err);
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
      const profil = await grupProfil(db, grupId);
      if (!profil) return res.status(404).json({ ok: false, error: "Grup bulunamadı." });

      res.json({ ok: true, grup: profil });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Grup bilgileri yüklenemedi." });
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

  return router;
}

module.exports = { createGameRouter };
