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

  /* Truncate a label to a max character count, breaking at word boundary */
  function truncate(s, max) {
    if (s.length <= max) return s;
    return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '\u2026';
  }

  function show({ items, cardIds, topicLabel, pickerEl, traductions, cefrLevels, onStart }) {
    const cards     = Progress.getAllCards();
    const total     = cardIds.length;
    const seenCount = cardIds.filter(id => { const c = cards[id]; return c && c.reps > 0; }).length;
    const isWordList = total > 0 && typeof items[0] === 'object';
    const pct = total > 0 ? Math.round((seenCount / total) * 100) : 0;

    /* Hide the picker, build our section */
    if (pickerEl) pickerEl.classList.add('hidden');

    const section = document.createElement('section');
    section.id = 'pb-section';
    section.className = 'pb-section';
    section.setAttribute('aria-label', topicLabel + ' — ' + (isWordList ? 'word list' : 'phrase list'));

    /* ── Top bar ── */
    const bar = document.createElement('div');
    bar.className = 'pb-bar';

    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '\u2190 Topics';
    backBtn.setAttribute('aria-label', 'Back to topic picker');

    const barMeta = document.createElement('div');
    barMeta.className = 'pb-bar-meta';

    const barTitle = document.createElement('span');
    barTitle.className = 'pb-bar-title';
    barTitle.textContent = topicLabel;

    const barCount = document.createElement('span');
    barCount.className = 'pb-bar-count';
    barCount.textContent = seenCount + '\u202f/\u202f' + total + ' practiced';

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
    track.setAttribute('aria-label', pct + '% of ' + topicLabel + ' practiced');
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
        mainText = item.word;
        subText  = item.category || null;
      } else {
        const raw = (traductions && traductions[i]) ? traductions[i] : item;
        mainText = truncate(raw, 42);
        subText  = null;
      }

      const chip = document.createElement('button');
      chip.className = 'pb-chip' + (seen ? ' pb-chip--seen' : '');
      chip.setAttribute('role', 'listitem');
      chip.setAttribute('aria-label', (isWordList ? 'Word' : 'Phrase') + ' ' + (i + 1) + ': ' + mainText + (seen ? ' (practiced)' : ''));

      const num = document.createElement('span');
      num.className = 'pb-chip-num';
      num.setAttribute('aria-hidden', 'true');
      num.textContent = i + 1;

      const dot = document.createElement('span');
      dot.className = 'pb-chip-dot';
      dot.setAttribute('aria-hidden', 'true');

      const text = document.createElement('span');
      text.className = 'pb-chip-text';
      text.textContent = mainText;

      chip.appendChild(num);
      chip.appendChild(dot);
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

      chip.addEventListener('click', () => { close(); window.scrollTo(0, 0); onStart(i); });
      grid.appendChild(chip);
    });

    /* ── CTA footer ── */
    const cta = document.createElement('div');
    cta.className = 'pb-cta';

    const startBtn = document.createElement('button');
    startBtn.className = 'pb-start-btn';
    startBtn.textContent = 'Start from beginning \u2192';
    cta.appendChild(startBtn);

    /* ── Assemble ── */
    section.appendChild(bar);
    section.appendChild(track);
    section.appendChild(grid);
    section.appendChild(cta);

    const main = document.querySelector('main');
    if (main) main.appendChild(section);
    else document.body.appendChild(section);

    backBtn.focus();

    function close() {
      section.remove();
      if (pickerEl) pickerEl.classList.remove('hidden');
    }

    backBtn.addEventListener('click', close);
    startBtn.addEventListener('click', () => { section.remove(); window.scrollTo(0, 0); onStart(0); });
  }

  return { show };
})();
