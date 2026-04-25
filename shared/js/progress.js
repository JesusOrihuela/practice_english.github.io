/* ============================================================
   progress.js — Spaced Repetition System (SRS)
   Based on SM-2 (Wozniak 1990) with two intentional divergences:
     1. EF ceiling raised from 2.5 → 3.0 (standard caps at 2.5).
        Rationale: conversational phrases are short and high-frequency;
        a higher ceiling lets genuinely easy material space out faster,
        reducing review fatigue without hurting retention.
     2. Easy bonus multiplier of ×1.3 on interval (not in original SM-2).
        Rationale: same as above — rewards consistent recall more
        aggressively than the base algorithm.
   ============================================================ */

const Progress = (() => {
  const STORE_KEY      = 'pe_srs';
  const SCHEMA_VERSION = 1;

  // ---- SM-2 algorithm parameters -----------------------------------------
  const EF_DEFAULT      = 2.5;  // initial ease factor for every new card
  const EF_MIN          = 1.3;  // ease factor floor (SM-2 standard)
  const EF_MAX          = 3.0;  // ease factor ceiling (SM-2 standard is 2.5 — see file header)
  const EF_HARD_PENALTY = 0.2;  // ease deducted on Hard response (SM-2 standard is 0.3; softer here to reduce frustration on short conversational phrases)
  const EF_OK_PENALTY   = 0.14; // ease deducted on OK response (SM-2 spec)
  const EF_EASY_BOOST   = 0.1;  // ease added on Easy response
  const EF_EASY_BONUS   = 1.3;  // interval multiplier on Easy responses (see file header)
  // ------------------------------------------------------------------------

  // ---- Schema migrations -------------------------------------------------
  // Add entries here when the stored structure changes.
  // Each entry runs when storedVersion <= from and SCHEMA_VERSION > from.
  // Example:
  //   { from: 1, run(data) { /* rename / transform fields */ return data; } }
  const _migrations = [
    // v0 → v1: first versioned release — no structural changes, stamp only.
  ];

  function _migrate(data, storedVersion) {
    let d = data;
    for (const m of _migrations) {
      if (storedVersion <= m.from) d = m.run(d);
    }
    return d;
  }

  // -----------------------------------------------------------------------

  function _load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { _v: SCHEMA_VERSION };
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { _v: SCHEMA_VERSION };

      const storedVersion = typeof data._v === 'number' ? data._v : 0;
      if (storedVersion === SCHEMA_VERSION) {
        return data;
      }

      if (storedVersion < SCHEMA_VERSION) {
        // Migrate forward and persist immediately so stale data isn't reprocessed
        const migrated = _migrate(data, storedVersion);
        migrated._v = SCHEMA_VERSION;
        _save(migrated);
        return migrated;
      }

      // storedVersion > SCHEMA_VERSION: app downgrade — read as-is.
      // getAllCards() sanitizer handles any unknown / missing fields safely.
      return data;
    } catch (e) {
      return { _v: SCHEMA_VERSION };
    }
  }

  let _quotaWarned = false;

  function _showQuotaToast() {
    if (_quotaWarned) return;
    _quotaWarned = true;
    const t = document.createElement('div');
    t.setAttribute('role', 'alert');
    Object.assign(t.style, {
      position: 'fixed', bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)',
      background: '#b91c1c', color: '#fff', borderRadius: '0.5rem',
      padding: '0.6rem 1.1rem', fontSize: '0.85rem', fontWeight: '600',
      zIndex: '10000', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
      maxWidth: '90vw', textAlign: 'center',
    });
    t.textContent = '⚠️ Storage full — progress may not be saved. Clear browser data to free space.';
    document.body?.appendChild(t);
    setTimeout(() => t.remove(), 8000);
  }

  function _save(data) {
    data._v = SCHEMA_VERSION; // always stamp on write
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        _showQuotaToast();
      }
    }
  }

  /**
   * Return a card's current SRS state. If the card has never been rated,
   * returns a fresh default object (interval 0, EF_DEFAULT ease, 0 reps).
   * @param {string} id - Unique card ID (e.g. 'greetings_0').
   * @returns {{ interval: number, ease: number, reps: number, lapses: number }}
   */
  function getCard(id) {
    const data = _load();
    return data[id] || { interval: 0, ease: EF_DEFAULT, reps: 0, lapses: 0 };
  }

  /**
   * Rate a card after review and advance its SRS schedule.
   * @param {string} id      - Unique card ID.
   * @param {1|3|5}  quality - Recall quality: 1 = Hard, 3 = OK, 5 = Easy.
   */
  function rate(id, quality) {
    const data = _load();
    const card = data[id] || { interval: 0, ease: EF_DEFAULT, reps: 0, lapses: 0 };

    if (quality === 1) {
      // Hard/lapse: reset interval, lower ease, restart graduation sequence
      card.interval = 1;
      card.ease = Math.max(EF_MIN, card.ease - EF_HARD_PENALTY);
      card.lapses = (card.lapses || 0) + 1;
      card.reps = 0; // restart so next correct answer begins at 1-day interval
    } else if (quality === 3) {
      // OK: standard SM-2 progression + EF penalty per SM-2 spec
      if (card.reps === 0) card.interval = 1;
      else if (card.reps === 1) card.interval = 3;
      else card.interval = Math.max(1, Math.round(card.interval * card.ease));
      card.ease = Math.max(EF_MIN, card.ease - EF_OK_PENALTY);
    } else {
      // Easy: boosted progression
      if (card.reps === 0) card.interval = 3;
      else if (card.reps === 1) card.interval = 5;
      else card.interval = Math.max(1, Math.round(card.interval * card.ease * EF_EASY_BONUS));
      card.ease = Math.min(EF_MAX, card.ease + EF_EASY_BOOST);
    }

    // Gradual lapse decay: each correct review reduces the lapse count by 1.
    // A card that lapsed N times needs N more correct answers to leave "Hard Cards".
    if (quality >= 3) card.lapses = Math.max(0, (card.lapses || 0) - 1);

    card.reps = (card.reps || 0) + 1;
    data[id] = card;
    _save(data);
  }


  /**
   * Return review statistics for a topic.
   * @param {string} topic - SRS key prefix (e.g. 'greetings', 'cloze_restaurant').
   * @param {number} total - Total number of cards in the topic.
   * @returns {{ seen: number, total: number }}
   *   seen  — cards rated at least once
   *   total — same as the input total
   */
  function getTopicStats(topic, total) {
    const data = _load();
    let seen = 0;
    for (let i = 0; i < total; i++) {
      const card = data[`${topic}_${i}`];
      if (card && card.reps > 0) seen++;
    }
    return { seen, total };
  }

  /**
   * Append a session record and update the daily streak.
   * Keeps the last 100 session records to bound localStorage growth.
   * @param {string} topic   - SRS key prefix for the activity/topic.
   * @param {number} correct - Number of correct responses in the session.
   * @param {number} total   - Total responses attempted in the session.
   */
  function recordSession(topic, correct, total) {
    const data = _load();
    if (!data._sessions) data._sessions = [];
    data._sessions.push({
      date: new Date().toLocaleDateString('sv'),
      topic,
      correct,
      total
    });
    if (data._sessions.length > 100) data._sessions.shift();

    // Update streak (local-time dates so midnight in user's timezone resets the streak correctly)
    const today = new Date().toLocaleDateString('sv');
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yesterday = yd.toLocaleDateString('sv');
    if (!data._streak) data._streak = { current: 0, last: '', best: 0 };
    const s = data._streak;
    if (s.last !== today) {
      s.current = (s.last === yesterday) ? s.current + 1 : 1;
      s.last = today;
      s.best = Math.max(s.best, s.current);
    }
    _save(data);
  }

  /**
   * Return the current study streak.
   * @returns {{ current: number, last: string, best: number }}
   *   current — consecutive days studied up to and including today
   *   last    — ISO-style date string (YYYY-MM-DD) of the last study day
   *   best    — all-time longest streak
   */
  function getStreak() {
    return _load()._streak || { current: 0, last: '', best: 0 };
  }

  /**
   * Return the raw session history array (up to the last 100 entries).
   * Each entry: { date: string, topic: string, correct: number, total: number }
   * @returns {Array<{ date: string, topic: string, correct: number, total: number }>}
   */
  function getSessions() {
    return _load()._sessions || [];
  }

  /**
   * Returns a snapshot of all SRS card data keyed by cardId.
   * Sanitizes each card: non-object values are dropped; missing or
   * non-finite numeric fields fall back to safe defaults so callers
   * can always read .reps, .interval, .ease, .lapses safely.
   */
  function getAllCards() {
    const data = _load();
    const DEFAULTS = { interval: 0, ease: EF_DEFAULT, reps: 0, lapses: 0 };
    const out = {};

    for (const key of Object.keys(data)) {
      // Preserve internal meta-keys (_sessions, _streak, …) exactly as stored
      if (key.startsWith('_')) { out[key] = data[key]; continue; }

      const v = data[key];
      // Drop corrupted entries (null, string, array, …)
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;

      // Apply field-level defaults for any missing or non-finite numeric value
      const num = (field) =>
        typeof v[field] === 'number' && isFinite(v[field]) ? v[field] : DEFAULTS[field];

      out[key] = {
        interval: num('interval'),
        ease:     num('ease'),
        reps:     num('reps'),
        lapses:   num('lapses'),
      };
    }

    return out;
  }

  return { getCard, rate, getTopicStats, recordSession, getStreak, getSessions, getAllCards };
})();
