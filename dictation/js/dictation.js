/* ============================================================
   dictation.js — Dictation Practice with SRS
   Listen to a phrase, type what you hear, get word-level diff.
   Works in every browser — no microphone required.
   ============================================================ */

const DICT_PREFIX = 'dict_';
const LAST_KEY = 'pe_last_dictation';

let _openPhraseBrowser = null;


// ---- State ----
let phrases = [], grammarTips = [], cardIds = [], currentIndex = 0;
let currentTopic = '';
let _lastCorrect = false;
let hasChecked = false;
let contractionMap = {};

document.addEventListener('DOMContentLoaded', () => {
  AppData.get('word-equivalents')
    .then(data => {
      const { flatMap } = AppText.buildEquivalenceMaps(data.groups || []);
      contractionMap = flatMap;
    })
    .catch(() => {});

  // Show streak
  const streak = Progress.getStreak();
  const streakEl = document.getElementById('dict-streak');
  if (streakEl) streakEl.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  AppTopicGrid.build({ badge: 'Dictation', srsPrefix: DICT_PREFIX, onSelect: startTopic });

  document.getElementById('play-btn').addEventListener('click', playAudio);
  document.getElementById('check-btn').addEventListener('click', checkAnswer);
  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('exercise-area').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });
  const input = document.getElementById('dict-input');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });

  document.getElementById('next-btn').addEventListener('click', () => rateAndNext(3));
  document.getElementById('try-again-btn').addEventListener('click', () => loadPhrase(currentIndex));


  AppAudio.setBase('../../shared/audio/');
  AppAudio.warmup();
});

function _showLoadError(topicKey) {
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
  btn.addEventListener('click', () => { banner.remove(); startTopic(topicKey); });

  banner.appendChild(txt);
  banner.appendChild(btn);
  const picker = document.getElementById('topic-picker');
  if (picker) picker.insertBefore(banner, picker.firstChild);
}

async function startTopic(topicKey) {
  localStorage.setItem(LAST_KEY, topicKey);
  currentTopic = topicKey;
  let data;
  try {
    data = await AppData.get(topicKey);
  } catch {
    _showLoadError(topicKey);
    return;
  }
  phrases     = data.phrases || [];
  grammarTips = data.grammar || [];
  cardIds     = phrases.map((_, i) => DICT_PREFIX + topicKey + '_' + i);

  const topicObj = (AppTopics.PHRASE_TOPICS || []).find(t => t.id === topicKey);
  const _pbArgs = {
    items: phrases,
    cardIds,
    topicLabel: topicObj ? topicObj.label : topicKey,
    pickerEl: document.getElementById('topic-picker'),
    traductions: data.traductions || null,
    onStart: idx => _beginExercise(idx),
  };
  _openPhraseBrowser = () => PhraseBrowser.show(_pbArgs);
  _openPhraseBrowser();
}

function _beginExercise(idx) {
  currentIndex = idx;
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('exercise-area').classList.remove('hidden');
  const streak = Progress.getStreak();
  const streakEl = document.getElementById('dict-streak');
  if (streakEl) streakEl.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  loadPhrase(currentIndex);
  updateCounter();
}

// ---- Phrase Management ----

function loadPhrase(index) {
  hasChecked = false;

  document.getElementById('play-btn').disabled   = false;
  document.getElementById('dict-input').value    = '';
  document.getElementById('dict-input').disabled = false;
  document.getElementById('check-btn').disabled  = false;

  document.getElementById('dict-feedback').className = 'dict-feedback hidden';
  document.getElementById('feedback-result').textContent = '';
  document.getElementById('dict-diff').textContent = '';
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('try-again-btn').classList.add('hidden');
  const wrap = document.getElementById('grammar-chip-wrap');
  if (wrap) wrap.classList.add('hidden');
}

function updateCounter() {
  const el = document.getElementById('dict-counter');
  if (!el || phrases.length === 0) return;
  const stats = Progress.getTopicStats(DICT_PREFIX + currentTopic, phrases.length);
  el.textContent = stats.seen + ' / ' + stats.total + ' learned';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}

function showTopicPicker() {
  document.getElementById('exercise-area').classList.add('hidden');
  document.getElementById('topic-picker').classList.remove('hidden');
  AppTopicGrid.build({ badge: 'Dictation', srsPrefix: DICT_PREFIX, onSelect: startTopic });
}

// ---- TTS (Kokoro via AppTTS) ----

function playAudio() {
  const phrase = phrases[currentIndex];
  if (!phrase) return;

  const playBtn = document.getElementById('play-btn');

  playBtn.disabled = true;
  AppAudio.play(currentTopic, currentIndex, phrase, 1).then(() => {
    playBtn.disabled = false;
    document.getElementById('dict-input')?.focus();
  }).catch(() => {
    playBtn.disabled = false;
  });
}

// ---- Grammar Chip ----

function updateGrammarChip(index) {
  const wrap = document.getElementById('grammar-chip-wrap');
  if (!wrap) return;
  const tip = grammarTips[index] || null;
  if (!tip) { wrap.classList.add('hidden'); return; }
  const { label, ruleId } = extractGrammarInfo(tip);
  if (!ruleId) { wrap.classList.add('hidden'); return; }
  document.getElementById('grammar-chip-label').textContent = label;
  document.getElementById('grammar-chip').href = '../../grammar/html/grammar.html?rule=' + ruleId;
  wrap.classList.remove('hidden');
}

// ---- Check Answer ----

function checkAnswer() {
  const input    = document.getElementById('dict-input').value.trim();
  const original = phrases[currentIndex] || '';

  if (!input) return;

  hasChecked = true;
  document.getElementById('dict-input').disabled = true;
  document.getElementById('check-btn').disabled  = true;

  const isCorrect = AppText.normalise(input, contractionMap) === AppText.normalise(original, contractionMap);
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);
  Progress.recordSession(DICT_PREFIX + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();
  const feedback = document.getElementById('dict-feedback');
  const resultEl = document.getElementById('feedback-result');
  const diffEl   = document.getElementById('dict-diff');

  resultEl.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  diffEl.textContent   = '';
  diffEl.appendChild(
    isCorrect
      ? AppFeedback.buildCorrect(original)
      : AppFeedback.buildDiff(input, original, contractionMap)
  );
  feedback.className = 'dict-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  feedback.classList.remove('hidden');

  if (isCorrect) updateGrammarChip(currentIndex);

  // Re-enable audio after checking so learner can hear the correct phrase
  document.getElementById('play-btn').disabled = false;

  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', _lastCorrect);
  document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus();
}

// ---- Word-level diff — delegated to AppFeedback (shared/js/feedback.js) ----


// ---- Rating & Navigation ----

function rateAndNext(quality) {
  // Progress already saved in checkAnswer — just advance
  nextPhrase();
}

function nextPhrase() {
  currentIndex = (currentIndex + 1) % phrases.length;
  loadPhrase(currentIndex);
  updateCounter();

  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.focus();

  const streak = Progress.getStreak();
  const el = document.getElementById('dict-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
}

// ---- Utilities ----

