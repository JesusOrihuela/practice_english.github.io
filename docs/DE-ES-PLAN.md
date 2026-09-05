# Plan — `de-es` (Alemán → Español) a nivel SHIPPABLE

El primer par **shippable real** que no es es-en/en-es. Source **alemán** (bloque UI `de` ya existe,
creado para de-pl), target **español** (vocab/es target-centric + audio es + coverage gate ya existen).

## Restricción que define el enfoque

- **vocab/es es target-centric y compartido: ~1605 entradas.** de-es lo reutiliza, pero cada entrada
  necesita `translations.de` + `gloss.de` (glosa alemana) para su toggle L1/L2.
- **El gate del español es 86 % en AMBOS canales (frases y vocab), por-idioma** (de-es y en-es
  gatean contra el mismo `es=86`). El canal vocab ya lo cubre vocab/es; el **canal de frases de de-es
  es independiente** (frases con source alemán) → debe alcanzar ~86 % por sí solo.
- Por eso un de-es shippable necesita **amplitud comparable a en-es** (~30 temas). La independencia de
  contenido se ejerce en los márgenes (qué situacionales/culturales + etiqueta y énfasis alemanes),
  no en recortar el núcleo funcional que cubre el top-1000 español.

## Set de temas — CERRADO (30)

**A · Núcleo funcional (11):** greetings, personal_info, family, emociones, daily_routine, survival,
descripciones (ser/estar), conversacion, planes, pensamientos_opiniones, calendario

**B · Situacionales — viaje/vida (12):** restaurant, supermarket, kitchen, directions, transportation,
airport, accommodation, viajes, weather, health, cuerpo, hogar

**C · Interés/cultura + cierre de cobertura (7):** trabajo_economia, estudios, tiempo_libre, deportes,
naturaleza_lugares, technology, sitios

*(Fuera de en-es por ser demasiado específicos: accountability, theater, museums, politica, oficina,
fiesta, describiendo_personas → se pliega en descripciones.)*

## Mecanismo `wip` (work-in-progress)

Un par real en construcción no puede registrarse "de golpe": dispararía los checks de completitud
(1605 glosas alemanas ausentes) y metería CI en rojo. Flag **`wip: true`** en el objeto PAIR:
- **Oculto** del picker shippable (`getShippable` filtra `!stressTest && !wip`); accesible con `?dev=1`.
- **Exento** de `check-pair-completeness` (no exige sus banderas/gramática/placement NI añade su source
  a `sourcesByTarget`, así que las glosas alemanas no se exigen aún) y de coverage.
- Se **quita el flag** cuando el par pasa todos los gates → se vuelve shippable normal y aparece solo.

## Fases

- **Fase 0 — Andamiaje:** registrar `de-es` (wip) en lang-pair.js (source de flags de/at, target es
  flags es/mx/ar, sttLanguage spanish, voces es); `pairs/de-es/topics.json` (crece por tema),
  `placement.json`, `grammar-rules.json` con la regla insignia **ser/estar**.
- **Fase 1 — Núcleo A1–A2** (bloque A): frases (source alemán fiel + target español neutro), audio es
  (edge-tts ef_dora/em_alex), glosas alemanas del vocab de esos temas.
- **Fase 2 — Situacionales A2–B1** (bloque B).
- **Fase 3 — Cierre de cobertura B1–B2** (bloque C + `build-candidates-cover --pair de-es` para los
  lemas del top-1000 que falten) hasta `coverage --pair de-es` ≥ 86 % en frases.
- **Fase 4 — Glosas alemanas del vocab** (paralela, mecánica): `translations.de` + `gloss.de` en las
  1605 entradas de vocab/es (por deck, junto con cada fase).
- **Fase 5 — Shippear:** todos los gates verdes + gate 86 % ambos canales → quitar `wip` → el par
  aparece en el picker.

## Énfasis gramatical propio de un germanoparlante (distinto de en-es)

1. **ser/estar** (el alemán tiene un solo *sein*) — punto #1.
2. **por/para** (el alemán no distingue).
3. **subjuntivo** (inexistente como en español).
4. **pretérito indefinido vs imperfecto** (el alemán usa el Perfekt casi siempre).
5. **género + concordancia** y **conjugación rica**.

## Reglas transversales

Calidad **uno-a-uno** (classify → definir → enrich → audio → validar por ítem, sin paralelos que
diluyan). Source alemán = traducción fiel del target español. Español **neutro** (sin regionalismos en
base; variantes regionales en `target[]`/`variants[]`). Todos los gates verdes por fase.
