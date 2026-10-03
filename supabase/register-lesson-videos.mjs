// ============================================================
// I-Land1o1 – Lektions-Videos in Supabase Storage registrieren
// ------------------------------------------------------------
// Das hier lädt KEINE Dateien hoch (große Dateien brauchen TUS/
// resumable Upload) – es prüft nur, ob die Videos im privaten
// Bucket liegen, und trägt die Zuordnung in die Tabelle
// "lesson_videos" ein.
//
// Verwendung (PowerShell):
//   $env:SUPABASE_URL     = 'https://xxx.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY = 'service_role key'
//   node supabase\register-lesson-videos.mjs
//
// Den service_role-Key gibt es in Supabase unter
// Project Settings -> API. Er gehört NICHT ins Git!
//
// Upload selbst: Dashboard -> Storage -> course-videos -> Upload
// (Dateinamen siehe PLAN unten) – oder per Supabase-CLI:
//   supabase storage cp "Videos/DE/DE Start.mp4" supabase://course-videos/de/start.mp4
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const BUCKET = 'course-videos';
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Fehlt: SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY als Umgebungsvariable.');
  process.exit(1);
}

// Dateiname -> Lektions-ID (muss zu dashboard/lessons.js passen!)
function lessonIdFor(fileName) {
  if (/start/i.test(fileName)) return 'start';
  if (/schiff/i.test(fileName)) return 'schiff';
  const m = fileName.match(/Lesson\s*(\d{1,2})/i);
  if (m) return 'l' + String(m[1]).padStart(2, '0');
  return null;
}

// Ablagepfad ohne Leerzeichen (raeumt URLs und Signierung auf)
function storagePathFor(fileName, id) {
  if (id === 'start') return 'de/start.mp4';
  if (id === 'schiff') return 'de/schiff.mp4';
  return `de/level1/${id}.mp4`;
}

function sortOrderFor(id) {
  if (id === 'start') return 0;
  if (id === 'schiff') return 1;
  return 10 + Number(id.slice(1));
}

const srcDir = path.resolve('Videos/DE');
if (!fs.existsSync(srcDir)) {
  console.error('Videos/DE nicht gefunden – bitte im Repo-Root ausführen.');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

async function existsInBucket(objectPath) {
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, {
    method: 'GET',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  });
  return res.status === 200;
}

const rows = [];
let missing = 0;

for (const file of walk(srcDir).filter((f) => f.endsWith('.mp4'))) {
  const name = path.basename(file);
  const id = lessonIdFor(name);
  if (!id) {
    console.warn('⚠️  Keine Lektions-ID erkannt:', name);
    continue;
  }
  const storagePath = storagePathFor(name, id);
  const ok = await existsInBucket(storagePath);
  if (!ok) missing++;

  rows.push({
    lesson_id: id,
    title: path.parse(name).name,
    storage_path: storagePath,
    sort_order: sortOrderFor(id),
    published: true,
  });

  console.log(`${ok ? '✅' : '❌'} ${id.padEnd(7)} ${storagePath}`);
}

// Zuordnung in die Datenbank schreiben (service role umgeht RLS)
const res = await fetch(`${URL}/rest/v1/lesson_videos?on_conflict=lesson_id`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});

if (!res.ok) {
  console.error('\nFehler beim Schreiben:', res.status, await res.text());
  process.exit(1);
}

console.log(`\n${rows.length} Lektionen registriert.`);
if (missing) {
  console.log(`⚠️  ${missing} Video(s) fehlen noch im Bucket "${BUCKET}" – bitte hochladen:`);
  for (const r of rows) {
    const ok = await existsInBucket(r.storage_path);
    if (!ok) console.log(`   - ${r.storage_path}`);
  }
} else {
  console.log('Alle Videos vorhanden. Dashboard testen: Lektion öffnen.');
}