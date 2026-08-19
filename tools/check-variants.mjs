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

   LEXICON SOURCING RULE (authoritative, like PCIC/NGSL for coverage) — the region provenance
   (which countries use each variant) MUST come from an authoritative reference, not a guess:
     • Spanish → **Diccionario de americanismos (ASALE)** — https://www.asale.org/damer/<term> —
       which marks each sense with its countries (Mx, Ar, Ch, Pe, Bo, Ur, Co, Ve…); Spain usage
       from the DLE (dle.rae.es). Cite in CREDITS.md.
     • English → the US/UK/AU marks of standard dictionaries (Oxford/Cambridge) and the
       documented British-vs-American vocabulary comparisons.
     • A NEW target language → that language's authoritative dialectal/regional dictionary.
   NOTE: the country lists below are a working seed and must be VERIFIED against DAMER/DLE (the
   fetch is feasible — see tools/damer-provenance if present) before the front-(2) curation is
   final. Gender is GRAMMATICAL (not sourced) — its detection is rule-based below.

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

// Gendered PREDICATE terms (Spanish) — GRAMMATICAL, not dialectal. A phrase describing the
// SPEAKER/ADDRESSEE with one of these should offer both gender forms (Rule 10). Masc lemma;
// matched in -o/-a(/-s) form inside a 1st/2nd-person predicate ("estoy/soy/estás/eres … -o/-a").
const GENDER_ES = [
  'cansado', 'contento', 'enfermo', 'listo', 'seguro', 'nervioso', 'preocupado', 'emocionado',
  'aburrido', 'ocupado', 'perdido', 'asustado', 'enojado', 'molesto', 'sorprendido', 'orgulloso',
  'agradecido', 'encantado', 'resfriado', 'mareado', 'casado', 'soltero', 'divorciado',
  'enfermero', 'maestro', 'ingeniero', 'profesor', 'abogado', 'cocinero', 'camarero',
  'director', 'gerente', 'vendedor', 'arquitecto', 'dueño',
];
// 1st/2nd-person SINGULAR predicate only: there the speaker/addressee's gender is inherently
// variable (→ needs both forms). 3rd person ("es/está + noun") is excluded — a noun subject
// fixes the gender ("ese muchacho es listo" is not variable).
const GENDER_COPULA = /\b(estoy|soy|est[aá]s|eres|me siento|te ves|ser[eé]|seas|est[eé]s|quiero ser|quieres ser|voy a ser|vas a ser)\b/i;
// A gendered lemma (masc -o) as its -o/-a(/-s) forms, whole word.
const genderLemmaRe = (lemma) => {
  const stem = lemma.replace(/o$/, '');
  return new RegExp('(^|[^\\p{L}])' + stem + '[oa]s?($|[^\\p{L}])', 'iu');
};
function gestureGendered(text) {   // → the lemma matched in a personal predicate, or null
  if (!GENDER_COPULA.test(text)) return null;
  for (const lemma of GENDER_ES) if (genderLemmaRe(lemma).test(text)) return lemma;
  return null;
}
const anyRegionMember = (lex, text) => lex.some(set => set.members.some(m => memberInText(m, text)));

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
      const hasGender = forms.some(t => t.labels && t.labels.gender !== undefined);
      const hasRegion = forms.some(t => t.labels && t.labels.region !== undefined);
      const base = { pair, topic: f.replace('.json', ''), id: p.id };

      // (1) REGION completeness — a region-variable word present without all its variants.
      for (const set of lex) {
        const present = set.members.filter(m => memberInText(m, allText));
        if (!present.length) continue;
        const missing = set.members.filter(m => !present.includes(m));
        if (missing.length) findings.push({ ...base, type: 'region', set: set.name,
          has: present.map(m => m.label).join('/'),
          detail: missing.map(m => `${m.words[0]} [${m.label}: ${m.countries.join(',')}]`).join('  ') });
      }

      // (2) GENDER completeness (es) — a phrase describing the speaker/addressee with a gendered
      //     predicate, but no gender variant.
      const gLemma = lang === 'es' ? gestureGendered(allText) : null;
      if (gLemma && !hasGender) findings.push({ ...base, type: 'gender', detail: `predicado con género "${gLemma}" sin variante masculino/femenino` });

      // (3) COMBINATIONS — one dimension present, the other genuinely applies too.
      if (hasGender && !hasRegion && anyRegionMember(lex, allText))
        findings.push({ ...base, type: 'combo', detail: 'tiene GÉNERO y usa un término región-variable → falta la dimensión REGIÓN (región×género)' });
      if (hasRegion && !hasGender && gLemma)
        findings.push({ ...base, type: 'combo', detail: `tiene REGIÓN y un predicado con género ("${gLemma}") → falta la dimensión GÉNERO (región×género)` });
    }
  }
}

const order = { region: 0, gender: 1, combo: 2 };
findings.sort((a, b) => (order[a.type] - order[b.type]) || (a.pair + a.topic).localeCompare(b.pair + b.topic));
const counts = { region: 0, gender: 0, combo: 0 };
for (const x of findings) counts[x.type]++;
console.log(`Completitud de variantes — ${findings.length} hallazgo(s)  ` +
  `(región ${counts.region}, género ${counts.gender}, combinación ${counts.combo}):`);
for (const x of findings) {
  console.log(`  [${x.type.toUpperCase()}] [${x.pair} ${x.topic}] ${x.id}${x.set ? ' (set: ' + x.set + '; tiene: ' + x.has + ')' : ''}`);
  console.log(`     ${x.detail}`);
}
if (!findings.length) console.log('  ✓ todas las frases con variantes están completas (región, género y combinaciones).');

if (GATE && findings.length) { console.log(`\n✗ ${findings.length} hallazgo(s) de variantes incompletas.`); process.exit(1); }
