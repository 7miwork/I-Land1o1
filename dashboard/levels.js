/* ============================================================
   I-Land1o1 – Level-Loader
   Lädt Lektions-JSONs aus der Ordnerstruktur:
   /dashboard/levels/<level>/<part>/<lang>/lessons/<id>/lesson.json
   ============================================================ */

window.ILAND_LEVELS = window.ILAND_LEVELS || {};

async function loadLesson(level, part, lang, id) {
  const path = `/dashboard/levels/${level}/${part}/${lang}/lessons/${id}/lesson.json`;
  try {
    const resp = await fetch(path);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    console.warn('Lesson laden fehlgeschlagen:', path, err.message);
    return null;
  }
}

async function loadAllLessons() {
  const levels = ['level1'];
  const parts = ['part1'];
  const langs = ['de', 'en', 'zh'];
  const lessons = ['l01', 'l02', 'l03'];

  for (const level of levels) {
    for (const part of parts) {
      for (const lang of langs) {
        for (const id of lessons) {
          const lesson = await loadLesson(level, part, lang, id);
          if (lesson) {
            const key = `${level}/${part}/${lang}/${id}`;
            window.ILAND_LEVELS[key] = lesson;
          }
        }
      }
    }
  }
  console.log(`${Object.keys(window.ILAND_LEVELS).length} Lektionen geladen`);
}

// Automatisch laden beim Einbinden
loadAllLessons();