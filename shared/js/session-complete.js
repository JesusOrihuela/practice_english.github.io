/* ============================================================
   session-complete.js — AppUI.sessionComplete()

   The identical "🎉 session complete" terminal screen every phrase/vocab/quiz
   activity shows when a Ruta de Aprendizaje session finishes. Previously this
   markup was duplicated verbatim in 7 activity files; centralizing it keeps the
   copy, styling and i18n keys in one place. It replaces the whole <body> (the
   only way out is the link back to Mi Aprendizaje), so callers should do any
   activity-specific cleanup (e.g. AppAudio.cancel()) before invoking it.

   Text is from AppLang.t (author-controlled i18n) — safe to interpolate.
   The ../../ path resolves relative to the activity page, which is always at
   {activity}/html/{activity}.html, so it points at my-learning for every caller.
   ============================================================ */
var AppUI = (function () {
  function sessionComplete() {
    var prog        = (typeof PathSession !== 'undefined') ? PathSession.getProgress() : null;
    var reviewCount = prog ? Math.max(0, prog.total - (prog.newCount || 0)) : 0;
    var newCount    = prog ? (prog.newCount || 0) : 0;
    document.body.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;font-family:inherit;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;">🎉</div>' +
        '<h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">' + AppLang.t('session_complete') + '</h1>' +
        '<p style="color:var(--clr-text-muted,#6b7280);margin-bottom:2rem;">' +
          AppLang.t('path_complete_summary', { review: reviewCount, new: newCount }) +
        '</p>' +
        '<a href="../../my-learning/html/my-learning.html" style="background:var(--clr-primary,#4f46e5);color:#fff;padding:0.75rem 2rem;border-radius:999px;text-decoration:none;font-weight:600;">' + AppLang.t('my_learning_link') + '</a>' +
      '</div>';
  }
  return { sessionComplete: sessionComplete };
})();
