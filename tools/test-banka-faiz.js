/**
 * Banka faiz mantığı smoke test.
 * node tools/test-banka-faiz.js
 */
const assert = require("assert");
const { dayKeyCmp, FAIZ_ORAN } = require("../game/bankaService");
const { PREMIUM_PAKETLER } = require("../game/premiumService");

assert.strictEqual(dayKeyCmp("2026-07-17", "2026-07-18"), -1);
assert.strictEqual(dayKeyCmp("2026-07-18", "2026-07-17"), 1);
assert.strictEqual(dayKeyCmp("2026-07-18", "2026-07-18"), 0);

assert.strictEqual(PREMIUM_PAKETLER.tetikci.faizOran, 0.005);
assert.strictEqual(PREMIUM_PAKETLER.racon.faizOran, 0.01);
assert.strictEqual(PREMIUM_PAKETLER.baron.faizOran, 0.015);
assert.strictEqual(FAIZ_ORAN, 0.005);

assert.strictEqual(Math.floor(1_000_000 * 0.005), 5000);
assert.strictEqual(Math.floor(1_000_000 * 0.01), 10000);
assert.strictEqual(Math.floor(1_000_000 * 0.015), 15000);

console.log("PASS banka faiz oranları + dayKeyCmp");
process.exit(0);
