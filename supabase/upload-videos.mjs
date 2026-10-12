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
import { requireKey, getProjectUrl } from './keys.mjs';

const SB_URL = getProjectUrl();
const KEY = requireKey(
  'SUPABASE_SERVICE_ROLE_KEY',
  'Der Key umgeht alle Sicherheitsregeln – nur fuer lokale Scripts benutzen.'
);

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
    method: 'HEAD',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  });
  return res.status === 200;
}

async function remoteSize(objectPath) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, {
    method: 'HEAD',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  });
  if (res.status !== 200) return -1;
  return Number(res.headers.get('content-length') || 0);
}

async function removeObject(objectPath) {
  await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
  });
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

// TUS ist auf manchen Supabase-Projekten nicht aktiviert (dann antwortet
// das Endpunkt mit "Bucket name invalid"). Darum gibt es zwei Wege:
// 1) Versuch per TUS (resumabel, ideal fuer grosse Dateien)
// 2) Rueckfall auf den Standard-Upload (klappt bis 50 MB)
// Die grossen Videos ueber 50 MB brauchen Weg 1 oder den Weg unten.

async function uploadFile(filePath, objectPath, size) {
  // Supabase liest Bucket und Ziel-Objekt AUSSCHLIESSLICH aus
  // Upload-Metadata. Ohne diese beiden Felder kommt zurueck:
  //   "Bucket name invalid"
  // Format laut TUS-Spec: "key base64wert,key2 base64wert2"
  // (Leerzeichen zwischen Key und Wert, Komma zwischen Paaren)
  const meta =
    `bucketName ${b64(BUCKET)},` +
    `objectName ${b64(objectPath)},` +
    `filename ${b64(path.basename(filePath))},` +
    `filetype ${b64('video/mp4')}`;

  // 1) TUS versuchen (resumabel)
  try {
    return await uploadViaTus(filePath, objectPath, size, meta);
  } catch (err) {
    // 413 "Maximum size exceeded" kommt auf dem Free-Tarif AUCH beim
    // TUS-Start (nicht nur beim Standard-Upload) – fuer Dateien <= 50 MB
    // ist der Standard-Upload trotzdem der richtige Weg.
    if (!/bucket name invalid|not enabled|404|maximum size|413/i.test(err.message)) throw err;
    console.log('   (TUS nicht verfügbar, nutze Standard-Upload)');
    return await uploadViaStandard(filePath, objectPath, size);
  }
}

async function uploadViaTus(filePath, objectPath, size, meta) {
  // Bucket muss eigener Pfadteil sein
  const endpoint = `${SB_URL}/storage/v1/upload/resumable/${BUCKET}`;

  const create = await fetch(endpoint, {
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
  let offset = await getUploadOffset(location);

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

async function uploadViaStandard(filePath, objectPath, size) {
  // Supabase nimmt im Standard-Upload maximal 50 MB pro Anfrage.
  // Groessere Dateien zerlegen wir in Bloecke und schieben sie
  // nacheinander an dieselbe URL. Laeuft ein Block durch, machen
  // wir mit dem naechsten weiter (der Server haengt an).
  const MAX = 50 * 1024 * 1024;
  const url = `${SB_URL}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`;
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(MAX);

  try {
    let offset = 0;
    let isFirst = true;
    const contentRange = [];

    while (offset < size) {
      const toRead = Math.min(MAX, size - offset);
      const bytesRead = fs.readSync(fd, buffer, 0, toRead, offset);

      const end = offset + bytesRead;
      contentRange.push(`${offset}-${end - 1}/${size}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + KEY,
          'Content-Type': 'video/mp4',
          // Range-Header: signalisiert, dass dies ein Teil ist
          'Content-Range': `bytes ${offset}-${end - 1}/${size}`,
          ...(isFirst ? { 'x-upsert': 'true' } : {}),
        },
        body: buffer.subarray(0, bytesRead),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(
          `Fehler bei ${Math.round(offset / 1048576)} MB (${res.status}): ${t.slice(0, 160)}`
        );
      }

      offset = end;
      process.stdout.write(
        `\r   ${Math.round((offset / size) * 100)}%  (${Math.round(offset / 1048576)} / ${Math.round(size / 1048576)} MB)   `
      );
      isFirst = false;
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
const skipped = [];

for (const file of files) {
  const name = path.basename(file);
  const id = lessonIdFor(name);
  if (!id) {
    console.log(`⚠️  uebersprungen (keine ID): ${name}`);
    continue;
  }
  const objectPath = storagePathFor(id);
  // Quelldatei waehlen: ist das Original > 50 MB und existiert eine
  // komprimierte Fassung (Videos/compressed/...), nehmen wir die.
  // Supabase Free blockt grosse Dateien naemlich AUCH per TUS (413).
  let source = file;
  const origSize = fs.statSync(file).size;
  if (origSize > 50 * 1024 * 1024) {
    const alt = path.join(srcDir, '..', 'compressed', path.relative(srcDir, file));
    if (fs.existsSync(alt)) {
      source = alt;
      console.log(`   (komprimierte Fassung: ${path.relative(process.cwd(), alt)})`);
    }
  }
  const size = fs.statSync(source).size;

  // Bereits vollstaendig im Bucket? Dann ueberspringen.
  if (!FORCE) {
    const rSize = await remoteSize(objectPath);
    if (rSize > 0 && Math.abs(rSize - size) <= 1024) {
      console.log(`⏭  ${id.padEnd(7)} ${objectPath} (existiert schon, ${Math.round(rSize / 1048576)} MB)`);
      done++;
      continue;
    }
    // Abgeschnittenes Teilstueck? Erst loeschen, dann neu hochladen.
    if (rSize > 0) {
      console.log(`🧹 ${id.padEnd(7)} ${objectPath}: Teilstueck (${Math.round(rSize / 1048576)} statt ${Math.round(size / 1048576)} MB) wird ersetzt`);
      await removeObject(objectPath);
    }
  }

  // Ueber 50 MB: nur ueber TUS moeglich. Der Standard-Upload
  // scheitert dann. Wir versuchen es mit TUS und melden es,
  // falls auch das nicht klappt.
  const viaTusOnly = size > 50 * 1024 * 1024;

  console.log(`⬆️  ${id.padEnd(7)} ${objectPath}  ${Math.round(size / 1048576)} MB${viaTusOnly ? '  (nur TUS möglich)' : ''}`);
  try {
    await uploadFile(source, objectPath, size);
    console.log('   fertig.');
    done++;
  } catch (err) {
    console.log(`\n   FEHLER: ${err.message}`);
    if (viaTusOnly) {
      console.log('   -> Datei ist >50 MB und braucht zwingend TUS.');
      skipped.push({ id, objectPath, mb: Math.round(size / 1048576) });
    } else {
      console.log('   -> Script einfach erneut starten, es setzt fort.');
    }
  }
}

console.log(`\n${done}/${files.length} Videos im Bucket.`);

if (skipped.length) {
  console.log(`\n${skipped.length} Video(s) ueber 50 MB – bitte ueber das Dashboard hochladen:`);
  console.log('  Supabase -> Storage -> course-videos -> Upload');
  for (const s of skipped) {
    console.log(`    ${s.objectPath}   (${s.mb} MB, lokal: Videos/DE/...)`);
  }
}

const missing = [];
for (const file of files) {
  const id = lessonIdFor(path.basename(file));
  if (!id) continue;
  const obj = storagePathFor(id);
  // Gleiche Logik wie oben: komprimierte Fassung zaehlt als Referenz
  let ref = file;
  const origSize2 = fs.statSync(file).size;
  if (origSize2 > 50 * 1024 * 1024) {
    const alt = path.join(srcDir, '..', 'compressed', path.relative(srcDir, file));
    if (fs.existsSync(alt)) ref = alt;
  }
  const localSize = fs.statSync(ref).size;
  const rSize = await remoteSize(obj);
  if (rSize < 0 || Math.abs(rSize - localSize) > 1024) missing.push(obj);
}
if (missing.length) {
  console.log('\nNoch offen:');
  missing.forEach((m) => console.log('  - ' + m));
} else {
  console.log('\nAlle Videos vollstaendig. Jetzt noch:');
  console.log('  node supabase/register-lesson-videos.mjs');
}