/* ============================================================
   classify.mjs — Author-time category suggester (dev-time, report-only).

   Prevention at the source: before adding a phrase/word, ask where it fits — instead
   of placing by intuition and auditing later. **MANDATORY step** in the content-add
   flow (see docs/CONTENT-QUALITY.md).

   Method: kNN DISTRIBUTION. It finds the k most similar EXISTING items (of the same
   kind, in topical categories) and reports the category distribution among them —
   honestly surfacing AMBIGUITY instead of confidently guessing:

     • VOCAB — one concept, so the neighbors usually agree ⇒ a confident, reliable
       suggestion (a wrong deck stands out).
     • PHRASE — situational, so a generic phrase ("the water is cold") sits between
       kitchen and weather. classify then reports BOTH and says AMBIGUOUS — the
       category is the intended SCENARIO, a human/authoring decision no text-only
       classifier can make. For a domain-specific phrase ("Can we see the menu?") the
       neighbors agree ⇒ confident. This is the honest best a classifier can do for
       phrases; confirm against the scope rubric (category-scopes.json).

   Only TOPICAL categories are ranked (functional/property are placed by act / POS).

   Usage (from repo root; run tools/semantic-audit.mjs once to warm the cache):
     node tools/classify.mjs --kind phrase --text "El cielo está despejado."
     node tools/classify.mjs --kind vocab  --text "banco"  --def "Lugar donde se guarda dinero."
     node tools/classify.mjs --kind phrase --text "…" --json
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEmbedder, cos } from './lib-embed.mjs';
import { discoverPairs, phraseTopicsFor, vocabLangs, vocabDecksFor } from './lib-content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_FILE = path.join(ROOT, 'tools/sources/derived/semantic-embeddings-cache.json');
const K = 15;              // neighbors to inspect
const HOMELESS = 0.35;     // mean similarity of the top neighbors below this ⇒ fits nothing
const CONFIDENT = 0.55;    // top category's share of the neighbors above this ⇒ confident

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const KIND = argVal('--kind', 'phrase');
const TEXT = argVal('--text', '');
const DEF = argVal('--def', '');
const JSON_OUT = args.includes('--json');
if (!TEXT) { console.error('ERROR: --text required'); process.exit(1); }

const scopes = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/json/common/category-scopes.json'), 'utf8'));
const axisOf = {}, scopeText = {};
for (const c of scopes.categories) { axisOf[c.kind + ':' + c.id] = c.axis; scopeText[c.kind + ':' + c.id] = c.scope; }
const tieBreak = scopes.tieBreak || [];

const E = makeEmbedder(CACHE_FILE);

// Gather cached vectors of existing TOPICAL items of this kind, tagged by category.
const items = [];   // { category, vec }
if (KIND === 'vocab') {
  for (const lang of vocabLangs()) for (const deck of vocabDecksFor(lang)) {
    if (axisOf['vocab:' + deck] !== 'topical') continue;
    const f = path.join(ROOT, `shared/json/vocab/${lang}/${deck === 'general' ? 'words.json' : 'words-' + deck + '.json'}`);
    for (const w of JSON.parse(fs.readFileSync(f, 'utf8')).words || []) {
      const v = E.get(`${w.term}. ${w.definition || ''}`.trim());
      if (v) items.push({ category: deck, vec: v });
    }
  }
} else {
  for (const pair of discoverPairs()) for (const t of phraseTopicsFor(pair)) {
    if (axisOf['phrase:' + t] !== 'topical') continue;
    const f = path.join(ROOT, `shared/json/pairs/${pair}/${t}.json`);
    if (!fs.existsSync(f)) continue;
    for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).phrases || []) {
      const v = E.get((p.target && p.target[0] && p.target[0].text) || '');
      if (v) items.push({ category: t, vec: v });
    }
  }
}
if (items.length === 0) { console.error('No hay embeddings cacheados. Corre: node tools/semantic-audit.mjs'); process.exit(1); }

const qv = await E.embed(KIND === 'vocab' ? `${TEXT}. ${DEF}`.trim() : TEXT);
const nn = items.map(it => [it.category, cos(qv, it.vec)]).sort((a, b) => b[1] - a[1]).slice(0, K);
const meanTopSim = nn.reduce((a, [, s]) => a + s, 0) / nn.length;
// Category distribution among the k neighbors, weighted by similarity.
const share = {};
for (const [cat, s] of nn) share[cat] = (share[cat] || 0) + s;
const totalW = Object.values(share).reduce((a, b) => a + b, 0) || 1;
const ranked = Object.entries(share).map(([cat, w]) => [cat, w / totalW]).sort((a, b) => b[1] - a[1]);

const homeless = meanTopSim < HOMELESS;
const top = ranked[0], second = ranked[1] || ['', 0];
const confident = !homeless && top[1] >= CONFIDENT && (top[1] - second[1]) >= 0.20;
const verdict = homeless ? 'homeless' : confident ? 'confident' : 'ambiguous';

if (JSON_OUT) {
  console.log(JSON.stringify({ kind: KIND, text: TEXT, verdict, meanSim: +meanTopSim.toFixed(3),
    distribution: ranked.slice(0, 5).map(([category, s]) => ({ category, share: +s.toFixed(2), scope: scopeText[KIND + ':' + category] || null })),
    tieBreak: verdict === 'ambiguous' ? tieBreak : undefined }, null, 2));
} else {
  console.log(`\nCandidato (${KIND}): "${TEXT}"${DEF ? ` — "${DEF}"` : ''}`);
  console.log(`Veredicto: ${verdict.toUpperCase()}  (afinidad media ${meanTopSim.toFixed(2)} sobre ${K} vecinos)`);
  if (homeless)
    console.log('  ⚠ No se parece a ninguna categoría → considera OMITIR, o proponer categoría nueva. Si es functional/property, ubícalo por acto/POS.');
  else if (confident)
    console.log(`  ✓ Sugerencia clara: ${top[0]}`);
  else
    console.log(`  ? AMBIGUO entre ${ranked.slice(0, 3).map(([c]) => c).join(' / ')} → decide por el ESCENARIO que enseña la frase.`);
  console.log('\nDistribución de las categorías de los vecinos más parecidos:');
  for (const [cat, s] of ranked.slice(0, 5)) console.log(`  ${(s * 100).toFixed(0).padStart(3)}%  ${cat}`);
  // For ambiguous cases, put the rubric inline so the decider (human or agent) has the
  // candidate scopes + tie-break rules right here — no need to open category-scopes.json.
  if (!confident && !homeless) {
    console.log('\nAlcance de las candidatas (para decidir por significado, no por palabras que menciona):');
    for (const [cat] of ranked.slice(0, 3)) console.log(`  • ${cat}: ${scopeText[KIND + ':' + cat] || '(sin scope)'}`);
    if (tieBreak.length) {
      console.log('\nReglas de desempate:');
      for (const r of tieBreak) console.log(`  – ${r}`);
    }
  }
}
