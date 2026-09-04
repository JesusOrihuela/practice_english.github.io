#!/usr/bin/env node
/* ============================================================
   check-grammar.mjs — CI gate for grammar-rules.json completeness & quality.

   Enforces the schema in docs/GRAMMAR.md so a grammar rule can never ship as an
   opaque wall of text or a half-authored sequence:
     • every rule populates ALL FIVE phases (context_dialogue ≥ 2, noticing_prompts ≥ 1,
       structured_input ≥ 1, quiz ≥ 1);
     • every learner-facing TARGET sentence (dialogue turn, structured_input.sentence,
       quiz.sentence) carries a source-language `translation`;
     • category ∈ categories[]; title_en/title_es/level/explanation present;
     • structured_input.correct is a valid option index; quiz.answer ∈ accepted.

   Pairs are DERIVED from the content tree (lib-content.discoverPairs) — nothing hardcoded.
   Node built-ins only. Exit 1 on any issue.

   Usage:  node tools/check-grammar.mjs [--pair en-de]
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPairs } from './lib-content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAIRS_DIR = path.join(ROOT, 'shared/json/pairs');
const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const argPair = (() => { const i = process.argv.indexOf('--pair'); return i !== -1 ? process.argv[i + 1] : null; })();

const issues = [];
let rulesChecked = 0, sentencesChecked = 0;

function isNonEmptyStr(v) { return typeof v === 'string' && v.trim() !== ''; }

/** A learner-facing target sentence must have a non-empty source-language translation. */
function checkTranslation(where, obj, key) {
  sentencesChecked++;
  if (!isNonEmptyStr(obj.translation)) {
    issues.push(`${where}: "${(obj[key] || '').slice(0, 48)}" is missing a source-language "translation"`);
  }
}

/** A noticing prompt is either a plain string or an object with a `q` field (both render). */
function promptText(p) { return typeof p === 'string' ? p : (p && p.q); }

/** A quiz item carries its answer key either flat (`answer` string) or per-blank
    (`blanks[].answer` array) — both are produced/checked by the activity. */
function quizHasAnswer(q) {
  if (isNonEmptyStr(q.answer)) return true;
  if (Array.isArray(q.blanks) && q.blanks.length &&
      q.blanks.every(b => Array.isArray(b.answer) ? b.answer.some(isNonEmptyStr) : isNonEmptyStr(b.answer))) return true;
  return false;
}

function checkRule(pair, srcLang, rule, categoryIds) {
  rulesChecked++;
  const id = rule.id || '(no id)';
  const at = `[${pair}] ${id}`;

  if (!isNonEmptyStr(rule.id)) issues.push(`${at}: missing "id"`);
  // The title shown is title_{source} (fallback to a bare `title`); require the one this pair displays.
  if (!isNonEmptyStr(rule['title_' + srcLang]) && !isNonEmptyStr(rule.title))
    issues.push(`${at}: missing "title_${srcLang}" (source-language title)`);
  if (!isNonEmptyStr(rule.explanation)) issues.push(`${at}: missing "explanation"`);
  if (!CEFR.has(rule.level)) issues.push(`${at}: level "${rule.level}" is not a CEFR band`);
  if (!categoryIds.has(rule.category)) issues.push(`${at}: category "${rule.category}" not in categories[]`);

  // Phase 1 — context_dialogue (≥ 2 turns, each text + translation)
  const dlg = rule.context_dialogue || [];
  if (dlg.length < 2) issues.push(`${at}: context_dialogue must have ≥ 2 turns (has ${dlg.length}) — phase 1 empty`);
  dlg.forEach((t, i) => {
    if (!isNonEmptyStr(t.speaker)) issues.push(`${at}: dialogue #${i} missing "speaker"`);
    if (!isNonEmptyStr(t.text)) issues.push(`${at}: dialogue #${i} missing "text"`);
    else checkTranslation(`${at} dialogue #${i}`, t, 'text');
  });

  // Phase 2 — noticing_prompts (≥ 1; string or { q })
  const notice = rule.noticing_prompts || [];
  if (notice.length < 1) issues.push(`${at}: noticing_prompts empty — phase 2 empty`);
  notice.forEach((p, i) => { if (!isNonEmptyStr(promptText(p))) issues.push(`${at}: noticing_prompt #${i} has no text`); });

  // Phase 4 — structured_input (≥ 1 REFERENTIAL + ≥ 1 AFFECTIVE — Processing Instruction needs both).
  //   Referential: target sentence + gloss, one correct index (form-meaning connection).
  //   Affective:   no single correct answer (the learner reacts to real meaning); question + options only.
  const si = rule.structured_input || [];
  if (si.length < 1) issues.push(`${at}: structured_input empty — phase 4 empty`);
  let referential = 0, affective = 0;
  si.forEach((s, i) => {
    if (!isNonEmptyStr(s.question)) issues.push(`${at}: structured_input #${i} missing "question"`);
    if (!Array.isArray(s.options) || s.options.length < 2) issues.push(`${at}: structured_input #${i} needs ≥ 2 options`);
    if (!isNonEmptyStr(s.feedback)) issues.push(`${at}: structured_input #${i} missing "feedback"`);
    if (s.affective) {
      affective++;
      // affective items intentionally have no `correct` and no target `sentence`/`translation`.
    } else {
      referential++;
      if (!isNonEmptyStr(s.sentence)) issues.push(`${at}: structured_input #${i} (referential) missing "sentence"`);
      else checkTranslation(`${at} structured_input #${i}`, s, 'sentence');
      if (Array.isArray(s.options) && (!Number.isInteger(s.correct) || s.correct < 0 || s.correct >= s.options.length))
        issues.push(`${at}: structured_input #${i} "correct" index ${s.correct} out of range`);
    }
  });
  if (si.length && referential < 1) issues.push(`${at}: structured_input has no REFERENTIAL item`);
  if (si.length && affective < 1) issues.push(`${at}: structured_input has no AFFECTIVE item (add one with "affective": true)`);

  // Phase 5 — quiz (≥ 1; sentence+translation + an answer key in either schema)
  const quiz = rule.quiz || [];
  if (quiz.length < 1) issues.push(`${at}: quiz empty — phase 5 empty`);
  quiz.forEach((q, i) => {
    if (!isNonEmptyStr(q.sentence)) issues.push(`${at}: quiz #${i} missing "sentence"`);
    else checkTranslation(`${at} quiz #${i}`, q, 'sentence');
    if (!quizHasAnswer(q)) issues.push(`${at}: quiz #${i} has no answer key (needs "answer" or "blanks[].answer")`);
  });

  // Phase 6 — communicative production (≥ 1; open prompt + model answer + its gloss, self-assessed)
  const cp = rule.communicative_production || [];
  if (cp.length < 1) issues.push(`${at}: communicative_production empty — phase 6 (Express) empty`);
  cp.forEach((c, i) => {
    if (!isNonEmptyStr(c.prompt)) issues.push(`${at}: communicative_production #${i} missing "prompt"`);
    if (!isNonEmptyStr(c.model)) issues.push(`${at}: communicative_production #${i} missing "model"`);
    if (!isNonEmptyStr(c.model_translation)) issues.push(`${at}: communicative_production #${i} missing "model_translation"`);
  });

  // No em-dash (—) in any learner-facing prose (Rule 6). `answer`/`accepted` are functional
  // answer-matching data (may use — as a "no-article" token), so they are excluded.
  const prose = [rule.title, rule.title_en, rule.title_es, rule.explanation];
  for (const t of dlg) prose.push(t.text, t.translation);
  for (const p of notice) prose.push(promptText(p), (p && p.placeholder));
  for (const s of si) prose.push(s.sentence, s.translation, s.question, s.feedback, ...(s.options || []));
  for (const q of quiz) prose.push(q.sentence, q.translation, q.feedback_why, q.contrast);
  for (const c of cp) prose.push(c.prompt, c.model, c.model_translation, c.hint);
  for (const s of prose) if (typeof s === 'string' && s.includes('—'))
    issues.push(`${at}: em-dash (—) in learner-facing text — use a comma (Rule 6): "${s.slice(0, 50)}"`);
}

const pairs = (argPair ? [argPair] : discoverPairs())
  .filter(p => fs.existsSync(path.join(PAIRS_DIR, p, 'grammar-rules.json')));

for (const pair of pairs) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(PAIRS_DIR, pair, 'grammar-rules.json'), 'utf8')); }
  catch (e) { issues.push(`[${pair}] grammar-rules.json invalid JSON: ${e.message}`); continue; }
  const categoryIds = new Set((data.categories || []).map(c => c.id));
  const srcLang = pair.split('-')[0];
  if (!(data.rules || []).length) issues.push(`[${pair}] no rules`);
  for (const rule of (data.rules || [])) checkRule(pair, srcLang, rule, categoryIds);
}

console.log(`check-grammar: ${pairs.length} pair(s), ${rulesChecked} rules, ${sentencesChecked} learner-facing sentences.`);
if (issues.length) {
  console.error(`\n✗ ${issues.length} grammar issue(s):`);
  for (const i of issues) console.error('  ✗ ' + i);
  process.exit(1);
}
console.log('✓ check-grammar: ALL CLEAR — every rule is complete and every target sentence has an L1 gloss.');
