// ============================================================
// I-Land1o1 - Reparatur der Benutzerrollen
// ------------------------------------------------------------
// 1. Alle Konten lesen (Admin-API)
// 2. Rolle ermitteln: aus user_metadata, sonst aus der E-Mail
// 3. profiles.role + display_name nachziehen (Service-Key, ohne RLS)
//
// Der Fremdschluessel auf auth.users (ON DELETE CASCADE) laesst
// sich nur per SQL aendern -> fix-signup-role.sql im Dashboard.
//
// Verwendung: node supabase/fix-roles.mjs
// ============================================================

import { getKey, getProjectUrl } from './keys.mjs';

const SB_URL = getProjectUrl();
const KEY = getKey('SUPABASE_SERVICE_ROLE_KEY');

function admin(path, opts = {}) {
  return fetch(SB_URL + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

function db(path, opts = {}) {
  return fetch(SB_URL + path, {
    method: opts.method || 'POST',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

// Diese Testkonten bleiben IMMER Schueler: sie bilden verschiedene
// Abo-Zustaende ab und duerfen nicht promotet werden.
const FORCE_STUDENT = ['demo-student', 'schueler', 'schüler'];

// Ausnahmen: hier zaehlt die Adresse nicht, das Konto ist festgelegt.
// kind@ ist ein Schueler-Konto, obwohl "kind" nach Eltern aussieht.
const FIXED_ROLES = {
  'kind@i-land1o1.com': 'student',
  'eltern@i-land1o1.com': 'parent',
  'admin@i-land1o1.com': 'admin',
};

function roleFor(user) {
  const email = (user.email || '').toLowerCase();
  if (FIXED_ROLES[email]) return FIXED_ROLES[email];
  if (FORCE_STUDENT.some((k) => email.includes(k))) return 'student';

  // 1) Was bei der Registrierung angegeben wurde
  const fromMeta = user.user_metadata?.role;
  if (['parent', 'admin', 'teacher', 'student'].includes(fromMeta)) return fromMeta;

  // 2) Aus der Adresse ableiten
  if (email.includes('admin')) return 'admin';
  if (email.includes('teacher') || email.includes('lehrer')) return 'teacher';
  if (
    email.includes('parent') ||
    email.includes('eltern') ||
    email.includes('kind') ||
    email.includes('kid')
  ) {
    return 'parent';
  }
  return 'student';
}

function nameFor(user) {
  const meta = user.user_metadata?.display_name;
  if (meta && meta.trim()) return meta.trim();
  // demo-parent@i-land1o1.com -> Demo Parent
  const local = (user.email || '').split('@')[0];
  const pretty = local
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return pretty || 'Pirat';
}

(async () => {
  const res = await admin('/auth/v1/admin/users?page=1&per_page=200');
  if (!res.ok) {
    console.error('Konten nicht lesbar:', res.status, (await res.text()).slice(0, 200));
    process.exit(1);
  }
  const { users = [] } = await res.json();
  console.log(`${users.length} Konten gefunden.\n`);

  const profRes = await db('/rest/v1/profiles?select=id,role,display_name', { method: 'GET' });
  const profiles = await profRes.json();
  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  // Alle noetigen Aenderungen zuerst sammeln
  const todo = [];
  for (const u of users) {
    const profile = byId.get(u.id);
    const wantRole = roleFor(u);
    const wantName = nameFor(u);
    if (profile && profile.role === wantRole && profile.display_name === wantName) {
      console.log(`  ok          ${u.email.padEnd(38)} ${wantRole}`);
      continue;
    }
    todo.push({
      id: u.id,
      email: u.email,
      oldRole: profile?.role ?? null,
      wantRole,
      wantName,
    });
  }

  if (!todo.length) {
    console.log('\nAlles bereits korrekt.');
    return;
  }

  console.log('\nAenderungen:');
  for (const c of todo) {
    console.log(
      `  ${c.email.padEnd(38)} ${(c.oldRole ?? 'ohne Profil').padEnd(12)} -> ${c.wantRole}`
    );
  }

  // --- 1) Metadaten in auth.users aktualisieren ---
  console.log('\nSchritt 1: Metadaten in auth.users');
  for (const u of users) {
    const c = todo.find((x) => x.id === u.id);
    if (!c) continue;
    const r = await admin('/auth/v1/admin/users/' + u.id, {
      method: 'PUT',
      body: {
        email: u.email,
        user_metadata: {
          ...(u.user_metadata || {}),
          role: c.wantRole,
          display_name: c.wantName,
        },
      },
    });
    if (!r.ok) console.error(`  FEHLER ${u.email}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  console.log('  fertig.');

  // --- 2) profiles nachziehen (fehlende Profile werden angelegt) ---
  // WICHTIG: Updates brauchen PATCH. Ein POST wuerde einen neuen
  // Datensatz anlegen und scheitert an "null value in column id".
  // Der Service-Key umgeht dabei guard_role_change, weil dort
  // auth.uid() = null ist – sonst waeren Rollenwechsel verboten.
  console.log('\nSchritt 2: profiles-Tabelle');
  for (const c of todo) {
    if (c.oldRole === null) {
      // Kein Profil vorhanden -> anlegen. admin/teacher sind dabei
      // nicht moeglich, das blockiert guard_signup_role absichtlich.
      const r = await db('/rest/v1/profiles?on_conflict=id', {
        method: 'POST',
        body: { id: c.id, role: c.wantRole, display_name: c.wantName },
      });
      if (r.status < 300) {
        console.log(`  neu angelegt  ${c.email}: HTTP ${r.status} (${c.wantRole})`);
      } else {
        console.log(`  NEIN          ${c.email}: HTTP ${r.status}`);
        console.log('    ', (await r.text()).replace(/\s+/g, ' ').slice(0, 130));
      }
    } else {
      const r = await db('/rest/v1/profiles?id=eq.' + c.id, {
        method: 'PATCH',
        body: { role: c.wantRole, display_name: c.wantName },
      });
      if (r.status < 300) {
        console.log(`  aktualisiert  ${c.email}: HTTP ${r.status} (${c.wantRole})`);
      } else {
        console.log(`  NEIN          ${c.email}: HTTP ${r.status}`);
        console.log('    ', (await r.text()).replace(/\s+/g, ' ').slice(0, 130));
      }
    }
  }

  // --- 3) Kontrolle ---
  console.log('\n--- Kontrolle ---');
  const list2 = await admin('/auth/v1/admin/users?page=1&per_page=200');
  const { users: after = [] } = await list2.json();
  const profRes2 = await db('/rest/v1/profiles?select=id,role,display_name', { method: 'GET' });
  const profs2 = await profRes2.json();
  const map2 = new Map((profs2 || []).map((p) => [p.id, p]));

  const rows = after
    .map((u) => ({ email: u.email, ...map2.get(u.id) }))
    .sort((a, b) => (a.role || 'zzz').localeCompare(b.role || 'zzz'));

  for (const r of rows) {
    const flag = r.role ? '  ' : '!!';
    console.log(
      `${flag} ${(r.role || 'KEIN PROFIL').padEnd(8)} ${r.email.padEnd(38)} ${r.display_name || ''}`
    );
  }

  const ohne = rows.filter((r) => !r.role).length;
  console.log(
    ohne ? `\nNoch ${ohne} Konten ohne Profil.` : '\nAlle Konten haben ein Profil.'
  );
})();