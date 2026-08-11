/* ============================================================
   grammar-topics.mjs — derive each grammar rule's `topics` field from
   ACTUAL phrase evidence, so the premise holds: a rule is tagged with a
   topic only if that topic has phrases exercising the structure.

   For each rule a detector matches the target-language structure in the
   phrases; the rule's topics become the topics with the most matches
   (≥ MIN_HITS, top MAX_TOPICS). Rules whose structure appears in no phrase
   get an empty list (correctly → n/a in the Exercise Summary).

   Usage:
     node tools/grammar-topics.mjs --check         # report drift, exit 1 if any
     node tools/grammar-topics.mjs --write          # rewrite grammar-rules.json
     node tools/grammar-topics.mjs --pair en-es ... # limit to one pair
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DETECTORS } from './lang-detectors.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ONLY_PAIR = args.includes('--pair') ? args[args.indexOf('--pair') + 1] : null;
const MIN_HITS = 2;      // a topic needs ≥ this many matching phrases to be tagged
const MAX_TOPICS = Infinity; // no cap: tag EVERY topic whose phrases exercise it (the premise)

// Detectors are keyed by TARGET language (shared/tools registry lang-detectors.mjs),
// so any pair learning that language reuses them. Pair id is `source-target`, so
// the target code is the segment after the dash.
const detectorsForPair = (pairId) => DETECTORS[pairId.split('-')[1]];

// Language pairs to check: discovered from the content tree (every dir with a
// grammar-rules.json), so a new pair flows in automatically.
function discoverPairs() {
  const dir = `${ROOT}/shared/json/pairs`;
  return fs.readdirSync(dir).filter(p =>
    fs.existsSync(`${dir}/${p}/grammar-rules.json`) && fs.existsSync(`${dir}/${p}/topics.json`));
}


const CURATED = new Set(['gender_nouns_articles', 'gender_adjective_agreement']);

function verifyPair(pair) {
  const det = detectorsForPair(pair);
  if (!det) return { pair, changes: [], skipped: true };
  const topicsMeta = JSON.parse(fs.readFileSync(`${ROOT}/shared/json/pairs/${pair}/topics.json`, 'utf8')).topics.filter(t => t.phrase);
  const phrasesByTopic = {};
  for (const t of topicsMeta) {
    const d = JSON.parse(fs.readFileSync(`${ROOT}/shared/json/pairs/${pair}/${t.id}.json`, 'utf8'));
    phrasesByTopic[t.id] = (d.phrases || []).map(p => ({ id: p.id, text: p.target.map(f => f.text).join(' ') }));
  }
  const rulesFile = `${ROOT}/shared/json/pairs/${pair}/grammar-rules.json`;
  const data = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
  const changes = [];
  const phraseRules = {};   // phraseId → [ruleId]  (every rule this phrase exercises)
  for (const r of data.rules) {
    if (CURATED.has(r.id)) continue;                    // keep hand-curated
    const d = det[r.id];
    if (!d) { changes.push({ id: r.id, note: 'NO DETECTOR (kept)', keep: true }); continue; }
    const hits = [];                                    // [topicId, matchCount] for rule.topics
    for (const [tid, phrases] of Object.entries(phrasesByTopic)) {
      let n = 0;
      for (const p of phrases) {
        if (d.test(p.text)) { n++; (phraseRules[p.id] ||= []).push(r.id); }
      }
      if (n >= MIN_HITS) hits.push([tid, n]);
    }
    hits.sort((a, b) => b[1] - a[1]);
    const newTopics = hits.slice(0, MAX_TOPICS).map(([t]) => t);
    const old = Array.isArray(r.topics) ? r.topics : [];
    const same = old.length === newTopics.length && old.every(t => newTopics.includes(t));
    if (!same) changes.push({ id: r.id, old, now: newTopics, evidence: hits.slice(0, MAX_TOPICS) });
    r.topics = newTopics;
  }
  // Deterministic order for stable diffs / --check comparison.
  const map = {};
  for (const id of Object.keys(phraseRules).sort()) map[id] = phraseRules[id].slice().sort();
  const mapFile = `${ROOT}/shared/json/pairs/${pair}/grammar-phrase-rules.json`;
  const mapNow = JSON.stringify(map, null, 0);
  const mapOld = fs.existsSync(mapFile) ? JSON.stringify(JSON.parse(fs.readFileSync(mapFile, 'utf8')), null, 0) : '';
  if (mapNow !== mapOld) changes.push({ id: '(grammar-phrase-rules.json)', mapDrift: true });
  if (WRITE) {
    fs.writeFileSync(rulesFile, JSON.stringify(data, null, 2) + '\n');
    fs.writeFileSync(mapFile, JSON.stringify(map, null, 2) + '\n');
  }
  return { pair, changes };
}

const pairs = ONLY_PAIR ? [ONLY_PAIR] : discoverPairs();
let drift = 0;
for (const pair of pairs) {
  const res = verifyPair(pair);
  if (res.skipped) { console.log(`(${pair}: sin detectores — omitido)`); continue; }
  console.log(`\n=== ${pair} ===`);
  for (const c of res.changes) {
    if (c.keep) continue;
    drift++;
    if (c.mapDrift) { console.log(`  ${c.id.padEnd(30)} el mapa por-frase difiere de la evidencia`); continue; }
    console.log(`  ${c.id.padEnd(30)} ${JSON.stringify(c.old)} → ${JSON.stringify(c.now)}` +
                (c.evidence ? `  (evidencia: ${c.evidence.map(e => e[0] + ':' + e[1]).join(', ')})` : ''));
  }
  if (!res.changes.some(c => !c.keep)) console.log('  (sin cambios — tags coinciden con la evidencia)');
}
if (!WRITE && drift > 0) {
  console.log(`\n✗ ${drift} regla(s) con tags que no coinciden con la evidencia. Corre con --write.`);
  process.exit(1);
} else if (WRITE) {
  console.log(`\n✓ escrito. ${drift} regla(s) actualizada(s).`);
} else {
  console.log('\n✓ todos los tags coinciden con la evidencia de las frases.');
}
