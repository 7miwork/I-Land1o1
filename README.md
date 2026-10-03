# I-Land1o1 – Learning Platform (Live-Site)

Dieses Repo enthält den **Deploy-Stand** der Live-Website auf Hostinger
(Vite/React-Build-Output aus Manus).

## Struktur

| Pfad              | Beschreibung                                   |
|-------------------|------------------------------------------------|
| `index.html`      | Einstiegspunkt der App                          |
| `assets/`         | Build-Output (JS + CSS, dateiert im Filename)   |
| `manus-storage/`  | Bilder                                          |
| `__manus__/`      | Manus Debug-Collector                           |
| `.htaccess`       | Apache SPA-Rewrite (React Router)               |
| `Videos/`         | ⛔ NICHT im Repo – zu groß, nur per FTP auf dem Server |
| `dashboard/`      | Schüler-Dashboard (Level 1) – eigene statische App     |

## Schüler-Dashboard (`/dashboard/`)

Eigene, statische App (kein Build-Schritt) im Piraten-Design der Hauptseite.

| Datei          | Zweck                                                              |
|----------------|--------------------------------------------------------------------|
| `index.html`   | Login-Overlay + Seitenlayout                                       |
| `auth.js`      | Supabase-Auth (Login / Registrierung / Session / Logout)           |
| `config.js`    | ⚠️ Supabase `SUPABASE_URL` + `SUPABASE_ANON_KEY` hier eintragen     |
| `lessons.js`   | **Kurs-Inhalte pflegen** (`window.ILAND_LESSONS`)                   |
| `dashboard.js` | Rendert Lektionsraster, Video-Modal, Fortschritt                   |
| `dashboard.css`| Styles (Fonts + Farbpalette aus dem Hauptbundle übernommen)        |

- **Inhalte ändern:** einfach `dashboard/lessons.js` bearbeiten
  (`title`, `desc`, `task`, `video`). Neue Lektion = neues Objekt oder `length: 11` anpassen.
- **Fortschritt:** pro Supabase-User-ID in `localStorage` (`iland-progress-de-level1:<id>`),
  spiegeln in die Tabelle `lesson_progress` (Supabase) → geräteübergreifend.
- **Ohne ausgefüllte `config.js`-Werte** bleibt das Dashboard offen erreichbar (praktisch zum Testen).
- **Abo & Zahlung:** `dashboard/billing.js` spricht die Edge Functions an
  (Preise + Stripe-Key liegen ausschließlich serverseitig).

## Datenbank & Zahlungen (Supabase)

| Datei | Inhalt |
|-------|--------|
| `supabase/schema.sql` | `profiles` (Rollen Schüler/Eltern/Lehrer/Admin), `parent_links`, `lesson_progress`, RLS |
| `supabase/subscriptions.sql` | `subscriptions` + `payments` (nur lesbar für User, geschrieben vom Webhook) |
| `supabase/parents.sql` | Eltern-Einladungen (`parent_invites`), Registrierungs-Regeln, `has_course_access()` |
| `supabase/videos.sql` | Privater Storage-Bucket `course-videos` + Tabelle `lesson_videos` (Bezahlschranke) |
| `supabase/functions/README.md` | **Anleitung:** Edge Functions & Stripe in 7 Schritten |
| `.env.example` | Vorlage aller Variablen (echte `.env` ist in `.gitignore`) |

Reihenfolge: erst `schema.sql`, dann `subscriptions.sql` ausführen.

**Goldene Regel:** Alles mit `sk_…`, `service_role` oder SMTP-Passwörtern
gehört ausschließlich in **Supabase Edge Function Secrets** – niemals in
`dashboard/config.js`, niemals ins Git.

## Deployment

- **Website-Code:** dieses Repo → Hostinger (Git-Deploy bzw. Manuell)
- **Videos:** laufen weiterhin über FTP.
  Nach einem Git-Deploy ggf. prüfen, dass `Videos/` auf dem Server noch da ist.

## Videos hochladen (FTP)

Lokal (Skript liegt neben `index.html`, ist per `.gitignore` ausgeschlossen):

```powershell
cd Z:\I-Land1o1\Webseite
.\upload-videos.ps1          # lädt nur neue/geänderte Videos hoch
.\upload-videos.ps1 -Force   # lädt alles komplett neu hoch
```
