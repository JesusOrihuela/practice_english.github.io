/* ============================================================
   move-item.mjs — Move a phrase or vocab entry between categories, safely.

   Formalizes the JSON-move + id-reprefix + slug-based audio relocation so cleanup
   (the semantic-audit triage, plan §E) is repeatable instead of ad-hoc scripts.
   Moving does NOT regenerate audio (it relocates the existing WAVs by slug) and does
   NOT change the practiced/target text, so coverage is unaffected. After moving, the
   CALLER runs the normal pipeline:
     node tools/grammar-topics.mjs --write && node tools/fix-phrase-ids.js && \
     node tools/check-content.mjs && node tools/audit.mjs

   Usage (from repo root):
     # phrase: pair + from-topic + to-topic + phrase id
     node tools/move-item.mjs --kind phrase --pair es-en --from cotidianidad --to oficina --id cotidianidad_please_fill_the_form
     # vocab: target lang + from-deck + to-deck + word id
     node tools/move-item.mjs --kind vocab --lang es --from objetos --to naturaleza --id piedra
   Add --dry to preview without writing.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry');
const KIND = val('--kind'), FROM = val('--from'), TO = val('--to'), ID = val('--id');
const PAIR = val('--pair'), LANG = val('--lang');

function die(m) { console.error('ERROR: ' + m); process.exit(1); }
if (!KIND || !FROM || !TO || !ID) die('--kind, --from, --to, --id required');

function relocateAudio(dirFrom, dirTo, matchers) {
  if (!fs.existsSync(dirFrom)) return 0;
  if (!DRY && !fs.existsSync(dirTo)) fs.mkdirSync(dirTo, { recursive: true });
  let n = 0;
  for (const w of fs.readdirSync(dirFrom))
    if (w.endsWith('.wav') && matchers.some(m => w.startsWith(m + '-'))) {
      if (!DRY) fs.renameSync(path.join(dirFrom, w), path.join(dirTo, w));
      n++;
    }
  return n;
}

if (KIND === 'phrase') {
  if (!PAIR) die('phrase move needs --pair');
  const fromFile = path.join(ROOT, `shared/json/pairs/${PAIR}/${FROM}.json`);
  const toFile = path.join(ROOT, `shared/json/pairs/${PAIR}/${TO}.json`);
  const from = JSON.parse(fs.readFileSync(fromFile, 'utf8'));
  const to = JSON.parse(fs.readFileSync(toFile, 'utf8'));
  const idx = from.phrases.findIndex(p => p.id === ID);
  if (idx < 0) die(`phrase "${ID}" not found in ${PAIR}/${FROM}`);
  const ph = from.phrases[idx];
  const newId = ph.id.startsWith(FROM + '_') ? TO + '_' + ph.id.slice(FROM.length + 1) : ph.id;
  if (to.phrases.some(p => p.id === newId)) die(`destination already has id "${newId}"`);
  const slugs = (ph.target || []).map(t => t.audioSlug).filter(Boolean);
  const nAudio = relocateAudio(path.join(ROOT, `shared/audio/${PAIR}/${FROM}`), path.join(ROOT, `shared/audio/${PAIR}/${TO}`), slugs);
  if (!DRY) {
    ph.id = newId;
    from.phrases.splice(idx, 1);
    to.phrases.push(ph);
    fs.writeFileSync(fromFile, JSON.stringify(from, null, 2) + '\n');
    fs.writeFileSync(toFile, JSON.stringify(to, null, 2) + '\n');
  }
  console.log(`${DRY ? '[dry] ' : ''}${PAIR}: ${FROM}/${ID} → ${TO}/${newId}  (audio ${nAudio})`);
} else if (KIND === 'vocab') {
  if (!LANG) die('vocab move needs --lang');
  const fF = (d) => path.join(ROOT, `shared/json/vocab/${LANG}/${d === 'general' ? 'words.json' : 'words-' + d + '.json'}`);
  const fromFile = fF(FROM), toFile = fF(TO);
  const from = JSON.parse(fs.readFileSync(fromFile, 'utf8'));
  const to = JSON.parse(fs.readFileSync(toFile, 'utf8'));
  const idx = from.words.findIndex(w => w.id === ID);
  if (idx < 0) die(`word "${ID}" not found in vocab/${LANG}/${FROM}`);
  if (to.words.some(w => w.id === ID)) die(`destination deck already has id "${ID}"`);
  const w = from.words[idx];
  const nAudio = relocateAudio(path.join(ROOT, `shared/audio/${LANG}/vocab_${FROM}`), path.join(ROOT, `shared/audio/${LANG}/vocab_${TO}`), [ID]);
  if (!DRY) {
    from.words.splice(idx, 1);
    to.words.push(w);
    fs.writeFileSync(fromFile, JSON.stringify(from, null, 2) + '\n');
    fs.writeFileSync(toFile, JSON.stringify(to, null, 2) + '\n');
  }
  console.log(`${DRY ? '[dry] ' : ''}vocab/${LANG}: ${FROM}/${ID} → ${TO}/${ID}  (audio ${nAudio})`);
} else die('--kind must be phrase or vocab');

if (!DRY) console.log('Ahora corre: node tools/grammar-topics.mjs --write && node tools/fix-phrase-ids.js && node tools/check-content.mjs && node tools/audit.mjs');
