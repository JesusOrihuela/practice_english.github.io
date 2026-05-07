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
      id: 'all_activities',
      emoji: '🎯',
      title: 'All-Round Learner',
      desc: 'You tried all 5 activity types. Every skill counts!',
      check: function (cards) {
        var hasSpeaking  = Object.entries(cards).some(function (kv) {
          var k = kv[0];
          return !k.startsWith('_') && !SPEAKING_PREFIX.test(k) && !k.startsWith('quiz_') && !k.startsWith('vocab') && kv[1].reps >= 1;
        });
        var hasDict     = Object.keys(cards).some(function (k) { return k.startsWith('dict_')     && cards[k].reps >= 1; });
        var hasCloze    = Object.keys(cards).some(function (k) { return k.startsWith('cloze_')    && cards[k].reps >= 1; });
        var hasScramble = Object.keys(cards).some(function (k) { return k.startsWith('scramble_') && cards[k].reps >= 1; });
        var hasTrans    = Object.keys(cards).some(function (k) { return k.startsWith('trans_')    && cards[k].reps >= 1; });
        return hasSpeaking && hasDict && hasCloze && hasScramble && hasTrans;
      }
    },
    {
      id: 'topic_unlocked',
      emoji: '🗝️',
      title: 'Pathfinder',
      desc: 'You practiced enough to move on to a new topic. The path opens up!',
      check: function (cards) {
        var next = ['restaurant_', 'supermarket_', 'kitchen_', 'traveling_', 'entertainment_', 'gym_', 'technology_', 'accountability_'];
        return Object.entries(cards).some(function (kv) {
          var k = kv[0];
          if (k.startsWith('_')) return false;
          return next.some(function (t) { return k.startsWith(t); }) && kv[1].reps >= 1;
        });
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
      id: 'perfect_session',
      emoji: '✨',
      title: 'Flawless',
      desc: 'Perfect score in a session with 5 or more cards. Impressive!',
      check: function (cards, sessions) {
        return sessions.some(function (s) { return s.total >= 5 && s.correct === s.total; });
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
      id: 'first_mastered',
      emoji: '⭐',
      title: 'First Card Mastered',
      desc: 'You reached full mastery on a phrase — consistent and accurate!',
      check: function (cards) {
        return Object.keys(cards).some(function (key) {
          if (key.startsWith('_')) return false;
          return typeof Progress !== 'undefined' && Progress.getMastery(key) === 'mastered';
        });
      }
    },
    {
      id: 'mastered_50',
      emoji: '💡',
      title: '50 Cards Mastered',
      desc: '50 phrases at full mastery — your English is sticking!',
      check: function (cards) {
        if (typeof Progress === 'undefined') return false;
        return Object.keys(cards).filter(function (key) {
          return !key.startsWith('_') && Progress.getMastery(key) === 'mastered';
        }).length >= 50;
      }
    },
    {
      id: 'streak_30',
      emoji: '💎',
      title: 'Iron Habit',
      desc: '30 days of consistent practice. English is part of your life now.',
      check: function (cards, sessions, streak) { return streak.best >= 30; }
    },
    {
      id: 'mastered_100',
      emoji: '🌟',
      title: 'Language Champion',
      desc: '100 cards at full mastery. You\'re building real fluency.',
      check: function (cards) {
        if (typeof Progress === 'undefined') return false;
        return Object.keys(cards).filter(function (key) {
          return !key.startsWith('_') && Progress.getMastery(key) === 'mastered';
        }).length >= 100;
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
