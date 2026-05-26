const NOTES_KEY = 'notes_v2';
const THEME_KEY = 'theme';
let notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
let search = '';
let subjectFilter = '';

const els = {
  noteTitle: document.getElementById('noteTitle'),
  noteInput: document.getElementById('noteInput'),
  noteSubject: document.getElementById('noteSubject'),
  noteTags: document.getElementById('noteTags'),
  addBtn: document.getElementById('addNoteBtn'),
  notesContainer: document.getElementById('notesContainer'),
  searchInput: document.getElementById('searchInput'),
  filterSubject: document.getElementById('filterSubject'),
  dashboard: document.getElementById('dashboard'),
  timeline: document.getElementById('timeline'),
  themeToggle: document.getElementById('themeToggle')
};

function save() { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString(); }
function todayKey(ts) { return new Date(ts).toISOString().slice(0, 10); }

function addNote() {
  const title = els.noteTitle.value.trim();
  const content = els.noteInput.value.trim();
  const subject = els.noteSubject.value.trim() || 'General';
  const tags = els.noteTags.value.split(',').map(t => t.trim()).filter(Boolean);
  if (!content) return alert('Please enter note content.');

  notes.unshift({
    id: crypto.randomUUID(),
    title,
    content,
    subject,
    tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastOpenedAt: Date.now(),
    priority: content.length > 250 ? 'High' : 'Normal'
  });

  ['noteTitle', 'noteInput', 'noteSubject', 'noteTags'].forEach(k => els[k].value = '');
  save();
  renderAll();
}

function openNote(id) {
  const n = notes.find(x => x.id === id);
  if (!n) return;
  n.lastOpenedAt = Date.now();
  save();
  renderAll();
}
function deleteNote(id) { notes = notes.filter(n => n.id !== id); save(); renderAll(); }

function computeStreak() {
  const days = [...new Set(notes.map(n => todayKey(n.createdAt)))].sort();
  if (!days.length) return 0;
  let streak = 0;
  let cursor = new Date();
  for (;;) {
    const d = cursor.toISOString().slice(0, 10);
    if (days.includes(d)) { streak++; cursor.setDate(cursor.getDate() - 1); } else break;
  }
  return streak;
}

function renderDashboard() {
  const total = notes.length;
  const today = todayKey(Date.now());
  const todayCount = notes.filter(n => todayKey(n.createdAt) === today).length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCount = notes.filter(n => n.createdAt >= weekAgo).length;
  const streak = computeStreak();
  const categories = {};
  notes.forEach(n => categories[n.subject] = (categories[n.subject] || 0) + 1);
  const top = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const goal = 14;
  const pct = Math.min(100, Math.round((weeklyCount / goal) * 100));

  els.dashboard.innerHTML = `
    <div class="card"><h3>Total Notes</h3><div class="metric">${total}</div></div>
    <div class="card"><h3>Today Activity</h3><div class="metric">${todayCount}</div></div>
    <div class="card"><h3>Weekly Activity</h3><div class="metric">${weeklyCount}</div></div>
    <div class="card"><h3>Study Streak 🔥</h3><div class="metric">${streak} day${streak === 1 ? '' : 's'}</div></div>
    <div class="card"><h3>Weekly Goal</h3><div>${weeklyCount}/${goal} notes</div><div class="progress"><span style="width:${pct}%"></span></div></div>
    <div class="card"><h3>Top Subjects</h3>${top.map(([s, c]) => `<div>${s} <span class="badge">${c}</span></div>`).join('') || 'No data yet'}</div>
  `;
}

function renderSubjectFilter() {
  const subjects = [...new Set(notes.map(n => n.subject))].sort();
  els.filterSubject.innerHTML = '<option value="">All subjects</option>' + subjects.map(s => `<option ${s === subjectFilter ? 'selected' : ''}>${s}</option>`).join('');
}

function renderNotes() {
  const q = search.toLowerCase();
  const filtered = notes.filter(n => {
    const matchSearch = !q || `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase().includes(q);
    const matchSubject = !subjectFilter || n.subject === subjectFilter;
    return matchSearch && matchSubject;
  });

  els.notesContainer.innerHTML = filtered.length ? filtered.map(n => `
    <article class="note">
      <strong>${escapeHtml(n.title || '(Untitled)')}</strong>
      <p>${escapeHtml(n.content)}</p>
      <div class="note-meta">
        <span>Subject: ${escapeHtml(n.subject)}</span>
        <span>Priority: ${n.priority}</span>
        <span>Updated: ${fmtDate(n.updatedAt)}</span>
      </div>
      <div class="note-meta">${n.tags.map(t => `<span class="badge">#${escapeHtml(t)}</span>`).join(' ')}</div>
      <div class="note-actions">
        <button type="button" onclick="openNote('${n.id}')">Open</button>
        <button type="button" onclick="deleteNote('${n.id}')">Delete</button>
      </div>
    </article>
  `).join('') : '<p>No notes found.</p>';
}

function renderTimeline() {
  const recent = [...notes].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)).slice(0, 8);
  els.timeline.innerHTML = recent.length ? recent.map(n => `<div class="timeline-item">${escapeHtml(n.title || '(Untitled)')} — last opened ${new Date(n.lastOpenedAt).toLocaleString()}</div>`).join('') : '<p>No recent activity yet.</p>';
}

function escapeHtml(str) {
  return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function initTheme() {
  const existing = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', existing);
  els.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  });
}

function renderAll() {
  renderSubjectFilter();
  renderDashboard();
  renderNotes();
  renderTimeline();
}

els.addBtn.addEventListener('click', addNote);
els.searchInput.addEventListener('input', e => { search = e.target.value; renderNotes(); });
els.filterSubject.addEventListener('change', e => { subjectFilter = e.target.value; renderNotes(); });

initTheme();
renderAll();
