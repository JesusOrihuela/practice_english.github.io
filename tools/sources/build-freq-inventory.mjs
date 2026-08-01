/**
 * build-freq-inventory.mjs — Derive a compact CEFR-banded frequency index
 * =======================================================================
 * Reads the raw FrequencyWords lists (OpenSubtitles 2018, CC BY-SA) from
 * tools/sources/raw/{lang}_50k.txt and produces a compact lookup at
 * tools/sources/derived/{lang}-freq.json:
 *
 *   { "_source": ..., "_license": "CC BY-SA (hermitdave/FrequencyWords)",
 *     "lang": "es", "ranks": { "<word>": <1-based rank> }, "bands": {...} }
 *
 * The rank → CEFR band mapping follows Nation's coverage thresholds
 * (see CLAUDE.md Rule 12): the first ~1000 lemmas ≈ A1 core, ~2000-3000 ≈ A2,
 * ~4000-5000 ≈ B1. Beyond 5000 is treated as B2+ (no strict band).
 *
 * These are surface word forms, not lemmas — good enough as a frequency
 * *signal* for reconciliation and candidate filtering, never as ground truth.
 *
 * USAGE (from tools/sources/):  node build-freq-inventory.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = join(__dirname, 'raw');
const OUT = join(__dirname, 'derived');

const LANGS = ['es', 'en'];
const CAP   = 6000;   // keep the top N forms; enough for A1..B1 signalling

// rank (1-based) → CEFR band
function rankToBand(rank) {
  if (rank <= 1000) return 'A1';
  if (rank <= 3000) return 'A2';
  if (rank <= 5000) return 'B1';
  return 'B2+';
}

for (const lang of LANGS) {
  const src = join(RAW, `${lang}_50k.txt`);
  if (!existsSync(src)) { console.log(`SKIP ${lang}: ${src} not found`); continue; }

  const lines = readFileSync(src, 'utf8').split(/\r?\n/).filter(Boolean);
  const ranks = {};
  let rank = 0;
  for (const line of lines) {
    const word = line.split(/\s+/)[0];
    if (!word) continue;
    rank++;
    if (rank > CAP) break;
    // first occurrence wins (list is already frequency-sorted)
    if (!(word in ranks)) ranks[word] = rank;
  }

  const out = {
    _source: 'hermitdave/FrequencyWords — content/2018 (OpenSubtitles 2018)',
    _url: 'https://github.com/hermitdave/FrequencyWords',
    _license: 'CC BY-SA 3.0',
    lang,
    cap: CAP,
    bands: { A1: '1-1000', A2: '1001-3000', B1: '3001-5000', 'B2+': '5001+' },
    ranks,
  };
  writeFileSync(join(OUT, `${lang}-freq.json`), JSON.stringify(out));
  console.log(`OK ${lang}: ${Object.keys(ranks).length} forms → derived/${lang}-freq.json`);
}
