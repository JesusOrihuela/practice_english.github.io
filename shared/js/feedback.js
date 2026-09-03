/* ============================================================
   feedback.js — Shared Unified Feedback Component (AppFeedback)
   Produces DOM nodes for the standard feedback card diff rows.
   ============================================================ */

const AppFeedback = (() => {

  /* Build a single diff row: label | word word word
     Words are wrapped in a .uf-words div so multi-line wrapping
     aligns to the first word, not to the label. */
  function _makeRow(label, words) {
    const row = document.createElement('div');
    row.className = 'uf-diff-row';

    const lbl = document.createElement('span');
    lbl.className = 'uf-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const wordsWrap = document.createElement('div');
    wordsWrap.className = 'uf-words';
    words.forEach(w => {
      const s = document.createElement('span');
      s.className = w.cls;
      s.textContent = w.text;
      wordsWrap.appendChild(s);
    });
    row.appendChild(wordsWrap);

    return row;
  }

  /* LCS-based word alignment.
     Returns steps: { type: 'match'|'extra'|'miss', expWord?, hearWord? }
     Display words come from original strings (preserving case/punctuation).
     Normalised forms are used only for comparison. */
  function _align(userText, correctText, contractionMap) {
    const norm = s => (typeof AppText !== 'undefined')
      ? AppText.normalise(s, contractionMap || {})
      : s.toLowerCase().trim();

    const expOrig  = correctText.trim().split(/\s+/).filter(Boolean);
    const hearOrig = userText.trim().split(/\s+/).filter(Boolean);
    const expW     = expOrig.map(w => norm(w));
    const hearW    = hearOrig.map(w => norm(w));

    const m = expW.length, n = hearW.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = expW[i-1] === hearW[j-1]
          ? dp[i-1][j-1] + 1
          : Math.max(dp[i-1][j], dp[i][j-1]);

    const steps = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && expW[i-1] === hearW[j-1]) {
        steps.unshift({ type: 'match', expWord: expOrig[i-1], hearWord: hearOrig[j-1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        steps.unshift({ type: 'extra', hearWord: hearOrig[j-1] });
        j--;
      } else {
        steps.unshift({ type: 'miss', expWord: expOrig[i-1] });
        i--;
      }
    }
    return steps;
  }

  /* Incorrect: YOUR ANSWER row (colored per word) + EXPECTED row (all green).
     Returns a .uf-diff-wrap DOM node. */
  function buildDiff(userText, correctText, contractionMap) {
    const steps = _align(userText, correctText, contractionMap);

    const yourWords = steps.map(s => {
      if (s.type === 'match') return { cls: 'uf-word-ok',   text: s.hearWord };
      if (s.type === 'extra') return { cls: 'uf-word-err',  text: s.hearWord };
      return                         { cls: 'uf-word-miss', text: '[' + s.expWord + ']' };
    });

    const expWords = steps
      .filter(s => s.type !== 'extra')
      .map(s => ({ cls: 'uf-word-ok', text: s.expWord }));

    const wrap = document.createElement('div');
    wrap.className = 'uf-diff-wrap';
    wrap.appendChild(_makeRow(AppLang.t('feedback_your_answer'), yourWords));
    wrap.appendChild(_makeRow(AppLang.t('feedback_correct_answer'), expWords));
    return wrap;
  }

  /* Correct: YOUR ANSWER row only, all words green.
     Returns a .uf-diff-wrap DOM node. */
  function buildCorrect(correctText) {
    const words = correctText.trim().split(/\s+/).filter(Boolean)
      .map(w => ({ cls: 'uf-word-ok', text: w }));

    const wrap = document.createElement('div');
    wrap.className = 'uf-diff-wrap';
    wrap.appendChild(_makeRow(AppLang.t('feedback_your_answer'), words));
    return wrap;
  }

  /* Cloze: shows the full phrase with the blank word colored.
     YOUR ANSWER row: all words green except the blank word (green if correct, red+strikethrough if wrong).
     EXPECTED row (only on incorrect): all words green with the correct word in the blank position.
     blankedPhrase contains '___' where the blank is. */
  function buildCloze(blankedPhrase, userWord, correctWord, isCorrect) {
    const tokens = blankedPhrase.trim().split(/\s+/);
    const blankIdx = tokens.indexOf('___');

    function makeWords(word, correct) {
      return tokens.map((t, i) => {
        if (i !== blankIdx) return { cls: 'uf-word-ok', text: t };
        return { cls: correct ? 'uf-word-ok' : 'uf-word-err', text: word };
      });
    }

    const wrap = document.createElement('div');
    wrap.className = 'uf-diff-wrap';
    wrap.appendChild(_makeRow(AppLang.t('feedback_your_answer'), makeWords(userWord, isCorrect)));
    if (!isCorrect) {
      wrap.appendChild(_makeRow(AppLang.t('feedback_correct_answer'), makeWords(correctWord, true)));
    }
    return wrap;
  }

  /* Quiz: multiple-choice — no word diff, whole definition as a block.
     YOUR ANSWER row: chosen definition (green if correct, red+strikethrough if wrong).
     CORRECT ANSWER row (only on incorrect): correct definition in green.
     Returns a .uf-diff-wrap node. */
  function buildQuiz(chosenDef, correctDef, isCorrect) {
    const wrap = document.createElement('div');
    wrap.className = 'uf-diff-wrap';

    const yourWords = [{ cls: isCorrect ? 'uf-word-ok' : 'uf-word-err', text: chosenDef }];
    wrap.appendChild(_makeRow(AppLang.t('feedback_your_answer'), yourWords));

    if (!isCorrect) {
      wrap.appendChild(_makeRow(AppLang.t('feedback_correct_answer'), [{ cls: 'uf-word-ok', text: correctDef }]));
    }

    return wrap;
  }

  /* Alternative chips: shown after a correct answer when there are typed alternatives.
     alts    — array of form objects from target[]; non-style forms have audioSlug + optional labels
     t       — AppLang.t bound function
     basePhraseIfAlt — non-null string when user answered with an alternative (not the base);
                       causes an extra chip showing the base phrase.
     Returns a DocumentFragment or null if there is nothing to show. */
  function buildAltNote(alts, t, basePhraseIfAlt) {
    // Priority by primary label dimension (from the registry; lower = shown first).
    const _prio = (k) => { const D = _dims(); return D ? D.priority(k) : ({ loanword: 0, region: 1, gender: 2, number: 3, register: 4 }[k] ?? 99); };

    function _altPriority(alt) {
      const labs = alt.labels || {};
      const keys = Object.keys(labs);
      if (!keys.length) return 99;
      return Math.min(...keys.map(k => _prio(k)));
    }

    const typed = (alts || [])
      .filter(a => a.audioSlug !== undefined)
      .sort((a, b) => _altPriority(a) - _altPriority(b));

    if (typed.length === 0 && !basePhraseIfAlt) return null;

    const frag = document.createDocumentFragment();

    /* makeChip: phraseTexts is an array of strings (or a single string for basePhraseIfAlt). */
    function makeChip(labelText, phraseTexts, extraClass) {
      const texts = Array.isArray(phraseTexts) ? phraseTexts : [phraseTexts];
      const chip = document.createElement('span');
      chip.className = 'alt-chip' + (extraClass ? ' ' + extraClass : '');

      if (labelText) {
        const lbl = document.createElement('span');
        lbl.className = 'alt-chip-label';
        lbl.textContent = labelText;
        chip.appendChild(lbl);
      }

      for (const phraseText of texts) {
        const txt = document.createElement('span');
        txt.className = 'alt-chip-text';
        txt.textContent = phraseText;
        chip.appendChild(txt);
      }

      return chip;
    }

    // COMBINED label across ALL dimensions a form carries (gender · region · register ·
    // loanword), so every variant/combination is shown distinctly — a form that is both
    // feminine AND from Spain reads "Femenino · España", never collapsed to just one axis.
    // COMBINED label across ALL dimensions the form carries, in registry order — so a form that is
    // both feminine AND from Spain reads "España · Femenino", a plural feminine "Femenino · Plural",
    // and any FUTURE dimension appears automatically. Gender/region/number read in their own value
    // (target-language metadata); register/loanword use the localized UI strings.
    function labelFor(alt) {
      const labs = alt.labels || {};
      const parts = [];
      for (const dim of _dimOrder()) {
        const v = labs[dim];
        if (v === undefined || v === '') continue;
        if (dim === 'register') parts.push(v === 'formal' ? t('alt_note_register_f') : t('alt_note_register_i'));
        else if (dim === 'loanword') parts.push(t('alt_note_loanword'));
        else if (dim === 'synonym') parts.push(t('alt_note_synonym'));
        else parts.push(_capitalize(v));   // gender, region, number, + any future axis
      }
      return parts.join(' · ');  // '' for an unlabeled form → chip shows text only
    }

    /* One chip per DISTINCT combined label, so all combinations appear (no cross-dimension
       merge). Forms with an identical full label collapse into one chip (true duplicates). */
    const groupMap = new Map(); // labelText → texts[]
    for (const alt of typed) {
      const label = labelFor(alt);
      if (!groupMap.has(label)) groupMap.set(label, []);
      if (!groupMap.get(label).includes(alt.text)) groupMap.get(label).push(alt.text);
    }
    for (const [labelText, texts] of groupMap) {
      frag.appendChild(makeChip(labelText, texts));
    }

    if (basePhraseIfAlt) {
      frag.appendChild(makeChip(t('alt_note_base_shown'), basePhraseIfAlt, 'alt-chip--base'));
    }

    return frag;
  }

  /**
   * Show/refresh a small badge stating the grammatical gender of the form
   * currently displayed (multi-gender target languages: es, sl, ...). Driven
   * purely by form.labels.gender — no branching by language code, so any
   * future gendered target works automatically. Removes the badge when the
   * active form carries no gender label.
   */
  const _capitalize = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);

  // Adaptive variant badge(s): shows which VARIANT the learner is currently seeing —
  // gender (♀/♂/Neutro) and/or region (flag + name). Both live in a top-left flex wrap so
  // they coexist. Driven purely by the picked form's labels — no branching by language, so
  // any gendered/regional target works. Removes itself when the form carries no variant label.
  // The variant-dimension registry (shared/js/variant-dimensions.js) drives which axes exist, their
  // order, and each one's badge style — so gender, region, register, number, and ANY future
  // dimension render with no change here. Falls back to a fixed order if the registry isn't loaded.
  const _dims = () => (typeof AppVariantDims !== 'undefined') ? AppVariantDims : null;
  const _dimOrder = () => { const D = _dims(); return D ? D.ordered() : ['loanword', 'region', 'gender', 'number', 'register']; };
  const _dimBadge = (d) => { const D = _dims(); return D ? D.badge(d) : (d === 'gender' ? 'gender' : d === 'region' ? 'flag' : 'pill'); };

  // A variant tag is METALANGUAGE (Formal, Feminine, Nominative…), so it is shown in the learner's
  // SOURCE language (via AppLang), and EVERY axis carries a small icon (like gender's ♀/♂), not just
  // gender. Region keeps its flag + the region name (a proper noun). Any future/unknown axis falls
  // back to the capitalized raw value.
  const _VAL_KEY = {
    gender:   { femenino: 'alt_note_gender_f', masculino: 'alt_note_gender_m', neutro: 'alt_note_gender_n' },
    register: { formal: 'alt_note_register_f', informal: 'alt_note_register_i' },
    number:   { singular: 'alt_note_number_s', plural: 'alt_note_number_p' },
    case:     { nominativ: 'alt_note_case_nom', akkusativ: 'alt_note_case_akk', dativ: 'alt_note_case_dat', genitiv: 'alt_note_case_gen',
                nominatiivi: 'alt_note_case_nom', partitiivi: 'alt_note_case_part', genetiivi: 'alt_note_case_gen',
                inessiivi: 'alt_note_case_iness', elatiivi: 'alt_note_case_elat', illatiivi: 'alt_note_case_illat' },
  };
  const _DIM_KEY = { loanword: 'alt_note_loanword', synonym: 'alt_note_synonym' };

  // Inline-SVG ICONS (never emoji): crisp, theme-aware (currentColor), one per dimension — or per
  // value where the axis is a two/three-way choice (gender, register). A NEW dimension that wants an
  // icon adds an entry here keyed by its registry id; without one the tag simply shows text only, so
  // the registry stays open. viewBox 0 0 16 16, sized to the pill's font via .variant-ico (CSS).
  // `color` tints the whole glyph (stroke + any currentColor fill) with a semantic hue that reads on
  // both light and dark badge grounds; omit it to inherit the muted text color.
  const _svg = (inner, color) =>
    '<svg class="variant-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' +
    (color ? ' style="color:' + color + '"' : '') + '>' +
    inner + '</svg>';
  // Geometry note: every glyph's visual bounding box is centered on y≈8 (roughly y3–y13) so the icon
  // sits vertically centered beside the label — a top-heavy glyph (e.g. a hat drawn high) reads as
  // "floating". Keep new icons balanced the same way.
  const _ICON = {
    gender: {
      femenino:  _svg('<circle cx="8" cy="5.8" r="3"/><path d="M8 8.8V13.5M5.8 11.4h4.4"/>', '#DB2777'),
      masculino: _svg('<circle cx="7" cy="9.2" r="3"/><path d="M9.1 7.1 12.5 3.7M9.8 3.5H13V6.7"/>', '#2563EB'),
      neutro:    _svg('<circle cx="8" cy="6.5" r="3"/><path d="M8 9.5V13.5"/>', '#7C3AED'),
    },
    register: {
      formal:   _svg('<path d="M5 11V6C5 5.4 5.5 5 6 5h4c.5 0 1 .4 1 1v5"/><path d="M2.7 11.3h10.6M5 9h6"/>', '#4F46E5'),
      informal: _svg('<rect x="2.5" y="3.5" width="11" height="7" rx="2"/><path d="M6 10.5 5.2 13 8.4 10.5"/>', '#0D9488'),
    },
    number:   _svg('<path d="M6 3.2 5 12.8M11 3.2 10 12.8M3.2 6.4h9.6M2.7 9.6h9.6"/>', '#D97706'),
    case:     _svg('<circle cx="8" cy="8" r="5.3"/><circle cx="8" cy="8" r="2.7"/><circle cx="8" cy="8" r="0.7" fill="currentColor" stroke="none"/>', '#2563EB'),
    loanword: _svg('<circle cx="8" cy="8" r="5.3"/><path d="M2.7 8h10.6M8 2.7c2 1.9 2 8.7 0 10.6M8 2.7c-2 1.9-2 8.7 0 10.6"/>', '#059669'),
    synonym:  _svg('<path d="M4 6.6A4 4 0 0 1 11.4 5"/><path d="M11 2.4 11.6 5.3 8.7 4.9"/><path d="M12 9.4A4 4 0 0 1 4.6 11"/><path d="M5 13.6 4.4 10.7 7.3 11.1"/>', '#7C3AED'),
  };
  function _iconMarkup(dim, val) {
    const e = _ICON[dim];
    return (e && typeof e === 'object' && !e.length) ? (e[val] || null) : (e || null);
  }
  /** The tag's TEXT only (source-language metalanguage), no icon. */
  function _variantLabelText(dim, val) {
    const t = (typeof AppLang !== 'undefined') ? AppLang.t.bind(AppLang) : (k => k);
    if (_VAL_KEY[dim] && _VAL_KEY[dim][val]) return t(_VAL_KEY[dim][val]);
    if (_DIM_KEY[dim]) return t(_DIM_KEY[dim]);
    return _capitalize(val);
  }
  /** Fill a badge element with [icon] + [label], the icon an inline SVG (never emoji). */
  function _fillVariantBadge(el, dim, val) {
    el.textContent = '';
    const mk = _iconMarkup(dim, val);
    if (mk) { const ico = document.createElement('span'); ico.innerHTML = mk; el.appendChild(ico.firstChild); }
    const lbl = document.createElement('span');
    lbl.textContent = _variantLabelText(dim, val);
    el.appendChild(lbl);
  }

  function applyVariantBadge(containerId, form) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let wrap = container.querySelector('.variant-badges');
    const labels = (form && form.labels) || {};
    // Every registered dimension present on this form, in registry (priority) order.
    const present = _dimOrder().filter(d => labels[d] !== undefined && labels[d] !== '');
    if (present.length === 0) {
      if (wrap) wrap.remove();
      container.classList.remove('has-variant-badge');   // release the reserved top space
      return;
    }
    container.classList.add('has-variant-badge');         // reserve room so the badge never crowds the text
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'variant-badges';
      container.style.position = 'relative';
      container.appendChild(wrap);
    }
    wrap.textContent = '';

    for (const dim of present) {
      const val = labels[dim];
      const style = _dimBadge(dim);
      const b = document.createElement('span');
      if (style === 'flag') {
        // Region: SVG flag / cluster / zone globe (never emoji) + region name.
        b.className = 'region-phrase-badge';
        if (typeof AppFlags !== 'undefined' && AppFlags.region) {
          const flag = AppFlags.region(val);
          if (flag) b.appendChild(flag);
        }
        const txt = document.createElement('span');
        txt.textContent = _capitalize(val);   // region name (proper noun) beside the flag
        b.appendChild(txt);
      } else if (style === 'gender') {
        b.className = 'gender-phrase-badge';
        _fillVariantBadge(b, dim, val);   // SVG gender icon + source-language term
      } else {
        // 'pill' | 'text' — register, number, case, loanword, synonym, or any future axis: each gets
        // its inline-SVG icon + the source-language label.
        b.className = 'variant-phrase-badge variant-phrase-badge--' + dim;
        _fillVariantBadge(b, dim, val);
      }
      wrap.appendChild(b);
    }
  }

  /* Recognition strip for a VOCAB word's structured variants[]: one chip per variant, each with
     its combined label (region flag / gender pill / generic pill, registry-driven) + the variant
     text. Used on the flashcard back so the learner MEETS every variant ("also: patata 🇪🇸",
     "niña ♀") without them competing as production targets — the interference-safe presentation
     (Tinkham/Waring/Webb). Returns a DocumentFragment, or null when there is nothing to show. */
  // Which KIND a variant belongs to, for grouping: 'inflectional' if it carries ANY inflectional-axis
  // label (gender/number/case — forms of the SAME word), else 'lexical' (region/register/loanword/
  // synonym — a DIFFERENT word for the same meaning). Registry-driven, so a future axis groups itself.
  function _variantKind(labs) {
    const D = _dims();
    for (const k of Object.keys(labs || {})) {
      if (labs[k] === undefined || labs[k] === '') continue;
      if (D && D.kind(k) === 'inflectional') return 'inflectional';
    }
    return 'lexical';
  }

  // One variant as a ROW of a bordered table: [FORM, prominent] ......... [its label(s), muted + icon].
  // The rows stack inside a boxed .variant-table (dividers between), like a textbook declension table.
  function _variantRow(v) {
    const labs = (v && v.labels) || {};
    const row = document.createElement('div');
    row.className = 'variant-row';
    const form = document.createElement('span');
    form.className = 'variant-form';
    form.textContent = _capitalize((v && v.text) || '');
    const meta = document.createElement('span');
    meta.className = 'variant-meta';
    for (const dim of _dimOrder()) {
      const val = labs[dim];
      if (val === undefined || val === '') continue;
      const item = document.createElement('span');
      item.className = 'variant-meta-item';
      if (_dimBadge(dim) === 'flag') {
        if (typeof AppFlags !== 'undefined' && AppFlags.region) { const fl = AppFlags.region(val); if (fl) item.appendChild(fl); }
        const tx = document.createElement('span'); tx.textContent = _capitalize(val); item.appendChild(tx);
      } else {
        const mk = _iconMarkup(dim, val);
        if (mk) { const ico = document.createElement('span'); ico.innerHTML = mk; item.appendChild(ico.firstChild); }
        const tx = document.createElement('span'); tx.textContent = _variantLabelText(dim, val); item.appendChild(tx);
      }
      meta.appendChild(item);
    }
    row.appendChild(form);
    row.appendChild(meta);
    return row;
  }

  function buildWordVariants(variants, currentText, t) {
    if (!Array.isArray(variants) || variants.length === 0) return null;
    const shown = variants.filter(v => !(currentText && v && v.text === currentText));
    if (shown.length === 0) return null;
    const tt = (typeof t === 'function') ? t : (k => k);
    const frag = document.createDocumentFragment();

    // GROUP by kind with a caption (grammatical FORMS of one word vs ALTERNATIVE WORDS), each group a
    // bordered table of form|label rows — so the learner sees the whole paradigm at a glance.
    function group(items, labelKey) {
      if (!items.length) return;
      const g = document.createElement('div');
      g.className = 'alt-group';
      const lbl = document.createElement('div');
      lbl.className = 'alt-group-label';
      lbl.textContent = tt(labelKey);
      g.appendChild(lbl);
      const tbl = document.createElement('div');
      tbl.className = 'variant-table';
      items.forEach(v => tbl.appendChild(_variantRow(v)));
      g.appendChild(tbl);
      frag.appendChild(g);
    }
    group(shown.filter(v => _variantKind(v && v.labels) === 'inflectional'), 'var_group_forms');
    group(shown.filter(v => _variantKind(v && v.labels) !== 'inflectional'), 'var_group_alt');
    return frag;
  }

  return { buildDiff, buildCorrect, buildCloze, buildQuiz, buildAltNote, applyVariantBadge, buildWordVariants };
})();
