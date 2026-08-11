/* ============================================================
   tests/smoke.mjs — browser smoke suite (Playwright + headless Chromium)

   Runs the app in a real headless browser and checks the flows that unit-level
   checks (check-content / check-i18n / audit) can't: DOM interaction, the answer
   loop, feedback rendering, and that pages load with no JS errors.

   Run locally:   npm test           (uses your installed Edge via channel)
   In CI:         PW_CHROME_PATH set to a Chromium binary (see ci.yml).

   It serves the repo over a throwaway HTTP server (the service worker needs a
   real origin, not file://) and drives each activity. No network/audio needed.
   ============================================================ */
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PW_PORT || 8199);
const BASE = `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT) || !existsSync(fp) || statSync(fp).isDirectory()) {
      res.writeHead(404); res.end('404'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});

// ── tiny test runner ────────────────────────────────────────
let pass = 0, fail = 0;
const check = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };

function launch() {
  const opts = { headless: true };
  if (process.env.PW_CHROME_PATH) return chromium.launch({ ...opts, executablePath: process.env.PW_CHROME_PATH });
  if (process.env.PW_CHANNEL)     return chromium.launch({ ...opts, channel: process.env.PW_CHANNEL });
  return chromium.launch({ ...opts, channel: 'msedge' });          // local dev: installed Edge
}

// Drive: topic picker → phrase browser → exercise input visible.
async function openExercise(page, url, inputSel) {
  // Not 'networkidle' — Speaking/Vocabulary warm up TTS/STT models so the network
  // is never idle. The explicit selector waits below gate on the actual UI instead.
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.click('#topic-grid button');
  await page.click('.pb-chip');
  await page.waitForSelector(inputSel, { state: 'visible' });
}

await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await launch();

try {
  // ── 1. Enter regression: one Enter shows feedback and must NOT re-trigger the
  //    focused button (the bug where Enter submitted AND advanced/reset). Uses a
  //    deliberately wrong answer so Try-again is the focused button — reverting the
  //    deferred-focus fix would re-fire it and reset the round.
  for (const a of [
    { name: 'cloze',       url: '/cloze/html/cloze.html',             input: '#cloze-input', fb: '#cloze-feedback' },
    { name: 'translation', url: '/translation/html/translation.html', input: '#trans-input', fb: '#trans-feedback' },
    { name: 'dictation',   url: '/dictation/html/dictation.html',     input: '#dict-input',  fb: '#dict-feedback'  },
  ]) {
    console.log(`Enter regression — ${a.name}`);
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await openExercise(page, a.url, a.input);
    await page.fill(a.input, 'zzqzzq');
    await page.press(a.input, 'Enter');
    await page.waitForTimeout(350);
    check(await page.isVisible(a.fb),                 `${a.name}: feedback stays visible after one Enter`);
    check(await page.isVisible('#try-again-btn'),     `${a.name}: Try-again is shown (no auto re-trigger)`);
    check((await page.inputValue(a.input)) === 'zzqzzq', `${a.name}: input not reset (single Enter didn't double-fire)`);
    check(errs.length === 0,                          `${a.name}: no page errors (${errs[0] || ''})`);
    await page.close();
  }

  // ── 2. Cloze correct path (the exact reported scenario): correct answer + Enter
  //    shows "Correct!" and stays; a SECOND Enter advances. Best-effort: skips if
  //    the answer can't be read from app state.
  {
    console.log('Enter regression — cloze correct path');
    const page = await browser.newPage();
    await openExercise(page, '/cloze/html/cloze.html', '#cloze-input');
    const answer = await page.evaluate(() => (typeof currentBlank !== 'undefined' && currentBlank) ? currentBlank.blankClean : null);
    if (!answer) { console.log('  ~ skipped (could not read answer from app state)'); }
    else {
      const before = await page.textContent('#phrase-text');
      await page.fill('#cloze-input', answer);
      await page.press('#cloze-input', 'Enter');
      await page.waitForTimeout(350);
      check(await page.isVisible('#cloze-feedback'),                     'cloze correct: feedback visible (not skipped)');
      check(/correct|correcto/i.test((await page.textContent('#feedback-result')) || ''), 'cloze correct: says Correct');
      check((await page.textContent('#phrase-text')) === before,        'cloze correct: did NOT auto-advance');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(350);
      check((await page.textContent('#phrase-text')) !== before,        'cloze correct: a second Enter advances');
    }
    await page.close();
  }

  // ── 3. Smoke-load every page: no uncaught JS errors on load.
  console.log('Smoke load — all pages');
  for (const url of [
    '/index.html', '/speaking/html/speaking.html', '/scramble/html/scramble.html',
    '/vocabulary/html/vocabulary.html', '/quiz/html/quiz.html', '/grammar/html/grammar.html',
    '/my-learning/html/my-learning.html', '/progress/html/progress.html', '/placement/html/placement.html',
  ]) {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + url, { waitUntil: 'load' });   // not networkidle — TTS/model loads
    await page.waitForTimeout(400);
    check(errs.length === 0, `load ${url} — no page errors (${errs[0] || ''})`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
