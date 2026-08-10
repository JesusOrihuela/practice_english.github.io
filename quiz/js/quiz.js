/* ============================================================
   quiz.js — Multiple Choice Vocabulary Quiz with SRS
   Research basis: Testing Effect (Roediger & Karpicke 2006)
   ============================================================ */


let _openPhraseBrowser = null;


let currentTopicId   = '';
let quizTopicKey     = '';  // SRS prefix
let words            = [];
let cardIds          = [];
let currentIndex     = 0;
let answered         = false;
let _lastCorrect     = false;
let _translationMode = false; // true for A1/A2: options show Spanish translation

// Option text: A1/A2 (non-cognate) show the source-language translation (L1 anchor);
// otherwise the target-language monolingual definition. Uniform across all pairs.
function _quizText(word) {
  const _srcCode = AppLangPair.getActive().source.code;
  return _translationMode
    ? (word.translations?.[_srcCode] || word.definition)
    : word.definition;
}

// Cognate = target term and its source-language translation share a root. Checked
// symmetrically so it works whichever language is the target (es\u2192en or en\u2192es).
function _isCognate(word) {
  const _norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const term = _norm(word.term);
  const _srcCode = AppLangPair.getActive().source.code;
  const src  = _norm(word.translations?.[_srcCode] || '');
  if (!term || !src) return false;
  if (term === src) return true;
  // Suffix pairs where an English and a Spanish word share the same root.
  const _pairs = [
    ['tion','cion'],['ty','dad'],['ous','o'],['ous','oso'],
    ['ate','ar'],['ize','izar'],['ise','izar'],['al','al'],['ble','ble'],
    ['ent','ente'],['ant','ante'],['ic','ico'],['ical','ico'],['ly','mente'],
  ];
  const _match = (a, b) => {
    for (const [eSuf, sSuf] of _pairs) {
      if (a.endsWith(eSuf) && b.endsWith(sSuf)) {
        const aRoot = a.slice(0, -eSuf.length), bRoot = b.slice(0, -sSuf.length);
        if (aRoot.length >= 3 && (aRoot === bRoot || bRoot.startsWith(aRoot) || aRoot.startsWith(bRoot))) return true;
      }
    }
    return false;
  };
  return _match(term, src) || _match(src, term);
}

// ---- Init ----

function _quizGridOpts() {
  return {
    badge: 'Quiz',
    topics: AppTopics.VOCAB_TOPICS,
    getSrsKey: t => t.id === 'general' ? 'quiz_vocab' : 'quiz_' + t.id,
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
    AppTopicGrid.build(_quizGridOpts());
  }

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('quiz-content').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });
  document.getElementById('next-btn').addEventListener('click', () => rateAndNext(_lastCorrect ? 5 : 1));
  document.getElementById('try-again-btn').addEventListener('click', () => {
    document.getElementById('try-again-btn').classList.add('hidden');
    showQuestion(currentIndex);
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
    document.getElementById('quiz-content').appendChild(_backLink);
  }
});

// ---- Topic Picker ----

function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('quiz-content').classList.add('hidden');
  AppTopicGrid.build(_quizGridOpts());
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
  quizTopicKey   = topicId === 'general' ? 'quiz_vocab' : 'quiz_' + topicId;
  const dataKey = topicId === 'general' ? 'words' : 'words-' + topicId;

  AppData.get(dataKey)
    .then(data => {
      const _order = CEFR_ORDER;
      const _tagged = (data.words || []).map(w => ({ ...w }))
        .sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));
      words   = _tagged;
      cardIds = _tagged.map(x => quizTopicKey + '_' + x.id);

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
  document.getElementById('quiz-content').classList.remove('hidden');
  AppSessionBar.updateStreak('quiz-streak');
  showQuestion(currentIndex);
  updateCounter();
}

// ---- Quiz Display ----

function showQuestion(index) {
  const word = words[index];
  if (!word) return;

  answered         = false;
  // Translation mode (A1/A2): show Spanish translation as options instead of English definition.
  // Disabled for cognates — trivially obvious answers like "formal/formal" defeat the purpose.
  _translationMode = !_isCognate(word) && (CEFR_ORDER[word.level] ?? 99) <= 1;

  document.getElementById('quiz-word').textContent     = word.term;
  const _POS_Q = { Noun: 'pos_noun', Verb: 'pos_verb', Adjective: 'pos_adjective', Adverb: 'pos_adverb' };
  document.getElementById('quiz-category').textContent = word.category ? AppLang.t(_POS_Q[word.category] || word.category) : '';
  document.getElementById('word-card').className       = 'word-card';

  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('quiz-diff').textContent = '';
  document.getElementById('feedback-example-text').textContent = '';
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('try-again-btn').classList.add('hidden');
  document.getElementById('back-to-path')?.classList.add('hidden');

  _showCefrBadge(word.level, 'word-card');
  const choices = buildChoices(index);
  renderChoices(choices, index);
  // Don't auto-focus first option — it triggers a visible border that looks like a selection
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

function buildChoices(correctIdx) {
  const correct  = words[correctIdx];
  const sameDiff = words.filter((w, i) => i !== correctIdx && w.difficulty === correct.difficulty);
  const pool     = sameDiff.length >= 3 ? sameDiff : words.filter((_, i) => i !== correctIdx);

  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const distractors = shuffled.slice(0, 3);
  const all = [{ ...correct, isCorrect: true }, ...distractors.map(w => ({ ...w, isCorrect: false }))];

  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

function renderChoices(choices, correctIdx) {
  const grid = document.getElementById('choices-grid');
  grid.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = _quizText(choice);
    btn.addEventListener('click', () => handleAnswer(choice.isCorrect, choice, correctIdx));
    grid.appendChild(btn);
  });
}

// ---- Answer Handling ----

function handleAnswer(isCorrect, chosenWord, correctIdx) {
  if (answered) return;
  answered = true;
  _lastCorrect = isCorrect;

  Progress.rate(cardIds[currentIndex], PathSession.getQualityFromResult(isCorrect));
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(words[currentIndex]?.level, isCorrect, 'quiz');
  Progress.recordSession(quizTopicKey, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const btns = document.querySelectorAll('.choice-btn');
  btns.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === _quizText(words[correctIdx])) {
      btn.classList.add('correct');
    } else if (btn.textContent === _quizText(chosenWord) && !isCorrect) {
      btn.classList.add('incorrect');
    }
  });

  const feedbackEl = document.getElementById('quiz-feedback');
  const resultEl   = document.getElementById('feedback-result');
  const diffEl     = document.getElementById('quiz-diff');
  const exampleEl  = document.getElementById('feedback-example-text');
  const wordCard   = document.getElementById('word-card');

  resultEl.textContent = isCorrect ? AppLang.t('feedback_correct') : AppLang.t('feedback_incorrect');
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  wordCard.classList.add(isCorrect ? 'word-card--correct' : 'word-card--incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(AppFeedback.buildQuiz(_quizText(chosenWord), _quizText(words[correctIdx]), isCorrect));

  exampleEl.textContent = '"' + (words[correctIdx].example || '') + '"';
  feedbackEl.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  document.getElementById('next-btn').classList.toggle('hidden', !isCorrect);
  document.getElementById('try-again-btn').classList.remove('hidden');  // siempre: acierto→avanzar o reforzar; fallo→reintentar
  document.getElementById('back-to-path')?.classList.remove('hidden');
  document.getElementById(isCorrect ? 'next-btn' : 'try-again-btn')?.focus();

}

function rateAndNext(quality) {
  // Progress already saved in handleAnswer — just advance
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

  currentIndex = (currentIndex + 1) % words.length;
  showQuestion(currentIndex);

  AppSessionBar.updateStreak('quiz-streak');
}

function _showPathSessionComplete() {
  AppUI.sessionComplete();
}

// ---- Utilities ----

function updateCounter() {
  AppSessionBar.updateCounter('quiz-counter', cardIds, _pathModeActive);
}
