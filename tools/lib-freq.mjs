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

// Common English irregular past/participle → base lemma. Regular -s/-ed/-ing are
// handled by suffix rules; this covers the strong verbs whose stem changes.
const EN_IRREGULAR = {
  became: 'become', held: 'hold', heard: 'hear', spent: 'spend', fell: 'fall', fallen: 'fall',
  grew: 'grow', grown: 'grow', won: 'win', bore: 'bear', born: 'bear', borne: 'bear',
  drew: 'draw', drawn: 'draw', wore: 'wear', worn: 'wear', threw: 'throw', thrown: 'throw',
  flew: 'fly', flown: 'fly', sat: 'sit', fought: 'fight', taught: 'teach', led: 'lead',
  bought: 'buy', caught: 'catch', paid: 'pay', sold: 'sell', lost: 'lose', sent: 'send',
  broke: 'break', broken: 'break', chose: 'choose', chosen: 'choose', rose: 'rise', risen: 'rise',
  drove: 'drive', driven: 'drive', rang: 'ring', rung: 'ring', struck: 'strike', sought: 'seek',
  dealt: 'deal', meant: 'mean', kept: 'keep', brought: 'bring', laid: 'lay', built: 'build',
  found: 'find', told: 'tell', gave: 'give', given: 'give', took: 'take', taken: 'take',
  came: 'come', knew: 'know', known: 'know', thought: 'think', felt: 'feel', met: 'meet',
  ran: 'run', wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak', stood: 'stand',
  understood: 'understand', left: 'leave',
};

// Light morphological fallbacks, keyed by language — a NEW language adds its block here (no
// `lang === 'xx'` branch to edit). Each fn adds lemma candidates for a surface word to `cands`.
// The English block is the default fallback (suffix stripping) for any language without its own.
const MORPH = {
  es: (word, cands) => {
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
    // Verb → infinitive reconstruction. A direct dictionary hit already returned in lookupRank,
    // so a homograph noun/adverb (solo, costa, caso) never reaches here — this only fires for
    // genuine conjugated forms not present as their own lemma.
    const addInf = (stem) => { cands.add(stem + 'ar'); cands.add(stem + 'er'); cands.add(stem + 'ir'); };
    if (word.endsWith('ando')) cands.add(word.slice(0, -4) + 'ar');
    if (word.endsWith('iendo') || word.endsWith('yendo')) { cands.add(word.slice(0, -5) + 'er'); cands.add(word.slice(0, -5) + 'ir'); }
    if (/(ado|ada|ados|adas)$/.test(word)) cands.add(word.replace(/(ado|ada|ados|adas)$/, 'ar'));
    if (/(ido|ida|idos|idas)$/.test(word)) { const s = word.replace(/(ido|ida|idos|idas)$/, ''); cands.add(s + 'er'); cands.add(s + 'ir'); }
    // present/preterite/imperfect endings → strip, try infinitives, undoing the
    // stem-change diphthong (ue→o, ie→e) so 'duele'→'doler', 'quiero'→'querer'.
    for (const e of ['o','as','a','amos','an','es','e','emos','en','imos','é','aste','ó','aron','í','iste','ió','ieron','aba','abas','aban','ía','ías','ían']) {
      if (word.endsWith(e) && word.length - e.length >= 2) {
        const st = word.slice(0, -e.length);
        addInf(st);
        const und = st.replace(/ue([^aeiou]*)$/, 'o$1').replace(/ie([^aeiou]*)$/, 'e$1');
        if (und !== st) addInf(und);
      }
    }
  },
  en: (word, cands) => {
    if (word.endsWith('s') && word.length > 3) { cands.add(word.slice(0, -1)); if (word.endsWith('es')) cands.add(word.slice(0, -2)); if (word.endsWith('ies')) cands.add(word.slice(0, -3) + 'y'); }
    if (word.endsWith('ed') && word.length > 4) { cands.add(word.slice(0, -1)); cands.add(word.slice(0, -2)); if (word.endsWith('ied')) cands.add(word.slice(0, -3) + 'y'); }
    if (word.endsWith('ing') && word.length > 5) { cands.add(word.slice(0, -3)); cands.add(word.slice(0, -3) + 'e'); }
    const past = EN_IRREGULAR[word];
    if (past) cands.add(past);
  },
};

// Best (lowest) rank found for a surface word, trying the language's light morphological
// fallbacks. `ranks` is the {word: rank} map.
export function lookupRank(word, lang, ranks) {
  const direct = ranks[word];
  if (direct != null) return direct;
  const cands = new Set();
  (MORPH[lang] || MORPH.en)(word, cands);   // English-style suffix stripping is the safe default
  let best = null;
  for (const c of cands) {
    const r = ranks[c];
    if (r != null && (best == null || r < best)) best = r;
  }
  return best;
}
