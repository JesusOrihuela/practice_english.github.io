/* ============================================================
   app-ui.js — AppUI: shared UI helpers used across every activity.

   Centralizes markup/behavior that was duplicated verbatim in the activity
   files. Text comes from AppLang.t (author-controlled i18n) — safe to interpolate.

     AppUI.sessionComplete()          — the "🎉 session complete" terminal screen
     AppUI.loadError(container, onRetry) — the fetch-error banner + retry button
   ============================================================ */
var AppUI = (function () {

  // Terminal screen shown when a Ruta de Aprendizaje session finishes. Replaces the
  // whole <body> (only way out is the link back to Mi Aprendizaje), so callers do
  // their own cleanup (e.g. AppAudio.cancel()) first. The ../../ path resolves from
  // the activity page ({activity}/html/{activity}.html), pointing at my-learning.
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

  // Fetch-error banner with a retry button, inserted at the top of `container`.
  // `onRetry` is the activity's reload action (usually () => startTopic(id)).
  function loadError(container, onRetry) {
    var old = document.getElementById('fetch-error-banner');
    if (old) old.remove();

    var banner = document.createElement('div');
    banner.id = 'fetch-error-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
    Object.assign(banner.style, {
      background: 'var(--clr-danger-light)', color: 'var(--clr-danger)',
      border: '1px solid var(--clr-danger)', borderRadius: 'var(--radius-md)',
      padding: '12px 16px', marginBottom: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      fontSize: '0.88rem', fontWeight: '600',
    });

    var txt = document.createElement('span');
    txt.textContent = AppLang.t('error_loading');

    var btn = document.createElement('button');
    btn.textContent = AppLang.t('retry');
    Object.assign(btn.style, {
      background: 'var(--clr-danger)', color: '#fff', border: 'none',
      borderRadius: 'var(--radius-full)', padding: '6px 14px',
      fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700',
      cursor: 'pointer', flexShrink: '0',
    });
    btn.addEventListener('click', function () { banner.remove(); if (onRetry) onRetry(); });

    banner.appendChild(txt);
    banner.appendChild(btn);
    if (container) container.insertBefore(banner, container.firstChild);
  }

  return { sessionComplete: sessionComplete, loadError: loadError };
})();
