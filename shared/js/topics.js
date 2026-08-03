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
    { id: 'greetings',    label: 'Saludos',                  labelEn: 'Greetings',            emoji: '👋' },
    { id: 'personal_info', label: 'Información Personal',     labelEn: 'Personal Information',  emoji: '🪪' },
    { id: 'family',       label: 'Familia y Personas',       labelEn: 'Family & People',      emoji: '👪' },
    { id: 'emociones',    label: 'Emociones',                labelEn: 'Emotions',             emoji: '😊' },
    { id: 'daily_routine', label: 'Rutina Diaria',            labelEn: 'Daily Routine',        emoji: '🕐' },
    { id: 'survival',     label: 'Sobrevivir el Idioma',     labelEn: 'Language Survival',    emoji: '🆘' },
    { id: 'weather',      label: 'Clima',                    labelEn: 'Weather',              emoji: '🌤️' },
    { id: 'health',       label: 'Salud y Cuerpo',           labelEn: 'Health & Body',        emoji: '🩺' },
    { id: 'directions',   label: 'Direcciones y Lugares',    labelEn: 'Directions & Places',  emoji: '🧭' },
    { id: 'restaurant',   label: 'Restaurante',              labelEn: 'Restaurant',           emoji: '🍽️' },
    { id: 'supermarket',  label: 'Supermercado',             labelEn: 'Supermarket',          emoji: '🛒' },
    { id: 'transportation', label: 'Transporte',               labelEn: 'Transportation',       emoji: '🚌' },
    { id: 'airport',      label: 'Aeropuerto',               labelEn: 'Airport',              emoji: '✈️' },
    { id: 'accommodation', label: 'Alojamiento',              labelEn: 'Accommodation',        emoji: '🏨' },
    { id: 'kitchen',      label: 'Cocina',                   labelEn: 'Kitchen',              emoji: '🍳' },
    { id: 'movies',       label: 'Películas & Series',       labelEn: 'Movies & Series',      emoji: '🎬' },
    { id: 'music',        label: 'Música',                   labelEn: 'Music',                emoji: '🎵' },
    { id: 'technology',   label: 'Tecnología',               labelEn: 'Technology',           emoji: '💻' },
    { id: 'gym',          label: 'Gimnasio',                 labelEn: 'Gym',                  emoji: '💪' },
    { id: 'museums',      label: 'Museos & Arte',            labelEn: 'Museums & Art',        emoji: '🖼️' },
    { id: 'theater',      label: 'Teatro',                   labelEn: 'Theater',              emoji: '🎭' },
    { id: 'accountability', label: 'Contabilidad',             labelEn: 'Accounting',           emoji: '📊' },
  ];

  // Phrase-only topics (no vocabulary set) are excluded from the word activities
  // (Vocabulario, Quiz) which would otherwise fail to load them.
  const PHRASE_ONLY = new Set(['emociones', 'museums', 'personal_info', 'daily_routine', 'weather', 'directions', 'survival']);
  // Vocab-only topics (no phrase set) — like 'general', they carry a word list
  // but are not part of the CEFR learning path. Declared explicitly here.
  const VOCAB_ONLY = [
    { id: 'general', label: 'General', labelEn: 'General', emoji: '📖' },
    { id: 'society', label: 'Sociedad y Trabajo', labelEn: 'Society & Work', emoji: '🏛️' },
  ];
  const VOCAB_TOPICS = [
    ...VOCAB_ONLY,
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
