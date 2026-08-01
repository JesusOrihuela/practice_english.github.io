#!/usr/bin/env node
// check-content.mjs
// Automated checks for content rules not covered by audit.mjs:
//   R11 — grammar tip length (> 15 words) and anti-pedagogical patterns
//   R11 — tip language mismatch heuristic
//   R15 — IDs with generic suffixes (_2, _new, _alt, _b2_1, etc.)
//   R17 — terminal punctuation verification (post-script sanity check)
//   schema — residual old-schema fields (audioIdx, hint, region, note — standalone on form, not inside labels)
//   schema — labels object key validation
//
// Read-only — does NOT modify any files.
// Usage: node tools/check-content.mjs

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = join(__dirname, '..', 'shared', 'json');

const PAIRS = ['es-en', 'en-es'];
const TOPICS = [
  'emociones', 'greetings', 'restaurant', 'kitchen', 'gym', 'technology',
  'supermarket', 'accommodation', 'accountability', 'movies',
  'music', 'theater', 'transportation', 'airport'
];

// R15: ID suffix patterns that indicate generic/non-descriptive IDs
const GENERIC_ID_RE = /(_\d+$|_new$|_alt$|_b[12]_\d+|_c[12]_\d+|_a[12]_\d+)/;

// R11: Anti-pedagogical patterns (describes what, not why/how)
const ANTI_PEDAGOGY_RE = /\b(esta frase usa|this sentence uses|uses the|esta oración|este enunciado usa)\b/i;

// R11: Spanish-character heuristic for wrong-language tip detection
const SPANISH_CHARS_RE = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/;

// R17: Terminal punctuation
const TERMINAL_RE = /[.?!]$/;

// Schema: old fields that should not exist after migration
const OLD_SCHEMA_FIELDS = ['audioIdx', 'hint', 'note', 'region'];
// Valid labels keys in the new schema
const VALID_LABEL_KEYS = new Set(['gender', 'region', 'register', 'loanword']);
// audioSlug length cap — must match SLUG_MAX in assign-alt-slugs.mjs and the generators.
const SLUG_MAX = 100;

const issues = [];

function flag(pair, topic, id, field, rule, msg) {
  issues.push({ pair, topic, id, field, rule, msg });
}

for (const pair of PAIRS) {
  for (const topic of TOPICS) {
    const filepath = join(BASE, 'pairs', pair, `${topic}.json`);
    let data;
    try {
      data = JSON.parse(readFileSync(filepath, 'utf8'));
    } catch {
      flag(pair, topic, '—', '—', 'R9', `Cannot read/parse file`);
      continue;
    }

    for (const phrase of data.phrases) {
      const id = phrase.id || '(no id)';

      // R15 — Generic ID suffix
      if (GENERIC_ID_RE.test(id)) {
        flag(pair, topic, id, 'id', 'R15', `Generic/numeric ID suffix: "${id}"`);
      }

      // R17 — Terminal punctuation on source
      if (phrase.source && !TERMINAL_RE.test(phrase.source.trimEnd())) {
        flag(pair, topic, id, 'source', 'R17', `Missing terminal punctuation: "${phrase.source}"`);
      }

      // schema (R16 §3) — no two forms may carry identical labels. Forms that
      // are indistinguishable by any labelled dimension are redundant duplicates.
      if ((phrase.target || []).length > 1) {
        const seenLabels = new Map();
        for (let i = 0; i < phrase.target.length; i++) {
          const key = JSON.stringify(phrase.target[i].labels || {});
          if (seenLabels.has(key)) {
            flag(pair, topic, id, `target[${i}].labels`, 'schema',
              `Duplicate labels ${key} — redundant form indistinguishable from target[${seenLabels.get(key)}]; give it a distinct dimension or remove it`);
          } else {
            seenLabels.set(key, i);
          }
        }
      }

      // R17 + schema — validate each target form
      for (let i = 0; i < (phrase.target || []).length; i++) {
        const form = phrase.target[i];

        // R17 — Terminal punctuation
        if (form.text && !TERMINAL_RE.test(form.text.trimEnd())) {
          flag(pair, topic, id, `target[${i}].text`, 'R17', `Missing terminal punctuation: "${form.text}"`);
        }

        // schema — residual old fields
        for (const f of OLD_SCHEMA_FIELDS) {
          if (form[f] !== undefined) {
            flag(pair, topic, id, `target[${i}].${f}`, 'schema',
              `Residual old-schema field "${f}" — remove it; move any variant info into labels and run: node tools/assign-alt-slugs.mjs`);
          }
        }

        // schema — type field is no longer valid (type:'style' abolished; use labels instead)
        if (form.type !== undefined) {
          flag(pair, topic, id, `target[${i}].type`, 'schema',
            `Field "type" is no longer valid — assign labels to this form and remove the type field`);
        }

        // schema — every form in a multi-form phrase must have labels
        if ((phrase.target || []).length > 1 && form.labels === undefined) {
          flag(pair, topic, id, `target[${i}]`, 'schema',
            `Form in multi-target phrase missing "labels" — all forms must describe their variant dimension`);
        }

        // schema — validate labels keys
        if (form.labels !== undefined) {
          for (const key of Object.keys(form.labels)) {
            if (!VALID_LABEL_KEYS.has(key)) {
              flag(pair, topic, id, `target[${i}].labels.${key}`, 'schema',
                `Unknown label key "${key}" — valid keys: ${[...VALID_LABEL_KEYS].join(', ')}`);
            }
          }
        }

        // schema — every form (including style) must have audioSlug
        if (form.audioSlug === undefined) {
          flag(pair, topic, id, `target[${i}]`, 'schema',
            `Form missing audioSlug — run: node tools/assign-alt-slugs.mjs`);
        }

        // schema — audioSlug length cap (keeps audio paths within Windows MAX_PATH 260).
        // assign-alt-slugs.mjs caps at SLUG_MAX; a longer value means a stale hand-written slug.
        if (form.audioSlug !== undefined && form.audioSlug.length > SLUG_MAX) {
          flag(pair, topic, id, `target[${i}].audioSlug`, 'schema',
            `audioSlug exceeds ${SLUG_MAX} chars (${form.audioSlug.length}) — delete it and re-run: node tools/assign-alt-slugs.mjs`);
        }
      }

      // Grammar tip checks (R11)
      if (phrase.grammar) {
        const tip = phrase.grammar;
        const wordCount = tip.trim().split(/\s+/).length;

        // R11 — Tip too long
        if (wordCount > 15) {
          flag(pair, topic, id, 'grammar', 'R11', `Tip too long (${wordCount} words, max 15): "${tip}"`);
        }

        // R11 — Anti-pedagogical pattern
        if (ANTI_PEDAGOGY_RE.test(tip)) {
          flag(pair, topic, id, 'grammar', 'R11', `Anti-pedagogical pattern (states what, not why): "${tip}"`);
        }

        // R11 — Language mismatch: es-en pair target is English, so tip must NOT contain Spanish-specific chars
        if (pair === 'es-en' && SPANISH_CHARS_RE.test(tip)) {
          flag(pair, topic, id, 'grammar', 'R11', `Spanish characters in es-en tip (target is English): "${tip}"`);
        }
        // Note: en-es tips in Spanish without accented chars are valid; no heuristic check applied.
      }
    }
  }
}

// ─── REPORT ───────────────────────────────────────────────────────────────────

if (issues.length === 0) {
  console.log('✓ check-content: 0 issues found — ALL CLEAR');
  process.exit(0);
}

// Group by rule for readable output
const byRule = {};
for (const issue of issues) {
  if (!byRule[issue.rule]) byRule[issue.rule] = [];
  byRule[issue.rule].push(issue);
}

let totalIssues = 0;
for (const rule of Object.keys(byRule).sort()) {
  const ruleIssues = byRule[rule];
  console.log(`\n── ${rule} (${ruleIssues.length} issues) ──`);
  for (const { pair, topic, id, field, msg } of ruleIssues) {
    console.log(`  [${pair}/${topic}] ${id} › ${field}`);
    console.log(`    ${msg}`);
    totalIssues++;
  }
}

console.log(`\n✗ check-content: ${totalIssues} issues found`);
process.exit(1);
