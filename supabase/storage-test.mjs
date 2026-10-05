// Testet, welche Storage-Endpunkte antworten und ob der Bucket existiert.
import { requireKey, getProjectUrl } from './keys.mjs';

const SB_URL = getProjectUrl();
const KEY = requireKey('SUPABASE_SERVICE_ROLE_KEY');

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function t(label, path, opts = {}) {
  const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY, ...(opts.headers || {}) };
  const res = await fetch(SB_URL + path, { ...opts, headers });
  const body = await res.text();
  console.log(`${String(res.status).padEnd(4)} ${label}`);
  console.log(`     ${body.slice(0, 260)}`);
  if (res.headers.get('location')) {
    console.log(`     location: ${res.headers.get('location')}`);
  }
  console.log('');
  return res;
}

// 1) Bucket-Liste (zeigt, wie der Bucket wirklich heisst)
await t('Buckets', '/storage/v1/bucket', { method: 'GET' });

// 2) Datei-Metadaten (existiert die Datei schon?)
await t('Object de/start.mp4', '/storage/v1/object/course-videos/de/start.mp4', { method: 'GET' });

const meta = 'filename ' + Buffer.from('t.txt').toString('base64');

// 3) TUS OHNE Content-Type (richtige TUS-Header)
const a = await t('TUS /upload/resumable', '/storage/v1/upload/resumable', {
  method: 'POST',
  headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': '4', 'Upload-Metadata': meta },
});

// 4) TUS mit Bucket als Pfadteil
const b = await t('TUS /upload/resumable/course-videos', '/storage/v1/upload/resumable/course-videos', {
  method: 'POST',
  headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': '4', 'Upload-Metadata': meta },
});

// 5) Wenn eins davon 201 war: ein PATCH mit den 4 Bytes senden
for (const r of [a, b]) {
  if (r.status === 201 && r.headers.get('location')) {
    await t('PATCH Test', r.headers.get('location'), {
      method: 'PATCH',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      body: 'test',
    });
  }
}

// 6) Klassischer Upload ohne TUS (funktioniert bis 50 MB)
const c = await t('Standard-Upload 4 Bytes', '/storage/v1/object/course-videos/test-tiny.mp4', {
  method: 'POST',
  headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: 'test',
});

// 7) Danach pruefen und wieder loeschen
if (c.status === 200 || c.status === 201) {
  await t('Datei pruefen', '/storage/v1/object/course-videos/test-tiny.mp4', { method: 'GET' });
  await t('Datei loeschen', '/storage/v1/object/course-videos/test-tiny.mp4', { method: 'DELETE' });
}