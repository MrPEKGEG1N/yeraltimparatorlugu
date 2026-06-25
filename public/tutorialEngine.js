(function () {
  'use strict';

  var STORAGE_STEP = 'yi_tutorial_step';
  var STORAGE_DONE = 'yi_tutorial_done';

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
      delay: 5000,
      nextAction: 'auto-redirect-gazete',
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
  var delayTimer = null;
  var modalVisible = false;

  function getStep() {
    for (var i = 0; i < tutorialData.length; i++) {
      if (tutorialData[i].step === currentStep) return tutorialData[i];
    }
    return tutorialData[0];
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_STEP, String(currentStep));
      if (currentStep > tutorialData.length) {
        localStorage.setItem(STORAGE_DONE, '1');
      }
    } catch (_) {}
  }

  function loadProgress() {
    try {
      if (localStorage.getItem(STORAGE_DONE) === '1') return false;
      var saved = parseInt(localStorage.getItem(STORAGE_STEP), 10);
      if (!Number.isNaN(saved) && saved >= 1 && saved <= tutorialData.length) {
        currentStep = saved;
      }
      return true;
    } catch (_) {
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

  function setBodyClass(on) {
    document.body.classList.toggle('egitim-acik', !!on);
  }

  function updateResumeButton() {
    var btn = document.getElementById('tutorialResumeBtn');
    if (!btn) return;
    var show = !isComplete() && !modalVisible;
    btn.classList.toggle('gizli', !show);
  }

  function render() {
    var step = getStep();
    var modal = document.getElementById('tutorialModal');
    var metin = document.getElementById('tutorialMetin');
    var baslik = document.getElementById('tutorialBaslik');
    var ileri = document.getElementById('tutorialIleri');
    if (!modal || !metin) return;

    metin.textContent = step.text || '';
    if (baslik) {
      baslik.textContent =
        currentStep === 1
          ? 'Oyun Eğitimi: Hoşgeldiniz'
          : 'Oyun Eğitimi: Adım ' + currentStep + ' / ' + tutorialData.length;
    }
    if (ileri) {
      ileri.disabled = !!busy;
      ileri.textContent = currentStep >= tutorialData.length ? 'Bitir' : 'İleri';
    }

    modal.classList.remove('gizli');
    modal.setAttribute('aria-hidden', 'false');
    modalVisible = true;
    setBodyClass(true);
    updateResumeButton();
  }

  function close(markDone) {
    var modal = document.getElementById('tutorialModal');
    if (modal) {
      modal.classList.add('gizli');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    busy = false;
    modalVisible = false;
    setBodyClass(false);
    if (markDone) {
      currentStep = tutorialData.length + 1;
    }
    saveProgress();
    updateResumeButton();
  }

  function showCurrentStep() {
    var step = getStep();
    if (step.targetPage && step.targetPage !== 'close-tutorial') {
      navigate(step.targetPage);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(render);
    });
  }

  function open(opts) {
    opts = opts || {};
    if (opts.step != null) currentStep = opts.step;
    else if (!opts.force) {
      if (!loadProgress()) return;
    }
    if (currentStep > tutorialData.length) return;
    showCurrentStep();
  }

  function advanceToNext() {
    currentStep += 1;
    saveProgress();
    if (currentStep > tutorialData.length) {
      close(true);
      return false;
    }
    showCurrentStep();
    return true;
  }

  function forward() {
    if (busy) return;
    var step = getStep();

    if (step.targetPage === 'close-tutorial') {
      close(true);
      return;
    }

    if (step.delay && step.nextAction === 'auto-redirect-gazete') {
      busy = true;
      render();
      delayTimer = setTimeout(function () {
        navigate('/gazete');
        busy = false;
        delayTimer = null;
        advanceToNext();
      }, step.delay);
      return;
    }

    advanceToNext();
  }

  function isComplete() {
    try {
      return localStorage.getItem(STORAGE_DONE) === '1' || currentStep > tutorialData.length;
    } catch (_) {
      return false;
    }
  }

  function reset() {
    currentStep = 1;
    try {
      localStorage.removeItem(STORAGE_STEP);
      localStorage.removeItem(STORAGE_DONE);
    } catch (_) {}
    updateResumeButton();
  }

  function init() {
    loadProgress();
    var ileri = document.getElementById('tutorialIleri');
    var kapat = document.getElementById('tutorialKapat');
    var devam = document.getElementById('tutorialResumeBtn');
    if (ileri) ileri.addEventListener('click', forward);
    if (kapat) kapat.addEventListener('click', function () { close(false); });
    if (devam) devam.addEventListener('click', function () { open({ force: true }); });
    updateResumeButton();
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
    forward: forward,
    render: render,
    reset: reset,
    isComplete: isComplete,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
