/* ============================================================
   grammar.js — Grammar Workshop
   5-phase exercise: Context → Noticing → Rule → Structured Input → FITB Production
   Research: Schmidt 1990, VanPatten 2004, Erlam 2003, Lyster & Ranta 1997

   Card ID format: grammar_{category}_{ruleId}
     — ruleId is a stable semantic string (e.g. "present_simple"), NOT a sequential
       integer. This is intentional: grammar rules can be reordered or extended without
       orphaning SRS history.
     — All SRS reads use Progress.getAllCards() + manual filter.
     — parseCardId() in progress-page.js has a dedicated branch for this format.
   ============================================================ */

/* ── State ── */
let allRules     = [];
let categories   = [];
let currentRule  = null;

/* ── Path mode (set once on load) ── */
const _pathMode  = new URLSearchParams(window.location.search).get('path') === '1';
const _pathTopic = new URLSearchParams(window.location.search).get('topic') || null;
let phase        = 0;          // 0-4 = phases; 5 = complete
let siIndex      = 0;          // structured input item index
let prodIndex    = 0;          // production item index
let prodCorrect      = 0;      // count of correct FITB answers
let prodAnswered     = false;  // whether current FITB was answered
let currentAutoQuality = 3;   // SRS quality calculated from accuracy (1/3/5)
let _progressSaved   = false;  // true once Progress.rate has been called for the current rule
let noticingAnswers   = [];   // user's Phase 2 answers, shown in Phase 3

const PHASE_IDS = [
  'phase-context',
  'phase-noticing',
  'phase-rule',
  'phase-structured',
  'phase-production',
  'phase-complete',
];

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  document.getElementById('back-to-categories').addEventListener('click', () => {
    showCategories();
  });
  document.getElementById('back-to-rules').addEventListener('click', () => {
    showRules(currentRule?.category);
  });

  document.getElementById('context-next-btn').addEventListener('click', () => goToPhase(1));
  document.getElementById('noticing-show-btn').addEventListener('click', () => {
    // Capture answers before the textareas leave the DOM view
    noticingAnswers = Array.from(
      document.querySelectorAll('#noticing-card .noticing-input')
    ).map(t => t.value.trim());
    goToPhase(2);
  });
  document.getElementById('rule-next-btn').addEventListener('click', () => goToPhase(3));

  document.getElementById('rate-auto').addEventListener('click', () => finishAndRate(currentAutoQuality));

  loadData();
});

/* ── Data Loading ── */
function loadData() {
  AppData.get('grammar-rules')
    .then(data => {
      allRules   = data.rules   || [];
      categories = data.categories || [];

      // Path mode: ?path=1 — hide navigation, handle advance via PathSession
      if (_pathMode) {
        document.getElementById('back-to-categories').classList.add('hidden');
        document.getElementById('back-to-rules').classList.add('hidden');
      }

      // Deep-link: grammar.html?rule=<ruleId> → jump straight to that rule
      const urlRule = new URLSearchParams(window.location.search).get('rule');
      if (urlRule) {
        const deepRule = allRules.find(r => r.id === urlRule);
        if (deepRule) { startExercise(deepRule); return; }
      }

      // Topic filter: grammar.html?topic=<topicId> → show only rules for that topic
      if (_pathTopic && !urlRule) {
        const topicRules = allRules.filter(r =>
          Array.isArray(r.topics) && r.topics.includes(_pathTopic)
        );
        if (topicRules.length > 0) {
          _showTopicRules(topicRules);
          return;
        }
      }

      buildCategoryGrid();
    })
    .catch(() => {
      document.getElementById('category-grid').innerHTML =
        '<p style="color:var(--clr-danger);text-align:center">Error loading grammar data.</p>';
    });
}

/* ══════════════════════════════════════════════════════
   SCREEN 1 — Category Grid
══════════════════════════════════════════════════════ */

function buildCategoryGrid() {
  const grid = document.getElementById('category-grid');
  grid.innerHTML = '';

  categories.forEach(cat => {
    const rulesInCat = allRules.filter(r => r.category === cat.id);
    const cardIds    = rulesInCat.map(r => 'grammar_' + cat.id + '_' + r.id);
    const seen       = cardIds.filter(id => {
      const cards = Progress.getAllCards();
      return cards && cards[id] && cards[id].reps > 0;
    }).length;

    const btn = document.createElement('button');
    btn.className = 'category-card';
    btn.style.setProperty('--cat-color', cat.color);
    btn.setAttribute('aria-label', cat.label + ' — ' + cat.label_es);
    btn.innerHTML =
      '<span class="category-emoji">' + cat.emoji + '</span>' +
      '<span class="category-label">' + cat.label + '</span>' +
      '<span class="category-label-es">' + cat.label_es + '</span>' +
      '<span class="category-progress">' + seen + ' / ' + rulesInCat.length + '</span>';

    btn.addEventListener('click', () => showRules(cat.id));
    grid.appendChild(btn);
  });

  showScreen('screen-categories');
}

function showCategories() {
  buildCategoryGrid();
}

/* ── Topic-filtered rule list (used when ?topic= is set) ── */
function _showTopicRules(rules) {
  const list = document.getElementById('rule-list');
  if (!list) return;
  list.innerHTML = '';

  const header = document.getElementById('rules-category-label');
  if (header) header.textContent = 'Grammar for this topic';

  rules.forEach(rule => {
    const cardId = 'grammar_' + rule.category + '_' + rule.id;
    const card   = Progress.getAllCards()[cardId];
    const seen   = card && card.reps > 0;

    const btn = document.createElement('button');
    btn.className = 'rule-row' + (seen ? ' rule-row--seen' : '');
    btn.setAttribute('aria-label', rule.title);
    btn.innerHTML =
      '<span class="rule-row__title">' + rule.title + '</span>' +
      (seen ? '<span class="rule-row__seen-badge">Studied</span>' : '<span class="rule-row__new-badge">New</span>');
    btn.addEventListener('click', () => startExercise(rule));
    list.appendChild(btn);
  });

  showScreen('screen-rules');
}

/* ══════════════════════════════════════════════════════
   SCREEN 2 — Rule List
══════════════════════════════════════════════════════ */

function showRules(categoryId) {
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return;

  document.getElementById('rule-category-label').textContent = cat.emoji + ' ' + cat.label_es;

  const rulesInCat = allRules.filter(r => r.category === categoryId);
  const list = document.getElementById('rule-list');
  list.innerHTML = '';

  if (rulesInCat.length === 0) {
    list.innerHTML =
      '<div class="empty-state">' +
        '<span class="empty-state__icon">🚧</span>' +
        '<p class="empty-state__msg">Coming soon</p>' +
        '<p class="empty-state__sub">We\'re preparing content for this category.</p>' +
      '</div>';
    showScreen('screen-rules');
    return;
  }

  rulesInCat.forEach(rule => {
    const cardId  = 'grammar_' + categoryId + '_' + rule.id;
    const cards   = Progress.getAllCards();
    const card    = cards && cards[cardId];
    const isDone  = card && card.reps > 0;

    const btn = document.createElement('button');
    btn.className = 'rule-row';
    btn.setAttribute('aria-label', rule.title + ' — ' + rule.title_es);

    const statusHtml = isDone
      ? '<span class="rule-row__status rule-row__status--done">✓ Done</span>'
      : '<span class="rule-row__status">→</span>';

    btn.innerHTML =
      '<span class="rule-row__cefr cefr-' + rule.cefr + '">' + rule.cefr + '</span>' +
      '<span class="rule-row__text">' +
        '<span class="rule-row__title">' + rule.title + '</span>' +
        '<span class="rule-row__title-es">' + rule.title_es + '</span>' +
      '</span>' +
      statusHtml;

    btn.addEventListener('click', () => startExercise(rule));
    list.appendChild(btn);
  });

  showScreen('screen-rules');
}

/* ══════════════════════════════════════════════════════
   SCREEN 3 — Exercise (5 phases)
══════════════════════════════════════════════════════ */

function startExercise(rule) {
  currentRule  = rule;
  phase           = 0;
  siIndex         = 0;
  prodIndex       = 0;
  prodCorrect     = 0;
  prodAnswered    = false;
  noticingAnswers = [];
  _progressSaved  = false;

  // Set header badges
  document.getElementById('exercise-rule-title').textContent = rule.title;
  const cefrBadge = document.getElementById('exercise-cefr-badge');
  cefrBadge.textContent = rule.cefr;
  cefrBadge.className   = 'cefr-badge cefr-' + rule.cefr;

  const cardId  = 'grammar_' + rule.category + '_' + rule.id;
  const reentry = getReentryPhase(cardId);

  showScreen('screen-exercise');

  // Show / hide re-entry banner
  setReentryBanner(reentry === REENTRY_PHASE);

  if (reentry === REENTRY_PHASE) {
    // Skip context / noticing / rule — user has seen them.
    // Phase dots 0-2 rendered as done, jump straight to Structured Input.
    phase = REENTRY_PHASE;          // set before updatePhaseDots
    updatePhaseDots();
    goToPhase(REENTRY_PHASE);       // builds phase 4
  } else {
    buildPhase1();
    buildPhase2();
    goToPhase(0);
  }
}

/* ── Phase Transitions ── */
function goToPhase(p) {
  phase = p;
  updatePhaseDots();

  // Hide all phases
  PHASE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(PHASE_IDS[p]);
  if (target) target.classList.remove('hidden');

  // Build on-demand phases
  if (p === 2) { buildPhase3(); }
  if (p === 3) { buildPhase4(); }
  if (p === 4) { buildPhase5(); }
  if (p === 5) { buildPhaseComplete(); }
}

function updatePhaseDots() {
  document.querySelectorAll('.phase-dot').forEach(dot => {
    const dp = parseInt(dot.dataset.phase, 10);
    dot.classList.toggle('phase-dot--active', dp === phase);
    // Mark as done: either naturally passed, or skipped via re-entry
    dot.classList.toggle('phase-dot--done', dp < phase && phase <= 4);
  });
}

/* ══════════════════════════════════════════
   PHASE 1 — Context Dialogue
══════════════════════════════════════════ */
function buildPhase1() {
  const card = document.getElementById('dialogue-card');
  card.innerHTML = '';

  (currentRule.context_dialogue || []).forEach(turn => {
    const div = document.createElement('div');
    div.className = 'dialogue-turn' + (turn.highlight ? ' dialogue-turn--highlight' : '');

    const spk = document.createElement('span');
    spk.className   = 'dialogue-speaker';
    spk.textContent = turn.speaker;

    const txt = document.createElement('span');
    txt.className  = 'dialogue-text';
    // **word** → <span class="dialogue-target"> for target structure highlighting
    txt.innerHTML = parseDialogueText(escapeHTML(turn.text));

    div.appendChild(spk);
    div.appendChild(txt);
    card.appendChild(div);
  });
}

/* ══════════════════════════════════════════
   PHASE 2 — Noticing Questions (interactive)
══════════════════════════════════════════ */
const MIN_NOTICING_CHARS = 3; // minimum chars per answer to count as engaged

function buildPhase2() {
  const card    = document.getElementById('noticing-card');
  const btn     = document.getElementById('noticing-show-btn');
  const progEl  = document.getElementById('noticing-progress');
  card.innerHTML = '';

  // Reset button state for this rule
  btn.disabled = true;

  const prompts = currentRule.noticing_prompts || [];
  const inputs  = [];

  prompts.forEach((prompt, i) => {
    // Question row
    const questionDiv = document.createElement('div');
    questionDiv.className = 'noticing-question';

    const num = document.createElement('span');
    num.className   = 'noticing-num';
    num.textContent = i + 1;

    const promptText = typeof prompt === 'object' ? prompt.q : prompt;
    const promptHint = typeof prompt === 'object' ? (prompt.placeholder || '') : '';

    const txt = document.createElement('span');
    txt.className   = 'noticing-text';
    txt.textContent = promptText;

    questionDiv.appendChild(num);
    questionDiv.appendChild(txt);
    card.appendChild(questionDiv);

    // Answer input
    const textarea = document.createElement('textarea');
    textarea.className   = 'noticing-input';
    textarea.rows        = 2;
    textarea.placeholder = promptHint || 'Write your observation…';
    textarea.setAttribute('aria-label', 'Answer to question ' + (i + 1));
    card.appendChild(textarea);
    inputs.push(textarea);

    // Update gate on every keystroke
    textarea.addEventListener('input', () => checkNoticingGate(inputs, btn, progEl, prompts.length));
  });

  // Initial progress label
  updateNoticingProgress(progEl, 0, prompts.length);
}

function checkNoticingGate(inputs, btn, progEl, total) {
  const answered = inputs.filter(inp => inp.value.trim().length >= MIN_NOTICING_CHARS).length;
  updateNoticingProgress(progEl, answered, total);
  btn.disabled = answered < total;
}

function updateNoticingProgress(el, answered, total) {
  if (!el) return;
  if (answered === 0) {
    el.textContent = 'Answer all ' + total + ' questions to continue';
    el.className   = 'noticing-progress';
  } else if (answered < total) {
    el.textContent = answered + ' / ' + total + ' respondidas';
    el.className   = 'noticing-progress noticing-progress--partial';
  } else {
    el.textContent = '✓ Listo';
    el.className   = 'noticing-progress noticing-progress--done';
  }
}

/* ══════════════════════════════════════════
   PHASE 3 — Rule Explanation (+ noticing contrast)
══════════════════════════════════════════ */
function buildPhase3() {
  const card = document.getElementById('rule-card');
  card.innerHTML = '';

  // ── "Tu hipótesis" block — only when the user has answers ──
  const prompts = currentRule.noticing_prompts || [];
  const hasAnswers = noticingAnswers.some(a => a.length > 0);

  if (hasAnswers && prompts.length > 0) {
    const hypothesisBlock = document.createElement('div');
    hypothesisBlock.className = 'rule-hypothesis';

    const heading = document.createElement('p');
    heading.className = 'rule-hypothesis__heading';
    heading.textContent = 'Your hypothesis';
    hypothesisBlock.appendChild(heading);

    prompts.forEach((prompt, i) => {
      const answer = noticingAnswers[i] || '';
      if (!answer) return;

      const item = document.createElement('div');
      item.className = 'rule-hypothesis__item';

      const qEl = document.createElement('span');
      qEl.className = 'rule-hypothesis__q';
      qEl.textContent = (typeof prompt === 'object' ? prompt.q : prompt);

      const aEl = document.createElement('blockquote');
      aEl.className = 'rule-hypothesis__a';
      aEl.textContent = answer;

      item.appendChild(qEl);
      item.appendChild(aEl);
      hypothesisBlock.appendChild(item);
    });

    card.appendChild(hypothesisBlock);

    const divider = document.createElement('div');
    divider.className = 'rule-divider';
    divider.setAttribute('aria-hidden', 'true');
    card.appendChild(divider);
  }

  // ── Rule explanation ──
  const explanationEl = document.createElement('div');
  explanationEl.className = 'rule-explanation';
  explanationEl.innerHTML = parseMarkdown(escapeHTML(currentRule.explanation || ''));
  card.appendChild(explanationEl);
}

/* ══════════════════════════════════════════
   PHASE 4 — Structured Input (comprehension)
══════════════════════════════════════════ */
function buildPhase4() {
  siIndex = 0;
  showStructuredItem(0);
}

function showStructuredItem(idx) {
  const items = currentRule.structured_input || [];
  const total = items.length;

  if (idx >= total) {
    goToPhase(4);  // goToPhase(4) calls buildPhase5()
    return;
  }

  document.getElementById('structured-counter').textContent =
    'Question ' + (idx + 1) + ' of ' + total;

  const item = items[idx];
  const card = document.getElementById('structured-card');
  card.innerHTML = '';

  const sentEl = document.createElement('div');
  sentEl.className = 'structured-sentence';
  sentEl.innerHTML = parseInlineMarkdown(escapeHTML(item.sentence));
  card.appendChild(sentEl);

  const qEl = document.createElement('div');
  qEl.className   = 'structured-question';
  qEl.textContent = item.question;
  card.appendChild(qEl);

  const optsEl = document.createElement('div');
  optsEl.className = 'structured-options';

  const LETTERS = ['A', 'B', 'C', 'D'];
  item.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML =
      '<span class="option-letter">' + LETTERS[i] + '</span>' +
      escapeHTML(opt);

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      // Disable all
      optsEl.querySelectorAll('.option-btn').forEach(b => { b.disabled = true; });

      const isCorrect = i === item.correct;
      btn.classList.add(isCorrect ? 'option-btn--correct' : 'option-btn--wrong');
      if (!isCorrect) {
        optsEl.querySelectorAll('.option-btn')[item.correct].classList.add('option-btn--correct');
      }

      // Show feedback
      const fb = document.createElement('div');
      fb.className = 'structured-feedback' + (isCorrect ? '' : ' structured-feedback--wrong');
      fb.textContent = item.feedback;
      card.appendChild(fb);

      const advance = () => {
        siIndex++;
        if (siIndex >= (currentRule.structured_input || []).length) {
          goToPhase(4);
        } else {
          showStructuredItem(siIndex);
        }
      };

      const nextBtn = document.createElement('button');
      nextBtn.className   = 'structured-next-btn';
      nextBtn.textContent = 'Next →';
      nextBtn.addEventListener('click', advance);
      card.appendChild(nextBtn);
      nextBtn.focus();
    });

    optsEl.appendChild(btn);
  });

  card.appendChild(optsEl);
}

/* ══════════════════════════════════════════
   PHASE 5 — FITB Production
══════════════════════════════════════════ */
function buildPhase5() {
  prodIndex    = 0;
  prodCorrect  = 0;
  prodAnswered = false;
  showProductionItem(0);
}

function showProductionItem(idx) {
  const items = currentRule.quiz || [];
  const total = items.length;

  if (idx >= total) {
    goToPhase(5); // goToPhase(5) calls buildPhaseComplete()
    return;
  }

  document.getElementById('production-counter').textContent =
    'Item ' + (idx + 1) + ' of ' + total;

  const item = items[idx];
  const card = document.getElementById('production-card');
  card.innerHTML = '';
  prodAnswered = false;

  // Detect number of blanks — multi-blank needs inline inputs
  const blankParts  = item.sentence.split(/_+/);
  const blankCount  = blankParts.length - 1;
  const answerParts = (item.answer || '').split(' / ');

  // Always render inputs inline inside the sentence text
  const sentEl = document.createElement('div');
  sentEl.className = 'production-sentence production-sentence--multi';

  const inputs = [];

  blankParts.forEach((part, i) => {
    if (part) {
      const span = document.createElement('span');
      span.textContent = part;
      sentEl.appendChild(span);
    }
    if (i < blankCount) {
      const inp = document.createElement('input');
      inp.type         = 'text';
      inp.className    = 'production-input production-input--inline';
      inp.autocomplete = 'off';
      inp.spellcheck   = false;
      inp.setAttribute('aria-label', 'Blank ' + (i + 1));
      const hint = answerParts[i] || '';
      inp.style.width  = Math.max(52, hint.length * 11 + 16) + 'px';
      inputs.push(inp);
      sentEl.appendChild(inp);
    }
  });
  card.appendChild(sentEl);

  // Check button in its own row below the sentence
  const checkBtn = document.createElement('button');
  checkBtn.className   = 'production-check-btn';
  checkBtn.textContent = 'Check ✓';
  const btnRow = document.createElement('div');
  btnRow.className = 'production-input-row production-input-row--check-only';
  btnRow.appendChild(checkBtn);
  card.appendChild(btnRow);

  // Feedback area
  const fbEl = document.createElement('div');
  fbEl.className = 'production-feedback';
  card.appendChild(fbEl);

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className   = 'production-next-btn';
  nextBtn.textContent = idx + 1 < total ? 'Next →' : 'See results →';
  card.appendChild(nextBtn);

  // Focus first input
  if (inputs.length > 0) inputs[0].focus();

  // Submit logic
  const submit = () => {
    if (prodAnswered) return;
    const raw = inputs.map(i => i.value.trim()).filter(Boolean).join(' ');
    if (!raw) return;
    prodAnswered = true;

    inputs.forEach(i => { i.disabled = true; });
    checkBtn.disabled = true;

    const accepted = (item.accepted || [item.answer]).map(a => AppText.normalise(a));
    const isCorrect = accepted.includes(AppText.normalise(raw));

    if (isCorrect) {
      prodCorrect++;
      inputs.forEach(i => i.classList.add('production-input--correct'));
      fbEl.className = 'production-feedback production-feedback--correct visible';
      fbEl.innerHTML =
        '<span class="feedback-answer">✓ ' + escapeHTML(item.answer) + '</span>' +
        '<span class="feedback-why">' + escapeHTML(item.feedback_why) + '</span>' +
        (item.contrast
          ? '<span class="feedback-contrast">' + escapeHTML(item.contrast) + '</span>'
          : '');
    } else {
      inputs.forEach(i => i.classList.add('production-input--wrong'));
      fbEl.className = 'production-feedback production-feedback--wrong visible';
      fbEl.innerHTML =
        '<span class="feedback-answer">Answer: ' + escapeHTML(item.answer) + '</span>' +
        '<span class="feedback-why">' + escapeHTML(item.feedback_why) + '</span>' +
        (item.contrast
          ? '<span class="feedback-contrast">' + escapeHTML(item.contrast) + '</span>'
          : '');
    }

    nextBtn.classList.add('visible');
    nextBtn.focus();
  };

  checkBtn.addEventListener('click', submit);
  inputs.forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));

  nextBtn.addEventListener('click', () => {
    prodIndex++;
    showProductionItem(prodIndex);
  });
}

/* ══════════════════════════════════════════
   PHASE 6 — Complete / Rating
══════════════════════════════════════════ */
/* Maps FITB accuracy to SM-2 quality score:
   ≥80% → 5 (Easy)  |  50–79% → 3 (OK)  |  <50% → 1 (Hard) */
function accuracyToQuality(correct, total) {
  if (total === 0) return 3;
  const pct = correct / total;
  if (pct >= 0.8) return 5;
  if (pct >= 0.5) return 3;
  return 1;
}

const QUALITY_META = {
  5: { emoji: '😄', label: 'Easy', cls: 'badge--easy',   hint: 'next review in ~1 week' },
  3: { emoji: '🙂', label: 'OK',   cls: 'badge--ok',     hint: 'next review in ~3 days' },
  1: { emoji: '😰', label: 'Hard', cls: 'badge--hard',   hint: 'next review tomorrow'   },
};

function buildPhaseComplete() {
  const cardId     = 'grammar_' + currentRule.category + '_' + currentRule.id;
  const total      = (currentRule.quiz || []).length;
  const pct        = total > 0 ? Math.round((prodCorrect / total) * 100) : 0;
  const wasReentry = getReentryPhase(cardId) === REENTRY_PHASE;

  // Calculate and store auto quality
  currentAutoQuality = accuracyToQuality(prodCorrect, total);

  // Record progress immediately so it's saved even if the user never taps Continue
  if (!_progressSaved) {
    _progressSaved = true;
    if (prodCorrect < total && currentAutoQuality < 5) {
      setReentryPhase(cardId);
    } else {
      clearReentryPhase(cardId);
    }
    Progress.rate(cardId, currentAutoQuality);
    if (typeof AppProficiency !== 'undefined') AppProficiency.update(currentRule.cefr, currentAutoQuality >= 3, 'grammar');
    Progress.recordSession('grammar_' + currentRule.category, prodCorrect, total);
  }

  // Score line
  document.getElementById('complete-score').textContent =
    prodCorrect + ' / ' + total + ' correct (' + pct + '%)';

  // Icon + title
  const iconEl  = document.querySelector('.complete-icon');
  const titleEl = document.querySelector('.complete-title');
  if (prodCorrect === total) {
    iconEl.textContent  = wasReentry ? '🏆' : '🎉';
    titleEl.textContent = wasReentry ? 'Rule mastered!' : 'Exercise complete!';
  } else {
    iconEl.textContent  = '💪';
    titleEl.textContent = 'Keep practising';
  }

  // Focus continue button
  document.getElementById('rate-auto')?.focus();

  // Back-to-path link (path mode only)
  const _completeCard = document.getElementById('complete-card');
  const _existingBack = document.getElementById('grammar-back-to-path');
  if (_pathMode && _completeCard && !_existingBack) {
    const _backLink = document.createElement('a');
    _backLink.id = 'grammar-back-to-path';
    _backLink.href = '../../my-learning/html/my-learning.html';
    _backLink.className = 'back-to-path-link';
    _backLink.textContent = '← Back to path';
    _completeCard.appendChild(_backLink);
  }

  buildRelatedPhrases(currentRule);
}

function buildRelatedPhrases(rule) {
  var container = document.getElementById('related-phrases');
  if (!container) return;
  container.innerHTML = '';
  container.classList.add('hidden');

  var keywords = rule.title.toLowerCase().split(/\s+/).filter(function(w){ return w.length > 3; });
  if (keywords.length === 0) return;

  var topicMeta = [
    { id: 'greetings',      label: 'Greetings' },
    { id: 'traveling',      label: 'Travelling' },
    { id: 'technology',     label: 'Technology' },
    { id: 'restaurant',     label: 'Restaurant' },
    { id: 'kitchen',        label: 'Kitchen' },
    { id: 'supermarket',    label: 'Supermarket' },
    { id: 'entertainment',  label: 'Entertainment' },
    { id: 'accountability', label: 'Work & Goals' },
    { id: 'gym',            label: 'Gym' },
  ];

  var fetches = topicMeta.map(function(tm) {
    return AppData.get(tm.id)
      .then(function(d){ return { meta: tm, data: d }; })
      .catch(function(){ return null; });
  });

  Promise.all(fetches).then(function(results) {
    var matches = [];
    for (var t = 0; t < results.length && matches.length < 3; t++) {
      var res = results[t];
      if (!res) continue;
      var phrases = res.data.phrases || [];
      for (var i = 0; i < phrases.length && matches.length < 3; i++) {
        var tip = phrases[i].grammar || null;
        if (!tip) continue;
        var tipLower = tip.toLowerCase();
        var hit = keywords.some(function(kw){ return tipLower.indexOf(kw) !== -1; });
        if (hit) matches.push({ phrase: phrases[i].phrase, topicId: res.meta.id, topicLabel: res.meta.label });
      }
    }
    if (matches.length === 0) return;

    container.classList.remove('hidden');

    var heading = document.createElement('p');
    heading.className = 'related-heading';
    heading.textContent = '💬 Real phrases using this rule — practise in context';
    container.appendChild(heading);

    var activities = [
      { key: 'pe_last_cloze',        href: '../../cloze/html/cloze.html',            label: '🔤 Cloze' },
      { key: 'pe_last_translation',  href: '../../translation/html/translation.html', label: '🔄 Translate' },
      { key: 'pe_last_speaking',     href: '../../speaking/html/speaking.html',       label: '🎙️ Speak' },
    ];

    matches.forEach(function(m) {
      var item = document.createElement('div');
      item.className = 'related-phrase-item';

      var phraseEl = document.createElement('span');
      phraseEl.className = 'related-phrase-text';
      phraseEl.textContent = m.phrase;

      var topicEl = document.createElement('span');
      topicEl.className = 'related-topic-label';
      topicEl.textContent = m.topicLabel;

      var linksEl = document.createElement('div');
      linksEl.className = 'related-activity-links';

      activities.forEach(function(act) {
        var link = document.createElement('a');
        link.className = 'related-practice-btn';
        link.href = act.href;
        link.textContent = act.label;
        link.addEventListener('click', function() {
          localStorage.setItem(act.key, m.topicId);
        });
        linksEl.appendChild(link);
      });

      item.appendChild(phraseEl);
      item.appendChild(topicEl);
      item.appendChild(linksEl);
      container.appendChild(item);
    });
  });
}


function finishAndRate(quality) {
  const cardId = 'grammar_' + currentRule.category + '_' + currentRule.id;
  const total  = (currentRule.quiz || []).length;

  // Progress already saved in buildPhaseComplete(); only re-rate if quality differs
  if (!_progressSaved) {
    _progressSaved = true;
    if (prodCorrect < total && quality < 5) {
      setReentryPhase(cardId);
    } else {
      clearReentryPhase(cardId);
    }
    Progress.rate(cardId, quality);
    Progress.recordSession('grammar_' + currentRule.category, prodCorrect, total);
  }

  if (_pathMode && typeof PathSession !== 'undefined') {
    const nextHref = PathSession.advance();
    if (nextHref) {
      window.location.href = '../../' + nextHref;
    } else {
      _showPathSessionComplete();
    }
    return;
  }

  showRules(currentRule.category);
}

function _showPathSessionComplete() {
  const summary = typeof PathSession !== 'undefined' ? PathSession.getTodaySummary() : null;
  const screen  = document.getElementById('screen-exercise');
  if (!screen) { window.location.href = '../../my-learning/html/my-learning.html'; return; }
  screen.innerHTML =
    '<div class="path-session-complete">' +
      '<div class="path-session-complete__icon">🎉</div>' +
      '<h2 class="path-session-complete__title">Session complete!</h2>' +
      (summary ? '<p class="path-session-complete__sub">You reviewed ' + summary.reviewCount + ' cards and learned ' + summary.newCount + ' new ones today.</p>' : '') +
      '<a href="../../my-learning/html/my-learning.html" class="path-session-complete__btn">My Learning →</a>' +
    '</div>';
}

/* ══════════════════════════════════════════
   Re-entry Banner
══════════════════════════════════════════ */
function setReentryBanner(visible) {
  let banner = document.getElementById('reentry-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id        = 'reentry-banner';
    banner.className = 'reentry-banner hidden';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<span class="reentry-icon">🔁</span>' +
      '<span>Resuming from <strong>Comprehension + Production</strong> — context and rule already seen</span>';
    // Insert after phase-progress bar
    const prog = document.getElementById('phase-progress');
    if (prog) prog.insertAdjacentElement('afterend', banner);
  }
  banner.classList.toggle('hidden', !visible);
}

/* ══════════════════════════════════════════
   Screen switching
══════════════════════════════════════════ */
function showScreen(id) {
  ['screen-categories', 'screen-rules', 'screen-exercise'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

/* ══════════════════════════════════════════
   Re-entry — persist which phase to start from
   Key: 'pe_reentry_' + cardId → '3' (phase index for Structured Input)
   Set when production ends with errors; cleared on perfect score or Easy rating.
══════════════════════════════════════════ */
const REENTRY_PHASE = 3; // index of Structured Input in PHASE_IDS

function getReentryPhase(cardId) {
  const v = localStorage.getItem('pe_reentry_' + cardId);
  return v ? parseInt(v, 10) : 0;
}

function setReentryPhase(cardId) {
  localStorage.setItem('pe_reentry_' + cardId, String(REENTRY_PHASE));
}

function clearReentryPhase(cardId) {
  localStorage.removeItem('pe_reentry_' + cardId);
}

/* ══════════════════════════════════════════
   Utilities
══════════════════════════════════════════ */

function escapeHTML(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Converts **bold**, *italic*, and `code` spans to HTML.
 * Input must already be HTML-escaped.
 * Use for short inline strings (sentences, feedback).
 */
function parseInlineMarkdown(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/**
 * Converts multi-line markdown to HTML, supporting:
 *   - Paragraphs (blank-line separated)
 *   - Bullet lists (lines starting with "- ")
 *   - Blockquotes (lines starting with "&gt;" after escapeHTML)
 *   - All inline formatting from parseInlineMarkdown
 * Input must already be HTML-escaped.
 * Use for explanation text in Phase 3.
 */
function parseMarkdown(s) {
  const lines = s.split('\n');
  const out = [];
  let inList = false;
  let paraLines = [];

  const flushPara = () => {
    if (paraLines.length) {
      out.push('<p>' + paraLines.join('<br>') + '</p>');
      paraLines = [];
    }
  };

  for (const line of lines) {
    if (line === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      flushPara();
    } else if (line.startsWith('- ')) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + parseInlineMarkdown(line.slice(2)) + '</li>');
    } else if (line.startsWith('&gt;')) {
      if (inList) { out.push('</ul>'); inList = false; }
      flushPara();
      out.push('<blockquote class="rule-tip">' +
        parseInlineMarkdown(line.replace(/^&gt;\s*/, '')) +
        '</blockquote>');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      paraLines.push(parseInlineMarkdown(line));
    }
  }
  if (inList) out.push('</ul>');
  flushPara();
  return out.join('');
}

/**
 * Converts **text** markers in dialogue turns into
 * visually highlighted .dialogue-target spans.
 * Used exclusively in buildPhase1() for input enhancement.
 * Input must already be HTML-escaped.
 */
function parseDialogueText(s) {
  return s.replace(/\*\*(.+?)\*\*/g,
    '<span class="dialogue-target">$1</span>'
  );
}
