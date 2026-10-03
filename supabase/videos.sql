-- ============================================================
-- I-Land1o1 – Video-Ablage in Supabase Storage (Bezahlschranke)
-- Ausführen: SQL Editor -> New query -> Run
-- Reihenfolge: schema.sql -> parents.sql -> DIESE Datei
-- Idempotent: mehrfach ausführbar.
-- ============================================================

-- 1) PRIVATER Bucket: Dateien sind niemals öffentlich abrufbar.
--    Zugriff nur über signierte URLs, die die Edge Function
--    "get-video-url" nach Prüfung der Bezahlung kurzzeitig erzeugt.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-videos', 'course-videos', false, 524288000, array['video/mp4'])
on conflict (id) do update set public = false;

-- 2) Zuordnung Lektions-ID -> Datei im Bucket.
--    Der Browser kennt nur die Lektions-ID ("l01"), niemals den Pfad –
--    sonst könnte jeder einfach die Datei-Pfade erraten.
create table if not exists public.lesson_videos (
  lesson_id    text primary key,
  title        text,
  storage_path text not null unique,
  sort_order   integer not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.lesson_videos enable row level security;

-- Angemeldete dürfen die Zuordnung lesen (die eigentliche Sperre ist die
-- signierte URL in der Edge Function, nicht diese Tabelle).
drop policy if exists "video-zuordnung: lesen" on public.lesson_videos;
create policy "video-zuordnung: lesen"
  on public.lesson_videos for select
  using (auth.role() = 'authenticated');

-- Schreiben darf nur der Admin (bzw. das Upload-Script mit service role).
drop policy if exists "video-zuordnung: admin schreibt" on public.lesson_videos;
create policy "video-zuordnung: admin schreibt"
  on public.lesson_videos for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- 3) Kontrolle: Sind alle erwarteten Lektionen hinterlegt?
--    select lesson_id, storage_path, published from lesson_videos order by sort_order;