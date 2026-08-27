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
   All translatable HTML is now empty (data-i18n / data-i18n-html) and filled
   by nav.js from AppLang, for every pair — there is no hardcoded on-page text.
   To avoid painting empty elements before they're filled, hide the content
   until translation is done. This runs in <head>, before first paint; the
   cloak is removed on DOMContentLoaded — after the whole body is parsed and
   all end-of-body scripts (nav.js and each activity's own i18n) have run — so
   it works uniformly for every page, including ones that don't load nav.js
   (e.g. placement). A failsafe timer guarantees content is never stuck hidden. */
(function () {
  try {
    var de = document.documentElement;
    // Inject the cloak rule INLINE (not relying on the external stylesheet, which on a
    // cold load may not be applied yet when the class is added — leaving the hardcoded
    // subtitle painted alone). Runs in <head> before the body paints.
    var cs = document.createElement('style');
    cs.textContent = 'html.lang-cloak body{visibility:hidden}';
    (document.head || de).appendChild(cs);
    de.classList.add('lang-cloak');
    var revealed = false;
    // Removing lang-cloak makes the body visible; adding page-in (same frame) starts the
    // orchestrated entrance (title → subtitle → cards) defined in generalities.css. Because
    // the grid is already built when this runs, it is a pure reveal — nothing pops in empty.
    var reveal = function () { if (revealed) return; revealed = true; de.classList.remove('lang-cloak'); de.classList.add('page-in'); };
    // Exposed so AppTopicGrid.build() can reveal the page the moment the topic grid is
    // populated — on picker pages we wait for that instead of DOMContentLoaded, so the
    // header/subtitle never paints above an empty grid (the async grid build lands ~200ms
    // after DOMContentLoaded on a cold load). Pages without a grid reveal on DCL as before.
    window.__revealPage = reveal;
    document.addEventListener('DOMContentLoaded', function () {
      if (!document.getElementById('topic-grid')) reveal();
    });
    setTimeout(reveal, 2000);  // failsafe — content is never stuck hidden even if build never runs
  } catch (e) { /* never let cloaking break the page */ }
})();
