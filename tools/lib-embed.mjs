/* ============================================================
   lib-embed.mjs — Shared multilingual embedding + vector helpers.

   The ONE place the semantic tools (semantic-audit.mjs, classify.mjs) get their
   embedder, cosine, and centroid — no duplication. Multilingual model works for any
   pair/language. Embeddings are cached on disk (keyed by text hash) so re-runs are
   fast; the model (~120 MB) is a dev-only dependency in tools/, cached like Kokoro.
   ============================================================ */
import { pipeline } from '@huggingface/transformers';
import fs from 'node:fs';
import crypto from 'node:crypto';

export const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/** An embedder backed by a JSON disk cache. `embed(text)` returns a normalized
 *  vector (cached); `save()` persists new vectors; `has(text)` checks the cache. */
export function makeEmbedder(cacheFile) {
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const hash = (s) => crypto.createHash('sha1').update('e:' + s).digest('hex').slice(0, 12);
  let extractor = null;
  async function embed(text) {
    const h = hash(text);
    if (cache[h]) return cache[h];
    if (!extractor) { process.stderr.write(`(cargando ${MODEL}…)\n`); extractor = await pipeline('feature-extraction', MODEL); }
    const o = await extractor(text, { pooling: 'mean', normalize: true });
    const v = Array.from(o.data);
    cache[h] = v;
    return v;
  }
  return {
    embed,
    has: (text) => !!cache[hash(text)],
    get: (text) => cache[hash(text)],
    save: () => fs.writeFileSync(cacheFile, JSON.stringify(cache)),
    cache, hash,
  };
}

/** Cosine similarity of two already-normalized vectors (= dot product). */
export const cos = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; };

/** Normalized mean (centroid) of a non-empty list of vectors. */
export function centroid(vecs) {
  const dim = vecs[0].length, c = new Array(dim).fill(0);
  for (const v of vecs) for (let i = 0; i < dim; i++) c[i] += v[i];
  let n = 0; for (let i = 0; i < dim; i++) n += c[i] * c[i]; n = Math.sqrt(n) || 1;
  for (let i = 0; i < dim; i++) c[i] /= n;
  return c;
}
