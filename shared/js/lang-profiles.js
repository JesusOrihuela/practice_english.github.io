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
     nativeChars     : string   — non-ASCII letters/marks the language legitimately
                                   uses (lowercase). A target-language text field with
                                   a non-ASCII letter OUTSIDE this set is a wrong-language
                                   signal (check-content R11 tip check). '' = pure ASCII.
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
    // SOURCE-side gender: words that, when they appear in a SOURCE (L1) hint, FIX a person's gender
    // (a gendered pronoun/kinship/role/title), so a single-gender target rendering is a faithful
    // translation, not a missing variant (Rule 10/14.4). Read by check-variants sourceFixesGender()
    // keyed by the pair's SOURCE language — NOT hardcoded in the tool. `nounsCapitalized:false` ⇒ a
    // mid-sentence Capital reliably marks a proper name (which also fixes gender).
    sourceGender: {
      nounsCapitalized: false,
      fixWords: ['he', 'him', 'his', 'she', 'her', 'hers', 'son', 'daughter', 'brother', 'sister',
        'uncle', 'aunt', 'husband', 'wife', 'boyfriend', 'girlfriend', 'grandmother', 'grandfather',
        'grandma', 'grandpa', 'grandson', 'granddaughter', 'granny', 'mother', 'father', 'mom', 'mum',
        'dad', 'nephew', 'niece', 'king', 'queen', 'prince', 'princess', 'actor', 'actress', 'waiter',
        'waitress', 'host', 'hostess', 'widow', 'widower', 'groom', 'bride', 'boy', 'girl', 'man',
        'men', 'woman', 'women', 'lady', 'ladies', 'gentleman', 'guy', 'sir', 'madam', 'mister',
        'mrs', 'mr', 'ms', 'monk', 'nun'],
    },
    voices: ['af_bella', 'af_heart', 'am_michael', 'bf_emma'],   // TTS voices spoken for this language (audio filename suffixes).
    tts: { engine: 'kokoro' },   // audio generator: 'kokoro' (generate-audio.mjs) | 'edge' (generate-audio-tgt.py)
    foldPreserve: '',   // English has no letters that folding would destroy → pure ASCII fold.
    nativeChars: '',   // non-ASCII letters/marks this language legitimately uses (lowercase); English is pure ASCII, so any accented/¿¡ char in an English text field is a wrong-language signal (check-content R11).
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
      gateIndex: 'ngsl-en.json',   // committed derived index the coverage GATE reads (CI)
      gateFloor: 86,               // CI floor: cover ≥ this % of the top-1000 in both channels
    },
  };

  // ── Spanish (es) ──────────────────────────────────────────────
  const es = {
    name: 'Spanish',
    grammaticalGender: true,   // masc/fem agreement → gender-variant enrichment applies (Rule 10).
    voices: ['ef_dora', 'em_alex', 'em_santa'],   // TTS voices spoken for this language (audio filename suffixes).
    tts: { engine: 'edge' },   // audio generator: 'kokoro' (generate-audio.mjs) | 'edge' (generate-audio-tgt.py)
    foldPreserve: 'ñ',   // 'ñ' is a distinct letter (año ≠ ano); fold á→a etc. but keep ñ.
    nativeChars: 'áéíóúüñ¿¡',   // non-ASCII letters/marks Spanish legitimately uses (lowercase, incl. inverted marks); other non-ASCII letters in Spanish text signal a wrong-language slip (check-content R11).
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
      list: 'PCIC (Instituto Cervantes)',
      cefrGraded: true,
      committed: true,   // committeable index (public reference) → Spanish gate runs in CI.
      note: 'PCIC Inventario de nociones (A1-B2) — membresía + grado CEFR (referencia pública ' +
            'Instituto Cervantes); orden intra-nivel por FrequencyWords (CC BY-SA). Build: ' +
            'tools/sources/build-pcic-core.py. Es la única lista curada+committeable+CEFR del es.',
      gateIndex: 'es-core.json',   // committed derived index the coverage GATE reads (CI)
      // The top-1000 is the official A1-A2 vocabulary curriculum (CEFR-first ordering). Live
      // coverage is ~67%/51% today; the north-star is the 88% sweet-spot (comunicación cotidiana).
      // gateFloor is a RATCHET (regression guard just below live) that we raise as content grows.
      // Live (Aug 2026): vocab 88.2%, phrases 89.1% — BOTH channels reached the 88% sweet spot, so
      // the floor now sits at 86 (just below live, matching English), guarding the milestone.
      gateFloor: 86,
      targetFloor: 88,   // north-star coverage the ongoing content curation builds toward.
      // ELELex (CEFR-graded, CC BY-NC-SA) is NOT committeable → stays a LOCAL-only cross-check
      // shown when tools/sources/derived/elelex-es.json exists. It is NOT the gate.
      localIndex: 'elelex-es.json',
    },
  };

  // ── German (de) — STRESS-TEST target (en-de), intentionally minimal/non-shippable ──
  const de = {
    name: 'German',
    grammaticalGender: true,   // der/die/das + person -in → gender-variant enrichment applies.
    // SOURCE-side gender (German as L1 hint, e.g. de-pl). `nounsCapitalized:true` ⇒ German capitalizes
    // ALL nouns, so a mid-sentence Capital is NOT a proper-name signal (the English heuristic must be
    // skipped). fixWords = gendered pronouns/kinship/roles/titles that fix a person's gender; the
    // ambiguous bare pronouns (sie=she/they/formal-you, ihr=her/you-pl) and 'sein' (=his / verb "to be")
    // are deliberately EXCLUDED — a German "she" context reliably carries a feminine noun that IS listed
    // (Schwester, Frau, Ärztin…), so dropping them avoids false negatives without losing coverage.
    sourceGender: {
      nounsCapitalized: true,
      fixWords: ['er', 'ihn', 'ihm', 'bruder', 'schwester', 'onkel', 'tante', 'ehemann', 'ehefrau',
        'mann', 'frau', 'freund', 'freundin', 'großmutter', 'großvater', 'oma', 'opa', 'enkel',
        'enkelin', 'mutter', 'vater', 'mama', 'papa', 'neffe', 'nichte', 'sohn', 'tochter', 'könig',
        'königin', 'prinz', 'prinzessin', 'herr', 'dame', 'junge', 'mädchen', 'witwe', 'witwer',
        'bräutigam', 'braut', 'kellner', 'kellnerin', 'lehrer', 'lehrerin', 'arzt', 'ärztin',
        'schauspieler', 'schauspielerin', 'student', 'studentin'],
    },
    voices: ['df_hedda', 'dm_conrad'],   // edge-tts de-DE voices (see generate-audio-tgt.py).
    tts: { engine: 'edge' },
    // Umlauts and ß are phonemic/meaning-bearing (schon≠schön, Straße): preserve them as distinct
    // letters so answer-checking stays strict, exactly like Spanish keeps ñ. (ae/oe/ue/ss keyboard
    // fallbacks are a future UX refinement, out of scope for the stress-test pair.)
    foldPreserve: 'äöüß',
    nativeChars: 'äöüß',
    // Cloze must blank a CONTENT word, never these closed-class German words.
    clozeStopWords: [
      'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines', 'kein', 'keine',
      'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'ihn', 'uns', 'euch', 'mir', 'dir', 'ihm', 'ihnen', 'man',
      'mein', 'dein', 'sein', 'unser', 'euer',
      'und', 'oder', 'aber', 'denn', 'sondern', 'weil', 'dass', 'wenn', 'ob', 'als', 'damit', 'obwohl',
      'in', 'an', 'auf', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen', 'mit', 'ohne', 'für', 'gegen',
      'um', 'durch', 'aus', 'bei', 'nach', 'seit', 'von', 'zu', 'bis',
      'bin', 'bist', 'ist', 'sind', 'seid', 'habe', 'hast', 'hat', 'haben',
      'nicht', 'nur', 'auch', 'schon', 'noch', 'sehr',
      // wh-words — blanking these yields trivial gaps
      'was', 'wann', 'wo', 'wer', 'wie', 'warum', 'welche', 'welcher', 'welches',
    ],
    // Closed-class German words excluded from the VOCAB coverage denominator.
    functionWords: [
      // Artikel / Determinative
      'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
      'kein', 'keine', 'keinen', 'keinem', 'keiner', 'dieser', 'diese', 'dieses', 'diesen', 'diesem',
      'jeder', 'jede', 'jedes', 'jeden', 'jener', 'jene', 'jenes', 'welcher', 'welche', 'welches',
      'alle', 'alles', 'viele', 'viel', 'wenige', 'wenig', 'manche', 'einige', 'mehr', 'weniger',
      // Pronomen
      'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'ihn', 'uns', 'euch',
      'mir', 'dir', 'ihm', 'ihnen', 'ihrer', 'seiner', 'man', 'jemand', 'niemand', 'etwas', 'nichts',
      'mein', 'meine', 'dein', 'deine', 'sein', 'seine', 'unser', 'unsere', 'euer', 'eure',
      // Präpositionen
      'in', 'an', 'auf', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen', 'mit', 'ohne', 'für',
      'gegen', 'um', 'durch', 'aus', 'bei', 'nach', 'seit', 'von', 'zu', 'bis', 'ab', 'gegenüber',
      'trotz', 'während', 'wegen', 'statt', 'innerhalb', 'außerhalb',
      // Konjunktionen
      'und', 'oder', 'aber', 'denn', 'sondern', 'weil', 'dass', 'wenn', 'als', 'ob', 'damit', 'obwohl',
      'sowie', 'sowohl', 'entweder', 'weder', 'noch', 'falls', 'sobald', 'solange', 'bevor', 'nachdem',
      // Hilfs- / Modalverben
      'bin', 'bist', 'ist', 'sind', 'seid', 'war', 'waren', 'sein', 'habe', 'hast', 'hat', 'haben', 'hatte', 'hatten',
      'werde', 'wirst', 'wird', 'werden', 'wurde', 'wurden', 'kann', 'kannst', 'können', 'konnte',
      'muss', 'musst', 'müssen', 'musste', 'will', 'willst', 'wollen', 'wollte', 'soll', 'sollen',
      'darf', 'darfst', 'dürfen', 'mag', 'möchte', 'möchten',
      // Negation / grammatische Adverbien / Partikeln
      'nicht', 'nein', 'ja', 'doch', 'nur', 'auch', 'schon', 'noch', 'sehr', 'hier', 'da', 'dort',
      'jetzt', 'dann', 'immer', 'nie', 'oft', 'manchmal', 'wieder', 'sehr', 'zu', 'so', 'mal', 'etwa',
      'wo', 'was', 'wer', 'wann', 'wie', 'warum', 'wohin', 'woher',
    ],
    ignoreTokens: ['äh', 'ähm', 'hm', 'na', 'tja', 'ach', 'oh'],
    // Authored German tip → German rule id (only ruleIds that exist in en-de/grammar-rules.json).
    grammarTipLabels: [
      [/trennbar|vorsilbe|separable/i, 'Trennbare Verben', 'separable_verbs'],
      [/akkusativ|wen oder was/i, 'Akkusativ', 'akkusativ_articles'],
      [/genus|geschlecht|der, die, das/i, 'Genus', 'gender_articles'],
    ],
    frequency: {
      list: 'Goethe-Institut Wortliste (A1/A2)',
      cefrGraded: true,
      committed: false,
      // STRESS-TEST pair: intentionally minimal, NOT shippable → exempt from the coverage gate
      // (no committed top-1000 index required) until it is promoted to a real, coverage-complete
      // pair. check-lang-profiles + coverage.mjs both honor this flag.
      stressTest: true,
      note: 'Goethe-Institut Zertifikat A1/A2 Wortliste (CEFR-graded, public reference). The full ' +
            'committeable top-1000 index is built when this pair is promoted from stress-test to shippable.',
      gateFloor: 0,
    },
  };

  // ── Finnish (fi) — STRESS-TEST target (en-fi), intentionally minimal/non-shippable ──
  // The OPPOSITE pole to German: NO grammatical gender (the gender-variant path must cleanly
  // skip), and an extreme case system (15 cases; the pair exercises a minimal slice incl. the
  // partitive) with vowel harmony (ä/ö) and agglutination (case endings stack onto the stem).
  const fi = {
    name: 'Finnish',
    grammaticalGender: false,   // Finnish has NO grammatical gender → gender-variant enrichment must skip cleanly.
    voices: ['fif_noora', 'fim_harri'],   // edge-tts fi-FI voices (see generate-audio-tgt.py).
    tts: { engine: 'edge' },
    // ä and ö are distinct front vowels (not accented a/o — talo≠tälö, and vowel harmony depends on
    // them), and å is a letter of the Finnish alphabet (Swedish loans): preserve all three so
    // answer-checking stays strict, exactly like Spanish keeps ñ and German keeps äöüß.
    foldPreserve: 'äöå',
    nativeChars: 'äöå',
    // Cloze must blank a CONTENT word, never these closed-class Finnish words.
    clozeStopWords: [
      'minä', 'sinä', 'hän', 'me', 'te', 'he', 'se', 'ne', 'tämä', 'tuo', 'nämä', 'nuo',
      'minua', 'sinua', 'häntä', 'meitä', 'teitä', 'heitä', 'sitä', 'niitä',
      'minun', 'sinun', 'hänen', 'meidän', 'teidän', 'heidän', 'sen',
      'ja', 'tai', 'sekä', 'mutta', 'vaan', 'että', 'jotta', 'koska', 'kun', 'jos', 'vaikka', 'kuin', 'eli', 'sillä',
      'ei', 'en', 'et', 'emme', 'ette', 'eivät',
      'on', 'ovat', 'olen', 'olet', 'olemme', 'olette', 'oli', 'ollut',
      'myös', 'vain', 'jo', 'vielä', 'nyt', 'sitten', 'aina', 'kyllä', 'ehkä',
      // wh-words — blanking these yields trivial gaps
      'mikä', 'mitä', 'kuka', 'ketä', 'missä', 'mistä', 'mihin', 'milloin', 'miksi', 'miten', 'kuinka', 'kumpi',
    ],
    // Closed-class Finnish words excluded from the VOCAB coverage denominator.
    functionWords: [
      // pronominit (persoona / demonstratiivi / relatiivi / interrogatiivi)
      'minä', 'sinä', 'hän', 'me', 'te', 'he', 'se', 'ne', 'tämä', 'tuo', 'nämä', 'nuo', 'joka', 'mikä', 'kuka', 'itse',
      'minua', 'sinua', 'häntä', 'meitä', 'teitä', 'heitä', 'sitä', 'niitä',
      'minun', 'sinun', 'hänen', 'meidän', 'teidän', 'heidän', 'sen', 'niiden',
      'minulla', 'sinulla', 'hänellä', 'meillä', 'teillä', 'heillä',
      'ketä', 'kenen', 'kumpi', 'jokin', 'joku', 'kaikki', 'moni', 'muu', 'sama', 'toinen',
      // konjunktiot
      'ja', 'tai', 'sekä', 'mutta', 'vaan', 'että', 'jotta', 'koska', 'kun', 'jos', 'vaikka', 'kuin', 'eli', 'sillä', 'joko', 'sekä',
      // kieltoverbi + olla
      'ei', 'en', 'et', 'emme', 'ette', 'eivät', 'älä', 'älkää',
      'on', 'ovat', 'olen', 'olet', 'olemme', 'olette', 'oli', 'olivat', 'ollut', 'olla',
      // adpositiot / partikkelit / adverbit
      'kanssa', 'jälkeen', 'edessä', 'takana', 'alla', 'päällä', 'vieressä', 'luona', 'ilman', 'varten',
      'myös', 'vain', 'jo', 'vielä', 'nyt', 'sitten', 'aina', 'usein', 'joskus', 'koskaan', 'kyllä', 'ehkä', 'niin', 'näin',
      // interrogatiivit
      'mikä', 'mitä', 'missä', 'mistä', 'mihin', 'milloin', 'miksi', 'miten', 'kuinka',
    ],
    ignoreTokens: ['öö', 'hmm', 'aha', 'no', 'niin', 'tuota'],
    // Authored Finnish tip → Finnish rule id (only ruleIds that exist in en-fi/grammar-rules.json).
    grammarTipLabels: [
      [/partitiiv|partitive|osaobjekt/i, 'Partitiivi', 'partitive'],
    ],
    frequency: {
      list: 'Kotus / YKI (A1/A2)',
      cefrGraded: true,
      committed: false,
      // STRESS-TEST pair: intentionally minimal, NOT shippable → exempt from the coverage gate
      // (no committed top-1000 index required) until promoted to a real, coverage-complete pair.
      stressTest: true,
      note: 'Kotimaisten kielten keskus (Kotus) reference grammar + YKI (National Certificate of ' +
            'Language Proficiency) A1/A2 word stock. The committeable top-1000 index is built when ' +
            'this pair is promoted from stress-test to shippable.',
      gateFloor: 0,
    },
  };

  // ── Polish (pl) — STRESS-TEST target (de-pl), intentionally minimal/non-shippable ──
  // The 3rd stress-test target and the first with a NON-en/es SOURCE (German). Polish stresses:
  // grammatical gender (masc/fem/neut, plus masculine animacy), a 7-CASE system (the pair exercises
  // a slice, e.g. the instrumental), verbal ASPECT (perfective/imperfective: robić/zrobić), NO
  // articles, and consonant-heavy orthography with 9 special letters (ą ć ę ł ń ó ś ź ż).
  const pl = {
    name: 'Polish',
    grammaticalGender: true,    // masc/fem/neut agreement → gender-variant enrichment applies + gender-detector block.
    voices: ['plf_zofia', 'plm_marek'],   // edge-tts pl-PL voices (see generate-audio-tgt.py).
    tts: { engine: 'edge' },
    // The 9 Polish special letters are DISTINCT letters (ó≠o phonemically in spelling, ł≠l, etc.), not
    // accented ASCII — preserve them all so answer-checking stays strict (like es keeps ñ, de keeps äöüß).
    foldPreserve: 'ąćęłńóśźż',
    nativeChars: 'ąćęłńóśźż',
    // Cloze must blank a CONTENT word, never these closed-class Polish words.
    clozeStopWords: [
      'ja', 'ty', 'on', 'ona', 'ono', 'my', 'wy', 'oni', 'one',
      'mnie', 'mię', 'ciebie', 'cię', 'jego', 'go', 'jej', 'ją', 'nas', 'was', 'ich', 'im', 'mu',
      'ten', 'ta', 'to', 'ci', 'te', 'tego', 'tej', 'tym',
      'i', 'a', 'ale', 'lub', 'albo', 'oraz', 'czy', 'że', 'żeby', 'aby', 'bo', 'gdy', 'kiedy', 'jeśli', 'jeżeli', 'choć', 'więc', 'ani', 'lecz',
      'nie',
      'jestem', 'jesteś', 'jest', 'jesteśmy', 'jesteście', 'są', 'był', 'była', 'było', 'byli', 'były', 'będę', 'będziesz', 'będzie', 'będą', 'być',
      'w', 'we', 'na', 'do', 'z', 'ze', 'od', 'po', 'przy', 'dla', 'o', 'u', 'za', 'pod', 'nad', 'przed',
      'już', 'tylko', 'jeszcze', 'teraz', 'potem', 'zawsze', 'może', 'tak', 'też', 'także', 'bardzo',
      // wh-words — blanking these yields trivial gaps
      'co', 'kto', 'gdzie', 'dlaczego', 'jak', 'który', 'która', 'które', 'ile',
    ],
    // Closed-class Polish words excluded from the VOCAB coverage denominator.
    functionWords: [
      // zaimki (osobowe / dzierżawcze / wskazujące / względne / pytające)
      'ja', 'ty', 'on', 'ona', 'ono', 'my', 'wy', 'oni', 'one', 'siebie', 'się',
      'mnie', 'mię', 'ciebie', 'cię', 'jego', 'go', 'jej', 'ją', 'nas', 'was', 'ich', 'im', 'mu', 'nam', 'wam',
      'mój', 'moja', 'moje', 'twój', 'twoja', 'nasz', 'wasz', 'swój',
      'ten', 'ta', 'to', 'ci', 'te', 'tamten', 'tamta', 'ów', 'taki', 'taka',
      'który', 'która', 'które', 'jaki', 'jaka', 'jakie', 'czyj',
      'co', 'kto', 'gdzie', 'kiedy', 'dlaczego', 'jak', 'ile', 'skąd', 'dokąd',
      // spójniki
      'i', 'a', 'ale', 'lub', 'albo', 'oraz', 'czy', 'że', 'żeby', 'aby', 'bo', 'ponieważ', 'gdy', 'jeśli', 'jeżeli', 'choć', 'chociaż', 'więc', 'dlatego', 'ani', 'lecz',
      // przeczenie
      'nie',
      // być
      'jestem', 'jesteś', 'jest', 'jesteśmy', 'jesteście', 'są', 'był', 'była', 'było', 'byli', 'były', 'będę', 'będziesz', 'będzie', 'będziemy', 'będziecie', 'będą', 'być',
      // przyimki
      'w', 'we', 'na', 'do', 'z', 'ze', 'od', 'po', 'przy', 'dla', 'o', 'u', 'za', 'pod', 'nad', 'przed', 'między', 'obok', 'koło', 'bez', 'przez', 'około', 'wśród',
      // partykuły / przysłówki funkcyjne
      'już', 'tylko', 'jeszcze', 'teraz', 'potem', 'zawsze', 'nigdy', 'może', 'tak', 'też', 'także', 'bardzo', 'właśnie', 'chyba', 'oczywiście', 'niech',
    ],
    ignoreTokens: ['yyy', 'eee', 'hmm', 'aha', 'no', 'ee'],
    // Authored Polish tip → Polish rule id (only ruleIds that exist in de-pl/grammar-rules.json).
    grammarTipLabels: [
      [/narzędnik|instrumental|narzednik/i, 'Narzędnik', 'instrumental_case'],
      [/aspekt|dokonany|niedokonany|aspect/i, 'Aspekt', 'verb_aspect'],
      [/rodzaj|gender|męski|żeński|nijaki/i, 'Rodzaj', 'noun_gender'],
    ],
    frequency: {
      list: 'ORViL / CKE (A1/A2)',
      cefrGraded: true,
      committed: false,
      // STRESS-TEST pair: intentionally minimal, NOT shippable → exempt from the coverage gate
      // (no committed top-1000 index required) until promoted to a real, coverage-complete pair.
      stressTest: true,
      note: 'ORViL (Opis referencyjny znajomości języka polskiego, the Polish CEFR reference ' +
            'description) + CKE certification A1/A2 word stock. The committeable top-1000 index is ' +
            'built when this pair is promoted from stress-test to shippable.',
      gateFloor: 0,
    },
  };

  // ── Portuguese (pt) — STRESS-TEST target (en-pt), intentionally minimal/non-shippable ──
  // The 4th and final stress-test target. It exercises: (1) the KOKORO audio engine with a language
  // OTHER than English (every other non-en target uses edge-tts; pt is the first non-English Kokoro
  // target, so generate-audio.mjs's non-English path is validated); (2) a 3-WAY register cline
  // (tu / você / o senhor) — the register dimension's first non-binary use; (3) BR↔PT regional
  // variation (ônibus/autocarro, celular/telemóvel). Portuguese has grammatical gender (-o/-a) → the
  // gender-detector block applies. Brazilian orthography (post-1990 Acordo Ortográfico).
  const pt = {
    name: 'Portuguese',
    grammaticalGender: true,    // masc/fem agreement (-o/-a) → gender-variant enrichment + gender-detector block.
    // Audio: edge-tts pt-BR (Azure Neural). kokoro-js ships ONLY English voices, so despite the model
    // supporting pt, every non-English target — pt included — uses edge-tts. pf_dora→pt-BR-Francisca,
    // pm_alex→pt-BR-Antonio (the only pt-BR male; there is no distinct second BR male, so 2 voices).
    voices: ['pf_dora', 'pm_alex'],
    tts: { engine: 'edge' },   // generate-audio-tgt.py --lang pt (Azure Neural pt-BR).
    // Portuguese uses accented vowels (á â ã à é ê í ó ô õ ú) and ç. These carry meaning (avô≠avó,
    // pêra≠pera historically, and ã/õ are nasal) so preserve them, exactly like es keeps ñ. Answer-
    // checking stays strict on the diacritics that distinguish words.
    foldPreserve: 'áâãàéêíóôõúç',
    nativeChars: 'áâãàéêíóôõúç',
    // Cloze must blank a CONTENT word, never these closed-class Portuguese words.
    clozeStopWords: [
      'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'você', 'vocês', 'me', 'te', 'se', 'lhe', 'nos', 'vos', 'lhes',
      'meu', 'minha', 'teu', 'tua', 'seu', 'sua', 'nosso', 'nossa', 'este', 'esta', 'esse', 'essa', 'aquele', 'aquela', 'isto', 'isso', 'aquilo',
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
      'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 'até', 'desde', 'entre',
      'e', 'ou', 'mas', 'porque', 'que', 'se', 'quando', 'como', 'embora', 'pois', 'nem',
      'não', 'sim', 'já', 'ainda', 'agora', 'sempre', 'muito', 'também', 'só', 'bem',
      'sou', 'és', 'é', 'somos', 'são', 'estou', 'está', 'estamos', 'estão', 'ser', 'estar', 'ter', 'tem', 'há',
      // wh-words — blanking these yields trivial gaps
      'qual', 'quais', 'quem', 'onde', 'quanto', 'quanta', 'quantos', 'quantas',
    ],
    // Closed-class Portuguese words excluded from the VOCAB coverage denominator.
    functionWords: [
      // pronomes (pessoais / possessivos / demonstrativos / relativos / interrogativos)
      'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'você', 'vocês', 'me', 'te', 'se', 'lhe', 'nos', 'vos', 'lhes', 'mim', 'ti', 'si', 'consigo', 'connosco',
      'meu', 'minha', 'meus', 'minhas', 'teu', 'tua', 'seu', 'sua', 'nosso', 'nossa', 'dele', 'dela', 'deles', 'delas',
      'este', 'esta', 'esse', 'essa', 'aquele', 'aquela', 'isto', 'isso', 'aquilo', 'estes', 'estas',
      'que', 'quem', 'qual', 'quais', 'cujo', 'onde', 'quando', 'como', 'quanto',
      // conjunções
      'e', 'ou', 'mas', 'porém', 'contudo', 'porque', 'pois', 'que', 'se', 'quando', 'enquanto', 'embora', 'como', 'nem', 'logo', 'portanto',
      // negação
      'não', 'nunca', 'jamais', 'nada', 'ninguém', 'nenhum',
      // ser / estar / ter / haver
      'sou', 'és', 'é', 'somos', 'sois', 'são', 'ser', 'era', 'foi', 'estou', 'estás', 'está', 'estamos', 'estão', 'estar',
      'tenho', 'tens', 'tem', 'temos', 'têm', 'ter', 'há', 'haver',
      // preposições + contrações
      'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'a', 'ao', 'à', 'aos', 'às', 'por', 'pelo', 'pela',
      'para', 'com', 'sem', 'sob', 'sobre', 'até', 'desde', 'entre', 'contra', 'perante',
      // partículas / advérbios funcionais
      'já', 'ainda', 'agora', 'sempre', 'muito', 'também', 'só', 'bem', 'mal', 'aqui', 'ali', 'lá', 'assim', 'talvez', 'sim',
    ],
    ignoreTokens: ['né', 'ãh', 'hmm', 'aha', 'ah', 'eh', 'tá'],
    // Authored Portuguese tip → Portuguese rule id (only ruleIds that exist in en-pt/grammar-rules.json).
    grammarTipLabels: [
      [/g[eê]nero|masculin|feminin|concord/i, 'Gênero', 'gender_agreement'],
      [/ser\b|estar\b|permanent|tempor/i, 'Ser vs Estar', 'ser_vs_estar'],
      [/tratamento|registro|você|senhor|formalidade/i, 'Formas de tratamento', 'forms_of_address'],
    ],
    frequency: {
      list: 'Referencial Camões PLE (A1/A2)',
      cefrGraded: true,
      committed: false,
      // STRESS-TEST pair: intentionally minimal, NOT shippable → exempt from the coverage gate
      // (no committed top-1000 index required) until promoted to a real, coverage-complete pair.
      stressTest: true,
      note: 'Referencial Camões PLE (Português Língua Estrangeira) A1/A2, public reference. The ' +
            'committeable top-1000 index is built when this pair is promoted from stress-test to shippable.',
      gateFloor: 0,
    },
  };

  // ── Swedish (sv) — STRESS-TEST target (en-sv), intentionally minimal/non-shippable ──
  // NORTH Germanic. Closes the COMMON/NEUTER gender typology (utrum/neutrum, en/ett) shared by
  // nl/sv/no/da — but that gender is NOUN-INHERENT (marked by the article in the term, like German
  // "der Bruder"), NOT a speaker-chosen person variant, so grammaticalGender:false (no gender-variant
  // path / no gender detector; Swedish person nouns are gender-neutral: en lärare). What it uniquely
  // stresses: the DEFINITE article is a SUFFIX (hus → huset), modeled by the new `definiteness`
  // inflectional dimension. du is universal → register is absent. Genitive -s aside, no case system.
  const sv = {
    name: 'Swedish',
    grammaticalGender: false,   // common/neuter is noun-inherent (article in term) → no person m/f variant path.
    voices: ['svf_sofie', 'svm_mattias'],   // edge-tts sv-SE voices (Sofie / Mattias).
    tts: { engine: 'edge' },
    // å ä ö are distinct letters of the Swedish alphabet (not accented a/o) — preserve all three so
    // answer-checking stays strict, like fi keeps äöå and de keeps äöüß.
    foldPreserve: 'äöå',
    nativeChars: 'äöå',
    // Cloze must blank a CONTENT word, never these closed-class Swedish words.
    clozeStopWords: [
      'jag', 'du', 'han', 'hon', 'den', 'det', 'vi', 'ni', 'de', 'dem', 'mig', 'dig', 'sig', 'oss', 'er',
      'min', 'mitt', 'mina', 'din', 'ditt', 'dina', 'hans', 'hennes', 'vår', 'våra', 'sin', 'sitt', 'sina',
      'en', 'ett', 'och', 'eller', 'men', 'att', 'som', 'om', 'när', 'medan', 'för', 'så',
      'inte', 'ej', 'aldrig', 'ingen', 'inget', 'inga',
      'är', 'var', 'varit', 'vara', 'har', 'hade', 'haft', 'ha', 'blir', 'blev',
      'i', 'på', 'av', 'till', 'från', 'med', 'under', 'över', 'vid', 'hos', 'utan', 'mot', 'genom', 'mellan',
      'här', 'där', 'nu', 'då', 'sedan', 'alltid', 'ofta', 'redan', 'bara', 'också', 'mycket', 'ja', 'nej',
      // wh-words — blanking these yields trivial gaps
      'vad', 'vem', 'vilken', 'vilket', 'vilka', 'vart', 'varför', 'hur',
    ],
    // Closed-class Swedish words excluded from the VOCAB coverage denominator.
    functionWords: [
      // pronomen (personliga / possessiva / demonstrativa / relativa / frågande)
      'jag', 'du', 'han', 'hon', 'den', 'det', 'vi', 'ni', 'de', 'dem', 'mig', 'dig', 'sig', 'oss', 'er', 'man',
      'min', 'mitt', 'mina', 'din', 'ditt', 'dina', 'hans', 'hennes', 'dess', 'vår', 'vårt', 'våra', 'deras', 'sin', 'sitt', 'sina',
      'denna', 'detta', 'dessa', 'sådan', 'samma', 'varje', 'någon', 'något', 'några', 'ingen', 'inget', 'inga', 'all', 'allt', 'alla',
      'som', 'vilken', 'vilket', 'vilka', 'vad', 'vem', 'vart', 'var', 'när', 'varför', 'hur',
      // konjunktioner
      'och', 'eller', 'men', 'för', 'att', 'om', 'när', 'medan', 'fast', 'så', 'samt', 'utan', 'därför',
      // negation
      'inte', 'ej', 'aldrig',
      // vara / ha / bli
      'är', 'var', 'varit', 'vara', 'har', 'hade', 'haft', 'ha', 'blir', 'blev', 'blivit',
      // prepositioner
      'i', 'på', 'av', 'till', 'från', 'med', 'om', 'under', 'över', 'vid', 'hos', 'utan', 'mot', 'genom', 'mellan', 'bakom', 'framför', 'efter', 'före',
      // artiklar + partiklar / adverb
      'en', 'ett', 'ju', 'nog', 'väl', 'här', 'där', 'nu', 'då', 'sedan', 'alltid', 'ofta', 'redan', 'bara', 'också', 'mycket', 'ja', 'nej',
    ],
    ignoreTokens: ['öh', 'hmm', 'aha', 'åh', 'eh', 'typ', 'liksom'],
    // Authored Swedish tip → Swedish rule id (only ruleIds that exist in en-sv/grammar-rules.json).
    grammarTipLabels: [
      [/genus|utrum|neutrum|en-ord|ett-ord|en\/ett|common gender|neuter/i, 'Genus', 'gender_en_ett'],
      [/bestämd|obestämd|definite|ändelse|suffix|artikel/i, 'Bestämd form', 'definite_suffix'],
    ],
    frequency: {
      list: 'Kelly-listan (A1/A2)',
      cefrGraded: true,
      committed: false,
      // STRESS-TEST pair: intentionally minimal, NOT shippable → exempt from the coverage gate
      // (no committed top-1000 index required) until promoted to a real, coverage-complete pair.
      stressTest: true,
      note: 'Swedish Kelly list (Kelly-listan) A1/A2, public reference. The committeable top-1000 ' +
            'index is built when this pair is promoted from stress-test to shippable.',
      gateFloor: 0,
    },
  };

  const PROFILES = { en, es, de, fi, pl, pt, sv };

  // Cognate suffix pairs, keyed by the two language codes SORTED and joined with
  // '|'. Each pair is [suffixInLangA, suffixInLangB] following the sorted order.
  // Symmetric — Quiz tries both directions. (en|es sorted → 'en|es': [en, es].)
  const COGNATES = {
    'en|es': [
      ['tion', 'cion'], ['ty', 'dad'], ['ous', 'o'], ['ous', 'oso'],
      ['ate', 'ar'], ['ize', 'izar'], ['ise', 'izar'], ['al', 'al'], ['ble', 'ble'],
      ['ent', 'ente'], ['ant', 'ante'], ['ic', 'ico'], ['ical', 'ico'], ['ly', 'mente'],
    ],
    // Portuguese cognates fold like Spanish (ç→c, ã→a via NFD): -ção→cao, -dade, -oso, -vel, -mente.
    'en|pt': [
      ['tion', 'cao'], ['ty', 'dade'], ['ous', 'oso'], ['ate', 'ar'], ['ize', 'izar'],
      ['al', 'al'], ['ble', 'vel'], ['ent', 'ente'], ['ant', 'ante'], ['ic', 'ico'],
      ['ical', 'ico'], ['ly', 'mente'], ['ment', 'mento'],
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
    /** Non-ASCII letters/marks the language legitimately uses ('' if pure ASCII). */
    nativeChars: function (code) { const p = PROFILES[code]; return p ? (p.nativeChars || '') : ''; },
    /** Source-side gender config ({fixWords, nounsCapitalized}) or null — used when this language is a SOURCE (L1) hint. */
    sourceGender: function (code) { const p = PROFILES[code]; return p ? (p.sourceGender || null) : null; },
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
