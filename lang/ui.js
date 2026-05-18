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

      // ── Scramble ────────────────────────────────────────────────
      word_bank_prompt:       'Toca las palabras de abajo para empezar…',
      remove_word:            'Quitar: {word}',
      add_word:               'Agregar: {word}',

      // ── Gramática ───────────────────────────────────────────────
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
      speak_btn:              '🎙️ Hablar',
      speak_btn_label:        'Habla la frase en voz alta',

      // ── Navegación / botones comunes ─────────────────────────────
      back_to_topics:         '← Temas',
      close_btn:              'Cerrar',
      aria_continue:          'Continuar: {label}',
      aria_go_to:             'Ir a: {label}',

      // ── Prueba de nivel ──────────────────────────────────────────
      placement_counter:      'Pregunta {n} de {total}',
      option_n:               'Opción {n}',

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

      // ── Milestones ───────────────────────────────────────────────
      milestone_share:        'Compartir logro',

      // ── Sistema ──────────────────────────────────────────────────
      storage_full:           '⚠️ Almacenamiento lleno — el progreso puede no guardarse. Limpia los datos del navegador para liberar espacio.',

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
    },

    // ── Agrega aquí nuevos idiomas origen ─────────────────────────
    // pt: { speaking_title: 'Como se pronuncia?', ... },

  };

  const _code = (typeof AppLangPair !== 'undefined')
    ? AppLangPair.getActive().source.code
    : 'es';

  window.LangUI = _DATA[_code] || _DATA.es;

})();
