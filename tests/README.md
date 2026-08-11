# Browser smoke suite

`smoke.mjs` runs the app in a **real headless browser** (Playwright + Chromium) and
checks the things the static tools (`check-content`, `check-i18n`, `audit`) can't:
the answer loop, feedback rendering, the Enter-key behavior, and that every page
loads with no uncaught JS errors.

It serves the repo over a throwaway local HTTP server (the service worker needs a
real origin, not `file://`), drives each activity, and asserts. No network or audio
needed. It already caught a real bug (the placement page was missing its
`topic-data.js` include → `AppData is not defined`).

## Run

```bash
npm install     # once — installs playwright-core (no browser download)
npm test
```

**Browser selection** (in order): `PW_CHROME_PATH` (an explicit binary) →
`PW_CHANNEL` (e.g. `chrome`) → your installed **Edge** (`channel: 'msedge'`, the
local default). So locally you need no browser download; it uses Edge/Brave/Chrome.

## What it covers

- **Enter regression** (cloze / translation / dictation): one Enter shows feedback
  and must not re-fire the focused button; a correct answer in cloze stays on screen
  and only a *second* Enter advances.
- **Smoke-load** of every page: no uncaught JS errors on load.

## Not covered

Speaking with the microphone (STT) and the heavy TTS/Whisper WASM models — those
need real audio/hardware. Everything else in the UI is exercised.

## CI

Runs as the `e2e` job in `.github/workflows/ci.yml` (checks out the app without the
~400 MB of audio, installs Chrome, runs `npm test`).
