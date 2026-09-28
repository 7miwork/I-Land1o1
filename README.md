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
