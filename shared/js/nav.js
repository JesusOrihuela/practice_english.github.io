/* ============================================================
   nav.js — Path-mode nav highlight
   When ?path=1 is present, overrides the hardcoded active
   class so "My Learning" stays highlighted across all activities.
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  if (new URLSearchParams(location.search).get('path') !== '1') return;

  // Mark body so CSS can theme all primary-color elements gold
  document.body.classList.add('path-mode');

  // Remove existing active highlight
  document.querySelectorAll('.mode-switcher .mode-btn.active').forEach(function (el) {
    el.classList.remove('active');
  });

  // Highlight My Learning with path color
  var ml = document.querySelector('.mode-switcher [data-nav="my-learning"]');
  if (ml) { ml.classList.add('active'); ml.classList.add('active--path'); }
});
