/* ============================================================
   dictation.js — Dictation Practice with SRS
   Listen to a phrase, type what you hear, get word-level diff.
   Works in every browser — no microphone required.
   ============================================================ */

const DICT_PREFIX = 'dict_';
const LAST_KEY = 'pe_last_dictation';

let _openPhraseBrowser = null;


// ---- State ----
let phrases = [], grammarTips = [], cardIds = [], cefrLevels = [], audioIndices = [], phraseAlternatives = [], currentIndex = 0;
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

  const _urlTopic = new URLSearchParams(location.search).get('topic');
  const _pathMode = new URLSearchParams(location.search).get('path') === '1';
  const _pathCard = new URLSearchParams(location.search).get('card');

  if (_pathMode) {
    document.getElementById('back-btn').classList.add('hidden');
    if (typeof PathSession !== 'undefined') PathSession.start();
  }

  if (_urlTopic && AppTopics.PHRASE_TOPICS.some(t => t.id === _urlTopic)) {
    startTopic(_urlTopic, _pathMode, _pathCard);
  } else {
    AppTopicGrid.build({ badge: 'Dictation', srsPrefix: DICT_PREFIX, onSelect: startTopic });
  }

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

  if (_pathMode) {
    const _backLink = document.createElement('a');
    _backLink.id = 'back-to-path';
    _backLink.href = '../../my-learning/html/my-learning.html';
    _backLink.className = 'back-to-path-link hidden';
    _backLink.textContent = '← Back to path';
    _backLink.addEventListener('click', function () {
      if (_lastCorrect && typeof PathSession !== 'undefined') PathSession.advance();
    });
    document.getElementById('exercise-area').appendChild(_backLink);
  }

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

let _pathModeActive = false;
let _pathCardId     = null;

async function startTopic(topicKey, pathMode, pathCard) {
  _pathModeActive = !!pathMode;
  _pathCardId     = pathCard || null;
  localStorage.setItem(LAST_KEY, topicKey);
  currentTopic = topicKey;
  let data;
  try {
    data = await AppData.get(topicKey);
  } catch {
    _showLoadError(topicKey);
    return;
  }
  const _order = { A1: 0, A2: 1, B1: 2, B2: 3 };
  const _tagged = (data.phrases || []).map((p, i) => ({
    phrase: p.phrase, translation: p.translation || '', grammar: p.grammar || null, cefr: p.cefr || null, id: p.id, origIdx: i, alternatives: p.alternatives || [],
  })).sort((a, b) => (_order[a.cefr] ?? 99) - (_order[b.cefr] ?? 99));
  phrases            = _tagged.map(x => x.phrase);
  grammarTips        = _tagged.map(x => x.grammar);
  cefrLevels         = _tagged.map(x => x.cefr);
  cardIds            = _tagged.map(x => DICT_PREFIX + x.id);
  audioIndices       = _tagged.map(x => x.origIdx);
  phraseAlternatives = _tagged.map(x => x.alternatives);

  const topicObj = (AppTopics.PHRASE_TOPICS || []).find(t => t.id === topicKey);
  const _pbArgs = {
    items: phrases,
    cardIds,
    topicLabel: topicObj ? topicObj.label : topicKey,
    pickerEl: document.getElementById('topic-picker'),
    traductions: _tagged.map(x => x.translation),
    cefrLevels,
    onStart: idx => _beginExercise(idx),
  };
  _openPhraseBrowser = () => PhraseBrowser.show(_pbArgs);
  if (_pathModeActive) {
    _beginExercise(0);
  } else {
    _openPhraseBrowser();
  }
}

function _beginExercise(idx) {
  if (_pathModeActive && _pathCardId) {
    const cardIdx = cardIds.indexOf(_pathCardId);
    if (cardIdx !== -1) idx = cardIdx;
  }
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
  document.getElementById('back-to-path')?.classList.add('hidden');
  const wrap = document.getElementById('grammar-chip-wrap');
  if (wrap) wrap.classList.add('hidden');
  _showCefrBadge(cefrLevels[index], 'audio-controls');
}

function _showCefrBadge(level, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let badge = container.querySelector('.cefr-phrase-badge');
  if (!badge) {
    badge = document.createElement('span');
    container.style.position = 'relative';
    container.appendChild(badge);
  }
  if (!level) { badge.className = 'cefr-phrase-badge'; badge.textContent = ''; return; }
  badge.className = 'cefr-phrase-badge cefr-badge cefr-badge--' + level.toLowerCase();
  badge.textContent = level;
  badge.setAttribute('aria-label', 'CEFR level ' + level);
}

function updateCounter() {
  const el = document.getElementById('dict-counter');
  if (!el || phrases.length === 0) return;
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const prog = PathSession.getProgress();
    el.textContent = 'Exercise ' + prog.current + ' of ' + prog.total;
    const pct = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;
    const fill = document.getElementById('session-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const bar = document.getElementById('session-progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', pct);
    return;
  }
  const stats = Progress.getStatsForCards(cardIds);
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
  AppAudio.play(currentTopic, audioIndices[currentIndex] ?? currentIndex, phrase, 1).then(() => {
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

  const _norm = s => AppText.normalise(s, contractionMap);
  const isCorrect = _norm(input) === _norm(original)
    || (phraseAlternatives[currentIndex] || []).some(alt => _norm(input) === _norm(alt));
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(cefrLevels[currentIndex], isCorrect, 'dictation');
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
      : AppFeedback.buildDiff(input, AppText.closestPhrase(input, [original, ...(phraseAlternatives[currentIndex] || [])], contractionMap), contractionMap)
  );
  feedback.className = 'dict-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  feedback.classList.remove('hidden');

  if (isCorrect) updateGrammarChip(currentIndex);

  // Re-enable audio after checking so learner can hear the correct phrase
  document.getElementById('play-btn').disabled = false;

  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', _lastCorrect);
  document.getElementById('back-to-path').classList.remove('hidden');
  document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus();

}

// ---- Word-level diff — delegated to AppFeedback (shared/js/feedback.js) ----


// ---- Rating & Navigation ----

function rateAndNext(quality) {
  // Progress already saved in checkAnswer — just advance
  nextPhrase();
}

function nextPhrase() {
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const nextHref = PathSession.advance();
    if (nextHref) {
      window.location.href = '../../' + nextHref;
    } else {
      _showPathSessionComplete();
    }
    return;
  }
  currentIndex = (currentIndex + 1) % phrases.length;
  loadPhrase(currentIndex);
  updateCounter();

  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.focus();

  const streak = Progress.getStreak();
  const el = document.getElementById('dict-streak');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
}

function _showPathSessionComplete() {
  AppAudio.cancel();
  const prog = typeof PathSession !== 'undefined' ? PathSession.getProgress() : null;
  const reviewCount = prog ? Math.max(0, prog.total - (prog.newCount || 0)) : 0;
  const newCount    = prog ? (prog.newCount || 0) : 0;
  document.body.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;font-family:inherit;">' +
      '<div style="font-size:3rem;margin-bottom:1rem;">🎉</div>' +
      '<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">Session complete!</h1>' +
      '<p style="color:var(--clr-text-muted,#6b7280);margin-bottom:2rem;">' +
        (reviewCount > 0 ? reviewCount + ' review' + (reviewCount > 1 ? 's' : '') : '') +
        (reviewCount > 0 && newCount > 0 ? ' and ' : '') +
        (newCount > 0 ? newCount + ' new card' + (newCount > 1 ? 's' : '') : '') +
        ' done today.' +
      '</p>' +
      '<a href="../../my-learning/html/my-learning.html" style="background:var(--clr-primary,#4f46e5);color:#fff;padding:0.75rem 2rem;border-radius:999px;text-decoration:none;font-weight:600;">My Learning →</a>' +
    '</div>';
}

// ---- Utilities ----

