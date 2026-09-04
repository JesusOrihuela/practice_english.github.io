# Credits & Content Sources

Practice English is MIT-licensed (see [LICENSE](LICENSE)). Some learning content
is curated with the help of open linguistic resources. This file records those
sources and their licenses, as their terms require attribution.

The raw corpora and their derived indexes are **not committed** to this repo
(they are large and/or carry share-alike terms); they are downloaded on demand
with `tools/sources/fetch-sources.sh` and processed by
`tools/sources/build-freq-inventory.mjs`. Only curated, reworked phrases enter
the app's content files.

## Sources

### Tatoeba — CC BY 2.0 FR
Native-written example sentences with translations, used as a pool of candidate
phrases (via `tools/build-candidates.mjs`). Sentences are curated, adapted to
neutral Spanish, and enriched before inclusion; they are not reproduced verbatim
as a dataset.
- Project: https://tatoeba.org
- Distribution: OPUS (https://opus.nlpl.eu) — `OPUS-Tatoeba` en-es corpus
- License: Creative Commons Attribution 2.0 France (CC BY 2.0 FR)

### NGSL — New General Service List (Browne, Culligan & Phillips)
A pedagogically curated list of ~2,801 high-frequency English lemmas for
learners (excludes proper nouns, profanity and subtitle noise). Used as the
clean frequency **target** for measuring English lexical coverage
(`tools/coverage.mjs`, via `tools/sources/derived/ngsl-en.json`), not reproduced
as an app dataset. Covers ~90% of general English text at ~2,000 words.
- Project: https://www.newgeneralservicelist.com/
- License: free for research and educational use, with attribution.

### ELELex — CEFR-graded lexical resource for Spanish (CEFRLex, UCLouvain CENTAL)
A pedagogically graded Spanish lexicon (14,290 entries) built from Spanish-as-a-
foreign-language textbooks and simplified readers, giving each lemma a CEFR-level
frequency distribution. Used as the clean frequency **target** for measuring
Spanish lexical coverage (`tools/coverage.mjs`, via a locally-built
`tools/sources/derived/elelex-es.json`) — the Spanish analog of NGSL. The raw
lexicon and the derived index are **not redistributed** here (download on demand
with `tools/sources/fetch-sources.sh`, then `tools/sources/build-elelex.mjs`).
- Project: https://cental.uclouvain.be/cefrlex/elelex/
- License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0)

### FrequencyWords (Hermit Dave) — CC BY-SA 3.0
Word-frequency lists from the OpenSubtitles 2018 corpus. Used as a *frequency
signal* for CEFR-band difficulty during reconciliation (`tools/reconcile.mjs`),
and — for the Spanish coverage gate — as the **intra-level ordering key** of the
PCIC-curated core index (`tools/sources/derived/es-core.json`; see PCIC below).
The raw 50k lists themselves are not committed.
- Repository: https://github.com/hermitdave/FrequencyWords
- License: Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)

### Plan Curricular del Instituto Cervantes (PCIC)
Official Spanish reference inventories (functions, notions) used to decide which
communicative functions and topics to cover, and at which CEFR level. Two uses:
- Per-topic functional/notional seeds (`tools/sources/derived/pcic-*.json`).
- **The Spanish coverage-gate core index** (`tools/sources/derived/es-core.json`,
  built by `tools/sources/build-pcic-core.py`): the PCIC Inventario de nociones
  (generales + específicas, A1-B2) provides the curated CEFR **membership + grade**;
  FrequencyWords provides only the within-level frequency order; tokens are
  lemmatized with `simplemma`. This is the single curated + committeable + CEFR
  list that governs the Spanish gate in CI (project rule: one such list per
  language). Spanish's CEFR-graded ELELex (CC BY-NC-SA) is a better-formatted
  metric but not committeable, so it stays a local-only cross-check, never the gate.
- Source: https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/
- Public reference material (Instituto Cervantes)

### Diccionario de americanismos (ASALE)
Authoritative regional provenance for the Spanish variant lexicon (`tools/check-variants.mjs`):
each sense (acepción) is marked with the countries where it is used. Queried per term with
`tools/damer-provenance.mjs` (parses the public entry's structured metadata) to ground which
countries each regional word covers (e.g. *palta* = gt,ec,pe,bo,cl,ar,uy; *carro* = the Automóvil
sense excludes the Cono Sur; *papa*/*celular* = pan-Latin-American). No dictionary data is bundled.
- Source: https://www.asale.org/damer/ (Asociación de Academias de la Lengua Española)
- Public reference material (ASALE). Spain/general terms are levelled from the DLE.

### Variant system — academic sources
The multi-dimensional variant system (`shared/js/variant-dimensions.js` registry;
`tools/check-variants.mjs`) is grounded in published references, not intuition:
- **Gender / number / concordancia** — RAE & ASALE, *Nueva gramática de la lengua española* (NGLE)
  and the *Diccionario de la lengua española* (DLE): which words inflect, and what must agree
  (article + noun + adjective + participle + verb).
- **Region provenance** — *Diccionario de americanismos* (ASALE) + DLE (see the DAMER entry above).
- **Register / forms of address** — pragmatics & sociolinguistics of *tú/usted/vos* and formal vs
  informal registers.
- **Variant PRESENTATION** — Tinkham (1993, 1997), Waring (1997) and Webb (2007) on interference
  when semantically related words / synonyms are taught together: lexical variants (region/register)
  are shown as one PRIMARY form + labelled recognition variants, while inflectional variants
  (gender/number) are taught as one concept's agreement pattern.
No copyrighted text from these works is bundled; they inform the rules and the curated lexicons.

### Grammar system — academic sources
The grammar activity (`grammar/`, `shared/json/pairs/{pair}/grammar-rules.json`) is a five-phase
Focus-on-Form sequence, and its rule selection/leveling is grounded in a recognized CEFR inventory
per target language — not intuition. Full spec: `docs/GRAMMAR.md`. No copyrighted text is bundled.
- **Pedagogical model** — Schmidt (1990, noticing); VanPatten (1996/2004, processing instruction /
  structured input); Adair-Hauck & Donato (2002, PACE); Long (1991, focus on form); Swain (1985,
  output); Slamecka & Graf (1978, generation effect); Krashen (1985) & Sharwood Smith (1993, input /
  input enhancement); Laufer & Girsai (2008, L1 in form-focused instruction — grounds the L1 gloss).
- **English rule inventory / leveling** — English Grammar Profile (Cambridge University Press &
  Cambridge Assessment, Cambridge Learner Corpus); reference: *Practical English Usage* (Swan).
- **Spanish rule inventory / leveling** — Plan Curricular del Instituto Cervantes (PCIC), "Gramática";
  reference: *Nueva gramática de la lengua española* (NGLE, RAE & ASALE).
- **German** — Goethe-Institut / *Profile deutsch* CEFR descriptors; reference: *Duden — Die Grammatik*.
- **Finnish** — CEFR descriptors (YKI/EOI); reference: *Iso suomen kielioppi* (VISK, SKS).
- **Polish** — ORViL (*Opis referencyjny znajomości języka polskiego*, the Polish CEFR reference
  description) + CKE certification A1/A2 word stock; reference grammar: *Gramatyka języka polskiego*.

### National flags (`shared/img/flags/`)
Faithful national flag SVGs used for the region/variant badges. National flags are in the
**public domain** (government works); files sourced from Wikimedia Commons.
- Source: https://commons.wikimedia.org/ (Special:FilePath/Flag_of_*.svg)
- License: Public domain

### Orthographic region maps (`shared/img/regions/`)
Real orthographic-projection locator maps for contiguous macro-regions (e.g. Latinoamérica),
used in the variant badge. Sourced from Wikimedia Commons.
- Source: https://commons.wikimedia.org/ (e.g. Latin America (orthographic projection).svg)
- License: Creative Commons Attribution-ShareAlike (CC BY-SA), per each file's Commons page.

## Topic images

The photos on the topic cards (`{activity}/img/{topic}.jpg` / `.webp`) are sourced and
quality-gated by `tools/fetch-topic-images.mjs` (see `docs/IMAGE-QUALITY.md`): candidates
are fetched from a Creative-Commons / royalty-free provider, scored for on-topic relevance
with CLIP, cover-cropped, and checked for framing.

- **Default provider: [Pixabay](https://pixabay.com)** — Pixabay Content License
  (royalty-free, no attribution required, commercial use OK). Recorded per-image in the
  gitignored `tools/sources/derived/image-credits.json` for provenance.
- **Fallback provider: [Wikimedia Commons](https://commons.wikimedia.org)** — used when no
  API key is configured; images keep their individual CC licenses and authors (captured in
  the same manifest for attribution).

## Reference inventories consulted (no data redistributed)

Used to guide selection and CEFR levelling; not bundled:

- **NGSL** (New General Service List) — CC BY-SA 4.0 — https://www.newgeneralservicelist.com
- **PHRASE List** (Martinez & Schmitt, 2012, *Applied Linguistics*) — academic reference
- **Core Inventory for General English** (British Council / EAQUALS)
- **CEFRLex** (EFLLex, ELELex, FLELex, …) — pedagogical-use lexicons
- **Oxford 3000/5000**, **Cambridge** vocabulary lists — publisher references
- Official CEFR inventories for future target languages: **Goethe-Institut Wortlisten** (de),
  **Referencial Camões PLE** (pt), **Profilo della lingua italiana** (it),
  **Niveaux de référence** (fr)
