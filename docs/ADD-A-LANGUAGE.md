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

## 2. Not gated — do these by hand (no check can infer them)
- **`shared/js/lang-pair.js` `PAIRS`**: add the pair (flags, `name`, `localName`) — display
  data that can't be derived.
- **`tools/audit.mjs` `PAIRS`**: register `{ id, sourceLang, targetLang }` for the new pair.
- **`lang/ui.js`**: a UI block for a new SOURCE language (full key set; `check-i18n` then
  verifies it resolves). Topic labels cross-check is es/en-only (topics.json stores those two).
- **Audio**: generate it with the engine your profile's `tts.engine` names
  (`kokoro` → `tools/generate-audio.mjs`, `edge` → `tools/generate-audio-tgt.py`); the voice
  set is read from `lang-profiles.voices`. `check-audio` then validates it.
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

### Gated automatically (no thought needed — CI enforces)
- Em dash / colon / semicolon ban; terminal punctuation; word-count by CEFR (Rule 5/6/17).
- Duplicate IDs; duplicate practiced phrases; `_ID_MAP` freshness; taxonomy/scope.
- `labels` present on every multi-form phrase; valid label **keys** AND **values**
  (`gender` ∈ masculino/femenino/neutro, `register` ∈ formal/informal — Rule 16 §6/§8).
- Anglicisms / regional terms per language (needs the CONTENT_RULES block, §1).
- Wrong-language characters in grammar tips (needs `nativeChars`, §1).
- Grammar-tip length; anti-pedagogical patterns (Rule 11).

### Author judgment (not reliably gateable — apply by hand, per language)
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

## 5. The gate/ratchet toward 88%

Coverage (`tools/coverage.mjs --gate`) checks BOTH channels (phrases-only, vocab-only) against
the committed index (§0), per-language floor from `frequency.gateFloor`. The floor is a
regression ratchet just below live coverage; the goal is the **88% sweet spot** (the ~1000 most
useful words cover ~88% of everyday communication). Raising a language toward 88% is content
curation: mine the missing core lemmas with `build-candidates-cover.mjs`, then author them one
at a time through the full quality pipeline (classify → define → enrich → audio → audit). Bump
`gateFloor` as live coverage rises.
