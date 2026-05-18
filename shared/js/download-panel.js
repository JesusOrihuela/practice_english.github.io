/* ============================================================
   download-panel.js — Shared model-download progress panel
   Used by: tts.js (voice model), speaking.js (speech model)
   ============================================================ */

const AppDownloadPanel = (() => {

  function _getContainer() {
    let c = document.getElementById('pe-download-panels');
    if (!c) {
      c = document.createElement('div');
      c.id = 'pe-download-panels';
      Object.assign(c.style, {
        position: 'fixed', bottom: '1.25rem', right: '1.25rem',
        display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem',
        zIndex: '9999', pointerEvents: 'none',
      });
      document.body.appendChild(c);
    }
    return c;
  }

  /**
   * Create an independent download-progress panel card.
   * @param {string} loadingText - Text shown while downloading (e.g. '🔊 Loading voice model…')
   * @param {string} readyText   - Text shown on completion   (e.g. '🔊 Voice model ready ✓')
   * @param {string} cacheKey    - localStorage key; when set, show() is a no-op after first completion
   * @returns {{ show, update, complete, hide }}
   */
  function create(loadingText, readyText, cacheKey) {
    let panel = null, barEl = null, hideTimer = null, safetyTimer = null, _done = false;

    function hide() {
      clearTimeout(safetyTimer);
      clearTimeout(hideTimer);
      if (!panel) return;
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(6px)';
      // Remove from DOM after the CSS transition finishes (300ms)
      const el = panel;
      panel = null;
      barEl = null;
      setTimeout(() => el.remove(), 350);
    }

    function _ensure() {
      if (panel) return;
      panel = document.createElement('div');
      Object.assign(panel.style, {
        width: '240px', background: 'var(--clr-surface, #fff)',
        color: 'var(--clr-text, #1e293b)', border: '1px solid var(--clr-border, #e2e8f0)',
        borderRadius: '0.6rem', padding: '0.75rem 1rem', fontSize: '0.8rem',
        boxShadow: '0 4px 16px rgba(0,0,0,.12)',
        opacity: '0', transform: 'translateY(6px)', transition: 'opacity .3s, transform .3s',
      });
      panel.setAttribute('role', 'status');
      panel.setAttribute('aria-live', 'polite');
      const title = document.createElement('div');
      Object.assign(title.style, { fontWeight: '600', marginBottom: '0.5rem' });
      title.textContent = loadingText;
      panel.appendChild(title);
      const track = document.createElement('div');
      Object.assign(track.style, { background: 'var(--clr-border, #e2e8f0)', borderRadius: '99px', height: '5px', overflow: 'hidden' });
      barEl = document.createElement('div');
      Object.assign(barEl.style, { background: 'var(--clr-primary, #2563eb)', height: '100%', width: '0%', borderRadius: '99px', transition: 'width .6s ease' });
      track.appendChild(barEl);
      panel.appendChild(track);
      _getContainer().appendChild(panel);
    }

    function show() {
      if (_done) return;                                        // already complete this session
      if (cacheKey && localStorage.getItem(cacheKey)) return;  // cached from prior session
      clearTimeout(hideTimer);
      _ensure();
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(hide, 12000);
      requestAnimationFrame(() => {
        if (!panel) return;
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
      });
    }

    function update(pct) {
      if (_done) return;
      show();
      if (barEl) barEl.style.width = Math.min(pct, 100) + '%';
    }

    function complete() {
      _done = true;
      if (cacheKey) localStorage.setItem(cacheKey, '1');
      clearTimeout(safetyTimer);
      if (!panel) return;
      const title = panel.querySelector('div');
      if (title) title.textContent = readyText;
      if (barEl) barEl.style.width = '100%';
      hideTimer = setTimeout(hide, 2000);
    }

    return { show, update, complete, hide };
  }

  return { create };
})();
