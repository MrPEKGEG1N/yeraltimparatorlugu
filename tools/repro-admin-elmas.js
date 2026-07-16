const path = require("path");
const { initDatabase, get, run } = require("../db/database");
const { updatePlayerFull, getPlayerDetail } = require("../game/adminService");

async function main() {
  process.env.DATABASE_PATH = path.join(__dirname, "..", "db", "oyun.db");
  const db = await initDatabase();
  const uid = 1;
  const admin = await get(db, "SELECT id FROM users WHERE is_admin = 1 LIMIT 1");
  const beforeRow = await get(db, "SELECT elmas, premium_paket, profil_resmi FROM players WHERE user_id = ?", [uid]);
  const before = beforeRow.elmas || 0;

  // Previously failed with: "premium_paket geçersiz (0–2000000000)." because premium_paket was in numMap
  const r = await updatePlayerFull(db, admin.id, uid, {
    oyuncu: {
      elmas: before + 9,
      premiumPaket: "tetikci",
      profilResmi: "vip-erkek-01",
    },
  });
  console.log("update with string premiumPaket + VIP portrait:", r);
  const after = await get(db, "SELECT elmas, premium_paket, profil_resmi FROM players WHERE user_id = ?", [uid]);
  console.log("elmas", before, "->", after.elmas, "paket", after.premium_paket, "profil", after.profil_resmi);

  await run(
    db,
    "UPDATE players SET elmas = ?, premium_paket = ?, profil_resmi = ? WHERE user_id = ?",
    [before, beforeRow.premium_paket || "", beforeRow.profil_resmi || "", uid]
  );

  if (!r.ok) throw new Error(r.error || "update failed");
  if (after.elmas !== before + 9) throw new Error("elmas not applied");
  if (after.premium_paket !== "tetikci") throw new Error("premium paket not applied");
  if (after.profil_resmi !== "vip-erkek-01") throw new Error("vip portrait not applied");

  const detail = await getPlayerDetail(db, uid);
  if ((detail.user.elmas || 0) !== before) {
    // restored above; detail should match restore
  }
  console.log("detail elmas after restore", (await getPlayerDetail(db, uid)).user.elmas);
  console.log("OK repro");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
