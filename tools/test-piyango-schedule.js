/** Piyango çekiliş takvimi ve teselli ödül testi */
const {
  sonrakiCekilisZamani,
  sonSayilariEslesme,
  teselliHakHesapla,
  CEKILIS_GUNLER,
  TESELLI_SON_3_HAK,
  TESELLI_SON_2_HAK,
} = require("../game/kumarhanePiyangoService");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Pazartesi 2026-06-22 10:00 Istanbul -> sonraki çekiliş aynı gün 20:30
const pztSabah = new Date("2026-06-22T07:00:00.000Z");
const sonraki = sonrakiCekilisZamani(pztSabah);
assert(sonraki.donem === "2026-06-22T2030", `Pzt sabah: ${sonraki.donem}`);

// Salı -> Çarşamba 20:30
const sali = new Date("2026-06-23T10:00:00.000Z");
const carsamba = sonrakiCekilisZamani(sali);
assert(carsamba.donem === "2026-06-24T2030", `Salı: ${carsamba.donem}`);

const cekilis = [3, 7, 12, 15, 20, 24];
assert(sonSayilariEslesme([1, 15, 20, 24, 5, 9], cekilis, 3), "son 3 eşleşme");
assert(sonSayilariEslesme([1, 20, 24, 5, 9, 11], cekilis, 2), "son 2 eşleşme");
assert(!sonSayilariEslesme([1, 2, 3, 4, 5, 6], cekilis, 2), "eşleşme yok");
assert(teselliHakHesapla([1, 15, 20, 24, 5, 9], cekilis) === TESELLI_SON_3_HAK, "teselli 3");
assert(teselliHakHesapla([1, 20, 24, 5, 9, 11], cekilis) === TESELLI_SON_2_HAK, "teselli 2");

console.log("OK piyango schedule + teselli");
