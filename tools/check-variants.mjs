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
import { GENDER } from './gender-detectors.mjs';   // per-target-language gender detection (perfil-driven)
import AppVariantDims from '../shared/js/variant-dimensions.js';   // the open dimension registry (inflectional dims are data-driven)

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
    // ('vacation'/'holiday' removed — "holiday" is POLYSEMOUS (US "public holiday" = día festivo, vs
    //  UK "holiday" = vacation), so it false-positives on the público sense, e.g. the vocab entry
    //  "holiday" = día festivo. Per the anti-polysemy policy above, a word with two senses is excluded.)
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
// Person-noun / person-adjective lexicons and the gender morphology now live per TARGET language in
// tools/gender-detectors.mjs (GENDER[lang]) — a new gendered language adds a block there, not here.

// Does the SOURCE already fix the person's gender? (source language = English here — the only
// source that reaches the gender block, since the target must be Spanish.) A gendered pronoun /
// kinship / role noun, or a proper name (mid-sentence capital), means the single-gender Spanish
// is a FAITHFUL translation, not a missing variant (Rule 10/14.4). Only a gender-NEUTRAL source
// (neighbor, friend, teacher, cousin, they, the person) that Spanish must render in one gender is
// a genuine missing-variant case (→ both forms as variants). Keeps "Mi vecino ← My neighbor" (real)
// while dropping "Ese muchacho ← That boy", "Su esposo ← Her husband", "mi amiga Ana" (source-fixed).
const EN_GENDER_WORDS = /\b(he|him|his|she|her|hers|son|daughter|brother|sister|uncle|aunt|husband|wife|boyfriend|girlfriend|grand(mother|father|ma|pa|son|daughter)|granny|mother|father|mom|mum|dad|nephew|niece|king|queen|prince|princess|actor|actress|waiter|waitress|host|hostess|widow|widower|groom|bride|boy|girl|man|men|woman|women|lady|ladies|gentleman|guy|sir|madam|mister|mrs|mr|ms|monk|nun)\b/i;
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

// ── CONCORDANCIA (agreement): two forms that differ in exactly ONE inflectional dimension
// (gender or number) must differ ONLY by recognised inflection — article + noun + adjective + verb
// all agreeing, nothing else. Catches a form where a word was NOT agreed ("La niña es listo") or a
// non-inflectional change slipped in. Deterministic morphology + a small irregular allowlist.
const _w = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
// Spanish preposition+article contractions expand so word alignment matches the feminine ("a la"):
// "al" = "a el", "del" = "de el". Without this, "al niño" (2) vs "a la niña" (3) looks like a length change.
const expandContractions = (t) => t.replace(/\bal\b/gi, 'a el').replace(/\bdel\b/gi, 'de el');
// → null if the pair agrees cleanly, else a human reason string. `G` is the target language's gender
// detector (GENDER[lang]); the inflection test is the language's own (G.isGenderInfl).
function concordMismatch(textA, textB, dim, G) {
  const wa = expandContractions(textA).split(/\s+/).filter(Boolean), wb = expandContractions(textB).split(/\s+/).filter(Boolean);
  // Structural invariant for EVERY inflectional dimension: the two forms must have the same word
  // count — they may differ only by inflection, never by adding/removing words.
  if (wa.length !== wb.length)
    return `las formas ${dim} difieren en nº de palabras (${wa.length}≠${wb.length}) — deben diferir solo por flexión`;
  // Deep per-word check only where the target ships a morphology detector for the dimension: gender
  // is verified via the language's own detector; number/case rely on the structural invariant above
  // until their morphology detectors are added (a future increment — see docs/LANGUAGE-PROFILES.md).
  if (dim === 'gender' && G) {
    for (let i = 0; i < wa.length; i++) {
      if (_w(wa[i]) === _w(wb[i])) continue;
      if (!G.isGenderInfl(wa[i], wb[i])) return `"${wa[i]}" / "${wb[i]}" no es una flexión de ${dim} (¿palabra sin concordar?)`;
    }
  }
  return null;
}
// Inflectional variant dimensions the registry declares for a target language (data-driven → number,
// case, … join automatically without editing this tool). Concordancia applies to two forms differing
// in exactly one of these.
const inflDimsFor = (lang) => AppVariantDims.keys().filter(d => AppVariantDims.kind(d) === 'inflectional' && AppVariantDims.appliesTo(d, lang));
// The single dimension in which two label sets differ, or null if not exactly one.
function soleDiffDim(la, lb) {
  const keys = new Set([...Object.keys(la || {}), ...Object.keys(lb || {})]);
  let diff = null;
  for (const k of keys) { if ((la || {})[k] !== (lb || {})[k]) { if (diff) return null; diff = k; } }
  return diff;
}

const findings = [];
for (const pair of fs.readdirSync(PAIRS_DIR)) {
  const dir = path.join(PAIRS_DIR, pair);
  if (!fs.statSync(dir).isDirectory()) continue;
  const lang = pair.split('-')[1];
  const lex = LEXICON[lang] || [];   // region lexicon (empty for a language with no region splits yet)
  const G = GENDER[lang];   // the target language's gender detector (undefined ⇒ no grammatical gender)
  // Process the language if there is ANYTHING to check: region splits, a gender detector, or any
  // inflectional dimension (gender/number/case…) the registry declares for it. Don't skip a gendered
  // or case/number language just because it has no region lexicon yet.
  if (!lex.length && !G && !inflDimsFor(lang).length) continue;
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
      const gLemma = G ? G.gestureGendered(allText) : null;
      const genderMissing = gLemma && !hasGender && !sourceFixesGender(p.source);
      if (genderMissing) findings.push({ ...base, type: 'gender', detail: `predicado con género "${gLemma}" (source no fija género) sin variante masculino/femenino` });

      // (3) COMBINATIONS — one dimension present, the other genuinely applies too.
      if (hasGender && !hasRegion && anyRegionMember(lex, allText))
        findings.push({ ...base, type: 'combo', detail: 'tiene GÉNERO y usa un término región-variable → falta la dimensión REGIÓN (región×género)' });
      if (hasRegion && genderMissing)
        findings.push({ ...base, type: 'combo', detail: `tiene REGIÓN y un predicado con género ("${gLemma}") → falta la dimensión GÉNERO (región×género)` });

      // (4) CONCORDANCIA — a pair of forms differing in exactly one inflectional dimension
      //     (gender/number) must differ ONLY by recognised inflection (art+noun+adj+verb agree).
      for (let a = 0; a < forms.length; a++) for (let b = a + 1; b < forms.length; b++) {
        const dim = soleDiffDim(forms[a].labels, forms[b].labels);
        if (dim && inflDimsFor(lang).includes(dim)) {
          const m = concordMismatch(forms[a].text || '', forms[b].text || '', dim, G);
          if (m) findings.push({ ...base, type: 'concord', detail: m });
          else if (dim === 'gender' && G) {          // also catch a retained wrong-gender adjective
            const fa = forms[a].labels || {}, fb = forms[b].labels || {};
            const masc = fa.gender === 'masculino' ? forms[a].text : fb.gender === 'masculino' ? forms[b].text : null;
            const fem = fa.gender === 'femenino' ? forms[a].text : fb.gender === 'femenino' ? forms[b].text : null;
            if (masc && fem) { const r = G.retainedAdjMismatch(masc, fem); if (r) findings.push({ ...base, type: 'concord', detail: r }); }
          }
        }
      }
    }
  }
}

// ── VOCAB scan — words carry variants too: a person noun needs BOTH genders (niño/niña); a
// region-variable word needs all its regional forms (papa/patata). allText = term + every
// variants[].text; the English gloss (translations.en) is the L1 anchor that can fix gender,
// exactly like a phrase source. So the user's rule "las palabras también deben cumplir variantes,
// y que se identifiquen" is enforced, not only phrases.
const VOCAB_BASE = path.join(ROOT, 'shared/json/vocab');
for (const lang of (fs.existsSync(VOCAB_BASE) ? fs.readdirSync(VOCAB_BASE) : [])) {
  const lex = LEXICON[lang] || [];   // region lexicon (empty for a language with no region splits yet)
  const G = GENDER[lang];   // the target language's gender detector (undefined ⇒ no grammatical gender)
  if (!lex.length && !G && !inflDimsFor(lang).length) continue;   // process gendered/case/number langs too
  const vdir = path.join(VOCAB_BASE, lang);
  if (!fs.statSync(vdir).isDirectory()) continue;
  for (const f of fs.readdirSync(vdir)) {
    if (!f.endsWith('.json')) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(vdir, f), 'utf8')); } catch { continue; }
    const deck = f === 'words.json' ? 'general' : f.replace(/^words-/, '').replace(/\.json$/, '');
    for (const w of (data.words || [])) {
      const variants = w.variants || [];
      const allText = [w.term, ...variants.map(v => v.text || '')].join('  ');
      const enGloss = (w.translations && w.translations.en) || '';
      const base = { pair: 'vocab/' + lang, topic: deck, id: w.id };

      for (const set of lex) {           // REGION completeness (same rule as phrases)
        const present = set.members.filter(m => memberInText(m, allText));
        if (!present.length) continue;
        const missing = set.members.filter(m => !present.includes(m));
        if (!missing.length || present.every(m => m.neutral)) continue;
        findings.push({ ...base, type: 'region', set: set.name, has: present.map(m => m.label).join('/'),
          detail: missing.map(m => `${m.words[0]} [${m.label}: ${m.countries.join(',')}]`).join('  ') });
      }

      // GENDER — a person noun present but NOT in both gender forms, and the English gloss doesn't
      // fix the gender (gloss "child" is neutral → needs niño/niña; "man" fixes it → single is fine).
      const gLemma = G ? G.gestureGendered(allText) : null;
      if (gLemma && !G.bothGendersPresent(gLemma, allText) && !sourceFixesGender(enGloss))
        findings.push({ ...base, type: 'gender', detail: `término con género "${gLemma}" (gloss "${enGloss}" no fija género) sin ambas formas masculino/femenino` });

      // MISLABEL — a LEXICAL variant set (synonym/loanword) whose forms are actually a gender
      // inflection of one lemma (inglés/inglesa) must NOT rotate: gender is the dictionary-slash
      // pattern, not a rotating recognition variant. Catches the class of bug where the migration
      // detector missed a gender pair and structured it as a rotating synonym.
      if (G && variants.length === 2) {
        const lexical = variants.every(v => v.labels && ('synonym' in v.labels || 'loanword' in v.labels) && !('gender' in v.labels));
        if (lexical && G.isGenderInfl(variants[0].text || '', variants[1].text || ''))
          findings.push({ ...base, type: 'gender',
            detail: `"${variants[0].text}" / "${variants[1].text}" es flexión de GÉNERO etiquetada como léxica (sinónimo/préstamo) → debe ser barra de género, no rotar` });
      }
    }
  }
}

const order = { region: 0, gender: 1, combo: 2, concord: 3 };
findings.sort((a, b) => (order[a.type] - order[b.type]) || (a.pair + a.topic).localeCompare(b.pair + b.topic));
const counts = { region: 0, gender: 0, combo: 0, concord: 0 };
for (const x of findings) counts[x.type]++;
console.log(`Completitud de variantes — ${findings.length} hallazgo(s)  ` +
  `(región ${counts.region}, género ${counts.gender}, combinación ${counts.combo}, concordancia ${counts.concord}):`);
for (const x of findings) {
  console.log(`  [${x.type.toUpperCase()}] [${x.pair} ${x.topic}] ${x.id}${x.set ? ' (set: ' + x.set + '; tiene: ' + x.has + ')' : ''}`);
  console.log(`     ${x.detail}`);
}
if (!findings.length) console.log('  ✓ todas las frases con variantes están completas (región, género y combinaciones).');

if (GATE && findings.length) { console.log(`\n✗ ${findings.length} hallazgo(s) de variantes incompletas.`); process.exit(1); }
