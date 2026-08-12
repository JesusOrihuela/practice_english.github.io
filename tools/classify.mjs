/* ============================================================
   classify.mjs — Author-time category suggester (dev-time, report-only).

   Prevention at the source: before adding a phrase/word, ask which category fits
   best, instead of placing by intuition and auditing later. Embeds the candidate
   with the same multilingual model + reuses the cached item embeddings
   (tools/sources/derived/semantic-embeddings-cache.json, warmed by semantic-audit)
   to build the topical-category CENTROIDS, and returns the top-N nearest — the same
   relative signal the audit uses. HOMELESS-aware: if the best fit is below the
   floor, it says the item may not fit any category (consider omit / new category)
   instead of forcing a top-N.

   Only TOPICAL categories are ranked (functional/property categories are placed by
   communicative act / POS, not topical similarity — see docs/CONTENT-QUALITY.md).

   Usage (from repo root):
     node tools/classify.mjs --kind phrase --text "El cielo está despejado."
     node tools/classify.mjs --kind vocab  --text "banco"  --def "Lugar donde se guarda dinero."
   ============================================================ */
import { pipeline } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_FILE = path.join(ROOT, 'tools/sources/derived/semantic-embeddings-cache.json');
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const HOMELESS = 0.32, TOPN = 5;

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const KIND = argVal('--kind', 'phrase');
const TEXT = argVal('--text', '');
const DEF = argVal('--def', '');
if (!TEXT) { console.error('ERROR: --text required'); process.exit(1); }

const scopes = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/json/common/category-scopes.json'), 'utf8'));
const axisOf = {};
for (const c of scopes.categories) axisOf[c.kind + ':' + c.id] = c.axis;

// Load the same content items + cached embeddings the audit uses.
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
const hash = (s) => crypto.createHash('sha1').update('e:' + s).digest('hex').slice(0, 12);
let extractor = null;
async function embed(text) {
  const h = hash(text);
  if (cache[h]) return cache[h];
  if (!extractor) { process.stderr.write(`(cargando ${MODEL}…)\n`); extractor = await pipeline('feature-extraction', MODEL); }
  const o = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(o.data);
}
const cos = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; };

// Build topical centroids from cached item embeddings (skip items not yet cached).
const members = {};   // cat -> [vec]
function addPhrases() {
  const dir = path.join(ROOT, 'shared/json/pairs');
  for (const pair of fs.readdirSync(dir).filter(p => fs.existsSync(path.join(dir, p, 'topics.json')))) {
    for (const t of JSON.parse(fs.readFileSync(path.join(dir, pair, 'topics.json'), 'utf8')).topics.filter(x => x.phrase)) {
      if (axisOf['phrase:' + t.id] !== 'topical') continue;
      const f = path.join(dir, pair, `${t.id}.json`);
      if (!fs.existsSync(f)) continue;
      for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).phrases || []) {
        const v = cache[hash((p.target && p.target[0] && p.target[0].text) || '')];
        if (v) (members[t.id] ||= []).push(v);
      }
    }
  }
}
function addVocab() {
  const base = path.join(ROOT, 'shared/json/vocab');
  for (const lang of fs.readdirSync(base)) {
    const d = path.join(base, lang); if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d).filter(x => x.endsWith('.json'))) {
      const deck = f === 'words.json' ? 'general' : f.replace(/^words-/, '').replace(/\.json$/, '');
      if (axisOf['vocab:' + deck] !== 'topical') continue;
      for (const w of JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')).words || []) {
        const v = cache[hash(`${w.term}. ${w.definition || ''}`.trim())];
        if (v) (members[deck] ||= []).push(v);
      }
    }
  }
}
(KIND === 'vocab' ? addVocab : addPhrases)();

const centroids = {};
for (const [cat, vecs] of Object.entries(members)) {
  if (vecs.length < 2) continue;
  const dim = vecs[0].length, c = new Array(dim).fill(0);
  for (const v of vecs) for (let i = 0; i < dim; i++) c[i] += v[i];
  let n = 0; for (let i = 0; i < dim; i++) n += c[i] * c[i]; n = Math.sqrt(n) || 1;
  for (let i = 0; i < dim; i++) c[i] /= n;
  centroids[cat] = c;
}
if (Object.keys(centroids).length === 0) {
  console.error('No hay centroides cacheados. Corre primero: node tools/semantic-audit.mjs'); process.exit(1);
}

const qv = await embed(KIND === 'vocab' ? `${TEXT}. ${DEF}`.trim() : TEXT);
const ranked = Object.entries(centroids).map(([cat, v]) => [cat, cos(qv, v)]).sort((a, b) => b[1] - a[1]);

console.log(`\nCandidato (${KIND}): "${TEXT}"${DEF ? ` — "${DEF}"` : ''}`);
if (ranked[0][1] < HOMELESS) {
  console.log(`\n⚠ Puede que NO encaje en ninguna categoría topical (mejor=${ranked[0][0]}:${ranked[0][1].toFixed(3)} < ${HOMELESS}).`);
  console.log('  → Considera omitir, o proponer una categoría nueva. Si es functional/property, ubícalo por acto/POS, no por tema.');
}
console.log('\nTop categorías topical por afinidad:');
for (const [cat, s] of ranked.slice(0, TOPN)) console.log(`  ${s.toFixed(3)}  ${cat}`);
