#!/usr/bin/env node
const { initDatabase, get } = require("../db/database");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const http = require("http");

async function fetchGazete(cookie) {
  return new Promise((resolve) => {
    http
      .get({ hostname: "localhost", port: 3000, path: "/api/gazete", headers: { Cookie: cookie } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve({ status: r.statusCode, body: d }));
      })
      .on("error", (e) => resolve({ status: 0, body: e.message }));
  });
}

(async () => {
  const db = await initDatabase();
  const u = await get(db, "SELECT id, username, reis_adi, token_version FROM users WHERE id = 2");
  const token = jwt.sign(
    { userId: u.id, username: u.username, reisAdi: u.reis_adi, tv: u.token_version || 0 },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  const cookie = `yeralti_token=${token}`;
  const results = await Promise.all(Array.from({ length: 20 }, () => fetchGazete(cookie)));
  const ok = results.filter((r) => r.status === 200 && r.body.includes('"ok":true')).length;
  const fail = results.length - ok;
  console.log("concurrent:", { ok, fail });
  if (fail) results.filter((r) => r.status !== 200 || !r.body.includes('"ok":true')).forEach((r) => console.log(r));
  process.exit(fail ? 1 : 0);
})();
