const { normalizeGameLang } = require("./localeMetaService");

const MONTHLY_CHAR_BUDGET = 500_000;
let usedChars = 0;
let budgetMonth = "";

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function ensureBudget() {
  const m = currentMonthKey();
  if (budgetMonth !== m) {
    budgetMonth = m;
    usedChars = 0;
  }
}

function translateLangCode(lang) {
  const code = normalizeGameLang(lang);
  if (code === "zh") return "zh-CN";
  if (code === "pt-BR") return "pt";
  if (code === "en-US") return "en";
  if (code === "ja") return "ja";
  return code.split("-")[0];
}

async function translateText(text, targetLang, sourceLang) {
  const src = String(text || "").trim();
  if (!src) return { ok: false, error: "Çevrilecek metin yok." };

  ensureBudget();
  if (usedChars + src.length > MONTHLY_CHAR_BUDGET) {
    return { ok: false, error: "Aylık çeviri kotası doldu. Daha sonra tekrar dene." };
  }

  const to = translateLangCode(targetLang || "en");
  const from = sourceLang ? translateLangCode(sourceLang) : "auto";

  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
    if (apiKey) {
      const url = new URL("https://translation.googleapis.com/language/translate/v2");
      url.searchParams.set("key", apiKey);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: src, target: to, source: from === "auto" ? undefined : from, format: "text" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.error?.message || "Google çeviri başarısız." };
      }
      const out = data?.data?.translations?.[0]?.translatedText || "";
      usedChars += src.length;
      return { ok: true, text: out, provider: "google-cloud" };
    }

    const translate = require("google-translate-api-x");
    const result = await translate(src, { from: from, to: to, autoCorrect: false });
    usedChars += src.length;
    return { ok: true, text: result.text || src, provider: "google-translate-api-x" };
  } catch (err) {
    return { ok: false, error: err.message || "Çeviri yapılamadı." };
  }
}

module.exports = {
  translateText,
  MONTHLY_CHAR_BUDGET,
};
