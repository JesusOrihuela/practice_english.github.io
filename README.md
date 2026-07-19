# Practice English

A free, installable **language-learning PWA** that teaches a target language through real-life topics and eight skill-building activities — with on-device speech synthesis and recognition, a spaced-repetition learning path, and full offline support. No backend, no sign-up, no tracking.

[![Content checks](https://github.com/JesusOrihuela/practice_english.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/JesusOrihuela/practice_english.github.io/actions/workflows/ci.yml)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)
![No build step](https://img.shields.io/badge/build-none-brightgreen)
![Vanilla JS](https://img.shields.io/badge/stack-HTML%20%C2%B7%20CSS%20%C2%B7%20vanilla%20JS-f7df1e)

**▶ Live app:** https://jesusorihuela.github.io/practice_english.github.io/

---

## What it is

Practice English is a static Progressive Web App for language learners. It guides you through 13 everyday topics (greetings, restaurant, airport, technology, …) in CEFR order and builds a daily study session automatically using a custom **SM-2 spaced-repetition** engine. Everything — progress, placement, preferences — lives in your browser's `localStorage`; nothing is sent to a server.

It ships as two independent language pairs:

| Pair | You speak | You learn |
|------|-----------|-----------|
| `es-en` | Spanish | English |
| `en-es` | English | Spanish (neutral) |

Each pair has its own independent content, and switching pairs is a completely separate session — no data is shared or lost.

## Features

- **Eight practice activities**, each targeting a different skill:
  - 🎙️ **Pronunciation** — listen, record, and get speech-recognition feedback
  - ✍️ **Dictation** — listen and type what you hear
  - 🔤 **Cloze** — fill in the blank (the generation effect)
  - 🔄 **Translation** — read the prompt, write the target phrase
  - 🧩 **Scramble** — reorder jumbled words
  - 📚 **Vocabulary** — flashcards with definitions and examples
  - 🧠 **Quiz** — adaptive multiple-choice vocabulary
  - 📐 **Grammar** — rules browser + fill-in-the-blank exercises
- **Mi Aprendizaje** — a guided learning path with a daily session queue, mastery tracking, and a CEFR progression.
- **Placement test** — a 14-question CEFR test (A1–C2) to start at the right level.
- **On-device audio** — pre-generated natural speech for instant playback, with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) TTS and [Whisper](https://huggingface.co/onnx-community/whisper-tiny) STT running fully in the browser (no audio ever leaves your device).
- **Works offline** — installable PWA with a network-first service worker; models and audio are cached after first use.
- **Accessible** — WCAG 2.1 AA target: labelled controls, live regions, keyboard support.

## Tech stack

Deliberately minimal and dependency-free at runtime:

- **Pure HTML + CSS + vanilla JavaScript** — no framework, **no build step**, no bundler.
- **No backend, no auth** — all state in `localStorage`; hosted on **GitHub Pages**.
- **On-device ML** via [`@huggingface/transformers`](https://github.com/huggingface/transformers.js) (Kokoro TTS ~92 MB, Whisper STT ~41 MB), cached in the browser Cache API.
- **Pre-generated WAV audio** committed to the repo so playback is instant without downloading the TTS model.

## Getting started

Because the app uses `fetch()` for content and registers a service worker, it must be served over HTTP — open it via a local server, not `file://`.

```bash
git clone https://github.com/JesusOrihuela/practice_english.github.io.git
cd practice_english.github.io

# serve the folder with any static server, e.g.:
python -m http.server 8000
# then open http://localhost:8000/
```

> **Note:** the repository includes the pre-generated audio, so the clone is large (~1 GB+). This is intentional — it gives users instant playback without downloading the TTS model.

## Project structure

```
├── index.html                 # Landing page
├── {activity}/                # speaking, dictation, cloze, translation, scramble,
│   ├── html/ css/ js/         #   vocabulary, quiz, grammar, my-learning, placement, progress
├── shared/
│   ├── js/                    # Shared modules (SRS engine, TTS/STT, data cache, i18n, learning path…)
│   ├── json/
│   │   ├── pairs/{pairId}/    # Pair-specific content (phrases, grammar, placement)
│   │   └── common/            # Shared content (vocabulary, word-equivalents, onboarding)
│   └── audio/                 # Pre-generated WAV files, per pair + shared vocab
├── lang/                      # UI strings (source language) + target-language labels
├── tools/                     # Content-audit + audio-generation scripts (Node/Python)
└── .github/workflows/         # CI (content checks + Lighthouse)
```

## Content & tooling

Content lives in JSON and is validated by scripts in [`tools/`](tools/):

- `node tools/check-content.mjs` / `node tools/audit.mjs` — validate schema, spelling, punctuation, ID uniqueness, anglicisms, audio alignment, and more.
- `node tools/assign-alt-slugs.mjs` — assign stable audio slugs to new phrase forms.
- `node tools/generate-audio.mjs` (English, Kokoro) and `python tools/generate-audio-tgt.py --lang es` (other languages, edge-tts) — generate the WAV audio.
- `node tools/fix-phrase-ids.js` — sync the learning-path ID map after content changes.

Adding a new language pair is data-only: create `shared/json/pairs/{pairId}/`, add the pair to `lang-pair.js` and a UI-strings block to `lang/ui.js`, then generate audio. No activity code changes.

## CI/CD

- **Content checks** ([`ci.yml`](.github/workflows/ci.yml)) run `check-content` + `audit` on every push and pull request to `main`; the check is required before a PR can merge.
- **Lighthouse** ([`lighthouse.yml`](.github/workflows/lighthouse.yml)) audits the live site after each deploy (report-only) to track performance, accessibility, best practices, and SEO.
- Deployment is handled by GitHub Pages on every push to `main` — there is no build step.

## License

Released under the [MIT License](LICENSE) — free to use, modify, and distribute with attribution.

---

<sub>Built with vanilla web tech and on-device ML.</sub>
