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

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import AppLangProfiles from '../shared/js/lang-profiles.js';
import AppVariantDims from '../shared/js/variant-dimensions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = join(__dirname, '..', 'shared', 'json');

// Pairs are DERIVED from the content tree (every dir with a topics.json) — nothing
// hardcoded, so a new pair is checked automatically and a removed one drops out.
const PAIRS = readdirSync(join(BASE, 'pairs'))
  .filter(p => existsSync(join(BASE, 'pairs', p, 'topics.json')));
// Phrase topics are DERIVED per pair from its topics.json (t.phrase) — no hardcoded
// list to drift (this is how fiesta and any future topic flow in automatically).
function phraseTopicsFor(pair) {
  return JSON.parse(readFileSync(join(BASE, 'pairs', pair, 'topics.json'), 'utf8'))
    .topics.filter(t => t.phrase).map(t => t.id);
}
// Source languages that learn a given target lang — DERIVED from the pairs (e.g. target
// "es" is learned by en-es ⇒ source "en"). Used to know which translations.<src>/gloss.<src>
// each vocab word must carry. No hardcoded language literals.
function srcLangsFor(lang) {
  return [...new Set(PAIRS.filter(p => p.split('-')[1] === lang).map(p => p.split('-')[0]))];
}
// Normalize text for exact-duplicate detection: lowercase, strip accents + punctuation,
// collapse whitespace. Deterministic; no model. (ñ folds to n via NFD — fine for dup keys.)
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
// Collectors for the cross-file exact-duplicate check (per pair, phrases).
const phraseTexts = {};
for (const p of PAIRS) phraseTexts[p] = new Map();   // normText -> [{topic,id}]

// R15: ID suffix patterns that indicate generic/non-descriptive IDs
const GENERIC_ID_RE = /(_\d+$|_new$|_alt$|_b[12]_\d+|_c[12]_\d+|_a[12]_\d+)/;

// R11: Anti-pedagogical patterns (describes what, not why/how)
const ANTI_PEDAGOGY_RE = /\b(esta frase usa|this sentence uses|uses the|esta oración|este enunciado usa)\b/i;

// R11: wrong-language detection — non-ASCII letters/marks in a target-language text
// that are NOT part of that language's alphabet (lang-profiles `nativeChars`). Returns a
// string of the distinct offending chars (or '' if none). Fully derived per language, so
// any target inherits the check by declaring nativeChars; no hardcoded charset or pair.
function wrongLangChars(text, targetCode) {
  const native = AppLangProfiles.nativeChars(targetCode);
  const bad = new Set();
  for (const ch of (text || '')) {
    if (ch.charCodeAt(0) < 128) continue;                 // ASCII always allowed
    if (native.includes(ch.toLowerCase())) continue;      // native letter/mark of this language
    if (/[\p{L}\p{M}]/u.test(ch) || ch === '¿' || ch === '¡') bad.add(ch);  // letter/diacritic/inverted mark → foreign
  }
  return [...bad].join('');
}

// R17: Terminal punctuation
const TERMINAL_RE = /[.?!]$/;

// Schema: old fields that should not exist after migration
const OLD_SCHEMA_FIELDS = ['audioIdx', 'hint', 'note', 'region'];
// Label validation (keys + closed value sets) is delegated to the OPEN variant-dimension registry
// via AppVariantDims.validateLabels() — NOT hardcoded here. A new language adds a dimension in
// shared/js/variant-dimensions.js (case, honorific, noun class…) and it becomes valid content with
// no edit to this file. Open dims (region, loanword) accept any non-empty string; closed ones
// (gender, register…) validate against their value set (Rule 16 §8 — 'femenino' not 'female').
// audioSlug length cap — must match SLUG_MAX in assign-alt-slugs.mjs and the generators.
const SLUG_MAX = 100;

const issues = [];

function flag(pair, topic, id, field, rule, msg) {
  issues.push({ pair, topic, id, field, rule, msg });
}

for (const pair of PAIRS) {
  for (const topic of phraseTopicsFor(pair)) {
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

      // DUP — collect normalized practiced text for the cross-file duplicate check.
      const _t0 = norm(phrase.target && phrase.target[0] && phrase.target[0].text);
      if (_t0) {
        if (!phraseTexts[pair].has(_t0)) phraseTexts[pair].set(_t0, []);
        phraseTexts[pair].get(_t0).push({ topic, id });
      }

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

        // Per-form source (referent-determined variant, e.g. "The girl is smart."): optional, but
        // when present it is the L1 hint shown for THIS form, so it must be a real, punctuated
        // sentence like the phrase source (faithfulness is author judgment; format is checked).
        if (form.source !== undefined) {
          if (typeof form.source !== 'string' || form.source.trim() === '') {
            flag(pair, topic, id, `target[${i}].source`, 'schema', `Per-form source must be a non-empty string`);
          } else if (!TERMINAL_RE.test(form.source.trimEnd())) {
            flag(pair, topic, id, `target[${i}].source`, 'R17', `Missing terminal punctuation in per-form source: "${form.source}"`);
          }
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

        // schema — validate labels keys/values via the registry's own validator (single arbiter;
        // Rule 16 §8 — a closed value must match exactly, catching 'female', 'f', etc.).
        if (form.labels !== undefined) {
          const tgt = pair.split('-')[1];
          for (const e of AppVariantDims.validateLabels(form.labels, tgt)) {
            if (e.code === 'unknown-key')
              flag(pair, topic, id, `target[${i}].labels.${e.key}`, 'schema',
                `Unknown label key "${e.key}" — valid keys: ${AppVariantDims.keys().join(', ')}`);
            else if (e.code === 'not-applicable')
              flag(pair, topic, id, `target[${i}].labels.${e.key}`, 'schema',
                `Label "${e.key}" does not apply to target "${tgt}" (dimension appliesTo excludes it)`);
            else
              flag(pair, topic, id, `target[${i}].labels.${e.key}`, 'schema',
                `Invalid ${e.key} value "${e.value}" — must be one of: ${AppVariantDims.values(e.key).join(', ')}`);
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

      // R14.4 — gender-hint coherence with the badge. When the TARGET carries ≥2 forms that
      // differ by gender, each such form is shown with the adaptive gender badge, so the L1
      // hint must match the badged gender. If the SOURCE language marks gender morphologically
      // (grammaticalGender in lang-profiles), a single phrase-level `source` cannot serve both
      // genders — the badge would say one gender while the hint shows the combined slash (or the
      // wrong gender). Each gendered form must therefore carry its own per-form `source`.
      // Fully derived: source-gender from lang-profiles, gender variance from labels. A source
      // with NO grammatical gender (English) needs no per-form source — one genderless hint fits
      // every form — so those pairs never trip this. See docs/ADD-A-LANGUAGE.md (variant source).
      const _srcLang = pair.split('-')[0];
      const _srcProfile = AppLangProfiles.get(_srcLang);
      if (_srcProfile && _srcProfile.grammaticalGender && (phrase.target || []).length > 1) {
        const _gendered = (phrase.target || [])
          .map((f, i) => ({ f, i }))
          .filter(x => x.f.labels && x.f.labels.gender);
        const _genders = new Set(_gendered.map(x => x.f.labels.gender));
        if (_genders.size > 1) {
          for (const { f, i } of _gendered) {
            if (f.source === undefined) {
              flag(pair, topic, id, `target[${i}].source`, 'R14',
                `Gendered target form needs a per-form source: the source language (${_srcLang}) marks gender, and the badge announces this form's gender, so the L1 hint must match it — do not fall back to the shared phrase source. Add "source" to each gender form (e.g. "Ich bin Student." / "Ich bin Studentin.").`);
            }
          }
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

        // R11 — Language mismatch: the tip is written in the TARGET language, so any
        // non-ASCII letter/mark OUTSIDE that language's nativeChars (lang-profiles) is a
        // wrong-language slip. Fully derived — English (nativeChars '') flags any accent/
        // ¿¡; Spanish allows áéíóúüñ¿¡ but would flag e.g. a stray ç; a new target inherits
        // the check by declaring its nativeChars. No hardcoded pair or charset.
        const foreign = wrongLangChars(tip, pair.split('-')[1]);
        if (foreign) {
          flag(pair, topic, id, 'grammar', 'R11', `Characters foreign to the target language (${foreign}) in tip: "${tip}"`);
        }
      }
    }
  }
}

// DUP — exact-duplicate practiced phrase within a pair (same normalized target text,
// even if the id/topic differ). Scoped to ONE pair — never across pairs (content is
// independent per pair).
for (const pair of PAIRS) {
  for (const [, list] of phraseTexts[pair]) {
    if (list.length > 1)
      flag(pair, list[0].topic, list.map(x => x.id).join(' , '), 'target[0].text', 'DUP',
        `Duplicate practiced phrase across: ${list.map(x => x.topic + '/' + x.id).join(', ')}`);
  }
}

// Vocab checks (target-centric, one lang at a time): exact-duplicate / cross-deck
// term uniqueness (a term lives in ONE deck per target language) + POS↔deck convention.
const VOCAB_BASE = join(BASE, 'vocab');
let vocabLangs = [];
try { vocabLangs = readdirSync(VOCAB_BASE); } catch { /* no vocab dir */ }
for (const lang of vocabLangs) {
  const dir = join(VOCAB_BASE, lang);
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith('.json')); } catch { continue; }
  const termSeen = new Map();   // normTerm -> [{deck,id}]
  for (const f of files) {
    const deck = f === 'words.json' ? 'general' : f.replace(/^words-/, '').replace(/\.json$/, '');
    let words;
    try { words = JSON.parse(readFileSync(join(dir, f), 'utf8')).words || []; } catch { continue; }
    for (const w of words) {
      const nt = norm(w.term);
      if (nt) {
        if (!termSeen.has(nt)) termSeen.set(nt, []);
        termSeen.get(nt).push({ deck, id: w.id });
      }
      // POS↔deck: verbos_* must be Verb, adjetivos_* must be Adjective.
      const expect = /^verbos_/.test(deck) ? 'Verb' : /^adjetivos_/.test(deck) ? 'Adjective' : null;
      if (expect && w.category !== expect)
        flag('vocab/' + lang, deck, w.id, 'category', 'POS',
          `category "${w.category}" ≠ deck convention "${expect}"`);
      // R-gloss: every word must carry a non-empty source-language translation AND gloss
      // for each source language that learns this target (drives the hint/translation UI).
      for (const src of srcLangsFor(lang)) {
        const tr = w.translations && w.translations[src];
        const gl = w.gloss && w.gloss[src];
        if (!tr || !String(tr).trim())
          flag('vocab/' + lang, deck, w.id, `translations.${src}`, 'R-gloss', `Missing/empty translation for source "${src}"`);
        if (!gl || !String(gl).trim())
          flag('vocab/' + lang, deck, w.id, `gloss.${src}`, 'R-gloss', `Missing/empty gloss for source "${src}"`);
      }

      // Structured word variants (optional): a list of EQUAL forms, each with text + registry-valid
      // labels. There is no base/primary — the flashcard shows one form per session (rotation, like
      // phrases) for lexical variants, or the slash pattern for inflectional ones. Labels validated
      // against the same open dimension registry as phrases.
      if (w.variants !== undefined) {
        if (!Array.isArray(w.variants)) {
          flag('vocab/' + lang, deck, w.id, 'variants', 'schema', 'variants must be an array');
        } else {
          w.variants.forEach((v, vi) => {
            if (!v || typeof v.text !== 'string' || !v.text.trim())
              flag('vocab/' + lang, deck, w.id, `variants[${vi}].text`, 'schema', 'variant text must be a non-empty string');
            const labs = (v && v.labels) || {};
            if (Object.keys(labs).length === 0)
              flag('vocab/' + lang, deck, w.id, `variants[${vi}].labels`, 'schema', 'every variant must carry labels');
            for (const e of AppVariantDims.validateLabels(labs, lang)) {
              if (e.code === 'unknown-key')
                flag('vocab/' + lang, deck, w.id, `variants[${vi}].labels.${e.key}`, 'schema', `Unknown label key "${e.key}"`);
              else if (e.code === 'not-applicable')
                flag('vocab/' + lang, deck, w.id, `variants[${vi}].labels.${e.key}`, 'schema', `Label "${e.key}" does not apply to target "${lang}"`);
              else
                flag('vocab/' + lang, deck, w.id, `variants[${vi}].labels.${e.key}`, 'schema', `Invalid ${e.key} value "${e.value}"`);
            }
          });
        }
      }
    }
  }
  for (const [, list] of termSeen) {
    if (list.length > 1)
      flag('vocab/' + lang, list[0].deck, list.map(x => x.id).join(' , '), 'term', 'DUP',
        `Duplicate/cross-deck term across: ${list.map(x => x.deck + '/' + x.id).join(', ')}`);
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
