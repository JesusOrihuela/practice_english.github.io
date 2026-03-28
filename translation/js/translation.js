/* ============================================================
   translation.js — Reverse Translation (Spanish → English) with SRS
   Research basis: Desirable Difficulty (Bjork 1994), Cook (2010)
   ============================================================ */


const TOPICS = [
  { id: 'greetings',      label: 'Greetings',      emoji: '👋' },
  { id: 'traveling',      label: 'Traveling',       emoji: '✈️' },
  { id: 'technology',     label: 'Technology',      emoji: '💻' },
  { id: 'restaurant',     label: 'Restaurant',      emoji: '🍽️' },
  { id: 'kitchen',        label: 'Kitchen',         emoji: '🍳' },
  { id: 'supermarket',    label: 'Supermarket',     emoji: '🛒' },
  { id: 'entertainment',  label: 'Entertainment',   emoji: '🎬' },
  { id: 'accountability', label: 'Accountability',  emoji: '🎯' },
  { id: 'gym',            label: 'Gym',             emoji: '💪' },
];

let currentTopic = '';
let phrases = [], translations = [], cardIds = [];
let currentIndex = 0;
let answered = false;

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  buildTopicGrid();

  document.getElementById('back-btn').addEventListener('click', showTopicPicker);

  document.getElementById('check-btn').addEventListener('click', checkAnswer);
  document.getElementById('trans-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkAnswer();
  });

  document.getElementById('listen-btn').addEventListener('click', () => {
    const phrase = phrases[currentIndex];
    if (phrase) playTTS(phrase);
  });

  document.getElementById('rate-hard').addEventListener('click', () => rateAndNext(1));
  document.getElementById('rate-ok').addEventListener('click',   () => rateAndNext(3));
  document.getElementById('rate-easy').addEventListener('click', () => rateAndNext(5));

  AppTTS.warmup();
});

// ---- Topic Grid ----

function buildTopicGrid() {
  const grid = document.getElementById('topic-grid');
  grid.className = 'img-topic-grid';
  TOPICS.forEach((topic, i) => {
    const btn = document.createElement('button');
    btn.className = 'img-topic-card';
    btn.dataset.theme = topic.id;
    btn.style.animationDelay = (i * 0.06) + 's';
    btn.setAttribute('aria-label', topic.label + ' translation');
    const imgSrc = '../img/' + topic.id + '.jpg';
    btn.innerHTML =
      '<div class="img-topic-card__img-wrap">' +
      '<img class="img-topic-card__img" src="' + imgSrc + '" alt="" loading="lazy">' +
      '<div class="img-topic-card__overlay"></div>' +
      '</div>' +
      '<div class="img-topic-card__body">' +
      '<div class="img-topic-card__info">' +
      '<span class="img-topic-card__title">' + topic.label + '</span>' +
      '<span class="img-topic-card__progress" id="tp-' + topic.id + '"></span>' +
      '</div>' +
      '<span class="img-topic-card__badge">Translate</span>' +
      '</div>';
    btn.addEventListener('click', () => startTopic(topic.id));
    grid.appendChild(btn);

    fetch('../../speaking/json/' + topic.id + '.json')
      .then(r => r.json())
      .then(data => {
        const total = data.phrases ? data.phrases.length : 0;
        const s = Progress.getTopicStats('trans_' + topic.id, total);
        const el = document.getElementById('tp-' + topic.id);
        if (el) el.textContent = s.seen + ' / ' + total + ' learned';
      })
      .catch(() => {});
  });
}

function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('exercise-area').classList.add('hidden');
}

// ---- Load Topic ----

function startTopic(topicId) {
  currentTopic = topicId;
  fetch('../../speaking/json/' + topicId + '.json')
    .then(r => r.json())
    .then(data => {
      // Filter out phrases with no translation
      const validPairs = data.phrases
        .map((p, i) => ({ phrase: p, translation: (data.traductions || [])[i] || '', idx: i }))
        .filter(pair => pair.translation.trim().length > 0);

      phrases      = validPairs.map(p => p.phrase);
      translations = validPairs.map(p => p.translation);
      cardIds      = validPairs.map((_, seqIdx) => 'trans_' + topicId + '_' + seqIdx);

      if (phrases.length === 0) {
        alert('No translations available for this topic.');
        return;
      }

      currentIndex = Progress.getNextIndex(cardIds, -1);

      document.getElementById('topic-picker').classList.add('hidden');
      document.getElementById('exercise-area').classList.remove('hidden');

      const streak = Progress.getStreak();
      document.getElementById('trans-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

      showPhrase(currentIndex);
      updateCounter();
    })
    .catch(err => {
      alert('Error loading topic. Please try again.');
      console.error(err);
    });
}

// ---- Display ----

function showPhrase(index) {
  answered = false;

  document.getElementById('spanish-phrase').textContent = translations[index] || '—';
  document.getElementById('trans-input').value           = '';
  document.getElementById('trans-input').disabled        = false;
  document.getElementById('check-btn').disabled          = false;
  document.getElementById('trans-feedback').classList.add('hidden');
  document.getElementById('rating-area').classList.add('hidden');
  document.getElementById('listen-btn').classList.add('hidden');
  document.getElementById('phrase-card').className       = 'phrase-card';

  document.getElementById('trans-input').focus();
}

// ---- Answer Check ----

function normalise(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
}

function buildDiff(expected, actual) {
  const eWords = normalise(expected).split(' ');
  const aWords = normalise(actual).split(' ');
  return eWords.map((w, i) => {
    const cls = (aWords[i] === w) ? 'diff-ok' : 'diff-err';
    return '<span class="' + cls + '">' + escapeHTML(w) + '</span>';
  }).join(' ');
}

function checkAnswer() {
  if (answered) return;
  const input = document.getElementById('trans-input');
  const raw   = input.value.trim();
  if (!raw) return;

  answered = true;
  input.disabled = true;
  document.getElementById('check-btn').disabled = true;

  const expected   = phrases[currentIndex];
  const isCorrect  = normalise(raw) === normalise(expected);

  const resultEl   = document.getElementById('feedback-result');
  const diffEl     = document.getElementById('feedback-diff');
  const feedback   = document.getElementById('trans-feedback');
  const card       = document.getElementById('phrase-card');
  const listenBtn  = document.getElementById('listen-btn');

  if (isCorrect) {
    resultEl.textContent = '✓ Correct!';
    resultEl.className   = 'feedback-result correct';
    diffEl.innerHTML     = '<span class="diff-ok">' + escapeHTML(expected) + '</span>';
    card.classList.add('phrase-card--correct');
  } else {
    resultEl.textContent = '✗ Correct answer:';
    resultEl.className   = 'feedback-result incorrect';
    diffEl.innerHTML     = buildDiff(expected, raw);
    card.classList.add('phrase-card--incorrect');
  }

  listenBtn.classList.remove('hidden');
  feedback.classList.remove('hidden');
  document.getElementById('rating-area').classList.remove('hidden');
  document.getElementById('rate-hard').focus();
}

// ---- Rating & Advance ----

function rateAndNext(quality) {
  Progress.rate(cardIds[currentIndex], quality);
  Progress.recordSession(currentTopic, quality >= 3 ? 1 : 0, 1);

  updateCounter();

  const streak = Progress.getStreak();
  document.getElementById('trans-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  currentIndex = Progress.getNextIndex(cardIds, currentIndex);
  showPhrase(currentIndex);
}

// ---- Counter ----

function updateCounter() {
  const stats = Progress.getTopicStats('trans_' + currentTopic, phrases.length);
  const el = document.getElementById('trans-counter');
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' learned';
}

// ---- TTS (Kokoro via AppTTS) ----

function playTTS(text) {
  if (!text) return;
  AppTTS.speak(text);
}

// ---- Utilities ----

function escapeHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
