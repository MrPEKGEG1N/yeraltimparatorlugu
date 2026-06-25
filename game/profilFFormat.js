const { escapeHtml } = require("./htmlEscape");

const F_TAG_RE = /\[f(\s+[^\]]*)?\]|\[\/f\]/gi;
const SIZE_MAP = {
  "01": "1px",
  "02": "2px",
  "03": "3px",
  "04": "4px",
  "05": "5px",
  "06": "6px",
  "07": "7px",
  "08": "8px",
  "09": "9px",
  "10": "10px",
  "11": "11px",
  "12": "12px",
};

function htmlToPlainText(html) {
  let s = String(html || "");
  if (!s.includes("<")) return s;
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "");
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function profilAciklamaFFormatMi(raw) {
  const text = htmlToPlainText(raw);
  return /\[f[\s\]]/i.test(text) || /\[\/f\]/i.test(text);
}

function parseFAttrs(attrStr) {
  const attrs = {};
  const src = String(attrStr || "");
  const fontQuoted = src.match(/\bf\s*=\s*"([^"]*)"/i);
  const fontPlain = src.match(/\bf\s*=\s*'([^']*)'/i) || src.match(/\bf\s*=\s*([^'"\s\]]+)/i);
  const size = src.match(/\bs\s*=\s*([0-9]{1,2})/i);
  const color = src.match(/\bc\s*=\s*(#[0-9a-f]{3,8})/i);
  if (fontQuoted) attrs.font = fontQuoted[1].trim();
  else if (fontPlain) attrs.font = fontPlain[1].trim();
  if (size) attrs.size = size[1];
  if (color) attrs.color = color[1].toLowerCase();
  return attrs;
}

function fontSizeFromCode(code) {
  const key = String(code || "").padStart(2, "0");
  if (SIZE_MAP[key]) return SIZE_MAP[key];
  const n = parseInt(code, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(24, n) + "px";
}

function spanStyleFromAttrs(attrs) {
  const parts = [];
  if (attrs.font) {
    const safeFont = attrs.font.replace(/["<>]/g, "").slice(0, 80);
    if (safeFont) parts.push("font-family:" + safeFont + ",monospace");
  }
  if (attrs.size) {
    const px = fontSizeFromCode(attrs.size);
    if (px) parts.push("font-size:" + px);
  }
  if (attrs.color && /^#[0-9a-f]{3,8}$/i.test(attrs.color)) {
    parts.push("color:" + attrs.color);
  }
  return parts.join(";");
}

function fFormatToHtml(raw) {
  const text = htmlToPlainText(raw);
  if (!profilAciklamaFFormatMi(text)) return null;

  let html = "";
  const stack = [];
  let last = 0;
  let m;
  F_TAG_RE.lastIndex = 0;
  while ((m = F_TAG_RE.exec(text)) !== null) {
    html += escapeHtml(text.slice(last, m.index));
    last = F_TAG_RE.lastIndex;
    const token = m[0].toLowerCase();
    if (token === "[/f]") {
      if (stack.length) {
        html += "</span>";
        stack.pop();
      }
      continue;
    }
    const style = spanStyleFromAttrs(parseFAttrs(m[1] || ""));
    if (style) {
      html += '<span style="' + style + '">';
      stack.push(true);
    }
  }
  html += escapeHtml(text.slice(last));
  while (stack.length) {
    html += "</span>";
    stack.pop();
  }
  return '<div class="profil-f-art">' + html + "</div>";
}

function profilAciklamaRenderHtml(raw) {
  const fHtml = fFormatToHtml(raw);
  if (fHtml) return fHtml;
  return String(raw || "").trim();
}

module.exports = {
  htmlToPlainText,
  profilAciklamaFFormatMi,
  fFormatToHtml,
  profilAciklamaRenderHtml,
};
