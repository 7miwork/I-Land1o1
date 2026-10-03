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
const resumeBtn = document.getElementById('resumeBtn');
const modalLock = document.getElementById('modalLock');

let hasAccess = null; // null = noch unbekannt, false = Abo nötig

// Prüft (serverseitig per RLS/RPC), ob für dieses Konto ein Abo gilt –
// beim Kind über den Eltern-Code, beim Elternteil über das eigene Abo.
async function checkAccess() {
  if (!sbClient || currentUserId === 'anon') return;
  try {
    const { data, error } = await sbClient.rpc('has_course_access');
    if (!error) {
      hasAccess = !!data;
      render();
    }
  } catch (err) {
    console.warn('Zugang nicht prüfbar:', err.message);
  }
}

if (resumeBtn) {
  resumeBtn.addEventListener('click', () => {
    const next = LESSONS.find((l) => !done.has(l.id));
    if (next) openModal(next);
  });
}

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
  const next = LESSONS.find((l) => !done.has(l.id));
  if (resumeBtn) {
    resumeBtn.hidden = !next;
    if (next) resumeBtn.textContent = count === 0 ? "⚓ Los geht's!" : '▶ Weiter geht\u2019s!';
  }
}

function render() {
  grid.innerHTML = '';
  LESSONS.forEach((lesson) => {
    const isDone = done.has(lesson.id);
    const locked = hasAccess === false;
    const card = document.createElement('article');
    card.className = 'card' + (isDone ? ' is-done' : '') + (locked ? ' is-locked' : '');
    card.innerHTML = `
      <span class="card-badge">${isDone ? 'ERLEDIGT ✓' : 'OFFEN'}</span>
      <span class="card-num">${TYPE_ICONS[lesson.type] || '🧭'} ${lesson.num}</span>
      <h3 class="card-title">${lesson.title}</h3>
      <p class="card-desc">${lesson.desc}</p>
      ${lesson.task ? `<p class="card-task">🎯 ${lesson.task}</p>` : ''}
      <div class="card-actions">
        <button class="btn btn-play" data-action="play" data-id="${lesson.id}">${
      locked ? '🔒 Gesperrt' : '▶ Video starten'
    }</button>
        <button class="btn btn-done" data-action="toggle" data-id="${lesson.id}">
          ${isDone ? '✓ Erledigt' : 'Als erledigt markieren'}
        </button>
      </div>`;
    grid.appendChild(card);
  });
  updateProgress();
}

async function openModal(lesson) {
  currentLesson = lesson;
  modalTitle.textContent = `${lesson.num}: ${lesson.title}`;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalLock.hidden = true;
  modalLock.textContent = '';
  if (modalDone) modalDone.hidden = false;
  modalVideo.removeAttribute('src');
  modalVideo.load();

  // Ohne Abo: kein Video, sondern Hinweis
  if (hasAccess === false) {
    showLock('🔒 Für diese Lektion brauchst du ein aktives Abo.\n'
      + 'Deine Eltern können es unter „⚓ Abo & Zahlung“ buchen – '
      + 'der Code im Bereich „👨‍👩‍👧 Familie“ schaltet dann alle Lektionen frei.');
    return;
  }

  // Video-URL kommt serverseitig (nur mit Abo, nur 5 Minuten gültig)
  if (sbClient) {
    const { data, error } = await sbClient.functions.invoke('get-video-url', {
      body: { lessonId: lesson.id },
    });
    if (error || !data || !data.url) {
      if (data && data.locked) {
        hasAccess = false;
        render();
        showLock('🔒 Für diese Lektion brauchst du ein aktives Abo.');
      } else {
        showLock('😢 Das Video konnte nicht geladen werden. Bitte kurz später nochmal versuchen.');
      }
      return;
    }
    modalVideo.src = data.url;
    modalVideo.play().catch(() => {/* Auto-Play kann der Browser blockieren */});
    return;
  }

  // Entwicklung ohne Supabase: direkt vom Server
  modalVideo.src = lesson.video;
  modalVideo.play().catch(() => {});
}

function showLock(text) {
  if (!modalLock) return;
  modalLock.hidden = false;
  modalLock.textContent = text;
  if (modalDone) modalDone.hidden = true; // gesperrte Lektion kann nicht abgehakt werden
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
  checkAccess();
};
