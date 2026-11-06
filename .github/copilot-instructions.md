# Copilot Instructions für I-Land1o1

## Projektübersicht

I-Land1o1 ist eine Lernplattform für Kinder und Jugendliche mit Minecraft-basierten Coding-Abenteuern. Das Repository enthält eine statische Website, ein Schüler-Dashboard, Supabase-Integration, Stripe-Logik und Video-Lerninhalte.

## Wichtige Prioritäten

- Sicherheits- und Datenschutzaspekte haben Vorrang vor Komfortfunktionen.
- Keine Secrets, Tokens oder Schlüssel im Frontend oder im Git-Verlauf speichern.
- Für Videozugriff, Authentifizierung und Zahlungsstatus immer serverseitige Verifikation berücksichtigen.
- Änderungen nur im Rahmen der vorhandenen Architektur und Projektstruktur vornehmen.
- Rechtliche Seiten dürfen nicht als geprüft oder verbindlich dargestellt werden, wenn sie Platzhalter enthalten.

## Arbeitsregeln für Copilot

- Prüfe vor Änderungen die betroffenen Dateien und vorhandene Projektstruktur.
- Kein Code auf Vermutungen hin hinzufügen; nur das, was im Repository verifiziert ist.
- Änderungen klein und fokussiert halten.
- Tests oder geeignete manuelle Prüfungen ausführen, sofern für die Aufgabe relevant.
- Wenn etwas unklar ist, Rückfrage oder klare Kennzeichnung als ungeprüft.

## Sicherheitsanforderungen

- Keine API-Schlüssel, Supabase-Service-Role-Keys, Webhook-Secrets oder Stripe-Geheimnisse in Code, Logs oder Commits hinterlegen.
- Keine produktiven Daten oder Live-Konfigurationen ohne Freigabe ändern.
- Bei Supabase, Stripe und Videozugriff auf Berechtigungs- und Zugriffskontrollen achten.
- Öffentliche URLs allein sind nicht ausreichend, wenn geschützte oder kostenpflichtige Inhalte bereitgestellt werden.

## Hinweise für die Umsetzung

- Wenn Dateien oder Abläufe im Repository nicht verifiziert sind, nicht als gesichert behandeln.
- Mehrere Änderungen in einem Schritt vermeiden, wenn sie separaten Prüfungen bedürfen.
- Dokumentation und Code müssen mit dem tatsächlichen Projektstand übereinstimmen.

## Abschluss

Jede praktische Änderung sollte mit einer kurzen Zusammenfassung enden:

- betroffene Dateien
- durchgeführte Prüfung
- Ergebnis
- offene Risiken oder offene Punkte
- Freigabebedarf
