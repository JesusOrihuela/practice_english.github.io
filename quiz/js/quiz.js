/* ============================================================
   quiz.js — Multiple Choice Vocabulary Quiz with SRS
   Research basis: Testing Effect (Roediger & Karpicke 2006)
   ============================================================ */


let _openPhraseBrowser = null;


let currentTopicId   = '';
let quizTopicKey     = '';  // SRS prefix
let words            = [];
let cardIds          = [];
let currentIndex     = 0;
let answered         = false;
let _lastCorrect     = false;
let _translationMode = false; // true for A1/A2: options show Spanish translation

function _quizText(word) {
  return _translationMode
    ? (word.translations?.es || word.definition)
    : word.definition;
}

// ---- Init ----

function _quizGridOpts() {
  return {
    badge: 'Quiz',
    topics: AppTopics.VOCAB_TOPICS,
    getSrsKey: t => t.id === 'general' ? 'quiz_vocab' : 'quiz_' + t.id,
    getItemCount: t => {
      const key = t.id === 'general' ? 'words' : 'words-' + t.id;
      return AppData.get(key).then(d => d.words ? d.words.length : 0);
    },
    onSelect: startTopic,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const _urlTopic = new URLSearchParams(location.search).get('topic');
  const _pathMode = new URLSearchParams(location.search).get('path') === '1';
  const _pathCard = new URLSearchParams(location.search).get('card');

  if (_pathMode) {
    document.getElementById('back-btn').classList.add('hidden');
    if (typeof PathSession !== 'undefined') PathSession.start();
  }

  if (_urlTopic && AppTopics.VOCAB_TOPICS.some(t => t.id === _urlTopic)) {
    startTopic(_urlTopic, _pathMode, _pathCard);
  } else {
    AppTopicGrid.build(_quizGridOpts());
  }

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('quiz-content').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });
  document.getElementById('next-btn').addEventListener('click', () => rateAndNext(_lastCorrect ? 5 : 1));
  document.getElementById('try-again-btn').addEventListener('click', () => {
    document.getElementById('try-again-btn').classList.add('hidden');
    showQuestion(currentIndex);
  });

  if (_pathMode) {
    const _backLink = document.createElement('a');
    _backLink.id = 'back-to-path';
    _backLink.href = '../../my-learning/html/my-learning.html';
    _backLink.className = 'back-to-path-link hidden';
    _backLink.textContent = AppLang.t('back_to_path');
    _backLink.addEventListener('click', function () {
      if (_lastCorrect && typeof PathSession !== 'undefined') PathSession.advance();
    });
    document.getElementById('quiz-content').appendChild(_backLink);
  }
});

// ---- Topic Picker ----

function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('quiz-content').classList.add('hidden');
  AppTopicGrid.build(_quizGridOpts());
}

function _showLoadError(topicId) {
  const old = document.getElementById('fetch-error-banner');
  if (old) old.remove();

  const banner = document.createElement('div');
  banner.id = 'fetch-error-banner';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'assertive');
  Object.assign(banner.style, {
    background: 'var(--clr-danger-light)', color: 'var(--clr-danger)',
    border: '1px solid var(--clr-danger)', borderRadius: 'var(--radius-md)',
    padding: '12px 16px', marginBottom: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    fontSize: '0.88rem', fontWeight: '600',
  });

  const txt = document.createElement('span');
  txt.textContent = AppLang.t('error_loading');

  const btn = document.createElement('button');
  btn.textContent = AppLang.t('retry');
  Object.assign(btn.style, {
    background: 'var(--clr-danger)', color: '#fff', border: 'none',
    borderRadius: 'var(--radius-full)', padding: '6px 14px',
    fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700',
    cursor: 'pointer', flexShrink: '0',
  });
  btn.addEventListener('click', () => { banner.remove(); startTopic(topicId); });

  banner.appendChild(txt);
  banner.appendChild(btn);
  const picker = document.getElementById('topic-picker');
  if (picker) picker.insertBefore(banner, picker.firstChild);
}

let _pathModeActive = false;
let _pathCardId     = null;

function startTopic(topicId, pathMode, pathCard) {
  _pathModeActive = !!pathMode;
  _pathCardId     = pathCard || null;
  currentTopicId = topicId;
  quizTopicKey   = topicId === 'general' ? 'quiz_vocab' : 'quiz_' + topicId;
  const dataKey = topicId === 'general' ? 'words' : 'words-' + topicId;

  AppData.get(dataKey)
    .then(data => {
      const _order = CEFR_ORDER;
      const _tagged = (data.words || []).map(w => ({ ...w }))
        .sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));
      words   = _tagged;
      cardIds = _tagged.map(x => quizTopicKey + '_' + x.id);

      const topicObj = (AppTopics.VOCAB_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: words,
        cardIds,
        topicLabel: topicObj ? topicObj.label : topicId,
        pickerEl: document.getElementById('topic-picker'),
        cefrLevels: _tagged.map(x => x.level || null),
        onStart: idx => _beginExercise(idx),
      };
      _openPhraseBrowser = () => PhraseBrowser.show(_pbArgs);
      if (_pathModeActive) {
        _beginExercise(0);
      } else {
        _openPhraseBrowser();
      }
    })
    .catch(() => _showLoadError(topicId));
}

function _beginExercise(idx) {
  if (_pathModeActive && _pathCardId) {
    const cardIdx = cardIds.indexOf(_pathCardId);
    if (cardIdx !== -1) idx = cardIdx;
  }
  currentIndex = idx;
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('quiz-content').classList.remove('hidden');
  const streak = Progress.getStreak();
  const el = document.getElementById('quiz-streak');
  if (el) el.textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });
  showQuestion(currentIndex);
  updateCounter();
}

// ---- Quiz Display ----

function showQuestion(index) {
  const word = words[index];
  if (!word) return;

  answered         = false;
  _translationMode = (CEFR_ORDER[word.level] ?? 99) <= 1; // A1=0, A2=1 → translation mode

  document.getElementById('quiz-word').textContent     = word.word;
  document.getElementById('quiz-category').textContent = word.category || '';
  document.getElementById('word-card').className       = 'word-card';

  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('quiz-diff').textContent = '';
  document.getElementById('feedback-example-text').textContent = '';
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('try-again-btn').classList.add('hidden');
  document.getElementById('back-to-path')?.classList.add('hidden');

  _showCefrBadge(word.level, 'word-card');
  const choices = buildChoices(index);
  renderChoices(choices, index);
  // Don't auto-focus first option — it triggers a visible border that looks like a selection
}

function _showCefrBadge(level, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let badge = container.querySelector('.cefr-phrase-badge');
  if (!badge) {
    badge = document.createElement('span');
    container.style.position = 'relative';
    container.appendChild(badge);
  }
  if (!level) { badge.className = 'cefr-phrase-badge'; badge.textContent = ''; return; }
  badge.className = 'cefr-phrase-badge cefr-badge cefr-badge--' + level.toLowerCase();
  badge.textContent = level;
  badge.setAttribute('aria-label', 'CEFR level ' + level);
}

function buildChoices(correctIdx) {
  const correct  = words[correctIdx];
  const sameDiff = words.filter((w, i) => i !== correctIdx && w.difficulty === correct.difficulty);
  const pool     = sameDiff.length >= 3 ? sameDiff : words.filter((_, i) => i !== correctIdx);

  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const distractors = shuffled.slice(0, 3);
  const all = [{ ...correct, isCorrect: true }, ...distractors.map(w => ({ ...w, isCorrect: false }))];

  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

function renderChoices(choices, correctIdx) {
  const grid = document.getElementById('choices-grid');
  grid.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = _quizText(choice);
    btn.addEventListener('click', () => handleAnswer(choice.isCorrect, choice, correctIdx));
    grid.appendChild(btn);
  });
}

// ---- Answer Handling ----

function handleAnswer(isCorrect, chosenWord, correctIdx) {
  if (answered) return;
  answered = true;
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], PathSession.getQualityFromResult(isCorrect));
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(words[currentIndex]?.level, isCorrect, 'quiz');
  Progress.recordSession(quizTopicKey, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const btns = document.querySelectorAll('.choice-btn');
  btns.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === _quizText(words[correctIdx])) {
      btn.classList.add('correct');
    } else if (btn.textContent === _quizText(chosenWord) && !isCorrect) {
      btn.classList.add('incorrect');
    }
  });

  const feedbackEl = document.getElementById('quiz-feedback');
  const resultEl   = document.getElementById('feedback-result');
  const diffEl     = document.getElementById('quiz-diff');
  const exampleEl  = document.getElementById('feedback-example-text');
  const wordCard   = document.getElementById('word-card');

  resultEl.textContent = isCorrect ? AppLang.t('feedback_correct') : AppLang.t('feedback_incorrect');
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  wordCard.classList.add(isCorrect ? 'word-card--correct' : 'word-card--incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(AppFeedback.buildQuiz(_quizText(chosenWord), _quizText(words[correctIdx]), isCorrect));

  exampleEl.textContent = '"' + words[correctIdx].example + '"';
  feedbackEl.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  document.getElementById('next-btn').classList.toggle('hidden', !isCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', isCorrect);
  document.getElementById('back-to-path')?.classList.remove('hidden');
  document.getElementById(isCorrect ? 'next-btn' : 'try-again-btn')?.focus();

}

function rateAndNext(quality) {
  // Progress already saved in handleAnswer — just advance
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const nextHref = PathSession.advance();
    if (nextHref) {
      window.location.href = '../../' + nextHref;
    } else {
      _showPathSessionComplete();
    }
    return;
  }
  updateCounter();

  currentIndex = (currentIndex + 1) % words.length;
  showQuestion(currentIndex);

  const streak = Progress.getStreak();
  const el = document.getElementById('quiz-streak');
  if (el) el.textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });
}

function _showPathSessionComplete() {
  const prog = typeof PathSession !== 'undefined' ? PathSession.getProgress() : null;
  const reviewCount = prog ? Math.max(0, prog.total - (prog.newCount || 0)) : 0;
  const newCount    = prog ? (prog.newCount || 0) : 0;
  document.body.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;font-family:inherit;">' +
      '<div style="font-size:3rem;margin-bottom:1rem;">🎉</div>' +
      '<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">' + AppLang.t('session_complete') + '</h1>' +
      '<p style="color:var(--clr-text-muted,#6b7280);margin-bottom:2rem;">' +
        AppLang.t('path_complete_summary', { review: reviewCount, new: newCount }) +
      '</p>' +
      '<a href="../../my-learning/html/my-learning.html" style="background:var(--clr-primary,#4f46e5);color:#fff;padding:0.75rem 2rem;border-radius:999px;text-decoration:none;font-weight:600;">' + AppLang.t('my_learning_link') + '</a>' +
    '</div>';
}

// ---- Utilities ----

function updateCounter() {
  const el = document.getElementById('quiz-counter');
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const prog = PathSession.getProgress();
    if (el) el.textContent = AppLang.t('cta_exercise_n', { cur: prog.current, total: prog.total });
    const pct = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;
    const fill = document.getElementById('session-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const bar = document.getElementById('session-progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', pct);
    return;
  }
  const stats = Progress.getStatsForCards(cardIds);
  if (el) el.textContent = AppLang.t('topic_learned', { seen: stats.seen, total: stats.total });
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}
