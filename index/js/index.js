document.addEventListener('DOMContentLoaded', async function () {

  /* ── Hero image skew effect ── */
  const image = document.getElementById('skewingImage');
  if (image) {
    image.addEventListener('mousemove', function (e) {
      const rect    = image.getBoundingClientRect();
      const x       = e.clientX - rect.left;
      const y       = e.clientY - rect.top;
      const centerX = rect.width  / 2;
      const centerY = rect.height / 2;
      const skewX   = (x - centerX) / 150;
      const skewY   = (y - centerY) / 150;
      image.style.transform = `skew(${skewX}deg, ${skewY}deg)`;
    });
    image.addEventListener('mouseleave', function () {
      image.style.transform = 'skew(0deg, 0deg)';
    });
  }

  /* ── Learning Path ── */
  if (typeof AppPath === 'undefined' || typeof Progress === 'undefined') return;

  const grammarData = await fetch('shared/json/grammar-rules.json').then(r => r.json()).catch(() => ({ rules: [] }));
  AppPath.setGrammarRules(grammarData.rules || []);

  _renderSessionCta();
  _renderSessionTrail();
});

/* ═══════════════════════════════════════════════
   ZONE 1 — Daily session CTA card
   ═══════════════════════════════════════════════ */

function _ctaSubtitle(summary) {
  var parts = [];
  if (summary.reviewCount > 0) parts.push(summary.reviewCount + ' to review');
  if (summary.newCount > 0)    parts.push(summary.newCount + ' new exercise' + (summary.newCount !== 1 ? 's' : ''));
  if (summary.estimatedMinutes) parts.push('~' + summary.estimatedMinutes + ' min');
  if (summary.skippedReviews > 0) parts.push('+' + summary.skippedReviews + ' deferred');
  return parts.join(' · ');
}

function _renderSessionCta() {
  const el = document.getElementById('path-session-cta');
  if (!el || typeof PathSession === 'undefined') return;

  const active  = PathSession.isActive();
  const session = PathSession.getSession();
  const summary = PathSession.getTodaySummary();

  if (active) {
    const prog    = PathSession.getProgress();
    const item    = PathSession.getCurrentItem();
    const href    = item ? item.href : null;
    const remMins = PathSession.getRemainingMinutes();
    const pct     = Math.round(((prog.current - 1) / prog.total) * 100);
    el.innerHTML =
      '<div class="path-cta__bar"><div class="path-cta__bar-fill" style="width:' + Math.max(pct, 5) + '%"></div></div>' +
      '<div class="path-cta__row">' +
        '<div class="path-cta__body">' +
          '<div class="path-cta__title">Keep it up! 💪</div>' +
          '<div class="path-cta__sub">Exercise ' + prog.current + ' of ' + prog.total + (remMins ? ' · ~' + remMins + ' min left' : '') + '</div>' +
        '</div>' +
        (href
          ? '<a href="my-learning/html/my-learning.html" class="path-cta__btn">Continue →</a>'
          : '<span class="path-cta__done">✓ Done</span>') +
      '</div>';
    return;
  }

  if (session && session.started && session.position >= session.queue.length) {
    el.innerHTML =
      '<div class="path-cta__row">' +
        '<div class="path-cta__body">' +
          '<div class="path-cta__title">🎉 Great work today!</div>' +
          '<div class="path-cta__sub">Come back tomorrow to keep your streak going</div>' +
        '</div>' +
      '</div>';
    return;
  }

  if (!summary.hasAnything) {
    el.innerHTML =
      '<div class="path-cta__row">' +
        '<div class="path-cta__body">' +
          '<div class="path-cta__title">✓ You\'re all caught up!</div>' +
          '<div class="path-cta__sub">Come back tomorrow for new exercises</div>' +
        '</div>' +
      '</div>';
    return;
  }

  el.innerHTML =
    '<div class="path-cta__row">' +
      '<div class="path-cta__body">' +
        '<div class="path-cta__title">Ready for today\'s session?</div>' +
        '<div class="path-cta__sub">' + _ctaSubtitle(summary) + '</div>' +
      '</div>' +
      '<a href="my-learning/html/my-learning.html" class="path-cta__btn">Start →</a>' +
    '</div>';
}

/* ═══════════════════════════════════════════════
   ZONE 2 — Duolingo-style session trail
   ═══════════════════════════════════════════════ */

const _ACT_EMOJI = {
  speaking: '🎙️', grammar: '📐', vocabulary: '📚', quiz: '🧠',
  cloze: '🔤', dictation: '✍️', translation: '🔄', scramble: '🧩',
};
const _ACT_LABEL = {
  speaking: 'Speaking', grammar: 'Grammar', vocabulary: 'Vocab', quiz: 'Quiz',
  cloze: 'Fill-in', dictation: 'Dictation', translation: 'Translate', scramble: 'Scramble',
};
const _TOPIC_LABEL = {
  greetings: '👋 Greetings', restaurant: '🍽️ Restaurant', supermarket: '🛒 Supermarket',
  kitchen: '🍳 Kitchen', traveling: '✈️ Traveling', entertainment: '🎬 Entertainment',
  gym: '💪 Gym', technology: '💻 Technology', accountability: '📋 Accountability',
};

function _renderSessionTrail() {
  const container = document.getElementById('path-nodes');
  if (!container || typeof PathSession === 'undefined') return;

  // Rebuild if not yet started — ensures reviews due since last build are included
  let session = PathSession.getSession();
  if (!session || !session.started) {
    const summary = PathSession.getTodaySummary();
    if (summary.hasAnything) session = PathSession.buildAndSave();
  }

  container.innerHTML = '';

  if (session && session.queue.length > 0) {
    _buildTrailNodes(container, session.queue, session.position);
  }
  // If truly nothing to do, leave trail empty (CTA already shows "All caught up!")
}

function _buildTrailNodes(container, queue, position) {
  const trail = document.createElement('div');
  trail.className = 'path-trail';

  // Zigzag geometry constants
  // Even-index nodes sit on the upper rail; odd-index nodes drop WAVE px lower.
  const WAVE  = 40;   // vertical offset between rails (px)
  const C_W   = 100;  // desired horizontal span per connector (px)
  const ANGLE = Math.round(Math.atan2(WAVE, C_W) * 180 / Math.PI); // ≈ 22°
  const C_LEN = Math.round(Math.sqrt(WAVE * WAVE + C_W * C_W));    // ≈ 108px
  // Negative right margin closes the layout vs visual gap:
  // connector CSS width = C_LEN, but visual horizontal reach = C_W;
  // pulling next node C_LEN-C_W px closer makes the tip land at the bubble edge.
  const GAP_FIX = -(C_LEN - C_W);
  // Bubble center from flex-row top: padding-top(32) + half-bubble(30) = 62px
  const BUBBLE_CTR_UP   = 62;               // bubble center of upper-rail nodes
  const BUBBLE_CTR_DOWN = 62 + WAVE;        // bubble center of lower-rail nodes

  queue.forEach(function (item, idx) {
    // ── Connector between nodes ──────────────────────────────────────
    if (idx > 0) {
      const prevDown = (idx - 1) % 2 !== 0; // previous node on lower rail?
      const conn = document.createElement('div');
      conn.className = 'path-connector' + (idx <= position ? ' path-connector--done' : '');
      conn.style.width       = C_LEN + 'px';
      conn.style.marginRight = GAP_FIX + 'px';
      if (!prevDown) {
        // upper → lower: angle down
        conn.style.marginTop = (BUBBLE_CTR_UP - 1) + 'px';
        conn.style.transform = 'rotate(' + ANGLE + 'deg)';
      } else {
        // lower → upper: angle up
        conn.style.marginTop = (BUBBLE_CTR_DOWN - 1) + 'px';
        conn.style.transform = 'rotate(-' + ANGLE + 'deg)';
      }
      trail.appendChild(conn);
    }

    const isDone   = idx < position;
    const isActive = idx === position;
    const side     = idx % 2 === 0 ? 'left' : 'right';

    const node = document.createElement('div');
    node.className = 'path-node path-node--' + side +
      (isDone ? ' path-node--done' : isActive ? ' path-node--active' : ' path-node--pending');

    // Odd-index nodes sit on the lower rail (WAVE px below upper rail)
    if (idx % 2 !== 0) node.style.marginTop = WAVE + 'px';

    // Topic pin — always shown on every node
    const pin = document.createElement('div');
    pin.className = 'path-node__topic';
    pin.textContent = _TOPIC_LABEL[item.topic] || item.topic;
    node.appendChild(pin);

    // Bubble — link when active, plain div otherwise
    const bubble = isActive ? document.createElement('a') : document.createElement('div');
    bubble.className = 'path-node__bubble';
    if (isActive && item.href) {
      bubble.href = item.href;
      bubble.setAttribute('aria-label', 'Go to: ' + (_ACT_LABEL[item.activityId] || item.activityId));
    }
    bubble.setAttribute('aria-hidden', isActive ? 'false' : 'true');

    if (isDone) {
      bubble.innerHTML = '<span class="path-node__check">✓</span>';
    } else {
      bubble.textContent = _ACT_EMOJI[item.activityId] || '●';
    }
    node.appendChild(bubble);

    // Activity label
    const label = document.createElement('div');
    label.className = 'path-node__label';
    label.textContent = _ACT_LABEL[item.activityId] || item.activityId;
    node.appendChild(label);

    // "NEW" / review badge
    if (!isDone && item.isNew) {
      const badge = document.createElement('span');
      badge.className = 'path-node__new-badge';
      badge.textContent = '✨ New';
      node.appendChild(badge);
    } else if (!isDone && !item.isNew) {
      const rbadge = document.createElement('span');
      rbadge.className = 'path-node__review-badge';
      rbadge.textContent = '🔁 Review';
      node.appendChild(rbadge);
    }

    trail.appendChild(node);
  });

  container.appendChild(trail);

  // Scroll controls
  const scrollEl   = container;
  const btnLeft    = document.getElementById('path-scroll-left');
  const btnRight   = document.getElementById('path-scroll-right');
  const fadeLeft   = scrollEl.parentElement ? scrollEl.parentElement.querySelector('.path-nodes-fade--left')  : null;
  const fadeRight  = scrollEl.parentElement ? scrollEl.parentElement.querySelector('.path-nodes-fade--right') : null;
  const SCROLL_AMT = 200;

  function _updateScrollBtns() {
    if (!btnLeft || !btnRight) return;
    const atStart = scrollEl.scrollLeft <= 4;
    const atEnd   = scrollEl.scrollLeft >= scrollEl.scrollWidth - scrollEl.clientWidth - 4;
    btnLeft.classList.toggle('hidden', atStart);
    btnRight.classList.toggle('hidden', atEnd);
    if (fadeLeft)  fadeLeft.classList.toggle('hidden', atStart);
    if (fadeRight) fadeRight.classList.toggle('hidden', atEnd);
  }

  if (btnLeft)  btnLeft.addEventListener('click',  function () { scrollEl.scrollBy({ left: -SCROLL_AMT, behavior: 'smooth' }); });
  if (btnRight) btnRight.addEventListener('click', function () { scrollEl.scrollBy({ left:  SCROLL_AMT, behavior: 'smooth' }); });
  scrollEl.addEventListener('scroll', _updateScrollBtns, { passive: true });

  // Scroll active node into center, then update buttons
  setTimeout(function () {
    const activeNode = container.querySelector('.path-node--active');
    if (activeNode) {
      const nodeLeft = activeNode.offsetLeft;
      const nodeW    = activeNode.offsetWidth;
      const contW    = scrollEl.offsetWidth;
      scrollEl.scrollTo({ left: nodeLeft - contW / 2 + nodeW / 2, behavior: 'smooth' });
    }
    setTimeout(_updateScrollBtns, 350);
  }, 300);
}


/* ── Utilities ── */

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
