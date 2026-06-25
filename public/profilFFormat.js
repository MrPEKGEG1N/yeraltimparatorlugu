(function (global) {
  "use strict";

  var F_TAG_RE = /\[f(\s+[^\]]*)?\]|\[\/f\]/gi;
  var HIZA_PREFIX_RE = /^\[profil-hiza:(left|center|right)\]\s*/i;
  var SIZE_MAP = {
    "01": "1px", "02": "2px", "03": "3px", "04": "4px", "05": "5px",
    "06": "6px", "07": "7px", "08": "8px", "09": "9px", "10": "10px",
    "11": "11px", "12": "12px"
  };

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function htmlToPlainText(html) {
    var s = String(html || "");
    if (s.indexOf("<") < 0) return s;
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

  function profilHizaAyikla(raw) {
    var s = String(raw || "");
    var m = s.match(HIZA_PREFIX_RE);
    if (!m) return { hiza: "left", body: s };
    return { hiza: m[1].toLowerCase(), body: s.slice(m[0].length) };
  }

  function profilHizaEkle(body, hiza) {
    var b = String(body || "").trim();
    var h = String(hiza || "left").toLowerCase();
    if (!b) return "";
    if (h === "left") return b;
    return "[profil-hiza:" + h + "]\n" + b;
  }

  function profilHizaSinif(hiza) {
    if (hiza === "center") return "profil-hiza-orta";
    if (hiza === "right") return "profil-hiza-sag";
    return "profil-hiza-sol";
  }

  function profilAciklamaFFormatMi(raw) {
    var text = htmlToPlainText(profilHizaAyikla(raw).body);
    return /\[f[\s\]]/i.test(text) || /\[\/f\]/i.test(text);
  }

  function parseFAttrs(attrStr) {
    var attrs = {};
    var src = String(attrStr || "");
    var fontQuoted = src.match(/\bf\s*=\s*"([^"]*)"/i);
    var fontPlain = src.match(/\bf\s*=\s*'([^']*)'/i) || src.match(/\bf\s*=\s*([^'"\s\]]+)/i);
    var size = src.match(/\bs\s*=\s*([0-9]{1,2})/i);
    var color = src.match(/\bc\s*=\s*(#[0-9a-f]{3,8})/i);
    if (fontQuoted) attrs.font = fontQuoted[1].trim();
    else if (fontPlain) attrs.font = fontPlain[1].trim();
    if (size) attrs.size = size[1];
    if (color) attrs.color = color[1].toLowerCase();
    return attrs;
  }

  function fontSizeFromCode(code) {
    var key = String(code || "").padStart(2, "0");
    if (SIZE_MAP[key]) return SIZE_MAP[key];
    var n = parseInt(code, 10);
    if (!isFinite(n) || n <= 0) return null;
    return Math.min(24, n) + "px";
  }

  function spanStyleFromAttrs(attrs) {
    var parts = [];
    if (attrs.font) {
      var safeFont = attrs.font.replace(/["<>]/g, "").slice(0, 80);
      if (safeFont) parts.push("font-family:" + safeFont + ",monospace");
    }
    if (attrs.size) {
      var px = fontSizeFromCode(attrs.size);
      if (px) parts.push("font-size:" + px);
    }
    if (attrs.color && /^#[0-9a-f]{3,8}$/i.test(attrs.color)) {
      parts.push("color:" + attrs.color);
    }
    return parts.join(";");
  }

  function fFormatToHtml(raw) {
    var parsed = profilHizaAyikla(htmlToPlainText(raw));
    var text = parsed.body;
    if (!/\[f[\s\]]/i.test(text) && !/\[\/f\]/i.test(text)) return null;

    var html = "";
    var stack = [];
    var last = 0;
    var m;
    F_TAG_RE.lastIndex = 0;
    while ((m = F_TAG_RE.exec(text)) !== null) {
      html += escHtml(text.slice(last, m.index));
      last = F_TAG_RE.lastIndex;
      var token = m[0].toLowerCase();
      if (token === "[/f]") {
        if (stack.length) {
          html += "</span>";
          stack.pop();
        }
        continue;
      }
      var style = spanStyleFromAttrs(parseFAttrs(m[1] || ""));
      if (style) {
        html += '<span style="' + style + '">';
        stack.push(true);
      }
    }
    html += escHtml(text.slice(last));
    while (stack.length) {
      html += "</span>";
      stack.pop();
    }
    return '<div class="profil-f-art ' + profilHizaSinif(parsed.hiza) + '">' + html + "</div>";
  }

  global.profilFFormat = {
    htmlToPlainText: htmlToPlainText,
    profilHizaAyikla: profilHizaAyikla,
    profilHizaEkle: profilHizaEkle,
    profilHizaSinif: profilHizaSinif,
    profilAciklamaFFormatMi: profilAciklamaFFormatMi,
    fFormatToHtml: fFormatToHtml
  };
})(window);
