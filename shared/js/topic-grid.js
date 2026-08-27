/* ============================================================
   topic-grid.js — Shared image-card topic picker
   Used by: speaking, dictation, cloze, translation, scramble,
            quiz, vocabulary

   Topic ordering (3A — guide + freedom):
     1. Topics the user has already started (any card with reps ≥ 1) — active first
     2. Topics not yet started — in original path order
   Within each group the original order is preserved.
   ============================================================ */

const AppTopicGrid = (() => {

  /**
   * Build (or rebuild) the image-card topic picker grid.
   * @param {Object}    opts
   * @param {string}    opts.badge            - Card badge label  (e.g. 'Fill-in')
   * @param {string}    opts.srsPrefix        - SRS key prefix   (e.g. 'cloze_'); ignored if getSrsKey is provided
   * @param {Function}  opts.onSelect         - Called with topicId when card is clicked
   * @param {Array}    [opts.topics]          - Topic list; defaults to AppTopics.PHRASE_TOPICS
   * @param {Function} [opts.getSrsKey]       - (topic) => srsKey; defaults to t => srsPrefix + t.id
   * @param {Function} [opts.getItemCount]    - (topic) => Promise<number>; defaults to AppData phrase count
   */
  function build({ badge, srsPrefix, onSelect, topics, getSrsKey, getItemCount }) {
    const topicList  = topics       || AppTopics.PHRASE_TOPICS;
    const resolveSrsKey  = getSrsKey || (t => srsPrefix + t.id);
    const resolveCount   = getItemCount || (t => AppData.get(t.id).then(data => data.phrases ? data.phrases.length : 0));

    const cards = Progress.getAllCards();

    const grid = document.getElementById('topic-grid');
    if (!grid) return;
    grid.className = 'img-topic-grid';
    grid.innerHTML = '';

    topicList.forEach((topic, i) => {
      const btn = document.createElement('button');
      btn.className = 'img-topic-card';
      btn.dataset.theme = topic.id;
      // Orchestrated-reveal stagger (only fires under .page-in, once the grid is fully built
      // and the cloak lifts — see generalities.css / page-title.js). Base 0.18s lets the
      // header (title 0s → subtitle 0.09s) land first; the per-card step is CAPPED at 12
      // cards (~0.6s max) so ~45 topics cascade in order without a long, piecemeal tail.
      btn.style.animationDelay = (0.18 + Math.min(i, 12) * 0.035).toFixed(3) + 's';
      const imgSrc = '../img/' + topic.id + '.webp';
      btn.innerHTML =
        '<div class="img-topic-card__img-wrap">' +
          '<img class="img-topic-card__img" src="' + imgSrc + '" alt="" loading="lazy" onerror="this.remove()" width="800" height="450">' +
          '<div class="img-topic-card__overlay"></div>' +
        '</div>' +
        '<div class="img-topic-card__body">' +
          '<span class="img-topic-card__title">' + ((typeof AppTopics !== 'undefined') ? AppTopics.getLabel(topic) : topic.label) + '</span>' +
          '<span class="img-topic-card__progress" id="tp-' + topic.id + '"></span>' +
        '</div>';
      btn.addEventListener('click', () => onSelect(topic.id));
      grid.appendChild(btn);

      resolveCount(topic)
        .then(total => {
          const keyPrefix = resolveSrsKey(topic) + '_';
          const seen = Object.keys(cards).filter(k => k.startsWith(keyPrefix) && cards[k].reps > 0).length;
          const el = document.getElementById('tp-' + topic.id);
          if (el) el.textContent = AppLang.t('topic_learned', { seen, total });
        })
        .catch(() => {});
    });

    // Cards are in the DOM now — reveal the page (see page-title.js). On picker pages this
    // is what lifts the cloak, so header + grid appear together instead of the subtitle
    // showing alone above an empty grid while this async build was pending.
    if (typeof window !== 'undefined' && typeof window.__revealPage === 'function') window.__revealPage();
  }

  /**
   * Fill #topic-grid with placeholder skeleton cards so the picker never shows an
   * empty gap under its title/subtitle while topics.json loads. build() clears these.
   * @param {number} [n=12] - how many placeholders (enough to fill the visible area).
   */
  function skeleton(n) {
    const grid = document.getElementById('topic-grid');
    if (!grid || grid.children.length) return;   // don't overwrite a built grid
    grid.className = 'img-topic-grid';
    let html = '';
    for (let i = 0; i < (n || 12); i++) {
      html +=
        '<div class="img-topic-card img-topic-card--skeleton" aria-hidden="true">' +
          '<div class="img-topic-card__img-wrap sk-shimmer"></div>' +
          '<div class="img-topic-card__body">' +
            '<span class="sk-line sk-shimmer" style="width:70%"></span>' +
            '<span class="sk-line sk-shimmer" style="width:40%;height:9px"></span>' +
          '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
  }

  // Auto-render skeletons as soon as the DOM is ready (before the activity's async
  // AppTopics.load() + build() resolve), for every activity that has a #topic-grid.
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => skeleton());
  }

  return { build, skeleton };
})();
