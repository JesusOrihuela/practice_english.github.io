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
   * The active target language's fold-preserve set: graphemes that must survive
   * accent-folding because they are DISTINCT LETTERS, not accented vowels
   * (Spanish 'ñ': año ≠ ano). Read from the language profile — no language code
   * is hardcoded here. Empty string ('' = fold everything to ASCII) when there is
   * no profile or the language preserves nothing (English).
   */
  function _foldPreserve() {
    if (typeof AppLangProfiles === "undefined" || typeof AppLangPair === "undefined") return "";
    return AppLangProfiles.foldPreserve(AppLangPair.getActive().target.code);
  }

  /**
   * Fold a string for comparison: lowercase → NFD decompose → strip diacritics
   * → strip non-alphanumeric (except apostrophe and preserved graphemes) →
   * collapse spaces. NFD splits accented letters into base + combining mark
   * (é → e + ◌́); the strip removes the mark, leaving the base letter, so
   * keyboard users type "é" or "e" interchangeably. Any grapheme in `preserve`
   * is shielded from decomposition (e.g. ñ, which NFD would split into n + ◌̃).
   * @param {string} s        - Raw input (any case).
   * @param {string} preserve - Distinct letters to keep intact (e.g. "ñ").
   */
  function _fold(s, preserve) {
    let x = (s || "").toLowerCase();
    const restore = [];
    for (let i = 0; i < preserve.length; i++) {
      const tok = "" + i + "";
      restore.push([tok, preserve[i]]);
      x = x.split(preserve[i]).join(tok);          // shield before NFD
    }
    x = x.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const [tok, ch] of restore) x = x.split(tok).join(ch);   // unshield
    const cls = preserve.replace(/[\\\]^-]/g, "\\$&");            // escape for char class
    return x.replace(new RegExp("[^a-z0-9" + cls + "\\s']", "g"), "")
      .replace(/\s+/g, " ").trim();
  }

  /**
   * Normalise a phrase for comparison. Folds the active target language's accents
   * (preserving its distinct letters), then optionally expands contractions.
   * @param {string}  s    - Raw input (any case).
   * @param {Object} [map] - Contraction map; omit or pass null to skip expansion.
   */
  function normalise(s, map) {
    const stripped = _fold(s, _foldPreserve());
    if (!map) return stripped;
    return expandContractions(stripped, map).replace(/\s+/g, " ").trim();
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

  /**
   * Normalise an alternative entry to a typed object.
   * Strings (legacy format) become { text, type: 'style' }.
   * Objects are returned as-is.
   * @param {string|Object} alt
   * @returns {{ text: string, type: string, hint?: string, region?: string, note?: string }}
   */
  function normaliseAlt(alt) {
    return typeof alt === 'string' ? { text: alt, type: 'style' } : alt;
  }

  return { expandContractions, normalise, normaliseSingle, buildEquivalenceMaps, closestPhrase, normaliseAlt };
})();

/* ============================================================
   AppCloze — shared blank-word selection for cloze exercises
   Used by: cloze.js, global-review.js
   ============================================================ */

const AppCloze = (() => {

  // Words unsuitable as a blank (function words, pronouns, wh-words) are read from
  // the active TARGET language's profile — the blank is in the target language, so
  // a Spanish target doesn't leave the gap on "de"/"la"/"que". Defined per language
  // in shared/js/lang-profiles.js (clozeStopWords); no language code is hardcoded
  // here. 1–2-letter words are already dropped by the length filter below.
  function _stopWords() {
    if (typeof AppLangProfiles === 'undefined' || typeof AppLangPair === 'undefined') return new Set();
    return AppLangProfiles.clozeStopWords(AppLangPair.getActive().target.code);
  }

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
    const stop = _stopWords();
    const tokens = phrase.split(' ');
    const candidates = tokens
      .map((w, i) => ({ word: w, idx: i, clean: w.toLowerCase().replace(/[^a-z'-]/g, '') }))
      .filter(t => t.clean.length > 2 && !stop.has(t.clean));

    if (candidates.length === 0) return null;

    const chosen = candidates[Math.floor(candidates.length / 2)];
    return { ...chosen, tokens };
  }

  return { pick };
})();
