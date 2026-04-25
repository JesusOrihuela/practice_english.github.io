/* ============================================================
   cloze.js — Fill-in-the-Blank Exercise with SRS
   Research basis: Generation Effect (Slamecka & Graf 1978)
   ============================================================ */




const LAST_KEY = 'pe_last_cloze';
let _openPhraseBrowser = null;

// ---- Answer equivalence ----
let _groupMap = null; // Map<word, Set<all_equivalent_forms>> — built from word-equivalents.json

function _equivalentMatch(guess, answer) {
  if (!_groupMap) return false;
  const gSet = _groupMap.get(guess);
  const aSet = _groupMap.get(answer);
  if (gSet && gSet.has(answer)) return true;
  if (aSet && aSet.has(guess))  return true;
  return false;
}


let currentTopic = '';
let phrases = [], translations = [], grammarNotes = [], cardIds = [];
let currentIndex = 0;
let currentBlank = null;  // { blank, blankClean, blankedPhrase, fullPhrase }
let answered = false;
let _lastCorrect = false;

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  AppTopicGrid.build({ badge: 'Fill-in', ariaLabelSuffix: 'fill-in-the-blank', srsPrefix: 'cloze_', onSelect: startTopic });

  AppData.get('word-equivalents')
    .then(data => {
      const { groupMap } = AppText.buildEquivalenceMaps(data.groups || []);
      _groupMap = groupMap;
    })
    .catch(() => {});

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('exercise-area').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });

  document.getElementById('check-btn').addEventListener('click', checkAnswer);
  document.getElementById('cloze-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkAnswer();
  });

  document.getElementById('listen-btn').addEventListener('click', () => {
    if (currentBlank) playTTS(currentBlank.fullPhrase);
  });

  document.getElementById('next-btn').addEventListener('click', () => rateAndNext(3));
  document.getElementById('try-again-btn').addEventListener('click', () => {
    answered = false;
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('try-again-btn').classList.add('hidden');
    showPhrase(currentIndex);
  });

  AppAudio.setBase('../../shared/audio/');
  AppAudio.warmup();
});


function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('exercise-area').classList.add('hidden');
  AppTopicGrid.build({ badge: 'Fill-in', srsPrefix: 'cloze_', onSelect: startTopic });
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
      phrases      = data.phrases;
      translations = data.traductions || [];
      grammarNotes = data.grammar || [];
      cardIds      = phrases.map((_, i) => 'cloze_' + topicId + '_' + i);

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
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('exercise-area').classList.remove('hidden');
  const streak = Progress.getStreak();
  document.getElementById('cloze-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  showPhrase(idx);
  updateCounter();
}

// ---- Cloze Display ----

function selectBlankWord(phrase) {
  const p = AppCloze.pick(phrase);
  if (!p) return null;
  return {
    blank:        p.word.replace(/[^a-zA-Z'-]/g, ''),
    blankClean:   p.clean,
    blankDisplay: p.word,
    blankedPhrase: p.tokens.map((w, i) => i === p.idx ? '___' : w).join(' '),
    fullPhrase:   phrase,
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
      currentIndex = (currentIndex + 1) % cardIds.length;
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
  document.getElementById('cloze-diff').textContent = '';
  document.getElementById('grammar-chip-wrap').classList.add('hidden');
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('try-again-btn').classList.add('hidden');
  document.getElementById('phrase-card').className        = 'phrase-card';

  document.getElementById('cloze-input')?.focus();
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

  const guess = raw.toLowerCase().replace(/['']/g, "'").replace(/[^a-z'\- ]/g, '').replace(/\s+/g, ' ').trim();
  const isCorrect = guess === currentBlank.blankClean || _equivalentMatch(guess, currentBlank.blankClean);
  _lastCorrect = isCorrect;

  // Save progress immediately — so navigating away without pressing Next still records the result
  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);
  Progress.recordSession('cloze_' + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const resultEl  = document.getElementById('feedback-result');
  const diffEl    = document.getElementById('cloze-diff');
  const card      = document.getElementById('phrase-card');
  const feedback  = document.getElementById('cloze-feedback');

  resultEl.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  card.classList.add(isCorrect ? 'phrase-card--correct' : 'phrase-card--incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(AppFeedback.buildCloze(currentBlank.blankedPhrase, raw, currentBlank.blankDisplay, isCorrect));

  const chipWrap = document.getElementById('grammar-chip-wrap');
  if (chipWrap) {
    const tip = isCorrect ? grammarNotes[currentIndex] : null;
    if (tip) {
      const { label, ruleId } = extractGrammarInfo(tip);
      if (ruleId) {
        document.getElementById('grammar-chip-label').textContent = label;
        document.getElementById('grammar-chip').href = '../../grammar/html/grammar.html?rule=' + ruleId;
        chipWrap.classList.remove('hidden');
      } else {
        chipWrap.classList.add('hidden');
      }
    } else {
      chipWrap.classList.add('hidden');
    }
  }

  feedback.className = 'cloze-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', _lastCorrect);
  document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus();
}

// ---- Rating & Advance ----

function rateAndNext(quality) {
  // Progress already saved in checkAnswer — just advance
  updateCounter();

  const streak = Progress.getStreak();
  document.getElementById('cloze-streak').innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';

  currentIndex = (currentIndex + 1) % phrases.length;
  showPhrase(currentIndex);
}

// ---- Counter ----

function updateCounter() {
  const stats = Progress.getTopicStats('cloze_' + currentTopic, phrases.length);
  const el = document.getElementById('cloze-counter');
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' learned';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}

// ---- Audio playback ----

function playTTS(text) {
  if (!text) return;
  AppAudio.play(currentTopic, currentIndex, text);
}

// extractGrammarInfo is in shared/js/grammar-chip.js
