/* ============================================================
   dictation.js — Dictation Practice with SRS
   Listen to a phrase, type what you hear, get word-level diff.
   Works in every browser — no microphone required.
   ============================================================ */

const DICT_PREFIX = 'dict_';


const TOPICS = [
  { key: 'greetings',     label: 'Greetings',     emoji: '👋' },
  { key: 'traveling',     label: 'Traveling',     emoji: '✈️' },
  { key: 'technology',    label: 'Technology',    emoji: '💻' },
  { key: 'restaurant',    label: 'Restaurant',    emoji: '🍽️' },
  { key: 'kitchen',       label: 'Kitchen',       emoji: '🍳' },
  { key: 'supermarket',   label: 'Supermarket',   emoji: '🛒' },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { key: 'accountability',label: 'Accountability',emoji: '🎯' },
  { key: 'gym',           label: 'Gym',           emoji: '💪' },
];

// ---- State ----
let phrases = [], cardIds = [], currentIndex = 0;
let currentTopic = '';
let hasPlayed = false;
let hasChecked = false;

document.addEventListener('DOMContentLoaded', () => {
  // Show streak
  const streak = Progress.getStreak();
  const streakEl = document.getElementById('dict-streak');
  if (streakEl) streakEl.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  buildTopicGrid();

  document.getElementById('play-btn').addEventListener('click', playAudio);
  document.getElementById('replay-btn').addEventListener('click', playAudio);
  document.getElementById('check-btn').addEventListener('click', checkAnswer);
  document.getElementById('reveal-btn').addEventListener('click', revealAnswer);
  document.getElementById('back-btn').addEventListener('click', showTopicPicker);
  document.getElementById('skip-btn').addEventListener('click', () => {
    if (!hasChecked) Progress.rate(cardIds[currentIndex], 1);
    nextPhrase();
  });

  const input = document.getElementById('dict-input');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });

  document.getElementById('rate-hard').addEventListener('click', () => rateAndNext(1));
  document.getElementById('rate-ok').addEventListener('click',   () => rateAndNext(3));
  document.getElementById('rate-easy').addEventListener('click', () => rateAndNext(5));

  AppAudio.setBase('../../speaking/audio/');
  AppAudio.warmup();
});

// ---- Topic Grid ----

function buildTopicGrid() {
  const grid = document.getElementById('topic-grid');
  if (!grid) return;
  grid.className = 'img-topic-grid';

  TOPICS.forEach((topic, i) => {
    const btn = document.createElement('button');
    btn.className = 'img-topic-card';
    btn.dataset.theme = topic.key;
    btn.style.animationDelay = (i * 0.06) + 's';
    btn.setAttribute('aria-label', topic.label + ' dictation');
    const imgSrc = '../img/' + topic.key + '.jpg';
    btn.innerHTML =
      '<div class="img-topic-card__img-wrap">' +
      '<img class="img-topic-card__img" src="' + imgSrc + '" alt="" loading="lazy">' +
      '<div class="img-topic-card__overlay"></div>' +
      '</div>' +
      '<div class="img-topic-card__body">' +
      '<div class="img-topic-card__info">' +
      '<span class="img-topic-card__title">' + topic.label + '</span>' +
      '<span class="img-topic-card__progress" id="tp-' + topic.key + '"></span>' +
      '</div>' +
      '<span class="img-topic-card__badge">Dictation</span>' +
      '</div>';
    btn.addEventListener('click', () => startTopic(topic.key));
    grid.appendChild(btn);

    fetch('../../speaking/json/' + topic.key + '.json')
      .then(r => r.json())
      .then(data => {
        const total = data.phrases ? data.phrases.length : 0;
        const s = Progress.getTopicStats(DICT_PREFIX + topic.key, total);
        const el = document.getElementById('tp-' + topic.key);
        if (el) el.textContent = s.seen + ' / ' + total + ' learned';
      })
      .catch(() => {});
  });
}

async function startTopic(topicKey) {
  currentTopic = topicKey;
  try {
    const r    = await fetch('../../speaking/json/' + topicKey + '.json');
    const data = await r.json();
    phrases  = data.phrases || [];
    cardIds  = phrases.map((_, i) => DICT_PREFIX + topicKey + '_' + i);
    currentIndex = Progress.getNextIndex(cardIds, -1);
  } catch (e) {
    alert('Could not load phrases for this topic. Please try again.');
    return;
  }

  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('exercise-area').classList.remove('hidden');
  loadPhrase(currentIndex);
  updateCounter();
}

// ---- Phrase Management ----

function loadPhrase(index) {
  hasPlayed  = false;
  hasChecked = false;

  document.getElementById('play-btn').disabled   = false;
  document.getElementById('replay-btn').disabled = true;
  document.getElementById('dict-input').value    = '';
  document.getElementById('dict-input').disabled = false;
  document.getElementById('check-btn').disabled  = false;
  document.getElementById('skip-btn').disabled   = false;

  document.getElementById('dict-feedback').classList.add('hidden');
  document.getElementById('dict-feedback').className = 'dict-feedback hidden';
  document.getElementById('reveal-btn').classList.add('hidden');
  document.getElementById('rating-area').classList.add('hidden');

  // Auto-play after 600ms so user is ready
  setTimeout(playAudio, 600);
}

function updateCounter() {
  const el = document.getElementById('dict-counter');
  if (!el || phrases.length === 0) return;
  const stats = Progress.getTopicStats(DICT_PREFIX + currentTopic, phrases.length);
  el.textContent = stats.seen + ' / ' + stats.total + ' learned';
}

function showTopicPicker() {
  document.getElementById('exercise-area').classList.add('hidden');
  document.getElementById('topic-picker').classList.remove('hidden');
  buildTopicGrid(); // refresh progress numbers
}

// ---- TTS (Kokoro via AppTTS) ----

function playAudio() {
  const phrase = phrases[currentIndex];
  if (!phrase) return;

  const playBtn   = document.getElementById('play-btn');
  const replayBtn = document.getElementById('replay-btn');

  playBtn.disabled   = true;
  replayBtn.disabled = true;
  hasPlayed = true;

  // 0.9 playback rate = ~0.855 effective speed — clear for dictation without sounding unnatural
  AppAudio.play(currentTopic, currentIndex, phrase, 0.9).then(() => {
    playBtn.disabled   = false;
    replayBtn.disabled = false;
    document.getElementById('dict-input').focus();
  }).catch(() => {
    playBtn.disabled   = false;
    replayBtn.disabled = false;
  });
}

// ---- Check Answer ----

function checkAnswer() {
  const input    = document.getElementById('dict-input').value.trim();
  const original = phrases[currentIndex] || '';

  if (!input) return;

  hasChecked = true;
  document.getElementById('dict-input').disabled = true;
  document.getElementById('check-btn').disabled  = true;

  const isCorrect = normalise(input) === normalise(original);
  const diffHtml  = buildDiff(input, original);
  const feedback  = document.getElementById('dict-feedback');

  feedback.innerHTML   = diffHtml;
  feedback.className   = 'dict-feedback ' + (isCorrect ? 'correct' : 'incorrect');

  if (!isCorrect) {
    document.getElementById('reveal-btn').classList.remove('hidden');
  }

  Progress.recordSession(DICT_PREFIX + currentTopic, isCorrect ? 1 : 0, 1);

  // Show rating area
  document.getElementById('rating-area').classList.remove('hidden');
}

// ---- Word-level diff ----

function buildDiff(typed, original) {
  const typedWords    = typed.trim().split(/\s+/);
  const originalWords = original.trim().split(/\s+/);
  let html = '';

  const maxLen = Math.max(typedWords.length, originalWords.length);
  for (let i = 0; i < maxLen; i++) {
    const tw = typedWords[i]   ? typedWords[i].replace(/[^a-z0-9']/gi,'').toLowerCase() : null;
    const ow = originalWords[i]? originalWords[i].replace(/[^a-z0-9']/gi,'').toLowerCase() : null;

    if (tw === null) {
      // Missing word
      html += '<span class="word-missing">[' + originalWords[i] + '] </span>';
    } else if (tw === ow) {
      html += '<span class="word-ok">' + typedWords[i] + ' </span>';
    } else {
      html += '<span class="word-wrong">' + typedWords[i] + ' </span>';
    }
  }
  return html;
}

function revealAnswer() {
  const original = phrases[currentIndex] || '';
  const feedback = document.getElementById('dict-feedback');
  // Show correct answer below the diff
  feedback.innerHTML += '<br><br><strong style="color:var(--clr-success)">✓ ' + original + '</strong>';
  document.getElementById('reveal-btn').classList.add('hidden');
}

// ---- Rating & Navigation ----

function rateAndNext(quality) {
  Progress.rate(cardIds[currentIndex], quality);
  nextPhrase();
}

function nextPhrase() {
  currentIndex = Progress.getNextIndex(cardIds, currentIndex);
  loadPhrase(currentIndex);
  updateCounter();

  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.focus();

  const streak = Progress.getStreak();
  const el = document.getElementById('dict-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
}

// ---- Utilities ----

function normalise(s) {
  return s.toLowerCase()
    .replace(/[.,\/#!$%^&*;:{}=\-_~()?!]/g, '')
    .replace(/\s+/g, ' ').trim();
}
