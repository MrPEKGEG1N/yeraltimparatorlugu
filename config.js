const JWT_SECRET =
  process.env.JWT_SECRET || "yeralti-dev-gizli-anahtar-degistir";
const COOKIE_NAME = "yeralti_token";
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = { JWT_SECRET, COOKIE_NAME, TOKEN_MAX_AGE_MS };
