# Language Profiles — the linguistic facts a target language must provide

This document is the **canonical spec** for adding a target language to PracticeEnglish.
It exists because most of what the app needs to teach a language is language-agnostic
(activities, SRS, UI, audio playback), but a handful of things are **irreducibly
per-language linguistic facts** — you cannot derive them generically; they *are* the
knowledge of the language. This file names each one, says **why the app needs it**,
and grounds it in the **formal second-language-acquisition (SLA) and pedagogical
literature**, so the choice is principled, not arbitrary.

The whole point of the profile architecture is to turn "adding a language" from
*hunting through five source files* into **filling one profile and passing one
check**. The gaps are inherent (linguistics), but the process is not.

---

## 1. Architecture — where the facts live

There are two axes of variation, and each has one home:

| Axis | What varies | Home | Consumed by |
|---|---|---|---|
| **Per target language** | fold rule, stop-words, function words, artifacts, tip→rule labels, frequency list | `shared/js/lang-profiles.js` (browser **and** Node, one file) | text-utils, grammar-chip, coverage.mjs |
| **Per target language (Node only)** | grammar-structure detectors (dense regex) | `tools/lang-detectors.mjs` | grammar-topics.mjs |
| **Per pair (source × target)** | cognate suffix pairs | `shared/js/lang-profiles.js` → `COGNATES` | quiz.js |

`shared/js/lang-profiles.js` is a **dual-mode classic script**: it sets a browser
global (`window.AppLangProfiles`) *and* `module.exports`, so the browser modules and
the Node tools read the **exact same data with no build step**. The heavy grammar
detectors are Node-only (the browser reads the *derived* `grammar-phrase-rules.json`),
so they stay in `tools/` to avoid shipping dense regex to every page.

**Completeness is enforced.** `tools/check-lang-profiles.mjs` (CI) fails the build if
any target language a pair learns is missing a profile field, its detector block, or
references a grammar rule id that doesn't exist. So a half-added language cannot merge.

---

## 2. The linguistic facts, one by one

Each subsection is one field of the profile: what it is, the app mechanic that needs
it, the pedagogical grounding, and how to fill it.

### 2.1 `foldPreserve` — orthographic normalization for answer-checking

**What.** A string of graphemes that must **survive accent-folding** because they are
*distinct letters*, not accented vowels. Spanish: `'ñ'` (año ≠ ano). English: `''`
(nothing to protect — fold everything to ASCII). When the learner types an answer, the
app folds both the answer and the target the same way before comparing, so `café` and
`cafe`, or `está` and `esta`, match — but a genuine letter like `ñ` is never silently
merged into `n`.

**Why the app needs it.** Typed-production activities (Dictation, Translation, Cloze,
Scramble) must not penalize a learner for **input-method limitations** — a keyboard
without a quick `é`, or a habit of dropping accents. That is *construct-irrelevant*
difficulty: it measures typing setup, not language knowledge.

**Pedagogical grounding.**
- **Construct validity / construct-irrelevant variance** — Messick (1989), *Validity*,
  in *Educational Measurement*: assessment should isolate the target construct
  (language knowledge) from irrelevant sources of difficulty (here, diacritic input).
- **Grapheme vs. diacritic** — Unicode NFD decomposition separates a base letter from
  its combining mark; folding removes the mark. But some marks form a *distinct letter*:
  the RAE (*Ortografía de la lengua española*, 2010) treats **ñ as the 15th letter of
  the Spanish alphabet**, not an accented `n`. `foldPreserve` encodes exactly that
  distinction per language (German would likely preserve nothing if `ä→a` is acceptable,
  or `'ß'`; the language expert decides).

**How to fill.** List only true distinct letters. If in doubt, consult the language's
official orthography (which letters are alphabet entries in their own right).

### 2.2 `clozeStopWords` — which words must *not* become the blank

**What.** Function words, pronouns, and wh-words that make **poor cloze blanks** in this
language. Cloze picks a *content* word to remove so the learner must retrieve a
meaning-bearing item.

**Why the app needs it.** Blanking `the` or `de` tests reading flow, not retrieval of
vocabulary or structure. Blanking `restaurant`/`restaurante` forces the learner to
*generate* the target item from meaning + context.

**Pedagogical grounding.**
- **The generation effect** — Slamecka & Graf (1978): information that a learner
  *generates* is retained better than information merely read. A content-word gap
  triggers generation; a function-word gap largely does not.
- **Desirable difficulties** — Bjork (1994): retrieval effort that is meaningful (not
  incidental) improves long-term retention. The blank should sit where effort pays off.
- **Cloze procedure** — Taylor (1953) introduced cloze; modern L2 pedagogy
  (e.g. Nation, 2013, ch. on deliberate learning) distinguishes *rational cloze*
  (deliberately chosen content gaps) from random-nth-word cloze precisely for this reason.

**How to fill.** List the closed-class words in **unaccented** form (the fold runs
first). 1–2-letter words are already excluded by a length filter, so cover 3+ letters.
`functionWords` is a good starting superset; trim to the ones that genuinely make trivial
gaps.

### 2.3 `functionWords` — the closed class excluded from the vocab coverage channel

**What.** The closed-class words of the language: articles, pronouns, prepositions,
conjunctions, determiners/quantifiers, auxiliaries/modals, and grammatical adverbs. A
**superset** — only members that appear in the top-1000 actually matter.

**Why the app needs it.** The core-vocabulary gate measures the top-1000 in two channels:
**phrases** (must cover the whole core, function words included — they appear naturally
in sentences) and **vocab** (content words only). Function words **cannot be isolated
flashcards** — you cannot meaningfully "define" `of` on a card — so they are excluded
from the vocab-channel denominator. Without this, the vocab channel caps at ~80–85%
(function words are ~15% of the top-1000) and the gate is red forever.

**Pedagogical grounding.**
- **Function vs. content words in vocabulary learning** — Nation (2001/2013), *Learning
  Vocabulary in Another Language*: high-frequency function words are a small, closed set
  best acquired through **exposure in context**, whereas content words are the proper
  target of **deliberate** vocabulary study. Schmitt (2000), *Vocabulary in Language
  Teaching*, makes the same split.
- **The lexical-coverage premise** — Nation (2006), "How large a vocabulary is needed for
  reading and listening?"; Adolphs & Schmitt (2003): the most frequent ~1000 word
  families cover ~80–85% of spoken discourse, which is why the gate targets the top-1000.

**How to fill.** Enumerate the closed classes above for the language. Err toward a
superset; the code intersects with the actual top-1000.

### 2.4 `ignoreTokens` — non-teachable tokenization artifacts

**What.** Tokens that appear in the frequency list or corpus but are **not teachable
content**: contraction fragments (English `'s`, `'t`, `don`, `isn`), OCR/list markers,
and corpus-specific proper nouns (ELELex surfaces `requena`, `raulito`). Excluded from
**both** coverage channels so the metric is not unfairly penalized — the raw figure is
still printed so it can't be gamed.

**Why the app needs it.** A frequency list built from a corpus carries corpus noise.
Counting `raulito` (a character name) as an "uncovered core word" is meaningless.

**Pedagogical grounding.** This is data hygiene in service of a valid measure — again
**construct-irrelevant variance** (Messick, 1989): the artifacts are not part of the
"core vocabulary" construct the gate claims to measure. Which tokens are artifacts is
language- and corpus-specific, hence per-language.

**How to fill.** Run `coverage.mjs` for the language and inspect the "missing top-1000"
list for non-words; add them here. Keep it honest — only genuine artifacts, never real
words you simply haven't taught yet.

### 2.5 `grammarTipLabels` — mapping an authored tip to a grammar rule (the chip)

**What.** A `[RegExp, label, ruleId]` table, most-specific-first, that maps a phrase's
authored `grammar` tip (written **in the target language**) to a rule id in that
language's `grammar-rules.json`. It drives the learning-mode **grammar chip**. `ruleId
= null` means "recognised structure, but no rule → no chip".

**Why the app needs it.** The tip is free text in the target language; the chip needs to
resolve it to a *rule* to show its localized title and level. The mapping is
target-language-specific (a Spanish tip resolves to Spanish rule ids; an English tip to
English ones), so a tip never links to the wrong language's rules.

**Pedagogical grounding.**
- **Noticing hypothesis** — Schmidt (1990, 2001): learners acquire features they
  consciously *notice*. A brief, well-timed grammar chip after a correct answer promotes
  noticing of the structure just used.
- **Focus on form** — Long (1991); Ellis (2001): drawing attention to form *within*
  meaningful use (not as isolated drills) aids acquisition — which is why the chip fires
  after a communicative answer, and (per project policy) never during path mode, where it
  would split attention.

**How to fill.** For each rule the language teaches, add patterns that match how tips for
it are phrased. Order most-specific first (the first match wins). Every non-null `ruleId`
**must** exist in `grammar-rules.json` — `check-lang-profiles.mjs` enforces this.

### 2.6 `frequency` — which pedagogical list governs the coverage gate

**What.** Metadata: `{ list, cefrGraded, committed, note }`. Records the authoritative
**pedagogical** frequency list for the language and whether it ships in CI.

**Why the app needs it.** Coverage is measured against a *clean, learner-oriented* list,
not a noisy raw-corpus list. English uses **NGSL**; Spanish uses **ELELex**. `committed`
says whether the list can run in CI (NGSL yes; ELELex is CC BY-NC-SA → local only).

**Pedagogical grounding.**
- **NGSL** — Browne, Culligan & Phillips (2013): a modern General Service List of ~2800
  curated high-frequency learner lemmas, successor to West's **GSL** (1953).
- **ELELex / CEFRLex** — François et al. (2014, 2016): CEFR-graded lexical resources built
  from pedagogical materials — the clean Spanish analogue of NGSL.
- **Frequency ≠ CEFR for topical items** — the PCIC (Instituto Cervantes, *Plan Curricular
  del Instituto Cervantes*) and the English *Core Inventory* govern the level of
  *topical/formulaic* vocabulary (`buenas tardes`, `menú`) that raw frequency mis-levels.
  Use frequency for general difficulty, the official inventory for topical items.

**How to fill.** Name the list, whether it is CEFR-graded, and whether it is
redistributable (drives CI vs. local-only). The actual *loader* lives in `coverage.mjs`
(list formats differ); this field is the declaration + validator anchor.

### 2.7 Grammar detectors — `tools/lang-detectors.mjs` (Node only)

**What.** For each grammar rule id, a regex matching a phrase's target text when it
exercises that structure. Keyed by target language. Used to (a) derive each rule's
evidence-based `topics` and (b) emit the per-phrase rule map.

**Why the app needs it.** A rule should be tagged to a topic **only if phrases actually
exercise it** — the association is *derived from evidence*, never asserted by intuition.
This keeps the progress dashboard honest and the chip grounded.

**Pedagogical grounding.** Same noticing / focus-on-form basis as 2.5 (Schmidt; Long;
Ellis) — plus the project principle that pedagogical claims are **evidence-based**: the
detector is the operationalization of "this content demonstrably exercises this
structure." A structure present in no phrase correctly yields an empty topic list (n/a),
never a false claim.

**How to fill.** Write **unambiguous lexical/morphological** detectors (avoid false
positives). Use the `wl()`/`ub()` helpers for Unicode-aware word boundaries when the
language has accented inflections. Rules with no reliable detector map to `null` and are
listed in `CURATED` in `grammar-topics.mjs` (kept hand-tagged). Run
`node tools/grammar-topics.mjs --write` to regenerate the derived artifacts.

### 2.8 Cognate suffix pairs — `COGNATES` (per pair)

**What.** Suffix pairs where a target term and its source translation share a root
(`-tion`/`-ción`, `-ty`/`-dad`). Keyed by the two language codes **sorted** and joined
with `|`. Symmetric.

**Why the app needs it.** At A1/A2, Quiz normally shows the L1 translation as the answer
option. For a **transparent cognate** (`education` / `educación`) that makes the question
trivial. Detecting cognates forces those into *definition* mode instead, preserving
difficulty.

**Pedagogical grounding.**
- **Cognate facilitation** — de Groot & Keijzer (2000): cognates are learned faster and
  recognized more easily than non-cognates, precisely because of shared form. That
  facilitation is what makes a cognate a *bad* multiple-choice item when the option is the
  L1 word.
- **L1 anchor for beginners** — Laufer & Shmueli (1997): L1 glosses aid initial
  vocabulary learning — which is why Quiz uses the L1 option at A1/A2 *except* for
  cognates, where it would give the answer away.

**How to fill.** This is the one **per-pair** fact — it depends on *both* languages.
Provide the productive suffix correspondences between the two languages' shared
(often Latinate) vocabulary. A pair with no systematic cognate relationship simply omits
the table (no boost, no failure — a warning only).

---

## 3. Facts that are already language-agnostic (no per-language work)

For completeness, these are handled generically and need **nothing** per language beyond
existing registration points:

- **Audio voices** — `ttsVoices` / `sttLanguage` in `PAIRS` (`lang-pair.js`); the audio
  generators map language → voice (`generate-audio.mjs` / `generate-audio-tgt.py`).
- **Content** (phrases, vocab, grammar rules, topics, placement) — per-pair JSON;
  schema is source/target-agnostic.
- **CEFR ordering, SRS, UI i18n, the 8 activities** — fully generic.
- **Anglicism / regional / grammar content checks** — `CONTENT_RULES` in `audit.mjs`
  (add a key per target language; a template is in the file).

### Project rule: nothing hardcoded

Pair, phrase-topic and vocab-deck **lists are DERIVED** from the content tree
(`topics.json` / filesystem) via `tools/lib-content.mjs` (Node ESM) — or inline the same
way in CJS (`fix-phrase-ids.js`) and Python (`generate-audio-tgt.py`). No tool holds a
hardcoded `PAIRS`/`PHRASE_TOPICS`/`VOCAB_TOPICS` array, and no tool gates logic on a pair
literal (`pair === 'es-en'`) — derive the target with `pair.split('-')[1]`. So adding or
removing a pair, topic or deck is a single content change with **zero tool edits**.
Per-language *facts* (this document) are the exception that proves the rule: they are not
"lists", they live one place per language in the profile / detectors, never scattered as
`lang === 'xx'` branches. Sweep with `grep -n "'es-en'\|'en-es'" tools/` before finishing
any new/refactored tool.

---

## 4. Checklist — adding a target language `xx`

1. **Profile** — add an `xx` entry to `PROFILES` in `shared/js/lang-profiles.js`:
   `name`, `foldPreserve`, `clozeStopWords`, `functionWords`, `ignoreTokens`,
   `grammarTipLabels`, `frequency`. (§2.1–2.6)
2. **Detectors** — add an `xx` block to `DETECTORS` in `tools/lang-detectors.mjs`. (§2.7)
3. **Cognates** — if the source↔`xx` pair has systematic cognates, add a `COGNATES`
   entry keyed by the two codes sorted. (§2.8)
4. **Frequency loader** — teach `coverage.mjs` to load the language's pedagogical list
   (NGSL/ELELex-style). Set `committed` accordingly for CI.
5. **Content-rule audit** — add an `xx` key to `CONTENT_RULES` in `audit.mjs`.
6. **Register the pair** — `PAIRS` in `lang-pair.js` (+ audit's `PAIRS`), a source-language
   block in `lang/ui.js`, and the content dirs under `shared/json/pairs/{pair}/`.
7. **Verify** — `node tools/check-lang-profiles.mjs` (green), `node tools/grammar-topics.mjs
   --check`, `node tools/coverage.mjs --pair {pair} --gate`, and `npm test`.

If step 7's profile check is green, the language is *complete* by construction — every
linguistic fact this document lists has been provided.

---

## References

- Adolphs, S., & Schmitt, N. (2003). Lexical coverage of spoken discourse. *Applied Linguistics, 24*(4).
- Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In *Metacognition*.
- Browne, C., Culligan, B., & Phillips, J. (2013). *The New General Service List (NGSL)*.
- de Groot, A. M. B., & Keijzer, R. (2000). What is hard to learn is easy to forget: cognate vs. non-cognate words. *Language Learning, 50*(1).
- Ellis, R. (2001). Investigating form-focused instruction. *Language Learning, 51*(s1).
- François, T., et al. (2014/2016). *CEFRLex* graded lexical resources (incl. the Spanish list used here).
- Instituto Cervantes. *Plan Curricular del Instituto Cervantes (PCIC)*.
- Laufer, B., & Shmueli, K. (1997). Memorizing new words: vocabulary retention and mode of presentation. *RELC Journal, 28*(1).
- Long, M. H. (1991). Focus on form. In *Foreign Language Research in Cross-Cultural Perspective*.
- Messick, S. (1989). Validity. In *Educational Measurement* (3rd ed.).
- Nation, I. S. P. (2001/2013). *Learning Vocabulary in Another Language*. Cambridge UP.
- Nation, I. S. P. (2006). How large a vocabulary is needed for reading and listening? *Canadian Modern Language Review, 63*(1).
- Real Academia Española. (2010). *Ortografía de la lengua española*.
- Schmidt, R. (1990). The role of consciousness in second language learning. *Applied Linguistics, 11*(2). (& 2001, "Attention".)
- Schmitt, N. (2000). *Vocabulary in Language Teaching*. Cambridge UP.
- Slamecka, N. J., & Graf, P. (1978). The generation effect. *Journal of Experimental Psychology: Human Learning and Memory, 4*(6).
- Taylor, W. L. (1953). "Cloze procedure": a new tool for measuring readability. *Journalism Quarterly, 30*.
- West, M. (1953). *A General Service List of English Words*.
