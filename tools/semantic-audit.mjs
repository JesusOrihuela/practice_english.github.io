/* ============================================================
   semantic-audit.mjs — Content-quality audit in the MEANING domain (dev-time).

   The deterministic checks (check-content, check-taxonomy, audit) catch the
   mechanical failures. This tool catches the SEMANTIC ones that regex cannot:
   misplaced items, homeless items (no category / candidate new category),
   semantic duplicates (synonyms/paraphrases), and low internal fidelity
   (source↔target for phrases, term↔definition for vocab). It is HEURISTIC and
   REPORT-ONLY — it never edits content; a human confirms every action. Not in CI
   (needs a ~120 MB model + judgment); run it after each content batch.

   Anchors = each category's scope + bilingual examples from
   shared/json/common/category-scopes.json. `axis` (topical|functional|property)
   gates which tests apply, so functional/property categories — dispersed BY DESIGN
   — are not falsely flagged as non-atomic. Model:
   Xenova/paraphrase-multilingual-MiniLM-L12-v2 (multilingual → works for any pair).

   Usage (from repo root; resolves tools/node_modules):
     node tools/semantic-audit.mjs                 # full sweep
     node tools/semantic-audit.mjs --top 40        # limit printed items per section
     node tools/semantic-audit.mjs --no-dup        # skip the O(n^2) duplication pass
   Report → tools/sources/derived/semantic-audit-report.json (+ printed summary).
   Waivers (persistent, tracked) → tools/semantic-audit-waivers.json.
   Rationale + how to triage: docs/CONTENT-QUALITY.md
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeEmbedder, cos, centroid as meanVec, MODEL } from './lib-embed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DERIVED = path.join(ROOT, 'tools/sources/derived');
const CACHE_FILE = path.join(DERIVED, 'semantic-embeddings-cache.json');
const REPORT_FILE = path.join(DERIVED, 'semantic-audit-report.json');
const WAIVER_FILE = path.join(ROOT, 'tools/semantic-audit-waivers.json');

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const TOP = parseInt(argVal('--top', '30'), 10);
const DO_DUP = !args.includes('--no-dup');
// Incremental mode: --only <comma-substrings> reports flags ONLY for items whose key
// matches (e.g. a pair, a topic, or an id) — cheap per-batch prospective run. Centroids
// are still built from ALL items (the anchor must see the full picture).
const ONLY = (argVal('--only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const inScope = (key) => ONLY.length === 0 || ONLY.some(s => key.includes(s));
// Thresholds — calibrated to be conservative (favor precision; the human confirms).
const T = {
  homeless: 0.32,   // sim to nearest category CENTROID below this ⇒ fits no category
  margin: 0.04,     // top1−top2 centroid gap below this ⇒ ambiguous (near-tie)
  misMargin: 0.05,  // confident misplacement needs at least this gap over the assigned cat
  dup: 0.90,        // cosine ≥ this (and not identical) ⇒ semantic near-duplicate
  faithLow: 0.20,   // source↔target / term↔definition below this ⇒ low fidelity. Cross-
                    // lingual sim of FAITHFUL idiomatic translations is wide (0.2–0.85),
                    // so only near-zero (true "riddle" anti-pattern of Rule 14) is flagged.
  cohesionLow: 0.40,// topical category mean-to-centroid below this ⇒ possibly non-atomic
  knn: 7,
};

// ── waivers ───────────────────────────────────────────────────
const waivers = fs.existsSync(WAIVER_FILE)
  ? JSON.parse(fs.readFileSync(WAIVER_FILE, 'utf8')) : { items: {} };
const contentHash = (s) => crypto.createHash('sha1').update(s || '').digest('hex').slice(0, 12);
// A waiver value may be `true` (waive every signal for this key) or an object
// { kinds?: string[], hash?: string, reason?: string }. With `hash`, a changed item
// re-flags. Dup keys are the two item keys SORTED (order-independent).
const isWaived = (key, kind, hash) => {
  const w = waivers.items[key];
  if (!w) return false;
  if (w === true) return true;
  return (!w.hash || w.hash === hash) && (!w.kinds || w.kinds.includes(kind));
};
const dupKey = (a, b) => [a, b].sort().join('|');

// ── load taxonomy + content ───────────────────────────────────
const scopes = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/json/common/category-scopes.json'), 'utf8'));
const axisOf = {};                    // "phrase:restaurant" -> axis
const anchorText = { phrase: {}, vocab: {} };
for (const c of scopes.categories) {
  axisOf[c.kind + ':' + c.id] = c.axis;
  const ex = [...((c.examples && c.examples.en) || []), ...((c.examples && c.examples.es) || [])];
  anchorText[c.kind][c.id] = `${c.scope} ${ex.join('. ')}`;
}

const items = [];                     // { key, kind, group, category, axis, text, pairA, pairB }
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');
const pairs = fs.readdirSync(PAIRS_DIR).filter(p => fs.existsSync(path.join(PAIRS_DIR, p, 'topics.json')));
for (const pair of pairs) {
  const topics = JSON.parse(fs.readFileSync(path.join(PAIRS_DIR, pair, 'topics.json'), 'utf8')).topics.filter(t => t.phrase);
  for (const t of topics) {
    const f = path.join(PAIRS_DIR, pair, `${t.id}.json`);
    if (!fs.existsSync(f)) continue;
    for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).phrases || []) {
      const text = (p.target && p.target[0] && p.target[0].text) || '';
      items.push({ key: `${pair}/${p.id}`, kind: 'phrase', group: pair, category: t.id,
        axis: axisOf['phrase:' + t.id], text, source: p.source || '',
        pairFields: { targetText: text } });
    }
  }
}
for (const lang of fs.readdirSync(path.join(ROOT, 'shared/json/vocab'))) {
  const dir = path.join(ROOT, 'shared/json/vocab', lang);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const deck = f === 'words.json' ? 'general' : f.replace(/^words-/, '').replace(/\.json$/, '');
    for (const w of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).words || []) {
      items.push({ key: `${lang}/${deck}/${w.id}`, kind: 'vocab', group: lang, category: deck,
        axis: axisOf['vocab:' + deck], text: `${w.term}. ${w.definition || ''}`.trim(),
        term: w.term || '', definition: w.definition || '' });
    }
  }
}

// ── embedding (shared lib-embed: disk cache + multilingual model) ─────────────
const E = makeEmbedder(CACHE_FILE);
const embed = E.embed;

// anchors
const anchorVec = { phrase: {}, vocab: {} };
for (const kind of ['phrase', 'vocab'])
  for (const id of Object.keys(anchorText[kind])) anchorVec[kind][id] = await embed(anchorText[kind][id]);
// items (+ extra fields for fidelity)
let done = 0;
for (const it of items) {
  it.vec = await embed(it.text);
  if (it.kind === 'phrase' && it.source) it.srcVec = await embed(it.source);
  if (it.kind === 'vocab' && it.definition) it.defVec = await embed(it.definition);
  if (++done % 500 === 0) process.stderr.write(`  embebidos ${done}/${items.length}\n`);
}
E.save();

// ── category CENTROIDS (topical only) — the anchor is the mean of a category's own
//    members (phrase-like, matches members far better than an abstract scope
//    sentence), so misplacement is RELATIVE: closer to another category's centroid
//    than to its own. Robust to the absolute-scale problem of scope-description
//    anchors. Self-pollution from a few mis-placed members is negligible.
const report = { model: MODEL, thresholds: T, generatedAt: new Date().toISOString(),
  misplaced: [], ambiguous: [], homeless: [], faithLow: [], duplicates: [], cohesion: [], newCategoryClusters: [] };
const catItems = {};
for (const it of items) (catItems[it.kind + ':' + it.category] ||= []).push(it);
const centroid = {};   // "kind:cat" (topical) -> normalized mean vec (via lib-embed)
for (const [ck, list] of Object.entries(catItems)) {
  if (axisOf[ck] !== 'topical') continue;
  centroid[ck] = meanVec(list.map(it => it.vec));
}
const centroidsFor = (kind) => Object.entries(centroid).filter(([ck]) => ck.startsWith(kind + ':'));

for (const it of items) {
  // Axis gate (plan §C-quinquies): topical-centroid tests apply ONLY to topical
  // categories. functional (survival, conversacion…) and property (verbos_*,
  // adjetivos_*, general, objetos) are dispersed BY DESIGN; their validity is
  // covered by POS↔deck (deterministic) + duplication.
  if (it.axis !== 'topical') continue;
  const cents = centroidsFor(it.kind).map(([ck, v]) => [ck.split(':')[1], cos(it.vec, v)]).sort((a, b) => b[1] - a[1]);
  const [c1, s1] = cents[0], [, s2] = cents[1] || ['', 0];
  const assignedSim = centroid[it.kind + ':' + it.category] ? cos(it.vec, centroid[it.kind + ':' + it.category]) : 0;
  const assignedRank = cents.findIndex(([id]) => id === it.category);
  const margin = s1 - s2;
  const hash = contentHash(it.text);

  if (s1 < T.homeless) { if (!isWaived(it.key, 'homeless', hash) && inScope(it.key)) report.homeless.push({ key: it.key, category: it.category, top1: c1, sim: +s1.toFixed(3), text: it.text }); continue; }
  if (c1 !== it.category && (s1 - assignedSim) >= T.misMargin && margin >= T.margin) {
    it._mis = { to: c1, s1, assignedSim, margin };   // corroborated by kNN below
  } else if (margin < T.margin && assignedRank > 0 && assignedRank <= 1) {
    if (!isWaived(it.key, 'ambiguous', hash) && inScope(it.key))
      report.ambiguous.push({ key: it.key, category: it.category, between: cents.slice(0, 3).map(([id, s]) => `${id}:${s.toFixed(2)}`), text: it.text });
  }
}

// ── kNN corroboration for misplacement (per group + kind) ─────
const byBucket = {};
for (const it of items) { const b = it.kind + '|' + it.group; (byBucket[b] ||= []).push(it); }
for (const it of items) {
  if (!it._mis) continue;
  const peers = byBucket[it.kind + '|' + it.group];
  const nn = peers.filter(p => p !== it).map(p => [p.category, cos(it.vec, p.vec)]).sort((a, b) => b[1] - a[1]).slice(0, T.knn);
  const counts = {}; for (const [cat] of nn) counts[cat] = (counts[cat] || 0) + 1;
  const knnTop = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const knnAgrees = knnTop && knnTop[0] !== it.category && knnTop[1] >= Math.ceil(T.knn / 2);
  const hash = contentHash(it.text);
  if (isWaived(it.key, 'misplaced', hash) || !inScope(it.key)) continue;
  const rec = { key: it.key, from: it.category, to: it._mis.to, axis: it.axis,
    sim: +it._mis.s1.toFixed(3), assignedSim: +it._mis.assignedSim.toFixed(3),
    knn: knnTop ? `${knnTop[0]}×${knnTop[1]}/${T.knn}` : '—', confident: !!knnAgrees, text: it.text };
  report.misplaced.push(rec);
}
report.misplaced.sort((a, b) => (b.confident - a.confident) || (b.sim - b.assignedSim) - (a.sim - a.assignedSim));

// ── fidelity: source↔target (phrase) / term↔definition (vocab) ─
for (const it of items) {
  const hash = contentHash(it.text);
  if (it.kind === 'phrase' && it.srcVec) {
    const s = cos(it.vec, it.srcVec);
    if (s < T.faithLow && !isWaived(it.key, 'faith', hash) && inScope(it.key))
      report.faithLow.push({ key: it.key, kind: 'source↔target', sim: +s.toFixed(3), source: it.source, target: it.text });
  }
  if (it.kind === 'vocab' && it.defVec) {
    const s = cos(it.vec, it.defVec);   // note: it.vec = term+def, so compare term alone
    const termVec = it.term ? await embed(it.term) : null;
    const st = termVec ? cos(termVec, it.defVec) : 1;
    if (st < T.faithLow && !isWaived(it.key, 'faith', hash) && inScope(it.key))
      report.faithLow.push({ key: it.key, kind: 'term↔definition', sim: +st.toFixed(3), term: it.term, definition: it.definition });
  }
}

// ── semantic duplication (within group+kind; paraphrase, not identical) ─
if (DO_DUP) {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const jacc = (a, b) => { const A = new Set(a.split(' ')), B = new Set(b.split(' ')); let inter = 0; for (const x of A) if (B.has(x)) inter++; return inter / (A.size + B.size - inter || 1); };
  for (const b of Object.keys(byBucket)) {
    const arr = byBucket[b];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const s = cos(arr[i].vec, arr[j].vec);
      if (s < T.dup) continue;
      const na = norm(arr[i].text), nb = norm(arr[j].text);
      if (na === nb) continue;   // exact dup already caught by check-content
      const hash = contentHash(arr[i].text + '|' + arr[j].text);
      if (isWaived(dupKey(arr[i].key, arr[j].key), 'dup', hash)) continue;
      if (!inScope(arr[i].key) && !inScope(arr[j].key)) continue;
      report.duplicates.push({ a: arr[i].key, b: arr[j].key, sim: +s.toFixed(3),
        kind: jacc(na, nb) > 0.5 ? 'near-dup' : 'paraphrase', textA: arr[i].text, textB: arr[j].text });
    }
  }
  report.duplicates.sort((a, b) => b.sim - a.sim);
}

// ── cohesion / atomicity (TOPICAL categories only) — reuses the centroids above ─
for (const [ck, list] of Object.entries(catItems)) {
  if (!centroid[ck] || list.length < 5) continue;   // centroid[] holds topical cats only
  const mean = list.reduce((a, it) => a + cos(it.vec, centroid[ck]), 0) / list.length;
  if (mean < T.cohesionLow) report.cohesion.push({ category: ck, size: list.length, cohesion: +mean.toFixed(3) });
}
report.cohesion.sort((a, b) => a.cohesion - b.cohesion);

// ── homeless clustering → new-category proposals ──────────────
{
  const hs = report.homeless.map(h => items.find(it => it.key === h.key)).filter(Boolean);
  const used = new Set(); const clusters = [];
  for (let i = 0; i < hs.length; i++) {
    if (used.has(i)) continue;
    const cl = [i]; used.add(i);
    for (let j = i + 1; j < hs.length; j++) if (!used.has(j) && hs[i].group === hs[j].group && cos(hs[i].vec, hs[j].vec) > 0.55) { cl.push(j); used.add(j); }
    if (cl.length >= 3) clusters.push(cl.map(k => hs[k].key));
  }
  report.newCategoryClusters = clusters;
}

// ── write + summarize ─────────────────────────────────────────
fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
const n = (a) => a.length;
console.log(`\n═══ Auditoría semántica (${items.length} ítems, modelo ${MODEL.split('/')[1]}) ═══`);
console.log(`Reporte completo: ${path.relative(ROOT, REPORT_FILE)}\n`);
const sec = (title, arr, fmt) => {
  console.log(`── ${title} (${n(arr)}) ──`);
  for (const r of arr.slice(0, TOP)) console.log('  ' + fmt(r));
  if (n(arr) > TOP) console.log(`  … +${n(arr) - TOP} más (ver reporte)`);
  console.log('');
};
sec('MISPLACEMENT (confiado primero)', report.misplaced, r => `${r.confident ? '‼' : '?'} ${r.key}  ${r.from} → ${r.to}  (sim ${r.sim} vs asignada ${r.assignedSim}, kNN ${r.knn})  "${r.text}"`);
sec('HOMELESS (candidatos a quitar / categoría nueva)', report.homeless, r => `${r.key}  best=${r.top1}:${r.sim}  "${r.text}"`);
sec('NEW-CATEGORY CLUSTERS', report.newCategoryClusters, c => `${c.length} ítems: ${c.slice(0, 6).join(', ')}${c.length > 6 ? '…' : ''}`);
sec('FIDELIDAD BAJA (source↔target / term↔def)', report.faithLow, r => `${r.key}  ${r.kind} sim=${r.sim}  ${r.source || r.term} ⟷ ${r.target || r.definition}`);
sec('DUPLICACIÓN SEMÁNTICA (paráfrasis/sinónimo)', report.duplicates, r => `[${r.kind} ${r.sim}] ${r.a} ⟷ ${r.b}  "${r.textA}" / "${r.textB}"`);
sec('COHESIÓN BAJA (categorías topical → posible split)', report.cohesion, r => `${r.category}  cohesión=${r.cohesion}  (${r.size} ítems)`);
const total = n(report.misplaced) + n(report.homeless) + n(report.faithLow) + n(report.duplicates) + n(report.cohesion);
console.log(`Total señaladas: ${total} (confirmación humana; nada se movió). Waivers: tools/semantic-audit-waivers.json`);
