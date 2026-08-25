/* ============================================================
   check-images.mjs — Deterministic topic-image checks (CI-blockable).

   Enumerates every expected (activity, topic) image slot via lib-images and
   verifies, with zero false positives, that each image is:
     • present     — both .jpg and .webp exist
     • decodable   — not corrupt
     • sized right  — jpg 1280×720, webp 800×450 (16:9, what the cards render)
     • un-barred    — no near-uniform letterbox/pillarbox edge (the "borders" bug)
     • sharp enough — variance of Laplacian above a conservative floor
     • unique       — no two topics in one activity share the same image (ahash)
   and that no orphan image exists for a demoted/removed topic.

   Pixel facts come from tools/img-probe.py (Pillow+numpy) in one pass. Topic images are an OPTIONAL
   enhancement (the cards degrade gracefully via onerror), so a MISSING image is advisory and does not
   fail CI; a PRESENT image that is corrupt/mis-sized/barred/blurry/duplicate, or an orphan, IS a
   failure (exit 1). --strict also requires presence; --report never exits 1.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as L from './lib-images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = process.argv.includes('--report');
// Thresholds (conservative → zero false positives for CI).
const T = { borderFrac: 0.02, sharpFloor: 5 };  // catches flat placeholders; soft photos (clouds, sky) pass

const issues = [];
const flag = (rel, rule, msg) => issues.push({ rel, rule, msg });

// 1) Gather every file to probe: expected slots + orphans.
const cells = L.cells();
const files = new Set();
for (const c of cells) { for (const f of [c.jpg, c.webp]) if (fs.existsSync(f)) files.add(f); }
const orphans = [];
for (const act of L.imageActivities())
  for (const id of L.orphanFiles(act)) {
    orphans.push({ act, id });
    for (const ext of ['jpg', 'webp']) { const f = path.join(ROOT, act, 'img', id + '.' + ext); if (fs.existsSync(f)) files.add(f); }
  }

// 2) Probe pixel facts in one Python pass.
let facts = {};
if (files.size) {
  const out = execFileSync('python', [path.join(ROOT, 'tools/img-probe.py')],
    { input: [...files].join('\n'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  facts = JSON.parse(out);
}
const factOf = (f) => facts[f] || facts[f.replace(/\\/g, '/')] || null;

// 3) Presence + per-file deterministic checks.
const ahashByAct = {};  // act → { ahash → topicId } for dup detection (use webp)
for (const c of cells) {
  for (const [ext, [W, H]] of Object.entries(L.CANON)) {
    const f = c[ext];
    if (!fs.existsSync(f)) { flag(`${c.rel}.${ext}`, 'missing', `falta ${ext} (${c.act}/${c.topic.id})`); continue; }
    const fx = factOf(f);
    if (!fx || !fx.ok) { flag(`${c.rel}.${ext}`, 'corrupt', `no decodifica${fx && fx.err ? ': ' + fx.err : ''}`); continue; }
    if (fx.w !== W || fx.h !== H) flag(`${c.rel}.${ext}`, 'dims', `${fx.w}×${fx.h}, esperado ${W}×${H}`);
    const bmax = Math.max(fx.border.t, fx.border.b) / fx.h, bmaxx = Math.max(fx.border.l, fx.border.r) / fx.w;
    if (bmax >= T.borderFrac || bmaxx >= T.borderFrac)
      flag(`${c.rel}.${ext}`, 'border', `barra uniforme t${fx.border.t} b${fx.border.b} l${fx.border.l} r${fx.border.r}`);
    if (fx.sharp < T.sharpFloor) flag(`${c.rel}.${ext}`, 'blurry', `nitidez ${fx.sharp} < ${T.sharpFloor}`);
    if (ext === 'webp') {
      (ahashByAct[c.act] ||= {});
      const prev = ahashByAct[c.act][fx.ahash];
      if (prev && prev !== c.topic.id) flag(`${c.rel}.webp`, 'duplicate', `misma imagen que "${prev}" en ${c.act}`);
      else ahashByAct[c.act][fx.ahash] = c.topic.id;
    }
  }
}

// 4) Orphans.
for (const o of orphans) flag(`${o.act}/img/${o.id}`, 'orphan', `imagen sin tema esperado (¿tema removido/degradado?)`);

// 5) Report. MISSING is ADVISORY — topic images are an optional enhancement and the topic cards
//    degrade gracefully (topic-grid.js loads the image with onerror="this.remove()"), so a missing
//    image must not block CI. Everything else (corrupt/dims/border/blurry/duplicate/orphan) is a
//    QUALITY failure: an image that IS present must be valid. `--strict` also requires presence.
const STRICT  = process.argv.includes('--strict');
const missing = issues.filter(i => i.rule === 'missing');
const hard    = issues.filter(i => i.rule !== 'missing');

if (issues.length === 0) { console.log(`✓ check-images: ${cells.length} celdas — ALL CLEAR`); process.exit(0); }

if (hard.length) {
  const byRule = {};
  for (const i of hard) (byRule[i.rule] ||= []).push(i);
  console.log(`✗ check-images: ${hard.length} problema(s) de calidad en ${cells.length} celdas\n`);
  for (const rule of Object.keys(byRule).sort()) {
    console.log(`── ${rule} (${byRule[rule].length}) ──`);
    for (const i of byRule[rule].slice(0, REPORT ? 999 : 12)) console.log(`  ${i.rel}: ${i.msg}`);
    if (!REPORT && byRule[rule].length > 12) console.log(`  … +${byRule[rule].length - 12} más (usa --report)`);
    console.log('');
  }
}
if (missing.length) {
  const lvl = STRICT ? '✗' : '·';
  console.log(`${lvl} ${missing.length} imagen(es) de tema ausente(s) — ${STRICT ? 'requeridas (--strict)' : 'advisory: las tarjetas degradan sin imagen'}.`);
  console.log(`  Puebla con: node tools/fetch-topic-images.mjs`);
}
if (!hard.length && !(STRICT && missing.length)) console.log(`  ✓ toda imagen PRESENTE es válida (${missing.length} ausente(s), advisory).`);

const blocking = hard.length + (STRICT ? missing.length : 0);
process.exit((blocking > 0 && !REPORT) ? 1 : 0);
