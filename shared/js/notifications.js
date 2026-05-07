/* ============================================================
   notifications.js — Local PWA Notification System
   No backend required. Fires once per day on home-page open,
   at or after the configured reminder time, when the user has
   due SRS cards or a streak at risk.
   ============================================================ */

(function () {
  'use strict';

  var KEY_ENABLED    = 'pe_notif_enabled';
  var KEY_TIME       = 'pe_notif_time';
  var KEY_LAST_SHOWN = 'pe_notif_last_shown';
  var KEY_ASKED      = 'pe_notif_asked';

  /* ---- State accessors ---- */

  function isEnabled() {
    return localStorage.getItem(KEY_ENABLED) === '1';
  }

  function getReminderTime() {
    return localStorage.getItem(KEY_TIME) || '20:00';
  }

  function setReminderTime(hhmm) {
    localStorage.setItem(KEY_TIME, hhmm);
  }

  function disable() {
    localStorage.setItem(KEY_ENABLED, '0');
  }

  /* ---- Permission request ---- */

  function requestPermission(callback) {
    if (!('Notification' in window)) {
      if (callback) callback('unsupported');
      return;
    }
    Notification.requestPermission().then(function (result) {
      if (result === 'granted') {
        localStorage.setItem(KEY_ENABLED, '1');
      } else {
        localStorage.setItem(KEY_ENABLED, '0');
      }
      if (callback) callback(result);
    });
  }

  // Known topic IDs in CEFR order (mirrors path.js — no import needed)
  var TOPIC_IDS = [
    'greetings', 'restaurant', 'supermarket', 'kitchen', 'traveling',
    'entertainment', 'gym', 'technology', 'accountability',
  ];

  var TOPIC_LABELS = {
    greetings: 'Greetings', restaurant: 'Restaurant', supermarket: 'Supermarket',
    kitchen: 'Kitchen', traveling: 'Traveling', entertainment: 'Entertainment',
    gym: 'Gym', technology: 'Technology', accountability: 'Accountability',
  };

  // Activity prefixes to strip when extracting topic from card key
  var ACTIVITY_PREFIXES = ['dict_', 'cloze_', 'scramble_', 'trans_', 'quiz_', 'vocab_'];

  function _topicFromKey(key) {
    var k = key;
    for (var i = 0; i < ACTIVITY_PREFIXES.length; i++) {
      if (k.startsWith(ACTIVITY_PREFIXES[i])) {
        k = k.slice(ACTIVITY_PREFIXES[i].length);
        break;
      }
    }
    for (var j = 0; j < TOPIC_IDS.length; j++) {
      if (k.startsWith(TOPIC_IDS[j] + '_')) return TOPIC_IDS[j];
    }
    return null;
  }

  // Returns the notification payload to show, or null if nothing to remind about.
  function buildPayload() {
    if (typeof Progress === 'undefined') return null;

    var streak   = Progress.getStreak();
    var today    = new Date().toISOString().slice(0, 10);
    var sessions = typeof Progress.getSessions === 'function' ? Progress.getSessions() : [];
    var practicedToday = sessions.some(function (s) { return s.date === today; });

    // ── Priority 1: due SRS cards (most actionable) ──
    var now   = Date.now();
    var cards = Progress.getAllCards();
    var dueCounts = {};  // topicId → count

    Object.keys(cards).forEach(function (key) {
      if (key.startsWith('_') || key.startsWith('grammar_')) return;
      var card = cards[key];
      if (!card || card.reps === 0 || card.due > now) return;
      var topic = _topicFromKey(key);
      if (!topic) return;
      dueCounts[topic] = (dueCounts[topic] || 0) + 1;
    });

    // Pick the topic with the most due cards
    var topDueTopic = null;
    var topDueCount = 0;
    TOPIC_IDS.forEach(function (tid) {
      if ((dueCounts[tid] || 0) > topDueCount) {
        topDueCount = dueCounts[tid];
        topDueTopic = tid;
      }
    });

    if (topDueTopic && topDueCount > 0) {
      var totalDue = Object.keys(dueCounts).reduce(function (s, k) { return s + dueCounts[k]; }, 0);
      var bodyText = topDueCount + ' card' + (topDueCount > 1 ? 's' : '') + ' due in ' + TOPIC_LABELS[topDueTopic];
      if (totalDue > topDueCount) {
        bodyText += ' (+ ' + (totalDue - topDueCount) + ' more across other topics)';
      }
      bodyText += ' — review now.';
      return {
        title: '📚 Cards waiting for review',
        body:  bodyText,
        tag:   'srs-due',
        url:   'speaking/html/speaking.html?topic=' + topDueTopic,
      };
    }

    // ── Priority 2: streak at risk ──
    if (streak.current >= 2 && !practicedToday) {
      return {
        title: '🔥 Streak at risk',
        body:  streak.current + '-day streak! Practice today to keep it going.',
        tag:   'streak-risk',
        url:   'speaking/html/speaking.html',
      };
    }

    return null;
  }

  /* ---- Main check — call once on home-page load ---- */

  function checkAndNotify() {
    if (!isEnabled()) return;
    if (!('serviceWorker' in navigator)) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    var today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(KEY_LAST_SHOWN) === today) return;

    // Only fire at or after the configured reminder time
    var parts = getReminderTime().split(':');
    var hh    = parseInt(parts[0], 10);
    var mm    = parseInt(parts[1], 10);
    var now   = new Date();
    if (now.getHours() < hh || (now.getHours() === hh && now.getMinutes() < mm)) return;

    var payload = buildPayload();
    if (!payload) return;

    navigator.serviceWorker.ready.then(function (reg) {
      return reg.showNotification(payload.title, {
        body:               payload.body,
        icon:               'index/img/ico/logo.png',
        badge:              'index/img/ico/favicon.ico',
        tag:                payload.tag,
        data:               { url: payload.url },
        requireInteraction: false,
      });
    }).then(function () {
      localStorage.setItem(KEY_LAST_SHOWN, today);
    }).catch(function () {
      /* Silently ignore — notification is progressive enhancement */
    });
  }

  /* ---- Post-session prompt ---- */
  /* Call from showSessionDone(). Shows once, only when permission not yet decided. */

  function showPostSessionPrompt(container) {
    if (!container) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(KEY_ASKED) !== null) return;

    var prompt = document.createElement('div');
    prompt.className = 'done-notif-prompt';
    prompt.setAttribute('role', 'region');
    prompt.setAttribute('aria-label', 'Enable daily reminders');

    var textEl = document.createElement('div');
    textEl.className = 'done-notif-text';
    var strong = document.createElement('strong');
    strong.textContent = '🔔 Get a daily reminder?';
    var desc = document.createElement('span');
    desc.textContent = "We'll tell you exactly which cards are due.";
    textEl.appendChild(strong);
    textEl.appendChild(desc);

    var btnRow = document.createElement('div');
    btnRow.className = 'done-notif-btns';

    var yesBtn = document.createElement('button');
    yesBtn.className = 'done-notif-yes';
    yesBtn.textContent = 'Yes, remind me';
    yesBtn.addEventListener('click', function () {
      localStorage.setItem(KEY_ASKED, '1');
      requestPermission(function (result) {
        if (result === 'granted') {
          prompt.innerHTML = '<span class="done-notif-confirmed">✓ Reminders on — we\'ll tell you exactly which cards are due each day.</span>';
        } else {
          prompt.innerHTML = '<span class="done-notif-confirmed">Notifications blocked in browser settings.</span>';
        }
      });
    });

    var noBtn = document.createElement('button');
    noBtn.className = 'done-notif-no';
    noBtn.textContent = 'Not now';
    noBtn.addEventListener('click', function () {
      localStorage.setItem(KEY_ASKED, '1');
      prompt.remove();
    });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    prompt.appendChild(textEl);
    prompt.appendChild(btnRow);
    container.appendChild(prompt);
  }

  /* ---- Public API ---- */

  window.NotificationSystem = {
    isEnabled:              isEnabled,
    getReminderTime:        getReminderTime,
    setReminderTime:        setReminderTime,
    requestPermission:      requestPermission,
    disable:                disable,
    buildPayload:           buildPayload,
    checkAndNotify:         checkAndNotify,
    showPostSessionPrompt:  showPostSessionPrompt,
  };
})();
