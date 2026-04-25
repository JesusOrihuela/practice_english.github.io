/* ============================================================
   progress-page.js — Progress Dashboard Logic
   All data comes from Progress (shared/js/progress.js) via localStorage.
   ============================================================ */

const TOPICS = AppTopics.PHRASE_TOPICS;

// In-page fetch cache — deduplicates concurrent requests and avoids re-fetching
// the same JSON twice within a page load (e.g. vocab data used by both
// renderVocabBreakdown and renderHardCards).
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

document.addEventListener('DOMContentLoaded', async () => {
  renderNotificationSettings();
  renderHeroStats();
  renderHeatmap();
  renderWeeklyAccuracy();
  await renderTopicsProgress();
  await renderVocabBreakdown();
  renderIntervalDistribution();
  renderActivitiesBreakdown();
  renderAccuracyByActivity();
  renderMilestones();
  await renderHardCards();
  renderRecentSessions();
});

// ---- Hero Stats ----

function renderHeroStats() {
  const streak   = Progress.getStreak();
  const sessions = Progress.getSessions();
  const srsData  = Progress.getAllCards();

  // Vocabulary words learned (vocab_* cards with reps >= 1)
  let vocabLearned = 0;
  Object.keys(srsData).forEach(key => {
    if (key.startsWith('vocab_') && srsData[key].reps >= 1) vocabLearned++;
  });

  // Phrases practiced (non-vocab, non-system keys with reps >= 1)
  let phrasesLearned = 0;
  Object.keys(srsData).forEach(key => {
    if (!key.startsWith('vocab_') && !key.startsWith('_') && srsData[key].reps >= 1) phrasesLearned++;
  });

  document.getElementById('stat-streak').textContent  = streak.current;
  document.getElementById('stat-vocab').textContent   = vocabLearned;
  document.getElementById('stat-phrases').textContent = phrasesLearned;
  document.getElementById('stat-sessions').textContent = sessions.length;
  const bestEl = document.getElementById('stat-best-streak');
  if (bestEl && streak.best > 1) bestEl.textContent = 'Best: ' + streak.best;
}

// ---- Activity Heatmap (last 60 days) ----

function renderHeatmap() {
  const sessions = Progress.getSessions();
  const container = document.getElementById('heatmap');
  if (!container) return;

  // Count sessions per date
  const counts = {};
  sessions.forEach(s => {
    counts[s.date] = (counts[s.date] || 0) + 1;
  });

  // Generate last 60 days
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

// ---- Topics Progress ----

async function renderTopicsProgress() {
  const container = document.getElementById('topics-progress');
  if (!container) return;

  const totals = await Promise.all(
    TOPICS.map(topic =>
      AppData.get(topic.id)
        .then(data => data.phrases ? data.phrases.length : 0)
        .catch(() => 0)
    )
  );

  TOPICS.forEach((topic, idx) => {
    const total = totals[idx];
    const stats = Progress.getTopicStats(topic.id, total);
    const pct   = total > 0 ? Math.round((stats.seen / stats.total) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'topic-row';
    row.innerHTML =
      '<span class="topic-name">' + topic.label + '</span>' +
      '<div class="topic-bar-track"><div class="topic-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="topic-pct">' + (total > 0 ? stats.seen + '/' + stats.total : '—') + '</span>';
    container.appendChild(row);
  });
}

// ---- Vocabulary Breakdown by Difficulty ----

async function renderVocabBreakdown() {
  const container = document.getElementById('vocab-breakdown');
  if (!container) return;

  let words = [];
  try {
    const data = await _fetchJSON('../../vocabulary/json/words.json');
    words = data.words || [];
  } catch (e) { return; }

  const srsData = Progress.getAllCards();

  const diffs = ['easy', 'medium', 'hard'];
  const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  for (const diff of diffs) {
    const total  = words.filter(w => w.difficulty === diff).length;
    const learned = words.filter((w, i) => {
      if (w.difficulty !== diff) return false;
      const card = srsData['vocab_' + i];
      return card && card.reps >= 1;
    }).length;

    const pct = total > 0 ? Math.round((learned / total) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'vocab-row';
    row.innerHTML =
      '<span class="vocab-diff ' + diff + '">' + labels[diff] + '</span>' +
      '<div class="vocab-bar-track"><div class="vocab-bar-fill ' + diff + '" style="width:' + pct + '%"></div></div>' +
      '<span class="vocab-count">' + learned + ' / ' + total + '</span>';
    container.appendChild(row);
  }
}

// ---- Other Activities Breakdown (Quiz, Cloze, Translation, Scramble) ----

function renderActivitiesBreakdown() {
  const container = document.getElementById('activities-breakdown');
  if (!container) return;

  const srsData = Progress.getAllCards();

  const activities = [
    { prefix: 'quiz_vocab', label: '🧠 Vocabulary Quiz' },
    { prefix: 'cloze_',     label: '🔤 Cloze' },
    { prefix: 'trans_',     label: '🔄 Translation' },
    { prefix: 'scramble_',  label: '🧩 Scramble' },
  ];

  let anyData = false;
  activities.forEach(act => {
    const keys  = Object.keys(srsData).filter(k => k.startsWith(act.prefix));
    const seen  = keys.filter(k => srsData[k].reps >= 1).length;
    const total = keys.length;
    if (total === 0) return;
    anyData = true;

    const pct = Math.round((seen / total) * 100);
    const row = document.createElement('div');
    row.className = 'topic-row';
    row.innerHTML =
      '<span class="topic-name">' + act.label + '</span>' +
      '<div class="topic-bar-track"><div class="topic-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="topic-pct">' + seen + '/' + total + '</span>';
    container.appendChild(row);
  });

  if (!anyData) {
    container.innerHTML = '<p class="empty-state">No activity yet — try Quiz, Cloze, Translation, or Scramble!</p>';
  }
}

// ---- Weekly Accuracy Chart ----

function renderWeeklyAccuracy() {
  const sessions = Progress.getSessions();
  const container = document.getElementById('weekly-accuracy-chart');
  if (!container) return;

  const nowMs = Date.now();
  const DAY   = 86400000;
  const weeks = [
    { label: '4w ago', correct: 0, total: 0 },
    { label: '3w ago', correct: 0, total: 0 },
    { label: '2w ago', correct: 0, total: 0 },
    { label: 'This week', correct: 0, total: 0 },
  ];

  sessions.forEach(s => {
    const daysAgo = Math.floor((nowMs - new Date(s.date + 'T00:00:00').getTime()) / DAY);
    const idx = 3 - Math.min(3, Math.floor(daysAgo / 7));
    if (idx >= 0) {
      weeks[idx].correct += s.correct || 0;
      weeks[idx].total   += s.total   || 0;
    }
  });

  if (!weeks.some(w => w.total > 0)) {
    document.getElementById('weekly-accuracy-block').classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  weeks.forEach(w => {
    const pct = w.total > 0 ? Math.round((w.correct / w.total) * 100) : null;
    const col = document.createElement('div');
    col.className = 'wac-col';
    col.innerHTML =
      '<div class="wac-bar-wrap">' +
        '<span class="wac-pct-label">' + (pct !== null ? pct + '%' : '—') + '</span>' +
        '<div class="wac-bar-track">' +
          '<div class="wac-bar-fill" style="height:' + (pct || 0) + '%"></div>' +
        '</div>' +
      '</div>' +
      '<span class="wac-label">' + escapeHTML(w.label) + '</span>';
    container.appendChild(col);
  });
}

// ---- Interval Distribution ----

function renderIntervalDistribution() {
  const cards = Progress.getAllCards();
  let learning = 0, consolidating = 0, mastered = 0;

  Object.entries(cards).forEach(([id, c]) => {
    if (id.startsWith('_') || c.reps === 0) return;
    if (c.interval <= 7)       learning++;
    else if (c.interval <= 21) consolidating++;
    else                       mastered++;
  });

  const total = learning + consolidating + mastered;
  if (total === 0) {
    document.getElementById('dist-block').classList.add('hidden');
    return;
  }

  document.getElementById('dist-learning').textContent      = learning;
  document.getElementById('dist-consolidating').textContent = consolidating;
  document.getElementById('dist-mastered').textContent      = mastered;

  document.getElementById('dist-bar-learning').style.width      = Math.round(learning      / total * 100) + '%';
  document.getElementById('dist-bar-consolidating').style.width = Math.round(consolidating / total * 100) + '%';
  document.getElementById('dist-bar-mastered').style.width      = Math.round(mastered      / total * 100) + '%';
}

// ---- Accuracy by Activity ----

function renderAccuracyByActivity() {
  const container = document.getElementById('accuracy-breakdown');
  if (!container) return;

  const sessions = Progress.getSessions();
  if (sessions.length === 0) {
    document.getElementById('accuracy-block').classList.add('hidden');
    return;
  }

  const EMOJIS = {
    Speaking: '🎙️', Dictation: '✍️', Cloze: '🔤',
    Translation: '🔄', Scramble: '🧩', Quiz: '🧠',
    Vocabulary: '📚', Grammar: '📐',
  };

  const groups = {};
  sessions.forEach(s => {
    let act = 'Speaking';
    if      (s.topic.startsWith('dict_'))     act = 'Dictation';
    else if (s.topic.startsWith('cloze_'))    act = 'Cloze';
    else if (s.topic.startsWith('trans_'))    act = 'Translation';
    else if (s.topic.startsWith('scramble_')) act = 'Scramble';
    else if (s.topic.startsWith('quiz_'))     act = 'Quiz';
    else if (s.topic.startsWith('vocab'))     act = 'Vocabulary';
    else if (s.topic.startsWith('grammar'))   act = 'Grammar';

    if (!groups[act]) groups[act] = { correct: 0, total: 0 };
    groups[act].correct += s.correct || 0;
    groups[act].total   += s.total   || 0;
  });

  const entries = Object.entries(groups)
    .filter(([, g]) => g.total > 0)
    .sort((a, b) => b[1].total - a[1].total);

  if (entries.length === 0) {
    document.getElementById('accuracy-block').classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  entries.forEach(([act, g]) => {
    const pct = Math.round((g.correct / g.total) * 100);
    const row = document.createElement('div');
    row.className = 'acc-row';
    row.innerHTML =
      '<span class="acc-name">' + (EMOJIS[act] || '') + ' ' + escapeHTML(act) + '</span>' +
      '<div class="acc-bar-track"><div class="acc-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="acc-pct">' + pct + '%</span>' +
      '<span class="acc-total">' + g.total + ' cards</span>';
    container.appendChild(row);
  });
}

// ---- Milestones ----

function renderMilestones() {
  const container = document.getElementById('milestones-grid');
  if (!container || typeof MilestoneSystem === 'undefined') return;

  const achieved  = MilestoneSystem.getAchieved();
  const milestones = MilestoneSystem.MILESTONES;

  container.innerHTML = '';
  milestones.forEach(m => {
    const done = achieved.indexOf(m.id) !== -1;
    const el = document.createElement('div');
    el.className = 'milestone-badge' + (done ? ' milestone-badge--done' : ' milestone-badge--locked');
    el.setAttribute('aria-label', m.title + (done ? ' — achieved' : ' — locked'));
    el.innerHTML =
      '<span class="milestone-badge__emoji">' + (done ? m.emoji : '🔒') + '</span>' +
      '<span class="milestone-badge__title">' + escapeHTML(m.title) + '</span>' +
      '<span class="milestone-badge__desc">' + escapeHTML(m.desc) + '</span>';
    container.appendChild(el);
  });
}

// ---- Hard Cards ----

function parseCardId(id) {
  // Grammar: grammar_{cat}_{ruleId}
  if (id.startsWith('grammar_')) {
    const ruleId = id.slice('grammar_'.length);
    return { activity: 'Grammar', emoji: '📐', url: '../../grammar/html/grammar.html',
             phraseLabel: ruleId.replace(/_/g, ' '), jsonFile: null };
  }

  // Quiz (general vocabulary): quiz_vocab_{index}
  // Must be checked before the generic quiz_ branch below.
  if (id.startsWith('quiz_vocab_')) {
    const index = parseInt(id.slice('quiz_vocab_'.length));
    return { activity: 'Quiz', emoji: '🧠', url: '../../quiz/html/quiz.html',
             topic: 'words', topicLabel: 'Vocabulary', index,
             jsonFile: '../../vocabulary/json/words.json', isVocab: true };
  }

  // Quiz (topic vocabulary): quiz_{topic}_{index}
  // Previously fell through to the speaking fallback, returning a wrong activity/topic/URL.
  if (id.startsWith('quiz_')) {
    const rest  = id.slice('quiz_'.length);
    const lastU = rest.lastIndexOf('_');
    if (lastU !== -1) {
      const topic      = rest.slice(0, lastU);
      const index      = parseInt(rest.slice(lastU + 1));
      const topicLabel = topic.charAt(0).toUpperCase() + topic.slice(1);
      return { activity: 'Quiz', emoji: '🧠', url: '../../quiz/html/quiz.html',
               topic, topicLabel, index,
               jsonFile: '../../vocabulary/json/words-' + topic + '.json', isVocab: true };
    }
  }

  // Vocabulary (general):  vocab_{index}        — rest has no underscore
  // Vocabulary (topic):    vocab_{topic}_{index} — rest has at least one underscore
  if (id.startsWith('vocab_')) {
    const rest  = id.slice('vocab_'.length);
    const lastU = rest.lastIndexOf('_');
    if (lastU === -1) {
      // General vocabulary — rest is just the numeric index
      return { activity: 'Vocabulary', emoji: '📚', url: '../../vocabulary/html/vocabulary.html',
               topic: 'words', topicLabel: 'Vocabulary', index: parseInt(rest),
               jsonFile: '../../vocabulary/json/words.json', isVocab: true };
    }
    const topic      = rest.slice(0, lastU);
    const index      = parseInt(rest.slice(lastU + 1));
    const topicLabel = topic.charAt(0).toUpperCase() + topic.slice(1);
    return { activity: 'Vocabulary', emoji: '📚', url: '../../vocabulary/html/vocabulary.html',
             topic, topicLabel, index,
             jsonFile: '../../vocabulary/json/words-' + topic + '.json', isVocab: true };
  }

  // Phrase-based activities: {prefix}{topic}_{index}
  const PREFIXES = [
    { prefix: 'dict_',     activity: 'Dictation',  emoji: '✍️',  url: '../../dictation/html/dictation.html' },
    { prefix: 'cloze_',    activity: 'Cloze',       emoji: '🔤', url: '../../cloze/html/cloze.html' },
    { prefix: 'trans_',    activity: 'Translation', emoji: '🔄', url: '../../translation/html/translation.html' },
    { prefix: 'scramble_', activity: 'Scramble',    emoji: '🧩', url: '../../scramble/html/scramble.html' },
  ];
  for (const p of PREFIXES) {
    if (id.startsWith(p.prefix)) {
      const rest       = id.slice(p.prefix.length);
      const lastU      = rest.lastIndexOf('_');
      const topic      = rest.slice(0, lastU);
      const index      = parseInt(rest.slice(lastU + 1));
      const topicLabel = topic.charAt(0).toUpperCase() + topic.slice(1);
      return { ...p, topic, topicLabel, index, jsonFile: '../../shared/json/' + topic + '.json' };
    }
  }

  // Speaking: {topic}_{index} (no activity prefix)
  const lastU      = id.lastIndexOf('_');
  const topic      = id.slice(0, lastU);
  const index      = parseInt(id.slice(lastU + 1));
  const topicLabel = topic.charAt(0).toUpperCase() + topic.slice(1);
  return { activity: 'Speaking', emoji: '🎙️', url: '../../speaking/html/speaking.html',
           topic, topicLabel, index, jsonFile: '../../shared/json/' + topic + '.json' };
}

async function renderHardCards() {
  const container = document.getElementById('hard-cards-list');
  if (!container) return;

  const srsData = Progress.getAllCards();

  const hardCards = Object.entries(srsData)
    .filter(([id, c]) => !id.startsWith('_') && (c.lapses || 0) > 0)
    .sort((a, b) => b[1].lapses - a[1].lapses)
    .slice(0, 10)
    .map(([id, c]) => ({ id, lapses: c.lapses, ...parseCardId(id) }));

  if (hardCards.length === 0) {
    document.getElementById('hard-cards-block').classList.add('hidden');
    return;
  }

  // Batch-fetch all unique JSON files needed (hits _fetchCache for any already loaded)
  const jsonFiles = [...new Set(hardCards.map(c => c.jsonFile).filter(Boolean))];
  const jsonCache = {};
  await Promise.all(jsonFiles.map(file =>
    _fetchJSON(file).then(data => { jsonCache[file] = data; }).catch(() => {})
  ));

  // Resolve phrase text for each card
  hardCards.forEach(card => {
    if (card.phraseLabel) return; // grammar — already has label
    const data = jsonCache[card.jsonFile];
    if (!data) { card.phraseLabel = card.id; return; }
    // Vocabulary JSONs (words.json, words-{topic}.json) use { words: [...] };
    // phrase-based JSONs (shared/json/{topic}.json) use { phrases: [...] }.
    if (card.isVocab) {
      const w = (data.words || [])[card.index];
      card.phraseLabel = w ? w.word + (w.translation ? ' — ' + w.translation : '') : card.id;
    } else {
      card.phraseLabel = (data.phrases || [])[card.index] || card.id;
    }
  });

  // Group by activity for the "practice" CTA per group
  const groups = {};
  hardCards.forEach(card => {
    const key = card.activity + '|' + card.url;
    if (!groups[key]) groups[key] = { activity: card.activity, emoji: card.emoji, url: card.url, count: 0 };
    groups[key].count++;
  });

  // Render list
  container.innerHTML = '';
  hardCards.forEach(card => {
    const item = document.createElement('div');
    item.className = 'hard-card-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML =
      '<div class="hard-card-phrase">' + escapeHTML(card.phraseLabel) + '</div>' +
      '<div class="hard-card-meta">' +
        '<span class="hard-card-badge">' + card.emoji + ' ' + card.activity +
          (card.topicLabel ? ' · ' + card.topicLabel : '') + '</span>' +
        '<span class="hard-card-lapses">' + card.lapses + (card.lapses === 1 ? ' miss' : ' misses') + '</span>' +
      '</div>';
    container.appendChild(item);
  });

  // Render grouped CTAs
  const ctaWrap = document.createElement('div');
  ctaWrap.className = 'hard-card-ctas';
  Object.values(groups).forEach(g => {
    const a = document.createElement('a');
    a.href = g.url;
    a.className = 'hard-card-cta';
    a.textContent = g.emoji + ' Practice ' + g.activity + ' (' + g.count + ') →';
    ctaWrap.appendChild(a);
  });
  container.appendChild(ctaWrap);
}

// ---- Utilities ----

// ---- Notification Settings ----

function renderNotificationSettings() {
  const NS = window.NotificationSystem;

  // Hide section if Notification API not available (very old browsers / iOS Safari < 16.4)
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
    toggle.textContent = on ? '🔔 Reminders on' : '🔕 Enable reminders';
    timeRow.classList.toggle('hidden', !on);

    if (Notification.permission === 'denied') {
      statusEl.textContent = 'Notifications blocked in browser settings.';
      statusEl.className   = 'notif-status notif-status--off';
      hintEl.textContent   = 'To enable, allow notifications for this site in your browser settings.';
      toggle.disabled      = true;
    } else if (on) {
      const payload = NS.buildPayload();
      statusEl.textContent = '✓ Active — daily reminder at ' + NS.getReminderTime();
      statusEl.className   = 'notif-status notif-status--on';
      hintEl.textContent   = payload
        ? 'Right now: "' + payload.body + '"'
        : 'No pending reminders — you\'re all caught up!';
      toggle.disabled = false;
    } else {
      statusEl.textContent = '';
      statusEl.className   = 'notif-status';
      hintEl.textContent   = 'Fires once per day when you open the app, if you have due cards or your streak is at risk.';
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

function escapeHTML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Recent Sessions ----

function renderRecentSessions() {
  const container = document.getElementById('sessions-list');
  if (!container) return;

  const sessions = Progress.getSessions().slice().reverse().slice(0, 12);

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No sessions yet — start practicing to see your history here!</p>';
    return;
  }

  sessions.forEach(s => {
    const topicLabel = escapeHTML(s.topic.charAt(0).toUpperCase() + s.topic.slice(1));
    const score = s.total > 0 ? Math.round((s.correct / s.total) * 100) + '% correct' : 'Completed';

    const item = document.createElement('div');
    item.className = 'session-item';
    item.innerHTML =
      '<span class="session-topic">' + topicLabel + '</span>' +
      '<span class="session-date">' + escapeHTML(s.date) + '</span>' +
      '<span class="session-score">' + escapeHTML(score) + '</span>';
    container.appendChild(item);
  });
}
