// ============================================================
// I-Land1o1 – create-portal-session
// EINFÜGEN in Supabase -> Edge Functions -> create-portal-session -> index.ts
// ------------------------------------------------------------
// Diese Datei ist eine Einzeldatei-Fassung: cors.ts und plans.ts
// sind bereits eingebettet, daher gibt es keine _shared-Importe.
// Quelle im Repo: supabase/functions/create-portal-session/index.ts
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

// ---------- create-portal-session/index.ts ----------
// Erstellt eine Stripe-Billing-Portal-Session, damit Eltern/Kunden
// ihre Zahlungsmittel, Rechnungen und das Abo selbst verwalten koennen.
//
// Verify JWT: AN

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

    // Kundennummer kommt aus unserer DB, nicht aus dem Browser.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) return fail('Du hast noch kein Abo.', 404);

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl()}/dashboard/?portal=zurueck`,
    });

    return json({ url: portal.url });
  } catch (err) {
    console.error('[edge] create-portal-session', err);
    return fail('Kundenportal konnte nicht geoeffnet werden.', 500);
  }
});
