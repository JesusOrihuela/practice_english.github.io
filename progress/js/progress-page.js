/* ============================================================
   progress-page.js — Progress Dashboard Logic
   All data comes from Progress (shared/js/progress.js) via localStorage.
   ============================================================ */

const TOPICS = [
  { key: 'greetings',     label: 'Greetings' },
  { key: 'traveling',     label: 'Traveling' },
  { key: 'technology',    label: 'Technology' },
  { key: 'restaurant',    label: 'Restaurant' },
  { key: 'kitchen',       label: 'Kitchen' },
  { key: 'supermarket',   label: 'Supermarket' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'accountability',label: 'Accountability' },
  { key: 'gym',           label: 'Gym' },
];

document.addEventListener('DOMContentLoaded', async () => {
  renderHeroStats();
  renderHeatmap();
  await renderTopicsProgress();
  await renderVocabBreakdown();
  renderActivitiesBreakdown();
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
      fetch('../../speaking/json/' + topic.key + '.json')
        .then(r => r.json())
        .then(data => data.phrases ? data.phrases.length : 0)
        .catch(() => 0)
    )
  );

  TOPICS.forEach((topic, idx) => {
    const total = totals[idx];
    const stats = Progress.getTopicStats(topic.key, total);
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
    const r    = await fetch('../../vocabulary/json/words.json');
    const data = await r.json();
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

// ---- Utilities ----

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
