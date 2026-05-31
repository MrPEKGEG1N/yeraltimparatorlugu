const { run, get, all } = require("../db/database");

const ELEMAN_MALIYET = 50000;
const ELEMAN_GUC = 100;

async function getIstihbarat(db, userId) {
  const row = await get(db, `SELECT eleman_sayisi FROM istihbarat WHERE user_id = ?`, [userId]);
  return row ? row.eleman_sayisi : 0;
}

async function elemanAl(db, userId, player, adet) {
  const miktar = Math.min(100, Math.max(1, parseInt(adet, 10) || 1));
  const toplamMaliyet = ELEMAN_MALIYET * miktar;
  
  if (player.kasa < toplamMaliyet) {
    return { ok: false, error: `Kasanda yeterli nakit yok! ${miktar} eleman için ${toplamMaliyet.toLocaleString("tr-TR")} TL gerekir.` };
  }
  
  player.kasa -= toplamMaliyet;
  const mevcut = await getIstihbarat(db, userId);
  const yeni = mevcut + miktar;
  
  await run(db, `INSERT OR REPLACE INTO istihbarat (user_id, eleman_sayisi) VALUES (?, ?)`, [userId, yeni]);
  await run(db, `UPDATE players SET kasa = ? WHERE user_id = ?`, [player.kasa, userId]);
  
  return { ok: true, elemanSayisi: yeni, odenen: toplamMaliyet };
}

async function oyuncuGucunuOgren(db, userId, hedefAdi) {
  const benimIstihbarat = await getIstihbarat(db, userId);
  if (benimIstihbarat === 0) {
    return { ok: false, error: "İstihbarat elemanın yok. Önce eleman al." };
  }
  
  const hedef = await get(
    db,
    `SELECT u.id, u.reis_adi, p.guc, (SELECT eleman_sayisi FROM istihbarat WHERE user_id = u.id) as hedef_istihbarat
     FROM users u
     JOIN players p ON p.user_id = u.id
     WHERE LOWER(u.reis_adi) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
    [hedefAdi.trim(), hedefAdi.trim()]
  );
  
  if (!hedef) {
    return { ok: false, error: "Bu isimde oyuncu bulunamadı." };
  }
  
  const hedefIstihbarat = hedef.hedef_istihbarat || 0;
  
  // Intelligence comparison system
  if (benimIstihbarat > hedefIstihbarat) {
    return {
      ok: true,
      oyuncuAdi: hedef.reis_adi,
      guc: hedef.guc,
      basari: true,
      mesaj: "İstihbaratın daha güçlü, rakibin gücünü öğrendin!"
    };
  } else if (benimIstihbarat < hedefIstihbarat) {
    return {
      ok: true,
      oyuncuAdi: hedef.reis_adi,
      guc: null,
      basari: false,
      mesaj: "Rakibin istihbaratı daha güçlü, bilgi alamadın!"
    };
  } else {
    return {
      ok: true,
      oyuncuAdi: hedef.reis_adi,
      guc: Math.floor(hedef.guc * 0.5), // Partial info when equal
      basari: true,
      mesaj: "İstihbarat eşit, kısmi bilgi aldın."
    };
  }
}

module.exports = {
  ELEMAN_MALIYET,
  ELEMAN_GUC,
  getIstihbarat,
  elemanAl,
  oyuncuGucunuOgren,
};
