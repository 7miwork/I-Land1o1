// ============================================================
// I-Land1o1 – Videos in Supabase Storage hochladen (TUS)
// ------------------------------------------------------------
// Warum ein Script? Supabase Storage bricht den normalen
// Upload bei Dateien > 50 MB ab. Unsere Videos sind bis
// 85 MB gross. Dieses Script nutzt deshalb das TUS-Protokoll
// (resumable) mit 6-MB-Bloecken und setzt nach einem Abbruch
// beim naechsten Lauf automatisch fort.
//
// Verwendung (PowerShell):
//   $env:SUPABASE_URL = 'https://lmlbjtazgcylsrtzzisr.supabase.co'
//   $env:SUPABASE_SERVICE_ROLE_KEY = '<service_role aus Project Settings -> API>'
//   node supabase/upload-videos.mjs
//
// Optionen:
//   -Force    nochmal hochladen, auch wenn die Datei schon da ist
//
// Abbruch jederzeit mit Strg+C moeglich, Fortsetzen beim
// naechsten Aufruf einfach erneut starten.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const CFG = fs.readFileSync('Z:/I-Land1o1/Webseite/dashboard/config.js', 'utf8');
const SB_URL = process.env.SUPABASE_URL || CFG.match(/SUPABASE_URL:\s*'([^']+)'/)[1];
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (() => {
    console.error('\nFehlt: SUPABASE_SERVICE_ROLE_KEY als Umgebungsvariable.');
    console.error('Findest du in Supabase unter Project Settings -> API -> service_role.');
    process.exit(1);
  })();

const BUCKET = 'course-videos';
const CHUNK = 6 * 1024 * 1024; // 6 MB – Supabase-Limit pro PATCH
const FORCE = process.argv.includes('-Force');

// Dateiname -> Lektions-ID (muss zu dashboard/lessons.js passen!)
function lessonIdFor(name) {
  if (/start/i.test(name)) return 'start';
  if (/schiff/i.test(name)) return 'schiff';
  const m = name.match(/Lesson\s*(\d{1,2})/i);
  if (m) return 'l' + String(m[1]).padStart(2, '0');
  return null;
}

function storagePathFor(id) {
  if (id === 'start') return 'de/start.mp4';
  if (id === 'schiff') return 'de/schiff.mp4';
  return `de/level1/${id}.mp4`;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

async function existsInBucket(objectPath) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  });
  return res.status === 200;
}

// TUS: Metadaten (Name + Content-Type) base64-kodiert
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');

async function getUploadOffset(location) {
  const res = await fetch(location, {
    method: 'HEAD',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Tus-Resumable': '1.0.0' },
  });
  if (!res.ok) return 0;
  const off = res.headers.get('upload-offset');
  return off ? Number(off) : 0;
}

async function uploadFile(filePath, objectPath, size) {
  const meta = `${b64('filename')},${b64(path.basename(filePath))} ${b64('filetype')},${b64('video/mp4')}`;

  // 1) Upload anlegen
  const create = await fetch(`${SB_URL}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(size),
      'Upload-Metadata': meta,
      'x-upsert': 'true',
    },
  });

  if (!create.ok) {
    const t = await create.text();
    throw new Error(`Upload nicht startbar (${create.status}): ${t.slice(0, 200)}`);
  }

  const location = create.headers.get('location');

  // 2) Offset holen – setzt nach einem Abbruch fort
  let offset = await getUploadOffset(location);

  // 3) In Bloecken senden
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(CHUNK);
  try {
    while (offset < size) {
      const toRead = Math.min(CHUNK, size - offset);
      const bytesRead = fs.readSync(fd, buffer, 0, toRead, offset);
      if (bytesRead <= 0) break;

      const patch = await fetch(location, {
        method: 'PATCH',
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + KEY,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: buffer.subarray(0, bytesRead),
      });

      if (patch.status !== 204 && patch.status !== 200) {
        const t = await patch.text();
        throw new Error(`Abbruch bei ${Math.round(offset / 1048576)} MB: ${patch.status} ${t.slice(0, 200)}`);
      }

      offset = Number(patch.headers.get('upload-offset') || offset + bytesRead);
      process.stdout.write(
        `\r   ${Math.round((offset / size) * 100)}%  (${Math.round(offset / 1048576)} / ${Math.round(size / 1048576)} MB)   `
      );
    }
  } finally {
    fs.closeSync(fd);
  }
  process.stdout.write('\n');
}
const srcDir = path.resolve('Videos/DE');
if (!fs.existsSync(srcDir)) {
  console.error('Videos/DE nicht gefunden – bitte im Repo-Root starten.');
  process.exit(1);
}

const files = walk(srcDir).filter((f) => f.endsWith('.mp4'));
console.log(`${files.length} Videos gefunden. Bucket: ${BUCKET}\n`);

let done = 0;
for (const file of files) {
  const name = path.basename(file);
  const id = lessonIdFor(name);
  if (!id) {
    console.log(`⚠️  uebersprungen (keine ID): ${name}`);
    continue;
  }
  const objectPath = storagePathFor(id);
  const size = fs.statSync(file).size;

  if (!FORCE && (await existsInBucket(objectPath))) {
    console.log(`⏭  ${id.padEnd(7)} ${objectPath} (existiert schon)`);
    done++;
    continue;
  }

  console.log(`⬆️  ${id.padEnd(7)} ${objectPath}  ${Math.round(size / 1048576)} MB`);
  try {
    await uploadFile(file, objectPath, size);
    console.log('   fertig.');
    done++;
  } catch (err) {
    console.log(`\n   FEHLER: ${err.message}`);
    console.log('   -> Script einfach erneut starten, es setzt fort.');
  }
}

console.log(`\n${done}/${files.length} Videos im Bucket.`);

const missing = [];
for (const file of files) {
  const id = lessonIdFor(path.basename(file));
  if (!id) continue;
  if (!(await existsInBucket(storagePathFor(id)))) missing.push(storagePathFor(id));
}
if (missing.length) {
  console.log('\nNoch fehlend:');
  missing.forEach((m) => console.log('  - ' + m));
} else {
  console.log('\nAlle Videos vorhanden. Jetzt noch:');
  console.log('  node supabase/register-lesson-videos.mjs');
}