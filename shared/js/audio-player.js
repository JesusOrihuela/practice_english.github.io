/* ============================================================
   audio-player.js — Static audio file player with Kokoro fallback

   Primary path: fetches pre-generated WAV files from disk.
   Fallback: Kokoro (AppTTS) for any phrase not yet pre-generated.

   Usage:
     AppAudio.setBase('../audio/');              // call once per page
     AppAudio.play(topic, slug, text)           // speaking (normal speed)
     AppAudio.play(topic, slug, text, 0.9)     // dictation (slower playback)
     AppAudio.cancel()
     AppAudio.warmup()
   ============================================================ */
const AppAudio = (() => {

  // Fallback voice pool (English) used when AppLangPair is not yet available.
  const _VOICES_FALLBACK = ['af_heart', 'af_bella', 'bf_emma', 'am_michael'];

  let _base          = '../audio/';   // path to {topic}/{audioSlug}-{voice}.wav, relative to the page
  let _audioCtx      = null;
  let _currentSource = null;
  let _cancelId      = 0;             // incremented on every play()/cancel() call

  function setBase(base) { _base = base; }

  function _getCtx() {
    if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new AudioContext();
    return _audioCtx;
  }

  function _randomVoice() {
    var pair   = (typeof AppLangPair !== 'undefined') ? AppLangPair.getActive() : null;
    var voices = (pair && pair.ttsVoices && pair.ttsVoices.length)
      ? pair.ttsVoices
      : _VOICES_FALLBACK;
    return voices[Math.floor(Math.random() * voices.length)];
  }

  /**
   * Play pre-generated audio for a phrase.
   * @param {string}  topic       - e.g. 'greetings'
   * @param {string}  slug        - audioSlug of the form (e.g. 'hello_how_are_you')
   * @param {string}  text        - phrase text (used by Kokoro fallback)
   * @param {number}  [rate=1.0]  - playback rate (0.9 for dictation)
   */
  async function play(topic, slug, text, rate) {
    cancel();
    const myId  = ++_cancelId;
    const speed = rate || 1.0;
    const voice = _randomVoice();
    const url   = _base + topic + '/' + slug + '-' + voice + '.wav';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('not found');
      if (_cancelId !== myId) return;

      const arrayBuf = await res.arrayBuffer();
      if (_cancelId !== myId) return;

      const ctx    = _getCtx();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      if (_cancelId !== myId) return;

      return new Promise((resolve) => {
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.playbackRate.value = speed;
        src.connect(ctx.destination);
        src.onended = () => { _currentSource = null; resolve(); };
        _currentSource = src;
        const start = () => src.start();
        if (ctx.state === 'suspended') ctx.resume().then(start).catch(resolve);
        else start();
      });

    } catch {
      // Static file not available — fall back to Kokoro
      if (_cancelId !== myId) return;
      if (typeof AppTTS === 'undefined') return;
      return AppTTS.speak(text, { voice: _randomVoice(), speed });
    }
  }

  function cancel() {
    _cancelId++;
    if (_currentSource) {
      try { _currentSource.stop(); } catch (_) {}
      _currentSource = null;
    }
    if (typeof AppTTS !== 'undefined') AppTTS.cancel();
  }

  /**
   * Pre-warm AudioContext on first interaction.
   * Also warms up AppTTS so Kokoro is ready if fallback is needed.
   */
  function warmup() {
    // Don't pre-create the Kokoro worker — it's a fallback only, created on demand.
    document.addEventListener('pointerdown', () => {
      _getCtx().resume().catch(() => {});
    }, { once: true });
  }

  return { play, cancel, warmup, setBase };
})();
