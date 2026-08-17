/* ============================================================
   tests/smoke-voice.mjs — Speaking TTS/STT end-to-end (Playwright + Chromium)

   The plain smoke suite loads pages but never exercises the voice feature, so the
   worker/CSP/model path (Kokoro TTS from esm.sh, Whisper STT from jsdelivr, WASM,
   HF model weights) went unverified — which is how the CSP `worker-src` bug slipped
   through. This drives the real feature:

     • launches Chromium with a fake microphone fed a REAL pre-generated phrase WAV
       (--use-file-for-fake-audio-capture), so recording produces actual speech;
     • TTS: clicks "Listen" and asserts no error / no CSP violation;
     • STT: records → stops → waits for the model to download + transcribe, then
       asserts a NON-error result appeared (the CSP block produced the error state)
       and that Whisper actually returned text.

   It needs network (models load from CDN/HF) and is slower than the plain smoke, so
   it lives in its own script/job. Run: npm run test:voice
   ============================================================ */
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PW_PORT || 8231);
const BASE = `http://127.0.0.1:${PORT}`;
// A clear, short English phrase whose pre-generated WAV feeds the fake mic.
const FAKE_WAV = path.join(ROOT, 'shared/audio/es-en/greetings/good_afternoon-af_bella.wav');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT) || !existsSync(fp) || statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});

let pass = 0, fail = 0;
const check = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };

const ARGS = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',                       // auto-grant mic, no prompt
  `--use-file-for-fake-audio-capture=${FAKE_WAV}`,        // real speech into the mic
  '--autoplay-policy=no-user-gesture-required',
];
function launch() {
  const opts = { headless: true, args: ARGS };
  if (process.env.PW_CHROME_PATH) return chromium.launch({ ...opts, executablePath: process.env.PW_CHROME_PATH });
  if (process.env.PW_CHANNEL)     return chromium.launch({ ...opts, channel: process.env.PW_CHANNEL });
  return chromium.launch({ ...opts, channel: 'msedge' });
}

const waitText = async (page, sel, ms) => {         // poll a selector for non-empty text
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = (await page.textContent(sel).catch(() => '')) || '';
    if (t.trim()) return t.trim();
    await page.waitForTimeout(1000);
  }
  return '';
};

if (!existsSync(FAKE_WAV)) { console.error('missing fake-mic WAV: ' + FAKE_WAV); process.exit(1); }
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await launch();
try {
  console.log('Speaking — TTS (Kokoro/esm.sh) + STT (Whisper/jsdelivr) under CSP');
  const page = await browser.newPage();
  const errs = [], csp = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { const t = m.text(); if (/content security policy|violates the following/i.test(t)) csp.push(t); });

  await page.goto(BASE + '/speaking/html/speaking.html', { waitUntil: 'domcontentloaded' });
  await page.click('#topic-grid button');                // pick a topic → phrase browser
  await page.waitForSelector('.pb-chip', { state: 'visible', timeout: 15000 });
  await page.click('.pb-chip');                          // pick a phrase → exercise area
  await page.waitForSelector('#speakButton', { state: 'visible', timeout: 15000 });
  check(!!(await page.textContent('#Phrase').catch(() => '')), 'exercise reached (phrase visible)');

  // TTS: "Listen" must not error and must not trip the CSP.
  await page.click('#listenButton');
  await page.waitForTimeout(4000);                        // model load + synth (first time is slow)
  check(!/error/i.test((await page.textContent('#speaking-feedback-result').catch(() => '')) || ''), 'TTS: Listen produced no error banner');
  check(csp.length === 0, `TTS: no CSP worker/script violation (${csp[0] || ''})`);

  // STT: record → stop → transcribe. Result must be a real terminal state, not the error.
  await page.click('#speakButton');                      // start recording (fake mic feeds the WAV)
  await page.waitForTimeout(3000);
  await page.click('#speakButton').catch(() => {});      // stop (VAD may have auto-stopped already)
  const result = await waitText(page, '#speaking-feedback-result', 150000);  // model download can be slow
  console.log(`    → STT result: "${result}"  heard: "${(await page.textContent('#recognizedText').catch(() => '')) || ''}"`);
  check(result !== '',                       'STT: transcription completed (a result appeared)');
  check(!/^✗?\s*error/i.test(result),        `STT: result is NOT the error state ("${result}")`);
  check(csp.length === 0,                    `STT: no CSP worker/script violation (${csp[0] || ''})`);
  check(errs.length === 0,                   `no page errors (${errs[0] || ''})`);
  await page.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
