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
let phrases = [], translations = [], grammarNotes = [], cardIds = [], cefrLevels = [], formPools = [], phraseIds = [];
let _activeAudioSlug = '';   // audioSlug of the picked form for this round
let _activePickedForm = null; // picked form object (labels drive the gender badge)
let currentIndex = 0;
let currentBlank = null;  // { blank, blankClean, blankedPhrase, fullPhrase }
let answered = false;
let _lastCorrect = false;

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  // Part B: load the active pair's topics before reading topic lists.
  await AppActivity.loadData();
  const { topic: _urlTopic, path: _pathMode, card: _pathCard } = AppActivity.pathParams();

  if (_pathMode) AppActivity.startPathMode();

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
    if (e.key === 'Enter') { e.preventDefault(); checkAnswer(); }
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
    AppUI.addPathBackLink('exercise-area', function () { return _lastCorrect; });
  }

  AppAudio.setBase('../../shared/audio/' + AppLangPair.getActive().id + '/');
  AppAudio.warmup();
});


function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('exercise-area').classList.add('hidden');
  AppTopicGrid.build({ badge: 'Fill-in', srsPrefix: 'cloze_', onSelect: startTopic });
}

function _showLoadError(topicId) {
  AppUI.loadError(document.getElementById('topic-picker'), function () { startTopic(topicId); });
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
      const _tagged = (data.phrases || []).map(p => ({
        practiceText: p.target?.[0]?.text || '',
        hintText:     p.source || '',
        forms:        p.target || [],
        grammar: p.grammar || null, level: p.level || null, id: p.id,
      })).sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));
      phrases      = _tagged.map(x => x.practiceText);
      translations = _tagged.map(x => x.hintText);
      grammarNotes = _tagged.map(x => x.grammar);
      cefrLevels   = _tagged.map(x => x.level);
      cardIds      = _tagged.map(x => 'cloze_' + x.id);
      formPools    = _tagged.map(x => x.forms);
      phraseIds    = _tagged.map(x => x.id);
      AppGrammarChip.load();   // preload evidence map so auto-chips are ready

      const topicObj = (AppTopics.PHRASE_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: phrases,
        cardIds,
        topicLabel: topicObj ? AppTopics.getLabel(topicObj) : topicId,
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
  AppSessionBar.updateStreak('cloze-streak');
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

function _buildPool(forms) {
  return forms.filter(f => f.audioSlug !== undefined);
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
    // Pick the least-practiced form with audio (coverage-aware) and try to blank it
    const _pool   = _buildPool(formPools[currentIndex] || []);
    const _picked = Progress.pickVariant(cardIds[currentIndex], _pool) || _pool[0];
    currentBlank  = selectBlankWord(_picked.text);
    if (currentBlank) {
      _activeAudioSlug = _picked.audioSlug;
      _activePickedForm = _picked;
    } else {
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

  // Build the blanked phrase with DOM nodes (not innerHTML) so phrase text with
  // &, <, > renders literally instead of being parsed as markup.
  (function renderBlank() {
    var host  = document.getElementById('phrase-text');
    var parts = currentBlank.blankedPhrase.split('___');
    host.textContent = '';
    host.appendChild(document.createTextNode(parts[0] || ''));
    var blank = document.createElement('span');
    blank.setAttribute('aria-label', AppLang.t('cloze_blank_word_aria'));
    blank.textContent = '[___]';
    host.appendChild(blank);
    if (parts.length > 1) host.appendChild(document.createTextNode(parts.slice(1).join('___')));
  })();
  // Per-form source: the picked form's own hint when present (referent-determined variants), else phrase source.
  document.getElementById('translation-text').textContent = (_activePickedForm && _activePickedForm.source) || translations[currentIndex] || '';
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
  AppFeedback.applyVariantBadge('phrase-card', _activePickedForm);
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
  badge.setAttribute('aria-label', AppLang.t('cefr_level_aria', { level }));
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
  if (_activeAudioSlug) Progress.recordVariant(cardIds[currentIndex], _activeAudioSlug);
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
    const info = isCorrect
      ? AppGrammarChip.choose({ tip: grammarNotes[currentIndex], id: phraseIds[currentIndex], pathMode: _pathModeActive })
      : null;
    if (info && info.ruleId) {
      document.getElementById('grammar-chip-label').textContent = info.label;
      document.getElementById('grammar-chip').href = '../../grammar/html/grammar.html?rule=' + info.ruleId;
      chipWrap.classList.remove('hidden');
    } else {
      chipWrap.classList.add('hidden');
    }
  }

  feedback.className = 'cloze-feedback ' + (isCorrect ? 'correct' : 'incorrect');
  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.remove('hidden');  // siempre: acierto→avanzar o reforzar; fallo→reintentar
  document.getElementById('back-to-path')?.classList.remove('hidden');
  setTimeout(function () { document.getElementById(_lastCorrect ? 'next-btn' : 'try-again-btn')?.focus(); }, 0); // defer: keep the submitting Enter on the input, not the just-shown button

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

  AppSessionBar.updateStreak('cloze-streak');

  currentIndex = (currentIndex + 1) % phrases.length;
  showPhrase(currentIndex);
}

function _showPathSessionComplete() {
  AppAudio.cancel();
  AppUI.sessionComplete();
}

// ---- Counter ----

function updateCounter() {
  AppSessionBar.updateCounter('cloze-counter', cardIds, _pathModeActive);
}

// ---- Audio playback ----

function playTTS(text) {
  if (!text) return;
  AppAudio.play(currentTopic, _activeAudioSlug, text);
}

// extractGrammarInfo is in shared/js/grammar-chip.js
