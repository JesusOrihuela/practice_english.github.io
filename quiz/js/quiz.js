/* ============================================================
   quiz.js — Multiple Choice Vocabulary Quiz with SRS
   Research basis: Testing Effect (Roediger & Karpicke 2006)
   ============================================================ */

const LAST_KEY = 'pe_last_quiz';

let _openPhraseBrowser = null;


let currentTopicId   = '';
let quizTopicKey     = '';  // SRS prefix
let words            = [];
let cardIds          = [];
let currentIndex     = 0;
let answered         = false;
let _lastCorrect     = false;

// ---- Init ----

function _quizGridOpts() {
  return {
    badge: 'Quiz',
    topics: AppTopics.VOCAB_TOPICS,
    getSrsKey: t => t.id === 'general' ? 'quiz_vocab' : 'quiz_' + t.id,
    getItemCount: t => {
      const path = t.id === 'general' ? '../../shared/json/words.json' : '../../shared/json/words-' + t.id + '.json';
      return fetch(path).then(r => r.json()).then(d => d.words ? d.words.length : 0);
    },
    onSelect: startTopic,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  AppTopicGrid.build(_quizGridOpts());

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
  txt.textContent = '⚠️ Error loading topic. Check your connection.';

  const btn = document.createElement('button');
  btn.textContent = 'Retry →';
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

function startTopic(topicId) {
  localStorage.setItem(LAST_KEY, topicId);
  currentTopicId = topicId;
  quizTopicKey   = topicId === 'general' ? 'quiz_vocab' : 'quiz_' + topicId;
  const jsonPath = topicId === 'general'
    ? '../../shared/json/words.json'
    : '../../shared/json/words-' + topicId + '.json';

  fetch(jsonPath)
    .then(r => r.json())
    .then(data => {
      words   = data.words;
      cardIds = words.map((_, i) => quizTopicKey + '_' + i);

      const topicObj = (AppTopics.VOCAB_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: words,
        cardIds,
        topicLabel: topicObj ? topicObj.label : topicId,
        pickerEl: document.getElementById('topic-picker'),
        onStart: idx => _beginExercise(idx),
      };
      _openPhraseBrowser = () => PhraseBrowser.show(_pbArgs);
      _openPhraseBrowser();
    })
    .catch(() => _showLoadError(topicId));
}

function _beginExercise(idx) {
  currentIndex = idx;
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('quiz-content').classList.remove('hidden');
  const streak = Progress.getStreak();
  const el = document.getElementById('quiz-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  showQuestion(currentIndex);
  updateCounter();
}

// ---- Quiz Display ----

function showQuestion(index) {
  const word = words[index];
  if (!word) return;

  answered = false;

  document.getElementById('quiz-word').textContent     = word.word;
  document.getElementById('quiz-category').textContent = word.category || '';
  document.getElementById('word-card').className       = 'word-card';

  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('quiz-diff').textContent = '';
  document.getElementById('feedback-example-text').textContent = '';
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('try-again-btn').classList.add('hidden');

  const choices = buildChoices(index);
  renderChoices(choices, index);
  const firstChoice = document.querySelector('#choices-grid .choice-btn');
  if (firstChoice) firstChoice.focus();
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
    btn.textContent = choice.definition;
    btn.addEventListener('click', () => handleAnswer(choice.isCorrect, choice, correctIdx));
    grid.appendChild(btn);
  });
}

// ---- Answer Handling ----

function handleAnswer(isCorrect, chosenWord, correctIdx) {
  if (answered) return;
  answered = true;
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);
  Progress.recordSession(quizTopicKey, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const btns = document.querySelectorAll('.choice-btn');
  btns.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === words[correctIdx].definition) {
      btn.classList.add('correct');
    } else if (btn.textContent === chosenWord.definition && !isCorrect) {
      btn.classList.add('incorrect');
    }
  });

  const feedbackEl = document.getElementById('quiz-feedback');
  const resultEl   = document.getElementById('feedback-result');
  const diffEl     = document.getElementById('quiz-diff');
  const exampleEl  = document.getElementById('feedback-example-text');
  const wordCard   = document.getElementById('word-card');

  resultEl.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  wordCard.classList.add(isCorrect ? 'word-card--correct' : 'word-card--incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(AppFeedback.buildQuiz(chosenWord.definition, words[correctIdx].definition, isCorrect));

  exampleEl.textContent = '"' + words[correctIdx].example + '"';
  feedbackEl.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  document.getElementById('next-btn').classList.toggle('hidden', !isCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', isCorrect);
  document.getElementById(isCorrect ? 'next-btn' : 'try-again-btn')?.focus();
}

function rateAndNext(quality) {
  // Progress already saved in handleAnswer — just advance
  updateCounter();

  currentIndex = (currentIndex + 1) % words.length;
  showQuestion(currentIndex);

  const streak = Progress.getStreak();
  const el = document.getElementById('quiz-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
}

// ---- Utilities ----

function updateCounter() {
  const stats = Progress.getTopicStats(quizTopicKey, words.length);
  const el = document.getElementById('quiz-counter');
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' learned';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}
