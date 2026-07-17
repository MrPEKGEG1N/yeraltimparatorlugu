/**
 * Smoke: bildirim türleri allowlist + exportlar.
 * Çalıştır: node tools/test-bildirim-types.js
 */
const b = require("../game/bildirimService");

const required = [
  "mafya_davet",
  "zam_onay",
  "zam_red",
  "sirket_kapandi",
  "kumarhane_pvp",
  "ozel_mesaj",
  "saldiri",
  "gazete",
];

let ok = true;
for (const t of required) {
  if (!b.BILDIRIM_TURLERI[t]) {
    console.error("EKSİK tür:", t);
    ok = false;
  }
}
if (typeof b.fcmTokenKaydet !== "function" || typeof b.fcmTokenSil !== "function") {
  console.error("FCM API export eksik");
  ok = false;
}
if (typeof b.bildirimGonder !== "function") {
  console.error("bildirimGonder eksik");
  ok = false;
}

console.log(ok ? "PASS bildirim türleri + FCM export" : "FAIL");
process.exit(ok ? 0 : 1);
