// ============================================================
// I-Land1o1 – Legt Test-Konten an und prueft den Login.
// Funktioniert nur, wenn in Supabase unter
// Authentication -> Providers -> Email die Option
// "Confirm email" AUSGESCHALTET ist.
//
// Verwendung:
//   node supabase/create-test-users.mjs
// ============================================================

import fs from 'node:fs';
import { requireKey, getProjectUrl, getAnonKey } from './keys.mjs';

const SB_URL = getProjectUrl();
const KEY = getAnonKey();

const PASSWORD = 'Pirat1234!';
const USERS = [
  { email: 'eltern@i-land1o1.com', name: 'Eltern-Demo', role: 'parent' },
  { email: 'kind@i-land1o1.com', name: 'Kind-Demo', role: 'student' },
  { email: 'admin@i-land1o1.com', name: 'Admin-Demo', role: 'admin' },
];

async function api(path, opts = {}) {
  const res = await fetch(SB_URL + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

async function signUp(u) {
  return api('/auth/v1/signup', {
    method: 'POST',
    body: { email: u.email, password: PASSWORD, data: { display_name: u.name, role: u.role } },
  });
}

async function signIn(email) {
  return api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
}

(async () => {
  console.log('Konten werden angelegt bzw. geprueft...\n');
  let first = null;

  for (const u of USERS) {
    let r = await signUp(u);
    let status = 'neu erstellt';

    if (r.status === 422 || r.status === 400) {
      // existiert schon -> nur Login pruefen
      const li = await signIn(u.email);
      if (li.status === 200) status = 'existiert, Login OK';
      else status = 'EXISTIERT, ABER LOGIN FEHLGESCHLAGEN';
    } else if (r.status !== 200) {
      status = 'FEHLER: ' + r.text.slice(0, 120);
    }

    const li = await signIn(u.email);
    const ok = li.status === 200;
    console.log(`${ok ? 'OK  ' : 'HMM '} ${u.email.padEnd(24)} ${status}`);

    if (ok && !first) {
      const data = JSON.parse(li.text);
      first = { id: data.user.id, email: u.email, role: u.role };
    }
  }

  console.log('\nPasswort fuer alle Testkonten: ' + PASSWORD);

  if (!first) {
    console.log('\nKein Login moeglich. Wahrscheinlich ist "Confirm email"');
    console.log('in Supabase noch AN. Dann: Authentication -> Providers ->');
    console.log('Email -> "Confirm email" ausschalten und erneut ausfuehren.');
    return;
  }

  // Rolle des ersten Kontos pruefen (kam der Trigger durch?)
  const prof = await api('/rest/v1/profiles?select=role,display_name&id=eq.' + first.id);
  console.log('\nProfil von ' + first.email + ': ' + prof.text.slice(0, 200));

  // Wie viele Profile gibt es ueberhaupt?
  const all = await api('/rest/v1/profiles?select=id,role,display_name');
  console.log('Alle Profile (anon sieht nichts, daher mit Login-Token):');

  const me = await signIn(first.email);
  const tok = JSON.parse(me.text).access_token;
  const withTok = await fetch(SB_URL + '/rest/v1/profiles?select=id,role,display_name', {
    headers: { apikey: KEY, Authorization: 'Bearer ' + tok },
  });
  console.log('  ', await withTok.text());

  // Funktion existiert? (handle_new_user)
  const rpc = await api('/rest/v1/rpc/my_role', {
    method: 'POST',
    body: {},
  });
  console.log('\nmy_role() via RPC (ohne Token):', rpc.status, rpc.text.slice(0, 150));
})();