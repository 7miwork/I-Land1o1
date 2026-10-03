// ============================================================
// I-Land1o1 – create-checkout-session
// EINFÜGEN in Supabase -> Edge Functions -> create-checkout-session -> index.ts
// ------------------------------------------------------------
// Diese Datei ist eine Einzeldatei-Fassung: cors.ts und plans.ts
// sind bereits eingebettet, daher gibt es keine _shared-Importe.
// Quelle im Repo: supabase/functions/create-checkout-session/index.ts
// ============================================================

// ---------- _shared/cors.ts ----------
// Gemeinsame CORS-Helfer fuer alle Edge Functions.
// CORS ist noetig, damit das Dashboard (andere Domain/Port) die Function aufrufen kann.
// Sicherheit entsteht NICHT dadurch, sondern durch die JWT-Pruefung in jeder Function.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Preflight beantworten und null zurueckgeben, wenn es kein OPTIONS ist.
function preflight(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// Klare Fehlermeldungen, ohne interne Details nach aussen zu geben.
// `extra` wird mitgeschickt (z. B. { locked: true }).
function fail(message, status = 400, extra = {}) {
  console.error('[edge]', message, extra);
  return json({ error: message, ...extra }, status);
}

// ---------- _shared/plans.ts ----------
// Serverseitige Tarif-Whitelist.
//
// SICHERHEITSKERN: Der Browser darf nur einen PLAN-NAMEN schicken
// (z. B. "level1-monthly"), niemals einen Preis. Die Preis-ID wird
// hier serverseitig aufgeloest. Sonst koennte jeder Besucher im
// Browser seinen Abo-Preis auf 1 Cent stellen.

const PLANS = {
  'level1-monthly': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_MONTHLY',
    label: 'Level 1 – monatlich',
    mode: 'subscription',
  },
  'level1-yearly': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_YEARLY',
    label: 'Level 1 – jährlich',
    mode: 'subscription',
  },
  // Einmalzahlung: dauerhafter Zugang, kein Abo, keine Verlaengerung
  'level1-once': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_ONCE',
    label: 'Level 1 – einmalig (11 Lektionen)',
    mode: 'payment',
  },
};

// Liefert die Preis-ID oder null, wenn der Plan unbekannt bzw.
// die Secret nicht gesetzt ist.
function priceFor(plan) {
  const entry = PLANS[plan];
  if (!entry) return null;
  const id = Deno.env.get(entry.priceEnv);
  // Sicherheitsnetz: eine Preis-ID sieht immer so aus. Verhindert,
  // dass jemand versehentlich den Secret-Key als "Preis" setzt.
  return id && id.startsWith('price_') ? id : null;
}

function labelFor(plan) {
  return PLANS[plan]?.label ?? plan;
}

// 'subscription' = Abo mit Verlaengerung, 'payment' = einmaliger Kauf
function modeFor(plan) {
  return PLANS[plan]?.mode === 'payment' ? 'payment' : 'subscription';
}

function siteUrl() {
  return (Deno.env.get('SITE_URL') || 'https://i-land1o1.com').replace(/\/$/, '');
}

// Holt den angemeldeten User aus dem JWT. Ohne gueltige Session: null.
async function requireUser(req, supabase) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const { data, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', '').trim());
  if (error || !data?.user) return null;
  return data.user;
}

// ---------- create-checkout-session/index.ts ----------
// Erstellt eine Stripe-Checkout-Session fuer eine neues Abo.
// Aufruf aus dem Frontend: supabase.functions.invoke('create-checkout-session', { body: { plan } })
//
// Verify JWT: AN (im Supabase-Dashboard bei "Verify JWT" aktiv lassen!)

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    if (req.method !== 'POST') return fail('Method not allowed', 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey || !stripeKey) {
      return fail('Server nicht konfiguriert (Secrets fehlen).', 500);
    }

    const anon = createClient(supabaseUrl, anonKey);
    const user = await requireUser(req, anon);
    if (!user) return fail('Bitte zuerst anmelden.', 401);

    let body;
    try {
      body = await req.json();
    } catch {
      return fail('Ungueltige Anfrage.', 400);
    }

    // 1) Plan pruefen -> Preis kommt ausschliesslich vom Server
    const plan = String(body?.plan || '');
    const priceId = priceFor(plan);
    if (!priceId) return fail('Unbekannter Tarif.', 400);

    // 2) Schon bezahlt? Dann nicht doppelt kaufen lassen.
    const mode = modeFor(plan);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: existing } = await admin
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'paid'])
      .maybeSingle();
    if (existing) {
      // Einmalzahlung gilt dauerhaft -> kein weiterer Kauf derselben Sache
      if (existing.status === 'paid' && existing.plan === plan) {
        return fail('Diesen Zugang hast du bereits.', 409, { alreadySubscribed: true });
      }
      if (existing.status === 'paid') {
        return fail('Du hast bereits den einmaligen Kauf.', 409, { alreadySubscribed: true });
      }
      return fail('Du hast schon ein aktives Abo – bitte im Kundenportal verwalten.', 409, {
        alreadySubscribed: true,
      });
    }

    // 3) Checkout-Session bauen (Preis ist serverseitig festgelegt)
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const site = siteUrl();

    const session = await stripe.checkout.sessions.create({
      // Einmalzahlung -> kein Abo, keine Verlaengerung
      mode: mode,
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      locale: 'de',
      success_url: `${site}/dashboard/?checkout=erfolg`,
      cancel_url: `${site}/dashboard/?checkout=abgebrochen`,
      // metadata landet in beiden Objekten -> damit kann der Webhook
      // das Abo spaeter eindeutig einem User zuordnen.
      metadata: { user_id: user.id, plan },
      // Bei Einmalzahlung darf kein Abo-Metadatenblock mitgegeben werden
      ...(mode === 'subscription'
        ? { subscription_data: { metadata: { user_id: user.id, plan } } }
        : {}),
      // Nur beim Abo braucht Stripe die Grundlage fuer spaetere Abbuchungen
      ...(mode === 'subscription'
        ? { payment_intent_data: { setup_future_usage: 'off_session' } }
        : {}),
    });

    if (!session.url) return fail('Kasse konnte nicht gestartet werden.', 500);

    console.log('[edge] checkout erstellt', { user_id: user.id, plan, label: labelFor(plan) });
    return json({ url: session.url });
  } catch (err) {
    console.error('[edge] create-checkout-session', err);
    return fail('Kasse konnte nicht gestartet werden.', 500);
  }
});
