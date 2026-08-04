/**
 * audit.mjs — PracticeEnglish Content Audit
 * ==========================================
 * Language-pair-aware audit for all shared/json/{pairId}/*.json content files.
 * Runs universal checks (em dash, word count, ID uniqueness, JSON validity)
 * and language-specific checks (anglicisms, regional terms, vosotros paradigms)
 * driven by a single CONTENT_RULES configuration object.
 *
 * USAGE (run from the tools/ directory):
 *   node audit.mjs               # full audit, including audio alignment
 *   node audit.mjs --quick       # skip audio alignment check (fast)
 *   node audit.mjs --file shared/json/pairs/es-en/greetings.json   # single file
 *
 * EXIT CODE: 0 = all clear, 1 = issues found.
 *
 * ─── ADDING A NEW LANGUAGE PAIR ────────────────────────────────────────────
 * 1. Add the new pair to the PAIRS array below (id, sourceLang, targetLang).
 *    The audit will automatically cover:
 *      shared/json/{id}/{topic}.json    — phrase files
 *      shared/json/{id}/grammar-rules.json
 *      shared/json/{id}/placement.json
 *      shared/audio/{id}/{topic}/       — audio alignment
 *
 * 2. If the new pair's target language has content rules, add them to
 *    CONTENT_RULES below (key = ISO 639-1 target language code).
 *
 * 3. Register the target language voice leader in LANG_VOICE_LEADERS.
 *
 * ─── PHRASE FILE SCHEMA (per-pair) ─────────────────────────────────────────
 *   { id, source (string hint), level, grammar, target: [{text, audioSlug, labels?}] }
 *   - source: native-language hint shown to learner (never validated for target rules)
 *   - target[]: array of typed forms; no hierarchy among items (target[0] is not "base")
 *   - Every form requires audioSlug assigned by tools/assign-alt-slugs.mjs
 *   - Labels object (labels: { gender?, region?, register?, loanword? }) replaces the old
 *     type/hint/region/note fields; in a multi-form phrase every form must carry labels.
 *     The old type:'style' category was abolished (schema enforced by check-content.mjs).
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const JSON_DIR  = join(ROOT, 'shared', 'json');
const AUDIO_DIR = join(ROOT, 'shared', 'audio');

// ─── LANGUAGE PAIRS ───────────────────────────────────────────────────────────
// To add a new pair: add one entry here. All loops and path resolution is driven
// by this array — no other changes needed in this file (unless new rules are needed).

const PAIRS = [
  { id: 'es-en', sourceLang: 'es', targetLang: 'en' },
  { id: 'en-es', sourceLang: 'en', targetLang: 'es' },
];

// ─── TOPIC LISTS ─────────────────────────────────────────────────────────────

const PHRASE_TOPICS = [
  'emociones', 'greetings', 'restaurant', 'supermarket', 'kitchen',
  'transportation', 'airport', 'accommodation',
  'movies', 'music', 'theater', 'museums', 'gym', 'technology', 'accountability', 'personal_info', 'family', 'daily_routine', 'health', 'weather', 'directions', 'survival',
  'descripciones',
];

const VOCAB_TOPICS = [
  'general', 'verbos_basicos', 'verbos_avanzados', 'adjetivos_basicos', 'adjetivos_avanzados',
  'colores', 'naturaleza', 'tiempo', 'lugares', 'cantidad', 'juegos', 'ropa', 'lengua',
  'sociedad_politica', 'trabajo', 'educacion',
  'greetings', 'family', 'emociones', 'health', 'restaurant', 'supermarket', 'kitchen',
  'transportation', 'airport', 'accommodation',
  'movies', 'music', 'theater', 'museums', 'gym', 'technology', 'accountability',
];
// Vocabulary is target-centric: shared/json/vocab/{targetLang}/ (English + Spanish today).
const VOCAB_LANGS = ['en', 'es'];

// ─── AUDIO VOICE LEADERS (ONE PER LANGUAGE) ──────────────────────────────────

const LANG_VOICE_LEADERS = {
  en: 'af_heart',      // es-en pair (Kokoro)
  es: 'ef_dora',       // en-es pair (edge-tts)
  fr: 'ff_siwis',
  de: 'df_hedda',
  it: 'if_sara',
  pt: 'pf_dora',
  nl: 'nlf_colette',
  pl: 'plf_zofia',
  sv: 'svf_sofie',
  no: 'nof_pernille',
  da: 'daf_christel',
  fi: 'fif_selma',
  cs: 'csf_vlasta',
  lv: 'lvf_everita',
  lt: 'ltf_ona',
  et: 'etf_anu',
};

// ─── CONTENT RULES (PER TARGET LANGUAGE) ─────────────────────────────────────

const CONTENT_RULES = {

  es: {
    label: 'Spanish (neutral)',

    anglicisms: [
      { pattern: /\bapp\b/i,         suggestion: 'aplicación' },
      { pattern: /\bapps\b/i,        suggestion: 'aplicaciones' },
      { pattern: /\bemail\b/i,       suggestion: 'correo electrónico' },
      { pattern: /\bstreaming\b/i,   suggestion: 'transmisión' },
      { pattern: /\bcheck-in\b/i,    suggestion: 'registro' },
      { pattern: /\bcheck-out\b/i,   suggestion: 'salida' },
      { pattern: /\bcarpool\b/i,     suggestion: 'viaje compartido' },
      { pattern: /\bridesharing\b/i, suggestion: 'transporte compartido' },
      { pattern: /\bupgrade\b/i,     suggestion: 'mejora de clase' },
      { pattern: /\brevival\b/i,     suggestion: 'reposición' },
    ],

    regionalTerms: [
      { pattern: /\bpatatas?\b/i,     neutral: 'papas',           region: 'España' },
      { pattern: /\bordenador\b/i,    neutral: 'computadora',     region: 'España' },
      { pattern: /\bfrigorífico\b/i,  neutral: 'refrigerador',    region: 'España' },
      { pattern: /\baparcamiento\b/i, neutral: 'estacionamiento', region: 'España' },
    ],

    grammarChecks: {
      vosotrosParadigmPatterns: [
        /\bsois\b/,
        /\bestáis\b/,
        /\bfuisteis\b/,
        /\b-asteis\b/,
        /\b-isteis\b/,
        /\b-abais\b/,
        /\b-íais\b/,
        /\b-éis\b/,
        /\b-áis\b/,
        /\bos \(you all\)/i,
        /Forms: me, te, le, nos, os/,
        /me \(me\), te \(you\)[^)]*os \(you all\)/i,
      ],
      vosotrosDialoguePatterns: [
        /\b\w+(?:asteis|isteis)\b/i,
        /\b(?:vosotros|vosotras)\b/i,
        /\b\w+[áé]is\b/,
      ],
    },
  },

  // ─── TEMPLATE FOR A NEW TARGET LANGUAGE ──────────────────────────────────
  // fr: {
  //   label: 'French',
  //   anglicisms: [ { pattern: /\bemail\b/i, suggestion: 'courriel' } ],
  //   regionalTerms: [],
  //   grammarChecks: null,
  // },

};

// ─── CEFR WORD COUNT LIMITS (Rule 5) ─────────────────────────────────────────
const WORD_LIMIT = { A1: Infinity, A2: Infinity, B1: 12, B2: 14, C1: 16, C2: 18 };

// ─── GENERIC ID SUFFIX PATTERNS (Rule 15) ────────────────────────────────────
// A slug ending with these patterns signals a counter/placeholder rather than
// a description of the phrase's actual content. Matched at the END of the slug
// (after stripping the topic prefix) so "_new_museum" does not false-positive.
const GENERIC_ID_SUFFIX_RE = /(_\d+|_new|_alt|_extra)$/i;

// ─── ISSUE COLLECTION ────────────────────────────────────────────────────────
const _issues = [];

function issue(file, id, field, msg) {
  _issues.push({ file, id: id ?? '—', field, msg });
}

// ─── UNIVERSAL CHECK FUNCTIONS ───────────────────────────────────────────────

function checkEmDash(text, file, id, field) {
  if (!text) return;
  if (/—/.test(text))
    issue(file, id, field, `em dash "—" — replace with comma or conjunction (Rule 6)`);
  if (/;/.test(text))
    issue(file, id, field, `semicolon ";" — replace with comma or conjunction (Rule 6)`);
  if (/:/.test(text))
    issue(file, id, field, `colon ":" — replace with comma or conjunction (Rule 6)`);
}

function checkWordCount(phrase, level, file, id) {
  const limit = WORD_LIMIT[level];
  if (!limit || limit === Infinity || !phrase) return;
  const count = phrase.trim().split(/\s+/).length;
  if (count > limit)
    issue(file, id, 'target[0]', `${count} words — exceeds ${level} limit of ${limit} (Rule 5)`);
}

function checkIdUniqueness(items, file, idKey) {
  const seen = new Set();
  for (const item of items) {
    const id = item[idKey];
    if (seen.has(id))
      issue(file, id, idKey, `duplicate ID — will corrupt SRS history (Rule 2)`);
    seen.add(id);
  }
}

// ─── RULE 15: ID SLUG CHECK ──────────────────────────────────────────────────
// Detects generic suffixes at the END of the slug (after stripping the topic
// prefix), so "_new_museum" or "_discovery_new_city" are NOT false positives.

function checkIdSlug(id, topic, file) {
  const prefix = `${topic}_`;
  const slug   = id.startsWith(prefix) ? id.slice(prefix.length) : id;
  if (GENERIC_ID_SUFFIX_RE.test(slug)) {
    const m = slug.match(GENERIC_ID_SUFFIX_RE)[0];
    issue(file, id, 'id',
      `generic suffix "${m}" in ID slug — update to describe current content (Rule 15)`);
  }
}

// ─── FORM OBJECT HELPERS ────────────────────────────────────────────────────
// New schema: every form is { text, audioSlug, labels? }. The legacy string form
// and the type/hint/region/note fields were abolished. Residual `type` and missing
// `labels` on multi-form phrases are enforced by check-content.mjs; here we only
// resolve the text and verify audioSlug presence.

function altText(alt, file, id, field) {
  if (typeof alt === 'string') {
    issue(file, id, field, `legacy string form "${alt}" — convert to typed object { text: "...", audioSlug: "...", labels: {...} }`);
    return alt;
  }
  if (alt && typeof alt.text === 'string') {
    if (alt.audioSlug === undefined) {
      issue(file, id, field, `form missing audioSlug — run: node tools/assign-alt-slugs.mjs`);
    }
    return alt.text;
  }
  return '';
}

// ─── LANGUAGE-SPECIFIC CHECK FUNCTIONS ───────────────────────────────────────

function checkAnglicisms(text, file, id, field, rules) {
  if (!text || !rules) return;
  for (const { pattern, suggestion } of rules.anglicisms) {
    if (pattern.test(text)) {
      const match = text.match(pattern)?.[0];
      issue(file, id, field,
        `anglicism "${match}" — replace with "${suggestion}" or remove entry if no natural equivalent (Rule 4)`);
    }
  }
}

function checkRegionalTerms(text, file, id, field, rules, isAlternatives = false) {
  if (!text || !rules || isAlternatives) return;
  for (const { pattern, neutral, region } of rules.regionalTerms) {
    if (pattern.test(text)) {
      const match = text.match(pattern)?.[0];
      issue(file, id, field,
        `regional term (${region}) "${match}" — use neutral "${neutral}" in base; ${region} variant goes in target alternatives (Rule 4)`);
    }
  }
}

// ─── PHRASE FILE AUDIT (per-pair schema) ─────────────────────────────────────
// Schema: { id, source (string), level, grammar, target: [{text, audioSlug?, labels?, type?}] }
// Checks: JSON validity, ID uniqueness, legacy field detection, em dash,
//         word count (target[0]), target[] audioSlug presence,
//         language-specific rules for source and target fields.

function auditPhraseFile(topic, pairId, sourceLang, targetLang) {
  const file = `shared/json/pairs/${pairId}/${topic}.json`;
  const absPath = join(ROOT, file);
  if (!existsSync(absPath)) return;

  let data;
  try { data = JSON.parse(readFileSync(absPath, 'utf8')); }
  catch (e) { issue(file, null, 'JSON', `syntax error: ${e.message}`); return; }

  const phrases = data.phrases ?? [];
  checkIdUniqueness(phrases, file, 'id');

  const srcRules = CONTENT_RULES[sourceLang] || null;
  const tgtRules = CONTENT_RULES[targetLang] || null;

  for (const p of phrases) {
    const id = p.id;
    checkIdSlug(id, topic, file);

    // Detect legacy fields from the old bilingual schema
    if (p.phrase !== undefined)
      issue(file, id, 'phrase', 'legacy field "phrase" found — file needs re-migration');
    if (p.translations !== undefined)
      issue(file, id, 'translations', 'legacy field "translations" found — file needs re-migration');
    if (p.alternatives !== undefined)
      issue(file, id, 'alternatives', 'legacy field "alternatives" found — file needs re-migration');

    // em dash in source (hint text)
    checkEmDash(p.source, file, id, 'source');

    // target[] validation
    (p.target ?? []).forEach((item, i) => {
      const field = `target[${i}]`;
      const text  = altText(item, file, id, field);
      checkEmDash(text, file, id, field);
    });

    // Word count: checked against target[0].text (base practice form)
    const baseText = p.target?.[0]?.text;
    if (baseText && p.level) checkWordCount(baseText, p.level, file, id);

    // Language-specific: source field is in sourceLang
    if (srcRules) {
      checkAnglicisms(p.source, file, id, 'source', srcRules);
      checkRegionalTerms(p.source, file, id, 'source', srcRules, false);
    }

    // Language-specific: target[] items are in targetLang
    if (tgtRules) {
      (p.target ?? []).forEach((item, i) => {
        const field = `target[${i}]`;
        const text  = typeof item === 'string' ? item : (item.text ?? '');
        const isRegional = typeof item === 'object' && item.labels?.region !== undefined;
        checkAnglicisms(text, file, id, field, tgtRules);
        // Regional terms are allowed in target[] when the form declares labels.region
        checkRegionalTerms(text, file, id, field, tgtRules, isRegional);
      });
    }
  }
}

// ─── VOCAB FILE AUDIT (per-pair — word selection and CEFR levels diverge) ────

function auditVocabFile(lang, topic, esRules) {
  const filename = topic === 'general' ? 'words.json' : `words-${topic}.json`;
  const file = `shared/json/vocab/${lang}/${filename}`;
  const absPath = join(ROOT, file);
  if (!existsSync(absPath)) return;

  let data;
  try { data = JSON.parse(readFileSync(absPath, 'utf8')); }
  catch (e) { issue(file, null, 'JSON', `syntax error: ${e.message}`); return; }

  const words = data.words ?? [];
  checkIdUniqueness(words, file, 'id');

  for (const w of words) {
    const id = w.id;

    if (!w.term)       issue(file, id, 'term',        'missing required field — the target-language term (Rule 4)');
    if (!w.definition) issue(file, id, 'definition',  'missing required field — a monolingual target-language definition (Rule 4)');
    if (!w.translations || !Object.keys(w.translations).length)
      issue(file, id, 'translations', 'missing required field — at least one source-language translation (L1 anchor)');

    // Rule 6: no em dash / colon / semicolon in any text field.
    const allText = [
      ['term', w.term], ['definition', w.definition], ['example', w.example],
      ...Object.entries(w.translations   || {}).map(([k, v]) => [`translations.${k}`,   v]),
      ...Object.entries(w.gloss          || {}).map(([k, v]) => [`gloss.${k}`,          v]),
      ...Object.entries(w.gloss_example  || {}).map(([k, v]) => [`gloss_example.${k}`,  v]),
    ];
    for (const [key, text] of allText) checkEmDash(text, file, id, key);

    // Anglicisms / regional terms apply to Spanish text wherever it lives: the
    // target fields when this is the Spanish vocab, plus any Spanish source gloss.
    if (esRules) {
      const spanishFields = [];
      if (lang === 'es') spanishFields.push(['term', w.term], ['definition', w.definition], ['example', w.example]);
      if (w.translations?.es)  spanishFields.push(['translations.es',  w.translations.es]);
      if (w.gloss?.es)         spanishFields.push(['gloss.es',         w.gloss.es]);
      if (w.gloss_example?.es) spanishFields.push(['gloss_example.es', w.gloss_example.es]);
      for (const [key, text] of spanishFields) {
        checkAnglicisms(text, file, id, key, esRules);
        checkRegionalTerms(text, file, id, key, esRules, false);
      }
    }
  }
}

// ─── GRAMMAR FILE AUDIT (per-pair path) ───────────────────────────────────────

function auditGrammarFile(pairId, targetLang) {
  const file = `shared/json/pairs/${pairId}/grammar-rules.json`;
  const absPath = join(ROOT, file);
  if (!existsSync(absPath)) return;

  let data;
  try { data = JSON.parse(readFileSync(absPath, 'utf8')); }
  catch (e) { issue(file, null, 'JSON', `syntax error: ${e.message}`); return; }

  const langRules = targetLang ? (CONTENT_RULES[targetLang] || null) : null;
  const gc = langRules?.grammarChecks;

  for (const rule of (data.rules ?? [])) {
    const id = rule.id;

    const dialogueSentences = [
      ...(rule.context_dialogue?.map((d, i) =>
        ({ text: d.text, field: `context_dialogue[${i}].text` })) ?? []),
      ...(rule.structured_input?.map((s, i) =>
        ({ text: s.sentence, field: `structured_input[${i}].sentence` })) ?? []),
      ...(rule.quiz?.map((q, i) =>
        ({ text: q.sentence, field: `quiz[${i}].sentence` })) ?? []),
    ];

    for (const { text, field } of dialogueSentences) {
      if (langRules) checkEmDash(text, file, id, field);
      if (langRules) {
        checkAnglicisms(text, file, id, field, langRules);
        checkRegionalTerms(text, file, id, field, langRules, false);
      }
    }

    if (gc?.vosotrosParadigmPatterns) {
      const expClean = (rule.explanation ?? '')
        .replace(/\*\([^)]*vosotros[^)]*\)\*/gi, '')
        .replace(/\(In Spain[^)]*\)/gi, '');

      for (const pat of gc.vosotrosParadigmPatterns) {
        if (pat.test(expClean)) {
          issue(file, id, 'explanation',
            `vosotros form in primary paradigm (${pat}) — move to *(In Spain …)* note (CLAUDE.md)`);
          break;
        }
      }
    }

    if (gc?.vosotrosDialoguePatterns) {
      for (const { text, field } of dialogueSentences) {
        if (!text) continue;
        for (const pat of gc.vosotrosDialoguePatterns) {
          if (pat.test(text)) {
            issue(file, id, field,
              `vosotros form "${text.match(pat)?.[0]}" in exercise/dialogue — replace with ustedes form (CLAUDE.md)`);
            break;
          }
        }
      }
    }
  }
}

// ─── PLACEMENT FILE AUDIT (per-pair) ─────────────────────────────────────────

function auditPlacementFile(pairId) {
  const file = `shared/json/pairs/${pairId}/placement.json`;
  const absPath = join(ROOT, file);
  if (!existsSync(absPath)) return;

  let data;
  try { data = JSON.parse(readFileSync(absPath, 'utf8')); }
  catch (e) { issue(file, null, 'JSON', `syntax error: ${e.message}`); return; }

  const questions = data.questions ?? [];
  for (const [i, q] of questions.entries()) {
    checkEmDash(q.q, file, `[${i}]`, 'q');
    (q.options ?? []).forEach((opt, j) =>
      checkEmDash(opt, file, `[${i}]`, `options[${j}]`));
  }
}

// ─── PHRASE AUDIO ALIGNMENT CHECK (per-pair, slug-based) ─────────────────────
// Checks ALL non-style forms (base + alts) in a single pass using audioSlug.

function checkPhraseAudioAlignment(topic, pairId, targetLangCode) {
  const jsonPath  = join(JSON_DIR, 'pairs', pairId, `${topic}.json`);
  const audioPath = join(AUDIO_DIR, pairId, topic);
  if (!existsSync(jsonPath) || !existsSync(audioPath)) return;

  const data    = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const phrases = data.phrases ?? [];
  const fileRef = `shared/json/pairs/${pairId}/${topic}.json`;

  const leaderVoice = LANG_VOICE_LEADERS[targetLangCode];
  if (!leaderVoice) return;

  const genCmd = targetLangCode === 'en'
    ? `node tools/generate-audio.mjs --topic ${topic}`
    : `python tools/generate-audio-tgt.py --lang ${targetLangCode} --topic ${topic}`;

  // Collect all (phraseId, slug) pairs that need audio
  const expected = [];
  for (const p of phrases) {
    for (const form of (p.target ?? [])) {
      if (typeof form === 'object' && form.audioSlug) {
        expected.push({ phraseId: p.id, slug: form.audioSlug });
      }
    }
  }

  if (expected.length === 0) return;

  const missing = expected.filter(({ slug }) =>
    !existsSync(join(audioPath, `${slug}-${leaderVoice}.wav`))
  );

  if (missing.length === 0) return;

  // If NOTHING has been generated yet, report a single summary
  if (missing.length === expected.length) {
    issue(fileRef, null, `audio_${targetLangCode}`,
      `${targetLangCode.toUpperCase()} audio not generated for ${expected.length} form(s) — run: ${genCmd}`);
    return;
  }

  // Some generated, some missing — report individually
  for (const { phraseId, slug } of missing) {
    issue(fileRef, phraseId, `audio_${targetLangCode}`,
      `${targetLangCode.toUpperCase()} audio missing: ${slug}-${leaderVoice}.wav — run: ${genCmd}`);
  }
}

// ─── VOCAB AUDIO ALIGNMENT CHECK (shared, slug-based) ────────────────────────

function checkVocabAudioAlignment(lang, topic) {
  const jsonFile    = topic === 'general' ? 'words.json' : `words-${topic}.json`;
  const audioSubdir = topic === 'general' ? 'vocab' : `vocab_${topic}`;
  const fileRef     = `shared/json/vocab/${lang}/${jsonFile}`;
  const leaderVoice = LANG_VOICE_LEADERS[lang];
  if (!leaderVoice) return;

  // Vocab is target-centric: shared/json/vocab/{lang}/ speaks its language's voices
  // under shared/audio/{lang}/{audioSubdir}.
  const jsonPath  = join(JSON_DIR, 'vocab', lang, jsonFile);
  const audioPath = join(AUDIO_DIR, lang, audioSubdir);
  if (!existsSync(jsonPath) || !existsSync(audioPath)) return;
  const words = (JSON.parse(readFileSync(jsonPath, 'utf8')).words) ?? [];

  let found = 0;
  for (const w of words) {
    if (existsSync(join(audioPath, `${w.id}-${leaderVoice}.wav`))) found++;
  }
  if (found === 0) return;  // not yet generated for this language

  if (found !== words.length) {
    const missing = words.length - found;
    const genCmd = lang === 'en'
      ? `node tools/generate-audio.mjs --topic ${audioSubdir}`
      : `python tools/generate-audio-tgt.py --lang ${lang} --topic ${audioSubdir}`;
    issue(fileRef, null, `audio_${lang}`,
      `${lang.toUpperCase()} mismatch: ${missing} ${leaderVoice} files missing of ${words.length} — run: ${genCmd}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const quick   = args.includes('--quick');
const fileIdx = args.indexOf('--file');
const fileArg = fileIdx !== -1 ? args[fileIdx + 1] : null;

const pairIds = PAIRS.map(p => p.id);

if (fileArg) {
  // ── Single-file mode (used by the Claude Code PostToolUse hook) ──
  // Detect pair from path (e.g. shared/json/pairs/es-en/greetings.json → 'es-en')
  const normalised = fileArg.replace(/\\/g, '/');
  const pathParts  = normalised.split('/');
  const base       = basename(fileArg);
  const parentDir  = pathParts[pathParts.length - 2];
  const pairId     = pairIds.includes(parentDir) ? parentDir : null;

  const isVocab     = base.startsWith('words') && !pairId;
  const isGrammar   = base === 'grammar-rules.json';
  const isPlacement = base === 'placement.json';

  if (pairId && isGrammar) {
    const pair = PAIRS.find(p => p.id === pairId);
    auditGrammarFile(pairId, pair ? pair.targetLang : null);
  } else if (pairId && isPlacement) {
    auditPlacementFile(pairId);
  } else if (pairId) {
    const topic = base.replace('.json', '');
    if (PHRASE_TOPICS.includes(topic)) {
      const pair = PAIRS.find(p => p.id === pairId);
      if (pair) auditPhraseFile(topic, pairId, pair.sourceLang, pair.targetLang);
    }
  } else if (isVocab) {
    const topic = base === 'words.json' ? 'general' : base.replace('words-', '').replace('.json', '');
    auditVocabFile(topic, CONTENT_RULES.es);
  }
} else {
  // ── Full audit ──
  for (const { id, sourceLang, targetLang } of PAIRS) {
    for (const t of PHRASE_TOPICS) auditPhraseFile(t, id, sourceLang, targetLang);
    auditGrammarFile(id, targetLang);
    auditPlacementFile(id);
  }

  for (const lang of VOCAB_LANGS) for (const t of VOCAB_TOPICS) auditVocabFile(lang, t, CONTENT_RULES.es);

  if (!quick) {
    for (const { id, targetLang } of PAIRS) {
      for (const t of PHRASE_TOPICS) checkPhraseAudioAlignment(t, id, targetLang);
    }
    for (const lang of VOCAB_LANGS) for (const t of VOCAB_TOPICS) checkVocabAudioAlignment(lang, t);
  }
}

// ─── REPORT ───────────────────────────────────────────────────────────────────

if (_issues.length === 0) {
  process.stdout.write('✓ ALL CLEAR — 0 issues found\n');
  process.exit(0);
} else {
  const byFile = {};
  for (const iss of _issues) {
    (byFile[iss.file] ??= []).push(iss);
  }

  process.stderr.write(`\n✗ ${_issues.length} issue${_issues.length === 1 ? '' : 's'} found:\n\n`);
  for (const [file, issues] of Object.entries(byFile)) {
    process.stderr.write(`  ${file} (${issues.length}):\n`);
    for (const iss of issues) {
      process.stderr.write(`    [${iss.id}] ${iss.field}: ${iss.msg}\n`);
    }
  }
  process.stderr.write('\n');
  process.exit(1);
}
