// ============================================================
// I-Land1o1 – DIAGNOSE (nur temporaer, danach wieder loeschen!)
// Listet auf, welche Variablen diese Edge Function sieht.
// Es werden KEINE Werte ausgegeben – nur "gesetzt/fehlt".
// ------------------------------------------------------------
// So benutzen:
//  1. Supabase -> Edge Functions -> Deploy a new function -> Via Editor
//  2. Name: DIAGNOSIS        (mit D, damit es nicht verwechselt wird)
//  3. Diese Datei als index.ts einfuegen -> Deploy
//  4. Aufrufen: https://<projekt>.supabase.co/functions/v1/DIAGNOSIS
//  5. Ergebnis mit mir durchgehen, danach Function wieder loeschen
// ============================================================

const NEEDED = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_LEVEL1_MONTHLY',
  'STRIPE_PRICE_LEVEL1_YEARLY',
  'STRIPE_PRICE_LEVEL1_ONCE',
  'SITE_URL',
];

// zeigt nur die ersten Zeichen, damit man erkennt,
// ob z. B. ein Leerzeichen oder "sk_test_..." dort steht
function peek(v) {
  if (!v) return null;
  const s = String(v);
  return { set: true, laenge: s.length, start: s.slice(0, 12) + '…' };
}

Deno.serve(async () => {
  const rows = NEEDED.map((name) => {
    const v = Deno.env.get(name);
    return { name, ...(peek(v) || { set: false }) };
  });

  return new Response(JSON.stringify({ rows }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});