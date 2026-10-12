// ============================================================
// I-Land1o1 – Schluessel pruefen: Darf dieser User das Video sehen?
// ------------------------------------------------------------
// Letztes Glied der Kette Bezahlung -> Zugang -> Video.
// Ruft dieselbe Edge Function auf, die auch das Dashboard benutzt
// (get-video-url). Die Function prueft serverseitig, ob der User
// (oder ein Elternteil) ein gueltiges Abo hat, und erstellt erst
// dann eine signierte URL fuer den privaten Bucket.
//
// Erwartung:
//   mit Abo        -> 200 und eine URL, die nach 1 Stunde ablaeuft
//   ohne Abo       -> 403 und KEINE URL
//
// Der zweite Fall ist der wichtigere: Er beweist, dass die Paywall
// wirklich haelt und nicht nur so tut.
//
// Verwendung:
//   node supabase/test-video-access.mjs
//   node supabase/test-video-access.mjs kind@i-land1o1.com l05
// ============================================================

import { getKey, getProjectUrl, getAnonKey } from './keys.mjs';

const SB_URL = getProjectUrl();
const ANON = getAnonKey();

const EMAIL = process.argv[2] || 'eltern@i-land1o1.com';
const LESSON = process.argv[3] || 'l05';

// --- 1) Am Ende der Kette: echter Login, echter User-Token ---------
const login = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: 'Pirat1234!' }),
});

if (!login.ok) {
  const e = await login.json();
  console.error(`❌ Login fehlgeschlagen für ${EMAIL}: ${e.error_description || e.msg}`);
  process.exit(1);
}

const session = await login.json();
const token = session.access_token;
console.log(`Angemeldet als: ${EMAIL}\n`);

// --- 2) Lektion muss existieren und veroeffentlicht sein ------------
const svc = getKey('SUPABASE_SERVICE_ROLE_KEY');
const svcHeaders = { apikey: svc, Authorization: 'Bearer ' + svc };
const lessonRes = await fetch(
  `${SB_URL}/rest/v1/lesson_videos?lesson_id=eq.${LESSON}&select=lesson_id,title,storage_path,published`,
  { headers: svcHeaders }
);
const lessons = await lessonRes.json();

if (!lessons.length) {
  console.error(`❌ Lektion "${LESSON}" ist nicht registriert.`);
  console.error('   Erst: node supabase/register-lesson-videos.mjs');
  process.exit(1);
}

const lesson = lessons[0];
console.log(`Lektion: ${lesson.title}`);
console.log(`  Datei:       ${lesson.storage_path}`);
console.log(`  published:   ${lesson.published}`);

if (!lesson.published) {
  console.error('\n⚠️  Diese Lektion ist NICHT veröffentlicht.');
  console.error('   Das Video fehlt im Bucket (l01–l04 sind >50 MB und');
  console.error('   liegen nur lokal). Nimm eine andere Lektion, z. B. l05.');
  process.exit(1);
}

// --- 3) Die Function aufrufen, die auch das Dashboard benutzt ------
console.log('\n--- get-video-url aufrufen ---');
const res = await fetch(`${SB_URL}/functions/v1/get-video-url`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ lessonId: LESSON }),
});

const body = await res.text();
console.log(`HTTP ${res.status}`);

let data;
try {
  data = JSON.parse(body);
} catch {
  console.log(body.slice(0, 200));
  process.exit(1);
}

// --- 4) Ergebnis deuten -------------------------------------------
if (res.status === 200 && data.url) {
  console.log('\n✅ Zugriff erlaubt – signierte URL erstellt.');
  const expires = new Date(data.expires_at || Date.now() + 3600 * 1000);
  console.log(`   Läuft ab: ${expires.toLocaleTimeString('de-DE')}`);
  console.log(`   URL: ${data.url.slice(0, 90)}…`);

  // Kurz pruefen, ob die URL wirklich laedt (nur den Kopf holen)
  const probe = await fetch(data.url, { method: 'HEAD' });
  console.log(`   Video erreichbar: HTTP ${probe.status}`);
  if (probe.status === 200) {
    const size = probe.headers.get('content-length');
    if (size) console.log(`   Größe: ${Math.round(Number(size) / 1048576)} MB`);
  }
} else if (res.status === 403 || res.status === 402) {
  console.log('\n🔒 Zugriff verweigert – Paywall hält.');
  console.log(`   Grund: ${data.error || data.message || 'kein Abo'}`);
  console.log('   (Genau das soll passieren ohne Zahlung.)');
} else {
  console.log('\n⚠️  Unerwartete Antwort:', JSON.stringify(data).slice(0, 200));
}
