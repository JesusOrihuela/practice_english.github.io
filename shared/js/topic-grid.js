/* ============================================================
   topic-grid.js — Shared image-card topic picker
   Used by: speaking, dictation, cloze, translation, scramble,
            quiz, vocabulary
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
    const topicList    = topics        || AppTopics.PHRASE_TOPICS;
    const resolveSrsKey   = getSrsKey  || (t => srsPrefix + t.id);
    const resolveCount    = getItemCount || (t => AppData.get(t.id).then(data => data.phrases ? data.phrases.length : 0));

    const grid = document.getElementById('topic-grid');
    if (!grid) return;
    grid.className = 'img-topic-grid';
    grid.innerHTML = '';

    topicList.forEach((topic, i) => {
      const btn = document.createElement('button');
      btn.className = 'img-topic-card';
      btn.dataset.theme = topic.id;
      btn.style.animationDelay = (i * 0.06) + 's';
      // No aria-label: the button's accessible name is computed from its visible
      // children (title + progress counter + badge), which already describe the action.
      // An explicit aria-label would override and hide the progress text from screen readers.
      const imgSrc = '../img/' + topic.id + '.webp';
      btn.innerHTML =
        '<div class="img-topic-card__img-wrap">' +
          '<img class="img-topic-card__img" src="' + imgSrc + '" alt="" loading="lazy" width="800" height="450">' +
          '<div class="img-topic-card__overlay"></div>' +
        '</div>' +
        '<div class="img-topic-card__body">' +
          '<div class="img-topic-card__info">' +
            '<span class="img-topic-card__title">' + topic.label + '</span>' +
            '<span class="img-topic-card__progress" id="tp-' + topic.id + '"></span>' +
          '</div>' +
          '<span class="img-topic-card__badge">' + badge + '</span>' +
        '</div>';
      btn.addEventListener('click', () => onSelect(topic.id));
      grid.appendChild(btn);

      resolveCount(topic)
        .then(total => {
          const s = Progress.getTopicStats(resolveSrsKey(topic), total);
          const el = document.getElementById('tp-' + topic.id);
          if (el) el.textContent = s.seen + ' / ' + total + ' learned';
        })
        .catch(() => {});
    });
  }

  return { build };
})();
