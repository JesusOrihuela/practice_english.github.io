/* ============================================================
   quiz.js — Multiple Choice Vocabulary Quiz with SRS
   Research basis: Testing Effect (Roediger & Karpicke 2006)
   ============================================================ */

const TOPICS = [
  { id: 'general',        label: 'General',        emoji: '📖' },
  { id: 'greetings',      label: 'Greetings',      emoji: '👋' },
  { id: 'traveling',      label: 'Traveling',      emoji: '✈️' },
  { id: 'technology',     label: 'Technology',     emoji: '💻' },
  { id: 'restaurant',     label: 'Restaurant',     emoji: '🍽️' },
  { id: 'kitchen',        label: 'Kitchen',        emoji: '🍳' },
  { id: 'supermarket',    label: 'Supermarket',    emoji: '🛒' },
  { id: 'entertainment',  label: 'Entertainment',  emoji: '🎬' },
  { id: 'accountability', label: 'Accountability', emoji: '🎯' },
  { id: 'gym',            label: 'Gym',            emoji: '💪' },
];

let currentTopicId   = '';
let quizTopicKey     = '';  // SRS prefix
let words            = [];
let cardIds          = [];
let currentIndex     = 0;
let sessionReviewed  = 0;
let answered         = false;

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  buildTopicGrid();

  document.getElementById('back-btn').addEventListener('click', showTopicPicker);
  document.getElementById('rate-hard').addEventListener('click', () => rateAndNext(1));
  document.getElementById('rate-ok').addEventListener('click',   () => rateAndNext(3));
  document.getElementById('rate-easy').addEventListener('click', () => rateAndNext(5));

  document.getElementById('continue-btn').addEventListener('click', () => {
    document.getElementById('session-done').classList.add('hidden');
    document.getElementById('word-card').classList.remove('hidden');
    document.getElementById('choices-grid').classList.remove('hidden');
    sessionReviewed = 0;
    currentIndex = Progress.getNextIndex(cardIds, -1);
    showQuestion(currentIndex);
    updateCounter();
  });
});

// ---- Topic Picker ----

function buildTopicGrid() {
  const grid = document.getElementById('topic-grid');
  grid.className = 'img-topic-grid';
  TOPICS.forEach((topic, i) => {
    const btn = document.createElement('button');
    btn.className = 'img-topic-card';
    btn.dataset.theme = topic.id;
    btn.style.animationDelay = (i * 0.06) + 's';
    btn.setAttribute('aria-label', topic.label + ' vocabulary quiz');
    const imgSrc = '../img/' + topic.id + '.webp';
    btn.innerHTML =
      '<div class="img-topic-card__img-wrap">' +
      '<img class="img-topic-card__img" src="' + imgSrc + '" alt="" loading="lazy" width="800" height="450">' +
      '<div class="img-topic-card__overlay"></div>' +
      '</div>' +
      '<div class="img-topic-card__body">' +
      '<div class="img-topic-card__info">' +
      '<span class="img-topic-card__title">' + topic.label + '</span>' +
      '<span class="img-topic-card__progress" id="tp-' + topic.id + '"></span>' +
      '</div>' +
      '<span class="img-topic-card__badge">Quiz</span>' +
      '</div>';
    btn.addEventListener('click', () => startTopic(topic.id));
    grid.appendChild(btn);

    const jsonPath = topic.id === 'general'
      ? '../../vocabulary/json/words.json'
      : '../../vocabulary/json/words-' + topic.id + '.json';
    const prefix = topic.id === 'general' ? 'quiz_vocab' : 'quiz_' + topic.id;
    fetch(jsonPath)
      .then(r => r.json())
      .then(data => {
        const total = data.words ? data.words.length : 0;
        const s = Progress.getTopicStats(prefix, total);
        const el = document.getElementById('tp-' + topic.id);
        if (el) el.textContent = s.seen + ' / ' + total + ' learned';
      })
      .catch(() => {});
  });
}

function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('quiz-content').classList.add('hidden');
}

function startTopic(topicId) {
  currentTopicId = topicId;
  // Preserve original SRS IDs for 'general' to avoid breaking existing progress
  quizTopicKey   = topicId === 'general' ? 'quiz_vocab' : 'quiz_' + topicId;
  const jsonPath = topicId === 'general'
    ? '../../vocabulary/json/words.json'
    : '../../vocabulary/json/words-' + topicId + '.json';

  fetch(jsonPath)
    .then(r => r.json())
    .then(data => {
      words   = data.words;
      cardIds = words.map((_, i) => quizTopicKey + '_' + i);
      currentIndex = Progress.getNextIndex(cardIds, -1);

      document.getElementById('topic-picker').classList.add('hidden');
      document.getElementById('quiz-content').classList.remove('hidden');

      const streak = Progress.getStreak();
      const el = document.getElementById('quiz-streak');
      if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

      showQuestion(currentIndex);
      updateCounter();
    })
    .catch(err => {
      document.getElementById('quiz-word').textContent = 'Error loading words.';
      console.error(err);
    });
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
  document.getElementById('rating-area').classList.add('hidden');

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
  const correctEl  = document.getElementById('feedback-correct');
  const exampleEl  = document.getElementById('feedback-example');
  const wordCard   = document.getElementById('word-card');

  if (isCorrect) {
    resultEl.textContent  = '✓ Correct!';
    resultEl.className    = 'feedback-result correct';
    wordCard.classList.add('word-card--correct');
    correctEl.textContent = '';
  } else {
    resultEl.textContent  = '✗ Incorrect';
    resultEl.className    = 'feedback-result incorrect';
    wordCard.classList.add('word-card--incorrect');
    correctEl.textContent = 'Correct: ' + words[correctIdx].definition;
  }

  exampleEl.textContent = '"' + words[correctIdx].example + '"';
  feedbackEl.classList.remove('hidden');
  document.getElementById('rating-area').classList.remove('hidden');
  document.getElementById('rate-hard').focus();
}

function rateAndNext(quality) {
  Progress.rate(cardIds[currentIndex], quality);
  Progress.recordSession(quizTopicKey, quality >= 3 ? 1 : 0, 1);
  sessionReviewed++;

  updateCounter();

  const nextIdx = Progress.getNextIndex(cardIds, currentIndex);
  const session = getSessionStats();

  if (sessionReviewed >= Math.min(20, words.length) && session.due === 0 && session.newCards === 0) {
    showSessionDone();
    return;
  }

  currentIndex = nextIdx;
  showQuestion(currentIndex);

  const streak = Progress.getStreak();
  const el = document.getElementById('quiz-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
}

// ---- Utilities ----

function getSessionStats() {
  const data = Progress.getAllCards();
  const now  = Date.now();
  let newCards = 0, due = 0;
  cardIds.forEach(id => {
    const card = data[id];
    if (!card || card.reps === 0) newCards++;
    else if (card.due <= now) due++;
  });
  return { newCards, due };
}

function updateCounter() {
  const stats = Progress.getTopicStats(quizTopicKey, words.length);
  const el = document.getElementById('quiz-counter');
  if (!el) return;
  const session   = getSessionStats();
  const remaining = session.newCards + session.due;
  el.textContent  = remaining > 0
    ? remaining + ' due  ·  ' + stats.seen + ' / ' + stats.total + ' learned'
    : stats.seen + ' / ' + stats.total + ' learned';
}

function showSessionDone() {
  const stats = Progress.getTopicStats(quizTopicKey, words.length);
  document.getElementById('word-card').classList.add('hidden');
  document.getElementById('choices-grid').classList.add('hidden');
  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('rating-area').classList.add('hidden');
  const msg = document.getElementById('done-message');
  if (msg) {
    msg.textContent = 'You answered ' + sessionReviewed + ' questions. '
      + stats.seen + ' of ' + stats.total + ' words learned so far!';
  }
  document.getElementById('session-done').classList.remove('hidden');
  sessionReviewed = 0;
}
