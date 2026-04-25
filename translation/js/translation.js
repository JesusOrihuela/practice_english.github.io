/* ============================================================
   translation.js — Reverse Translation (Spanish → English) with SRS
   Research basis: Desirable Difficulty (Bjork 1994), Cook (2010)
   ============================================================ */



const LAST_KEY = 'pe_last_translation';
let _openPhraseBrowser = null;


let currentTopic = '';
let phrases = [], translations = [], grammarNotes = [], cardIds = [];
let currentIndex = 0;
let answered = false;
let _lastCorrect = false;
let contractionMap = {};

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  // Build lang badge with shared flag module
  const badge = document.getElementById('lang-badge');
  if (badge && typeof AppFlags !== 'undefined') {
    badge.appendChild(AppFlags.stack('es', 'mx'));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    badge.appendChild(arrow);
    badge.appendChild(AppFlags.stack('us', 'gb'));
  }

  AppData.get('word-equivalents')
    .then(data => {
      const { flatMap } = AppText.buildEquivalenceMaps(data.groups || []);
      contractionMap = flatMap;
    })
    .catch(() => {}); // non-critical — comparison still works without it

  AppTopicGrid.build({ badge: 'Translate', ariaLabelSuffix: 'translation', srsPrefix: 'trans_', onSelect: startTopic });

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('exercise-area').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });

  document.getElementById('check-btn').addEventListener('click', checkAnswer);
  document.getElementById('trans-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkAnswer();
  });

  document.getElementById('listen-btn').addEventListener('click', () => {
    const phrase = phrases[currentIndex];
    if (phrase) playTTS(phrase);
  });

  document.getElementById('next-btn').addEventListener('click', () => rateAndNext(3));
  document.getElementById('try-again-btn').addEventListener('click', () => {
    answered = false;
    showPhrase(currentIndex);
  });

  AppAudio.setBase('../../shared/audio/');
  AppAudio.warmup();
});


function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('exercise-area').classList.add('hidden');
  AppTopicGrid.build({ badge: 'Translate', srsPrefix: 'trans_', onSelect: startTopic });
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
      const validPairs = data.phrases
        .map((p, i) => ({ phrase: p, translation: (data.traductions || [])[i] || '', idx: i }))
        .filter(pair => pair.translation.trim().length > 0);

      phrases      = validPairs.map(p => p.phrase);
      translations = validPairs.map(p => p.translation);
      grammarNotes = validPairs.map(p => (data.grammar || [])[p.idx] || null);
      cardIds      = validPairs.map(p => 'trans_' + topicId + '_' + p.idx);

      if (phrases.length === 0) {
        alert('No translations available for this topic.');
        return;
      }

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
  document.getElementById('trans-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  showPhrase(currentIndex);
  updateCounter();
}

// ---- Display ----

function showPhrase(index) {
  answered = false;

  document.getElementById('spanish-phrase').textContent = translations[index] || '—';
  document.getElementById('trans-input').value           = '';
  document.getElementById('trans-input').disabled        = false;
  document.getElementById('check-btn').disabled          = false;
  document.getElementById('trans-feedback').className = 'trans-feedback hidden';
  document.getElementById('trans-diff').textContent   = '';
  document.getElementById('feedback-divider').classList.add('hidden');
  document.getElementById('feedback-grammar-tip').classList.add('hidden');
  const _tipText = document.getElementById('feedback-grammar-tip-text');
  if (_tipText) _tipText.textContent = '';
  document.getElementById('grammar-chip-wrap').classList.add('hidden');
  document.getElementById('listen-btn').classList.add('hidden');
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('try-again-btn').classList.add('hidden');
  document.getElementById('phrase-card').className = 'phrase-card';

  document.getElementById('trans-input')?.focus();
}

// ---- Answer Check ----

function checkAnswer() {
  if (answered) return;
  const input = document.getElementById('trans-input');
  const raw   = input.value.trim();
  if (!raw) return;

  answered = true;
  input.disabled = true;
  document.getElementById('check-btn').disabled = true;

  const expected  = phrases[currentIndex];
  const isCorrect = AppText.normalise(raw, contractionMap) === AppText.normalise(expected, contractionMap);
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);
  Progress.recordSession('trans_' + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const resultEl = document.getElementById('feedback-result');
  const diffEl   = document.getElementById('trans-diff');
  const feedback = document.getElementById('trans-feedback');
  const card     = document.getElementById('phrase-card');

  resultEl.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  card.classList.add(isCorrect ? 'phrase-card--correct' : 'phrase-card--incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(
    isCorrect
      ? AppFeedback.buildCorrect(expected)
      : AppFeedback.buildDiff(raw, expected, contractionMap)
  );

  feedback.className = 'trans-feedback ' + (isCorrect ? 'correct' : 'incorrect');

  // Grammar tip (correct only) — shown below a divider
  const chipWrap  = document.getElementById('grammar-chip-wrap');
  const tipEl     = document.getElementById('feedback-grammar-tip');
  const dividerEl = document.getElementById('feedback-divider');
  const tip = isCorrect ? grammarNotes[currentIndex] : null;
  if (tip) {
    const { label, ruleId } = extractGrammarInfo(tip);
    if (ruleId && chipWrap) {
      document.getElementById('grammar-chip-label').textContent = label;
      document.getElementById('grammar-chip').href = '../../grammar/html/grammar.html?rule=' + ruleId;
      chipWrap.classList.remove('hidden');
    } else if (chipWrap) {
      chipWrap.classList.add('hidden');
    }
    const tipTextEl = document.getElementById('feedback-grammar-tip-text');
    if (tipTextEl) tipTextEl.textContent = tip;
    if (tipEl)     tipEl.classList.remove('hidden');
    if (dividerEl) dividerEl.classList.remove('hidden');
  } else {
    if (chipWrap)  chipWrap.classList.add('hidden');
    if (tipEl)     tipEl.classList.add('hidden');
    if (dividerEl) dividerEl.classList.add('hidden');
  }

  document.getElementById('listen-btn').classList.remove('hidden');
  feedback.classList.remove('hidden');
  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', _lastCorrect);
  document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus();
}

// ---- Rating & Advance ----

// Compute seen/total directly from cardIds so non-sequential original indices
// (p.idx anchoring) are counted correctly. Progress.getTopicStats() assumes
// sequential indices 0…total-1 which breaks when some phrases lack translations.
function _getCardStats() {
  const cards = Progress.getAllCards();
  const seen  = cardIds.filter(id => { const c = cards[id]; return c && c.reps > 0; }).length;
  return { seen, total: cardIds.length };
}

function rateAndNext(quality) {
  // Progress already saved in checkAnswer — just advance
  updateCounter();

  const streak = Progress.getStreak();
  document.getElementById('trans-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  currentIndex = (currentIndex + 1) % phrases.length;
  showPhrase(currentIndex);
}

// ---- Counter ----

function updateCounter() {
  const stats = _getCardStats();
  const el = document.getElementById('trans-counter');
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' learned';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}

// ---- TTS (Kokoro via AppTTS) ----

function playTTS(text) {
  if (!text) return;
  AppAudio.play(currentTopic, currentIndex, text);
}

// extractGrammarInfo is in shared/js/grammar-chip.js
