/* ============================================================
   tts.js — Kokoro-82M Text-to-Speech (main-thread API)
   Audio cache: memory (session) → IndexedDB (persistent across visits).
   Kokoro runs once per phrase ever; all repeats are instant.

   Usage:
     AppTTS.speak('Hello world')
     AppTTS.speak('Slower phrase', { speed: 0.85, voice: 'bf_emma' })
     AppTTS.cancel()
     AppTTS.prefetch('Next phrase', { voice: 'af_bella' })
   ============================================================ */
const AppTTS = (() => {
  const _workerUrl = document.currentScript
    ? new URL('tts-worker.js', document.currentScript.src).href
    : null;

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

  const _DB_NAME    = 'pe-tts-audio';
  const _DB_STORE   = 'phrases';
  let   _db         = null;
  let   _dbPromise  = null;

  function _openDB() {
    if (_db) return Promise.resolve(_db);
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(_DB_NAME, 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore(_DB_STORE);
      req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror    = ()  => resolve(null); // DB unavailable — degrade gracefully
    });
    return _dbPromise;
  }

  function _dbGet(key) {
    return _openDB().then(db => {
      if (!db) return null;
      return new Promise((resolve) => {
        const req = db.transaction(_DB_STORE, 'readonly').objectStore(_DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
    });
  }

  function _dbPut(key, audio, sr) {
    _openDB().then(db => {
      if (!db) return;
      const tx  = db.transaction(_DB_STORE, 'readwrite');
      tx.objectStore(_DB_STORE).put({ audio, sr }, key);
    }).catch(() => {});
  }

  // ---- Download Progress Panel -----------------------------------

  let _panel = null, _barEl = null, _hideTimer = null, _safetyTimer = null;

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

  function _hidePanel() {
    clearTimeout(_safetyTimer);
    if (!_panel) return;
    _panel.style.opacity = '0';
    _panel.style.transform = 'translateY(6px)';
  }

  function _ensurePanel() {
    if (_panel) return;
    _panel = document.createElement('div');
    Object.assign(_panel.style, {
      width: '240px', background: 'var(--clr-surface, #fff)',
      color: 'var(--clr-text, #1e293b)', border: '1px solid var(--clr-border, #e2e8f0)',
      borderRadius: '0.6rem', padding: '0.75rem 1rem', fontSize: '0.8rem',
      boxShadow: '0 4px 16px rgba(0,0,0,.12)',
      opacity: '0', transform: 'translateY(6px)', transition: 'opacity .3s, transform .3s',
    });
    _panel.setAttribute('role', 'status');
    _panel.setAttribute('aria-live', 'polite');
    const title = document.createElement('div');
    Object.assign(title.style, { fontWeight: '600', marginBottom: '0.5rem' });
    title.textContent = '🔊 Loading voice model…';
    _panel.appendChild(title);
    const track = document.createElement('div');
    Object.assign(track.style, { background: 'var(--clr-border, #e2e8f0)', borderRadius: '99px', height: '5px', overflow: 'hidden' });
    _barEl = document.createElement('div');
    Object.assign(_barEl.style, { background: 'var(--clr-primary, #2563eb)', height: '100%', width: '0%', borderRadius: '99px', transition: 'width .6s ease' });
    track.appendChild(_barEl);
    _panel.appendChild(track);
    _getPanelContainer().appendChild(_panel);
  }

  function _showPanel() {
    if (localStorage.getItem('pe_tts_cached')) return;
    clearTimeout(_hideTimer);
    _ensurePanel();
    // Safety: auto-hide after 12 s in case 'ready' never fires
    clearTimeout(_safetyTimer);
    _safetyTimer = setTimeout(_hidePanel, 12000);
    requestAnimationFrame(() => { _panel.style.opacity = '1'; _panel.style.transform = 'translateY(0)'; });
  }

  function _updatePanel(pct) {
    _showPanel();
    if (_barEl) _barEl.style.width = Math.min(pct, 100) + '%';
  }

  function _completePanel() {
    localStorage.setItem('pe_tts_cached', '1');
    clearTimeout(_safetyTimer);
    if (!_panel) return;
    const title = _panel.querySelector('div');
    if (title) title.textContent = '🔊 Voice model ready ✓';
    if (_barEl) _barEl.style.width = '100%';
    _hideTimer = setTimeout(_hidePanel, 2000);
  }

  // ---- Worker ----------------------------------------------------

  function _getWorker() {
    if (_worker) return _worker;
    if (!_workerUrl) return null;
    _worker = new Worker(_workerUrl, { type: 'module' });
    _worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        if (data.status === 'initiate') _showPanel();
        else if (data.status === 'progress' && data.progress != null)
          _updatePanel(data.progress);
        return;
      }
      if (data.type === 'ready') { _completePanel(); return; }
      const cb = _queue.get(data.id);
      if (!cb) return;
      _queue.delete(data.id);
      if (data.type === 'done') cb(null, data.audio, data.sampling_rate);
      else cb(new Error(data.message || 'TTS error'));
    };
    _worker.onerror = (e) => {
      _hidePanel();
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

  function _generate(key, text, voice, speed) {
    // Reuse an in-progress generation for the same key — never run Kokoro twice for same phrase
    if (_inProgress.has(key)) return _inProgress.get(key);

    const worker = _getWorker();
    if (!worker) return Promise.reject(new Error('no worker'));

    const promise = new Promise((resolve, reject) => {
      const id = ++_msgId;
      _queue.set(id, (err, audio, sr) => {
        _inProgress.delete(key);
        if (err) { reject(err); return; }
        const result = { audio, sr };
        _memCache.set(key, result);  // memory cache
        _dbPut(key, audio, sr);      // persist to IndexedDB for future sessions
        resolve(result);
      });
      worker.postMessage({ id, text, voice, speed });
    });

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

    const voice = (opts && opts.voice) || 'af_bella';
    const speed = (opts && opts.speed) || 1.0;
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

    const voice = (opts && opts.voice) || 'af_bella';
    const speed = (opts && opts.speed) || 1.0;
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

  return { speak, cancel, warmup, prefetch };
})();
