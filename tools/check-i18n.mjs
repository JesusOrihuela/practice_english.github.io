/* ============================================================
   check-i18n.mjs — enforces the "no hardcoded UI text" standard.

   Checks every HTML page:
   1. KEY RESOLUTION — each data-i18n / -html / -aria / -placeholder key
      used in the HTML is defined in EVERY language block of lang/ui.js.
   2. NO HARDCODED TEXT — no translatable element (h1/h2/h3/p/button/label,
      or a <span> with a class) holds literal letter text unless it carries a
      data-i18n* attribute. Elements with an id (JS-filled at runtime) and
      pure emoji/number/symbol text are allowed.

   Exit 1 on any violation. Run: node tools/check-i18n.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = [
  'index.html',
  ...['speaking','dictation','cloze','translation','scramble','vocabulary','quiz','grammar','my-learning','progress','placement']
      .map(a => `${a}/html/${a}.html`),
];

// ── Parse lang/ui.js language blocks ──────────────────────────────────────
const ui = fs.readFileSync(path.join(ROOT, 'lang/ui.js'), 'utf8');
// top-level 2-letter blocks like `\n    es: {` (skip commented `// pt:`)
const blockRe = /\n {4}([a-z]{2}): \{/g;
const blocks = {};
let bm, starts = [];
while ((bm = blockRe.exec(ui))) starts.push({ code: bm[1], idx: bm.index });
for (let i = 0; i < starts.length; i++) {
  const from = starts[i].idx;
  const to = i + 1 < starts.length ? starts[i + 1].idx : ui.length;
  const body = ui.slice(from, to);
  const keys = new Set();
  for (const m of body.matchAll(/^\s*([a-z0-9_]+)\s*:/gim)) keys.add(m[1]);
  blocks[starts[i].code] = keys;
}
const langCodes = Object.keys(blocks);

// ── Scan HTML ─────────────────────────────────────────────────────────────
const problems = [];
const TAGS = /<(h1|h2|h3|h4|p|button|label)\b([^>]*)>([^<]*)</gi;
const SPAN = /<span\b([^>]*\bclass="[^"]*"[^>]*)>([^<]*)</gi;
const hasI18n = (attrs) => /data-i18n(?:-html|-aria|-placeholder)?=/.test(attrs);
const hasId = (attrs) => /\bid="/.test(attrs);
const isLetterText = (t) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]{2,}/.test(t);

for (const rel of HTML) {
  const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  // 1. keys resolve in every block
  for (const m of s.matchAll(/data-i18n(?:-html|-aria|-placeholder)?="([a-z0-9_]+)"/gi)) {
    const key = m[1];
    for (const code of langCodes) {
      if (!blocks[code].has(key)) problems.push(`${rel}: key "${key}" missing in ui.js '${code}' block`);
    }
  }

  // 2. no hardcoded text (heuristic)
  const scan = (re, attrsIdx, textIdx) => {
    let m;
    while ((m = re.exec(s))) {
      const attrs = m[attrsIdx] || '';
      const text = (m[textIdx] || '').trim();
      if (!isLetterText(text)) continue;      // emoji/number/symbol only → ok
      if (hasI18n(attrs)) continue;            // translated via data-i18n → ok
      if (hasId(attrs)) continue;              // JS-filled at runtime → ok
      problems.push(`${rel}: hardcoded text "${text.slice(0, 40)}" (add data-i18n or an id)`);
    }
  };
  scan(TAGS, 2, 3);
  scan(SPAN, 1, 2);
}

if (problems.length) {
  console.log(`✗ check-i18n: ${problems.length} issue(s)`);
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
} else {
  console.log(`✓ check-i18n: 0 issues — no hardcoded UI text; all keys resolve in [${langCodes.join(', ')}]`);
}
