/* ============================================================
   my-learning.js — My Learning Path page
   Depends on: progress.js, path.js, path-session.js
   ============================================================ */

const _ACT_EMOJI = {
  speaking: '🎙️', grammar: '📐', vocabulary: '📚', quiz: '🧠',
  cloze: '🔤', dictation: '✍️', translation: '🔄', scramble: '🧩',
};
function _topicLabel(id) {
  var t = (AppTopics.PHRASE_TOPICS || []).find(function (x) { return x.id === id; })
       || (AppTopics.VOCAB_TOPICS  || []).find(function (x) { return x.id === id; });
  return t ? t.emoji + ' ' + t.label : id;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', async function () {
  const fy = document.getElementById('footer-year');
  if (fy) fy.textContent = new Date().getFullYear();

  if (typeof AppPath === 'undefined' || typeof Progress === 'undefined') return;

  const grammarData = await AppData.get('grammar-rules').catch(() => ({ rules: [] }));
  AppPath.setGrammarRules(grammarData.rules || []);

  _renderStreak();
  _renderCta();
  _renderTrail();
});

// ── Streak ───────────────────────────────────────────────────

function _renderStreak() {
  const el = document.getElementById('ml-streak');
  if (!el || typeof Progress === 'undefined') return;
  const streak = Progress.getStreak();
  if (streak.current > 0) el.textContent = AppLang.t(streak.current === 1 ? 'streak_singular' : 'streak_plural', { n: streak.current });
}

// ── CTA ──────────────────────────────────────────────────────

function _ctaSubtitle(summary) {
  var parts = [];
  if (summary.reviewCount > 0)    parts.push(AppLang.t('cta_review', { n: summary.reviewCount }));
  if (summary.newCount > 0)       parts.push(AppLang.t(summary.newCount === 1 ? 'cta_new_one' : 'cta_new_many', { n: summary.newCount }));
  if (summary.estimatedMinutes)   parts.push(AppLang.t('cta_min_left', { n: summary.estimatedMinutes }));
  if (summary.skippedReviews > 0) parts.push(AppLang.t('cta_deferred', { n: summary.skippedReviews }));
  return parts.join(' · ');
}

function _renderCta() {
  const el = document.getElementById('ml-session-cta');
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
      '<div class="ml-cta__bar"><div class="ml-cta__bar-fill" style="width:' + Math.max(pct,5) + '%"></div></div>' +
      '<div class="ml-cta__row">' +
        '<div class="ml-cta__body">' +
          '<div class="ml-cta__title">' + AppLang.t('cta_keep_going') + '</div>' +
          '<div class="ml-cta__sub">' + AppLang.t('cta_exercise_n', { cur: prog.current, total: prog.total }) +
            (remMins ? ' · ' + AppLang.t('cta_min_left', { n: remMins }) : '') + '</div>' +
        '</div>' +
        (href ? '<a href="../../' + _esc(href) + '" class="ml-cta__btn">' + AppLang.t('cta_continue') + '</a>'
              : '<span class="ml-cta__done">' + AppLang.t('done_today_status') + '</span>') +
      '</div>';
    return;
  }

  if (session && session.started && session.position >= session.queue.length) {
    el.innerHTML =
      '<div class="ml-cta__row"><div class="ml-cta__body">' +
        '<div class="ml-cta__title">' + AppLang.t('cta_done_today') + '</div>' +
        '<div class="ml-cta__sub">' + AppLang.t('cta_tomorrow') + '</div>' +
      '</div></div>';
    return;
  }

  if (!summary.hasAnything) {
    el.innerHTML =
      '<div class="ml-cta__row"><div class="ml-cta__body">' +
        '<div class="ml-cta__title">' + AppLang.t('cta_up_to_date') + '</div>' +
        '<div class="ml-cta__sub">' + AppLang.t('cta_come_back_new') + '</div>' +
      '</div></div>';
    return;
  }

  el.innerHTML =
    '<div class="ml-cta__row">' +
      '<div class="ml-cta__body">' +
        '<div class="ml-cta__title">' + AppLang.t('cta_ready') + '</div>' +
        '<div class="ml-cta__sub">' + _ctaSubtitle(summary) + '</div>' +
      '</div>' +
      '<button class="ml-cta__btn" id="ml-start-btn">' + AppLang.t('cta_start') + '</button>' +
    '</div>';

  document.getElementById('ml-start-btn').addEventListener('click', function () {
    var s = PathSession.getSession();
    if (!s) s = PathSession.buildAndSave();
    if (s && s.queue.length > 0) {
      PathSession.start();
      window.location.href = '../../' + s.queue[s.position].href;
    }
  });
}

// ── Trail ─────────────────────────────────────────────────────

function _renderTrail() {
  const container = document.getElementById('ml-trail');
  const titleEl   = document.getElementById('ml-trail-title');
  if (!container || typeof PathSession === 'undefined') return;

  container.innerHTML = '';

  var session = PathSession.getSession();
  // Rebuild only if no session exists or session hasn't started AND has no progress yet.
  // Never rebuild a session that's already in progress (position > 0) — that would reset the user's place.
  if (!session || (!session.started && session.position === 0)) {
    var summary = PathSession.getTodaySummary();
    if (summary.hasAnything) session = PathSession.buildAndSave();
  }

  if (session && session.queue.length > 0) {
    if (titleEl) titleEl.textContent = AppLang.t('trail_today');
    _buildSnakeTrail(container, session.queue, session.position);
  } else {
    if (titleEl) titleEl.textContent = AppLang.t('trail_empty');
  }
}

// ── Snake trail ───────────────────────────────────────────────
// Absolute positioning. Each node i sits at:
//   x = one of 3 columns (left / center / right) following a 4-phase cycle
//   y = i * STEP  (all nodes equally spaced vertically)
//
// Column cycle (i % 4): [left, center, right, center]
// This creates the shared-corner zigzag:
//   node 0 (left) → node 1 (center) → node 2 (right, PIVOT)
//                                    → node 3 (center) → node 4 (left, PIVOT)
//                                                       → node 5 (center) → node 6 (right, PIVOT) …
//
// The pivot node naturally has two connectors (one arriving, one departing) — no side connector needed.

var _COL_PHASE = [0, 1, 2, 1];   // 0=left, 1=center, 2=right
var _STEP      = 120;             // px between consecutive node tops (node height ≈ 118px)
var _NODE_W    = 90;              // px width of each node's bounding box
var _PIN_H     = 14;              // topic pin height (font ~9px + 2px padding + border)
var _GAP       = 10;              // gap between pin and bubble (CSS gap: 10px)
var _HALF_BUB  = 32;              // half of 64px bubble
var _BCTL      = _PIN_H + _GAP + _HALF_BUB;  // node top → bubble center ≈ 56px

function _colX(col, cW, nodeW) {
  if (col === 0) return nodeW / 2;
  if (col === 1) return cW / 2;
  return cW - nodeW / 2;
}

function _buildSnakeTrail(container, queue, position) {
  container.className = 'ml-trail ml-trail--snake';

  var cW = container.offsetWidth || 440;
  var n  = queue.length;

  // Responsive: 2 columns (left/right) on narrow screens, 3 on wide
  var twoCol   = cW < 480;
  var colPhase = twoCol ? [0, 2, 0, 2] : [0, 1, 2, 1];
  var nodeW    = 130;

  // Container height: last node top + pin + gap + bubble + label + badge + padding
  var nodeFullH = _PIN_H + _GAP + 64 + 6 + 16 + 20 + 8; // ≈ 128px
  container.style.height = ((n - 1) * _STEP + nodeFullH) + 'px';

  queue.forEach(function (item, i) {
    var col     = colPhase[i % 4];
    var xCenter = _colX(col, cW, nodeW);
    var yTop    = i * _STEP;
    var yBubble = yTop + _BCTL;

    // ── Connector from previous node to this one ─────────────
    if (i > 0) {
      var prevCol     = colPhase[(i - 1) % 4];
      var prevXCenter = _colX(prevCol, cW, nodeW);
      var prevYBubble = (i - 1) * _STEP + _BCTL;
      var dx          = xCenter - prevXCenter;
      var dy          = _STEP;
      var lenFull     = Math.sqrt(dx * dx + dy * dy);
      var angle       = Math.atan2(dy, dx) * 180 / Math.PI;
      var connDone    = i <= position;

      // Trim GAP px from each end so the line doesn't overlap the bubble circles
      // +14 gives clearance for the active node's 6px glow ring + a small visual gap
      var GAP  = _HALF_BUB + 14;
      var ux   = dx / lenFull;
      var uy   = dy / lenFull;
      var sx   = Math.round(prevXCenter + GAP * ux);
      var sy   = Math.round(prevYBubble + GAP * uy);
      var len  = Math.max(0, Math.round(lenFull - 2 * GAP));

      var conn = document.createElement('div');
      conn.className = 'ml-h-conn' + (connDone ? ' ml-h-conn--done' : '');
      conn.style.left      = sx + 'px';
      conn.style.top       = sy + 'px';
      conn.style.width     = len + 'px';
      conn.style.transform = 'rotate(' + angle + 'deg)';
      container.appendChild(conn);
    }

    // ── Node ─────────────────────────────────────────────────
    var isDone   = i < position;
    var isActive = i === position;

    var node = document.createElement('div');
    node.className = 'ml-snode' +
      (isDone ? ' ml-snode--done' : isActive ? ' ml-snode--active' : ' ml-snode--pending');
    node.style.left  = (xCenter - nodeW / 2) + 'px';
    node.style.top   = yTop + 'px';
    node.style.width = nodeW + 'px';
    node.setAttribute('role', 'listitem');

    // Topic pin
    var tp = document.createElement('div');
    tp.className = 'ml-snode__topic';
    tp.textContent = _topicLabel(item.topic);
    node.appendChild(tp);

    // Bubble
    var bubble = isActive ? document.createElement('a') : document.createElement('div');
    bubble.className = 'ml-snode__bubble';
    if (isActive && item.href) {
      bubble.href = '../../' + item.href;
      bubble.setAttribute('aria-label', AppLang.t('aria_continue', { label: AppLang.t('act_' + item.activityId) || item.activityId }));
    }
    if (isDone) {
      bubble.innerHTML = '<span class="ml-snode__check">✓</span>';
    } else {
      bubble.textContent = _ACT_EMOJI[item.activityId] || '●';
    }
    node.appendChild(bubble);

    // Label + badge grouped together
    var info = document.createElement('div');
    info.className = 'ml-snode__info';
    var lbl = document.createElement('span');
    lbl.className = 'ml-snode__label';
    lbl.textContent = AppLang.t('act_' + item.activityId) || item.activityId;
    info.appendChild(lbl);
    if (!isDone && item.isNew) {
      var badge = document.createElement('span');
      badge.className = 'ml-snode__new-badge';
      badge.textContent = AppLang.t('badge_new');
      info.appendChild(badge);
    } else if (!isDone && !item.isNew) {
      var rbadge = document.createElement('span');
      rbadge.className = 'ml-snode__review-badge';
      rbadge.textContent = AppLang.t('badge_review');
      info.appendChild(rbadge);
    }
    node.appendChild(info);

    container.appendChild(node);
  });
}
