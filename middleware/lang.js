const { normalizeLang } = require("../game/errors");

function attachLang(req, res, next) {
  const raw =
    req.headers["x-game-lang"] ||
    req.headers["accept-language"]?.split(",")[0]?.trim() ||
    req.query.lang ||
    "tr";
  req.lang = normalizeLang(raw);
  next();
}

function localizeResponse(req, res, next) {
  const orig = res.json.bind(res);
  res.json = function localizeJson(data) {
    if (req.lang && req.lang !== "tr") {
      try {
        const { localizePayload } = require("../game/errors");
        return orig(localizePayload(data, req.lang));
      } catch (_) {
        return orig(data);
      }
    }
    return orig(data);
  };
  next();
}

module.exports = { attachLang, localizeResponse };
