/* ============================================================
   lang-pair.js — Language pair management
   MUST load before proficiency.js, progress.js, and path-session.js.

   Responsibilities:
     1. Define available language pairs
     2. Persist and retrieve the active pair
     3. Namespace all per-pair localStorage keys via storageKey()
     4. Migrate existing (un-namespaced) data to the active pair on first load
     5. Inject the language pair badge into the page header
   ============================================================ */

const AppLangPair = (() => {

  const ACTIVE_KEY = 'pe_active_pair';

  // ── Available pairs ───────────────────────────────────────────
  // Add new pairs here when new source/target languages are supported.
  // flags: [back, front] — matches AppFlags.stack(back, front) keys in flags.js.
  const PAIRS = [
    {
      id:     'es-en',
      source: { code: 'es', flags: ['es', 'mx'], name: 'Español',  localName: 'español' },
      target: { code: 'en', flags: ['us', 'gb'], name: 'English', localName: 'inglés'  },
      label:  'Español → English',
    },
  ];

  // ── Active pair ───────────────────────────────────────────────

  function getActive() {
    var stored = localStorage.getItem(ACTIVE_KEY);
    return PAIRS.find(function (p) { return p.id === stored; }) || PAIRS[0];
  }

  function setActive(id) {
    if (!PAIRS.find(function (p) { return p.id === id; })) return;
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function getAll() { return PAIRS.slice(); }

  // ── Key namespacing ───────────────────────────────────────────
  // Returns a pair-scoped localStorage key.
  // e.g.  storageKey('pe_progress') → 'pe_progress__es-en'

  function storageKey(base) {
    return base + '__' + getActive().id;
  }

  // ── One-time data migration ───────────────────────────────────
  // Runs synchronously at module init so that progress.js reads
  // the correct namespaced key from its very first call.

  var _KEYS_TO_MIGRATE = [
    'pe_progress',
    'pe_path_session',
    'pe_topic_preferences',
    'pe_placement_level',
    'pe_placement_done',
    'pe_onboarded',
    'pe_user_proficiency',
    'pe_milestones',
  ];

  (function _migrate() {
    var pairId = getActive().id;
    _KEYS_TO_MIGRATE.forEach(function (key) {
      var newKey = key + '__' + pairId;
      var existing = localStorage.getItem(key);
      if (existing !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, existing);
        localStorage.removeItem(key);
      }
    });
  })();

  // ── Header badge (injected on DOMContentLoaded) ───────────────

  function _progressHref() {
    // Compute relative path to progress page based on URL structure.
    // Root page (index.html): pathname ends with / or index.html — no prefix needed.
    // Activity pages (e.g. speaking/html/speaking.html): need ../../ to reach root.
    // Checking the filename is more robust than counting segments, because dev servers
    // may serve from a parent directory, adding extra path segments before the app root.
    var path = location.pathname;
    var isRoot = /\/$/.test(path) || /\/index\.html$/.test(path) || path === '';
    var prefix = isRoot ? '' : '../../';
    return prefix + 'progress/html/progress.html';
  }

  function _injectBadge() {
    var header = document.querySelector('header');
    if (!header || header.querySelector('.lp-badge') || typeof AppFlags === 'undefined') return;
    var pair = getActive();

    var badge = document.createElement('a');
    badge.className  = 'lp-badge';
    badge.href       = _progressHref();
    badge.setAttribute('aria-label', pair.label + ' — cambiar idioma');
    badge.setAttribute('title', pair.label);

    badge.appendChild(AppFlags.stack(pair.source.flags[0], pair.source.flags[1]));
    var sep = document.createElement('span');
    sep.className   = 'lp-badge__sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '→';
    badge.appendChild(sep);
    badge.appendChild(AppFlags.stack(pair.target.flags[0], pair.target.flags[1]));

    header.appendChild(badge);
  }

  document.addEventListener('DOMContentLoaded', _injectBadge);

  // ── Public API ────────────────────────────────────────────────
  return { getActive, setActive, getAll, storageKey };

})();
