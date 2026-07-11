/** dd1 snapshot dogrulama — yerel DB veya canli admin */
const https = require("https");
const path = require("path");
const { initDatabase, get, all, DB_PATH } = require("../db/database");

const EXPECT = {
  username: "dd1",
  kasa: 580784000,
  guc: 86296950,
  bonusGucMin: 7777000,
  puan: 159850,
  icraat: 250,
  sms: 349,
  mekanToplam: 88,
  guvenliYer: 15,
  istihbarat: 2,
};

function httpJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : require("http");
    const req = lib.request(url, opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function verifyLocal() {
  const db = await initDatabase();
  const u = await get(
    db,
    `SELECT u.id, u.username, p.kasa, p.guc, p.puan, p.icraat, p.sms_hakki,
            COALESCE(p.bonus_guc,0) AS bonus_guc,
            COALESCE(ub.base_seviye,1) AS gy,
            COALESCE(i.eleman_sayisi,0) AS ist
     FROM users u
     JOIN players p ON p.user_id = u.id
     LEFT JOIN user_base ub ON ub.user_id = u.id
     LEFT JOIN istihbarat i ON i.user_id = u.id
     WHERE u.username = ?`,
    [EXPECT.username]
  );
  if (!u) {
    console.error("LOCAL: dd1 bulunamadi");
    process.exit(1);
  }
  const mekan = await get(
    db,
    `SELECT COALESCE(SUM(adet),0) AS t FROM sektor_sahiplik WHERE user_id = ?`,
    [u.id]
  );
  const row = {
    kasa: u.kasa,
    guc: u.guc,
    bonus_guc: u.bonus_guc,
    toplamGuc: u.guc + u.bonus_guc,
    puan: u.puan,
    icraat: u.icraat,
    sms: u.sms_hakki,
    mekanToplam: mekan?.t || 0,
    guvenliYer: u.gy,
    istihbarat: u.ist,
  };
  console.log("LOCAL dd1:", JSON.stringify(row, null, 2));
  console.log("DB:", DB_PATH);
  const ok =
    row.kasa === EXPECT.kasa &&
    row.puan === EXPECT.puan &&
    row.icraat === EXPECT.icraat &&
    row.sms === EXPECT.sms &&
    row.mekanToplam === EXPECT.mekanToplam &&
    row.guvenliYer === EXPECT.guvenliYer &&
    row.istihbarat === EXPECT.istihbarat &&
    row.toplamGuc === EXPECT.guc + EXPECT.bonusGucMin;
  return ok;
}

async function verifyLiveHealth() {
  const base = process.env.LIVE_URL || process.env.PUBLIC_BASE_URL || "https://yeraltimparatorlugu-production.up.railway.app";
  const r = await httpJson(`${base}/api/health`);
  console.log("LIVE health:", r.status, r.body);
  return r.status === 200 && r.body?.ok;
}

async function main() {
  const localOk = await verifyLocal();
  console.log(localOk ? "LOCAL OK" : "LOCAL MISMATCH");
  if (process.argv.includes("--live")) {
    const liveOk = await verifyLiveHealth();
    console.log(liveOk ? "LIVE health OK" : "LIVE health FAIL");
  }
  process.exit(localOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
