# Anweisungen für Coding-Agenten

## Projekt

I-Land1o1 ist eine Lernplattform mit einer Hauptwebsite, einem Schüler-Dashboard, Supabase-Authentifizierung und Datenspeicherung, Stripe-Zahlungsfunktionen sowie Video-Lerninhalten.

## Vor jeder Änderung

1. Prüfe den Repository-Status und die betroffenen Dateien.
2. Lies bestehende Implementierungen, Konfigurationen und relevante Dokumentation.
3. Verifiziere, dass angenommene Dateien und Befehle tatsächlich vorhanden sind.
4. Beschreibe bei größeren Aufgaben kurz den geplanten Umfang.
5. Frage nach, wenn Anforderungen, Berechtigungen oder gewünschtes Verhalten unklar sind.

## Verbindliche Sicherheitsregeln

- Keine Geheimnisse, Tokens, Passwörter oder privaten Nutzerdaten in Antworten, Logs oder Commits ausgeben.
- Keine Secret-Keys im Frontend oder in versionierten Dateien hinterlegen.
- Keine Änderungen an Produktionssystemen, Live-Zahlungen oder produktiven Daten ohne ausdrückliche Genehmigung.
- Zugriffe auf Nutzerdaten und Kursinhalte serverseitig bzw. durch geeignete Policies absichern.
- Bei Supabase-Änderungen RLS, Rollen und Zugriff auf fremde Nutzerdaten berücksichtigen.
- Bei Videozugriff prüfen, ob öffentliche URLs den Schutz kostenpflichtiger Inhalte umgehen.
- Irreversible Datenbankänderungen, Löschungen und Deployment-Aktionen vorab bestätigen lassen.

## Entwicklungsregeln

- Änderungen klein und auf die Aufgabe beschränkt halten.
- Bestehende Architektur und Konventionen bevorzugen.
- Keine Funktionalität entfernen oder ersetzen, ohne dies zu begründen.
- Keine nicht verifizierten Behauptungen über aktuelle Dateien, Setup oder Produktverhalten dokumentieren.
- Tests und Prüfungen ausführen, sofern verfügbar und für die Änderung relevant.
- Falls Tests nicht ausgeführt werden können, den Grund klar angeben.
- Keine Build- oder Deployment-Befehle erfinden; zuerst Repository-Dokumentation und Konfiguration prüfen.

## Besondere Bereiche

### Supabase

Vor Änderungen an SQL, Policies oder Functions die Auswirkungen auf Profile, Fortschritt, Eltern-Kind-Verknüpfungen, Abos und Videos prüfen. Berechtigungen müssen dem Prinzip der geringsten Rechte folgen.

### Stripe

Keine Live-Konfiguration ohne ausdrückliche Genehmigung ändern. Zahlungsstatus darf nicht allein aus Browserdaten abgeleitet werden. Webhooks, Signaturprüfung und wiederholte Zustellungen berücksichtigen.

### Rechtliche Seiten

Keine fehlenden Angaben erfinden und keine rechtliche Prüfung behaupten. Platzhalter und offene Punkte sichtbar dokumentieren; Veröffentlichung fachlich prüfen lassen.

### Dokumentation

Dokumentation muss mit dem tatsächlich vorhandenen Repository übereinstimmen. Wenn Dateien oder Abläufe nicht verifiziert wurden, als ungeprüft kennzeichnen statt sie als Tatsache darzustellen.

## Abschluss jeder Aufgabe

Zusammenfassen:

- Änderungen und betroffene Dateien
- Ausgeführte Tests oder Prüfungen
- Testergebnisse
- Offene Fragen, Risiken oder nicht geprüfte Bereiche
- Notwendige manuelle oder fachliche Freigaben
