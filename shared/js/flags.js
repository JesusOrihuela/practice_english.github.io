/* ============================================================
   flags.js — Shared SVG flag builder (AppFlags)
   Usage: AppFlags.stack('es', 'mx')  → <span class="flag-stack">…</span>
          AppFlags.single('us')       → <svg>…</svg>
   ============================================================ */

const AppFlags = (() => {

  /* ---------- Raw SVG definitions ---------- */
  const DEFS = {
    es: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#c60b1e"/>
      <rect y="3.75" width="22" height="7.5" fill="#ffc400"/>
      <rect x="8.5" y="5.2" width="5" height="4.6" rx="0.5" fill="#8B0000" opacity="0.7"/>
    </svg>`,

    mx: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#006847"/>
      <rect x="7.33" width="7.34" height="15" fill="#fff"/>
      <rect x="14.67" width="7.33" height="15" fill="#ce1126"/>
      <circle cx="11" cy="7.5" r="2.5" fill="#6B3A2A"/>
    </svg>`,

    us: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#B22234"/>
      <rect y="1.15" width="22" height="1.15" fill="#fff"/>
      <rect y="3.46" width="22" height="1.15" fill="#fff"/>
      <rect y="5.77" width="22" height="1.15" fill="#fff"/>
      <rect y="8.08" width="22" height="1.15" fill="#fff"/>
      <rect y="10.38" width="22" height="1.15" fill="#fff"/>
      <rect y="12.69" width="22" height="1.15" fill="#fff"/>
      <rect width="9" height="8.08" fill="#3C3B6E"/>
    </svg>`,

    gb: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#012169"/>
      <polygon points="0,0 3,0 22,12 22,15 19,15 0,3" fill="#fff"/>
      <polygon points="22,0 19,0 0,12 0,15 3,15 22,3" fill="#fff"/>
      <polygon points="0,0 2,0 22,13 22,15 20,15 0,2" fill="#C8102E"/>
      <polygon points="22,0 20,0 0,13 0,15 2,15 22,2" fill="#C8102E"/>
      <rect x="9" width="4" height="15" fill="#fff"/>
      <rect y="5.5" width="22" height="4" fill="#fff"/>
      <rect x="9.5" width="3" height="15" fill="#C8102E"/>
      <rect y="6" width="22" height="3" fill="#C8102E"/>
    </svg>`,
  };

  /* ---------- Helpers ---------- */

  function _svgEl(code, cls) {
    const wrap = document.createElement('span');
    wrap.innerHTML = code.trim();
    const svg = wrap.firstElementChild;
    svg.classList.add(cls);
    return svg;
  }

  /* ---------- Public API ---------- */

  /**
   * Returns a <span class="flag-stack"> with two overlapping SVG flags.
   * @param {string} back  — country code for the back flag (e.g. 'es')
   * @param {string} front — country code for the front flag (e.g. 'mx')
   */
  function stack(back, front) {
    const wrap = document.createElement('span');
    wrap.className = 'flag-stack';
    wrap.setAttribute('aria-hidden', 'true');
    if (DEFS[back])  wrap.appendChild(_svgEl(DEFS[back],  'flag-back'));
    if (DEFS[front]) wrap.appendChild(_svgEl(DEFS[front], 'flag-front'));
    return wrap;
  }

  /**
   * Returns a single SVG flag element (no stacking).
   * @param {string} code — country code (e.g. 'us')
   */
  function single(code) {
    if (!DEFS[code]) return document.createElement('span');
    return _svgEl(DEFS[code], 'flag-single');
  }

  return { stack, single };
})();
