#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { initDatabase, run } = require("../db/database");
const { vipPortreEquipKontrol, getVipPortreDurum } = require("../game/vipPortreService");
const { premiumSatinAl } = require("../game/premiumService");

const TEST_DB = path.join(__dirname, ".vip-portre-test.db");

async function main() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  process.env.DATABASE_PATH = TEST_DB;
  process.env.NODE_ENV = "test";

  const db = await initDatabase();
  const uid = 9101;
  await run(
    db,
    `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi) VALUES (?, 'vipt', 'x', 'VipT')`,
    [uid]
  );
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas, profil_resmi)
     VALUES (?, 100000, 1000, 100, 10, 100, 5000, 'erkek-01')`,
    [uid]
  );

  let r = await vipPortreEquipKontrol(db, uid, "vip-erkek-01");
  if (r.ok) throw new Error("locked vip should fail");

  const buy = await premiumSatinAl(db, uid, "tetikci");
  if (!buy.ok) throw new Error(buy.error);

  // Tetikçi: sadece operasyon açık — elmas koleksiyonu kilitli kalmalı
  r = await vipPortreEquipKontrol(db, uid, "vip-erkek-01");
  if (r.ok) throw new Error("tetikci should NOT unlock elmas collection");

  r = await vipPortreEquipKontrol(db, uid, "vip-erkek-mafya-01");
  if (r.ok) throw new Error("tetikci should NOT unlock mafya collection");

  r = await vipPortreEquipKontrol(db, uid, "vip-erkek-operasyon-01");
  if (!r.ok) throw new Error("tetikci should unlock operasyon: " + r.error);

  r = await vipPortreEquipKontrol(db, uid, "vip-erkek-operasyon-02", { kaliciSec: true });
  if (!r.ok) throw new Error("gift claim fail " + r.error);

  await run(db, `UPDATE players SET profil_resmi = ? WHERE user_id = ?`, [
    "vip-erkek-operasyon-02",
    uid,
  ]);

  let d = await getVipPortreDurum(db, uid);
  if (!d.sahip.includes("vip-erkek-operasyon-02")) throw new Error("not owned");
  if (d.hediye.tetikci !== 0) throw new Error("gift credit not consumed: " + d.hediye.tetikci);

  // Uzatma: yeni kalıcı resim hakkı verilmeli
  await run(db, `UPDATE players SET elmas = 5000 WHERE user_id = ?`, [uid]);
  const extend = await premiumSatinAl(db, uid, "tetikci");
  if (!extend.ok) throw new Error("extend failed: " + extend.error);
  d = await getVipPortreDurum(db, uid);
  if (d.hediye.tetikci !== 1) throw new Error("extend should grant +1 gift, got " + d.hediye.tetikci);

  r = await vipPortreEquipKontrol(db, uid, "vip-erkek-operasyon-03", { kaliciSec: true });
  if (!r.ok) throw new Error("extend gift claim fail " + r.error);
  d = await getVipPortreDurum(db, uid);
  if (!d.sahip.includes("vip-erkek-operasyon-03")) throw new Error("extend portrait not owned");
  if (d.hediye.tetikci !== 0) throw new Error("extend gift not consumed");

  // Racon: operasyon + mafya
  await run(db, `UPDATE players SET elmas = 5000 WHERE user_id = ?`, [uid]);
  const buyR = await premiumSatinAl(db, uid, "racon");
  if (!buyR.ok) throw new Error(buyR.error);
  r = await vipPortreEquipKontrol(db, uid, "vip-erkek-mafya-01");
  if (!r.ok) throw new Error("racon should unlock mafya: " + r.error);
  r = await vipPortreEquipKontrol(db, uid, "vip-erkek-01");
  if (r.ok) throw new Error("racon should NOT unlock elmas collection");

  await run(db, `UPDATE players SET premium_paket_bitis = 1 WHERE user_id = ?`, [uid]);
  d = await getVipPortreDurum(db, uid);
  if (d.premiumAktif) throw new Error("should expire");
  if (d.profilResmi !== "vip-erkek-operasyon-02") {
    throw new Error("permanent should remain got " + d.profilResmi);
  }

  await run(
    db,
    `UPDATE players SET premium_paket='tetikci', premium_paket_bitis=9999999999, profil_resmi='vip-erkek-01' WHERE user_id=?`,
    [uid]
  );
  d = await getVipPortreDurum(db, uid);
  if (d.profilResmi === "vip-erkek-01") {
    throw new Error("tetikci should reset non-operasyon temp vip");
  }

  console.log("OK vip portre tests", d.profilResmi);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
