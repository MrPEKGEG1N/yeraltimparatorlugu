(function (global) {
  "use strict";

  var MEKAN_AD = {
    kahvehane: {
      tr: "Kahvehane",
      en: "Corner Café",
      de: "Eckcafé",
      fr: "Café du coin",
      es: "Cafetería de barrio",
      it: "Caffè di quartiere",
      pt: "Café de esquina",
      pl: "Kawiarnia",
      ru: "Кофейня",
      zh: "喫茶店",
      ja: "喫茶店",
      ar: "مقهى الحي",
    },
    bar: {
      tr: "Bar",
      en: "Neighborhood Bar",
      de: "Kneipe",
      fr: "Bar de quartier",
      es: "Bar del barrio",
      it: "Bar di quartiere",
      pt: "Bar de bairro",
      pl: "Bar",
      ru: "Бар",
      zh: "酒吧",
      ja: "バー",
      ar: "حانة",
    },
    disco: {
      tr: "Disco",
      en: "Nightclub",
      de: "Diskothek",
      fr: "Discothèque",
      es: "Discoteca",
      it: "Discoteca",
      pt: "Discoteca",
      pl: "Dyskoteka",
      ru: "Дискотека",
      zh: "迪斯科",
      ja: "ディスコ",
      ar: "ملهى ليلي",
    },
    lunapark: {
      tr: "Lunapark",
      en: "Amusement Park",
      de: "Vergnügungspark",
      fr: "Parc d'attractions",
      es: "Parque de atracciones",
      it: "Luna park",
      pt: "Parque de diversões",
      pl: "Lunapark",
      ru: "Луна-парк",
      zh: "游乐园",
      ja: "遊園地",
      ar: "مدينة ملاهٍ",
    },
    kumarhane: {
      tr: "Şans Oyunları",
      en: "Games of Chance",
      de: "Glücksspiele",
      fr: "Jeux de hasard",
      es: "Juegos de azar",
      it: "Giochi d'azzardo",
      pt: "Jogos de azar",
      pl: "Gry losowe",
      ru: "Азартные игры",
      zh: "博彩厅",
      ja: "賭博場",
      ar: "ألعاب الحظ",
    },
    sokak_arasi: {
      tr: "Sokak Arası Sektörü",
      en: "Street-Level Arms",
      de: "Straßenwaffen",
      fr: "Armes de rue",
      es: "Armas callejeras",
      pl: "Broń uliczna",
      ru: "Уличное оружие",
      zh: "街头军火",
      ja: "ストリート武器",
      ar: "سلاح الشوارع",
    },
    sehirler_arasi: {
      tr: "Şehirler Arası Sektörü",
      en: "Intercity Arms Network",
      de: "Zwischenstädtisches Netz",
      fr: "Réseau interurbain",
      es: "Red interurbana",
      pl: "Sieć między miastami",
      ru: "Межгородская сеть",
      zh: "城际军火网",
      ja: "都市間ネットワーク",
      ar: "شبكة بين المدن",
    },
    kacakcilik: {
      tr: "Kaçakçılık Sektörü",
      en: "Smuggling Sector",
      de: "Schmuggel",
      fr: "Contrebande",
      es: "Contrabando",
      pl: "Przemyt",
      ru: "Контрабанда",
      zh: "走私渠道",
      ja: "密輸ルート",
      ar: "تهريب",
    },
    uluslararasi: {
      tr: "Uluslararası Sektörü",
      en: "International Sector",
      de: "International",
      fr: "International",
      es: "Internacional",
      pl: "Międzynarodowy",
      ru: "Международный сектор",
      zh: "国际军火",
      ja: "国際セクター",
      ar: "قطاع دولي",
    },
    atom: {
      tr: "Atom Sektörü",
      en: "Nuclear Black Market",
      de: "Atom-Schwarzmarkt",
      fr: "Marché noir nucléaire",
      es: "Mercado negro nuclear",
      pl: "Czarny rynek jądrowy",
      ru: "Ядерный чёрный рынок",
      zh: "核武黑市",
      ja: "核兵器闇市場",
      ar: "السوق النووي الأسود",
    },
  };

  function pick(map, key, lang) {
    var e = map[key];
    if (!e) return null;
    return e[lang] || e.en || e.tr || null;
  }

  function mekanAd(key, fallback) {
    var lang =
      global.I18n && typeof global.I18n.getLang === "function"
        ? global.I18n.getLang()
        : "tr";
    var hit = pick(MEKAN_AD, key, lang);
    if (hit) return hit;
    if (lang !== "en" && lang !== "tr") {
      hit = pick(MEKAN_AD, key, "en");
      if (hit) return hit;
    }
    if (fallback) return String(fallback);
    return key || "";
  }

  function mekanAciklama(key, fallback) {
    if (fallback && typeof global.tr === "function") return global.tr(fallback);
    return fallback || "";
  }

  global.mekanAd = mekanAd;
  global.mekanAciklama = mekanAciklama;
})(window);
