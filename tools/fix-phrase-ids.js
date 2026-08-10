// tools/fix-phrase-ids.js
// Regenerates _ID_MAP in shared/js/progress.js from the actual JSON files.
//
// _ID_MAP structure:
//   { phrases: { <pairId>:    { <topic>: [phraseId, ...] } },
//     vocab:   { <targetLang>: { <topic>: { quizBase, vocabBase, ids: [wordId, ...] } } } }
//
// The topic lists are DERIVED, not hardcoded, so adding a category or phrase flows
// through automatically (the Mi Aprendizaje path reads _ID_MAP for every topic):
//   - phrases: each pair's phrase topics come from that pair's topics.json (t.phrase).
//     Content is independent per pair, so each pair is read separately.
//   - vocab: target-centric (shared/json/vocab/{lang}/), discovered from the words*.json
//     files present; keyed by target language, shared across pairs with the same target.
//
// Run this ANY TIME you add, edit, or remove phrases, vocabulary words, or categories.
// Forgetting silently drops the affected content from the path session builder — so
// CI runs `--check` (below) to fail the build if progress.js drifts from the content.
//
// Usage:
//   node tools/fix-phrase-ids.js            # regenerate (writes only if changed)
//   node tools/fix-phrase-ids.js --check    # exit 1 if _ID_MAP is stale (no write) — CI

const fs = require('fs');
const path = require('path');

const root  = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

const PAIRS       = ['es-en', 'en-es'];
const VOCAB_LANGS = ['en', 'es'];

// ── Derive topic lists from the content (single source of truth) ─────────────

// Phrase topics for a pair = the phrase categories declared in its topics.json,
// in that file's order (deterministic — same committed file everywhere).
function phraseTopicsFor(pair) {
  const tj = JSON.parse(fs.readFileSync(
    path.join(root, 'shared', 'json', 'pairs', pair, 'topics.json'), 'utf8'));
  return (tj.topics || []).filter(t => t.phrase).map(t => t.id);
}

// Vocab topics for a language = the words*.json files present, sorted for a
// deterministic order across filesystems (readdir order is not portable).
function vocabTopicsFor(lang) {
  const dir = path.join(root, 'shared', 'json', 'vocab', lang);
  return fs.readdirSync(dir)
    .filter(f => f === 'words.json' || /^words-.+\.json$/.test(f))
    .map(f => (f === 'words.json' ? 'general' : f.replace(/^words-/, '').replace(/\.json$/, '')))
    .sort();
}

// ── 1. Build the map from JSON ───────────────────────────────────────────────

// Phrases: per-pair (IDs can differ between pairs under content independence).
const phrases = {};
for (const pair of PAIRS) {
  phrases[pair] = {};
  for (const topic of phraseTopicsFor(pair)) {
    const filePath = path.join(root, 'shared', 'json', 'pairs', pair, `${topic}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    phrases[pair][topic] = (data.phrases || data).map(p => p.id);
  }
}

// Vocabulary: target-centric (shared/json/vocab/{targetLang}/). Word selection
// and CEFR levels are independent per target language (English NGSL core vs
// Spanish ELELex core), so the map is keyed by target language.
const vocab = {};
for (const lang of VOCAB_LANGS) {
  vocab[lang] = {};
  for (const topic of vocabTopicsFor(lang)) {
    const filename = topic === 'general' ? 'words.json' : `words-${topic}.json`;
    const filePath = path.join(root, 'shared', 'json', 'vocab', lang, filename);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    vocab[lang][topic] = {
      quizBase:  topic === 'general' ? 'quiz_vocab' : `quiz_${topic}`,
      vocabBase: topic === 'general' ? 'vocab' : `vocab_${topic}`,
      ids: (data.words || data).map(w => w.id),
    };
  }
}

const idMap = { phrases, vocab };

// ── 2. Compare / replace the _ID_MAP block in progress.js ────────────────────

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

if (CHECK) {
  console.error('✗ _ID_MAP is STALE — content (categories/phrases/vocab) changed but');
  console.error('  shared/js/progress.js was not regenerated, so the Mi Aprendizaje path');
  console.error('  would silently drop the new content.');
  console.error('  Fix: node tools/fix-phrase-ids.js   (then commit shared/js/progress.js)');
  process.exit(1);
}

fs.writeFileSync(progressPath, newSrc, 'utf8');

// ── 3. Verify the written map round-trips ────────────────────────────────────

const written = JSON.parse(newSrc.match(/const _ID_MAP = (\{[\s\S]*?\});/)[1]);
if (JSON.stringify(written) !== JSON.stringify(idMap)) {
  console.error('❌ Verification failed — written _ID_MAP does not match the rebuilt map.');
  process.exit(1);
}

const pCount = PAIRS.reduce((s, p) =>
  s + Object.values(phrases[p]).reduce((a, ids) => a + ids.length, 0), 0);
const vCount = VOCAB_LANGS.reduce((s, l) =>
  s + Object.values(vocab[l]).reduce((a, e) => a + e.ids.length, 0), 0);
console.log(`✅ _ID_MAP updated: ${pCount} phrase IDs across ${PAIRS.length} pairs, ` +
            `${vCount} vocab IDs (${VOCAB_LANGS.length} target languages).`);
