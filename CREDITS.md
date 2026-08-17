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
Word-frequency lists from the OpenSubtitles 2018 corpus, used only as a
*frequency signal* to estimate CEFR-band difficulty during content
reconciliation (`tools/reconcile.mjs`). No frequency list is redistributed here.
- Repository: https://github.com/hermitdave/FrequencyWords
- License: Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)

### Plan Curricular del Instituto Cervantes (PCIC)
Official Spanish reference inventories (functions, notions) used to decide which
communicative functions and topics to cover, and at which CEFR level. Only short
functional exponents are referenced; the structured seed lives at
`tools/sources/derived/pcic-greetings.json`.
- Source: https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/
- Public reference material (Instituto Cervantes)

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
