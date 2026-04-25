/* ============================================================
   tts.js — Kokoro-82M Text-to-Speech (main-thread API)
   Audio cache: memory (session) → IndexedDB (persistent across visits).
   Kokoro runs once per phrase ever; all repeats are instant.

   Usage:
     AppTTS.speak('Hello world')
     AppTTS.speak('Slower phrase', { speed: TTS_SPEED_SLOW, voice: 'bf_emma' })
     AppTTS.cancel()
     AppTTS.prefetch('Next phrase', { voice: TTS_DEFAULT_VOICE })
   ============================================================ */
const AppTTS = (() => {
  const _workerUrl = document.currentScript
    ? new URL('tts-worker.js', document.currentScript.src).href
    : null;

  // Default playback parameters
  const TTS_DEFAULT_VOICE = 'af_bella'; // American female; alternate with 'bf_emma' for variety
  const TTS_DEFAULT_SPEED = 1.0;        // normal pace
  const TTS_SPEED_SLOW    = 0.85;       // slower pace for dictation / first-listen contexts

  let _worker  = null;
  let _msgId   = 0;

  // Memory cache: key → { audio: Float32Array, sr: number }
  const _memCache   = new Map();
  // In-progress generations: key → Promise<{ audio, sr }>
  const _inProgress = new Map();
  // Callbacks for active worker requests: id → fn(err, audio, sr)
  const _queue      = new Map();

  let _audioCtx      = null;
  let _currentSource = null;
  let _speakVersion  = 0; // incremented on each speak() / cancel() to detect stale continuations

  // ---- IndexedDB audio cache -------------------------------------

  const DB_NAME    = 'pe-tts-audio';
  const DB_STORE   = 'phrases';
  let   _db         = null;
  let   _dbPromise  = null;

  function _openDB() {
    if (_db) return Promise.resolve(_db);
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore(DB_STORE);
      req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror    = ()  => resolve(null); // DB unavailable — degrade gracefully
    });
    return _dbPromise;
  }

  function _dbGet(key) {
    return _openDB().then(db => {
      if (!db) return null;
      return new Promise((resolve) => {
        const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
    });
  }

  function _dbPut(key, audio, sr) {
    _openDB().then(db => {
      if (!db) return;
      const tx  = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ audio, sr }, key);
    }).catch(() => {});
  }

  // ---- Download Progress Panel -----------------------------------

  const _dp = AppDownloadPanel.create('🔊 Loading voice model…', '🔊 Voice model ready ✓', 'pe_tts_cached');

  // ---- Worker ----------------------------------------------------

  function _getWorker() {
    if (_worker) return _worker;
    if (!_workerUrl) return null;
    _worker = new Worker(_workerUrl, { type: 'module' });
    _worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        if (data.status === 'initiate') _dp.show();
        else if (data.status === 'progress' && data.progress != null)
          _dp.update(data.progress);
        return;
      }
      if (data.type === 'ready') { _dp.complete(); return; }
      const cb = _queue.get(data.id);
      if (!cb) return;
      _queue.delete(data.id);
      if (data.type === 'done') cb(null, data.audio, data.sampling_rate);
      else cb(new Error(data.message || 'TTS error'));
    };
    _worker.onerror = (e) => {
      _dp.hide();
      _worker = null;      // allow _getWorker() to spawn a fresh worker on the next request
      _inProgress.clear(); // drop stale in-progress keys so _generate() doesn't reuse dead promises
      _queue.forEach(cb => cb(new Error('TTS worker failed')));
      _queue.clear();
    };
    return _worker;
  }

  // ---- Audio playback --------------------------------------------

  function _getAudioCtx() {
    if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new AudioContext();
    return _audioCtx;
  }

  function _play(audioData, samplingRate) {
    return new Promise((resolve, reject) => {
      try {
        const ctx = _getAudioCtx();
        const buf = ctx.createBuffer(1, audioData.length, samplingRate);
        buf.getChannelData(0).set(audioData);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.onended = () => { _currentSource = null; resolve(); };
        _currentSource = src;
        const doStart = () => src.start();
        if (ctx.state === 'suspended') ctx.resume().then(doStart).catch(reject);
        else doStart();
      } catch (e) { reject(e); }
    });
  }

  // ---- Core generation (deduplication + caching) -----------------

  function _cacheKey(voice, speed, text) {
    return voice + ':' + speed + ':' + text;
  }

  const _TTS_TIMEOUT_MS = 30000;

  function _generate(key, text, voice, speed) {
    // Reuse an in-progress generation for the same key — never run Kokoro twice for same phrase
    if (_inProgress.has(key)) return _inProgress.get(key);

    const worker = _getWorker();
    if (!worker) return Promise.reject(new Error('no worker'));

    const promise = new Promise((resolve, reject) => {
      const id = ++_msgId;

      // Safety timeout: if the worker never responds, reject instead of hanging forever
      const timeoutId = setTimeout(() => {
        if (!_queue.has(id)) return;
        _queue.delete(id);
        reject(new Error('TTS timeout'));
      }, _TTS_TIMEOUT_MS);

      _queue.set(id, (err, audio, sr) => {
        clearTimeout(timeoutId);
        if (err) { reject(err); return; }
        const result = { audio, sr };
        _memCache.set(key, result);  // memory cache
        _dbPut(key, audio, sr);      // persist to IndexedDB for future sessions
        resolve(result);
      });
      worker.postMessage({ id, text, voice, speed });
    }).finally(() => _inProgress.delete(key)); // always clean up, regardless of outcome

    _inProgress.set(key, promise);
    return promise;
  }

  // ---- Public API ------------------------------------------------

  async function speak(text, opts) {
    if (!text) return;

    _speakVersion++;
    const myVersion = _speakVersion;

    // Stop current playback
    if (_currentSource) { try { _currentSource.stop(); } catch (_) {} _currentSource = null; }

    const voice = (opts && opts.voice) || TTS_DEFAULT_VOICE;
    const speed = (opts && opts.speed) || TTS_DEFAULT_SPEED;
    const key   = _cacheKey(voice, speed, text);

    // 1 — Memory cache (current session, prefetch result)
    const mem = _memCache.get(key);
    if (mem) { _memCache.delete(key); return _play(mem.audio, mem.sr); }

    // 2 — IndexedDB cache (previous sessions — instant replay, ~2-5ms)
    const db = await _dbGet(key);
    if (_speakVersion !== myVersion) return; // cancel() called while awaiting DB
    if (db) return _play(db.audio, db.sr);

    // 3 — Generate with Kokoro (reuses in-progress prefetch if already running)
    const result = await _generate(key, text, voice, speed).catch(() => null);
    if (_speakVersion !== myVersion || !result) return; // cancelled or failed
    return _play(result.audio, result.sr);
  }

  /**
   * Pre-generate audio in the background.
   * Checks DB first — if already cached from a previous session, loads to memory instantly.
   * Otherwise starts Kokoro in the background so speak() finds it ready.
   */
  async function prefetch(text, opts) {
    if (!text) return;

    const voice = (opts && opts.voice) || TTS_DEFAULT_VOICE;
    const speed = (opts && opts.speed) || TTS_DEFAULT_SPEED;
    const key   = _cacheKey(voice, speed, text);

    if (_memCache.has(key) || _inProgress.has(key)) return;

    // Load from DB into memory cache — speak() will find it instantly
    const db = await _dbGet(key);
    if (db) { _memCache.set(key, db); return; }

    // Not cached anywhere — start Kokoro generation in background
    _generate(key, text, voice, speed).catch(() => {});
  }

  function cancel() {
    _speakVersion++;
    if (_currentSource) { try { _currentSource.stop(); } catch (_) {} _currentSource = null; }
    _queue.forEach(cb => cb(new Error('cancelled')));
    _queue.clear();
  }

  /** Pre-create the worker so model download begins immediately. */
  function warmup() {
    _getWorker();
    _openDB(); // open DB connection early so first speak() is faster
    document.addEventListener('pointerdown', () => {
      _getAudioCtx().resume().catch(() => {});
    }, { once: true });
  }

  return { speak, cancel, warmup, prefetch, TTS_DEFAULT_VOICE, TTS_DEFAULT_SPEED, TTS_SPEED_SLOW };
})();
