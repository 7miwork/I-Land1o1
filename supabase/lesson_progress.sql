-- ============================================================
-- I-Land1o1 – Fortschritts-Tabelle für das Schüler-Dashboard
-- Ausführen im Supabase Dashboard: SQL Editor -> New query -> Run
-- (einmalig; ist bereits gelaufen, einfach erneut ausführen,
--  wegen IF NOT EXISTS kein Problem)
-- ============================================================

create table if not exists public.lesson_progress (
  user_id    uuid  not null references auth.users (id) on delete cascade,
  lesson_id  text  not null,
  done       boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Row Level Security: jeder angemeldete User sieht/schreibt NUR eigene Zeilen.
-- Der öffentliche anon-Key allein kann damit nichts lesen oder ändern.
alter table public.lesson_progress enable row level security;

drop policy if exists "eigener Fortschritt: lesen" on public.lesson_progress;
create policy "eigener Fortschritt: lesen"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

drop policy if exists "eigener Fortschritt: einfügen" on public.lesson_progress;
create policy "eigener Fortschritt: einfügen"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "eigener Fortschritt: ändern" on public.lesson_progress;
create policy "eigener Fortschritt: ändern"
  on public.lesson_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "eigener Fortschritt: löschen" on public.lesson_progress;
create policy "eigener Fortschritt: löschen"
  on public.lesson_progress for delete
  using (auth.uid() = user_id);
