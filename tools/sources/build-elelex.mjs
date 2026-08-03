/**
 * build-elelex.mjs — Derive a clean Spanish pedagogical frequency target
 * =====================================================================
 * Reads the ELELex CEFR-graded lexicon (CEFRLex project, UCLouvain CENTAL)
 * from tools/sources/raw/ELELex.tsv and produces a compact ranked index used
 * as the *pedagogical target* for measuring Spanish lexical coverage — the
 * clean analog of NGSL for English (coverage.mjs).
 *
 * ELELex is CC BY-NC-SA 4.0. The raw lexicon and this derived index are NOT
 * committed (see .gitignore: tools/sources/derived/* is ignored and elelex-es
 * is not whitelisted). Download on demand:
 *   curl -sL https://cental.uclouvain.be/cefrlex/static/resources/es/ELELex.tsv \
 *     -o tools/sources/raw/ELELex.tsv
 *   node tools/sources/build-elelex.mjs
 * Attribution: see CREDITS.md.
 *
 * Output: tools/sources/derived/elelex-es.json
 *   { _source, _url, _license, lang:'es', count, ranks:{word:rank}, cefr:{word:'A1'} }
 * Single-word lemmas only (multi-word expressions with "_" excluded); POS rows
 * aggregated per word by summed total frequency. CEFR = the level with the
 * highest normalized per-level frequency (its first substantial appearance).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = join(__dirname, 'raw', 'ELELex.tsv');
const OUT = join(__dirname, 'derived', 'elelex-es.json');

if (!existsSync(RAW)) {
  console.error(`ERROR: ${RAW} not found. Download it first (see header).`);
  process.exit(1);
}

const unquote = (s) => s.replace(/^"|"$/g, '');
const LETTERS = /^[a-záéíóúüñ]+$/; // single Spanish word, no digits/punctuation/MWE
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const lines = readFileSync(RAW, 'utf8').split(/\r?\n/);
lines.shift(); // header

const total = new Map();          // word -> summed total_freq
const levelFreq = new Map();      // word -> [a1,a2,b1,b2,c1] summed

for (const line of lines) {
  if (!line.trim()) continue;
  const c = line.split('\t').map(unquote);
  const word = c[0];
  if (!LETTERS.test(word)) continue;
  const lf = [2, 3, 4, 5, 6].map(i => parseFloat(c[i]) || 0);
  const tot = parseFloat(c[7]) || 0;
  total.set(word, (total.get(word) || 0) + tot);
  const acc = levelFreq.get(word) || [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) acc[i] += lf[i];
  levelFreq.set(word, acc);
}

const ordered = [...total.entries()].sort((a, b) => b[1] - a[1]);
const ranks = {};
const cefr = {};
let r = 0;
for (const [word] of ordered) {
  ranks[word] = ++r;
  const lf = levelFreq.get(word);
  let bi = 0, bv = -1;
  for (let i = 0; i < 5; i++) if (lf[i] > bv) { bv = lf[i]; bi = i; }
  cefr[word] = LEVELS[bi];
}

const out = {
  _source: 'ELELex — CEFR-graded lexical resource for Spanish as a foreign language (CEFRLex, UCLouvain CENTAL)',
  _url: 'https://cental.uclouvain.be/cefrlex/elelex/',
  _license: 'CC BY-NC-SA 4.0 — used as a measurement target, not redistributed (see CREDITS.md)',
  lang: 'es',
  count: r,
  ranks,
  cefr,
};
writeFileSync(OUT, JSON.stringify(out) + '\n');
console.log(`ELELex derived: ${r} single-word lemmas -> ${OUT}`);
console.log('Top 20:', ordered.slice(0, 20).map(([w]) => w).join(', '));
