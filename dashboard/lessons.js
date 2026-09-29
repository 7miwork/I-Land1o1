/* ============================================================
   I-Land1o1 – Lektions-Daten (Level 1, Deutsch)
   ------------------------------------------------------------
   Pflegt hier eure Kurs-Inhalte:
   - type : 'start' | 'kapitel' | 'lektion'
   - title/desc : dürfen später die echten Titel/Aufgaben
     der Videos bekommen (einfach pro Lektion ersetzen)
   - task : kurzer Hinweis "Was du machen sollst" (optional)
   - video : Pfad auf dem Server (FTP-Bereich /Videos/...)
   ============================================================ */
window.ILAND_LESSONS = [
  {
    id: 'start',
    type: 'start',
    num: 'Intro',
    title: 'Willkommen an Bord',
    desc: 'Lerne deine Crew, dein Schiff und Minecraft Education kennen – der perfekte Start in dein erstes Abenteuer!',
    video: '/Videos/DE/DE Start.mp4',
  },
  {
    id: 'schiff',
    type: 'kapitel',
    num: 'Kapitel',
    title: 'Das Schiff',
    desc: 'Zusammen bauen wir euer Klassen-Schiff – die Basis für alle weiteren Level-1-Abenteuer.',
    video: '/Videos/DE/DE Schiff.mp4',
  },
  ...Array.from({ length: 11 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      id: `l${n}`,
      type: 'lektion',
      num: `Lektion ${n}`,
      title: `Lektion ${n}`,
      desc: 'Video ansehen, Aufgabe in Minecraft Education lösen und danach als erledigt markieren.',
      video: `/Videos/DE/Level 1/DE Level 1 Lesson ${n}.mp4`,
    };
  }),
];
