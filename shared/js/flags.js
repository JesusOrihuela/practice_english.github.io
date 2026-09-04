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
    if (back)  wrap.appendChild(flagImg(back,  'flag-back'));
    if (front) wrap.appendChild(flagImg(front, 'flag-front'));
    return wrap;
  }

  /**
   * Render a language's flag set for ANY count (a language may need 1, 2 or 3+ flags — Finnish/
   * Icelandic 1, Spanish/German 2, or a triple). Dispatches by count so callers never assume two:
   * 1 → a single flag, 2 → the overlapping stack (compact pair look), 3+ → a side-by-side cluster.
   * @param {string[]} codes — the language's flag codes (from PAIRS' source.flags / target.flags).
   */
  // Approximate aspect ratio (w/h) of flags that are NOT the common 3:2; used only to size the stack
  // wrapper tightly around the flags (so the pair badge content is horizontally centered, no left lean)
  // and to place the 3-flag layout. A missing code defaults to 3:2. Visual metadata, not app logic.
  const FLAG_AR = { us: 1.9, gb: 1.667, mx: 1.75, ar: 1.6, ch: 1.0 };
  const _flagW = (code, h) => Math.round((FLAG_AR[code] || 1.5) * h);

  // A language's flags as ONE overlapping stack, for ANY count. Every flag is the SAME height; width
  // follows each flag's aspect. The wrapper is ALWAYS the same fixed height (HC) regardless of count —
  // so a 3-flag badge is never taller than a 1/2-flag one — and its width is the flags' real bounding
  // box (so the badge content is horizontally centered, no lean). Layout by count:
  //   1 → single, centered.        2 → diagonal: back top-left, front down-right + on top.
  //   3 → three levels (staircase): the MIDDLE flag (e.g. México in es/mx/ar) is at the bottom-centre
  //       and ON TOP (never covered); the LAST flag (Argentina) is top-left and hindmost; the FIRST is
  //       middle-right. All three fit inside HC (smaller vertical step than 2-flag), never taller.
  function langFlags(codes) {
    const list = (codes || []).filter(Boolean);
    const n = list.length;
    const FH = 14, HC = 22;                     // fixed flag height + fixed wrapper height (any count)
    const w = (i) => _flagW(list[i], FH);       // each flag's own width (aspect-based)
    const wrap = document.createElement('span');
    wrap.className = 'flag-stack';
    wrap.setAttribute('aria-hidden', 'true');
    if (!n) return wrap;

    // ZIGZAG (vertical levels) + overlap by HALF the covered flag's width, so a covered flag never
    // shows less than half whatever its aspect. pos[i] = { x, y, z }.
    //   n=2 → diagonal: back flag top-left; front flag down-right, covering the back's right half.
    //   n=3 → staircase: last flag (Argentina) top-left/back; first (España) middle-right; middle flag
    //         (México) bottom-centre and ON TOP, covering the inner half of each neighbour (uncovered).
    const DY = 4;                                         // vertical step between levels
    let pos = [];
    if (n === 1) {
      pos[0] = { x: 0, y: 0, z: 1 };
    } else if (n === 2) {
      pos[0] = { x: 0,        y: 0,  z: 1 };
      pos[1] = { x: w(0) / 2, y: DY, z: 2 };
    } else if (n === 3) {
      pos[2] = { x: 0,                          y: 0,      z: 1 };
      pos[0] = { x: w(2) / 2 + w(1) - w(0) / 2, y: DY,     z: 2 };
      pos[1] = { x: w(2) / 2,                   y: 2 * DY, z: 3 };
    } else {
      let x = 0;                                          // 4+: half-overlap zigzag cascade
      for (let i = 0; i < n; i++) { pos[i] = { x: x, y: (i % 2) * DY, z: i + 1 }; x += w(i) / 2; }
    }

    var minX = Infinity, maxX = -Infinity, maxY = 0;
    list.forEach(function (code, i) { minX = Math.min(minX, pos[i].x); maxX = Math.max(maxX, pos[i].x + w(i)); maxY = Math.max(maxY, pos[i].y); });
    var offY = (HC - (FH + maxY)) / 2;                    // centre the whole cascade in the fixed height
    list.forEach(function (code, i) {
      var img = flagImg(code, 'flag-layer');
      img.style.left = (pos[i].x - minX) + 'px';
      img.style.top  = (offY + pos[i].y) + 'px';
      img.style.zIndex = String(pos[i].z);
      wrap.appendChild(img);
    });
    wrap.style.width  = (maxX - minX) + 'px';
    wrap.style.height = HC + 'px';
    return wrap;
  }

  /**
   * Returns a single real flag as an <img> from the asset dir.
   * @param {string} code — country code (e.g. 'us')
   */
  function single(code) {
    return flagImg(code, 'flag-single');
  }

  /* ---------- Regions / variants → REAL national flags (cluster) ---------- */

  // Base path to the flag assets, derived from THIS script's own URL so it resolves at any page
  // depth (GitHub Pages subpath, local, …): .../shared/js/flags.js → .../shared/img/flags/
  const _scriptSrc = (document.currentScript && document.currentScript.src) ||
    ([].map.call(document.scripts, s => s.src).find(s => /\/flags\.js(\?|$)/.test(s))) || '';
  const FLAG_BASE = _scriptSrc.replace(/[^/]*$/, '').replace(/\/js\/$/, '/img/flags/');
  const REGION_BASE = FLAG_BASE.replace(/\/flags\/$/, '/regions/');   // shared/img/regions/

  const _fold = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // A region/variant LABEL → the country code(s) it covers. One country → one flag; several →
  // a flag cluster (works for any set, even antipodal like US+Australia). A new region/variant
  // needs an entry here + its flag asset in shared/img/flags/. A macro-zone with no country
  // list returns null → the caller shows the name alone.
  const REGION_MAP = {
    // German-speaking regions (DACH) — de/at/ch flag assets exist in shared/img/flags/.
    'deutschland': ['de'], 'alemania': ['de'], 'germany': ['de'],
    'osterreich': ['at'], 'austria': ['at'],
    'schweiz': ['ch'], 'suiza': ['ch'], 'switzerland': ['ch'],
    'dach': ['de', 'at', 'ch'],
    'espana': ['es'], 'uk': ['gb'], 'reino unido': ['gb'],
    // Portuguese-speaking regions (en-pt BR↔PT split) — br/pt flag assets exist in shared/img/flags/.
    'brasil': ['br'], 'brazil': ['br'], 'portugal': ['pt'],
    'us': ['us'], 'usa': ['us'], 'ee. uu.': ['us'], 'ee.uu.': ['us'], 'estados unidos': ['us'],
    'mexico': ['mx'], 'argentina': ['ar'], 'chile': ['cl'], 'peru': ['pe'], 'bolivia': ['bo'],
    'uruguay': ['uy'], 'colombia': ['co'], 'venezuela': ['ve'], 'australia': ['au'],
    // Macro-zones whose member flags all exist → a clean flag cluster (cluster() caps at 5 + "+N").
    'cono sur': ['ar', 'cl', 'uy'], 'rio de la plata': ['ar', 'uy'],
    'mexico y espana': ['mx', 'es'],
    'sudamerica andina y cono sur': ['pe', 'bo', 'cl', 'ar', 'uy'],
    'caribe': ['cu', 'do', 'pr'],
    'mexico y centroamerica': ['mx', 'gt', 'hn', 'ni', 'pa'],
    'sudamerica': ['co', 've', 'ec', 'pe', 'bo', 'cl', 'py', 'ar', 'uy'],
    'centroamerica': ['gt', 'hn', 'sv', 'ni', 'cr', 'pa'],
  };

  // Contiguous MACRO-regions (fit in one hemisphere) → a real orthographic-globe asset, since
  // a flag cluster of ~20 countries would be absurd. Country-precise sets use flags (above).
  const REGION_GLOBE = {
    'latinoamerica': 'latinoamerica.svg',
    // "carro" zone (DAMER): all of Latin America except the Cono Sur (which says "auto"). The Latin-
    // America globe is the closest locator; the label text carries the precise exclusion.
    'america (salvo cono sur)': 'latinoamerica.svg',
    // The neutral / pan-Hispanic variety is a first-class labelled variant with its own badge
    // (a world globe, distinct from the Latin-America locator map) — shown like any country/region.
    'general': 'general.svg', 'neutro': 'general.svg', 'panhispanico': 'general.svg',
  };

  /** A single real flag as an <img> from the asset dir (never inlined; emblem flags are big). */
  function flagImg(code, cls) {
    const img = document.createElement('img');
    img.src = FLAG_BASE + code + '.svg';
    img.className = cls || 'flag-img'; img.alt = '';
    img.setAttribute('aria-hidden', 'true'); img.loading = 'lazy';
    return img;
  }

  /** Cluster of real flags for a multi-country variant: first `max` + "+N"; wraps responsively. */
  function cluster(codes, max) {
    max = max || 5;
    const wrap = document.createElement('span');
    wrap.className = 'flag-cluster';
    (codes || []).slice(0, max).forEach(c => wrap.appendChild(flagImg(c)));
    if ((codes || []).length > max) {
      const more = document.createElement('span');
      more.className = 'flag-more';
      more.textContent = '+' + (codes.length - max);
      wrap.appendChild(more);
    }
    return wrap;
  }

  /**
   * Visual for a region/variant LABEL: one real flag, a flag cluster (multi-country), or null
   * (macro-zone with no country list → caller shows the name alone).
   * @param {string} name — label as authored (e.g. 'España', 'UK', 'palta')
   */
  function region(name) {
    const key = _fold(name);
    const codes = REGION_MAP[key];
    if (codes && codes.length) return codes.length === 1 ? flagImg(codes[0]) : cluster(codes);
    const globe = REGION_GLOBE[key];
    if (globe) {
      const img = document.createElement('img');
      img.src = REGION_BASE + globe;
      img.className = 'region-globe'; img.alt = '';
      img.setAttribute('aria-hidden', 'true'); img.loading = 'lazy';
      return img;
    }
    return null;   // unknown label → caller shows the name alone
  }

  return { stack, single, region, cluster, flagImg, langFlags };
})();
