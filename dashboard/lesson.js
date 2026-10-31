/* ============================================================
   I-Land1o1 – Single Lesson Page (Level 1, Mehrsprachig)
   ------------------------------------------------------------
   Aufruf: /dashboard/lesson.html?level=level1&part=part1&lang=de&id=l01
   Lädt Lektion aus JSON, zeigt Video klein mit Play-Overlay,
   Quiz + Test mit A/B/C/D, Zufallsgenerator, Bewertung + Passwort.
   ============================================================ */

(function () {
  const cfg = window.ILAND_CONFIG || {};
  const isConfigured =
    typeof cfg.SUPABASE_URL === 'string'
    && cfg.SUPABASE_URL.indexOf('HIER_') !== 0
    && /^https:\/\/.+\..+/.test(cfg.SUPABASE_URL)
    && typeof cfg.SUPABASE_ANON_KEY === 'string'
    && cfg.SUPABASE_ANON_KEY.indexOf('HIER_') !== 0
    && cfg.SUPABASE_ANON_KEY.length > 20;

  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') || 'level1';
  const part = params.get('part') || 'part1';
  const lang = params.get('lang') || 'de';
  const lessonId = params.get('id');

  let lesson = null;

  const els = {
    title: document.getElementById('lessonTitle'),
    num: document.getElementById('lessonNum'),
    badge: document.getElementById('lessonBadge'),
    desc: document.getElementById('lessonDesc'),
    video: document.getElementById('lessonVideo'),
    explanation: document.getElementById('lessonExplanation'),
    quizBox: document.getElementById('quizBox'),
    testBox: document.getElementById('testBox'),
    quizResult: document.getElementById('quizResult'),
    testResult: document.getElementById('testResult'),
    passwordResult: document.getElementById('passwordResult'),
    scoreBox: document.getElementById('scoreBox'),
    doneBtn: document.getElementById('btnDone'),
    backBtn: document.getElementById('btnBack'),
    lock: document.getElementById('lockNotice'),
    content: document.getElementById('lessonContent'),
    langLabel: document.getElementById('langLabel'),
  };

  let sbClient = null;
  let currentUserId = 'anon';
  let hasAccess = null;
  let lessonAccess = null;
  let done = new Set();
  let quizState = null;
  let testState = null;

  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Lektions-Reihenfolge (kein Überspringen) ----------
  function lessonNumber(id) {
    var m = String(id).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 9999;
  }

  function getPreviousLessonIds(currentId) {
    // Alle bekannten Lektionen derselben Sprache/Part mit kleinerer Nummer
    var all = [];
    for (var k in window.ILAND_LEVELS) {
      if (window.ILAND_LEVELS.hasOwnProperty(k)) {
        var l = window.ILAND_LEVELS[k];
        if (l.lang === lang && l.part === part && l.level === level) {
          all.push(l.id);
        }
      }
    }
    all.sort(function (a, b) { return lessonNumber(a) - lessonNumber(b); });
    var idx = all.indexOf(currentId);
    return idx > 0 ? all.slice(0, idx) : [];
  }

  async function checkLessonAccess(targetId) {
    var result = { allowed: true, reason: '', remaining: null };

    // 1. Reihenfolge: alle vorherigen Lektionen müssen done sein
    var previous = getPreviousLessonIds(targetId);
    for (var i = 0; i < previous.length; i++) {
      if (!done.has(previous[i])) {
        var prevLesson = window.ILAND_LEVELS[level + '/' + part + '/' + lang + '/' + previous[i]];
        var prevName = prevLesson ? prevLesson.num : previous[i];
        result.allowed = false;
        result.reason = 'Bitte mache erst die Lektionen der Reihe nach (aktuell: ' + prevName + ').';
        return result;
      }
    }

    // 2. Wenn nicht angemeldet oder kein Supabase -> lokal freigeben (Entwicklung)
    if (!sbClient || currentUserId === 'anon') { return result; }

    // 3. Genereller Zugang (Einmal-Kauf = alles frei, Abo = geprüft)
    try {
      const { data, error } = await sbClient.rpc('has_course_access');
      if (!error) {
        if (!data) {
          result.allowed = false;
          result.reason = 'Du brauchst ein aktives Abo oder einen einmaligen Kauf für diese Lektion.';
          return result;
        }
      } else {
        console.warn('has_course_access Fehler:', error.message);
      }
    } catch (err) { console.warn('Zugang nicht prüfbar:', err.message); }

    // 4. Monatliches Kontingent für Abo-Nutzer (nur wenn has_course_access true war)
    try {
      const { data: quota, error: qerr } = await sbClient.rpc('get_lesson_quota', { target_lesson_id: targetId });
      if (!qerr && quota) {
        if (quota.allowed === false) {
          result.allowed = false;
          result.reason = quota.reason || 'Dein monatliches Lektionskontingent ist aufgebraucht.';
        }
        if (quota.remaining !== undefined) result.remaining = quota.remaining;
      }
    } catch (err) {
      // RPC existiert noch nicht -> Kontingent-Prüfung überspringen (graceful)
      console.warn('get_lesson_quota RPC noch nicht verfügbar:', err.message);
    }

    return result;
  }

  async function loadLessonFromJson() {
    if (!lessonId) {
      document.body.innerHTML = '<p style="padding:2rem;font-family:Nunito,sans-serif;color:#f0ad4e;">Keine Lektion angegeben. <a href="/dashboard/">Zurück zum Dashboard</a></p>';
      return;
    }

    let tries = 0;
    while (!window.ILAND_LEVELS || Object.keys(window.ILAND_LEVELS).length === 0) {
      if (tries++ > 50) break;
      await new Promise(r => setTimeout(r, 100));
    }

    const key = level + '/' + part + '/' + lang + '/' + lessonId;
    lesson = window.ILAND_LEVELS[key];

    if (!lesson) {
      try {
        const resp = await fetch('/dashboard/levels/' + level + '/' + part + '/' + lang + '/lessons/' + lessonId + '/lesson.json');
        if (resp.ok) lesson = await resp.json();
      } catch (e) { console.warn('JSON-Laden fehlgeschlagen:', e); }
    }

    // Fallback: alte lessons.js Daten nutzen, wenn noch keine JSON existiert
    if (!lesson && window.ILAND_LESSONS) {
      var old = window.ILAND_LESSONS.find(function (l) { return l.id === lessonId; });
      if (old) {
        lesson = {
          id: old.id,
          level: level,
          part: part,
          lang: lang,
          num: old.num,
          title: old.title,
          desc: old.desc,
          task: old.task,
          video: old.video,
          explanation: old.desc,
          quiz: [],
          test: [],
          password: { threshold: 80, encrypted: '' }
        };
      }
    }

    if (!lesson) {
      document.body.innerHTML = '<p style="padding:2rem;font-family:Nunito,sans-serif;color:#f0ad4e;">Lektion nicht gefunden. <a href="/dashboard/">Zurück zum Dashboard</a></p>';
      return;
    }

    if (els.langLabel) els.langLabel.textContent = '(' + lesson.lang.toUpperCase() + ')';
    lessonAccess = await checkLessonAccess(lesson.id);
    render();
  }

  const STORAGE_PREFIX = 'iland-progress-de-level1:';
  function loadDone() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_PREFIX + currentUserId) || '[]')); } catch { return new Set(); }
  }
  function saveDone(set) { localStorage.setItem(STORAGE_PREFIX + currentUserId, JSON.stringify([...set])); }

  async function checkAccess() {
    if (!sbClient || currentUserId === 'anon') { hasAccess = true; render(); return; }
    try {
      const { data, error } = await sbClient.rpc('has_course_access');
      if (!error) hasAccess = !!data;
    } catch (err) { console.warn('Zugang nicht prüfbar:', err.message); hasAccess = true; }
    render();
  }

  async function loadVideo() {
    const videoEl = els.video;
    if (!videoEl) return;
    if (sbClient) {
      try {
        const { data, error } = await sbClient.functions.invoke('get-video-url', {
          body: { lessonId: lesson.id },
        });
        if (!error && data && data.url) {
          videoEl.src = data.url;
          return;
        }
        if (data && data.locked) { hasAccess = false; render(); return; }
      } catch (err) { console.warn('get-video-url Fehler:', err.message); }
    }
    videoEl.src = lesson.video;
  }

  function prepareQuestions(raw) {
    const shuffled = shuffle(raw);
    return shuffled.map(function (q) {
      const opts = q.options.slice();
      const correctText = opts[q.correct];
      const mixedOpts = shuffle(opts);
      const newCorrect = mixedOpts.indexOf(correctText);
      return {
        question: q.question,
        options: mixedOpts,
        correct: newCorrect,
        feedback: q.feedback,
      };
    });
  }

  function renderQuestions(box, questions, kind) {
    box.innerHTML = '';
    questions.forEach(function (q, qi) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'q-block';
      const legend = document.createElement('legend');
      legend.textContent = (qi + 1) + '. ' + q.question;
      fieldset.appendChild(legend);

      var letters = ['A', 'B', 'C', 'D'];
      q.options.forEach(function (opt, ai) {
        var id = kind + '-' + qi + '-' + ai;
        var label = document.createElement('label');
        label.className = 'q-option';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = kind + '-' + qi;
        input.id = id;
        input.value = ai;
        label.appendChild(input);
        label.append(' ' + letters[ai] + '. ' + opt.replace(/^[A-D]\)\s*/, ''));
        fieldset.appendChild(label);
      });
      box.appendChild(fieldset);
    });
  }

  function scoreQuestions(questions, kind) {
    var correct = 0;
    questions.forEach(function (q, qi) {
      var sel = document.querySelector('input[name="' + kind + '-' + qi + '"]:checked');
      if (sel && parseInt(sel.value, 10) === q.correct) correct++;
    });
    return correct;
  }

  function showResult(kind, correct, total) {
    var box = kind === 'quiz' ? els.quizResult : els.testResult;
    var pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    box.hidden = false;
    box.textContent = (kind === 'quiz' ? 'Quiz' : 'Test') + ': ' + correct + ' / ' + total + ' richtig (' + pct + '%). ' +
      (pct >= 60 ? 'Gut gemacht, Matrose!' : 'Noch einmal versuchen, kleiner Pirat!');
    box.className = pct >= 60 ? 'msg--ok' : 'msg--error';

    if (els.scoreBox) {
      els.scoreBox.hidden = false;
      els.scoreBox.textContent = 'Gesamt: ' + pct + '%';
    }

    if (kind === 'test' && lesson.password && pct >= lesson.password.threshold) {
      showPassword();
    }
  }

  function showPassword() {
    if (!els.passwordResult) return;
    var enc = lesson.password.encrypted;
    var pw = '';
    try { pw = atob(enc); } catch (e) { pw = enc; }
    els.passwordResult.hidden = false;
    els.passwordResult.textContent = '🎉 Passwort freigeschaltet: ' + pw;
    els.passwordResult.className = 'msg--ok';
  }

  async function markDone() {
    if (done.has(lesson.id)) return;
    done.add(lesson.id);
    saveDone(done);
    if (els.doneBtn) { els.doneBtn.textContent = '✓ Erledigt'; els.doneBtn.disabled = true; }
    if (els.badge) { els.badge.textContent = 'ERLEDIGT ✓'; els.badge.style.background = 'var(--green)'; }
    if (sbClient && currentUserId !== 'anon') {
      await sbClient.from('lesson_progress').upsert({
        user_id: currentUserId, lesson_id: lesson.id, done: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_id' }).catch(() => {});
    }

    // Monatliches Kontingent serverseitig erhöhen (nur Abo-Nutzer, graceful wenn RPC fehlt)
    if (sbClient && currentUserId !== 'anon') {
      try {
        await sbClient.rpc('increment_lesson_quota', { finished_lesson_id: lesson.id }).catch(() => {});
      } catch (e) { /* RPC existiert noch nicht */ }
    }
  }

  function render() {
    if (!lesson) return;
    if (els.title) els.title.textContent = lesson.title;
    if (els.num) els.num.textContent = lesson.num;
    if (els.desc) els.desc.textContent = lesson.desc;
    if (els.badge) els.badge.textContent = done.has(lesson.id) ? 'ERLEDIGT ✓' : 'OFFEN';

    var locked = lesson.type === 'lektion' && lessonAccess && !lessonAccess.allowed;
    if (locked) {
      if (els.lock) { els.lock.hidden = false; els.lock.textContent = '🔒 ' + (lessonAccess.reason || 'Diese Lektion ist gesperrt.'); }
      if (els.content) els.content.hidden = true;
      if (els.doneBtn) els.doneBtn.hidden = true;
      if (els.video) els.video.hidden = true;
      return;
    }
    if (els.lock) els.lock.hidden = true;
    if (els.content) els.content.hidden = false;
    if (els.doneBtn) els.doneBtn.hidden = false;
    if (els.doneBtn) {
      els.doneBtn.textContent = done.has(lesson.id) ? '✓ Erledigt' : '✅ Als erledigt markieren';
      els.doneBtn.disabled = done.has(lesson.id);
    }

    if (els.explanation) els.explanation.textContent = lesson.explanation || '';

    var showQuiz = lesson.type === 'lektion';
    var hasQuiz = showQuiz && (lesson.quiz || []).length > 0;
    var hasTest = showQuiz && (lesson.test || []).length > 0;
    document.getElementById('quizSection').hidden = !hasQuiz;
    document.getElementById('testSection').hidden = !hasTest;

    if (hasQuiz) {
      if (!quizState) {
        quizState = prepareQuestions(lesson.quiz || []);
        testState = prepareQuestions(lesson.test || []);
      }
      renderQuestions(els.quizBox, quizState, 'quiz');
      document.getElementById('btnQuiz').onclick = function () { showResult('quiz', scoreQuestions(quizState, 'quiz'), quizState.length); };
      if (els.quizResult) els.quizResult.hidden = true;
    }
    if (hasTest) {
      if (!testState) {
        testState = prepareQuestions(lesson.test || []);
      }
      renderQuestions(els.testBox, testState, 'test');
      document.getElementById('btnTest').onclick = function () { showResult('test', scoreQuestions(testState, 'test'), testState.length); };
      if (els.testResult) els.testResult.hidden = true;
      if (els.passwordResult) els.passwordResult.hidden = true;
    }

    loadVideo();
  }

  var videoExpanded = false;
  var videoWrapper = document.getElementById('videoWrapper');
  var videoPlayOverlay = document.getElementById('videoPlayOverlay');
  var videoPlayBtn = document.getElementById('videoPlayBtn');
  var videoExpandBtn = document.getElementById('videoExpandBtn');

  function setVideoSize(expanded) {
    videoExpanded = expanded;
    if (expanded) {
      videoWrapper.classList.add('expanded');
      if (videoPlayOverlay) videoPlayOverlay.classList.add('hidden');
      if (videoExpandBtn) videoExpandBtn.textContent = '⇩';
      if (videoExpandBtn) videoExpandBtn.title = 'Verkleinern';
      els.video.play().catch(() => {});
    } else {
      videoWrapper.classList.remove('expanded');
      if (videoPlayOverlay) videoPlayOverlay.classList.remove('hidden');
      if (videoExpandBtn) videoExpandBtn.textContent = '⛶';
      if (videoExpandBtn) videoExpandBtn.title = 'Vergrößern';
      els.video.pause();
    }
  }

  function toggleVideo() {
    setVideoSize(!videoExpanded);
  }

  if (videoPlayBtn) {
    videoPlayBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setVideoSize(true);
    });
  }
  if (videoExpandBtn) {
    videoExpandBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleVideo();
    });
  }
  if (videoWrapper) {
    videoWrapper.addEventListener('click', function () {
      if (!videoExpanded) setVideoSize(true);
    });
  }
  if (els.video) {
    els.video.addEventListener('click', function () {
      if (!videoExpanded) setVideoSize(true);
    });
  }

  async function boot() {
    if (isConfigured && window.supabase) {
      sbClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      try {
        const { data, error } = await sbClient.auth.getSession();
        if (error) console.error('getSession error:', error);
        if (data && data.session && data.session.user) {
          currentUserId = data.session.user.id;
          try {
            const { data: prof } = await sbClient.from('profiles').select('display_name, role').eq('id', currentUserId).maybeSingle();
            var who = document.getElementById('authWho');
            if (who && prof) who.textContent = '🏴‍☠️ ' + (prof.display_name || data.session.user.email);
          } catch (e) { /* ignore */ }
        } else {
          window.location.replace('/login/index.html?next=' + encodeURIComponent('/dashboard/lesson.html?level=' + level + '&part=' + part + '&lang=' + lang + '&id=' + lessonId));
          return;
        }
      } catch (err) { console.error('Lesson boot failed:', err); }
    }
    done = loadDone();
    await loadLessonFromJson();
    // checkLessonAccess wurde bereits in loadLessonFromJson aufgerufen
  }

  if (els.doneBtn) els.doneBtn.addEventListener('click', markDone);
  if (els.backBtn) els.backBtn.addEventListener('click', function () { window.location.href = '/dashboard/'; });

  boot();
})();
