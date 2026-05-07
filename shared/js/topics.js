/* ============================================================
   topics.js — Canonical topic list (single source of truth)
   Exposes window.AppTopics with two arrays:
     PHRASE_TOPICS — 9 phrase-based topics (speaking, dictation, cloze,
                     translation, scramble, progress)
     VOCAB_TOPICS  — general + 9 topics (quiz, vocabulary)
   Do not duplicate this list in activity files.
   ============================================================ */

const AppTopics = (() => {
  const PHRASE_TOPICS = [
    { id: 'greetings',      label: 'Greetings',      emoji: '👋' },
    { id: 'restaurant',     label: 'Restaurant',      emoji: '🍽️' },
    { id: 'supermarket',    label: 'Supermarket',     emoji: '🛒' },
    { id: 'kitchen',        label: 'Kitchen',         emoji: '🍳' },
    { id: 'traveling',      label: 'Traveling',       emoji: '✈️' },
    { id: 'entertainment',  label: 'Entertainment',   emoji: '🎬' },
    { id: 'gym',            label: 'Gym',             emoji: '💪' },
    { id: 'technology',     label: 'Technology',      emoji: '💻' },
    { id: 'accountability', label: 'Accountability',  emoji: '🎯' },
  ];

  const VOCAB_TOPICS = [
    { id: 'general',        label: 'General',         emoji: '📖' },
    ...PHRASE_TOPICS,
  ];

  return { PHRASE_TOPICS, VOCAB_TOPICS };
})();
