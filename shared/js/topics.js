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
    { id: 'greetings',      label: 'Saludos',           labelEn: 'Greetings',       emoji: '👋' },
    { id: 'emociones',      label: 'Emociones',          labelEn: 'Emotions',        emoji: '😊' },
    { id: 'restaurant',     label: 'Restaurante',        labelEn: 'Restaurant',      emoji: '🍽️' },
    { id: 'supermarket',    label: 'Supermercado',       labelEn: 'Supermarket',     emoji: '🛒' },
    { id: 'kitchen',        label: 'Cocina',             labelEn: 'Kitchen',         emoji: '🍳' },
    { id: 'transportation', label: 'Transporte',         labelEn: 'Transportation',  emoji: '🚌' },
    { id: 'airport',        label: 'Aeropuerto',         labelEn: 'Airport',         emoji: '✈️' },
    { id: 'accommodation',  label: 'Alojamiento',        labelEn: 'Accommodation',   emoji: '🏨' },
    { id: 'movies',         label: 'Películas & Series', labelEn: 'Movies & Series', emoji: '🎬' },
    { id: 'music',          label: 'Música',             labelEn: 'Music',           emoji: '🎵' },
    { id: 'theater',        label: 'Teatro & Arte',      labelEn: 'Theater & Arts',  emoji: '🎭' },
    { id: 'gym',            label: 'Gimnasio',           labelEn: 'Gym',             emoji: '💪' },
    { id: 'technology',     label: 'Tecnología',         labelEn: 'Technology',      emoji: '💻' },
    { id: 'accountability', label: 'Contabilidad',       labelEn: 'Accountability',  emoji: '🎯' },
  ];

  // emociones is phrase-only (no vocabulary set), so it is excluded from the
  // word activities (Vocabulario, Quiz) which would otherwise fail to load it.
  const VOCAB_TOPICS = [
    { id: 'general', label: 'General', labelEn: 'General', emoji: '📖' },
    ...PHRASE_TOPICS.filter(t => t.id !== 'emociones'),
  ];

  // ── Topic label helper ────────────────────────────────────────
  // Returns the localized label for a topic object.
  // Reads from AppLang.t('topic_{id}') if available; falls back to
  // topic.labelEn (English source) or topic.label (Spanish source).
  function getLabel(topic) {
    if (typeof AppLang !== 'undefined') {
      var key = 'topic_' + topic.id;
      var val = AppLang.t(key);
      if (val !== key) return val;
    }
    var src = (typeof AppLangPair !== 'undefined') ? AppLangPair.getActive().source.code : 'es';
    return (src !== 'es' && topic.labelEn) ? topic.labelEn : topic.label;
  }

  return { PHRASE_TOPICS, VOCAB_TOPICS, getLabel };
})();
