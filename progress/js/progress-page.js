/* ============================================================
   progress-page.js — Progress Dashboard Logic
   All data comes from Progress (shared/js/progress.js) and
   AppPath (shared/js/path.js) via localStorage.
   ============================================================ */

// In-page fetch cache — deduplicates concurrent requests
const _fetchCache = new Map();
function _fetchJSON(url) {
  if (!_fetchCache.has(url)) {
    _fetchCache.set(url,
      fetch(url)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(err => { _fetchCache.delete(url); throw err; })
    );
  }
  return _fetchCache.get(url);
}

// Prefix hrefs from AppPath (root-relative) to work from progress/html/
function _pHref(href) { return '../../' + href; }

document.addEventListener('DOMContentLoaded', async () => {
  renderLangPair();
  renderNotificationSettings();
  renderHeroStats();
  renderTopicPrefs();
  renderHeatmap();
  renderMilestones();
  await renderExerciseMatrix();
});

// ---- Language Pair ----

function renderLangPair() {
  const grid = document.getElementById('lang-pair-grid');
  if (!grid || typeof AppLangPair === 'undefined') return;

  const active = AppLangPair.getActive();
  const all    = AppLangPair.getAll();

  grid.innerHTML = '';

  all.forEach(function (pair) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lp-card' + (pair.id === active.id ? ' lp-card--active' : '');
    card.setAttribute('aria-pressed', pair.id === active.id ? 'true' : 'false');
    card.setAttribute('aria-label', pair.label);

    // Flag row
    const flagRow = document.createElement('span');
    flagRow.className = 'lp-card__flags';
    if (typeof AppFlags !== 'undefined') {
      flagRow.appendChild(AppFlags.stack(pair.source.flags[0], pair.source.flags[1]));
      const arrow = document.createElement('span');
      arrow.className   = 'lp-card__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      flagRow.appendChild(arrow);
      flagRow.appendChild(AppFlags.stack(pair.target.flags[0], pair.target.flags[1]));
    }
    card.appendChild(flagRow);

    // Label
    const lbl = document.createElement('span');
    lbl.className   = 'lp-card__label';
    lbl.textContent = pair.label;
    card.appendChild(lbl);

    card.addEventListener('click', function () {
      AppLangPair.setActive(pair.id);
      // Reload so all data re-initializes from the new pair's namespace
      location.reload();
    });

    grid.appendChild(card);
  });
}

// ---- Topic Preferences ----

function renderTopicPrefs() {
  const container = document.getElementById('prog-prefs-bubbles');
  if (!container || typeof AppTopics === 'undefined') return;
  const saved = new Set(JSON.parse(localStorage.getItem(AppLangPair.storageKey('pe_topic_preferences')) || '[]'));
  AppTopics.PHRASE_TOPICS.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prog-bubble' + (saved.has(t.id) ? ' prog-bubble--on' : '');
    btn.textContent = t.emoji + ' ' + t.label;
    btn.dataset.id = t.id;
    btn.setAttribute('aria-pressed', saved.has(t.id) ? 'true' : 'false');
    btn.addEventListener('click', () => {
      btn.classList.toggle('prog-bubble--on');
      const isOn = btn.classList.contains('prog-bubble--on');
      btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      const on = Array.from(container.querySelectorAll('.prog-bubble--on')).map(b => b.dataset.id);
      localStorage.setItem(AppLangPair.storageKey('pe_topic_preferences'), JSON.stringify(on));
    });
    container.appendChild(btn);
  });
}

// ---- Hero Stats ----

function renderHeroStats() {
  const streak = Progress.getStreak();
  const cards  = Progress.getAllCards();

  let masteredCount = 0;
  Object.keys(cards).forEach(key => {
    if (!key.startsWith('_') && Progress.getMastery(key) === 'mastered') masteredCount++;
  });

  document.getElementById('stat-streak').textContent   = streak.current;
  document.getElementById('stat-mastered').textContent = masteredCount; // total added later by renderExerciseMatrix
  const bestEl = document.getElementById('stat-best-streak');
  if (bestEl && streak.best > streak.current) bestEl.textContent = AppLang.t('streak_best', { n: streak.best });
}

// ---- Exercise Overview Accordion ----

// Returns { mastered, learning, total } for one topic × activity.
// learning = seen but not yet mastered.
function _getActStats(topicId, actId, allCards, phraseIds, vocabIds, grammarRules) {
  var PHRASE_PFX = { speaking: '', cloze: 'cloze_', dictation: 'dict_', translation: 'trans_', scramble: 'scramble_' };
  var ids;

  if (actId === 'grammar') {
    ids = grammarRules
      .filter(function (r) { return Array.isArray(r.topics) && r.topics.includes(topicId); })
      .map(function (r) { return 'grammar_' + r.category + '_' + r.id; });
  } else if (actId === 'vocabulary') {
    ids = vocabIds.map(function (id) { return 'vocab_' + topicId + '_' + id; });
  } else if (actId === 'quiz') {
    ids = vocabIds.map(function (id) { return 'quiz_' + topicId + '_' + id; });
  } else if (actId in PHRASE_PFX) {
    ids = phraseIds.map(function (id) { return PHRASE_PFX[actId] + id; });
  } else {
    return null;
  }

  if (!ids || ids.length === 0) return null;

  var mastered = 0, seen = 0;
  ids.forEach(function (cardId) {
    var c = allCards[cardId];
    if (c && c.reps > 0) {
      seen++;
      if (Progress.getMastery(cardId) === 'mastered') mastered++;
    }
  });
  return { mastered: mastered, learning: seen - mastered, total: ids.length };
}

// Builds the inner HTML for a 3-segment bar (mastered | learning | not-started).
// The "not started" segment is implicit — it's the bar background showing through.
function _segBar(mastered, learning, total) {
  if (!total) return '';
  var mPct = Math.round((mastered  / total) * 100);
  var lPct = Math.round((learning  / total) * 100);
  var out  = '';
  if (mPct > 0) out += '<div class="ex-seg--mastered" style="width:' + mPct + '%"></div>';
  if (lPct > 0) out += '<div class="ex-seg--learning" style="width:' + lPct + '%"></div>';
  return out;
}

async function renderExerciseMatrix() {
  const container = document.getElementById('ex-matrix');
  if (!container || typeof AppPath === 'undefined') return;

  const grammarData = await _fetchJSON('../../shared/json/grammar-rules.json').catch(() => ({ rules: [] }));
  AppPath.setGrammarRules(grammarData.rules || []);
  const grammarRules = grammarData.rules || [];
  const allCards = Progress.getAllCards();

  // Update Cards Mastered stat with full total (phrases×5 + vocab×2 + grammar per topic)
  (function() {
    let masteredCount = 0, totalCount = 0;
    Object.keys(allCards).forEach(function(key) {
      if (!key.startsWith('_') && Progress.getMastery(key) === 'mastered') masteredCount++;
    });
    AppPath.getTopicStatuses().forEach(function(topic) {
      totalCount += Progress.getPhraseIds(topic.id).length * 5;
      totalCount += Progress.getVocabIds(topic.id).length * 2;
      totalCount += grammarRules.filter(function(r) { return Array.isArray(r.topics) && r.topics.includes(topic.id); }).length;
    });
    const el = document.getElementById('stat-mastered');
    if (el) el.textContent = masteredCount + ' / ' + totalCount;
  })();

  const ACT_ORDER = [
    { id: 'speaking',    emoji: '🎙️', label: 'Pronunciación' },
    { id: 'dictation',   emoji: '✍️', label: 'Dictado'       },
    { id: 'vocabulary',  emoji: '📚', label: 'Vocabulario'   },
    { id: 'cloze',       emoji: '🔤', label: 'Cloze'         },
    { id: 'translation', emoji: '🔄', label: 'Traducción'    },
    { id: 'scramble',    emoji: '🧩', label: 'Secuencia'     },
    { id: 'quiz',        emoji: '🧠', label: 'Quiz'          },
    { id: 'grammar',     emoji: '📐', label: 'Gramática'     },
  ];

  container.innerHTML = '';

  // ── Header row ────────────────────────────────────────────
  const hdrRow = document.createElement('div');
  hdrRow.className = 'ex-grid-row ex-grid-row--header';
  hdrRow.setAttribute('role', 'row');
  // Empty corner cell
  const corner = document.createElement('div');
  corner.setAttribute('role', 'columnheader');
  hdrRow.appendChild(corner);
  ACT_ORDER.forEach(function (a) {
    const th = document.createElement('div');
    th.className = 'ex-grid-th';
    th.setAttribute('role', 'columnheader');
    th.setAttribute('aria-label', a.label);
    th.innerHTML = '<span aria-hidden="true">' + a.emoji + '</span><span class="ex-grid-th-label">' + a.label + '</span>';
    hdrRow.appendChild(th);
  });
  container.appendChild(hdrRow);

  // ── Topic rows ────────────────────────────────────────────
  AppPath.getTopicStatuses().forEach(function (topic) {
    const phraseIds = Progress.getPhraseIds(topic.id);
    const vocabIds  = Progress.getVocabIds(topic.id);

    const row = document.createElement('div');
    row.className = 'ex-grid-row';
    row.setAttribute('role', 'row');

    // Topic label cell
    const th = document.createElement('div');
    th.className = 'ex-grid-topic';
    th.setAttribute('role', 'rowheader');
    th.innerHTML =
      '<span class="ex-grid-topic-emoji" aria-hidden="true">' + topic.emoji + '</span>' +
      '<span class="ex-grid-topic-name">' + _esc(topic.label) + '</span>';
    row.appendChild(th);

    // One cell per activity
    ACT_ORDER.forEach(function (act) {
      const td = document.createElement('div');
      td.className = 'ex-grid-cell';
      td.setAttribute('role', 'cell');

      const stats = _getActStats(topic.id, act.id, allCards, phraseIds, vocabIds, grammarRules);

      if (!stats) {
        td.innerHTML = '<div class="ex-seg-bar ex-seg-bar--na"></div><span class="ex-cell-na">n/a</span>';
        td.title = AppLang.t('cell_na', { act: act.label });
        row.appendChild(td);
        return;
      }

      var ns = stats.total - stats.mastered - stats.learning;
      td.title = AppLang.t('cell_stats', { act: act.label, mastered: stats.mastered, learning: stats.learning, unseen: ns });
      td.setAttribute('aria-label', td.title);
      td.innerHTML =
        '<div class="ex-seg-bar">' + _segBar(stats.mastered, stats.learning, stats.total) + '</div>' +
        '<div class="ex-cell-counts">' +
          '<span class="ex-count--n">' + ns + '</span>' +
          '<span class="ex-count-sep">·</span>' +
          '<span class="ex-count--l">' + stats.learning + '</span>' +
          '<span class="ex-count-sep">·</span>' +
          '<span class="ex-count--m">' + stats.mastered + '</span>' +
        '</div>';

      row.appendChild(td);
    });

    container.appendChild(row);
  });

  // ── Legend ────────────────────────────────────────────────
  const legend = document.createElement('div');
  legend.className = 'ex-acc-legend';
  legend.setAttribute('aria-hidden', 'true');
  [
    { cls: 'ex-seg--new',      countCls: 'ex-count--n', label: 'Sin iniciar'  },
    { cls: 'ex-seg--learning', countCls: 'ex-count--l', label: 'En progreso'  },
    { cls: 'ex-seg--mastered', countCls: 'ex-count--m', label: 'Dominado'     },
  ].forEach(function (li) {
    const el = document.createElement('div');
    el.className = 'ex-acc-legend-item';
    el.innerHTML =
      '<div class="ex-acc-legend-swatch ' + li.cls + '"></div>' +
      '<span class="' + li.countCls + '">' + li.label + '</span>';
    legend.appendChild(el);
  });
  document.getElementById('exercises-block').appendChild(legend);
}

// ---- Activity Heatmap (last 60 days) ----

function renderHeatmap() {
  const sessions  = Progress.getSessions();
  const container = document.getElementById('heatmap');
  if (!container) return;

  const counts = {};
  sessions.forEach(s => {
    counts[s.date] = (counts[s.date] || 0) + 1;
  });

  const today = new Date();
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count   = counts[dateStr] || 0;
    const level   = count === 0 ? 'l0' : count === 1 ? 'l1' : count <= 3 ? 'l2' : 'l3';

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell ' + level;
    cell.title = dateStr + (count > 0 ? ' — ' + count + ' session' + (count > 1 ? 's' : '') : '');
    container.appendChild(cell);
  }
}

// ---- Milestones ----

function renderMilestones() {
  const container = document.getElementById('milestones-grid');
  if (!container || typeof MilestoneSystem === 'undefined') return;

  const achieved   = MilestoneSystem.getAchieved();
  const milestones = MilestoneSystem.MILESTONES;

  container.innerHTML = '';
  milestones.forEach(m => {
    const done = achieved.indexOf(m.id) !== -1;
    const el   = document.createElement('div');
    el.className = 'milestone-badge' + (done ? ' milestone-badge--done' : ' milestone-badge--locked');
    el.setAttribute('aria-label', m.title + (done ? ' — achieved' : ' — locked'));
    el.innerHTML =
      '<span class="milestone-badge__emoji">' + (done ? m.emoji : '🔒') + '</span>' +
      '<span class="milestone-badge__title">' + _esc(m.title) + '</span>' +
      '<span class="milestone-badge__desc">' + _esc(m.desc) + '</span>';
    container.appendChild(el);
  });
}

// ---- Notification Settings ----

function renderNotificationSettings() {
  const NS = window.NotificationSystem;

  if (!NS || !('Notification' in window)) {
    const block = document.getElementById('notif-block');
    if (block) block.classList.add('hidden');
    return;
  }

  const toggle    = document.getElementById('notif-toggle');
  const timeRow   = document.getElementById('notif-time-row');
  const timeInput = document.getElementById('notif-time');
  const statusEl  = document.getElementById('notif-status');
  const hintEl    = document.getElementById('notif-hint');
  if (!toggle) return;

  function updateUI() {
    const granted = Notification.permission === 'granted';
    const on      = granted && NS.isEnabled();

    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.textContent = on ? AppLang.t('notif_on') : AppLang.t('notif_off');
    timeRow.classList.toggle('hidden', !on);

    if (Notification.permission === 'denied') {
      statusEl.textContent = AppLang.t('notif_blocked');
      statusEl.className   = 'notif-status notif-status--off';
      hintEl.textContent   = AppLang.t('notif_blocked_hint');
      toggle.disabled      = true;
    } else if (on) {
      const payload = NS.buildPayload();
      statusEl.textContent = AppLang.t('notif_active', { time: NS.getReminderTime() });
      statusEl.className   = 'notif-status notif-status--on';
      hintEl.textContent   = payload ? AppLang.t('notif_current', { body: payload.body }) : AppLang.t('notif_no_pending');
      toggle.disabled      = false;
    } else {
      statusEl.textContent = '';
      statusEl.className   = 'notif-status';
      hintEl.textContent   = AppLang.t('notif_hint');
      toggle.disabled      = false;
    }
  }

  timeInput.value = NS.getReminderTime();

  toggle.addEventListener('click', () => {
    if (NS.isEnabled() && Notification.permission === 'granted') {
      NS.disable();
      updateUI();
    } else {
      NS.requestPermission(() => updateUI());
    }
  });

  timeInput.addEventListener('change', () => {
    NS.setReminderTime(timeInput.value);
    updateUI();
  });

  updateUI();
}

// ---- Utilities ----

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

