// tools/fix-phrase-ids.js
// Regenerates _ID_MAP in shared/js/progress.js from the actual JSON files.
//
// _ID_MAP structure:
//   { phrases: { <pairId>: { <topic>: [phraseId, ...] } },
//     vocab:   { <topic>:  { quizBase, vocabBase, ids: [wordId, ...] } } }
//
// Phrases are keyed by pair — content is independent per pair, so phrase IDs
// may diverge (e.g. es-en/restaurant has 76 phrases, en-es/restaurant has 77).
// Vocabulary is shared across pairs (a single bilingual dataset under common/vocab).
//
// Run this ANY TIME you add, edit, or remove phrases or vocabulary words. Forgetting
// silently breaks the Mi Aprendizaje session builder (PathSession) for the affected pair.
//
// Usage:
//   node tools/fix-phrase-ids.js
//
// Safe to run multiple times — only rewrites the file if the map actually changed.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const PAIRS = ['es-en', 'en-es'];

const phraseTopics = [
  'greetings', 'restaurant', 'supermarket', 'kitchen',
  'transportation', 'airport', 'accommodation',
  'movies', 'music', 'theater',
  'gym', 'technology', 'accountability',
];

const vocabTopics = [
  'general', 'greetings', 'restaurant', 'supermarket', 'kitchen',
  'transportation', 'airport', 'accommodation',
  'movies', 'music', 'theater',
  'gym', 'technology', 'accountability',
];

// ── 1. Build the map from JSON ───────────────────────────────────────────────

// Phrases: per-pair (IDs can differ between pairs under content independence).
const phrases = {};
for (const pair of PAIRS) {
  phrases[pair] = {};
  for (const topic of phraseTopics) {
    const filePath = path.join(root, 'shared', 'json', 'pairs', pair, `${topic}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    phrases[pair][topic] = (data.phrases || data).map(p => p.id);
  }
}

// Vocabulary: shared across pairs (single dataset under common/vocab).
const vocab = {};
for (const topic of vocabTopics) {
  const filename = topic === 'general' ? 'words.json' : `words-${topic}.json`;
  const filePath = path.join(root, 'shared', 'json', 'common', 'vocab', filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  vocab[topic] = {
    quizBase:  topic === 'general' ? 'quiz_vocab' : `quiz_${topic}`,
    vocabBase: topic === 'general' ? 'vocab' : `vocab_${topic}`,
    ids: (data.words || data).map(w => w.id),
  };
}

const idMap = { phrases, vocab };

// ── 2. Replace the whole _ID_MAP block in progress.js ────────────────────────

const progressPath = path.join(root, 'shared', 'js', 'progress.js');
const src = fs.readFileSync(progressPath, 'utf8');

const _ID_MAP_RE = /const _ID_MAP = \{[\s\S]*?\};/;
if (!_ID_MAP_RE.test(src)) {
  console.error('  ✗ Could not locate the _ID_MAP block in progress.js');
  process.exit(1);
}

const newBlock = 'const _ID_MAP = ' + JSON.stringify(idMap) + ';';
const newSrc = src.replace(_ID_MAP_RE, newBlock);

if (newSrc === src) {
  console.log('✓ _ID_MAP is already up to date — no changes needed.');
  process.exit(0);
}

fs.writeFileSync(progressPath, newSrc, 'utf8');

// ── 3. Verify ─────────────────────────────────────────────────────────────────

const written = JSON.parse(newSrc.match(/const _ID_MAP = (\{[\s\S]*?\});/)[1]);
let allOk = true;
for (const pair of PAIRS) {
  for (const topic of phraseTopics) {
    if (JSON.stringify(written.phrases[pair][topic]) !== JSON.stringify(phrases[pair][topic])) {
      allOk = false; console.error(`  ✗ phrases.${pair}.${topic} mismatch after write`);
    }
  }
}
for (const topic of vocabTopics) {
  if (JSON.stringify(written.vocab[topic].ids) !== JSON.stringify(vocab[topic].ids)) {
    allOk = false; console.error(`  ✗ vocab.${topic} mismatch after write`);
  }
}

if (allOk) {
  const pCount = PAIRS.reduce((s, p) => s + phraseTopics.reduce((a, t) => a + phrases[p][t].length, 0), 0);
  const vCount = vocabTopics.reduce((s, t) => s + vocab[t].ids.length, 0);
  console.log(`✅ _ID_MAP updated: ${pCount} phrase IDs across ${PAIRS.length} pairs, ${vCount} vocab IDs.`);
} else {
  console.error('❌ Verification failed — check output above.');
  process.exit(1);
}
