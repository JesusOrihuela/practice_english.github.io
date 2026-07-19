/* ============================================================
   nav.js — Nav highlight + i18n label injection
   1. Path-mode: overrides the active class when ?path=1 is set.
   2. i18n: fills nav labels and common exercise elements from
      AppLang.t() — works for any source language (es, en, …).
      Labels in HTML are empty; JS is the single source of truth.
   ============================================================ */
(function () {

  // ── Path-mode highlight ────────────────────────────────────────
  if (new URLSearchParams(location.search).get('path') === '1') {
    document.body.classList.add('path-mode');
    document.querySelectorAll('.mode-switcher .mode-btn.active').forEach(function (el) {
      el.classList.remove('active');
    });
    var ml = document.querySelector('.mode-switcher [data-nav="my-learning"]');
    if (ml) { ml.classList.add('active'); ml.classList.add('active--path'); }
  }

  // ── i18n label injection ───────────────────────────────────────
  if (typeof AppLangPair === 'undefined' || typeof AppLang === 'undefined') return;

  // 1. Nav labels via data-i18n — must run for ALL language pairs
  // Pass {target}/{source} params so strings that reference language names
  // can substitute them dynamically (e.g. translation_picker_sub, grammar_picker_sub).
  var _navPair = AppLangPair.getActive();
  var _i18nParams = {
    target:     _navPair.target.localName,
    source:     _navPair.source.localName,
    targetName: _navPair.target.name,
    sourceName: _navPair.source.name,
  };
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    var txt = AppLang.t(key, _i18nParams);
    if (txt !== key) el.textContent = txt;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-aria');
    var txt = AppLang.t(key, _i18nParams);
    if (txt !== key) el.setAttribute('aria-label', txt);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-placeholder');
    var txt = AppLang.t(key, _i18nParams);
    if (txt !== key) el.setAttribute('placeholder', txt);
  });

  // 2. Browser tab title — runs for ALL language pairs
  // AppLang.t() returns the correct source-language string regardless of pair.
  // Strip <span> tags (present in non-source-lang values) before setting document.title.
  var _PAGE_TITLE_MAP = {
    'speaking':    'speaking_page_title',
    'dictation':   'dictation_page_title',
    'cloze':       'cloze_page_title',
    'translation': 'translation_page_title',
    'scramble':    'scramble_page_title',
    'vocabulary':  'vocab_page_title',
    'quiz':        'quiz_page_title',
    'grammar':     'grammar_page_title',
    'my-learning': 'my_learning_page_title',
    'progress':    'progress_page_title',
    'placement':   'placement_page_title',
  };
  var _parts = location.pathname.split('/');
  var _htmlIdx = _parts.indexOf('html');
  var _activity = _htmlIdx > 0 ? _parts[_htmlIdx - 1] : null;
  var _pageTxt = (_activity && _PAGE_TITLE_MAP[_activity]) ? AppLang.t(_PAGE_TITLE_MAP[_activity]) : null;
  if (_pageTxt && _pageTxt !== _PAGE_TITLE_MAP[_activity]) {
    document.title = _pageTxt.replace(/<[^>]*>/g, '') + ' — Practice English';
  }

  // Sections below only run for non-source-language-HTML pairs.
  // Source-lang HTML (es-en) is already written in the source language and uses
  // <span> markup inside h1 that innerHTML reassignment would correctly set,
  // but the hardcoded HTML already has the right text — no JS update needed.
  if (AppLangPair.getActive().source.code === 'es') return;

  // 3. Common exercise buttons
  var _BTN_MAP = {
    'back-btn':           'back_to_topics',
    'back-to-categories': 'back_to_categories',
    'back-to-rules':      'back_to_rules',
    'listen-btn':         'listen_btn',
    'listen-btn-back':    'listen_btn',
    'play-btn':           'listen_btn',
    'listenButton':       'listen_btn_label',
    'check-btn':          'btn_verify',
  };
  Object.keys(_BTN_MAP).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var txt = AppLang.t(_BTN_MAP[id]);
    if (txt !== _BTN_MAP[id]) el.textContent = txt;
  });

  // 3b. Footer — always set from i18n (works for both es and en)
  var _footerP = document.querySelector('footer .footer-content p');
  if (_footerP) {
    var _devTxt = AppLang.t('footer_developed_by');
    if (_devTxt !== 'footer_developed_by') {
      var _yrEl = _footerP.querySelector('#footer-year');
      var _yr = _yrEl ? _yrEl.textContent : new Date().getFullYear();
      _footerP.innerHTML = '© <span id="footer-year">' + _yr + '</span> ' + _devTxt + ' Jesús Orihuela';
    }
  }

  // 4. Exercise area titles (by CSS class)
  var _TITLE_MAP = {
    'listening-title':    'speaking_title',
    'listening-subtitle': 'speaking_sub',
    'dict-title':         'dictation_title',
    'cloze-title':        'cloze_title',
    'cloze-subtitle':     'cloze_sub',
    'scramble-title':     'scramble_title',
  };
  Object.keys(_TITLE_MAP).forEach(function (cls) {
    var el = document.querySelector('.' + cls);
    if (!el) return;
    var txt = AppLang.t(_TITLE_MAP[cls]);
    if (txt !== _TITLE_MAP[cls]) el.textContent = txt;
  });

  // 5. Topic picker page header h1 (non-source-lang pairs only —
  //    source-lang HTML already has the correct <span> markup hardcoded)
  if (_pageTxt && _pageTxt !== _PAGE_TITLE_MAP[_activity]) {
    var _h1 = document.querySelector('.topic-picker-header h1, .dict-header h1, .cloze-header h1, .trans-header h1, .scramble-header h1, .grammar-header h1');
    if (_h1) _h1.innerHTML = _pageTxt;
  }

}());
