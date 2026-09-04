# Grammar system — pedagogy, sources, schema, and gates

This document is to the grammar activity what `docs/CONTENT-QUALITY.md` is to phrases/vocab and
`docs/LANGUAGE-PROFILES.md` is to per-language linguistics: the single reference for **why the
grammar activity is built the way it is, where its content comes from, what schema each rule must
follow, and which CI gate enforces it.** Read it before adding or editing grammar rules for any pair.

The data lives at `shared/json/pairs/{pairId}/grammar-rules.json` (one file per pair — grammar is
**not** target-centric, because rule selection and leveling are pair-specific). The activity is
`grammar/` (`html/`, `css/`, `js/`). The CI gate is `tools/check-grammar.mjs` (job `validate`).

---

## 1. The pedagogical model — a five-phase Focus-on-Form sequence

A grammar rule is not a page of prose the learner reads. Each rule is a **guided six-phase
sequence** that moves the learner from meaning-bearing input, through explicit knowledge and
controlled practice, to open communicative production — the arc that current second-language-
acquisition (SLA) research supports for teaching form without sacrificing meaning. The phases (see
`grammar/js/grammar.js`, `goToPhase`) are:

| # | Phase | Field consumed | What the learner does | SLA grounding |
|---|-------|----------------|-----------------------|---------------|
| 1 | **Context** | `context_dialogue` | Reads a short natural dialogue where the target structure is used repeatedly and **highlighted** (input flood). | Comprehensible input (Krashen 1985); input flood / enhanced input (Sharwood Smith 1993). |
| 2 | **Notice** | `noticing_prompts` | Answers open questions that direct attention to the form **before** any rule is given. | The **Noticing Hypothesis** (Schmidt 1990, 2001): learners must consciously attend to a form to acquire it. |
| 3 | **The Rule** | `explanation` (+ the learner's phase-2 answers echoed back) | Reads the explicit rule, now anchored to what they just noticed. | Explicit instruction after noticing (PACE model: Adair-Hauck & Donato 2002); Focus on Form (Long 1991). |
| 4 | **Comprehension** | `structured_input` | Answers **referential** items (one correct answer, form→meaning) **and** an **affective** item (reacts to real meaning, no right answer) before producing the form. | **Processing Instruction / Structured Input** (VanPatten 1996, 2004): interpret before you produce — with **both** referential and affective activities. |
| 5 | **Production** | `quiz` | Produces the form in controlled fill-in-the-blank items with feedback. | Output Hypothesis (Swain 1985); the generation effect (Slamecka & Graf 1978). |
| 6 | **Express** | `communicative_production` | Writes their **own** sentence using the structure, then reveals a model answer + gloss and self-checks. | The practice progression mechanical → **meaningful → communicative** (Paulston 1970; DeKeyser 1998/2007 skill acquisition; Ellis 2006). |

Three consequences of this model are **rules**, not options:

- **Every rule must populate all six phases** (context_dialogue ≥ 2; noticing_prompts ≥ 1;
  structured_input with ≥ 1 referential **and** ≥ 1 affective item; quiz ≥ 1;
  communicative_production ≥ 1). A missing phase collapses the sequence — the learner reads the
  explanation and then practices nothing, or drills mechanically and never uses the form for real
  meaning. The gate rejects any empty phase.
- **Comprehension is referential *and* affective.** Processing Instruction is only complete when the
  learner both makes form-meaning connections (referential) and processes the form while engaging
  real content/opinion (affective). One of each is required.
- **The phase order is fixed** and encoded in the activity. Do not add a rule that expects a
  different order.

### Phase 4 — referential vs affective structured input

A **referential** item shows a target sentence and asks a question with **one correct answer** that
can only be answered by connecting the form to its meaning (e.g. *"Why is 'vettä' in the
partitive?"*). An **affective** item (`"affective": true`) has **no single correct answer**: its
options are all short target-language statements using the structure, and the learner picks the one
**true for them** (*"Which describes your morning?"*). It processes the form while attaching it to
real meaning — and is acknowledged, never marked right/wrong. VanPatten's Processing Instruction
prescribes both; without the affective item the design is only half-built.

#### Distractor quality (referential items) — the standard

A referential item only teaches if the wrong options are **plausible**. If the distractors are
obviously silly, the learner picks the right answer without processing the form, and the item tests
nothing. Every distractor must follow these rules:

1. **Plausible, not self-defeating.** A distractor is a mistake a real learner at this level could
   genuinely make: a competing rule, an over-generalization, a confused form-meaning link. It must
   **never announce that it is wrong** — no *"it's an error"*, *"it's impossible"*, *"it's a
   certainty"*, *"it should be X instead"*. State the wrong interpretation **confidently**, the way a
   confused learner would believe it (*"It's happening right now"*, not *"This is grammatically
   wrong"*).
2. **Targets the real confusion.** Each distractor should probe the specific contrast the rule
   teaches — for present-simple-as-habit, distractors are the *present-continuous* reading ("right
   now"), the *past* reading, the *recently-stopped* reading. Random unrelated options don't test.
3. **Parallel in form, length and register** to the correct option, so nothing but the meaning gives
   the answer away. Avoid a correct option that is noticeably longer or more detailed.
4. **Exactly one is correct.** Distractors are unambiguously wrong on inspection, but not obviously so
   at a glance — no partially-correct "trap" that could also be defended.
5. **Grounded in the meaning, not the metalanguage.** Options describe *what the sentence means / why
   the form is used*, phrased as interpretations a learner weighs — not verdicts on correctness.

The same bar applies to `quiz` `contrast` notes and to affective options (which must all be genuine,
true-for-someone statements). New rules and new pairs must meet this bar; obvious distractors are a
content defect, not a stylistic preference.

### Phase 6 — Express (communicative production, self-assessed)

Controlled fill-in-the-blank practice is **mechanical**; skill-acquisition theory (DeKeyser) and the
mechanical → meaningful → communicative progression (Paulston; Ellis 2006) hold that proceduralizing
a form needs the learner to produce it for **their own meaning**. With no backend to grade free text,
Express is **self-assessed**: the learner writes their own sentence using the structure, then reveals
a `model` answer with its `model_translation` gloss and self-checks against a rubric prompt (does it
use the structure, and is it true for me?). It is deliberately not auto-graded — the value is in
producing and comparing, not in a machine verdict.

### The L1 gloss — comprehension support on every target sentence

Every learner-facing **target-language** sentence — each `context_dialogue` turn, each
`structured_input.sentence`, each `quiz.sentence` — carries a `translation` field: a faithful,
natural rendering **in the source language**. The activity renders it as a muted line beneath the
target text.

Rationale: the desirable difficulty of a grammar exercise comes from **noticing and producing the
form**, not from failing to understand what the sentence means. Without an L1 gloss, a sentence in a
distant target (e.g. Finnish `Juon vettä.` or German `Ich stehe früh auf.`) is simply opaque to a
beginner — extraneous cognitive load (Sweller 1988) that competes with the grammar point instead of
supporting it. Providing the meaning in the L1 is standard, evidence-based support at lower levels
(Laufer & Girsai 2008 on the value of L1 in form-focused instruction); the learner still has to
notice and produce the target form, which is the actual challenge. The gloss is **not** a place to
give away a fill-in-the-blank answer's *form* — it gives the sentence's meaning; the target
grammatical form is what the learner supplies.

---

## 2. Where the content comes from (sources per language)

Rule selection and CEFR leveling are **governed by a recognized reference for each target language** —
the same principle as vocab (NGSL/PCIC). This table is the **authority a rule's `level` must answer
to**: it is the standard against which new rules are written and existing rules are reconciled (which
structures belong at which level, and which structures belong in the curriculum at all). It is a
policy, not a claim that every legacy rule was mechanically derived from these lists; where a current
rule's level cannot be justified against the inventory below, the rule is re-leveled or cut. No
copyrighted text from these works is bundled.

| Target | CEFR rule inventory / leveling | Reference grammar (facts & examples) |
|--------|--------------------------------|--------------------------------------|
| **English** (`es-en`) | **English Grammar Profile** (Cambridge University Press & Cambridge Assessment, from the Cambridge Learner Corpus) — which grammatical competences appear at A1…C2. Lexis from **NGSL**. | *Practical English Usage* (Swan); *Cambridge Grammar of English* (Carter & McCarthy). |
| **Spanish** (`en-es`) | **Plan Curricular del Instituto Cervantes (PCIC)** — "Gramática" inventory by level. | **Nueva gramática de la lengua española (NGLE)**, RAE & ASALE; *Gramática de referencia para la enseñanza de español* (Matte Bon). |
| **German** (`en-de`) | **Goethe-Institut / CEFR** *Profile deutsch* level descriptors. | *Duden — Die Grammatik*; standard DaF reference grammars. |
| **Finnish** (`en-fi`) | **CEFR** descriptors for Finnish (EOI / YKI level syllabi). | **Iso suomen kielioppi (VISK)**, the reference grammar of Finnish (SKS, open online). |

The English/Spanish inventories (English Grammar Profile, PCIC) are the **authority for a rule's
`level`** — the same way the PCIC/NGSL govern vocab leveling. Where corpus frequency and the CEFR
inventory disagree for a structure, the inventory wins (a structure is A2 because the inventory says
learners meet it at A2, not because a word in the example is frequent).

These citations are mirrored in `CREDITS.md` (§ "Grammar system — academic sources").

---

## 3. Rule schema

```jsonc
{
  "id": "present_simple",              // stable slug (card id: grammar_{category}_{id})
  "category": "tenses",               // must match a categories[].id in the file
  "level": "A1",                      // CEFR from the inventory above
  "title": "Present Simple",          // fallback title
  "title_en": "Present Simple",       // shown when source = en
  "title_es": "Presente Simple",      // shown when source = es
  "explanation": "…**markdown**…",    // the explicit rule (phase 3)

  "context_dialogue": [               // phase 1 — REQUIRED, ≥ 2 turns
    { "speaker": "ANA", "text": "…**form**…", "translation": "…L1…", "highlight": true }
  ],
  "noticing_prompts": [               // phase 2 — REQUIRED, ≥ 1
    { "q": "…question in the SOURCE language…", "placeholder": "e.g. …" }
  ],
  "structured_input": [               // phase 4 — REQUIRED, ≥ 1 REFERENTIAL + ≥ 1 AFFECTIVE
    // referential: one correct answer (form → meaning)
    { "sentence": "…target…", "translation": "…L1…",
      "question": "…source-language question…",
      "options": ["…", "…", "…", "…"], "correct": 0, "feedback": "…" },
    // affective: no correct answer, no sentence — options are target statements the learner reacts to
    { "affective": true,
      "question": "…source-language prompt: which is true for you?…",
      "options": ["…target statement…", "…target statement…", "…target statement…"],
      "feedback": "…source-language acknowledgment (note how each uses the form)…" }
  ],
  "quiz": [                           // phase 5 — REQUIRED, ≥ 1
    { "sentence": "…target with ___ blank… (lemma cue)", "translation": "…L1…",
      "answer": "form", "accepted": ["form"], "feedback_why": "…", "contrast": "" }
  ],
  "communicative_production": [       // phase 6 (Express) — REQUIRED, ≥ 1
    { "prompt": "…source-language: write your own sentence using X…",
      "model": "…a model answer in the TARGET language…",
      "model_translation": "…its L1 gloss…", "hint": "…optional source-language nudge…" }
  ],

  "related_phrases": [],              // optional
  "topics": []                        // DERIVED by tools/grammar-topics.mjs — do not hand-edit
}
```

Field rules that the gate enforces:

- **`translation` is required** on every `context_dialogue` turn, **referential** `structured_input`
  item, and `quiz` item — a faithful, natural **source-language** rendering of the `text`/`sentence`.
  (Affective items have no target sentence, so no `translation`.)
- The `translation` follows the same prose hygiene as other content: natural, correct orthography,
  Spanish glosses use `¿ ¡`, and avoid `— ; :` as prose punctuation (a colon inside a dialogue
  speaker label like `A: '…'` that mirrors the source is not prose punctuation).
- **All six phases are populated** (`context_dialogue` ≥ 2 turns; `noticing_prompts` ≥ 1;
  `structured_input` with ≥ 1 referential **and** ≥ 1 affective item; `quiz` ≥ 1;
  `communicative_production` ≥ 1 with `prompt` + `model` + `model_translation`).
- `category` matches an entry in the file's `categories[]`.
- `title_en` / `title_es` exist so the title shows in the active source language.
- The learner is *addressed* in the **source** language (`noticing_prompts[].q`,
  `structured_input[].question`, affective `feedback`, `communicative_production[].prompt`/`hint`) and
  *practices* in the **target** language (`text`, referential `sentence`, affective `options`,
  `model`) — the target-practice strings carry a source-language gloss/translation.

A quiz `sentence` may carry a compact base-form cue for the word to inflect — e.g.
`"Puhun ___. (englanti)"` — so the learner knows *which* word to produce the form of; the full
meaning is the `translation`. Do **not** put an ad-hoc inline gloss like `(englanti = English)`
inside the sentence; that is what `translation` is for.

---

## 4. The CI gate — `tools/check-grammar.mjs`

Runs in the `validate` job of `ci.yml`. Fails the build when any pair's `grammar-rules.json`:

- has a rule with an **empty phase** (`context_dialogue` < 2, or empty `noticing_prompts` /
  `structured_input` / `quiz` / `communicative_production`);
- has a `structured_input` with **no referential** item, or **no affective** item;
- has a `communicative_production` item missing `prompt` / `model` / `model_translation`;
- has a learner-facing target sentence **missing `translation`** (dialogue turn, referential
  structured-input sentence, or quiz sentence);
- references a `category` not defined in `categories[]`;
- is missing `title_en` / `title_es` / `level` / `explanation`;
- has a `structured_input` item whose `correct` index is out of range, or a `quiz` item whose
  `answer` is not in `accepted`.

Run it locally after any grammar edit:

```bash
node tools/check-grammar.mjs            # all pairs
node tools/check-grammar.mjs --pair en-de
```

---

## 5. Adding grammar for a new pair

1. Pick the rule set from the target's CEFR inventory (§2). Do not invent rules or levels.
2. For each rule, author **all six phases** (§1) and a `translation` on every learner-facing target
   sentence, following §3. Keep dialogues short and natural; highlight the target form with `**bold**`.
   No em-dashes (—) in any learner-facing text — use a comma (the gate enforces this).
3. Add `title_en` / `title_es`; write `noticing_prompts`, `structured_input.question`, affective
   `feedback` and `communicative_production.prompt`/`hint` in the source language.
4. Run `node tools/grammar-topics.mjs --write` (re-derives the evidence `topics` map) and
   `node tools/check-grammar.mjs` (must be clean) and `node tools/check-content.mjs`.
5. Cite the target's inventory + reference grammar in `CREDITS.md`.

**Ordering is automatic — do not hand-order the file.** The category grid and the rule list are
ordered **by CEFR complexity** at render time (categories by their rules' easiest entry level then
average level; rules within a category by level), so a learner always meets foundational categories
first and advanced ones (e.g. advanced syntax, all C1/C2) last. A new category or rule lands in a
coherent spot automatically by its own content level — the `categories[]` / rules array order in the
JSON is irrelevant to what the learner sees.

---

## References

- Adair-Hauck, B. & Donato, R. (2002). *The PACE Model: A Story-Based Approach to Meaning and Form.*
- Krashen, S. (1985). *The Input Hypothesis.*
- Laufer, B. & Girsai, N. (2008). *Form-focused instruction in second language vocabulary learning.*
- Long, M. (1991). *Focus on form: A design feature in language teaching methodology.*
- Schmidt, R. (1990). *The role of consciousness in second language learning.*
- Sharwood Smith, M. (1993). *Input enhancement in instructed SLA.*
- Slamecka, N. J. & Graf, P. (1978). *The generation effect.*
- Swain, M. (1985). *Communicative competence: The output hypothesis.*
- Sweller, J. (1988). *Cognitive load during problem solving.*
- VanPatten, B. (1996, 2004). *Input Processing and Grammar Instruction / Processing Instruction.*
