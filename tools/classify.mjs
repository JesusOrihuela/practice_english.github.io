/* ============================================================
   classify.mjs — Author-time category suggester (dev-time, report-only).

   Prevention at the source: before adding a phrase/word, ask which category fits
   best, instead of placing by intuition and auditing later. Reuses the shared
   embedder (lib-embed) + its cached item embeddings (warmed by semantic-audit) to
   build the topical-category CENTROIDS, and returns the top-N nearest — the same
   relative signal the audit uses. HOMELESS-aware: if the best fit is below the
   floor, it says the item may not fit any category (consider omit / new category).

   Only TOPICAL categories are ranked (functional/property are placed by
   communicative act / POS, not topical similarity — see docs/CONTENT-QUALITY.md).

   Usage (from repo root):
     node tools/classify.mjs --kind phrase --text "El cielo está despejado."
     node tools/classify.mjs --kind vocab  --text "banco"  --def "Lugar donde se guarda dinero."
     node tools/classify.mjs --kind phrase --text "…" --json     # machine-readable
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEmbedder, cos, centroid as meanVec } from './lib-embed.mjs';
import { discoverPairs, phraseTopicsFor, vocabLangs, vocabDecksFor } from './lib-content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_FILE = path.join(ROOT, 'tools/sources/derived/semantic-embeddings-cache.json');
const HOMELESS = 0.32, TOPN = 5;

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const KIND = argVal('--kind', 'phrase');
const TEXT = argVal('--text', '');
const DEF = argVal('--def', '');
const JSON_OUT = args.includes('--json');
if (!TEXT) { console.error('ERROR: --text required'); process.exit(1); }

const scopes = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/json/common/category-scopes.json'), 'utf8'));
const axisOf = {};
for (const c of scopes.categories) axisOf[c.kind + ':' + c.id] = c.axis;

const E = makeEmbedder(CACHE_FILE);

// Build topical centroids from cached item embeddings (skip items not yet cached).
const members = {};   // cat -> [vec]
if (KIND === 'vocab') {
  for (const lang of vocabLangs()) for (const deck of vocabDecksFor(lang)) {
    if (axisOf['vocab:' + deck] !== 'topical') continue;
    const f = path.join(ROOT, `shared/json/vocab/${lang}/${deck === 'general' ? 'words.json' : 'words-' + deck + '.json'}`);
    for (const w of JSON.parse(fs.readFileSync(f, 'utf8')).words || []) {
      const v = E.get(`${w.term}. ${w.definition || ''}`.trim());
      if (v) (members[deck] ||= []).push(v);
    }
  }
} else {
  for (const pair of discoverPairs()) for (const t of phraseTopicsFor(pair)) {
    if (axisOf['phrase:' + t] !== 'topical') continue;
    const f = path.join(ROOT, `shared/json/pairs/${pair}/${t}.json`);
    if (!fs.existsSync(f)) continue;
    for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).phrases || []) {
      const v = E.get((p.target && p.target[0] && p.target[0].text) || '');
      if (v) (members[t] ||= []).push(v);
    }
  }
}

const centroids = {};
for (const [cat, vecs] of Object.entries(members)) if (vecs.length >= 2) centroids[cat] = meanVec(vecs);
if (Object.keys(centroids).length === 0) {
  console.error('No hay centroides cacheados. Corre primero: node tools/semantic-audit.mjs'); process.exit(1);
}

const qv = await E.embed(KIND === 'vocab' ? `${TEXT}. ${DEF}`.trim() : TEXT);
const ranked = Object.entries(centroids).map(([cat, v]) => [cat, cos(qv, v)]).sort((a, b) => b[1] - a[1]);
const homeless = ranked[0][1] < HOMELESS;

if (JSON_OUT) {
  console.log(JSON.stringify({ kind: KIND, text: TEXT, homeless,
    top: ranked.slice(0, TOPN).map(([category, sim]) => ({ category, sim: +sim.toFixed(3) })) }, null, 2));
} else {
  console.log(`\nCandidato (${KIND}): "${TEXT}"${DEF ? ` — "${DEF}"` : ''}`);
  if (homeless) {
    console.log(`\n⚠ Puede que NO encaje en ninguna categoría topical (mejor=${ranked[0][0]}:${ranked[0][1].toFixed(3)} < ${HOMELESS}).`);
    console.log('  → Considera omitir, o proponer categoría nueva. Si es functional/property, ubícalo por acto/POS, no por tema.');
  }
  console.log('\nTop categorías topical por afinidad:');
  for (const [cat, s] of ranked.slice(0, TOPN)) console.log(`  ${s.toFixed(3)}  ${cat}`);
}
