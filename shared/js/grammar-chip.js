/* ============================================================
   grammar-chip.js — Shared utility for grammar micro-tip chips
   Included in: speaking, cloze, translation, grammar

   ruleId values must match rule `id` fields in grammar-rules.json.
   Set ruleId to null when no matching rule exists — chip is hidden.
   ============================================================ */

function extractGrammarInfo(tip) {
  const LABELS = [
    // Order matters: more specific patterns first
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
  for (const [pat, label, ruleId] of LABELS) {
    if (pat.test(tip)) return { label, ruleId };
  }
  return { label: 'Grammar note', ruleId: null };
}
