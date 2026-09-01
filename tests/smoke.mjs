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
// `pair` (optional) selects the active language pair before any page script runs,
// so we can exercise a non-default target language (e.g. Spanish: ñ-preserving
// fold + Spanish cloze stop-words from the language profile).
async function openExercise(page, url, inputSel, pair) {
  if (pair) await page.addInitScript(p => { localStorage.setItem('pe_active_pair', p); }, pair);
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

  // ── 2b. Language profile in a NON-DEFAULT target (Spanish, en-es pair): the
  //    ñ-preserving accent fold and the Spanish cloze stop-words come from
  //    shared/js/lang-profiles.js. Assert the profile is wired for Spanish and
  //    that a correct answer (typed back as the folded form) still matches.
  {
    console.log('Language profile — en-es (Spanish target)');
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await openExercise(page, '/cloze/html/cloze.html', '#cloze-input', 'en-es');
    const prof = await page.evaluate(() => ({
      pair: AppLangPair.getActive().id,
      preserve: AppLangProfiles.foldPreserve('es'),
      stops: AppLangProfiles.clozeStopWords('es').size,
      // ñ must survive the fold (año ≠ ano); accents must not.
      folded: AppText.normalise('Año pingüino ESTÁ'),
    }));
    check(prof.pair === 'en-es',        `en-es: active pair is Spanish target (${prof.pair})`);
    check(prof.preserve === 'ñ',        `en-es: profile preserves ñ (${prof.preserve})`);
    check(prof.stops > 0,               `en-es: Spanish cloze stop-words loaded (${prof.stops})`);
    check(prof.folded === 'año pinguino esta', `en-es: fold keeps ñ, drops accents ("${prof.folded}")`);
    const answer = await page.evaluate(() => (typeof currentBlank !== 'undefined' && currentBlank) ? currentBlank.blankClean : null);
    if (answer) {
      await page.fill('#cloze-input', answer);
      await page.press('#cloze-input', 'Enter');
      await page.waitForTimeout(350);
      check(/correct|correcto/i.test((await page.textContent('#feedback-result')) || ''), 'en-es cloze: correct answer matches (fold works)');
    } else { console.log('  ~ correct-path skipped (no readable answer)'); }
    check(errs.length === 0,            `en-es: no page errors (${errs[0] || ''})`);
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

  // ── 4. Divergent stress-test pairs (en-de, en-fi) load every screen with no JS
  //    errors — the app derives topics/grammar/vocab per pair, so a pair-specific
  //    break (missing content, bad script order, absent dimension) surfaces here.
  for (const pair of ['en-de', 'en-fi']) {
    console.log(`Stress-test pair — ${pair}`);
    for (const url of [
      '/index.html', '/my-learning/html/my-learning.html', '/progress/html/progress.html',
      '/grammar/html/grammar.html', '/vocabulary/html/vocabulary.html', '/placement/html/placement.html',
      '/speaking/html/speaking.html',
    ]) {
      const page = await browser.newPage();
      const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.addInitScript(p => { localStorage.setItem('pe_active_pair', p); }, pair);
      await page.goto(BASE + url, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      check(errs.length === 0, `${pair}: load ${url} — no page errors (${errs[0] || ''})`);
      await page.close();
    }
  }

  // ── 5. Variant tags render an inline-SVG ICON, never an emoji. Call the app's own
  //    AppFeedback.buildWordVariants in-page (deterministic — no card-flip flake) with a
  //    number/case variant set and assert the chips carry <svg class="variant-ico"> and
  //    contain no emoji codepoint. Guards the "usa iconos, no emojis" requirement.
  {
    console.log('Variant tags — inline-SVG icons, not emoji');
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => { localStorage.setItem('pe_active_pair', 'en-de'); }, null);
    await page.goto(BASE + '/vocabulary/html/vocabulary.html?topic=family', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      if (typeof AppFeedback === 'undefined' || !AppFeedback.buildWordVariants) return { skip: true };
      const t = (k) => (typeof AppLang !== 'undefined' ? AppLang.t(k) : k);
      const frag = AppFeedback.buildWordVariants(
        [{ text: 'die Kinder', labels: { number: 'plural' } },
         { text: 'den Mann',   labels: { case: 'akkusativ' } },
         { text: 'die Lehrerin', labels: { gender: 'femenino' } }],
        'das Kind', t);
      const div = document.createElement('div'); if (frag) div.appendChild(frag);
      return {
        hasSvg: !!div.querySelector('svg.variant-ico'),
        emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u.test(div.textContent || ''),
        n: div.querySelectorAll('svg.variant-ico').length,
      };
    });
    check(errs.length === 0, `variant tags: no page errors (${errs[0] || ''})`);
    check(!r.skip && r.hasSvg, `variant tags render an <svg class="variant-ico"> (${r.n || 0} icons)`);
    check(!r.skip && !r.emoji, 'variant tags contain NO emoji codepoint');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
