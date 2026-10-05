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
import { getKey, getProjectUrl, getAnonKey } from './keys.mjs';

const SB_URL = getProjectUrl();
const KEY = getAnonKey();

const PASSWORD = 'Pirat1234!';
const USERS = [
  { email: 'eltern@i-land1o1.com', name: 'Eltern-Demo', role: 'parent' },
  { email: 'kind@i-land1o1.com', name: 'Kind-Demo', role: 'student' },
  { email: 'admin@i-land1o1.com', name: 'Admin-Demo', role: 'admin' },
];

async function api(path, opts = {}) {
  // Admin-Aufrufe brauchen den service_role-Key, normale den anon-Key.
  const key = opts.admin ? getKey('SUPABASE_SERVICE_ROLE_KEY') : KEY;
  const res = await fetch(SB_URL + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

async function signUp(u) {
  // WICHTIG: Über den normalen /auth/v1/signup werden die
  // user_metadata in manchen Supabase-Setups verworfen. Über die
  // Admin-API mit email_confirm:true kommen sie zuverlässig an –
  // und das Konto ist sofort bestätigt (kein E-Mail-Trial).
  const adminKey = getKey('SUPABASE_SERVICE_ROLE_KEY');
  return api('/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: u.name, role: u.role },
    },
    admin: true,
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

  // Alte Testkonten erst entfernen, damit sie sauber neu angelegt
  // werden und der Trigger das Profil mit der richtigen Rolle erzeugt.
  const adminKey = getKey('SUPABASE_SERVICE_ROLE_KEY');
  const list = await api('/auth/v1/admin/users?page=1&per_page=100', { admin: true });
  if (list.status === 200) {
    const { users = [] } = JSON.parse(list.text);
    for (const u of users) {
      if (!['eltern@i-land1o1.com', 'kind@i-land1o1.com', 'admin@i-land1o1.com'].includes(u.email)) continue;
      const del = await api('/auth/v1/admin/users/' + u.id, { method: 'DELETE', admin: true });
      console.log(`🗑️  ${u.email} entfernt (HTTP ${del.status})`);
    }
  }

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

  // Rohdaten: welche Metadaten hat der Eltern-User wirklich?
  const admin = await fetch(SB_URL + '/auth/v1/admin/users?page=1&per_page=50', {
    headers: { apikey: getKey('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + getKey('SUPABASE_SERVICE_ROLE_KEY') },
  });
  if (admin.ok) {
    const data = await admin.json();
    console.log('\nRohdaten aus auth.users (user_metadata):');
    for (const u of data.users || []) {
      console.log(
        `  ${u.email.padEnd(38)} role=${JSON.stringify(u.user_metadata?.role)} name=${JSON.stringify(u.user_metadata?.display_name)}`
      );
    }
  } else {
    console.log('\nadmin/users nicht lesbar:', admin.status, (await admin.text()).slice(0, 120));
  }
})();