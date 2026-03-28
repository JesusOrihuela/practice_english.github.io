/* ============================================================
   cloze.js — Fill-in-the-Blank Exercise with SRS
   Research basis: Generation Effect (Slamecka & Graf 1978)
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


const STOP_WORDS = new Set([
  'a','an','the','in','on','at','to','of','is','are','was','were','be','been',
  'have','has','had','do','does','did','will','would','could','should','may',
  'might','must','shall','and','or','but','if','so','yet','for','nor',
  'i','you','he','she','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','this','that','these','those',
  'with','from','by','as','not','no','up','out','it','its'
]);

let currentTopic = '';
let phrases = [], translations = [], cardIds = [];
let currentIndex = 0;
let currentBlank = null;  // { blank, blankClean, blankedPhrase, fullPhrase }
let answered = false;

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  buildTopicGrid();

  document.getElementById('back-btn').addEventListener('click', showTopicPicker);

  document.getElementById('check-btn').addEventListener('click', checkAnswer);
  document.getElementById('cloze-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkAnswer();
  });

  document.getElementById('listen-btn').addEventListener('click', () => {
    if (currentBlank) playTTS(currentBlank.fullPhrase);
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
    btn.setAttribute('aria-label', topic.label + ' fill-in-the-blank');
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
      '<span class="img-topic-card__badge">Fill-in</span>' +
      '</div>';
    btn.addEventListener('click', () => startTopic(topic.id));
    grid.appendChild(btn);

    fetch('../../speaking/json/' + topic.id + '.json')
      .then(r => r.json())
      .then(data => {
        const total = data.phrases ? data.phrases.length : 0;
        const s = Progress.getTopicStats('cloze_' + topic.id, total);
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
      phrases      = data.phrases;
      translations = data.traductions || [];
      cardIds      = phrases.map((_, i) => 'cloze_' + topicId + '_' + i);
      currentIndex = Progress.getNextIndex(cardIds, -1);

      document.getElementById('topic-picker').classList.add('hidden');
      document.getElementById('exercise-area').classList.remove('hidden');

      const streak = Progress.getStreak();
      document.getElementById('cloze-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

      showPhrase(currentIndex);
      updateCounter();
    })
    .catch(err => {
      alert('Error loading topic. Please try again.');
      console.error(err);
    });
}

// ---- Cloze Display ----

function selectBlankWord(phrase) {
  const tokens = phrase.split(' ');
  const candidates = tokens.map((w, i) => {
    const clean = w.toLowerCase().replace(/[^a-z'-]/g, '');
    return { word: w, idx: i, clean };
  }).filter(t => t.clean.length > 2 && !STOP_WORDS.has(t.clean));

  if (candidates.length === 0) return null;

  // Prefer words from the middle of the phrase (more contextually meaningful)
  const preferred = candidates.slice(0, Math.min(candidates.length, 3));
  const pick = preferred[Math.floor(Math.random() * preferred.length)];

  const blankedPhrase = tokens.map((w, i) => i === pick.idx ? '___' : w).join(' ');
  // Strip trailing punctuation from the blank word for comparison
  const blankClean = pick.clean.replace(/[^a-z'-]/g, '');

  return {
    blank: pick.word.replace(/[^a-zA-Z'-]/g, ''),
    blankClean,
    blankedPhrase,
    fullPhrase: phrase
  };
}

function showPhrase(startIndex) {
  answered = false;
  currentBlank = null;
  currentIndex = startIndex;

  // Iterate instead of recurse to avoid stack overflow when many phrases lack blankable words
  const tried = new Set();
  while (!currentBlank) {
    if (tried.has(currentIndex) || tried.size >= cardIds.length) break;
    tried.add(currentIndex);
    currentBlank = selectBlankWord(phrases[currentIndex]);
    if (!currentBlank) {
      currentIndex = Progress.getNextIndex(cardIds, currentIndex);
    }
  }
  if (!currentBlank) {
    // Edge case: no blankable phrase in the entire topic — show error and go back
    alert('No fill-in-the-blank exercises are available for this topic.');
    showTopicPicker();
    return;
  }

  document.getElementById('phrase-text').innerHTML        = currentBlank.blankedPhrase.replace('___', '<span aria-label="blank word">[___]</span>');
  document.getElementById('translation-text').textContent = translations[currentIndex] || '';
  document.getElementById('cloze-input').value            = '';
  document.getElementById('cloze-input').disabled         = false;
  document.getElementById('check-btn').disabled           = false;
  document.getElementById('cloze-feedback').classList.add('hidden');
  document.getElementById('rating-area').classList.add('hidden');
  document.getElementById('phrase-card').className        = 'phrase-card';

  document.getElementById('cloze-input').focus();
}

// ---- Answer Check ----

function checkAnswer() {
  if (answered) return;
  const input = document.getElementById('cloze-input');
  const raw   = input.value.trim();
  if (!raw) return;

  answered = true;
  input.disabled    = true;
  document.getElementById('check-btn').disabled = true;

  const guess = raw.toLowerCase().replace(/[^a-z'-]/g, '');
  const isCorrect = guess === currentBlank.blankClean;

  const resultEl  = document.getElementById('feedback-result');
  const fullEl    = document.getElementById('feedback-full');
  const card      = document.getElementById('phrase-card');
  const feedback  = document.getElementById('cloze-feedback');

  if (isCorrect) {
    resultEl.textContent = '✓ Correct! The word was "' + currentBlank.blank + '"';
    resultEl.className   = 'feedback-result correct';
    card.classList.add('phrase-card--correct');
  } else {
    resultEl.textContent = '✗ The answer was "' + currentBlank.blank + '"';
    resultEl.className   = 'feedback-result incorrect';
    card.classList.add('phrase-card--incorrect');
  }

  fullEl.textContent = currentBlank.fullPhrase;
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
  document.getElementById('cloze-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  currentIndex = Progress.getNextIndex(cardIds, currentIndex);
  showPhrase(currentIndex);
}

// ---- Counter ----

function updateCounter() {
  const stats = Progress.getTopicStats('cloze_' + currentTopic, phrases.length);
  const el = document.getElementById('cloze-counter');
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' learned';
}

// ---- TTS Hint (Kokoro via AppTTS) ----

function playTTS(text) {
  if (!text) return;
  AppTTS.speak(text);
}
