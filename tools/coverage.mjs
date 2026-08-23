/**
 * coverage.mjs — Frequency-coverage metric for the phrase/vocab content
 * ====================================================================
 * Measures how much of the target language's high-frequency core the app's
 * content actually exercises. Complements the situational topics with a
 * frequency compass: "are we teaching the words people actually use most?".
 *
 * For each pair it loads the target-language frequency index
 * (tools/sources/derived/{lang}-freq.json), collects every content word used
 * across all phrase `target[].text` and vocab terms, and reports what fraction
 * of the top-500 / top-1000 / top-2000 most frequent words is covered. It also
 * lists the missing top-N words so the gap is actionable.
 *
 * Premise (Nation / GSL / NGSL): the ~1000-2000 most frequent WORD families
 * cover ~80-90% of everyday running speech. This tool tracks progress toward
 * that lexical core — not a claim about a fixed set of "1000 phrases".
 *
 * Caveat: the frequency list is OpenSubtitles-derived, so it overweights
 * interjections (oh, yeah, uh) and tokenised contractions ('s, 't). A small
 * IGNORE set below excludes those from the "teachable" figure; the raw figure
 * is also shown so the metric is not gamed.
 *
 * USAGE (from repo root):
 *   node tools/coverage.mjs                  # both pairs, top 500/1000/2000
 *   node tools/coverage.mjs --pair en-es     # one pair
 *   node tools/coverage.mjs --missing 60     # show more missing words
 *   node tools/coverage.mjs --top 1000       # focus on one band
 *   node tools/coverage.mjs --pair es-en --gate --min 90   # GATE: exit 1 if < 90%
 *
 * GATE (core-vocabulary rule): with --gate, checks that the target language covers
 *   ≥ --min% (default 90) of the pedagogical top-1000 (NGSL for en, ELELex for es)
 *   and exits 1 if not. es-en → checks English (en); en-es → checks Spanish (es).
 *   English runs in CI (NGSL committed); Spanish is local only (ELELex CC BY-NC-SA).
 *
 * EXIT CODE: without --gate, always 0 (report). With --gate, 1 when below --min.
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadFreq, tokenize, lookupRank } from './lib-freq.mjs';
import AppLangProfiles from '../shared/js/lang-profiles.js';
import { discoverPairs } from './lib-content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Auto-discover phrase topics from the pairs directory so new topics are counted
// automatically. Excludes non-topic files (grammar-rules, placement).
const NON_TOPIC = new Set(['grammar-rules', 'placement']);
function discoverTopics() {
  const dir = join(ROOT, 'shared/json/pairs/en-es');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .filter(t => !NON_TOPIC.has(t));
}
const TOPICS = discoverTopics();

// Per-language lexical sets (artifacts to ignore + closed-class FUNCTION words)
// come from the shared language-profile registry — the SAME data the browser reads
// (shared/js/lang-profiles.js). No word list is hardcoded here.
//
//  • ignoreFor(lang)   — tokenisation/interjection artifacts and non-teachable
//    tokens, excluded from BOTH channels so the metric is not unfairly penalised
//    (English contraction fragments; ELELex list markers/proper nouns). The raw
//    figure is still shown so it can't be gamed.
//  • functionFor(lang) — closed-class function words (articles, pronouns,
//    prepositions, conjunctions, determiners, auxiliaries, grammatical adverbs).
//    They belong to the top-1000 but can't be isolated-vocab flashcards, so they
//    are dropped from the VOCAB channel denominator only; the PHRASE channel still
//    counts them. Each list is a superset; only members in the top-1000 matter.
const ignoreFor = (lang) => AppLangProfiles.ignoreTokens(lang);
const functionFor = (lang) => AppLangProfiles.functionWords(lang);
const unionSet = (a, b) => { const s = new Set(a); for (const x of b) s.add(x); return s; };

const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const PAIR_ARG = argVal('--pair');
const MISSING_N = parseInt(argVal('--missing') || '30', 10);
const TOP_ARG = argVal('--top');
const BANDS = TOP_ARG ? [parseInt(TOP_ARG, 10)] : [500, 1000, 2000];

// Gate mode: enforce the core-vocabulary rule. A pair "passes" when its target
// language covers ≥ MIN% of the pedagogical top-1000 (NGSL for en, ELELex for es).
const GATE = args.includes('--gate');
const MIN  = parseFloat(argVal('--min') || '80');
// Two-channel gate: each targetLang must cover ≥ MIN% of the pedagogical top-1000
// with phrases alone AND with vocab alone.
const gatePhrases = {};  // targetLang → top-1000 phrase-only coverage % (teachable)
const gateVocab   = {};  // targetLang → top-1000 vocab-only  coverage % (teachable)
const gateMissing = {};  // targetLang → { phrases: [lemma…], vocab: [lemma…] } (rank-ordered)

// Collect the distinct content words used by a pair, restricted to a channel:
//   'phrases' — only phrase target[].text
//   'vocab'   — only vocab terms (target-centric)
//   'all'     — both (combined figure)
// The core-vocabulary rule is now a two-channel gate: the top-1000 must be covered
// ≥ MIN% by phrases alone AND by vocab alone, so the core is taught both in context
// (phrases) and in isolation (vocab).
function contentWords(pair, lang, scope = 'all') {
  const words = new Set();
  if (scope === 'phrases' || scope === 'all') {
    for (const t of TOPICS) {
      const path = join(ROOT, `shared/json/pairs/${pair}/${t}.json`);
      if (!fs.existsSync(path)) continue;
      const d = JSON.parse(fs.readFileSync(path, 'utf8'));
      for (const p of (d.phrases || [])) for (const f of p.target) for (const w of tokenize(f.text)) words.add(w);
    }
  }
  if (scope === 'vocab' || scope === 'all') {
    // Vocabulary is target-centric: shared/json/vocab/{targetLang}/, term = the word.
    const vdir = join(ROOT, `shared/json/vocab/${lang}`);
    if (fs.existsSync(vdir)) for (const file of fs.readdirSync(vdir)) {
      if (!file.endsWith('.json')) continue;
      const d = JSON.parse(fs.readFileSync(join(vdir, file), 'utf8'));
      for (const wobj of (d.words || [])) {
        // term = the displayed headword (the primary form for a lexical-variant word); the
        // structured variants[] carry the other forms (patata, móvil…) — count them too, so moving
        // a lexical variant out of the slash term into variants[] never drops it from coverage.
        for (const w of tokenize(wobj.term || '')) words.add(w);
        for (const v of (wobj.variants || [])) for (const w of tokenize(v.text || '')) words.add(w);
      }
    }
  }
  return words;
}

// Coverage of a flat lemma list (NGSL) over the lemmas that remain after removing
// `exclude`. A lemma counts as covered when any surface form in the content maps to
// its rank via lookupRank (so 'parents'→parent, 'became'→become are credited), i.e.
// its rank is in `coveredRanks`.
function channelCov(list, ranks, coveredRanks, exclude) {
  const teachable = list.filter(w => !exclude.has(w));
  const missing = teachable.filter(w => !coveredRanks.has(ranks[w]));
  return { covered: teachable.length - missing.length, total: teachable.length,
           pct: 100 * (teachable.length - missing.length) / teachable.length, missing };
}
// Ranks reachable from a used-set through light morphology — language-parameterized
// (lookupRank handles per-language forms). coveredRanksEn kept as the English alias.
function coveredRanks(used, lang, ranks) {
  const s = new Set();
  for (const w of used) { const r = lookupRank(w, lang, ranks); if (r != null) s.add(r); }
  return s;
}
function coveredRanksEn(used, ranks) { return coveredRanks(used, 'en', ranks); }

// Derived: [pairId, targetLang, label] per pair — no hardcoded pair list.
const PAIRS = discoverPairs().map(p => [p, p.split('-')[1], `par ${p} (objetivo ${p.split('-')[1]})`])
  .filter(([p]) => !PAIR_ARG || p === PAIR_ARG);

for (const [pair, lang, label] of PAIRS) {
  let FREQ;
  // The raw {lang}-freq.json bands display is a local dev nicety (those lists are
  // gitignored); the GATE uses the committed index instead, so just skip if absent.
  try { FREQ = loadFreq(lang); } catch { continue; }
  const ranks = FREQ.ranks;
  const byBand = {};
  for (const N of BANDS) byBand[N] = [];
  for (const [w, r] of Object.entries(ranks)) for (const N of BANDS) if (r <= N) byBand[N].push(w);

  const used = contentWords(pair, lang);
  console.log(`\n=== ${label} — indice de frecuencia cap ${FREQ.cap} ===`);
  console.log(`Palabras de contenido distintas: ${used.size}`);
  for (const N of BANDS) {
    const list = byBand[N];
    const _igEn = ignoreFor('en');
    const teachable = list.filter(w => !_igEn.has(w));
    const covered = list.filter(w => used.has(w)).length;
    const coveredT = teachable.filter(w => used.has(w)).length;
    const pct = (100 * covered / list.length).toFixed(1);
    const pctT = (100 * coveredT / teachable.length).toFixed(1);
    console.log(`  Top-${N}: ${covered}/${list.length} (${pct}%)  ·  ensenable (sin interjecciones): ${coveredT}/${teachable.length} (${pctT}%)`);
    if (N === 1000 || BANDS.length === 1) {
      const missing = teachable.filter(w => !used.has(w)).slice(0, MISSING_N);
      console.log(`    Faltan del top-${N} (muestra): ${missing.join(', ')}`);
    }
  }
}

// ── NGSL — clean pedagogical target for the English side (es-en, target English) ──
// The NGSL (2801 curated learner lemmas) excludes the profanity/fillers/proper
// nouns that pollute the OpenSubtitles list, so it is the meaningful target for
// "% of everyday communication covered".
// The NGSL is the English list, so this block runs for the pair whose TARGET is
// English — derived (no hardcoded pair), so any X→en pair works.
const enPair = PAIR_ARG || discoverPairs().find(p => p.split('-')[1] === 'en');
const ngslPath = join(ROOT, 'tools/sources/derived/ngsl-en.json');
if (fs.existsSync(ngslPath) && enPair && enPair.split('-')[1] === 'en' && (!PAIR_ARG || PAIR_ARG === enPair)) {
  const ngsl = JSON.parse(fs.readFileSync(ngslPath, 'utf8')).ranks;
  const crAll     = coveredRanksEn(contentWords(enPair, 'en', 'all'), ngsl);
  const crPhrases = coveredRanksEn(contentWords(enPair, 'en', 'phrases'), ngsl);
  const crVocab   = coveredRanksEn(contentWords(enPair, 'en', 'vocab'), ngsl);
  const igEn = ignoreFor('en');
  const igFnEn = unionSet(igEn, functionFor('en'));  // vocab channel: also drop function words
  console.log(`\n=== Ingles vs NGSL (lista pedagogica, ${Object.keys(ngsl).length} lemmas) ===`);
  for (const N of [500, 1000, 2000, 2801]) {
    const list = Object.entries(ngsl).filter(([, r]) => r <= N).map(([w]) => w);
    const all = channelCov(list, ngsl, crAll, igEn);
    console.log(`  Top-${N}: ${all.covered}/${all.total} (${all.pct.toFixed(1)}%)`);
    if (N === 1000) {
      const ph = channelCov(list, ngsl, crPhrases, igEn);       // phrases: full teachable top-1000
      const vo = channelCov(list, ngsl, crVocab, igFnEn);        // vocab: content words only
      gatePhrases.en = ph.pct;
      gateVocab.en   = vo.pct;
      console.log(`    · frases-solo (todo el top-1000): ${ph.covered}/${ph.total} (${ph.pct.toFixed(1)}%)`);
      console.log(`    · vocab-solo (solo contenido):    ${vo.covered}/${vo.total} (${vo.pct.toFixed(1)}%)`);
      console.log(`    Faltan en frases (${ph.missing.length}, muestra): ${ph.missing.slice(0, MISSING_N).join(', ')}`);
      console.log(`    Faltan en vocab-contenido (${vo.missing.length}, muestra): ${vo.missing.slice(0, MISSING_N).join(', ')}`);
    }
    if (N === 2801) {
      console.log(`  NGSL total no cubiertas: ${all.missing.length}. Muestra: ${all.missing.slice(0, MISSING_N).join(', ')}`);
    }
  }
}

// ── ELELex — clean pedagogical target for the Spanish side (en-es, target Spanish) ──
// ELELex (CEFRLex, CC BY-NC-SA) is a CEFR-graded lemma list built from SFL
// pedagogical materials, so it is the clean Spanish analog of NGSL — a real
// learning target, unlike the noisy OpenSubtitles es-freq list. The derived
// index is NOT committed (see build-elelex.mjs / .gitignore); build it locally.
// Since ELELex is lemmatised and content has inflected forms, lookupRank maps
// each content surface word back toward its lemma (plural/gender/enclitic).
// ELELex is the Spanish list → runs for the pair whose TARGET is Spanish (derived).
const esPair = PAIR_ARG || discoverPairs().find(p => p.split('-')[1] === 'es');
const elelexPath = join(ROOT, 'tools/sources/derived/elelex-es.json');
if (fs.existsSync(elelexPath) && esPair && esPair.split('-')[1] === 'es' && (!PAIR_ARG || PAIR_ARG === esPair)) {
  const elelex = JSON.parse(fs.readFileSync(elelexPath, 'utf8'));
  const ranks = elelex.ranks;
  const byRank = {};
  for (const [w, r] of Object.entries(ranks)) byRank[r] = w;
  // Rank-based coverage over teachable ranks; `exclude` lemmas are skipped from the
  // denominator (IGNORE_ES for both channels; plus function words for vocab).
  // Content surface forms are mapped toward their lemma by lookupRank.
  function elelexCov(N, used, exclude) {
    const coveredRanks = new Set();
    for (const w of used) { const r = lookupRank(w, 'es', ranks); if (r != null) coveredRanks.add(r); }
    let covered = 0, total = 0; const missing = [];
    for (let r = 1; r <= N; r++) {
      const lemma = byRank[r];
      if (!lemma || exclude.has(lemma)) continue;
      total++;
      if (coveredRanks.has(r)) covered++; else missing.push(lemma);
    }
    return { covered, total, pct: 100 * covered / total, missing };
  }
  const usedAll     = contentWords(esPair, 'es', 'all');
  const usedPhrases = contentWords(esPair, 'es', 'phrases');
  const usedVocab   = contentWords(esPair, 'es', 'vocab');
  const igEs = ignoreFor('es');
  const igFnEs = unionSet(igEs, functionFor('es'));  // vocab channel: also drop function words
  console.log(`\n=== Espanol vs ELELex (lexico pedagogico CEFR, ${elelex.count} lemmas) ===`);
  for (const N of [500, 1000, 2000, 2800]) {
    const all = elelexCov(N, usedAll, igEs);
    console.log(`  Top-${N}: ${all.covered}/${all.total} (${all.pct.toFixed(1)}%)`);
    if (N === 1000) {
      const ph = elelexCov(N, usedPhrases, igEs);      // phrases: full teachable top-1000
      const vo = elelexCov(N, usedVocab, igFnEs);       // vocab: content words only
      gatePhrases.es = ph.pct;
      gateVocab.es   = vo.pct;
      console.log(`    · frases-solo (todo el top-1000): ${ph.covered}/${ph.total} (${ph.pct.toFixed(1)}%)`);
      console.log(`    · vocab-solo (solo contenido):    ${vo.covered}/${vo.total} (${vo.pct.toFixed(1)}%)`);
      console.log(`    Faltan en frases (${ph.missing.length}, muestra): ${ph.missing.slice(0, MISSING_N).join(', ')}`);
      console.log(`    Faltan en vocab-contenido (${vo.missing.length}, muestra): ${vo.missing.slice(0, MISSING_N).join(', ')}`);
    }
    if (N === 2800) {
      console.log(`  ELELex top-${N} no cubiertas: ${all.missing.length}. Muestra: ${all.missing.slice(0, MISSING_N).join(', ')}`);
    }
  }
}

// ── Unified GATE computation for EVERY target language ────────────────────────
// Each language's gate reads the COMMITTEABLE index its profile declares
// (frequency.gateIndex) — NGSL for en, PCIC (es-core.json) for es, {lang}-freq for future
// langs — so coverage gates every language in CI (no "local only" per language). Runs
// after the detailed display blocks and is the single source of the gate values (for
// en it recomputes the same number; for es it uses the committed PCIC-curated CEFR index
// instead of the non-committeable ELELex). Nothing hardcoded: langs from discoverPairs,
// index + floor from lang-profiles.
for (const pair of (PAIR_ARG ? [PAIR_ARG] : discoverPairs())) {
  const lang = pair.split('-')[1];
  const gi = AppLangProfiles.get(lang)?.frequency?.gateIndex;
  if (!gi) continue;                                   // enforcement: handled in the GATE block
  const giPath = join(ROOT, 'tools/sources/derived', gi);
  if (!fs.existsSync(giPath)) continue;
  const ranks = JSON.parse(fs.readFileSync(giPath, 'utf8')).ranks;
  const ig = ignoreFor(lang), igFn = unionSet(ig, functionFor(lang));
  const list = Object.entries(ranks).filter(([, r]) => r <= 1000).map(([w]) => w);
  const ph = channelCov(list, ranks, coveredRanks(contentWords(pair, lang, 'phrases'), lang, ranks), ig);
  const vo = channelCov(list, ranks, coveredRanks(contentWords(pair, lang, 'vocab'), lang, ranks), igFn);
  gatePhrases[lang] = ph.pct;
  gateVocab[lang]   = vo.pct;
  const byRank = (a, b) => (ranks[a] ?? 1e9) - (ranks[b] ?? 1e9);
  gateMissing[lang] = { phrases: [...ph.missing].sort(byRank), vocab: [...vo.missing].sort(byRank) };
}

// ── --gate-missing: dump the actionable, rank-ordered gap list per channel ────
// The exact words the committed-index gate counts as missing (phrase channel = full
// teachable top-1000; vocab channel = content words only), most-frequent first. Feeds
// build-candidates-cover.mjs / vocab authoring when raising a language toward 88%.
if (args.includes('--gate-missing')) {
  const langs = PAIR_ARG ? [PAIR_ARG.split('-')[1]] : Object.keys(gateMissing);
  for (const lang of langs) {
    const m = gateMissing[lang] || { phrases: [], vocab: [] };
    console.log(`\n=== ${lang}: faltantes del top-1000 (orden por rango = prioridad) ===`);
    console.log(`  PHRASES (${m.phrases.length}):\n  ${m.phrases.join(' ')}`);
    console.log(`  VOCAB-content (${m.vocab.length}):\n  ${m.vocab.join(' ')}`);
  }
  process.exit(0);
}

// ── GATE — enforce the core-vocabulary rule (top-1000 ≥ floor%) ───────────────
// The premise: knowing the ~1000 most frequent units covers ~88% of everyday
// communication. A pair is only "complete" when its target language teaches that
// core. Every language gates in CI against its committed index; the floor is per
// language (frequency.gateFloor), overridable with --min.
if (GATE) {
  // Target languages to gate: the pair's target (if --pair), else all present — derived.
  const scope = PAIR_ARG ? [PAIR_ARG.split('-')[1]]
              : [...new Set(discoverPairs().map(p => p.split('-')[1]))];
  const minOverride = argVal('--min') != null;
  console.log(`\n=== GATE — cobertura del top-1000 en AMBOS canales (frases y vocab), piso por idioma ===`);
  let failed = false;
  for (const lang of scope) {
    // Enforcement: every gated language MUST declare a committed index. Missing tables
    // ⇒ no committeable index (frequency.gateIndex) ⇒ the language can't gate in CI → fail.
    if (!(lang in gatePhrases) || !(lang in gateVocab)) {
      console.error(`  ✗ ${lang}: sin índice de frecuencia committeado (lang-profiles frequency.gateIndex + ` +
        `tools/sources/derived/*) — el idioma no puede gatearse en CI.`);
      failed = true; continue;
    }
    const floor = minOverride ? MIN : (AppLangProfiles.get(lang)?.frequency?.gateFloor ?? MIN);
    for (const [channel, table] of [['frases', gatePhrases], ['vocab', gateVocab]]) {
      const pct = table[lang];
      const ok = pct >= floor;
      if (!ok) failed = true;
      console.log(`  ${ok ? '✓' : '✗'} ${lang} · ${channel}: ${pct.toFixed(1)}% ${ok ? '≥' : '<'} ${floor}%` +
        (ok ? '' : `  → faltan ${(floor - pct).toFixed(1)} puntos; ver faltantes arriba`));
    }
  }
  console.log(failed ? '\nGATE: FALLA — el par no cumple la premisa del núcleo ~1000 en ambos canales.'
                     : '\nGATE: OK — el par cumple la premisa del núcleo ~1000 en frases y en vocab.');
  process.exit(failed ? 1 : 0);
}
