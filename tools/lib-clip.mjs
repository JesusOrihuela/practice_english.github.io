/* ============================================================
   lib-clip.mjs — Shared CLIP image↔text scorer (dev-time).

   Wraps Xenova/clip-vit-base-patch32 (via @huggingface/transformers, already a
   tools/ dependency) so both fetch-topic-images.mjs (author-time pick-the-best)
   and audit-images.mjs (relevance audit) share one lazy-loaded model. Mirrors
   tools/lib-embed.mjs. Cosine on L2-normalized projection embeddings ∈ ~[.15,.35].
   ============================================================ */
import { AutoProcessor, CLIPVisionModelWithProjection, AutoTokenizer, CLIPTextModelWithProjection, RawImage } from '@huggingface/transformers';

export const MODEL = 'Xenova/clip-vit-base-patch32';
let _proc, _vis, _tok, _txt;

async function ensure() {
  if (_vis) return;
  _proc = await AutoProcessor.from_pretrained(MODEL);
  _vis = await CLIPVisionModelWithProjection.from_pretrained(MODEL);
  _tok = await AutoTokenizer.from_pretrained(MODEL);
  _txt = await CLIPTextModelWithProjection.from_pretrained(MODEL);
}

const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
export const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

/** Embed an image (file path, URL, Blob, or RawImage) → normalized vector. */
export async function imgEmb(src) {
  await ensure();
  const image = src instanceof RawImage ? src : await RawImage.read(src);
  const out = await _vis(await _proc(image));
  return norm(Array.from(out.image_embeds.data));
}

/** Embed one or more text strings → normalized vector(s). */
export async function txtEmb(text) {
  await ensure();
  const arr = Array.isArray(text) ? text : [text];
  const out = await _txt(await _tok(arr, { padding: true, truncation: true }));
  const d = out.text_embeds.data, dim = out.text_embeds.dims[1], res = [];
  for (let i = 0; i < arr.length; i++) res.push(norm(Array.from(d.slice(i * dim, (i + 1) * dim))));
  return Array.isArray(text) ? res : res[0];
}

export { RawImage };
