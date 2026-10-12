# Was DU machen musst – 3 Schritte im Browser

Nachdem ich die Code-Seite fertig habe, bleiben drei Dinge, die nur im
Browser gehen. Alle drei sind Kleinigkeiten, aber zusammen sind sie der
Grund, warum der Zahlungsfluss bisher nie durchlief.

**Wichtig:** Teste erst nach Schritt 1 + 2. Vorher scheitert jeder Kauf.

---

## Schritt 1: Webhook-Freigabe (Verify JWT AUS) ⚠️ WICHTIGSTER PUNKT

**Warum das nötig ist – der Beweis:**

Ich habe gemessen, was passiert, wenn Stripe den Webhook aufruft:

| Anfrage | Antwort |
|---|---|
| Wie Stripe es schickt (nur `stripe-signature`, **kein** `Authorization`) | ❌ **401** `Missing authorization header` |
| Mit `Authorization`-Header (so können nur wir testen) | 400 `invalid signature` |

**Stripe sendet nie einen Supabase-Token.** Solange „Verify JWT" an ist,
wird jeder echte Zahlungs-Webhook mit 401 abgelehnt – er kommt also
**nie bis zur Signaturprüfung**. Das ist kein Verdacht, das ist gemessen.

Genau daran ist der Testkauf bisher gescheitert. Stripe hat bezahlt
richtig gemeldet, aber die Function hat die Nachricht nie angenommen.
Deshalb blieb `subscriptions` leer.

**So schaltest du es ab:**

1. Öffne: https://supabase.com/dashboard/project/lmlbjtazgcylsrtzzisr/functions
2. Klicke auf **`stripe-webhook`**
3. Tab **Details** (rechts) → Abschnitt **„Verify JWT"**
4. Schalter auf **AUS**
5. Speichern

**Bleibt die Sicherheit?** Ja. Die Function prüft jede Anfrage mit
`STRIPE_WEBHOOK_SECRET` – nur wer das geheime Signatur-Secret hat, kommt
durch. Ohne den Secret gibt es 400 `invalid signature`. Genau das habe
ich oben gemessen: **400**, nicht 200. Die Absicherung ist also aktiv,
nur eben über Stripe statt über Supabase-JWT.

> **Nur diese eine Function.** Die anderen drei (`create-checkout-session`,
> `create-portal-session`, `get-video-url`) müssen JWT **anbehalten** –
> die prüfen, ob ein Nutzer angemeldet ist.

---

## Schritt 2: Secrets eintragen

https://supabase.com/dashboard/project/lmlbjtazgcylsrtzzisr/functions

### Bei `create-checkout-session`

| Name | Wert |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (aus `supabase/.env.local`) |
| `STRIPE_PRICE_LEVEL1_MONTHLY` | `price_1UMSNrGrOz3Fo9oHXqEvSOAb` |
| `STRIPE_PRICE_LEVEL1_ONCE` | `price_1UMSNrGrOz3Fo9oHKlsuSCNK` |

### Bei `stripe-webhook`

| Name | Wert |
|---|---|
| `STRIPE_SECRET_KEY` | derselbe `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` aus dem **Testmodus** |

**Warum es hier klemmt:** `.env.local` ist nur für meine lokalen Scripte.
Die Functions lesen ausschließlich diese Secrets – deshalb funktioniert
derselbe Aufruf lokal, über die Function aber nicht.

Das `STRIPE_WEBHOOK_SECRET` gibt es hier:
Stripe Dashboard → **Test mode AN** → Developers → Webhooks →
dein Endpoint → *Signing secret* → Reveal

⚠️ Dein aktuelles `whsec_naHb…` in `.env.local` gehört zum **Live**-Key.
Nimm das aus dem Testmodus, sonst schlägt die Signaturprüfung fehl.

---

## Schritt 3: Function-Code aktualisieren

Bei `create-checkout-session` → Tab **Code** → Inhalt ersetzen mit:

```
Z:\I-Land1o1\Webseite\supabase\functions-deploy\create-checkout-session.ts
```

Danach zeigt ein Fehler die echte Stripe-Ursache (`reason` + `info`)
statt eines rätselhaften 500.

---

## Was ich schon für dich erledigt habe

| | Stand |
|---|---|
| `subscriptions`-Schema (Stripe-Spalten) | ✅ läuft |
| `has_course_access()` | ✅ läuft, gibt `true` bei Abo |
| Upsert über `user_id` | ✅ getestet – aktualisiert statt dupliziert |
| Preise + `tax_code` bei Stripe | ✅ gesetzt, beide aktiv |
| Checkout lokal nachgebaut | ✅ HTTP 200, Session wird erstellt |
| **Paywall ohne Abo** | ✅ **403 – hält** |
| Test-Scripts geschrieben | ✅ siehe unten |

---

## Nach Schritt 1–3: Selbst testen

```powershell
cd Z:\I-Land1o1\Webseite

# 1) Bezahlung simulieren (ohne Karte, ohne Kauf)
node supabase\test-webhook.mjs

# 2) Pruefen, ob das Video jetzt aufgeht
node supabase\test-video-access.mjs
```

`test-webhook.mjs` schickt ein **echt signiertes** Event – die Function
kann nicht unterscheiden, ob Stripe oder das Script es geschickt hat.
Läuft das durch, ist die komplette Kette intakt.

Danach gern der echte Kauf mit `4242 4242 4242 4242` zur Kontrolle.
