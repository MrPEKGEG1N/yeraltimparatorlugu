(function () {
  'use strict';

  var tutorialData = [
    {
      step: 1,
      textKey: 'tutorial.step.1',
      targetPage: '/profilim',
    },
    {
      step: 2,
      textKey: 'tutorial.step.2',
      targetPage: '/ekip-kirala',
    },
    {
      step: 3,
      textKey: 'tutorial.step.3',
      targetPage: '/buyume-adimlari',
    },
    {
      step: 4,
      textKey: 'tutorial.step.4',
      targetPage: '/mekan-sahibi',
    },
    {
      step: 5,
      textKey: 'tutorial.step.5',
      targetPage: '/istihbarat',
    },
    {
      step: 6,
      textKey: 'tutorial.step.6',
      targetPage: '/banka',
    },
    {
      step: 7,
      textKey: 'tutorial.step.7',
      targetPage: '/medya',
    },
    {
      step: 8,
      textKey: 'tutorial.step.8',
      targetPage: '/sehre-hukmet',
    },
    {
      step: 9,
      textKey: 'tutorial.step.9',
      targetPage: '/sohbet',
    },
    {
      step: 10,
      textKey: 'tutorial.step.10',
      targetPage: '/dusmana-cok',
    },
    {
      step: 11,
      textKey: 'tutorial.step.11',
      targetPage: '/devlet-iliskileri',
    },
    {
      step: 12,
      textKey: 'tutorial.step.12',
      targetPage: 'close-tutorial',
    },
  ];

  var PAGE_MAP = {
    '/profilim': 'profilim',
    '/ekip-kirala': 'korumaEkibi',
    '/buyume-adimlari': 'buyume',
    '/mekan-sahibi': 'mekan',
    '/istihbarat': 'istihbarat',
    '/banka': 'banka',
    '/medya': 'medya',
    '/gazete': 'gazete',
    '/sehre-hukmet': 'sehreHukmet',
    '/sohbet': 'mesajKutusu',
    '/dusmana-cok': 'dusmanaCok',
    '/devlet-iliskileri': 'devletIliskisi',
    'close-tutorial': null,
  };

  var MENU_EXPAND = {
    mesajKutusu: { menuId: 'sohbetMenu', btnId: 'sohbetMenuBtn' },
    mafyaSohbet: { menuId: 'sohbetMenu', btnId: 'sohbetMenuBtn' },
  };

  var currentStep = 1;
  var busy = false;
  var autoResumeTimer = null;

  function userId() {
    if (window.__benimUserId != null) return String(window.__benimUserId);
    if (window.aktifKullanici && window.aktifKullanici.id != null) {
      return String(window.aktifKullanici.id);
    }
    return null;
  }

  function isLoggedIn() {
    return userId() != null;
  }

  function isInGame() {
    var auth = document.getElementById('authEkran');
    var layout = document.getElementById('masterLayout');
    if (!isLoggedIn()) return false;
    if (auth && !auth.classList.contains('gizli')) return false;
    if (layout && layout.classList.contains('gizli')) return false;
    return true;
  }

  function storageKeys() {
    var uid = userId();
    if (!uid) return null;
    return {
      step: 'yi_tutorial_step_' + uid,
      done: 'yi_tutorial_done_' + uid,
    };
  }

  function escTutorial(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stepText(step) {
    if (!step) return '';
    return typeof t === 'function' && step.textKey ? t(step.textKey) : (step.text || '');
  }

  function getStep() {
    for (var i = 0; i < tutorialData.length; i++) {
      if (tutorialData[i].step === currentStep) return tutorialData[i];
    }
    return tutorialData[0];
  }

  function saveProgress() {
    try {
      var keys = storageKeys();
      if (!keys) return;
      localStorage.setItem(keys.step, String(currentStep));
      if (currentStep > tutorialData.length) {
        localStorage.setItem(keys.done, '1');
      }
    } catch (_) {}
  }

  function loadProgress() {
    try {
      var keys = storageKeys();
      if (!keys) return false;
      if (localStorage.getItem(keys.done) === '1') return false;
      var saved = parseInt(localStorage.getItem(keys.step), 10);
      if (!Number.isNaN(saved) && saved >= 1 && saved <= tutorialData.length) {
        currentStep = saved;
      } else {
        currentStep = 1;
      }
      return true;
    } catch (_) {
      currentStep = 1;
      return true;
    }
  }

  function expandMenuForTip(tip) {
    var cfg = MENU_EXPAND[tip];
    if (!cfg) return;
    var menu = document.getElementById(cfg.menuId);
    var btn = document.getElementById(cfg.btnId);
    if (!menu || menu.classList.contains('acik')) return;
    if (typeof window.toggleMenu === 'function') {
      window.toggleMenu(cfg.menuId, btn);
      return;
    }
    menu.classList.add('acik');
    if (btn) btn.classList.add('aktif-menu');
  }

  function navigate(path) {
    if (!path || path === 'close-tutorial') return;
    var tip = PAGE_MAP[path];
    if (!tip) return;
    var go = typeof window.ekranDegistir === 'function' ? window.ekranDegistir : null;
    if (!go) return;
    go(tip);
    expandMenuForTip(tip);
  }

  function isComplete() {
    try {
      var keys = storageKeys();
      if (!keys) return true;
      return localStorage.getItem(keys.done) === '1' || currentStep > tutorialData.length;
    } catch (_) {
      return false;
    }
  }

  function isPaused() {
    return !isComplete() && !modalVisible();
  }

  function modalVisible() {
    var modal = document.getElementById('tutorialModal');
    return !!(modal && !modal.classList.contains('gizli'));
  }

  function updateResumeButton() {
    var btn = document.getElementById('tutorialResumeBtn');
    if (!btn) return;
    if (!isInGame()) {
      btn.classList.add('gizli');
      return;
    }
    var show = isPaused();
    btn.classList.toggle('gizli', !show);
    if (show) {
      btn.textContent = typeof t === 'function'
        ? t('tutorial.resume', { step: currentStep, total: tutorialData.length })
        : '';
    }
  }

  function syncVisibility() {
    if (!isInGame()) {
      pause();
      updateResumeButton();
      return;
    }
    loadProgress();
    updateResumeButton();
  }

  function render() {
    var step = getStep();
    var modal = document.getElementById('tutorialModal');
    var metin = document.getElementById('tutorialMetin');
    var baslik = document.getElementById('tutorialBaslik');
    var ileri = document.getElementById('tutorialIleri');
    if (!modal || !metin) return false;

    var text = stepText(step);
    if (baslik) {
      baslik.textContent =
        currentStep === 1
          ? (typeof t === 'function' ? t('tutorial.title.welcome') : '')
          : (typeof t === 'function'
            ? t('tutorial.title.step', { step: currentStep, total: tutorialData.length })
            : '');
    }
    if (currentStep > 1) {
      metin.innerHTML =
        '<span class="eg-adim-etiket">' + escTutorial(typeof t === 'function'
          ? t('tutorial.stepLabel', { step: currentStep, total: tutorialData.length })
          : '') + '</span>'
        + escTutorial(text || '');
    } else {
      metin.textContent = text || '';
    }
    if (ileri) {
      ileri.disabled = !!busy;
      if (step.targetPage === 'close-tutorial') {
        ileri.textContent = typeof t === 'function' ? t('tutorial.finish') : '';
      } else {
        ileri.textContent = typeof t === 'function' ? t('tutorial.goToPage') : '';
      }
    }

    modal.classList.remove('gizli');
    modal.setAttribute('aria-hidden', 'false');
    updateResumeButton();
    return true;
  }

  function pause() {
    var modal = document.getElementById('tutorialModal');
    if (modal) {
      modal.classList.add('gizli');
      modal.setAttribute('aria-hidden', 'true');
    }
    busy = false;
    saveProgress();
    updateResumeButton();
  }

  function close(markDone) {
    pause();
    if (markDone) {
      currentStep = tutorialData.length + 1;
      saveProgress();
    }
    updateResumeButton();
  }

  function resume() {
    if (isComplete()) return;
    var step = getStep();
    if (step.targetPage && step.targetPage !== 'close-tutorial') {
      navigate(step.targetPage);
    }
    render();
  }

  function open(opts) {
    opts = opts || {};
    if (opts.step != null) currentStep = opts.step;
    else if (!opts.force) {
      if (!loadProgress()) return;
    } else {
      loadProgress();
    }
    if (currentStep > tutorialData.length) currentStep = 1;

    if (isPaused() && !opts.force) {
      updateResumeButton();
      return;
    }

    render();
    if (opts.navigate) {
      var step = getStep();
      if (step.targetPage && step.targetPage !== 'close-tutorial') {
        navigate(step.targetPage);
      }
    }
  }

  function forward() {
    if (busy) return;
    var step = getStep();

    if (step.targetPage === 'close-tutorial') {
      close(true);
      return;
    }

    if (step.targetPage) {
      navigate(step.targetPage);
    }

    currentStep += 1;
    saveProgress();

    if (currentStep > tutorialData.length) {
      close(true);
      return;
    }

    pause();
  }

  function tryAutoResume(action) {
    if (!isPaused() || busy) return;
    if (autoResumeTimer) clearTimeout(autoResumeTimer);
    autoResumeTimer = setTimeout(function () {
      autoResumeTimer = null;
      if (isPaused()) resume();
    }, 900);
  }

  function reset() {
    currentStep = 1;
    try {
      var keys = storageKeys();
      if (!keys) return;
      localStorage.removeItem(keys.step);
      localStorage.removeItem(keys.done);
    } catch (_) {}
    updateResumeButton();
  }

  function finishTutorial() {
    close(true);
  }

  function init() {
    var ileri = document.getElementById('tutorialIleri');
    var kapat = document.getElementById('tutorialKapat');
    var bitir = document.getElementById('tutorialBitir');
    var devam = document.getElementById('tutorialResumeBtn');
    if (ileri) ileri.addEventListener('click', forward);
    if (kapat) kapat.addEventListener('click', function () { pause(); });
    if (bitir) bitir.addEventListener('click', finishTutorial);
    if (devam) devam.addEventListener('click', resume);
    syncVisibility();
  }

  window.TutorialEngine = {
    tutorialData: tutorialData,
    get currentStep() {
      return currentStep;
    },
    set currentStep(n) {
      currentStep = Math.max(1, Math.min(tutorialData.length, Number(n) || 1));
      saveProgress();
    },
    open: open,
    close: close,
    pause: pause,
    resume: resume,
    forward: forward,
    finish: finishTutorial,
    render: render,
    reset: reset,
    isComplete: isComplete,
    isPaused: isPaused,
    tryAutoResume: tryAutoResume,
    syncVisibility: syncVisibility,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
