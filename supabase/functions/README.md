# I-Land1o1 – Supabase Edge Functions (Stripe)

Hier liegen die **Server-Funktionen** für Zahlungen. Sie sind der einzige Ort,
an dem der geheime Stripe-Schlüssel liegt – im Frontend (`dashboard/`) steht
nur ein **Tarifname**, niemals ein Preis.

```
Browser (Dashboard)
  └─ supabase.functions.invoke('create-checkout-session', { plan: 'level1-monthly' })
        │  (JWT beweist: wer ist eingeloggt)
        ▼
   Edge Function  ──►  Stripe Checkout (Preis kommt aus der Server-Whitelist)
        ▲
        │  (Stripe meldet Zahlung/Abo-Änderungen)
   Edge Function stripe-webhook  ──►  schreibt subscriptions / payments in Supabase
```

## Dateien

| Datei | Zweck | Verify JWT |
|-------|-------|-----------|
| `_shared/cors.ts` | CORS-Header, JSON-Fehler | – |
| `_shared/plans.ts` | Tarif-Whitelist + Preis-Auflösung, User-Check | – |
| `create-checkout-session/index.ts` | Startet die Stripe-Kasse | **AN** |
| `create-portal-session/index.ts` | Öffnet das Stripe-Kundenportal | **AN** |
| `stripe-webhook/index.ts` | Schreibt Abo-/Zahlungsdaten in die DB | **AUS** (Stripe ruft ohne Token) |

## Einrichtung (einmalig)

### 1. Tabellen anlegen
Supabase Dashboard → **SQL Editor** → Inhalt von `../subscriptions.sql` → **Run**.

### 2. Stripe-Produkt anlegen
1. <https://dashboard.stripe.com/test/products> → **Add product**
   (z. B. „I-Land1o1 Level 1“) → darunter **Pricing** → monatlich **z. B. 19,99 €** + jährlich
2. Preis-IDs notieren (`price_…`)

### 3. Secrets in Supabase hinterlegen
Dashboard → **Project Settings → Edge Functions → Secrets** → **Add new secret**:

| Name | Wert |
|------|------|
| `STRIPE_SECRET_KEY` | `sk_test_…` (Stripe → Developers → API keys) |
| `STRIPE_WEBHOOK_SECRET` | kommt in Schritt 5 |
| `STRIPE_PRICE_LEVEL1_MONTHLY` | `price_…` aus Schritt 2 |
| `STRIPE_PRICE_LEVEL1_YEARLY` | `price_…` aus Schritt 2 |
| `SITE_URL` | `https://i-land1o1.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **service_role** |

> `SUPABASE_URL` und `SUPABASE_ANON_KEY` sind in Edge Functions automatisch gesetzt.

### 4. Functions deployen
Dashboard → **Edge Functions → Create Function**

Für jede der drei Funktionen (`create-checkout-session`, `create-portal-session`,
`stripe-webhook`):

1. Namen eingeben, **Deploy**
2. Danach **Edit function** → Inhalt der jeweiligen `index.ts` einfügen → **Deploy**
3. Bei den ersten beiden: **Verify JWT = AN** (Häkchen gesetzt)

### 5. Webhook in Stripe eintragen
1. <https://dashboard.stripe.com/test/webhooks> → **Add endpoint**
2. URL:
   `https://lmlbjtazgcylsrtzzisr.supabase.co/functions/v1/stripe-webhook`
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.created` / `.updated` / `.deleted`
   - `invoice.payment_succeeded`
4. Nach dem Anlegen: **Signing secret** (`whsec_…`) als
   `STRIPE_WEBHOOK_SECRET` in Supabase eintragen

### 6. Billing-Portal aktivieren
Stripe Dashboard → **Settings → Billing → Customer portal** → **Activate**
(sonst liefert `create-portal-session` einen Fehler).

### 7. Testen
Im Dashboard anmelden → Abschnitt **„⚓ Abo & Zahlung"** → **„Abo starten"**.
Stripe Testkarten: `4242 4242 4242 4242`, beliebiges Datum, CVC `123`.
Prüfen: `subscriptions`-Tabelle in Supabase enthält eine Zeile mit `status = active`.

## Checkliste vor dem Livegang
- [ ] Von `sk_test_…` auf `sk_live_…` wechseln (Live-Modus in Stripe)
- [ ] Live-Preise statt Test-Preise als Secrets eintragen
- [ ] Webhook-Endpoint auf **Live-Modus** anlegen (nicht nur Test!)
- [ ] `SITE_URL` zeigt auf die echte Domain