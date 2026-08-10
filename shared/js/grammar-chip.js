/* ============================================================
   grammar-chip.js — Shared utility for grammar micro-tip chips
   Included in: speaking, cloze, translation, grammar

   The phrase's `grammar` tip is written in the TARGET language, so the tip →
   rule map is target-language-specific. `ruleId` values must match rule `id`
   fields in that pair's grammar-rules.json; null → no matching rule, chip hidden.
   The active pair's target language selects the map (English tips for *→en,
   Spanish tips for *→es), so a tip never links to the other language's rule ids.
   ============================================================ */

// English tips (target = English, e.g. es-en) → English rule ids.
const _GRAMMAR_LABELS_EN = [
  [/present perfect continuous/i, 'Present Perfect Continuous', null],
  [/present perfect/i,            'Present Perfect',            'present_perfect_experience'],
  [/past perfect/i,               'Past Perfect',               'past_perfect'],
  [/past continuous/i,            'Past Continuous',            'past_continuous'],
  [/present continuous/i,         'Present Continuous',         'present_continuous_now'],
  [/present simple/i,             'Present Simple',             'present_simple_habits'],
  [/simple past/i,                'Simple Past',                'simple_past'],
  [/will\b.*going to|going to.*\bwill/i, 'will vs. going to',  'future_will_going_to'],
  [/first conditional/i,          'First Conditional',          'conditional_first'],
  [/second conditional/i,         'Second Conditional',         'conditional_second'],
  [/third conditional/i,          'Third Conditional',          'conditional_third'],
  [/zero conditional/i,           'Zero Conditional',           'conditional_zero'],
  [/conditional/i,                'Conditionals',               'conditional_first'],
  [/passive/i,                    'Passive Voice',              'passive_present_simple'],
  [/'would'/i,                     'Modal: would',               null],
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
  [/\ba\/an\b|article.*a\b/i,    'A / An',                     'article_a_an'],
  [/\bthe\b.*article|article.*\bthe\b/i, 'The',               'article_the'],
  [/zero article/i,               'Zero Article',               'article_zero'],
];

// Spanish tips (target = Spanish, e.g. en-es) → Spanish rule ids. Most specific
// first. Structures without a rule (estar+gerundio, "hay que", imperative,
// "hace tiempo que"…) fall through to null so no chip shows.
const _GRAMMAR_LABELS_ES = [
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
];

function extractGrammarInfo(tip) {
  var targetCode = 'en';
  try { targetCode = AppLangPair.getActive().target.code; } catch (e) {}
  const LABELS = targetCode === 'es' ? _GRAMMAR_LABELS_ES : _GRAMMAR_LABELS_EN;
  for (const [pat, label, ruleId] of LABELS) {
    if (pat.test(tip)) return { label, ruleId };
  }
  return { label: AppLang.t('grammar_note_label'), ruleId: null };
}

/* ============================================================
   AppGrammarChip — decides WHICH grammar rule a phrase surfaces as a chip.

   A phrase exercises many structures (see grammar-phrase-rules.json, derived by
   tools/grammar-topics.mjs). Final policy (user's decision):

     • Free mode only. In Ruta de Aprendizaje (path mode) NO chip ever shows —
       attention must stay on the task (Schmidt's noticing: a chip would split it).
     • Show at most ONE chip: the MOST ADVANCED (highest-CEFR) rule the phrase
       exercises. Rationale: a phrase's ceiling structure defines its difficulty,
       so the hardest rule is the one worth pointing at (present + mixed
       conditional → mixed conditional). No learner-level filter, no throttle.
     • Candidates = the evidence map ∪ the rule an authored `grammar` tip resolves
       to (so a curated teaching point is never missed if detectors don't catch it).
     • If the phrase exercises no rule from the grammar section → no chip. Never
       invent one.

   Data (map + rule levels/titles) loads once per active pair via AppData; call
   load() on topic start. Until loaded, choose() honors only an authored tip.
   ============================================================ */
var AppGrammarChip = (function () {
  var ORDER = (typeof CEFR_ORDER !== 'undefined')
    ? CEFR_ORDER : { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
  var _map = null;              // phraseId → [ruleId] (structures the phrase exercises)
  var _lvl = null;              // ruleId → CEFR index (0..5)
  var _title = null;            // ruleId → localized title
  var _pair = null, _loaded = false;

  function _activePair() { try { return AppLangPair.getActive().id; } catch (e) { return null; } }
  function _targetCode() { try { return AppLangPair.getActive().target.code; } catch (e) { return 'en'; } }

  function load() {
    var pair = _activePair();
    if (_loaded && _pair === pair) return Promise.resolve();
    _pair = pair; _loaded = false;
    var tgt = _targetCode();
    return Promise.all([
      AppData.get('grammar-phrase-rules').catch(function () { return {}; }),
      AppData.get('grammar-rules').catch(function () { return { rules: [] }; })
    ]).then(function (res) {
      _map = res[0] || {};
      _lvl = {}; _title = {};
      (res[1].rules || []).forEach(function (r) {
        _lvl[r.id]   = (ORDER[r.level] != null) ? ORDER[r.level] : null;
        _title[r.id] = (tgt === 'es' ? r.title_es : r.title_en) || r.title || r.id;
      });
      _loaded = true;
    });
  }

  // Every grammar-section rule a phrase exercises: evidence map ∪ the rule its
  // authored tip resolves to. Single source of truth for the phrase↔rule link —
  // used both by the chip (choose) and the Grammar page's related-phrases panel,
  // so a chip that points at rule X is always mirrored by X listing that phrase.
  // phrase: { tip, id } → [ruleId].
  function rulesFor(phrase) {
    phrase = phrase || {};
    var out = (_loaded && _map && _map[phrase.id]) ? _map[phrase.id].slice() : [];
    if (phrase.tip) {
      var ai = extractGrammarInfo(phrase.tip);
      if (ai.ruleId && out.indexOf(ai.ruleId) === -1) out.push(ai.ruleId);
    }
    return out;
  }

  // phrase: { tip, id, pathMode } → { label, ruleId } | null.  ruleId null/absent
  // means "no chip". Callers show a chip only when the result has a truthy ruleId.
  function choose(phrase) {
    phrase = phrase || {};
    if (phrase.pathMode) return null;   // Ruta de Aprendizaje: focused attention → no chip
    var cands = rulesFor(phrase);
    if (!cands.length) return null;     // no explicit grammar rule → no chip (don't invent)
    // Show only ONE: the most advanced (highest-CEFR) structure in the phrase.
    var best = null, bestLvl = -1;
    for (var i = 0; i < cands.length; i++) {
      var lv = (_lvl && _lvl[cands[i]] != null) ? _lvl[cands[i]] : -1;
      if (lv > bestLvl) { bestLvl = lv; best = cands[i]; }
    }
    if (!best) return null;
    var label = (_title && _title[best]) ? _title[best] : AppLang.t('grammar_note_label');
    return { label: label, ruleId: best };
  }

  return { load: load, choose: choose, rulesFor: rulesFor };
})();
