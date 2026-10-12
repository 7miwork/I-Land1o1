// Stripe-Webhook: haelt subscriptions/payments in Supabase aktuell.
//
// WICHTIG: "Verify JWT" muss im Supabase-Dashboard AUS sein – Stripe
// ruft diese URL ohne Supabase-Token auf. Die Sicherheit kommt stattdessen
// aus der Signaturpruefung (STRIPE_WEBHOOK_SECRET): Jede Anfrage wird
// verifiziert, Manipulation ist damit nicht moeglich.

import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ------------------------------------------------------------
  // Achtung Stripe-API-Versionen: Ab 2025-03-31 ("basil") liegt
  // current_period_end NICHT mehr am Subscription-Objekt, sondern
  // bei den Items. Wir lesen deshalb beide Varianten, damit es
  // egal ist, welche Version im Webhook-Endpoint eingestellt ist.
  // ------------------------------------------------------------
  function periodEndOf(sub) {
    const ts =
      sub?.current_period_end ??
      sub?.items?.data?.[0]?.current_period_end ??
      null;
    return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!supabaseUrl || !serviceKey || !stripeKey || !webhookSecret) {
    console.error('[webhook] Secrets fehlen');
    return new Response('Server nicht konfiguriert', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' });

  // 1) Signatur pruefen (bevor irgendetwas passiert)
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      Stripe.createSubtleCryptoProvider(),
      undefined,
    );
  } catch (err) {
    console.error('[webhook] Signatur ungueltig', err);
    return new Response('invalid signature', { status: 400 });
  }

  // 2) Serverseitiger Client mit service role: umgeht RLS (darf alles)
  const db = createClient(supabaseUrl, serviceKey);

  // WICHTIG: Der Supabase-Client wirft bei einem fehlgeschlagenen
  // Schreiben KEINEN Fehler, sondern gibt { data, error } zurueck.
  // Wer das ignoriert, loggt "Abo aktiviert", obwohl nichts in der
  // Datenbank angekommen ist - genau dieser Fehler war hier drin.
  // Diese Helfer-Funktion macht aus einem stillen Fehler einen lauten.
  async function write(what, result) {
    const { error } = await result;
    if (error) {
      console.error(`[webhook] SCHREIBFEHLER (${what}):`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      // 500 => Stripe wiederholt den Aufruf. Ein bezahlter Vorgang
      // darf nicht stillschweigend verloren gehen.
      throw error;
    }
  }

  try {
    switch (event.type) {
      // Bezahlung abgeschlossen -> Abo aktivieren
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const plan = session.metadata?.plan || 'level1-monthly';

        // Abo-Details nachladen (Status + Laufzeit)
        let subStatus = 'active';
        let periodEnd = null;
        let cancelAtEnd = false;
        let subscriptionId = null;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
          );
          subStatus = sub.status;
          subscriptionId = sub.id;
          cancelAtEnd = sub.cancel_at_period_end;
          periodEnd = periodEndOf(sub);
        }

        if (userId) {
          if (session.mode === 'payment') {
            // Einmalzahlung: dauerhafter Zugang, KEIN Abo.
            // 'paid' heisst: bezahlt und nicht ablaeufig.
            await write('subscriptions:once', db.from('subscriptions').upsert(
              {
                user_id: userId,
                stripe_customer_id:
                  typeof session.customer === 'string' ? session.customer : session.customer?.id,
                stripe_subscription_id: null,
                plan,
                status: 'paid',
                // HINWEIS: current_period_end darf NICHT null sein. Die
                // Spalte in der Datenbank hat ein NOT NULL – ein null
                // liess den ganzen upsert mit 23502 scheitern (der
                // Webhook brach dann mit 500 ab). Fuer die Einmalzahlung
                // tragen wir ein fernes Datum ein: der Zugang soll
                // dauerhaft gelten. has_course_access() prueft bei
                // status 'paid' NICHT das Datum, nur active/trialing
                // werden gegen current_period_end geprueft.
                current_period_end: '2099-12-31T23:59:59Z',
                cancel_at_period_end: false,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' },
            ));
            console.log('[webhook] Einmalzahlung freigeschaltet', { userId, plan });
          } else {
            await write('subscriptions:subscription', db.from('subscriptions').upsert(
              {
                user_id: userId,
                stripe_customer_id:
                  typeof session.customer === 'string' ? session.customer : session.customer?.id,
                stripe_subscription_id: subscriptionId,
                plan,
                status: subStatus,
                // NOT NULL: nie null eintragen (sonst 23502 -> 500).
                // Fehlt das Datum, gilt dauerhafter Zugang als Notfall.
                current_period_end: periodEnd ?? '2099-12-31T23:59:59Z',
                cancel_at_period_end: cancelAtEnd,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' },
            ));
            console.log('[webhook] Abo aktiviert', { userId, plan, subStatus });
          }
        }
        break;
      }
      // Abo geaendert (Zahlungsmittel, Verlaengerung, Kuendigung)
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.created': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
        const row = {
          stripe_customer_id:
            typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          stripe_subscription_id: sub.id,
          plan: sub.metadata?.plan || 'level1-monthly',
          status,
          // NOT NULL: periodEndOf kann null liefern -> nie null eintragen
          current_period_end: periodEndOf(sub) ?? '2099-12-31T23:59:59Z',
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        };

        if (userId) {
          await write('subscriptions:abo-update', db.from('subscriptions').upsert(row, { onConflict: 'user_id' }));
        } else {
          // Fallback: ueber die Stripe-Subscription-ID den User finden
          await write('subscriptions:abo-fallback', db.from('subscriptions').update(row).eq('stripe_subscription_id', sub.id));
        }
        console.log('[webhook] Abo-Update', { type: event.type, status });
        break;
      }

      // Zahlung erfolgreich -> Zahlungsprotokoll
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        // Zahlung einem User zuordnen
        let userId = null;
        if (customerId) {
          const { data: row } = await db
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          userId = row?.user_id || null;
        }

        if (userId) {
          await write('payments:invoice', db.from('payments').upsert(
            {
              user_id: userId,
              stripe_invoice_id: invoice.id,
              amount_cents: invoice.amount_paid || 0,
              currency: invoice.currency || 'eur',
              status: 'paid',
              paid_at: new Date().toISOString(),
            },
            { onConflict: 'stripe_invoice_id' },
          ));
          console.log('[webhook] Zahlung erfasst', { userId, amount: invoice.amount_paid });
        }
        break;
      }

      default:
        // Unwichtige Events (z. B. invoice.created) bewusst ignorieren
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[webhook] Verarbeitung fehlgeschlagen', err);
    // 500 => Stripe wiederholt den Aufruf (wichtig bei Timeouts)
    return new Response('processing error', { status: 500 });
  }
});