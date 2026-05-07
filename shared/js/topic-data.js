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
  const _SS_PREFIX = 'pe_topic_v2_';     // v2: phrase objects {id,phrase,translation,cefr,grammar}

  function _ssGet(id) {
    try {
      const raw = sessionStorage.getItem(_SS_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _ssPut(id, data) {
    try { sessionStorage.setItem(_SS_PREFIX + id, JSON.stringify(data)); }
    catch (_) {}  // quota exceeded — degrade silently, memory cache still works
  }

  /**
   * Load and cache a JSON file from shared/json/.
   * @param {string} id - Filename without extension (e.g. 'greetings', 'contractions')
   * @returns {Promise<Object>} Parsed JSON data
   */
  function get(id) {
    // 1 — Memory cache (same page, also holds in-flight Promises for dedup)
    if (_cache.has(id)) return Promise.resolve(_cache.get(id));

    // 2 — sessionStorage (cross-page within the same tab — no network needed)
    const ss = _ssGet(id);
    if (ss) { _cache.set(id, ss); return Promise.resolve(ss); }

    // 3 — Network fetch
    const p = fetch(_BASE + id + '.json')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        _cache.set(id, data);   // replace in-flight Promise with resolved value
        _ssPut(id, data);       // persist for subsequent activity pages this session
        return data;
      })
      .catch(err => {
        _cache.delete(id);      // evict so the caller can retry
        throw err;
      });

    _cache.set(id, p);          // store Promise to deduplicate concurrent requests
    return p;
  }

  return { get };
})();
