/* ============================================================
   page-title.js — Set the browser tab title in the active pair's
   SOURCE language before first paint, to avoid a title FOUC.

   The HTML <title> is hardcoded in Spanish (the original source
   language). For any pair whose source is not Spanish (e.g. en-es),
   nav.js used to rewrite document.title at end-of-body, which caused
   a visible flash (Spanish → source language) in the browser tab.

   Loaded in <head> right after lang.js, this runs during head parsing
   — before the page paints — so the tab shows the correct language
   from the start. Works for any current or future language pair.
   ============================================================ */
(function () {
  if (typeof AppLangPair === 'undefined' || typeof AppLang === 'undefined') return;

  var MAP = {
    speaking:      'speaking_page_title',
    dictation:     'dictation_page_title',
    cloze:         'cloze_page_title',
    translation:   'translation_page_title',
    scramble:      'scramble_page_title',
    vocabulary:    'vocab_page_title',
    quiz:          'quiz_page_title',
    grammar:       'grammar_page_title',
    'my-learning': 'my_learning_page_title',
    progress:      'progress_page_title',
    placement:     'placement_page_title',
  };

  var parts = location.pathname.split('/');
  var hi = parts.indexOf('html');
  var activity = hi > 0 ? parts[hi - 1] : null;
  var key = activity && MAP[activity];
  if (!key) return;

  var txt = AppLang.t(key);
  // Strip <span> markup present in non-source-language values.
  if (txt && txt !== key) {
    document.title = txt.replace(/<[^>]*>/g, '') + ' — Practice English';
  }
})();

/* ── i18n cloak ──────────────────────────────────────────────────────────
   For pairs whose source language is NOT the hardcoded HTML language (es),
   hide the content until every element is translated, so no Spanish text is
   ever painted (title, headers, footer, buttons…). This runs in <head>,
   before first paint. The cloak is removed on DOMContentLoaded — which fires
   after the whole body is parsed and all end-of-body scripts (nav.js and each
   activity's own i18n) have run — so it works uniformly for every page,
   including ones that don't load nav.js (e.g. placement). A failsafe timer
   guarantees the content is never stuck hidden if something throws. */
(function () {
  if (typeof AppLangPair === 'undefined') return;
  try {
    if (AppLangPair.getActive().source.code === 'es') return;  // source pair: no cloak
    var de = document.documentElement;
    de.classList.add('lang-cloak');
    var reveal = function () { de.classList.remove('lang-cloak'); };
    document.addEventListener('DOMContentLoaded', reveal);
    setTimeout(reveal, 2000);  // failsafe
  } catch (e) { /* never let cloaking break the page */ }
})();
