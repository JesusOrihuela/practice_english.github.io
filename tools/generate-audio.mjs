/**
 * generate-audio.mjs — PracticeEnglish Audio Generator
 * ======================================================
 * Checks ALL audio sources and generates any missing WAV files using
 * Kokoro-82M TTS. Existing files are always skipped — safe to re-run
 * at any time, including after adding or editing phrases.
 *
 * SOURCES covered:
 *   Phrase topics  → shared/audio/{topic}/{i}_{voice}.wav
 *   Vocab general  → shared/audio/vocab/{i}_{voice}.wav
 *   Vocab topics   → shared/audio/vocab_{topic}/{i}_{voice}.wav
 *
 * USAGE (run from the tools/ directory):
 *   node generate-audio.mjs                  # check + generate everything
 *   node generate-audio.mjs --check          # dry-run: only report missing files
 *   node generate-audio.mjs --topic greetings          # single phrase topic
 *   node generate-audio.mjs --topic vocab              # general vocab only
 *   node generate-audio.mjs --topic vocab_greetings    # topic vocab only
 *
 * VOICES generated (edit VOICES below to change):
 *   af_heart · af_bella · bf_emma · am_michael
 *
 * REQUIREMENTS:
 *   - Node.js ≥ 18
 *   - kokoro-js installed (npm install in tools/)
 *   - Run from the tools/ directory so relative paths resolve correctly
 */

import { KokoroTTS } from 'kokoro-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Configuration ──────────────────────────────────────────────────────────

const VOICES = ['af_heart', 'af_bella', 'bf_emma', 'am_michael'];
const MODEL  = 'onnx-community/Kokoro-82M-ONNX';
const DTYPE  = 'fp32';   // 'q8' is faster but lower quality
const SPEED  = 0.95;

/** All phrase topic IDs (each maps to shared/json/{id}.json) */
const PHRASE_TOPICS = [
  'greetings', 'traveling', 'technology', 'restaurant',
  'kitchen', 'supermarket', 'entertainment', 'accountability', 'gym',
];

/** All vocabulary topic IDs (each maps to shared/json/words-{id}.json) */
const VOCAB_TOPICS = [
  'accountability', 'entertainment', 'greetings', 'gym',
  'kitchen', 'restaurant', 'supermarket', 'technology', 'traveling',
];

// ── Parse CLI arguments ────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const checkOnly = args.includes('--check');
const topicArg  = args.includes('--topic') ? args[args.indexOf('--topic') + 1] : null;

// ── Build source list ──────────────────────────────────────────────────────

/**
 * Each source has:
 *   id       — unique key used for --topic filter
 *   jsonPath — path to the JSON file
 *   outDir   — directory where WAV files are written
 *   getText  — function(item) → string to synthesize
 *   getItems — function(data) → array of items
 */
const ALL_SOURCES = [
  // Phrase topics
  ...PHRASE_TOPICS.map(id => ({
    id,
    jsonPath: resolve(__dirname, `../shared/json/${id}.json`),
    outDir:   resolve(__dirname, `../shared/audio/${id}`),
    getItems: data => data.phrases || [],
    getText:  item => item,
  })),

  // General vocabulary
  {
    id:       'vocab',
    jsonPath: resolve(__dirname, '../shared/json/words.json'),
    outDir:   resolve(__dirname, '../shared/audio/vocab'),
    getItems: data => data.words || [],
    getText:  item => item.word,
  },

  // Topic-specific vocabulary
  ...VOCAB_TOPICS.map(id => ({
    id:       `vocab_${id}`,
    jsonPath: resolve(__dirname, `../shared/json/words-${id}.json`),
    outDir:   resolve(__dirname, `../shared/audio/vocab_${id}`),
    getItems: data => data.words || [],
    getText:  item => item.word,
  })),
];

// Apply --topic filter
const sources = topicArg
  ? ALL_SOURCES.filter(s => s.id === topicArg)
  : ALL_SOURCES;

if (sources.length === 0) {
  console.error(`Unknown topic: "${topicArg}". Valid IDs:\n  ${ALL_SOURCES.map(s => s.id).join('\n  ')}`);
  process.exit(1);
}

// ── Collect missing tasks ──────────────────────────────────────────────────

const tasks = [];
let totalExpected = 0;

for (const src of sources) {
  if (!existsSync(src.jsonPath)) {
    console.warn(`  [skip] JSON not found: ${src.jsonPath}`);
    continue;
  }

  const data  = JSON.parse(readFileSync(src.jsonPath, 'utf8'));
  const items = src.getItems(data);

  mkdirSync(src.outDir, { recursive: true });

  for (let i = 0; i < items.length; i++) {
    for (const voice of VOICES) {
      totalExpected++;
      const outPath = resolve(src.outDir, `${i}_${voice}.wav`);
      if (!existsSync(outPath)) {
        tasks.push({ src: src.id, i, voice, text: src.getText(items[i]), outPath });
      }
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────

const existing = totalExpected - tasks.length;
console.log(`\nAudio check complete`);
console.log(`  Expected : ${totalExpected} files (${sources.length} source(s) × ${VOICES.length} voices)`);
console.log(`  Existing : ${existing}`);
console.log(`  Missing  : ${tasks.length}`);

if (tasks.length === 0) {
  console.log('\nAll audio files are up to date.');
  process.exit(0);
}

if (checkOnly) {
  console.log('\nMissing files:');
  for (const t of tasks) {
    console.log(`  ${t.src}/${t.i}_${t.voice}.wav  — "${t.text.slice(0, 60)}"`);
  }
  console.log('\n(dry-run — pass without --check to generate)');
  process.exit(0);
}

// ── Generate ───────────────────────────────────────────────────────────────

console.log(`\nLoading Kokoro-82M (dtype=${DTYPE})…`);
const tts = await KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE });
console.log('Model ready.\n');

/** Encode Float32 PCM → 16-bit WAV Buffer */
function encodeWav(samples, sampleRate) {
  const numSamples = samples.length;
  const byteCount  = numSamples * 2;
  const buf        = Buffer.alloc(44 + byteCount);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + byteCount, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(byteCount, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

let generated = 0;
let errors    = 0;

for (const { src, i, voice, text, outPath } of tasks) {
  const label = `[${generated + errors + 1}/${tasks.length}] ${src}/${i}_${voice}.wav`;
  process.stdout.write(`${label} — "${text.slice(0, 50)}"… `);
  try {
    const result = await tts.generate(text, { voice, speed: SPEED });
    writeFileSync(outPath, encodeWav(result.audio, result.sampling_rate));
    console.log('✓');
    generated++;
  } catch (e) {
    console.log(`✗  ${e.message}`);
    errors++;
  }
}

console.log(`\nDone — ${generated} generated, ${errors} errors, ${existing} already existed.`);
if (errors > 0) process.exit(1);
