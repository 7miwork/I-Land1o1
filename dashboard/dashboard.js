/* I-Land1o1 Dashboard JS - Lesson Pages System */
const LESSONS = window.ILAND_LESSONS || [];
const TYPE_ICONS = { start: '🏴‍☠️', kapitel: '⛵', lektion: '⛏️' };
const STORAGE_PREFIX = 'iland-progress-de-level1:';
let storageKey = STORAGE_PREFIX + 'anon';
let sbClient = null;
let currentUserId = 'anon';
let userRole = 'student';
const grid = document.getElementById('lessonGrid');
const progressCount = document.getElementById('progressCount');
const progressFill = document.getElementById('progressFill');
const progressMsg = document.getElementById('progressMsg');
const lessonPageContainer = document.getElementById('lessonPageContainer');
let hasAccess = null;
let done = new Set();

// Prüft (serverseitig per RLS/RPC), ob für dieses Konto ein Abo gilt
async function checkAccess() {
  if (!sbClient || currentUserId === 'anon') return;
  try {
    const { data, error } = await sbClient.rpc('has_course_access');
    if (!error) {
      hasAccess = !!data;
      // Bei Abo: Sequenzial-Freischaltung prüfen
      if (hasAccess && userRole === 'parent') {
        await checkMonthlySequenceAccess();
      }
      render();
    }
  } catch (err) {
    console.warn('Zugang nicht prüfbar:', err.message);
  }
}

// Prüft welche Lektionen aufgrund des Abo-Monats freigeschaltet sind
async function checkMonthlySequenceAccess() {
  if (!sbClient) return;
  try {
    const { data: profile, error: pError } = await sbClient
      .from('profiles')
      .select('created_at')
      .eq('id', currentUserId)
      .single();
    if (pError) throw pError;

    const created = new Date(profile.created_at);
    const now = new Date();
    const monthsDiff = Math.floor((now - created) / (30 * 24 * 60 * 60 * 1000));
    const maxLessonsPerMonth = 4;
    const unlockedCount = Math.min(maxLessonsPerMonth * (monthsDiff + 1), LESSONS.length);

    const done = loadDone();
    const alreadyDoneCount = LESSONS.filter((l) => done.has(l.id)).length;
    const monthForCurrent = Math.floor(alreadyDoneCount / maxLessonsPerMonth);

    LESSONS.forEach((lesson, idx) => {
      const lessonMonth = Math.floor(idx / maxLessonsPerMonth);
      if (lessonMonth <= monthsDiff) {
        lesson._unlocked = true;
      } else if (lessonMonth === monthsDiff + 1 && idx < unlockedCount) {
        lesson._unlocked = idx < unlockedCount;
      } else {

// Fortschritt pro Lektion (localStorage + Server-Sync)
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

// Fortschritts-Update
function updateProgress() {
  const total = LESSONS.length;
  const count = LESSONS.filter((l) => done.has(l.id)).length;
  progressCount.textContent = `${count} / ${total}`;
  progressFill.style.width = `${(count / total) * 100}%`;
  if (count === 0) progressMsg.textContent = 'Lege los, kleiner Pirat! ⚓';
  else if (count < total) progressMsg.textContent = 'Stark! Jeder Schatz braucht Geduld – weiter gehts! 💪';
  else progressMsg.textContent = 'GRATULIERE! Level 1 gemeistert – du bist ein echter Coding-Pirat! 🏆🎉';

  // resumeBtn veraltet – wir nutzen jetzt die Lektionen-Seite
  if (resumeBtn) {
    resumeBtn.hidden = true;

// Neue Lektionen-Seite rendern (pro Lektion als eigene Seite)
function renderLessonPage(lesson) {
  const isUnlocked = lesson._unlocked !== false;
  if (!isUnlocked) {
    grid.innerHTML = `<p class="access-msg">Diese Lektion ist noch nicht freigeschaltet.</p>`;
    return;
  }

  const videoSrc = lesson.video || '/Videos/placeholder.mp4';
  const isDone = done.has(lesson.id);

  // HTML für die Lektionen-Seite
  const pageHTML = `
    <header class="lesson-header">
      <h1 class="lesson-title">${lesson.title}</h1>
      <div class="lesson-progress">
        <span class="progress-text">Lektion ${lesson.num} von ${LESSONS.length}</span>
        <progress class="lesson-progress-bar" max="${LESSONS.length}" value="${done.has(lesson.id) ? LESSONS.indexOf(lesson) + 1 : done.size}"></progress>
      </div>
    </header>

    <main class="lesson-content">
      <!-- Video Bereich -->
      <section class="video-section">
        <div class="video-wrapper">
          <video controls preload="metadata" class="lesson-video" id="lesson-video-${lesson.id}">
            <source src="${videoSrc}" type="video/mp4">
            Dein Browser unterstützt keine Videowiedergabe.
          </video>
          <div class="video-controls">
            <button class="btn-play-pause" id="play-pause-${lesson.id}">▶</button>
            <div class="time-display">
              <span class="current-time">0:00</span>
              <span class="duration">0:00</span>
            </div>
          </div>
        </div>
        <div class="video-info">
          <p class="video-desc">${lesson.desc}</p>
        </div>
      </section>

      <!-- Tabs Register für Inhalte -->
      <div class="lesson-tabs">
        <button class="tab-btn active" data-tab="explanation">📖 Erklärung</button>
        <button class="tab-btn" data-tab="quiz">❓ Quiz</button>
        <button class="tab-btn" data-tab="tips">💡 Tipps</button>
        <button class="tab-btn" data-tab="ki">🤖 KI-Assistent</button>
      </div>

      <!-- Tab: Erklärung -->
      <div class="tab-content active" id="tab-explanation-${lesson.id}">
        <div class="explanation-text">${lesson.desc || 'Keine Beschreibung verfügbar.'}</div>
      </div>

      <!-- Tab: Quiz -->
      <div class="tab-content" id="tab-quiz-${lesson.id}">
        <div class="quiz-container">
          <h3>Quiz: ${lesson.title}</h3>
          <p>Teste dein Wissen zur Lektion.</p>
          <form class="quiz-form" id="quiz-form-${lesson.id}">
            <div class="quiz-questions" id="quiz-questions-${lesson.id}"></div>
          </form>
          <div class="quiz-result" hidden>
            <p id="quiz-result-text-${lesson.id}"></p>
            <button class="btn btn-continue" id="next-lesson-${lesson.id}">Zur nächsten Lektion</button>
          </div>
        </div>
      </div>

      <!-- Tab: Tipps -->
      <div class="tab-content" id="tab-tips-${lesson.id}">
        <div class="tips-list">
          <p>${lesson.desc || 'Keine Tipps verfügbar.'}</p>
          <small>Hier erscheinen praktische Tipps und Tricks zur Minecraft-Aufgabe.</small>
        </div>
      </div>

      <!-- Tab: KI-Assistent -->

// Tabs für eine Lektion einrichten
function setupLessonTabs(lessonId) {
  const tabs = document.querySelectorAll('.lesson-tabs .tab-btn');
  const tabContents = document.querySelectorAll('.lesson-page .tab-content');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      tabContents.forEach((content) => content.classList.remove('active'));
      const activeContent = document.getElementById(`tab-${tabName}-${lessonId}`);
      if (activeContent) {
        activeContent.classList.add('active');
        // Tab-State speichern
        try { localStorage.setItem(`lesson-tab-state-${lessonId}`, tabName); } catch (e) {}
      }
    });
  });
}

// Video-Element für Lektion einrichten
function setupLessonVideo(lessonId) {
  const video = document.getElementById(`lesson-video-${lessonId}`);
  const playPause = document.getElementById(`play-pause-${lessonId}`);
  if (!video) return;

  if (playPause) {
    playPause.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        playPause.textContent = '⏸️';
      } else {
        video.pause();
        playPause.textContent = '▶';
      }
    });
  }
  video.addEventListener('play', () => {
    if (playPause) playPause.textContent = '⏸️';
  });
  video.addEventListener('pause', () => {
    if (playPause) playPause.textContent = '▶';
  });
}

// Quiz-Fragen generieren und einrichten
function setupLessonQuiz(lessonId, lessonNum) {
  const quizForm = document.getElementById(`quiz-form-${lessonId}`);
  const quizQuestions = document.getElementById(`quiz-questions-${lessonId}`);
  const quizResultText = document.getElementById(`quiz-result-text-${lessonId}`);
  const nextLessonBtn = document.getElementById(`next-lesson-${lessonId}`);

  if (!quizForm || !quizQuestions) return;

  // 3 Quiz-Fragen basierend auf Lektionsnummer
  const questions = generateQuizQuestions(parseInt(lessonNum));

  let html = '';
  questions.forEach((q, idx) => {
    html += `
      <div class="quiz-question">
        <p><strong>${idx + 1}. ${q.question}</strong></p>
        <div class="quiz-options">
          ${q.options.map((opt, i) => `
            <label class="quiz-option">
              <input type="radio" name="q${idx}" value="${i}" required>
              ${opt}
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });
  quizQuestions.innerHTML = html;

  quizForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const allCorrect = questions.every((q, i) => {
      const sel = document.querySelector(`input[name="q${i}"]:checked`);
      return sel && parseInt(sel.value) === q.correct;
    });

    if (!document.querySelector('.quiz-questions input:checked')) {

// "Als erledigt" Button handler
function setupLessonCompleteButton(lessonId) {
  const completeBtn = document.querySelector(`.lesson-footer .btn-complete[data-lesson-id="${lessonId}"]`);
  if (!completeBtn) return;

  completeBtn.addEventListener('click', () => {
    if (done.has(lessonId)) return;
    done.add(lessonId);
    saveDone(done);
    updateProgress();
    completeBtn.textContent = '✓ Erledigt';
    completeBtn.disabled = true;
    syncToServer(lessonId, true);
    setTimeout(() => renderLessonList(), 1000);
  });
}

// Lektions-Liste rendern (Gitter mit Klick-Link zu Lektionen-Seiten)
function renderLessonList() {
  const done = loadDone();
  if (!grid) return;
  grid.innerHTML = '';

  LESSONS.forEach((lesson) => {
    const isUnlocked = lesson._unlocked !== false;
    const isDone = done.has(lesson.id);
    const locked = !isUnlocked;
    const card = document.createElement('article');
    card.className = 'card' + (isDone ? ' done' : '') + (locked ? ' locked' : '');
    card.innerHTML = `
      <div class="card-header">
        <span class="card-icon">${TYPE_ICONS[lesson.type] || ''}</span>
        <h3 class="card-title">${lesson.title}</h3>
        ${locked ? '<span class="card-lock">🔒</span>' : ''}
      </div>
      <div class="card-body">
        <p class="card-desc">${lesson.desc}</p>
      </div>
      <div class="card-footer">
        ${isDone ? '<span class="card-done">✓ Erledigt</span>' : locked ? '<span class="card-locked">Gesperrt</span>' : '<button class="btn btn-play small" data-action="open-lesson" data-id="' + lesson.id + '">Öffnen</button>'}
      </div>
    `;
    grid.appendChild(card);
  });
  setupLessonLinks();
}

// Links zu Lektionen-Seiten einrichten
function setupLessonLinks() {
  const lessonLinks = document.querySelectorAll('.btn.open-lesson');
  lessonLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const lesson = LESSONS.find((l) => l.id === link.dataset.id);
      if (lesson) renderLessonPage(lesson);
    });
  });
}

// Server-Sync
async function syncToServer(lessonId, isDone) {
  if (!sbClient || currentUserId === 'anon') return;
  const { error } = await sbClient.from('lesson_progress').upsert(
    { user_id: currentUserId, lesson_id: lessonId, done: isDone, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,lesson_id' }
  );
  if (error) console.warn('Fortschritt nicht synchronisiert:', error.message);
}

// Server-Fortschritt laden
async function hydrateFromServer() {
  if (!sbClient || currentUserId === 'anon') return;
  try {
    const { data, error } = await sbClient.from('lesson_progress').select('lesson_id, done').eq('user_id', currentUserId);
    if (error) throw error;
    const rows = data || [];
    const serverDone = new Set(rows.filter((r) => r.done).map((r) => r.lesson_id));
    const known = new Set(rows.map((r) => r.lesson_id));
    const missing = [...done].filter((id) => !known.has(id));
    done = new Set([...serverDone, ...done]);
    saveDone(done);
    if (missing.length) {
      await sbClient.from('lesson_progress').upsert(
        missing.map((id) => ({ user_id: currentUserId, lesson_id: id, done: true })),
        { onConflict: 'user_id,lesson_id' }
      );
    }
  } catch (err) {
    console.warn('Server-Fortschritt nicht geladen:', err.message);
  }
}

// Start-Funktion
function initDashboard(userId, client, role) {
  sbClient = client || null;
  currentUserId = userId || 'anon';
  userRole = role || 'student';
  storageKey = STORAGE_PREFIX + currentUserId;
  done = loadDone();

  checkAccess().then(() => {
    // ★ WICHTIG: Für Kind/Student-Accounts alle Lektionen freischalten ★
    // (monatliche Sequenz nur bei Eltern-Accounts)
    if (userRole !== 'parent') {
      LESSONS.forEach((lesson) => {
        lesson._unlocked = true;
      });
    }
    renderLessonList();
    updateProgress();
    setupLessonLinks();
    hydrateFromServer();
  });
}

// Export für auth.js
window.initDashboard = initDashboard;
      quizResultText.innerHTML = '<span class="wrong">Bitte alle Fragen beantworten!</span>';
      quizResultText.hidden = false;
      return;
    }

    if (allCorrect) {
      const password = generatePassword(lessonId);
      quizResultText.innerHTML = `
        <span class="correct">Richtig! 🎉</span>
        <p>Passwort für Minecraft-Welt: <code>${password}</code></p>
      `;
      saveLessonPassword(lessonId, password);
    } else {
      quizResultText.innerHTML = '<span class="wrong">Fast! 😢</span><p>Überprüfe deine Antworten.</p>';
    }
    quizResultText.hidden = false;
  });

  if (nextLessonBtn) {
    nextLessonBtn.addEventListener('click', () => {
      const nextLesson = LESSONS.find((l) => !done.has(l.id) && l._unlocked !== false);
      if (nextLesson) renderLessonPage(nextLesson);
    });
  }
}

// Beispiel-Quiz-Fragen generieren (kann später mit echten Inhalten ersetzt werden)
function generateQuizQuestions(lessonNum) {
  const baseQuestions = [
    {
      question: 'Was ist der Hauptblock im Code Builder?',
      options: ['Ein Schwert', 'Ein Buch und Feder', 'Eine Pickaxe', 'Ein Pferd'],
      correct: 1
    },
    {
      question: 'Wie startest du den Code Builder?',
      options: ['Taste C', 'Taste E', 'Rechtsklick', 'Befehl /code'],
      correct: 3
    },
    {
      question: 'Welche Farbe hat der Fortschrittsbalken?',
      options: ['Blau', 'Rot', 'Gold', 'Grün'],
      correct: 2
    }
  ];
  const idx = (lessonNum - 1) % baseQuestions.length;
  const q = { ...baseQuestions[idx] };
  const options = [...q.options].sort(() => Math.random() - 0.5);
  return {
    question: q.question,
    options: options,
    correct: options.indexOf(q.options[q.correct])
  };
}

// Passwort generieren
function generatePassword(lessonId) {
  const base = lessonId.replace('l', '').padStart(2, '0');
  const random = Math.floor(100 + Math.random() * 900);
  return `${base}${random}`;
}

// Passwort speichern
function saveLessonPassword(lessonId, password) {
  const passwords = JSON.parse(localStorage.getItem('iland-lesson-passwords') || '{}');
  passwords[lessonId] = password;
  localStorage.setItem('iland-lesson-passwords', JSON.stringify(passwords));
  if (sbClient && currentUserId !== 'anon') {
    try {
      sbClient.from('lesson_passwords').upsert({
        user_id: currentUserId, lesson_id: lessonId, password: password, used: false, created_at: new Date().toISOString()
      });
    } catch (err) { console.warn('Passwort nicht gespeichert'); }
  }
}
      <div class="tab-content" id="tab-ki-${lesson.id}">
        <div class="ki-assistant-placeholder">
          <span class="pirate-symbol">🏴‍☠️</span>
          <p>KI-Assistent: Fragen zum Video-Inhalt. Kommt bald!</p>
          <small>Platzhalter – wird später mit KI-Integration erweitert.</small>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="lesson-footer">
      <button class="btn btn-complete" data-action="complete-lesson" data-lesson-id="${lesson.id}">
        ${isDone ? '✓ Erledigt' : '✅ Als erledigt markieren'}
      </button>
      <div class="lesson-hint" hidden>
        <p>Alle Inhalte dieser Lektion wurden abgerufen.</p>
      </div>
    </footer>
  `;

  lessonPageContainer.innerHTML = pageHTML;
  setupLessonTabs(lesson.id);
  setupLessonVideo(lesson.id);
  setupLessonQuiz(lesson.id, lesson.num);
  setupLessonCompleteButton(lesson.id);
}
  }
}
        lesson._unlocked = false;
      }
    });
  } catch (err) {
    console.warn('Monatliche Zugangskontrolle fehlgeschlagen:', err.message);
    LESSONS.forEach((l) => l._unlocked = false);
  }
}
