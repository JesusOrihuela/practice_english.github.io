/**
 * reconcile.mjs — Verify existing content against the frequency inventory
 * =======================================================================
 * For every phrase in a pair (or a single topic), this tool cross-checks the
 * vocabulary of target[0].text against the CEFR-banded frequency index
 * (tools/sources/derived/{targetLang}-freq.json) and emits a per-entry verdict:
 *
 *   keep     — the declared level is >= the vocabulary-implied band, no unknowns.
 *              Grammar may legitimately raise the level above the vocab band
 *              (CLAUDE.md Rule 12), so a declared level HIGHER than the vocab band
 *              is fine; only a declared level LOWER than the vocab band is a bug.
 *   relevel  — the vocabulary is harder than the declared level → suggests raising
 *              the level to the vocabulary-implied band. (Never suggests lowering:
 *              grammar complexity can justify a higher level than the vocab alone.)
 *   review   — contains words outside the top-N frequency cap (rare word, proper
 *              noun, or loanword) → a human must judge whether to keep, reword, or
 *              retire the entry.
 *
 * A "retire" verdict is intentionally NOT emitted automatically — retiring/replacing
 * an entry is a human decision, guided by the `review` flag plus the coverage stats
 * this tool reports (fraction of content words within the A1/A2/B1 core).
 *
 * This tool NEVER modifies content. It writes a machine-readable report to
 * tools/sources/derived/{pairId}-reconcile.json and prints a human summary.
 *
 * USAGE (from tools/):
 *   node reconcile.mjs --pair en-es                 # whole pair
 *   node reconcile.mjs --pair en-es --topic greetings
 *   node reconcile.mjs --pair es-en --topic greetings --verbose
 *
 * EXIT CODE: 0 always (this is a report, not a gate).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadFreq, tokenize, lookupRank, rankToBand, CEFR_ORDER, BAND_ORDER, BAND_AS_CEFR } from './lib-freq.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, '..');
const PAIRS_DIR = join(ROOT, 'shared', 'json', 'pairs');
const DERIVED  = join(__dirname, 'sources', 'derived');

const PHRASE_TOPICS = [
  'emociones', 'greetings', 'restaurant', 'supermarket', 'kitchen',
  'transportation', 'airport', 'accommodation',
  'movies', 'music', 'theater', 'museums', 'gym', 'technology', 'accountability', 'personal_info', 'family', 'daily_routine',
];

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argVal(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
const PAIR    = argVal('--pair');
const TOPIC   = argVal('--topic');
const VERBOSE = args.includes('--verbose');

if (!PAIR) { console.error('ERROR: --pair <id> required (e.g. --pair en-es)'); process.exit(1); }
const targetLang = PAIR.split('-')[1];

// ── load frequency index ────────────────────────────────────────────────────
let FREQ;
try { FREQ = loadFreq(targetLang); }
catch (e) { console.error('ERROR: ' + e.message); process.exit(1); }
const RANKS = FREQ.ranks;
const CAP = FREQ.cap;

// ── reconcile one phrase ────────────────────────────────────────────────────
function reconcilePhrase(phrase) {
  const text = phrase.target?.[0]?.text || '';
  const words = tokenize(text);
  const known = [];
  const unknown = [];
  let hardestBand = 'A1';

  for (const w of words) {
    const rank = lookupRank(w, targetLang, RANKS);
    if (rank == null) { unknown.push(w); continue; }
    const band = rankToBand(rank);
    known.push({ w, rank, band });
    if (BAND_ORDER[band] > BAND_ORDER[hardestBand]) hardestBand = band;
  }

  const total = words.length || 1;
  const coverage = {
    inTop1000: known.filter(k => k.rank <= 1000).length / total,
    inTop3000: known.filter(k => k.rank <= 3000).length / total,
    inTop5000: known.filter(k => k.rank <= 5000).length / total,
    unknown: unknown.length / total,
  };

  const declared = phrase.level;
  const vocabBandCefr = unknown.length ? 'B2' : BAND_AS_CEFR[hardestBand];
  // Rare vocabulary is EXPECTED at B2+ (difficulty comes from vocab+grammar,
  // Rule 12). Unknown words only signal a real mismatch when the phrase claims
  // to be A1/A2/B1. At B2+ they are noted, not flagged for review.
  const declaredOrder = CEFR_ORDER[declared] ?? 99;
  const unknownIsProblem = unknown.length && declaredOrder <= CEFR_ORDER.B1;

  let verdict, suggestion = null, reason;
  if (unknownIsProblem) {
    verdict = 'review';
    reason = `${unknown.length} palabra(s) rara(s) para nivel ${declared || '—'}: ${unknown.join(', ')}`;
  } else if (declared == null) {
    verdict = 'relevel';
    suggestion = vocabBandCefr;
    reason = `sin nivel declarado; vocabulario sugiere ${vocabBandCefr}`;
  } else if ((CEFR_ORDER[declared] ?? 99) < (CEFR_ORDER[vocabBandCefr] ?? 0)) {
    verdict = 'relevel';
    suggestion = vocabBandCefr;
    reason = `nivel ${declared} pero el vocabulario alcanza ${vocabBandCefr}`;
  } else {
    verdict = 'keep';
    reason = `vocabulario ${vocabBandCefr} ⊆ nivel ${declared}`
      + (unknown.length ? ` (raras esperadas en ${declared}: ${unknown.join(', ')})` : '');
  }

  return { id: phrase.id, text, declared, vocabBandCefr, verdict, suggestion, reason, coverage, unknown };
}

// ── run ─────────────────────────────────────────────────────────────────────
const topics = TOPIC ? [TOPIC] : PHRASE_TOPICS;
const report = { pair: PAIR, targetLang, generatedAt: new Date().toISOString(), topics: {} };
const totals = { keep: 0, relevel: 0, review: 0 };

for (const topic of topics) {
  const file = join(PAIRS_DIR, PAIR, `${topic}.json`);
  if (!existsSync(file)) { if (TOPIC) console.log(`(no existe ${file})`); continue; }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const results = (data.phrases || []).map(reconcilePhrase);
  report.topics[topic] = results;

  const counts = { keep: 0, relevel: 0, review: 0 };
  for (const r of results) { counts[r.verdict]++; totals[r.verdict]++; }

  console.log(`\n■ ${topic} (${results.length} frases) — keep ${counts.keep} · relevel ${counts.relevel} · review ${counts.review}`);
  if (VERBOSE || TOPIC) {
    for (const r of results) {
      if (r.verdict === 'keep' && !VERBOSE) continue;
      const tag = r.verdict === 'keep' ? '  keep ' : r.verdict === 'relevel' ? '↑ RELV ' : '? REVW ';
      console.log(`  ${tag} [${r.declared || '—'}${r.suggestion ? '→' + r.suggestion : ''}] ${r.text}`);
      console.log(`          ${r.reason}`);
    }
  }
}

writeFileSync(join(DERIVED, `${PAIR}-reconcile.json`), JSON.stringify(report, null, 2));
console.log(`\n═══ TOTAL ${PAIR}: keep ${totals.keep} · relevel ${totals.relevel} · review ${totals.review}`);
console.log(`Reporte: tools/sources/derived/${PAIR}-reconcile.json`);
