/* ============================================================
   variant-dimensions.js — the OPEN, data-driven registry of variant dimensions.

   A "variant dimension" is an axis along which a phrase form or a vocab word can vary: gender,
   region, register, loanword — and, for a FUTURE language, anything else it needs (number for a
   language whose plural is more than "+s", grammatical case, noun class, honorifics, evidentiality…).
   This registry is the ONE place that
   knowledge lives. Adding a dimension (or a value) here makes it valid content, badge-able, and
   completeness-checkable WITH NO CODE CHANGE — the replicability backbone of the variant system.

   Consumed identically by the browser and Node (dual-mode, like lang-profiles.js):
     • tools/check-content.mjs   → validates label keys/values against the registry.
     • shared/js/feedback.js     → orders + renders badges and the post-answer "other variants" list.
     • tools/check-variants.mjs  → per-dimension completeness (which forms must coexist).

   Per dimension:
     kind        'inflectional' (forms of ONE lemma, e.g. gender — taught together as the
                 agreement pattern) | 'lexical' (DIFFERENT words for the same meaning: region,
                 register, loanword — one PRIMARY form + the rest as tagged recognition variants,
                 to avoid synonym interference — Tinkham 1993/1997, Waring 1997, Webb 2007).
     values      closed value set, OR `open:true` for free strings (region names).
     priority    order in the combined label / badge row (lower first).
     badge       visual style hint: 'gender' (♀/♂ pill) | 'flag' (country flag/cluster/globe) |
                 'pill' (text pill) | 'text'.
     appliesTo   '*' = every language, or a list of language codes that have this dimension.
     agreement   (inflectional only) the elements that MUST co-vary — a gender variant must
                 change ALL of these, not just the head word ("el niño listo" → "la niña lista").

   Academic sources (cited in CREDITS.md / docs/ADD-A-LANGUAGE.md): RAE/NGLE (gender, number,
   concordancia), DAMER + DLE (region provenance), pragmatics/sociolinguistics (register / forms of
   address), Tinkham/Waring/Webb (variant presentation).
   ============================================================ */
(function (root) {
  'use strict';

  const DIMENSIONS = {
    loanword: { kind: 'lexical',      open: true,                              priority: 0, badge: 'text',   appliesTo: '*' },
    region:   { kind: 'lexical',      open: true,                              priority: 1, badge: 'flag',   appliesTo: '*' },
    gender:   { kind: 'inflectional', values: ['masculino', 'femenino', 'neutro'], priority: 2, badge: 'gender', appliesTo: ['es', 'de'],
                agreement: ['articulo', 'sustantivo', 'adjetivo', 'participio', 'pronombre'] },
    // NUMBER (singular/plural) — a content dimension only where the plural is more than a bare "+s"
    // and drives real agreement (German: article + noun umlaut/ending + adjective + verb all co-vary,
    // das Kind ist → die Kinder sind). Added data-only for the en-de stress-test pair.
    number:   { kind: 'inflectional', values: ['singular', 'plural'],          priority: 3, badge: 'pill',   appliesTo: ['de'],
                agreement: ['artikel', 'nomen', 'adjektiv', 'verb'] },
    // CASE (grammatical case) — inflectional axis a language marks on the noun/article/adjective.
    // Value names are LANGUAGE-SPECIFIC (German der→den accusative; Finnish talo→talossa inessive),
    // so the closed set is the UNION of the case systems in use — German's 4 + Finnish's (a minimal
    // slice of its 15: nominative, partitive, genitive, inessive). appliesTo gates which language may
    // use the dimension at all; the union of values is harmless because no pair authors another
    // language's case names. A NEW dimension proving the registry is open: no consumer hardcodes it.
    case:     { kind: 'inflectional',
                values: ['nominativ', 'akkusativ', 'dativ', 'genitiv',
                         'nominatiivi', 'partitiivi', 'genetiivi', 'inessiivi'],
                priority: 4, badge: 'pill', appliesTo: ['de', 'fi'],
                agreement: ['artikel', 'adjektiv', 'pronomen'] },
    register: { kind: 'lexical',      values: ['formal', 'informal'],          priority: 5, badge: 'pill',   appliesTo: '*' },
    // Native near-synonyms for the same concept (hostal/albergue, tarifa/arancel). LEXICAL, so it
    // takes the rotation + recognition presentation ("also: albergue") — which is what the synonym-
    // interference research prescribes, unlike showing them as co-equal slash targets. A single
    // token value (the badge reads "también"/"also"). Added data-only — proof the registry is open.
    synonym:  { kind: 'lexical',      values: ['sinónimo'],                    priority: 6, badge: 'pill',   appliesTo: '*' },
    // A FUTURE language adds its own axes HERE, data-only (proven by the openness test):
    // noun class, honorifics, evidentiality, aspect… Not defined until a language actually uses it —
    // so the registry never advertises a dimension with zero content.
  };

  const AppVariantDims = {
    /** The raw registry (read-only use). */
    all: function () { return DIMENSIONS; },
    /** Every dimension id (drives label-key validation). */
    keys: function () { return Object.keys(DIMENSIONS); },
    has: function (d) { return Object.prototype.hasOwnProperty.call(DIMENSIONS, d); },
    /** Closed value set for a dimension, or null when the dimension is open (free strings). */
    values: function (d) { return (DIMENSIONS[d] && DIMENSIONS[d].values) || null; },
    isOpen: function (d) { return !!(DIMENSIONS[d] && DIMENSIONS[d].open); },
    kind: function (d) { return DIMENSIONS[d] ? DIMENSIONS[d].kind : null; },
    priority: function (d) { return DIMENSIONS[d] && DIMENSIONS[d].priority != null ? DIMENSIONS[d].priority : 99; },
    badge: function (d) { return DIMENSIONS[d] ? DIMENSIONS[d].badge : 'text'; },
    agreement: function (d) { return (DIMENSIONS[d] && DIMENSIONS[d].agreement) || []; },
    /** True if `lang` has this dimension ('*' applies to all). */
    appliesTo: function (d, lang) {
      const a = DIMENSIONS[d] && DIMENSIONS[d].appliesTo;
      return a === '*' || (Array.isArray(a) && a.indexOf(lang) !== -1);
    },
    /** Dimension ids ordered by priority (badge row / combined label order). */
    ordered: function () {
      return Object.keys(DIMENSIONS).sort(function (a, b) {
        return (DIMENSIONS[a].priority != null ? DIMENSIONS[a].priority : 99) -
               (DIMENSIONS[b].priority != null ? DIMENSIONS[b].priority : 99);
      });
    },
    /** Is a value valid for a dimension? (open dims accept any non-empty string.) */
    isValidValue: function (d, v) {
      if (!DIMENSIONS[d]) return false;
      if (DIMENSIONS[d].open) return typeof v === 'string' && v.trim() !== '';
      return (DIMENSIONS[d].values || []).indexOf(v) !== -1;
    },
    /** Validate a labels object against the registry — the ONE validator both check-content and
        the openness test call, so a dimension added here is accepted with zero validator code.
        When `lang` (the target-language code) is given, also enforces `appliesTo`: a dimension the
        language does not declare is rejected (e.g. `number` on Spanish). Returns [] when clean,
        else [{ key, value, code:'unknown-key'|'not-applicable'|'invalid-value' }]. */
    validateLabels: function (labels, lang) {
      const errs = [];
      for (const key of Object.keys(labels || {})) {
        const value = labels[key];
        if (!this.has(key)) { errs.push({ key: key, value: value, code: 'unknown-key' }); continue; }
        if (lang && !this.appliesTo(key, lang)) { errs.push({ key: key, value: value, code: 'not-applicable' }); continue; }
        if (!this.isOpen(key) && !this.isValidValue(key, value)) errs.push({ key: key, value: value, code: 'invalid-value' });
      }
      return errs;
    },
  };

  if (typeof window !== 'undefined') window.AppVariantDims = AppVariantDims;
  if (typeof module !== 'undefined' && module.exports) module.exports = AppVariantDims;

})(typeof globalThis !== 'undefined' ? globalThis : this);
