const fs = require("fs");
const vm = require("vm");
const g = { window: {} };
const src =
  fs.readFileSync("public/i18n/languages.js", "utf8") +
  fs.readFileSync("public/i18n/locales.js", "utf8").replace(/\(window\)/g, "(global.window)");
vm.runInNewContext(src, { global: g, window: g.window });
const locales = g.window.I18N_LOCALES;
console.log("menu.buyume tr:", JSON.stringify(locales.tr["menu.buyume"]));
console.log("menu.gunlukGorevler tr:", JSON.stringify(locales.tr["menu.gunlukGorevler"]));
