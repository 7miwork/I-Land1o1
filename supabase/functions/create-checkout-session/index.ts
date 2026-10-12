// Erstellt eine Stripe-Checkout-Session fuer eine neues Abo.
// Aufruf aus dem Frontend: supabase.functions.invoke('create-checkout-session', { body: { plan } })
//
// Verify JWT: AN (im Supabase-Dashboard bei "Verify JWT" aktiv lassen!)

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { preflight, json, fail } from '../_shared/cors.ts';
import { priceFor, labelFor, modeFor, siteUrl, requireUser } from '../_shared/plans.ts';

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
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' });
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
    // Warum wird der Fehler weitergereicht? Ohne das bleibt ein
    // falscher API-Key, ein abgelaufener Preis oder ein fehlendes
    // Secret woertlich unsichtbar – man sieht nur "HTTP 500".
    // err.type / err.code nennen die Ursache konkret (z. B.
    // "StripeAuthenticationError" bei falschem Key). Der API-Key
    // selbst steht NIE in diesem Feld.
    const e = err ?? {};
    const reason =
      e.type || e.code || e.raw?.code || e.raw?.type || e.name || 'unbekannt';
    const info =
      (typeof e.raw?.message === 'string' && e.raw.message.slice(0, 200)) ||
      (typeof e.message === 'string' && e.message.slice(0, 200)) ||
      '';
    return json(
      { error: 'Kasse konnte nicht gestartet werden.', reason: String(reason), info },
      500
    );
  }
});