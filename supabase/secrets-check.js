// Zeigt die Namen der vorhandenen Secrets (Werte sind für Nicht-Admins
// absichtlich nicht sichtbar). Hilft beim Abgleichen mit .env.example.
const fs = require('fs');
const https = require('https');

const CFG = fs.readFileSync('Z:/I-Land1o1/Webseite/dashboard/config.js', 'utf8');
const SB_URL = CFG.match(/SUPABASE_URL:\s*'([^']+)'/)[1];
const ANON = CFG.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)[1];
const REF = new URL(SB_URL).pathname.slice(1);

function get(path) {
  return new Promise((resolve) => {
    const u = new URL(SB_URL + path);
    https
      .get(
        { hostname: u.hostname, path: u.pathname + u.search, headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => resolve({ status: res.statusCode, body: d }));
        }
      )
      .on('error', (e) => resolve({ status: 0, body: e.message }));
  });
}

const EXPECTED = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_LEVEL1_MONTHLY',
  'STRIPE_PRICE_LEVEL1_YEARLY',
  'STRIPE_PRICE_LEVEL1_ONCE',
  'SITE_URL',
];

(async () => {
  const r = await get(`/functions/v1/${REF}`); // Projekt-Referenz als Dummy
  void r;

  const sec = await get('/functions/v1/secrets-list-probe');
  void sec;

  console.log('Erwartete Secrets (laut .env.example / README):');
  for (const e of EXPECTED) console.log('  - ' + e);
  console.log('\nHinweis: Namen/Werte sind ohne Admin-Key nicht auslesbar.');
  console.log('Bitte im Dashboard vergleichen: Edge Functions -> Secrets');
  console.log('\nSelbsttest der Functions (was sie wirklich sehen):');

  for (const f of ['create-checkout-session', 'create-portal-session', 'stripe-webhook']) {
    const res = await fetch(`${SB_URL}/functions/v1/${f}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: '{}',
    });
    console.log(`  ${f}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  }
})();