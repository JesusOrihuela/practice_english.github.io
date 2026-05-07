# PracticeEnglish — Claude Code Context

## What this project is
A static PWA for Spanish speakers learning English. Hosted on GitHub Pages. No backend, no auth, no build step, no framework — pure HTML + CSS + vanilla JS. All state lives in `localStorage` via a custom SM-2 SRS engine.

**Target user:** Spanish-speaking adults learning conversational English.

---

## Architecture

```
practice_english.github.io/
├── index.html                        # Landing page (activity hub)
├── manifest.json + service-worker.js # PWA
├── shared/js/
│   ├── progress.js   # SM-2 SRS engine — included in every activity
│   ├── theme.js      # Dark/light mode toggle
│   ├── tts.js        # AppTTS global (Kokoro-82M via Web Worker)
│   ├── tts-worker.js # Kokoro TTS Web Worker (ESM, imports esm.sh)
│   └── stt-worker.js # Whisper-tiny.en STT Web Worker (ESM)
├── index/css/
│   └── generalities.css  # Global utilities: CSS vars, .visually-hidden, etc.
├── speaking/    # Core speaking activity (largest module)
├── dictation/            # Listen → type what you hear
├── cloze/                # Fill-in-the-blank (generation effect)
├── translation/          # Spanish → English (reverse translation)
├── scramble/             # Word-order reconstruction
├── quiz/                 # Multiple-choice vocabulary
├── vocabulary/       # Flashcard vocab trainer
└── progress/             # Progress dashboard
```

Each activity follows the same layout:
```
{activity}/
  html/{activity}.html
  css/{activity}.css
  js/{activity}.js
```

---

## Shared modules — use these, don't re-invent

### SRS — `shared/js/progress.js` (global `Progress`)
```js
Progress.rate(cardId, quality)           // quality: 1=Hard, 3=OK, 5=Easy
Progress.getNextIndex(cardIds, excludeIdx) // returns index of next due card
Progress.getTopicStats(prefix, total)    // → { seen, due, total }
Progress.recordSession(topic, correct, total)
Progress.getStreak()                     // → { current, best, last }
Progress.getAllCards()                   // → raw localStorage card map
```

**Card ID convention** (CRITICAL — inconsistency breaks per-activity SRS):
| Activity | ID format | Index type |
|---|---|---|
| Speaking | `{topic}_{i}` (e.g. `greetings_0`) | original phrase index |
| Dictation | `dict_{topic}_{i}` | original phrase index |
| Cloze | `cloze_{topic}_{i}` | original phrase index |
| Translation | `trans_{topic}_{i}` | original phrase index (filtered phrases use p.idx, not seqIdx) |
| Scramble | `scramble_{topic}_{i}` | original phrase index (filtered phrases use p.idx, not seqIdx) |
| Quiz (general) | `quiz_vocab_{wordId}` | stable word slug, e.g. `quiz_vocab_abundant` |
| Quiz (topic) | `quiz_{topic}_{wordId}` | stable word slug, e.g. `quiz_greetings_introduction` |
| Vocabulary (general) | `vocab_{wordId}` | stable word slug, e.g. `vocab_abundant` |
| Vocabulary (topic) | `vocab_{topic}_{wordId}` | stable word slug, e.g. `vocab_greetings_introduction` |
| Grammar | `grammar_{category}_{ruleId}` | **stable string rule ID** — use `getAllCards()` + manual filter |

Card IDs are stable string slugs (v3 schema). Use `Progress.getStatsForCards(cardIds)` instead of `getTopicStats()`. Legacy numeric IDs are auto-migrated on first load by `_migrateCardIds()` in progress.js.

### TTS — `shared/js/tts.js` (global `AppTTS`)
```js
AppTTS.speak(text, { voice: 'af_bella', speed: 1.0 }) // → Promise<void>
AppTTS.cancel()
AppTTS.warmup() // call in DOMContentLoaded to start model download early
```
Available voices: `af_bella` (American female), `bf_emma` (British female).
Alternate between them for accent variety. For dictation use `speed: 0.85`.
Shows a download progress panel (bottom-right) on first use (~92 MB, cached).

### STT — Web Worker (`shared/js/stt-worker.js`)
Whisper-tiny.en via `@huggingface/transformers@3.3.3`. ~41 MB, cached after first download.
Used only in `speaking/js/speaking.js` — MediaRecorder → Float32Array @ 16kHz → worker.

---

## Topic data (JSON)

All phrase topics live in `shared/json/{topic}.json` (single source of truth used by every activity):
```json
{
  "phrases": [
    { "id": "greetings_hello_how_are_you_today", "phrase": "Hello, how are you today?", "translation": "Hola, ¿cómo estás hoy?", "cefr": "A1", "grammar": null },
    ...
  ]
}
```
Each phrase object has:
- `id` — stable string slug used as card ID (speaking) or prefixed for other activities
- `phrase` — English text (what the user speaks/types/hears)
- `translation` — Spanish text (prompt for translation, optional hint in speaking)
- `cefr` — `"A1"` | `"A2"` | `"B1"` | `"B2"` | `null` — used for CEFR badge and sorting
- `grammar` — grammar tip string or `null`

**When reading phrase data in activities:**
```js
const _tagged = (data.phrases || []).map(p => ({
  phrase: p.phrase, translation: p.translation || '',
  grammar: p.grammar || null, cefr: p.cefr || null, id: p.id,
})).sort((a, b) => (_order[a.cefr] ?? 99) - (_order[b.cefr] ?? 99));
cardIds = _tagged.map(x => actPrefix + x.id);  // speaking: x.id; others: 'dict_' + x.id, etc.
```

Available topics: `greetings`, `traveling`, `technology`, `restaurant`, `kitchen`, `supermarket`, `entertainment`, `accountability`, `gym`.

Vocabulary data: `vocabulary/json/words.json`.
Contractions map: `shared/json/contractions.json` (contraction→expansion map; useful for any exercise that normalizes text input or compares spoken/typed answers).

**Audio files** live in `shared/audio/{topic}/{index}_{voice}.wav`. Index matches the phrase index in the JSON.
Any activity that plays audio calls `AppAudio.setBase('../../shared/audio/')` (path relative to the activity HTML page).

### Audio generation — `tools/generate-audio.mjs`

Single unified script. Checks every audio source and generates only missing files (always safe to re-run).

```bash
# Run from tools/
node generate-audio.mjs                     # generate everything missing
node generate-audio.mjs --check            # dry-run: report missing files only
node generate-audio.mjs --topic greetings  # single phrase topic
node generate-audio.mjs --topic vocab      # general vocabulary only
node generate-audio.mjs --topic vocab_gym  # topic-specific vocabulary
```

**Sources covered:**
| Source ID | JSON file | Output folder |
|---|---|---|
| `greetings`, `traveling`, … (9 topics) | `shared/json/{topic}.json` | `shared/audio/{topic}/` |
| `vocab` | `shared/json/words.json` | `shared/audio/vocab/` |
| `vocab_{topic}` (9 topics) | `shared/json/words-{topic}.json` | `shared/audio/vocab_{topic}/` |

Voices generated: `af_heart`, `af_bella`, `bf_emma`, `am_michael` (edit `VOICES` in the script to change).

**When to run:** any time you add, edit, or remove phrases from a JSON file. After editing, run `--check` first to see exactly which files are affected, then run without `--check` to generate.

The browser-based `tools/generate-audio.html` also exists for one-off generation without Node.js.

---

## CSS conventions

- Design tokens in `index/css/generalities.css` (`:root` and `[data-theme="dark"]`)
- Key variables: `--clr-primary`, `--clr-bg`, `--clr-card`, `--clr-text`, `--clr-border`, `--clr-success`, `--clr-error`
- `.visually-hidden` for screen-reader-only text (defined in generalities.css)
- Topic images use `data-theme="{topic}"` attribute on `.practice-section` (not `data-topic`)

---

## Service worker

The service worker uses a **network-first** strategy for all HTML/JS/CSS/JSON files — no static asset list to maintain. New files are automatically cached on first fetch. No version bumping needed when adding new files.

---

## Hard constraints

- **No backend.** No API calls to any server we control. No auth.
- **No build step.** No npm, no bundler, no TypeScript compilation. Raw `.js` files.
- **No framework.** No React, Vue, Angular. Vanilla JS only.
- **GitHub Pages compatible.** No server-side headers (no COOP/COEP). No `SharedArrayBuffer`.
- **All state in localStorage.** Key: `pe_srs`. Never break the existing schema.
- **WCAG 2.1 AA.** All interactive elements need `aria-label` or visible label. Use `role="status" aria-live="polite"` for dynamic feedback regions.
- **Don't add `console.log` to production code.**

---

## Script load order in HTML

```html
<script src="../../shared/js/progress.js"></script>  <!-- must be first -->
<script src="../../shared/js/theme.js"></script>
<script src="../../shared/js/tts.js"></script>        <!-- before activity script -->
<script src="js/{activity}.js"></script>               <!-- last -->
```

---

## Feedback diff system — `shared/js/feedback.js` (global `AppFeedback`)

All exercises that check a typed/spoken answer use this shared module for rendering feedback. **Never build custom diff DOM in an activity script.**

### API

```js
// Incorrect state: shows YOUR ANSWER (with errors) + CORRECT ANSWER rows
AppFeedback.buildDiff(userText, correctText, contractionMap)  // → DocumentFragment

// Correct state: shows YOUR ANSWER row (all words green)
AppFeedback.buildCorrect(correctText)  // → DocumentFragment

// Cloze: full phrase with blank word colored; adds CORRECT ANSWER row if wrong
AppFeedback.buildCloze(blankedPhrase, userWord, correctWord, isCorrect)  // → DocumentFragment

// Quiz: chosen vs correct definition as whole blocks (no word-level diff)
AppFeedback.buildQuiz(chosenDefinition, correctDefinition, isCorrect)  // → DocumentFragment
```

Inject into a `<div id="*-diff">` placeholder:
```js
const diffEl = document.getElementById('my-diff');
diffEl.textContent = '';
diffEl.appendChild(AppFeedback.buildDiff(raw, expected, contractionMap));
```

### Visual output

- **YOUR ANSWER** row — words with per-word colored bubble:
  - `.uf-word-ok` — green bg, italic (matched)
  - `.uf-word-err` — red bg, strikethrough, italic (wrong word)
  - `.uf-word-miss` — muted gray, italic (missing — only shown in CORRECT ANSWER row)
- **CORRECT ANSWER** row — shown only when incorrect; all words in `.uf-word-ok`
- `.uf-label` (fixed `width: 130px`, right-aligned, `border-right`) creates the vertical separator bar
- `.uf-words` wraps the bubbles so long phrases wrap without indenting under the label

### Extra info after feedback (divider + note)

When an exercise needs to show additional context (grammar tip, example sentence) below the diff:
1. Place `<div class="feedback-divider hidden" id="feedback-divider"></div>` after the diff container
2. Add a `.feedback-note` block with `.feedback-note-icon` + `.feedback-note-text` spans
3. In JS: remove `hidden` from both elements when content is available

```html
<div class="feedback-divider hidden" id="feedback-divider"></div>
<div class="feedback-note hidden" id="my-note">
  <span class="feedback-note-icon">💡</span>
  <span class="feedback-note-text" id="my-note-text"></span>
</div>
```

**Current users:** Translation (grammar tip via `💡`), Quiz (example sentence via `💬`).

All `.uf-*`, `.feedback-divider`, and `.feedback-note` styles live in `index/css/generalities.css`.

### Display rule (CRITICAL)
`buildDiff` / `buildCorrect` display **original (non-normalized) tokens** — words keep capitalization, punctuation, contractions. Normalization is used **only internally for comparison**. Never pass pre-normalized strings to these functions.

---

## Mixed Review mode

Clicking the Mixed Review card in `speaking/js/speaking.js` calls `startTopic('__mixed__')`, which triggers `loadMixedPhrases()`. This loads all 9 topics and merges them into one SRS queue. Card IDs are shared with per-topic sessions (`greetings_0`, not `mixed_0`).

---

## PWA / offline

Models (Kokoro ~92 MB, Whisper ~41 MB) are cached by `@huggingface/transformers` in the browser's Cache API (`transformers-cache`) — not the service worker cache. Static app assets are in `pe-v5` service worker cache.
