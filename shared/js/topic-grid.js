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
      btn.style.animationDelay = (i * 0.06) + 's';
      const imgSrc = '../img/' + topic.id + '.webp';
      btn.innerHTML =
        '<div class="img-topic-card__img-wrap">' +
          '<img class="img-topic-card__img" src="' + imgSrc + '" alt="" loading="lazy" width="800" height="450">' +
          '<div class="img-topic-card__overlay"></div>' +
        '</div>' +
        '<div class="img-topic-card__body">' +
          '<span class="img-topic-card__title">' + topic.label + '</span>' +
          '<span class="img-topic-card__progress" id="tp-' + topic.id + '"></span>' +
        '</div>';
      btn.addEventListener('click', () => onSelect(topic.id));
      grid.appendChild(btn);

      resolveCount(topic)
        .then(total => {
          const keyPrefix = resolveSrsKey(topic) + '_';
          const seen = Object.keys(cards).filter(k => k.startsWith(keyPrefix) && cards[k].reps > 0).length;
          const el = document.getElementById('tp-' + topic.id);
          if (el) el.textContent = typeof AppLang !== 'undefined'
            ? AppLang.t('topic_learned', { seen, total })
            : seen + ' / ' + total + ' Aprendidas';
        })
        .catch(() => {});
    });
  }

  return { build };
})();
