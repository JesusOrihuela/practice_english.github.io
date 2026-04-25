/* ============================================================
   speaking.js — Topic Picker + Speaking Practice with SRS
   TTS: Kokoro-82M via AppTTS (shared/js/tts.js)
   STT: Whisper-tiny.en via Web Worker (shared/js/stt-worker.js)
   ============================================================ */

/* ---- Topic Picker ---- */

const LAST_KEY = 'pe_last_speaking';
let _openPhraseBrowser = null;

/* ---- Exercise State ---- */

let jsConfetti;
let contractionMap = {};
let phrases = [], translations = [], grammarTips = [], cardIds = [];
let currentIndex = 0;
let currentTheme = '';
let sessionCorrect = 0, sessionTotal = 0;
let attemptDone = false;

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

document.addEventListener('DOMContentLoaded', () => {
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

  AppTopicGrid.build({ badge: 'Speaking', ariaLabelSuffix: 'speaking practice', srsPrefix: '', onSelect: startTopic });
  AppTTS.warmup();
  AppAudio.setBase('../../shared/audio/');
  AppAudio.warmup();
  if (HAS_STT) _getSttWorker();
});

/* ---- Navigation ---- */

function startTopic(id) {
  localStorage.setItem(LAST_KEY, id);
  currentTheme = id;
  phrases = []; translations = []; cardIds = [];
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
  showTopicPicker(); // return to picker — exercise-area may have been shown already

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
  txt.textContent = '⚠️ Error loading topic. Check your connection.';

  const btn = document.createElement('button');
  btn.textContent = 'Retry →';
  Object.assign(btn.style, {
    background: 'var(--clr-danger)', color: '#fff', border: 'none',
    borderRadius: 'var(--radius-full)', padding: '6px 14px',
    fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700',
    cursor: 'pointer', flexShrink: '0',
  });
  btn.addEventListener('click', () => { banner.remove(); startTopic(topicId); });

  banner.appendChild(txt);
  banner.appendChild(btn);
  const section = document.getElementById('topic-picker');
  if (section) section.insertBefore(banner, section.firstChild);
}

function loadPhrases(topicId) {
  AppData.get(topicId)
    .then(data => {
      phrases      = data.phrases;
      translations = data.traductions || [];
      grammarTips  = data.grammar || [];
      cardIds      = phrases.map((_, i) => topicId + '_' + i);

      const topicObj = AppTopics.PHRASE_TOPICS.find(t => t.id === topicId);
      const _pbArgs = {
        items: phrases,
        cardIds,
        topicLabel: topicObj ? topicObj.label : topicId,
        pickerEl: document.getElementById('topic-picker'),
        traductions: data.traductions || null,
        onStart: idx => _beginExercise(idx),
      };
      _openPhraseBrowser = () => PhraseBrowser.show(_pbArgs);
      _openPhraseBrowser();
    })
    .catch(() => _showLoadError(currentTheme));
}

function _beginExercise(idx) {
  currentIndex = idx;
  document.getElementById('topic-picker').classList.add('hidden');
  document.getElementById('exercise-area').classList.remove('hidden');
  const streakBadge = document.getElementById('streak-badge');
  if (streakBadge) {
    const streak = Progress.getStreak();
    streakBadge.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  }
  showPhrase(currentIndex);
  updateSessionCounter();
}

function showPhrase(index) {
  document.getElementById('Phrase').textContent     = phrases[index] || '';
  document.getElementById('Traduction').textContent = translations[index] || '';
  attemptDone = false;
  const wrap = document.getElementById('grammar-chip-wrap');
  if (wrap) wrap.classList.add('hidden');
  resetAttempt();
}

function updateGrammarChip(index) {
  const wrap = document.getElementById('grammar-chip-wrap');
  if (!wrap) return;
  const tip = grammarTips[index] || null;
  if (!tip) { wrap.classList.add('hidden'); return; }
  const { label, ruleId } = extractGrammarInfo(tip);
  // Only show the chip when there is a direct link to a specific grammar rule.
  // Going to the Grammar main page without context is not useful.
  if (!ruleId) { wrap.classList.add('hidden'); return; }
  document.getElementById('grammar-chip-label').textContent = label;
  document.getElementById('grammar-chip').href = '../../grammar/html/grammar.html?rule=' + ruleId;
  wrap.classList.remove('hidden');
}

// extractGrammarInfo is in shared/js/grammar-chip.js

function updateSessionCounter() {
  const el = document.getElementById('session-counter');
  if (!el || phrases.length === 0) return;
  const stats = Progress.getTopicStats(currentTheme, phrases.length);
  el.textContent = stats.seen + ' / ' + stats.total + ' learned';
  const pct = stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0;
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const bar = document.getElementById('session-progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', pct);
}

/* ---- Attempt Flow ---- */

function resetAttempt() {
  document.getElementById('listenButton').disabled = false;
  if (HAS_STT) {
    document.getElementById('speakButton').disabled  = false;
    document.getElementById('speakButton').textContent = '🎙️ Speak';
    document.getElementById('speakButton').setAttribute('aria-label', 'Speak the phrase aloud');
  }
  document.getElementById('tryAgainButton').classList.add('hidden');
  document.getElementById('tryAgainButton').disabled = true;
  document.getElementById('tryAnotherButton').classList.add('hidden');
  document.getElementById('tryAnotherButton').disabled = true;
  document.getElementById('recognizedText').textContent = "Press the button when you're ready to talk";
  document.getElementById('recognizedText').className = '';
  const card = document.getElementById('phrase-card');
  if (card) { card.classList.remove('phrase-card--correct', 'phrase-card--incorrect'); }
  const fb = document.getElementById('speaking-feedback');
  if (fb) { fb.classList.add('hidden'); fb.className = 'speaking-feedback hidden'; }
  const fbr = document.getElementById('speaking-feedback-result');
  if (fbr) { fbr.textContent = ''; fbr.className = 'feedback-result'; }
  const sd = document.getElementById('speaking-diff');
  if (sd) { sd.textContent = ''; sd.classList.remove('hidden'); }
  const ti = document.getElementById('text-input');
  if (ti) ti.disabled = false;
}

function showRatingArea() {
  const ta = document.getElementById('tryAgainButton');
  ta.classList.remove('hidden');
  ta.disabled = false;
  // tryAnotherButton is managed per-result: shown only on correct answer or STT/mic error
}

function nextPhrase() {
  currentIndex = (currentIndex + 1) % phrases.length;
  showPhrase(currentIndex);
  updateSessionCounter();

  const listenBtn = document.getElementById('listenButton');
  if (listenBtn) listenBtn.focus();
  const streak = Progress.getStreak();
  const el = document.getElementById('streak-badge');
  if (el) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
}

/* ---- TTS (Kokoro via AppTTS) ---- */

function _audioRef() {
  return { topic: currentTheme, index: currentIndex };
}

function _getSpeed() { return 1; }

function playTTS() {
  const phraseText = document.getElementById('Phrase').textContent;
  if (!phraseText) return;

  document.getElementById('listenButton').disabled = true;
  if (HAS_STT) document.getElementById('speakButton').disabled = true;

  const { topic, index } = _audioRef();
  AppAudio.play(topic, index, phraseText, _getSpeed()).then(() => {
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
    console.error('[AppSTT] Worker failed to load:', detail || e);
    _onSttError('Speech recognition model could not load. Check your connection and try again.');
  };

  return _sttWorker;
}

/* ---- STT Download Progress Panel ---- */

const _sttDp = AppDownloadPanel.create('🎙️ Loading speech model…', '🎙️ Speech model ready ✓', 'pe_stt_cached');

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
    document.getElementById('speakButton').textContent = '⏹ Stop';
    document.getElementById('speakButton').setAttribute('aria-label', 'Stop recording');
    { document.getElementById('recognizedText').textContent = '🎙 Recording… tap Stop when done'; document.getElementById('recognizedText').className = ''; }

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
          { document.getElementById('recognizedText').textContent = '🎙 Listening…'; document.getElementById('recognizedText').className = 'vad-active'; }
        } else if (speechDetected) {
          if (!silenceStart) silenceStart = Date.now();
          { document.getElementById('recognizedText').textContent = '🎙 Recording… tap Stop when done'; document.getElementById('recognizedText').className = ''; }
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
      NotAllowedError : 'Microphone access blocked. Allow it in your browser settings.',
      NotFoundError   : 'No microphone found. Please connect one and try again.',
    };
    const errMsg = msgs[e.name] || 'Could not access microphone. Please try again.';
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
  document.getElementById('speakButton').textContent = '⏳ Transcribing…';
  document.getElementById('speakButton').setAttribute('aria-label', 'Transcribing your speech');

  _mediaRecorder.onstop = async () => {
    _mediaRecorder.stream.getTracks().forEach(t => t.stop());

    const blob = new Blob(_recordingChunks, { type: 'audio/webm' });
    try {
      const ab      = await blob.arrayBuffer();
      const ctx     = new AudioContext({ sampleRate: 16000 });
      const decoded = await ctx.decodeAudioData(ab);
      const audio   = decoded.getChannelData(0);

      const worker = _getSttWorker();
      if (!worker) { _onSttError('Speech recognition not available.'); return; }
      worker.postMessage({ id: Date.now(), audio }, [audio.buffer]);

      // Safety timeout: if Whisper hangs and never responds, unblock the UI
      _sttTimeoutId = setTimeout(() => {
        _onSttError('Transcription timed out. Please try again.');
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
  document.getElementById('speakButton').textContent = '🎙️ Speak';
  document.getElementById('speakButton').setAttribute('aria-label', 'Speak the phrase aloud');

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

  if (fbr) { fbr.textContent = '👂 Couldn\'t understand you!'; fbr.className = 'feedback-result not-understood'; }
  if (sd)  { sd.textContent = ''; sd.classList.add('hidden'); }
  if (fb)  { fb.className = 'speaking-feedback not-understood'; fb.classList.remove('hidden'); }
  if (card) { card.classList.remove('phrase-card--correct', 'phrase-card--incorrect'); }

  // Re-enable speak/listen so user can try again immediately
  document.getElementById('listenButton').disabled = false;
  if (HAS_STT) {
    document.getElementById('speakButton').disabled   = false;
    document.getElementById('speakButton').textContent = '🎙️ Speak';
  }
  document.getElementById('tryAgainButton').classList.remove('hidden');
  document.getElementById('tryAgainButton').disabled = false;
}

function _onSttError(errMsg) {
  clearTimeout(_sttTimeoutId);
  _isRecording = false;
  document.getElementById('listenButton').disabled = false;
  document.getElementById('speakButton').disabled  = false;
  document.getElementById('speakButton').textContent = '🎙️ Speak';
  document.getElementById('speakButton').setAttribute('aria-label', 'Speak the phrase aloud');
  document.getElementById('recognizedText').textContent = '';
  document.getElementById('recognizedText').className = '';
  const fbr = document.getElementById('speaking-feedback-result');
  if (fbr) { fbr.textContent = '✗ Error'; fbr.className = 'feedback-result incorrect'; }
  const sd = document.getElementById('speaking-diff');
  if (sd) sd.textContent = errMsg || 'An error occurred. Please try again.';
  const fb = document.getElementById('speaking-feedback');
  if (fb) { fb.className = 'speaking-feedback incorrect'; fb.classList.remove('hidden'); }
  document.getElementById('tryAnotherButton').classList.remove('hidden');
  document.getElementById('tryAnotherButton').disabled = false;
  showRatingArea();
}

/* ---- Result Display ---- */

function displayResult(text, confidence) {
  const originalPhrase = document.getElementById('Phrase').textContent.trim();
  const isCorrect = AppText.normalise(text, contractionMap) === AppText.normalise(originalPhrase, contractionMap);

  attemptDone = true;
  sessionTotal++;

  Progress.rate(cardIds[currentIndex], isCorrect ? 3 : 1);

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
    if (fbr)  { fbr.textContent = '✓ Correct!'; fbr.className = 'feedback-result correct'; }
    if (sd)   { sd.textContent = ''; sd.appendChild(AppFeedback.buildCorrect(originalPhrase)); }
    if (fb)   { fb.className = 'speaking-feedback correct'; fb.classList.remove('hidden'); }
    if (card) { card.classList.add('phrase-card--correct'); }
    jsConfetti.addConfetti({ confettiNumber: confettiCount });
    const tb = document.getElementById('tryAnotherButton');
    tb.classList.remove('hidden'); tb.disabled = false;
    updateGrammarChip(currentIndex);
  } else {
    document.getElementById('recognizedText').textContent = '';
    document.getElementById('recognizedText').className   = '';
    if (fbr)  { fbr.textContent = '✗ Incorrect'; fbr.className = 'feedback-result incorrect'; }
    if (sd)   { sd.textContent = ''; sd.appendChild(AppFeedback.buildDiff(text, originalPhrase, contractionMap)); }
    if (fb)   { fb.className = 'speaking-feedback incorrect'; fb.classList.remove('hidden'); }
    if (card) { card.classList.add('phrase-card--incorrect'); }
    // document.getElementById('tryAnotherButton') stays disabled — user must Try Again
  }

  document.getElementById('listenButton').disabled = false; // keep enabled so learner can replay for comparison
  if (HAS_STT) {
    document.getElementById('speakButton').disabled  = true;
    document.getElementById('speakButton').textContent = '🎙️ Speak';
    document.getElementById('speakButton').setAttribute('aria-label', 'Speak the phrase aloud');
  }
  const ti = document.getElementById('text-input');
  if (ti) ti.disabled = true;

  showRatingArea();
}

/* ---- Word-level Diff — delegated to AppFeedback (shared/js/feedback.js) ---- */

