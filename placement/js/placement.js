/* ============================================================
   placement.js — Initial Placement Test (CEFR A1–C2)
   14 questions of increasing difficulty.
   Research: Nation & Newton (2009) — placement tests that
   estimate CEFR bands need just ~10 well-selected items.
   ============================================================ */

/* ---- Questions ------------------------------------------------
   Ordered A1 → C2 (2 per band, B1/B2 have 3). Correct answer index = .answer
   ---------------------------------------------------------------- */
const QUESTIONS = [
  {
    level: 'A1',
    q: '¿Qué significa "Good morning"?',
    options: ['Buenos días', 'Buenas noches', 'Buenas tardes', 'Hasta luego'],
    answer: 0,
  },
  {
    level: 'A1',
    q: 'Completa: "She ___ a doctor."',
    options: ['are', 'am', 'be', 'is'],
    answer: 3,
  },
  {
    level: 'A2',
    q: '¿Qué significa "grateful"?',
    options: ['enojado', 'cansado', 'agradecido', 'confundido'],
    answer: 2,
  },
  {
    level: 'A2',
    q: 'Completa: "We ___ dinner together last night."',
    options: ['eats', 'eat', 'eating', 'had'],
    answer: 3,
  },
  {
    level: 'B1',
    q: '¿Qué significa "efficient"?',
    options: ['lento', 'antiguo', 'eficiente', 'confuso'],
    answer: 2,
  },
  {
    level: 'B1',
    q: 'Completa: "I have never ___ sushi before."',
    options: ['ate', 'eat', 'eating', 'tried'],
    answer: 3,
  },
  {
    level: 'B1',
    q: '¿Qué significa "to elaborate on an idea"?',
    options: ['ignorarla', 'simplificarla', 'desarrollarla con más detalle', 'repetirla'],
    answer: 2,
  },
  {
    level: 'B2',
    q: 'Completa: "If I ___ more free time, I would travel more."',
    options: ['have', 'had', 'has', 'having'],
    answer: 1,
  },
  {
    level: 'B2',
    q: '¿Qué significa "to advocate for a cause"?',
    options: ['criticar públicamente', 'defender activamente', 'ignorar completamente', 'estudiar en privado'],
    answer: 1,
  },
  {
    level: 'B2',
    q: 'Elige la oración gramaticalmente correcta:',
    options: [
      '"She suggested that he studies more."',
      '"She suggested that he would study more."',
      '"She suggested that he study more."',
      '"She suggested that he studied more."',
    ],
    answer: 2,
  },
  {
    level: 'C1',
    q: 'Completa: "Not only ___ the deadline, but the team also lost the client."',
    options: ['they missed', 'did they miss', 'they did miss', 'missed they'],
    answer: 1,
  },
  {
    level: 'C1',
    q: '¿Qué significa "to corroborate a statement"?',
    options: ['contradecirla con evidencia', 'confirmarla con evidencia adicional', 'ignorarla por completo', 'reformularla en términos simples'],
    answer: 1,
  },
  {
    level: 'C2',
    q: 'Elige la oración gramaticalmente correcta en inglés formal:',
    options: [
      '"It is essential that he submits the report today."',
      '"It is essential that he submit the report today."',
      '"It is essential that he would submit the report today."',
      '"It is essential that he submitted the report today."',
    ],
    answer: 1,
  },
  {
    level: 'C2',
    q: '¿Qué significa "to prevaricate"?',
    options: ['hablar con claridad y precisión', 'evitar decir la verdad directamente', 'anticiparse a las consecuencias', 'contradecirse de manera repetida'],
    answer: 1,
  },
];

/* ---- CEFR result config ---- */
const LEVELS = {
  A1: {
    label: 'A1 — Principiante',
    emoji: '🌱',
    color: '#22c55e',
    message: '¡Punto de partida ideal! Comienza con vocabulario esencial y frases del día a día.',
    suggestions: [
      { emoji: '📚', label: 'Vocabulario',            url: '../../vocabulary/html/vocabulary.html' },
      { emoji: '🎙️', label: 'Pronunciación: Saludos', url: '../../speaking/html/speaking.html' },
      { emoji: '✍️', label: 'Dictado',                url: '../../dictation/html/dictation.html' },
    ],
  },
  A2: {
    label: 'A2 — Elemental',
    emoji: '📗',
    color: '#3b82f6',
    message: 'Buena base. Practica vocabulario variado y empieza a producir tus propias oraciones.',
    suggestions: [
      { emoji: '🎙️', label: 'Pronunciación', url: '../../speaking/html/speaking.html' },
      { emoji: '🔤', label: 'Cloze',          url: '../../cloze/html/cloze.html' },
      { emoji: '🧠', label: 'Quiz',           url: '../../quiz/html/quiz.html' },
    ],
  },
  B1: {
    label: 'B1 — Intermedio',
    emoji: '📘',
    color: '#f59e0b',
    message: '¡Buen nivel! Enfócate en gramática y producción activa para consolidar tu inglés.',
    suggestions: [
      { emoji: '📐', label: 'Gramática',  url: '../../grammar/html/grammar.html' },
      { emoji: '🔄', label: 'Traducción', url: '../../translation/html/translation.html' },
      { emoji: '🧩', label: 'Secuencia',  url: '../../scramble/html/scramble.html' },
    ],
  },
  B2: {
    label: 'B2 — Avanzado',
    emoji: '🎓',
    color: '#7c3aed',
    message: '¡Nivel avanzado! Trabaja gramática compleja y producción sin apoyo.',
    suggestions: [
      { emoji: '📐', label: 'Gramática',               url: '../../grammar/html/grammar.html' },
      { emoji: '🔄', label: 'Traducción',              url: '../../translation/html/translation.html' },
      { emoji: '🎙️', label: 'Pronunciación: Avanzado', url: '../../speaking/html/speaking.html' },
    ],
  },
  C1: {
    label: 'C1 — Competente',
    emoji: '🏅',
    color: '#0891b2',
    message: '¡Nivel competente! Usa el inglés con fluidez y precisión en contextos académicos y profesionales.',
    suggestions: [
      { emoji: '📐', label: 'Gramática',  url: '../../grammar/html/grammar.html' },
      { emoji: '🔄', label: 'Traducción', url: '../../translation/html/translation.html' },
      { emoji: '🧩', label: 'Secuencia',  url: '../../scramble/html/scramble.html' },
    ],
  },
  C2: {
    label: 'C2 — Maestría',
    emoji: '🌟',
    color: '#be123c',
    message: '¡Nivel de maestría! Comprende y produce inglés con la precisión de un hablante culto nativo.',
    suggestions: [
      { emoji: '📐', label: 'Gramática',  url: '../../grammar/html/grammar.html' },
      { emoji: '🔄', label: 'Traducción', url: '../../translation/html/translation.html' },
      { emoji: '🧩', label: 'Secuencia',  url: '../../scramble/html/scramble.html' },
    ],
  },
};

/* ---- State ---- */
let currentQ = 0;
let score    = 0;
let answered = false;  // lock during feedback delay

/* ---- Screens ---- */

function showScreen(id) {
  ['screen-intro', 'screen-quiz', 'screen-result'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

/* ---- Intro ---- */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').addEventListener('click', startTest);
  document.getElementById('skip-btn').addEventListener('click', skipTest);
  document.getElementById('retake-btn').addEventListener('click', retakeTest);
});

function startTest() {
  currentQ = 0;
  score    = 0;
  answered = false;
  showScreen('screen-quiz');
  showQuestion(0);
}

function skipTest() {
  localStorage.setItem(AppLangPair.storageKey('pe_placement_done'), 'skipped');
  window.location.href = '../../index.html';
}

function retakeTest() {
  startTest();
}

/* ---- Quiz ---- */

function showQuestion(i) {
  const q = QUESTIONS[i];

  // Progress bar
  const pct = (i / QUESTIONS.length) * 100;
  document.getElementById('placement-progress-fill').style.width = pct + '%';

  // Counter + level badge
  document.getElementById('placement-counter').textContent = AppLang.t('placement_counter', { n: i + 1, total: QUESTIONS.length });
  const badge = document.getElementById('placement-level-badge');
  badge.textContent = q.level;
  badge.className   = 'placement-level-badge level-' + q.level.replace('+', 'plus').replace(' ', '');

  // Question text
  document.getElementById('question-text').textContent = q.q;

  // Options
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  answered = false;

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.setAttribute('aria-label', AppLang.t('option_n', { n: idx + 1 }) + ': ' + opt);
    btn.addEventListener('click', () => selectOption(idx, btn));
    grid.appendChild(btn);
  });
}

function selectOption(idx, btn) {
  if (answered) return;
  answered = true;

  const q = QUESTIONS[currentQ];
  const correct = idx === q.answer;
  if (correct) score++;

  // Visual feedback: mark selected + correct
  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer)   b.classList.add('option-correct');
    if (i === idx && !correct) b.classList.add('option-wrong');
  });

  // Advance after short delay so user sees the feedback
  setTimeout(() => {
    currentQ++;
    if (currentQ < QUESTIONS.length) {
      showQuestion(currentQ);
    } else {
      showResults();
    }
  }, 850);
}

/* ---- Results ---- */

function scoreToLevel(s) {
  if (s <= 3)  return 'A1';
  if (s <= 6)  return 'A2';
  if (s <= 9)  return 'B1';
  if (s <= 11) return 'B2';
  if (s <= 13) return 'C1';
  return 'C2';
}

function showResults() {
  const level  = scoreToLevel(score);
  const config = LEVELS[level];

  // Fill progress bar to 100%
  document.getElementById('placement-progress-fill').style.width = '100%';

  // Result card
  const emojiEl = document.getElementById('result-emoji');
  const levelEl = document.getElementById('result-level-label');
  const scoreEl = document.getElementById('result-score');
  const msgEl   = document.getElementById('result-message');
  const sugsEl  = document.getElementById('result-suggestions');
  const ctaEl   = document.getElementById('result-cta');

  emojiEl.textContent = config.emoji;
  emojiEl.style.setProperty('--level-color', config.color);

  levelEl.textContent  = config.label;
  levelEl.style.color  = config.color;
  scoreEl.textContent  = score + ' / ' + QUESTIONS.length + ' respuestas correctas';
  msgEl.textContent    = config.message;

  sugsEl.innerHTML = '';
  config.suggestions.forEach(s => {
    const a = document.createElement('a');
    a.href      = s.url;
    a.className = 'result-suggestion';
    a.innerHTML = '<span class="result-suggestion__emoji">' + s.emoji + '</span>' +
                  '<span class="result-suggestion__label">' + s.label + '</span>';
    sugsEl.appendChild(a);
  });

  ctaEl.href = '../../index.html';

  showScreen('screen-result');

  // Persist level + initialize proficiency from placement result
  localStorage.setItem(AppLangPair.storageKey('pe_placement_done'),  'done');
  localStorage.setItem(AppLangPair.storageKey('pe_placement_level'), level);
  if (typeof AppProficiency !== 'undefined') AppProficiency.initFromManual(level);
}
