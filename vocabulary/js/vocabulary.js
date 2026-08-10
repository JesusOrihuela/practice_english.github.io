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

document.addEventListener('DOMContentLoaded', async () => {
  // Part B: load the active pair's topics before reading topic lists.
  await AppTopics.load();
  if (typeof AppPath !== 'undefined' && AppPath.load) await AppPath.load();
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
    if (word) {
      AppAudio.play(currentTopicId === 'general' ? 'vocab' : 'vocab_' + currentTopicId, word.id, word.term);
    }
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

  AppAudio.setBase('../../shared/audio/' + AppLangPair.getActive().target.code + '/');
  AppAudio.warmup();
});

// ---- Topic Picker ----

function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('vocab-content').classList.add('hidden');
  AppTopicGrid.build(_vocabGridOpts());
}

function _showLoadError(topicId) {
  AppUI.loadError(document.getElementById('topic-picker'), function () { startTopic(topicId); });
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
      const _tagged = (data.words || []).slice()
        .sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));
      words   = _tagged;
      cardIds = _tagged.map(x => vocabTopicKey + '_' + x.id);

      const topicObj = (AppTopics.VOCAB_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: words,
        cardIds,
        topicLabel: topicObj ? AppTopics.getLabel(topicObj) : topicId,
        pickerEl: document.getElementById('topic-picker'),
        traductions: _tagged.map(w => w.term),
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
  AppSessionBar.updateStreak('vocab-streak');
  showCard(currentIndex);
  updateStatsBar();
}

// ---- Card Display ----

function showCard(index) {
  const word = words[index];
  if (!word) return;
  isFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');

  const _srcCode     = AppLangPair.getActive().source.code;
  const _displayWord = word.term;
  const _displayHint = word.translations?.[_srcCode] || '';

  // Front
  const _POS = { Noun: 'pos_noun', Verb: 'pos_verb', Adjective: 'pos_adjective', Adverb: 'pos_adverb' };
  document.getElementById('word-category').textContent = word.category ? AppLang.t(_POS[word.category] || word.category) : '';
  document.getElementById('word-text').textContent = _displayWord;

  // Back — definition/example are the target-language (monolingual) forms; fall
  // back to the source-language gloss for entries that lack a monolingual form.
  document.getElementById('fc-back-word').textContent    = _displayWord;
  document.getElementById('word-definition').textContent = word.definition || (word.gloss?.[_srcCode] || '');
  document.getElementById('word-example').textContent    = word.example || (word.gloss_example?.[_srcCode] || '');
  document.getElementById('word-translation').textContent = _displayHint;

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
  badge.setAttribute('aria-label', AppLang.t('cefr_level_aria', { level }));
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

  AppSessionBar.updateStreak('vocab-streak');
}

function _showPathSessionComplete() {
  AppAudio.cancel();
  AppUI.sessionComplete();
}

// ---- Utilities ----

function updateStatsBar() {
  AppSessionBar.updateCounter('cards-remaining', cardIds, _pathModeActive);
}
