# Komprimiert die vier grossen Lektionsvideos unter 50 MB (Supabase-Free-Limit).
# TUS ist auf dem Free-Tarif ebenfalls geblockt (413 beim Upload-Start),
# deshalb bleibt nur: kleiner machen und per Standard-Upload hochladen.
# Quellen bleiben unangetastet, Ergebnisse landen in Videos\compressed\...
#
# v2: bessere Qualitaet pro Byte –
#   - volles Budget: 47,5 MB Ziel (Marge unter 50-MB-Limit)
#   - preset slow statt veryfast (~10-15 % schaerfer bei gleicher Bitrate)
#   - Video-Bitrate automatisch aus der Dauer statt hartcodiert
#   - SSIM-Vergleich gegen das Original zur Kontrolle
$ErrorActionPreference = 'Stop'
Set-Location 'Z:\I-Land1o1\Webseite'

$src = 'Videos\DE\Level 1'
$dst = 'Videos\compressed\Level 1'
New-Item -ItemType Directory -Force -Path $dst | Out-Null

$targetMB  = 47.5   # Gesamtziel pro Datei (Video + Audio)
$audioKbps = 96     # AAC stereo – fuer Sprach-/Lernvideos ausreichend
$preset    = 'slow' # quality first; veryfast waere ~4x schneller, aber schlechter

$names = @(
  'DE Level 1 Lesson 01.mp4'
  'DE Level 1 Lesson 02.mp4'
  'DE Level 1 Lesson 03.mp4'
  'DE Level 1 Lesson 04.mp4'
)

foreach ($name in $names) {
  $in  = Join-Path $src $name
  $out = Join-Path $dst $name
  $dur = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $in)
  # Video-Bitrate so waehlen, dass (Video+Audio)*Dauer == Zielgroesse
  $vKbps = [int](($targetMB * 1024 * 8 / $dur) - $audioKbps)
  Write-Output ("== {0}  {1:N1} min  ->  Video {2} kbit/s, Audio {3} kbit/s" -f $name, ($dur/60), $vKbps, $audioKbps)
  ffmpeg -y -hide_banner -loglevel error -i $in -c:v libx264 -preset $preset -b:v "${vKbps}k" -pass 1 -an -f null NUL
  ffmpeg -y -hide_banner -loglevel error -i $in -c:v libx264 -preset $preset -b:v "${vKbps}k" -pass 2 -c:a aac -b:a "${audioKbps}k" -movflags +faststart -pix_fmt yuv420p $out
  $mb = [math]::Round((Get-Item $out).Length/1MB,1)
  # Qualitaet objektiv gegen das Original messen (nur Ausgabe, kein Filter)
  $ssim = (ffmpeg -hide_banner -loglevel info -i $in -i $out -lavfi ssim -f null NUL 2>&1 | Select-String 'All:').ToString().Trim()
  Write-Output "   fertig: $mb MB | $ssim"
}
Remove-Item 'ffmpeg2pass-0.log*' -ErrorAction SilentlyContinue
Write-Output 'ENDE'
