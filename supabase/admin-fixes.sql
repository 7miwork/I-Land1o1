-- ============================================================
-- I-Land1o1 – Admin-Dashboard Fixes (SQL)
-- ============================================================
-- Idempotent: Kann mehrfach ausgeführt werden.
-- Ausführung: Supabase SQL Editor -> New query -> Run
-- ============================================================

-- ============================================================
-- TEIL 1: profiles-Spalten erweitern
-- ============================================================
-- Benötigt für: Admin-Tabelle, Letzter Login, E-Mail-Vergleich

-- Spalte Email hinzufügen
alter table public.profiles
  add column if not exists email text;

-- Letzter Login hinzufügen
alter table public.profiles
  add column if not exists last_sign_in_at timestamptz;

-- Neue Profile sollen auch email bekommen (falls im Metadaten)
update public.profiles p
set email = coalece(
  nullif(u.raw_user_meta_data ->> 'email', ''),
  nullif(split_part(coalesce(u.email, ''), '@', 1), '')
)
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;


-- ============================================================
-- TEIL 2: handle_new_user() erweitern (auch Email speichern)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    -- Rolle aus Metadaten (WhiteList: parent/student)
    case when new.raw_user_meta_data ->> 'role' = 'parent'
         then 'parent'::public.app_role
         else 'student'::public.app_role end,
    -- Email aus Metadaten oder Email-Adresse
    coalesce(
      nullif(new.raw_user_meta_data ->> 'email', ''),
      new.email
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;


-- ============================================================
-- TEIL 3: Trigger auf auth.users
-- ============================================================
-- Synchronisiert email und last_sign_in_at in das Profil.

drop trigger if exists sync_profiles_on_auth_users on auth.users;

create trigger sync_profiles_on_auth_users
  after update of email, last_sign_in_at
  on auth.users
  for each row
  execute function public.sync_auth_user_to_profile();

create or replace function public.sync_auth_user_to_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
  set
    email = coalesce(nullif(new.email, ''), p.email),
    last_sign_in_at = new.last_sign_in_at
  where p.id = new.id;
  return new;
end $$;


-- ============================================================
-- TEIL 4: Policies für Admin-Zugriffe
-- ============================================================
-- Vorher drop policy if exists verwenden


-- --- subscriptions: UPDATE nur für Admin ---

drop policy if exists "admin can update subscriptions" on public.subscriptions;

create policy "admin can update subscriptions"
  on public.subscriptions
  for update
  to public
  using (public.my_role() = 'admin');


-- --- lesson_progress: DELETE zusätzlich für Admin ---

drop policy if exists "admin can delete lesson progress" on public.lesson_progress;

create policy "admin can delete lesson progress"
  on public.lesson_progress
  for delete
  to public
  using (public.my_role() = 'admin');


-- ============================================================
-- TEIL 5: Endkontrolle
-- ============================================================
select
  'profiles' as table_name,
  count(*) as column_count
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by column_name;
