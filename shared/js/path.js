/* ============================================================
   path.js — Learning Path Data Layer
   Defines CEFR topic order, guide thresholds, and activity mapping.
   Exposes window.AppPath.

   Model: "guide + freedom"
     - All topics are ALWAYS accessible (no hard locks).
     - Topics appear as 'active' when naturally recommended.
     - Topics not yet recommended appear as 'ahead' — grayed,
       labeled "Recommended after X", with an escape-hatch link.

   Guide threshold (when a topic becomes 'active'):
     - Topic 1 (Greetings): always active.
     - Topic N: becomes active when the PREVIOUS topic has ≥ 30%
       of its Speaking cards seen at least once (reps ≥ 1).
       Speaking is used because it's the primary/entry activity.
       30% ≈ 2–3 sessions, so the gate is light.

   Complete threshold: combined mastery % ≥ 80% across all activities.
   ============================================================ */

const AppPath = (() => {

  // ── CEFR-ordered topic list ─────────────────────────────────────────────
  const TOPICS = [
    { id: 'greetings',      level: 'A1', emoji: '👋', label: 'Greetings',      order: 1 },
    { id: 'restaurant',     level: 'A1', emoji: '🍽️', label: 'Restaurant',     order: 2 },
    { id: 'supermarket',    level: 'A2', emoji: '🛒', label: 'Supermarket',    order: 3 },
    { id: 'kitchen',        level: 'A2', emoji: '🍳', label: 'Kitchen',        order: 4 },
    { id: 'traveling',      level: 'A2', emoji: '✈️', label: 'Traveling',      order: 5 },
    { id: 'entertainment',  level: 'B1', emoji: '🎬', label: 'Entertainment',  order: 6 },
    { id: 'gym',            level: 'B1', emoji: '💪', label: 'Gym',            order: 7 },
    { id: 'technology',     level: 'B1', emoji: '💻', label: 'Technology',     order: 8 },
    { id: 'accountability', level: 'B2', emoji: '🎯', label: 'Accountability', order: 9 },
  ];

  // ── Grammar rule count (matches grammar-rules.json "rules" array length) ─
  const GRAMMAR_TOTAL = 28;

  // ── Activity definitions ─────────────────────────────────────────────────
  const ACTIVITIES = [
    {
      id: 'speaking',
      emoji: '🎙️',
      label: 'Speaking',
      skill: 'speaking',
      href: topicId => `speaking/html/speaking.html?topic=${topicId}`,
      actPrefix: '',
    },
    {
      id: 'dictation',
      emoji: '✍️',
      label: 'Dictation',
      skill: 'listening',
      href: topicId => `dictation/html/dictation.html?topic=${topicId}`,
      actPrefix: 'dict_',
    },
    {
      id: 'cloze',
      emoji: '🔤',
      label: 'Cloze',
      skill: 'reading',
      href: topicId => `cloze/html/cloze.html?topic=${topicId}`,
      actPrefix: 'cloze_',
    },
    {
      id: 'scramble',
      emoji: '🧩',
      label: 'Scramble',
      skill: 'writing',
      href: topicId => `scramble/html/scramble.html?topic=${topicId}`,
      actPrefix: 'scramble_',
    },
    {
      id: 'translation',
      emoji: '🔄',
      label: 'Translation',
      skill: 'writing',
      href: topicId => `translation/html/translation.html?topic=${topicId}`,
      actPrefix: 'trans_',
    },
  ];

  // ── Vocabulary/Quiz secondary activities (15 words per topic) ───────────
  const SECONDARY_ACTIVITIES = [
    {
      id: 'quiz',
      emoji: '🧠',
      label: 'Quiz',
      href: topicId => `quiz/html/quiz.html?topic=${topicId}`,
      cardPrefix: topicId => 'quiz_' + topicId,
      total: 15,
    },
    {
      id: 'vocabulary',
      emoji: '📚',
      label: 'Vocabulary',
      href: topicId => `vocabulary/html/vocabulary.html?topic=${topicId}`,
      cardPrefix: topicId => 'vocab_' + topicId,
      total: 15,
    },
  ];

  // ── Grammar rules cache (set via setGrammarRules after JSON fetch) ────────
  let _grammarRules = [];

  function setGrammarRules(rules) {
    _grammarRules = Array.isArray(rules) ? rules : [];
  }

  /**
   * Grammar rules relevant to a topic (matched by topics[] field in the rule).
   * Each rule declares which topics it belongs to — content-mapped, not just CEFR.
   * @returns {{ total, seen, due, titles, href }} or null if no rules loaded
   */
  function getTopicGrammarInfo(topicId) {
    if (_grammarRules.length === 0) return null;

    const relevant = _grammarRules.filter(r =>
      Array.isArray(r.topics) && r.topics.includes(topicId)
    );
    if (relevant.length === 0) return null;

    const cards = Progress.getAllCards();
    const now   = Date.now();
    let seen = 0, due = 0;

    relevant.forEach(r => {
      const key  = 'grammar_' + r.category + '_' + r.id;
      const card = cards[key];
      if (!card || card.reps === 0) return;
      seen++;
      if (card.due <= now) due++;
    });

    return {
      total:  relevant.length,
      seen,
      due,
      titles: relevant.map(r => r.title),
      href:   'grammar/html/grammar.html',
    };
  }

  // ── Thresholds ────────────────────────────────────────────────────────────
  // Previous topic's Speaking seen% needed for the next topic to become 'active'.
  // 30% ≈ ~20 phrases seen — achievable in 2-3 sessions.
  const GUIDE_THRESHOLD = 0.30;

  // A topic is 'complete' when combined mastery % reaches this.
  const COMPLETE_THRESHOLD = 0.80;

  // ── Internal mastery helpers ──────────────────────────────────────────────

  /**
   * Fraction of Speaking cards seen (reps ≥ 1) for a topic. Used for guide threshold.
   */
  function _speakingSeenFraction(topicId) {
    const phraseIds = Progress.getPhraseIds(topicId);
    if (phraseIds.length === 0) return 0;
    const stats = Progress.getStatsForCards(phraseIds);  // Speaking prefix = '' (phraseId IS the key)
    return stats.seen / phraseIds.length;
  }

  /**
   * Combined mastery % (average of mastered/total across all activities).
   * Returns 0–100 integer.
   */
  function getTopicMastery(topicId) {
    const phraseIds = Progress.getPhraseIds(topicId);
    if (phraseIds.length === 0) return 0;
    const cards = Progress.getAllCards();
    let sum = 0;
    ACTIVITIES.forEach(act => {
      let mastered = 0;
      phraseIds.forEach(pid => {
        const card = cards[act.actPrefix + pid];
        if (card && card.interval > 14) mastered++;
      });
      sum += mastered / phraseIds.length;
    });
    return Math.round((sum / ACTIVITIES.length) * 100);
  }

  /**
   * Mastery state per activity for a topic.
   * @returns {Array<{ id, emoji, label, skill, state, href }>}
   *   state: 'mastered'|'practiced'|'learning'|'new'
   */
  function getActivityStates(topicId) {
    const phraseIds = Progress.getPhraseIds(topicId);
    const cards = Progress.getAllCards();
    return ACTIVITIES.map(act => {
      let state = 'new';
      if (phraseIds.length > 0) {
        let mastered = 0, practiced = 0, seen = 0;
        phraseIds.forEach(pid => {
          const card = cards[act.actPrefix + pid];
          if (!card || card.reps === 0) return;
          seen++;
          if (card.interval > 14)     mastered++;
          else if (card.interval > 3) practiced++;
        });
        const total = phraseIds.length;
        if (mastered / total >= 0.50)              state = 'mastered';
        else if ((mastered + practiced) / total >= 0.40) state = 'practiced';
        else if (seen > 0)                         state = 'learning';
      }
      return { ...act, state, href: act.href(topicId) };
    });
  }

  /**
   * Status of every topic:  'active' | 'ahead' | 'complete'
   */
  function getTopicStatuses() {
    return TOPICS.map((topic, idx) => {
      const masteryPct = getTopicMastery(topic.id);

      let status;
      if (idx === 0) {
        status = masteryPct >= COMPLETE_THRESHOLD * 100 ? 'complete' : 'active';
      } else {
        const prevTopic = TOPICS[idx - 1];
        if (_speakingSeenFraction(prevTopic.id) >= GUIDE_THRESHOLD) {
          status = masteryPct >= COMPLETE_THRESHOLD * 100 ? 'complete' : 'active';
        } else {
          status = 'ahead';
        }
      }

      return { ...topic, status, masteryPct };
    });
  }

  /**
   * CEFR-level average mastery percentages.
   * @returns {{ A1, A2, B1, B2 }}  each 0–100
   */
  function getLevelProgress() {
    const levels = { A1: [], A2: [], B1: [], B2: [] };
    TOPICS.forEach(t => levels[t.level].push(getTopicMastery(t.id)));
    const out = {};
    Object.keys(levels).forEach(lvl => {
      const arr = levels[lvl];
      out[lvl] = arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
    });
    return out;
  }

  /**
   * Mastery state per secondary activity (Quiz, Vocabulary) for a topic.
   * @returns {Array<{ id, emoji, label, state, href }>}
   */
  function getSecondaryActivityStates(topicId) {
    const vocabIds = Progress.getVocabIds(topicId);
    const cards    = Progress.getAllCards();
    return SECONDARY_ACTIVITIES.map(act => {
      const prefix = act.cardPrefix(topicId);
      let mastered = 0, practicedPlus = 0, seen = 0;
      vocabIds.forEach(id => {
        const card = cards[prefix + '_' + id];
        if (!card || card.reps === 0) return;
        seen++;
        if (card.interval > 14)     { mastered++; practicedPlus++; }
        else if (card.interval > 3) practicedPlus++;
      });
      const total = vocabIds.length || act.total;
      let state = 'new';
      if (mastered / total >= 0.50)       state = 'mastered';
      else if (practicedPlus / total >= 0.40) state = 'practiced';
      else if (seen > 0)                  state = 'learning';
      return { ...act, state, href: act.href(topicId) };
    });
  }

  /**
   * Total due cards (reps > 0, due ≤ now) across all activities (primary + secondary) for a topic.
   */
  function getTopicDueCount(topicId) {
    const phraseIds = Progress.getPhraseIds(topicId);
    const vocabIds  = Progress.getVocabIds(topicId);
    const now   = Date.now();
    const cards = Progress.getAllCards();
    let due = 0;
    ACTIVITIES.forEach(act => {
      phraseIds.forEach(pid => {
        const card = cards[act.actPrefix + pid];
        if (card && card.reps > 0 && card.due <= now) due++;
      });
    });
    SECONDARY_ACTIVITIES.forEach(act => {
      const prefix = act.cardPrefix(topicId);
      vocabIds.forEach(id => {
        const card = cards[prefix + '_' + id];
        if (card && card.reps > 0 && card.due <= now) due++;
      });
    });
    return due;
  }

  /**
   * Soonest future due timestamp (ms) across all activities for a topic.
   * Only considers cards with reps > 0 and due > now (not yet due).
   * Returns null if no future-due cards exist.
   */
  function getTopicNextDue(topicId) {
    const phraseIds = Progress.getPhraseIds(topicId);
    const vocabIds  = Progress.getVocabIds(topicId);
    const now   = Date.now();
    const cards = Progress.getAllCards();
    let soonest = null;
    ACTIVITIES.forEach(act => {
      phraseIds.forEach(pid => {
        const card = cards[act.actPrefix + pid];
        if (!card || card.reps === 0 || card.due <= now) return;
        if (soonest === null || card.due < soonest) soonest = card.due;
      });
    });
    SECONDARY_ACTIVITIES.forEach(act => {
      const prefix = act.cardPrefix(topicId);
      vocabIds.forEach(id => {
        const card = cards[prefix + '_' + id];
        if (!card || card.reps === 0 || card.due <= now) return;
        if (soonest === null || card.due < soonest) soonest = card.due;
      });
    });
    return soonest;
  }

  /**
   * Grammar Workshop global progress (not topic-specific).
   * @returns {{ seen, due, nextDue, mastered, total }}
   *   nextDue — soonest future-due timestamp (ms), or null
   */
  function getGrammarProgress() {
    const cards = Progress.getAllCards();
    const now   = Date.now();
    let seen = 0, due = 0, mastered = 0, nextDue = null;
    Object.keys(cards).forEach(key => {
      if (!key.startsWith('grammar_')) return;
      const card = cards[key];
      if (!card || card.reps === 0) return;
      seen++;
      if (card.due <= now) {
        due++;
      } else if (nextDue === null || card.due < nextDue) {
        nextDue = card.due;
      }
      if (Progress.getMastery(key) === 'mastered') mastered++;
    });
    return { seen, due, nextDue, mastered, total: GRAMMAR_TOTAL };
  }

  /**
   * Activity href for "Continue →" CTA.
   * Priority: activity (primary or secondary) with the most due cards,
   * then primary new > learning > practiced, then secondary new > learning > practiced.
   */
  function getNextActivityHref(topicId) {
    const phraseIds = Progress.getPhraseIds(topicId);
    const vocabIds  = Progress.getVocabIds(topicId);
    const now   = Date.now();
    const cards = Progress.getAllCards();

    // Gather due counts across all activities (primary + secondary)
    const allDueCounts = [];

    ACTIVITIES.forEach(act => {
      if (phraseIds.length === 0) return;
      let due = 0;
      phraseIds.forEach(pid => {
        const card = cards[act.actPrefix + pid];
        if (card && card.reps > 0 && card.due <= now) due++;
      });
      allDueCounts.push({ act, due, secondary: false });
    });

    SECONDARY_ACTIVITIES.forEach(act => {
      const prefix = act.cardPrefix(topicId);
      let due = 0;
      vocabIds.forEach(id => {
        const card = cards[prefix + '_' + id];
        if (card && card.reps > 0 && card.due <= now) due++;
      });
      allDueCounts.push({ act, due, secondary: true });
    });

    // Prefer the activity (any type) with the most due cards
    const withDue = allDueCounts.filter(d => d.due > 0);
    if (withDue.length > 0) {
      withDue.sort((a, b) => b.due - a.due);
      return withDue[0].act.href;
    }

    // Fall back: primary activities by mastery state, then secondary
    const primaryStates = getActivityStates(topicId);
    const priority = ['new', 'learning', 'practiced', 'mastered'];
    for (const state of priority) {
      const match = primaryStates.find(a => a.state === state);
      if (match) return match.href;
    }

    const secStates = getSecondaryActivityStates(topicId);
    for (const state of priority) {
      const match = secStates.find(a => a.state === state);
      if (match) return match.href;
    }

    return ACTIVITIES[0].href(topicId);
  }

  /**
   * Hint text for 'ahead' topics.
   */
  function getAheadHint(topicId) {
    const idx = TOPICS.findIndex(t => t.id === topicId);
    if (idx <= 0) return '';
    return `Recommended after ${TOPICS[idx - 1].label}`;
  }

  /**
   * Direct href for an 'ahead' topic's first activity (escape hatch).
   */
  function getAheadHref(topicId) {
    return ACTIVITIES[0].href(topicId); // Speaking
  }

  /**
   * Ordered step states for the "Now Learning" path card.
   * Sequence: Speaking → Vocabulary → Cloze → Dictation → Translation → Scramble → Grammar
   * Each step: { actId, emoji, label, href, mastered, due, total, state }
   * state: 'done' | 'next' (first incomplete) | 'upcoming'
   * Grammar step omitted when no rules exist for this topic.
   */
  function getTopicStepStates(topicId) {
    const phraseIds    = Progress.getPhraseIds(topicId);
    const vocabIds     = Progress.getVocabIds(topicId);
    const cards        = Progress.getAllCards();
    const now          = Date.now();
    const grammarRules = _grammarRules.filter(r =>
      Array.isArray(r.topics) && r.topics.includes(topicId)
    );

    function _stats(keyFn, ids) {
      let mastered = 0, due = 0;
      ids.forEach(function (id) {
        const card = cards[keyFn(id)];
        if (!card || card.reps === 0) return;
        if (card.interval > 14) mastered++;
        if (card.due <= now)    due++;
      });
      return { mastered: mastered, due: due, total: ids.length };
    }

    const spkAct   = ACTIVITIES.find(function (a) { return a.id === 'speaking'; });
    const dictAct  = ACTIVITIES.find(function (a) { return a.id === 'dictation'; });
    const clozeAct = ACTIVITIES.find(function (a) { return a.id === 'cloze'; });
    const scrAct   = ACTIVITIES.find(function (a) { return a.id === 'scramble'; });
    const transAct = ACTIVITIES.find(function (a) { return a.id === 'translation'; });
    const vocabAct = SECONDARY_ACTIVITIES.find(function (a) { return a.id === 'vocabulary'; });

    // Vocabulary: fall back to known total (15) when ID map not yet populated
    const vocabStats = vocabIds.length > 0
      ? _stats(function (id) { return vocabAct.cardPrefix(topicId) + '_' + id; }, vocabIds)
      : { mastered: 0, due: 0, total: vocabAct.total };

    let gMastered = 0, gDue = 0;
    grammarRules.forEach(function (r) {
      const key  = 'grammar_' + r.category + '_' + r.id;
      const card = cards[key];
      if (!card || card.reps === 0) return;
      if (card.interval > 14) gMastered++;
      if (card.due <= now)    gDue++;
    });

    const RAW = [
      { actId: 'speaking',    emoji: '🎙️', label: 'Speaking',
        href: spkAct.href(topicId),
        ..._stats(function (id) { return spkAct.actPrefix + id; }, phraseIds) },
      { actId: 'vocabulary',  emoji: '📚', label: 'Vocabulary',
        href: vocabAct.href(topicId), ...vocabStats },
      { actId: 'cloze',       emoji: '🔤', label: 'Cloze',
        href: clozeAct.href(topicId),
        ..._stats(function (id) { return clozeAct.actPrefix + id; }, phraseIds) },
      { actId: 'dictation',   emoji: '✍️', label: 'Dictation',
        href: dictAct.href(topicId),
        ..._stats(function (id) { return dictAct.actPrefix + id; }, phraseIds) },
      { actId: 'translation', emoji: '🔄', label: 'Translation',
        href: transAct.href(topicId),
        ..._stats(function (id) { return transAct.actPrefix + id; }, phraseIds) },
      { actId: 'scramble',    emoji: '🧩', label: 'Scramble',
        href: scrAct.href(topicId),
        ..._stats(function (id) { return scrAct.actPrefix + id; }, phraseIds) },
    ].concat(grammarRules.length > 0
      ? [{ actId: 'grammar', emoji: '📐', label: 'Grammar',
           href: 'grammar/html/grammar.html',
           mastered: gMastered, due: gDue, total: grammarRules.length }]
      : []);

    let nextAssigned = false;
    return RAW.map(function (step) {
      const isDone = step.total > 0 && step.mastered / step.total >= 0.50;
      if (isDone) return Object.assign({}, step, { state: 'done' });
      if (!nextAssigned) { nextAssigned = true; return Object.assign({}, step, { state: 'next' }); }
      return Object.assign({}, step, { state: 'upcoming' });
    });
  }

  return {
    TOPICS,
    ACTIVITIES,
    SECONDARY_ACTIVITIES,
    GRAMMAR_TOTAL,
    GUIDE_THRESHOLD,
    COMPLETE_THRESHOLD,
    getTopicStatuses,
    getTopicMastery,
    getTopicDueCount,
    getActivityStates,
    getSecondaryActivityStates,
    getTopicNextDue,
    getGrammarProgress,
    setGrammarRules,
    getTopicGrammarInfo,
    getLevelProgress,
    getNextActivityHref,
    getAheadHint,
    getAheadHref,
    getTopicStepStates,
    _getGrammarRules: function () { return _grammarRules; },
  };
})();
