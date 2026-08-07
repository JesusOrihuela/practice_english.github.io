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
    // Priority by primary label dimension (lower = shown first)
    const PRIORITY = { loanword: 0, region: 1, gender: 2, register: 3 };

    function _altPriority(alt) {
      const labs = alt.labels || {};
      const keys = Object.keys(labs);
      if (!keys.length) return 99;
      return Math.min(...keys.map(k => PRIORITY[k] ?? 99));
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

    function labelFor(alt) {
      const labs = alt.labels || {};
      if (labs.gender !== undefined) {
        if (labs.gender === 'masculino' || labs.gender === 'masculine') return t('alt_note_gender_m');
        if (labs.gender === 'femenino' || labs.gender === 'feminine')   return t('alt_note_gender_f');
        return t('alt_note_gender_n');
      }
      if (labs.region !== undefined) return t('alt_note_regional').replace('{region}', labs.region || '');
      if (labs.loanword !== undefined) return t('alt_note_loanword');
      if (labs.register !== undefined) {
        return labs.register === 'formal' ? t('alt_note_register_f') : t('alt_note_register_i');
      }
      return '';  // unlabeled form — chip shows text only
    }

    /* Group by label so forms sharing the same label appear as one chip. */
    const groupMap = new Map(); // labelText → texts[]
    for (const alt of typed) {
      const label = labelFor(alt);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label).push(alt.text);
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
  function applyVariantBadge(containerId, form) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let badge = container.querySelector('.gender-phrase-badge');
    const gender = form && form.labels && form.labels.gender;
    if (!gender) { if (badge) badge.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'gender-phrase-badge';
      container.style.position = 'relative';
      container.appendChild(badge);
    }
    const key = gender === 'masculino' ? 'alt_note_gender_m'
              : gender === 'femenino'  ? 'alt_note_gender_f'
              : gender === 'neutro'    ? 'alt_note_gender_n' : null;
    const label = key ? t(key) : (gender.charAt(0).toUpperCase() + gender.slice(1));
    const sym = gender === 'femenino' ? '♀ ' : gender === 'masculino' ? '♂ ' : '';
    badge.textContent = sym + label;
  }

  return { buildDiff, buildCorrect, buildCloze, buildQuiz, buildAltNote, applyVariantBadge };
})();
