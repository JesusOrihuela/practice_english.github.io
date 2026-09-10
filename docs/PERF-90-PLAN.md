# Plan — Performance móvil estable ≥90 (refactor de `progress.js`)

## ✅ EJECUTADO (2026-09-10, commit 139bcaae)

`_ID_MAP` (~70 KiB) externalizado de `progress.js` a **`shared/json/common/id-map.json`** de carga
diferida (SW-precacheado, offline-safe). `progress.js` pasó de **208 KB → 22 KB**. Detalles:
- `tools/fix-phrase-ids.js` genera el JSON (antes inyectaba el const en progress.js); `--check` lo valida en CI.
- `progress.js`: loader `_ensureIdMap()` + helpers `_mapPhrases/_mapVocab` (devuelven {} hasta cargar).
  **Migración v2→v3 DIFERIDA sin pérdida de progreso** — nunca sube `_v` sin el remap real; reintenta al
  cargar el mapa. Verificado con test de migración (v2 posicional intacto, luego remapeado con reps preservados).
- `AppPath.load()` espera el mapa → cubre TODOS los flujos path/session (index, my-learning, grammar,
  progress-page, activity.js). Landing stat + index.js path esperan `ensureIdMap`. Ancho de stat reservado (CLS 0).
- `service-worker.js` precachea `id-map.json`. Los 11 gates verdes + 2 tests de unidad (migración + operación normal).

**Confirmado (Lighthouse CI, runner limpio, deploy 139bcaae):** 3 corridas = 83/90/90 → **mediana 90**
(a11y 96, bp 96, seo 100). Cruzado el objetivo. La corrida de 83 (LCP 3.9s) es el outlier de ruido habitual
del runner libre (±8 pts); las otras dos dan 90 exacto con LCP ~3.1s. El costo estructural (70 KiB en la
ruta crítica) quedó eliminado; la mediana ahora se apoya en 90. Palancas de respaldo (abajo) quedan
documentadas por si se quisiera margen extra sobre el ruido.

---

## Contexto (estado verificado 2026-09-10)

Todo lo demás del proyecto está **cerrado y en vivo**: par de-es shippado (Fases 0-5), matriz de
stress-test (6 pares: en-de/en-fi/de-pl/en-pt/en-sv/en-no) con el framework de variantes abierto
completo (registro data-driven, `validateLabels`, `variant-openness` 21/21, fuentes académicas). 0
commits sin pushear. **El único abierto es este.**

Performance móvil del landing hoy = **~87-89** (runner limpio de CI, ±8 pts ruidoso; ver
`project_mobile_perf`). Gate CI: `performance` como **`warn` @ 0.90** (nudge, no bloquea); a11y/bp
`error @ 0.90`, seo `error @ 0.95`. Objetivo: cruzar **90 de forma estable** (no por suerte del ruido).

## Causa raíz (del último trace limpio)

- LCP ≈ 3.1-3.4 s con `element render delay ≈ 1.5 s`; main-thread "Other" ≈ 2.2 s.
- El costo dominante es **parse/ejecución de `shared/js/progress.js` (~70 KiB)** por su **`_ID_MAP` embebido**
  (const gigante con los ids de frase/vocab de TODOS los pares), que corre antes del reveal del cloak.
- Ya hecho y sin más margen fácil: preload+fetchpriority de `learn.webp`, `defer` de los 10 scripts del
  body (paraleliza descarga, no ejecución), SVGs de banderas −51%. El `defer` no baja la EJECUCIÓN de
  `_ID_MAP`; ese es el lever que queda.

## Objetivo

Sacar `_ID_MAP` de `progress.js` a un **JSON de carga diferida** para que no se parsee en la ruta crítica
del landing, bajando main-thread y el LCP render-delay → **≥90 estable** en móvil, **sin romper** el SRS
ni las 8 actividades ni "Mi Aprendizaje".

## Restricción que define el enfoque

`progress.js` es **módulo COMPARTIDO** (SRS de las 8 actividades + landing). `_ID_MAP` lo consumen:
- `getContentCounts()` → stat "frases" del landing (número tipo "1100+").
- Lógica del SRS / path (qué contenido existe, due counts).
Hacer `_ID_MAP` asíncrono obliga a que esos consumidores toleren "aún no cargado".

## Enfoques (elegir en la ejecución; A recomendado)

- **A · `_ID_MAP` externo + accessor perezoso con caché.** Mover el objeto a
  `shared/json/derived/id-map.json` (generado por el mismo tooling que hoy lo embebe — buscar en
  `tools/` quién escribe `_ID_MAP` en progress.js y redirigirlo a escribir el JSON). En progress.js:
  `_ID_MAP = null`; `ensureIdMap()` → `AppData.get('id-map')` (fetch cacheado, network-first como el
  resto de JSON) que puebla `_ID_MAP` una vez. `getContentCounts()` pasa a devolver `null`/promesa si no
  está listo; el landing ya difiere la stat a DOMContentLoaded (`_setPhrasesStat`), así que puede
  `await ensureIdMap()` ahí sin FOUC (placeholder "—" reservado). Revisar cada consumidor del SRS: los
  que corren en respuesta a acción del usuario (siempre tras carga) no cambian; los de arranque, gatear
  con `ensureIdMap()`.
- **B · Split de script.** Dejar `_ID_MAP` en su propio `<script defer src="id-map.js">` (define
  `window.__PE_ID_MAP`) y `progress.js` lo lee. Más simple pero sigue parseando 70 KiB en el hilo (solo
  lo separa); ganancia menor que A. Sirve si A resulta muy invasivo.

## Pasos (Enfoque A)

1. **Localizar el generador** de `_ID_MAP` (`grep -rn "_ID_MAP" tools/`), redirigirlo a emitir
   `shared/json/derived/id-map.json` (+ dejar en progress.js solo el accessor). Registrar `id-map` en
   `AppData` (loader de JSON por clave).
2. **Reescribir consumidores**: `getContentCounts` async-safe; `_setPhrasesStat` (index.html) hace
   `await`; auditar SRS/path para arranque-sin-mapa.
3. **Verificar**: `gate-run` de un par + los 11 gates; **smoke e2e** de las 8 actividades + Mi Aprendizaje
   en de-es y en-es (que el SRS puntúe, el due funcione, la stat del landing aparezca). `check-audio`/
   `fix-phrase-ids` intactos (el id-map alimenta esos).
4. **Medir**: re-deploy → correr `gh run` del workflow Lighthouse (runner limpio) ×3; confirmar mediana
   ≥90 con LCP render-delay bajando. Si sigue <90, evaluar además: (a) diferir `progress.js` mismo si el
   landing no lo necesita síncrono tras el split, (b) `content-visibility:auto` en secciones bajo el
   fold, (c) minificar `ui.js` (31 KiB) con un paso one-time.

## Verificación / criterios de aceptación

- Los **11 gates** verdes; **smoke e2e** verde (SRS + stat + path en de-es/en-es).
- Lighthouse móvil (runner limpio, mediana de 3) **≥90**, CLS 0, sin regresión de a11y/bp/seo.
- `git status` limpio; commits pusheados; sin `_ID_MAP` embebido en `progress.js`.

## Riesgo y mitigación

Riesgo real (módulo compartido + volver async un dato hoy síncrono). Mitigación: enfoque A mantiene un
accessor con caché (una sola carga), gatea solo los puntos de arranque, y el landing ya tiene el punto de
diferido (`_setPhrasesStat`). Si A destapa demasiados consumidores síncronos, caer a B (split de script),
que es no-invasivo aunque con menor ganancia. **No** relajar el gate para "pasar": el gate perf es `warn`.
