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

// Derived from the content tree — no hardcoded pair/lang lists (CJS derives inline).
const PAIRS = fs.readdirSync(path.join(root, 'shared', 'json', 'pairs'))
  .filter(p => fs.existsSync(path.join(root, 'shared', 'json', 'pairs', p, 'topics.json'))).sort();
const VOCAB_LANGS = fs.readdirSync(path.join(root, 'shared', 'json', 'vocab'))
  .filter(l => fs.statSync(path.join(root, 'shared', 'json', 'vocab', l)).isDirectory()).sort();

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

// ── 2. Compare / write the id-map JSON ───────────────────────────────────────
// Externalized (2026-09) from an inline const in progress.js to shared/json/common/
// id-map.json: progress.js is precached by the service worker for offline, and the
// map (~70 KiB) was gating first paint on the landing (parsed on the critical path).
// Now it is a lazily-fetched, SW-precached JSON — off the critical path. progress.js
// loads it via AppData.get('id-map') with a data-loss-proof migration guard.

const idMapPath = path.join(root, 'shared', 'json', 'common', 'id-map.json');
const newJson   = JSON.stringify(idMap);
const prevJson  = fs.existsSync(idMapPath) ? fs.readFileSync(idMapPath, 'utf8') : null;

if (prevJson === newJson) {
  console.log('✓ id-map.json is already up to date — no changes needed.');
  process.exit(0);
}

if (CHECK) {
  console.error('✗ id-map.json is STALE — content (categories/phrases/vocab) changed but');
  console.error('  shared/json/common/id-map.json was not regenerated, so the Mi Aprendizaje');
  console.error('  path would silently drop the new content.');
  console.error('  Fix: node tools/fix-phrase-ids.js   (then commit shared/json/common/id-map.json)');
  process.exit(1);
}

fs.writeFileSync(idMapPath, newJson, 'utf8');

// ── 3. Verify the written map round-trips ────────────────────────────────────

const written = JSON.parse(fs.readFileSync(idMapPath, 'utf8'));
if (JSON.stringify(written) !== newJson) {
  console.error('❌ Verification failed — written id-map.json does not match the rebuilt map.');
  process.exit(1);
}

const pCount = PAIRS.reduce((s, p) =>
  s + Object.values(phrases[p]).reduce((a, ids) => a + ids.length, 0), 0);
const vCount = VOCAB_LANGS.reduce((s, l) =>
  s + Object.values(vocab[l]).reduce((a, e) => a + e.ids.length, 0), 0);
console.log(`✅ _ID_MAP updated: ${pCount} phrase IDs across ${PAIRS.length} pairs, ` +
            `${vCount} vocab IDs (${VOCAB_LANGS.length} target languages).`);
