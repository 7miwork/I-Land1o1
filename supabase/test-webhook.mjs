// ============================================================
// I-Land1o1 – Webhook testen, OHNE einzukaufen
// ------------------------------------------------------------
// Warum? Der Weg Klick -> Stripe -> Webhook -> Datenbank -> Video
// laesst sich nur pruefen, wenn Stripe den Webhook wirklich ruft.
// Entweder man kauft mit einer Testkarte (4242...) oder man schickt
// der Function ein SIGNIERTES Event, das exakt aussieht wie eines
// von Stripe. Genau das macht dieses Script.
//
// Die Signatur ist echt: t=<zeit>,v1=HMAC-SHA256 aus
// "<zeit>.<payload>". Ohne den richtigen STRIPE_WEBHOOK_SECRET
// lehnt die Function mit "invalid signature" ab – es wird also
// nichts vorgetaeuscht.
//
// Vorbereitung (einmalig):
//   Stripe -> Developers -> Webhooks -> dein Endpoint
//   -> "Signing secret" anzeigen -> whsec_...
//   In supabase\\.env.local eintragen:
//     STRIPE_WEBHOOK_SECRET=whsec_...
//
// Verwendung:
//   node supabase/test-webhook.mjs                     # Abo monatlich
//   node supabase/test-webhook.mjs level1-once         # Einmalzahlung
//   node supabase/test-webhook.mjs level1-monthly kind@i-land1o1.com
// ============================================================

import crypto from 'node:crypto';
import { getKey, getProjectUrl } from './keys.mjs';

const SB_URL = getProjectUrl();
const SERVICE = getKey('SUPABASE_SERVICE_ROLE_KEY');
const WEBHOOK_SECRET = getKey('STRIPE_WEBHOOK_SECRET');

const PLAN = process.argv[2] || 'level1-monthly';
const EMAIL = process.argv[3] || 'eltern@i-land1o1.com';

// mode: Abo verlaengert sich, Einmalzahlung nicht
const MODE = PLAN === 'level1-once' ? 'payment' : 'subscription';

if (!WEBHOOK_SECRET) {
  console.error('❌ STRIPE_WEBHOOK_SECRET fehlt (supabase/.env.local).');
  console.error('   Stripe -> Developers -> Webhooks -> Signing secret.');
  process.exit(1);
}

// --- 1) Den echten User finden -------------------------------------
const adminHeaders = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };
const usersRes = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=200`, {
  headers: adminHeaders,
});
const { users = [] } = await usersRes.json();
const user = users.find((u) => u.email === EMAIL);

if (!user) {
  console.error(`❌ Konto nicht gefunden: ${EMAIL}`);
  console.error('   Vorhanden: ' + users.map((u) => u.email).join(', '));
  process.exit(1);
}
console.log(`Konto: ${user.email} (${user.id})\n`);

// --- 2) Event bauen, wie Stripe es schicken wuerde -----------------
const session = {
  id: 'cs_test_' + crypto.randomBytes(12).toString('hex'),
  object: 'checkout.session',
  mode: MODE,
  client_reference_id: user.id,
  customer: 'cus_' + crypto.randomBytes(8).toString('hex'),
  customer_email: user.email,
  metadata: { user_id: user.id, plan: PLAN },
  payment_status: 'paid',
};

// Abo bekommt eine subscription. WICHTIG: Die Function ruft fuer
// diesen Zweig stripe.subscriptions.retrieve() auf. Eine erfundene ID
// (sub_...) existiert bei Stripe nicht -> die Function bricht mit 500
// ab. Fuer den Durchlauf ohne echten Kauf darf deshalb KEINE
// subscription mitgeschickt werden; die Function setzt dann
// status='active' als Vorgabe. Genau dieser Zweig wird hier getestet.
if (MODE === 'subscription') {
  session.subscription_data = { metadata: { user_id: user.id, plan: PLAN } };
}

const event = {
  id: 'evt_' + crypto.randomBytes(12).toString('hex'),
  object: 'event',
  type: 'checkout.session.completed',
  api_version: '2024-06-20',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  data: { object: session },
};

const payload = JSON.stringify(event);

// --- 3) Signatur bilden (identisch zu Stripe) ----------------------
const timestamp = Math.floor(Date.now() / 1000);
const signed = `${timestamp}.${payload}`;
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(signed, 'utf8')
  .digest('hex');
const header = `t=${timestamp},v1=${signature}`;

console.log(`Event: ${event.type}`);
console.log(`Plan:  ${PLAN} (${MODE})\n`);

// --- 4) Absenden ---------------------------------------------------
const res = await fetch(`${SB_URL}/functions/v1/stripe-webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': header,
  },
  body: payload,
});

console.log(`Webhook-Antwort: HTTP ${res.status} ${(await res.text()).slice(0, 80)}`);

if (res.status !== 200) {
  console.error('\n❌ Abgelehnt. Haeufigste Ursachen:');
  console.error('   - STRIPE_WEBHOOK_SECRET in .env.local ist der LIVE-Key');
  console.error('     (whsec_... aus dem Testmodus nehmen!)');
  console.error('   - Function hat ein anderes Secret gesetzt');
  process.exit(1);
}

// --- 5) Pruefen, was in der Datenbank gelandet ist -----------------
console.log('\n--- Abo in der Datenbank ---');
const subRes = await fetch(
  `${SB_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&select=plan,status,stripe_customer_id,cancel_at_period_end`,
  { headers: adminHeaders }
);
const rows = await subRes.json();

if (!rows.length) {
  console.error('❌ Keine Zeile geschrieben – Webhook hat nicht gegriffen.');
  process.exit(1);
}

for (const r of rows) {
  console.log(`  plan:      ${r.plan}`);
  console.log(`  status:    ${r.status}`);
  console.log(`  Kunde:     ${r.stripe_customer_id ?? '(keiner)'}`);
}

// --- 6) Zugang pruefen --------------------------------------------
const accessRes = await fetch(`${SB_URL}/rest/v1/rpc/has_course_access`, {
  method: 'POST',
  headers: { ...adminHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_user: user.id }),
});
const hasAccess = await accessRes.text();

console.log(`\nZugang (has_course_access): ${hasAccess === 'true' ? 'JA ✅' : 'NEIN ❌'}`);

if (hasAccess !== 'true') {
  console.error('   -> status muss active/trialing/paid sein.');
  process.exit(1);
}

console.log('\nNächster Schritt: Video-URL für eine Lektion holen.');
console.log('  node supabase/test-video-access.mjs');
