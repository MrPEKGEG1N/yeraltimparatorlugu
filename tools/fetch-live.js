const https = require("https");
https
  .get("https://yeralti-game.onrender.com/api/leaderboard", (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => console.log(d));
  })
  .on("error", (e) => console.error(e.message));
