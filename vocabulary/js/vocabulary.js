/* ============================================================
   vocabulary.js — Flashcard Vocabulary Trainer with SRS
   ============================================================ */


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
      const key = t.id === 'general' ? 'words' : 'words-' + t.id;
      return AppData.get(key).then(d => d.words ? d.words.length : 0);
    },
    onSelect: startTopic,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const _urlTopic = new URLSearchParams(location.search).get('topic');
  const _pathMode = new URLSearchParams(location.search).get('path') === '1';
  const _pathCard = new URLSearchParams(location.search).get('card');

  if (_pathMode) {
    document.getElementById('back-btn').classList.add('hidden');
    if (typeof PathSession !== 'undefined') PathSession.start();
  }

  if (_urlTopic && AppTopics.VOCAB_TOPICS.some(t => t.id === _urlTopic)) {
    startTopic(_urlTopic, _pathMode, _pathCard);
  } else {
    AppTopicGrid.build(_vocabGridOpts());
  }

  function _playCurrentWord(e) {
    e.stopPropagation(); // prevent card flip
    const word = words[currentIndex];
    if (word) AppAudio.play(currentTopicId === 'general' ? 'vocab' : 'vocab_' + currentTopicId, word._origIdx ?? currentIndex, word.word);
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

  if (_pathMode) {
    const _backLink = document.createElement('a');
    _backLink.id = 'back-to-path';
    _backLink.href = '../../my-learning/html/my-learning.html';
    _backLink.className = 'back-to-path-link hidden';
    _backLink.textContent = AppLang.t('back_to_path');
    _backLink.addEventListener('click', function () {
      if (isFlipped && typeof PathSession !== 'undefined') PathSession.advance();
    });
    document.getElementById('vocab-content').appendChild(_backLink);
  }

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

let _pathModeActive = false;
let _pathCardId     = null;

function startTopic(topicId, pathMode, pathCard) {
  _pathModeActive = !!pathMode;
  _pathCardId     = pathCard || null;
  currentTopicId = topicId;
  vocabTopicKey  = topicId === 'general' ? 'vocab' : 'vocab_' + topicId;
  const dataKey = topicId === 'general' ? 'words' : 'words-' + topicId;

  AppData.get(dataKey)
    .then(data => {
      const _order = CEFR_ORDER;
      const _tagged = (data.words || []).map((w, i) => ({ ...w, _origIdx: i }))
        .sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));
      words   = _tagged;
      cardIds = _tagged.map(x => vocabTopicKey + '_' + x.id);

      const topicObj = (AppTopics.VOCAB_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: words,
        cardIds,
        topicLabel: topicObj ? topicObj.label : topicId,
        pickerEl: document.getElementById('topic-picker'),
        cefrLevels: _tagged.map(x => x.level || null),
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
  document.getElementById('vocab-content').classList.remove('hidden');
  const streak = Progress.getStreak();
  const el = document.getElementById('vocab-streak');
  if (el) el.textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });
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
  const _POS = { Noun: 'pos_noun', Verb: 'pos_verb', Adjective: 'pos_adjective', Adverb: 'pos_adverb' };
  document.getElementById('word-category').textContent = word.category ? AppLang.t(_POS[word.category] || word.category) : '';
  document.getElementById('word-text').textContent = word.word;

  // Back
  document.getElementById('fc-back-word').textContent    = word.word;
  document.getElementById('word-definition').textContent = word.definition;
  document.getElementById('word-example').textContent    = word.example;
  document.getElementById('word-translation').textContent = word.translations?.[AppLangPair.getActive().source.code] || '';

  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('back-to-path')?.classList.add('hidden');
  _showCefrBadge(word.level, 'flashcard-front');
  _showCefrBadge(word.level, 'flashcard-back');
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

function flipCard() {
  isFlipped = true;
  document.getElementById('flashcard').classList.add('flipped');
  setTimeout(() => {
    document.getElementById('next-btn').classList.remove('hidden');
    document.getElementById('back-to-path')?.classList.remove('hidden');
  }, 350);
}

function rateAndNext(quality) {
  const _isCorrect = quality >= 3;
  Progress.rate(cardIds[currentIndex], PathSession.getQualityFromResult(_isCorrect));
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(words[currentIndex]?.level, _isCorrect, 'vocabulary');
  Progress.recordSession(vocabTopicKey, _isCorrect ? 1 : 0, 1);

  if (_pathModeActive && typeof PathSession !== 'undefined') {
    const nextHref = PathSession.advance();
    if (nextHref) {
      window.location.href = '../../' + nextHref;
    } else {
      _showPathSessionComplete();
    }
    return;
  }

  updateStatsBar();

  currentIndex = (currentIndex + 1) % words.length;
  showCard(currentIndex);

  const scene = document.getElementById('flashcard-scene');
  if (scene) scene.focus();

  const streak = Progress.getStreak();
  const el = document.getElementById('vocab-streak');
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

function updateStatsBar() {
  const el = document.getElementById('cards-remaining');
  if (!el) return;
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
