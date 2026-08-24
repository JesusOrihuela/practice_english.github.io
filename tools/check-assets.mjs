/* ============================================================
   check-assets.mjs — every region/variant label used in content must have its visual asset.

   RULE (part of "adding a language"): when a pair introduces region labels, the flags of its
   countries, the flag CLUSTERS of its zones, and the GLOBE of its macro-regions must all exist as
   real SVG assets — no label may fall back to bare text by accident. This check reads every
   `labels.region` value in the content (phrases + vocab), resolves it through AppFlags' REGION_MAP
   / REGION_GLOBE (parsed from shared/js/flags.js), and fails if any referenced flag or globe file
   is missing under shared/img/. A label intentionally left text-only (not in the map) is allowed
   but reported, so the author sees it.

     node tools/check-assets.mjs          # report
     node tools/check-assets.mjs --gate   # exit 1 on any missing asset
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = process.argv.includes('--gate');
const FLAGS_DIR = path.join(ROOT, 'shared/img/flags');
const REGIONS_DIR = path.join(ROOT, 'shared/img/regions');

const flagsSrc = fs.readFileSync(path.join(ROOT, 'shared/js/flags.js'), 'utf8');
// REGION_MAP entries: 'key': ['xx','yy'] → country codes; REGION_GLOBE: 'key': 'file.svg'.
const region2codes = {};
for (const m of flagsSrc.matchAll(/'([a-z0-9.() ]+)':\s*\[([^\]]*)\]/g))
  region2codes[m[1]] = (m[2].match(/'([a-z]{2})'/g) || []).map(s => s.replace(/'/g, ''));
const region2globe = {};
for (const m of flagsSrc.matchAll(/'([a-z0-9() ]+)':\s*'([a-z-]+\.svg)'/g)) region2globe[m[1]] = m[2];

const fold = (s) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const flagFiles = new Set(fs.readdirSync(FLAGS_DIR).filter(f => f.endsWith('.svg')).map(f => f.replace('.svg', '')));

// Collect every region label used in content.
const labels = new Set();
const scan = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) scan(p);
    else if (f.endsWith('.json'))
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/"region":\s*"([^"]+)"/g)) labels.add(m[1]);
  }
};
for (const d of ['shared/json/pairs', 'shared/json/vocab']) {
  const abs = path.join(ROOT, d);
  if (fs.existsSync(abs)) scan(abs);
}

const missing = [];
const textOnly = [];
for (const lab of [...labels].sort()) {
  const k = fold(lab);
  const builtinSingle = { us: 'us', uk: 'gb' }[k];
  const codes = region2codes[k] || (builtinSingle ? [builtinSingle] : null);
  if (codes) {
    const gone = codes.filter(c => !flagFiles.has(c));
    if (gone.length) missing.push(`${lab} → flags ${codes.join(',')} — MISSING: ${gone.join(',')}`);
  } else if (region2globe[k]) {
    if (!fs.existsSync(path.join(REGIONS_DIR, region2globe[k]))) missing.push(`${lab} → globe ${region2globe[k]} — MISSING`);
  } else {
    textOnly.push(lab);
  }
}

console.log(`Assets de variante — ${labels.size} etiqueta(s) de región; ${missing.length} sin asset, ${textOnly.length} solo-texto.`);
for (const m of missing) console.log('  ✗ ' + m);
if (textOnly.length) console.log('  · solo-texto (sin bandera/globo): ' + textOnly.join(', '));
if (!missing.length) console.log('  ✓ toda etiqueta de región tiene su asset (bandera / clúster / globo).');

if (GATE && missing.length) { console.log(`\n✗ ${missing.length} etiqueta(s) sin asset.`); process.exit(1); }
