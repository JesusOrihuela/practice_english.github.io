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

    fr: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#ED2939"/>
      <rect width="14.67" height="15" fill="#fff"/>
      <rect width="7.33" height="15" fill="#002395"/>
    </svg>`,

    de: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#FFCE00"/>
      <rect width="22" height="10" fill="#DD0000"/>
      <rect width="22" height="5" fill="#000"/>
    </svg>`,

    pt: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#FF0000"/>
      <rect width="8.8" height="15" fill="#006600"/>
    </svg>`,

    br: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#009C3B"/>
      <polygon points="11,1.5 20.5,7.5 11,13.5 1.5,7.5" fill="#FEDF00"/>
      <circle cx="11" cy="7.5" r="3" fill="#003087"/>
    </svg>`,

    it: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#CE2B37"/>
      <rect width="14.67" height="15" fill="#fff"/>
      <rect width="7.33" height="15" fill="#009246"/>
    </svg>`,

    nl: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#21468B"/>
      <rect width="22" height="10" fill="#fff"/>
      <rect width="22" height="5" fill="#AE1C28"/>
    </svg>`,

    pl: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#DC143C"/>
      <rect width="22" height="7.5" fill="#fff"/>
    </svg>`,

    se: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#006AA7"/>
      <rect y="5.5" width="22" height="4" fill="#FECC02"/>
      <rect x="6" width="4" height="15" fill="#FECC02"/>
    </svg>`,

    no: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#EF2B2D"/>
      <rect y="5.5" width="22" height="4" fill="#fff"/>
      <rect x="6" width="4" height="15" fill="#fff"/>
      <rect y="6.5" width="22" height="2" fill="#002868"/>
      <rect x="7" width="2" height="15" fill="#002868"/>
    </svg>`,

    dk: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#C60C30"/>
      <rect y="5.5" width="22" height="4" fill="#fff"/>
      <rect x="6" width="4" height="15" fill="#fff"/>
    </svg>`,

    fi: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#fff"/>
      <rect y="5.5" width="22" height="4" fill="#003580"/>
      <rect x="6" width="4" height="15" fill="#003580"/>
    </svg>`,

    cz: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#D7141A"/>
      <rect width="22" height="7.5" fill="#fff"/>
      <polygon points="0,0 10,7.5 0,15" fill="#11457E"/>
    </svg>`,

    lv: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#9E3039"/>
      <rect y="6" width="22" height="3" fill="#fff"/>
    </svg>`,

    lt: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#C1272D"/>
      <rect width="22" height="10" fill="#006A44"/>
      <rect width="22" height="5" fill="#FDB913"/>
    </svg>`,

    ee: `<svg width="22" height="15" viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="15" fill="#fff"/>
      <rect width="22" height="10" fill="#000"/>
      <rect width="22" height="5" fill="#0072CE"/>
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

  /* ---------- Regions (variant labels) ---------- */

  // A region LABEL maps either to a single-country flag OR, for multi-country zones with no
  // single flag, to a stylised silhouette. Extensible: a new region only needs an entry here
  // (a country code below, or a shape in REGION_SHAPES). Keys are accent-folded + lowercased.
  const REGION_CODE = {
    'espana': 'es', 'uk': 'gb', 'reino unido': 'gb',
    'us': 'us', 'usa': 'us', 'ee. uu.': 'us', 'ee.uu.': 'us', 'estados unidos': 'us',
    'mexico': 'mx', 'francia': 'fr', 'alemania': 'de', 'italia': 'it', 'brasil': 'br',
    'portugal': 'pt',
  };

  // Simplified, recognisable zone silhouettes (fill = currentColor, so they inherit the pill
  // colour and stay theme-aware). Add zones (Sudamérica, El Caribe, etc.) here as needed.
  const REGION_SHAPES = {
    // Orthographic-globe locator: grey sphere + the region highlighted (like a Wikimedia
    // "(orthographic projection)" map). A fuller/real coastline asset can replace this path.
    latinoamerica: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#dbe0e6"/><circle cx="20" cy="20" r="19" fill="none" stroke="#b8c0ca" stroke-width="1"/><path fill="#3f8f5b" d="M16 8 L21 7 L24 10 L22 13 L27 15 L30 20 L27 26 L23 31 L20 35 L18 30 L17 25 L14 21 L13 16 L15 12 Z"/></svg>`,
  };

  const _fold = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /**
   * Returns the SVG element for a region variant LABEL — a country flag or a zone silhouette —
   * or null when the region has no visual (caller then shows the name alone).
   * @param {string} name — region label as authored (e.g. 'España', 'UK', 'Latinoamérica')
   */
  function region(name) {
    const key = _fold(name);
    if (!key) return null;
    const code = REGION_CODE[key];
    if (code && DEFS[code]) return _svgEl(DEFS[code], 'flag-single');
    if (REGION_SHAPES[key]) return _svgEl(REGION_SHAPES[key], 'region-silhouette');
    return null;
  }

  return { stack, single, region };
})();
