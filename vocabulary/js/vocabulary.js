/* ============================================================
   vocabulary.js — Flashcard Vocabulary Trainer with SRS
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

let currentTopicId  = '';
let vocabTopicKey   = '';  // SRS prefix
let words           = [];
let cardIds         = [];
let currentIndex    = 0;
let isFlipped       = false;
let sessionReviewed = 0;

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  buildTopicGrid();

  document.getElementById('back-btn').addEventListener('click', showTopicPicker);

  document.getElementById('flashcard-scene').addEventListener('click', () => {
    if (!isFlipped) flipCard();
  });

  document.getElementById('flashcard-scene').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !isFlipped) {
      e.preventDefault();
      flipCard();
    }
  });

  document.getElementById('rate-hard').addEventListener('click', () => rateAndNext(1));
  document.getElementById('rate-ok').addEventListener('click',   () => rateAndNext(3));
  document.getElementById('rate-easy').addEventListener('click', () => rateAndNext(5));

  document.getElementById('continue-btn').addEventListener('click', () => {
    document.getElementById('session-done').classList.add('hidden');
    document.getElementById('flashcard-scene').classList.remove('hidden');
    sessionReviewed = 0;
    currentIndex = Progress.getNextIndex(cardIds, -1);
    showCard(currentIndex);
    updateStatsBar();
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
    btn.setAttribute('aria-label', topic.label + ' vocabulary flashcards');
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
      '<span class="img-topic-card__badge">Flashcard</span>' +
      '</div>';
    btn.addEventListener('click', () => startTopic(topic.id));
    grid.appendChild(btn);

    const jsonPath = topic.id === 'general'
      ? '../../vocabulary/json/words.json'
      : '../../vocabulary/json/words-' + topic.id + '.json';
    const prefix = topic.id === 'general' ? 'vocab' : 'vocab_' + topic.id;
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
  document.getElementById('vocab-content').classList.add('hidden');
}

function startTopic(topicId) {
  currentTopicId = topicId;
  // Preserve original SRS IDs for 'general' to avoid breaking existing progress
  vocabTopicKey  = topicId === 'general' ? 'vocab' : 'vocab_' + topicId;
  const jsonPath = topicId === 'general'
    ? '../json/words.json'
    : '../json/words-' + topicId + '.json';

  fetch(jsonPath)
    .then(r => r.json())
    .then(data => {
      words   = data.words;
      cardIds = words.map((_, i) => vocabTopicKey + '_' + i);
      currentIndex = Progress.getNextIndex(cardIds, -1);

      document.getElementById('topic-picker').classList.add('hidden');
      document.getElementById('vocab-content').classList.remove('hidden');

      const streak = Progress.getStreak();
      const el = document.getElementById('vocab-streak');
      if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

      showCard(currentIndex);
      updateStatsBar();
    })
    .catch(err => {
      document.getElementById('word-text').textContent = 'Error loading words.';
      console.error(err);
    });
}

// ---- Card Display ----

function showCard(index) {
  const word = words[index];
  if (!word) return;
  isFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');
  document.getElementById('word-category').textContent     = word.category || '';
  document.getElementById('word-text').textContent         = word.word;
  document.getElementById('word-category-back').textContent = word.category || '';
  document.getElementById('word-definition').textContent   = word.definition;
  document.getElementById('word-example').textContent      = '"' + word.example + '"';
  document.getElementById('word-translation').textContent  = word.translation;
  document.getElementById('rating-area').classList.add('hidden');
}

function flipCard() {
  isFlipped = true;
  document.getElementById('flashcard').classList.add('flipped');
  setTimeout(() => {
    document.getElementById('rating-area').classList.remove('hidden');
  }, 350);
}

function rateAndNext(quality) {
  Progress.rate(cardIds[currentIndex], quality);
  Progress.recordSession(vocabTopicKey, quality >= 3 ? 1 : 0, 1);
  sessionReviewed++;

  updateStatsBar();

  const nextIdx = Progress.getNextIndex(cardIds, currentIndex);
  const session = getSessionStats();

  if (sessionReviewed >= Math.min(20, words.length) && session.due === 0 && session.newCards === 0) {
    showSessionDone();
    return;
  }

  currentIndex = nextIdx;
  showCard(currentIndex);

  const scene = document.getElementById('flashcard-scene');
  if (scene) scene.focus();

  const streak = Progress.getStreak();
  const el = document.getElementById('vocab-streak');
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

function updateStatsBar() {
  const stats     = Progress.getTopicStats(vocabTopicKey, words.length);
  const el        = document.getElementById('cards-remaining');
  if (!el) return;
  const session   = getSessionStats();
  const remaining = session.newCards + session.due;
  el.textContent  = remaining > 0
    ? remaining + ' cards due  ·  ' + stats.seen + ' / ' + stats.total + ' learned'
    : stats.seen + ' / ' + stats.total + ' learned  ·  all caught up!';
}

function showSessionDone() {
  const stats = Progress.getTopicStats(vocabTopicKey, words.length);
  document.getElementById('flashcard-scene').classList.add('hidden');
  document.getElementById('rating-area').classList.add('hidden');
  const msg = document.getElementById('done-message');
  if (msg) {
    msg.textContent = 'You reviewed ' + sessionReviewed + ' cards. '
      + stats.seen + ' of ' + stats.total + ' words learned so far. Keep it up!';
  }
  document.getElementById('session-done').classList.remove('hidden');
  sessionReviewed = 0;
}
