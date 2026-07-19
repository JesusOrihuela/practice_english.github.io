/* ============================================================
   placement.js — Initial Placement Test (CEFR A1–C2)
   14 questions of increasing difficulty.
   Research: Nation & Newton (2009) — placement tests that
   estimate CEFR bands need just ~10 well-selected items.
   ============================================================ */

/* ---- Questions (loaded from shared/json/placement-questions.json) ----
   Ordered A1 → C2 (2 per band, B1/B2 have 3). Correct answer index = .answer
   To add a new language pair: add a key matching the pair id in the JSON file.
   ---------------------------------------------------------------- */
let QUESTIONS = null;
AppData.get('placement')
  .then(function (data) {
    QUESTIONS = (data && data.questions) || [];
  })
  .catch(function () { QUESTIONS = []; });

/* ---- CEFR result config ---- */
const _LEVEL_COLORS  = { A1: '#22c55e', A2: '#3b82f6', B1: '#f59e0b', B2: '#7c3aed', C1: '#0891b2', C2: '#be123c' };
const _LEVEL_EMOJIS  = { A1: '🌱', A2: '📗', B1: '📘', B2: '🎓', C1: '🏅', C2: '🌟' };
const _LEVEL_SUGGESTIONS = {
  A1: [
    { emoji: '📚', labelKey: 'act_vocabulary',            url: '../../vocabulary/html/vocabulary.html' },
    { emoji: '🎙️', labelKey: 'placement_speaking_greetings', url: '../../speaking/html/speaking.html' },
    { emoji: '✍️', labelKey: 'act_dictation',             url: '../../dictation/html/dictation.html' },
  ],
  A2: [
    { emoji: '🎙️', labelKey: 'act_speaking',   url: '../../speaking/html/speaking.html' },
    { emoji: '🔤', labelKey: 'act_cloze',       url: '../../cloze/html/cloze.html' },
    { emoji: '🧠', labelKey: 'act_quiz',        url: '../../quiz/html/quiz.html' },
  ],
  B1: [
    { emoji: '📐', labelKey: 'act_grammar',     url: '../../grammar/html/grammar.html' },
    { emoji: '🔄', labelKey: 'act_translation', url: '../../translation/html/translation.html' },
    { emoji: '🧩', labelKey: 'act_scramble',    url: '../../scramble/html/scramble.html' },
  ],
  B2: [
    { emoji: '📐', labelKey: 'act_grammar',               url: '../../grammar/html/grammar.html' },
    { emoji: '🔄', labelKey: 'act_translation',           url: '../../translation/html/translation.html' },
    { emoji: '🎙️', labelKey: 'placement_speaking_advanced', url: '../../speaking/html/speaking.html' },
  ],
  C1: [
    { emoji: '📐', labelKey: 'act_grammar',     url: '../../grammar/html/grammar.html' },
    { emoji: '🔄', labelKey: 'act_translation', url: '../../translation/html/translation.html' },
    { emoji: '🧩', labelKey: 'act_scramble',    url: '../../scramble/html/scramble.html' },
  ],
  C2: [
    { emoji: '📐', labelKey: 'act_grammar',     url: '../../grammar/html/grammar.html' },
    { emoji: '🔄', labelKey: 'act_translation', url: '../../translation/html/translation.html' },
    { emoji: '🧩', labelKey: 'act_scramble',    url: '../../scramble/html/scramble.html' },
  ],
};

function _getLevelConfig(level) {
  var lk = level.toLowerCase();
  return {
    label:   AppLang.t('placement_result_' + lk + '_label'),
    emoji:   _LEVEL_EMOJIS[level],
    color:   _LEVEL_COLORS[level],
    message: AppLang.t('placement_result_' + lk + '_msg'),
    suggestions: (_LEVEL_SUGGESTIONS[level] || []).map(function (s) {
      return { emoji: s.emoji, label: AppLang.t(s.labelKey), url: s.url };
    }),
  };
}

/* ---- State ---- */
let currentQ = 0;
let score    = 0;
let answered = false;  // lock during feedback delay

/* ---- Screens ---- */

function showScreen(id) {
  ['screen-intro', 'screen-quiz', 'screen-result'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

/* ---- Intro ---- */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').addEventListener('click', startTest);
  document.getElementById('skip-btn').addEventListener('click', skipTest);
  document.getElementById('retake-btn').addEventListener('click', retakeTest);

  if (AppLangPair.getActive().source.code !== 'es' &&
      typeof AppLang !== 'undefined') {
    const _plPair = AppLangPair.getActive();
    const _plParams = { target: _plPair.target.localName, targetName: _plPair.target.name, source: _plPair.source.localName, sourceName: _plPair.source.name };
    const _t = key => { const v = AppLang.t(key, _plParams); return v !== key ? v : null; };
    const _s = (sel, key) => { const el = document.querySelector(sel); const v = _t(key); if (el && v) el.textContent = v; };
    const _i = (id,  key) => { const el = document.getElementById(id);  const v = _t(key); if (el && v) el.textContent = v; };
    _s('.placement-title',       'placement_title');
    _s('.placement-subtitle',    'placement_subtitle_enes');
    _i('start-btn',              'placement_start_btn');
    _i('skip-btn',               'placement_skip_btn');
    _i('retake-btn',             'placement_retake_btn');
    _i('result-cta',             'placement_result_cta');
    _s('.result-suggestions-label', 'placement_suggestions_label');
    // Info pills (by index)
    const pills = document.querySelectorAll('.info-pill');
    const pillKeys = ['placement_time_pill', 'placement_questions_pill', 'placement_result_pill'];
    pills.forEach((p, i) => { const v = _t(pillKeys[i]); if (v) p.textContent = v; });
  }
});

function startTest() {
  currentQ = 0;
  score    = 0;
  answered = false;
  showScreen('screen-quiz');
  showQuestion(0);
}

function skipTest() {
  localStorage.setItem(AppLangPair.storageKey('pe_placement_done'), 'skipped');
  window.location.href = '../../index.html';
}

function retakeTest() {
  startTest();
}

/* ---- Quiz ---- */

function showQuestion(i) {
  const q = QUESTIONS[i];

  // Progress bar
  const pct = (i / QUESTIONS.length) * 100;
  document.getElementById('placement-progress-fill').style.width = pct + '%';

  // Counter + level badge
  document.getElementById('placement-counter').textContent = AppLang.t('placement_counter', { n: i + 1, total: QUESTIONS.length });
  const badge = document.getElementById('placement-level-badge');
  badge.textContent = q.level;
  badge.className   = 'placement-level-badge level-' + q.level.replace('+', 'plus').replace(' ', '');

  // Question text
  document.getElementById('question-text').textContent = q.q;

  // Options
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  answered = false;

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.setAttribute('aria-label', AppLang.t('option_n', { n: idx + 1 }) + ': ' + opt);
    btn.addEventListener('click', () => selectOption(idx, btn));
    grid.appendChild(btn);
  });
}

function selectOption(idx, btn) {
  if (answered) return;
  answered = true;

  const q = QUESTIONS[currentQ];
  const correct = idx === q.answer;
  if (correct) score++;

  // Visual feedback: mark selected + correct
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer)   b.classList.add('option-correct');
    if (i === idx && !correct) b.classList.add('option-wrong');
  });

  // Advance after short delay so user sees the feedback
  setTimeout(() => {
    currentQ++;
    if (currentQ < QUESTIONS.length) {
      showQuestion(currentQ);
    } else {
      showResults();
    }
  }, 850);
}

/* ---- Results ---- */

function scoreToLevel(s) {
  if (s <= 3)  return 'A1';
  if (s <= 6)  return 'A2';
  if (s <= 9)  return 'B1';
  if (s <= 11) return 'B2';
  if (s <= 13) return 'C1';
  return 'C2';
}

function showResults() {
  const level  = scoreToLevel(score);
  const config = _getLevelConfig(level);

  // Fill progress bar to 100%
  document.getElementById('placement-progress-fill').style.width = '100%';

  // Result card
  const emojiEl = document.getElementById('result-emoji');
  const levelEl = document.getElementById('result-level-label');
  const scoreEl = document.getElementById('result-score');
  const msgEl   = document.getElementById('result-message');
  const sugsEl  = document.getElementById('result-suggestions');
  const ctaEl   = document.getElementById('result-cta');

  emojiEl.textContent = config.emoji;
  emojiEl.style.setProperty('--level-color', config.color);

  levelEl.textContent  = config.label;
  levelEl.style.color  = config.color;
  const _isEnSrc = AppLangPair.getActive().source.code === 'en';
  scoreEl.textContent  = score + ' / ' + QUESTIONS.length + AppLang.t('placement_score_suffix');
  msgEl.textContent    = config.message;

  sugsEl.innerHTML = '';
  config.suggestions.forEach(s => {
    const a = document.createElement('a');
    a.href      = s.url;
    a.className = 'result-suggestion';
    a.innerHTML = '<span class="result-suggestion__emoji">' + s.emoji + '</span>' +
                  '<span class="result-suggestion__label">' + s.label + '</span>';
    sugsEl.appendChild(a);
  });

  ctaEl.href = '../../index.html';

  showScreen('screen-result');

  // Persist level + initialize proficiency from placement result
  localStorage.setItem(AppLangPair.storageKey('pe_placement_done'),  'done');
  localStorage.setItem(AppLangPair.storageKey('pe_placement_level'), level);
  if (typeof AppProficiency !== 'undefined') AppProficiency.initFromManual(level);
}
