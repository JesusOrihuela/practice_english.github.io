/* ============================================================
   speaking.js — Topic Picker + Speaking Practice with SRS
   TTS: Kokoro-82M via AppTTS (shared/js/tts.js)
   STT: Whisper-tiny.en via Web Worker (shared/js/stt-worker.js)
   ============================================================ */

/* ---- Topic Picker ---- */

const TOPICS = [
  { id: 'greetings',      label: 'Greetings'      },
  { id: 'traveling',      label: 'Traveling'      },
  { id: 'technology',     label: 'Technology'     },
  { id: 'restaurant',     label: 'Restaurant'     },
  { id: 'kitchen',        label: 'Kitchen'        },
  { id: 'supermarket',    label: 'Supermarket'    },
  { id: 'entertainment',  label: 'Entertainment'  },
  { id: 'accountability', label: 'Accountability' },
  { id: 'gym',            label: 'Gym'            },
  { id: 'mixed',          label: 'Mixed Review'   },
];

function buildTopicGrid() {
  const grid = document.getElementById('topic-grid');
  if (!grid) return;

  TOPICS.forEach((topic, i) => {
    const btn = document.createElement('button');
    btn.className = 'img-topic-card';
    btn.dataset.theme = topic.id;
    btn.style.animationDelay = (i * 0.06) + 's';
    btn.setAttribute('aria-label', topic.label + ' speaking practice');

    const isMixed = topic.id === 'mixed';
    const imgSrc  = !isMixed ? '../img/' + topic.id + '.jpg' : null;

    btn.innerHTML =
      '<div class="img-topic-card__img-wrap">' +
      (imgSrc
        ? '<img class="img-topic-card__img" src="' + imgSrc + '" alt="" loading="lazy">'
        : '<div class="speak-mixed-gradient"><span aria-hidden="true">🔀</span></div>') +
      '<div class="img-topic-card__overlay"></div>' +
      '</div>' +
      '<div class="img-topic-card__body">' +
      '<div class="img-topic-card__info">' +
      '<span class="img-topic-card__title">' + topic.label + '</span>' +
      '<span class="img-topic-card__progress" id="tp-' + topic.id + '">' +
      (isMixed ? 'All 9 topics' : '') +
      '</span>' +
      '</div>' +
      '<span class="img-topic-card__badge">' + (isMixed ? 'All Topics' : 'Speaking') + '</span>' +
      '</div>';

    btn.addEventListener('click', () => {
      startTopic(isMixed ? '__mixed__' : topic.id);
    });

    grid.appendChild(btn);

    if (!isMixed) {
      fetch('../json/' + topic.id + '.json')
        .then(r => r.json())
        .then(data => {
          const total = data.phrases ? data.phrases.length : 0;
          const s = Progress.getTopicStats(topic.id, total);
          const el = document.getElementById('tp-' + topic.id);
          if (el) el.textContent = s.seen + ' / ' + total + ' learned';
        })
        .catch(() => {});
    }
  });
}

/* ---- Exercise State ---- */

let listenButton, speakButton, tryAnotherButton, tryAgainButton, message;
let jsConfetti;
let contractionsData = null;
let phrases = [], translations = [], cardIds = [];
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

fetch('../json/contractions.json')
  .then(r => r.json())
  .then(d => { contractionsData = d.contractions; })
  .catch(() => {});

document.addEventListener('DOMContentLoaded', () => {
  jsConfetti = new JSConfetti();

  listenButton     = document.getElementById('listenButton');
  speakButton      = document.getElementById('speakButton');
  tryAnotherButton = document.getElementById('tryAnotherButton');
  tryAgainButton   = document.getElementById('tryAgainButton');
  message          = document.getElementById('recognizedText');

  const textFallback = document.getElementById('text-fallback');
  const textInput    = document.getElementById('text-input');
  const textSubmit   = document.getElementById('text-submit');

  if (!HAS_STT) {
    speakButton.style.display = 'none';
    if (textFallback) textFallback.classList.remove('hidden');
  }

  document.getElementById('back-btn').addEventListener('click', showTopicPicker);

  listenButton.addEventListener('click', playTTS);
  speakButton.addEventListener('click', toggleRecording);

  if (textSubmit) {
    textSubmit.addEventListener('click', () => {
      const val = textInput.value.trim();
      if (val) { displayResult(val, 0); textInput.value = ''; }
    });
    textInput.addEventListener('keydown', e => { if (e.key === 'Enter') textSubmit.click(); });
  }

  tryAgainButton.addEventListener('click', resetAttempt);
  tryAnotherButton.addEventListener('click', () => {
    if (!attemptDone) Progress.rate(cardIds[currentIndex], 1);
    Progress.recordSession(currentTheme, 0, 1);
    nextPhrase();
  });

  document.getElementById('rate-hard').addEventListener('click', () => rateAndNext(1));
  document.getElementById('rate-ok').addEventListener('click',   () => rateAndNext(3));
  document.getElementById('rate-easy').addEventListener('click', () => rateAndNext(5));

  buildTopicGrid();
  AppTTS.warmup();
  AppAudio.setBase('../audio/');
  AppAudio.warmup();
  if (HAS_STT) _getSttWorker();
});

/* ---- Navigation ---- */

function startTopic(id) {
  currentTheme = id;
  phrases = []; translations = []; cardIds = [];
  sessionCorrect = 0; sessionTotal = 0;

  document.getElementById('topic-section').classList.add('hidden');
  document.getElementById('exercise-section').classList.remove('hidden');

  const streakBadge = document.getElementById('streak-badge');
  if (streakBadge) {
    const streak = Progress.getStreak();
    streakBadge.innerHTML = '<span aria-hidden="true">🔥</span> ' + streak.current + ' day streak';
  }

  if (id === '__mixed__') {
    loadMixedPhrases();
  } else {
    loadPhrases('../json/' + id + '.json');
  }
}

function showTopicPicker() {
  if (_isRecording) _stopRecording();
  document.getElementById('exercise-section').classList.add('hidden');
  document.getElementById('topic-section').classList.remove('hidden');
  currentTheme = '';

  // Refresh progress counts on topic cards
  TOPICS.forEach(topic => {
    if (topic.id === 'mixed') return;
    fetch('../json/' + topic.id + '.json')
      .then(r => r.json())
      .then(data => {
        const total = data.phrases ? data.phrases.length : 0;
        const s = Progress.getTopicStats(topic.id, total);
        const el = document.getElementById('tp-' + topic.id);
        if (el) el.textContent = s.seen + ' / ' + total + ' learned';
      })
      .catch(() => {});
  });
}

/* ---- Data Loading ---- */

function loadPhrases(jsonFile) {
  fetch(jsonFile)
    .then(r => r.json())
    .then(data => {
      phrases      = data.phrases;
      translations = data.traductions || [];
      cardIds      = phrases.map((_, i) => currentTheme + '_' + i);
      currentIndex = Progress.getNextIndex(cardIds, -1);
      showPhrase(currentIndex);
      updateSessionCounter();
    })
    .catch(err => {
      if (message) message.textContent = 'Error loading phrases. Please go back and try again.';
      console.error(err);
    });
}

const MIXED_TOPICS = ['greetings','traveling','technology','restaurant','kitchen','supermarket','entertainment','accountability','gym'];

async function loadMixedPhrases() {
  const allPhrases = [], allTranslations = [], allIds = [];
  try {
    const results = await Promise.all(
      MIXED_TOPICS.map(t => fetch('../json/' + t + '.json').then(r => r.json()))
    );
    results.forEach((data, idx) => {
      const topic = MIXED_TOPICS[idx];
      data.phrases.forEach((p, i) => {
        allPhrases.push(p);
        allTranslations.push((data.traductions || [])[i] || '');
        allIds.push(topic + '_' + i);
      });
    });
  } catch (err) {
    if (message) message.textContent = 'Error loading phrases. Please go back and try again.';
    console.error(err);
    return;
  }
  phrases      = allPhrases;
  translations = allTranslations;
  cardIds      = allIds;
  currentIndex = Progress.getNextIndex(cardIds, -1);
  showPhrase(currentIndex);
  updateSessionCounter();
}

function showPhrase(index) {
  document.getElementById('Phrase').textContent     = phrases[index] || '';
  document.getElementById('Traduction').textContent = translations[index] || '';
  attemptDone = false;
  resetAttempt();
}

function updateSessionCounter() {
  const el = document.getElementById('session-counter');
  if (!el || phrases.length === 0) return;
  if (currentTheme === '__mixed__') {
    const data = Progress.getAllCards();
    const seen = cardIds.filter(id => data[id] && data[id].reps > 0).length;
    el.textContent = seen + ' / ' + cardIds.length + ' phrases learned';
  } else {
    const stats = Progress.getTopicStats(currentTheme, phrases.length);
    el.textContent = stats.seen + ' / ' + stats.total + ' phrases learned';
  }
}

/* ---- Attempt Flow ---- */

function resetAttempt() {
  listenButton.disabled = false;
  if (HAS_STT) {
    speakButton.disabled  = false;
    speakButton.textContent = '🎙️ Speak';
    speakButton.setAttribute('aria-label', 'Speak the phrase aloud');
  }
  tryAgainButton.disabled   = true;
  tryAnotherButton.disabled = true;
  if (message) { message.textContent = "Press the button when you're ready to talk"; message.className = ''; }
  document.getElementById('rating-area').classList.add('hidden');
  const ti = document.getElementById('text-input');
  if (ti) ti.disabled = false;
}

function showRatingArea() {
  tryAgainButton.disabled   = false;
  tryAnotherButton.disabled = false;
  document.getElementById('rating-area').classList.remove('hidden');
}

function rateAndNext(quality) {
  Progress.rate(cardIds[currentIndex], quality);
  Progress.recordSession(currentTheme, sessionCorrect, sessionTotal);
  nextPhrase();
}

function nextPhrase() {
  sessionCorrect = 0;
  sessionTotal   = 0;
  currentIndex   = Progress.getNextIndex(cardIds, currentIndex);
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
  // In mixed mode, cardIds[i] = 'greetings_5' → use real topic + original index
  if (currentTheme === '__mixed__' && cardIds[currentIndex]) {
    const parts = cardIds[currentIndex].split('_');
    const idx   = parseInt(parts.pop(), 10);
    return { topic: parts.join('_'), index: idx };
  }
  return { topic: currentTheme, index: currentIndex };
}

function playTTS() {
  const phraseText = document.getElementById('Phrase').textContent;
  if (!phraseText) return;

  listenButton.disabled = true;
  if (HAS_STT) speakButton.disabled = true;

  const { topic, index } = _audioRef();
  AppAudio.play(topic, index, phraseText).then(() => {
    listenButton.disabled = false;
    if (HAS_STT && !_isRecording) speakButton.disabled = false;
  }).catch(() => {
    listenButton.disabled = false;
    if (HAS_STT && !_isRecording) speakButton.disabled = false;
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

let _sttPanel = null, _sttBarEl = null, _sttHideTimer = null, _sttSafetyTimer = null;

function _getPanelContainer() {
  let c = document.getElementById('pe-download-panels');
  if (!c) {
    c = document.createElement('div');
    c.id = 'pe-download-panels';
    Object.assign(c.style, {
      position: 'fixed', bottom: '1.25rem', right: '1.25rem',
      display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem',
      zIndex: '9999', pointerEvents: 'none',
    });
    document.body.appendChild(c);
  }
  return c;
}

function _hideSttPanel() {
  clearTimeout(_sttSafetyTimer);
  if (!_sttPanel) return;
  _sttPanel.style.opacity = '0';
  _sttPanel.style.transform = 'translateY(6px)';
}

function _ensureSttPanel() {
  if (_sttPanel) return;
  _sttPanel = document.createElement('div');
  Object.assign(_sttPanel.style, {
    width: '240px', background: 'var(--clr-surface, #fff)',
    color: 'var(--clr-text, #1e293b)', border: '1px solid var(--clr-border, #e2e8f0)',
    borderRadius: '0.6rem', padding: '0.75rem 1rem', fontSize: '0.8rem',
    boxShadow: '0 4px 16px rgba(0,0,0,.12)',
    opacity: '0', transform: 'translateY(6px)',
    transition: 'opacity .3s, transform .3s',
  });
  _sttPanel.setAttribute('role', 'status');
  _sttPanel.setAttribute('aria-live', 'polite');
  const title = document.createElement('div');
  Object.assign(title.style, { fontWeight: '600', marginBottom: '0.5rem' });
  title.textContent = '🎙️ Loading speech model…';
  _sttPanel.appendChild(title);
  const track = document.createElement('div');
  Object.assign(track.style, { background: 'var(--clr-border, #e2e8f0)', borderRadius: '99px', height: '5px', overflow: 'hidden' });
  _sttBarEl = document.createElement('div');
  Object.assign(_sttBarEl.style, { background: 'var(--clr-primary, #2563eb)', height: '100%', width: '0%', borderRadius: '99px', transition: 'width .6s ease' });
  track.appendChild(_sttBarEl);
  _sttPanel.appendChild(track);
  _getPanelContainer().appendChild(_sttPanel);
}

function _showSttPanel() {
  if (localStorage.getItem('pe_stt_cached')) return;
  clearTimeout(_sttHideTimer);
  _ensureSttPanel();
  clearTimeout(_sttSafetyTimer);
  _sttSafetyTimer = setTimeout(_hideSttPanel, 12000);
  requestAnimationFrame(() => { _sttPanel.style.opacity = '1'; _sttPanel.style.transform = 'translateY(0)'; });
}

function _onSttProgress(p) {
  if (p.status === 'initiate') {
    _showSttPanel();
  } else if (p.status === 'progress' && p.progress != null) {
    _showSttPanel();
    if (_sttBarEl) _sttBarEl.style.width = Math.min(p.progress, 100) + '%';
  }
}

function _onSttReady() {
  localStorage.setItem('pe_stt_cached', '1');
  clearTimeout(_sttSafetyTimer);
  if (!_sttPanel) return;
  const title = _sttPanel.querySelector('div');
  if (title) title.textContent = '🎙️ Speech model ready ✓';
  if (_sttBarEl) _sttBarEl.style.width = '100%';
  _sttHideTimer = setTimeout(_hideSttPanel, 2000);
}

function toggleRecording() {
  if (_isRecording) _stopRecording();
  else _startRecording();
}

async function _startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _mediaRecorder   = new MediaRecorder(stream);
    _recordingChunks = [];

    _mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) _recordingChunks.push(e.data); };
    _mediaRecorder.start();
    _isRecording = true;

    listenButton.disabled = true;
    speakButton.textContent = '⏹ Stop';
    speakButton.setAttribute('aria-label', 'Stop recording');
    if (message) { message.textContent = '🎙 Recording… tap Stop when done'; message.className = ''; }
  } catch (e) {
    const msgs = {
      NotAllowedError : 'Microphone access blocked. Allow it in your browser settings.',
      NotFoundError   : 'No microphone found. Please connect one and try again.',
    };
    if (message) {
      message.textContent = msgs[e.name] || 'Could not access microphone. Please try again.';
      message.className = 'incorrect';
    }
    showRatingArea();
  }
}

function _stopRecording() {
  if (!_mediaRecorder || _mediaRecorder.state === 'inactive') return;
  _isRecording = false;

  speakButton.disabled  = true;
  speakButton.textContent = '⏳ Transcribing…';
  speakButton.setAttribute('aria-label', 'Transcribing your speech');

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
    } catch (e) {
      _onSttError(e.message);
    }
  };

  _mediaRecorder.stop();
}

function _onTranscript(text) {
  speakButton.disabled  = false;
  speakButton.textContent = '🎙️ Speak';
  speakButton.setAttribute('aria-label', 'Speak the phrase aloud');
  displayResult(text, 0);
}

function _onSttError(errMsg) {
  _isRecording = false;
  listenButton.disabled = false;
  speakButton.disabled  = false;
  speakButton.textContent = '🎙️ Speak';
  speakButton.setAttribute('aria-label', 'Speak the phrase aloud');
  if (message) {
    message.textContent = errMsg || 'An error occurred. Please try again.';
    message.className = 'incorrect';
  }
  showRatingArea();
}

/* ---- Result Display ---- */

function displayResult(text, confidence) {
  const originalPhrase = document.getElementById('Phrase').textContent.trim();
  const clean = s => expandContractions(s).toLowerCase()
    .replace(/[.,\/#!$%^&*;:{}=\-_~()?!]/g, '')
    .replace(/\s+/g, ' ').trim();
  const isCorrect = clean(text) === clean(originalPhrase);

  attemptDone = true;
  sessionTotal++;

  if (isCorrect) {
    sessionCorrect++;
    let msg = 'Correct!';
    let confettiCount = 100;
    if (confidence >= 0.975)     { msg = 'Excellent! \uD83C\uDF89'; confettiCount = 800; }
    else if (confidence >= 0.95) { msg = 'Great! \uD83D\uDE04';     confettiCount = 350; }
    else if (confidence >= 0.9)  { msg = 'Good! \uD83D\uDE42';      confettiCount = 120; }
    else if (confidence > 0)     { msg = 'Correct! Keep it up \uD83D\uDC4D'; confettiCount = 50; }
    if (confidence > 0) msg += '  \u00b7  ' + (confidence * 100).toFixed(0) + '% confidence';
    message.textContent = msg;
    message.className   = 'correct';
    jsConfetti.addConfetti({ confettiNumber: confettiCount });
  } else {
    let shown = text.replace(/\bi\b/g, 'I');
    shown = shown.charAt(0).toUpperCase() + shown.slice(1);
    message.textContent = 'I heard: "' + shown + '"';
    message.className   = 'incorrect';
  }

  listenButton.disabled = true;
  if (HAS_STT) {
    speakButton.disabled  = true;
    speakButton.textContent = '🎙️ Speak';
    speakButton.setAttribute('aria-label', 'Speak the phrase aloud');
  }
  const ti = document.getElementById('text-input');
  if (ti) ti.disabled = true;

  showRatingArea();
}

/* ---- Contractions ---- */

function expandContractions(text) {
  if (!contractionsData) return text;
  contractionsData.forEach(c => {
    text = text.replace(new RegExp(c.original, 'gi'), c.expanded);
  });
  return text;
}
