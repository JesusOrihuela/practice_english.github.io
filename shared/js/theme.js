/* ============================================================
   theme.js — Streak badge & footer year
   Include at end of <body> in every page.
   ============================================================ */

// ---- Streak badge in mode-switcher (runs on every page) ----
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('mode-streak');
  if (el && window.Progress) {
    const s = Progress.getStreak();
    const count = s && s.current != null ? s.current : 0;
    if (count > 0) el.innerHTML = '<span aria-hidden="true">🔥</span> ' + count + (count === 1 ? ' day' : ' days');
  }

  // Auto-update footer copyright year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
