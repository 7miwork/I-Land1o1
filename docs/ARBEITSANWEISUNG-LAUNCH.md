# Arbeitsanweisung: I-Land1o1 für den Produktivstart vorbereiten

## Ziel

Die I-Land1o1-Lernplattform soll sicher, verlässlich und nachvollziehbar für einen möglichen Produktivstart vorbereitet werden. Diese Arbeitsanweisung bildet die Grundlage für die Umsetzung durch Entwickler:innen sowie Coding-Assistenten.

Das Repository enthält eine Website, ein Schüler-Dashboard, Supabase-Integrationen, Stripe-Funktionen und Video-Inhalte. Vor Änderungen muss der tatsächliche Stand im Repository geprüft werden. Die README ist eine Orientierung, aber kein Ersatz für die Prüfung des Codes und der aktuellen Konfiguration.

## Arbeitsregeln

- Änderungen in kleinen, nachvollziehbaren Schritten durchführen.
- Vor der Umsetzung zuerst relevante Dateien, Abhängigkeiten und vorhandene Tests prüfen.
- Bestehende Abläufe nicht ohne Begründung ersetzen.
- Keine Zugangsdaten, API-Schlüssel, Tokens, Kundendaten oder sonstigen Geheimnisse ausgeben oder committen.
- Keine produktiven Daten, Secrets, Stripe-Live-Einstellungen oder Supabase-Produktivressourcen verändern.
- Keine rechtlichen Texte als fachlich geprüft oder rechtsverbindlich darstellen.
- Bei unklaren Anforderungen zuerst eine Rückfrage stellen.
- Nach jeder Änderung passende Prüfungen und manuelle Validierungen durchführen und dokumentieren.
- Keine unbekannten Dateien, Skripte oder Befehle voraussetzen. Vor ihrer Verwendung prüfen, ob sie im Repository existieren.

## Priorität 1: Videozugriff und Berechtigungen prüfen

### Ziel
Bezahlte oder anderweitig geschützte Videos dürfen nicht allein durch Kenntnis ihrer URL abrufbar sein.

### Aufgaben
1. Prüfen, wo Videos aktuell gespeichert und wie sie im Dashboard referenziert werden.
2. Prüfen, ob direkte öffentliche URLs oder Serverpfade den Zugriffsschutz umgehen.
3. Den vorhandenen Stand von Supabase Storage, `lesson_videos` und `get-video-url` untersuchen.
4. Prüfen, ob die Edge Function den angemeldeten Nutzer und dessen Kursberechtigung serverseitig kontrolliert.
5. Sicherstellen, dass geschützte Videos über signierte, kurzlebige URLs geliefert werden.
6. Den Übergang zwischen bisheriger Videoquelle und geschütztem Storage dokumentieren.

### Abnahmekriterien
- Nicht angemeldete Nutzende erhalten keinen geschützten Videozugriff.
- Nutzende ohne passende Berechtigung erhalten keinen geschützten Videozugriff.
- Berechtigte Nutzende können das vorgesehene Video abspielen.
- Keine Service-Role- oder Stripe-Geheimnisse befinden sich im Frontend oder in Git-versionierten Dateien.
- Die Prüfung dokumentiert klar, welche Videos noch direkt über den Hosting-Anbieter erreichbar sind.

## Priorität 2: Datenbank, Authentifizierung und Datenschutz prüfen

### Aufgaben
1. Vorhandene Supabase-Schemas, Policies und Edge Functions prüfen.
2. RLS-Regeln für Profile, Eltern-Kind-Verknüpfungen, Fortschritt, Zahlungen und Videometadaten nachvollziehen.
3. Sicherstellen, dass Nutzende nicht auf fremde Daten zugreifen können.
4. Login, Registrierung, Session-Wiederherstellung und Logout prüfen.
5. Fehlerfälle und fehlende Konfigurationen nachvollziehbar behandeln, ohne vertrauliche Informationen auszugeben.
6. Änderungen an Datenbank-Policies oder Berechtigungen besonders vorsichtig und mit Tests durchführen.

### Abnahmekriterien
- Zugriff auf private Nutzerdaten ist auf berechtigte Rollen und Eigentümer beschränkt.
- Authentifizierungsfehler führen nicht zu unbeabsichtigter Freigabe geschützter Inhalte.
- Die Prüfungen und offenen Risiken sind dokumentiert.

## Priorität 3: Stripe-Zahlungsabläufe testen

### Aufgaben
1. Vorhandene Checkout-, Kundenportal- und Webhook-Implementierung untersuchen.
2. Prüfen, ob Webhook-Signaturen serverseitig validiert werden.
3. Den Testmodus verwenden, um mindestens folgende Abläufe zu prüfen:
   - erfolgreicher Kauf
   - fehlgeschlagene oder abgebrochene Zahlung
   - Abo-Änderung oder Kündigung
   - wiederholte Webhook-Zustellung
   - Aktualisierung des Zugriffs nach Zahlungsstatus
4. Idempotenz und sichere Fehlerbehandlung bewerten.
5. Keine Live-Zahlungen oder Live-Konfigurationen ohne ausdrückliche Freigabe vornehmen.

### Abnahmekriterien
- Nur serverseitig bestätigte Zahlungsereignisse können geschützte Inhalte freischalten.
- Wiederholte Webhooks führen nicht zu inkonsistenten oder doppelten Zuständen.
- Testmodus und Live-Modus sind klar getrennt.
- Für den Livegang ist eine separate, manuell freizugebende Checkliste vorhanden.

## Priorität 4: Rechtliche Seiten und Produktinformationen

### Aufgaben
1. Seiten für Impressum, Datenschutz und AGB im Repository prüfen.
2. Platzhalter, unvollständige Angaben und nicht bestätigte Aussagen auflisten.
3. Keine rechtlichen Platzhalter eigenmächtig durch erfundene Informationen ersetzen.
4. Eine Liste benötigter Informationen erstellen, die der Projektverantwortliche bereitstellen muss.
5. Bei Angeboten für Kinder besonders auf verständliche Produktinformationen und den Umgang mit personenbezogenen Daten hinweisen.
6. Rechtliche Texte vor Veröffentlichung durch fachkundige Personen prüfen lassen.

### Abnahmekriterien
- Es gibt eine dokumentierte Liste offener Angaben und Platzhalter.
- Keine erfundenen Betreiber-, Kontakt-, Preis- oder Rechtsangaben wurden ergänzt.
- Die Dokumentation macht deutlich, dass die Prüfung durch eine qualifizierte Stelle erfolgen muss.

## Priorität 5: Deployment und Betrieb

### Aufgaben
1. Den realen Deployment-Ablauf und die benötigten Dateien untersuchen.
2. Prüfen, wie Videos und andere große Medien ausgeliefert werden.
3. Sicherstellen, dass `.env`-Dateien, lokale Konfigurationen und Zugangsdaten nicht versioniert werden.
4. Einen sicheren Ablauf für Backups, Wiederherstellung und Rollback dokumentieren.
5. Website, Login, Dashboard und wichtige Seiten auf Desktop und Mobilgeräten prüfen.
6. Existierende CI- oder Testläufe nutzen; keine neuen Build-Befehle erfinden.

### Abnahmekriterien
- Deployment-Schritte basieren auf den tatsächlich vorhandenen Dateien und Werkzeugen.
- Ein Rollback- und Backup-Verfahren ist dokumentiert.
- Kritische Seiten und Nutzerabläufe wurden geprüft.
- Bekannte Betriebsrisiken sind festgehalten.

## Vorgehen für Coding-Assistenten

Für jede Aufgabe:

1. Repository-Status und relevante Dateien untersuchen.
2. Ziel und betroffene Bereiche kurz benennen.
3. Änderungen möglichst klein halten.
4. Tests oder geeignete Prüfungen ausführen.
5. Ergebnisse, offene Punkte und Risiken zusammenfassen.
6. Bei Produktionszugriff, Secrets, rechtlichen Entscheidungen oder unklaren Berechtigungen vorher stoppen und Rückfrage stellen.

## Abschlussbericht

Nach Abschluss jeder Phase dokumentieren:

- Was geprüft oder geändert wurde
- Welche Dateien betroffen sind
- Welche Tests oder Prüfungen ausgeführt wurden
- Welche Ergebnisse vorliegen
- Welche Risiken oder offenen Fragen verbleiben
- Ob eine manuelle Freigabe erforderlich ist

Ein erfolgreicher Testlauf allein ist keine Freigabe für den Produktivstart.

## Wichtige Hinweise für den Launch

- Videos dürfen nicht nur über öffentliche URLs bereitgestellt werden, falls sie kostenpflichtig oder eingeschränkt nutzbar sein sollen.
- Privacy, AGB, Datenschutz und Impressum müssen vor dem Livegang fachlich geprüft werden.
- Secrets und API-Keys müssen stets außerhalb des Frontends und außerhalb von Git verwaltet werden.
- Stripe-Live- und Testmodus müssen sauber getrennt bleiben.
- Die README sollte regelmäßig mit dem tatsächlichen Projektstand abgeglichen werden.

---

Dies ist die operative Arbeitsanweisung für den Start der Plattform. Sie dient als Grundlage für Copilot-, Cline- und Agenten-Workflows im Repository.
