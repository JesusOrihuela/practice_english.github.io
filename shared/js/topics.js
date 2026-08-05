/* ============================================================
   topics.js — Canonical topic list (per-pair, Part B)
   Exposes window.AppTopics:
     PHRASE_TOPICS — phrase-based topics (speaking, dictation, cloze, …)
     VOCAB_TOPICS  — vocab-only ('general', 'society') + phrase topics with a word list
     load()        — async: load the ACTIVE PAIR's shared/json/pairs/{pairId}/topics.json
                     and override the embedded default (which covers es-en/en-es today).
     getRecords()  — raw per-topic records (id, level, order, emoji, label, labelEn, flags)
   The topic set/order/labels are now DATA per pair; the arrays below are the
   default/fallback so pages work synchronously before load() resolves. Activities
   call `await AppTopics.load()` early so a divergent pair gets its own topics.
   ============================================================ */

const AppTopics = (() => {
  // Embedded default records (es-en and en-es are identical today). Source of truth
  // per pair is shared/json/pairs/{pairId}/topics.json; load() overrides these.
  const _DEFAULT_RECORDS = [
    { id: 'greetings',      label: 'Saludos',               labelEn: 'Greetings',            emoji: '👋', phrase: true,  vocab: true,  level: 'A1', order: 1 },
    { id: 'personal_info',  label: 'Información Personal',   labelEn: 'Personal Information',  emoji: '🪪', phrase: true,  vocab: false, level: 'A1', order: 2 },
    { id: 'family',         label: 'Familia y Personas',    labelEn: 'Family & People',      emoji: '👪', phrase: true,  vocab: true,  level: 'A1', order: 3 },
    { id: 'emociones',      label: 'Emociones',             labelEn: 'Emotions',             emoji: '😊', phrase: true,  vocab: true,  level: 'A1', order: 4 },
    { id: 'daily_routine',  label: 'Rutina Diaria',         labelEn: 'Daily Routine',        emoji: '🕐', phrase: true,  vocab: false, level: 'A1', order: 5 },
    { id: 'survival',       label: 'Sobrevivir el Idioma',  labelEn: 'Language Survival',    emoji: '🆘', phrase: true,  vocab: false, level: 'A1', order: 6 },
    { id: 'weather',        label: 'Clima',                 labelEn: 'Weather',              emoji: '🌤️', phrase: true,  vocab: false, level: 'A1', order: 7 },
    { id: 'health',         label: 'Salud y Cuerpo',        labelEn: 'Health & Body',        emoji: '🩺', phrase: true,  vocab: true,  level: 'A2', order: 12 },
    { id: 'directions',     label: 'Direcciones y Lugares', labelEn: 'Directions & Places',  emoji: '🧭', phrase: true,  vocab: false, level: 'A2', order: 13 },
    { id: 'restaurant',     label: 'Restaurante',           labelEn: 'Restaurant',           emoji: '🍽️', phrase: true,  vocab: true,  level: 'A1', order: 8 },
    { id: 'supermarket',    label: 'Supermercado',          labelEn: 'Supermarket',          emoji: '🛒', phrase: true,  vocab: true,  level: 'A2', order: 16 },
    { id: 'transportation', label: 'Transporte',            labelEn: 'Transportation',       emoji: '🚌', phrase: true,  vocab: true,  level: 'A2', order: 18 },
    { id: 'airport',        label: 'Aeropuerto',            labelEn: 'Airport',              emoji: '✈️', phrase: true,  vocab: true,  level: 'A2', order: 19 },
    { id: 'accommodation',  label: 'Alojamiento',           labelEn: 'Accommodation',        emoji: '🏨', phrase: true,  vocab: true,  level: 'A2', order: 20 },
    { id: 'kitchen',        label: 'Cocina',                labelEn: 'Kitchen',              emoji: '🍳', phrase: true,  vocab: true,  level: 'A2', order: 17 },
    { id: 'movies',         label: 'Películas & Series',    labelEn: 'Movies & Series',      emoji: '🎬', phrase: true,  vocab: true,  level: 'A2', order: 21 },
    { id: 'music',          label: 'Música',                labelEn: 'Music',                emoji: '🎵', phrase: true,  vocab: true,  level: 'A2', order: 22 },
    { id: 'technology',     label: 'Tecnología',            labelEn: 'Technology',           emoji: '💻', phrase: true,  vocab: true,  level: 'B1', order: 24 },
    { id: 'gym',            label: 'Gimnasio',              labelEn: 'Gym',                  emoji: '💪', phrase: true,  vocab: true,  level: 'B1', order: 25 },
    { id: 'museums',        label: 'Museos & Arte',         labelEn: 'Museums & Art',        emoji: '🖼️', phrase: true,  vocab: true,  level: 'A2', order: 23 },
    { id: 'theater',        label: 'Teatro',                labelEn: 'Theater',              emoji: '🎭', phrase: true,  vocab: true,  level: 'B1', order: 26 },
    { id: 'accountability', label: 'Contabilidad',          labelEn: 'Accounting',           emoji: '📊', phrase: true,  vocab: true,  level: 'B2', order: 30 },
    { id: 'descripciones',  label: 'Descripciones',         labelEn: 'Descriptions',         emoji: '🔍', phrase: true,  vocab: false, level: 'A2', order: 9 },
    { id: 'conceptos', label: 'Ideas y conceptos', labelEn: 'Ideas & Concepts', emoji: '💭', phrase: true,  vocab: false, level: 'B1', order: 29 },
    { id: 'sociedad_actualidad', label: 'Sociedad y actualidad', labelEn: 'Society & Current Affairs', emoji: '📰', phrase: true,  vocab: false, level: 'B1', order: 28 },
    { id: 'trabajo_economia', label: 'Trabajo y economía', labelEn: 'Work & Economy', emoji: '💼', phrase: true,  vocab: false, level: 'B1', order: 27 },
    { id: 'planes', label: 'Planes y decisiones', labelEn: 'Plans & Decisions', emoji: '🎯', phrase: true,  vocab: false, level: 'A2', order: 11 },
    { id: 'tiempo_libre', label: 'Tiempo libre y cultura', labelEn: 'Leisure & Culture', emoji: '🎉', phrase: true,  vocab: false, level: 'A2', order: 15 },
    { id: 'naturaleza_lugares', label: 'Naturaleza y lugares', labelEn: 'Nature & Places', emoji: '🏞️', phrase: true,  vocab: false, level: 'A2', order: 14 },
    { id: 'conversacion', label: 'Conversación y opiniones', labelEn: 'Conversation & Opinions', emoji: '💬', phrase: true,  vocab: false, level: 'A2', order: 10 },
    { id: 'general',             label: 'Conceptos',            labelEn: 'Concepts',                emoji: '💡', phrase: false, vocab: true, vocabOrder: 0 },
    { id: 'verbos_basicos',      label: 'Verbos Básicos',       labelEn: 'Basic Verbs',             emoji: '🏃', phrase: false, vocab: true, vocabOrder: 1 },
    { id: 'verbos_avanzados',    label: 'Verbos Avanzados',     labelEn: 'Advanced Verbs',          emoji: '⚡', phrase: false, vocab: true, vocabOrder: 2 },
    { id: 'adjetivos_basicos',   label: 'Adjetivos Básicos',    labelEn: 'Basic Adjectives',        emoji: '🔤', phrase: false, vocab: true, vocabOrder: 3 },
    { id: 'adjetivos_avanzados', label: 'Adjetivos Avanzados',  labelEn: 'Advanced Adjectives',     emoji: '🔠', phrase: false, vocab: true, vocabOrder: 4 },
    { id: 'colores',             label: 'Colores',              labelEn: 'Colors',                  emoji: '🎨', phrase: false, vocab: true, vocabOrder: 5 },
    { id: 'naturaleza',          label: 'Naturaleza',           labelEn: 'Nature',                  emoji: '🌳', phrase: false, vocab: true, vocabOrder: 6 },
    { id: 'tiempo',              label: 'Tiempo',               labelEn: 'Time',                    emoji: '⏰', phrase: false, vocab: true, vocabOrder: 7 },
    { id: 'lugares',             label: 'Lugares',              labelEn: 'Places',                  emoji: '📍', phrase: false, vocab: true, vocabOrder: 8 },
    { id: 'cantidad',            label: 'Cantidad y Medida',    labelEn: 'Quantity & Measure',      emoji: '🔢', phrase: false, vocab: true, vocabOrder: 9 },
    { id: 'juegos',              label: 'Juegos y Ocio',        labelEn: 'Games & Leisure',         emoji: '🎲', phrase: false, vocab: true, vocabOrder: 10 },
    { id: 'ropa',                label: 'Ropa y Moda',          labelEn: 'Clothing & Fashion',      emoji: '👕', phrase: false, vocab: true, vocabOrder: 11 },
    { id: 'lengua',              label: 'Lengua y Comunicación',labelEn: 'Language & Communication',emoji: '🗣️', phrase: false, vocab: true, vocabOrder: 12 },
    { id: 'sociedad_politica',   label: 'Sociedad y Política',  labelEn: 'Society & Politics',      emoji: '🏛️', phrase: false, vocab: true, vocabOrder: 13 },
    { id: 'trabajo',             label: 'Trabajo y Economía',   labelEn: 'Work & Economy',          emoji: '💼', phrase: false, vocab: true, vocabOrder: 14 },
    { id: 'educacion',           label: 'Educación',            labelEn: 'Education',               emoji: '🎓', phrase: false, vocab: true, vocabOrder: 15 },
    { id: 'objetos',            label: 'Objetos y cosas',      labelEn: 'Objects & Things',        emoji: '📦', phrase: false, vocab: true, vocabOrder: 16 },
  ];

  const _view = t => ({ id: t.id, label: t.label, labelEn: t.labelEn, emoji: t.emoji });

  // Derive the two public arrays from the raw records.
  function _derive(records) {
    const phrase = records.filter(t => t.phrase).sort((a, b) => a.order - b.order).map(_view);
    const phraseOnly = new Set(records.filter(t => t.phrase && !t.vocab).map(t => t.id));
    const vocabOnly = records.filter(t => !t.phrase && t.vocab)
      .sort((a, b) => (a.vocabOrder ?? 99) - (b.vocabOrder ?? 99)).map(_view);
    const vocab = [...vocabOnly, ...phrase.filter(t => !phraseOnly.has(t.id))];
    return { phrase, vocab };
  }

  let _records = _DEFAULT_RECORDS;
  const _d = _derive(_records);
  const PHRASE_TOPICS = _d.phrase;   // mutated in place by load() (stable reference)
  const VOCAB_TOPICS  = _d.vocab;
  let _loadPromise = null;

  // Load the active pair's topics.json and override the default in place.
  function load() {
    if (_loadPromise) return _loadPromise;
    const p = (typeof AppData !== 'undefined') ? AppData.get('topics') : Promise.reject();
    _loadPromise = p.then(data => {
      const records = (data && Array.isArray(data.topics) && data.topics.length) ? data.topics : _DEFAULT_RECORDS;
      _records = records;
      const d = _derive(records);
      PHRASE_TOPICS.length = 0; PHRASE_TOPICS.push(...d.phrase);
      VOCAB_TOPICS.length = 0;  VOCAB_TOPICS.push(...d.vocab);
    }).catch(() => { /* keep embedded default */ });
    return _loadPromise;
  }

  function getRecords() { return _records; }

  // ── Topic label helper ────────────────────────────────────────
  // Returns the localized label for a topic object. Reads AppLang.t('topic_{id}')
  // if available; falls back to topic.labelEn (English source) or topic.label.
  function getLabel(topic) {
    if (typeof AppLang !== 'undefined') {
      var key = 'topic_' + topic.id;
      var val = AppLang.t(key);
      if (val !== key) return val;
    }
    var src = (typeof AppLangPair !== 'undefined') ? AppLangPair.getActive().source.code : 'es';
    return (src !== 'es' && topic.labelEn) ? topic.labelEn : topic.label;
  }

  // Eager load: start fetching the active pair's topics.json immediately so the
  // arrays are corrected in place before activities render. For es-en/en-es the
  // data equals the embedded default, so this is a no-op behaviorally. A divergent
  // pair may add `await AppTopics.load()` in activity init to guarantee zero FOUC.
  load();

  return { PHRASE_TOPICS, VOCAB_TOPICS, getLabel, load, getRecords };
})();
