const sanitizeHtml = require("sanitize-html");
const { profilAciklamaFFormatMi, htmlToPlainText } = require("./profilFFormat");

const MAX_HTML_UZUNLUK = 12000;
const MAX_F_UZUNLUK = 250000;

function sanitizeProfilAciklama(raw) {
  const src = String(raw || "");

  if (profilAciklamaFFormatMi(src)) {
    const plain = htmlToPlainText(src)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!plain) return "";
    return plain.slice(0, MAX_F_UZUNLUK);
  }

  const cleaned = sanitizeHtml(src, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "span", "font"],
    allowedAttributes: {
      "*": ["style", "class"],
      font: ["color", "size", "face"],
      span: ["style", "class"],
      p: ["style", "class"],
    },
    allowedStyles: {
      "*": {
        color: [
          /^#[0-9a-f]{3,8}$/i,
          /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i,
          /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i,
        ],
        "font-size": [/^\d+(?:px|em|pt|%)$/],
        "font-family": [/^[a-z0-9 ,'"()-]+$/i],
        "text-align": [/^(?:left|right|center|justify)$/],
      },
    },
    allowedClasses: {
      "*": [/^ql-/],
    },
    disallowedTagsMode: "discard",
  }).trim();

  if (!cleaned || cleaned === "<p></p>" || cleaned === "<p><br></p>") {
    return "";
  }
  return cleaned.slice(0, MAX_HTML_UZUNLUK);
}

module.exports = { sanitizeProfilAciklama };
