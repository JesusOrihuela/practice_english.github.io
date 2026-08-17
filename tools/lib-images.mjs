/* ============================================================
   lib-images.mjs — Shared discovery for the topic-image pipeline.

   Single derived source of truth (nothing hardcoded): the topic manifest is
   parsed from shared/js/topics.js (the app's TOPICS array), the image
   activities from the filesystem (dirs with an img/ folder), and each topic's
   CLIP descriptor from its label + category scope. Mirrors tools/lib-content.mjs.

   A "cell" is one (activity, topic) image slot: {activity}/img/{topic}.jpg
   (1280×720) + .webp (800×450). Phrase activities carry phrase topics; the two
   vocab activities (quiz, vocabulary) carry vocab topics — derived, not hardcoded.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Canonical dimensions the cards are built for (topic-grid.js renders 800×450).
export const CANON = { jpg: [1280, 720], webp: [800, 450] };
export const ROOT_DIR = ROOT;

let _topics = null;
/** Parse the TOPICS array from shared/js/topics.js → [{id,label,labelEn,phrase,vocab}]. */
export function topics() {
  if (_topics) return _topics;
  const src = fs.readFileSync(path.join(ROOT, 'shared/js/topics.js'), 'utf8');
  const objs = [...src.matchAll(/\{\s*id:\s*(["'])([a-z_]+)\1[^}]*\}/g)].map(m => m[0]);
  const seen = new Set();
  _topics = [];
  for (const o of objs) {
    const id = (o.match(/id:\s*["']([a-z_]+)/) || [])[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    _topics.push({
      id,
      label: (o.match(/label:\s*["']([^"']+)/) || [])[1] || id,
      labelEn: (o.match(/labelEn:\s*["']([^"']+)/) || [])[1] || id,
      phrase: /phrase:\s*true/.test(o),
      vocab: /vocab:\s*true/.test(o),
    });
  }
  return _topics;
}

let _scopes = null;
function scopeFor(id) {
  if (!_scopes) {
    _scopes = {};
    try {
      const sc = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/json/common/category-scopes.json'), 'utf8'));
      // prefer vocab scope, fall back to phrase scope — both describe the theme
      for (const c of sc.categories) { if (!_scopes[c.id] || c.kind === 'vocab') _scopes[c.id] = c.scope; }
    } catch { /* scopes optional */ }
  }
  return _scopes[id] || '';
}

/** Theme text for CLIP relevance: English label enriched by its scope when present. */
export function descriptor(topic) {
  const s = scopeFor(topic.id);
  return s ? `${topic.labelEn}. ${s}` : `a photo representing ${topic.labelEn}`;
}

/** Activity dirs that hold topic images (exclude index's logo folder). */
export function imageActivities() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'img')))
    .map(d => d.name).filter(a => a !== 'index').sort();
}

/** Derived: an activity is vocab-kind iff it holds an image for a vocab-only topic. */
export function activityKind(act) {
  const vocabOnly = new Set(topics().filter(t => t.vocab && !t.phrase).map(t => t.id));
  const dir = path.join(ROOT, act, 'img');
  const hit = fs.readdirSync(dir).some(f => f.endsWith('.webp') && vocabOnly.has(f.replace(/\.webp$/, '')));
  return hit ? 'vocab' : 'phrase';
}

/** Topics an activity SHOULD have an image for (phrase→phrase topics, vocab→vocab topics). */
export function expectedTopics(act) {
  const vocabKind = activityKind(act) === 'vocab';
  return topics().filter(t => (vocabKind ? t.vocab : t.phrase));
}

/** Every expected (activity, topic) image slot. */
export function cells() {
  const out = [];
  for (const act of imageActivities())
    for (const t of expectedTopics(act))
      out.push(cell(act, t));
  return out;
}

export function cell(act, topic) {
  return {
    act, topic,
    jpg: path.join(ROOT, act, 'img', topic.id + '.jpg'),
    webp: path.join(ROOT, act, 'img', topic.id + '.webp'),
    rel: `${act}/img/${topic.id}`,
  };
}

/** Image files present in an activity that no expected topic claims (e.g. a demoted topic). */
export function orphanFiles(act) {
  const expected = new Set(expectedTopics(act).map(t => t.id));
  const dir = path.join(ROOT, act, 'img');
  return fs.readdirSync(dir)
    .filter(f => /\.(jpg|webp)$/.test(f))
    .map(f => f.replace(/\.(jpg|webp)$/, ''))
    .filter((id, i, a) => a.indexOf(id) === i && !expected.has(id));
}
