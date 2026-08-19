/* ============================================================
   check-length.mjs — Phrase length & run-on advisory (Rule 5+).

   A phrase must be ONE idea, short enough to hold in working memory — this matters MOST for
   Dictation, where the learner transcribes from audio WITHOUT seeing the text (pure phonological
   loop). Evidence: A1-A2 sentences average < ~10 words, B1-B2 ~10-16; long sentences raise
   cognitive load (Baddeley phonological loop ~2 s; graded-reader/readability research).

   Checks target[0].text of every phrase, per CEFR level:
     • words  — max words (primary limit)
     • chars  — max characters (catches dense phrases within the word limit)
     • run-on — a comma joining independent clauses (comma + clause connector, or ≥2 commas):
                a phrase that is really several phrases glued together, not one idea.

   RULE: a phrase must satisfy BOTH the word limit AND the character limit (and not be a run-on)
   for its CEFR level — both must pass, not either. New/edited phrases must comply.
   Currently advisory: exits 0 by default (does NOT fail CI while the existing backlog is fixed);
   pass --gate to exit 1 on any violation (wire into CI once the content is clean).

   Usage:  node tools/check-length.mjs          # report
           node tools/check-length.mjs --gate   # fail on any violation
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');
const GATE = process.argv.includes('--gate');

// Calibrated from the working-memory / graded-reader evidence (see header). words = primary;
// chars ≈ words × ~6.5 (Spanish/English incl. spaces), trimmed to discourage dense phrasing.
const LIMITS = {
  A1: { words: 9,  chars: 60 },
  A2: { words: 10, chars: 65 },
  B1: { words: 12, chars: 78 },
  B2: { words: 14, chars: 90 },
  C1: { words: 16, chars: 100 },
  C2: { words: 18, chars: 110 },
};

// A comma directly joining another clause → likely two phrases glued into one (comma splice /
// run-on). Connectors that typically start an independent/relative clause after a comma.
const RUNON_CONNECTOR =
  /,\s*(which|who|and then|but |so |however|because|although|while|,|lo que|pero |sino |pues |aunque |mientras |porque |así que|por lo que|que |y )/i;

function isRunOn(text) {
  const commas = (text.match(/,/g) || []).length;
  // A comma directly followed by a clause connector = two clauses glued together. (≥2 commas
  // alone is NOT flagged: natural short phrases — "Muy bien, gracias, ¿y tú?" — use commas as
  // pauses, not clause joins. Only ≥3 commas, a strong signal of several ideas, is flagged.)
  if (commas >= 1 && RUNON_CONNECTOR.test(text)) return 'comma + clause connector — likely a run-on';
  if (commas >= 3) return 'many commas (≥3) — likely several ideas';
  return null;
}

const findings = [];
for (const pair of fs.readdirSync(PAIRS_DIR)) {
  const dir = path.join(PAIRS_DIR, pair);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || ['grammar-rules.json', 'placement.json', 'topics.json'].includes(f)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const p of (data.phrases || [])) {
      const text = p.target?.[0]?.text || '';
      const level = p.level;
      const lim = LIMITS[level];
      if (!text || !lim) continue;
      const words = text.split(/\s+/).filter(Boolean).length;
      const chars = text.length;
      const flags = [];
      if (words > lim.words) flags.push(`words ${words}/${lim.words}`);
      if (chars > lim.chars) flags.push(`chars ${chars}/${lim.chars}`);
      const ro = isRunOn(text);
      if (ro) flags.push(`run-on: ${ro}`);
      if (flags.length) findings.push({ pair, topic: f.replace('.json', ''), id: p.id, level, flags, text });
    }
  }
}

// Report, grouped by flag kind.
const byKind = { words: 0, chars: 0, 'run-on': 0 };
for (const x of findings) for (const fl of x.flags) {
  if (fl.startsWith('words')) byKind.words++;
  else if (fl.startsWith('chars')) byKind.chars++;
  else byKind['run-on']++;
}
findings.sort((a, b) => b.text.length - a.text.length);
console.log(`Longitud/run-on — ${findings.length} frase(s) marcada(s)  ` +
  `(over-words ${byKind.words}, over-chars ${byKind.chars}, run-on ${byKind['run-on']})`);
for (const x of findings) {
  console.log(`  [${x.pair} ${x.topic} ${x.level}] ${x.id}\n     ${x.flags.join(' · ')}\n     "${x.text}"`);
}
if (!findings.length) console.log('  ✓ todo dentro de límites.');

if (GATE && findings.length) {
  console.log(`\n✗ ${findings.length} violación(es) de longitud/run-on.`);
  process.exit(1);
}
