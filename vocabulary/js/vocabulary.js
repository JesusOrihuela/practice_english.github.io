/* ============================================================
   vocabulary.js — Flashcard Vocabulary Trainer with SRS
   ============================================================ */

const LAST_KEY = 'pe_last_vocabulary';

let _openPhraseBrowser = null;


let currentTopicId  = '';
let vocabTopicKey   = '';  // SRS prefix
let words           = [];
let cardIds         = [];
let currentIndex    = 0;
let isFlipped       = false;

// ---- Init ----

function _vocabGridOpts() {
  return {
    badge: 'Flashcard',
    topics: AppTopics.VOCAB_TOPICS,
    getSrsKey: t => t.id === 'general' ? 'vocab' : 'vocab_' + t.id,
    getItemCount: t => {
      const path = t.id === 'general' ? '../../shared/json/words.json' : '../../shared/json/words-' + t.id + '.json';
      return fetch(path).then(r => r.json()).then(d => d.words ? d.words.length : 0);
    },
    onSelect: startTopic,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  AppTopicGrid.build(_vocabGridOpts());

  function _playCurrentWord(e) {
    e.stopPropagation(); // prevent card flip
    const word = words[currentIndex];
    if (word) AppAudio.play(currentTopicId === 'general' ? 'vocab' : 'vocab_' + currentTopicId, currentIndex, word.word);
  }
  document.getElementById('listen-btn').addEventListener('click', _playCurrentWord);
  document.getElementById('listen-btn-back').addEventListener('click', _playCurrentWord);

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('vocab-content').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });

  document.getElementById('flashcard-scene').addEventListener('click', () => {
    if (!isFlipped) flipCard();
  });

  document.getElementById('flashcard-scene').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !isFlipped) {
      e.preventDefault();
      flipCard();
    }
  });

  document.getElementById('next-btn').addEventListener('click', () => rateAndNext(3));

  AppAudio.setBase('../../shared/audio/');
  AppAudio.warmup();
});

// ---- Topic Picker ----

function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('vocab-content').classList.add('hidden');
  AppTopicGrid.build(_vocabGridOpts());
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
  vocabTopicKey  = topicId === 'general' ? 'vocab' : 'vocab_' + topicId;
  const jsonPath = topicId === 'general'
    ? '../../shared/json/words.json'
    : '../../shared/json/words-' + topicId + '.json';

  fetch(jsonPath)
    .then(r => r.json())
    .then(data => {
      words   = data.words;
      cardIds = words.map((_, i) => vocabTopicKey + '_' + i);

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
  document.getElementById('vocab-content').classList.remove('hidden');
  const streak = Progress.getStreak();
  const el = document.getElementById('vocab-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  showCard(currentIndex);
  updateStatsBar();
}

// ---- Card Display ----

function showCard(index) {
  const word = words[index];
  if (!word) return;
  isFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');

  // Front
  document.getElementById('word-category').textContent  = word.category || '';
  document.getElementById('word-text').textContent = word.word;

  // Back
  document.getElementById('fc-back-word').textContent    = word.word;
  document.getElementById('word-definition').textContent = word.definition;
  document.getElementById('word-example').textContent    = word.example;
  document.getElementById('word-translation').textContent = word.translation;

  document.getElementById('next-btn').classList.add('hidden');
}

function flipCard() {
  isFlipped = true;
  document.getElementById('flashcard').classList.add('flipped');
  setTimeout(() => {
    document.getElementById('next-btn').classList.remove('hidden');
  }, 350);
}

function rateAndNext(quality) {
  Progress.rate(cardIds[currentIndex], quality);
  Progress.recordSession(vocabTopicKey, quality >= 3 ? 1 : 0, 1);

  updateStatsBar();

  currentIndex = (currentIndex + 1) % words.length;
  showCard(currentIndex);

  const scene = document.getElementById('flashcard-scene');
  if (scene) scene.focus();

  const streak = Progress.getStreak();
  const el = document.getElementById('vocab-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
}

// ---- Utilities ----

function updateStatsBar() {
  const stats = Progress.getTopicStats(vocabTopicKey, words.length);
  const el    = document.getElementById('cards-remaining');
  if (!el) return;
  el.textContent = stats.seen + ' / ' + stats.total + ' learned';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}
