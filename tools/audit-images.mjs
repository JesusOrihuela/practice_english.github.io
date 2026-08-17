/* ============================================================
   audit-images.mjs — Perceptual relevance audit of topic images (dev-time).

   The deterministic half (dims/borders/dupes/missing) lives in check-images.mjs.
   This half judges MEANING: does each image actually depict its topic? Uses CLIP
   (lib-clip) to score every image against its topic descriptor and against every
   OTHER topic's descriptor. Two report-only buckets, ranked worst-first:

     • low-relevance — cos(image, own topic) below an absolute floor
     • mismatch      — some OTHER topic scores clearly higher (e.g. "Hogar" whose
                       photo is an outdoor couch → "outdoor furniture" wins)

   Human confirms; reviewed exceptions go in tools/image-audit-waivers.json (same
   pattern as semantic-audit). The fail list feeds the remediation (re-fetch).
   Image embeddings are cached by file-content hash so re-runs are cheap.

   Usage:  node tools/audit-images.mjs            (all cells, summary)
           node tools/audit-images.mjs --json      (write report json)
   ============================================================ */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './lib-images.mjs';
import { imgEmb, txtEmb, cos } from './lib-clip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools/sources/derived/image-embeddings-cache.json');
const REPORT = path.join(ROOT, 'tools/sources/derived/image-audit-report.json');
const WAIVERS = path.join(ROOT, 'tools/image-audit-waivers.json');
const T = { low: 0.24, margin: 0.03 };  // relevance floor; mismatch margin

const waivers = fs.existsSync(WAIVERS) ? JSON.parse(fs.readFileSync(WAIVERS, 'utf8')).items || {} : {};
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);

async function embedCached(file) {
  const h = sha(fs.readFileSync(file));
  if (cache[h]) return cache[h];
  const v = await imgEmb(file);
  cache[h] = v;
  return v;
}

// Descriptor text vector for every topic (the distractor set).
const TOPICS = L.topics();
const descVec = {};
for (const t of TOPICS) descVec[t.id] = await txtEmb(L.descriptor(t));

const rows = [];
for (const c of L.cells()) {
  if (!fs.existsSync(c.webp)) continue;                 // missing → check-images handles it
  if (waivers[c.rel]) continue;
  const v = await embedCached(c.webp);
  const rel = cos(v, descVec[c.topic.id]);
  let best = c.topic.id, bestSim = rel;
  for (const t of TOPICS) { if (t.id === c.topic.id) continue; const s = cos(v, descVec[t.id]); if (s > bestSim) { best = t.id; bestSim = s; } }
  const mismatch = best !== c.topic.id && bestSim - rel >= T.margin;
  const bucket = mismatch ? 'mismatch' : (rel < T.low ? 'low-relevance' : null);
  if (bucket) rows.push({ rel: +rel.toFixed(3), key: c.rel, topic: c.topic.id, bucket, rival: best, rivalSim: +bestSim.toFixed(3) });
}
fs.writeFileSync(CACHE, JSON.stringify(cache));

rows.sort((a, b) => (a.rel - a.rivalSim) - (b.rel - b.rivalSim) || a.rel - b.rel);
const byB = { mismatch: rows.filter((r) => r.bucket === 'mismatch'), 'low-relevance': rows.filter((r) => r.bucket === 'low-relevance') };
console.log(`audit-images: ${L.cells().length} celdas | señaladas ${rows.length} (waivers ${Object.keys(waivers).length})\n`);
for (const b of ['mismatch', 'low-relevance']) {
  console.log(`── ${b} (${byB[b].length}) ──`);
  for (const r of byB[b]) console.log(`  rel ${r.rel}  ${r.key}${r.bucket === 'mismatch' ? `  → gana "${r.rival}" (${r.rivalSim})` : ''}`);
  console.log('');
}
if (process.argv.includes('--json')) {
  fs.writeFileSync(REPORT, JSON.stringify({ thresholds: T, generatedAt: new Date().toISOString(), flagged: rows }, null, 2) + '\n');
  console.log(`reporte → ${path.relative(ROOT, REPORT)}`);
}
