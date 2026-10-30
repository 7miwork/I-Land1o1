// ============================================================
// I-Land1o1 – END-TO-END-TEST (kein Kauf noetig)
//   1) Anmeldung eltern -> create-checkout-session aufrufen
//      (prueft STRIPE_SECRET_KEY + Preis-IDs)
//   2) Stripe-API: Webhook-Endpunkte auflisten
//   3) Familie: create_invite (Eltern) -> accept_invite (Kind)
//      -> has_course_access(Kind) -> get-video-url
// Aufruf: node supabase/e2e-test.mjs
// ============================================================
import fs from 'node:fs';

const env = fs.readFileSync('Z:/I-Land1o1/Webseite/supabase/.env.local', 'utf8');
const get = (k) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1]?.trim();
const SB = get('SUPABASE_URL');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');
const STRIPE = get('STRIPE_SECRET_KEY');
const H = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' };

async function rest(path, opts = {}) {
  const r = await fetch(SB + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

async function login(email, password) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  return d.access_token ? { token: d.access_token, user: d.user } : { error: d };
}

// ---------- 1) Checkout testen ----------
console.log('=== 1) CHECKOUT (Preis-IDs pruefen) ===');
const parent = await login('eltern@i-land1o1.com', 'Pirat1234!');
if (parent.error) { console.log('Login eltern fehlgeschlagen:', JSON.stringify(parent.error).slice(0, 300)); process.exit(1); }
console.log('  Login eltern OK');

for (const plan of ['level1-once', 'level1-monthly']) {
  const r = await fetch(`${SB}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + parent.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  if (r.status === 200 && d.url) console.log(`  ${plan}: OK -> ${String(d.url).slice(0, 70)}...`);
  else console.log(`  ${plan}: FEHLER ${r.status} -> ${JSON.stringify(d).slice(0, 400)}`);
}

// ---------- 2) Stripe Webhook-Endpunkte ----------
console.log('\n=== 2) STRIPE WEBHOOK-ENDPUNKTE ===');
const wh = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
  headers: { Authorization: 'Bearer ' + STRIPE },
});
const whd = await wh.json();
if (whd.error) console.log('  Fehler: ' + JSON.stringify(whd.error).slice(0, 300));
else {
  for (const e of whd.data || []) {
    console.log(`  ${e.url}`);
    console.log(`    status=${e.status} enabled_events=${(e.enabled_events || []).length}`);
  }
  for (const e of whd.data || []) {
    const r = await fetch('https://api.stripe.com/v1/webhook_endpoints/' + e.id, {
      headers: { Authorization: 'Bearer ' + STRIPE },
    });
    const d = await r.json();
    if (d.secret) {
      const local = get('STRIPE_WEBHOOK_SECRET');
      console.log(`    secret (Stripe):  ${d.secret.slice(0, 14)}...endet ${d.secret.slice(-4)}`);
      console.log(`    secret (.env):    ${local.slice(0, 14)}...endet ${local.slice(-4)}`);
      console.log(`    TREFFER: ${d.secret === local ? 'JA' : 'NEIN'}`);
    } else {
      console.log('    secret: nicht ueber API auslesbar (nur im Dashboard)');
    }
  }
}


// ---------- 3) Familie: Code erstellen + einloesen ----------
console.log('\n=== 3) FAMILIE (Eltern-Kind-Link) ===');
const kind = await login('kind@i-land1o1.com', 'Pirat1234!');
if (kind.error) { console.log('Login kind fehlgeschlagen:', JSON.stringify(kind.error).slice(0, 300)); process.exit(1); }

const before = await rest('/rest/v1/parent_links?select=*');
console.log('  Links vorher: ' + JSON.stringify(before.data));

// Code als Eltern erstellen
const inv = await fetch(`${SB}/rest/v1/rpc/create_invite`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: 'Bearer ' + parent.token, 'Content-Type': 'application/json' },
  body: '{}',
});
const invText = await inv.text();
console.log(`  create_invite: HTTP ${inv.status} -> ${invText.slice(0, 200)}`);

if (inv.status === 200) {
  const code = invText.replace(/"/g, '').trim();
  const acc = await fetch(`${SB}/rest/v1/rpc/accept_invite`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + kind.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: code }),
  });
  const accText = await acc.text();
  console.log(`  accept_invite(${code}): HTTP ${acc.status} -> ${accText.slice(0, 200)}`);

  const after = await rest('/rest/v1/parent_links?select=*');
  console.log('  Links nachher: ' + JSON.stringify(after.data));

  const accKind = await rest('/rest/v1/rpc/has_course_access', {
    method: 'POST',
    body: JSON.stringify({ p_user: kind.user.id }),
  });
  console.log('  has_course_access(Kind): ' + JSON.stringify(accKind.data));

  const vid = await fetch(`${SB}/functions/v1/get-video-url`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + kind.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_id: 'l01' }),
  });
  const vt = await vid.text();
  console.log(`  get-video-url(Kind, l01): HTTP ${vid.status} -> ${vt.slice(0, 160)}`);
}

// Video-URL fuer Eltern (haben Abo)
const vidP = await fetch(`${SB}/functions/v1/get-video-url`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: 'Bearer ' + parent.token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ lesson_id: 'l01' }),
});
const vtp = await vidP.text();
console.log(`  get-video-url(Eltern, l01): HTTP ${vidP.status} -> ${vtp.slice(0, 160)}`);
