/* ============================================================
   stt-worker.js — Whisper-tiny.en STT (Web Worker, ESM)
   Lazy-loads the model on first request; reuses the singleton.
   Input: Float32Array at 16 000 Hz (mono)
   ============================================================ */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';

env.allowLocalModels = false;

let _pipe           = null;
let _loadingPromise = null;

function getTranscriber() {
  if (_pipe) return Promise.resolve(_pipe);
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = pipeline(
    'automatic-speech-recognition',
    'onnx-community/whisper-tiny.en',
    {
      dtype  : 'q8',
      device : 'wasm',
      progress_callback: (p) => {
        self.postMessage({ type: 'progress', status: p.status, file: p.file, progress: p.progress });
      },
    }
  ).then(instance => {
    _pipe = instance;
    _loadingPromise = null;
    self.postMessage({ type: 'ready' });
    return _pipe;
  });

  return _loadingPromise;
}

// Start loading the model immediately when the worker is created.
getTranscriber();

self.addEventListener('message', async ({ data }) => {
  const { id, audio } = data;
  try {
    const transcriber = await getTranscriber();
    const result      = await transcriber(audio, { sampling_rate: 16000 });
    self.postMessage({ id, type: 'done', text: result.text });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err.message });
  }
});
