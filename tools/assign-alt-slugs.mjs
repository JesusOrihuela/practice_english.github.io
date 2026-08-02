/**
 * assign-alt-slugs.mjs
 * ────────────────────
 * Idempotent script that assigns a stable audioSlug to every form in
 * target[] that lacks one, across all per-pair phrase topic JSON files.
 *
 * Rules:
 *   - every form in target[] gets audioSlug = slugify(text) if missing.
 *     No form is exempt — the former type:'style' category was abolished;
 *     all forms have audio and (in multi-form phrases) labels.
 *
 * Uniqueness check:
 *   Within each pair + topic directory, no two forms may have the same slug.
 *   A collision means duplicate text — a content quality error.
 *
 * labels are NOT set by this script — they are the author's responsibility.
 *
 * Safe to re-run: forms that already have audioSlug are never changed.
 *
 * Usage:
 *   node tools/assign-alt-slugs.mjs          # assign + write
 *   node tools/assign-alt-slugs.mjs --dry    # preview only
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_DIR  = resolve(__dirname, '../shared/json');

// ── slugify (canonical filename-safe slug; mirrored by generate-audio.mjs and generate-audio-tgt.py) ──
// Slugs are capped at SLUG_MAX chars to keep audio paths within the Windows
// MAX_PATH (260) limit. When the base slug exceeds the cap it is truncated and
// suffixed with an 8-char sha256 of the ORIGINAL text, keeping the name
// deterministic and collision-free (two long forms sharing a prefix — e.g.
// gender variants differing only at the end — get distinct slugs).
const SLUG_MAX = 100;

const _slugBase = s =>
  s.toLowerCase()
   .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '_')
   .replace(/^_|_$/g, '');

const slugify = s => {
  const base = _slugBase(s);
  if (base.length <= SLUG_MAX) return base;
  const hash = createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 8);
  const head = base.slice(0, SLUG_MAX - 9).replace(/_+$/, '');  // 9 = '_' + 8 hex
  return `${head}_${hash}`;
};

// ── Configuration ─────────────────────────────────────────────────────────────

const PHRASE_TOPICS = [
  'emociones', 'greetings', 'restaurant', 'supermarket', 'kitchen',
  'transportation', 'airport', 'accommodation',
  'movies', 'music', 'theater', 'museums',
  'gym', 'technology', 'accountability',
];

const PAIRS = ['es-en', 'en-es'];

const args   = process.argv.slice(2);
const dryRun = args.includes('--dry');

if (dryRun) console.log('(dry-run — no files will be written)\n');

let grandTotal = 0;
const errors   = [];

// ── Main loop ─────────────────────────────────────────────────────────────────

for (const pairId of PAIRS) {
  for (const topic of PHRASE_TOPICS) {
    const jsonPath = resolve(JSON_DIR, 'pairs', pairId, `${topic}.json`);
    if (!existsSync(jsonPath)) continue;

    let data;
    try { data = JSON.parse(readFileSync(jsonPath, 'utf8')); }
    catch (_) { continue; }

    const phrases  = data.phrases ?? [];
    const slugsUsed = new Map();  // slug → phraseId (collision detection)
    let assigned = 0;
    let dirty    = false;

    // First pass: collect all existing slugs to prevent double-assignment
    for (const p of phrases) {
      for (const form of (p.target ?? [])) {
        if (form.audioSlug) slugsUsed.set(form.audioSlug, p.id);
      }
    }

    // Second pass: assign missing slugs
    for (const p of phrases) {
      for (const form of (p.target ?? [])) {
        if (form.audioSlug) continue;          // already assigned — skip

        const slug = slugify(form.text);

        if (slugsUsed.has(slug)) {
          const msg = `COLLISION [${pairId}/${topic}] slug "${slug}" for phrase "${p.id}" already used by "${slugsUsed.get(slug)}"`;
          errors.push(msg);
          console.error('ERROR:', msg);
          continue;
        }

        form.audioSlug = slug;
        slugsUsed.set(slug, p.id);
        assigned++;
        dirty = true;
        if (dryRun) console.log(`  [DRY] ${pairId}/${topic}  ${p.id}: "${form.text}" → audioSlug: "${slug}"`);
      }
    }

    if (dirty && !dryRun) {
      writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`[${pairId}] ${topic}: ${assigned} slug(s) assigned`);
    } else if (!dirty) {
      if (dryRun) console.log(`[${pairId}] ${topic}: nothing to assign`);
    }

    grandTotal += assigned;
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nTotal: ${grandTotal} audioSlug(s) assigned`);
if (errors.length > 0) {
  console.log(`\nCollisions (${errors.length}):`);
  errors.forEach(e => console.log(' ', e));
  process.exit(1);
}
if (dryRun && grandTotal > 0)
  console.log('(dry-run — run without --dry to write)');
