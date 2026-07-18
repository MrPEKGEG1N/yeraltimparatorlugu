#!/usr/bin/env node
const path = require("path");
const fs = require("fs");

const TEST_DB = path.join(__dirname, ".vip-portre-satin-test.db");
for (const f of [TEST_DB, TEST_DB + "-shm", TEST_DB + "-wal"]) {
  try {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch (_) {}
}
process.env.DATABASE_PATH = TEST_DB;
process.env.NODE_ENV = "test";

const { initDatabase, run, get } = require("../db/database");
const {
  vipPortreTekilSatinAl,
  vipPortreKoleksiyonSatinAl,
  getVipPortreDurum,
} = require("../game/vipPortreService");

async function main() {
  const db = await initDatabase();
  const uid = 9301;
  await run(
    db,
    `INSERT OR REPLACE INTO users (id, username, password_hash, reis_adi) VALUES (?, 'vipbuy', 'x', 'VipBuy')`,
    [uid]
  );
  await run(
    db,
    `INSERT OR REPLACE INTO players (user_id, kasa, puan, guc, icraat, devlet_iliskisi, elmas, profil_resmi)
     VALUES (?, 100000, 1000, 100, 10, 100, 5000, 'erkek-01')`,
    [uid]
  );

  let r = await vipPortreTekilSatinAl(db, uid, "vip-erkek-01");
  if (!r.ok) throw new Error("tekil fail: " + r.error);
  if (r.maliyet !== 150) throw new Error("tekil maliyet " + r.maliyet);
  let row = await get(db, `SELECT elmas, vip_portre_sahip FROM players WHERE user_id = ?`, [uid]);
  if (row.elmas !== 4850) throw new Error("elmas after tekil " + row.elmas);
  if (!JSON.parse(row.vip_portre_sahip).includes("vip-erkek-01")) throw new Error("sahip yok");
  console.log("OK tekil 150");

  r = await vipPortreKoleksiyonSatinAl(db, uid, "mafya", "erkek");
  if (!r.ok) throw new Error("koleksiyon fail: " + r.error);
  if (r.maliyet !== 350) throw new Error("mafya maliyet " + r.maliyet);
  row = await get(db, `SELECT elmas, vip_portre_sahip FROM players WHERE user_id = ?`, [uid]);
  if (row.elmas !== 4500) throw new Error("elmas after mafya " + row.elmas);
  const sahip = JSON.parse(row.vip_portre_sahip);
  if (!sahip.includes("vip-erkek-mafya-01") || !sahip.includes("vip-erkek-mafya-03")) {
    throw new Error("mafya portreler eksik");
  }
  console.log("OK mafya koleksiyon 350");

  r = await vipPortreKoleksiyonSatinAl(db, uid, "mafya", "erkek");
  if (!r.ok || !r.zaten) throw new Error("zaten sahip olmali");
  row = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [uid]);
  if (row.elmas !== 4500) throw new Error("ikinci alimda elmas dustu");
  console.log("OK zaten sahip");

  r = await vipPortreKoleksiyonSatinAl(db, uid, "elmas", "erkek");
  if (!r.ok) throw new Error("elmas kol fail: " + r.error);
  if (r.maliyet !== 1200) throw new Error("elmas kol maliyet " + r.maliyet);
  // vip-erkek-01 zaten vardi; yine 1200 odemeli, eksikler eklenir
  row = await get(db, `SELECT elmas FROM players WHERE user_id = ?`, [uid]);
  if (row.elmas !== 3300) throw new Error("elmas after elmas-kol " + row.elmas);
  const d = await getVipPortreDurum(db, uid);
  if (!d.sahip.includes("vip-erkek-12")) throw new Error("elmas 12 yok");
  console.log("OK elmas koleksiyon 1200");
  console.log("ALL PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
