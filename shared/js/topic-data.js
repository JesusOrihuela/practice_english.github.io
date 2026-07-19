/* ============================================================
   topic-data.js — Shared JSON cache for topic data files
   Three-layer cache: memory → sessionStorage → network fetch.
   - Memory cache: synchronous hit within the same page load
   - sessionStorage cache: instant hit across page navigations
     within the same tab (cleared when tab closes)
   - Concurrent requests for the same key share one fetch (in-flight dedup)
   - Failed fetches are evicted so the caller can retry cleanly
   ============================================================ */

const AppData = (() => {
  const _cache     = new Map();          // memory: in-flight Promises + resolved data
  const _BASE      = '../../shared/json/';
  const _SS_PREFIX = 'pe_topic_v7_';     // v7: labels on all multi-form phrases; audioSlug on all forms including former style forms

  // IDs that are shared across all pairs (no pair prefix needed)
  const _SHARED = /^(word-equivalents|words)($|[-_])/;
  // Vocabulary lives under common/vocab/; other shared files under common/
  const _VOCAB  = /^words($|[-_])/;

  function _pairId() {
    return (typeof AppLangPair !== 'undefined') ? AppLangPair.getActive().id : 'es-en';
  }

  // Build URL:
  //   words*            → common/vocab/   (shared bilingual vocabulary)
  //   word-equivalents  → common/         (shared reference)
  //   everything else   → pairs/{pairId}/ (pair-specific phrases, grammar, placement)
  function _url(id) {
    if (_VOCAB.test(id))  return _BASE + 'common/vocab/' + id + '.json';
    if (_SHARED.test(id)) return _BASE + 'common/' + id + '.json';
    return _BASE + 'pairs/' + _pairId() + '/' + id + '.json';
  }

  // Cache key includes pair for pair-specific files to prevent cross-pair collisions
  function _cacheKey(id) {
    if (_SHARED.test(id)) return _SS_PREFIX + id;
    return _SS_PREFIX + _pairId() + '_' + id;
  }

  function _ssGet(id) {
    try {
      const raw = sessionStorage.getItem(_cacheKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _ssPut(id, data) {
    try { sessionStorage.setItem(_cacheKey(id), JSON.stringify(data)); }
    catch (_) {}  // quota exceeded — degrade silently, memory cache still works
  }

  /**
   * Load and cache a JSON file from shared/json/{pairId}/ (or shared/json/ for shared files).
   * @param {string} id - Filename without extension (e.g. 'greetings', 'word-equivalents')
   * @returns {Promise<Object>} Parsed JSON data
   */
  function get(id) {
    const key = _cacheKey(id);

    // 1 — Memory cache (same page, also holds in-flight Promises for dedup)
    if (_cache.has(key)) return Promise.resolve(_cache.get(key));

    // 2 — sessionStorage (cross-page within the same tab — no network needed)
    const ss = _ssGet(id);
    if (ss) { _cache.set(key, ss); return Promise.resolve(ss); }

    // 3 — Network fetch
    const p = fetch(_url(id))
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        _cache.set(key, data);  // replace in-flight Promise with resolved value
        _ssPut(id, data);       // persist for subsequent activity pages this session
        return data;
      })
      .catch(err => {
        _cache.delete(key);     // evict so the caller can retry
        throw err;
      });

    _cache.set(key, p);         // store Promise to deduplicate concurrent requests
    return p;
  }

  return { get };
})();
