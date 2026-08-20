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
// PROVENANCE: `countries` come from the Diccionario de americanismos (ASALE) per-sense country
// marks — fetched with `node tools/damer-provenance.mjs <term>:<meaning>` — NOT guessed; the
// Spain/general term is España (es) from the DLE. `label` is the display region. Country codes
// with no flag asset yet (gt,hn,sv,ni,cr,pa,cu,do,pr,py,ec) are still recorded for provenance;
// the badge shows the label text alone until the flag exists (AppFlags.region → null fallback).
const LEXICON = {
  es: [
    { name: 'car',        members: [    // DAMER carro=Automóvil: us,mx,gt,hn,sv,ni,pa,cu,do,pr,co,ve,pe
      { words: ['coche'],  label: 'España',                  countries: ['es'] },
      { words: ['carro'],  label: 'América (salvo Cono Sur)', countries: ['mx', 'gt', 'hn', 'sv', 'ni', 'pa', 'cu', 'do', 'pr', 'co', 've', 'pe'] },
      { words: ['auto'],   label: 'Cono Sur',                countries: ['ar', 'cl', 'uy'] } ] },
    { name: 'cellphone',  members: [    // DAMER celular=Teléfono portátil: pan-latinoamericano (19 países)
      { words: ['móvil'],   label: 'España',        countries: ['es'] },
      { words: ['celular'], label: 'Latinoamérica', countries: ['mx', 'gt', 'hn', 'sv', 'ni', 'cr', 'pa', 'cu', 'do', 'pr', 'co', 've', 'ec', 'pe', 'bo', 'cl', 'py', 'ar', 'uy'] } ] },
    { name: 'computer',   members: [    // DAMER computador=Ordenador personal; computadora general Latam
      { words: ['ordenador'],   label: 'España',        countries: ['es'] },
      { words: ['computadora', 'computador'], label: 'Latinoamérica', countries: ['mx', 'gt', 'hn', 'sv', 'ni', 'pa', 'do', 've', 'pe', 'cl', 'co', 'ar'] } ] },
    { name: 'potato',     members: [    // DAMER papa=Tubérculo: pan-latinoamericano (19 países)
      { words: ['patata', 'patatas'], label: 'España',        countries: ['es'] },
      { words: ['papa', 'papas'],     label: 'Latinoamérica', countries: ['mx', 'gt', 'hn', 'sv', 'ni', 'cr', 'pa', 'cu', 'do', 'pr', 'co', 've', 'ec', 'pe', 'bo', 'cl', 'py', 'ar', 'uy'] } ] },
    { name: 'avocado',    members: [    // DAMER palta=Fruto del aguacate: gt,ec,pe,bo,cl,ar,uy
      { words: ['aguacate'], label: 'México y España',  countries: ['mx', 'hn', 'sv', 'ni', 'cr', 'pa', 'cu', 'do', 'pr', 'co', 've', 'es'] },
      { words: ['palta'],    label: 'Sudamérica andina y Cono Sur', countries: ['gt', 'ec', 'pe', 'bo', 'cl', 'ar', 'uy'] } ] },
    { name: 'fridge',     members: [    // DLE frigorífico=España; heladera=Río de la Plata; refrigerador general Latam
      { words: ['frigorífico'], label: 'España',        countries: ['es'] },
      { words: ['refrigerador', 'refrigeradora'], label: 'Latinoamérica', countries: ['mx', 'pe', 'cl', 'co', 've', 'ec'] },
      { words: ['heladera'], label: 'Río de la Plata', countries: ['ar', 'uy', 'py'] } ] },
    { name: 'juice',      members: [    // DLE zumo=España; jugo general Latam para bebida de fruta
      { words: ['zumo'], label: 'España',        countries: ['es'] },
      { words: ['jugo'], label: 'Latinoamérica', countries: ['mx', 'gt', 'hn', 'sv', 'ni', 'cr', 'pa', 'cu', 'do', 'pr', 'co', 've', 'ec', 'pe', 'bo', 'cl', 'py', 'ar', 'uy'] } ] },
    { name: 'pool',       members: [    // piscina neutral; DAMER alberca=Estanque mx,gt,hn,ni,pa; pileta Río de la Plata
      { words: ['piscina'], label: 'General', neutral: true, countries: ['es', 'co', 've', 'pe', 'cl', 'ec'] },
      { words: ['alberca'], label: 'México y Centroamérica', countries: ['mx', 'gt', 'hn', 'ni', 'pa'] },
      { words: ['pileta'],  label: 'Río de la Plata', countries: ['ar', 'uy', 'py'] } ] },
    { name: 'bus',        members: [    // autobús/bus neutral (panhispánico); camión=Mx, colectivo=Ar, guagua=Caribe
      { words: ['autobús', 'bus'], label: 'General', neutral: true, countries: ['es', 'co', 'pe', 've'] },
      { words: ['camión'],         label: 'México',    countries: ['mx'] },
      { words: ['colectivo'],      label: 'Argentina', countries: ['ar'] },
      { words: ['guagua'],         label: 'Caribe',    countries: ['cu', 'do', 'pr'] } ] },
    { name: 'cake',       members: [    // DAMER torta=Pastel grande: excluye México (allí torta=sándwich)
      { words: ['tarta'],  label: 'España',                countries: ['es'] },
      { words: ['pastel'], label: 'México y Centroamérica', countries: ['mx', 'gt', 'sv', 'cr', 'cu', 'do', 'pr'] },
      { words: ['torta'],  label: 'Sudamérica',            countries: ['ni', 'pa', 'co', 've', 'ec', 'pe', 'bo', 'cl', 'py', 'ar', 'uy'] } ] },
  ],
  // English US/UK. Only CLEAN binary splits where the region marker is unambiguous. Polysemous or
  // register-neutral words are deliberately EXCLUDED (they produced mostly false positives):
  //  • film/movie — "film" is neutral-standard everywhere (film festival, Best Foreign Film), not a
  //    reliable UK marker; "movie" is understood universally. Not a must-teach split.
  //  • rent/hire, grocery/shopping — "rent"/"shopping" are polysemous (rent a flat; go shopping).
  // "the bill"/"the check" are anchored to the restaurant NOUN sense so the verb "to check", the
  // "check-in/check-out" compounds, and "check" = cheque no longer false-positive.
  en: [
    { name: 'fries',    members: [
      { words: ['fries'], label: 'US', countries: ['us'] },
      { words: ['chips'], label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    // ('bill'/'check' removed — even anchored, "the bill" is neutral for a hotel/invoice and only
    //  the restaurant DINING sense splits US check / UK bill; the two genuine restaurant phrases
    //  are completed by hand. Context can't be told apart deterministically.)
    { name: 'cart',     members: [
      { words: ['cart', 'carts'],       label: 'US', countries: ['us'] },
      { words: ['trolley', 'trolleys'], label: 'UK', countries: ['gb', 'au', 'nz'] } ] },
    { name: 'aluminum', members: [
      { words: ['aluminum'],  label: 'US', countries: ['us'] },
      { words: ['aluminium'], label: 'UK', countries: ['gb', 'au', 'nz'] } ] },
    { name: 'gas',      members: [
      { words: ['gasoline'], label: 'US', countries: ['us'] },
      { words: ['petrol'],   label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'elevator', members: [    // 'lift' anchored to the NOUN — the bare verb "to lift" is not a variant
      { words: ['elevator'], label: 'US', countries: ['us'] },
      { words: ['the lift', 'a lift'], label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'apartment', members: [
      { words: ['apartment'], label: 'US', countries: ['us'] },
      { words: ['flat'],      label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'vacation', members: [
      { words: ['vacation'], label: 'US', countries: ['us'] },
      { words: ['holiday'],  label: 'UK', countries: ['gb', 'au', 'nz', 'ie'] } ] },
    { name: 'truck',    members: [
      { words: ['truck'], label: 'US', countries: ['us'] },
      { words: ['lorry'], label: 'UK', countries: ['gb'] } ] },
  ],
};

const wordRe = (w) => new RegExp('(^|[^\\p{L}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'iu');

function memberInText(member, text) {
  return member.words.some(w => wordRe(w).test(text));
}

// Gendered PERSON references (Spanish) — GRAMMATICAL, not dialectal. When a phrase names a person
// whose gender can vary, both gender forms should exist (Rule 10). Coverage is DELIBERATELY broad:
// 3rd-person person-nouns ("ese muchacho/esa muchacha", "mi vecino/vecina") AND nominalised plural
// adjectives ("los más lentos/las más lentas") — not only 1st/2nd-person predicates. Two suppressors
// keep the findings actionable (only genuine within-phrase variants remain), both documented inline:
//   • sourceFixesGender() — the English source already fixes the gender (he/husband/boy/a name).
//   • masculine-plural-only nouns — "hijos/hermanos/abuelos" are the standard generic for a group
//     (Rule 14.4 excludes masculine plurals for groups); the feminine plural would change meaning.
// Curated PERSON terms with -o/-a gender — split so we can gate the polysemous adjectives:
//  • NOUNS always signal a person (muchacho, esposo, profesor…) → any form flags.
//  • ADJECTIVES are polysemous (listo=ready, rápido=fast object, bajo=under) so they only flag in
//    a PERSON context: a 1st/2nd-person predicate ("estoy/soy … cansado") or a nominalisation
//    ("los/las más lentos"). This covers "ese muchacho/esa muchacha" (noun) and "los más lentos/
//    las más lentas" (nominalised adj) while excluding "el balance está listo", "análisis rápido".
const PERSON_NOUN_ES = [
  'muchacho', 'niño', 'chico', 'hermano', 'amigo', 'hijo', 'abuelo', 'tío', 'sobrino', 'nieto',
  'novio', 'esposo', 'compañero', 'vecino', 'alumno', 'jugador', 'conductor', 'pasajero',
  'ciudadano', 'empleado', 'jefe', 'dueño', 'profesor', 'maestro', 'doctor', 'enfermero',
  'ingeniero', 'abogado', 'cocinero', 'camarero', 'director', 'gerente', 'vendedor', 'arquitecto',
  'bombero', 'panadero', 'peluquero', 'carpintero',
  // ('cartero' omitted — its -a form collides with "cartera" = wallet, a common false positive.)
];
const PERSON_ADJ_ES = [
  'listo', 'lento', 'rápido', 'alto', 'gordo', 'delgado', 'guapo', 'feo', 'rubio', 'moreno',
  'calvo', 'simpático', 'antipático', 'nervioso', 'contento', 'cansado', 'enfermo', 'aburrido',
  'ocupado', 'preocupado', 'emocionado', 'orgulloso', 'callado', 'tímido', 'curioso', 'honesto',
  'generoso', 'perezoso', 'casado', 'soltero', 'divorciado', 'viudo', 'sorprendido', 'asustado',
  'enojado', 'molesto', 'mareado', 'resfriado', 'agradecido',
];
// Person context for adjectives: 1st/2nd-person predicate, or "el/la/los/las (más|menos) …".
const PERSON_CTX = /\b(estoy|soy|est[aá]s|eres|me siento|te ves|ser[eé]|seas|est[eé]s)\b|\b(el|la|los|las)\s+(m[aá]s|menos)\s/i;
// A person lemma (masc -o) as its -o/-os/-a/-as forms, whole word.
const genderLemmaRe = (lemma) => {
  const stem = lemma.replace(/o$/, '');
  return new RegExp('(^|[^\\p{L}])' + stem + '[oa]s?($|[^\\p{L}])', 'iu');
};
function gestureGendered(text) {   // → the person term matched, or null
  // NOUNS: flag the SINGULAR (vecino→vecina is a real variant) or an explicit feminine plural.
  // A masculine-plural-only noun (hijos = children, abuelos = grandparents, hermanos = siblings) is
  // the STANDARD generic for a group — Rule 14.4 excludes "masculine plurals for groups" → skip.
  for (const l of PERSON_NOUN_ES) {
    const stem = l.replace(/o$/, '');
    const sg = new RegExp('(^|[^\\p{L}])' + stem + '[oa]($|[^\\p{L}])', 'iu');
    const plFem = new RegExp('(^|[^\\p{L}])' + stem + 'as($|[^\\p{L}])', 'iu');
    if (sg.test(text) || plFem.test(text)) return l;
    // else (masculine-plural-only, or no match) → not a within-phrase variant; keep scanning.
  }
  // ADJECTIVES (nominalised): keep plural too — "los más lentos/las más lentas" IS a real agreement
  // variant of one concept (unlike a plural noun, whose feminine changes the meaning).
  if (PERSON_CTX.test(text)) for (const l of PERSON_ADJ_ES) if (genderLemmaRe(l).test(text)) return l;
  return null;
}

// Does the SOURCE already fix the person's gender? (source language = English here — the only
// source that reaches the gender block, since the target must be Spanish.) A gendered pronoun /
// kinship / role noun, or a proper name (mid-sentence capital), means the single-gender Spanish
// is a FAITHFUL translation, not a missing variant (Rule 10/14.4). Only a gender-NEUTRAL source
// (neighbor, friend, teacher, cousin, they, the person) that Spanish must render in one gender is
// a genuine missing-variant case (→ both forms as variants). Keeps "Mi vecino ← My neighbor" (real)
// while dropping "Ese muchacho ← That boy", "Su esposo ← Her husband", "mi amiga Ana" (source-fixed).
const EN_GENDER_WORDS = /\b(he|him|his|she|her|hers|son|daughter|brother|sister|uncle|aunt|husband|wife|boyfriend|girlfriend|grand(mother|father|ma|pa)|granny|mother|father|mom|mum|dad|nephew|niece|king|queen|prince|princess|actor|actress|waiter|waitress|host|hostess|widow|widower|groom|bride|boy|girl|man|men|woman|women|lady|ladies|gentleman|guy|sir|madam|mister|mrs|mr|ms|monk|nun)\b/i;
function sourceFixesGender(src) {
  if (!src) return false;
  if (EN_GENDER_WORDS.test(src)) return true;
  const words = src.split(/\s+/);          // a proper name (mid-sentence capital) fixes the gender
  for (let i = 1; i < words.length; i++) {
    if (/[.?!]$/.test(words[i - 1])) continue;                 // skip token after sentence break
    if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(words[i])) return true;  // mid-sentence Capital → name
  }
  return false;
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
      //     A LONE NEUTRAL base (autobús, piscina) is fine everywhere → not flagged; only a REGIONAL
      //     term missing its siblings is. When the full set IS shown, the neutral is a first-class
      //     labelled variant with its own badge (rule: "si hay neutra, que también salga").
      for (const set of lex) {
        const present = set.members.filter(m => memberInText(m, allText));
        if (!present.length) continue;
        const missing = set.members.filter(m => !present.includes(m));
        if (!missing.length) continue;                                  // complete
        if (present.every(m => m.neutral)) continue;                    // only the neutral base → OK
        findings.push({ ...base, type: 'region', set: set.name,
          has: present.map(m => m.label).join('/'),
          detail: missing.map(m => `${m.words[0]} [${m.label}: ${m.countries.join(',')}]`).join('  ') });
      }

      // (2) GENDER completeness (es) — a phrase describing the speaker/addressee with a gendered
      //     predicate, but no gender variant.
      const gLemma = lang === 'es' ? gestureGendered(allText) : null;
      const genderMissing = gLemma && !hasGender && !sourceFixesGender(p.source);
      if (genderMissing) findings.push({ ...base, type: 'gender', detail: `predicado con género "${gLemma}" (source no fija género) sin variante masculino/femenino` });

      // (3) COMBINATIONS — one dimension present, the other genuinely applies too.
      if (hasGender && !hasRegion && anyRegionMember(lex, allText))
        findings.push({ ...base, type: 'combo', detail: 'tiene GÉNERO y usa un término región-variable → falta la dimensión REGIÓN (región×género)' });
      if (hasRegion && genderMissing)
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
