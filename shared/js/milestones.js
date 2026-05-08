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
      title: 'Primera Racha',
      desc: 'Volviste — esa es la parte más difícil.',
      check: function (cards, sessions, streak) { return streak.current >= 1; }
    },
    {
      id: 'phrases_10',
      emoji: '📖',
      title: '10 Frases Aprendidas',
      desc: 'Has empezado a construir tu inglés.',
      check: function (cards) {
        return Object.entries(cards).filter(function (kv) {
          return !kv[0].startsWith('_') && kv[1].reps >= 1;
        }).length >= 10;
      }
    },
    {
      id: 'all_activities',
      emoji: '🎯',
      title: 'Aprendiz Completo',
      desc: 'Probaste los 5 tipos de actividad. ¡Cada habilidad cuenta!',
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
      title: 'Explorador',
      desc: 'Practicaste suficiente para avanzar a un nuevo tema. ¡El camino se abre!',
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
      title: '50 Frases de Speaking',
      desc: 'Tu confianza al hablar crece rápidamente.',
      check: function (cards) {
        return Object.entries(cards).filter(function (kv) {
          return !kv[0].startsWith('_') && !SPEAKING_PREFIX.test(kv[0]) && kv[1].reps >= 1;
        }).length >= 50;
      }
    },
    {
      id: 'perfect_session',
      emoji: '✨',
      title: 'Perfecto',
      desc: 'Puntuación perfecta en una sesión con 5 o más tarjetas. ¡Impresionante!',
      check: function (cards, sessions) {
        return sessions.some(function (s) { return s.total >= 5 && s.correct === s.total; });
      }
    },
    {
      id: 'grammar_first',
      emoji: '🏆',
      title: 'Primera Regla de Gramática',
      desc: 'Completaste tu primera regla del Grammar Workshop.',
      check: function (cards) {
        return Object.entries(cards).some(function (kv) {
          return kv[0].startsWith('grammar_') && kv[1].reps >= 1;
        });
      }
    },
    {
      id: 'streak_7',
      emoji: '🔥',
      title: 'Racha de 7 Días',
      desc: 'Una semana de práctica constante — ¡hábito formado!',
      check: function (cards, sessions, streak) { return streak.current >= 7; }
    },
    {
      id: 'first_mastered',
      emoji: '⭐',
      title: 'Primera Tarjeta Dominada',
      desc: 'Alcanzaste dominio total en una frase — ¡constante y preciso!',
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
      title: '50 Tarjetas Dominadas',
      desc: '50 frases con dominio total — ¡tu inglés se está fijando!',
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
      title: 'Hábito de Hierro',
      desc: '30 días de práctica constante. El inglés ya es parte de tu vida.',
      check: function (cards, sessions, streak) { return streak.best >= 30; }
    },
    {
      id: 'mastered_100',
      emoji: '🌟',
      title: 'Campeón del Idioma',
      desc: '100 tarjetas con dominio total. Estás construyendo fluidez real.',
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
    shareBtn.setAttribute('aria-label', 'Compartir logro');
    shareBtn.title = 'Share';
    shareBtn.textContent = '📤';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'milestone-toast__close';
    closeBtn.id = 'mt-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
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
    var text = '¡Acabo de desbloquear "' + current.title + '" en PracticeEnglish! ' + current.emoji + ' practiceenglish.app';
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
