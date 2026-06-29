/** Sabotaj katalog — yeraltı dünyasına özgü operasyonlar */

const SABOTAJ_MIN_PUAN = 500;
const SABOTAJ_MAX_SEVIYE_FARK = 3;
const SABOTAJ_HEDEF_BEKLEME_SN = 3 * 24 * 60 * 60;

const SABOTAJ_KATEGORILER = [
  {
    id: "siber",
    ad: "Siber",
    ikon: "💻",
    aciklama: "Dijital korsanlar ve finans tuzakları — kasayı, bankayı ve borsa portföyünü hedefler.",
  },
  {
    id: "mekanik",
    ad: "Mekanik",
    ikon: "🔧",
    aciklama: "Sokak çeteleri ve kirli işler — saygınlık ve icraat dengesini bozar.",
  },
  {
    id: "hirisizlik",
    ad: "Hırsızlık",
    ikon: "🎭",
    aciklama: "Gece kulübü tuzakları ve gölge hırsızlar — SMS ve nakit avı.",
  },
  {
    id: "suikast",
    ad: "Suikastçı",
    ikon: "🗡️",
    aciklama: "Gizli operasyonlar — rakibin gücünü ve yeteneklerini zayıflatır.",
  },
];

const SABOTAJ_TURLERI = [
  {
    id: "dahi_cocuk",
    kategori: "siber",
    ad: "Defter Kurdu",
    karakter: "Kasa Operatörü",
    aciklama: "Rakibin kasa defterine sızar; nakit rezervinden pay keser.",
    etkiTip: "kasa_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 25000, icraat: 1, sureSn: 600, etkiDeger: 0.02, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 75000, icraat: 2, sureSn: 1800, etkiDeger: 0.04, etiket: "2. Plan" },
    ],
  },
  {
    id: "neo",
    kategori: "siber",
    ad: "Kasa Kırıcı",
    karakter: "Banka Sızıntısı",
    aciklama: "Banka kayıtlarına girer; hedefin yatırımlarından dilim alır.",
    etkiTip: "banka_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 30000, icraat: 1, sureSn: 600, etkiDeger: 0.005, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 90000, icraat: 2, sureSn: 1800, etkiDeger: 0.01, etiket: "2. Plan" },
    ],
  },
  {
    id: "borsa_korsani",
    kategori: "siber",
    ad: "Borsa Korsanı",
    karakter: "Portföy Sızıntısı",
    aciklama: "Hedefin hisse portföyüne sızar; pozisyonlarından pay keser.",
    etkiTip: "borsa_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 32000, icraat: 1, sureSn: 600, etkiDeger: 0.03, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 96000, icraat: 2, sureSn: 1800, etkiDeger: 0.06, etiket: "2. Plan" },
    ],
  },
  {
    id: "short_emri",
    kategori: "siber",
    ad: "Short Emri",
    karakter: "Piyasa Baskısı",
    aciklama: "Sahte haberle hisseleri baskılar; portföyde büyük erime yaratır.",
    etkiTip: "borsa_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 50000, icraat: 2, sureSn: 1200, etkiDeger: 0.05, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 150000, icraat: 3, sureSn: 2400, etkiDeger: 0.1, etiket: "2. Plan" },
    ],
  },
  {
    id: "surucu_timi",
    kategori: "mekanik",
    ad: "Mahalle Konvoyu",
    karakter: "İtibar Baskısı",
    aciklama: "Sokaklarda dedikodu yayar; hedefin saygınlığını düşürür.",
    etkiTip: "puan_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 20000, icraat: 1, sureSn: 600, etkiDeger: 0.005, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 60000, icraat: 2, sureSn: 1800, etkiDeger: 0.01, etiket: "2. Plan" },
    ],
  },
  {
    id: "pyro",
    kategori: "mekanik",
    ad: "Körükçü",
    karakter: "Operasyon Bozucu",
    aciklama: "Rakibin iş planını aksatır; icraat hakkını tüketir.",
    etkiTip: "icraat_dus",
    asamalar: [
      { seviye: 1, kasaMaliyet: 22000, icraat: 1, sureSn: 600, etkiDeger: 25, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 66000, icraat: 2, sureSn: 1800, etkiDeger: 50, etiket: "2. Plan" },
    ],
  },
  {
    id: "kirli_polis",
    kategori: "mekanik",
    ad: "Çürük Rozet",
    karakter: "Dosya Açan",
    aciklama: "Devlet kapılarında dosya açar; avukat ilişkisini zedeler.",
    etkiTip: "avukat_dus",
    asamalar: [
      { seviye: 1, kasaMaliyet: 28000, icraat: 1, sureSn: 600, etkiDeger: 100, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 84000, icraat: 2, sureSn: 1800, etkiDeger: 250, etiket: "2. Plan" },
    ],
  },
  {
    id: "luks_eskort",
    kategori: "hirisizlik",
    ad: "Gece Perdesi",
    karakter: "Lounge Tuzağı",
    aciklama: "Gece hayatında tuzak kurar; SMS hatlarını bozar.",
    etkiTip: "sms_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 18000, icraat: 1, sureSn: 600, etkiDeger: 0.3, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 54000, icraat: 2, sureSn: 1800, etkiDeger: 0.5, etiket: "2. Plan" },
    ],
  },
  {
    id: "gece_hirsizi",
    kategori: "hirisizlik",
    ad: "Çatı Faresi",
    karakter: "Nakit Avcısı",
    aciklama: "Kasa kapısında pusuda bekler; sessizce nakit çalar.",
    etkiTip: "kasa_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 15000, icraat: 1, sureSn: 600, etkiDeger: 0.01, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 45000, icraat: 2, sureSn: 1800, etkiDeger: 0.02, etiket: "2. Plan" },
    ],
  },
  {
    id: "teyze_may",
    kategori: "suikast",
    ad: "Zehirli Fincan",
    karakter: "Yetenek Erozyonu",
    aciklama: "İçeceğe karıştırılan şeylerle rakibin yeteneklerini törpüler.",
    etkiTip: "yetenek_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 35000, icraat: 1, sureSn: 600, etkiDeger: 0.01, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 105000, icraat: 2, sureSn: 1800, etkiDeger: 0.03, etiket: "2. Plan" },
    ],
  },
  {
    id: "sessiz_nisan",
    kategori: "suikast",
    ad: "Gölge Emri",
    karakter: "Güç Kırıcı",
    aciklama: "Perde arkasından vurur; hedefin gücünü kırar.",
    etkiTip: "guc_oran",
    asamalar: [
      { seviye: 1, kasaMaliyet: 40000, icraat: 1, sureSn: 600, etkiDeger: 0.01, etiket: "1. Plan" },
      { seviye: 2, kasaMaliyet: 120000, icraat: 2, sureSn: 1800, etkiDeger: 0.03, etiket: "2. Plan" },
    ],
  },
];

function formatYuzdeOran(etkiDeger) {
  const p = (etkiDeger || 0) * 100;
  if (p > 0 && p < 1) return `${p.toFixed(1).replace(/\.0$/, "")}%`;
  return `${Math.round(p)}%`;
}

/** UI / mesaj için hedef kaybı özeti */
function sabotajHedefKaybiOzeti(etkiTip, etkiDeger) {
  switch (etkiTip) {
    case "kasa_oran":
      return `Kasanın ${formatYuzdeOran(etkiDeger)}'i`;
    case "banka_oran":
      return `Banka yatırımının ${formatYuzdeOran(etkiDeger)}'i`;
    case "borsa_oran":
      return `Hisse portföyünün ${formatYuzdeOran(etkiDeger)}'i`;
    case "puan_oran":
      return `Saygınlığın ${formatYuzdeOran(etkiDeger)}'i`;
    case "icraat_dus":
      return `${Math.floor(etkiDeger)} icraat`;
    case "avukat_dus":
      return `${Math.floor(etkiDeger)} avukat ilişkisi`;
    case "sms_oran":
      return `SMS hakkının ${formatYuzdeOran(etkiDeger)}'i`;
    case "guc_oran":
      return `Gücün ${formatYuzdeOran(etkiDeger)}'i`;
    case "yetenek_oran":
      return `Yeteneklerin ${formatYuzdeOran(etkiDeger)}'i`;
    default:
      return "—";
  }
}

function sabotajParaTransferiMi(etkiTip) {
  return etkiTip === "kasa_oran" || etkiTip === "banka_oran" || etkiTip === "borsa_oran";
}

function sabotajKategoriAdi(kategoriId) {
  const k = SABOTAJ_KATEGORILER.find((c) => c.id === kategoriId);
  return k ? k.ad : "Sabotaj";
}

function sabotajTurBul(id) {
  return SABOTAJ_TURLERI.find((t) => t.id === id) || null;
}

function sabotajAsamaBul(tur, seviye) {
  if (!tur) return null;
  return tur.asamalar.find((a) => a.seviye === seviye) || null;
}

function sabotajKataloguClient() {
  return {
    kategoriler: SABOTAJ_KATEGORILER,
    turler: SABOTAJ_TURLERI.map((t) => ({
      id: t.id,
      kategori: t.kategori,
      ad: t.ad,
      karakter: t.karakter,
      aciklama: t.aciklama,
      etkiTip: t.etkiTip,
      asamalar: t.asamalar.map((a) => ({
        seviye: a.seviye,
        kasaMaliyet: a.kasaMaliyet,
        icraat: a.icraat,
        sureSn: a.sureSn,
        etiket: a.etiket,
        etkiDeger: a.etkiDeger,
        hedefKaybi: sabotajHedefKaybiOzeti(t.etkiTip, a.etkiDeger),
        paraSanaGecer: sabotajParaTransferiMi(t.etkiTip),
      })),
    })),
    minPuan: SABOTAJ_MIN_PUAN,
    hedefBeklemeGun: 3,
    maxSeviyeFark: SABOTAJ_MAX_SEVIYE_FARK,
  };
}

module.exports = {
  SABOTAJ_MIN_PUAN,
  SABOTAJ_MAX_SEVIYE_FARK,
  SABOTAJ_HEDEF_BEKLEME_SN,
  SABOTAJ_KATEGORILER,
  SABOTAJ_TURLERI,
  sabotajTurBul,
  sabotajAsamaBul,
  sabotajKataloguClient,
  sabotajHedefKaybiOzeti,
  sabotajParaTransferiMi,
  sabotajKategoriAdi,
  formatYuzdeOran,
};
