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
    { id: 'greetings',              label: 'Saludos',                    labelEn: 'Greetings',                  emoji: '👋', phrase: true,  vocab: true, vocabOrder: 7, level: 'A1', order: 1 },
    { id: 'personal_info',          label: 'Información Personal',       labelEn: 'Personal Information',       emoji: '🪪', phrase: true,  vocab: false, level: 'A1', order: 3 },
    { id: 'family',                 label: 'Familia',                    labelEn: 'Family',                     emoji: '👪', phrase: true,  vocab: true, vocabOrder: 8, level: 'A1', order: 6 },
    { id: 'emociones',              label: 'Emociones',                  labelEn: 'Emotions',                   emoji: '😊', phrase: true,  vocab: true, vocabOrder: 9, level: 'A1', order: 7 },
    { id: 'daily_routine',          label: 'Rutina Diaria',              labelEn: 'Daily Routine',              emoji: '🕐', phrase: true,  vocab: false, level: 'A1', order: 4 },
    { id: 'cotidianidad',           label: 'Cotidianidad',               labelEn: 'Everyday Life',              emoji: '📅', phrase: true,  vocab: false, level: 'A2', order: 13 },
    { id: 'survival',               label: 'Sobrevivir el Idioma',       labelEn: 'Language Survival',          emoji: '🆘', phrase: true,  vocab: false, level: 'A1', order: 2 },
    { id: 'weather',                label: 'Clima',                      labelEn: 'Weather',                    emoji: '🌤️', phrase: true,  vocab: false, level: 'A1', order: 11 },
    { id: 'restaurant',             label: 'Restaurante',                labelEn: 'Restaurant',                 emoji: '🍽️', phrase: true,  vocab: true, vocabOrder: 15, level: 'A1', order: 10 },
    { id: 'descripciones',          label: 'Descripciones',              labelEn: 'Descriptions',               emoji: '🔍', phrase: true,  vocab: false, level: 'A2', order: 15 },
    { id: 'describiendo_personas',  label: 'Describiendo Personas',      labelEn: 'Describing People',          emoji: '🧑', phrase: true,  vocab: false, level: 'A2', order: 16 },
    { id: 'profesiones',            label: 'Profesiones',                labelEn: 'Professions',                emoji: '👔', phrase: true,  vocab: false, level: 'A2', order: 29 },
    { id: 'estudios',               label: 'Educación',                  labelEn: 'Education',                  emoji: '🎓', phrase: true,  vocab: false, level: 'A2', order: 30 },
    { id: 'conversacion',           label: 'Comunicación',               labelEn: 'Communication',              emoji: '💬', phrase: true,  vocab: false, level: 'A2', order: 12 },
    { id: 'pensamientos_opiniones', label: 'Pensamientos y Opiniones',   labelEn: 'Thoughts & Opinions',        emoji: '🧠', phrase: true,  vocab: false, level: 'A2', order: 17 },
    { id: 'planes',                 label: 'Decisiones',                 labelEn: 'Decisions',                  emoji: '🎯', phrase: true,  vocab: false, level: 'A2', order: 18 },
    { id: 'viajes',                 label: 'Viajes',                     labelEn: 'Travel',                     emoji: '🧳', phrase: true,  vocab: false, level: 'A2', order: 26 },
    { id: 'directions',             label: 'Direcciones',                labelEn: 'Directions',                 emoji: '🧭', phrase: true,  vocab: false, level: 'A2', order: 24 },
    { id: 'sitios',                 label: 'Lugares',                    labelEn: 'Places',                     emoji: '📍', phrase: true,  vocab: false, level: 'A2', order: 25 },
    { id: 'vestimenta',           label: 'Ropa',                      labelEn: 'Clothes',                   emoji: '👕', phrase: true,  vocab: false, level: 'A1', order: 9 },
    { id: 'hogar',                label: 'Hogar',                     labelEn: 'Home',                      emoji: '🏡', phrase: true,  vocab: false, level: 'A1', order: 8 },
    { id: 'calendario',           label: 'La Hora y la Fecha',        labelEn: 'Time & Date',               emoji: '🗓️', phrase: true,  vocab: false, level: 'A1', order: 5 },
    { id: 'emergencias',          label: 'Emergencias',               labelEn: 'Emergencies',               emoji: '🚨', phrase: true,  vocab: false, level: 'A2', order: 14 },
    { id: 'naturaleza_lugares',     label: 'Naturaleza',                 labelEn: 'Nature',                     emoji: '🏞️', phrase: true,  vocab: false, level: 'A2', order: 36 },
    { id: 'animales',               label: 'Animales',                   labelEn: 'Animals',                    emoji: '🐾', phrase: true,  vocab: false, level: 'A2', order: 37 },
    { id: 'deportes',               label: 'Deportes',                   labelEn: 'Sports',                     emoji: '⚽', phrase: true,  vocab: false, level: 'A2', order: 32 },
    { id: 'tiempo_libre',           label: 'Pasatiempos',                labelEn: 'Hobbies',                    emoji: '🎨', phrase: true,  vocab: false, level: 'A2', order: 31 },
    { id: 'fiesta',                 label: 'Fiestas y diversión',        labelEn: 'Parties & Fun',              emoji: '🎉', phrase: true,  vocab: false, level: 'A2', order: 31 },
    { id: 'health',                 label: 'Salud',                      labelEn: 'Health',                     emoji: '🩺', phrase: true,  vocab: true, vocabOrder: 14, level: 'A2', order: 19 },
    { id: 'cuerpo',                 label: 'Cuerpo',                     labelEn: 'Body',                       emoji: '🦵', phrase: true,  vocab: false, level: 'A2', order: 20 },
    { id: 'supermarket',            label: 'Supermercado',               labelEn: 'Supermarket',                emoji: '🛒', phrase: true,  vocab: true, vocabOrder: 16, level: 'A2', order: 21 },
    { id: 'kitchen',                label: 'Cocina',                     labelEn: 'Kitchen',                    emoji: '🍳', phrase: true,  vocab: true, vocabOrder: 17, level: 'A2', order: 22 },
    { id: 'transportation',         label: 'Transporte',                 labelEn: 'Transportation',             emoji: '🚌', phrase: true,  vocab: true, vocabOrder: 18, level: 'A2', order: 23 },
    { id: 'airport',                label: 'Aeropuerto',                 labelEn: 'Airport',                    emoji: '✈️', phrase: true,  vocab: true, vocabOrder: 29, level: 'A2', order: 27 },
    { id: 'accommodation',          label: 'Alojamiento',                labelEn: 'Accommodation',              emoji: '🏨', phrase: true,  vocab: true, vocabOrder: 30, level: 'A2', order: 28 },
    { id: 'movies',                 label: 'Películas & Series',         labelEn: 'Movies & Series',            emoji: '🎬', phrase: true,  vocab: true, vocabOrder: 25, level: 'A2', order: 33 },
    { id: 'music',                  label: 'Música',                     labelEn: 'Music',                      emoji: '🎵', phrase: true,  vocab: true, vocabOrder: 24, level: 'A2', order: 34 },
    { id: 'museums',                label: 'Museos & Arte',              labelEn: 'Museums & Art',              emoji: '🖼️', phrase: true,  vocab: true, vocabOrder: 26, level: 'A2', order: 35 },
    { id: 'economia',               label: 'Economía',                   labelEn: 'Economy',                    emoji: '💰', phrase: true,  vocab: false, level: 'B1', order: 40 },
    { id: 'oficina',                label: 'Oficina',                    labelEn: 'Office',                     emoji: '💼', phrase: true,  vocab: false, level: 'B1', order: 39 },
    { id: 'politica',               label: 'Política',                   labelEn: 'Politics',                   emoji: '🏛️', phrase: true,  vocab: false, level: 'B1', order: 42 },
    { id: 'technology',             label: 'Tecnología',                 labelEn: 'Technology',                 emoji: '💻', phrase: true,  vocab: false, level: 'B1', order: 38 },
    { id: 'gym',                    label: 'Gimnasio',                   labelEn: 'Gym',                        emoji: '💪', phrase: true,  vocab: true, vocabOrder: 28, level: 'B1', order: 41 },
    { id: 'theater',                label: 'Teatro',                     labelEn: 'Theater',                    emoji: '🎭', phrase: true,  vocab: true, vocabOrder: 27, level: 'B1', order: 43 },
    { id: 'accountability',         label: 'Contabilidad',               labelEn: 'Accounting',                 emoji: '📊', phrase: true,  vocab: true, vocabOrder: 36, level: 'B2', order: 44 },
    { id: 'general',             label: 'Conceptos',            labelEn: 'Concepts',                emoji: '💡', phrase: false, vocab: true, vocabOrder: 19 },
    { id: 'verbos_basicos',      label: 'Verbos Básicos',       labelEn: 'Basic Verbs',             emoji: '🏃', phrase: false, vocab: true, vocabOrder: 0 },
    { id: 'verbos_avanzados',    label: 'Verbos Avanzados',     labelEn: 'Advanced Verbs',          emoji: '⚡', phrase: false, vocab: true, vocabOrder: 1 },
    { id: 'adjetivos_basicos',   label: 'Adjetivos Básicos',    labelEn: 'Basic Adjectives',        emoji: '🔤', phrase: false, vocab: true, vocabOrder: 2 },
    { id: 'adjetivos_avanzados', label: 'Adjetivos Avanzados',  labelEn: 'Advanced Adjectives',     emoji: '🔠', phrase: false, vocab: true, vocabOrder: 3 },
    { id: 'colores',             label: 'Colores',              labelEn: 'Colors',                  emoji: '🎨', phrase: false, vocab: true, vocabOrder: 4 },
    { id: 'naturaleza',          label: 'Naturaleza',           labelEn: 'Nature',                  emoji: '🌳', phrase: false, vocab: true, vocabOrder: 12 },
    { id: 'tiempo',              label: 'Tiempo',               labelEn: 'Time',                    emoji: '⏰', phrase: false, vocab: true, vocabOrder: 6 },
    { id: 'lugares',             label: 'Lugares',              labelEn: 'Places',                  emoji: '📍', phrase: false, vocab: true, vocabOrder: 11 },
    { id: 'cantidad',            label: 'Cantidad y Medida',    labelEn: 'Quantity & Measure',      emoji: '🔢', phrase: false, vocab: true, vocabOrder: 5 },
    { id: 'juegos',              label: 'Juegos y Ocio',        labelEn: 'Games & Leisure',         emoji: '🎲', phrase: false, vocab: true, vocabOrder: 23 },
    { id: 'ropa',                label: 'Ropa y Moda',          labelEn: 'Clothing & Fashion',      emoji: '👕', phrase: false, vocab: true, vocabOrder: 13 },
    { id: 'lengua',              label: 'Lengua y Comunicación',labelEn: 'Language & Communication',emoji: '🗣️', phrase: false, vocab: true, vocabOrder: 22 },
    { id: 'sociedad_politica',   label: 'Sociedad y Política',  labelEn: 'Society & Politics',      emoji: '🏛️', phrase: false, vocab: true, vocabOrder: 34 },
    { id: 'trabajo',             label: 'Trabajo y Economía',   labelEn: 'Work & Economy',          emoji: '💼', phrase: false, vocab: true, vocabOrder: 21 },
    { id: 'educacion',           label: 'Educación',            labelEn: 'Education',               emoji: '🎓', phrase: false, vocab: true, vocabOrder: 20 },
    { id: 'objetos',            label: 'Objetos y cosas',      labelEn: 'Objects & Things',        emoji: '📦', phrase: false, vocab: true, vocabOrder: 10 },
    { id: 'dispositivos',          label: 'Dispositivos',         labelEn: 'Devices',                 emoji: '📱', phrase: false, vocab: true, vocabOrder: 31 },
    { id: 'internet_conectividad', label: 'Internet y Conexión',  labelEn: 'Internet & Connectivity', emoji: '🌐', phrase: false, vocab: true, vocabOrder: 32 },
    { id: 'software_apps',         label: 'Software y Apps',      labelEn: 'Software & Apps',         emoji: '🖥️', phrase: false, vocab: true, vocabOrder: 33 },
    { id: 'ciberseguridad',        label: 'Ciberseguridad',       labelEn: 'Cybersecurity',           emoji: '🔒', phrase: false, vocab: true, vocabOrder: 35 },
  ];

  const _view = t => ({ id: t.id, label: t.label, labelEn: t.labelEn, emoji: t.emoji });

  // Derive the two public arrays from the raw records.
  function _derive(records) {
    const phrase = records.filter(t => t.phrase).sort((a, b) => a.order - b.order).map(_view);
    // Single unified vocabOrder across ALL vocab decks (vocab-only + situational),
    // so the grid leads with the most useful/common decks — mirroring the phrase
    // grid's single `order`. Every vocab deck carries a vocabOrder.
    const vocab = records.filter(t => t.vocab)
      .sort((a, b) => (a.vocabOrder ?? 99) - (b.vocabOrder ?? 99)).map(_view);
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
    // Script-order safety: if AppData isn't defined yet (this script loaded before topic-data.js),
    // reject WITHOUT caching so a later call — after all scripts are parsed — actually fetches the
    // pair's topics.json. Caching the failure here left a divergent pair stuck on the default list.
    if (typeof AppData === 'undefined') return Promise.reject(new Error('AppData not ready'));
    _loadPromise = AppData.get('topics').then(data => {
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
