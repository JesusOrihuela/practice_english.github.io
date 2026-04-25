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

  // Scroll active nav button into view so it's never hidden off-screen on mobile
  const nav    = document.querySelector('.mode-switcher');
  const active = nav && nav.querySelector('.mode-btn.active');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
});
