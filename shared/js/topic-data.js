/* ============================================================
   topic-data.js — Shared JSON loader for topic data files

   NETWORK-FIRST (mirrors the service worker), so a content deploy reaches users
   on the next navigation with NO manual reload or hard refresh:
   - Memory cache: synchronous hit within the same page load (also dedups
     concurrent in-flight requests). Cleared on every navigation, so it never
     pins content across page loads.
   - Network: every fresh get fetches from the network (through the SW, which is
     itself network-first → fresh online, cached for offline).
   - sessionStorage: OFFLINE FALLBACK ONLY. We keep a copy of each fetched file
     so a mid-session offline navigation still works, but it is never served
     while online — that was the old source of stale content that forced a hard
     refresh. (Cleared when the tab closes.)
   ============================================================ */

const AppData = (() => {
  const _cache     = new Map();          // memory: in-flight Promises + resolved data
  const _BASE      = '../../shared/json/';
  const _SS_PREFIX = 'pe_topic_v11_';    // v11: faithful-translation sources + new phrase categories

  // IDs still shared across all pairs (no pair prefix).
  const _SHARED = /^word-equivalents($|[-_])/;
  // Vocabulary lives under vocab/{targetLang}/ (target-centric — shared by target
  // language, so all X→en pairs reuse the English vocab, all X→es reuse Spanish).
  const _VOCAB  = /^words($|[-_])/;

  function _pairId() {
    return (typeof AppLangPair !== 'undefined') ? AppLangPair.getActive().id : 'es-en';
  }

  function _targetLang() {
    return (typeof AppLangPair !== 'undefined') ? AppLangPair.getActive().target.code : 'en';
  }

  // Build URL:
  //   words*            → vocab/{targetLang}/    (target-centric vocabulary)
  //   word-equivalents  → common/                (shared reference)
  //   everything else   → pairs/{pairId}/        (pair-specific phrases, grammar, placement)
  function _url(id) {
    if (_VOCAB.test(id))  return _BASE + 'vocab/' + _targetLang() + '/' + id + '.json';
    if (_SHARED.test(id)) return _BASE + 'common/' + id + '.json';
    return _BASE + 'pairs/' + _pairId() + '/' + id + '.json';
  }

  // Cache key: vocab is keyed by target language (shared across pairs with the
  // same target); other pair-specific files by pair; word-equivalents pair-agnostic.
  function _cacheKey(id) {
    if (_SHARED.test(id)) return _SS_PREFIX + id;
    if (_VOCAB.test(id))  return _SS_PREFIX + 'tgt-' + _targetLang() + '_' + id;
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

    // 1 — Memory cache (same page only; also holds in-flight Promises for dedup)
    if (_cache.has(key)) return Promise.resolve(_cache.get(key));

    // 2 — Network-first: always fetch fresh when online (through the SW). Fall
    // back to the sessionStorage copy only if the fetch fails (offline), so
    // stale content is never served while online.
    const p = fetch(_url(id))
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        _cache.set(key, data);  // replace in-flight Promise with resolved value
        _ssPut(id, data);       // keep an offline fallback copy for this tab
        return data;
      })
      .catch(err => {
        const ss = _ssGet(id);  // offline / fetch failed → last-known copy
        if (ss) { _cache.set(key, ss); return ss; }
        _cache.delete(key);     // nothing cached → evict so the caller can retry
        throw err;
      });

    _cache.set(key, p);         // store Promise to deduplicate concurrent requests
    return p;
  }

  return { get };
})();
