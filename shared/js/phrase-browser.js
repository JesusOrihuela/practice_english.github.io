/* shared/js/phrase-browser.js
   Renders a phrase/word list as a third screen inside <main>,
   sitting alongside #topic-picker and #exercise-area.
   Header, nav and footer remain fully visible.

   PhraseBrowser.show({ items, cardIds, topicLabel, pickerEl, traductions, onStart })
     items      — string[] (phrases) or {word, category}[] (vocab)
     cardIds    — parallel SRS card ID array
     topicLabel — heading text
     pickerEl   — the picker DOM element to hide while browser is open
     traductions — optional string[] of Spanish translations used as labels (same length as items)
     onStart(i) — called with chosen index when user picks or taps "Start"
*/

const PhraseBrowser = (() => {

  function show({ items, cardIds, topicLabel, pickerEl, traductions, cefrLevels, forms, onStart }) {
    const cards     = Progress.getAllCards();
    const total     = cardIds.length;
    const seenCount = cardIds.filter(id => { const c = cards[id]; return c && c.reps > 0; }).length;
    const isWordList = total > 0 && typeof items[0] === 'object';
    const pct = total > 0 ? Math.round((seenCount / total) * 100) : 0;

    /* Reset scroll before any DOM change so focus() below lands in-view */
    window.scrollTo(0, 0);

    /* Hide the picker, build our section */
    if (pickerEl) pickerEl.classList.add('hidden');

    const section = document.createElement('section');
    section.id = 'pb-section';
    section.className = 'pb-section';
    section.setAttribute('aria-label', topicLabel + ' — ' + AppLang.t(isWordList ? 'pb_word' : 'pb_phrase'));

    /* ── Top bar ── */
    const bar = document.createElement('div');
    bar.className = 'pb-bar';

    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = AppLang.t('back_to_topics');
    backBtn.setAttribute('aria-label', AppLang.t('back_to_topics'));

    const barMeta = document.createElement('div');
    barMeta.className = 'pb-bar-meta';

    const barTitle = document.createElement('span');
    barTitle.className = 'pb-bar-title';
    barTitle.textContent = topicLabel;

    const barCount = document.createElement('span');
    barCount.className = 'pb-bar-count';
    barCount.textContent = AppLang.t('topic_learned', { seen: seenCount, total });

    barMeta.appendChild(barTitle);
    barMeta.appendChild(barCount);
    bar.appendChild(backBtn);
    bar.appendChild(barMeta);

    /* ── Progress track ── */
    const track = document.createElement('div');
    track.className = 'pb-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuenow', seenCount);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', total);
    track.setAttribute('aria-label', AppLang.t('pb_pct_learned', { pct: pct, topic: topicLabel }));
    const fill = document.createElement('div');
    fill.className = 'pb-track-fill';
    fill.style.width = pct + '%';
    track.appendChild(fill);

    /* ── Grid ── */
    const grid = document.createElement('div');
    grid.className = 'pb-grid';
    grid.setAttribute('role', 'list');

    items.forEach((item, i) => {
      const seen = !!(cards[cardIds[i]] && cards[cardIds[i]].reps > 0);
      let mainText, subText;
      if (isWordList) {
        const _raw = (traductions && traductions[i]) ? traductions[i] : (item.term || item.word);
        // Capitalize the first letter of EVERY slash-separated form ("carta / letra" → "Carta / Letra").
        mainText = _raw ? _raw.replace(/(^|\/\s*)(\p{L})/gu, (m, p, c) => p + c.toUpperCase()) : _raw;
        const _POS = { Noun: 'pos_noun', Verb: 'pos_verb', Adjective: 'pos_adjective', Adverb: 'pos_adverb' };
        subText  = item.category
          ? (typeof AppLang !== 'undefined' ? AppLang.t(_POS[item.category] || item.category) : item.category)
          : null;
      } else {
        // No JS truncation — the CSS ellipsis on .pb-chip-text cuts the label
        // exactly where the chip actually runs out of width at each viewport.
        mainText = (traductions && traductions[i]) ? traductions[i] : item;
        subText  = null;
      }

      const chip = document.createElement('button');
      chip.className = 'pb-chip' + (seen ? ' pb-chip--seen' : '');
      chip.title = mainText;
      chip.setAttribute('role', 'listitem');
      chip.setAttribute('aria-label', AppLang.t(isWordList ? 'pb_word' : 'pb_phrase') + ' ' + (i + 1) + ': ' + mainText + (seen ? ' ' + AppLang.t('pb_learned') : ''));

      const num = document.createElement('span');
      num.className = 'pb-chip-num';
      num.setAttribute('aria-hidden', 'true');
      num.textContent = i + 1;

      const text = document.createElement('span');
      text.className = 'pb-chip-text';
      text.textContent = mainText;

      chip.appendChild(num);
      chip.appendChild(text);

      if (subText) {
        const sub = document.createElement('span');
        sub.className = 'pb-chip-sub';
        sub.setAttribute('aria-hidden', 'true');
        sub.textContent = subText;
        chip.appendChild(sub);
      }

      if (cefrLevels && cefrLevels[i]) {
        const lvl = cefrLevels[i];
        const badge = document.createElement('span');
        badge.className = 'pb-chip-cefr cefr-badge cefr-badge--' + lvl.toLowerCase();
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = lvl;
        chip.appendChild(badge);
      }

      // Hidden-variant tag — a LEXICAL variant dimension the chip text doesn't reveal (gender rides
      // in the source slash; register/loanword don't). Registry-driven: any future lexical dim shows
      // automatically. It sits on the L1 (source) side, so it signals e.g. "this phrase has a
      // formal AND informal version" WITHOUT spoiling the target. Synonym is skipped (a
      // "sinónimo/sinónimo" tag carries no information).
      const _fset = (forms && forms[i]) || [];
      if (!isWordList && _fset.length > 1) {
        const D = (typeof AppVariantDims !== 'undefined') ? AppVariantDims : null;
        const _lex = new Set();
        _fset.forEach(f => Object.keys((f && f.labels) || {}).forEach(k => {
          const kind = D ? D.kind(k) : (k === 'gender' || k === 'number' ? 'inflectional' : 'lexical');
          if (kind === 'lexical' && k !== 'synonym') _lex.add(k);
        }));
        _lex.forEach(dim => {
          // Compact per-dimension label — never the joined values (region names run long and would
          // blow out the chip). Register shows its two poles (Formal/Informal); the rest a short tag.
          let label;
          if (dim === 'register') label = AppLang.t('alt_note_register_f') + '/' + AppLang.t('alt_note_register_i');
          else if (dim === 'region') label = AppLang.t('pb_tag_region');
          else if (dim === 'loanword') label = AppLang.t('pb_tag_loanword');
          else label = dim;
          if (!label) return;
          const tag = document.createElement('span');
          tag.className = 'pb-chip-tag pb-chip-tag--' + dim;
          tag.setAttribute('aria-hidden', 'true');   // read via the chip's aria-label instead
          tag.textContent = label;
          chip.appendChild(tag);
          chip.setAttribute('aria-label', chip.getAttribute('aria-label') + ' · ' + label);
        });
      }

      // Coverage indicator — one pip per form, filled = practiced. A single-form
      // phrase shows one pip (practiced-or-not); a multi-form phrase shows N pips
      // (gender/region/register coverage). One consistent indicator — no separate
      // "seen" dot of a different size to disambiguate.
      const _pool  = (forms && forms[i]) ? forms[i].filter(f => f && f.audioSlug) : [];
      const _total = Math.max(_pool.length, 1);
      let _done;
      if (_pool.length > 1 && typeof Progress !== 'undefined' && Progress.getVariantCoverage) {
        _done = Progress.getVariantCoverage(cardIds[i], _pool.map(f => f.audioSlug)).practiced;
      } else {
        _done = seen ? _total : 0;   // single-form (or word list): reflect seen state
      }
      const cov = document.createElement('span');
      cov.className = 'pb-chip-cov';
      cov.setAttribute('role', 'img');
      cov.setAttribute('aria-label', _total > 1
        ? AppLang.t('pb_variants', { done: _done, total: _total })
        : (seen ? AppLang.t('pb_learned') : AppLang.t('pb_not_practiced')));
      for (let k = 0; k < _total; k++) {
        const pip = document.createElement('span');
        pip.className = 'pb-cov-pip' + (k < _done ? ' pb-cov-pip--done' : '');
        cov.appendChild(pip);
      }
      chip.appendChild(cov);

      chip.addEventListener('click', () => { close(); window.scrollTo(0, 0); onStart(i); });
      grid.appendChild(chip);
    });

    /* ── Assemble ── */
    section.appendChild(bar);
    section.appendChild(track);
    section.appendChild(grid);

    const main = document.querySelector('main');
    if (main) main.appendChild(section);
    else document.body.appendChild(section);

    backBtn.focus({ preventScroll: true });

    function close() {
      section.remove();
      if (pickerEl) pickerEl.classList.remove('hidden');
    }

    backBtn.addEventListener('click', close);
  }

  return { show };
})();
