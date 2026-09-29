/* ============================================================
   I-Land1o1 – Schüler-Dashboard (Level 1)
   Lektionsliste + Video-Modal + Fortschritt (localStorage)
   ============================================================ */

// Videos liegen auf dem Server unter /Videos/... (FTP-Bereich, nicht im Git)
const LESSONS = [
  {
    id: 'start',
    num: 'Intro',
    title: 'Willkommen an Bord',
    desc: 'Lerne deine Crew, dein Schiff und Minecraft Education kennen – der perfekte Start in dein erstes Abenteuer!',
    video: '/Videos/DE/DE Start.mp4',
  },
  {
    id: 'schiff',
    num: 'Kapitel',
    title: 'Das Schiff',
    desc: 'Zusammen bauen wir euer Klassen-Schiff – die Basis für alle weiteren Level-1-Abenteuer.',
    video: '/Videos/DE/DE Schiff.mp4',
  },
  ...Array.from({ length: 11 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      id: `l${n}`,
      num: `Lektion ${n}`,
      title: `Lektion ${n}`,
      desc: 'Video ansehen, Aufgabe in Minecraft Education lösen und danach als erledigt markieren. ⛏️',
      video: `/Videos/DE/Level 1/DE Level 1 Lesson ${n}.mp4`,
    };
  }),
];

// Fortschritt wird pro Account (Supabase-User-ID) getrennt gespeichert
const STORAGE_PREFIX = 'iland-progress-de-level1:';
let storageKey = STORAGE_PREFIX + 'anon';


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
      <span class="card-num">${lesson.num}</span>
      <h3 class="card-title">${lesson.title}</h3>
      <p class="card-desc">${lesson.desc}</p>
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
  if (done.has(id)) done.delete(id);
  else done.add(id);
  saveDone(done);
  render();
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

// Start erfolgt durch auth.js -> initDashboard(userId)
window.initDashboard = function (userId) {
  storageKey = STORAGE_PREFIX + (userId || 'anon');
  done = loadDone();
  render();
};
