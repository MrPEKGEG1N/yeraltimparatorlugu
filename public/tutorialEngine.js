(function () {
  'use strict';

  var tutorialData = [
    {
      step: 1,
      text: 'Karanlık dünyaya hoşgeldin evlat. Burada sana birkaç ipucu vereceğim. Sonra kendi başınasın. Önce Profilim sayfasına git. Orada bilgilerin olacak ve karakter resmini/cinsiyetini değiştirebilirsin.',
      targetPage: '/profilim',
    },
    {
      step: 2,
      text: 'Şimdi Güçlen/Ekip Kirala kısmından yanına bir mahalle delikanlısı al.',
      targetPage: '/ekip-kirala',
    },
    {
      step: 3,
      text: 'Bravo! Artık arkan ve gücün daha sağlam. Şimdi Büyüme Adımları sayfasını incele. Burada gücüne göre işler yapabilir ve nakit+saygınlık kazanabilirsin.',
      targetPage: '/buyume-adimlari',
    },
    {
      step: 4,
      text: 'Şimdi Mekan Sahibi kısmını incele! Orada saatlik kazanç sağlayabileceğin mekanlar alabilirsin.',
      targetPage: '/mekan-sahibi',
    },
    {
      step: 5,
      text: 'Çok iyi gidiyorsun. Şimdi istihbarat kısmına bir göz at! İstihbarat gücün rakibinden fazla olmalı, elemanlarını arttırmayı unutma.',
      targetPage: '/istihbarat',
    },
    {
      step: 6,
      text: 'Şimdi sıra Banka kısmında. Burada paranı düşmanlarından saklayabilir ve faiz kazanabilirsin.',
      targetPage: '/banka',
    },
    {
      step: 7,
      text: "Şimdi Medya kısmına göz at ve Gazete Oku. Medya'da haber yaptırabilir, Gazete'den düşmanlarını takip edebilirsin.",
      targetPage: '/medya',
    },
    {
      step: 8,
      text: 'Buraya kadar çok iyi geldin! Şimdi Şehre Hükmet! Limanları, Sözünü Geçir ve Sadakat Yemini makamlarını ele geçirirsen herkes gücünü görür.',
      targetPage: '/sehre-hukmet',
    },
    {
      step: 9,
      text: 'Sohbet sayfasında Mesaj Kutun var. Mafya Sohbetleri ise herkesin yazabildiği yerdir.',
      targetPage: '/sohbet',
    },
    {
      step: 10,
      text: "Düşmana Çök kısmında düşmanlarına saldırı gerçekleştirip paralarının %10'una, saygınlıklarının %1'ine çökebilirsin!",
      targetPage: '/dusmana-cok',
    },
    {
      step: 11,
      text: "Şehre Hükmetmek istediğin için Kara Liste'ye alınmış olursun. Devlet İlişkin yüksek olmalı ki İcraat yapabilesin. Avukatına para vermeyi unutma! Mafya Grubu lideri ya da üyesi olmak daha avantajlıdır.",
      targetPage: '/devlet-iliskileri',
    },
    {
      step: 12,
      text: 'Sana söyleyeceklerim ve eğitimin bu kadardı. Başarıyla tamamladın. Şehir seni bekliyor!',
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
      btn.textContent = '📖 Eğitime Devam (Adım ' + currentStep + '/' + tutorialData.length + ')';
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

    if (baslik) {
      baslik.textContent =
        currentStep === 1
          ? 'Oyun Eğitimi: Hoşgeldiniz'
          : 'Oyun Eğitimi: Adım ' + currentStep + ' / ' + tutorialData.length;
    }
    if (currentStep > 1) {
      metin.innerHTML =
        '<span class="eg-adim-etiket">Adım ' + currentStep + ' / ' + tutorialData.length + '</span>'
        + escTutorial(step.text || '');
    } else {
      metin.textContent = step.text || '';
    }
    if (ileri) {
      ileri.disabled = !!busy;
      if (step.targetPage === 'close-tutorial') {
        ileri.textContent = 'Bitir';
      } else {
        ileri.textContent = 'Sayfaya Git';
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

  function init() {
    var ileri = document.getElementById('tutorialIleri');
    var kapat = document.getElementById('tutorialKapat');
    var devam = document.getElementById('tutorialResumeBtn');
    if (ileri) ileri.addEventListener('click', forward);
    if (kapat) kapat.addEventListener('click', function () { pause(); });
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
