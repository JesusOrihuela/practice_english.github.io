/* ============================================================
   dictation.js — Dictation Practice with SRS
   Listen to a phrase, type what you hear, get word-level diff.
   Works in every browser — no microphone required.
   ============================================================ */

const DICT_PREFIX = 'dict_';

let _openPhraseBrowser = null;


// ---- State ----
let phrases = [], grammarTips = [], cardIds = [], cefrLevels = [], formPools = [], currentIndex = 0;
let _activeAudioSlug = '';   // audioSlug of the picked form for this round
let _activePicked    = null; // { text, audioSlug, labels?, ... } — picked form for this round
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
  if (streakEl) streakEl.textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });

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
  document.getElementById('try-again-btn').addEventListener('click', () => loadPhrase(currentIndex, true));

  if (_pathMode) {
    const _backLink = document.createElement('a');
    _backLink.id = 'back-to-path';
    _backLink.href = '../../my-learning/html/my-learning.html';
    _backLink.className = 'back-to-path-link hidden';
    _backLink.textContent = AppLang.t('back_to_path');
    _backLink.addEventListener('click', function () {
      if (_lastCorrect && typeof PathSession !== 'undefined') PathSession.advance();
    });
    document.getElementById('exercise-area').appendChild(_backLink);
  }

  AppAudio.setBase('../../shared/audio/' + AppLangPair.getActive().id + '/');
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
  txt.textContent = AppLang.t('error_loading');

  const btn = document.createElement('button');
  btn.textContent = AppLang.t('retry');
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
  currentTopic = topicKey;
  let data;
  try {
    data = await AppData.get(topicKey);
  } catch {
    _showLoadError(topicKey);
    return;
  }
  const _order = CEFR_ORDER;
  const _tagged = (data.phrases || []).map(p => ({
    practiceText: p.target?.[0]?.text || '',
    hintText:     p.source || '',
    forms:        p.target || [],
    grammar: p.grammar || null, level: p.level || null, id: p.id,
  })).sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));
  phrases     = _tagged.map(x => x.practiceText);
  grammarTips = _tagged.map(x => x.grammar);
  cefrLevels  = _tagged.map(x => x.level);
  cardIds     = _tagged.map(x => DICT_PREFIX + x.id);
  formPools   = _tagged.map(x => x.forms);

  const topicObj = (AppTopics.PHRASE_TOPICS || []).find(t => t.id === topicKey);
  const _pbArgs = {
    items: phrases,
    cardIds,
    topicLabel: topicObj ? AppTopics.getLabel(topicObj) : topicKey,
    pickerEl: document.getElementById('topic-picker'),
    traductions: _tagged.map(x => x.hintText),
    cefrLevels,
    forms: formPools,
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
  if (streakEl) streakEl.textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });
  loadPhrase(currentIndex);
  updateCounter();
}

// ---- Phrase Management ----

function _buildPool(forms) {
  return forms.filter(f => f.audioSlug !== undefined);
}

function loadPhrase(index, keepPicked = false) {
  hasChecked = false;

  // Pick the least-practiced form with audio for this round (coverage-aware
  // rotation — guarantees every variant is exercised over repetitions).
  // keepPicked=true on retry — preserve the same form so the user hears the same audio.
  if (!keepPicked || !_activePicked) {
    const _pool  = _buildPool(formPools[index] || []);
    _activePicked    = Progress.pickVariant(cardIds[index], _pool) || _pool[0];
    _activeAudioSlug = _activePicked.audioSlug;
  }

  document.getElementById('play-btn').disabled   = false;
  document.getElementById('dict-input').value    = '';
  document.getElementById('dict-input').disabled = false;
  document.getElementById('check-btn').disabled  = false;

  document.getElementById('dict-feedback').className = 'dict-feedback hidden';
  document.getElementById('feedback-result').textContent = '';
  document.getElementById('dict-diff').textContent = '';
  document.getElementById('alt-note')?.classList.add('hidden');
  document.getElementById('alt-note-divider')?.classList.add('hidden');
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
  badge.setAttribute('aria-label', AppLang.t('cefr_level_aria', { level }));
}

function updateCounter() {
  const el = document.getElementById('dict-counter');
  if (!el || phrases.length === 0) return;
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const prog = PathSession.getProgress();
    el.textContent = AppLang.t('cta_exercise_n', { cur: prog.current, total: prog.total });
    const pct = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;
    const fill = document.getElementById('session-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const bar = document.getElementById('session-progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', pct);
    return;
  }
  const stats = Progress.getStatsForCards(cardIds);
  el.textContent = AppLang.t('topic_learned', { seen: stats.seen, total: stats.total });
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
  const phrase = _activePicked ? _activePicked.text : phrases[currentIndex];
  if (!phrase) return;

  const playBtn = document.getElementById('play-btn');

  playBtn.disabled = true;
  AppAudio.play(currentTopic, _activeAudioSlug, phrase, 1).then(() => {
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
  if (AppLangPair.getActive().target.code !== 'en') { wrap.classList.add('hidden'); return; }
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

  const _norm    = s => AppText.normalise(s, contractionMap);
  const forms    = formPools[currentIndex] || [];
  const _expected = _activePicked ? _activePicked.text : original;
  // Dictation: only the specific played form is acceptable — not any other variant.
  const isCorrect = _norm(input) === _norm(_expected);
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], PathSession.getQualityFromResult(isCorrect));
  if (_activeAudioSlug) Progress.recordVariant(cardIds[currentIndex], _activeAudioSlug);
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(cefrLevels[currentIndex], isCorrect, 'dictation');
  Progress.recordSession(DICT_PREFIX + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();
  const feedback = document.getElementById('dict-feedback');
  const resultEl = document.getElementById('feedback-result');
  const diffEl   = document.getElementById('dict-diff');

  resultEl.textContent = isCorrect ? AppLang.t('feedback_correct') : AppLang.t('feedback_incorrect');
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  diffEl.textContent   = '';
  diffEl.appendChild(
    isCorrect
      ? AppFeedback.buildCorrect(_expected)
      : AppFeedback.buildDiff(input, _expected, contractionMap)
  );
  feedback.className = 'dict-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  feedback.classList.remove('hidden');

  if (isCorrect) updateGrammarChip(currentIndex);

  // Alternative chips (correct only)
  const altNoteEl    = document.getElementById('alt-note');
  const altDividerEl = document.getElementById('alt-note-divider');
  if (isCorrect && altNoteEl) {
    const altsToShow = forms.filter(f => _norm(f.text) !== _norm(_expected));
    const frag = AppFeedback.buildAltNote(altsToShow, AppLang.t.bind(AppLang), null);
    if (frag) {
      altNoteEl.textContent = '';
      altNoteEl.appendChild(frag);
      altNoteEl.classList.remove('hidden');
      if (altDividerEl) altDividerEl.classList.remove('hidden');
    } else {
      altNoteEl.classList.add('hidden');
      if (altDividerEl) altDividerEl.classList.add('hidden');
    }
  } else if (altNoteEl) {
    altNoteEl.classList.add('hidden');
    if (altDividerEl) altDividerEl.classList.add('hidden');
  }

  // Re-enable audio after checking so learner can hear the correct phrase
  document.getElementById('play-btn').disabled = false;

  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.toggle('hidden', _lastCorrect);
  document.getElementById('back-to-path')?.classList.remove('hidden');
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
  if (el) el.textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });
}

function _showPathSessionComplete() {
  AppAudio.cancel();
  const prog = typeof PathSession !== 'undefined' ? PathSession.getProgress() : null;
  const reviewCount = prog ? Math.max(0, prog.total - (prog.newCount || 0)) : 0;
  const newCount    = prog ? (prog.newCount || 0) : 0;
  document.body.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;font-family:inherit;">' +
      '<div style="font-size:3rem;margin-bottom:1rem;">🎉</div>' +
      '<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">' + AppLang.t('session_complete') + '</h1>' +
      '<p style="color:var(--clr-text-muted,#6b7280);margin-bottom:2rem;">' +
        AppLang.t('path_complete_summary', { review: reviewCount, new: newCount }) +
      '</p>' +
      '<a href="../../my-learning/html/my-learning.html" style="background:var(--clr-primary,#4f46e5);color:#fff;padding:0.75rem 2rem;border-radius:999px;text-decoration:none;font-weight:600;">' + AppLang.t('my_learning_link') + '</a>' +
    '</div>';
}

// ---- Utilities ----

