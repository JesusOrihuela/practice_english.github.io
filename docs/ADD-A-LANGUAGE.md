# Adding a language / pair

Architecture goal: adding a target language costs the same whether it's #3 or #10 —
everything is derived from the content tree + `shared/js/lang-profiles.js`, and the
completeness gate (`check-lang-profiles`) fails CI on anything missing. This is the single
committed reference for **everything** a new language/pair needs: what CI enforces, what you
do by hand, the per-language linguistic extension points, and the content-authoring
conventions that replicate per language. If you forget a **gated** item, CI tells you exactly
what.

---

## 0. RULE — the coverage frequency list (do this first)

Every target language uses **ONE reference list** to drive the coverage gate, and that list
must be all three of:

1. **Committeable** — permissive license (CC BY / CC BY-SA / CC0 / public domain / public
   reference). **Never NonCommercial**, never anything that can't ship in this MIT repo.
2. **Curated / high quality** — pedagogical and CEFR-graded (or the language's equivalent),
   **not raw corpus frequency**.
3. **Single** — one list per language. **No** "committeable-but-weak in CI + good-but-local"
   split. If the best list isn't committeable, find another that is; never trade quality for
   license or vice-versa.

**Why:** two lists produce two conflicting numbers, license risk, and a weak gate. Examples
that satisfy the rule:

| Lang | List | How it's built | Committeable |
|------|------|----------------|--------------|
| en | **NGSL** (New General Service List) | `ngsl-en.json` (curated frequency list) | CC BY-SA |
| es | **PCIC** (Instituto Cervantes) | `tools/sources/build-pcic-core.py` → `es-core.json`: PCIC Inventario de nociones (A1-B2) gives the curated CEFR **membership + grade**; FrequencyWords (CC BY-SA) gives only the within-level frequency order; tokens lemmatized with `simplemma`. Top-1000 = official A1-A2 vocabulary. | Public reference + CC BY-SA |

For a **new language**, find its equivalent curated + committeable + CEFR list on day one
(a national reference syllabus, an open CEFR-graded lexicon, or a curated frequency list).
Emit a `{ lang, ranks: {lemma: rank} }` index into `tools/sources/derived/<gateIndex>`, add
its `!` exception in `.gitignore`, attribute it in `CREDITS.md`. ELELex-style resources that
are CC BY-**NC**-SA may only be a LOCAL cross-check (`frequency.localIndex`), never the gate.

---

## 1. Gated — CI fails until these exist (fill the profile or fail)
- **`shared/js/lang-profiles.js` entry** for the target code with every required field:
  `foldPreserve`, `nativeChars`, `clozeStopWords`, `functionWords`, `ignoreTokens`, `voices`,
  `grammarTipLabels`, `frequency: { list, gateIndex, gateFloor }`, `tts: { engine }`.
  - `nativeChars` — the non-ASCII letters/marks the language legitimately uses (lowercase; '' if
    pure ASCII). Drives the wrong-language check for grammar tips (`check-content` R11).
- **Detector block** in `tools/lang-detectors.mjs` (grammar evidence) — required by
  `check-lang-profiles`.
- **Gender-detector block** in `tools/gender-detectors.mjs` — REQUIRED (and gated by
  `check-lang-profiles`) whenever the profile has `grammaticalGender: true`. A self-contained object
  per language (`personNouns`, `personAdjs`, `personCtx`, `arts`, `irregular`, and its OWN morphology
  methods `gestureGendered`/`isGenderInfl`/`bothGendersPresent`/`retainedAdjMismatch` — gender
  inflection differs per language, so the language provides it, and `check-variants` stays generic).
  A non-gendered target (English) needs none. This is what makes gender detection perfil-driven: a new
  gendered language adds a block here, zero edits to the audit tools.
- **Committed frequency index** at `tools/sources/derived/<gateIndex>` — see §0 for the rule
  and the build pattern (`build-pcic-core.py` for es, `ngsl-en.json` for en). Calibrate
  `gateFloor` a couple points below live coverage (a **ratchet** you raise as content grows);
  the north-star sweet spot is **88%** in both channels.
- **CONTENT_RULES block** in `tools/audit.mjs` (key = ISO 639-1) with the language's
  `anglicisms[]`, `regionalTerms[]`, `grammarChecks` — the anglicism/regional audit now checks
  every field in the language it is written in, so a missing block silently skips those checks.
- **Content**: `shared/json/pairs/<pair>/*.json` (+ `topics.json`, `grammar-rules.json`) and
  target-language vocab in `shared/json/vocab/<lang>/`. The deterministic gates
  (`check-content`, `check-taxonomy`, `check-audio`, `check-i18n`) then apply automatically.
- **Pair runtime completeness** (`check-pair-completeness.mjs`) — the runtime assets/wiring shared
  code assumes exist (the class of gaps the first divergent pair, en-de, exposed by hand):
  - **Flags**: every code in the pair's `source.flags` / `target.flags` (`lang-pair.js`) has a real
    `shared/img/flags/<code>.svg`. A missing asset shows a blank flag in the badge/picker.
  - **Grammar categories**: every `rule.category` in `grammar-rules.json` is defined in that file's
    `categories[]` — otherwise `grammar.js` renders an **empty grid** (only deep-linked `?rule=`
    works). A `grammar-rules.json` with rules MUST ship a `categories[]`.
  - **Placement**: the pair has a `placement.json` with a non-empty `questions[]`.
  - **Quiz viability** (warning): each vocab deck has ≥ 4 words so the Quiz can build 4 options.
  - *Infra note:* the topic/path loaders (`topics.js`, `path.js`) are hardened to be robust to
    `<script>` order and to not cache an attempt made before their deps are defined — a divergent
    pair no longer silently falls back to the default topic list. Keep the documented order anyway
    (`topic-data.js` → `topics.js` → `path.js`).

## 2. Not gated — do these by hand (no check can infer them)
- **`shared/js/lang-pair.js` `PAIRS`**: add the pair (flags, `name`, `localName`) — display
  data that can't be derived.
- **`tools/audit.mjs` `PAIRS`**: register `{ id, sourceLang, targetLang }` for the new pair.
- **`lang/ui.js`**: a UI block for a new SOURCE language (full key set; `check-i18n` then
  verifies it resolves). Topic labels cross-check is es/en-only (topics.json stores those two).
- **Audio**: generate it with the engine your profile's `tts.engine` names
  (`kokoro` → `tools/generate-audio.mjs`, `edge` → `tools/generate-audio-tgt.py`); the voice
  set is read from `lang-profiles.voices`. `check-audio` then validates it. **IMPORTANT: kokoro-js
  ships voices for English ONLY**, so `tts.engine:'kokoro'` works for `en` alone — **every
  non-English target must use `tts.engine:'edge'`** (Azure Neural via `generate-audio-tgt.py`), even
  Portuguese/French/Italian, which the Kokoro-82M model nominally supports but kokoro-js does not
  expose. (The en-pt stress-test surfaced this; the project's old "pt = kokoro" assumption was wrong.)
- **Perceptual curation** (dev-only, advisory): run `classify`/`semantic-audit` while
  authoring, `audit-images` / `audio-asr-audit` / `gloss-audit` over the new content.

## 3. Per-language linguistic extension points (add a block, keyed by lang)
These legitimately branch on the language (they encode that language's linguistics) — a new
language ADDS its block, like a detector:
- `tools/lib-freq.mjs` `lookupRank` — the morphology (plural/gender/verb→infinitive) block.
- `tools/build-candidates*.mjs` (dev-only) — the frequency-line source per language.
- Everything else (accent-fold, cloze stop-words, function words, wrong-language chars,
  anglicisms, cognates) is now DATA in `lang-profiles` / `CONTENT_RULES`, not code branches.

---

## 4. Content-authoring conventions that replicate per language

These are the authoring rules that recur for every language. Some are gated (deterministic);
the rest are author judgment — apply them by hand. The full prose lives in `CLAUDE.md`; this is
the checklist so nothing is tribal when a new pair is added.

- **Genuine categorization over filling a bucket.** Every phrase/word goes in the category its
  MEANING belongs to, never the one that's convenient to demonstrate a feature. A category with a
  SINGLE phrase or word is valid and preferred over piling unrelated items into one (`en-de` first
  shipped 11 phrases in `survival`; only 4 were survival — the rest were split into `personal_info`,
  `family`, `descripciones`, `daily_routine`, `calendario`, `technology`, `economia`, one phrase
  each). Categories reuse existing topic ids so their shared images/`_ID_MAP` wiring already exist.
  Recategorizing a phrase = move it to the correct `<topic>.json`, rename its id to the `<topic>_`
  prefix, AND move its `shared/audio/<pair>/<topic>/` wav files (the audioSlug is unchanged, so no
  regen). Then `grammar-topics --write` + `fix-phrase-ids` pick it up.

### Gated automatically (no thought needed — CI enforces)
- Em dash / colon / semicolon ban; terminal punctuation; word-count by CEFR (Rule 5/6/17).
- Duplicate IDs; duplicate practiced phrases; `_ID_MAP` freshness; taxonomy/scope.
- `labels` present on every multi-form phrase; valid label **keys** AND **values**
  (`gender` ∈ masculino/femenino/neutro, `register` ∈ formal/informal — Rule 16 §6/§8).
- Anglicisms / regional terms per language (needs the CONTENT_RULES block, §1).
- Wrong-language characters in grammar tips (needs `nativeChars`, §1).
- Grammar-tip length; anti-pedagogical patterns (Rule 11).

### The variant system (OPEN — the replication backbone)
Variants (gender, region, number, case, register, loanword, synonym, **definiteness**, **standard** —
and anything a future language needs) are driven by ONE data-driven registry,
`shared/js/variant-dimensions.js` (dual-mode: browser + Node). The stress-test pairs proved this by
adding new axes data-only: `case` (de/fi/pl), `number` (de), `definiteness` (sv/no — the North-Germanic
suffixed definite article, hus→huset), and `standard` (no — Bokmål/Nynorsk, the first axis that is
NEITHER geographic NOR grammatical, so its badge is TEXT not a flag). To give a new language its own
axes (grammatical case, honorifics, noun class, evidentiality…), add a dimension THERE — no code
change: `check-content` validates its label values, `feedback.js` badges
it and lists it in the post-answer combinations, and `check-variants` checks its completeness, all
from the registry. **This openness is CI-enforced by `tools/variant-openness.mjs`** (validate job):
it registers a fictitious dimension at runtime and asserts the registry API, `validateLabels` (the
exact validator `check-content` runs), and `feedback.js`'s badge row all handle it with no code
change — so a consumer that hardcodes dimensions is caught and the guarantee can never silently
regress. Each dimension declares `kind`: **inflectional** (gender/number — forms of one
lemma, shown as the dictionary-style slash pattern / taught as the agreement rule) or **lexical**
(region/register/synonym/loanword — different words, shown by ROTATION: one form per session
(`Progress.pickVariant`, least-practiced first — there is NO "base" form) + the others as labelled
recognition variants, to avoid synonym interference — Tinkham/Waring/Webb). Two structural facts, both
registry-validated:
- **Phrases** may carry a per-form `source` (`target[].source`): the L1 hint shown adapts to the
  variant on screen. The 5 phrase activities read the picked form's source (`pickedForm.source ||
  p.source`), and the **same picked form drives the gender/region badge** — so hint and badge must
  never disagree. **The deciding factor is whether the TARGET carries gendered variants + whether the
  SOURCE language marks gender** (not "referent- vs speaker-determined"):
  - **Target has ONE form** (gender not a target variant) **and the source marks gender** → keep one
    combined-slash phrase `source` (Rule 14.4): `I have a cold.`→`Estoy resfriado/a.` (es-en: Spanish
    source, English target has no gender). No per-form source.
  - **Target carries ≥2 gendered forms** (each shown with the adaptive badge) → **each gendered form
    MUST carry its own faithful per-form `source`**, so the hint matches the badged gender. If the
    source marks gender this is mandatory (`Jestem studentem.`←`Ich bin Student.` /
    `Jestem studentką.`←`Ich bin Studentin.` — de-pl); a combined slash would contradict the badge,
    and a bare masculine fallback would mislabel the feminine form. If the source has **no** gender
    (English → `en-es` "I'm tired" for both `estoy cansado/a`), one genderless phrase source already
    fits every form, so per-form source is optional. `check-content` R14 enforces this: a gendered
    target form with a gender-marking source but no per-form `source` is flagged.
  - **Referent-determined variants** (the words genuinely differ: `El niño`/`La niña`) also get a
    per-form source — that case is subsumed by the rule above (≥2 gendered forms → per-form source).
  The phrase-level `source` remains the neutral label for the PhraseBrowser index (e.g. the German
  `Student/in.` slash), reached only as a fallback the exercises no longer hit for gendered forms.
- **Vocab words** may carry structured `variants[]` (`{text, labels, audioSlug}`) so words — not only
  phrases — have their variants, identified; `check-variants` scans them, and the flashcard renders
  the kind-differentiated display. LEXICAL variant words ROTATE (no base — `Progress.pickVariant`, like
  phrases) with per-form audio; INFLECTIONAL (gender/number/case) stay the dictionary slash and do not
  rotate. `coverage.mjs` counts `variants[].text`. **Audio for an inflectional-variant vocab word**:
  the generator emits ONE file per variant (`audioSlug`), not a term-id file, so the flashcard plays
  the FIRST variant's audio (the player handles this) — never rely on a `{wordId}.wav` for a word
  that has `variants[]`.
- **Variant vs. grammar phenomenon (decide before authoring)** — a **variant dimension** is a
  speaker/lexical CHOICE for the same slot (register du/Sie, gender -in Lehrer/Lehrerin, region
  Januar/Jänner, number sing/plural, case forms of a noun, loanword Handy/Mobiltelefon). A **grammar
  phenomenon** is determined by the sentence, not chosen: inherent noun gender (der/die/das),
  attributive-adjective concordancia (gén×caso×núm endings), separable verbs / V2 word order. Those
  are NOT variants — they go in **`grammar-rules.json`** (a rule + a `lang-detectors` regex + a
  `grammarTipLabels` mapping), never as `labels`. Trying to force them into `target[]` variants breaks
  the "differ by one inflection" concordancia invariant. (The registry still *supports* every value —
  e.g. `gender:neutro` — proven by `variant-openness`; you just may not have a natural variant for it.)
- **Inflectional agreement (concordancia)** — a gender/number variant differs ONLY by recognised
  inflection (article + noun + adjective + verb all agree); `check-variants` enforces it.

- **Variant completeness (RULE + PROCESS)** — if a phrase has ANY labelled variant, EVERY variant
  and combination that genuinely exists must be present: gender, region, register, AND their
  combinations. The detector `tools/check-variants.mjs` FINDS phrases missing region/gender
  variants (region-lexicon-driven + gendered-predicate rule); run it and curate to zero.
  **The region lexicon's provenance MUST come from an authoritative source, not a guess:**
  Spanish → **Diccionario de americanismos (ASALE)** (`asale.org/damer/<term>`, marks each sense's
  countries) + DLE for Spain; English → standard dictionary US/UK/AU marks + documented
  British-vs-American comparisons; a NEW language → that language's authoritative regional
  dictionary. Cite the source in `CREDITS.md`. **Gender is grammatical (rule-based, not sourced),
  and the detector's coverage is broad on purpose:** it flags any person whose gender can vary —
  3rd-person person-nouns (*ese muchacho/esa muchacha*, *mi vecino/vecina*) AND nominalised plural
  adjectives (*los más lentos/las más lentas*), via a curated person-term lexicon (nouns always;
  polysemous adjectives only in a person context — a 1st/2nd-person predicate or *los/las más …*).
  Two suppressors keep it actionable so only genuine within-phrase variants surface: (a) the SOURCE
  already fixes the gender (English *he/husband/boy* or a proper name → the single-gender translation
  is faithful, Rule 10/14.4), and (b) masculine-plural-only nouns (*hijos/hermanos/abuelos* = the
  standard generic for a group, which Rule 14.4 excludes). A gender-neutral source that the target
  must render in one gender (*My neighbor…* → *vecino/vecina*) is the real missing-variant case.
  A phrase with a gendered speaker *and* a region-varying word has all
  region×gender forms (e.g. 4 forms), each `target[]` carrying the full `labels: { region,
  gender }`. Regions are as fine as reality: not only España/Latinoamérica or US/UK, but
  country/zone variants where they differ (e.g. *palta* in much of South America vs *aguacate*
  in Mexico/Spain; Australian English; etc.). Never ship only one axis or one region when more
  genuinely exist. The adaptive badge and the post-answer "other variants" list surface them
  all (`AppFeedback.applyVariantBadge` / `buildAltNote`); `AppFlags.region(name)` gives each
  region a flag or a zone silhouette.
  - **Neutral / pan-regional variety is itself a first-class variant (RULE).** When a set has a
    neutral term used across the whole language area (Spanish *autobús*, *piscina* — valid
    everywhere), it is NOT an unlabelled base: it is shown as a labelled variant ("General") with
    its **own badge** — a world-globe SVG (`shared/img/regions/general.svg`, wired in
    `REGION_GLOBE`), distinct from a country flag or a macro-zone locator map — exactly like the
    country/region variants. Teach the finer sub-regional flavours (e.g. *camión*/*colectivo*/
    *guagua* for bus) on a **canonical** phrase or two per set rather than on every phrase, so the
    learner meets each variant without the same 4 forms repeating across the topic. The detector
    marks the neutral member `neutral: true`: a **lone neutral base is valid** (not flagged), but a
    lone REGIONAL term still requires its siblings. A set with no neutral term (Latam↔Spain splits
    like *celular/móvil*, or three-way *carro/coche/auto*) has every member carry its own region.
  - **RULE — create ALL the region assets.** When a pair introduces region labels you must provide the
    real SVG assets they resolve to: a **country flag** per country (`shared/img/flags/<iso2>.svg`,
    public-domain from Wikimedia Commons), a **flag cluster** for a multi-country zone (just its member
    flags — `AppFlags.cluster` shows up to 5 + "+N"), and a **macro-zone globe**
    (`shared/img/regions/*.svg`) for a continent-scale label, plus the neutral **General** globe. Map
    each label → codes/globe in `AppFlags.REGION_MAP` / `REGION_GLOBE` (`shared/js/flags.js`). No label
    may silently fall back to bare text. `tools/check-assets.mjs --gate` (CI `images` job) fails if any
    region label used in content lacks its asset — identifying and creating every needed asset is part
    of adding a language, not an afterthought.
- **Grammatical gender modeling** (Rule 10 / 16) — only for a target with grammatical gender
  (`grammaticalGender: true`). Base-gender conventions: 1st-person "I am [adj]" → base
  **feminine** + masculine variant; 2nd-person "you are [adj]?" → base **masculine** + feminine
  variant; 3rd-person gendered roles → both genders as variants. Every variant carries
  `labels.gender` and differs ONLY in the gendered term (Rule 16 §7). Keep base-gender balanced
  across a topic.
- **Combined-gender source hints** (Rule 14.4) — when the SOURCE language marks gender but the
  target phrase doesn't determine it, the source shows both endings with a slash:
  "Estoy resfriado/a." ← "I have a cold."; "Ellos/Ellas hablan francés." Scope: gendered words
  predicated of the speaker/addressee (1st/2nd person) and bare subject pronouns. NOT for
  gender fixed by the target, grammatical gender of nouns, generic 3rd-person, or masculine
  plurals for groups. (Applies to gendered SOURCE languages; the source is display-only, no
  audio.)
- **Register (formal/informal — tú/usted for es)** — add the T-V / politeness variant ONLY where
  BOTH registers genuinely occur: first-encounter, service (customer↔staff), addressing a stranger,
  doctor↔patient, courtesy. Intimate/emotional lines stay informal-only (single form) — never force
  the formal. Direction: the informal form is `target[0]`; the formal is the labelled variant; both
  carry `labels.register`. In vocab, a genuinely higher-register synonym (*cabello/pelo*, *rostro/cara*,
  *padecer/sufrir*) is `register`, not plain `synonym`. Lexical → it rotates; badge is a text pill
  ("Formal"/"Informal"); the source is SHARED (L1 rarely marks T-V, so no per-form source).
- **Synonym** — for interchangeable near-synonyms with the SAME meaning, region AND register
  (*razón/motivo*, *elegir/escoger*). **False-merge test (critical):** if the forms carry DIFFERENT
  meanings under one L1 gloss they are NOT synonyms — SPLIT them into separate cards (*carta/letra*;
  *drug* = medicamento vs droga). Verify each form against the entry's own definition/example before
  merging. Lexical → rotates; the recognition strip tags the others "también/also".
- **Loanword (as a variant)** — when a native term coexists with a widely-used borrowing
  (*portátil/laptop*, *sobreventa/overbooking*) the borrowed form may be a `loanword` variant (label the
  borrowed form `loanword`, the native one `synonym`/`region`). But NEVER invent a calque nobody says
  (that is the No-extranjerismos rule below), and a fully RAE-accepted borrowing (*software*, *wifi*,
  *pódcast*) is simply the term — no variant. Lexical → rotates; badge "préstamo/loanword".
- **Number (singular/plural)** — for Spanish this is NOT a content dimension and is deliberately NOT
  in the registry: plurals are authored as SEPARATE phrases/words, never `number` variants (the
  lemmatised coverage core doesn't distinguish them and plural is a grammar competency, taught in the
  Grammar section). A registry must never advertise a dimension with zero content. A FUTURE language
  whose plural is more than a "+s" suffix adds `number` back data-only (one registry line — the
  evidentiality openness test proves a new dimension needs no code), with `agreement`
  ['articulo','sustantivo','adjetivo','verbo'] so every plural variant changes the WHOLE concordance.
- **How variants appear in the INDEX (`PhraseBrowser`)** — the phrase index shows the L1 `source`
  (never the target, to avoid spoilers), so lexical variants (region/register/synonym/loanword) are
  NOT spelled out there; they surface only as **coverage pips** — one pip per form (a tú/usted phrase =
  2 pips), filled as each form is practised. GENDER is the exception: it rides in the `source` slash
  (*resfriado/a*, *Ellos/Ellas*, Rule 14.4) so it IS visible in the phrase index. The vocab index shows
  the `term` = the slash of ALL forms (*Pelo / Cabello*, *Carro / Coche / Auto*), so every dimension is
  visible there.
- **No extranjerismos** (Rule 4) — no loanwords where a genuine native term exists; if none
  exists, remove the entry rather than invent a calque. Use the language's authoritative
  dictionary (RAE for es, Merriam-Webster for en). Encode the concrete replacements in the
  CONTENT_RULES `anglicisms[]` so the audit catches regressions.
- **Neutral regional standard** — pick the language's neutral variety for base forms; regional
  terms go in variants with `labels.region`. Encode in CONTENT_RULES `regionalTerms[]`.
- **Source = faithful translation** (Rule 14) — the `source` is a faithful, natural translation
  of `target[0].text`, never a situational description or riddle.
- **Cognates** (`COGNATES` in lang-profiles, per language pair) — optional Quiz boost;
  `check-lang-profiles` WARNS (not fails) if a pair has no cognate table.
- **CEFR precision** (Rule 12) — vocabulary AND grammar of `target[0].text` must match the
  declared `level`. The `level` field is rating-system-agnostic (a string like "A1"); for a
  non-CEFR language (JLPT/HSK) add a mapping table in `lang-pair.js` and keep `level` a string.
- **Atomicity / categorization** (category-scopes) — every phrase/word in exactly one category
  by meaning; run `classify` before adding; omit rather than force a homeless item.

---

## 4c. Infrastructure invariants & pitfalls (the first divergent pair, en-de, hit every one)

Until en-de, every pair shared English/Spanish as source AND target, so shared code that silently
assumed the DEFAULT lists/assets never broke. A divergent pair exposes them. All of these are now
either **CI-gated** or **structurally fixed** — a new pair should not meet them again, but know them:

- **Flags need SVG ASSETS, not just codes.** Every code in a pair's `source.flags`/`target.flags`
  AND every `region` label's mapped code (`flags.js` `REGION_MAP`) must have a real
  `shared/img/flags/<code>.svg`. *Gated:* `check-pair-completeness`.
- **A language uses 1, 2 or 3+ flags — never assume two.** `source.flags`/`target.flags` is a list of
  ANY length (Finnish/Icelandic may want just `['fi']`/`['is']`; Spanish/German two; a language could
  need three). Render with **`AppFlags.langFlags(codes)`** (1 = single, 2 = overlapping stack, 3+ =
  cluster) — never `stack(flags[0], flags[1])`. The definition switch uses the FRONT flag
  (`flags[flags.length-1]`), also count-agnostic.
- **`grammar-rules.json` MUST ship `categories[]`** covering every rule's `category`, or the Grammar
  page renders an EMPTY grid (only deep-linked `?rule=` works). *Gated:* `check-pair-completeness`.
- **A pair needs `placement.json`** with questions. *Gated:* `check-pair-completeness`.
- **A vocab deck needs ≥ 4 words** or the Quiz can't build 4 options. *Warned:* `check-pair-completeness`.
- **Topic lists come from the pair's `topics.json`, loaded async.** `topics.js`/`path.js` loaders are
  hardened: they don't cache an attempt made before their deps (`AppData`/`AppTopics`) are defined,
  and are robust to `<script>` order — so a divergent pair no longer falls back to the 45-topic default
  in the grids OR the Progress summary. **Still keep the order `topic-data.js` → `topics.js` → `path.js`
  on EVERY page (index.html included).** `topics.js` eager-calls `load()` at parse; if `topic-data.js`
  (which defines `AppData`) hasn't loaded yet, that call rejects and — with no synchronous consumer to
  catch it — surfaces as an unhandled-rejection **pageerror** ("AppData not ready"). Functionally the
  page recovers (a later `load()` retries), but the error is real: the browser smoke suite fails on it.
  index.html shipped `topics.js` in `<head>` (before `topic-data.js` at body-end) and hit exactly this.
- **The Progress summary shows the pair's phrase topics AND its vocab-only decks** (each pair its own).
- **Variant tags are METALANGUAGE → source language + an inline-SVG ICON (never an emoji), for EVERY
  pair.** `feedback.js` renders every badge (`applyVariantBadge`, `buildWordVariants`) via `AppLang.t()`
  in the learner's SOURCE language (never the raw registry value — "Feminine"/"Femenino" by source, not
  always "Femenino"), capitalized, each axis with a crisp **inline SVG** icon from `feedback.js`'s
  `_ICON` map (theme-aware via `currentColor`, sized by `.variant-ico`): gender ♀/♂/⚲, register
  top-hat/speech-bubble, number, case (bullseye), loanword (globe), synonym (cycle); region uses its
  flag. **Do NOT use emoji** — the smoke suite asserts variant tags contain no emoji codepoint. A NEW
  dimension value needs an `alt_note_<dim>_<val>` key in EVERY `lang/ui.js` source block + (optionally)
  an SVG in `feedback.js`'s `_ICON`; with no icon the tag simply shows text, so the registry stays open.
  Inflectional variants (case/number/gender) are shown as labelled chips too (der/den/dem/des Mann →
  each with its case tag), not just an unlabelled slash headword.
- **Vocab audio of an inflectional slash term reads ALL forms**: the generator emits the term
  (`wordId`) audio (slash → comma → every inflection spoken); the flashcard plays it for non-rotated
  words. Lexical variants keep per-form rotation audio.
- **Grammar "✓ Done" means PASSED, not attempted**: it gates on `lapses === 0` (a failed round rates
  Hard → `lapses ≥ 1` → not Done), so getting a rule wrong no longer marks it complete.
- **No user-facing text hardcoded in CSS `content:`** — it can't be localized. Grammar's "The rule"
  divider uses `content: attr(data-label)` fed from `AppLang.t()`, not a literal string.
- **Vocab definitions — dual + level-adaptive + toggle (comprehensible at any level).** Every word
  ships BOTH an L1 gloss (`gloss.<src>`, source language) and an L2 `definition` (target language).
  The flashcard shows the L1 gloss by default at A1/A2 and the L2 definition at B1+, with a toggle
  (`#fc-def-toggle`) to swap; the L1 translation stays visible below as the safety net (no external
  lookup needed). **Content rule:** the **L2 definition must use CONTROLLED "defining vocabulary" at
  or below the entry's level** (the Longman/Oxford learner-dictionary principle) so a B1 word never
  gets a B2+ definition — and every word must carry both `gloss.<src>` and `definition`. This is
  **CI-enforced by `check-pair-completeness`**: for every pair, each vocab word of its target must have
  the L2 `definition` AND the L1 `gloss.<source>` (per pair, independently) — else the switch has no
  second side. The toggle is a **two-flag switch** (source flag left, target flag right, active one
  highlighted) on the definition line, driven by the pair's own `source`/`target` flags.
- **Grammar step-back + pass-gated skip** (shared, every pair): a `#phase-back-btn` returns to an
  earlier phase (gray, left of the blue "next", same row); the re-entry SKIP is set only when the
  learner PASSED (quality ≥ 3) — a failed learner sees the full lesson again.
- **Grammar buttons + spacing are ONE system** (shared, every pair). Forward buttons are all the
  same solid-blue button on the RIGHT; the single back button is the same shape in gray on the LEFT;
  both live in a `.phase-actions` row per phase (`--split` = space-between, tops aligned). Vertical
  rhythm comes from a SINGLE source — `.phase-section:not(.hidden)` is a flex column with `gap:16px`,
  so header/card/counter/progress/actions are all 16px apart; do NOT add per-element vertical margins
  inside a phase (they fight the gap and make the buttons look detached). A dynamic phase's Next is
  appended to its `.phase-actions` bar (`#structured-actions`/`#production-actions`), never the card.
  A per-phase hint (noticing's "Answer N to continue") goes INSIDE the action row (centered between
  back and next), never on its own line — an own line adds a gap slot and desyncs the card→button
  distance from the other phases. On RE-ENTRY (skip to practice), still build the earlier phases so
  the step-back button reveals them populated, not empty.
- **TTS voice availability**: edge-tts retires voices (de's `BerndNeural`, then fi's `SelmaNeural`, both
  gone → `ConradNeural` / `NooraNeural`). The failure is silent-ish: the generator prints `ERR … No audio
  was received` per missing voice and still says `Done`, so **never trust the summary without reading the
  ERR lines** (a whole voice can fail while its pair partner succeeds — half the files written). Confirm
  the current list with `edge-tts --list-voices | grep <locale>` BEFORE authoring, then keep
  `lang-profiles.voices`, `lang-pair.ttsVoices`, `audit.LANG_VOICE_LEADERS`, and BOTH generators'
  voice maps (`generate-audio-tgt.py`, `generate-audio.mjs`) in sync (same slug ids). `check-audio` then
  validates the files exist.
- **Article-less language → `term` = the lemma, not a slash list.** The vocab audio generator emits a
  `{wordId}` file speaking the whole `term` PLUS a `{audioSlug}` file per variant. German dodges a
  collision because its slash term carries articles (`der Mann`≠bare `mann`). A language with no articles
  (Finnish `talo`) would collide the id-file with the nominative-variant slug. Use the **dictionary lemma**
  (nominative singular) as `term` and put the inflected forms in `variants[]` — then the id-file and the
  nominative-variant file are the SAME text (harmless), and the case chips still rotate. (Finnish lemma =
  nominative singular anyway, so this is also the linguistically correct citation form.)
- **A target with NO grammatical gender** (`grammaticalGender:false`, e.g. Finnish): the gender dimension
  must NOT be in `case`/gender `appliesTo` for it, and `validateLabels({gender…}, lang)` returns
  `not-applicable` — the gender-variant path skips cleanly. Do not author gender variants; a role noun
  like "student" is ONE form (`Olen opiskelija`), unlike German `Student/Studentin`.
- **Case values are language-specific.** `case` is one shared dimension but German's 4 and Finnish's
  (a slice of its 15: `nominatiivi/partitiivi/genetiivi/inessiivi`) are DIFFERENT value strings; the
  registry's closed set is their UNION, gated per language by `appliesTo`. Add a badge i18n key
  (`alt_note_case_*` in `lang/ui.js`) + a `feedback._VAL_KEY.case` mapping for each new value, in the
  learner's SOURCE language.
- **`SLUG_MAX` (100)** truncates+hashes long slugs — but the phrase char limit (Rule 5) is also 100, so
  natural content rarely triggers it; a single long German compound in a normal sentence stays well
  under. It's enforced by `check-content`; don't author an over-limit phrase just to exercise it.
- **Node-loading a browser module**: a tool that `require()`s a shared `.js` (e.g. the pair gate reads
  `lang-pair.js`) needs that file to be dual-mode (`module.exports`) AND guard `window`/`document`/
  `localStorage` behind `typeof … !== 'undefined'`. `lang-profiles.js`, `variant-dimensions.js` and
  `lang-pair.js` follow this.

**After adding a pair, the green bar is:** `check-content`, `check-pair-completeness`,
`check-lang-profiles`, `check-variants --gate`, `check-length --gate`, `variant-openness`,
`check-i18n`, `check-a11y`, `check-images`, `check-taxonomy`, `audit`, `coverage --gate`,
`fix-phrase-ids --check`, `grammar-topics --check` — plus the browser smoke suite (`npm test`), which
now loads every screen for es-en, en-es AND each stress-test pair (en-de, en-fi) with zero page errors,
and asserts variant tags render inline-SVG icons with no emoji.

---

## 5. The gate/ratchet toward 88%

Coverage (`tools/coverage.mjs --gate`) checks BOTH channels (phrases-only, vocab-only) against
the committed index (§0), per-language floor from `frequency.gateFloor`. The floor is a
regression ratchet just below live coverage; the goal is the **88% sweet spot** (the ~1000 most
useful words cover ~88% of everyday communication). Raising a language toward 88% is content
curation: mine the missing core lemmas with `build-candidates-cover.mjs`, then author them one
at a time through the full quality pipeline (classify → define → enrich → audio → audit). Bump
`gateFloor` as live coverage rises.
