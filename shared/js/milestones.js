/* ============================================================
   milestones.js — Achievement System
   Self-contained: injects its own toast DOM, no HTML changes needed.
   Include after progress.js on any page.
   ============================================================ */

(function () {
  'use strict';

  var SPEAKING_PREFIX = /^(dict_|cloze_|trans_|scramble_|quiz_vocab_|vocab_|grammar_)/;

  var MILESTONES = [
    {
      id: 'first_streak',
      emoji: '🌱',
      title: 'First Day Streak',
      desc: 'You came back — that\'s the hardest part.',
      check: function (cards, sessions, streak) { return streak.current >= 1; }
    },
    {
      id: 'phrases_10',
      emoji: '📖',
      title: '10 Phrases Learned',
      desc: 'You\'ve started building your English.',
      check: function (cards) {
        return Object.entries(cards).filter(function (kv) {
          return !kv[0].startsWith('_') && kv[1].reps >= 1;
        }).length >= 10;
      }
    },
    {
      id: 'speaking_50',
      emoji: '🗣️',
      title: '50 Speaking Phrases',
      desc: 'Your speaking confidence is growing fast.',
      check: function (cards) {
        return Object.entries(cards).filter(function (kv) {
          return !kv[0].startsWith('_') && !SPEAKING_PREFIX.test(kv[0]) && kv[1].reps >= 1;
        }).length >= 50;
      }
    },
    {
      id: 'grammar_first',
      emoji: '🏆',
      title: 'First Grammar Rule',
      desc: 'You completed your first Grammar Workshop rule.',
      check: function (cards) {
        return Object.entries(cards).some(function (kv) {
          return kv[0].startsWith('grammar_') && kv[1].reps >= 1;
        });
      }
    },
    {
      id: 'streak_7',
      emoji: '🔥',
      title: '7-Day Streak',
      desc: 'One week of consistent practice — habit formed!',
      check: function (cards, sessions, streak) { return streak.current >= 7; }
    },
    {
      id: 'consolidated_100',
      emoji: '💡',
      title: '100 Consolidated Cards',
      desc: '100 phrases memorized long-term (interval > 7 days).',
      check: function (cards) {
        return Object.values(cards).filter(function (c) { return (c.interval || 0) > 7; }).length >= 100;
      }
    }
  ];

  // ---- Toast queue ----

  var queue   = [];
  var showing = false;
  var current = null;
  var timer   = null;

  function injectDOM() {
    if (document.getElementById('milestone-toast')) return;
    var el = document.createElement('div');
    el.id        = 'milestone-toast';
    el.className = 'milestone-toast hidden';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    var inner = document.createElement('div');
    inner.className = 'milestone-toast__inner';

    var emoji = document.createElement('span');
    emoji.className = 'milestone-toast__emoji';
    emoji.id = 'mt-emoji';

    var body = document.createElement('div');
    body.className = 'milestone-toast__body';

    var title = document.createElement('strong');
    title.id = 'mt-title';

    var desc = document.createElement('span');
    desc.id = 'mt-desc';

    var shareBtn = document.createElement('button');
    shareBtn.className = 'milestone-toast__share';
    shareBtn.id = 'mt-share';
    shareBtn.setAttribute('aria-label', 'Share achievement');
    shareBtn.title = 'Share';
    shareBtn.textContent = '📤';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'milestone-toast__close';
    closeBtn.id = 'mt-close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '✕';

    body.appendChild(title);
    body.appendChild(desc);
    inner.appendChild(emoji);
    inner.appendChild(body);
    inner.appendChild(shareBtn);
    inner.appendChild(closeBtn);
    el.appendChild(inner);

    document.body.appendChild(el);
    closeBtn.addEventListener('click', hideToast);
    shareBtn.addEventListener('click', shareAchievement);
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    current = queue.shift();
    showing = true;

    document.getElementById('mt-emoji').textContent = current.emoji;
    document.getElementById('mt-title').textContent = current.title;
    document.getElementById('mt-desc').textContent  = current.desc;

    var toast = document.getElementById('milestone-toast');
    toast.classList.remove('hidden', 'milestone-toast--out');
    toast.classList.add('milestone-toast--in');

    clearTimeout(timer);
    timer = setTimeout(hideToast, 5500);
  }

  function hideToast() {
    clearTimeout(timer);
    var toast = document.getElementById('milestone-toast');
    if (!toast) return;
    toast.classList.remove('milestone-toast--in');
    toast.classList.add('milestone-toast--out');
    setTimeout(function () {
      toast.classList.add('hidden');
      toast.classList.remove('milestone-toast--out');
      showing = false;
      current = null;
      showNext();
    }, 350);
  }

  function shareAchievement() {
    if (!current) return;
    var text = 'I just unlocked "' + current.title + '" on PracticeEnglish! ' + current.emoji + ' practiceenglish.app';
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () {});
    } else {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  // ---- Checker ----

  function checkMilestones() {
    if (typeof Progress === 'undefined') return;
    var achieved = [];
    try { achieved = JSON.parse(localStorage.getItem('pe_milestones') || '[]'); } catch (e) {}

    var cards   = Progress.getAllCards();
    var sessions = Progress.getSessions();
    var streak  = Progress.getStreak();
    var newOnes = [];

    MILESTONES.forEach(function (m) {
      if (achieved.indexOf(m.id) !== -1) return;
      try {
        if (m.check(cards, sessions, streak)) {
          achieved.push(m.id);
          newOnes.push(m);
        }
      } catch (e) {}
    });

    if (newOnes.length === 0) return;
    localStorage.setItem('pe_milestones', JSON.stringify(achieved));
    newOnes.forEach(function (m) { queue.push(m); });
    showNext();
  }

  // ---- Public API (used by progress page) ----

  window.MilestoneSystem = {
    MILESTONES: MILESTONES,
    getAchieved: function () {
      try { return JSON.parse(localStorage.getItem('pe_milestones') || '[]'); } catch (e) { return []; }
    }
  };

  // ---- Boot ----

  document.addEventListener('DOMContentLoaded', function () {
    injectDOM();
    setTimeout(checkMilestones, 1200);
  });
})();
