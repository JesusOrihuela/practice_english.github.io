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
  // flags: a language's flag code(s) — ONE, TWO or THREE, whatever represents it (Finnish/Icelandic
  //   may need just ['fi']/['is']; Spanish/German two; a language could need three). AppFlags.langFlags()
  //   renders any count (1 = single, 2 = overlapping stack, 3+ = cluster) — never assume exactly two.
  const PAIRS = [
    {
      id:          'es-en',
      source:      { code: 'es', flags: ['es', 'mx', 'ar'], name: 'Español', localName: 'español' },
      target:      { code: 'en', flags: ['us', 'gb'], name: 'English', localName: 'inglés'  },
      label:       'Español → English',
      ttsVoices:   ['af_heart', 'af_bella', 'bf_emma', 'am_michael'],
      sttLanguage: 'english',
    },
    {
      id:          'en-es',
      source:      { code: 'en', flags: ['us', 'gb'], name: 'English', localName: 'English' },
      target:      { code: 'es', flags: ['es', 'mx', 'ar'], name: 'Español', localName: 'Spanish' },
      label:       'English → Español',
      ttsVoices:   ['ef_dora', 'em_alex', 'em_santa'],
      sttLanguage: 'spanish',
    },
    {
      // STRESS-TEST pair (intentionally minimal): exercises the framework's new variant
      // dimensions (number, case) + 3-way gender and du/Sie register with a German target.
      id:          'en-de',
      source:      { code: 'en', flags: ['us', 'gb'], name: 'English', localName: 'English' },
      target:      { code: 'de', flags: ['at', 'de'], name: 'Deutsch', localName: 'German' },
      label:       'English → Deutsch',
      ttsVoices:   ['df_hedda', 'dm_conrad'],
      sttLanguage: 'german',
      stressTest:  true,   // architecture stress-test pair — hidden from the shippable picker + exempt from coverage
    },
    {
      // STRESS-TEST pair (intentionally minimal): the opposite pole to en-de — a target with NO
      // grammatical gender and an extreme case system (partitive + local cases), vowel harmony and
      // agglutination. Also the first pair whose target is ONE flag (Finland), proving langFlags()
      // never assumes exactly two.
      id:          'en-fi',
      source:      { code: 'en', flags: ['us', 'gb'], name: 'English', localName: 'English' },
      target:      { code: 'fi', flags: ['fi'],       name: 'Suomi',   localName: 'Finnish' },
      label:       'English → Suomi',
      ttsVoices:   ['fif_noora', 'fim_harri'],
      sttLanguage: 'finnish',
      stressTest:  true,   // architecture stress-test pair — hidden from the shippable picker + exempt from coverage
    },
    {
      // STRESS-TEST pair (intentionally minimal): the 3rd divergent target AND the first pair with a
      // NON-en/es SOURCE (German). Polish stresses a 7-case system + verbal aspect (perf/imperf) +
      // 3-gender agreement, no articles, and 9 special letters (ąćęłńóśźż). localName follows the
      // convention "target's name in the SOURCE language" → Polnisch (Polish, in German).
      id:          'de-pl',
      source:      { code: 'de', flags: ['at', 'de'], name: 'Deutsch', localName: 'Deutsch'  },
      target:      { code: 'pl', flags: ['pl'],       name: 'Polski',  localName: 'Polnisch' },
      label:       'Deutsch → Polski',
      ttsVoices:   ['plf_zofia', 'plm_marek'],
      sttLanguage: 'polish',
      stressTest:  true,   // architecture stress-test pair — hidden from the shippable picker + exempt from coverage
    },
    {
      // STRESS-TEST pair (intentionally minimal): the 4th and final divergent target. Portuguese
      // stresses (1) a 3-WAY register cline tu / você / o senhor (register's first non-binary use),
      // (2) BR↔PT regional variation (flags br + pt), and grammatical gender -o/-a. NOTE: it also
      // exposed that kokoro-js ships ONLY English voices, so pt (like every non-en target) uses
      // edge-tts pt-BR — the "Kokoro with a new language" premise is not achievable with kokoro-js.
      id:          'en-pt',
      source:      { code: 'en', flags: ['us', 'gb'], name: 'English',    localName: 'English' },
      target:      { code: 'pt', flags: ['br', 'pt'], name: 'Português', localName: 'Portuguese' },
      label:       'English → Português',
      ttsVoices:   ['pf_dora', 'pm_alex'],
      sttLanguage: 'portuguese',
      stressTest:  true,   // architecture stress-test pair — hidden from the shippable picker + exempt from coverage
    },
    {
      // STRESS-TEST pair (intentionally minimal): the 5th divergent target. Swedish (North Germanic)
      // closes the COMMON/NEUTER gender typology (en/ett = utrum/neutrum, shared by nl/sv/no/da) and
      // stresses the SUFFIXED definite article (hus → huset) via the new `definiteness` dimension. Its
      // common/neuter is noun-inherent (article in the term), not a person m/f variant → no gender
      // detector. du is universal (register absent).
      id:          'en-sv',
      source:      { code: 'en', flags: ['us', 'gb'], name: 'English',  localName: 'English' },
      target:      { code: 'sv', flags: ['se'],       name: 'Svenska',  localName: 'Swedish' },
      label:       'English → Svenska',
      ttsVoices:   ['svf_sofie', 'svm_mattias'],
      sttLanguage: 'swedish',
      stressTest:  true,   // architecture stress-test pair — hidden from the shippable picker + exempt from coverage
    },
    {
      // STRESS-TEST pair (intentionally minimal): the 6th and final divergent target. Norwegian closes
      // the DUAL WRITTEN STANDARD gap — Bokmål ↔ Nynorsk, two official norms of one spoken language
      // (jeg/eg, ikke/ikkje), handled by the new `standard` dimension with a TEXT badge (both are
      // Norway → no distinct flag). Reuses common/neuter (en/et) + suffixed definite from en-sv.
      id:          'en-no',
      source:      { code: 'en', flags: ['us', 'gb'], name: 'English', localName: 'English' },
      target:      { code: 'no', flags: ['no'],       name: 'Norsk',   localName: 'Norwegian' },
      label:       'English → Norsk',
      ttsVoices:   ['nof_pernille', 'nom_finn'],
      sttLanguage: 'norwegian',
      stressTest:  true,   // architecture stress-test pair — hidden from the shippable picker + exempt from coverage
    },
    {
      // SHIPPABLE pair IN PROGRESS (`wip:true`): German → Spanish, the first real product pair beyond
      // es-en/en-es. Source German reuses the `de` UI block; target Spanish reuses vocab/es (adding
      // German glosses) + es audio + the es coverage gate. `wip:true` HIDES it from the shippable
      // picker and EXEMPTS it from the completeness/coverage gates while it is built (see
      // docs/DE-ES-PLAN.md); remove the flag when it passes every gate. Reachable with ?dev=1.
      id:          'de-es',
      source:      { code: 'de', flags: ['de', 'at'],       name: 'Deutsch', localName: 'Deutsch' },
      target:      { code: 'es', flags: ['es', 'mx', 'ar'], name: 'Español', localName: 'Spanisch' },
      label:       'Deutsch → Español',
      ttsVoices:   ['ef_dora', 'em_alex', 'em_santa'],
      sttLanguage: 'spanish',
      wip:         true,   // work-in-progress shippable pair — hidden + gate-exempt until complete
    },
    // To add a new pair, insert an object here with id, source, target, label,
    // ttsVoices (Kokoro voice names for the target language),
    // sttLanguage (Whisper language name for the target language).
    // Grammar rules are stored at shared/json/{pairId}/grammar-rules.json —
    // AppData.get('grammar-rules') resolves to the active pair's file automatically.
  ];

  // ── Active pair ───────────────────────────────────────────────

  function getActive() {
    // localStorage is absent in Node (the pair-completeness gate loads this module) → default pair.
    var stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(ACTIVE_KEY) : null;
    return PAIRS.find(function (p) { return p.id === stored; }) || PAIRS[0];
  }

  function setActive(id) {
    if (!PAIRS.find(function (p) { return p.id === id; })) return;
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function getAll() { return PAIRS.slice(); }

  // Pairs to offer in the SHIPPABLE product picker: everything EXCEPT the architecture stress-test
  // pairs (`stressTest:true`), which are intentionally minimal and not for real users. A dev escape
  // — localStorage `pe_dev='1'` or a `?dev=1` URL param — reveals ALL pairs so we can still select and
  // test the stress-test ones during development. getAll() stays the full list (tools, audit, etc.).
  function getShippable() {
    var dev = false;
    try {
      dev = (typeof localStorage !== 'undefined' && localStorage.getItem('pe_dev') === '1') ||
            (typeof location !== 'undefined' && /[?&]dev=1(&|$)/.test(location.search));
    } catch (e) { /* storage/location blocked → default to shippable-only */ }
    return dev ? PAIRS.slice() : PAIRS.filter(function (p) { return !p.stressTest && !p.wip; });
  }

  // ── Key namespacing ───────────────────────────────────────────
  // Returns a pair-scoped localStorage key.
  // e.g.  storageKey('pe_progress') → 'pe_progress__es-en'

  function storageKey(base) {
    return base + '__' + getActive().id;
  }

  // ── Grammar file key ──────────────────────────────────────────
  // Returns the AppData key for the active pair's grammar rules.
  // AppData.get() resolves this to shared/json/{pairId}/grammar-rules.json.

  function grammarKey() {
    return 'grammar-rules';
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
    if (typeof localStorage === 'undefined') return;   // Node (tooling) — nothing to migrate.
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
    badge.setAttribute('aria-label',
      (typeof AppLang !== 'undefined') ? AppLang.t('lang_switch_aria', { pair: pair.label }) : pair.label);
    badge.setAttribute('title', pair.label);

    badge.appendChild(AppFlags.langFlags(pair.source.flags));
    var sep = document.createElement('span');
    sep.className   = 'lp-badge__sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '→';
    badge.appendChild(sep);
    badge.appendChild(AppFlags.langFlags(pair.target.flags));

    header.appendChild(badge);
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', _injectBadge);

  // ── Public API ────────────────────────────────────────────────
  return { getActive, setActive, getAll, getShippable, storageKey, grammarKey };

})();

// Dual-mode: expose to Node tooling (getAll() reads no localStorage) so the pair-completeness
// gate can validate each pair's declared flags/voices without duplicating the PAIRS list.
if (typeof module !== 'undefined' && module.exports) module.exports = AppLangPair;
