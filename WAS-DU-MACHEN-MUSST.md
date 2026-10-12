# Was DU machen musst – 3 Deploy-Schritte

Signaturprüfung läuft inzwischen (200 statt 401/400), aber die Function
schreibt nichts. Der Grund ist eindeutig geklärt.

## Der Beweis

Drei Events mit **gültiger Signatur** geschickt:

| Event | Antwort |
|---|---|
| `checkout.session.completed` | 200 `{"received":true}` |
| `customer.subscription.deleted` | 200 `{"received":true}` |
| **leeres `{}`** (ohne `type`) | **200 `{"received":true}`** ← identisch! |

Ein leeres Objekt ohne Event-Typ kann nicht dasselbe sein wie ein
Bezahlt-Event – außer die Function kennt unsere Verarbeitung gar nicht
und antwortet bei allem gleich. `subscriptions` bleibt bei allen drei
Aufrufen **leer**.

**Fazit: Die deployete Function ist eine alte Version** ohne unser
`switch (event.type)`. Der Code liegt im Repo, wurde aber nie hochgeladen.

---

## Schritt 1: `stripe-webhook` neu deployen

https://supabase.com/dashboard/project/lmlbjtazgcylsrtzzisr/functions/stripe-webhook

1. Function **`stripe-webhook`** → Tab **Code**
2. Gesamten Inhalt löschen
3. Inhalt dieser Datei einfügen:

```
Z:\I-Land1o1\Webseite\supabase\functions-deploy\stripe-webhook.ts
```

4. **Deploy**

**Probe:** Danach sollte das leere `{}` nicht mehr `200 received:true`
geben, sondern scheitern – es hat ja kein `type`-Feld.

---

## Schritt 2: Secrets bei `stripe-webhook`

| Name | Wert |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (aus `.env.local`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` aus dem **Testmodus** |
| `SUPABASE_URL` | `https://lmlbjtazgcylsrtzzisr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role-Key |

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` sind oft automatisch da –
prüfe aber den Service-Key. Ohne ihn bricht die Function bei
„Server nicht konfiguriert" ab.

---

## Schritt 3: `create-checkout-session` neu deployen

Gleiches Problem, gleiche Lösung. Bei **`create-checkout-session`** →
**Code** → Inhalt ersetzen mit:

```
Z:\I-Land1o1\Webseite\supabase\functions-deploy\create-checkout-session.ts
```

Secrets dort:

| Name | Wert |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_PRICE_LEVEL1_MONTHLY` | `price_1UMSNrGrOz3Fo9oHXqEvSOAb` |
| `STRIPE_PRICE_LEVEL1_ONCE` | `price_1UMSNrGrOz3Fo9oHKlsuSCNK` |

---

## Was schon funktioniert

| Prüfung | Stand |
|---|---|
| Verify JWT beim Webhook | ✅ **AUS** – Stripe kommt durch |
| Signatur | ✅ gültig, wird akzeptiert |
| Webhook-Endpoint | ✅ 5 Events, richtige URL |
| `subscriptions`-Schema | ✅ Stripe-Spalten da |
| `has_course_access()` | ✅ läuft |
| **Paywall ohne Abo** | ✅ **403 – hält** |
| Checkout lokal nachgebaut | ✅ HTTP 200 |

Alles außer dem Deploy ist bereit.

---

## Selbsttest danach

```powershell
cd Z:\I-Land1o1\Webseite
node supabase\test-webhook.mjs          # Bezahlung simulieren
node supabase\test-video-access.mjs     # Video freigegeben?
```

`test-webhook.mjs` signiert echt – die Function kann nicht erkennen, ob
Stripe oder das Script es geschickt hat.
