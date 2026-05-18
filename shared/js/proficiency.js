/* ============================================================
   proficiency.js — Continuous User Proficiency Estimate
   Scale: 0.0–1.0 across A1→C2 (6 bands of 1/6 each)
   Algorithm: Logistic Elo weighted by activity difficulty
   ============================================================ */

window.AppProficiency = (() => {
  // Midpoint of each CEFR band on the 0–1 scale
  const CEFR_MID = {
    A1: 0.083, A2: 0.250, B1: 0.417,
    B2: 0.583, C1: 0.750, C2: 0.917,
  };

  // Lower boundary of each CEFR band (used for manual init — bias correction)
  const CEFR_BOUNDARY = {
    A1: 0.010, A2: 0.167, B1: 0.333,
    B2: 0.500, C1: 0.667, C2: 0.833,
  };

  // Production activities carry stronger signal than receptive ones
  const ACT_WEIGHT = {
    speaking:    1.30,
    grammar:     1.20,
    dictation:   1.15,
    translation: 1.10,
    scramble:    1.05,
    cloze:       1.00,
    vocabulary:  0.85,
    quiz:        0.80,
  };

  const KEY    = AppLangPair.storageKey('pe_user_proficiency');
  const LR     = 0.005;  // normal learning rate (~0.03–0.06 shift per session)
  const LR_QUIZ = 0.05;  // fast rate used during placement quiz (converges in ~10 answers)

  // ── Read ──────────────────────────────────────────────────

  function get() {
    return parseFloat(localStorage.getItem(KEY)) || 0.167;
  }

  // ── Init (called once, never overwrites existing value) ───

  // Case 2: user manually picked their level → start at lower boundary
  // (corrects Dunning-Kruger overestimation bias)
  function initFromManual(level) {
    if (localStorage.getItem(KEY)) return;
    const val = CEFR_BOUNDARY[level];
    if (val !== undefined) localStorage.setItem(KEY, val.toFixed(4));
  }

  // Case 3: user closed/skipped onboarding → A1/A2 boundary as neutral default
  function initDefault() {
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, '0.167');
  }

  // ── Update ────────────────────────────────────────────────

  // Case 1 (placement quiz) and all normal practice.
  // cefrLevel: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'
  // isCorrect: boolean
  // activityId: key from ACT_WEIGHT (or omit for default weight 1.0)
  // isQuiz: true during placement quiz to use faster LR
  function update(cefrLevel, isCorrect, activityId, isQuiz) {
    if (!cefrLevel || CEFR_MID[cefrLevel] === undefined) return;
    const cur    = get();
    const diff   = CEFR_MID[cefrLevel];
    const actW   = ACT_WEIGHT[activityId] || 1.0;
    const lr     = isQuiz ? LR_QUIZ : LR;
    // Logistic expected probability of a correct answer given user level vs card difficulty
    const expected = 1 / (1 + Math.exp(-8 * (cur - diff)));
    const delta    = lr * actW * ((isCorrect ? 1 : 0) - expected);
    const next     = Math.max(0.01, Math.min(0.99, cur + delta));
    localStorage.setItem(KEY, next.toFixed(4));
  }

  // ── Display helpers ───────────────────────────────────────

  function getLabel() {
    const p = get();
    if (p < 0.167) return 'A1';
    if (p < 0.333) return 'A2';
    if (p < 0.500) return 'B1';
    if (p < 0.667) return 'B2';
    if (p < 0.833) return 'C1';
    return 'C2';
  }

  // Percentage progress within the current CEFR band (0–100)
  function getBandPercent() {
    const p    = get();
    const size = 1 / 6;
    const band = Math.floor(p / size);
    return Math.round(((p - band * size) / size) * 100);
  }

  return { get, initFromManual, initDefault, update, getLabel, getBandPercent };
})();
