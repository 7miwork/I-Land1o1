# Nur noch EIN Schritt

Der Rest ist fertig. Deine Logs haben den Fehler gefunden.

## Was die Logs gezeigt haben

```
[webhook] Abo aktiviert { userId: "02da27ad…", plan: "level1-monthly", subStatus: "active" }
```

Fünfmal. Der Code läuft also korrekt – und **trotzdem** blieb `subscriptions` leer.

**Ursache:** Alle Schreibvorgänge warfen ihr Ergebnis weg:

```js
await db.from('subscriptions').upsert({...});   // Fehler wird verworfen
console.log('[webhook] Abo aktiviert');          // logt trotzdem Erfolg
```

Der Supabase-Client wirft bei einem fehlgeschlagenen Schreiben **keinen**
Fehler, sondern gibt `{ data, error }` zurück. Das wurde ignoriert – deshalb
der Erfolgs-Log bei leerer Tabelle. Behoben.

---

## Schritt 1: `stripe-webhook` neu deployen

https://supabase.com/dashboard/project/lmlbjtazgcylsrtzzisr/functions/stripe-webhook

1. Function **`stripe-webhook`** → Tab **Code**
2. **Gesamten** Inhalt löschen
3. Inhalt dieser Datei einfügen:

```
Z:\I-Land1o1\Webseite\supabase\functions-deploy\stripe-webhook.ts
```

4. **Deploy** klicken

Das ist alles. Danach sag Bescheid, ich prüfe den Rest.

---

## Was danach passiert

Die Function gibt jetzt bei einem Schreibfehler **500** zurück (vorher: stilles
Verschweigen). Zwei mögliche Ausgänge:

**A) Es funktioniert** – Abo landet in `subscriptions`, ich prüfe mit
`test-video-access.mjs`, ob das Video aufgeht.

**B) `SCHREIBFEHLER` im Log** – dann steht dort die echte Ursache
(`message`, `code`, `hint`). Ich sehe daran sofort, was fehlt.

In beiden Fällen wissen wir mehr als jetzt.

---

## Selbsttest nach dem Deploy

```powershell
cd Z:\I-Land1o1\Webseite
node supabase\test-webhook.mjs          # Bezahlung simulieren
node supabase\test-video-access.mjs     # Video freigegeben?
```

---

## Was bereits funktioniert (geprüft, nicht vermutet)

| Prüfung | Stand |
|---|---|
| Verify JWT beim Webhook | ✅ **AUS** – Stripe kommt durch |
| Signatur | ✅ wird akzeptiert |
| Webhook-Endpoint | ✅ 5 Events, richtige URL, `enabled` |
| Event-Verarbeitung | ✅ Zweig wird erreicht (aus deinen Logs) |
| `subscriptions`-Schema | ✅ alle Stripe-Spalten |
| Upsert über `user_id` | ✅ getestet – aktualisiert statt dupliziert |
| `has_course_access()` | ✅ läuft, gibt `true` bei Abo |
| **Paywall ohne Abo** | ✅ **403 – hält** |
| Preise + `tax_code` | ✅ beide aktiv |
| Checkout lokal nachgebaut | ✅ HTTP 200, Session erstellt |

---

## Zwei Dinge, die ich aus deinen Logs noch mitnehme

**Ein echter Kauf ist bereits durchgelaufen.** Die Payload mit
`t=1791787600` war kein Test von mir:

```json
"customer": "cus_c35ef669462eb0b4",
"subscription": "sub_583593e4bf9230f3",
"payment_status": "paid"
```

Der wurde wegen falscher Signatur abgelehnt. Seit deiner `whsec_`-Korrektur
passt sie – der läuft jetzt durch.

**Stripe mahnt die API-Version an:** `2024-06-20` ist veraltet, aktuell wäre
`2026-09-30.endive`. Nicht dringend, aber irgendwann fällig. Soll ich das
mitnehmen, wenn wir sowieso dabei sind?
