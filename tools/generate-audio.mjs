/**
 * generate-audio.mjs — Audio sync tool for PracticeEnglish
 *
 * Checks which WAV files are missing for every topic × voice,
 * reports what needs to be generated, then generates only the missing ones.
 * Safe to re-run at any time — existing files are never overwritten.
 *
 * Usage (from repo root):
 *   node tools/generate-audio.mjs           → check + generate missing
 *   node tools/generate-audio.mjs --check   → check only, no generation
 */

import { KokoroTTS }  from 'kokoro-js';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check');

// ── Configuration ────────────────────────────────────────────────────────────

const TOPICS = [
  'greetings', 'traveling', 'technology', 'restaurant',
  'kitchen', 'supermarket', 'entertainment', 'accountability', 'gym',
];

const VOICES = [
  { id: 'af_heart',   speed: 0.95 },
  { id: 'af_bella',   speed: 0.95 },
  { id: 'af_nicole',  speed: 0.95 },
  { id: 'bf_emma',    speed: 0.95 },
  { id: 'am_michael', speed: 0.95 },
];

const AUDIO_DIR = resolve(ROOT, 'speaking-exercises', 'audio');
const JSON_DIR  = resolve(ROOT, 'speaking-exercises', 'json');

// ── Helpers ──────────────────────────────────────────────────────────────────

const clr = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};
const c = (col, s) => col + s + clr.reset;

function loadPhrases(topic) {
  const path = resolve(JSON_DIR, topic + '.json');
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8')).phrases || [];
}

function pcmToWav(float32, sampleRate) {
  const samples = float32.length;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVE', 8, 'ascii'); buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, float32[i] * 32767 | 0)), 44 + i * 2);
  return buf;
}

// ── Step 1: Check ─────────────────────────────────────────────────────────────

console.log('\n' + c(clr.bold, '🔊  PracticeEnglish — Audio Sync'));
console.log(c(clr.dim, '─'.repeat(52)));

// Collect missing files grouped by topic
const missing = {};   // topic → [{ index, voiceId, speed, phrase }]
let totalPhrases = 0, totalExpected = 0, totalMissing = 0;

for (const topic of TOPICS) {
  const phrases = loadPhrases(topic);
  totalPhrases  += phrases.length;
  totalExpected += phrases.length * VOICES.length;

  for (let i = 0; i < phrases.length; i++) {
    for (const { id: voiceId, speed } of VOICES) {
      const file = resolve(AUDIO_DIR, topic, `${i}_${voiceId}.wav`);
      if (!existsSync(file)) {
        if (!missing[topic]) missing[topic] = [];
        missing[topic].push({ index: i, voiceId, speed, phrase: phrases[i] });
        totalMissing++;
      }
    }
  }
}

const totalPresent = totalExpected - totalMissing;

// Print report
console.log(`\nTopics  : ${TOPICS.length}   Voices: ${VOICES.map(v => v.id).join(', ')}`);
console.log(`Expected: ${totalExpected} files  (${totalPhrases} phrases × ${VOICES.length} voices)\n`);

if (totalMissing === 0) {
  console.log(c(clr.green, `✓ All ${totalExpected} audio files present — nothing to generate.\n`));
  process.exit(0);
}

// Per-topic breakdown
for (const topic of TOPICS) {
  const phraseCount   = loadPhrases(topic).length;
  const topicExpected = phraseCount * VOICES.length;
  const topicMissing  = (missing[topic] || []).length;
  const topicPresent  = topicExpected - topicMissing;
  const bar = topicMissing === 0
    ? c(clr.green, '✓')
    : c(clr.yellow, `✗ ${topicMissing} missing`);
  console.log(`  ${topic.padEnd(16)} ${String(topicPresent).padStart(4)}/${topicExpected}  ${bar}`);
}

console.log(c(clr.dim, '\n' + '─'.repeat(52)));
console.log(`  Present : ${c(clr.green,  String(totalPresent))} files`);
console.log(`  Missing : ${c(clr.yellow, String(totalMissing))} files`);
console.log(c(clr.dim, '─'.repeat(52)));

if (CHECK_ONLY) {
  console.log(c(clr.cyan, '\nRun without --check to generate missing files.\n'));
  process.exit(0);
}

// ── Step 2: Generate missing ───────────────────────────────────────────────

console.log(c(clr.cyan, `\nLoading Kokoro-82M (q8)…`));

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
  dtype: 'q8', device: 'cpu',
});
console.log(c(clr.green, 'Model ready ✓') + '\n');

let done = 0, generated = 0, errors = 0;
const startTime = Date.now();

for (const topic of Object.keys(missing)) {
  mkdirSync(resolve(AUDIO_DIR, topic), { recursive: true });
  console.log(c(clr.bold, `── ${topic.toUpperCase()} (${missing[topic].length} missing)`));

  for (const { index, voiceId, speed, phrase } of missing[topic]) {
    const fileName = `${index}_${voiceId}.wav`;
    const filePath = resolve(AUDIO_DIR, topic, fileName);
    done++;
    const pct = (done / totalMissing * 100).toFixed(0).padStart(3);

    try {
      process.stdout.write(`  [${pct}%] ${fileName}  — generating…`);
      const audio = await tts.generate(phrase, { voice: voiceId, speed });
      const wav   = pcmToWav(audio.audio, audio.sampling_rate);
      writeFileSync(filePath, wav);
      process.stdout.write(`\r  [${pct}%] ${fileName}  — ${c(clr.green, `✓ ${wav.length >> 10} KB`)}   \n`);
      generated++;
    } catch (e) {
      process.stdout.write(`\r  [${pct}%] ${fileName}  — ${c(clr.red, '✗ ' + e.message)}\n`);
      errors++;
    }
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
console.log('\n' + c(clr.dim, '─'.repeat(52)));
if (errors === 0) {
  console.log(c(clr.green, `✓ Done in ${elapsed}s — ${generated} files generated.\n`));
} else {
  console.log(c(clr.yellow, `Done in ${elapsed}s — ${generated} generated, ${errors} errors.\n`));
}
