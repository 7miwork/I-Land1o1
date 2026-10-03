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
| `get-video-url/index.ts` | Signierte Video-URL – nur mit aktivem Abo | **AN** |

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
| `STRIPE_PRICE_LEVEL1_ONCE` | `price_…` Einmalzahlung (z. B. Level 1 dauerhaft) |
| `SITE_URL` | `https://i-land1o1.com` |
> `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` setzt
> Supabase **automatisch** – die muss man nicht (und sollte nicht) von Hand anlegen.
> Es sind also genau **6 Einträge** oben.

### 4. Functions deployen

Supabase Dashboard → **Edge Functions → Deploy a new function → Via Editor**

Für jede der **vier** Funktionen:

| Function-Name | Verify JWT | Datei zum Einfügen |
|---------------|-----------|--------------------|
| `create-checkout-session` | **AN** | `supabase/functions-deploy/create-checkout-session.ts` |
| `create-portal-session` | **AN** | `supabase/functions-deploy/create-portal-session.ts` |
| `get-video-url` | **AN** | `supabase/functions-deploy/get-video-url.ts` |
| `stripe-webhook` | **AUS** | `supabase/functions-deploy/stripe-webhook.ts` |

**Ablauf je Function:**
1. Function name eintragen (exakt wie in der Tabelle)
2. Den vorhandenen Beispielcode im Editor **komplett markieren** (`Strg+A`) und durch den Inhalt der Datei **ersetzen** (`Strg+V`)
3. **Deploy function** klicken
4. Verify JWT: **nur beim `stripe-webhook` ausschalten**
   (danach: Function in der Liste öffnen → Einstellungen/Zahnrad → Verify JWT)

> **Warum `functions-deploy/` und nicht `functions/<name>/index.ts`?**
> Die Dateien in `functions/` importieren aus `functions/_shared/`.
> Der Browser-Editor kennt diesen Ordner nicht und würde beim Deploy
> einen Fehler werfen. Die Dateien in `functions-deploy/` haben
> `_shared/cors.ts` und `_shared/plans.ts` schon eingebaut und
> funktionieren daher als Einzeldatei.
>
> Nach Code-Änderungen: `node supabase/build-standalone.mjs` neu ausführen.

### 5. Webhook in Stripe eintragen

Stripe hat den Dialog als 3-Schritte-Assistenten umgebaut
(**Select events → Choose destination type → Configure your destination**).

1. **Select events:** in die Suchleiste tippen und diese 5 Events anhaken
   (Reihenfolge egal, „Selected events" zählt mit):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
2. **Choose destination type:** „Webhook endpoint" (AWS/Azure nicht nötig)
3. **Configure your destination:**
   - URL: `https://lmlbjtazgcylsrtzzisr.supabase.co/functions/v1/stripe-webhook`
   - API-Version: **muss nicht** angepasst werden – der Webhook-Code liest das
     Ablaufdatum ab Stripe-Version 2025-03-31 sowohl am Subscription-Objekt
     als auch bei den Items. Falls du auf Nummer sicher gehen willst, wähle
     `2024-06-20` (dann passt sie zum Code in den Functions).
4. Nach dem Anlegen: **Signing secret** (`whsec_…`) als
   `STRIPE_WEBHOOK_SECRET` in Supabase eintragen

### 6. Billing-Portal aktivieren
Stripe Dashboard → **Settings → Billing → Customer portal** → **Activate**
(sonst liefert `create-portal-session` einen Fehler).

### 7. Testen
Im Dashboard anmelden → Abschnitt **„⚓ Abo & Zahlung"** → **„Abo starten"**.
Stripe Testkarten: `4242 4242 4242 4242`, beliebiges Datum, CVC `123`.
Prüfen: `subscriptions`-Tabelle in Supabase enthält eine Zeile mit `status = active`.

## 5. Video-Schranke (damit „bezahlt = Zugang" wirklich gilt)

Die Videos liegen aktuell als öffentliche Dateien auf Hostinger – die kann jeder
per URL aufrufen. Für eine echte Schranke kommen sie in einen **privaten**
Supabase-Storage-Bucket; ab dann liefert nur noch die Edge Function eine
kurzlebige URL.

### 5a. Bucket anlegen
SQL Editor → Inhalt von `../videos.sql` → **Run** (legt `course-videos` als
**privaten** Bucket an und erlaubt höchstens MP4 bis 500 MB).

### 5b. Videos hochladen
Dashboard → **Storage → course-videos** → Upload. Dateinamen dabei so wählen:

| Lokale Datei | Pfad im Bucket |
|---|---|
| `DE Start.mp4` | `de/start.mp4` |
| `DE Schiff.mp4` | `de/schiff.mp4` |
| `DE Level 1 Lesson 01.mp4` | `de/level1/l01.mp4` |
| … | … |
| `DE Level 1 Lesson 11.mp4` | `de/level1/l11.mp4` |

> Leerezeichen und Umlaute vermeiden – sonst wird's bei URLs unnötig fummelig.

### 5c. Zuordnung in die Datenbank eintragen
```powershell
cd Z:\I-Land1o1\Webseite
$env:SUPABASE_URL = 'https://lmlbjtazgcylsrtzzisr.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '<service_role key aus Project Settings -> API>'
node supabase\register-lesson-videos.mjs
```
Das Script prüft jede Datei im Bucket und schreibt die Zuordnung
(Lektions-ID ↔ Pfad) in `lesson_videos`.

### 5d. Function deployen
`get-video-url` wie in Schritt 4 anlegen, **Verify JWT = AN**.
Der Bucket-Zugriff der Function braucht **Service**-Rolle in
**Storage → Policies → service_role**, sonst kann sie keine signierten URLs
erzeugen.

### 5e. Prüfen
1. Ohne Abo: Lektion öffnen → 🔒-Hinweis statt Video
2. Abo Test-Abo kaufen (Testkarte `4242 4242 4242 4242`) → Video läuft
3. `select * from subscriptions;` zeigt `status = active`

> Bis die Videos im Bucket liegen, lädt das Dashboard weiterhin direkt von
> Hostinger (`/Videos/...`). Die Schranke greift also erst, wenn 5a–5d fertig sind.

## Checkliste vor dem Livegang
- [ ] Von `sk_test_…` auf `sk_live_…` wechseln (Live-Modus in Stripe)
- [ ] Live-Preise statt Test-Preise als Secrets eintragen
- [ ] Webhook-Endpoint auf **Live-Modus** anlegen (nicht nur Test!)
- [ ] `SITE_URL` zeigt auf die echte Domain