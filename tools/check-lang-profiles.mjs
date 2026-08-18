/* ============================================================
   check-lang-profiles.mjs — Language-profile completeness gate (CI).

   Every TARGET language used by a pair must have a COMPLETE linguistic profile,
   so adding a language is "fill one profile + pass this check" instead of hunting
   through scattered files. For each target language a pair learns, this verifies:

     1. shared/js/lang-profiles.js has an entry (foldPreserve, clozeStopWords,
        functionWords, ignoreTokens, grammarTipLabels, frequency metadata) with the
        right shapes and the essential lists non-empty.
     2. tools/lang-detectors.mjs has a detector block for it (grammar-topics needs
        it to derive rule↔phrase evidence).
     3. every non-null ruleId referenced by the profile's grammarTipLabels actually
        exists in that target's grammar-rules.json (catches chip-linking typos).

   Cognate tables and empty grammarTipLabels are reported as warnings, not failures
   (a pair may legitimately have no cognate boost, and a language may have no
   authored tips yet). Rationale + the full linguistic-fact spec each field encodes:
   docs/LANGUAGE-PROFILES.md

   Usage:  node tools/check-lang-profiles.mjs        # exit 1 on any failure
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppLangProfiles from '../shared/js/lang-profiles.js';
import { DETECTORS } from './lang-detectors.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');

// Pairs = content dirs with a grammar-rules.json. Target code = segment after '-'.
const pairs = fs.readdirSync(PAIRS_DIR).filter(p =>
  fs.existsSync(path.join(PAIRS_DIR, p, 'grammar-rules.json')));
const targets = [...new Set(pairs.map(p => p.split('-')[1]))].sort();

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

const isNonEmptyArray = (v) => Array.isArray(v) && v.length > 0;

for (const code of targets) {
  const usedBy = pairs.filter(p => p.split('-')[1] === code).join(', ');
  const label = `[${code}] (used by: ${usedBy})`;
  const p = AppLangProfiles.get(code);

  // 1. Profile presence + shape.
  if (!p) { fail(`${label} — NO profile in shared/js/lang-profiles.js`); continue; }
  if (typeof p.foldPreserve !== 'string') fail(`${label} — foldPreserve must be a string (use '' for none)`);
  if (typeof p.nativeChars !== 'string') fail(`${label} — nativeChars must be a string (non-ASCII letters/marks the language uses; '' for pure ASCII) — check-content's wrong-language tip check reads it`);
  if (!isNonEmptyArray(p.clozeStopWords)) fail(`${label} — clozeStopWords is empty; cloze would blank function words`);
  if (!isNonEmptyArray(p.functionWords))  fail(`${label} — functionWords is empty; the vocab coverage channel would be wrong`);
  if (!isNonEmptyArray(p.voices))         fail(`${label} — voices is empty; check-audio can't validate this language's audio voice set`);
  if (!Array.isArray(p.ignoreTokens))     fail(`${label} — ignoreTokens must be an array (may be empty)`);
  if (!Array.isArray(p.grammarTipLabels)) fail(`${label} — grammarTipLabels must be an array`);
  else if (p.grammarTipLabels.length === 0) warn(`${label} — grammarTipLabels empty: no learning-mode grammar chip for this language`);
  if (!p.frequency || !p.frequency.list)  fail(`${label} — frequency.list is required (which pedagogical list governs the coverage gate)`);
  if (!p.tts || !p.tts.engine)            fail(`${label} — tts.engine is required (audio generator: 'kokoro' | 'edge')`);
  // Coverage must gate this language IN CI → it needs a COMMITTED frequency index + floor.
  if (!p.frequency || !p.frequency.gateIndex) {
    fail(`${label} — frequency.gateIndex is required (committed index for the CI coverage gate)`);
  } else if (!fs.existsSync(path.join(ROOT, 'tools/sources/derived', p.frequency.gateIndex))) {
    fail(`${label} — frequency.gateIndex "${p.frequency.gateIndex}" is not committed in tools/sources/derived/ — coverage can't gate ${code} in CI`);
  }
  if (!p.frequency || typeof p.frequency.gateFloor !== 'number') fail(`${label} — frequency.gateFloor (number %) is required for the coverage gate`);

  // 2. Node grammar detectors.
  if (!DETECTORS[code]) fail(`${label} — NO detector block in tools/lang-detectors.mjs (grammar evidence would be empty)`);

  // 3. grammarTipLabels ruleIds must exist in the grammar rules of this target's pairs.
  const ruleIds = new Set();
  for (const pair of pairs.filter(x => x.split('-')[1] === code)) {
    try {
      const rules = JSON.parse(fs.readFileSync(path.join(PAIRS_DIR, pair, 'grammar-rules.json'), 'utf8')).rules || [];
      for (const r of rules) ruleIds.add(r.id);
    } catch (e) { fail(`${label} — could not read ${pair}/grammar-rules.json: ${e.message}`); }
  }
  for (const entry of (p.grammarTipLabels || [])) {
    const ruleId = entry[2];
    if (ruleId && !ruleIds.has(ruleId)) fail(`${label} — grammarTipLabels points to unknown ruleId "${ruleId}"`);
  }

  // Cognate table per pair (warning only — a boost, not a requirement).
  for (const pair of pairs.filter(x => x.split('-')[1] === code)) {
    const src = pair.split('-')[0];
    if (AppLangProfiles.cognateSuffixes(code, src).length === 0)
      warn(`${label} — no cognate suffix table for ${pair} (Quiz cognate-mode boost disabled for this pair)`);
  }
}

console.log(`Perfiles de idioma — objetivos: ${targets.join(', ') || '(ninguno)'}`);
for (const w of warns) console.log(`  ⚠ ${w}`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  console.log(`\n✗ ${fails.length} problema(s) de completitud de perfil. Ver docs/LANGUAGE-PROFILES.md.`);
  process.exit(1);
}
console.log(`\n✓ Todos los idiomas objetivo tienen un perfil lingüístico completo (${targets.length}).`);
