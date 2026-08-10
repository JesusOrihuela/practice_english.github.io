/* ============================================================
   i18n-dom.js — the ONE way UI text enters the DOM.

   PROJECT STANDARD: no page hardcodes user-facing UI text. Every
   translatable element is empty in the HTML and carries one of:
     data-i18n            → textContent
     data-i18n-html       → innerHTML     (values with markup, e.g. an <span>)
     data-i18n-aria       → aria-label
     data-i18n-placeholder→ placeholder
   AppI18nDom.apply() fills them from AppLang for the ACTIVE pair, so the
   same HTML works for every language pair with no hardcoded strings.

   Used by nav.js (activity pages) and index.html (landing). Enforced by
   tools/check-i18n.mjs.
   ============================================================ */
(function () {
  function apply(root, params) {
    if (typeof AppLang === 'undefined') return;
    root = root || document;
    params = params || {};
    var pass = function (attr, set) {
      root.querySelectorAll('[' + attr + ']').forEach(function (el) {
        var key = el.getAttribute(attr);
        var txt = AppLang.t(key, params);
        if (txt !== key) set(el, txt);
      });
    };
    pass('data-i18n',            function (el, t) { el.textContent = t; });
    pass('data-i18n-html',       function (el, t) { el.innerHTML = t; });
    pass('data-i18n-aria',       function (el, t) { el.setAttribute('aria-label', t); });
    pass('data-i18n-placeholder',function (el, t) { el.setAttribute('placeholder', t); });
  }

  // Standard params so values can reference the active languages by name.
  function params() {
    try {
      var p = AppLangPair.getActive();
      return { target: p.target.localName, source: p.source.localName,
               targetName: p.target.name, sourceName: p.source.name };
    } catch (e) { return {}; }
  }

  window.AppI18nDom = { apply: apply, params: params };

  // Universal safety net: fill every data-i18n* element once the DOM is parsed,
  // for ANY page that loads this file — including pages without nav.js (e.g.
  // placement) and future pages. nav.js / index also call apply() earlier
  // during parse; re-applying is idempotent. Guarantees the no-hardcoded-text
  // standard holds everywhere with zero per-page wiring.
  document.addEventListener('DOMContentLoaded', function () { apply(document, params()); });
})();
