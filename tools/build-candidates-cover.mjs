/**
 * build-candidates-cover.mjs — Surface attested candidate phrases that COVER
 * specific missing top-1000 lemmas (frequency-core gap), not a topic.
 * ======================================================================
 * Companion to build-candidates.mjs. Where that tool mines a TOPIC's keyword set,
 * this one mines the Tatoeba parallel corpus for natural, native-written sentences
 * that CONTAIN a given target-language lemma (one of the top-1000 words still not
 * covered by the phrase channel — see coverage.mjs --gate). For each lemma it
 * surfaces SEVERAL short candidates so the human curator can pick the one whose
 * MEANING fits a genuine category (situational or functional) — no misc bucket.
 *
 * Matching a surface form to a lemma reuses lookupRank (the same light morphology
 * coverage.mjs uses): a token belongs to lemma L when lookupRank(token) === rank(L).
 *
 * It NEVER writes into shared/json. It writes a candidate pool to
 * tools/sources/derived/{pair}-cover-candidates.json and prints a preview.
 * Curation (naturalness, neutro, gender/register variants, grammar tips, slugs,
 * audio, category placement) is applied by hand on the accepted subset, then the
 * mandatory pipeline runs.
 *
 * Corpus expected at tools/sources/raw/Tatoeba.en-es.en / .es (OPUS moses format).
 *
 * USAGE (from tools/):
 *   node build-candidates-cover.mjs --pair en-es --lemmas "querer,saber,pensar" --per 4
 *   node build-candidates-cover.mjs --pair es-en --lemmas-file missing-en.txt --level B1
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

// Same level knobs as build-candidates.mjs so exemplars stay level-plausible.
const LEVEL_MAX_WORDS = { A1: 8, A2: 10, B1: 12, B2: 14 };

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const PAIR  = argVal('--pair');
const LEVEL = argVal('--level') || 'B1';
const PER   = parseInt(argVal('--per') || '4', 10);
// maxRank bounds the OTHER words in an exemplar (keep the sentence within a clean
// core). The covered lemma itself is top-1000 so it always qualifies. Default 2500
// (≈ B1 core) yields natural but not obscure sentences.
const MAXRANK = parseInt(argVal('--maxrank') || '2500', 10);

if (!PAIR) { console.error('ERROR: --pair <id> required'); process.exit(1); }
const [srcLang, tgtLang] = PAIR.split('-');
const maxWords = LEVEL_MAX_WORDS[LEVEL] ?? 12;

// Lemmas to cover: inline --lemmas or --lemmas-file (comma/space/newline separated).
let lemmaText = argVal('--lemmas') || '';
const lemmaFile = argVal('--lemmas-file');
if (lemmaFile) {
  if (!existsSync(lemmaFile)) { console.error(`ERROR: --lemmas-file not found: ${lemmaFile}`); process.exit(1); }
  lemmaText += ' ' + readFileSync(lemmaFile, 'utf8');
}
const LEMMAS = [...new Set(lemmaText.toLowerCase().split(/[\s,]+/).map(s => s.trim()).filter(Boolean))];
if (!LEMMAS.length) { console.error('ERROR: provide lemmas via --lemmas or --lemmas-file'); process.exit(1); }

// ── load resources ──────────────────────────────────────────────────────────
const FREQ = loadFreq(tgtLang);
const RANKS = FREQ.ranks;

const corpusBase = join(RAW, `Tatoeba.en-es`);
const enFile = `${corpusBase}.en`, esFile = `${corpusBase}.es`;
if (!existsSync(enFile) || !existsSync(esFile)) {
  console.error(`ERROR: Tatoeba corpus not found at ${enFile} / ${esFile}`); process.exit(1);
}
const enLines = readFileSync(enFile, 'utf8').split(/\r?\n/);
const esLines = readFileSync(esFile, 'utf8').split(/\r?\n/);
const tgtLines = tgtLang === 'es' ? esLines : enLines;
const srcLines = srcLang === 'es' ? esLines : enLines;

// ── filters (mirror build-candidates.mjs) ────────────────────────────────────
function passesProjectBasics(text) {
  if (/[—;:]/.test(text)) return false;                   // Rule 6
  if (!/[.?!]$/.test(text.trim())) return false;           // Rule 17 terminal punct
  if (text.split(/\s+/).length > maxWords) return false;   // level word cap
  if (/["“”()\[\]*_/\\]/.test(text)) return false;         // stray markup/quotes
  return true;
}

// ── index: rank → qualifying candidate lines ──────────────────────────────────
// A line qualifies if it passes project basics and every word is within maxRank
// (a clean core). We index it under the rank of each distinct word it contains, so
// a lemma lookup is O(1). Shorter sentences are preferred later.
const byRank = new Map();       // rank → [{ tgt, src, len }]
const seen = new Set();
for (let i = 0; i < tgtLines.length; i++) {
  const tgt = (tgtLines[i] || '').trim();
  const src = (srcLines[i] || '').trim();
  if (!tgt || !src) continue;
  if (!passesProjectBasics(tgt)) continue;
  const words = tokenize(tgt);
  if (!words.length) continue;
  const ranksInLine = [];
  let ok = true;
  for (const w of words) {
    const r = lookupRank(w, tgtLang, RANKS);
    if (r == null || r > MAXRANK) { ok = false; break; }
    ranksInLine.push(r);
  }
  if (!ok) continue;
  const key = tgt.toLowerCase().replace(/[¿?¡!.,]/g, '');
  if (seen.has(key)) continue;
  seen.add(key);
  const entry = { tgt, src, len: tgt.length };
  for (const r of new Set(ranksInLine)) {
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(entry);
  }
}

// ── collect candidates per lemma ──────────────────────────────────────────────
const out = { _source: 'Tatoeba via OPUS (CC BY 2.0 FR) + frequency-core filter',
  _note: 'Candidatos crudos por lemma. Curar a mano: naturalidad, neutro, variantes, tips, categoria (sin misc), slugs, audio.',
  pair: PAIR, level: LEVEL, maxRank: MAXRANK, maxWords, per: PER,
  requested: LEMMAS.length, covered: 0, uncovered: [], lemmas: [] };

for (const lemma of LEMMAS) {
  const rank = RANKS[lemma] ?? lookupRank(lemma, tgtLang, RANKS);
  let pool = (rank != null && byRank.has(rank)) ? byRank.get(rank).slice() : [];
  pool.sort((a, b) => a.len - b.len);
  const picks = pool.slice(0, PER);
  if (!picks.length) { out.uncovered.push(lemma); continue; }
  out.covered++;
  out.lemmas.push({
    lemma, rank: rank ?? null,
    candidates: picks.map((c, k) => ({
      id: `cover_${lemma}_${String(k + 1).padStart(2, '0')}`,
      source: c.src,
      level: LEVEL,
      grammar: null,
      target: [{ text: c.tgt }],
    })),
  });
}

const outPath = join(DERIVED, `${PAIR}-cover-candidates.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));

// ── preview ───────────────────────────────────────────────────────────────────
console.log(`\n${PAIR} · cubrir ${LEMMAS.length} lemmas · nivel ${LEVEL} (maxRank ${MAXRANK}, ≤${maxWords} palabras, ${PER}/lemma)\n`);
for (const L of out.lemmas) {
  console.log(`  [${L.lemma}]`);
  for (const c of L.candidates) console.log(`    ${c.target[0].text}   ⟵  ${c.source}`);
}
if (out.uncovered.length) console.log(`\nSin candidato (${out.uncovered.length}): ${out.uncovered.join(', ')}`);
console.log(`\nCubiertos ${out.covered}/${LEMMAS.length}. Pool: tools/sources/derived/${PAIR}-cover-candidates.json`);
