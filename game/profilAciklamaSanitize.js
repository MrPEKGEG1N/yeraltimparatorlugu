const sanitizeHtml = require("sanitize-html");

const MAX_UZUNLUK = 6000;

function sanitizeProfilAciklama(raw) {
  const cleaned = sanitizeHtml(String(raw || ""), {
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
  return cleaned.slice(0, MAX_UZUNLUK);
}

module.exports = { sanitizeProfilAciklama };
