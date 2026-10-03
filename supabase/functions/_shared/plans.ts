// Serverseitige Tarif-Whitelist.
//
// SICHERHEITSKERN: Der Browser darf nur einen PLAN-NAMEN schicken
// (z. B. "level1-monthly"), niemals einen Preis. Die Preis-ID wird
// hier serverseitig aufgeloest. Sonst koennte jeder Besucher im
// Browser seinen Abo-Preis auf 1 Cent stellen.

export const PLANS = {
  'level1-monthly': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_MONTHLY',
    label: 'Level 1 – monatlich',
  },
  'level1-yearly': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_YEARLY',
    label: 'Level 1 – jährlich',
  },
};

// Liefert die Preis-ID oder null, wenn der Plan unbekannt bzw.
// die Secret nicht gesetzt ist.
export function priceFor(plan) {
  const entry = PLANS[plan];
  if (!entry) return null;
  const id = Deno.env.get(entry.priceEnv);
  // Sicherheitsnetz: eine Preis-ID sieht immer so aus. Verhindert,
  // dass jemand versehentlich den Secret-Key als "Preis" setzt.
  return id && id.startsWith('price_') ? id : null;
}

export function labelFor(plan) {
  return PLANS[plan]?.label ?? plan;
}

export function siteUrl() {
  return (Deno.env.get('SITE_URL') || 'https://i-land1o1.com').replace(/\/$/, '');
}

// Holt den angemeldeten User aus dem JWT. Ohne gueltige Session: null.
export async function requireUser(req, supabase) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const { data, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', '').trim());
  if (error || !data?.user) return null;
  return data.user;
}