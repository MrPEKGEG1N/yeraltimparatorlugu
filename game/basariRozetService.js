const { run, get, all } = require("../db/database");
const { istanbulGunKey, gunKeyEkle } = require("./turkiyeSaati");

const YILLIK_GUN = 365;
const ON_MILYON = 10_000_000;

/**
 * goal: tooltip "Artış" metni
 * unlockMin: rozetin açılması için minimum güncel değer
 * step: canlı ham sayı * step = gösterilen güncel (opsiyonel)
 */
const BASARI_ROZETLER = [
  // Savaş ve Operasyon
  { id: "war_victor", name: "Mafya Grubu Savaşı Kazandı", icon: "war_win.png", goal: "+1", unlockMin: 1, kategori: "savas" },
  { id: "war_defeat", name: "Mafya Grubu Savaşı Kaybetti", icon: "broken_shield.png", goal: "+1", unlockMin: 1, kategori: "savas" },
  { id: "mafia_job", name: "Mafya Grubu İşi Yaptı", icon: "briefcase.png", goal: "+10", unlockMin: 10, step: 10, kategori: "savas" },
  { id: "saboteur", name: "Sabotaj Yaptı", icon: "dynamite.png", goal: "+1", unlockMin: 1, kategori: "savas" },
  { id: "sabotaged", name: "Sabotaj Yedi", icon: "broken_gear.png", goal: "+1", unlockMin: 1, kategori: "savas" },
  { id: "enemy_crush", name: "Düşmana Çöktü", icon: "city_collapse.png", goal: "+100", unlockMin: 100, kategori: "savas" },
  { id: "spy_intel", name: "İstihbarat Bilgisini Aldı", icon: "spy_glass.png", goal: "+10", unlockMin: 10, kategori: "savas" },
  // Ekonomi ve Kariyer
  { id: "lottery_winner", name: "Piyango Kazanan", icon: "lottery_6.png", goal: "+1", unlockMin: 1, kategori: "ekonomi" },
  { id: "company_founder", name: "Kendi Şirketini Kurdu", icon: "skyscraper.png", goal: "+1", unlockMin: 1, kategori: "ekonomi" },
  { id: "npc_worker", name: "NPC İşinde Çalıştı", icon: "tools.png", goal: "+1", unlockMin: 1, kategori: "ekonomi" },
  { id: "stock_trader", name: "Borsada +10M Kazandı", icon: "stock_chart.png", goal: "+10M", unlockMin: ON_MILYON, kategori: "ekonomi", format: "money" },
  { id: "casino_player", name: "Kumarhanede +10M Kazandı", icon: "casino_dice.png", goal: "+10M", unlockMin: ON_MILYON, kategori: "ekonomi", format: "money" },
  // Sosyal ve Adalet
  { id: "daily_quest", name: "Günlük Görev Uzmanı", icon: "daily_calendar.png", goal: "+7", unlockMin: 7, kategori: "sosyal" },
  { id: "yearly_player", name: "Senedir Oynayan", icon: "hourglass_snake.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "mafia_chat", name: "Mafya Sohbetleri +500 SMS", icon: "chat_bubble.png", goal: "+500", unlockMin: 500, kategori: "sosyal" },
  { id: "press_baron", name: "Medyada 10 Haber Yayınladı", icon: "newspaper_press.png", goal: "+10", unlockMin: 10, kategori: "sosyal" },
  { id: "blacklist_king", name: "Kara Liste", icon: "blacklist.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "lawyer_briber", name: "Avukata Rüşvet", icon: "lawyer_gavel.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "jailed", name: "Hapishaneye Düştü", icon: "prison_bars.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "prison_bribe", name: "Hapishaneden Rüşvetle Kurtuldu", icon: "prison_door.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "prison_rescue", name: "Hapishaneden Başka Birini Kurtardı", icon: "cash_handshake.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "mafia_member", name: "Mafya Grubu Üyesi", icon: "handshake.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "mafia_leader", name: "Mafya Lideri", icon: "king_chess.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "rule_city", name: "Şehre Hükmet", icon: "roman_eagle.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
  { id: "nightmare", name: "Şehrin Yeni Kabusu", icon: "nightmare.png", goal: "+1", unlockMin: 1, kategori: "sosyal" },
];

const BASARI_KATEGORILER = [
  {
    id: "sosyal",
    name: "Sosyal ve Adalet Rozetleri",
    nameKey: "game.profil.achievementCatSocial",
  },
  {
    id: "savas",
    name: "Savaş ve Operasyon Rozetleri",
    nameKey: "game.profil.achievementCatWar",
  },
  {
    id: "ekonomi",
    name: "Ekonomi ve Kariyer Rozetleri",
    nameKey: "game.profil.achievementCatEconomy",
  },
];

const BASARI_ID_SET = new Set(BASARI_ROZETLER.map((x) => x.id));
const BASARI_BY_ID = Object.fromEntries(BASARI_ROZETLER.map((x) => [x.id, x]));

/** Eski id → yeni id (kalıcı sayaç taşınır) */
const BASARI_ID_MIGRATE = {
  fallen_reign: "enemy_crush",
  prison_break: "prison_bribe",
  chatter: "mafia_chat",
  company_worker: "mafia_job",
};

async function ensureBasariColumns(db) {
  for (const [col, def] of [
    ["basari_rozet_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["basari_login_meta", "TEXT NOT NULL DEFAULT '{}'"],
  ]) {
    try {
      await run(db, `ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (_) {}
  }
}

function parseJson(raw, fallback) {
  try {
    const v = JSON.parse(raw || "");
    return v != null ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

function toCount(n) {
  const v = Math.floor(Number(n) || 0);
  return v > 0 ? v : 0;
}

function normalizeCounts(raw) {
  const parsed = parseJson(raw, {});
  const out = {};
  if (Array.isArray(parsed)) {
    for (const id of parsed) {
      let k = String(id || "").trim();
      k = BASARI_ID_MIGRATE[k] || k;
      if (BASARI_ID_SET.has(k)) out[k] = Math.max(out[k] || 0, 1);
    }
    return out;
  }
  if (parsed && typeof parsed === "object") {
    for (const [id, val] of Object.entries(parsed)) {
      const k = BASARI_ID_MIGRATE[id] || id;
      if (!BASARI_ID_SET.has(k)) continue;
      out[k] = Math.max(toCount(out[k]), toCount(val));
    }
  }
  return out;
}

function iconUrl(icon) {
  return `images/profil/rozet/basari/${icon}`;
}

async function safeCount(db, sql, params = []) {
  const row = await get(db, sql, params).catch(() => null);
  return toCount(row?.n);
}

async function safeSum(db, sql, params = []) {
  const row = await get(db, sql, params).catch(() => null);
  const v = Math.floor(Number(row?.n) || 0);
  return v > 0 ? v : 0;
}

async function kabusSayisi(db, userId) {
  const rows = await all(
    db,
    `SELECT deger FROM sistem_gunluk WHERE anahtar LIKE 'gazete_kabus_%'`
  ).catch(() => []);
  let n = 0;
  for (const row of rows || []) {
    const kayit = parseJson(row.deger, null);
    if (kayit && String(kayit.userId) === String(userId)) n += 1;
  }
  return n;
}

async function piyangoKazanimSayisi(db, userId) {
  return safeCount(
    db,
    `SELECT COUNT(*) AS n FROM kumarhane_piyango_bilet
     WHERE user_id = ? AND (odul > 0 OR eslesme >= 6)`,
    [userId]
  );
}

async function sehreHukmetSayisi(db, userId) {
  const { sehreHukmediyorMu } = require("./karaListeService");
  const row = await get(
    db,
    `SELECT sehre_hukmet_sayisi FROM players WHERE user_id = ?`,
    [userId]
  ).catch(() => null);
  let n = toCount(row?.sehre_hukmet_sayisi);
  if (n <= 0 && (await sehreHukmediyorMu(db, userId))) n = 1;
  return n;
}

async function yilSayisi(db, userId) {
  const row = await get(db, `SELECT created_at FROM users WHERE id = ?`, [userId]);
  const created = Number(row?.created_at) || 0;
  if (!created) return 0;
  const now = Math.floor(Date.now() / 1000);
  return Math.floor(Math.floor((now - created) / 86400) / YILLIK_GUN);
}

async function npcCalismaSayisi(db, userId) {
  return (await get(db, `SELECT 1 AS ok FROM oyuncu_meslek WHERE user_id = ? LIMIT 1`, [userId]).catch(
    () => null
  ))
    ? 1
    : 0;
}

async function sirketKurmaSayisi(db, userId) {
  return safeCount(db, `SELECT COUNT(*) AS n FROM oyuncu_sirketleri WHERE sahip_user_id = ?`, [
    userId,
  ]);
}

async function mafyaDurumu(db, userId) {
  const row = await get(
    db,
    `SELECT g.lider_user_id, m.rutbe
     FROM mafya_uyeleri m
     JOIN mafya_gruplari g ON g.id = m.grup_id
     WHERE m.user_id = ?`,
    [userId]
  ).catch(() => null);
  if (!row) return { uye: 0, lider: 0 };
  const lider =
    String(row.lider_user_id) === String(userId) ||
    String(row.rutbe || "") === "Mafya Lideri";
  return { uye: 1, lider: lider ? 1 : 0 };
}

async function savasSayilari(db, userId) {
  const win = await safeCount(
    db,
    `SELECT COUNT(DISTINCT s.id) AS n
     FROM mafya_savaslar s
     JOIN mafya_savas_katilim k ON k.savas_id = s.id AND k.user_id = ?
     WHERE s.durum = 'tamamlandi'
       AND s.kazanan_grup_id IS NOT NULL
       AND s.kazanan_grup_id = k.grup_id`,
    [userId]
  );
  const loss = await safeCount(
    db,
    `SELECT COUNT(DISTINCT s.id) AS n
     FROM mafya_savaslar s
     JOIN mafya_savas_katilim k ON k.savas_id = s.id AND k.user_id = ?
     WHERE s.durum = 'tamamlandi'
       AND s.kazanan_grup_id IS NOT NULL
       AND s.kazanan_grup_id != k.grup_id`,
    [userId]
  );
  return { win, loss };
}

async function borsaKar(db, userId) {
  // Gerçekleşmemiş portföy K/Z
  const unreal = await safeSum(
    db,
    `SELECT COALESCE(SUM(p.adet * s.fiyat - p.adet * p.ortalama_maliyet), 0) AS n
     FROM borsa_portfoy p
     JOIN borsa_sirketleri s ON s.id = p.sirket_id
     WHERE p.user_id = ?`,
    [userId]
  );
  // Nakit akış proxy (sat - al)
  const net = await safeSum(
    db,
    `SELECT COALESCE(SUM(CASE WHEN tur = 'sat' THEN toplam ELSE -toplam END), 0) AS n
     FROM borsa_islem_log WHERE user_id = ?`,
    [userId]
  );
  return Math.max(unreal, net, 0);
}

async function kumarhaneKar(db, userId) {
  return safeSum(
    db,
    `SELECT COALESCE(SUM(kazanc - bahis), 0) AS n FROM kumarhane_log WHERE user_id = ?`,
    [userId]
  );
}

async function adaySayilariHesapla(db, userId) {
  const [
    kabus,
    piyango,
    hukmet,
    yil,
    npc,
    sirket,
    mafya,
    savas,
    mafyaIs,
    gunlukGorev,
    sabotajOk,
    sabotajYedi,
    medya,
    borsa,
    kumar,
    sohbet,
    hapiste,
  ] = await Promise.all([
    kabusSayisi(db, userId),
    piyangoKazanimSayisi(db, userId),
    sehreHukmetSayisi(db, userId),
    yilSayisi(db, userId),
    npcCalismaSayisi(db, userId),
    sirketKurmaSayisi(db, userId),
    mafyaDurumu(db, userId),
    savasSayilari(db, userId),
    safeCount(
      db,
      `SELECT COUNT(*) AS n
       FROM mafya_is_katilim k
       JOIN mafya_isleri mi ON mi.id = k.is_id
       WHERE k.user_id = ? AND mi.durum = 'tamamlandi'`,
      [userId]
    ),
    safeCount(
      db,
      `SELECT COUNT(*) AS n FROM gunluk_gorev_atama WHERE user_id = ? AND odul_alindi = 1`,
      [userId]
    ),
    safeCount(
      db,
      `SELECT COUNT(*) AS n FROM sabotaj_isleri
       WHERE saldiran_id = ? AND durum = 'tamamlandi' AND basari = 1`,
      [userId]
    ),
    safeCount(
      db,
      `SELECT COUNT(*) AS n FROM sabotaj_isleri
       WHERE hedef_id = ? AND durum = 'tamamlandi' AND basari = 1`,
      [userId]
    ),
    safeCount(db, `SELECT COUNT(*) AS n FROM medya_haberleri WHERE user_id = ?`, [userId]),
    borsaKar(db, userId),
    kumarhaneKar(db, userId),
    safeCount(db, `SELECT COUNT(*) AS n FROM mafya_sohbet WHERE user_id = ?`, [userId]),
    get(db, `SELECT hapis_bitis_at FROM players WHERE user_id = ?`, [userId])
      .then((r) => (Number(r?.hapis_bitis_at) > 0 ? 1 : 0))
      .catch(() => 0),
  ]);

  return {
    war_victor: savas.win,
    war_defeat: savas.loss,
    mafia_job: mafyaIs * 10,
    saboteur: sabotajOk,
    sabotaged: sabotajYedi,
    enemy_crush: 0, // olay latch (+100)
    spy_intel: 0, // olay latch (+10)
    lottery_winner: piyango,
    company_founder: sirket,
    npc_worker: npc,
    stock_trader: borsa,
    casino_player: kumar,
    daily_quest: gunlukGorev,
    yearly_player: yil,
    mafia_chat: sohbet,
    press_baron: medya,
    blacklist_king: hukmet,
    lawyer_briber: 0, // sadece elmas rüşvet latch
    jailed: hapiste, // + olay latch
    prison_bribe: 0, // gardiyan rüşveti latch
    prison_rescue: 0, // başkasını kurtarma latch
    mafia_member: mafya.uye,
    mafia_leader: mafya.lider,
    rule_city: hukmet,
    nightmare: kabus,
  };
}

function mergeCounts(onceki, canli) {
  const out = { ...onceki };
  for (const id of BASARI_ID_SET) {
    const n = Math.max(toCount(onceki[id]), toCount(canli[id]));
    if (n > 0) out[id] = n;
    else delete out[id];
  }
  return out;
}

function countsEqual(a, b) {
  for (const id of BASARI_ID_SET) {
    if (toCount(a[id]) !== toCount(b[id])) return false;
  }
  return true;
}

async function kaydetCounts(db, userId, counts) {
  await run(
    db,
    `UPDATE players SET basari_rozet_json = ? WHERE user_id = ?`,
    [JSON.stringify(counts), userId]
  );
}

async function basariRozetArtir(db, userId, rozetId, delta = 1) {
  const id = BASARI_ID_MIGRATE[rozetId] || String(rozetId || "").trim();
  if (!BASARI_ID_SET.has(id) || !userId) return null;
  const artis = Math.max(1, Math.floor(Number(delta) || 1));
  try {
    await ensureBasariColumns(db);
    const row = await get(db, `SELECT basari_rozet_json FROM players WHERE user_id = ?`, [userId]);
    const counts = normalizeCounts(row?.basari_rozet_json);
    counts[id] = toCount(counts[id]) + artis;
    await kaydetCounts(db, userId, counts);
    return counts[id];
  } catch (err) {
    console.warn("[basari-rozet] artir:", err?.message || err);
    return null;
  }
}

function listeOlustur(counts) {
  return BASARI_ROZETLER.map((r) => {
    const adet = toCount(counts[r.id]);
    const unlockMin = Math.max(1, toCount(r.unlockMin) || 1);
    return {
      id: r.id,
      name: r.name,
      icon: r.icon,
      iconUrl: iconUrl(r.icon),
      unlocked: adet >= unlockMin,
      count: adet,
      goal: r.goal || "+1",
      kategori: r.kategori,
      format: r.format || "",
      unlockMin,
    };
  });
}

async function oyuncuBasariRozetleri(db, userId, opts = {}) {
  await ensureBasariColumns(db);
  const row = await get(
    db,
    `SELECT basari_rozet_json FROM players WHERE user_id = ?`,
    [userId]
  );
  const onceki = normalizeCounts(row?.basari_rozet_json);
  let counts = { ...onceki };

  try {
    const canli = await adaySayilariHesapla(db, userId);
    counts = mergeCounts(onceki, canli);
  } catch (err) {
    console.warn("[basari-rozet] hesaplama:", err?.message || err);
  }

  if (!countsEqual(onceki, counts)) {
    await kaydetCounts(db, userId, counts);
  }

  const liste = listeOlustur(counts);
  const unlockedIds = liste.filter((x) => x.unlocked).map((x) => x.id);
  return { liste, unlockedIds, counts, kategoriler: BASARI_KATEGORILER };
}

module.exports = {
  BASARI_ROZETLER,
  BASARI_KATEGORILER,
  BASARI_BY_ID,
  ON_MILYON,
  ensureBasariColumns,
  oyuncuBasariRozetleri,
  basariRozetArtir,
  normalizeCounts,
};
