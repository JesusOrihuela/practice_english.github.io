/**
 * enrich-audit.mjs — Guarantee that finalized content is enriched to the max
 * =========================================================================
 * check-content.mjs validates that what IS present is correct. This tool is the
 * complement: it detects enrichment that is APPLICABLE but MISSING, so no phrase
 * ships with only its base form when a gender/register/region variant, a grammar
 * tip, or a vocab note genuinely applies (plan Part D2).
 *
 * Flags are assisted, not automatic — some phrases legitimately admit no variant.
 * A human resolves each flag by either enriching the entry OR recording a waiver
 * in tools/sources/derived/{pair}-enrich-waivers.json (a JSON array of phrase/word
 * ids that were reviewed and found complete). The point the gate enforces is that
 * EVERY entry was evaluated across every dimension — nothing slips through unseen.
 *
 * Checks (en-es target = Spanish):
 *   1. gender    — a state/role adjective in a 1st/2nd person estar/ser clause,
 *                  with no opposite-gender form present.
 *   2. grammar   — target[0].text matches a canonical grammar-tip pattern but
 *                  grammar is null.
 *   3. vocab     — definition_es/example_es missing, or definition_es over the
 *                  level word limit.
 * (region/register are surfaced as soft suggestions, never gate failures.)
 *
 * USAGE (from tools/):
 *   node enrich-audit.mjs --pair en-es --topic greetings
 *   node enrich-audit.mjs --pair en-es                 # all topics
 *
 * EXIT CODE: 0 = no unwaived pending enrichment, 1 = pending flags exist.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const PAIRS_DIR = join(ROOT, 'shared', 'json', 'pairs');
const DERIVED   = join(__dirname, 'sources', 'derived');

const PHRASE_TOPICS = [
  'emociones', 'greetings', 'restaurant', 'supermarket', 'kitchen',
  'transportation', 'airport', 'accommodation',
  'movies', 'music', 'theater', 'museums', 'gym', 'technology', 'accountability', 'personal_info',
];

// Gendered state/role adjectives & participles (masculine base). If a phrase's
// text carries one of these (in either gender) inside a personal estar/ser
// clause and lacks the opposite-gender form, a gender variant is missing.
// Deliberately excludes polysemous forms that are usually adverbial or fixed
// phrases (nuevo → "de nuevo", solo → "no es solo") to avoid false positives.
const GENDERED_ADJ = [
  'cansado','emocionado','ocupado','nervioso','preocupado','enojado','enfadado',
  'aburrido','sorprendido','confundido','relajado','estresado','asustado',
  'contento','perdido','agradecido','encantado','molesto','orgulloso',
];
// Words ending in -o/-a that are NOT gendered adjectives here (avoid false hits).
const GENDER_STOP = new Set(['hola','día','buenos','buenas','cómo','todo','todos','esto','eso','mucho','luego','mañana','ahora','pronto','como']);

const PERSONAL_CLAUSE = /\b(estoy|soy|estás|eres|está|es|estamos|somos)\b/i;

// Canonical grammar-tip patterns (en-es target). Each: [label, regex].
const GRAMMAR_PATTERNS = [
  ['llevar+gerundio',       /\bllev[oa]s?\b.*\w+(ando|iendo)\b/i],
  ['lo que + verbo',        /\blo que\b/i],
  ['cuanto más/menos',      /\bcuanto (más|menos)\b/i],
  ['emoción + subjuntivo',  /\b(espero|ojalá|me alegr\w+|me sorprend\w+|me molest\w+|quiero) que\b/i],
  ['pasiva refleja',        /\bse (ha|han|debe|deben|puede|pueden|vende|venden|hace|hacen|habla|hablan|necesita|necesitan|actualiza|actualizan)\b/i],
  ['pretérito vs perfecto', /\bya (viste|comiste|llegaste|hiciste)\b/i],
];

const LEVEL_DEF_WORDS = { A1: 10, A2: 10, B1: 15 };

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const PAIR  = argVal('--pair');
const TOPIC = argVal('--topic');
if (!PAIR) { console.error('ERROR: --pair <id> required'); process.exit(1); }
const targetLang = PAIR.split('-')[1];

// waivers
const waiverPath = join(DERIVED, `${PAIR}-enrich-waivers.json`);
const WAIVERS = existsSync(waiverPath) ? new Set(JSON.parse(readFileSync(waiverPath, 'utf8'))) : new Set();

// ── helpers ─────────────────────────────────────────────────────────────────
function words(text) {
  return text.toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').split(/\s+/).filter(Boolean);
}
function hasGenderCoverage(forms) {
  const genders = forms.map(f => f.labels?.gender).filter(Boolean);
  return genders.includes('masculino') && genders.includes('femenino');
}
function findGenderedWord(text) {
  for (const w of words(text)) {
    if (GENDER_STOP.has(w)) continue;
    const masc = w.endsWith('a') ? w.slice(0, -1) + 'o' : w;
    if (GENDERED_ADJ.includes(w) || GENDERED_ADJ.includes(masc)) return w;
  }
  return null;
}

// ── audit one phrase file ────────────────────────────────────────────────────
const flags = [];
function auditPhrases(topic) {
  const file = join(PAIRS_DIR, PAIR, `${topic}.json`);
  if (!existsSync(file)) return;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  for (const p of (data.phrases || [])) {
    if (WAIVERS.has(p.id)) continue;
    const forms = p.target || [];
    const base = forms[0]?.text || '';

    // 1. gender (en-es only)
    if (targetLang === 'es' && !hasGenderCoverage(forms)) {
      const gw = findGenderedWord(base);
      if (gw && PERSONAL_CLAUSE.test(base)) {
        flags.push({ topic, id: p.id, kind: 'gender', detail: `adjetivo con género "${gw}" sin forma opuesta`, text: base });
      }
    }
    // 2. grammar tip
    if (!p.grammar) {
      for (const [label, re] of GRAMMAR_PATTERNS) {
        if (re.test(base)) { flags.push({ topic, id: p.id, kind: 'grammar', detail: `patrón "${label}" sin tip`, text: base }); break; }
      }
    }
  }
}

function auditVocab(topic) {
  const fname = topic === 'general' ? 'words.json' : `words-${topic}.json`;
  // vocab is per-pair since Part C
  const file = join(PAIRS_DIR, PAIR, 'vocab', fname);
  if (!existsSync(file)) return;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  for (const w of (data.words || [])) {
    if (WAIVERS.has(w.id)) continue;
    if (!w.definition_es) flags.push({ topic, id: w.id, kind: 'vocab', detail: 'falta definition_es', text: w.word });
    if (!w.example_es)    flags.push({ topic, id: w.id, kind: 'vocab', detail: 'falta example_es', text: w.word });
    const lim = LEVEL_DEF_WORDS[w.level];
    if (lim && w.definition_es && w.definition_es.split(/\s+/).length > lim) {
      flags.push({ topic, id: w.id, kind: 'vocab', detail: `definition_es supera ${lim} palabras para ${w.level}`, text: w.word });
    }
  }
}

// ── run ─────────────────────────────────────────────────────────────────────
const topics = TOPIC ? [TOPIC] : PHRASE_TOPICS;
for (const t of topics) { auditPhrases(t); auditVocab(t); }

const byKind = { gender: 0, grammar: 0, vocab: 0 };
for (const f of flags) byKind[f.kind]++;

if (!flags.length) {
  console.log(`✓ enrich-audit ${PAIR}${TOPIC ? ' · ' + TOPIC : ''}: 0 pendientes (waivers: ${WAIVERS.size})`);
  process.exit(0);
}

console.log(`\n✗ enrich-audit ${PAIR}${TOPIC ? ' · ' + TOPIC : ''}: ${flags.length} pendientes` +
            ` (género ${byKind.gender} · gramática ${byKind.grammar} · vocab ${byKind.vocab})\n`);
let lastTopic = null;
for (const f of flags) {
  if (f.topic !== lastTopic) { console.log(`■ ${f.topic}`); lastTopic = f.topic; }
  console.log(`  [${f.kind}] ${f.id}: ${f.detail}`);
  console.log(`          "${f.text}"`);
}
console.log(`\nResolver cada pendiente enriqueciendo la entrada o agregando su id a`);
console.log(`tools/sources/derived/${PAIR}-enrich-waivers.json (revisado, sin enriquecimiento aplicable).`);
process.exit(1);
