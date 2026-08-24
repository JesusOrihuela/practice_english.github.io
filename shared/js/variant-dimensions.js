/* ============================================================
   variant-dimensions.js — the OPEN, data-driven registry of variant dimensions.

   A "variant dimension" is an axis along which a phrase form or a vocab word can vary: gender,
   region, number, register, loanword — and, for a FUTURE language, anything else it needs
   (grammatical case, noun class, honorifics, evidentiality…). This registry is the ONE place that
   knowledge lives. Adding a dimension (or a value) here makes it valid content, badge-able, and
   completeness-checkable WITH NO CODE CHANGE — the replicability backbone of the variant system.

   Consumed identically by the browser and Node (dual-mode, like lang-profiles.js):
     • tools/check-content.mjs   → validates label keys/values against the registry.
     • shared/js/feedback.js     → orders + renders badges and the post-answer "other variants" list.
     • tools/check-variants.mjs  → per-dimension completeness (which forms must coexist).

   Per dimension:
     kind        'inflectional' (forms of ONE lemma: gender, number — taught together as the
                 agreement pattern) | 'lexical' (DIFFERENT words for the same meaning: region,
                 register, loanword — one PRIMARY form + the rest as tagged recognition variants,
                 to avoid synonym interference — Tinkham 1993/1997, Waring 1997, Webb 2007).
     values      closed value set, OR `open:true` for free strings (region names).
     priority    order in the combined label / badge row (lower first).
     badge       visual style hint: 'gender' (♀/♂ pill) | 'flag' (country flag/cluster/globe) |
                 'pill' (text pill) | 'text'.
     appliesTo   '*' = every language, or a list of language codes that have this dimension.
     agreement   (inflectional only) the elements that MUST co-vary — a gender/number variant must
                 change ALL of these, not just the head word ("el niño listo" → "los niños listos").

   Academic sources (cited in CREDITS.md / docs/ADD-A-LANGUAGE.md): RAE/NGLE (gender, number,
   concordancia), DAMER + DLE (region provenance), pragmatics/sociolinguistics (register / forms of
   address), Tinkham/Waring/Webb (variant presentation).
   ============================================================ */
(function (root) {
  'use strict';

  const DIMENSIONS = {
    loanword: { kind: 'lexical',      open: true,                              priority: 0, badge: 'text',   appliesTo: '*' },
    region:   { kind: 'lexical',      open: true,                              priority: 1, badge: 'flag',   appliesTo: '*' },
    gender:   { kind: 'inflectional', values: ['masculino', 'femenino', 'neutro'], priority: 2, badge: 'gender', appliesTo: ['es'],
                agreement: ['articulo', 'sustantivo', 'adjetivo', 'participio', 'pronombre'] },
    number:   { kind: 'inflectional', values: ['singular', 'plural'],          priority: 3, badge: 'pill',   appliesTo: ['es'],
                agreement: ['articulo', 'sustantivo', 'adjetivo', 'verbo'] },
    register: { kind: 'lexical',      values: ['formal', 'informal'],          priority: 4, badge: 'pill',   appliesTo: '*' },
    // Native near-synonyms for the same concept (hostal/albergue, tarifa/arancel). LEXICAL, so it
    // takes the primary + recognition presentation ("also: albergue") — which is what the synonym-
    // interference research prescribes, unlike showing them as co-equal slash targets. A single
    // token value (the badge reads "también"/"also"). Added data-only — proof the registry is open.
    synonym:  { kind: 'lexical',      values: ['sinónimo'],                    priority: 5, badge: 'pill',   appliesTo: '*' },
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
  };

  if (typeof window !== 'undefined') window.AppVariantDims = AppVariantDims;
  if (typeof module !== 'undefined' && module.exports) module.exports = AppVariantDims;

})(typeof globalThis !== 'undefined' ? globalThis : this);
