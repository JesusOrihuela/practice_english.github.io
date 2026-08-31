/* ============================================================
   check-pair-completeness.mjs — Per-pair RUNTIME completeness gate (CI).

   check-content validates content SHAPE and check-lang-profiles validates a target language's
   LINGUISTIC profile. This gate closes the third gap the first divergent pair (en-de) exposed: the
   per-pair RUNTIME assets/wiring a pair needs to actually work in the app, which shared code assumes
   exist. Each was a real bug found by hand; now they fail CI before a user sees them:

     1. FLAGS — every country code a pair declares in source.flags / target.flags
        (shared/js/lang-pair.js) has a real SVG in shared/img/flags/. (en-de shipped without de/at.)
     2. GRAMMAR CATEGORIES — every rule.category in a pair's grammar-rules.json is defined in that
        file's `categories[]`; otherwise the Grammar page renders an empty grid. (en-de had none.)
     3. PLACEMENT — every pair has a placement.json with a non-empty questions array.
     4. QUIZ VIABILITY (warning) — a vocab deck needs ≥ 4 words or the Quiz can't build 4 options.

   Usage:  node tools/check-pair-completeness.mjs      # exit 1 on any failure
   Rationale + the full "adding a pair" checklist: docs/ADD-A-LANGUAGE.md.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppLangPair from '../shared/js/lang-pair.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');
const FLAGS_DIR = path.join(ROOT, 'shared/img/flags');
const VOCAB_DIR = path.join(ROOT, 'shared/json/vocab');
const QUIZ_MIN_WORDS = 4;   // correct + 3 distractors

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

const pairs = AppLangPair.getAll();

for (const pair of pairs) {
  const label = `[${pair.id}]`;

  // 1. FLAGS — every declared flag code has an SVG asset.
  const codes = [...(pair.source?.flags || []), ...(pair.target?.flags || [])];
  for (const code of codes) {
    if (!fs.existsSync(path.join(FLAGS_DIR, code + '.svg')))
      fail(`${label} — missing flag asset shared/img/flags/${code}.svg (declared in lang-pair.js) — the pair badge/picker shows a blank flag`);
  }

  const dir = path.join(PAIRS_DIR, pair.id);
  if (!fs.existsSync(dir)) { fail(`${label} — no content dir shared/json/pairs/${pair.id}/`); continue; }

  // 2. GRAMMAR CATEGORIES — every rule's category is defined in categories[].
  const grPath = path.join(dir, 'grammar-rules.json');
  if (fs.existsSync(grPath)) {
    try {
      const gr = JSON.parse(fs.readFileSync(grPath, 'utf8'));
      const catIds = new Set((gr.categories || []).map(c => c.id));
      if (!(gr.rules || []).length) warn(`${label} — grammar-rules.json has no rules`);
      if (!catIds.size && (gr.rules || []).length)
        fail(`${label} — grammar-rules.json has rules but NO categories[] — the Grammar page grid renders empty (only deep-linked ?rule= works)`);
      for (const r of (gr.rules || [])) {
        if (r.category && !catIds.has(r.category))
          fail(`${label} — grammar rule "${r.id}" uses category "${r.category}" not defined in categories[] — it never appears in the Grammar grid`);
      }
    } catch (e) { fail(`${label} — grammar-rules.json is invalid JSON: ${e.message}`); }
  }

  // 3. PLACEMENT — present with questions.
  const plPath = path.join(dir, 'placement.json');
  if (!fs.existsSync(plPath)) {
    fail(`${label} — no placement.json (the placement test would fail for this pair)`);
  } else {
    try {
      const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
      if (!Array.isArray(pl.questions) || !pl.questions.length)
        fail(`${label} — placement.json has no questions[]`);
    } catch (e) { fail(`${label} — placement.json is invalid JSON: ${e.message}`); }
  }
}

// 4. QUIZ VIABILITY (warning) — target-centric vocab decks with too few words for a 4-option quiz.
if (fs.existsSync(VOCAB_DIR)) {
  for (const lang of fs.readdirSync(VOCAB_DIR)) {
    const vdir = path.join(VOCAB_DIR, lang);
    if (!fs.statSync(vdir).isDirectory()) continue;
    for (const f of fs.readdirSync(vdir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const n = (JSON.parse(fs.readFileSync(path.join(vdir, f), 'utf8')).words || []).length;
        if (n > 0 && n < QUIZ_MIN_WORDS)
          warn(`vocab/${lang}/${f} — only ${n} word(s); the Quiz needs ≥ ${QUIZ_MIN_WORDS} to build 4 distinct options`);
      } catch { /* shape checked by check-content */ }
    }
  }
}

// ── Report ──
console.log(`Completitud de pares — ${pairs.length} par(es): ${pairs.map(p => p.id).join(', ')}`);
for (const w of warns) console.log(`  ⚠ ${w}`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  console.log(`\n✗ ${fails.length} problema(s) de completitud de par. Ver docs/ADD-A-LANGUAGE.md (checklist "adding a pair").`);
  process.exit(1);
}
console.log(`\n✓ Todos los pares están completos a nivel de runtime (banderas, categorías de gramática, placement).`);
