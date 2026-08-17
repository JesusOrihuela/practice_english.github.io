/* ============================================================
   lang-profiles.js — Per-language linguistic profile registry
   SINGLE SOURCE OF TRUTH for every language-specific "linguistic fact" the app
   needs. Adding a target language = adding ONE entry here (+ its Node detectors
   in tools/lang-detectors.mjs). No other file hardcodes a language.

   DUAL-MODE (no build step): this is a classic <script> that sets a browser
   global (window.AppLangProfiles) AND exports for Node (module.exports), so the
   browser modules (text-utils, grammar-chip, quiz) and the Node tools
   (coverage.mjs, check-lang-profiles.mjs) read the exact same data.

   ── Profile schema (per target-language code) ──────────────────────────────
   PROFILES[code] = {
     name            : string   — English name of the language (docs/validator).
     foldPreserve    : string   — graphemes that survive accent-folding because
                                   they are DISTINCT LETTERS, not accented vowels
                                   (Spanish 'ñ': año ≠ ano). '' = fold everything
                                   to ASCII (English). See normalise() in text-utils.
     clozeStopWords  : string[] — words unsuitable as a cloze blank (function
                                   words, pronouns, wh-words). The blank must fall
                                   on a CONTENT word for the generation effect
                                   (Slamecka & Graf 1978) to do real work.
     functionWords   : string[] — closed-class words (articles, pronouns,
                                   prepositions, conjunctions, determiners,
                                   auxiliaries, grammatical adverbs). Excluded from
                                   the VOCAB coverage channel: they are acquired
                                   through exposure in phrases, not as flashcards
                                   (Nation 2001). A superset — only members present
                                   in the top-1000 matter.
     ignoreTokens    : string[] — tokenisation artifacts / non-teachable tokens
                                   (contraction fragments, OCR/list markers, corpus
                                   proper nouns) excluded from BOTH coverage
                                   channels so the metric is not unfairly penalised.
     grammarTipLabels: [RegExp, label, ruleId][] — maps an authored `grammar` tip
                                   (written in THIS language) to a grammar-rules.json
                                   rule id, for the learning-mode chip. Most-specific
                                   pattern first. ruleId null → recognised structure
                                   with no rule → no chip. (Browser: grammar-chip.js.)
     frequency       : { list, cefrGraded, committed, note } — which pedagogical
                                   frequency list governs the coverage gate for this
                                   language, and whether it ships in CI. Metadata for
                                   the validator + docs; the loader lives in
                                   coverage.mjs (list-specific parsing).
   }

   COGNATES[a|b] (a,b sorted) = [engSuffix, otherSuffix][] — suffix pairs where a
   word in language a and its translation in language b share a root
   (education/educación). Used by Quiz to force cognates into definition-mode so
   the question isn't trivial (Laufer & Shmueli 1997). Symmetric.

   Full rationale + pedagogical sources: docs/LANGUAGE-PROFILES.md
   ============================================================ */

;(function (global) {
  'use strict';

  // ── English (en) ──────────────────────────────────────────────
  const en = {
    name: 'English',
    grammaticalGender: false,   // no grammatical gender → no gender-variant enrichment.
    voices: ['af_bella', 'af_heart', 'am_michael', 'bf_emma'],   // TTS voices spoken for this language (audio filename suffixes).
    foldPreserve: '',   // English has no letters that folding would destroy → pure ASCII fold.
    // Cloze blank exclusions (3+ letters; 1–2-letter words are dropped by a length filter).
    clozeStopWords: [
      'a', 'an', 'the', 'in', 'on', 'at', 'to', 'of', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
      'might', 'must', 'shall', 'and', 'or', 'but', 'if', 'so', 'yet', 'for', 'nor',
      'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
      'with', 'from', 'by', 'as', 'not', 'no', 'up', 'out', 'it',
      // wh-question words — blanking these produces trivial, non-generative gaps
      'what', 'when', 'where', 'why', 'who', 'whom', 'whose', 'which', 'how',
    ],
    // Closed-class function words excluded from the VOCAB coverage denominator.
    functionWords: [
      // articles / determiners / quantifiers
      'a', 'an', 'the', 'this', 'that', 'these', 'those', 'each', 'every', 'either', 'neither', 'another', 'other', 'such',
      'all', 'both', 'some', 'any', 'no', 'none', 'much', 'many', 'more', 'most', 'less', 'least', 'few', 'several', 'enough', 'half',
      // pronouns
      'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
      'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves',
      'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever', 'whichever', 'one', 'ones',
      'someone', 'somebody', 'something', 'anyone', 'anybody', 'anything', 'everyone', 'everybody', 'everything', 'nobody', 'nothing', 'else',
      // prepositions
      'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'about', 'into', 'onto', 'over', 'under', 'above', 'below',
      'between', 'among', 'through', 'during', 'before', 'after', 'since', 'until', 'till', 'against', 'toward', 'towards',
      'upon', 'within', 'without', 'throughout', 'despite', 'except', 'besides', 'beyond', 'behind', 'beneath', 'beside',
      'across', 'along', 'around', 'round', 'off', 'out', 'up', 'down', 'near', 'per', 'via', 'than', 'as', 'unto',
      // conjunctions
      'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'because', 'while', 'whereas', 'although', 'though', 'unless', 'whether',
      'once', 'when', 'whenever', 'where', 'wherever', 'why', 'how', 'plus',
      // auxiliaries / modals
      'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'ought', 'dare', 'used',
      // negation / affirmation
      'not', 'yes', 'yeah', 'yep', 'nope',
      // grammatical adverbs / connectors
      'there', 'here', 'now', 'then', 'very', 'just', 'only', 'also', 'even', 'too', 'still', 'quite', 'rather', 'already',
      'almost', 'always', 'never', 'ever', 'often', 'sometimes', 'usually', 'seldom', 'rarely', 'however', 'therefore',
      'thus', 'hence', 'perhaps', 'maybe', 'instead', 'indeed', 'anyway', 'anyhow', 'moreover', 'furthermore',
      'nevertheless', 'again', 'soon', 'otherwise', 'meanwhile', 'likewise', 'somewhat', 'somehow',
      'everywhere', 'anywhere', 'somewhere', 'nowhere', 'elsewhere',
    ],
    // Tokenisation/interjection artifacts (English contraction fragments + fillers).
    ignoreTokens: [
      "'s", "'t", "'m", "'re", "'ll", "'ve", "'d", 's', 't', 'm', 're', 'll', 've', 'd', 'don', 'doesn', 'didn', 'isn', 'aren', 'wasn', 'won', 'can', 'couldn', 'wouldn', 'shouldn',
      'oh', 'uh', 'ah', 'eh', 'mmm', 'hmm', 'yeah', 'yep', 'nope', 'huh', 'wow', 'ok', 'okay',
    ],
    // Authored English tip → English rule id (most specific first).
    grammarTipLabels: [
      [/present perfect continuous/i, 'Present Perfect Continuous', null],
      [/present perfect/i,            'Present Perfect',            'present_perfect_experience'],
      [/past perfect/i,               'Past Perfect',               'past_perfect'],
      [/past continuous/i,            'Past Continuous',            'past_continuous'],
      [/present continuous/i,         'Present Continuous',         'present_continuous_now'],
      [/present simple/i,             'Present Simple',             'present_simple_habits'],
      [/simple past/i,                'Simple Past',                'simple_past'],
      [/will\b.*going to|going to.*\bwill/i, 'will vs. going to',   'future_will_going_to'],
      [/first conditional/i,          'First Conditional',          'conditional_first'],
      [/second conditional/i,         'Second Conditional',         'conditional_second'],
      [/third conditional/i,          'Third Conditional',          'conditional_third'],
      [/zero conditional/i,           'Zero Conditional',           'conditional_zero'],
      [/conditional/i,                'Conditionals',               'conditional_first'],
      [/passive/i,                    'Passive Voice',              'passive_present_simple'],
      [/'would'/i,                    'Modal: would',               null],
      [/could be better/i,            'Idiomatic expression',       null],
      [/intensifier/i,                'Intensifier',                null],
      [/must\b|have to/i,             'must / have to',             'modal_must_obligation'],
      [/should/i,                     'should',                     'modal_should_advice'],
      [/\bcan\b|\bcould\b/i,          'can / could',                'modal_can_ability'],
      [/modal/i,                      'Modal Verbs',                'modal_can_ability'],
      [/idiomatic phrasal/i,          'Idiomatic Phrasal Verbs',    'phrasal_idiomatic'],
      [/phrasal verb/i,               'Phrasal Verbs',              'phrasal_common'],
      [/gerund/i,                     'Verb + Gerund',              'verb_gerund'],
      [/infinitive/i,                 'Verb + Infinitive',          'verb_infinitive'],
      [/wh.question/i,                'Wh- Questions',              'questions_wh'],
      [/comparative/i,                'Comparatives',               'comparatives_short'],
      [/preposition.*time/i,          'Prepositions of Time',       'prepositions_time'],
      [/preposition.*place/i,         'Prepositions of Place',      'prepositions_place'],
      [/preposition/i,                'Prepositions',               'prepositions_time'],
      [/\ba\/an\b|article.*a\b/i,     'A / An',                     'article_a_an'],
      [/\bthe\b.*article|article.*\bthe\b/i, 'The',                 'article_the'],
      [/zero article/i,               'Zero Article',               'article_zero'],
    ],
    frequency: {
      list: 'NGSL',
      cefrGraded: false,
      committed: true,   // NGSL ships in the repo → the English gate runs in CI.
      note: 'New General Service List (Browne et al.) — 2801 curated learner lemmas.',
    },
  };

  // ── Spanish (es) ──────────────────────────────────────────────
  const es = {
    name: 'Spanish',
    grammaticalGender: true,   // masc/fem agreement → gender-variant enrichment applies (Rule 10).
    voices: ['ef_dora', 'em_alex', 'em_santa'],   // TTS voices spoken for this language (audio filename suffixes).
    foldPreserve: 'ñ',   // 'ñ' is a distinct letter (año ≠ ano); fold á→a etc. but keep ñ.
    // Spanish function words in UNACCENTED form (the fold step removes accents first).
    clozeStopWords: [
      'los', 'las', 'una', 'unos', 'unas', 'del',
      'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hasta', 'desde', 'hacia',
      'que', 'como', 'cuando', 'donde', 'porque', 'pero', 'sino', 'pues', 'aunque',
      'sus', 'mis', 'tus', 'nos', 'les',
      'esta', 'estan', 'ser', 'estar', 'hay', 'muy', 'mas', 'tan', 'solo',
      'este', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'esto', 'eso',
      'ella', 'ellos', 'ellas', 'usted', 'ustedes', 'nosotros', 'vosotros',
      // question words (unaccented after folding)
      'quien', 'cual', 'cuanto', 'cuantos',
    ],
    functionWords: [
      // artículos / determinantes / cuantificadores
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'uno',
      'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'esto', 'eso', 'aquello',
      'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'mismos', 'mismas',
      'cada', 'alguno', 'alguna', 'algunos', 'algunas', 'ninguno', 'ninguna', 'ningún', 'cualquier', 'cualquiera',
      'tanto', 'tanta', 'tantos', 'tantas', 'mucho', 'mucha', 'muchos', 'muchas', 'poco', 'poca', 'pocos', 'pocas',
      'demasiado', 'demasiada', 'demasiados', 'demasiadas', 'varios', 'varias', 'tal', 'tales', 'demás', 'ambos', 'ambas', 'bastante',
      // posesivos
      'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras',
      'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas',
      // pronombres
      'yo', 'tú', 'él', 'ella', 'ello', 'ellos', 'ellas', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'usted', 'ustedes',
      'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'mí', 'ti', 'sí', 'conmigo', 'contigo', 'consigo', 'vos',
      'alguien', 'nadie', 'algo', 'nada', 'quien', 'quienes', 'cuyo', 'cuya', 'cuyos', 'cuyas',
      // interrogativos
      'qué', 'quién', 'quiénes', 'cuál', 'cuáles', 'cómo', 'cuándo', 'dónde', 'cuánto', 'cuánta', 'cuántos', 'cuántas',
      // preposiciones
      'de', 'a', 'en', 'con', 'por', 'para', 'sobre', 'sin', 'desde', 'hasta', 'entre', 'hacia', 'según', 'tras', 'ante',
      'contra', 'durante', 'bajo', 'mediante', 'salvo', 'excepto', 'junto',
      // conjunciones
      'y', 'e', 'o', 'u', 'que', 'pero', 'si', 'porque', 'como', 'cuando', 'aunque', 'mientras', 'pues', 'ni', 'sino', 'mas', 'embargo', 'además',
      // auxiliares / modales
      'haber', 'poder', 'deber',
      // adverbios gramaticales / conectores / negación / afirmación
      'no', 'sí', 'más', 'menos', 'muy', 'ya', 'ahora', 'aquí', 'allí', 'ahí', 'allá', 'acá', 'arriba', 'abajo',
      'siempre', 'nunca', 'jamás', 'también', 'tampoco', 'así', 'tan', 'casi', 'luego', 'entonces', 'después', 'antes',
      'todavía', 'aún', 'quizá', 'quizás', 'incluso', 'solo', 'sólo', 'bien', 'apenas', 'adelante', 'atrás', 'pronto',
      'enseguida', 'encima', 'debajo', 'delante', 'detrás', 'dentro', 'fuera', 'cerca', 'lejos', 'alrededor',
    ],
    // ELELex top-1000 artifacts that are not teachable content words: single-letter
    // list markers (b, c, d), corpus proper nouns (requena, raulito), and honorific/
    // dialectal tokens that are not general vocabulary.
    ignoreTokens: [
      'b', 'c', 'd', 'requena', 'raulito', 'san', 'don', 'doña', 'vos', 'inca',
    ],
    // Authored Spanish tip → Spanish rule id (most specific first).
    grammarTipLabels: [
      [/subjuntivo imperfecto|imperfecto de subjuntivo|gustara|subjuntivo perfecto|haya \+ participio|haya [a-z]+(ado|ido)/i, 'Subjuntivo (imperfecto/perfecto)', 'imperfecto_subjuntivo'],
      [/aunque \+ subjuntivo|para que \+ subjuntivo|a menos que|con tal de que|sin que|hay algo que \+ subjuntivo/i, 'Subjuntivo (avanzado)', 'subjuntivo_avanzado'],
      [/subjuntivo/i,                 'Subjuntivo',                 'subjunctive_present_wishes'],
      [/pasiva/i,                     'Voz pasiva',                 'voz_pasiva'],
      [/pluscuamperfecto/i,           'Pluscuamperfecto',           'pluscuamperfecto'],
      [/pret[eé]rito perfecto|he estado|he tenido/i, 'Pretérito perfecto', 'preterito_perfecto'],
      [/futuro perfecto/i,            'Futuro perfecto',            'futuro_perfecto'],
      [/(pret[eé]rito )?imperfecto/i, 'Pretérito imperfecto',       'imperfect_habits_descriptions'],
      [/pret[eé]rito/i,               'Pretérito',                  'preterite_regular'],
      [/condicional|deber[ií]a|deber[ií]amos/i, 'Condicional',      'condicional_simple'],
      [/futuro/i,                     'Futuro',                     'futuro_simple'],
      [/reflexiv|encl[ií]tico|levantarse|sentirse|inscribirse|parecerse|llevarse bien|me siento|me levanto|lávate/i, 'Verbos reflexivos', 'reflexive_verbs_daily_routine'],
      [/gustar|doler funciona como|me duele/i, 'Verbo como gustar', 'gustar_structure'],
      [/'lo que'|nominaliza|cl[aá]usula relativa|relativo|cuyo|'que' introduce/i, 'Cláusulas de relativo', 'clausulas_relativo'],
      [/para \+ infinitivo|'para que'|finalidad|prop[oó]sito/i, "'para' (finalidad)", 'para_purpose_destination'],
      [/'por' (expresa|indica)|por (causa|medio|duraci)/i, "'por' (causa/medio)", 'por_cause_means_duration'],
      [/marcador|no solo\.\.\. sino|sin embargo|por lo tanto/i, 'Marcadores del discurso', 'marcadores_discursivos'],
      [/estilo indirecto|discurso indirecto/i, 'Estilo indirecto', 'estilo_indirecto'],
      [/'estar'.*estado|'estar' expresa|estar \+ participio|'estás?'/i, "'estar'", 'estar_location_states'],
      [/'ser'.*(cualidad|identidad)|'ser' expresa|'es' expresa|'ser de'|se usa 'ser'|con 'ser'|'ser' sin art[ií]culo|para profesiones/i, "'ser'", 'ser_estar_adjectives'],
      [/interrogativ|'cu[aá]l'|palabras? de pregunta/i, 'Interrogativos', 'question_words'],
      [/g[eé]nero|concuerda en (g[eé]nero|singular|plural)/i, 'Concordancia', 'gender_adjective_agreement'],
    ],
    frequency: {
      list: 'ELELex',
      cefrGraded: true,
      committed: false,  // ELELex is CC BY-NC-SA → Spanish gate runs LOCAL ONLY.
      note: 'ELELex (CEFRLex, François et al.) — CEFR-graded Spanish lemma list.',
    },
  };

  const PROFILES = { en, es };

  // Cognate suffix pairs, keyed by the two language codes SORTED and joined with
  // '|'. Each pair is [suffixInLangA, suffixInLangB] following the sorted order.
  // Symmetric — Quiz tries both directions. (en|es sorted → 'en|es': [en, es].)
  const COGNATES = {
    'en|es': [
      ['tion', 'cion'], ['ty', 'dad'], ['ous', 'o'], ['ous', 'oso'],
      ['ate', 'ar'], ['ize', 'izar'], ['ise', 'izar'], ['al', 'al'], ['ble', 'ble'],
      ['ent', 'ente'], ['ant', 'ante'], ['ic', 'ico'], ['ical', 'ico'], ['ly', 'mente'],
    ],
  };

  // ── Public API ────────────────────────────────────────────────
  const AppLangProfiles = {
    /** Raw profile object for a language code (or undefined). */
    get: function (code) { return PROFILES[code]; },
    /** All registered language codes. */
    codes: function () { return Object.keys(PROFILES); },
    /** Graphemes to preserve during accent-folding ('' if none). */
    foldPreserve: function (code) { const p = PROFILES[code]; return p ? (p.foldPreserve || '') : ''; },
    /** Cloze blank-exclusion set (falls back to empty). */
    clozeStopWords: function (code) { const p = PROFILES[code]; return new Set(p ? p.clozeStopWords : []); },
    /** Closed-class function-word set (coverage vocab channel). */
    functionWords: function (code) { const p = PROFILES[code]; return new Set(p ? p.functionWords : []); },
    /** Non-teachable artifact set (coverage both channels). */
    ignoreTokens: function (code) { const p = PROFILES[code]; return new Set(p ? p.ignoreTokens : []); },
    /** Authored-tip → rule-id label table (grammar chip). */
    grammarTipLabels: function (code) { const p = PROFILES[code]; return p ? p.grammarTipLabels : []; },
    /** Cognate suffix pairs for two languages, oriented [aSuffix, bSuffix] for the
     *  GIVEN (a, b) argument order (the stored table is normalised internally). */
    cognateSuffixes: function (a, b) {
      const key = [a, b].sort().join('|');
      const table = COGNATES[key];
      if (!table) return [];
      // Stored order follows the sorted key; re-orient to caller's (a, b).
      return (a <= b) ? table : table.map(function (pair) { return [pair[1], pair[0]]; });
    },
  };

  // Browser: expose as a global (classic script, no bundler).
  if (typeof window !== 'undefined') window.AppLangProfiles = AppLangProfiles;
  // Node (CommonJS): export for the tools. The window guard above is skipped.
  if (typeof module !== 'undefined' && module.exports) module.exports = AppLangProfiles;

})(typeof globalThis !== 'undefined' ? globalThis : this);
