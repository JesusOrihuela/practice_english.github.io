/**
 * build-candidates.mjs — Surface verified candidate phrases from Tatoeba
 * =====================================================================
 * Mines the Tatoeba parallel corpus (CC-BY 2.0 FR) for natural, native-written
 * sentences that (a) belong to a topic (keyword match) and (b) whose target-
 * language vocabulary sits within the frequency core of the requested CEFR
 * level. Output is pre-mapped to the project phrase schema so a human curator
 * can accept/adjust rather than write from scratch.
 *
 * It NEVER writes into shared/json. It writes a candidate pool to
 * tools/sources/derived/{pair}-{topic}-{level}-candidates.json and prints a
 * preview. Curation (naturalness, neutro, gender/register variants, grammar
 * tips, slugs, audio) is applied by hand on the accepted subset, then the
 * mandatory pipeline runs.
 *
 * Corpus expected at tools/sources/raw/Tatoeba.en-es.en / .es (OPUS moses
 * format). Only the en-es corpus is bundled today; pass --corpus to override.
 *
 * USAGE (from tools/):
 *   node build-candidates.mjs --pair en-es --topic greetings --level A1 --n 40
 *
 * EXIT CODE: 0 always.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadFreq, tokenize, lookupRank } from './lib-freq.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW     = join(__dirname, 'sources', 'raw');
const DERIVED = join(__dirname, 'sources', 'derived');

// Max frequency rank allowed for a word at each level (⊆ core). Words rarer than
// this (or unseen) disqualify a sentence for that level — we want clean cores.
const LEVEL_MAX_RANK = { A1: 1200, A2: 3000, B1: 5000, B2: 6000 };
// Rough word-count ceilings so candidates are level-plausible for dictation.
const LEVEL_MAX_WORDS = { A1: 8, A2: 10, B1: 12, B2: 14 };

// Topic keyword sets (target-language, lowercase, accented). Seeded from the
// official inventories (PCIC for es). Extend as new topics are curated.
const TOPIC_KEYWORDS = {
  greetings: [
    'hola', 'buenos días', 'buenas tardes', 'buenas noches', 'adiós', 'chao',
    'hasta luego', 'hasta mañana', 'hasta pronto', 'nos vemos', 'qué tal',
    'cómo estás', 'cómo está', 'cómo te va', 'mucho gusto', 'encantado',
    'encantada', 'bienvenido', 'bienvenida', 'un placer', 'un abrazo',
    'saludos', 'cuídate', 'buen día',
  ],
  daily_routine: [
    'me levanto', 'me despierto', 'despierto', 'me ducho', 'me baño', 'me visto',
    'desayuno', 'almuerzo', 'ceno', 'me acuesto', 'duermo', 'me duermo',
    'rutina', 'todos los días', 'cada día', 'por la mañana', 'por la tarde',
    'por la noche', 'me cepillo los dientes', 'salgo de casa', 'llego a casa',
    'vuelvo a casa', 'regreso a casa', 'voy al trabajo', 'hago ejercicio',
    'me preparo', 'antes de dormir', 'después de comer',
  ],
};

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const PAIR  = argVal('--pair');
const TOPIC = argVal('--topic');
const LEVEL = argVal('--level') || 'A1';
const N     = parseInt(argVal('--n') || '40', 10);

if (!PAIR || !TOPIC) { console.error('ERROR: --pair <id> --topic <name> required'); process.exit(1); }
const [srcLang, tgtLang] = PAIR.split('-');
const keywords = TOPIC_KEYWORDS[TOPIC];
if (!keywords) { console.error(`ERROR: no keyword set for topic "${TOPIC}". Add one to TOPIC_KEYWORDS.`); process.exit(1); }
const maxRank  = LEVEL_MAX_RANK[LEVEL] ?? 6000;
const maxWords = LEVEL_MAX_WORDS[LEVEL] ?? 14;

// ── load resources ──────────────────────────────────────────────────────────
const FREQ = loadFreq(tgtLang);
const RANKS = FREQ.ranks;

// Corpus is named by canonical direction en-es; map either pair id onto it.
const corpusBase = join(RAW, `Tatoeba.en-es`);
const enFile = `${corpusBase}.en`, esFile = `${corpusBase}.es`;
if (!existsSync(enFile) || !existsSync(esFile)) {
  console.error(`ERROR: Tatoeba corpus not found at ${enFile} / ${esFile}`); process.exit(1);
}
const enLines = readFileSync(enFile, 'utf8').split(/\r?\n/);
const esLines = readFileSync(esFile, 'utf8').split(/\r?\n/);
// target side = the pair's target language; source side = the hint language
const tgtLines = tgtLang === 'es' ? esLines : enLines;
const srcLines = srcLang === 'es' ? esLines : enLines;

// ── filters ─────────────────────────────────────────────────────────────────
function passesProjectBasics(text) {
  if (/[—;:]/.test(text)) return false;                  // Rule 6
  if (!/[.?!]$/.test(text.trim())) return false;          // Rule 17 terminal punct
  if (text.split(/\s+/).length > maxWords) return false;  // level word cap
  if (/["“”()\[\]*_/\\]/.test(text)) return false;        // stray markup/quotes
  return true;
}

function withinCore(text) {
  const words = tokenize(text);
  if (!words.length) return false;
  for (const w of words) {
    const r = lookupRank(w, tgtLang, RANKS);
    if (r == null || r > maxRank) return false;
  }
  return true;
}

function matchesTopic(tgtText, srcText) {
  const hay = (tgtText + '  ' + srcText).toLowerCase();
  return keywords.some(k => hay.includes(k));
}

// ── mine ────────────────────────────────────────────────────────────────────
const seen = new Set();
const candidates = [];
for (let i = 0; i < tgtLines.length; i++) {
  const tgt = (tgtLines[i] || '').trim();
  const src = (srcLines[i] || '').trim();
  if (!tgt || !src) continue;
  if (!matchesTopic(tgt, src)) continue;
  if (!passesProjectBasics(tgt)) continue;
  if (!withinCore(tgt)) continue;
  const key = tgt.toLowerCase().replace(/[¿?¡!.,]/g, '');
  if (seen.has(key)) continue;
  seen.add(key);
  candidates.push({ target: tgt, source: src });
  if (candidates.length >= N * 3) break;   // gather a surplus to curate down
}

// Prefer shorter, higher-frequency sentences (better A1/A2 exemplars).
candidates.sort((a, b) => a.target.length - b.target.length);
const top = candidates.slice(0, N);

const out = {
  _source: 'Tatoeba via OPUS (CC BY 2.0 FR) + FrequencyWords core filter',
  _note: 'Candidatos crudos. Requieren curaduria manual: naturalidad, espanol neutro, variantes de genero/registro, tips de gramatica, slugs y audio.',
  pair: PAIR, topic: TOPIC, level: LEVEL, maxRank, maxWords,
  count: top.length,
  candidates: top.map((c, k) => ({
    id: `${TOPIC}_cand_${String(k + 1).padStart(2, '0')}`,
    source: c.source,
    level: LEVEL,
    grammar: null,
    target: [{ text: c.target }],
  })),
};
const outPath = join(DERIVED, `${PAIR}-${TOPIC}-${LEVEL}-candidates.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`\n${top.length} candidatos ${PAIR} · ${TOPIC} · ${LEVEL} (maxRank ${maxRank}, ≤${maxWords} palabras)\n`);
for (const c of top) console.log(`  ${c.target}   ⟵  ${c.source}`);
console.log(`\nPool: tools/sources/derived/${PAIR}-${TOPIC}-${LEVEL}-candidates.json`);
