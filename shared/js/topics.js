/* ============================================================
   topics.js — Canonical topic list (single source of truth)
   Exposes window.AppTopics with two arrays:
     PHRASE_TOPICS — 13 phrase-based topics (speaking, dictation, cloze,
                     translation, scramble, progress)
     VOCAB_TOPICS  — general + 13 topics (quiz, vocabulary)
   Do not duplicate this list in activity files.
   ============================================================ */

const AppTopics = (() => {
  const PHRASE_TOPICS = [
    { id: 'greetings',      label: 'Saludos',           emoji: '👋' },
    { id: 'restaurant',     label: 'Restaurante',        emoji: '🍽️' },
    { id: 'supermarket',    label: 'Supermercado',       emoji: '🛒' },
    { id: 'kitchen',        label: 'Cocina',             emoji: '🍳' },
    { id: 'transportation', label: 'Transporte',         emoji: '🚌' },
    { id: 'airport',        label: 'Aeropuerto',         emoji: '✈️' },
    { id: 'accommodation',  label: 'Alojamiento',        emoji: '🏨' },
    { id: 'movies',         label: 'Películas & Series', emoji: '🎬' },
    { id: 'music',          label: 'Música',             emoji: '🎵' },
    { id: 'theater',        label: 'Teatro & Arte',      emoji: '🎭' },
    { id: 'gym',            label: 'Gimnasio',           emoji: '💪' },
    { id: 'technology',     label: 'Tecnología',         emoji: '💻' },
    { id: 'accountability', label: 'Contabilidad',       emoji: '🎯' },
  ];

  const VOCAB_TOPICS = [
    { id: 'general',        label: 'General',         emoji: '📖' },
    ...PHRASE_TOPICS,
  ];

  return { PHRASE_TOPICS, VOCAB_TOPICS };
})();
