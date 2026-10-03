// Erstellt eine Stripe-Billing-Portal-Session, damit Eltern/Kunden
// ihre Zahlungsmittel, Rechnungen und das Abo selbst verwalten koennen.
//
// Verify JWT: AN

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { preflight, json, fail } from '../_shared/cors.ts';
import { siteUrl, requireUser } from '../_shared/plans.ts';

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