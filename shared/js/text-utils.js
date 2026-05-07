/* ============================================================
   text-utils.js — Shared text normalisation + cloze-gap utilities
   Single source of truth for expandContractions, normalise, AppCloze.
   Used by: translation, scramble, dictation, grammar, global-review, cloze
   ============================================================ */

const AppText = (() => {

  /**
   * Expand contractions in a lowercase string.
   * First pass: single-token expansion via regex (e.g. "don't" → "do not").
   * Second pass: multi-word phrase expansion (e.g. "it is" → "it's") using
   * patterns collected in map._multi by buildEquivalenceMaps().
   * @param {string} s   - Already-lowercased input.
   * @param {Object} map - { "don't": "do not", … } lookup table, optionally
   *                       with a _multi array of { pattern, canonical } entries.
   */
  function expandContractions(s, map) {
    if (!map) return s;
    // First pass: single-token expansion
    let result = s.replace(/[a-z][a-z']*[a-z]/g, token => map[token] || token);
    // Second pass: multi-word phrase expansion (longest patterns first)
    const multi = map._multi;
    if (multi && multi.length > 0) {
      for (const { pattern, canonical } of multi) {
        // Replace whole-word occurrences only (not in the middle of a word)
        result = result.replace(
          new RegExp('(^|\\s)' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'g'),
          (_, prefix) => prefix + canonical
        );
      }
    }
    return result;
  }

  /**
   * Normalise a phrase for comparison:
   * lowercase → NFD decompose → strip diacritics → strip non-alphanumeric
   * (except apostrophe) → collapse spaces → optionally expand contractions.
   *
   * NFD decomposition splits accented letters into base + combining mark
   * (e.g. é → e + ◌́), then the diacritic strip removes the mark, leaving
   * the base letter. This lets Spanish-keyboard users type "é" or "e"
   * interchangeably when answering English phrases.
   *
   * @param {string}  s    - Raw input (any case).
   * @param {Object} [map] - Contraction map; omit or pass null to skip expansion.
   */
  function normalise(s, map) {
    const stripped = (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!map) return stripped;
    return expandContractions(stripped, map).replace(/\s+/g, ' ').trim();
  }

  /**
   * Normalise a single word for comparison
   * (strips everything except letters, apostrophes, hyphens).
   * Applies the same NFD diacritic-stripping as normalise().
   * @param {string} s - Raw word.
   */
  function normaliseSingle(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/[^a-z'-]/g, '');
  }

  /**
   * Build equivalence maps from a word-equivalents groups array.
   *
   * Returns:
   *  flatMap  — { word: canonical } where canonical = first item in the group.
   *             Used by expandContractions / normalise for full-phrase comparison.
   *             Single-token keys only (no spaces) so the regex can match them.
   *  groupMap — Map<word, Set<all_forms>> for single-word set-intersection checks
   *             (Cloze). Multi-word entries like "it is" are also keyed here.
   *
   * @param {Array<string[]>} groups
   */
  function buildEquivalenceMaps(groups) {
    const flatMap  = {};
    const groupMap = new Map();
    const _multi   = []; // multi-word patterns for phrase-level expansion

    for (const group of groups) {
      const canonical = group[0].toLowerCase().replace(/['']/g, "'");
      const set = new Set(group.map(w => w.toLowerCase().replace(/['']/g, "'")));

      for (const form of set) {
        if (!form.includes(' ')) {
          // flatMap: single-token forms for expandContractions first pass
          flatMap[form] = canonical;
        } else if (!canonical.includes(' ')) {
          // _multi: multi-word form → single-token canonical mapping
          _multi.push({ pattern: form, canonical });
        }
        // groupMap: all forms, including multi-word
        if (!groupMap.has(form)) groupMap.set(form, new Set());
        for (const v of set) groupMap.get(form).add(v);
      }
    }

    // Sort by descending length so longer patterns are tried first
    _multi.sort((a, b) => b.pattern.length - a.pattern.length);
    flatMap._multi = _multi;

    return { flatMap, groupMap };
  }

  /**
   * From a list of candidate phrases (main + alternatives), return the one
   * with the most normalized words in common with the user's raw input.
   * Used to pick the best reference phrase for the diff display.
   * @param {string}   raw        - Raw user input.
   * @param {string[]} candidates - [mainPhrase, ...alternatives]
   * @param {Object}  [map]       - Contraction map.
   */
  function closestPhrase(raw, candidates, map) {
    if (!candidates || candidates.length === 0) return '';
    if (candidates.length === 1) return candidates[0];
    const normWords = normalise(raw, map).split(' ');
    let best = candidates[0], bestScore = -1;
    for (const c of candidates) {
      const cSet = new Set(normalise(c, map).split(' '));
      const score = normWords.filter(w => cSet.has(w)).length;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  return { expandContractions, normalise, normaliseSingle, buildEquivalenceMaps, closestPhrase };
})();

/* ============================================================
   AppCloze — shared blank-word selection for cloze exercises
   Used by: cloze.js, global-review.js
   ============================================================ */

const AppCloze = (() => {

  // Words that are unsuitable blanks: function words, pronouns, wh-words.
  // This is the single canonical set — edit here to affect both activities.
  const STOP_WORDS = new Set([
    'a','an','the','in','on','at','to','of','is','are','was','were','be','been',
    'have','has','had','do','does','did','will','would','could','should','may',
    'might','must','shall','and','or','but','if','so','yet','for','nor',
    'i','you','he','she','we','they','me','him','her','us','them',
    'my','your','his','its','our','their','this','that','these','those',
    'with','from','by','as','not','no','up','out','it',
    // wh-question words — blanking these produces trivial, non-generative gaps
    'what','when','where','why','who','whom','whose','which','how',
  ]);

  /**
   * Select the word to blank in a phrase.
   * Deterministic: always picks the middle content-word candidate so the
   * same card shows the same gap on every review session.
   *
   * @param {string} phrase - The full English phrase.
   * @returns {{ word: string, clean: string, idx: number, tokens: string[] } | null}
   *   `word`   — original token (may include trailing punctuation)
   *   `clean`  — lowercase, stripped to [a-z'-] only — use for comparison
   *   `idx`    — position in `tokens` array
   *   `tokens` — phrase.split(' ')
   *   Returns null when no blankable word exists in the phrase.
   */
  function pick(phrase) {
    const tokens = phrase.split(' ');
    const candidates = tokens
      .map((w, i) => ({ word: w, idx: i, clean: w.toLowerCase().replace(/[^a-z'-]/g, '') }))
      .filter(t => t.clean.length > 2 && !STOP_WORDS.has(t.clean));

    if (candidates.length === 0) return null;

    const chosen = candidates[Math.floor(candidates.length / 2)];
    return { ...chosen, tokens };
  }

  return { pick };
})();
