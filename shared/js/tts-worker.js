/* ============================================================
   tts-worker.js — Kokoro-82M TTS (Web Worker, ESM)
   Lazy-loads the model on first request; reuses the singleton.
   ============================================================ */
import { KokoroTTS } from 'https://esm.sh/kokoro-js@1.2.1';

let _tts            = null;
let _loadingPromise = null;

function getTTS() {
  if (_tts) return Promise.resolve(_tts);
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
    dtype  : 'q8',
    device : 'wasm',
    progress_callback: (p) => {
      self.postMessage({ type: 'progress', status: p.status, file: p.file, progress: p.progress });
    },
  }).then(instance => {
    _tts = instance;
    _loadingPromise = null;
    self.postMessage({ type: 'ready' });
    return _tts;
  });

  return _loadingPromise;
}

// Start loading the model immediately when the worker is created,
// so by the time the user interacts, it is already ready (or close to it).
getTTS();

self.addEventListener('message', async ({ data }) => {
  const { id, text, voice, speed } = data;
  try {
    const tts   = await getTTS();
    const audio = await tts.generate(text, { voice: voice || 'af_bella', speed: speed || 1.0 });
    const pcm   = audio.audio.slice(); // copy before transfer
    self.postMessage(
      { id, type: 'done', audio: pcm, sampling_rate: audio.sampling_rate },
      [pcm.buffer]
    );
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err.message });
  }
});
