#!/usr/bin/env node
/* ============================================================
   check-audio.mjs — Deterministic AUDIO-content gate.

   audit.mjs already checks that audio FILES exist (counts). This checks the
   SIGNAL: every .wav decodes, is not silent, is not clipped, and lasts a sane
   duration — and that each slug has exactly the voice set its language declares.
   Catches the failures a count can't: a muted/empty clip, a truncated render, a
   railed/distorted one, or a missing/cross-language voice.

   Nothing hardcoded: the voice set per language comes from shared/js/lang-profiles.js
   (`voices`); the language of an audio folder is DERIVED from the path (a pair dir
   like es-en → its TARGET language; a bare lang dir → itself). Pure Node — parses
   the WAV header + PCM directly, no Python. Some renders write a placeholder data-
   chunk size, so duration is taken from the ACTUAL bytes, not the declared size.

   Read-only. Exits 1 on any issue (for CI). Usage: node tools/check-audio.mjs
   ============================================================ */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import AppLangProfiles from '../shared/js/lang-profiles.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = join(ROOT, 'shared', 'audio');
// Calibration thresholds (only fixed numbers allowed — acoustic, not language facts).
const T = { silenceRms: 0.004, clipFrac: 0.02, minDur: 0.2, maxDur: 20 };

// Voice set + language derivation, all from lang-profiles (no literals).
const voicesFor = (lang) => (AppLangProfiles.get(lang)?.voices) || null;
const allVoices = new Set(AppLangProfiles.codes().flatMap((c) => voicesFor(c) || []));
const langForTop = (top) => (top.includes('-') ? top.split('-')[1] : top);  // pair→target, else the lang dir

function parseWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let off = 12, fmt = null, dataOff = -1, declared = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), sz = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    else if (id === 'data') { dataOff = off + 8; declared = sz; break; }
    off += 8 + sz + (sz % 2);
  }
  if (!fmt || dataOff < 0) return null;
  const dataLen = Math.min(declared, buf.length - dataOff);   // header size is sometimes a placeholder
  return { fmt, dataOff, dataLen };
}

// RMS + clip fraction + true duration over 16-bit PCM (decimated to ~20k samples).
function analyze(buf, w) {
  const { fmt, dataOff, dataLen } = w;
  const dur = dataLen / (fmt.rate * fmt.channels * (fmt.bits / 8));
  if (fmt.format !== 1 || fmt.bits !== 16) return { dur, pcm: false };
  const bytesPerSample = 2 * fmt.channels, total = Math.floor(dataLen / bytesPerSample);
  const stride = Math.max(1, Math.floor(total / 20000)) * bytesPerSample;
  let n = 0, sumSq = 0, clip = 0;
  for (let i = dataOff; i + 1 < dataOff + dataLen && i + 1 < buf.length; i += stride) {
    const s = buf.readInt16LE(i) / 32768;
    sumSq += s * s; n++;
    if (Math.abs(s) >= 0.999) clip++;
  }
  return { dur, pcm: true, rms: Math.sqrt(sumSq / (n || 1)), clipFrac: clip / (n || 1) };
}

// Walk shared/audio → files grouped by (dir, baseSlug); flag signal + voice issues.
const issues = [];
const flag = (rel, rule, msg) => issues.push({ rel, rule, msg });
const groups = new Map();  // "dir\0slug" → { lang, dir, voices:Set }

let scanned = 0;
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith('.wav')) continue;
    scanned++;
    const relDir = dir.slice(AUDIO.length + 1).split(/[\\/]/);
    const lang = langForTop(relDir[0]);
    const rel = `${relDir.join('/')}/${e.name}`;
    // signal
    const buf = readFileSync(p);
    const w = parseWav(buf);
    if (!w) { flag(rel, 'corrupt', 'no es un WAV PCM válido'); continue; }
    const a = analyze(buf, w);
    if (a.dur < T.minDur || a.dur > T.maxDur) flag(rel, 'duration', `duración ${a.dur.toFixed(2)}s fuera de [${T.minDur}, ${T.maxDur}]`);
    if (a.pcm && a.rms < T.silenceRms) flag(rel, 'silent', `casi en silencio (rms ${a.rms.toFixed(4)})`);
    if (a.pcm && a.clipFrac > T.clipFrac) flag(rel, 'clipped', `recortado (${(a.clipFrac * 100).toFixed(1)}% al tope)`);
    // voice grouping
    const voice = [...allVoices].find((v) => e.name.endsWith(`-${v}.wav`));
    if (!voice) { flag(rel, 'voice', 'sufijo de voz desconocido'); continue; }
    const slug = basename(e.name, `-${voice}.wav`);
    const key = relDir.join('/') + '\0' + slug;
    if (!groups.has(key)) groups.set(key, { lang, dir: relDir.join('/'), slug, voices: new Set() });
    groups.get(key).voices.add(voice);
  }
})(AUDIO);

// Voice-set completeness per slug (must equal exactly the language's declared voices).
for (const g of groups.values()) {
  const expected = voicesFor(g.lang);
  if (!expected) { flag(`${g.dir}/${g.slug}`, 'voice', `idioma "${g.lang}" sin voces en lang-profiles`); continue; }
  const missing = expected.filter((v) => !g.voices.has(v));
  const extra = [...g.voices].filter((v) => !expected.includes(v));
  if (missing.length) flag(`${g.dir}/${g.slug}`, 'voice', `faltan voces: ${missing.join(', ')}`);
  if (extra.length) flag(`${g.dir}/${g.slug}`, 'voice', `voces inesperadas para ${g.lang}: ${extra.join(', ')}`);
}

if (issues.length === 0) { console.log(`✓ check-audio: ${scanned} wav, ${groups.size} slugs — ALL CLEAR`); process.exit(0); }
const byRule = {};
for (const i of issues) (byRule[i.rule] ||= []).push(i);
console.log(`✗ check-audio: ${issues.length} problemas (${scanned} wav)\n`);
for (const rule of Object.keys(byRule).sort()) {
  console.log(`── ${rule} (${byRule[rule].length}) ──`);
  for (const i of byRule[rule].slice(0, 15)) console.log(`  ${i.rel}: ${i.msg}`);
  if (byRule[rule].length > 15) console.log(`  … +${byRule[rule].length - 15} más`);
  console.log('');
}
process.exit(1);
