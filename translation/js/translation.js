/* ============================================================
   translation.js — Reverse Translation (Spanish → English) with SRS
   Research basis: Desirable Difficulty (Bjork 1994), Cook (2010)
   ============================================================ */



const LAST_KEY = 'pe_last_translation';
let _openPhraseBrowser = null;


let currentTopic = '';
let phrases = [], translations = [], grammarNotes = [], cardIds = [], cefrLevels = [], audioIndices = [], phraseAlternatives = [];
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
    AppTopicGrid.build({ badge: 'Translate', ariaLabelSuffix: 'translation', srsPrefix: 'trans_', onSelect: startTopic });
  }

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

  if (_pathMode) {
    const _backLink = document.createElement('a');
    _backLink.id = 'back-to-path';
    _backLink.href = '../../my-learning/html/my-learning.html';
    _backLink.className = 'back-to-path-link hidden';
    _backLink.textContent = '← Volver a la ruta';
    _backLink.addEventListener('click', function () {
      if (_lastCorrect && typeof PathSession !== 'undefined') PathSession.advance();
    });
    document.getElementById('exercise-area').appendChild(_backLink);
  }

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
  txt.textContent = '⚠️ Error al cargar el tema. Revisa tu conexión.';

  const btn = document.createElement('button');
  btn.textContent = 'Reintentar →';
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

let _pathModeActive = false;
let _pathCardId     = null;

function startTopic(topicId, pathMode, pathCard) {
  _pathModeActive = !!pathMode;
  _pathCardId     = pathCard || null;
  localStorage.setItem(LAST_KEY, topicId);
  currentTopic = topicId;
  AppData.get(topicId)
    .then(data => {
      const _order = { A1: 0, A2: 1, B1: 2, B2: 3 };
      const validPairs = (data.phrases || [])
        .map((p, i) => ({ phrase: p.phrase, translation: p.translation || '', cefr: p.cefr || null, grammar: p.grammar || null, id: p.id, origIdx: i, alternatives: p.alternatives || [] }))
        .filter(p => p.translation.trim().length > 0)
        .sort((a, b) => (_order[a.cefr] ?? 99) - (_order[b.cefr] ?? 99));

      phrases            = validPairs.map(p => p.phrase);
      translations       = validPairs.map(p => p.translation);
      grammarNotes       = validPairs.map(p => p.grammar);
      cefrLevels         = validPairs.map(p => p.cefr);
      cardIds            = validPairs.map(p => 'trans_' + p.id);
      audioIndices       = validPairs.map(p => p.origIdx);
      phraseAlternatives = validPairs.map(p => p.alternatives);

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
        traductions: validPairs.map(p => p.translation),
        cefrLevels,
        onStart: idx => _beginExercise(idx),
      };
      _openPhraseBrowser = () => PhraseBrowser.show(_pbArgs);
      if (_pathModeActive) {
        _beginExercise(0);
      } else {
        _openPhraseBrowser();
      }
    })
    .catch(() => _showLoadError(topicId));
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
  document.getElementById('trans-streak').innerHTML = '<span aria-hidden="true">🔥</span> racha de ' + streak.current + ' día(s)';
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
  document.getElementById('back-to-path')?.classList.add('hidden');
  document.getElementById('phrase-card').className = 'phrase-card';
  _showCefrBadge(cefrLevels[index], 'phrase-card');

  document.getElementById('trans-input')?.focus();
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
  const _norm = s => AppText.normalise(s, contractionMap);
  const isCorrect = _norm(raw) === _norm(expected)
    || (phraseAlternatives[currentIndex] || []).some(alt => _norm(raw) === _norm(alt));
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(cefrLevels[currentIndex], isCorrect, 'translation');
  Progress.recordSession('trans_' + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const resultEl = document.getElementById('feedback-result');
  const diffEl   = document.getElementById('trans-diff');
  const feedback = document.getElementById('trans-feedback');
  const card     = document.getElementById('phrase-card');

  resultEl.textContent = isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto';
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  card.classList.add(isCorrect ? 'phrase-card--correct' : 'phrase-card--incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(
    isCorrect
      ? AppFeedback.buildCorrect(expected)
      : AppFeedback.buildDiff(raw, AppText.closestPhrase(raw, [expected, ...(phraseAlternatives[currentIndex] || [])], contractionMap), contractionMap)
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
  document.getElementById('back-to-path')?.classList.remove('hidden');
  document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus();

}

// ---- Rating & Advance ----

function _getCardStats() {
  const cards = Progress.getAllCards();
  const seen  = cardIds.filter(id => { const c = cards[id]; return c && c.reps > 0; }).length;
  return { seen, total: cardIds.length };
}

function rateAndNext(quality) {
  // Progress already saved in checkAnswer — just advance
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const nextHref = PathSession.advance();
    if (nextHref) {
      window.location.href = '../../' + nextHref;
    } else {
      _showPathSessionComplete();
    }
    return;
  }
  updateCounter();

  const streak = Progress.getStreak();
  document.getElementById('trans-streak').innerHTML = '<span aria-hidden="true">🔥</span> racha de ' + streak.current + ' día(s)';

  currentIndex = (currentIndex + 1) % phrases.length;
  showPhrase(currentIndex);
}

function _showPathSessionComplete() {
  AppAudio.cancel();
  const prog = typeof PathSession !== 'undefined' ? PathSession.getProgress() : null;
  const reviewCount = prog ? Math.max(0, prog.total - (prog.newCount || 0)) : 0;
  const newCount    = prog ? (prog.newCount || 0) : 0;
  document.body.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;font-family:inherit;">' +
      '<div style="font-size:3rem;margin-bottom:1rem;">🎉</div>' +
      '<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">¡Sesión completada!</h1>' +
      '<p style="color:var(--clr-text-muted,#6b7280);margin-bottom:2rem;">' +
        (reviewCount > 0 ? reviewCount + ' repaso' + (reviewCount > 1 ? 's' : '') : '') +
        (reviewCount > 0 && newCount > 0 ? ' y ' : '') +
        (newCount > 0 ? newCount + ' tarjeta' + (newCount > 1 ? 's' : '') + ' nueva' + (newCount > 1 ? 's' : '') : '') +
        ' completada' + ((reviewCount + newCount) > 1 ? 's' : '') + ' hoy.' +
      '</p>' +
      '<a href="../../my-learning/html/my-learning.html" style="background:var(--clr-primary,#4f46e5);color:#fff;padding:0.75rem 2rem;border-radius:999px;text-decoration:none;font-weight:600;">My Learning →</a>' +
    '</div>';
}

// ---- Counter ----

function updateCounter() {
  const el = document.getElementById('trans-counter');
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const prog = PathSession.getProgress();
    if (el) el.textContent = 'Ejercicio ' + prog.current + ' de ' + prog.total;
    const pct = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;
    const fill = document.getElementById('session-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const bar = document.getElementById('session-progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', pct);
    return;
  }
  const stats = _getCardStats();
  if (el) el.textContent = stats.seen + ' / ' + stats.total + ' aprendidas';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}

// ---- TTS (Kokoro via AppTTS) ----

function playTTS(text) {
  if (!text) return;
  AppAudio.play(currentTopic, audioIndices[currentIndex] ?? currentIndex, text);
}

// extractGrammarInfo is in shared/js/grammar-chip.js
