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

   Pixel facts come from tools/img-probe.py (Pillow+numpy) in one pass. Report-only
   with --report; exits 1 on any issue otherwise (for the CI `validate` job).
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

// 5) Report.
if (issues.length === 0) { console.log(`✓ check-images: ${cells.length} celdas — ALL CLEAR`); process.exit(0); }
const byRule = {};
for (const i of issues) (byRule[i.rule] ||= []).push(i);
console.log(`✗ check-images: ${issues.length} problemas en ${cells.length} celdas\n`);
for (const rule of Object.keys(byRule).sort()) {
  console.log(`── ${rule} (${byRule[rule].length}) ──`);
  for (const i of byRule[rule].slice(0, REPORT ? 999 : 12)) console.log(`  ${i.rel}: ${i.msg}`);
  if (!REPORT && byRule[rule].length > 12) console.log(`  … +${byRule[rule].length - 12} más (usa --report)`);
  console.log('');
}
process.exit(REPORT ? 0 : 1);
