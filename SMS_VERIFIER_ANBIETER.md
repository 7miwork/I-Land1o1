# SMS-Verifizierung – Kostenlose Anbieter für den Start

Diese Übersicht hilft bei der Wahl eines SMS-Dienstleisters für die Telefon-Verifizierung bei der Registrierung (Supabase Phone Auth / 2FA / OTP).

> ⚠️ **Hinweis:** Preise und Free-Tier-Kontingente ändern sich häufig. Bitte vor der Integration direkt auf der Anbieter-Website prüfen. Die Liste erhebt keinen Anspruch auf Vollständigkeit.

---

## Anbieter mit kostenlosem Einstieg

| Anbieter | Free Tier (ca.) | Kostenpflichtig ab | Besonderheit |
|----------|----------------|-------------------|--------------|
| **Twilio** | Kostenloses Testguthaben (ca. 15–15 €), danach Pay-as-you-go | Ab ca. 0,04–0,08 € pro SMS (Länderabhängig) | Sehr verbreitet, gute Dokumentation, Supabase kompatibel |
| **AWS SNS** | 100 SMS/Monat kostenlos (erste 12 Monate nach Kontoeröffnung) | Danach Pay-as-you-go | Gut, wenn ohnehin AWS im Einsatz |
| **MessageBird (Bird)** | Free Tier verfügbar (contingent variiert) | Pay-as-you-go | Internationale Abdeckung stark |
| **Plivo** | Free Trial mit Startguthaben | Pay-as-you-go | Günstige SMS-Tarife, API einfach |
| **Vonage (Nexmo)** | Free Trial-Guthaben | Pay-as-you-go | Solide API, viele Länder |
| **Infobip** | Free Trial / Startguthaben | Pay-as-you-go / Abomodelle | Enterprise-fokussiert, gutes Dashboard |
| **ClickSend** | Kostenloser Test-Account (begrenzt) | Pay-as-you-go | Einfache Oberfläche |
| **TextMagic** | Kein dauerhaftes Free-Tier, Testguthaben | Ab ca. 10 € / Monat | Einfache Bedienung |

---

## Empfehlung für den Start (I-Land1o1)

Da ihr **Supabase** nutzt, ist **Twilio** der naheliegendste Anbieter, weil Supabase Phone Auth standardmäßig auf Twilio aufsetzen kann. Alternativ kann man SMS auch über eine eigene Edge Function mit einem beliebigen Anbieter versenden.

### Worauf achten bei der kostenlosen Phase:

1. **Monatliches Kontingent:** Einige Anbieter geben z. B. 100 SMS/Monat kostenlos – reicht für den Testbetrieb mit wenigen Nutzern.
2. **Testguthaben statt Flat:** Viele Anbieter schenken statt eines dauerhaften Free Tiers einmalig 5–15 € Guthaben. Das reicht für hunderte Test-SMS, ist aber nicht dauerhaft kostenlos.
3. **Absender-ID (Sender ID):** In vielen Ländern (DE, AT, CH, US) benötigen kostenlose Konten eine verifizierte Absender-Nummer oder senden von einer generischen Nummer (z. B. „Twilio“).
4. **Länder:** Prüfen, ob die Zielmärkte (DE, EN, ZH-Länder) abgedeckt sind und wie teuer SMS dorthin sind.

---

## Integration in Supabase (Phone Auth)

Supabase bietet eingebaute **Phone Authentication**. Diese kann über Twilio oder einen benutzerdefinierten SMS-Provider realisiert werden.

**Option A – Supabase Phone Auth (Twilio):**
- In Supabase Dashboard unter *Authentication → Phone Provider* Twilio-Kredenzialen hinterlegen (Account SID, Auth Token, From-Nummer).
- Supabase versendet die OTP-SMS automatisch.

**Option B – Eigene Edge Function:**
- Eigene Edge Function schreiben, die einen beliebigen SMS-Anbieter (Twilio, Plivo, etc.) aufruft.
- Mehr Kontrolle, aber mehr Eigenentwicklung.

---

## Checkliste vor der Entscheidung

- [ ] Anzahl der erwarteten SMS pro Monat (Registrierungen, 2FA, Passwort-Vergessen)
- [ ] Ziel-Länder (Deutschland, Österreich, Schweiz, USA, UK, China etc.)
- [ ] Benötigte Absender-Nummer (verifizierte Telefonnummer oder alphanumerischer Sender)
- [ ] Einfache Upgrade-Möglichkeit (keine Vertragsbindung im Free Tier)
- [ ] GDPR / DSGVO-konform (Serverstandort, Auftragsverarbeitungsvertrag)

---

## Beispiel-URLs (zur Preisprüfung)

- https://www.twilio.com/de/sms/pricing
- https://aws.amazon.com/sns/pricing/
- https://www.messagebird.com/de/pricing
- https://www.plivo.com/pricing/
- https://www.vonage.com/api/pricing/
- https://www.infobip.com/pricing

---

*Erstellt für das I-Land1o1 Projekt (Webseite) – Stand Oktober 2026.*