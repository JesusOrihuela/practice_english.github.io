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

// Tokenisation/interjection artifacts excluded from the "teachable" figure.
const IGNORE = new Set([
  "'s","'t","'m","'re","'ll","'ve","'d",'s','t','m','re','ll','ve','d','don','doesn','didn','isn','aren','wasn','won','can','couldn','wouldn','shouldn',
  'oh','uh','ah','eh','mmm','hmm','yeah','yep','nope','huh','wow','ok','okay',
]);

const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const PAIR_ARG = argVal('--pair');
const MISSING_N = parseInt(argVal('--missing') || '30', 10);
const TOP_ARG = argVal('--top');
const BANDS = TOP_ARG ? [parseInt(TOP_ARG, 10)] : [500, 1000, 2000];

// Gate mode: enforce the core-vocabulary rule. A pair "passes" when its target
// language covers ≥ MIN% of the pedagogical top-1000 (NGSL for en, ELELex for es).
const GATE = args.includes('--gate');
const MIN  = parseFloat(argVal('--min') || '90');
const gateTop1000 = {};  // targetLang → top-1000 coverage % (from NGSL/ELELex)

function contentWords(pair, lang) {
  const words = new Set();
  for (const t of TOPICS) {
    const path = join(ROOT, `shared/json/pairs/${pair}/${t}.json`);
    if (!fs.existsSync(path)) continue;
    const d = JSON.parse(fs.readFileSync(path, 'utf8'));
    for (const p of (d.phrases || [])) for (const f of p.target) for (const w of tokenize(f.text)) words.add(w);
  }
  // Vocabulary is target-centric: shared/json/vocab/{targetLang}/, term = the word.
  const vdir = join(ROOT, `shared/json/vocab/${lang}`);
  if (fs.existsSync(vdir)) for (const file of fs.readdirSync(vdir)) {
    if (!file.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(join(vdir, file), 'utf8'));
    for (const wobj of (d.words || [])) {
      for (const w of tokenize(wobj.term || '')) words.add(w);
    }
  }
  return words;
}

const PAIRS = [['en-es','es','Espanol (par en-es)'], ['es-en','en','Ingles (par es-en)']]
  .filter(([p]) => !PAIR_ARG || p === PAIR_ARG);

for (const [pair, lang, label] of PAIRS) {
  let FREQ;
  try { FREQ = loadFreq(lang); } catch (e) { console.error('ERROR: ' + e.message); continue; }
  const ranks = FREQ.ranks;
  const byBand = {};
  for (const N of BANDS) byBand[N] = [];
  for (const [w, r] of Object.entries(ranks)) for (const N of BANDS) if (r <= N) byBand[N].push(w);

  const used = contentWords(pair, lang);
  console.log(`\n=== ${label} — indice de frecuencia cap ${FREQ.cap} ===`);
  console.log(`Palabras de contenido distintas: ${used.size}`);
  for (const N of BANDS) {
    const list = byBand[N];
    const teachable = list.filter(w => !IGNORE.has(w));
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
const ngslPath = join(ROOT, 'tools/sources/derived/ngsl-en.json');
if (fs.existsSync(ngslPath) && (!PAIR_ARG || PAIR_ARG === 'es-en')) {
  const ngsl = JSON.parse(fs.readFileSync(ngslPath, 'utf8')).ranks;
  const used = contentWords('es-en', 'en');
  console.log(`\n=== Ingles vs NGSL (lista pedagogica, ${Object.keys(ngsl).length} lemmas) ===`);
  for (const N of [500, 1000, 2000, 2801]) {
    const list = Object.entries(ngsl).filter(([, r]) => r <= N).map(([w]) => w);
    const covered = list.filter(w => used.has(w)).length;
    if (N === 1000) gateTop1000.en = 100 * covered / list.length;
    console.log(`  Top-${N}: ${covered}/${list.length} (${(100 * covered / list.length).toFixed(1)}%)`);
    if (N === 2801) {
      const missing = list.filter(w => !used.has(w));
      console.log(`  NGSL total no cubiertas: ${missing.length}. Muestra: ${missing.slice(0, MISSING_N).join(', ')}`);
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
const elelexPath = join(ROOT, 'tools/sources/derived/elelex-es.json');
if (fs.existsSync(elelexPath) && (!PAIR_ARG || PAIR_ARG === 'en-es')) {
  const elelex = JSON.parse(fs.readFileSync(elelexPath, 'utf8'));
  const ranks = elelex.ranks;
  const used = contentWords('en-es', 'es');
  const coveredRanks = new Set();
  for (const w of used) { const r = lookupRank(w, 'es', ranks); if (r != null) coveredRanks.add(r); }
  const byRank = {};
  for (const [w, r] of Object.entries(ranks)) byRank[r] = w;
  console.log(`\n=== Espanol vs ELELex (lexico pedagogico CEFR, ${elelex.count} lemmas) ===`);
  for (const N of [500, 1000, 2000, 2800]) {
    let covered = 0;
    for (let r = 1; r <= N; r++) if (coveredRanks.has(r)) covered++;
    if (N === 1000) gateTop1000.es = 100 * covered / N;
    console.log(`  Top-${N}: ${covered}/${N} (${(100 * covered / N).toFixed(1)}%)`);
    if (N === 2800) {
      const missing = [];
      for (let r = 1; r <= N; r++) if (!coveredRanks.has(r) && byRank[r]) missing.push(byRank[r]);
      console.log(`  ELELex top-${N} no cubiertas: ${missing.length}. Muestra: ${missing.slice(0, MISSING_N).join(', ')}`);
    }
  }
}

// ── GATE — enforce the core-vocabulary rule (top-1000 ≥ MIN%) ─────────────────
// The premise: knowing the ~1000 most frequent units covers ~88% of everyday
// communication. A pair is only "complete" when its target language teaches that
// core. NGSL (en) is committed so this runs in CI; ELELex (es) is CC BY-NC-SA and
// only present locally, so the es gate is a local-only check.
if (GATE) {
  const scope = PAIR_ARG === 'es-en' ? ['en']
              : PAIR_ARG === 'en-es' ? ['es']
              : ['en', 'es'];
  console.log(`\n=== GATE — cobertura del top-1000 ≥ ${MIN}% ===`);
  let failed = false;
  for (const lang of scope) {
    if (!(lang in gateTop1000)) {
      console.error(`  ✗ ${lang}: lista de frecuencia no disponible (no se pudo medir). ` +
        `${lang === 'es' ? 'Descarga ELELex: tools/sources/fetch-sources.sh + build-elelex.mjs' : ''}`);
      failed = true; continue;
    }
    const pct = gateTop1000[lang];
    const ok = pct >= MIN;
    if (!ok) failed = true;
    console.log(`  ${ok ? '✓' : '✗'} ${lang}: ${pct.toFixed(1)}% ${ok ? '≥' : '<'} ${MIN}%` +
      (ok ? '' : `  → faltan ${(MIN - pct).toFixed(1)} puntos; ver faltantes arriba`));
  }
  console.log(failed ? '\nGATE: FALLA — el par no cumple la premisa del núcleo ~1000.'
                     : '\nGATE: OK — el par cumple la premisa del núcleo ~1000.');
  process.exit(failed ? 1 : 0);
}
