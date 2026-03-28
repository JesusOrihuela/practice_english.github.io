/* ============================================================
   scramble.js — Word Order Reconstruction with SRS
   Research basis: CALP Syntactic Reconstruction (Cummins 2000)
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
let shuffledTiles = [];   // [{ tileId, word }]
let builtSentence = [];   // array of tileIds in order
let answered = false;

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  buildTopicGrid();

  document.getElementById('back-btn').addEventListener('click', showTopicPicker);
  document.getElementById('clear-btn').addEventListener('click', clearSentence);
  document.getElementById('check-btn').addEventListener('click', checkAnswer);

  document.getElementById('rate-hard').addEventListener('click', () => rateAndNext(1));
  document.getElementById('rate-ok').addEventListener('click',   () => rateAndNext(3));
  document.getElementById('rate-easy').addEventListener('click', () => rateAndNext(5));
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
    btn.setAttribute('aria-label', topic.label + ' word scramble');
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
      '<span class="img-topic-card__badge">Scramble</span>' +
      '</div>';
    btn.addEventListener('click', () => startTopic(topic.id));
    grid.appendChild(btn);

    fetch('../../speaking/json/' + topic.id + '.json')
      .then(r => r.json())
      .then(data => {
        const total = data.phrases ? data.phrases.length : 0;
        const s = Progress.getTopicStats('scramble_' + topic.id, total);
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
      // Filter phrases with more than 2 words (trivial phrases aren't useful to scramble)
      const valid = data.phrases
        .map((p, i) => ({ phrase: p, translation: (data.traductions || [])[i] || '', idx: i }))
        .filter(pair => pair.phrase.split(' ').length > 2);

      if (valid.length === 0) {
        alert('No exercises available for this topic.');
        return;
      }

      phrases      = valid.map(p => p.phrase);
      translations = valid.map(p => p.translation);
      cardIds      = valid.map((_, seqIdx) => 'scramble_' + topicId + '_' + seqIdx);

      currentIndex = Progress.getNextIndex(cardIds, -1);

      document.getElementById('topic-picker').classList.add('hidden');
      document.getElementById('exercise-area').classList.remove('hidden');

      const streak = Progress.getStreak();
      document.getElementById('scramble-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

      showPhrase(currentIndex);
      updateCounter();
    })
    .catch(err => {
      alert('Error loading topic. Please try again.');
      console.error(err);
    });
}

// ---- Scramble Display ----

function scrambleWords(phrase) {
  const words = phrase.split(' ');
  // Create tiles with unique IDs (handle duplicate words)
  const tiles = words.map((w, i) => ({ tileId: 'tile_' + i, word: w }));

  // Fisher-Yates shuffle
  const shuffled = tiles.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // If shuffled happens to be the same as original, re-shuffle once
  if (shuffled.map(t => t.word).join(' ') === phrase) {
    const last = shuffled.pop();
    shuffled.unshift(last);
  }

  return shuffled;
}

function showPhrase(index) {
  answered  = false;
  builtSentence = [];
  shuffledTiles = scrambleWords(phrases[index]);

  document.getElementById('hint-text').textContent = translations[index] || '';
  document.getElementById('scramble-feedback').classList.add('hidden');
  document.getElementById('rating-area').classList.add('hidden');
  document.getElementById('check-btn').disabled = false;
  document.getElementById('clear-btn').disabled = false;

  renderTiles();
  const firstTile = document.querySelector('#word-bank .word-tile');
  if (firstTile) firstTile.focus();
}

// ---- Tile Rendering ----

function renderTiles() {
  const bankEl  = document.getElementById('word-bank');
  const buildEl = document.getElementById('construction-area');

  bankEl.innerHTML  = '';
  buildEl.innerHTML = '';

  // Word bank: tiles not yet placed
  const remaining = shuffledTiles.filter(t => !builtSentence.includes(t.tileId));
  remaining.forEach(tile => {
    const btn = createTileBtn(tile, false);
    btn.addEventListener('click', () => { if (!answered) addTile(tile.tileId); });
    bankEl.appendChild(btn);
  });

  // Construction area: tiles already placed
  if (builtSentence.length === 0) {
    const ph = document.createElement('span');
    ph.className = 'placeholder-text';
    ph.textContent = 'Tap words below to start…';
    buildEl.appendChild(ph);
  } else {
    builtSentence.forEach(tileId => {
      const tile = shuffledTiles.find(t => t.tileId === tileId);
      if (!tile) return;
      const btn = createTileBtn(tile, true);
      btn.addEventListener('click', () => { if (!answered) removeTile(tileId); });
      buildEl.appendChild(btn);
    });
  }
}

function createTileBtn(tile, placed) {
  const btn = document.createElement('button');
  btn.className = 'word-tile' + (placed ? ' placed' : '');
  btn.textContent = tile.word;
  btn.setAttribute('aria-label', (placed ? 'Remove: ' : 'Add: ') + tile.word);
  return btn;
}

function addTile(tileId) {
  builtSentence.push(tileId);
  renderTiles();
}

function removeTile(tileId) {
  builtSentence = builtSentence.filter(id => id !== tileId);
  renderTiles();
}

function clearSentence() {
  builtSentence = [];
  renderTiles();
}

// ---- Answer Check ----

function normalise(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
}

function checkAnswer() {
  if (answered) return;
  if (builtSentence.length === 0) return;

  answered = true;
  document.getElementById('check-btn').disabled = true;
  document.getElementById('clear-btn').disabled = true;

  // Mark placed tiles correct/incorrect by position
  const correctWords = phrases[currentIndex].split(' ');
  const builtWords   = builtSentence.map(id => shuffledTiles.find(t => t.tileId === id).word);

  const buildEl = document.getElementById('construction-area');
  buildEl.innerHTML = '';
  builtWords.forEach((w, i) => {
    const isCorrect = normalise(w) === normalise(correctWords[i] || '');
    const span = document.createElement('span');
    span.className = 'word-tile placed ' + (isCorrect ? 'tile-correct' : 'tile-incorrect');
    span.setAttribute('aria-label', w + (isCorrect ? ' — correct position' : ' — wrong position'));
    span.textContent = w;
    buildEl.appendChild(span);
  });

  const isCorrect = normalise(builtWords.join(' ')) === normalise(phrases[currentIndex]);

  const resultEl  = document.getElementById('feedback-result');
  const answerEl  = document.getElementById('feedback-answer');
  const feedback  = document.getElementById('scramble-feedback');

  if (isCorrect) {
    resultEl.textContent = '✓ Correct!';
    resultEl.className   = 'feedback-result correct';
    answerEl.textContent = '';
  } else {
    resultEl.textContent = '✗ Correct order:';
    resultEl.className   = 'feedback-result incorrect';
    answerEl.textContent = phrases[currentIndex];
  }

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
  document.getElementById('scramble-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  currentIndex = Progress.getNextIndex(cardIds, currentIndex);
  showPhrase(currentIndex);
}

// ---- Counter ----

function updateCounter() {
  const stats = Progress.getTopicStats('scramble_' + currentTopic, phrases.length);
  const el = document.getElementById('scramble-counter');
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' learned';
}
