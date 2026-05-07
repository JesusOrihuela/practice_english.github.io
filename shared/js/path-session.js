/* ============================================================
   path-session.js — Guided Learning Path Session Controller
   Depends on: progress.js, path.js (loaded before this)

   Builds a daily queue of SRS cards in path order, persisted
   in sessionStorage so activities can advance through it.

   Queue item format:
     { cardId, topic, activityId, href, isNew }

   Supported activityIds:
     speaking, grammar, vocabulary, quiz, cloze, dictation, translation, scramble
   ============================================================ */

const PathSession = (() => {

  const SS_KEY        = 'pe_path_session';
  const MAX_MINUTES   = 20; // hard cap on total session length
  const NEW_LIMIT     = 10; // max new cards even if time budget allows more
  const MIN_NEW       = 3;  // always include at least this many new cards (even on heavy review days)

  // localStorage so the session survives tab/browser close mid-session.
  // Date check in getSession() already prevents yesterday's session from loading.

  // Order of activities per topic (pedagogical sequence)
  const ACT_ORDER = ['speaking', 'grammar', 'vocabulary', 'quiz', 'cloze', 'dictation', 'translation', 'scramble'];

  // Card prefix per phrase activity (matches progress.js convention)
  const PHRASE_PREFIX = {
    speaking:    '',
    cloze:       'cloze_',
    dictation:   'dict_',
    translation: 'trans_',
    scramble:    'scramble_',
  };

  // ── Time estimation (seconds per card per activity) ─────────────────────
  // Based on typical completion times: production activities take longer.
  const ACT_SECONDS = {
    speaking:    40,
    grammar:     50,
    vocabulary:  18,
    quiz:        15,
    cloze:       22,
    dictation:   30,
    translation: 28,
    scramble:    25,
  };
  const AVG_SECONDS = 28; // fallback

  function _estimateMinutes(queue) {
    if (!queue || queue.length === 0) return 0;
    const total = queue.reduce(function (sum, item) {
      return sum + (ACT_SECONDS[item.activityId] || AVG_SECONDS);
    }, 0);
    return Math.max(1, Math.round(total / 60));
  }

  // ── Difficulty curve (Metcalfe & Kornell 2005 — region of proximal learning)
  // Optimal session order: easy warm-up → hard peak → medium cool-down
  // Produces better retention than uniform difficulty ordering.

  function _difficultyScore(item, cards) {
    const card = cards[item.cardId];
    if (!card || card.reps === 0) return 1.0; // new = hardest
    const interval = card.interval || 1;
    // Lower interval = harder (recently failed or barely known)
    const base = Math.max(0.05, 1 - interval / 65);
    // Production activities add difficulty weight
    const actBonus = { grammar: 0.10, speaking: 0.08, translation: 0.06, dictation: 0.04 };
    return Math.min(1.0, base + (actBonus[item.activityId] || 0));
  }

  function _applyDifficultyCurve(items, cards) {
    if (items.length < 5) return items; // not worth reordering tiny sessions
    const scored = items.map(function (item) {
      return { item: item, score: _difficultyScore(item, cards) };
    });
    scored.sort(function (a, b) { return a.score - b.score; }); // ASC: 0=easiest, n-1=hardest

    const n         = scored.length;
    const warmupN   = Math.max(1, Math.floor(n * 0.20)); // easiest 20%  → warm-up
    const cooldownN = Math.max(1, Math.floor(n * 0.20)); // medium 20%   → cool-down (second easiest bucket)
    // hardest 60% → peak (everything between warmup and the last cooldownN)

    const warmup   = scored.slice(0, warmupN);                   // easiest
    const cooldown = scored.slice(warmupN, warmupN + cooldownN); // medium (second-easiest)
    const peak     = scored.slice(warmupN + cooldownN);          // hardest

    warmup.forEach(function (x)   { x.item.phase = 'warmup';   });
    peak.forEach(function (x)     { x.item.phase = 'peak';     });
    cooldown.forEach(function (x) { x.item.phase = 'cooldown'; });

    // Final order: easy warm-up → hard peak → medium cool-down
    return warmup.concat(peak).concat(cooldown).map(function (x) { return x.item; });
  }

  // Href builders (paths relative to root, activities prefix ../../ themselves)
  function _href(activityId, topic, cardId) {
    switch (activityId) {
      case 'speaking':    return 'speaking/html/speaking.html?topic='    + topic + '&card=' + cardId + '&path=1';
      case 'cloze':       return 'cloze/html/cloze.html?topic='          + topic + '&card=' + cardId + '&path=1';
      case 'dictation':   return 'dictation/html/dictation.html?topic='  + topic + '&card=' + cardId + '&path=1';
      case 'translation': return 'translation/html/translation.html?topic=' + topic + '&card=' + cardId + '&path=1';
      case 'scramble':    return 'scramble/html/scramble.html?topic='    + topic + '&card=' + cardId + '&path=1';
      case 'vocabulary':  return 'vocabulary/html/vocabulary.html?topic=' + topic + '&card=' + cardId + '&path=1';
      case 'quiz':        return 'quiz/html/quiz.html?topic='             + topic + '&card=' + cardId + '&path=1';
      case 'grammar':     return 'grammar/html/grammar.html?rule='        + cardId + '&path=1';
      default:            return 'index.html';
    }
  }

  function _todayStr() {
    const d = new Date();
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  // ── Load / save ─────────────────────────────────────────────────────────

  function _save(session) {
    try { localStorage.setItem(SS_KEY, JSON.stringify(session)); } catch (e) {}
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.date !== _todayStr()) return null;
      return s;
    } catch (e) { return null; }
  }

  // ── Build queue (shared logic) ───────────────────────────────────────────
  // Returns { queue, skippedReviews } without saving. Used by both
  // buildAndSave() and getTodaySummary() so counts are always identical.

  function _buildQueue() {
    if (typeof Progress === 'undefined' || typeof AppPath === 'undefined') return null;

    const cards   = Progress.getAllCards();
    const now     = Date.now();
    const topics  = AppPath.TOPICS;
    const grammar = typeof AppPath._getGrammarRules === 'function'
      ? AppPath._getGrammarRules() : [];

    const reviews  = [];
    const newCards = [];
    let newOrder   = 0;

    topics.forEach(function (t) {
      const topicId   = t.id;
      const phraseIds = Progress.getPhraseIds(topicId);
      const vocabIds  = Progress.getVocabIds(topicId);

      ACT_ORDER.forEach(function (actId) {
        let ids = [];

        if (actId in PHRASE_PREFIX) {
          ids = phraseIds.map(function (pid) { return PHRASE_PREFIX[actId] + pid; });
        } else if (actId === 'vocabulary') {
          const entry = _getVocabEntry(topicId);
          if (!entry) return;
          ids = vocabIds.map(function (id) { return entry.vocabBase + '_' + id; });
        } else if (actId === 'quiz') {
          const entry = _getVocabEntry(topicId);
          if (!entry) return;
          ids = vocabIds.map(function (id) { return entry.quizBase + '_' + id; });
        } else if (actId === 'grammar') {
          if (!grammar.length) return;
          grammar.forEach(function (rule) {
            if (!Array.isArray(rule.topics) || !rule.topics.includes(topicId)) return;
            ids.push('grammar_' + rule.category + '_' + rule.id);
          });
        }

        ids.forEach(function (cardId) {
          const card = cards[cardId];
          if (card && card.reps > 0) {
            if (card.due <= now)
              reviews.push({ cardId: cardId, topic: topicId, activityId: actId, due: card.due });
          } else if (!card || card.reps === 0) {
            newCards.push({ cardId: cardId, topic: topicId, activityId: actId, order: newOrder++ });
          }
        });
      });
    });

    // Sort reviews most-overdue first
    reviews.sort(function (a, b) { return a.due - b.due; });

    // ── Time-budget ──────────────────────────────────────────────────────────
    // Budget = MAX_MINUTES. Reserve MIN_NEW × AVG_SECONDS for new cards so
    // even heavy review days always include some new learning.
    const budgetSecs   = MAX_MINUTES * 60;
    const minNewSecs   = MIN_NEW * AVG_SECONDS;
    const reviewBudget = budgetSecs - minNewSecs;

    // Fill reviews up to review budget (exact per-activity cost)
    const selectedReviews = [];
    let reviewSecs = 0;
    for (let i = 0; i < reviews.length; i++) {
      const cost = ACT_SECONDS[reviews[i].activityId] || AVG_SECONDS;
      if (reviewSecs + cost > reviewBudget) break;
      selectedReviews.push(reviews[i]);
      reviewSecs += cost;
    }
    const skippedReviews = reviews.length - selectedReviews.length;

    // Fill new cards round-robin with remaining time, up to NEW_LIMIT
    const newBudgetSecs = budgetSecs - reviewSecs;
    const newByAct = {};
    ACT_ORDER.forEach(function (a) { newByAct[a] = []; });
    newCards.forEach(function (item) { newByAct[item.activityId].push(item); });

    const selectedNew = [];
    const usedIdx     = {};
    ACT_ORDER.forEach(function (a) { usedIdx[a] = 0; });
    let newSecs = 0;

    // Pass 1: one per activity type
    for (let ai = 0; ai < ACT_ORDER.length && selectedNew.length < NEW_LIMIT; ai++) {
      const a    = ACT_ORDER[ai];
      const cost = ACT_SECONDS[a] || AVG_SECONDS;
      if (newByAct[a].length > 0 && newSecs + cost <= newBudgetSecs) {
        selectedNew.push(newByAct[a][0]);
        usedIdx[a] = 1;
        newSecs += cost;
      }
    }
    // Pass 2+: fill remaining slots
    let safety = 0;
    while (selectedNew.length < NEW_LIMIT && safety++ < 500) {
      let added = false;
      for (let ai = 0; ai < ACT_ORDER.length && selectedNew.length < NEW_LIMIT; ai++) {
        const a    = ACT_ORDER[ai];
        const cost = ACT_SECONDS[a] || AVG_SECONDS;
        if (usedIdx[a] < newByAct[a].length && newSecs + cost <= newBudgetSecs) {
          selectedNew.push(newByAct[a][usedIdx[a]++]);
          newSecs += cost;
          added = true;
        }
      }
      if (!added) break;
    }

    // Map to queue items
    const rawQueue = selectedReviews.concat(selectedNew).map(function (item) {
      const hrefCardId = item.activityId === 'grammar'
        ? item.cardId.split('_').slice(2).join('_')
        : item.cardId;
      return {
        cardId:     item.cardId,
        topic:      item.topic,
        activityId: item.activityId,
        href:       _href(item.activityId, item.topic, hrefCardId),
        isNew:      !('due' in item),
      };
    });

    const queue = _applyDifficultyCurve(rawQueue, cards);
    return { queue: queue, skippedReviews: skippedReviews };
  }

  function buildAndSave() {
    const result = _buildQueue();
    if (!result) return null;

    const session = {
      date:             _todayStr(),
      queue:            result.queue,
      position:         0,
      estimatedMinutes: _estimateMinutes(result.queue),
      skippedReviews:   result.skippedReviews,
      started:          false,
    };

    _save(session);
    return session;
  }

  function start() {
    const s = getSession();
    if (!s) return;
    s.started = true;
    _save(s);
  }

  // ── Vocab entry helper ───────────────────────────────────────────────────

  function _getVocabEntry(topicId) {
    // Progress._ID_MAP.vocab is the source of truth but it's private.
    // We derive it from getVocabIds which reads from _ID_MAP internally.
    // The quizBase/vocabBase prefixes follow a known convention:
    //   vocabBase = 'vocab_' + topicId
    //   quizBase  = 'quiz_'  + topicId
    const vocabIds = Progress.getVocabIds(topicId);
    if (!vocabIds || vocabIds.length === 0) return null;
    return {
      vocabBase: 'vocab_' + topicId,
      quizBase:  'quiz_'  + topicId,
    };
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function getCurrentItem() {
    const s = getSession();
    if (!s || s.position >= s.queue.length) return null;
    return s.queue[s.position];
  }

  function advance() {
    const s = getSession();
    if (!s) return null;
    s.position++;
    _save(s);
    if (s.position >= s.queue.length) return null;
    return s.queue[s.position].href;
  }

  function getProgress() {
    const s = getSession();
    if (!s) return { current: 0, total: 0 };
    return { current: s.position + 1, total: s.queue.length };
  }

  function getTodaySummary() {
    // Build a dry-run queue (same logic as buildAndSave, without saving).
    // This is the single source of truth — no duplicated counting logic.
    const session = _buildQueue();
    if (!session) return { reviewCount: 0, skippedReviews: 0, newCount: 0, hasAnything: false, estimatedMinutes: 0 };

    const reviewCount    = session.queue.filter(function (i) { return !i.isNew; }).length;
    const newCount       = session.queue.filter(function (i) { return  i.isNew; }).length;
    const estimatedMinutes = _estimateMinutes(session.queue);

    return {
      reviewCount:      reviewCount,
      skippedReviews:   session.skippedReviews,
      newCount:         newCount,
      hasAnything:      session.queue.length > 0,
      estimatedMinutes: estimatedMinutes,
    };
  }

  function getRemainingMinutes() {
    const s = getSession();
    if (!s) return 0;
    return _estimateMinutes(s.queue.slice(s.position));
  }

  function isActive() {
    const s = getSession();
    return s !== null && s.started === true && s.position < s.queue.length;
  }

  function clear() {
    try { localStorage.removeItem(SS_KEY); } catch (e) {}
  }

  return {
    buildAndSave:      buildAndSave,
    start:             start,
    getSession:        getSession,
    getCurrentItem:    getCurrentItem,
    advance:           advance,
    getProgress:       getProgress,
    getTodaySummary:   getTodaySummary,
    getRemainingMinutes: getRemainingMinutes,
    isActive:          isActive,
    clear:             clear,
  };

})();
