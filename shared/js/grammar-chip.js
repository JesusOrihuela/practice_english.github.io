/* ============================================================
   grammar-chip.js — Shared utility for grammar micro-tip chips
   Chip (AppGrammarChip): speaking, dictation, cloze, translation, scramble.
   rulesFor also feeds the grammar page's related-phrases panel.

   The phrase's `grammar` tip is written in the TARGET language, so the tip →
   rule map is target-language-specific. `ruleId` values must match rule `id`
   fields in that pair's grammar-rules.json; null → no matching rule, chip hidden.
   The active pair's target language selects the map (English tips for *→en,
   Spanish tips for *→es), so a tip never links to the other language's rule ids.
   ============================================================ */

// The authored-tip → rule-id label tables live PER TARGET LANGUAGE in
// shared/js/lang-profiles.js (grammarTipLabels). The active pair's target language
// selects the table (English tips for *→en, Spanish tips for *→es), so a tip never
// links to the other language's rule ids. Adding a target language = adding its
// grammarTipLabels to the profile; no edit here.
function extractGrammarInfo(tip) {
  var targetCode = 'en';
  try { targetCode = AppLangPair.getActive().target.code; } catch (e) {}
  const LABELS = (typeof AppLangProfiles !== 'undefined') ? AppLangProfiles.grammarTipLabels(targetCode) : [];
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
