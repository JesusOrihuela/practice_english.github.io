/* ============================================================
   check-variants.mjs — Variant-completeness detector (advisory).

   The RULE (feedback_regional_variants_complete): if a phrase uses a word that VARIES by
   region, every regional variant that genuinely exists must be present. check-content only
   validates that EXISTING variants are well-formed; it cannot find phrases that are MISSING
   variants. This tool does: driven by a curated LEXICON of region-variable term-sets (with
   provenance), it scans every phrase's target forms and flags:

     • MISSING — a phrase uses one member of a variant set but does not offer the others
       (e.g. "carro" without "coche"/"auto"; "movie" without "film").
     • the provenance (which countries each variant covers) so the curator can label correctly.

   It is the front-(2) audit instrument, analogous to check-length for front (1). Advisory:
   exits 0 by default (curate the flagged phrases); --gate to fail once the backlog is closed.

   The LEXICON is a curated, committeable asset (like NGSL/PCIC for coverage). Extend it with
   more region-variable everyday terms as content grows; add a language block for a new target.

   Usage:  node tools/check-variants.mjs           # report
           node tools/check-variants.mjs --gate     # fail on any finding
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');
const GATE = process.argv.includes('--gate');

// A variant SET = the same meaning across regions. Each member: the word(s) (lowercased,
// matched as whole words), the region LABEL to use, and the countries it covers (provenance).
// Only include genuine region splits of everyday vocabulary. `neutralLabel` groups pan-regional
// members (e.g. "Latinoamérica") so a two-way split reads cleanly.
const LEXICON = {
  es: [
    { name: 'car',        members: [
      { words: ['coche'],  label: 'España',        countries: ['es'] },
      { words: ['carro'],  label: 'Latinoamérica', countries: ['mx', 'co', 've'] },
      { words: ['auto'],   label: 'Cono Sur',      countries: ['ar', 'cl', 'uy'] } ] },
    { name: 'cellphone',  members: [
      { words: ['móvil'],   label: 'España',        countries: ['es'] },
      { words: ['celular'], label: 'Latinoamérica', countries: ['mx', 'ar', 'co'] } ] },
    { name: 'computer',   members: [
      { words: ['ordenador'],   label: 'España',        countries: ['es'] },
      { words: ['computadora', 'computador'], label: 'Latinoamérica', countries: ['mx', 'ar', 'co'] } ] },
    { name: 'potato',     members: [
      { words: ['patata', 'patatas'], label: 'España',        countries: ['es'] },
      { words: ['papa', 'papas'],     label: 'Latinoamérica', countries: ['mx', 'ar', 'co'] } ] },
    { name: 'avocado',    members: [
      { words: ['aguacate'], label: 'México/España',  countries: ['mx', 'co', 've', 'es'] },
      { words: ['palta'],    label: 'Sudamérica',     countries: ['ar', 'cl', 'pe', 'bo', 'uy'] } ] },
    { name: 'fridge',     members: [
      { words: ['nevera', 'frigorífico'], label: 'España',        countries: ['es'] },
      { words: ['refrigerador', 'heladera'], label: 'Latinoamérica', countries: ['mx', 'ar'] } ] },
    { name: 'juice',      members: [
      { words: ['zumo'], label: 'España',        countries: ['es'] },
      { words: ['jugo'], label: 'Latinoamérica', countries: ['mx', 'ar', 'co'] } ] },
    { name: 'pool',       members: [
      { words: ['piscina'], label: 'España/general', countries: ['es', 'co'] },
      { words: ['alberca'], label: 'México',         countries: ['mx'] },
      { words: ['pileta'],  label: 'Río de la Plata', countries: ['ar', 'uy'] } ] },
    { name: 'bus',        members: [
      { words: ['autobús'],  label: 'España',        countries: ['es'] },
      { words: ['camión'],   label: 'México',        countries: ['mx'] },
      { words: ['colectivo'], label: 'Argentina',    countries: ['ar'] } ] },
    { name: 'cake',       members: [
      { words: ['tarta'],           label: 'España',        countries: ['es'] },
      { words: ['pastel', 'torta'], label: 'Latinoamérica', countries: ['mx', 'ar', 'co'] } ] },
  ],
  en: [
    { name: 'film',     members: [
      { words: ['movie', 'movies'], label: 'US', countries: ['us'] },
      { words: ['film', 'films'],   label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'fries',    members: [
      { words: ['fries'], label: 'US', countries: ['us'] },
      { words: ['chips'], label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'bill',     members: [
      { words: ['check'], label: 'US', countries: ['us'] },
      { words: ['bill'],  label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'cart',     members: [
      { words: ['cart', 'carts'],       label: 'US', countries: ['us'] },
      { words: ['trolley', 'trolleys'], label: 'UK', countries: ['gb', 'au', 'nz'] } ] },
    { name: 'aluminum', members: [
      { words: ['aluminum'],  label: 'US', countries: ['us'] },
      { words: ['aluminium'], label: 'UK', countries: ['gb', 'au', 'nz'] } ] },
    { name: 'gas',      members: [
      { words: ['gasoline'], label: 'US', countries: ['us'] },
      { words: ['petrol'],   label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'elevator', members: [
      { words: ['elevator'], label: 'US', countries: ['us'] },
      { words: ['lift'],     label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'apartment', members: [
      { words: ['apartment'], label: 'US', countries: ['us'] },
      { words: ['flat'],      label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'vacation', members: [
      { words: ['vacation'], label: 'US', countries: ['us'] },
      { words: ['holiday'],  label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'truck',    members: [
      { words: ['truck'], label: 'US', countries: ['us'] },
      { words: ['lorry'], label: 'UK', countries: ['gb'] } ] },
    { name: 'grocery',  members: [
      { words: ['grocery'],  label: 'US', countries: ['us'] },
      { words: ['shopping'], label: 'UK', countries: ['gb', 'au', 'nz'] } ] },
    { name: 'rent',     members: [
      { words: ['rent'], label: 'US', countries: ['us'] },
      { words: ['hire'], label: 'UK', countries: ['gb', 'au', 'nz'] } ] },
  ],
};

const wordRe = (w) => new RegExp('(^|[^\\p{L}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'iu');

function memberInText(member, text) {
  return member.words.some(w => wordRe(w).test(text));
}

const findings = [];
for (const pair of fs.readdirSync(PAIRS_DIR)) {
  const dir = path.join(PAIRS_DIR, pair);
  if (!fs.statSync(dir).isDirectory()) continue;
  const lang = pair.split('-')[1];
  const lex = LEXICON[lang];
  if (!lex) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || ['grammar-rules.json', 'placement.json', 'topics.json'].includes(f)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const p of (data.phrases || [])) {
      const forms = (p.target || []);
      const allText = forms.map(t => t.text || '').join('  ');
      for (const set of lex) {
        // Which members' words appear anywhere in the phrase's forms?
        const present = set.members.filter(m => memberInText(m, allText));
        if (present.length === 0) continue;
        // Which members are MISSING (their word never appears in any form)?
        const missing = set.members.filter(m => !present.includes(m));
        if (missing.length > 0) {
          findings.push({
            pair, topic: f.replace('.json', ''), id: p.id, set: set.name,
            has: present.map(m => m.label).join('/'),
            missing: missing.map(m => `${m.words[0]} [${m.label}: ${m.countries.join(',')}]`).join('  '),
          });
        }
      }
    }
  }
}

findings.sort((a, b) => (a.pair + a.topic).localeCompare(b.pair + b.topic));
console.log(`Completitud de variantes — ${findings.length} frase(s) a las que les FALTAN variantes regionales:`);
for (const x of findings) {
  console.log(`  [${x.pair} ${x.topic}] ${x.id}  (set: ${x.set}; tiene: ${x.has})`);
  console.log(`     faltan: ${x.missing}`);
}
if (!findings.length) console.log('  ✓ todas las frases con términos región-variables ofrecen sus variantes.');

if (GATE && findings.length) { console.log(`\n✗ ${findings.length} frase(s) con variantes incompletas.`); process.exit(1); }
