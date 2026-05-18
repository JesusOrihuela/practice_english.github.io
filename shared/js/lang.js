/* ============================================================
   lang.js — AppLang helper
   Provides template substitution over LangUI / LangTarget.
   Depends on: lang/ui/{source}.js, lang/target/{target}.js
   ============================================================ */
const AppLang = (() => {

  /**
   * Get a UI string in the source language (user's native language).
   * Supports {placeholder} substitution.
   * @param {string} key
   * @param {Object} [vars] — e.g. { cur: 3, total: 10 }
   * @returns {string}
   */
  function t(key, vars) {
    const src = (typeof LangUI !== 'undefined' && LangUI[key]) || key;
    if (!vars) return src;
    return src.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }

  /**
   * Get a target-language string (activity names, nav labels).
   * @param {string} key
   * @returns {string}
   */
  function tgt(key) {
    return (typeof LangTarget !== 'undefined' && LangTarget[key]) || key;
  }

  return { t, tgt };
})();
