// ============================================================
// I-Land1o1 – DIAGNOSE: prueft den kompletten Kauf-Zugang-
//   Kette: profiles -> subscriptions -> parent_links ->
//          has_course_access -> lesson_videos
// Aufruf: node supabase/diagnose-access.mjs
// Liest supabase/.env.local (bleibt lokal).
// ============================================================
import fs from 'node:fs';

const env = fs.readFileSync('Z:/I-Land1o1/Webseite/supabase/.env.local', 'utf8');
const get = (k) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1]?.trim();
const SB = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' };

async function rest(path, opts = {}) {
  try {
    const r = await fetch(SB + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data };
  } catch (e) {
    return { status: 0, data: e.message };
  }
}

const out = [];
const log = (s) => { console.log(s); out.push(s); };

// 1) Auth-Users
const users = await rest('/auth/v1/admin/users?page=1&per_page=200');
const list = users.data?.users || [];
log('=== AUTH-USERS ===');
for (const u of list) log(`  ${u.email}  (${u.id})`);

// 2) profiles
log('\n=== PROFILES ===');
const prof = await rest('/rest/v1/profiles?select=id,role,display_name&limit=50');
if (prof.status === 200) {
  for (const p of prof.data) log(`  ${p.display_name ?? '?'} | role=${p.role} | ${p.id}`);
  if (!prof.data.length) log('  (leer!)');
} else log('  FEHLER: ' + JSON.stringify(prof.data).slice(0, 300));

// 3) subscriptions – erst ganze Zeile, dann Spalten-Probe
log('\n=== SUBSCRIPTIONS ===');
const subs = await rest('/rest/v1/subscriptions?select=*&limit=10');
log('  Status ' + subs.status + ': ' + JSON.stringify(subs.data).slice(0, 500));
const subsCols = await rest('/rest/v1/subscriptions?select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end&limit=10');
log('  Spalten-Probe (Stripe-Form): ' + subsCols.status + ' ' + JSON.stringify(subsCols.data).slice(0, 400));

// 4) parent_links / parent_invites
log('\n=== PARENT_LINKS ===');
const links = await rest('/rest/v1/parent_links?select=*&limit=20');
log('  ' + links.status + ': ' + JSON.stringify(links.data).slice(0, 400));
log('\n=== PARENT_INVITES (status/accepted_at) ===');
const inv1 = await rest('/rest/v1/parent_invites?select=code,status,accepted_at,parent_id&limit=10');
log('  ' + inv1.status + ': ' + JSON.stringify(inv1.data).slice(0, 400));
log('\n=== PARENT_INVITES (used_at) ===');
const inv2 = await rest('/rest/v1/parent_invites?select=code,used_at,parent_id&limit=10');
log('  ' + inv2.status + ': ' + JSON.stringify(inv2.data).slice(0, 400));

// 5) has_course_access fuer alle Users testen
log('\n=== HAS_COURSE_ACCESS ===');
for (const u of list) {
  const r = await rest('/rest/v1/rpc/has_course_access', {
    method: 'POST',
    body: JSON.stringify({ p_user: u.id }),
  });
  log(`  ${u.email}: ${r.status} -> ${JSON.stringify(r.data)}`);
}

// 6) lesson_videos
log('\n=== LESSON_VIDEOS ===');
const vids = await rest('/rest/v1/lesson_videos?select=lesson_id,title&limit=100');
if (vids.status === 200) {
  log('  Anzahl: ' + vids.data.length);
  for (const v of vids.data.slice(0, 15)) log(`  lesson_id=${v.lesson_id} | ${v.title ?? ''}`);
} else log('  ' + vids.status + ': ' + JSON.stringify(vids.data).slice(0, 300));

// 7) parent_invites Spalten generisch (information_schema geht nicht ueber REST,
//    aber der Fehler verrät, welche Spalte fehlt)
log('\n=== SPALTEN-PROBE parent_invites ===');
for (const sel of ['code', 'status', 'accepted_at', 'used_at', 'student_id', 'parent_id', 'created_at']) {
  const r = await rest(`/rest/v1/parent_invites?select=${sel}&limit=1`);
  log(`  ${sel}: ${r.status === 200 ? 'OK' : 'FEHLT (' + r.status + ') ' + JSON.stringify(r.data).slice(0, 120)}`);
}

// 8) Spalten-PROBE subscriptions
log('\n=== SPALTEN-PROBE subscriptions ===');
for (const sel of ['user_id', 'plan', 'status', 'stripe_customer_id', 'stripe_subscription_id', 'current_period_end', 'cancel_at_period_end', 'updated_at', 'monthly_lesson_quota', 'remaining_credits', 'current_period_start']) {
  const r = await rest(`/rest/v1/subscriptions?select=${sel}&limit=1`);
  log(`  ${sel}: ${r.status === 200 ? 'OK' : 'FEHLT (' + r.status + ') ' + JSON.stringify(r.data).slice(0, 120)}`);
}

fs.writeFileSync('Z:/I-Land1o1/Webseite/supabase/_diagnose-out.txt', out.join('\n'));
console.log('\ngespeichert: supabase/_diagnose-out.txt');
