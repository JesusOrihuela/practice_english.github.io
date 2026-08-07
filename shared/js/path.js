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
    { id: 'greetings',              level: 'A1', emoji: '👋', label: 'Saludos',                    labelEn: 'Greetings',                  order: 1 },
    { id: 'personal_info',          level: 'A1', emoji: '🪪', label: 'Información Personal',       labelEn: 'Personal Information',       order: 2 },
    { id: 'family',                 level: 'A1', emoji: '👪', label: 'Familia',                    labelEn: 'Family',                     order: 3 },
    { id: 'emociones',              level: 'A1', emoji: '😊', label: 'Emociones',                  labelEn: 'Emotions',                   order: 4 },
    { id: 'daily_routine',          level: 'A1', emoji: '🕐', label: 'Rutina Diaria',              labelEn: 'Daily Routine',              order: 5 },
    { id: 'cotidianidad',           level: 'A2', emoji: '📅', label: 'Cotidianidad',               labelEn: 'Everyday Life',              order: 6 },
    { id: 'survival',               level: 'A1', emoji: '🆘', label: 'Sobrevivir el Idioma',       labelEn: 'Language Survival',          order: 7 },
    { id: 'weather',                level: 'A1', emoji: '🌤️', label: 'Clima',                      labelEn: 'Weather',                    order: 8 },
    { id: 'restaurant',             level: 'A1', emoji: '🍽️', label: 'Restaurante',                labelEn: 'Restaurant',                 order: 9 },
    { id: 'descripciones',          level: 'A2', emoji: '🔍', label: 'Descripciones',              labelEn: 'Descriptions',               order: 10 },
    { id: 'describiendo_personas',  level: 'A2', emoji: '🧑', label: 'Describiendo Personas',      labelEn: 'Describing People',          order: 11 },
    { id: 'profesiones',            level: 'A2', emoji: '👔', label: 'Profesiones',                labelEn: 'Professions',                order: 12 },
    { id: 'estudios',               level: 'A2', emoji: '🎓', label: 'Educación',                  labelEn: 'Education',                  order: 12 },
    { id: 'conversacion',           level: 'A2', emoji: '💬', label: 'Comunicación',               labelEn: 'Communication',              order: 13 },
    { id: 'pensamientos_opiniones', level: 'A2', emoji: '🧠', label: 'Pensamientos y Opiniones',   labelEn: 'Thoughts & Opinions',        order: 14 },
    { id: 'planes',                 level: 'A2', emoji: '🎯', label: 'Decisiones',                 labelEn: 'Decisions',                  order: 15 },
    { id: 'viajes',                 level: 'A2', emoji: '🧳', label: 'Viajes',                     labelEn: 'Travel',                     order: 16 },
    { id: 'directions',             level: 'A2', emoji: '🧭', label: 'Direcciones',                labelEn: 'Directions',                 order: 17 },
    { id: 'sitios',                 level: 'A2', emoji: '📍', label: 'Lugares',                    labelEn: 'Places',                     order: 18 },
    { id: 'naturaleza_lugares',     level: 'A2', emoji: '🏞️', label: 'Naturaleza',                 labelEn: 'Nature',                     order: 19 },
    { id: 'animales',               level: 'A2', emoji: '🐾', label: 'Animales',                   labelEn: 'Animals',                    order: 20 },
    { id: 'deportes',               level: 'A2', emoji: '⚽', label: 'Deportes',                   labelEn: 'Sports',                     order: 21 },
    { id: 'tiempo_libre',           level: 'A2', emoji: '🎨', label: 'Pasatiempos',                labelEn: 'Hobbies',                    order: 22 },
    { id: 'health',                 level: 'A2', emoji: '🩺', label: 'Salud',                      labelEn: 'Health',                     order: 23 },
    { id: 'cuerpo',                 level: 'A2', emoji: '🦵', label: 'Cuerpo',                     labelEn: 'Body',                       order: 24 },
    { id: 'supermarket',            level: 'A2', emoji: '🛒', label: 'Supermercado',               labelEn: 'Supermarket',                order: 25 },
    { id: 'kitchen',                level: 'A2', emoji: '🍳', label: 'Cocina',                     labelEn: 'Kitchen',                    order: 26 },
    { id: 'transportation',         level: 'A2', emoji: '🚌', label: 'Transporte',                 labelEn: 'Transportation',             order: 27 },
    { id: 'airport',                level: 'A2', emoji: '✈️', label: 'Aeropuerto',                 labelEn: 'Airport',                    order: 28 },
    { id: 'accommodation',          level: 'A2', emoji: '🏨', label: 'Alojamiento',                labelEn: 'Accommodation',              order: 29 },
    { id: 'movies',                 level: 'A2', emoji: '🎬', label: 'Películas & Series',         labelEn: 'Movies & Series',            order: 30 },
    { id: 'music',                  level: 'A2', emoji: '🎵', label: 'Música',                     labelEn: 'Music',                      order: 31 },
    { id: 'museums',                level: 'A2', emoji: '🖼️', label: 'Museos & Arte',              labelEn: 'Museums & Art',              order: 32 },
    { id: 'economia',               level: 'B1', emoji: '💰', label: 'Economía',                   labelEn: 'Economy',                    order: 33 },
    { id: 'oficina',                level: 'B1', emoji: '💼', label: 'Oficina',                    labelEn: 'Office',                     order: 34 },
    { id: 'politica',               level: 'B1', emoji: '🏛️', label: 'Política',                   labelEn: 'Politics',                   order: 36 },
    { id: 'technology',             level: 'B1', emoji: '💻', label: 'Tecnología',                 labelEn: 'Technology',                 order: 35 },
    { id: 'gym',                    level: 'B1', emoji: '💪', label: 'Gimnasio',                   labelEn: 'Gym',                        order: 36 },
    { id: 'theater',                level: 'B1', emoji: '🎭', label: 'Teatro',                     labelEn: 'Theater',                    order: 37 },
    { id: 'conceptos',              level: 'B1', emoji: '💭', label: 'Ideas y conceptos',          labelEn: 'Ideas & Concepts',           order: 38 },
    { id: 'accountability',         level: 'B2', emoji: '📊', label: 'Contabilidad',               labelEn: 'Accounting',                 order: 39 },
  ];

  // ── Grammar rule count (matches grammar-rules.json "rules" array length) ─
  const GRAMMAR_TOTAL = 35;

  // ── Activity definitions ─────────────────────────────────────────────────
  const ACTIVITIES = [
    {
      id: 'speaking',
      emoji: '🎙️',
      label: 'Pronunciación',
      skill: 'speaking',
      href: topicId => `speaking/html/speaking.html?topic=${topicId}`,
      actPrefix: '',
    },
    {
      id: 'dictation',
      emoji: '✍️',
      label: 'Dictado',
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
      label: 'Secuencia',
      skill: 'writing',
      href: topicId => `scramble/html/scramble.html?topic=${topicId}`,
      actPrefix: 'scramble_',
    },
    {
      id: 'translation',
      emoji: '🔄',
      label: 'Traducción',
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
      label: 'Vocabulario',
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
   * Grammar rules available at the user's current CEFR level.
   * A rule with level null is always included (shown to all users).
   * Falls back to all rules if AppProficiency is unavailable.
   */
  function _leveledGrammarRules() {
    if (typeof AppProficiency === 'undefined') return _grammarRules;
    const userOrd = CEFR_ORDER[AppProficiency.getLabel()] ?? 5;
    return _grammarRules.filter(r => (CEFR_ORDER[r.level] ?? 0) <= userOrd);
  }

  /**
   * Grammar rules relevant to a topic (matched by topics[] field in the rule).
   * Each rule declares which topics it belongs to — content-mapped, not just CEFR.
   * @returns {{ total, seen, due, titles, href }} or null if no rules loaded
   */
  function getTopicGrammarInfo(topicId) {
    const leveled = _leveledGrammarRules();
    if (leveled.length === 0) return null;

    const relevant = leveled.filter(r =>
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
   *
   * Placement bootstrap: if the user has a placement level saved and has
   * never practiced Speaking in any topic, unlock all topics up to that
   * CEFR level so Mi Aprendizaje starts at the right place.
   * Once any Speaking card is seen the normal guide threshold takes over.
   */
  function getTopicStatuses() {
    const _cefrOrder = CEFR_ORDER;

    const _placementLevel = localStorage.getItem(AppLangPair.storageKey('pe_placement_level')); // 'A1'|'A2'|'B1'|'B2'|null

    // Bootstrap only applies when the user has zero Speaking practice across all topics.
    const _noPractice = _placementLevel
      ? TOPICS.every(t => _speakingSeenFraction(t.id) === 0)
      : false;

    return TOPICS.map((topic, idx) => {
      const masteryPct = getTopicMastery(topic.id);

      let status;
      if (idx === 0) {
        status = masteryPct >= COMPLETE_THRESHOLD * 100 ? 'complete' : 'active';
      } else if (_noPractice && (_cefrOrder[topic.level] ?? 99) <= (_cefrOrder[_placementLevel] ?? -1)) {
        // Placement bootstrap: topic is within the detected level — unlock it.
        status = 'active';
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
   * @returns {{ A1, A2, B1, B2, C1, C2 }}  each 0–100 (only levels present in TOPICS will have values)
   */
  function getLevelProgress() {
    const levels = Object.fromEntries(Object.keys(CEFR_ORDER).map(k => [k, []]));
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
    return { seen, due, nextDue, mastered, total: _leveledGrammarRules().length };
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
      return withDue[0].act.href(topicId);
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
    const _prevLabel = (typeof AppTopics !== 'undefined') ? AppTopics.getLabel(TOPICS[idx - 1]) : TOPICS[idx - 1].label;
    return (typeof AppLang !== 'undefined') ? AppLang.t('ahead_hint', { prev: _prevLabel }) : `Recomendado después de ${_prevLabel}`;
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
    const grammarRules = _leveledGrammarRules().filter(r =>
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
      { actId: 'speaking',    emoji: '🎙️', label: 'Pronunciación',
        href: spkAct.href(topicId),
        ..._stats(function (id) { return spkAct.actPrefix + id; }, phraseIds) },
      { actId: 'vocabulary',  emoji: '📚', label: 'Vocabulario',
        href: vocabAct.href(topicId), ...vocabStats },
      { actId: 'cloze',       emoji: '🔤', label: 'Cloze',
        href: clozeAct.href(topicId),
        ..._stats(function (id) { return clozeAct.actPrefix + id; }, phraseIds) },
      { actId: 'dictation',   emoji: '✍️', label: 'Dictado',
        href: dictAct.href(topicId),
        ..._stats(function (id) { return dictAct.actPrefix + id; }, phraseIds) },
      { actId: 'translation', emoji: '🔄', label: 'Traducción',
        href: transAct.href(topicId),
        ..._stats(function (id) { return transAct.actPrefix + id; }, phraseIds) },
      { actId: 'scramble',    emoji: '🧩', label: 'Secuencia',
        href: scrAct.href(topicId),
        ..._stats(function (id) { return scrAct.actPrefix + id; }, phraseIds) },
    ].concat(grammarRules.length > 0
      ? [{ actId: 'grammar', emoji: '📐', label: 'Gramática',
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

  // Part B: refresh TOPICS from the active pair's topics.json (reusing AppTopics'
  // fetch/cache). Keeps the embedded default above until loaded; mutates in place.
  let _loadPromise = null;
  function load() {
    if (_loadPromise) return _loadPromise;
    const base = (typeof AppTopics !== 'undefined' && AppTopics.load) ? AppTopics.load() : Promise.resolve();
    _loadPromise = base.then(() => {
      const recs = (typeof AppTopics !== 'undefined' && AppTopics.getRecords ? AppTopics.getRecords() : [])
        .filter(t => t.phrase);
      if (!recs.length) return;
      const rebuilt = recs.slice().sort((a, b) => a.order - b.order)
        .map(t => ({ id: t.id, level: t.level, emoji: t.emoji, label: t.label, labelEn: t.labelEn, order: t.order }));
      TOPICS.length = 0; TOPICS.push(...rebuilt);
    }).catch(() => {});
    return _loadPromise;
  }

  // Eager load: refresh TOPICS from the active pair's data as soon as AppTopics has it.
  load();

  return {
    TOPICS,
    load,
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
    _getGrammarRules: function () { return _leveledGrammarRules(); },
  };
})();
