# Komprimiert die vier grossen Lektionsvideos unter 50 MB (Supabase-Free-Limit).
# TUS ist auf dem Free-Tarif ebenfalls geblockt (413 beim Upload-Start),
# deshalb bleibt nur: kleiner machen und per Standard-Upload hochladen.
# Quellen bleiben unangetastet, Ergebnisse landen in Videos\compressed\...
$ErrorActionPreference = 'Stop'
Set-Location 'Z:\I-Land1o1\Webseite'

$src = 'Videos\DE\Level 1'
$dst = 'Videos\compressed\Level 1'
New-Item -ItemType Directory -Force -Path $dst | Out-Null

# Ziel-Bitraten (2-Pass ABR), so dass jede Datei mit Audio ~46 MB landet
# (4 MB Marge unter dem 50-MB-Limit, Container-Overhead eingerechnet)
$targets = [ordered]@{
  'DE Level 1 Lesson 01.mp4' = 800   # 7,0 min
  'DE Level 1 Lesson 02.mp4' = 550   # 9,7 min
  'DE Level 1 Lesson 03.mp4' = 560   # 9,5 min
  'DE Level 1 Lesson 04.mp4' = 690   # 8,0 min
}

foreach ($name in $targets.Keys) {
  $in  = Join-Path $src $name
  $out = Join-Path $dst $name
  $v   = $targets[$name]
  Write-Output "== $name -> ${v} kbit/s (2-Pass)"
  ffmpeg -y -hide_banner -loglevel error -i $in -c:v libx264 -preset veryfast -b:v "${v}k" -pass 1 -an -f null NUL
  ffmpeg -y -hide_banner -loglevel error -i $in -c:v libx264 -preset veryfast -b:v "${v}k" -pass 2 -c:a aac -b:a 96k -movflags +faststart $out
  $mb = [math]::Round((Get-Item $out).Length/1MB,1)
  Write-Output "   fertig: $mb MB"
}
Remove-Item 'ffmpeg2pass-0.log*' -ErrorAction SilentlyContinue
Write-Output 'ENDE'
