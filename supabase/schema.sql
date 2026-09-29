-- ============================================================
-- I-Land1o1 – Datenbankschema v1 (Supabase / PostgreSQL)
-- Ausführen im Supabase Dashboard: SQL Editor -> New query -> Run
-- Der Sketch ist idempotent (kann mehrmals gefahrlos laufen).
-- Ersetzt die alte lesson_progress.sql (Tabelle bleibt gleich).
-- ============================================================

-- 1) Rollen der Plattform (Schüler, Eltern, Lehrer, Admin)
do $$ begin
  create type public.app_role as enum ('student', 'parent', 'teacher', 'admin');
exception when duplicate_object then null; end $$;

-- 2) profiles: eine Zeile pro Login (auth.users kann man nicht erweitern)
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Pirat',
  role         public.app_role not null default 'student',
  created_at   timestamptz not null default now()
);

-- Selbstreparatur: falls eine profiles-Tabelle schon existierte (z. B. von
-- einem früheren Setup) bekommen fehlende Spalten automatisch ihren Default.
alter table public.profiles add column if not exists display_name text        not null default 'Pirat';
alter table public.profiles add column if not exists role         public.app_role not null default 'student';
alter table public.profiles add column if not exists created_at   timestamptz not null default now();

-- Falls eine alte Tabelle "role" als text/int statt Enum hatte: neu als Enum
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and data_type <> 'USER-DEFINED'
  ) then
    alter table public.profiles drop column role cascade;
    alter table public.profiles add column role public.app_role not null default 'student';
    raise notice 'Alte role-Spalte (kein Enum) wurde durch die Rollen-Spalte ersetzt';
  end if;
end $$;

-- FK auf auth.users nachtragen, falls die alte Tabelle ihn nicht hatte
do $$ begin
  alter table public.profiles
    add constraint profiles_id_fkey foreign key (id)
    references auth.users (id) on delete cascade;
exception
  when duplicate_object then null;   -- existiert schon (anders benannt o. ä.)
  when others then
    raise notice 'FK auth.users nicht gesetzt: %', sqlerrm;
end $$;

-- Störende NOT-NULL-Fremdspalten einer alten Tabelle (z. B. "username" aus
-- einem Tutorial-Setup) entblockieren, damit der Signup-Trigger einfügen kann
do $$
declare c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and is_nullable = 'NO' and column_default is null
      and column_name not in ('id', 'display_name', 'role', 'created_at')
  loop
    execute format('alter table public.profiles alter column %I drop not null', c);
    raise notice 'Alte Pflichtspalte entschärft: %', c;
  end loop;
end $$;

-- 3) parent_links: welches Elternteil gehört zu welchem Kind?
--    (Eltern-Dashboard liest später darüber die Kinder-Fortschritte)
create table if not exists public.parent_links (
  parent_id  uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

-- 4) Bei jeder Registrierung automatisch ein Profil anlegen
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'Pirat'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bereits existierende User (z. B. demo) nachtragen
insert into public.profiles (id, display_name)
select id, split_part(coalesce(email, 'pirat'), '@', 1) from auth.users
on conflict (id) do nothing;

-- 5) Hilfsfunktionen für die Policies (security definer = kein RLS-Konter)
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_parent_of(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.parent_links l
     where l.parent_id = auth.uid() and l.student_id = p_student
   ) $$;

-- 6) Fortschritt pro Lektion (wird von dashboard.js gefüllt)
create table if not exists public.lesson_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  lesson_id  text not null,
  done       boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_user_idx
  on public.lesson_progress (user_id);

-- ============================================================
-- Row Level Security: Berechtigungen liegen in der Datenbank,
-- nicht im JavaScript des Browsers.
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.parent_links    enable row level security;
alter table public.lesson_progress enable row level security;

-- ---- profiles: jeder sieht sich selbst, Lehrer/Admin sieht alle ----
drop policy if exists "profile: sich selbst lesen" on public.profiles;
create policy "profile: sich selbst lesen" on public.profiles for select
  using (id = auth.uid() or public.my_role() in ('teacher','admin'));

drop policy if exists "profile: eigene Daten bearbeiten" on public.profiles;
create policy "profile: eigene Daten bearbeiten" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Rollenwechsel ist Schülern/Eltern untersagt (nur Admin, siehe Trigger)
create or replace function public.guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and public.my_role() <> 'admin' then
      raise exception 'Rolle darf nur von einem Admin geändert werden';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_role_change on public.profiles;
create trigger guard_role_change
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- ---- parent_links: nur Admin schreibt, Eltern lesen ihre Verknüpfungen ----
drop policy if exists "links: als Elternteil lesen" on public.parent_links;
create policy "links: als Elternteil lesen" on public.parent_links for select
  using (parent_id = auth.uid() or public.my_role() = 'admin');

drop policy if exists "links: Admin schreibt" on public.parent_links;
create policy "links: Admin schreibt" on public.parent_links for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---- lesson_progress: Schüler schreiben eigene Zeilen, Eltern/Lehrer lesen ----
drop policy if exists "fortschritt: eigene Zeilen lesen" on public.lesson_progress;
create policy "fortschritt: eigene Zeilen lesen" on public.lesson_progress for select
  using (
    user_id = auth.uid()
    or public.is_parent_of(user_id)
    or public.my_role() in ('teacher','admin')
  );

drop policy if exists "fortschritt: eigene Zeilen einfügen" on public.lesson_progress;
create policy "fortschritt: eigene Zeilen einfügen" on public.lesson_progress for insert
  with check (user_id = auth.uid());

drop policy if exists "fortschritt: eigene Zeilen ändern" on public.lesson_progress;
create policy "fortschritt: eigene Zeilen ändern" on public.lesson_progress for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "fortschritt: eigene Zeilen löschen" on public.lesson_progress;
create policy "fortschritt: eigene Zeilen löschen" on public.lesson_progress for delete
  using (user_id = auth.uid());
