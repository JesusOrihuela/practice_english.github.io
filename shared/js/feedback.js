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
    wrap.appendChild(_makeRow('Your Answer', yourWords));
    wrap.appendChild(_makeRow('Correct Answer', expWords));
    return wrap;
  }

  /* Correct: YOUR ANSWER row only, all words green.
     Returns a .uf-diff-wrap DOM node. */
  function buildCorrect(correctText) {
    const words = correctText.trim().split(/\s+/).filter(Boolean)
      .map(w => ({ cls: 'uf-word-ok', text: w }));

    const wrap = document.createElement('div');
    wrap.className = 'uf-diff-wrap';
    wrap.appendChild(_makeRow('Your Answer', words));
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
    wrap.appendChild(_makeRow('Your Answer', makeWords(userWord, isCorrect)));
    if (!isCorrect) {
      wrap.appendChild(_makeRow('Correct Answer', makeWords(correctWord, true)));
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
    wrap.appendChild(_makeRow('Your Answer', yourWords));

    if (!isCorrect) {
      wrap.appendChild(_makeRow('Correct Answer', [{ cls: 'uf-word-ok', text: correctDef }]));
    }

    return wrap;
  }

  return { buildDiff, buildCorrect, buildCloze, buildQuiz };
})();
