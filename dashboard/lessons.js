/* ============================================================
   I-Land1o1 – Lektions-Daten (Level 1, Deutsch)
   ------------------------------------------------------------
   Pflegt hier eure Kurs-Inhalte:
   - type : 'start' | 'kapitel' | 'lektion'
   - title/desc : echte Titel/Aufgaben der Videos
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
    task: 'Schaue dir das Video an und finde alle Crewmitglieder im Spiel.',
    video: '/Videos/DE/DE Start.mp4',
    explanation: 'Willkommen an Bord, kleiner Pirat! In dieser Einführung lernst du deine Crew kennen, siehst dir das Klassen-Schiff an und erfährst, wie Minecraft Education funktioniert. Das ist dein Startschuss für Level 1.',
    quiz: [
      { q: 'Was ist Minecraft Education?', a: ['Ein Spiel nur zum Kämpfen', 'Eine Lern-Plattform zum Bauen und Programmieren', 'Eine App für Videos'], correct: 1, feedback: 'Genau! Minecraft Education dient dem Lernen, Bauen und kreativen Programmieren.' },
      { q: 'Wer hilft dir an Bord?', a: ['Die Crew', 'Nur du allein', 'Der Seestern'], correct: 0, feedback: 'Deine Crew steht dir zur Seite – zusammen seid ihr stark!' },
    ],
    test: [
      { q: 'Was machst du zuerst nach dem Start?', a: ['Die Crew kennenlernen und das Schiff ansehen', 'Sofort einen Drachen bauen', 'Das Schiff versenken'], correct: 0, feedback: 'Richtig: Erst schaust du dir Crew und Schiff an, dann baust du los.' },
    ],
  },
  {
    id: 'schiff',
    type: 'kapitel',
    num: 'Kapitel',
    title: 'Das Schiff',
    desc: 'Zusammen bauen wir euer Klassen-Schiff – die Basis für alle weiteren Level-1-Abenteuer.',
    task: 'Baue deinen Platz am Schiffsbug und finde die Anleitung für das Navigationstool.',
    video: '/Videos/DE/DE Schiff.mp4',
    explanation: 'Das Schiff ist eure gemeinsame Basis. Ihr baut es zusammen, jeder bekommt einen Platz am Bug, und dort findet ihr auch die Anleitung für euer Navigationstool.',
    quiz: [
      { q: 'Wo baust du deinen Platz?', a: ['Am Schiffsbug', 'Im Wasser', 'Im Bauch des Kapitäns'], correct: 0, feedback: 'Richtig – dein Platz liegt am Bug des Schiffs.' },
    ],
    test: [
      { q: 'Was ist das Schiff für euch?', a: ['Nur eine Kulisse', 'Die gemeinsame Basis für alle Abenteuer', 'Ein Hindernis'], correct: 1, feedback: 'Genau, das Schiff ist eure Basis für Level 1.' },
    ],
  },
  {
    id: 'l01',
    type: 'lektion',
    num: 'Lektion 01',
    title: 'Der Kompass',
    desc: 'Lerne, wie der Kompass auf dem Schiff funktioniert und wie du mit ihm navigierst.',
    task: 'Nutze den Kompass, um den versteckten Schatz auf der Insel zu finden.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 01.mp4',
    explanation: 'Der Kompass zeigt dir immer die vier Himmelsrichtungen: Norden, Osten, Süden und Westen. In Minecraft Education öffnest du ihn über das Inventar. Damit findest du dich auf der Karte zurecht und kannst den versteckten Schatz auf der Insel lokalisieren.',
    quiz: [
      { q: 'Welche Richtung zeigt ein Kompass nicht an?', a: ['Norden', 'Osten', 'Richtung Schatzkiste (magisch)'], correct: 2, feedback: 'Ein Kompass zeigt nur die Himmelsrichtungen, nicht direkt den Schatz.' },
      { q: 'Wo öffnest du den Kompass in Minecraft Education?', a: ['Im Inventar', 'Im Chat', 'Im Menü Einstellungen'], correct: 0, feedback: 'Richtig, über das Inventar.' },
    ],
    test: [
      { q: 'Wozu dient der Kompass auf der Insel?', a: ['Zum Orientieren und Schatzfinden', 'Zum Essen kochen', 'Zum Fliegen'], correct: 0, feedback: 'Der Kompass hilft dir, dich zu orientieren und den Schatz zu finden.' },
    ],
  },
  {
    id: 'l02',
    type: 'lektion',
    num: 'Lektion 02',
    title: 'Das Navigationstool',
    desc: 'Erkunde, wie das Navigationstool deinen Weg auf der Karte anzeigt und dir hilft, die Route zu planen.',
    task: 'Verfolge die Routen auf der Karte und markiere die wichtigsten Punkte.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 02.mp4',
    explanation: 'Das Navigationstool zeichnet deinen Weg auf der Karte auf und zeigt dir wichtige Punkte. So planst du deine Route über die Insel und verlierst nicht den Überblick, wo du schon warst.',
    quiz: [
      { q: 'Was macht das Navigationstool?', a: ['Zeigt deinen Weg auf der Karte', 'Baut Häuser für dich', 'Löscht die Insel'], correct: 0, feedback: 'Es zeichnet deine Route und wichtige Punkte auf.' },
    ],
    test: [
      { q: 'Warum markierst du wichtige Punkte?', a: ['Damit du den Weg nicht vergisst', 'Um die Insel zu löschen', 'Zum Spaß'], correct: 0, feedback: 'Markierte Punkte helfen dir, dich zu orientieren.' },
    ],
  },
  {
    id: 'l03',
    type: 'lektion',
    num: 'Lektion 03',
    title: 'Die Insel entdecken',
    desc: 'Entdecke die abielle Insel und lerne ihre geheimen Gänge und versteckten Orte kennen.',
    task: 'Finde die drei versteckten Orte auf der Insel und beschreibe sie.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 03.mp4',
    explanation: 'Die Insel birgt viele Geheimnisse: geheime Gänge, Höhlen und versteckte Orte. Deine Aufgabe ist es, drei dieser besonderen Orte zu finden und sie in deinem Piraten-Tagebuch festzuhalten.',
    quiz: [
      { q: 'Wie viele versteckte Orte suchst du?', a: ['Drei', 'Einen', 'Zehn'], correct: 0, feedback: 'Du suchst drei versteckte Orte auf der Insel.' },
    ],
    test: [
      { q: 'Was tust du mit den gefundenen Orten?', a: ['Du beschreibst sie in deinem Tagebuch', 'Du ignorierst sie', 'Du sprengst sie'], correct: 0, feedback: 'Richtig: Halte die Orte schriftlich fest.' },
    ],
  },
  {
    id: 'l04',
    type: 'lektion',
    num: 'Lektion 04',
    title: 'Minecraft Education: Erster Aufbau',
    desc: 'Nutze Minecraft Education, um deinen ersten Bau auf der Insel zu errichten.',
    task: 'Baue ein kleines Geschütz oder eine Höhle unter Verwendung der Planungsnotizen.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 04.mp4',
    explanation: 'Jetzt wird gebaut! Mit Minecraft Education errichtest du dein erstes Bauwerk auf der Insel – zum Beispiel ein kleines Geschütz oder eine Höhle. Halte dich dabei an deine Planungsnotizen.',
    quiz: [
      { q: 'Was baust du zuerst?', a: ['Ein Geschütz oder eine Höhle', 'Ein ganzes Schloss', 'Nichts'], correct: 0, feedback: 'Starte klein mit einem Geschütz oder einer Höhle.' },
    ],
    test: [
      { q: 'Worauf achtest du beim Bauen?', a: ['An deine Planungsnotizen', 'Nur aufs Aussehen', 'An nichts'], correct: 0, feedback: 'Die Planungsnotizen leiten dich beim Bau.' },
    ],
  },
  {
    id: 'l05',
    type: 'lektion',
    num: 'Lektion 05',
    title: 'Materialien sammeln',
    desc: 'Lerne, wie du verschiedene Materialien sammelst und sie in deinen Bau einfängst.',
    task: 'Sammle mindestens 5 verschiedene Materialien und weise sie deinem Bau zu.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 05.mp4',
    explanation: 'Holz, Stein, Sand, Erde – es gibt viele Materialien auf der Insel. Sammle mindestens fünf verschiedene und setze sie gezielt in deinem Bau ein, damit er stabil und schön wird.',
    quiz: [
      { q: 'Wie viele verschiedene Materialien sammelst du mindestens?', a: ['Fünf', 'Einen', 'Zwanzig'], correct: 0, feedback: 'Mindestens fünf verschiedene Materialien.' },
    ],
    test: [
      { q: 'Warum sammelst du verschiedene Materialien?', a: ['Für einen stabilen und schönen Bau', 'Um sie wegzuwerfen', 'Zum Essen'], correct: 0, feedback: 'Verschiedene Materialien machen deinen Bau stabiler und abwechslungsreicher.' },
    ],
  },
  {
    id: 'l06',
    type: 'lektion',
    num: 'Lektion 06',
    title: 'Das erste Pflanzen',
    desc: 'Entdecke, wie du in Minecraft Education Pflanzen pflanzen und verwildern kannst.',
    task: 'Pflanze 3 verschiedene Pflanzen und beschreibe das Wachstumsszenario.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 06.mp4',
    explanation: 'Auf der Insel kannst du Pflanzen setzen und zusehen, wie sie wachsen. Pflanze drei verschiedene Pflanzen und beschreibe, wie sie wachsen und gedeihen.',
    quiz: [
      { q: 'Wie viele Pflanzen setzt du?', a: ['Drei verschiedene', 'Eine', 'Keine'], correct: 0, feedback: 'Du pflanzt drei verschiedene Pflanzen.' },
    ],
    test: [
      { q: 'Was beschreibst du nach dem Pflanzen?', a: ['Das Wachstumsszenario', 'Die Farbe des Himmels', 'Die Anzahl der Wolken'], correct: 0, feedback: 'Du beschreibst, wie die Pflanzen wachsen.' },
    ],
  },
  {
    id: 'l07',
    type: 'lektion',
    num: 'Lektion 07',
    title: 'Das erste Tier',
    desc: 'Lerne, wie du in Minecraft Education Tiere züchten und pflegen kannst.',
    task: 'Züchte 2 verschiedene Tiere und dokumentiere ihr Verhalten.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 07.mp4',
    explanation: 'Tiere gehören zum Leben auf der Insel. Du züchtest zwei verschiedene Tierarten, pflegst sie und hältst ihr Verhalten in deinen Notizen fest.',
    quiz: [
      { q: 'Wie viele Tiere züchtest du?', a: ['Zwei verschiedene', 'Eines', 'Zehn'], correct: 0, feedback: 'Du züchtest zwei verschiedene Tierarten.' },
    ],
    test: [
      { q: 'Was dokumentierst du über die Tiere?', a: ['Ihr Verhalten', 'Ihre Lieblingsfarbe', 'Ihr Alter'], correct: 0, feedback: 'Du hältst das Verhalten der Tiere fest.' },
    ],
  },
  {
    id: 'l08',
    type: 'lektion',
    num: 'Lektion 08',
    title: 'Der Bau beginnt',
    desc: 'Baue dein erstes Gelände mit den gesammelten Materialien und fertige es nach dem Entwurf.',
    task: 'Verwende mindestens 10 Blöcke deiner Wahl und plane eine Tür und ein Fenster.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 08.mp4',
    explanation: 'Dein großes Gelände nimmt Form an. Verwende mindestens zehn Blöcke nach deiner Wahl und plane bewusst eine Tür und ein Fenster ein, damit dein Bau bewohnbar wird.',
    quiz: [
      { q: 'Wie viele Blöcke verwendest du mindestens?', a: ['Zehn', 'Einen', 'Hundert'], correct: 0, feedback: 'Mindestens zehn Blöcke.' },
    ],
    test: [
      { q: 'Was planst du bewusst ein?', a: ['Eine Tür und ein Fenster', 'Nur ein Dach', 'Nur eine Wand'], correct: 0, feedback: 'Eine Tür und ein Fenster gehören dazu.' },
    ],
  },
  {
    id: 'l09',
    type: 'lektion',
    num: 'Lektion 09',
    title: 'Der Schatz ist gefunden',
    desc: 'Erfinde einen Schatz und verborge ihn an einem sicheren Ort auf der Insel.',
    task: 'Verstecke den Schatz unter Sand oder in einem Schatzkoffer und markiere den Standort.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 09.mp4',
    explanation: 'Jetzt bist du dran: Erfinde deinen eigenen Schatz, verborge ihn sicher auf der Insel (unter Sand oder in einem Schatzkoffer) und markiere den Standort, damit du ihn wiederfindest.',
    quiz: [
      { q: 'Wo kannst du den Schatz verstecken?', a: ['Unter Sand oder in einem Schatzkoffer', 'Im Weltall', 'Im Ozean'], correct: 0, feedback: 'Unter Sand oder im Schatzkoffer ist sicher.' },
    ],
    test: [
      { q: 'Warum markierst du den Standort?', a: ['Damit du den Schatz wiederfindest', 'Um ihn zu vergessen', 'Für andere Piraten'], correct: 0, feedback: 'Die Markierung hilft dir, den Schatz später wiederzufinden.' },
    ],
  },
  {
    id: 'l10',
    type: 'lektion',
    num: 'Lektion 10',
    title: 'Das Schutzsystem',
    desc: 'Baue ein einfaches Schutzsystem mit Tor, Korb oder schmaleren Wegen ab.',
    task: 'Zeige, wie dein Schatz vor fremden Spielern geschützt wird und teste dein System.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 10.mp4',
    explanation: 'Dein Schatz braucht Schutz. Baue ein einfaches System – zum Beispiel mit einem Tor, einem Korb oder schmalen Wegen – und zeige, wie dein Schatz vor fremden Spielern geschützt wird.',
    quiz: [
      { q: 'Wozu dient dein Schutzsystem?', a: ['Den Schatz zu schützen', 'Den Schatz zu verlieren', 'Den Schatz zu essen'], correct: 0, feedback: 'Es schützt deinen Schatz vor Fremden.' },
    ],
    test: [
      { q: 'Was kannst du zum Schutz bauen?', a: ['Ein Tor, einen Korb oder schmale Wege', 'Nur ein Schild', 'Nichts'], correct: 0, feedback: 'Tore, Körbe und schmale Wege schützen deinen Schatz.' },
    ],
  },
  {
    id: 'l11',
    type: 'lektion',
    num: 'Lektion 11',
    title: 'Die letzte Lektion',
    desc: 'Kombiniere alles, was du bisher gelernt hast, um dein eigenes Abenteuer zu schaffen.',
    task: 'Entwickle eine eigene kurze Geschichte und biete sie als Spielmodul an.',
    video: '/Videos/DE/Level 1/DE Level 1 Lesson 11.mp4',
    explanation: 'Das ist dein großes Finale! Kombiniere alles, was du in Level 1 gelernt hast, und erschaffe dein eigenes Abenteuer mit einer kurzen Geschichte, die du als Spielmodul anbieten kannst.',
    quiz: [
      { q: 'Was erstellst du in dieser Lektion?', a: ['Ein eigenes Abenteuer als Spielmodul', 'Nur ein Bild', 'Eine Einkaufsliste'], correct: 0, feedback: 'Du erstellst dein eigenes Abenteuer als Spielmodul.' },
    ],
    test: [
      { q: 'Was kombinierst du für dein Abenteuer?', a: ['Alles, was du in Level 1 gelernt hast', 'Nur das erste Video', 'Nichts'], correct: 0, feedback: 'Du nutzt dein gesamtes Level-1-Wissen.' },
    ],
  },
];
