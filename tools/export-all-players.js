#!/usr/bin/env node
/**
 * Export every user in the local DB to seed/oyuncular/{username}.json
 * in deploy-restore format (dd1.json style).
 */
const fs = require("fs");
const path = require("path");
const { initDatabase, all } = require("../db/database");
const { exportPlayerSnapshot } = require("../game/adminService");

const OUT_DIR = path.join(process.cwd(), "seed", "oyuncular");

function mapToSeedSnapshot(full) {
  const k = full.kullanici || {};
  const st = full.istatistikler || {};
  const gy = full.guvenliYer || {};

  const snap = {
    id: k.username || String(full.oyuncuId || ""),
    username: k.username,
    reis_adi: k.reisAdi || k.username,
    lakap: k.lakap || "Mafya",
    force_restore: true,
    player: {
      kasa: st.kasa,
      guc: st.guc,
      puan: st.puan,
      icraat: st.icraat,
      sms_hakki: st.smsHakki,
    },
    guvenli_yer: {
      base_seviye: gy.baseSeviye != null ? gy.baseSeviye : 1,
    },
    istihbarat: {
      eleman_sayisi: full.istihbaratEleman != null ? full.istihbaratEleman : 0,
    },
    mekanlar: (full.mekanlar || []).map((m) => ({
      sektor: m.sektor,
      mekan_key: m.mekanKey || m.mekan_key,
      adet: m.adet != null ? m.adet : 0,
    })),
  };

  if (k.sonIp) snap.son_ip = k.sonIp;
  if (k.visitorId) snap.visitor_id = k.visitorId;
  if (k.userAgent) snap.user_agent = k.userAgent;

  return snap;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const db = await initDatabase();
  const users = await all(db, `SELECT id, username FROM users ORDER BY id`);
  const written = [];

  for (const u of users) {
    const full = await exportPlayerSnapshot(db, u.id);
    if (!full) {
      console.warn(`[export] atlandi (detay yok): ${u.username} (#${u.id})`);
      continue;
    }
    const snap = mapToSeedSnapshot(full);
    const file = path.join(OUT_DIR, `${u.username}.json`);
    fs.writeFileSync(file, JSON.stringify(snap, null, 2) + "\n", "utf8");
    written.push(file);
    console.log(`[export] ${u.username} -> ${path.relative(process.cwd(), file)}`);
  }

  console.log(`[export] ${written.length} oyuncu yazildi.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
