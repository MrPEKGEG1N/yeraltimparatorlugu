/** @type {import('@capacitor/cli').CapacitorConfig} */
const PRODUCTION_SERVER_URL =
  process.env.PUBLIC_BASE_URL ||
  process.env.CAPACITOR_SERVER_URL ||
  "https://yeraltimparatorlugu-production.up.railway.app";
const serverUrl = process.env.CAPACITOR_SERVER_URL || PRODUCTION_SERVER_URL;
// Mobil APK: oyun sunucudan yuklenir, APK icine tum public klasoru gomulmez (kucuk dosya)
const webDir = process.env.CAPACITOR_MOBILE_SHELL ? "capacitor-shell" : "public";

const config = {
  appId: "com.yeralti.imparatorlugu",
  appName: "Yeraltı İmparatorluğu",
  webDir,
  android: {
    allowMixedContent: false,
    backgroundColor: "#0a0604",
  },
  server: {
    url: serverUrl,
    androidScheme: "https",
    cleartext: serverUrl.startsWith("http://"),
  },
};

module.exports = config;
