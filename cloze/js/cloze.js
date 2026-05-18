/* ============================================================
   cloze.js — Fill-in-the-Blank Exercise with SRS
   Research basis: Generation Effect (Slamecka & Graf 1978)
   ============================================================ */




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
let phrases = [], translations = [], grammarNotes = [], cardIds = [], cefrLevels = [], audioIndices = [];
let currentIndex = 0;
let currentBlank = null;  // { blank, blankClean, blankedPhrase, fullPhrase }
let answered = false;
let _lastCorrect = false;

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
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
    AppTopicGrid.build({ badge: 'Fill-in', ariaLabelSuffix: 'fill-in-the-blank', srsPrefix: 'cloze_', onSelect: startTopic });
  }

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
  txt.textContent = AppLang.t('error_loading');

  const btn = document.createElement('button');
  btn.textContent = AppLang.t('retry');
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
  currentTopic = topicId;
  AppData.get(topicId)
    .then(data => {
      const _order = CEFR_ORDER;
      const _tagged = (data.phrases || []).map((p, i) => ({
        phrase: p.phrase, translation: p.translations?.[AppLangPair.getActive().source.code] || '',
        grammar: p.grammar || null, level: p.level || null, id: p.id, origIdx: i,
      })).sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));
      phrases      = _tagged.map(x => x.phrase);
      translations = _tagged.map(x => x.translation);
      grammarNotes = _tagged.map(x => x.grammar);
      cefrLevels   = _tagged.map(x => x.level);
      cardIds      = _tagged.map(x => 'cloze_' + x.id);
      audioIndices = _tagged.map(x => x.origIdx);

      const topicObj = (AppTopics.PHRASE_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: phrases,
        cardIds,
        topicLabel: topicObj ? topicObj.label : topicId,
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
    })
    .catch(() => _showLoadError(topicId));
}

function _beginExercise(idx) {
  if (_pathModeActive && _pathCardId) {
    const cardIdx = cardIds.indexOf(_pathCardId);
    if (cardIdx !== -1) idx = cardIdx;
  }
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('exercise-area').classList.remove('hidden');
  const streak = Progress.getStreak();
  document.getElementById('cloze-streak').textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });
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
    showTopicPicker();
    const _picker = document.getElementById('topic-picker');
    if (_picker) {
      const _msg = document.createElement('p');
      _msg.style.cssText = 'color:var(--clr-danger);font-size:0.9rem;margin:0 0 12px;text-align:center;';
      _msg.textContent = AppLang.t('no_cloze_exercises');
      _picker.prepend(_msg);
      setTimeout(() => _msg.remove(), 4000);
    }
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
  document.getElementById('back-to-path')?.classList.add('hidden');
  document.getElementById('phrase-card').className        = 'phrase-card';

  _showCefrBadge(cefrLevels[currentIndex], 'phrase-card');
  document.getElementById('cloze-input')?.focus();
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
  Progress.rate(cardIds[currentIndex], PathSession.getQualityFromResult(isCorrect));
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(cefrLevels[currentIndex], isCorrect, 'cloze');
  Progress.recordSession('cloze_' + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const resultEl  = document.getElementById('feedback-result');
  const diffEl    = document.getElementById('cloze-diff');
  const card      = document.getElementById('phrase-card');
  const feedback  = document.getElementById('cloze-feedback');

  resultEl.textContent = isCorrect ? AppLang.t('feedback_correct') : AppLang.t('feedback_incorrect');
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
  document.getElementById('back-to-path')?.classList.remove('hidden');
  document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus();

}

// ---- Rating & Advance ----

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
  document.getElementById('cloze-streak').textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });

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
      '<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">' + AppLang.t('session_complete') + '</h1>' +
      '<p style="color:var(--clr-text-muted,#6b7280);margin-bottom:2rem;">' +
        AppLang.t('path_complete_summary', { review: reviewCount, new: newCount }) +
      '</p>' +
      '<a href="../../my-learning/html/my-learning.html" style="background:var(--clr-primary,#4f46e5);color:#fff;padding:0.75rem 2rem;border-radius:999px;text-decoration:none;font-weight:600;">' + AppLang.t('my_learning_link') + '</a>' +
    '</div>';
}

// ---- Counter ----

function updateCounter() {
  const el = document.getElementById('cloze-counter');
  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const prog = PathSession.getProgress();
    if (el) el.textContent = AppLang.t('cta_exercise_n', { cur: prog.current, total: prog.total });
    const pct = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;
    const fill = document.getElementById('session-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const bar = document.getElementById('session-progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', pct);
    return;
  }
  const stats = Progress.getStatsForCards(cardIds);
  if (el) el.textContent = AppLang.t('topic_learned', { seen: stats.seen, total: stats.total });
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}

// ---- Audio playback ----

function playTTS(text) {
  if (!text) return;
  AppAudio.play(currentTopic, audioIndices[currentIndex] ?? currentIndex, text);
}

// extractGrammarInfo is in shared/js/grammar-chip.js
