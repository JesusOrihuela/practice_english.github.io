/* ============================================================
   translation.js — Reverse Translation (Spanish → English) with SRS
   Research basis: Desirable Difficulty (Bjork 1994), Cook (2010)
   ============================================================ */



let _openPhraseBrowser = null;


let currentTopic = '';
let phrases = [], translations = [], grammarNotes = [], cardIds = [], cefrLevels = [], formPools = [], phraseIds = [];
let currentIndex = 0;
let answered = false;
let _lastCorrect = false;
let contractionMap = {};

// Randomly selected expected form for the current phrase.
// Populated in showPhrase(); used in checkAnswer() for display and chip filtering.
let _currentExpected = '';
let _currentAudioSlug = null; // audioSlug of the picked form

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  // Part B: load the active pair's topics before reading topic lists.
  await AppActivity.loadData();
  // Set dynamic translation title using active target language name
  const pair = AppLangPair.getActive();
  const titleEl = document.querySelector('.trans-title');
  if (titleEl) {
    titleEl.innerHTML = AppLang.t('translation_title', { lang: '<span>' + pair.target.localName + '</span>' });
  }
  const subEl = document.querySelector('.trans-subtitle');
  if (subEl) {
    subEl.textContent = AppLang.t('translation_sub', { source: pair.source.localName, lang: pair.target.localName });
  }

  // Build lang badge with shared flag module
  const badge = document.getElementById('lang-badge');
  if (badge && typeof AppFlags !== 'undefined') {
    badge.appendChild(AppFlags.stack(pair.source.flags[0], pair.source.flags[1]));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    badge.appendChild(arrow);
    badge.appendChild(AppFlags.stack(pair.target.flags[0], pair.target.flags[1]));
  }

  AppData.get('word-equivalents')
    .then(data => {
      const { flatMap } = AppText.buildEquivalenceMaps(data.groups || []);
      contractionMap = flatMap;
    })
    .catch(() => {}); // non-critical — comparison still works without it

  const { topic: _urlTopic, path: _pathMode, card: _pathCard } = AppActivity.pathParams();

  if (_pathMode) AppActivity.startPathMode();

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
    AppUI.addPathBackLink('exercise-area', function () { return _lastCorrect; });
  }

  AppAudio.setBase('../../shared/audio/' + AppLangPair.getActive().id + '/');
  AppAudio.warmup();
});


function showTopicPicker() {
  document.getElementById('topic-picker').classList.remove('hidden');
  document.getElementById('exercise-area').classList.add('hidden');
  AppTopicGrid.build({ badge: 'Translate', srsPrefix: 'trans_', onSelect: startTopic });
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
      const validPairs = (data.phrases || [])
        .map(p => ({
          practiceText: p.target?.[0]?.text || '',
          hintText:     p.source || '',
          forms:        p.target || [],
          level: p.level || null, grammar: p.grammar || null, id: p.id,
        }))
        .filter(p => p.hintText.trim().length > 0)
        .sort((a, b) => (_order[a.level] ?? 99) - (_order[b.level] ?? 99));

      phrases      = validPairs.map(p => p.practiceText);
      translations = validPairs.map(p => p.hintText);
      grammarNotes = validPairs.map(p => p.grammar);
      cefrLevels   = validPairs.map(p => p.level);
      cardIds      = validPairs.map(p => 'trans_' + p.id);
      formPools    = validPairs.map(p => p.forms);
      phraseIds    = validPairs.map(p => p.id);
      AppGrammarChip.load();   // preload evidence map so auto-chips are ready

      if (phrases.length === 0) {
        showTopicPicker();
        const _picker = document.getElementById('topic-picker');
        if (_picker) {
          const _msg = document.createElement('p');
          _msg.style.cssText = 'color:var(--clr-danger);font-size:0.9rem;margin:0 0 12px;text-align:center;';
          _msg.textContent = AppLang.t('no_translations');
          _picker.prepend(_msg);
          setTimeout(() => _msg.remove(), 4000);
        }
        return;
      }

      const topicObj = (AppTopics.PHRASE_TOPICS || []).find(t => t.id === topicId);
      const _pbArgs = {
        items: phrases,
        cardIds,
        topicLabel: topicObj ? AppTopics.getLabel(topicObj) : topicId,
        pickerEl: document.getElementById('topic-picker'),
        traductions: validPairs.map(p => p.hintText),
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
  currentIndex = idx;
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('exercise-area').classList.remove('hidden');
  AppSessionBar.updateStreak('trans-streak');
  showPhrase(currentIndex);
  updateCounter();
}

// ---- Display ----

function _buildPool(forms) {
  return forms.filter(f => f.audioSlug !== undefined);
}

function showPhrase(index) {
  answered = false;

  // Pick the least-practiced form with audio as the audio hint (any form is
  // still accepted; coverage is recorded from the form the user actually produces)
  const _pool = _buildPool(formPools[index] || []);
  const _picked = Progress.pickVariant(cardIds[index], _pool) || _pool[0] || { text: '', audioSlug: null };
  _currentExpected = _picked.text;
  _currentAudioSlug = _picked.audioSlug ?? null;

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
  document.getElementById('alt-note')?.classList.add('hidden');
  document.getElementById('alt-note-divider')?.classList.add('hidden');
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
  badge.setAttribute('aria-label', AppLang.t('cefr_level_aria', { level }));
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

  const _norm = s => AppText.normalise(s, contractionMap);
  const forms = formPools[currentIndex] || [];
  const isCorrect = forms.some(f => _norm(raw) === _norm(f.text));
  _lastCorrect = isCorrect;

  // Identify the specific form the user actually matched (may differ from _currentExpected for style variants)
  const _matchedForm = isCorrect ? forms.find(f => _norm(f.text) === _norm(raw)) : null;
  const _matchedText = _matchedForm?.text ?? _currentExpected;
  if (_matchedForm?.audioSlug) _currentAudioSlug = _matchedForm.audioSlug;

  Progress.rate(cardIds[currentIndex], PathSession.getQualityFromResult(isCorrect));
  // Translation accepts any form — record the variant the user actually produced
  if (_matchedForm?.audioSlug) Progress.recordVariant(cardIds[currentIndex], _matchedForm.audioSlug);
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(cefrLevels[currentIndex], isCorrect, 'translation');
  Progress.recordSession('trans_' + currentTopic, isCorrect ? 1 : 0, 1);
  if (isCorrect) updateCounter();

  const resultEl = document.getElementById('feedback-result');
  const diffEl   = document.getElementById('trans-diff');
  const feedback = document.getElementById('trans-feedback');
  const card     = document.getElementById('phrase-card');

  resultEl.textContent = isCorrect ? AppLang.t('feedback_correct') : AppLang.t('feedback_incorrect');
  resultEl.className   = 'feedback-result ' + (isCorrect ? 'correct' : 'incorrect');
  card.classList.add(isCorrect ? 'phrase-card--correct' : 'phrase-card--incorrect');

  diffEl.textContent = '';
  diffEl.appendChild(
    isCorrect
      ? AppFeedback.buildCorrect(_matchedText)
      : AppFeedback.buildDiff(raw, AppText.closestPhrase(raw, forms.map(f => f.text), contractionMap), contractionMap)
  );

  feedback.className = 'trans-feedback ' + (isCorrect ? 'correct' : 'incorrect');

  // Grammar (correct only). Chip (link to a rule) and the authored tip TEXT are
  // independent: the chip is the most-advanced rule the phrase exercises (and is
  // hidden in path mode / when no rule applies), while the tip-text panel appears
  // only when a human note exists for the phrase.
  const chipWrap  = document.getElementById('grammar-chip-wrap');
  const tipEl     = document.getElementById('feedback-grammar-tip');
  const dividerEl = document.getElementById('feedback-divider');
  const authoredTip = isCorrect ? grammarNotes[currentIndex] : null;
  const chosen = isCorrect
    ? AppGrammarChip.choose({ tip: grammarNotes[currentIndex], id: phraseIds[currentIndex], pathMode: _pathModeActive })
    : null;

  if (chosen && chosen.ruleId && chipWrap) {
    document.getElementById('grammar-chip-label').textContent = chosen.label;
    document.getElementById('grammar-chip').href = '../../grammar/html/grammar.html?rule=' + chosen.ruleId;
    chipWrap.classList.remove('hidden');
  } else if (chipWrap) {
    chipWrap.classList.add('hidden');
  }

  if (authoredTip) {
    const tipTextEl = document.getElementById('feedback-grammar-tip-text');
    if (tipTextEl) tipTextEl.textContent = authoredTip;
    if (tipEl)     tipEl.classList.remove('hidden');
    if (dividerEl) dividerEl.classList.remove('hidden');
  } else {
    if (tipEl)     tipEl.classList.add('hidden');
    if (dividerEl) dividerEl.classList.add('hidden');
  }

  // Alternative chips (correct only) — typed alts excluding what the user actually wrote.
  // If user matched a style variant, show _currentExpected as the "También" base chip.
  const altNoteEl    = document.getElementById('alt-note');
  const altDividerEl = document.getElementById('alt-note-divider');
  if (isCorrect && altNoteEl) {
    const altsToShow = forms.filter(f => _norm(f.text) !== _norm(_matchedText));
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

  document.getElementById('listen-btn').classList.remove('hidden');
  feedback.classList.remove('hidden');
  document.getElementById('next-btn').classList.toggle('hidden', !_lastCorrect);
  document.getElementById('try-again-btn').classList.remove('hidden');  // siempre: acierto→avanzar o reforzar; fallo→reintentar
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

  AppSessionBar.updateStreak('trans-streak');

  currentIndex = (currentIndex + 1) % phrases.length;
  showPhrase(currentIndex);
}

function _showPathSessionComplete() {
  AppAudio.cancel();
  AppUI.sessionComplete();
}

// ---- Counter ----

function updateCounter() {
  AppSessionBar.updateCounter('trans-counter', cardIds, _pathModeActive);
}

// ---- TTS (Kokoro via AppTTS) ----

function playTTS(text) {
  if (!text) return;
  AppAudio.play(currentTopic, _currentAudioSlug ?? '', text);
}

// extractGrammarInfo is in shared/js/grammar-chip.js
