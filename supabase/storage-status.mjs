// Zeigt, welche Videos wirklich (vollstaendig) im Bucket liegen,
// inkl. Groesse. Vergleicht mit den lokalen Dateien, damit
// abgeschnittene Teilstuecke auffallen.
//
//   node supabase/storage-status.mjs
import fs from 'node:fs';
import path from 'node:path';
import { requireKey, getProjectUrl } from './keys.mjs';

const SB_URL = getProjectUrl();
const KEY = requireKey('SUPABASE_SERVICE_ROLE_KEY');
const BUCKET = 'course-videos';

function lessonIdFor(name) {
  if (/start/i.test(name)) return 'start';
  if (/schiff/i.test(name)) return 'schiff';
  const m = name.match(/Lesson\s*(\d{1,2})/i);
  return m ? 'l' + String(m[1]).padStart(2, '0') : null;
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

try {
  const files = walk(path.resolve('Videos/DE')).filter((f) => f.endsWith('.mp4'));
  let ok = 0;
  let bad = 0;

  for (const f of files) {
    const id = lessonIdFor(path.basename(f));
    if (!id) continue;
    const obj = storagePathFor(id);
    const localSize = fs.statSync(f).size;

    // Groesse per HEAD holen – ein GET liefert bei Video-Objekten
    // die Binaerdaten, die sich nicht als JSON parsen lassen.
    const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURI(obj)}`, {
      method: 'HEAD',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
    });

    if (res.status !== 200) {
      console.log(
        `fehlt    ${id.padEnd(7)} ${obj.padEnd(22)} ${String(Math.round(localSize / 1048576)).padStart(3)} MB lokal`
      );
      bad++;
      continue;
    }

    const remoteSize = Number(res.headers.get('content-length') || 0);
    const remoteMB = Math.round(remoteSize / 1048576);
    const localMB = Math.round(localSize / 1048576);
    const same = Math.abs(remoteMB - localMB) <= 1;

    console.log(
      `${same ? 'OK      ' : 'TEILUHR '} ${id.padEnd(7)} ${obj.padEnd(22)} ${String(localMB).padStart(3)} MB lokal / ${String(remoteMB).padStart(3)} MB im Bucket`
    );
    if (same) ok++;
    else bad++;
  }

  console.log(`\n${ok} vollstaendig, ${bad} offen.`);
} catch (err) {
  console.error('Fehler:', err.message);
  process.exit(1);
}