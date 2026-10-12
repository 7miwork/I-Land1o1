# Nur noch EIN Schritt

## Schritt 1: `stripe-webhook` NOCH EINMAL neu deployen

Der letzte Deploy hat den echten Fehler zum Vorschein gebracht – er lag
nicht im Webhook-Code, sondern an einem **NOT-NULL-Datenbankfeld**:

```
null value in column "current_period_end" ... violates not-null constraint (23502)
```

Der Webhook schrieb `current_period_end: null` (Einmalzahlung), die Spalte
verweigert `null` → ganzer Upsert scheiterte → 500. Vorher hat der Client
diesen Fehler stillschweigend verschluckt, deshalb „Abo aktiviert" im Log
bei leerer Tabelle. **Ist jetzt überall gefixt** (auch bei den beiden anderen
Null-Stellen, die dasselbe Problem gehabt hätten).

1. https://supabase.com/dashboard/project/lmlbjtazgcylsrtzzisr/functions/stripe-webhook → Tab **Code**
2. **Gesamten** Inhalt löschen
3. Inhalt einfügen aus:

```
Z:\I-Land1o1\Webseite\supabase\functions-deploy\stripe-webhook.ts
```

4. **Deploy** klicken
5. Danach hier melden – ich teste sofort die komplette Kette

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
