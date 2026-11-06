# I-Land1o1 – Learning Platform

I-Land1o1 ist eine digitale Lernplattform für Kinder und Jugendliche, die durch Minecraft-basierte Coding-Abenteuer programmieren lernen. Die Plattform kombiniert interaktive Unterrichtseinheiten, individuelle Fortschrittsverfolgung und ein modernes Dashboard für Lernende, Eltern und Lehrkräfte.

## Überblick

Die Plattform wurde als pädagogische, spielerische Lösung entwickelt, um Kinder im Alter von 6 bis 14 Jahren mit kreativer Programmierung vertraut zu machen. Der Fokus liegt auf:

- verständlichen, spielerischen Lerninhalten
- strukturierter Progression durch Lernlevel
- eigenem Schüler-Dashboard
- sicherem Login und Benutzerverwaltung
- Abonnement- und Zahlungslogik mit Stripe
- Deployment auf einer statischen Hosting-Umgebung

## Hauptfunktionen

- Lernplattform mit Minecraft- und Coding-Inhalten
- Level-basierte Kurse und Video-Lektionen
- individuelles Fortschritts-Tracking pro Nutzer
- Login-/Registrierungsfluss mit Supabase Auth
- Eltern- und Familienfunktionen
- Abo-/Zahlungsintegration über Stripe
- Datenschutz- und Legal-Abschnitte (Impressum, Datenschutz, AGB)
- Responsive Web-UI mit piratenhaftem Design

## Tech-Stack

- Frontend: HTML, CSS, JavaScript
- App-Output: Vite / React-Build-Assets
- Auth & Daten: Supabase
- Zahlungen: Stripe
- Hosting: Hostinger / statische Website-Deployment
- Routing/SPA: Apache Rewrite Rules

## Projektstruktur

```text
.
├── assets/                     # kompilierte Frontend-Assets
├── dashboard/                  # Schüler-Dashboard und Lernoberfläche
│   ├── auth.js                 # Supabase-Auth
│   ├── billing.js              # Zahlungs-/Abo-Funktionen
│   ├── config.js               # Supabase-Konfiguration
│   ├── dashboard.js            # Verlauf und Lektionslogik
│   ├── family.js               # Familien-/Elternfunktionen
│   ├── index.html              # Dashboard-Entry
│   ├── lessons.js              # Lerninhalte / Lektionen
│   └── dashboard.css           # Styles
├── login/                      # Login-Seite
├── agb/                        # AGB
├── datenschutz/                # Datenschutz
├── impressum/                  # Impressum
├── supabase/                   # Supabase-Schema, Edge Functions, Konfiguration
│   ├── functions/              # Edge Function-Implementierung
│   ├── schema.sql              # Basisdatenbankmodell
│   ├── subscriptions.sql       # Abos und Zahlungen
│   ├── videos.sql              # Video-/Storage-Regeln
│   ├── setup-keys.mjs          # lokale Schlüssel initialisieren
│   ├── keys.mjs                # lokale Env-Lader
│   └── ...
├── .htaccess                   # Apache SPA Rewrite
├── index.html                  # Einstiegspunkt der Hauptseite
├── README.md                   # Projekt-Dokumentation
├── package.json                 # falls vorhanden im Projektkontext
├── Videos/                     # große Videodateien (lokal/hostinger, nicht im Git)
├── manus-storage/              # Medien-Assets
├── __manus__/                  # Manus-Debug/Collector
└── .gitignore                  # lokale bzw. sensible Dateien
```

## Schnellstart

### Voraussetzungen

- Git
- Zugriff auf das Repository
- Supabase-Projekt
- Stripe-Konfiguration (falls Zahlungen aktiv sind)
- Hosting-Umgebung mit statischer Website

### Lokale Entwicklung

1. Repository klonen.
2. Laufende Umgebung oder bestehenden Build-Output in den Hauptordner einbinden.
3. Supabase-Konfiguration in `dashboard/config.js` ergänzen:

```js
window.ILAND_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY'
};
```

4. Für die technische Einbindung können die Datenbank- und Edge-Function-Dateien in Supabase entsprechend eingerichtet werden.
5. Die App über das lokale Setup oder direkt im Hosting-Umfeld testen.

## Dashboard und Inhalte anpassen

Die Lerninhalte werden zentral in `dashboard/lessons.js` gepflegt. Jede Lektion ist als Objekt definiert und enthält typischerweise Informationen wie:

- Titel
- Beschreibung
- Aufgabenstellung
- Video-Referenz
- Lernstatus / Fortschritt

Ein neues Lesson-Objekt kann einfach hinzugefügt werden, damit neue Inhalte im Dashboard automatisch erscheinen.

## Authentifizierung und Nutzerverwaltung

Die Plattform nutzt Supabase für:

- Login und Registrierung
- Session-Handling
- User-Profile
- Rollen- und Zugriffslogik
- sichere Speicherung von Fortschrittsdaten

Wichtiger Hinweis: sensible Geheimnisse wie API-Schlüssel oder Stripe-Keys dürfen niemals direkt im Frontend abgelegt werden. Solche Werte sollten ausschließlich in Supabase Edge Function Secrets oder einer sicheren Server-Umgebung verwaltet werden.

## Abonnements und Zahlungen

Die Zahlungslogik basiert auf Stripe und wird über Supabase Edge Functions abgewickelt. Das Projekt umfasst unter anderem:

- Checkout-Session-Erstellung
- Kundenportal
- Webhook-Handling
- Verifizierung des Zugriffs für bezahlte Inhalte

Die relevanten SQL-Skripte und Function-Definitionen befinden sich im Ordner `supabase/`.

## Deployment

Dieses Projekt wird als statische Website deployed. Typische Schritte sind:

1. Projekt auf Hostinger oder vergleichbarer Hosting-Umgebung veröffentlichen
2. Apache Rewrite-Regeln in `.htaccess` sicherstellen
3. notwendige statische Assets und Medien im richtigen Pfad bereitstellen
4. Supabase-Konfigurationen und Secrets prüfen
5. Login- und Dashboard-Pfade validieren
6. Video-Dateien gemäß Hosting-Strategie hochladen

## Video-Upload

Für größere Video-Dateien werden diese je nach Deployment-Umgebung separat über FTP oder einen entsprechenden Medien-Workflow bereitgestellt. Wichtig ist, dass die Pfade und Referenzen im Projekt konsistent mit dem Hosting-Schema bleiben.

## Sicherheit und Best Practices

- Keine Secret-Keys in Git oder im Frontend speichern
- Supabase Secrets nur über die offizielle Konfiguration verwalten
- Stripe-Schlüssel und Service-Role-Werte nur serverseitig bzw. in Edge Functions verwenden
- `.env`-Dateien nicht versionieren
- sensible Konfigurationen separat verwalten

## Lizenz

Das Projekt ist aktuell als internes bzw. privates Projekt konzipiert. Eine öffentliche Open-Source-Lizenz wurde nicht angegeben. Wenn du das Repository öffentlich machen möchtest, solltest du vorab die passende Lizenz auswählen.

## Status

Aktueller Status: Live- bzw. Produktivvorbereitung im Rahmen einer Lernplattform für Kinder.

## Kontakt / Betreuung

Für Fragen zum Projekt, zur Weiterentwicklung oder zur technischen Pflege kannst du das Repository verwenden und die relevanten Bereiche im Code bzw. in den Projektdateien anpassen.

---

Wenn du möchtest, kann ich dir als Nächstes noch eine zweite Version erstellen:

- mehr „startup-/unternehmenstauglich“ mit Hero-Section, Features und Architektur
- kürzer und moderner für GitHub
- auf Englisch, damit es internationaler wirkt
- mit einer echten badged Project-Overview und besserem Marketing-Style

Ich kann dir auch direkt eine noch professionellere README im Stil eines SaaS-/EdTech-Produkts aufschreiben und direkt einbauen.

































