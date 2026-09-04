/**
 * gender-detectors.mjs  (Node-only, mirrors lang-detectors.mjs)
 * ────────────────────────────────────────────────────────────
 * Per-TARGET-language gender-detection facts + morphology, one self-contained object per language.
 * check-variants.mjs stays generic: it looks up GENDER[targetLang] and calls its methods — it never
 * hardcodes a language's grammar. A NEW gendered target language adds ONE block here (its person
 * lexicons, article gender map, irregular pairs, and its own inflection morphology, which genuinely
 * differs per language — Spanish -o/-a is nothing like German -in), and needs NO edit to the tool.
 *
 * A language whose profile says `grammaticalGender: true` (shared/js/lang-profiles.js) MUST have a
 * block here — enforced by tools/check-lang-profiles.mjs. A non-gendered target (English) has none,
 * and check-variants simply skips gender detection for it.
 *
 * Each block exposes:
 *   gestureGendered(text)            → the person lemma whose gender varies within `text`, or null
 *   isGenderInfl(a, b)               → are the two surface words a gender inflection of one lemma?
 *   bothGendersPresent(lemma, text)  → does `text` already contain BOTH gender forms of `lemma`?
 *   retainedAdjMismatch(masc, fem)   → a person adjective left in the wrong gender across a pair
 * plus its raw data (personNouns, personAdjs, arts, irregular) for reference/testing.
 */

const _w = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
const reWord = (body) => new RegExp('(^|[^\\p{L}])' + body + '($|[^\\p{L}])', 'iu');

// ── Spanish ─────────────────────────────────────────────────────────────────
const es = {
  // NOUNS always signal a person (any -o/-a form flags); ADJECTIVES are polysemous (listo=ready,
  // rápido=fast object) so they only flag in a PERSON context (1st/2nd-person predicate, or "los/las
  // más …" nominalisation). Covers "ese muchacho/esa muchacha" and "los más lentos/las más lentas".
  personNouns: [
    'muchacho', 'niño', 'chico', 'hermano', 'amigo', 'hijo', 'abuelo', 'tío', 'sobrino', 'nieto',
    'novio', 'esposo', 'compañero', 'vecino', 'alumno', 'jugador', 'conductor', 'pasajero',
    'ciudadano', 'empleado', 'jefe', 'dueño', 'profesor', 'maestro', 'doctor', 'enfermero',
    'ingeniero', 'abogado', 'cocinero', 'camarero', 'director', 'gerente', 'vendedor', 'arquitecto',
    'bombero', 'panadero', 'peluquero', 'carpintero',
    // ('cartero' omitted — its -a form collides with "cartera" = wallet, a common false positive.)
  ],
  personAdjs: [
    'listo', 'lento', 'rápido', 'alto', 'gordo', 'delgado', 'guapo', 'feo', 'rubio', 'moreno',
    'calvo', 'simpático', 'antipático', 'nervioso', 'contento', 'cansado', 'enfermo', 'aburrido',
    'ocupado', 'preocupado', 'emocionado', 'orgulloso', 'callado', 'tímido', 'curioso', 'honesto',
    'generoso', 'perezoso', 'casado', 'soltero', 'divorciado', 'viudo', 'sorprendido', 'asustado',
    'enojado', 'molesto', 'mareado', 'resfriado', 'agradecido',
  ],
  // Adjectives that double as invariable adverbs (rápido/lento/alto/bajo) are excluded from the
  // retained-adjective concordance check to avoid false positives.
  _adjAdverbs: ['rápido', 'lento', 'alto', 'bajo'],
  personCtx: /\b(estoy|soy|est[aá]s|eres|me siento|te ves|ser[eé]|seas|est[eé]s)\b|\b(el|la|los|las)\s+(m[aá]s|menos)\s/i,
  arts: { el: 'la', los: 'las', un: 'una', unos: 'unas', este: 'esta', estos: 'estas', ese: 'esa', esos: 'esas', aquel: 'aquella', aquellos: 'aquellas', el2: 'ella', ellos: 'ellas', uno: 'una', nuestro: 'nuestra', nuestros: 'nuestras', vuestro: 'vuestra' },
  irregular: [
    ['actor', 'actriz'], ['rey', 'reina'], ['hombre', 'mujer'], ['padre', 'madre'], ['yerno', 'nuera'],
    ['heroe', 'heroina'], ['principe', 'princesa'], ['emperador', 'emperatriz'], ['caballo', 'yegua'],
    ['toro', 'vaca'], ['papa', 'mama'], ['varon', 'hembra'],
    // plural irregulars (the check runs on the surface words, so list both numbers)
    ['actores', 'actrices'], ['reyes', 'reinas'], ['hombres', 'mujeres'], ['padres', 'madres'],
    ['heroes', 'heroinas'], ['principes', 'princesas'], ['emperadores', 'emperatrices'],
  ],

  gestureGendered(text) {
    // NOUNS: flag the SINGULAR (vecino→vecina is a real variant) or an explicit feminine plural. A
    // masculine-plural-only noun (hijos, abuelos, hermanos) is the STANDARD generic for a group —
    // Rule 14.4 excludes it → skip.
    for (const l of this.personNouns) {
      const stem = l.replace(/o$/, '');
      if (reWord(stem + '[oa]').test(text) || reWord(stem + 'as').test(text)) return l;
    }
    // ADJECTIVES (nominalised): keep plural too — "los más lentos/las más lentas" IS a real agreement
    // variant of one concept (unlike a plural noun, whose feminine changes the meaning).
    if (this.personCtx.test(text)) {
      for (const l of this.personAdjs) {
        const stem = l.replace(/o$/, '');
        if (reWord(stem + '[oa]s?').test(text)) return l;
      }
    }
    return null;
  },

  isGenderInfl(a, b) {
    const la = _w(a), lb = _w(b); if (la === lb) return true;
    if (this.arts[la] === lb || this.arts[lb] === la) return true;
    if (this.irregular.some(([m, f]) => (la === m && lb === f) || (la === f && lb === m))) return true;
    if (la.length > 1 && lb.length > 1 && la.slice(0, -1) === lb.slice(0, -1) &&
        ((la.endsWith('o') && lb.endsWith('a')) || (la.endsWith('a') && lb.endsWith('o')))) return true;   // niño/niña
    if (la.length > 2 && lb.length > 2 && la.slice(0, -2) === lb.slice(0, -2) &&
        ((la.endsWith('os') && lb.endsWith('as')) || (la.endsWith('as') && lb.endsWith('os')))) return true; // niños/niñas
    if (lb === la + 'a' || la === lb + 'a') return true;   // profesor/profesora, español/española
    if (la.length > 2 && lb.length > 2 &&                    // jefe/jefa, presidente/presidenta (-e → -a)
        ((la.endsWith('e') && lb === la.slice(0, -1) + 'a') ||
         (lb.endsWith('e') && la === lb.slice(0, -1) + 'a'))) return true;
    return false;
  },

  bothGendersPresent(lemma, text) {
    if (/o$/.test(lemma)) {                       // -o nouns: masc = stem+o, fem = stem+a (niño/niña)
      const stem = lemma.slice(0, -1);
      return reWord(stem + 'os?').test(text) && reWord(stem + 'as?').test(text);
    }
    // consonant-ending nouns (jugador/jugadora, profesor/profesora): masc = bare, fem = +a.
    return reWord(lemma + '(es)?').test(text) && reWord(lemma + 'as?').test(text);
  },

  retainedAdjMismatch(mascText, femText) {
    for (const lemma of this.personAdjs) {
      if (this._adjAdverbs.includes(lemma)) continue;
      const stem = lemma.replace(/o$/, '');
      const masc = new RegExp('(^|[^\\p{L}])' + stem + 'os?($|[^\\p{L}])', 'iu');
      const fem = new RegExp('(^|[^\\p{L}])' + stem + 'as?($|[^\\p{L}])', 'iu');
      if (masc.test(femText)) return `adjetivo "${lemma}" en masculino dentro de la forma femenina (sin concordar)`;
      if (fem.test(mascText)) return `adjetivo "${lemma}" en femenino dentro de la forma masculina (sin concordar)`;
    }
    return null;
  },
};

// ── German ──────────────────────────────────────────────────────────────────
// Person gender in German: masculine base + feminine in -in (der Lehrer / die Lehrerin), plus
// article gender (der/die, ein/eine) and a few suppletive pairs (Mann/Frau). The morphology is
// wholly unlike Spanish -o/-a, which is exactly why it lives in its own block (the tool stays
// generic). NOTE: _w() folds umlauts (NFD), so lemmas are matched umlaut-agnostically; person
// nouns are chosen with plain -in feminines to keep raw-text detection reliable in the stress-test.
const de = {
  personNouns: [
    'lehrer', 'student', 'freund', 'kollege', 'nachbar', 'kellner', 'chef', 'partner',
    'schüler', 'mieter', 'besucher', 'sänger', 'spieler', 'verkäufer', 'fahrer', 'arbeiter',
  ],
  personAdjs: [],   // German adjective agreement is case/gender/number-complex → not person-context-flagged here.
  personCtx: /\b(ich bin|du bist|er ist|sie ist|ein|eine)\b/i,
  // Nominative + accusative masc→fem article/determiner map (both directions checked in isGenderInfl).
  arts: { der: 'die', den: 'die', ein: 'eine', einen: 'eine', dieser: 'diese', diesen: 'diese',
          mein: 'meine', dein: 'deine', sein: 'seine', kein: 'keine', keinen: 'keine',
          jeder: 'jede', welcher: 'welche', unser: 'unsere' },
  irregular: [
    ['mann', 'frau'], ['vater', 'mutter'], ['bruder', 'schwester'], ['sohn', 'tochter'],
    ['junge', 'madchen'], ['herr', 'frau'], ['onkel', 'tante'], ['opa', 'oma'], ['neffe', 'nichte'],
  ],

  gestureGendered(text) {
    // A person noun present as masculine base or feminine (+in / +innen) → its gender can vary.
    for (const l of this.personNouns) {
      if (reWord(l).test(text) || reWord(l + 'in').test(text) || reWord(l + 'innen').test(text)) return l;
    }
    return null;
  },

  isGenderInfl(a, b) {
    const la = _w(a), lb = _w(b); if (la === lb) return true;
    if (this.arts[la] === lb || this.arts[lb] === la) return true;
    if (this.irregular.some(([m, f]) => (la === m && lb === f) || (la === f && lb === m))) return true;
    if (lb === la + 'in' || la === lb + 'in') return true;           // Lehrer/Lehrerin
    if (lb === la + 'innen' || la === lb + 'innen') return true;     // Lehrer/Lehrerinnen (pl.)
    return false;
  },

  bothGendersPresent(lemma, text) {
    return reWord(lemma).test(text) && reWord(lemma + 'in').test(text);
  },

  retainedAdjMismatch() { return null; },   // adj concordance (strong/weak/mixed) out of scope for the stress-test slice.
};

// ── Polish (pl) — STRESS-TEST target (de-pl), minimal ────────────────────────
// Polish person nouns form the feminine mostly with -ka (student → studentka, nauczyciel →
// nauczycielka, aktor → aktorka; -arz → -arka: lekarz → lekarka), plus a set of suppletive pairs
// (mężczyzna/kobieta). `_w` folds the Polish diacritics that decompose (ą→a, ę→e, ó→o, ś→s, ć→c,
// ń→n, ź→z, ż→z) but keeps ł (a distinct letter), so the irregular/arts data is stored ALREADY
// folded to match `_w`. Adjective agreement (7 cases × 3 genders) is out of the stress-test slice.
const pl = {
  personNouns: [
    'student', 'nauczyciel', 'kelner', 'aktor', 'lekarz', 'kucharz', 'kolega', 'sąsiad',
    'pracownik', 'przyjaciel', 'pisarz', 'dziennikarz',
  ],
  personAdjs: [],
  personCtx: /\b(jestem|jesteś|jest|on jest|ona jest|to)\b/i,
  // Masculine → feminine gendered determiners/possessives (folded to _w form: mój→moj, który→ktory).
  arts: { ten: 'ta', tamten: 'tamta', moj: 'moja', twoj: 'twoja', nasz: 'nasza', wasz: 'wasza',
          swoj: 'swoja', jeden: 'jedna', ktory: 'ktora', jaki: 'jaka', taki: 'taka' },
  irregular: [
    ['mezczyzna', 'kobieta'], ['ojciec', 'matka'], ['brat', 'siostra'], ['syn', 'corka'],
    ['chłopiec', 'dziewczyna'], ['pan', 'pani'], ['maz', 'zona'], ['dziadek', 'babcia'],
    ['kolega', 'kolezanka'],
  ],

  // The feminine NOMINATIVE stem of a masculine person-lemma (folded): mostly -ka (student→studentk),
  // -arz→-arka (lekarz→lekark), -el→-elka (nauczyciel→nauczycielk), plus the suppletive pairs from
  // `irregular` (kolega→koleżanka). Returned WITHOUT the final -a so case endings attach to the stem.
  _femStem(lemma) {
    const lf = _w(lemma);
    const irr = this.irregular.find(([m]) => m === lf);
    if (irr) return irr[1].replace(/a$/, '');
    if (/arz$/.test(lf)) return lf.replace(/arz$/, 'ark');
    if (/el$/.test(lf)) return lf.replace(/el$/, 'elk');
    return lf + 'k';
  },
  // Does the text contain a masculine / feminine CASE-inflected form of `lemma`? być forces the
  // Narzędnik (studentem / studentką), and other cases add endings too, so we stem-match in the folded
  // space (ą→a, ę→e…) instead of exact whole-word — otherwise "studentem" never matches "student".
  _matchLemma(text, lemma) {
    const lem = _w(lemma);
    const fem = this._femStem(lemma);
    const MEND = ['', 'a', 'owi', 'em', 'u', 'ie', 'ze', 'ow', 'om', 'ami', 'ach'];   // masc sing/pl case endings (folded)
    const FEND = ['a', 'i', 'e', 'o', 'y', 'ce', 'ke', 'om', 'ami', 'ach'];           // fem (-k stem) case endings (ę→e, ą→a folded)
    let m = false, f = false;
    for (const raw of text.split(/[^\p{L}]+/u)) {
      if (!raw) continue;
      const t = _w(raw);
      if (t.startsWith(fem) && FEND.includes(t.slice(fem.length))) { f = true; continue; }  // fem first (studentka ⊃ student)
      if (t.startsWith(lem) && MEND.includes(t.slice(lem.length))) m = true;
    }
    return { masc: m, fem: f };
  },

  gestureGendered(text) {
    for (const l of this.personNouns) {
      const r = this._matchLemma(text, l);
      if (r.masc || r.fem) return l;
    }
    return null;
  },

  isGenderInfl(a, b) {
    const la = _w(a), lb = _w(b); if (la === lb) return true;
    if (this.arts[la] === lb || this.arts[lb] === la) return true;
    if (this.irregular.some(([m, f]) => (la === m && lb === f) || (la === f && lb === m))) return true;
    // Person-noun gender pairs (mostly -ka feminine), compared at the NOMINATIVE stem so they also
    // match when both forms carry a case ending. `być` forces the Narzędnik (instrumental): masc -em,
    // fem -ą (folded to -a by _w) — strip those so studentem/studentką ↦ student/studentka.
    const nom = (w) => w.replace(/em$/, '').replace(/ą$/, 'a');
    const pair = (x, y) =>
      x === y + 'ka' || y === x + 'ka' ||                                  // student/studentka
      x === y.replace(/arz$/, 'arka') || y === x.replace(/arz$/, 'arka') || // lekarz/lekarka
      x === y.replace(/el$/, 'elka') || y === x.replace(/el$/, 'elka');     // nauczyciel/nauczycielka
    if (pair(la, lb)) return true;
    if (pair(nom(la), nom(lb))) return true;
    return false;
  },

  bothGendersPresent(lemma, text) {
    const r = this._matchLemma(text, lemma);
    return r.masc && r.fem;
  },

  retainedAdjMismatch() { return null; },   // adjective concordance out of scope for the stress-test slice.
};

export const GENDER = { es, de, pl };
