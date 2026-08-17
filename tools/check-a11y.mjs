#!/usr/bin/env node
/* ============================================================
   check-a11y.mjs — Deterministic accessibility gate for the app's HTML pages.

   Complements check-i18n (which enforces externalized UI text). Pages are
   DISCOVERED from the filesystem (every {activity}/html/*.html) — no hardcoded list.
   High-precision, zero-false-positive checks suitable for CI:

     • <html> carries a lang attribute
     • every <img> has alt (or aria-hidden)                → screen-reader label
     • every <button>/<a href> has an accessible name       → aria-label, title,
       aria-labelledby, data-i18n[-aria] (runtime text), or non-empty inner text
     • every <input>/<select>/<textarea> has a name         → aria-label(ledby),
       title, placeholder, or an associated <label for=id>
     • no duplicate id within a page

   Runtime i18n attributes (data-i18n, data-i18n-aria) count as an accessible
   name because the text is injected on load, so a statically-empty button is
   still named — that keeps the gate free of false positives.

   Read-only. Exits 1 on any issue (for CI). Usage: node tools/check-a11y.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Discover every {activity}/html/*.html page from the filesystem.
const pages = [];
for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const htmlDir = join(ROOT, d.name, 'html');
  if (!existsSync(htmlDir)) continue;
  for (const f of readdirSync(htmlDir)) if (f.endsWith('.html')) pages.push(`${d.name}/html/${f}`);
}

const issues = [];
const flag = (page, rule, msg) => issues.push({ page, rule, msg });
const hasAttr = (openTag, name) => new RegExp(`\\b${name}(=|\\b)`, 'i').test(openTag);
const named = (openTag) => ['aria-label', 'aria-labelledby', 'title', 'data-i18n', 'data-i18n-aria']
  .some((a) => hasAttr(openTag, a));
const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, '').trim();

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), 'utf8');

  // 1) <html lang>
  const htmlTag = html.match(/<html[^>]*>/i);
  if (!htmlTag || !hasAttr(htmlTag[0], 'lang')) flag(page, 'html-lang', '<html> sin atributo lang');

  // 2) <img> alt
  for (const m of html.matchAll(/<img\b[^>]*>/gi))
    if (!hasAttr(m[0], 'alt') && !hasAttr(m[0], 'aria-hidden'))
      flag(page, 'img-alt', `<img> sin alt: ${m[0].slice(0, 80)}`);

  // 3) <button> / <a href> accessible name (attr OR non-empty inner text)
  for (const re of [/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, /<a\b([^>]*\bhref=[^>]*)>([\s\S]*?)<\/a>/gi]) {
    for (const m of html.matchAll(re)) {
      if (named('<x ' + m[1] + '>')) continue;
      if (stripTags(m[2])) continue;                          // visible text names it
      flag(page, 'control-name', `control sin nombre accesible: <${m[0].slice(1, 60)}…`);
    }
  }

  // 4) form controls accessible name
  const labelFor = new Set([...html.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["']/gi)].map((m) => m[1]));
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const tag = m[0], attrs = m[2];
    const type = (attrs.match(/\btype=["']?([a-z]+)/i) || [])[1] || 'text';
    if (m[1].toLowerCase() === 'input' && ['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    const id = (attrs.match(/\bid=["']([^"']+)["']/) || [])[1];
    if (named(tag) || hasAttr(tag, 'placeholder') || (id && labelFor.has(id))) continue;
    flag(page, 'control-name', `<${m[1]}> sin nombre accesible: ${tag.slice(0, 70)}`);
  }

  // 5) duplicate ids
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
  const seen = new Set(), dup = new Set();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  for (const id of dup) flag(page, 'dup-id', `id duplicado: "${id}"`);
}

if (issues.length === 0) { console.log(`✓ check-a11y: ${pages.length} páginas — ALL CLEAR`); process.exit(0); }
const byRule = {};
for (const i of issues) (byRule[i.rule] ||= []).push(i);
console.log(`✗ check-a11y: ${issues.length} problemas en ${pages.length} páginas\n`);
for (const rule of Object.keys(byRule).sort()) {
  console.log(`── ${rule} (${byRule[rule].length}) ──`);
  for (const i of byRule[rule]) console.log(`  [${i.page}] ${i.msg}`);
  console.log('');
}
process.exit(1);
