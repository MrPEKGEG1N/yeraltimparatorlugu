const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      })
      .on("error", reject);
  });
}

(async () => {
  const js = await get("https://yeralti-game.onrender.com/admin/admin.js?v=19");
  console.log("admin.js status", js.status, "len", js.data.length);
  console.log("has45s", js.data.includes("timeoutMs: 45000"));
  console.log("hasTryCatch", js.data.includes("oyuncuDetayYukle\", renderErr"));

  const detail = await get("https://yeralti-game.onrender.com/api/admin/oyuncular/2");
  console.log("detail status", detail.status, detail.data.slice(0, 200));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
