/* ============================================================
   fetch-topic-images.mjs — Author-time "pick the best" topic-image sourcer.

   Prevention at the source: instead of taking one RANDOM CC photo per keyword
   (the old LoremFlickr approach that produced off-topic/badly-framed images),
   this fetches many Creative-Commons candidates from the Openverse API, scores
   each with CLIP for relevance to the topic (lib-clip), keeps only those that
   clear the bar, and assigns the top DISTINCT ones — one per activity, preserving
   the per-activity variety. Chosen images are cover-cropped to the canonical pair
   (process-image.py) and their license/author recorded for CREDITS.md.

   Usage (from repo root):
     node tools/fetch-topic-images.mjs --topic fiesta --topic objetos
     node tools/fetch-topic-images.mjs --list tools/sources/derived/image-fetch-list.json
     node tools/fetch-topic-images.mjs --topic hogar --dry     # score only, no writes
   Options: --n <candidates=24>  --min-rel <0.24>  --dry  --activities a,b
   ============================================================ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as L from './lib-images.mjs';
import { imgEmb, txtEmb, cos } from './lib-clip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CREDITS = path.join(ROOT, 'tools/sources/derived/image-credits.json');
const TMP = path.join(os.tmpdir(), 'topic-img');
fs.mkdirSync(TMP, { recursive: true });

const args = process.argv.slice(2);
const argAll = (n) => args.reduce((a, v, i) => (args[i - 1] === n ? [...a, v] : a), []);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const N = +argVal('--n', 18), MIN_REL = +argVal('--min-rel', 0.22), DRY = args.includes('--dry');

let wantTopics = argAll('--topic');
const listFile = argVal('--list', '');
if (listFile) wantTopics = wantTopics.concat(JSON.parse(fs.readFileSync(listFile, 'utf8')));
if (!wantTopics.length) { console.error('ERROR: pasa --topic <id> (repetible) o --list <file>'); process.exit(1); }

const TOPICS = L.topics();
const byId = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

const UA = 'PracticeEnglish-image-sourcer/1.0 (language-learning app; educational)';
const strip = (h) => (h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Candidate CC images from Wikimedia Commons (no auth, generous limits, clean
    attribution). Returns normalized {id,url,title,license,creator,landing,source}. */
async function commons(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
    + `&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}`
    + `&gsrnamespace=6&gsrlimit=${N}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1280`;
  let r;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) break;
    if (attempt < 2) await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
  if (!r.ok) throw new Error(`commons ${r.status}`);
  const pages = Object.values((await r.json()).query?.pages || {});
  return pages.map((p) => {
    const ii = p.imageinfo?.[0] || {}, md = ii.extmetadata || {};
    return {
      id: String(p.pageid), url: ii.thumburl || ii.url, title: strip(md.ObjectName?.value) || p.title,
      license: strip(md.LicenseShortName?.value) || 'CC', creator: strip(md.Artist?.value) || null,
      landing: ii.descriptionurl, source: 'Wikimedia Commons',
      w: ii.thumbwidth || ii.width || 0, h: ii.thumbheight || ii.height || 0,
    };
  }).filter((x) => x.url && x.w >= 800 && x.h * 1 <= x.w * 1.4);  // large, not extreme portrait
}

/** A clean search keyword from an English label: the part before "&"/"/"/","
    An explicit --q overrides it (useful for abstract topics with weak labels). */
function queryFor(topic) { return argVal('--q', '') || topic.labelEn.split(/[&/,]/)[0].trim(); }

/** Optional higher-quality source. Key from $PIXABAY_KEY or the gitignored
    tools/.image-keys.json — never committed. Absent → Commons is used. */
function pixabayKey() {
  if (process.env.PIXABAY_KEY) return process.env.PIXABAY_KEY;
  const f = path.join(ROOT, 'tools/.image-keys.json');
  if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, 'utf8')).pixabay || null; } catch { /* ignore */ } }
  return null;
}
async function pixabay(query, key) {
  const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}`
    + `&image_type=photo&orientation=horizontal&safesearch=true&per_page=${Math.max(3, N)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`pixabay ${r.status}`);
  return ((await r.json()).hits || []).map((h) => ({
    id: String(h.id), url: h.largeImageURL || h.webformatURL, title: (h.tags || '').split(',')[0].trim(),
    license: 'Pixabay Content License', creator: h.user || null, landing: h.pageURL, source: 'Pixabay',
    w: h.imageWidth || h.webformatWidth || 0, h: h.imageHeight || 0,
  })).filter((x) => x.url && x.w >= 800 && x.h <= x.w * 1.4);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function download(url, dest) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    if (r.ok) { fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); return; }
    if (r.status === 429 && attempt < 3) { await sleep(1500 * (attempt + 1)); continue; }  // CDN rate-limit
    throw new Error(`dl ${r.status}`);
  }
}

/** Activities that carry an image for this topic (phrase→phrase acts, vocab→vocab acts). */
function activitiesFor(topic) {
  const override = argVal('--activities', '');
  if (override) return override.split(',');
  return L.imageActivities().filter((a) => (L.activityKind(a) === 'vocab' ? topic.vocab : topic.phrase));
}

const KEY = pixabayKey();
console.log(`fuente: ${KEY ? 'Pixabay (key detectada)' : 'Wikimedia Commons (sin key)'}`);
const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : {};
const PROC = path.join(ROOT, 'tools/process-image.py');
const PROBE = path.join(ROOT, 'tools/img-probe.py');
const usedAhash = new Set();  // avoid reusing a photo across topics (global, persistent)

// Seed usedAhash with the ahashes of every EXISTING topic image except the ones being
// regenerated now — so new picks never collide with images kept for other topics.
{
  const regen = new Set(wantTopics);
  const keep = [];
  for (const c of L.cells()) if (fs.existsSync(c.webp) && !regen.has(c.topic.id)) keep.push(c.webp);
  if (keep.length) {
    try {
      const out = execFileSync('python', [PROBE], { input: keep.join('\n'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      for (const f of Object.values(JSON.parse(out))) if (f.ahash) usedAhash.add(f.ahash);
    } catch { /* best-effort seeding */ }
  }
}

/** Cover-crop a raw download to a temp base and return its quality facts, or null. */
function processAndProbe(raw, base) {
  try {
    const out = execFileSync('python', [PROC, raw, base], { encoding: 'utf8' });
    return JSON.parse(out.trim().split('\n').pop());  // {sharp, ahash, border}
  } catch { return null; }
}
const isBordered = (b) => Math.max(b.t, b.b) >= 9 || Math.max(b.l, b.r) >= 16;  // ≥2% of webp edge

for (const id of wantTopics) {
  const topic = byId[id];
  if (!topic) { console.error(`  ⚠ tema desconocido: ${id}`); continue; }
  const acts = activitiesFor(topic);
  const desc = L.descriptor(topic);
  const tvec = await txtEmb(desc);
  console.log(`\n=== ${id} — "${topic.labelEn}" → ${acts.length} actividad(es) ===`);

  let cands;
  try { cands = KEY ? await pixabay(queryFor(topic), KEY) : await commons(queryFor(topic)); }
  catch (e) { console.error(`  ⚠ fuente falló: ${e.message}`); continue; }

  const scored = [];
  let rejected = 0;
  for (const c of cands) {
    const raw = path.join(TMP, `${id}-${c.id}`.replace(/[^\w-]/g, '') + '.img');
    const base = path.join(TMP, `${id}-${c.id}`.replace(/[^\w-]/g, '') + '-p');
    try {
      await download(c.url, raw);
      const fx = processAndProbe(raw, base);                       // cover-crop + quality facts
      if (!fx || isBordered(fx.border) || fx.sharp < 5 || usedAhash.has(fx.ahash)) { rejected++; await sleep(150); continue; }
      const rel = cos(await imgEmb(base + '.webp'), tvec);         // relevance of the FINAL image
      scored.push({ c, base, rel, ahash: fx.ahash });
    } catch { /* skip unreachable/undecodable candidate */ }
    await sleep(150);
  }
  scored.sort((a, b) => b.rel - a.rel);
  const passing = scored.filter((s) => s.rel >= MIN_REL);
  console.log(`  candidatos: ${scored.length} ok (${rejected} rechazados por encuadre/nitidez/dup), ${passing.length} ≥ ${MIN_REL}`);
  for (const s of scored.slice(0, 5)) console.log(`    ${s.rel.toFixed(3)}  ${(s.c.title || '').slice(0, 44)}  [${s.c.license} · ${s.c.source}]`);

  if (DRY) continue;
  if (passing.length === 0) {
    console.error(`  ⚠ 0 candidatos válidos ≥ ${MIN_REL} — revisa a mano o ajusta el keyword; NO se escribió nada`);
    continue;
  }
  // one distinct candidate per activity; if fewer pass than activities, cycle the
  // best ones to fill (a relevant image repeated beats an irrelevant filler).
  if (passing.length < acts.length)
    console.error(`  ⚠ solo ${passing.length} candidato(s) válido(s) para ${acts.length} actividades — se repetirán los mejores`);
  const chosen = acts.map((_, i) => passing[i % passing.length]);
  acts.forEach((act, i) => {
    const { c, base, ahash } = chosen[i];
    const outBase = path.join(ROOT, act, 'img', id);
    fs.copyFileSync(base + '.jpg', outBase + '.jpg');             // already processed + probed
    fs.copyFileSync(base + '.webp', outBase + '.webp');
    usedAhash.add(ahash);
    credits[`${act}/img/${id}`] = { title: c.title || null, creator: c.creator || null, license: c.license, source: c.source, landing: c.landing };
    console.log(`    ✓ ${act}/img/${id}  (rel ${chosen[i].rel.toFixed(3)}, ${c.license})`);
  });
}

if (!DRY) { fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 2) + '\n'); console.log(`\ncréditos → ${path.relative(ROOT, CREDITS)}`); }
