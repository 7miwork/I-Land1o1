// E2E-Sicherheitstest: Login als Demo-Schueler + RLS-Pruefung der drei Tabellen.
// Nutzt nur anon key + Benutzer-Login, also exakt den Weg des Browser-Codes.
const URL = 'https://lmlbjtazgcylsrtzzisr.supabase.co';
const fs = require('fs');
const KEY = fs.readFileSync('Z:/I-Land1o1/Webseite/dashboard/config.js', 'utf8')
  .match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)[1];

async function api(path, opts = {}, token) {
  const res = await fetch(URL + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + (token || KEY),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

const log = (name, r, ok) =>
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' -> HTTP ' + r.status + ' ' + r.text.slice(0, 140));

(async () => {
  // 1) Login
  const login = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: 'demo@i-land1o1.com', password: 'Pirat1234!' },
  });
  if (login.status !== 200) {
    console.log('FAIL Login -> HTTP ' + login.status + ' ' + login.text.slice(0, 200));
    console.log('(Email-Bestaetigung noch an? Dashboard: Auth -> Providers -> Email)');
    return;
  }
  const tok = JSON.parse(login.text).access_token;
  const uid = JSON.parse(login.text).user.id;
  console.log('PASS Login, user.id=' + uid);

  // 2) profiles: eigene Zeile sichtbar (Backfill/Trigger war ok)
  const prof = await api('/rest/v1/profiles?select=*&id=eq.' + uid, {}, tok);
  log('profiles: eigene Zeile lesen', prof, prof.status === 200 && prof.text.includes(uid));

  // 3) Fortschritt schreiben + lesen + loeschen
  const ins = await api('/rest/v1/lesson_progress', {
    method: 'POST',
    body: [{ user_id: uid, lesson_id: '__rls_test__', done: true }],
  }, tok);
  log('lesson_progress: eigener Eintrag', ins, ins.status === 201 || ins.status === 200);
  const sel = await api('/rest/v1/lesson_progress?select=lesson_id&user_id=eq.' + uid, {}, tok);
  log('lesson_progress: lesen', sel, sel.text.includes('__rls_test__'));
  const del = await api('/rest/v1/lesson_progress?lesson_id=eq.__rls_test__', { method: 'DELETE' }, tok);
  log('lesson_progress: loeschen', del, del.status === 200 || del.status === 204);

  // 4) Angriff: Rolle selbst auf admin drehen -> Muss scheitern (Trigger)
  const esc = await api('/rest/v1/profiles?id=eq.' + uid, {
    method: 'PATCH',
    body: { role: 'admin' },
  }, tok);
  const escBlocked = esc.status >= 400 || !esc.text.includes('"admin"');
  log('Rollenselbstwechsel blockiert', esc, escBlocked);

  // 5) Angriff: fremden Fortschritt schreiben -> Muss scheitern (with check)
  const fremd = await api('/rest/v1/lesson_progress', {
    method: 'POST',
    body: [{ user_id: '00000000-0000-0000-0000-000000000000', lesson_id: 'hack', done: true }],
  }, tok);
  log('Fremden Fortschritt schreiben blockiert', fremd, fremd.status >= 400);

  // 6) Anonym (ohne Login) darf nichts in lesson_progress sehen
  const anon = await api('/rest/v1/lesson_progress?select=*');
  log('anonymer Zugriff leer', anon, anon.status === 200 && anon.text === '[]');

  // Aufraeumen: evt. Reste des Angriffs/Eintrags
  await api('/rest/v1/lesson_progress?lesson_id=eq.__rls_test__', { method: 'DELETE' }, tok);
})();
