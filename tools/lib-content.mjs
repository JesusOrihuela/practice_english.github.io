/* ============================================================
   lib-content.mjs — Shared content-tree discovery. The ONE place tools learn what
   pairs / phrase topics / vocab decks exist, all DERIVED from the filesystem +
   topics.json. No tool hardcodes these lists, so adding/removing a pair, a phrase
   topic, or a vocab deck needs a single content change (topics.json / a new file)
   and NO tool edit — and everything adapts to new languages/pairs automatically.

   ESM. CommonJS tools (fix-phrase-ids.js) and Python (generate-audio-tgt.py) derive
   inline the same way (readdir + topics.json).
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');
const VOCAB_DIR = path.join(ROOT, 'shared/json/vocab');

/** Language pairs = content dirs with a topics.json (e.g. 'es-en', 'en-es'). */
export function discoverPairs() {
  return fs.readdirSync(PAIRS_DIR)
    .filter(p => fs.existsSync(path.join(PAIRS_DIR, p, 'topics.json'))).sort();
}

/** { id, sourceLang, targetLang } for a pair id 'src-tgt'. */
export function pairMeta(pair) {
  const [sourceLang, targetLang] = pair.split('-');
  return { id: pair, sourceLang, targetLang };
}

/** Phrase topic ids declared in a pair's topics.json (t.phrase). */
export function phraseTopicsFor(pair) {
  return JSON.parse(fs.readFileSync(path.join(PAIRS_DIR, pair, 'topics.json'), 'utf8'))
    .topics.filter(t => t.phrase).map(t => t.id);
}

/** Union of phrase topics across all pairs (sorted). */
export function allPhraseTopics() {
  const s = new Set();
  for (const p of discoverPairs()) for (const t of phraseTopicsFor(p)) s.add(t);
  return [...s].sort();
}

/** Target languages with a vocab dir (e.g. 'en', 'es'). */
export function vocabLangs() {
  return fs.readdirSync(VOCAB_DIR)
    .filter(l => fs.statSync(path.join(VOCAB_DIR, l)).isDirectory()).sort();
}

/** Vocab deck ids for a language (words.json → 'general'). */
export function vocabDecksFor(lang) {
  return fs.readdirSync(path.join(VOCAB_DIR, lang)).filter(f => f.endsWith('.json'))
    .map(f => f === 'words.json' ? 'general' : f.replace(/^words-/, '').replace(/\.json$/, '')).sort();
}

/** Union of vocab decks across all languages. `general` (words.json) is included;
 *  callers whose audio/path convention treats the general deck separately can
 *  `.filter(d => d !== 'general')`. */
export function allVocabDecks() {
  const s = new Set();
  for (const l of vocabLangs()) for (const d of vocabDecksFor(l)) s.add(d);
  return [...s].sort();
}
