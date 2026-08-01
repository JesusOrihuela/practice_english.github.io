/**
 * lib-freq.mjs — Shared frequency-signal helpers
 * ==============================================
 * Used by reconcile.mjs and build-candidates.mjs. Loads the CEFR-banded
 * frequency index built by tools/sources/build-freq-inventory.mjs and provides
 * tokenization + a light morphological lookup so surface-form frequency lists
 * still recognise inflected/enclitic Spanish word forms.
 *
 * This is a frequency *signal*, not a lemmatizer or parser.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DERIVED = join(__dirname, 'sources', 'derived');

export const CEFR_ORDER = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
export const BAND_ORDER = { A1: 0, A2: 1, B1: 2, 'B2+': 3 };
export const BAND_AS_CEFR = { A1: 'A1', A2: 'A2', B1: 'B1', 'B2+': 'B2' };

export function loadFreq(lang) {
  const p = join(DERIVED, `${lang}-freq.json`);
  if (!existsSync(p)) {
    throw new Error(`missing ${p}. Run tools/sources/build-freq-inventory.mjs first.`);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Tokenize keeping accents (Spanish freq keys are accented): lowercase, strip
// surrounding punctuation, drop pure-digit tokens.
export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[¿?¡!.,;:«»"“”()\[\]…]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^['´`]+|['´`]+$/g, ''))
    .filter(w => w && !/^\d+$/.test(w));
}

export function rankToBand(rank) {
  if (rank == null) return null;
  if (rank <= 1000) return 'A1';
  if (rank <= 3000) return 'A2';
  if (rank <= 5000) return 'B1';
  return 'B2+';
}

const ES_ENCLITICS = ['melo','mela','selo','sela','telo','tela','noslo','nosla','me','te','se','nos','os','le','les','lo','la','los','las'];

// Best (lowest) rank found for a surface word, trying light morphological
// fallbacks for the given language. `ranks` is the {word: rank} map.
export function lookupRank(word, lang, ranks) {
  const direct = ranks[word];
  if (direct != null) return direct;
  const cands = new Set();
  if (lang === 'es') {
    let base = word;
    for (let i = 0; i < 2; i++) {
      const hit = ES_ENCLITICS.find(s => base.length - s.length >= 3 && base.endsWith(s));
      if (!hit) break;
      base = base.slice(0, -hit.length);
      cands.add(base);
      cands.add(base + 'r');
    }
    if (word.endsWith('as')) cands.add(word.slice(0, -2) + 'os');
    if (word.endsWith('a'))  cands.add(word.slice(0, -1) + 'o');
    if (word.endsWith('es') && word.length > 4) cands.add(word.slice(0, -2));
    if (word.endsWith('s')  && word.length > 3) cands.add(word.slice(0, -1));
  } else {
    if (word.endsWith('s') && word.length > 3) cands.add(word.slice(0, -1));
    if (word.endsWith('ed') && word.length > 4) { cands.add(word.slice(0, -1)); cands.add(word.slice(0, -2)); }
    if (word.endsWith('ing') && word.length > 5) cands.add(word.slice(0, -3));
  }
  let best = null;
  for (const c of cands) {
    const r = ranks[c];
    if (r != null && (best == null || r < best)) best = r;
  }
  return best;
}
