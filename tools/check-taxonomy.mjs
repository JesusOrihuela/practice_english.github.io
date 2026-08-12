/* ============================================================
   check-taxonomy.mjs — Taxonomy conformance gate (CI).

   The canonical taxonomy (shared/json/common/category-scopes.json) must stay in
   sync with the actual content, and every phrase must live under its topic's id
   prefix. Verifies, deterministically (no model, cero falsos positivos):

     1. Every content category (phrase topic in each pair's topics.json; vocab deck
        file in shared/json/vocab/<lang>/) has EXACTLY one scope entry of the right
        `kind` in category-scopes.json — and vice versa (no orphan scopes).
     2. Each scope entry has the required fields (id, kind, axis ∈
        topical|functional|property, non-empty scope, ≥1 example).
     3. Every phrase `id` starts with "<topic>_" (id-prefix convention that the SRS,
        _ID_MAP and audio paths rely on).

   Rationale + the semantic layer that consumes these scopes: docs/CONTENT-QUALITY.md

   Usage:  node tools/check-taxonomy.mjs        # exit 1 on any mismatch
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');
const NON_TOPIC = new Set(['grammar-rules', 'placement', 'grammar-phrase-rules', 'topics']);
const AXES = new Set(['topical', 'functional', 'property']);

const fails = [];
const fail = (m) => fails.push(m);

// ── Load the canonical taxonomy ───────────────────────────────
const scopes = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/json/common/category-scopes.json'), 'utf8'));
const scopePhrase = new Map(), scopeVocab = new Map();
for (const c of scopes.categories) {
  const bag = c.kind === 'phrase' ? scopePhrase : c.kind === 'vocab' ? scopeVocab : null;
  if (!bag) { fail(`scope "${c.id}" has invalid kind "${c.kind}"`); continue; }
  if (bag.has(c.id)) fail(`duplicate scope entry ${c.kind}:${c.id}`);
  bag.set(c.id, c);
  if (!AXES.has(c.axis)) fail(`${c.kind}:${c.id} — invalid axis "${c.axis}"`);
  if (!c.scope || !c.scope.trim()) fail(`${c.kind}:${c.id} — empty scope`);
  const nEx = ((c.examples && c.examples.en) || []).length + ((c.examples && c.examples.es) || []).length;
  if (nEx === 0) fail(`${c.kind}:${c.id} — no examples (anchor would be weak)`);
}

// ── Discover actual content categories ────────────────────────
// Phrase topics: union of both pairs' topics.json (t.phrase).
const pairs = fs.readdirSync(PAIRS_DIR).filter(p => fs.existsSync(path.join(PAIRS_DIR, p, 'topics.json')));
const phraseTopics = new Set();
for (const pair of pairs) {
  const tj = JSON.parse(fs.readFileSync(path.join(PAIRS_DIR, pair, 'topics.json'), 'utf8'));
  for (const t of tj.topics.filter(x => x.phrase)) phraseTopics.add(t.id);
}
// Vocab decks: union of deck files across target languages.
const vocabDecks = new Set();
for (const lang of fs.readdirSync(path.join(ROOT, 'shared/json/vocab'))) {
  const dir = path.join(ROOT, 'shared/json/vocab', lang);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')))
    vocabDecks.add(f === 'words.json' ? 'general' : f.replace(/^words-/, '').replace(/\.json$/, ''));
}

// 1. content ↔ scope (both directions)
for (const id of phraseTopics) if (!scopePhrase.has(id)) fail(`phrase topic "${id}" has content but NO scope in category-scopes.json`);
for (const id of scopePhrase.keys()) if (!phraseTopics.has(id)) fail(`scope phrase:"${id}" has no matching phrase topic (orphan scope)`);
for (const id of vocabDecks) if (!scopeVocab.has(id)) fail(`vocab deck "${id}" has content but NO scope in category-scopes.json`);
for (const id of scopeVocab.keys()) if (!vocabDecks.has(id)) fail(`scope vocab:"${id}" has no matching vocab deck (orphan scope)`);

// 3. phrase id prefix convention
for (const pair of pairs) {
  const tj = JSON.parse(fs.readFileSync(path.join(PAIRS_DIR, pair, 'topics.json'), 'utf8'));
  for (const t of tj.topics.filter(x => x.phrase)) {
    const file = path.join(PAIRS_DIR, pair, `${t.id}.json`);
    if (!fs.existsSync(file)) continue;
    const phrases = JSON.parse(fs.readFileSync(file, 'utf8')).phrases || [];
    for (const p of phrases)
      if (!p.id.startsWith(t.id + '_')) fail(`${pair}/${t.id}: phrase id "${p.id}" does not start with "${t.id}_"`);
  }
}

console.log(`Taxonomía: ${scopePhrase.size} scopes de frase, ${scopeVocab.size} de vocab; contenido: ${phraseTopics.size} topics, ${vocabDecks.size} mazos.`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  console.log(`\n✗ ${fails.length} problema(s) de conformidad de taxonomía. Ver docs/CONTENT-QUALITY.md.`);
  process.exit(1);
}
console.log('\n✓ La taxonomía coincide con el contenido y las convenciones de id.');
