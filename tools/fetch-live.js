const https = require("https");
https
  .get("https://yeraltimparatorlugu-production.up.railway.app/api/leaderboard", (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => console.log(d));
  })
  .on("error", (e) => console.error(e.message));
