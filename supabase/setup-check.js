// ============================================================
// I-Land1o1 – Setup-Prüfung (ohne Admin-Rechte)
// Prüft mit dem anon Key, was öffentlich sichtbar sein sollte,
// und ob die Edge Functions überhaupt deployed sind.
// ============================================================

const fs = require('fs');
const https = require('https');

const CFG = fs.readFileSync('Z:/I-Land1o1/Webseite/dashboard/config.js', 'utf8');
const SB_URL = CFG.match(/SUPABASE_URL:\s*'([^']+)'/)[1];
const KEY = CFG.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)[1];

function req(path, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(SB_URL + path);
    const r = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + KEY,
          'Content-Type': 'application/json',
          ...(opts.headers || {}),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      }
    );
    r.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

function line(label, ok, detail) {
  console.log(`${ok ? 'OK  ' : 'HMM '} ${label}${detail ? ' -> ' + detail : ''}`);
}

(async () => {
  console.log('--- Tabellen (anon darf keine Daten sehen) ---');
  for (const t of ['profiles', 'parent_invites', 'parent_links', 'lesson_progress', 'subscriptions', 'payments', 'lesson_videos']) {
    const r = await req(`/rest/v1/${t}?select=*&limit=1`);
    const missing = r.status === 404;
    const leaked = r.status === 200 && r.body !== '[]';
    line(
      t.padEnd(16),
      !missing && !leaked,
      missing ? 'FEHLT (404)' : leaked ? 'ANON SIEHT DATEN! ' + r.body.slice(0, 80) : 'vorhanden, anonym leer'
    );
  }

  console.log('\n--- Edge Functions (401 = deployed & JWT aktiv) ---');
  for (const f of ['create-checkout-session', 'create-portal-session', 'get-video-url']) {
    const r = await req(`/functions/v1/${f}`, { method: 'POST', body: {} });
    const ok = r.status === 401;
    line(f.padEnd(26), ok, `${r.status} ${r.body.slice(0, 90)}`);
  }
  // Webhook: Verify JWT muss AUS sein -> 400 (Signatur fehlt) = richtig
  const wh = await req('/functions/v1/stripe-webhook', { method: 'POST', body: '{}' });
  line('stripe-webhook'.padEnd(26), wh.status === 400, `${wh.status} ${wh.body.slice(0, 90)}`);

  console.log('\n--- Storage: darf nichts oeffentlich sein ---');
  const paths = ['de/start.mp4', 'de/schiff.mp4', 'de/level1/l01.mp4'];
  for (const p of paths) {
    const r = await req(`/storage/v1/object/course-videos/${encodeURIComponent(p)}`);
    const blocked = r.status === 400 || r.status === 401 || r.status === 404;
    line(p.padEnd(20), blocked, `${r.status} ${r.body.slice(0, 60)}`);
  }

  console.log('\n--- Login-Test (Demo-User) ---');
  const login = await req('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: 'demo@i-land1o1.com', password: 'Pirat1234!' },
  });
  line('demo login', login.status === 200, `${login.status} ${login.body.slice(0, 120)}`);
})();