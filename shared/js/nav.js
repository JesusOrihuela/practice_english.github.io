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
  // data-i18n-html: values that carry markup (e.g. an accent <span> inside an h1).
  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-html');
    var txt = AppLang.t(key, _i18nParams);
    if (txt !== key) el.innerHTML = txt;
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

  // 3. Footer — built from i18n for ALL pairs. The name is invariant; only the
  //    "Developed by" text and the (dynamic) year vary. The <p> is empty in HTML.
  var _footerP = document.querySelector('footer .footer-content p');
  if (_footerP) {
    var _devTxt = AppLang.t('footer_developed_by');
    if (_devTxt !== 'footer_developed_by') {
      var _yrEl = _footerP.querySelector('#footer-year');
      var _yr = _yrEl ? _yrEl.textContent : new Date().getFullYear();
      _footerP.innerHTML = '© <span id="footer-year">' + _yr + '</span> ' + _devTxt + ' Jesús Orihuela';
    }
  }

  // NOTE: buttons, exercise titles and page-header h1 are no longer special-cased
  // here — they carry data-i18n / data-i18n-html in the HTML and are filled by the
  // generic passes above, for every language pair (no hardcoded text anywhere).

}());
