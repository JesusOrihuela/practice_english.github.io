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
    { id: 'theater',        label: 'Teatro',             labelEn: 'Theater',         emoji: '🎭' },
    { id: 'museums',        label: 'Museos & Arte',      labelEn: 'Museums & Art',   emoji: '🖼️' },
    { id: 'gym',            label: 'Gimnasio',           labelEn: 'Gym',             emoji: '💪' },
    { id: 'technology',     label: 'Tecnología',         labelEn: 'Technology',      emoji: '💻' },
    { id: 'accountability', label: 'Contabilidad',       labelEn: 'Accounting',      emoji: '📊' },
    { id: 'personal_info',  label: 'Información Personal',labelEn: 'Personal Info',   emoji: '🪪' },
    { id: 'family',         label: 'Familia y Personas', labelEn: 'Family & People',  emoji: '👪' },
    { id: 'daily_routine',  label: 'Rutina Diaria',      labelEn: 'Daily Routine',   emoji: '🕐' },
    { id: 'health',         label: 'Salud y Cuerpo',     labelEn: 'Health & Body',   emoji: '🩺' },
  ];

  // Phrase-only topics (no vocabulary set) are excluded from the word activities
  // (Vocabulario, Quiz) which would otherwise fail to load them.
  const PHRASE_ONLY = new Set(['emociones', 'museums', 'personal_info', 'family', 'daily_routine', 'health']);
  const VOCAB_TOPICS = [
    { id: 'general', label: 'General', labelEn: 'General', emoji: '📖' },
    ...PHRASE_TOPICS.filter(t => !PHRASE_ONLY.has(t.id)),
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
