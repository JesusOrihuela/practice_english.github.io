/* ============================================================
   progress.js — Spaced Repetition System (SRS)
   Simplified SM-2 algorithm — shared across all activities
   ============================================================ */

const Progress = (() => {
  const STORE_KEY = 'pe_srs';

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function _save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { console.warn('SRS: localStorage unavailable'); }
  }

  // Get a card's state (creates default if new)
  function getCard(id) {
    const data = _load();
    return data[id] || { interval: 0, ease: 2.5, reps: 0, due: 0, lapses: 0 };
  }

  /**
   * Rate a card after review.
   * quality: 1 = Hard | 3 = OK | 5 = Easy
   */
  function rate(id, quality) {
    const data = _load();
    const card = data[id] || { interval: 0, ease: 2.5, reps: 0, due: 0, lapses: 0 };

    if (quality === 1) {
      // Hard/lapse: reset interval, lower ease, restart graduation sequence
      card.interval = 1;
      card.ease = Math.max(1.3, card.ease - 0.2);
      card.lapses = (card.lapses || 0) + 1;
      card.reps = 0; // restart so next correct answer begins at 1-day interval
    } else if (quality === 3) {
      // OK: standard SM-2 progression + EF penalty per SM-2 spec
      if (card.reps === 0) card.interval = 1;
      else if (card.reps === 1) card.interval = 3;
      else card.interval = Math.max(1, Math.round(card.interval * card.ease));
      card.ease = Math.max(1.3, card.ease - 0.14);
    } else {
      // Easy: boosted progression
      if (card.reps === 0) card.interval = 3;
      else if (card.reps === 1) card.interval = 5;
      else card.interval = Math.max(1, Math.round(card.interval * card.ease * 1.3));
      card.ease = Math.min(3.0, card.ease + 0.1);
    }

    card.reps = (card.reps || 0) + 1;
    card.due = Date.now() + card.interval * 86400000;
    data[id] = card;
    _save(data);
  }

  /**
   * Returns the best index from cardIds to study next.
   * excludeIndex: current card index to skip (avoid repeating same card)
   */
  function getNextIndex(cardIds, excludeIndex) {
    const data = _load();
    const now = Date.now();

    const newCards = cardIds
      .map((id, i) => ({ id, i }))
      .filter(({ i }) => i !== excludeIndex)
      .filter(({ id }) => !data[id] || data[id].reps === 0);

    const dueCards = cardIds
      .map((id, i) => ({ id, i }))
      .filter(({ i }) => i !== excludeIndex)
      .filter(({ id }) => data[id] && data[id].reps > 0 && data[id].due <= now);

    // Due cards first (most overdue first), then new cards
    if (dueCards.length > 0) {
      dueCards.sort((a, b) => data[a.id].due - data[b.id].due);
      return dueCards[0].i;
    }
    if (newCards.length > 0) {
      return newCards[0].i;
    }

    // All cards done for now — pick any card that isn't current
    const others = cardIds.map((_, i) => i).filter(i => i !== excludeIndex);
    if (others.length === 0) return 0;
    return others[Math.floor(Math.random() * others.length)];
  }

  /**
   * Returns { seen, due, total } for a given topic.
   * topic: the theme key (e.g. 'greetings')
   * total: total number of phrases/cards in that topic
   */
  function getTopicStats(topic, total) {
    const data = _load();
    const now = Date.now();
    let seen = 0, due = 0;
    for (let i = 0; i < total; i++) {
      const card = data[`${topic}_${i}`];
      if (card && card.reps > 0) {
        seen++;
        if (card.due <= now) due++;
      }
    }
    return { seen, due, total };
  }

  /**
   * Record a completed study session.
   * Also updates the daily streak.
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

  function getStreak() {
    return _load()._streak || { current: 0, last: '', best: 0 };
  }

  function getSessions() {
    return _load()._sessions || [];
  }

  /** Returns a snapshot of all SRS card data keyed by cardId. */
  function getAllCards() {
    return _load();
  }

  return { getCard, rate, getNextIndex, getTopicStats, recordSession, getStreak, getSessions, getAllCards };
})();
