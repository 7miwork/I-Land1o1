/* ============================================================
   I-Land1o1 – Schüler-Dashboard (Level 1)
   Lektionsliste + Video-Modal + Fortschritt (localStorage)
   ============================================================ */

// Videos liegen auf dem Server unter /Videos/... (FTP-Bereich, nicht im Git)
// Die Inhalte selbst werden in lessons.js gepflegt (window.ILAND_LESSONS)
const LESSONS = window.ILAND_LESSONS || [];

const TYPE_ICONS = { start: '🏴‍☠️', kapitel: '⛵', lektion: '⛏️' };

// Fortschritt wird pro Account (Supabase-User-ID) getrennt gespeichert
const STORAGE_PREFIX = 'iland-progress-de-level1:';
let storageKey = STORAGE_PREFIX + 'anon';
let sbClient = null; // Supabase-Client (von auth.js übergeben), null = nur lokal
let currentUserId = 'anon';


const grid = document.getElementById('lessonGrid');
const progressCount = document.getElementById('progressCount');
const progressFill = document.getElementById('progressFill');
const progressMsg = document.getElementById('progressMsg');

const modal = document.getElementById('videoModal');
const modalTitle = document.getElementById('modalTitle');
const modalVideo = document.getElementById('modalVideo');
const modalClose = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalDone = document.getElementById('modalDone');

let currentLesson = null;

function loadDone() {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  } catch {
    return new Set();
  }
}

function saveDone(done) {
  localStorage.setItem(storageKey, JSON.stringify([...done]));
}

let done = loadDone();

function updateProgress() {
  const total = LESSONS.length;
  const count = LESSONS.filter((l) => done.has(l.id)).length;
  progressCount.textContent = `${count} / ${total}`;
  progressFill.style.width = `${(count / total) * 100}%`;
  if (count === 0) progressMsg.textContent = 'Lege los, kleiner Pirat! ⚓';
  else if (count < total) progressMsg.textContent = 'Stark! Jeder Schatz braucht Geduld – weiter geht\u2019s! 💪';
  else progressMsg.textContent = 'GRATULIERE! Level 1 gemeistert – du bist ein echter Coding-Pirat! 🏆🎉';
}

function render() {
  grid.innerHTML = '';
  LESSONS.forEach((lesson) => {
    const isDone = done.has(lesson.id);
    const card = document.createElement('article');
    card.className = 'card' + (isDone ? ' is-done' : '');
    card.innerHTML = `
      <span class="card-badge">${isDone ? 'ERLEDIGT ✓' : 'OFFEN'}</span>
      <span class="card-num">${TYPE_ICONS[lesson.type] || '🧭'} ${lesson.num}</span>
      <h3 class="card-title">${lesson.title}</h3>
      <p class="card-desc">${lesson.desc}</p>
      ${lesson.task ? `<p class="card-task">🎯 ${lesson.task}</p>` : ''}
      <div class="card-actions">
        <button class="btn btn-play" data-action="play" data-id="${lesson.id}">▶ Video starten</button>
        <button class="btn btn-done" data-action="toggle" data-id="${lesson.id}">
          ${isDone ? '✓ Erledigt' : 'Als erledigt markieren'}
        </button>
      </div>`;
    grid.appendChild(card);
  });
  updateProgress();
}

function openModal(lesson) {
  currentLesson = lesson;
  modalTitle.textContent = `${lesson.num}: ${lesson.title}`;
  modalVideo.src = lesson.video;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalVideo.play().catch(() => {/* Auto-Play kann vom Browser blockiert werden */});
}

function closeModal() {
  modalVideo.pause();
  modalVideo.removeAttribute('src');
  modalVideo.load();
  modal.hidden = true;
  document.body.style.overflow = '';
  currentLesson = null;
}

function toggleDone(id) {
  const nowDone = !done.has(id);
  if (nowDone) done.add(id);
  else done.delete(id);
  saveDone(done);
  render();
  syncToServer(id, nowDone);
}

/* ---- Server-Sync (Supabase-Tabelle lesson_progress) ----
   Lokal speichern ist sofort da (optimistisch), der Server folgt im Hintergrund. */

async function syncToServer(lessonId, isDone) {
  if (!sbClient || currentUserId === 'anon') return;
  const { error } = await sbClient
    .from('lesson_progress')
    .upsert(
      { user_id: currentUserId, lesson_id: lessonId, done: isDone, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    );
  if (error) console.warn('Fortschritt nicht synchronisiert:', error.message);
}

async function hydrateFromServer() {
  if (!sbClient || currentUserId === 'anon') return;
  try {
    const { data, error } = await sbClient
      .from('lesson_progress')
      .select('lesson_id, done')
      .eq('user_id', currentUserId);
    if (error) throw error;
    const rows = data || [];
    const serverDone = new Set(rows.filter((r) => r.done).map((r) => r.lesson_id));
    const known = new Set(rows.map((r) => r.lesson_id));
    // Lokal bereits geschafft, aber dem Server noch unbekannt -> einmalig hochladen
    const missing = [...done].filter((id) => !known.has(id));
    done = new Set([...serverDone, ...done]);
    saveDone(done);
    if (missing.length) {
      await sbClient
        .from('lesson_progress')
        .upsert(
          missing.map((id) => ({ user_id: currentUserId, lesson_id: id, done: true })),
          { onConflict: 'user_id,lesson_id' }
        );
    }
    render();
  } catch (err) {
    // Tabelle fehlt o.ä. -> Dashboard läuft lokal einfach weiter
    console.warn('Server-Fortschritt nicht geladen:', err.message);
  }
}

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const lesson = LESSONS.find((l) => l.id === btn.dataset.id);
  if (!lesson) return;
  if (btn.dataset.action === 'play') openModal(lesson);
  else toggleDone(lesson.id);
});

modalDone.addEventListener('click', () => {
  if (!currentLesson) return;
  if (!done.has(currentLesson.id)) toggleDone(currentLesson.id);
  closeModal();
});

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

// Start erfolgt durch auth.js -> initDashboard(userId, supabaseClient)
window.initDashboard = function (userId, client) {
  sbClient = client || null;
  currentUserId = userId || 'anon';
  storageKey = STORAGE_PREFIX + currentUserId;
  done = loadDone();
  render();
  hydrateFromServer();
};
