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
| Activity | ID format |
|---|---|
| Speaking | `{topic}_{i}` (e.g. `greetings_0`) |
| Dictation | `dict_{topic}_{i}` |
| Cloze | `cloze_{topic}_{i}` |
| Translation | `trans_{topic}_{i}` |
| Scramble | `scramble_{topic}_{i}` |
| Quiz | `quiz_vocab_{i}` |

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

All phrase topics live in `speaking/json/{topic}.json`:
```json
{
  "phrases": ["Hello, how are you?", ...],
  "traductions": ["Hola, ¿cómo estás?", ...]
}
```
Available topics: `greetings`, `traveling`, `technology`, `restaurant`, `kitchen`, `supermarket`, `entertainment`, `accountability`, `gym`.

Vocabulary data: `vocabulary/json/words.json`.
Contractions map: `speaking/json/contractions.json`.

---

## CSS conventions

- Design tokens in `index/css/generalities.css` (`:root` and `[data-theme="dark"]`)
- Key variables: `--clr-primary`, `--clr-bg`, `--clr-card`, `--clr-text`, `--clr-border`, `--clr-success`, `--clr-error`
- `.visually-hidden` for screen-reader-only text (defined in generalities.css)
- Topic images use `data-theme="{topic}"` attribute on `.practice-section` (not `data-topic`)

---

## Service worker — ALWAYS bump when adding files

When adding new HTML/CSS/JS/JSON files, bump `CACHE_NAME` in `service-worker.js` and add the new paths to `STATIC_ASSETS`. Current version: `pe-v5`.

```js
// service-worker.js
const CACHE_NAME = 'pe-v5'; // → increment to pe-v6, pe-v7, etc.
```

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

## Mixed Review mode

Clicking the Mixed Review card in `speaking/js/speaking.js` calls `startTopic('__mixed__')`, which triggers `loadMixedPhrases()`. This loads all 9 topics and merges them into one SRS queue. Card IDs are shared with per-topic sessions (`greetings_0`, not `mixed_0`).

---

## PWA / offline

Models (Kokoro ~92 MB, Whisper ~41 MB) are cached by `@huggingface/transformers` in the browser's Cache API (`transformers-cache`) — not the service worker cache. Static app assets are in `pe-v5` service worker cache.
