// tools/fix-phrase-ids.js
// Regenerates _ID_MAP in shared/js/progress.js from the actual JSON files.
//
// Run this script ANY TIME you add, edit, or remove phrases or vocabulary words
// from any shared/json/*.json file. Forgetting to run it will silently break
// the Mi Aprendizaje daily session builder (PathSession).
//
// Usage:
//   node tools/fix-phrase-ids.js
//
// Safe to run multiple times — only rewrites the file if IDs are actually stale.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

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

// ── 1. Extract IDs from JSON files ───────────────────────────────────────────

// Phrase IDs are read from the es-en pair (the canonical set for _ID_MAP).
// NOTE: pre-existing limitation — _ID_MAP is single-pair; per-pair phrase IDs
// may diverge under content independence. Out of scope for the folder reorg.
const phraseIds = {};
for (const topic of phraseTopics) {
  const filePath = path.join(root, 'shared', 'json', 'pairs', 'es-en', `${topic}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = data.phrases || data;
  phraseIds[topic] = items.map(p => p.id);
}

const vocabIds = {};
for (const topic of vocabTopics) {
  const filename = topic === 'general' ? 'words.json' : `words-${topic}.json`;
  const filePath = path.join(root, 'shared', 'json', 'common', 'vocab', filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = data.words || data;
  vocabIds[topic] = items.map(w => w.id);
}

// ── 2. Read progress.js ───────────────────────────────────────────────────────

const progressPath = path.join(root, 'shared', 'js', 'progress.js');
let src = fs.readFileSync(progressPath, 'utf8');

// ── 3. Replace each topic's array ────────────────────────────────────────────

function replaceArray(src, key, newIds) {
  // Match "key":[ or "key": [ and find the matching closing bracket
  const keyMarker = src.includes(`"${key}": [`) ? `"${key}": [` : `"${key}":[`;
  const startIdx = src.indexOf(keyMarker);
  if (startIdx === -1) {
    console.error(`  ✗ Could not find key: "${key}"`);
    return src;
  }

  const openBracket = startIdx + keyMarker.length - 1;
  let depth = 0;
  let closeBracket = -1;
  for (let i = openBracket; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) { closeBracket = i; break; }
    }
  }

  if (closeBracket === -1) {
    console.error(`  ✗ Could not find closing bracket for: "${key}"`);
    return src;
  }

  return src.slice(0, openBracket) + JSON.stringify(newIds) + src.slice(closeBracket + 1);
}

let changed = false;
const original = src;

for (const topic of phraseTopics) {
  src = replaceArray(src, topic, phraseIds[topic]);
}

for (const topic of vocabTopics) {
  // vocab IDs are nested under "ids" key, not the topic key directly
  // Find the vocab topic block and replace its "ids" array
  // The structure is: "topic":{"quizBase":"...","vocabBase":"...","ids":[...]}
  // We use a unique marker: the quizBase string helps us find the right block
  const quizBase = topic === 'general' ? 'quiz_vocab' : `quiz_${topic}`;
  const marker = `"${quizBase}"`;
  const blockStart = src.indexOf(marker);
  if (blockStart === -1) {
    console.error(`  ✗ Could not locate vocab block for: "${topic}"`);
    continue;
  }
  // Within this block, find "ids":[
  const idsMarker = src.indexOf('"ids":', blockStart);
  if (idsMarker === -1) {
    console.error(`  ✗ Could not find "ids" in vocab block for: "${topic}"`);
    continue;
  }
  // Now find the opening bracket
  const openIdx = src.indexOf('[', idsMarker);
  // Find matching close
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) { closeIdx = i; break; }
    }
  }
  if (closeIdx === -1) {
    console.error(`  ✗ Could not find closing bracket for vocab ids: "${topic}"`);
    continue;
  }
  src = src.slice(0, openIdx) + JSON.stringify(vocabIds[topic]) + src.slice(closeIdx + 1);
}

// ── 4. Verify and write ───────────────────────────────────────────────────────

if (src === original) {
  console.log('✓ _ID_MAP is already up to date — no changes needed.');
  process.exit(0);
}

fs.writeFileSync(progressPath, src, 'utf8');

// Quick verification
const mapMatch = src.match(/const _ID_MAP = ({[\s\S]*?});/);
const _ID_MAP = JSON.parse(mapMatch[1]);

let allOk = true;
for (const topic of phraseTopics) {
  const ok = JSON.stringify(_ID_MAP.phrases[topic]) === JSON.stringify(phraseIds[topic]);
  if (!ok) { allOk = false; console.error(`  ✗ phrases.${topic} mismatch after write`); }
}
for (const topic of vocabTopics) {
  const ok = JSON.stringify(_ID_MAP.vocab[topic]?.ids) === JSON.stringify(vocabIds[topic]);
  if (!ok) { allOk = false; console.error(`  ✗ vocab.${topic} mismatch after write`); }
}

if (allOk) {
  const pCount = phraseTopics.reduce((s, t) => s + phraseIds[t].length, 0);
  const vCount = vocabTopics.reduce((s, t) => s + vocabIds[t].length, 0);
  console.log(`✅ _ID_MAP updated: ${pCount} phrase IDs, ${vCount} vocab IDs across ${phraseTopics.length + vocabTopics.length} topics.`);
} else {
  console.error('❌ Verification failed — check output above.');
  process.exit(1);
}
