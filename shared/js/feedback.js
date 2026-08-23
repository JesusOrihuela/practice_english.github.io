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
        txt.textContent = _capitalize(val);   // "aguacate" → "Aguacate"
        b.appendChild(txt);
      } else if (style === 'gender') {
        b.className = 'gender-phrase-badge';
        const sym = val === 'femenino' ? '♀ ' : val === 'masculino' ? '♂ ' : '';
        b.textContent = sym + _capitalize(val);   // target-language gender term
      } else {
        // 'pill' | 'text' — number (Singular/Plural), register (Formal/Informal), or any future axis.
        b.className = 'variant-phrase-badge variant-phrase-badge--' + dim;
        b.textContent = _capitalize(val);
      }
      wrap.appendChild(b);
    }
  }

  return { buildDiff, buildCorrect, buildCloze, buildQuiz, buildAltNote, applyVariantBadge };
})();
