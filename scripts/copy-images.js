const fs = require("fs");
const path = require("path");

const src = "C:\\Users\\ahlas\\OneDrive\\Desktop\\koyulacak resimler";
const root = path.join(__dirname, "..", "public", "images");

function findFile(pred) {
  const names = fs.readdirSync(src);
  const hit = names.find(pred);
  return hit ? path.join(src, hit) : null;
}

function copy(srcFile, destRel) {
  if (!srcFile) {
    console.log("MISS", destRel);
    return;
  }
  const dest = path.join(root, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcFile, dest);
  console.log("OK", destRel);
}

const pairs = [
  [() => findFile((n) => /motorsik/i.test(n)), "luks/motorsiklet.png"],
  [() => findFile((n) => /ehirleraras/i.test(n) && /paket/i.test(n)), "mekan/sehir_teslimat.png"],
  [() => findFile((n) => /lke/i.test(n) && /paket/i.test(n)), "mekan/ulke_teslimat.png"],
  [() => findFile((n) => /uluslararas/i.test(n) && /paket/i.test(n)), "mekan/ulus_teslimat.png"],
  [() => findFile((n) => /Lüks Yat|Süper.*Yat/i.test(n)), "luks/yat.png"],
  [() => findFile((n) => /Gümrük/i.test(n)), "is/gumruk.png"],
  [() => findFile((n) => /Lojistik/i.test(n)), "is/lojistik.png"],
  [() => findFile((n) => /Kaçak.*Sekt/i.test(n)), "mekan/kacakcilik.png"],
  [() => findFile((n) => /Sokak Aras/i.test(n)), "mekan/sokak_arasi.png"],
  [() => findFile((n) => /ehirler Aras.*Sekt/i.test(n)), "mekan/sehirler_arasi.png"],
  [() => findFile((n) => /Uluslararas.*Sekt/i.test(n)), "mekan/uluslararasi.png"],
  [() => findFile((n) => /Atom/i.test(n)), "mekan/atom.png"],
  [() => findFile((n) => /mahalle.*teslimat/i.test(n)), "mekan/mahalle_teslimat.png"],
  [() => findFile((n) => /ehirleraras.*teslimat/i.test(n)), "mekan/sehir_teslimat.png"],
  [() => findFile((n) => /lke.*ap.*teslimat/i.test(n)), "mekan/ulke_teslimat.png"],
  [() => findFile((n) => /uluslararas.*teslimat/i.test(n) && /paket/i.test(n)), "mekan/ulus_teslimat.png"],
  [() => findFile((n) => /darphane/i.test(n)), "mafya/darphane.png"],
  [() => findFile((n) => /^ev([5-9]|10)\.png$/i.test(n)), null],
];

pairs.forEach(([fn, dest]) => {
  if (!dest) {
    for (let i = 5; i <= 10; i++) {
      const f = findFile((n) => n.toLowerCase() === `ev${i}.png`);
      copy(f, `mafya/ev${i}.png`);
    }
    return;
  }
  copy(fn(), dest);
});
