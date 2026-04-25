/* ============================================================
   scramble.js — Word Order Reconstruction with SRS
   Research basis: CALP Syntactic Reconstruction (Cummins 2000)
   ============================================================ */


const LAST_KEY = 'pe_last_scramble';
let _openPhraseBrowser = null;


let currentTopic = '';
let phrases = [], translations = [], cardIds = [];
let currentIndex = 0;
let shuffledTiles = [];   // [{ tileId, word }]
let builtSentence = [];   // array of tileIds in order
let answered = false;
let _lastCorrect = false;
let contractionMap = {};

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  AppData.get('word-equivalents')
    .then(data => {
      const { flatMap } = AppText.buildEquivalenceMaps(data.groups || []);
      contractionMap = flatMap;
    })
    .catch(() => {}); // non-critical — comparison still works without it

  AppTopicGrid.build({ badge: 'Scramble', ariaLabelSuffix: 'word scramble', srsPrefix: 'scramble_', onSelect: startTopic });

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('exercise-area').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });
  document.getElementById('clear-btn').addEventListener('click', clearSentence);
  document.getElementById('check-btn').addEventListener('click', checkAnswer);

  // Delegated tile listeners — set up once, survive every renderTiles() call
  document.getElementById('word-bank').addEventListener('click', e => {
    const btn = e.target.closest('.word-tile');
    if (btn && !answered) addTile(btn.dataset.tileId);
  });
  document.getElementById('construction-area').addEventListener('click', e => {
    const btn = e.target.closest('.word-tile');
    if (btn && !answered) removeTile(btn.dataset.tileId);
  });

  document.getElementById('next-btn').addEventListener('click', () => rateAndNext(3));
  document.getElementById('try-again-btn').addEventListener('click', () => {
    showPhrase(currentIndex);
  });

});


function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('exercise-area').classList.add('hidden');
  AppTopicGrid.build({ badge: 'Scramble', srsPrefix: 'scramble_', onSelect: startTopic });
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

// ---- Load Topic ----

function startTopic(topicId) {
  localStorage.setItem(LAST_KEY, topicId);
  currentTopic = topicId;
  AppData.get(topicId)
    .then(data => {
      const valid = data.phrases
        .map((p, i) => ({ phrase: p, translation: (data.traductions || [])[i] || '', idx: i }))
        .filter(pair => pair.phrase.split(' ').length > 2);

      if (valid.length === 0) {
        alert('No exercises available for this topic.');
        return;
      }

      phrases      = valid.map(p => p.phrase);
      translations = valid.map(p => p.translation);
      cardIds      = valid.map(p => 'scramble_' + topicId + '_' + p.idx);

      const topicObj = (AppTopics.PHRASE_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: phrases,
        cardIds,
        topicLabel: topicObj ? topicObj.label : topicId,
        pickerEl: document.getElementById('topic-picker'),
        traductions: data.traductions || null,
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
  document.getElementById('exercise-area').classList.remove('hidden');
  const streak = Progress.getStreak();
  document.getElementById('scramble-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  showPhrase(currentIndex);
  updateCounter();
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
  document.getElementById('scramble-diff').textContent = '';
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('try-again-btn').classList.add('hidden');
  document.getElementById('construction-area').classList.remove('construction-area--answered');
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
  remaining.forEach(tile => bankEl.appendChild(createTileBtn(tile, false)));

  // Construction area: tiles already placed
  if (builtSentence.length === 0) {
    const ph = document.createElement('span');
    ph.className = 'placeholder-text';
    ph.textContent = 'Tap words below to start…';
    buildEl.appendChild(ph);
  } else {
    builtSentence.forEach(tileId => {
      const tile = shuffledTiles.find(t => t.tileId === tileId);
      if (tile) buildEl.appendChild(createTileBtn(tile, true));
    });
  }
}

function createTileBtn(tile, placed) {
  const btn = document.createElement('button');
  btn.className = 'word-tile' + (placed ? ' placed' : '');
  btn.textContent = tile.word;
  btn.dataset.tileId = tile.tileId;
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


function checkAnswer() {
  if (answered) return;
  if (builtSentence.length === 0) return;

  answered = true;
  document.getElementById('check-btn').disabled = true;
  document.getElementById('clear-btn').disabled = true;

  // Mark placed tiles correct/incorrect by position
  const correctWords = phrases[currentIndex].split(' ');
  const builtWords   = builtSentence.map(id => { const t = shuffledTiles.find(x => x.tileId === id); return t ? t.word : ''; });

  const buildEl = document.getElementById('construction-area');
  buildEl.innerHTML = '';
  buildEl.classList.add('construction-area--answered');
  builtWords.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'word-tile placed';
    btn.textContent = w;
    btn.disabled = true;
    buildEl.appendChild(btn);
  });

  const isCorrect = AppText.normalise(builtWords.join(' '), contractionMap) === AppText.normalise(phrases[currentIndex], contractionMap);
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);
  Progress.recordSession('scramble_' + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const resultEl = document.getElementById('feedback-result');
  const diffEl   = document.getElementById('scramble-diff');
  const feedback = document.getElementById('scramble-feedback');

  resultEl.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(
    isCorrect
      ? AppFeedback.buildCorrect(phrases[currentIndex])
      : AppFeedback.buildDiff(builtWords.join(' '), phrases[currentIndex], contractionMap)
  );

  feedback.className = 'scramble-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', _lastCorrect);
  document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus();
}

// ---- Rating & Advance ----

// Compute seen/total directly from cardIds so non-sequential original indices
// (p.idx anchoring) are counted correctly. Progress.getTopicStats() assumes
// sequential indices 0…total-1 which breaks when short phrases are filtered out.
function _getCardStats() {
  const cards = Progress.getAllCards();
  const seen  = cardIds.filter(id => { const c = cards[id]; return c && c.reps > 0; }).length;
  return { seen, total: cardIds.length };
}

function rateAndNext(quality) {
  // Progress already saved in checkAnswer — just advance
  updateCounter();

  const streak = Progress.getStreak();
  document.getElementById('scramble-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  currentIndex = (currentIndex + 1) % phrases.length;
  showPhrase(currentIndex);
}

// ---- Counter ----

function updateCounter() {
  const stats = _getCardStats();
  const el = document.getElementById('scramble-counter');
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' learned';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}
