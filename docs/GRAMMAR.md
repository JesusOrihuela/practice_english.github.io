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

A grammar rule is not a page of prose the learner reads. Each rule is a **guided five-phase
sequence** that moves the learner from meaning-bearing input to explicit knowledge to production —
the arc that current second-language-acquisition (SLA) research supports for teaching form without
sacrificing meaning. The phases (see `grammar/js/grammar.js`, `goToPhase`) are:

| # | Phase | Field consumed | What the learner does | SLA grounding |
|---|-------|----------------|-----------------------|---------------|
| 1 | **Context** | `context_dialogue` | Reads a short natural dialogue where the target structure is used repeatedly and **highlighted** (input flood). | Comprehensible input (Krashen 1985); input flood / enhanced input (Sharwood Smith 1993). |
| 2 | **Notice** | `noticing_prompts` | Answers open questions that direct attention to the form **before** any rule is given. | The **Noticing Hypothesis** (Schmidt 1990, 2001): learners must consciously attend to a form to acquire it. |
| 3 | **The Rule** | `explanation` (+ the learner's phase-2 answers echoed back) | Reads the explicit rule, now anchored to what they just noticed. | Explicit instruction after noticing (PACE model: Adair-Hauck & Donato 2002); Focus on Form (Long 1991). |
| 4 | **Comprehension** | `structured_input` | Answers referential/affective multiple-choice items about meaning **before** producing the form. | **Processing Instruction / Structured Input** (VanPatten 1996, 2004): interpret before you produce. |
| 5 | **Production** | `quiz` | Produces the form in fill-in-the-blank items with feedback. | Output Hypothesis (Swain 1985); the generation effect (Slamecka & Graf 1978). |

Two consequences of this model are **rules**, not options:

- **Every rule must populate all five phases.** A rule with an empty `context_dialogue`,
  `structured_input`, or `quiz` collapses the sequence into a wall of text — the learner reads the
  explanation and then practices nothing. The gate rejects empty phases.
- **The phase order is fixed** and encoded in the activity. Do not add a rule that expects a
  different order.

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
  "structured_input": [               // phase 4 — REQUIRED, ≥ 1
    { "sentence": "…target…", "translation": "…L1…",
      "question": "…source-language question…",
      "options": ["…", "…", "…", "…"], "correct": 0, "feedback": "…" }
  ],
  "quiz": [                           // phase 5 — REQUIRED, ≥ 1
    { "sentence": "…target with ___ blank… (lemma cue)", "translation": "…L1…",
      "answer": "form", "accepted": ["form"], "feedback_why": "…", "contrast": "" }
  ],

  "related_phrases": [],              // optional
  "topics": []                        // DERIVED by tools/grammar-topics.mjs — do not hand-edit
}
```

Field rules that the gate enforces:

- **`translation` is required** on every `context_dialogue` turn, `structured_input` item, and
  `quiz` item. It is a faithful, natural **source-language** rendering of the `text`/`sentence`.
- The `translation` follows the same prose hygiene as other content: natural, correct orthography,
  Spanish glosses use `¿ ¡`, and avoid `— ; :` as prose punctuation (a colon inside a dialogue
  speaker label like `A: '…'` that mirrors the source is not prose punctuation).
- **All five phases are populated** (`context_dialogue` ≥ 2 turns; `noticing_prompts`,
  `structured_input`, `quiz` each ≥ 1).
- `category` matches an entry in the file's `categories[]`.
- `title_en` / `title_es` exist so the title shows in the active source language.
- `noticing_prompts[].q` and `structured_input[].question` are written in the **source** language
  (they talk *to* the learner); everything the learner reads *as target practice*
  (`text`, `sentence`) is in the **target** language and carries a `translation`.

A quiz `sentence` may carry a compact base-form cue for the word to inflect — e.g.
`"Puhun ___. (englanti)"` — so the learner knows *which* word to produce the form of; the full
meaning is the `translation`. Do **not** put an ad-hoc inline gloss like `(englanti = English)`
inside the sentence; that is what `translation` is for.

---

## 4. The CI gate — `tools/check-grammar.mjs`

Runs in the `validate` job of `ci.yml`. Fails the build when any pair's `grammar-rules.json`:

- has a rule with an **empty phase** (missing/empty `context_dialogue` < 2, or empty
  `noticing_prompts` / `structured_input` / `quiz`);
- has a learner-facing target sentence **missing `translation`** (dialogue turn, structured-input
  sentence, or quiz sentence);
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
2. For each rule, author **all five phases** and a `translation` on every target sentence, following
   §3. Keep dialogues short and natural; highlight the target form with `**bold**`.
3. Add `title_en` / `title_es`; write `noticing_prompts` and `structured_input.question` in the
   source language.
4. Run `node tools/grammar-topics.mjs --write` (re-derives the evidence `topics` map) and
   `node tools/check-grammar.mjs` (must be clean) and `node tools/check-content.mjs`.
5. Cite the target's inventory + reference grammar in `CREDITS.md`.

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
