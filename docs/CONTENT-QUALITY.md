# Content quality — mechanical + semantic

This is the end-to-end system that keeps content **high quality regardless of pair,
language, or category**: well-defined, correctly categorized, with semantic-domain
failures (atomicity, mis-categorization, synonymy, polysemy) minimized — for both the
content already created and everything added in the future.

## Why two layers

The existing checks (`check-content`, `audit`, `coverage`, `check-i18n`) are
**mechanical/syntactic** — decidable by regex or counting (JSON, identical ids,
punctuation, anglicisms-against-a-list, audio counts, coverage %). But the failures that
keep recurring when adding content — **category atomicity, correct categorization,
duplication by synonymy, polysemy/context** — live in the **meaning domain**, which is
not decidable by regex. They were left to author judgment with no independent oracle.

So the system adds the two missing layers:

1. **Deterministic (in CI)** — cheap, zero-false-positive checks for the mechanical
   subset that was still missing.
2. **Semantic (dev-time)** — a heuristic embedding-based detector that surfaces a short,
   ranked shortlist of the judgment-domain suspects for human confirmation.

**Dual purpose.** *Retrospective:* audit + clean all existing content, data-driven.
*Prospective:* keep new content correct by construction — `classify` at authoring time,
deterministic checks block bad content in CI, and the semantic audit runs after each batch.

## The canonical taxonomy — `shared/json/common/category-scopes.json`

The single machine-readable source of truth for every category (was prose in CLAUDE.md).
Per entry: `id`, `kind` (`phrase`|`vocab`), `scope`, bilingual `examples`, and **`axis`**:

- **`topical`** (restaurant, naturaleza, health…) — unified by THEME; cohesive. The
  semantic misplacement / homeless / atomicity tests apply here.
- **`functional`** (survival, conversacion, planes, pensamientos_opiniones, greetings…) —
  unified by a communicative ACT; topically dispersed **by design**. Topical-cohesion
  tests do NOT apply (they would flag all of them as "non-atomic").
- **`property`** (verbos_*, adjetivos_*, colores, general/Conceptos, objetos, cantidad) —
  unified by POS or abstractness/concreteness, not theme. Validity is POS↔deck
  (deterministic) — not topical similarity.

`axis` is the key that prevents massive false positives. Also holds the global tie-break
rules (most-specific wins; situational > functional; by meaning not verb; real tie → omit).

## The tools

| Tool | Layer | Runs | What it does |
|---|---|---|---|
| `check-taxonomy.mjs` | deterministic | **CI** | Every category ↔ scope (no orphans); every phrase id respects its topic prefix. |
| `check-content.mjs` | deterministic | **CI** | + exact-duplicate phrase (per pair) / vocab term (per lang), cross-deck term uniqueness, POS↔deck. (Plus the older R11/R15/R16/R17 rules.) |
| `semantic-audit.mjs` | semantic | dev-time | The meaning-domain detector (below). Report-only. |
| `classify.mjs` | semantic | dev-time | Author-time: suggests the top-N best-fitting topical categories for a candidate; warns if homeless. |
| `move-item.mjs` | — | dev-time | Safely move an entry between categories (JSON + id re-prefix + audio relocation by slug). |

The semantic tools use `@huggingface/transformers` with the multilingual model
`Xenova/paraphrase-multilingual-MiniLM-L12-v2` (works for any pair/language; a ~120 MB
dev-only dependency, cached like Kokoro — never shipped to users). They are **heuristic**
and **report-only** — a human confirms every action; that is why they are NOT in CI.

### What `semantic-audit.mjs` detects (report-only, ranked)

Anchors are the **centroid** of each topical category's own members (a relative signal,
robust to absolute-scale noise). For each item:

- **Misplacement** — closer to another category's centroid than its own, **triple-
  corroborated** (centroid gap + kNN majority); ranked confident-first.
- **Ambiguous (≈50/50)** — small top1−top2 gap; the human applies the tie-break rules.
- **Homeless** — far from every centroid → candidate to omit; homeless items that
  **cluster** together → proposal for a NEW category.
- **Semantic duplication** — high cosine but not identical text: `near-dup` (high lexical
  overlap) vs `paraphrase/synonym` (low overlap) — the case the id check can't see.
- **Low fidelity** — `source↔target` (Rule 14: source must be a faithful translation) and
  `term↔definition`. Cross-lingual similarity of faithful idiomatic translations is wide,
  so the threshold is deliberately conservative (a weak signal; treat as a hint).
- **Low cohesion** — a topical category whose members don't cluster → candidate to split.

Output: `tools/sources/derived/semantic-audit-report.json` (+ printed summary). Embedding
cache and report live under `tools/sources/derived/` (gitignored). Waivers —
`tools/semantic-audit-waivers.json` (tracked) — key by item (or `a|b` for a dup pair),
optional `hash` (so a changed item re-flags) and `kinds[]`. Thresholds are calibrated
empirically (see the `T` object in the tool) and refined as content grows.

## The workflow

1. **Authoring a batch** — for each candidate, run `classify` to place it in the right
   category the first time (or learn it's homeless → omit / new category).
2. **CI** — `check-taxonomy` + `check-content` block mechanical failures on push/PR.
3. **After the batch** — run `semantic-audit` (incremental or full), triage the ranked
   report: move (`move-item`) / rename / merge dup / split category / omit. Then the
   pipeline (`grammar-topics --write` → `fix-phrase-ids` → `check-content` → `audit` →
   `coverage`). Record accepted borderline cases in the waivers.
4. **Repeat** until only justified waivers remain.

## Triage notes (reduce, don't over-trust)

- Confirm **every** semantic flag by hand — the layer ranks suspects, it does not decide.
- **Misplacement is reliable for VOCAB, noisy for PHRASES.** A vocab entry is one concept,
  so a wrong deck stands out (an airport in `lugares`, a business term in `supermarket`).
  A phrase is situational and *mentions* several domains ("the water is cold" → the model
  pulls it to `weather`; "hotel breakfast included" → `restaurant`), so its primary meaning
  usually stays put and the flag is a false positive. Triage vocab misplacements first;
  waive the situational phrase flags.
- **Removing a duplicate never lowers coverage** (the kept copy has the same lemmas).
  **Removing a homeless item** can; re-run `coverage --gate` and, if needed, cover the
  lemma with a well-placed replacement before closing the batch.
- Idioms/figurative phrases and opaque jargon/acronyms are known noise sources (they land
  in "ambiguous" / low-fidelity); expect them and waive.
- Gender/register/region variants of ONE phrase are a single unit — never a duplicate.
