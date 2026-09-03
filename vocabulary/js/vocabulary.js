/* ============================================================
   vocabulary.js — Flashcard Vocabulary Trainer with SRS
   ============================================================ */


let _openPhraseBrowser = null;


let currentTopicId  = '';
let vocabTopicKey   = '';  // SRS prefix
let words           = [];
let cardIds         = [];
let currentIndex    = 0;
let _currentPickedForm = null;  // the rotated form shown for a lexical-variant word this round
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
  await AppActivity.loadData();
  const { topic: _urlTopic, path: _pathMode, card: _pathCard } = AppActivity.pathParams();

  if (_pathMode) AppActivity.startPathMode();

  if (_urlTopic && AppTopics.VOCAB_TOPICS.some(t => t.id === _urlTopic)) {
    startTopic(_urlTopic, _pathMode, _pathCard);
  } else {
    AppTopicGrid.build(_vocabGridOpts());
  }

  let _playSeq = 0;
  async function _playCurrentWord(e) {
    e.stopPropagation(); // prevent card flip
    const word = words[currentIndex];
    if (!word) return;
    const _topic = currentTopicId === 'general' ? 'vocab' : 'vocab_' + currentTopicId;
    // A word with variants shows ALL its forms on the front, so Listen plays EVERY form in sequence
    // (der Mann, den Mann, dem Mann, des Mannes) — not just the first. A re-click starts a new
    // sequence (the token guard stops the old one). A plain word plays its term.
    if (word.variants && word.variants.length) {
      const tok = ++_playSeq;
      for (const v of word.variants) {
        if (tok !== _playSeq) return;                         // superseded by a newer click
        if (v && v.audioSlug) await AppAudio.play(_topic, v.audioSlug, v.text);
      }
    } else {
      AppAudio.play(_topic, word.id, word.term);
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
    AppUI.addPathBackLink('vocab-content', function () { return isFlipped; });
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
        // The index label shows the word's VERSIONS: every variant form joined by " / " (each
        // capitalised), or the plain term when the word has no variants — so the list keeps showing
        // "Das Kind / Die Kinder", "Der Mann / Den Mann / …" as it did before the lemma change.
        traductions: _tagged.map(w => {
          const s = (w.variants && w.variants.length) ? w.variants.map(v => v.text).join(' / ') : (w.term || '');
          return s.replace(/(^|\/\s*)(\p{L})/gu, (m, p, c) => p + c.toUpperCase());
        }),
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

// Level-adaptive definition with a two-flag SWITCH. l1 = source-language gloss, l2 = target-language
// definition. A1/A2 default to L1 (source), B1+ to L2 (target). The switch shows two flags — source
// on the LEFT, target on the RIGHT — with the active one highlighted; tapping a flag shows that
// language's definition (intuitive: the flag says which language). Shown only when BOTH exist.
function _setupDefinition(l1, l2, level) {
  const defEl = document.getElementById('word-definition');
  const sw    = document.getElementById('fc-def-switch');
  const l1Btn = document.getElementById('fc-def-l1');
  const l2Btn = document.getElementById('fc-def-l2');
  if (!defEl) return;
  const pair    = AppLangPair.getActive();
  const hasBoth = !!l1 && !!l2;
  const beginner = (CEFR_ORDER[level] ?? 99) <= 1;   // A1/A2
  let showL1 = hasBoth ? beginner : !!l1;            // if only one exists, show it (switch hidden)

  const render = () => {
    defEl.textContent = showL1 ? (l1 || l2) : (l2 || l1);
    if (sw) {
      sw.classList.toggle('hidden', !hasBoth);
      if (l1Btn) l1Btn.classList.toggle('fc-def-side--active', showL1);
      if (l2Btn) l2Btn.classList.toggle('fc-def-side--active', !showL1);
    }
  };

  if (sw && hasBoth) {
    // Each side shows the language's OWN flag(s) — the same 1/2/3-flag stack that represents the pair
    // (Spanish es/mx/ar, English us/gb), not a single flag — via AppFlags.langFlags.
    const fill = (btn, flags, code, langName, cb) => {
      if (!btn) return;
      btn.textContent = '';
      if (typeof AppFlags !== 'undefined' && AppFlags.langFlags)
        btn.appendChild(AppFlags.langFlags((flags && flags.length) ? flags : [code]));
      btn.setAttribute('aria-label', AppLang.t('fc_def_show', { lang: langName }));
      btn.title = langName;
      btn.onclick = cb;
    };
    fill(l1Btn, pair.source.flags, pair.source.code, pair.source.localName || pair.source.name, () => { showL1 = true;  render(); });
    fill(l2Btn, pair.target.flags, pair.target.code, pair.target.localName || pair.target.name, () => { showL1 = false; render(); });
  }
  render();
}

function showCard(index) {
  const word = words[index];
  if (!word) return;
  isFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');

  const _srcCode     = AppLangPair.getActive().source.code;
  // Capitalize the first letter of EVERY slash-separated form ("carta / letra" → "Carta / Letra").
  const _capParts    = (s) => (s || '').replace(/(^|\/\s*)(\p{L})/gu, (m, p, c) => p + c.toUpperCase());

  // Rotation: a LEXICAL-variant word (region/synonym…) shows ONE form per session — no base, like
  // phrases, coverage-aware via pickVariant. INFLECTIONAL words (slash term, no variants[]) show the
  // pattern (term). The recognition strip then lists the OTHER forms.
  _currentPickedForm = null;
  const _lexical = (word.variants || []).filter(v =>
    Object.keys((v && v.labels) || {}).some(d => (typeof AppVariantDims !== 'undefined' && AppVariantDims.kind(d)) === 'lexical'));
  let _headword = word.term;
  if (_lexical.length > 1 && typeof Progress !== 'undefined' && Progress.pickVariant) {
    const _picked = Progress.pickVariant(cardIds[index], word.variants) || word.variants[0];
    if (_picked) {
      _currentPickedForm = _picked;
      _headword = _picked.text;
      if (Progress.recordVariant && _picked.audioSlug) Progress.recordVariant(cardIds[index], _picked.audioSlug);
    }
  }
  const _displayWord = _capParts(_headword);
  const _displayHint = _capParts(word.translations?.[_srcCode] || '');   // capitalize like the headword ("Kilogram")

  // Front
  const _POS = { Noun: 'pos_noun', Verb: 'pos_verb', Adjective: 'pos_adjective', Adverb: 'pos_adverb' };
  const _posLabel = word.category ? AppLang.t(_POS[word.category] || word.category) : '';
  // Front shows the word's FORMS: variants grouped in bordered boxes whose CONNECTED header carries the
  // POS + group label (no floating labels). A word with no variants shows its plain term + POS above.
  const _wtEl = document.getElementById('word-text');
  _wtEl.textContent = '';
  _wtEl.classList.remove('word-text--variants');
  const _frontFrag = (word.variants && word.variants.length && typeof AppFeedback !== 'undefined' && AppFeedback.buildWordVariants)
    ? AppFeedback.buildWordVariants(word.variants, null, AppLang.t, _posLabel) : null;
  // POS lives INSIDE the box header when the box is shown; otherwise it's the small label above the word.
  document.getElementById('word-category').textContent = _frontFrag ? '' : _posLabel;
  if (_frontFrag) { _wtEl.classList.add('word-text--variants'); _wtEl.appendChild(_frontFrag); }
  else { _wtEl.textContent = _displayWord; _renderCurrentFormBadge('word-text', _currentPickedForm); }

  // Back is the MEANING side: the word's identity (its lemma/term) + definition/example/translation.
  document.getElementById('fc-back-word').textContent = _frontFrag ? _capParts(word.term || '') : _displayWord;
  if (!_frontFrag) _renderCurrentFormBadge('fc-back-word', _currentPickedForm);
  // Definition: L1 (source-language gloss) vs L2 (target-language definition). Default follows the
  // CEFR level — A1/A2 lead with L1 (the learner can't yet parse an L2 definition), B1+ lead with L2
  // (monolingual) — and a toggle swaps to the other. The L1 translation stays visible below as the
  // safety net so no external lookup is ever needed. (Laufer & Shmueli 1997.)
  _setupDefinition((word.gloss && word.gloss[_srcCode]) || '', word.definition || '', word.level);
  document.getElementById('word-example').textContent    = word.example || (word.gloss_example?.[_srcCode] || '');
  document.getElementById('word-translation').textContent = _displayHint;

  // The BACK shows a COMPACT one-line list of the forms (below the meaning) — a reference, not the whole
  // table again (which read as "too much"). The full table is on the front.
  const _vBlock = document.getElementById('fc-variants-block');
  const _vHost  = document.getElementById('word-variants');
  if (_vHost) _vHost.textContent = '';
  const _vBack = (word.variants && word.variants.length && typeof AppFeedback !== 'undefined' && AppFeedback.buildWordVariantsCompact)
    ? AppFeedback.buildWordVariantsCompact(word.variants, null, AppLang.t) : null;
  if (_vBack && _vHost) { _vHost.appendChild(_vBack); _vBlock && _vBlock.classList.remove('hidden'); }
  else if (_vBlock) { _vBlock.classList.add('hidden'); }

  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('back-to-path')?.classList.add('hidden');
  _showCefrBadge(word.level, 'flashcard-front');
  _showCefrBadge(word.level, 'flashcard-back');
}

// Badge for the SHOWN rotated form's own variant (region flag / register pill), placed inline next to
// the word so the learner sees WHICH variety the headword is (e.g. "Ordenador · España"), not only
// the others. Mirrors the exercise variant badge. Gender never reaches here — a gender word keeps the
// dictionary-slash headword and does not rotate, so `form` is null and no badge is shown. The `synonym`
// dimension is skipped: "sinónimo" on the headword says nothing (the "Also …" strip already covers it)
// and only clutters — only INFORMATIVE varieties (region/register/loanword) get a headword badge.
function _renderCurrentFormBadge(hostId, form) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const old = host.querySelector('.fc-word-badge');
  if (old) old.remove();
  const labels = (form && form.labels) || {};
  const dims = Object.keys(labels).filter(k => labels[k] !== undefined && labels[k] !== '' && k !== 'synonym');
  if (!dims.length) return;                       // gender / synonym / single-form → word tells all
  const wrap = document.createElement('span');
  wrap.className = 'fc-word-badge';
  for (const dim of dims) {
    const val = labels[dim];
    const b = document.createElement('span');
    if (dim === 'region') {
      b.className = 'region-phrase-badge';
      if (typeof AppFlags !== 'undefined' && AppFlags.region) { const fl = AppFlags.region(val); if (fl) b.appendChild(fl); }
      const t = document.createElement('span'); t.textContent = val; b.appendChild(t);
    } else {
      b.className = 'variant-phrase-badge variant-phrase-badge--' + dim;
      b.textContent = dim === 'register' ? (val === 'formal' ? AppLang.t('alt_note_register_f') : AppLang.t('alt_note_register_i'))
                    : dim === 'loanword' ? AppLang.t('alt_note_loanword') : val;
    }
    wrap.appendChild(b);
  }
  host.appendChild(wrap);
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
