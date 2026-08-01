/* ============================================================
   lang/ui.js — UI strings, selects by active source language.
   Must load after lang-pair.js (uses AppLangPair.getActive()).
   Access via: AppLang.t('key') or AppLang.t('key', { var: val })

   To add a source language:
     1. Add a new key (e.g. 'pt') to _DATA below with all strings translated.
     2. Add the pair to AppLangPair PAIRS in lang-pair.js.
   ============================================================ */
(function () {

  const _DATA = {

    es: {
      // ── Títulos del área de ejercicio ──────────────────────────
      speaking_title:         '¿Cómo se pronuncia?',
      speaking_sub:           'Escucha con atención y luego pronuncia la frase en voz alta.',
      dictation_title:        'Escucha y Escribe',
      cloze_title:            'Completa el espacio',
      translation_title:      'Traduce al {lang}',
      translation_sub:        'Lee la frase en {source} y escribe la versión en {lang}.',
      scramble_title:         'Construye la oración',

      // ── TTS / STT ───────────────────────────────────────────────
      tts_loading:            '🔊 Cargando modelo de voz…',
      tts_ready:              '🔊 Modelo de voz listo ✓',
      stt_loading:            '🎙️ Cargando modelo de voz…',
      stt_ready:              '🎙️ Modelo de voz listo ✓',
      stt_load_error:         'No se pudo cargar el modelo de reconocimiento. Verifica tu conexión e intenta de nuevo.',
      stt_not_available:      'Reconocimiento de voz no disponible.',

      // ── Micrófono ───────────────────────────────────────────────
      mic_blocked:            'Acceso al micrófono bloqueado. Permítelo en la configuración de tu navegador.',
      mic_not_found:          'No se encontró micrófono. Conecta uno e intenta de nuevo.',
      mic_error:              'No se pudo acceder al micrófono. Intenta de nuevo.',
      generic_error:          'Ocurrió un error. Intenta de nuevo.',

      // ── Speaking ────────────────────────────────────────────────
      speak_prompt:           'Presiona el botón cuando estés listo para hablar',
      recording_prompt:       '🎙 Grabando… toca Detener cuando termines',
      listening_prompt:       '🎙 Escuchando…',
      stop_recording:         '⏹ Detener',
      stop_recording_label:   'Detener grabación',
      transcribing:           '⏳ Transcribiendo…',
      transcribing_label:     'Transcribiendo tu voz',
      transcription_timeout:  'No se pudo transcribir. Intenta de nuevo.',
      not_understood:         '👂 ¡No pude entenderte!',

      // ── Feedback ────────────────────────────────────────────────
      feedback_correct:       '✓ ¡Correcto!',
      feedback_incorrect:     '✗ Incorrecto',
      feedback_your_answer:   'Tu Respuesta',
      feedback_correct_answer: 'Respuesta Correcta',

      // ── Chips de alternativas (AppFeedback.buildAltNote) ────────
      alt_note_gender_m:      'Masculino',
      alt_note_gender_f:      'Femenino',
      alt_note_gender_n:      'Neutro',
      alt_note_regional:      '{region}',
      alt_note_loanword:      'Uso común',
      alt_note_register_f:    'Formal',
      alt_note_register_i:    'Informal',
      alt_note_base_shown:    'También',

      // ── Errores de carga ────────────────────────────────────────
      error_loading:          '⚠️ Error al cargar el tema. Revisa tu conexión.',
      retry:                  'Reintentar →',
      grammar_data_error:     'Error al cargar los datos de gramática.',

      // ── Mensajes vacíos ─────────────────────────────────────────
      no_cloze_exercises:     'No hay ejercicios de completar disponibles para este tema.',
      no_translations:        'No hay traducciones disponibles para este tema.',
      no_scramble_exercises:  'No hay ejercicios disponibles para este tema.',

      // ── Sesión / CTA ────────────────────────────────────────────
      cta_keep_going:         '¡Sigue así! 💪',
      cta_done_today:         '🎉 ¡Excelente trabajo hoy!',
      cta_up_to_date:         '✓ ¡Estás al día!',
      cta_ready:              '¿Listo para la sesión de hoy?',
      cta_start:              'Empezar →',
      cta_continue:           'Continuar →',
      cta_tomorrow:           'Vuelve mañana para mantener tu racha',
      cta_come_back_new:      'Vuelve mañana para nuevos ejercicios',
      cta_exercise_n:         'Ejercicio {cur} de {total}',
      cta_min_left:           '~{n} min restantes',
      cta_review:             '{n} para repasar',
      cta_new_one:            '{n} ejercicio nuevo',
      cta_new_many:           '{n} ejercicios nuevos',
      cta_deferred:           '+{n} diferidos',
      trail_today:            'Sesión de Hoy',
      trail_empty:            'Nada pendiente hoy',
      session_complete:       '¡Sesión completada!',
      done_today_status:      '✓ Listo por hoy',

      // ── PhraseBrowser ──────────────────────────────────────────
      pb_word:                'Palabra',
      pb_phrase:              'Frase',
      pb_learned:             '(aprendida)',
      pb_variants:            '{done}/{total} variantes practicadas',
      pb_not_practiced:       'sin practicar',
      pb_pct_learned:         '{pct}% de {topic} Aprendidas',

      // ── Contadores / progreso ───────────────────────────────────
      topic_learned:          '{seen} / {total} Aprendidas',
      answered_n:             '{done} / {total} respondidas',
      score_n:                '{correct} / {total} correctas ({pct}%)',

      // ── Racha ───────────────────────────────────────────────────
      streak_singular:        '🔥 Racha de {n} día',
      streak_plural:          '🔥 Racha de {n} días',

      // ── Navegación ──────────────────────────────────────────────
      back_to_path:           '← Volver a la ruta',
      my_learning_link:       'Mi Aprendizaje →',
      my_learning_path_link:  'Mi Ruta de Aprendizaje →',

      // ── Badges de estado ────────────────────────────────────────
      badge_new:              '✨ Nuevo',
      badge_review:           '🔁 Repasar',
      badge_studied:          'Estudiado',
      badge_new_plain:        'Nuevo',

      // ── Botones de ejercicio ────────────────────────────────────
      btn_next:               'Siguiente →',
      btn_verify:             'Verificar ✓',
      btn_results:            'Ver resultados →',
      done_status:            '✓ Hecho',
      ready_status:           '✓ Listo',

      // ── Categorías gramaticales ─────────────────────────────────
      pos_noun:               'Sustantivo',
      pos_verb:               'Verbo',
      pos_adjective:          'Adjetivo',
      pos_adverb:             'Adverbio',

      // ── Accesibilidad / barra de progreso ───────────────────────
      session_progress_aria:       'Progreso de la sesión',
      cefr_level_aria:             'Nivel CEFR {level}',
      cloze_blank_word_aria:       'palabra que falta',
      grammar_noticing_answer_n:   'Respuesta a la pregunta {n}',
      grammar_production_blank_n:  'Espacio en blanco {n}',

      // ── Scramble ────────────────────────────────────────────────
      word_bank_prompt:       'Toca las palabras de abajo para empezar…',
      remove_word:            'Quitar: {word}',
      add_word:               'Agregar: {word}',

      // ── Gramática ───────────────────────────────────────────────
      grammar_note_label:     'Nota de gramática',
      reentry_banner_msg:     'Reanudando desde <strong>Comprensión + Producción</strong> — contexto y regla ya vistos',
      grammar_topic_label:    'Gramática para este tema',
      coming_soon:            'Próximamente',
      coming_soon_body:       'Estamos preparando contenido para esta categoría.',
      rule_mastered:          '¡Regla dominada!',
      exercise_complete:      '¡Ejercicio completado!',
      keep_practicing:        'Sigue practicando',
      hypothesis:             'Tu hipótesis',
      noticing_placeholder:   'Escribe tu observación…',
      answer_questions_n:     'Responde las {n} preguntas para continuar',
      correct_answer_msg:     '✓ ¡Correcto! {answer}',
      incorrect_answer_msg:   '✗ Incorrecto — Respuesta: {answer}',
      related_phrases:        '💬 Frases reales usando esta regla — practica en contexto',
      path_complete_summary:  'Repasaste {review} tarjetas y aprendiste {new} nuevas hoy.',

      // ── Speaking ────────────────────────────────────────────────
      listen_btn_label:       '🔊 Escuchar',
      speak_btn:              '🎙️ Hablar',
      speak_btn_label:        'Habla la frase en voz alta',
      footer_developed_by:    'Desarrollado por',

      // ── Navegación / botones comunes ─────────────────────────────
      back_to_topics:         '← Temas',
      close_btn:              'Cerrar',
      aria_continue:          'Continuar: {label}',
      aria_go_to:             'Ir a: {label}',

      // ── Prueba de nivel ──────────────────────────────────────────
      placement_counter:      'Pregunta {n} de {total}',
      option_n:               'Opción {n}',
      placement_score_suffix: ' respuestas correctas',

      // ── Progreso ─────────────────────────────────────────────────
      streak_best:            '· Récord: {n}',
      cell_na:                '{act} — no aplica para este tema',
      cell_stats:             '{act}: {mastered} dominadas · {learning} en progreso · {unseen} sin iniciar',

      // ── Recordatorios (toggle en progress-page) ──────────────────
      notif_on:               '🔔 Desactivar recordatorios',
      notif_off:              '🔕 Activar recordatorios',
      notif_blocked:          'Notificaciones bloqueadas en la configuración del navegador.',
      notif_blocked_hint:     'Para activarlas, permite notificaciones de este sitio en la configuración de tu navegador.',
      notif_active:           '✓ Activo — recordatorio diario a las {time}',
      notif_hint:             'Se activa una vez al día cuando abres la app, si tu racha está en riesgo.',
      notif_current:          'Ahora mismo: "{body}"',
      notif_no_pending:       'Sin recordatorios pendientes — ¡estás al día!',

      // ── Recordatorios (payload push) ────────────────────────────
      notif_title_due:        '📚 Tarjetas pendientes de repaso',
      notif_body_due:         '{count} tarjeta{s} pendiente{s} en {topic} — repasa ahora.',
      notif_more_topics:      '+{n} más en otros temas',
      notif_title_streak:     '🔥 Racha en riesgo',
      notif_body_streak:      '¡Racha de {n} días! Practica hoy para mantenerla.',

      // ── Recordatorios (prompt inline en notifications.js) ────────
      notif_prompt_title:     '🔔 ¿Quieres un recordatorio diario?',
      notif_prompt_desc:      'Te diremos exactamente qué tarjetas tienes pendientes.',
      notif_yes:              'Sí, recuérdame',
      notif_no:               'Ahora no',
      notif_confirmed:        '✓ Recordatorios activados — te avisaremos qué tarjetas tienes pendientes cada día.',
      notif_prompt_aria:      'Activar recordatorios diarios',

      // ── Milestones ───────────────────────────────────────────────
      milestone_share:        'Compartir logro',
      milestone_share_text:   '¡Acabo de desbloquear "{title}" en PracticeEnglish! {emoji} practiceenglish.app',
      milestone_first_streak_title:    'Primera Racha',
      milestone_first_streak_desc:     'Volviste — esa es la parte más difícil.',
      milestone_phrases_10_title:      '10 Frases Aprendidas',
      milestone_phrases_10_desc:       'Has empezado a construir tu inglés.',
      milestone_all_activities_title:  'Aprendiz Completo',
      milestone_all_activities_desc:   'Probaste los 5 tipos de actividad. ¡Cada habilidad cuenta!',
      milestone_topic_unlocked_title:  'Explorador',
      milestone_topic_unlocked_desc:   'Practicaste suficiente para avanzar a un nuevo tema. ¡El camino se abre!',
      milestone_speaking_50_title:     '50 Frases de Speaking',
      milestone_speaking_50_desc:      'Tu confianza al hablar crece rápidamente.',
      milestone_perfect_session_title: 'Perfecto',
      milestone_perfect_session_desc:  'Puntuación perfecta en una sesión con 5 o más tarjetas. ¡Impresionante!',
      milestone_grammar_first_title:   'Primera Regla de Gramática',
      milestone_grammar_first_desc:    'Completaste tu primera regla del Grammar Workshop.',
      milestone_streak_7_title:        'Racha de 7 Días',
      milestone_streak_7_desc:         'Una semana de práctica constante — ¡hábito formado!',
      milestone_first_mastered_title:  'Primera Tarjeta Dominada',
      milestone_first_mastered_desc:   'Alcanzaste dominio total en una frase — ¡constante y preciso!',
      milestone_mastered_50_title:     '50 Tarjetas Dominadas',
      milestone_mastered_50_desc:      '50 frases con dominio total — ¡tu inglés se está fijando!',
      milestone_streak_30_title:       'Hábito de Hierro',
      milestone_streak_30_desc:        '30 días de práctica constante. El inglés ya es parte de tu vida.',
      milestone_mastered_100_title:    'Campeón del Idioma',
      milestone_mastered_100_desc:     '100 tarjetas con dominio total. Estás construyendo fluidez real.',

      // ── Sistema ──────────────────────────────────────────────────
      storage_full:           '⚠️ Almacenamiento lleno — el progreso puede no guardarse. Limpia los datos del navegador para liberar espacio.',
      network_offline:        '📶 Sin conexión — progreso guardado localmente',
      network_online:         '✓ Conexión restaurada',

      // ── Path ─────────────────────────────────────────────────────
      ahead_hint:             'Recomendado después de {prev}',

      // ── Gramática (links de práctica relacionada) ────────────────
      translate_btn:          '🔄 Traducir',

      // ── Barra de modos ──────────────────────────────────────────
      nav_my_learning:        'Mi Aprendizaje',
      nav_speaking:           'Pronunciación',
      nav_dictation:          'Dictado',
      nav_vocabulary:         'Vocabulario',
      nav_cloze:              'Cloze',
      nav_translation:        'Traducción',
      nav_scramble:           'Secuencia',
      nav_quiz:               'Quiz',
      nav_grammar:            'Gramática',

      // ── Nombres de actividad ────────────────────────────────────
      act_speaking:           'Pronunciación',
      act_grammar:            'Gramática',
      act_vocabulary:         'Vocabulario',
      act_quiz:               'Quiz',
      act_cloze:              'Cloze',
      act_dictation:          'Dictado',
      act_translation:        'Traducción',
      act_scramble:           'Secuencia',

      // ── Onboarding ───────────────────────────────────────────────
      ob_title_how:           'Tu {target}, en conversaciones reales',
      ob_body_how:            'Practica pronunciación, escritura y comprensión con frases de la vida diaria — restaurantes, viajes, trabajo y más.<br><br>El sistema aprende contigo: te muestra exactamente lo que necesitas en el momento justo.',
      ob_btn_find_level:      'Empezar →',
      ob_title_topics:        '¿Qué te interesa?',
      ob_body_topics:         'Elige los temas que más te interesan. Los verás con más frecuencia en tu ruta — puedes cambiarlo después.',
      ob_btn_topics_done:     'Encontrar mi nivel →',
      ob_quiz_skip:           'Saltar — ya sé mi nivel',
      ob_manual_label:        'Elige tu nivel:',
      manual_level_beginner:     '🌱 A1–A2 \u00a0 Principiante',
      manual_level_intermediate: '🌿 B1–B2 \u00a0 Intermedio',
      manual_level_advanced:     '🌳 C1–C2 \u00a0 Competente',
      ob_title_done:          '¡Todo listo!',
      ob_btn_go_path:         '🗺️ Ir a Mi Ruta',
      ob_btn_explore:         'Explorar por mi cuenta →',
      ob_welcome_msg:         'Tu nivel es {level}. Tu ruta personalizada está lista — empieza la práctica guiada o explora libremente.',

      // ── Botones de ejercicio ─────────────────────────────────────
      listen_btn:             '🔊 Escuchar',
      cloze_sub:              'Escribe la palabra que falta, luego presiona Enter o Verificar.',
      back_to_categories:     '← Categorías',
      back_to_rules:          '← Reglas',

      // ── Títulos de página (encabezado del topic picker) ──────────
      speaking_page_title:    'Pronunciación en Voz Alta',
      dictation_page_title:   'Práctica de Dictado',
      cloze_page_title:       'Ejercicio de Cloze',
      translation_page_title: 'Traducción Inversa',
      scramble_page_title:    'Construye la Oración',
      vocab_page_title:       'Vocabulario Interactivo',
      quiz_page_title:        'Prueba de Vocabulario',
      grammar_page_title:     'Taller de Gramática',
      my_learning_page_title: 'Mi Aprendizaje',
      progress_page_title:    'Mi Perfil',
      placement_page_title:   'Prueba de Nivel',

      // ── Nombres de temas ──────────────────────────────────────
      topic_general:        'General',
      topic_greetings:      'Saludos',
      topic_emociones:      'Emociones',
      topic_restaurant:     'Restaurante',
      topic_supermarket:    'Supermercado',
      topic_kitchen:        'Cocina',
      topic_transportation: 'Transporte',
      topic_airport:        'Aeropuerto',
      topic_accommodation:  'Alojamiento',
      topic_movies:         'Películas & Series',
      topic_music:          'Música',
      topic_theater:        'Teatro & Arte',
      topic_gym:            'Gimnasio',
      topic_technology:     'Tecnología',
      topic_accountability: 'Contabilidad',

      // ── Página principal (index.html) ─────────────────────────────
      index_hero_sub:           'Escucha, habla y amplía tu vocabulario con ejercicios interactivos diseñados para hacer el aprendizaje natural y divertido.',
      index_stat_activities:    'Actividades',
      index_stat_phrases:       'Frases',
      index_stat_free:          'Siempre',
      index_stat_free_num:      'Gratis',
      index_path_heading:       'Tu Ruta de Aprendizaje',
      index_path_sub:           'Tu sesión diaria — guiada por repetición espaciada.',
      index_activities_heading: 'Elige tu actividad',
      index_activities_sub:     '9 ejercicios con respaldo científico — cada uno enfocado en un aspecto distinto del aprendizaje.',
      index_group_speaking:     '🎙️ Habla y Escucha',
      index_group_sentences:    '✏️ Práctica de Oraciones',
      index_group_vocab:        '📖 Vocabulario',
      index_group_grammar:      '📐 Gramática',
      // Card benefits (taglines under h3)
      index_card_speaking_benefit:    'Habla en voz alta — recibe retroalimentación de pronunciación en tiempo real',
      index_card_dictation_benefit:   'Escucha y escribe — entrena la comprensión auditiva',
      index_card_cloze_benefit:       'Genera la palabra faltante — efecto de generación',
      index_card_translation_benefit: '{sourceName} → {targetName} — la dirección más efectiva',
      index_card_scramble_benefit:    'Reconstruye el orden de las palabras — gramática sin traducción',
      index_card_vocabulary_benefit:  'Tarjetas con repetición espaciada — efecto de práctica distribuida',
      index_card_quiz_benefit:        'Fuerza el recuerdo activo — efecto del test',
      index_card_grammar_benefit:     'Aprende reglas de forma inductiva en 5 fases',
      // Card descriptions (body paragraph)
      index_card_speaking_desc:    'Usa tu micrófono para hablar y recibe retroalimentación instantánea sobre tu pronunciación.',
      index_card_dictation_desc:   'Escucha con atención y escribe lo que oyes — entrena la escucha y la ortografía al mismo tiempo.',
      index_card_cloze_desc:       'Completa la palabra que falta. Generar palabras tú mismo construye una memoria un 40% más fuerte que leerlas.',
      index_card_translation_desc: 'Lee en {source}, escribe en {target}. La producción activa L1→L2 profundiza la retención de gramática y vocabulario.',
      index_card_scramble_desc:    'Toca las palabras desordenadas en el orden correcto. Entrena el orden de las palabras en {target} de forma natural.',
      index_card_vocabulary_desc:  'Domina más de 100 palabras con tarjetas inteligentes que se adaptan usando repetición espaciada.',
      index_card_quiz_desc:        'Preguntas de opción múltiple que fuerzan el recuerdo activo — el efecto del test construye una memoria a largo plazo más sólida.',
      index_card_grammar_desc:     'Contexto → Observación → Regla → Comprensión → Producción. Ejercicios de 5 fases con base científica y SRS por regla.',

      // ── Leyenda del progreso ─────────────────────────────────────
      progress_legend_unseen:   'Sin iniciar',
      progress_legend_learning: 'En progreso',
      progress_legend_mastered: 'Dominado',

      // ── Cambio de par ────────────────────────────────────────────
      lang_switch_title:      'Cambiar idioma',

      // ── i18n común (todas las páginas) ───────────────────────────
      skip_to_main:               'Ir al contenido principal',
      nav_modes_aria:             'Modos de práctica',
      nav_home_aria:              'Inicio',
      // Topic picker subtitles
      speaking_picker_sub:        'Elige un tema y comienza a practicar tu pronunciación con retroalimentación en tiempo real.',
      dictation_picker_sub:       'Escucha cada frase y escribe exactamente lo que oyes.',
      cloze_picker_sub:           'Escribe la palabra que falta. Cuanto más recuerdas, mejor retienes.',
      translation_picker_sub:     'Lee la frase en {source} y escribe la versión en {target}. La producción activa construye una memoria más sólida.',
      scramble_picker_sub:        'Toca las palabras para agregarlas. Toca las colocadas para quitarlas.',
      vocab_picker_sub:           'Elige un tema, voltea cada tarjeta para ver su significado y califica qué tan bien la conoces.',
      quiz_picker_sub:            'Elige un tema para poner a prueba tu vocabulario.',
      grammar_picker_sub:         'Aprende gramática de {target} a través de contexto real y práctica activa.',
      // Speaking interactive
      listen_phrase_aria:         'Escuchar la frase',
      speak_phrase_aria:          'Habla la frase en voz alta',
      text_input_label:           'Escribe la frase aquí',
      text_input_ph:              'Escribe la frase aquí y presiona Enter…',
      text_submit_aria:           'Enviar frase escrita',
      grammar_chip_aria:          'Abrir Taller de Gramática para esta regla',
      next_phrase_aria:           'Ir a la siguiente frase',
      try_again_speaking_aria:    'Intentar hablar de nuevo',
      // Dictation / common phrase navigation
      dictation_input_ph:         'Escribe lo que escuchas…',
      next_btn_aria:              'Continuar a la siguiente frase',
      try_again_phrase_aria:      'Intentar esta frase de nuevo',
      // Cloze
      listen_full_phrase_aria:    'Escuchar la frase completa',
      cloze_input_ph:             'Escribe la palabra que falta…',
      cloze_input_aria:           'Palabra que falta',
      next_question_aria:         'Continuar a la siguiente pregunta',
      try_again_question_aria:    'Intentar esta pregunta de nuevo',
      // Translation
      translation_input_ph:       'Escribe la frase en {target}…',
      translation_input_aria:     'Traducción al {target}',
      // Scramble
      hint_label:                 'Pista',
      hint_label_aria:            'Pista de traducción en español',
      zone_your_sentence:         'Tu oración',
      clear_sentence_aria:        'Borrar oración',
      word_bank_label:            'Banco de palabras',
      construction_area_aria:     'Oración construida',
      word_bank_aria:             'Banco de palabras disponibles',
      // Vocabulary
      back_to_topics_aria:        'Volver al selector de temas',
      listen_pronunciation_aria:  'Escuchar pronunciación',
      flip_hint:                  'Ver significado',
      fc_definition_label:        'Definición',
      fc_example_label:           'Ejemplo',
      fc_spanish_label:           '{sourceName}',
      next_word_aria:             'Continuar a la siguiente palabra',
      flashcard_flip_aria:        'Tarjeta — presiona Enter o Espacio para voltear',
      // Quiz
      choices_grid_aria:          'Opciones de definición',
      // Grammar phases
      phase_progress_aria:        'Fases del ejercicio',
      phase_0_short:              'Contexto',
      phase_0_aria:               'Fase 1: Contexto',
      phase_1_short:              'Observa',
      phase_1_aria:               'Fase 2: Observa',
      phase_2_short:              'La Regla',
      phase_2_aria:               'Fase 3: La Regla',
      phase_3_short:              'Comprensión',
      phase_3_aria:               'Fase 4: Comprensión',
      phase_4_short:              'Producción',
      phase_4_aria:               'Fase 5: Producción',
      phase_context_hint:         'Lee el diálogo. Observa las partes resaltadas.',
      context_next_btn:           '¿Qué observas? →',
      phase_noticing_hint:        'Escribe tu respuesta antes de continuar.',
      noticing_show_btn:          'Ver explicación',
      phase_rule_hint:            'Confirma lo que observaste.',
      rule_next_btn:              'Practicar reconocimiento →',
      phase_structured_hint:      'Elige la opción correcta.',
      phase_production_hint:      'Escribe la forma correcta en el espacio.',
      phase_complete_aria:        'Ejercicio completado',
      exercise_complete_h2:       '¡Ejercicio completado!',
      grammar_continue_btn:       'Continuar →',
      related_phrases_aria:       'Frases de práctica relacionadas',
      // My learning
      ml_page_h1:                 'Mi Ruta de Aprendizaje',
      // Progress page
      progress_page_h1:           'Mi Perfil',
      progress_page_subtitle:     'Tus ejercicios y dominio de un vistazo.',
      progress_lang_section:      '🌐 Idioma',
      progress_exercises_section: '📊 Resumen de Ejercicios',
      exercise_matrix_aria:       'Progreso por ejercicio y tema',
      progress_topics_section:    '🎯 Temas de Interés',
      progress_topics_sub:        'Los temas que elijas aparecerán con más frecuencia en tu ruta.',
      progress_heatmap_section:   'Actividad — Últimos 60 Días',
      heatmap_less:               'Menos',
      heatmap_more:               'Más',
      heatmap_session_singular:   'sesión',
      heatmap_session_plural:     'sesiones',
      progress_achievements_section: '🏅 Logros',
      progress_reminders_section: '🔔 Recordatorios',
      progress_reminders_sub:     'Recordatorio diario cuando tu racha esté en riesgo.',
      // Backup
      progress_backup_section:    '💾 Respaldo de Progreso',
      progress_backup_sub:        'Guarda una copia de todo tu avance para no perderlo si el navegador limpia el almacenamiento.',
      backup_export_btn:          'Exportar progreso',
      backup_import_btn:          'Importar backup',
      backup_last_export:         'Último respaldo: {date}',
      backup_never_exported:      'Aún no has exportado tu progreso.',
      backup_import_success:      '✓ Progreso restaurado. Recargando…',
      backup_import_error:        'Archivo inválido. Verifica que sea un respaldo de Practice English.',
      backup_instructions_export: '⬇️  Descarga un archivo .json con todo tu progreso. Guárdalo en Google Drive, iCloud o envíatelo por correo.',
      backup_instructions_import: '⬆️  Para restaurar, selecciona el archivo .json que descargaste anteriormente.',
      backup_reminder_title:      '💾 ¿Cuándo fue tu último respaldo?',
      backup_reminder_body:       'Han pasado más de 30 días. Exporta tu progreso para no perderlo.',
      backup_reminder_cta:        'Exportar →',
      backup_reminder_close:      'Cerrar',
      stat_streak_days:           'Días de Racha',
      stat_mastered_cards:        'Tarjetas Dominadas',
      stat_lessons_started:       'Lecciones Iniciadas',
      notif_time_label:           'Recuérdame a las',
      // Placement
      placement_title:            'Prueba de Nivel',
      placement_subtitle_enes:    '14 preguntas para encontrar tu nivel de {target} (A1–C2) y sugerirte el mejor punto de partida.',
      placement_time_pill:        '⏱️ ~3 minutos',
      placement_questions_pill:   '❓ 14 preguntas',
      placement_result_pill:      '📊 Resultado CEFR',
      placement_start_btn:        'Comenzar →',
      placement_skip_btn:         'Saltar — empezar desde cero',
      placement_suggestions_label:'Actividades recomendadas para tu nivel:',
      placement_result_cta:       'Empezar a practicar →',
      placement_retake_btn:       'Repetir la prueba',
      placement_result_a1_label:  'A1 — Principiante',
      placement_result_a1_msg:    '¡Punto de partida ideal! Comienza con vocabulario esencial y frases del día a día.',
      placement_result_a2_label:  'A2 — Elemental',
      placement_result_a2_msg:    'Buena base. Practica vocabulario variado y empieza a producir tus propias oraciones.',
      placement_result_b1_label:  'B1 — Intermedio',
      placement_result_b1_msg:    '¡Buen nivel! Enfócate en gramática y producción activa para consolidar tu inglés.',
      placement_result_b2_label:  'B2 — Avanzado',
      placement_result_b2_msg:    '¡Nivel avanzado! Trabaja gramática compleja y producción sin apoyo.',
      placement_result_c1_label:  'C1 — Competente',
      placement_result_c1_msg:    '¡Nivel competente! Usa el inglés con fluidez y precisión en contextos académicos y profesionales.',
      placement_result_c2_label:  'C2 — Maestría',
      placement_result_c2_msg:    '¡Nivel de maestría! Comprende y produce inglés con la precisión de un hablante culto nativo.',
      placement_speaking_greetings: 'Pronunciación: Saludos',
      placement_speaking_advanced:  'Pronunciación: Avanzado',
    },

    en: {
      // ── Exercise area titles ───────────────────────────────────
      speaking_title:         'How do you pronounce it?',
      speaking_sub:           'Listen carefully, then say the phrase out loud.',
      dictation_title:        'Listen and Write',
      cloze_title:            'Fill in the blank',
      translation_title:      'Translate to {lang}',
      translation_sub:        'Read the phrase in {source} and write it in {lang}.',
      scramble_title:         'Build the sentence',

      // ── TTS / STT ─────────────────────────────────────────────
      tts_loading:            '🔊 Loading voice model…',
      tts_ready:              '🔊 Voice model ready ✓',
      stt_loading:            '🎙️ Loading voice model…',
      stt_ready:              '🎙️ Voice model ready ✓',
      stt_load_error:         'Could not load the recognition model. Check your connection and try again.',
      stt_not_available:      'Speech recognition not available.',

      // ── Microphone ────────────────────────────────────────────
      mic_blocked:            'Microphone access blocked. Allow it in your browser settings.',
      mic_not_found:          'No microphone found. Connect one and try again.',
      mic_error:              'Could not access microphone. Please try again.',
      generic_error:          'An error occurred. Please try again.',

      // ── Speaking ──────────────────────────────────────────────
      speak_prompt:           'Press the button when you\'re ready to speak',
      recording_prompt:       '🎙 Recording… tap Stop when done',
      listening_prompt:       '🎙 Listening…',
      stop_recording:         '⏹ Stop',
      stop_recording_label:   'Stop recording',
      transcribing:           '⏳ Transcribing…',
      transcribing_label:     'Transcribing your voice',
      transcription_timeout:  'Could not transcribe. Please try again.',
      not_understood:         '👂 Couldn\'t understand you!',

      // ── Feedback ──────────────────────────────────────────────
      feedback_correct:       '✓ Correct!',
      feedback_incorrect:     '✗ Incorrect',
      feedback_your_answer:   'Your Answer',
      feedback_correct_answer: 'Correct Answer',

      // ── Alternative chips (AppFeedback.buildAltNote) ──────────
      alt_note_gender_m:      'Masculine',
      alt_note_gender_f:      'Feminine',
      alt_note_gender_n:      'Neutral',
      alt_note_regional:      '{region}',
      alt_note_loanword:      'Common usage',
      alt_note_register_f:    'Formal',
      alt_note_register_i:    'Informal',
      alt_note_base_shown:    'Also',

      // ── Load errors ───────────────────────────────────────────
      error_loading:          '⚠️ Error loading topic. Check your connection.',
      retry:                  'Retry →',
      grammar_data_error:     'Error loading grammar data.',

      // ── Empty states ──────────────────────────────────────────
      no_cloze_exercises:     'No fill-in-the-blank exercises available for this topic.',
      no_translations:        'No translations available for this topic.',
      no_scramble_exercises:  'No exercises available for this topic.',

      // ── Session / CTA ─────────────────────────────────────────
      cta_keep_going:         'Keep it up! 💪',
      cta_done_today:         '🎉 Excellent work today!',
      cta_up_to_date:         '✓ You\'re up to date!',
      cta_ready:              'Ready for today\'s session?',
      cta_start:              'Start →',
      cta_continue:           'Continue →',
      cta_tomorrow:           'Come back tomorrow to keep your streak',
      cta_come_back_new:      'Come back tomorrow for new exercises',
      cta_exercise_n:         'Exercise {cur} of {total}',
      cta_min_left:           '~{n} min left',
      cta_review:             '{n} to review',
      cta_new_one:            '{n} new exercise',
      cta_new_many:           '{n} new exercises',
      cta_deferred:           '+{n} deferred',
      trail_today:            'Today\'s Session',
      trail_empty:            'Nothing due today',
      session_complete:       'Session complete!',
      done_today_status:      '✓ Done for today',

      // ── PhraseBrowser ─────────────────────────────────────────
      pb_word:                'Word',
      pb_phrase:              'Phrase',
      pb_learned:             '(learned)',
      pb_variants:            '{done}/{total} variants practiced',
      pb_not_practiced:       'not practiced',
      pb_pct_learned:         '{pct}% of {topic} Learned',

      // ── Counters / progress ───────────────────────────────────
      topic_learned:          '{seen} / {total} Learned',
      answered_n:             '{done} / {total} answered',
      score_n:                '{correct} / {total} correct ({pct}%)',

      // ── Streak ────────────────────────────────────────────────
      streak_singular:        '🔥 {n}-day streak',
      streak_plural:          '🔥 {n}-day streak',

      // ── Navigation ────────────────────────────────────────────
      back_to_path:           '← Back to path',
      my_learning_link:       'My Learning →',
      my_learning_path_link:  'My Learning Path →',

      // ── Status badges ─────────────────────────────────────────
      badge_new:              '✨ New',
      badge_review:           '🔁 Review',
      badge_studied:          'Studied',
      badge_new_plain:        'New',

      // ── Exercise buttons ──────────────────────────────────────
      btn_next:               'Next →',
      btn_verify:             'Verify ✓',
      btn_results:            'See results →',
      done_status:            '✓ Done',
      ready_status:           '✓ Ready',

      // ── Parts of speech ───────────────────────────────────────
      pos_noun:               'Noun',
      pos_verb:               'Verb',
      pos_adjective:          'Adjective',
      pos_adverb:             'Adverb',

      // ── Accessibility / progress bar ─────────────────────────
      session_progress_aria:       'Session progress',
      cefr_level_aria:             'CEFR level {level}',
      cloze_blank_word_aria:       'blank word',
      grammar_noticing_answer_n:   'Answer to question {n}',
      grammar_production_blank_n:  'Blank {n}',

      // ── Scramble ──────────────────────────────────────────────
      word_bank_prompt:       'Tap the words below to start…',
      remove_word:            'Remove: {word}',
      add_word:               'Add: {word}',

      // ── Grammar ───────────────────────────────────────────────
      grammar_note_label:     'Grammar note',
      reentry_banner_msg:     'Resuming from <strong>Comprehension + Production</strong> — context and rule already seen',
      grammar_topic_label:    'Grammar for this topic',
      coming_soon:            'Coming Soon',
      coming_soon_body:       'We\'re preparing content for this category.',
      rule_mastered:          'Rule mastered!',
      exercise_complete:      'Exercise complete!',
      keep_practicing:        'Keep practicing',
      hypothesis:             'Your hypothesis',
      noticing_placeholder:   'Write your observation…',
      answer_questions_n:     'Answer {n} questions to continue',
      correct_answer_msg:     '✓ Correct! {answer}',
      incorrect_answer_msg:   '✗ Incorrect — Answer: {answer}',
      related_phrases:        '💬 Real phrases using this rule — practice in context',
      path_complete_summary:  'You reviewed {review} cards and learned {new} new ones today.',

      // ── Speaking ──────────────────────────────────────────────
      listen_btn_label:       '🔊 Listen',
      speak_btn:              '🎙️ Speak',
      speak_btn_label:        'Say the phrase out loud',
      footer_developed_by:    'Developed by',

      // ── Common navigation / buttons ───────────────────────────
      back_to_topics:         '← Topics',
      close_btn:              'Close',
      aria_continue:          'Continue: {label}',
      aria_go_to:             'Go to: {label}',

      // ── Placement test ────────────────────────────────────────
      placement_counter:      'Question {n} of {total}',
      option_n:               'Option {n}',
      placement_score_suffix: ' correct answers',

      // ── Progress ──────────────────────────────────────────────
      streak_best:            '· Best: {n}',
      cell_na:                '{act} — not applicable for this topic',
      cell_stats:             '{act}: {mastered} mastered · {learning} in progress · {unseen} not started',

      // ── Reminders (toggle in progress-page) ───────────────────
      notif_on:               '🔔 Disable reminders',
      notif_off:              '🔕 Enable reminders',
      notif_blocked:          'Notifications blocked in browser settings.',
      notif_blocked_hint:     'To enable them, allow notifications for this site in your browser settings.',
      notif_active:           '✓ Active — daily reminder at {time}',
      notif_hint:             'Triggers once a day when you open the app, if your streak is at risk.',
      notif_current:          'Right now: "{body}"',
      notif_no_pending:       'No pending reminders — you\'re up to date!',

      // ── Reminders (push payload) ──────────────────────────────
      notif_title_due:        '📚 Cards due for review',
      notif_body_due:         '{count} card{s} due in {topic} — review now.',
      notif_more_topics:      '+{n} more in other topics',
      notif_title_streak:     '🔥 Streak at risk',
      notif_body_streak:      '{n}-day streak! Practice today to keep it.',

      // ── Reminders (inline prompt in notifications.js) ─────────
      notif_prompt_title:     '🔔 Want a daily reminder?',
      notif_prompt_desc:      'We\'ll tell you exactly which cards are due.',
      notif_yes:              'Yes, remind me',
      notif_no:               'Not now',
      notif_confirmed:        '✓ Reminders enabled — we\'ll notify you of due cards daily.',
      notif_prompt_aria:      'Enable daily reminders',

      // ── Milestones ────────────────────────────────────────────
      milestone_share:        'Share achievement',
      milestone_share_text:   'I just unlocked "{title}" in PracticeEnglish! {emoji} practiceenglish.app',
      milestone_first_streak_title:    'First Streak',
      milestone_first_streak_desc:     "You came back — that's the hardest part.",
      milestone_phrases_10_title:      '10 Phrases Learned',
      milestone_phrases_10_desc:       "You've started building your Spanish.",
      milestone_all_activities_title:  'Complete Learner',
      milestone_all_activities_desc:   'You tried all 5 activity types. Every skill counts!',
      milestone_topic_unlocked_title:  'Explorer',
      milestone_topic_unlocked_desc:   'You practiced enough to unlock a new topic. The path opens!',
      milestone_speaking_50_title:     '50 Speaking Phrases',
      milestone_speaking_50_desc:      'Your speaking confidence is growing fast.',
      milestone_perfect_session_title: 'Perfect',
      milestone_perfect_session_desc:  'Perfect score in a session with 5+ cards. Impressive!',
      milestone_grammar_first_title:   'First Grammar Rule',
      milestone_grammar_first_desc:    'You completed your first rule in the Grammar Workshop.',
      milestone_streak_7_title:        '7-Day Streak',
      milestone_streak_7_desc:         'One week of consistent practice — habit formed!',
      milestone_first_mastered_title:  'First Card Mastered',
      milestone_first_mastered_desc:   'You reached full mastery on a phrase — consistent and precise!',
      milestone_mastered_50_title:     '50 Cards Mastered',
      milestone_mastered_50_desc:      "50 phrases fully mastered — your Spanish is sticking!",
      milestone_streak_30_title:       'Iron Habit',
      milestone_streak_30_desc:        'Spanish is now part of your life.',
      milestone_mastered_100_title:    'Language Champion',
      milestone_mastered_100_desc:     "100 cards fully mastered. You're building real fluency.",

      // ── System ────────────────────────────────────────────────
      storage_full:           '⚠️ Storage full — progress may not save. Clear browser data to free space.',
      network_offline:        '📶 No connection — progress saved locally',
      network_online:         '✓ Connection restored',

      // ── Path ──────────────────────────────────────────────────
      ahead_hint:             'Recommended after {prev}',

      // ── Grammar (related practice links) ─────────────────────
      translate_btn:          '🔄 Translate',

      // ── Mode bar ──────────────────────────────────────────────
      nav_my_learning:        'My Learning',
      nav_speaking:           'Speaking',
      nav_dictation:          'Dictation',
      nav_vocabulary:         'Vocabulary',
      nav_cloze:              'Cloze',
      nav_translation:        'Translation',
      nav_scramble:           'Scramble',
      nav_quiz:               'Quiz',
      nav_grammar:            'Grammar',

      // ── Activity names ────────────────────────────────────────
      act_speaking:           'Speaking',
      act_grammar:            'Grammar',
      act_vocabulary:         'Vocabulary',
      act_quiz:               'Quiz',
      act_cloze:              'Cloze',
      act_dictation:          'Dictation',
      act_translation:        'Translation',
      act_scramble:           'Scramble',

      // ── Onboarding ────────────────────────────────────────────
      ob_title_how:           'Your {targetName}, in real conversations',
      ob_body_how:            'Practice speaking, listening and writing with phrases from everyday life — restaurants, travel, work and more.<br><br>The system learns with you: shows you exactly what you need, right when you need it.',
      ob_btn_find_level:      'Get started →',
      ob_title_topics:        'What interests you?',
      ob_body_topics:         'Choose the topics you\'re most interested in. You\'ll see them more often in your path — you can change this later.',
      ob_btn_topics_done:     'Find my level →',
      ob_quiz_skip:           'Skip — I already know my level',
      ob_manual_label:        'Choose your level:',
      manual_level_beginner:     '🌱 A1–A2 \u00a0 Beginner',
      manual_level_intermediate: '🌿 B1–B2 \u00a0 Intermediate',
      manual_level_advanced:     '🌳 C1–C2 \u00a0 Advanced',
      ob_title_done:          'All set!',
      ob_btn_go_path:         '🗺️ Go to My Path',
      ob_btn_explore:         'Explore on my own →',
      ob_welcome_msg:         'Your level is {level}. Your personalized path is ready — start guided practice or explore freely.',

      // ── Exercise buttons ──────────────────────────────────────
      listen_btn:             '🔊 Listen',
      cloze_sub:              'Type the missing word, then press Enter or Verify.',
      back_to_categories:     '← Categories',
      back_to_rules:          '← Rules',

      // ── Page titles (topic picker header) ─────────────────────
      speaking_page_title:    'Speaking <span>Aloud</span>',
      dictation_page_title:   '<span>Dictation</span> Practice',
      cloze_page_title:       '<span>Cloze</span> Exercise',
      translation_page_title: 'Reverse <span>Translation</span>',
      scramble_page_title:    'Build the <span>Sentence</span>',
      vocab_page_title:       'Interactive <span>Vocabulary</span>',
      quiz_page_title:        '<span>Vocabulary</span> Quiz',
      grammar_page_title:     '<span>Grammar</span> Workshop',
      my_learning_page_title: 'My <span>Learning</span>',
      progress_page_title:    'My <span>Profile</span>',
      placement_page_title:   '<span>Level</span> Test',

      // ── Topic names ───────────────────────────────────────────
      topic_general:        'General',
      topic_greetings:      'Greetings',
      topic_emociones:      'Emotions',
      topic_restaurant:     'Restaurant',
      topic_supermarket:    'Supermarket',
      topic_kitchen:        'Kitchen',
      topic_transportation: 'Transportation',
      topic_airport:        'Airport',
      topic_accommodation:  'Accommodation',
      topic_movies:         'Movies & Series',
      topic_music:          'Music',
      topic_theater:        'Theater & Arts',
      topic_gym:            'Gym',
      topic_technology:     'Technology',
      topic_accountability: 'Accounting',

      // ── Main page (index.html) ────────────────────────────────
      index_hero_sub:           'Listen, speak, and expand your vocabulary with interactive exercises designed to make learning natural and fun.',
      index_stat_activities:    'Activities',
      index_stat_phrases:       'Phrases',
      index_stat_free:          'Always',
      index_stat_free_num:      'Free',
      index_path_heading:       'Your Learning Path',
      index_path_sub:           'Your daily session — guided by spaced repetition.',
      index_activities_heading: 'Choose your activity',
      index_activities_sub:     '9 science-backed exercises — each focused on a different aspect of learning.',
      index_group_speaking:     '🎙️ Speaking & Listening',
      index_group_sentences:    '✏️ Sentence Practice',
      index_group_vocab:        '📖 Vocabulary',
      index_group_grammar:      '📐 Grammar',
      // Card benefits (taglines under h3)
      index_card_speaking_benefit:    'Speak aloud — get real-time pronunciation feedback',
      index_card_dictation_benefit:   'Listen and write — train listening comprehension',
      index_card_cloze_benefit:       'Generate the missing word — generation effect',
      index_card_translation_benefit: '{sourceName} → {targetName} — the most effective direction',
      index_card_scramble_benefit:    'Rebuild word order — grammar without translation',
      index_card_vocabulary_benefit:  'Flashcards with spaced repetition — distributed practice effect',
      index_card_quiz_benefit:        'Force active recall — testing effect',
      index_card_grammar_benefit:     'Learn rules inductively in 5 phases',
      // Card descriptions (body paragraph)
      index_card_speaking_desc:    'Use your microphone to speak and get instant feedback on your pronunciation.',
      index_card_dictation_desc:   'Listen carefully and write what you hear — trains listening and spelling at the same time.',
      index_card_cloze_desc:       'Complete the missing word. Generating words yourself builds 40% stronger memory than reading them.',
      index_card_translation_desc: 'Read in {source}, write in {target}. Active L1→L2 production deepens grammar and vocabulary retention.',
      index_card_scramble_desc:    'Tap the jumbled words in the right order. Trains {target} word order naturally.',
      index_card_vocabulary_desc:  'Master 100+ words with smart flashcards that adapt using spaced repetition.',
      index_card_quiz_desc:        'Multiple-choice questions that force active recall — the testing effect builds stronger long-term memory.',
      index_card_grammar_desc:     'Context → Observation → Rule → Understanding → Production. Science-based 5-phase exercises with SRS per rule.',

      // ── Progress legend ───────────────────────────────────────
      progress_legend_unseen:   'Not started',
      progress_legend_learning: 'In progress',
      progress_legend_mastered: 'Mastered',

      // ── Language switch ───────────────────────────────────────
      lang_switch_title:      'Switch language',

      // ── i18n common (all pages) ───────────────────────────────────
      skip_to_main:               'Skip to main content',
      nav_modes_aria:             'Practice modes',
      nav_home_aria:              'Home',
      // Topic picker subtitles
      speaking_picker_sub:        'Choose a topic and start practicing your pronunciation with real-time feedback.',
      dictation_picker_sub:       'Listen to each phrase and type exactly what you hear.',
      cloze_picker_sub:           'Type the missing word. The more you recall, the better you retain.',
      translation_picker_sub:     'Read the phrase in {source} and write the {target} version. Active production builds stronger memory.',
      scramble_picker_sub:        'Tap words to add them. Tap placed words to remove them.',
      vocab_picker_sub:           'Choose a topic, flip each card to see its meaning, and rate how well you know it.',
      quiz_picker_sub:            'Choose a topic to test your vocabulary.',
      grammar_picker_sub:         'Learn {target} grammar through real context and active practice.',
      // Speaking interactive
      listen_phrase_aria:         'Listen to the phrase',
      speak_phrase_aria:          'Speak the phrase aloud',
      text_input_label:           'Type the phrase here',
      text_input_ph:              'Type the phrase here and press Enter…',
      text_submit_aria:           'Submit typed phrase',
      grammar_chip_aria:          'Open Grammar Workshop for this rule',
      next_phrase_aria:           'Go to next phrase',
      try_again_speaking_aria:    'Try speaking again',
      // Dictation / common phrase navigation
      dictation_input_ph:         'Type what you hear…',
      next_btn_aria:              'Go to the next phrase',
      try_again_phrase_aria:      'Try this phrase again',
      // Cloze
      listen_full_phrase_aria:    'Listen to the full phrase',
      cloze_input_ph:             'Type the missing word…',
      cloze_input_aria:           'Missing word',
      next_question_aria:         'Go to the next question',
      try_again_question_aria:    'Try this question again',
      // Translation
      translation_input_ph:       'Type the phrase in {target}…',
      translation_input_aria:     '{target} translation',
      // Scramble
      hint_label:                 'Hint',
      hint_label_aria:            'Translation hint',
      zone_your_sentence:         'Your sentence',
      clear_sentence_aria:        'Clear sentence',
      word_bank_label:            'Word bank',
      construction_area_aria:     'Built sentence',
      word_bank_aria:             'Available words',
      // Vocabulary
      back_to_topics_aria:        'Back to topic picker',
      listen_pronunciation_aria:  'Listen to pronunciation',
      flip_hint:                  'See meaning',
      fc_definition_label:        'Definition',
      fc_example_label:           'Example',
      fc_spanish_label:           '{sourceName}',
      next_word_aria:             'Go to the next word',
      flashcard_flip_aria:        'Flashcard — press Enter or Space to flip',
      // Quiz
      choices_grid_aria:          'Definition options',
      // Grammar phases
      phase_progress_aria:        'Exercise phases',
      phase_0_short:              'Context',
      phase_0_aria:               'Phase 1: Context',
      phase_1_short:              'Notice',
      phase_1_aria:               'Phase 2: Notice',
      phase_2_short:              'The Rule',
      phase_2_aria:               'Phase 3: The Rule',
      phase_3_short:              'Understanding',
      phase_3_aria:               'Phase 4: Understanding',
      phase_4_short:              'Production',
      phase_4_aria:               'Phase 5: Production',
      phase_context_hint:         'Read the dialogue. Notice the highlighted parts.',
      context_next_btn:           'What do you notice? →',
      phase_noticing_hint:        'Write your response before continuing.',
      noticing_show_btn:          'See explanation',
      phase_rule_hint:            'Confirm what you noticed.',
      rule_next_btn:              'Practice recognition →',
      phase_structured_hint:      'Choose the correct option.',
      phase_production_hint:      'Write the correct form in the blank.',
      phase_complete_aria:        'Exercise complete',
      exercise_complete_h2:       'Exercise complete!',
      grammar_continue_btn:       'Continue →',
      related_phrases_aria:       'Related practice phrases',
      // My learning
      ml_page_h1:                 'My Learning Path',
      // Progress page
      progress_page_h1:           'My Profile',
      progress_page_subtitle:     'Your exercises and mastery at a glance.',
      progress_lang_section:      '🌐 Language',
      progress_exercises_section: '📊 Exercise Summary',
      exercise_matrix_aria:       'Exercise and topic progress',
      progress_topics_section:    '🎯 Topics of Interest',
      progress_topics_sub:        'The topics you choose will appear more often in your path.',
      progress_heatmap_section:   'Activity — Last 60 Days',
      heatmap_less:               'Less',
      heatmap_more:               'More',
      heatmap_session_singular:   'session',
      heatmap_session_plural:     'sessions',
      progress_achievements_section: '🏅 Achievements',
      progress_reminders_section: '🔔 Reminders',
      progress_reminders_sub:     'Daily reminder when your streak is at risk.',
      // Backup
      progress_backup_section:    '💾 Progress Backup',
      progress_backup_sub:        'Save a copy of all your progress so you never lose it if the browser clears storage.',
      backup_export_btn:          'Export progress',
      backup_import_btn:          'Import backup',
      backup_last_export:         'Last backup: {date}',
      backup_never_exported:      'You haven\'t exported your progress yet.',
      backup_import_success:      '✓ Progress restored. Reloading…',
      backup_import_error:        'Invalid file. Make sure it\'s a Practice English backup.',
      backup_instructions_export: '⬇️  Download a .json file with all your progress. Save it to Google Drive, iCloud, or email it to yourself.',
      backup_instructions_import: '⬆️  To restore, select the .json file you previously downloaded.',
      backup_reminder_title:      '💾 Time to back up?',
      backup_reminder_body:       'It\'s been over 30 days. Export your progress so you don\'t lose it.',
      backup_reminder_cta:        'Export →',
      backup_reminder_close:      'Close',
      stat_streak_days:           'Streak Days',
      stat_mastered_cards:        'Cards Mastered',
      stat_lessons_started:       'Lessons Started',
      notif_time_label:           'Remind me at',
      // Placement
      placement_title:            'Level Test',
      placement_subtitle_enes:    '14 questions to find your {targetName} level (A1–C2) and suggest the best starting point.',
      placement_time_pill:        '⏱️ ~3 minutes',
      placement_questions_pill:   '❓ 14 questions',
      placement_result_pill:      '📊 CEFR Result',
      placement_start_btn:        'Start →',
      placement_skip_btn:         'Skip — start from scratch',
      placement_suggestions_label:'Recommended activities for your level:',
      placement_result_cta:       'Start practicing →',
      placement_retake_btn:       'Retake the test',
      placement_result_a1_label:  'A1 — Beginner',
      placement_result_a1_msg:    'Perfect starting point! Begin with essential vocabulary and everyday phrases.',
      placement_result_a2_label:  'A2 — Elementary',
      placement_result_a2_msg:    'Good foundation. Practice varied vocabulary and start producing your own sentences.',
      placement_result_b1_label:  'B1 — Intermediate',
      placement_result_b1_msg:    'Nice level! Focus on grammar and active production to consolidate your Spanish.',
      placement_result_b2_label:  'B2 — Upper Intermediate',
      placement_result_b2_msg:    'Advanced level! Work on complex grammar and unaided production.',
      placement_result_c1_label:  'C1 — Advanced',
      placement_result_c1_msg:    'Advanced! Use Spanish fluently and precisely in academic and professional contexts.',
      placement_result_c2_label:  'C2 — Mastery',
      placement_result_c2_msg:    'Mastery level! Understand and produce Spanish with near-native accuracy.',
      placement_speaking_greetings: 'Speaking: Greetings',
      placement_speaking_advanced:  'Speaking: Advanced',
    },

    // ── Add new source languages here ─────────────────────────────
    // pt: { speaking_title: 'Como se pronuncia?', ... },

  };

  // If a pair is active, use its source language.
  // If no pair is active yet (first visit), use navigator.language.
  // If the browser language isn't a supported block, default to 'en'.
  var _code;
  if (typeof AppLangPair !== 'undefined' && localStorage.getItem('pe_active_pair')) {
    _code = AppLangPair.getActive().source.code;
  } else {
    var _nav = (navigator.language || 'en').toLowerCase().split('-')[0];
    _code = _DATA[_nav] ? _nav : 'en';
  }

  window.LangUI = _DATA[_code] || _DATA.en;

  // Set <html lang> to the active source language for screen reader accuracy
  document.documentElement.lang = _code;

})();
