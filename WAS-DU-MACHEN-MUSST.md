# Was noch zu tun ist – Stand 2026-10-12 (nach System-Check)

Alles geprüft, was ohne deine Zugänge prüfbar war. Vier Schritte sind noch
offen – die Reihenfolge ist wichtig.

---

## 1. Supabase: DREI Functions neu deployen (blockiert den Kauf)

Die Kasse scheiterte nie am Code, sondern an der **Stripe-API-Version**.
Beim Test kam:

```
Managed Payments is not supported on API version 2024-06-20.
Update your API version, or set the API Version of this request
to 2025-03-31.basil or greater.
```

Der alte Wert war in allen drei Stripe-Functions hart gepinnt. **Geändert auf
`2025-03-31.basil`** (das Webhook liest Ablaufdaten ab dieser Version).

Zu deployen (Quelldateien fertig, `build-standalone.mjs` lief durch):

| Function | Verify JWT | Datei zum Einfügen |
|---|---|---|
| `create-checkout-session` | **AN** | `Z:\I-Land1o1\Webseite\supabase\functions-deploy\create-checkout-session.ts` |
| `create-portal-session` | **AN** | `…\functions-deploy\create-portal-session.ts` |
| `stripe-webhook` | **AUS** | `…\functions-deploy\stripe-webhook.ts` |

Ablauf je Function: Dashboard → Edge Functions → Function öffnen →
**Edit function** → alles markieren (Strg+A) → Dateiinhalt einfügen →
**Deploy**. (Verify JWT danach prüfen – nur beim Webhook aus.)

**Schneller für dich:** `npx supabase login` ausführen (Token aus Supabase
Dashboard → Account → Access Tokens) – dann deploye ich die drei Functions
selbst und teste sofort die ganze Kette.

### Danach in denselben Secrets kurz gegenlesen (2 Minuten)

- `STRIPE_SECRET_KEY` → muss der **Test-Key** (`sk_test_…`) sein, sonst
  geht die `4242`-Karte nicht durch
- `STRIPE_PRICE_LEVEL1_MONTHLY` / `_ONCE` → müssen echte `price_…`-IDs
  sein (in der Vorlage standen Platzhalter `price_99`/`price_499`)

---

## 2. Git-Secrets rotieren (lagen im Repo-Verlauf)

Die `.env.example` enthielt **echte Werte** – die sind bereinigt, liegen
aber noch in der Git-History:

1. **Stripe:** Dashboard → Developers → API keys → `sk_live_…` rotieren →
   neuen Wert als Secret `STRIPE_SECRET_KEY` in Supabase eintragen
2. **Supabase:** Project Settings → API → service_role neu erzeugen →
   Secret `SUPABASE_SERVICE_ROLE_KEY` in Supabase **und** lokal in
   `Z:\I-Land1o1\Webseite\supabase\.env.local` aktualisieren
   (sonst laufen alle lokalen Skripte mit dem alten Key)
3. `whsec_` im Stripe-Webhook ggf. mitrotieren (war ebenfalls im Verlauf)


---

## 3. GitHub-Secrets fürs Deploy (damit die Website aktualisiert wird)

Das Repo `7miwork/I-Land1o1-React` hat **keine Secrets** – die letzten
Workflow-Läufe scheiterten mit
`Input required and not supplied: server` (der Build selbst ist grün).

Eintragen unter: Repo → Settings → Secrets and variables → Actions

- `HOSTINGER_FTP_HOST`
- `HOSTINGER_FTP_USER`
- `HOSTINGER_FTP_PASSWORD`

Danach auslösen:

```powershell
gh workflow run "Deploy to Hostinger" -R 7miwork/I-Land1o1-React
```

Das Deploy bringt dann mit auf den Server:

- **neue `.htaccess`** → `https://i-land1o1.com/Videos/*` antwortet mit
  **403** (aktuell noch offen – geprüft: HTTP 206 auf die Originale)
- die statischen Seiten `login/` und `dashboard/` (jetzt versioniert im
  Repo, nicht mehr nur manuell auf dem Server)
- die `/login`-Rewrite-Regel (die der alte SPA-Rewrite verschluckt hätte)

**Ohne GitHub sofort wirksam:** eine einzige Datei hochladen
(File Manager → `/public_html/.htaccess` überschreiben) – Inhalt wie
`Z:\Codes\Codes\I-Land1o1\public\.htaccess`.

> Prüfung danach: Video-URL muss `403` liefern, `/login` und
> `/dashboard/` müssen `200` liefern. Das Dashboard-Video muss weiter
> spielen – es läuft über Supabase signed URLs, nicht über `/Videos`.

---

## 4. Echter Stripe-Testkauf (`4242…`)

Voraussetzung: **Schritt 1** (Functions deployen).

Das Test-Abo ist **gelöscht** – die Paywall greift wieder
(`subscriptions` = 0 Zeilen; getestet: 403 + `locked:true`).

1. Frischer Browser-Tab → `https://i-land1o1.com/login` → anmelden
2. Video öffnen → muss den Abo-Hinweis zeigen
3. „Abo & Zahlung" → `level1-monthly` buchen → Stripe-Kasse öffnet sich
   (öffnet sie sich **nicht**, greift der Fehler aus Schritt 1/Secrets)
4. `4242 4242 4242 4242`, beliebiges Datum/CVC bezahlen
5. Erwartet: Zurück im Dashboard, Video spielt, in der DB eine
   `subscriptions`-Zeile (`active`, `stripe_customer_id` gesetzt)

Danach auf Wunsch: Kündigung über das Kundenportal testen
(`customer.subscription.deleted` → Zugang muss weg sein).

Selbsttest der Kette:

```powershell
cd Z:\I-Land1o1\Webseite
node supabase\test-webhook.mjs          # Bezahlung simulieren
node supabase\test-video-access.mjs     # Video freigegeben?
node supabase\storage-status.mjs        # 13/13 Videos im Bucket
```

---

## 5. Restliche Offenpunkte (nicht blockierend)

- **SMTP + E-Mail-Bestätigung** für Signup-Mails (Supabase → Auth → SMTP;
  Hostinger: smtp.hostinger.com, Port 465)
- **Rechtsseiten**: Impressum, Datenschutz, AGB – als statische Seiten unter
  `/impressum/`, `/datenschutz/`, `/agb/` angelegt (Platzhalter, vor
  echtem Verkauf mit echten Angaben + Anwalt prüfen)
- Optional: Stripe-Webhook-Events prüfen (5 Events, `whsec_` muss passen)

---

## Was heute geprüft wurde (2026-10-12)

| Prüfung | Ergebnis |
|---|---|
| Alle 13 Videos im Supabase-Bucket | ✅ 13/13 vollständig |
| Signed-URL-Abruf (l01/l04/l05) | ✅ HTTP 206 |
| Paywall ohne Abo (frischer Account) | ✅ 403 `locked:true` |
| Checkout `{plan:…}` | ⛔ 500 → API-Version (gefixt, Deploy offen) |
| RLS (anon sieht keine Abo-/Videozeilen) | ✅ 0 Zeilen |
| Verify JWT: nur `stripe-webhook` aus | ✅ 401/405 korrekt |
| Webhook-Selbsttest | ✅ Signatur + Verarbeitung ok |
| Test-Abo gelöscht → Paywall | ✅ `subscriptions` = 0 Zeilen |
| React `tsc --noEmit` | ✅ exit 0 |
| React `build:hostinger` | ✅ exit 0 (login/dashboard/`.htaccess` drin) |
| Server-Dateien `login/`+`dashboard/` == Repo | ✅ inhaltlich identisch |
| `.env.example` ohne Geheimnisse | ✅ bereinigt (Rotation offen) |
| GitHub-Workflow | ⛔ scheitert an fehlenden FTP-Secrets |

Zwei Repos gepusht (jeweils `[skip ci]`):
`I-Land1o1-React@95ed510`, `I-Land1o1@d7545f2`.

