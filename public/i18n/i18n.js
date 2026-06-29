(function (global) {
  'use strict';

  var STORAGE_KEY = 'yi_lang';
  var DEFAULT_LANG = 'tr';
  var currentLang = DEFAULT_LANG;
  var pickersBound = false;

  function codes() {
    return (global.I18N_LANGUAGES || []).map(function (l) {
      return l.code;
    });
  }

  function meta(code) {
    var list = global.I18N_LANGUAGES || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return list[i];
    }
    return null;
  }

  function normalizeLang(code) {
    var c = String(code || '').trim();
    if (!c) return DEFAULT_LANG;
    if (global.I18N_LOCALES && global.I18N_LOCALES[c]) return c;
    if (c.indexOf('-') > 0) {
      var base = c.split('-')[0];
      if (global.I18N_LOCALES && global.I18N_LOCALES[base]) return base;
    }
    return DEFAULT_LANG;
  }

  function fallbackChain() {
    if (currentLang === 'tr') return ['tr'];
    return [currentLang, 'en', 'en-US'];
  }

  function getStoredLang() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    } catch (_) {
      return DEFAULT_LANG;
    }
  }

  function storeLang(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (_) {}
  }

  function lookup(code, key) {
    var locales = global.I18N_LOCALES || {};
    var bucket = locales[code];
    if (bucket && bucket[key] != null && bucket[key] !== '') return bucket[key];
    return null;
  }

  function interpolate(val, vars) {
    if (!val || !vars || typeof vars !== 'object') return val == null ? '' : String(val);
    var out = String(val);
    Object.keys(vars).forEach(function (k) {
      out = out.split('{' + k + '}').join(String(vars[k]));
    });
    return out;
  }

  function catalogLookup(trText, lang) {
    if (!trText || lang === 'tr') return null;
    var map = global.I18N_MSG_TO_CODE || {};
    var cat = global.I18N_CATALOG || {};
    var code = map[trText];
    if (code && cat[code]) {
      var entry = cat[code];
      return entry[lang] || entry.en || entry['en-US'] || null;
    }
    return applyTemplatePhrase(trText, lang);
  }

  function applyTemplatePhrase(text, lang) {
    var templates = global.I18N_TEMPLATES || [];
    for (var i = 0; i < templates.length; i++) {
      var tpl = templates[i];
      if (!tpl.pattern) continue;
      var re;
      try {
        re = new RegExp(tpl.pattern);
      } catch (_) {
        continue;
      }
      var m = text.match(re);
      if (!m) continue;
      var out = tpl[lang] || tpl.en || tpl['en-US'] || tpl.tr;
      var vars = tpl.vars || [];
      for (var j = 0; j < vars.length; j++) {
        out = out.split('${' + vars[j] + '}').join(m[j + 1] || '');
      }
      return out;
    }
    return null;
  }

  function trPhrase(phrase, vars) {
    if (!phrase) return '';
    if (currentLang === 'tr') return interpolate(phrase, vars);
    var fromCatalog = catalogLookup(phrase, currentLang);
    if (fromCatalog) return interpolate(fromCatalog, vars);
    return interpolate(phrase, vars);
  }

  function t(key, vars) {
    if (!key) return '';
    var val = lookup(currentLang, key);
    if (val == null) {
      var chain = fallbackChain();
      for (var i = 0; i < chain.length; i++) {
        val = lookup(chain[i], key);
        if (val != null) break;
      }
    }
    if (val == null) val = key;
    return interpolate(val, vars);
  }

  function screenTitle(tip) {
    if (!tip) return t('screen.default');
    var key = 'screen.' + tip;
    var val = t(key);
    if (val !== key) return val;
    return String(tip).replace(/_/g, ' ').toUpperCase();
  }

  function mafyaTitle(mod) {
    var key = 'mafya.' + mod;
    var val = t(key);
    if (val !== key) return val;
    return t('screen.mafya');
  }

  function applyRoot() {
    var m = meta(currentLang);
    document.documentElement.lang = currentLang.split('-')[0];
    document.documentElement.dir = m && m.rtl ? 'rtl' : 'ltr';
    document.title = t('auth.title');
  }

  function applyNode(el) {
    var key = el.getAttribute('data-i18n');
    if (key) {
      var html = el.getAttribute('data-i18n-html') === '1';
      var val = t(key);
      if (html) el.innerHTML = val;
      else el.textContent = val;
    }
    var ph = el.getAttribute('data-i18n-placeholder');
    if (ph) el.placeholder = t(ph);
    var titleKey = el.getAttribute('data-i18n-title');
    if (titleKey) el.title = t(titleKey);
    var tipKey = el.getAttribute('data-i18n-tip');
    if (tipKey) el.setAttribute('data-tip', t(tipKey));
    var ariaKey = el.getAttribute('data-i18n-aria');
    if (ariaKey) el.setAttribute('aria-label', t(ariaKey));
  }

  function redrawActiveScreen() {
    if (typeof global.ekranDegistir === 'function' && global.aktifEkran) {
      global.ekranDegistir(global.aktifEkran);
    }
  }

  function apply(root) {
    applyRoot();
    var scope = root || document;
    scope.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-tip], [data-i18n-aria]').forEach(applyNode);
    refreshPickers();
    if (typeof global.masterFramePlaqueGuncelle === 'function' && global.aktifEkran) {
      global.masterFramePlaqueGuncelle(global.aktifEkran);
    }
    if (typeof global.guncelleBgIsim === 'function') global.guncelleBgIsim();
  }

  function pickerHTML() {
    var cur = meta(currentLang) || meta(DEFAULT_LANG);
    var html =
      '<div class="lang-picker" data-lang-picker="1">' +
      '<button type="button" class="lang-picker-btn" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="lang-picker-flag">' + (cur ? cur.flag : '🌐') + '</span>' +
      '<span class="lang-picker-code">' + (cur ? cur.code.toUpperCase() : 'TR') + '</span>' +
      '</button><ul class="lang-picker-menu gizli" role="listbox">';
    (global.I18N_LANGUAGES || []).forEach(function (lang) {
      html +=
        '<li><button type="button" class="lang-picker-item' +
        (lang.code === currentLang ? ' aktif' : '') +
        '" data-lang="' +
        lang.code +
        '" role="option">' +
        '<span class="lang-picker-item-flag">' +
        lang.flag +
        '</span><span>' +
        lang.label +
        '</span></button></li>';
    });
    html += '</ul></div>';
    return html;
  }

  function closeAllMenus(except) {
    document.querySelectorAll('[data-lang-picker]').forEach(function (wrap) {
      if (except && wrap === except) return;
      var menu = wrap.querySelector('.lang-picker-menu');
      var btn = wrap.querySelector('.lang-picker-btn');
      if (menu) menu.classList.add('gizli');
      if (btn) {
        btn.classList.remove('acik');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function bindPickerWrap(wrap) {
    if (!wrap || wrap.getAttribute('data-lang-bound') === '1') return;
    wrap.setAttribute('data-lang-bound', '1');
    var btn = wrap.querySelector('.lang-picker-btn');
    var menu = wrap.querySelector('.lang-picker-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var acik = !menu.classList.contains('gizli');
      closeAllMenus(wrap);
      if (acik) {
        menu.classList.add('gizli');
        btn.classList.remove('acik');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        menu.classList.remove('gizli');
        btn.classList.add('acik');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    menu.querySelectorAll('[data-lang]').forEach(function (item) {
      item.addEventListener('click', function () {
        setLang(item.getAttribute('data-lang'));
        closeAllMenus();
      });
    });
  }

  function mountPickers() {
    ['authLangMount', 'gameLangMount'].forEach(function (id) {
      var mount = document.getElementById(id);
      if (!mount) return;
      mount.innerHTML = pickerHTML();
      bindPickerWrap(mount.querySelector('[data-lang-picker]'));
    });
    if (!pickersBound) {
      pickersBound = true;
      document.addEventListener('click', function () {
        closeAllMenus();
      });
    }
  }

  function refreshPickers() {
    ['authLangMount', 'gameLangMount'].forEach(function (id) {
      var mount = document.getElementById(id);
      if (!mount) return;
      mount.innerHTML = pickerHTML();
      bindPickerWrap(mount.querySelector('[data-lang-picker]'));
    });
  }

  function wrapToast() {
    if (typeof global.toast !== 'function' || global.toast.__i18nWrapped) return;
    var orig = global.toast;
    function wrappedToast(mesaj, tip) {
      return orig(trPhrase(mesaj), tip);
    }
    wrappedToast.__i18nWrapped = true;
    wrappedToast.__orig = orig;
    global.toast = wrappedToast;
  }

  function wrapConfirm() {
    if (global.confirm.__i18nWrapped) return;
    var orig = global.confirm.bind(global);
    global.confirm = function (mesaj) {
      return orig(trPhrase(mesaj));
    };
    global.confirm.__i18nWrapped = true;
  }

  function setLang(code, opts) {
    opts = opts || {};
    var next = normalizeLang(code);
    if (!global.I18N_LOCALES || !global.I18N_LOCALES[next]) next = DEFAULT_LANG;
    var changed = next !== currentLang;
    currentLang = next;
    storeLang(next);
    apply();
    wrapToast();
    wrapConfirm();
    if (!opts.silent && typeof global.toast === 'function') {
      var m = meta(next);
      var msg = (m ? m.flag + ' ' : '') + t('lang.changed');
      if (global.toast.__orig) global.toast.__orig(msg, 'basari');
      else global.toast(msg, 'basari');
    }
    try {
      document.dispatchEvent(new CustomEvent('yi:langchange', { detail: { lang: next } }));
    } catch (_) {}
    if (changed) redrawActiveScreen();
    return next;
  }

  function getLang() {
    return currentLang;
  }

  function init() {
    currentLang = normalizeLang(getStoredLang());
    mountPickers();
    apply();
    wrapToast();
    wrapConfirm();
  }

  global.I18n = {
    t: t,
    tr: trPhrase,
    apply: apply,
    init: init,
    setLang: setLang,
    getLang: getLang,
    screenTitle: screenTitle,
    mafyaTitle: mafyaTitle,
    redrawActiveScreen: redrawActiveScreen
  };
  global.t = t;
  global.tr = trPhrase;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
