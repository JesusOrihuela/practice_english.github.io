/* ============================================================
   speaking.js — Topic Picker + Speaking Practice with SRS
   TTS: Kokoro-82M via AppTTS (shared/js/tts.js)
   STT: Whisper-tiny.en via Web Worker (shared/js/stt-worker.js)
   ============================================================ */

/* ---- Topic Picker ---- */

let _openPhraseBrowser = null;

/* ---- Exercise State ---- */

let jsConfetti;
let contractionMap = {};
let phrases = [], translations = [], grammarTips = [], cardIds = [], cefrLevels = [], formPools = [];
let _activeAudioSlug = '';   // audioSlug of the picked form for this round
let _activePicked    = null; // { text, audioSlug, labels?, ... } — picked form for this round
let currentIndex = 0;
let currentTheme = '';
let sessionCorrect = 0, sessionTotal = 0;
let attemptDone = false;
let _lastCorrect = false;

// STT — resolve worker path relative to this script
const _sttWorkerUrl = document.currentScript
  ? new URL('../../shared/js/stt-worker.js', document.currentScript.src).href
  : null;

// STT is available wherever getUserMedia + MediaRecorder exist
const HAS_STT = !!(navigator.mediaDevices && typeof MediaRecorder !== 'undefined');

let _sttWorker       = null;
let _isRecording     = false;
let _mediaRecorder   = null;
let _recordingChunks = [];
let _sttTimeoutId    = null;
let _vadIntervalId   = null;
let _vadAudioCtx     = null;
const _STT_TIMEOUT_MS = 30000;

AppData.get('word-equivalents')
  .then(data => {
    const { flatMap } = AppText.buildEquivalenceMaps(data.groups || []);
    contractionMap = flatMap;
  })
  .catch(() => {});

document.addEventListener('DOMContentLoaded', async () => {
  // Part B: load the active pair's topics before reading topic lists.
  await AppActivity.loadData();
  jsConfetti = new JSConfetti();

  const textFallback = document.getElementById('text-fallback');
  const textInput    = document.getElementById('text-input');
  const textSubmit   = document.getElementById('text-submit');

  if (!HAS_STT) {
    document.getElementById('speakButton').style.display = 'none';
    if (textFallback) textFallback.classList.remove('hidden');
  }

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_openPhraseBrowser) {
      document.getElementById('exercise-area').classList.add('hidden');
      _openPhraseBrowser();
    } else {
      showTopicPicker();
    }
  });

  document.getElementById('listenButton').addEventListener('click', playTTS);
  document.getElementById('speakButton').addEventListener('click', toggleRecording);

  if (textSubmit) {
    textSubmit.addEventListener('click', () => {
      const val = textInput.value.trim();
      if (val) { displayResult(val, 0); textInput.value = ''; }
    });
    textInput.addEventListener('keydown', e => { if (e.key === 'Enter') textSubmit.click(); });
  }

  document.getElementById('tryAgainButton').addEventListener('click', resetAttempt);
  document.getElementById('tryAnotherButton').addEventListener('click', () => {
    // Progress.rate already saved in displayResult — just record session and advance
    Progress.recordSession(currentTheme, sessionCorrect, sessionTotal);
    nextPhrase();
  });

  const { topic: _urlTopic, path: _pathMode, card: _pathCard } = AppActivity.pathParams();

  if (_pathMode) AppActivity.startPathMode();

  if (_urlTopic && AppTopics.PHRASE_TOPICS.some(t => t.id === _urlTopic)) {
    startTopic(_urlTopic, _pathMode, _pathCard);
  } else {
    AppTopicGrid.build({ badge: 'Speaking', ariaLabelSuffix: 'speaking practice', srsPrefix: '', onSelect: startTopic });
  }
  if (_pathMode) {
    AppUI.addPathBackLink('exercise-area', function () { return _lastCorrect; });
  }

  AppTTS.warmup();
  AppAudio.setBase('../../shared/audio/' + AppLangPair.getActive().id + '/');
  AppAudio.warmup();
  if (HAS_STT) _getSttWorker();
});

/* ---- Navigation ---- */

let _pathModeActive = false;
let _pathCardId     = null;


function startTopic(id, pathMode, pathCard) {
  _pathModeActive = !!pathMode;
  _pathCardId     = pathCard || null;
  currentTheme = id;
  phrases = []; translations = []; cardIds = []; formPools = [];
  sessionCorrect = 0; sessionTotal = 0;
  loadPhrases(id);
}

function showTopicPicker() {
  if (_isRecording) _stopRecording();
  AppAudio.cancel();
  AppTTS.cancel();
  document.getElementById('exercise-area').classList.add('hidden');
  document.getElementById('topic-picker').classList.remove('hidden');
  currentTheme = '';
  AppTopicGrid.build({ badge: 'Speaking', ariaLabelSuffix: 'speaking practice', srsPrefix: '', onSelect: startTopic });
}

/* ---- Data Loading ---- */

function _showLoadError(topicId) {
  showTopicPicker(); // exercise-area may already be shown
  AppUI.loadError(document.getElementById('topic-picker'), function () { startTopic(topicId); });
}

function loadPhrases(topicId) {
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
      grammarTips  = _tagged.map(x => x.grammar);
      cefrLevels   = _tagged.map(x => x.level);
      cardIds      = _tagged.map(x => x.id);
      formPools    = _tagged.map(x => x.forms);
      AppGrammarChip.load();   // preload evidence map so auto-chips are ready

      const topicObj = AppTopics.PHRASE_TOPICS.find(t => t.id === topicId);
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
        _beginExercise(0); // _beginExercise overrides idx using _pathCardId
      } else {
        _openPhraseBrowser();
      }
    })
    .catch(() => _showLoadError(currentTheme));
}

function _beginExercise(idx) {
  if (_pathModeActive && _pathCardId) {
    const cardIdx = cardIds.indexOf(_pathCardId);
    if (cardIdx !== -1) idx = cardIdx;
  }
  currentIndex = idx;
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('exercise-area').classList.remove('hidden');
  AppSessionBar.updateStreak('streak-badge');
  showPhrase(currentIndex);
  updateSessionCounter();
}

function _buildPool(forms) {
  return forms.filter(f => f.audioSlug !== undefined);
}

function showPhrase(index) {
  // Pick the least-practiced form with audio (coverage-aware rotation)
  const _pool = _buildPool(formPools[index] || []);
  _activePicked    = Progress.pickVariant(cardIds[index], _pool) || _pool[0];
  _activeAudioSlug = _activePicked.audioSlug;

  document.getElementById('Phrase').textContent     = _activePicked.text;
  document.getElementById('Traduction').textContent = translations[index] || '';
  attemptDone = false;
  const wrap = document.getElementById('grammar-chip-wrap');
  if (wrap) wrap.classList.add('hidden');
  _showCefrBadge(cefrLevels[index], 'phrase-card');
  AppFeedback.applyVariantBadge('phrase-card', _activePicked);
  resetAttempt();
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

function updateGrammarChip(index) {
  const wrap = document.getElementById('grammar-chip-wrap');
  if (!wrap) return;
  // Most-advanced rule the phrase exercises (authored tip ∪ evidence map); no chip
  // in path mode or when the phrase exercises no grammar-section rule. See AppGrammarChip.
  const info = AppGrammarChip.choose({ tip: grammarTips[index], id: cardIds[index], pathMode: _pathModeActive });
  if (!info || !info.ruleId) { wrap.classList.add('hidden'); return; }
  document.getElementById('grammar-chip-label').textContent = info.label;
  document.getElementById('grammar-chip').href = '../../grammar/html/grammar.html?rule=' + info.ruleId;
  wrap.classList.remove('hidden');
}

// extractGrammarInfo is in shared/js/grammar-chip.js

function updateSessionCounter() {
  AppSessionBar.updateCounter('session-counter', cardIds, _pathModeActive);
}

/* ---- Attempt Flow ---- */

function resetAttempt() {
  document.getElementById('listenButton').disabled = false;
  if (HAS_STT) {
    document.getElementById('speakButton').disabled  = false;
    document.getElementById('speakButton').textContent = AppLang.t('speak_btn');
    document.getElementById('speakButton').setAttribute('aria-label', AppLang.t('speak_btn_label'));
  }
  document.getElementById('tryAgainButton').classList.add('hidden');
  document.getElementById('tryAgainButton').disabled = true;
  document.getElementById('tryAnotherButton').classList.add('hidden');
  document.getElementById('tryAnotherButton').disabled = true;
  document.getElementById('recognizedText').textContent = AppLang.t('speak_prompt');
  document.getElementById('recognizedText').className = '';
  const card = document.getElementById('phrase-card');
  if (card) { card.classList.remove('phrase-card--correct', 'phrase-card--incorrect'); }
  const fb = document.getElementById('speaking-feedback');
  if (fb) { fb.classList.add('hidden'); fb.className = 'speaking-feedback hidden'; }
  const fbr = document.getElementById('speaking-feedback-result');
  if (fbr) { fbr.textContent = ''; fbr.className = 'feedback-result'; }
  const sd = document.getElementById('speaking-diff');
  if (sd) { sd.textContent = ''; sd.classList.remove('hidden'); }
  document.getElementById('alt-note')?.classList.add('hidden');
  document.getElementById('alt-note-divider')?.classList.add('hidden');
  const ti = document.getElementById('text-input');
  if (ti) ti.disabled = false;
  document.getElementById('back-to-path')?.classList.add('hidden');
}

function showRatingArea() {
  const ta = document.getElementById('tryAgainButton');
  ta.classList.remove('hidden');
  ta.disabled = false;
  // tryAnotherButton is managed per-result: shown only on correct answer or STT/mic error
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
  showPhrase(currentIndex);
  updateSessionCounter();

  const listenBtn = document.getElementById('listenButton');
  if (listenBtn) listenBtn.focus();
  AppSessionBar.updateStreak('streak-badge');
}

function _showPathSessionComplete() {
  if (_isRecording) _stopRecording();
  AppAudio.cancel();
  AppTTS.cancel();
  AppUI.sessionComplete();
}

/* ---- TTS (Kokoro via AppTTS) ---- */

function _audioRef() {
  return { topic: currentTheme, slug: _activeAudioSlug };
}

function _getSpeed() { return 1; }

function playTTS() {
  const phraseText = document.getElementById('Phrase').textContent;
  if (!phraseText) return;

  document.getElementById('listenButton').disabled = true;
  if (HAS_STT) document.getElementById('speakButton').disabled = true;

  const { topic, slug } = _audioRef();
  AppAudio.play(topic, slug, phraseText, _getSpeed()).then(() => {
    document.getElementById('listenButton').disabled = false;
    if (HAS_STT && !_isRecording) document.getElementById('speakButton').disabled = false;
  }).catch(() => {
    document.getElementById('listenButton').disabled = false;
    if (HAS_STT && !_isRecording) document.getElementById('speakButton').disabled = false;
  });
}

/* ---- STT (Whisper via Web Worker) ---- */

function _getSttWorker() {
  if (_sttWorker) return _sttWorker;
  if (!_sttWorkerUrl) return null;

  _sttWorker = new Worker(_sttWorkerUrl, { type: 'module' });

  _sttWorker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      _onSttProgress(data);
      return;
    }
    if (data.type === 'ready') {
      _onSttReady();
      return;
    }
    if (data.type === 'done')  _onTranscript(data.text);
    if (data.type === 'error') _onSttError(data.message);
  };

  _sttWorker.onerror = (e) => {
    const detail = [e.message, e.filename && ('at ' + e.filename + ':' + e.lineno)].filter(Boolean).join(' ');
_onSttError(AppLang.t('stt_load_error'));
  };

  return _sttWorker;
}

/* ---- STT Download Progress Panel ---- */

const _sttDp = AppDownloadPanel.create(AppLang.t('stt_loading'), AppLang.t('stt_ready'), 'pe_stt_cached');

function _onSttProgress(p) {
  if (p.status === 'initiate') {
    _sttDp.show();
  } else if (p.status === 'progress' && p.progress != null) {
    _sttDp.update(p.progress);
  }
}

function _onSttReady() {
  _sttDp.complete();
}

function toggleRecording() {
  if (_isRecording) _stopRecording();
  else _startRecording();
}

async function _startRecording() {
  clearTimeout(_sttTimeoutId); // cancel any leftover timeout from a previous attempt
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _mediaRecorder   = new MediaRecorder(stream);
    _recordingChunks = [];

    _mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) _recordingChunks.push(e.data); };
    _mediaRecorder.start();
    _isRecording = true;

    document.getElementById('listenButton').disabled = true;
    document.getElementById('speakButton').textContent = AppLang.t('stop_recording');
    document.getElementById('speakButton').setAttribute('aria-label', AppLang.t('stop_recording_label'));
    { document.getElementById('recognizedText').textContent = AppLang.t('recording_prompt'); document.getElementById('recognizedText').className = ''; }

    // VAD: auto-stop after 1.5 s of silence following detected speech
    try {
      _vadAudioCtx = new AudioContext();
      const src      = _vadAudioCtx.createMediaStreamSource(stream);
      const analyser = _vadAudioCtx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let speechDetected = false;
      let silenceStart   = null;
      const THRESHOLD  = 15;    // peak amplitude above 128 (0–128 scale)
      const SILENCE_MS = 2500;  // ms of silence after speech → auto-stop

      _vadIntervalId = setInterval(() => {
        if (!_isRecording) { clearInterval(_vadIntervalId); _vadIntervalId = null; return; }
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let k = 0; k < buf.length; k++) {
          const v = Math.abs(buf[k] - 128);
          if (v > peak) peak = v;
        }
        if (peak > THRESHOLD) {
          speechDetected = true;
          silenceStart   = null;
          { document.getElementById('recognizedText').textContent = AppLang.t('listening_prompt'); document.getElementById('recognizedText').className = 'vad-active'; }
        } else if (speechDetected) {
          if (!silenceStart) silenceStart = Date.now();
          { document.getElementById('recognizedText').textContent = AppLang.t('recording_prompt'); document.getElementById('recognizedText').className = ''; }
          if (Date.now() - silenceStart >= SILENCE_MS) {
            clearInterval(_vadIntervalId);
            _vadIntervalId = null;
            _stopRecording();
          }
        }
      }, 80);
    } catch (_) { /* VAD is optional — fall through to manual stop */ }

  } catch (e) {
    const msgs = {
      NotAllowedError : AppLang.t('mic_blocked'),
      NotFoundError   : AppLang.t('mic_not_found'),
    };
    const errMsg = msgs[e.name] || AppLang.t('mic_error');
    document.getElementById('recognizedText').textContent = '';
    document.getElementById('recognizedText').className = '';
    const _fbr = document.getElementById('speaking-feedback-result');
    if (_fbr) { _fbr.textContent = '✗ Error'; _fbr.className = 'feedback-result incorrect'; }
    const _sd = document.getElementById('speaking-diff');
    if (_sd) _sd.textContent = errMsg;
    const _fb = document.getElementById('speaking-feedback');
    if (_fb) { _fb.className = 'speaking-feedback incorrect'; _fb.classList.remove('hidden'); }
    const _tb = document.getElementById('tryAnotherButton');
    _tb.classList.remove('hidden'); _tb.disabled = false;
    showRatingArea();
  }
}

function _stopRecording() {
  if (!_mediaRecorder || _mediaRecorder.state === 'inactive') return;
  _isRecording = false;

  // Clean up VAD
  clearInterval(_vadIntervalId); _vadIntervalId = null;
  if (_vadAudioCtx) { _vadAudioCtx.close().catch(() => {}); _vadAudioCtx = null; }

  document.getElementById('speakButton').disabled  = true;
  document.getElementById('speakButton').textContent = AppLang.t('transcribing');
  document.getElementById('speakButton').setAttribute('aria-label', AppLang.t('transcribing_label'));

  _mediaRecorder.onstop = async () => {
    _mediaRecorder.stream.getTracks().forEach(t => t.stop());

    const blob = new Blob(_recordingChunks, { type: 'audio/webm' });
    try {
      const ab      = await blob.arrayBuffer();
      const ctx     = new AudioContext({ sampleRate: 16000 });
      const decoded = await ctx.decodeAudioData(ab);
      const audio   = decoded.getChannelData(0);
      ctx.close().catch(() => {});   // browsers cap concurrent AudioContexts (~6); release it

      const worker = _getSttWorker();
      if (!worker) { _onSttError(AppLang.t('stt_not_available')); return; }
      const _sttLang = AppLangPair.getActive().sttLanguage || 'english';
      worker.postMessage({ id: Date.now(), audio, language: _sttLang }, [audio.buffer]);

      // Safety timeout: if Whisper hangs and never responds, unblock the UI
      _sttTimeoutId = setTimeout(() => {
        _onSttError(AppLang.t('transcription_timeout'));
      }, _STT_TIMEOUT_MS);
    } catch (e) {
      _onSttError(e.message);
    }
  };

  _mediaRecorder.stop();
}

function _isBlankAudio(text) {
  if (!text || !text.trim()) return true;
  const t = text.trim();
  // Whisper placeholder tokens for silence/noise
  if (/^\[.*\]$/.test(t)) return true;
  // Single word or very short — likely noise artifact
  if (t.replace(/[^a-z]/gi, '').length < 3) return true;
  return false;
}

function _onTranscript(text) {
  clearTimeout(_sttTimeoutId);
  document.getElementById('speakButton').disabled  = false;
  document.getElementById('speakButton').textContent = AppLang.t('speak_btn');
  document.getElementById('speakButton').setAttribute('aria-label', AppLang.t('speak_btn_label'));

  if (_isBlankAudio(text)) {
    _showNotUnderstood();
    return;
  }

  displayResult(text, 0);
}

function _showNotUnderstood() {
  document.getElementById('recognizedText').textContent = '';
  document.getElementById('recognizedText').className   = '';

  // Show neutral warning — no diff, no SRS penalty, no incorrect state
  const fb  = document.getElementById('speaking-feedback');
  const fbr = document.getElementById('speaking-feedback-result');
  const sd  = document.getElementById('speaking-diff');
  const card = document.getElementById('phrase-card');

  if (fbr) { fbr.textContent = AppLang.t('not_understood'); fbr.className = 'feedback-result not-understood'; }
  if (sd)  { sd.textContent = ''; sd.classList.add('hidden'); }
  if (fb)  { fb.className = 'speaking-feedback not-understood'; fb.classList.remove('hidden'); }
  if (card) { card.classList.remove('phrase-card--correct', 'phrase-card--incorrect'); }

  // Re-enable speak/listen so user can try again immediately
  document.getElementById('listenButton').disabled = false;
  if (HAS_STT) {
    document.getElementById('speakButton').disabled   = false;
    document.getElementById('speakButton').textContent = AppLang.t('speak_btn');
  }
  document.getElementById('tryAgainButton').classList.remove('hidden');
  document.getElementById('tryAgainButton').disabled = false;
}

function _onSttError(errMsg) {
  clearTimeout(_sttTimeoutId);
  _isRecording = false;
  document.getElementById('listenButton').disabled = false;
  document.getElementById('speakButton').disabled  = false;
  document.getElementById('speakButton').textContent = AppLang.t('speak_btn');
  document.getElementById('speakButton').setAttribute('aria-label', AppLang.t('speak_btn_label'));
  document.getElementById('recognizedText').textContent = '';
  document.getElementById('recognizedText').className = '';
  const fbr = document.getElementById('speaking-feedback-result');
  if (fbr) { fbr.textContent = '✗ Error'; fbr.className = 'feedback-result incorrect'; }
  const sd = document.getElementById('speaking-diff');
  if (sd) sd.textContent = errMsg || AppLang.t('generic_error');
  const fb = document.getElementById('speaking-feedback');
  if (fb) { fb.className = 'speaking-feedback incorrect'; fb.classList.remove('hidden'); }
  // A transcription failure is NOT a completed attempt — offer RETRY, not "Siguiente".
  // (Advancing is only for a correct answer or a mic-permission error, where the user
  // genuinely can't record.) Keep the advance button hidden so an error never looks done.
  document.getElementById('tryAnotherButton').classList.add('hidden');
  document.getElementById('tryAnotherButton').disabled = true;
  showRatingArea();   // shows only "try again"; nothing was rated (no Progress.rate on error)
}

/* ---- Result Display ---- */

function displayResult(text, confidence) {
  const originalPhrase = document.getElementById('Phrase').textContent.trim();
  const _norm = s => AppText.normalise(s, contractionMap);
  const forms = formPools[currentIndex] || [];
  // Speaking: only the specific displayed/played form is acceptable — not any other variant.
  const isCorrect = _norm(text) === _norm(originalPhrase);

  attemptDone = true;
  _lastCorrect = isCorrect;
  sessionTotal++;

  Progress.rate(cardIds[currentIndex], PathSession.getQualityFromResult(isCorrect));
  if (_activeAudioSlug) Progress.recordVariant(cardIds[currentIndex], _activeAudioSlug);
  if (typeof AppProficiency !== 'undefined') AppProficiency.update(cefrLevels[currentIndex], isCorrect, 'speaking');

  const fbr = document.getElementById('speaking-feedback-result');
  const sd  = document.getElementById('speaking-diff');
  const fb  = document.getElementById('speaking-feedback');

  const card = document.getElementById('phrase-card');
  if (isCorrect) {
    sessionCorrect++;
    let confettiCount = 100;
    if (confidence >= 0.975)     { confettiCount = 800; }
    else if (confidence >= 0.95) { confettiCount = 350; }
    else if (confidence >= 0.9)  { confettiCount = 120; }
    else if (confidence > 0)     { confettiCount = 50; }
    document.getElementById('recognizedText').textContent = '';
    document.getElementById('recognizedText').className   = '';
    if (fbr)  { fbr.textContent = AppLang.t('feedback_correct'); fbr.className = 'feedback-result correct'; }
    if (sd)   { sd.textContent = ''; sd.appendChild(AppFeedback.buildCorrect(_activePicked ? _activePicked.text : originalPhrase)); }
    if (fb)   { fb.className = 'speaking-feedback correct'; fb.classList.remove('hidden'); }
    if (card) { card.classList.add('phrase-card--correct'); }
    jsConfetti.addConfetti({ confettiNumber: confettiCount });
    const tb = document.getElementById('tryAnotherButton');
    tb.classList.remove('hidden'); tb.disabled = false;
    updateGrammarChip(currentIndex);

    // Alternative chips
    const altNoteEl    = document.getElementById('alt-note');
    const altDividerEl = document.getElementById('alt-note-divider');
    if (altNoteEl) {
      const altsToShow = forms.filter(f => _norm(f.text) !== _norm(originalPhrase));
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
    }
  } else {
    document.getElementById('recognizedText').textContent = '';
    document.getElementById('recognizedText').className   = '';
    if (fbr)  { fbr.textContent = AppLang.t('feedback_incorrect'); fbr.className = 'feedback-result incorrect'; }
    if (sd)   { sd.textContent = ''; sd.appendChild(AppFeedback.buildDiff(text, AppText.closestPhrase(text, forms.map(f => f.text), contractionMap), contractionMap)); }
    if (fb)   { fb.className = 'speaking-feedback incorrect'; fb.classList.remove('hidden'); }
    if (card) { card.classList.add('phrase-card--incorrect'); }
    // document.getElementById('tryAnotherButton') stays disabled — user must Try Again
  }

  document.getElementById('listenButton').disabled = false; // keep enabled so learner can replay for comparison
  if (HAS_STT) {
    document.getElementById('speakButton').disabled  = true;
    document.getElementById('speakButton').textContent = AppLang.t('speak_btn');
    document.getElementById('speakButton').setAttribute('aria-label', AppLang.t('speak_btn_label'));
  }
  const ti = document.getElementById('text-input');
  if (ti) ti.disabled = true;

  document.getElementById('back-to-path')?.classList.remove('hidden');
  showRatingArea();
}

/* ---- Word-level Diff — delegated to AppFeedback (shared/js/feedback.js) ---- */

