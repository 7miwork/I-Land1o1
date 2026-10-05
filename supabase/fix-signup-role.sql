-- ============================================================
-- I-Land1o1 – Fix: Rolle bei Registrierung
-- ============================================================
-- BUG: handle_new_user() hatte 3 Werte, aber nur 2 Spalten
-- angegeben (id, display_name). Dadurch wurde role='parent'
-- verworfen und JEDER als student gespeichert.
--
-- Ausfuehren: SQL Editor -> New query -> Run (einmalig)
-- Danach neu registrieren (bestehende Profile bleiben, wie sie sind).
-- Alt-Konten koennen unten nachgezogen werden.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- WICHTIG: Es muessen genauso viele Spalten wie Werte angegeben werden.
  -- Reihenfolge: id, display_name, role
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Pirat'), '@', 1)),
    -- Rolle aus den Registrierungs-Metadaten uebernehmen, aber NUR
    -- 'parent' oder 'student' (Whitelist). 'teacher'/'admin' kann man
    -- sich nicht selbst zuteilen.
    case when new.raw_user_meta_data ->> 'role' = 'parent'
         then 'parent'::public.app_role
         else 'student'::public.app_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Kontrolle: sollte 1 Zeile mit id = user-id zeigen
select u.email, p.role, p.display_name
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at;


-- ============================================================
-- TEIL 2: Bestehende Profile nachziehen
-- ------------------------------------------------------------
-- Der Trigger wirkt nur bei NEUEN Registrierungen. Wer schon
-- registriert ist, hat weiterhin 'student' stehen – auch die
-- Eltern-Konten. Deshalb korrigieren wir sie hier einmalig.
--
-- Die Rolle wird dabei aus den Registrierungs-Metadaten gelesen
-- (dort steht sie dank handle_new_user seit der Registrierung).
-- ============================================================

-- 1) Rolle + Name aus den Metadaten übernehmen (nur student/parent)
update public.profiles p
   set role = case
                when u.raw_user_meta_data ->> 'role' = 'parent' then 'parent'::public.app_role
                else 'student'::public.app_role
              end,
       display_name = coalesce(
                nullif(u.raw_user_meta_data ->> 'display_name', ''),
                nullif(split_part(coalesce(u.email, 'Pirat'), '@', 1), 'Pirat'),
                'Pirat'
              )
  from auth.users u
 where u.id = p.id
   and (
        -- Name stimmt nicht (z. B. nur der E-Mail-Teil oder 'Pirat')
        p.display_name is null
        or p.display_name = 'Pirat'
        or p.display_name = split_part(coalesce(u.email, ''), '@', 1)
        -- oder Rolle passt nicht zu den Metadaten
        or (u.raw_user_meta_data ->> 'role' = 'parent' and p.role <> 'parent')
        or (coalesce(u.raw_user_meta_data ->> 'role', 'student') <> 'parent' and p.role = 'parent')
   );

-- 2) Kontrollierte Ausnahmen: Konten, die Lehrer/Admin sein sollen.
--    Hier bewusst fest verdrahtet, damit sie nicht per Zufall
--    'student' bleiben. Bei echten Nutzern NUR per Einladung/Dashboard.
update public.profiles p
   set role = case
                when u.email like '%admin%'    then 'admin'::public.app_role
                when u.email like '%teacher%'  or
                     u.email like '%lehrer%'   then 'teacher'::public.app_role
                when u.email like '%parent%'   or
                     u.email like '%eltern%'   or
                     u.email like '%kid%'      or
                     u.email like '%kind%'     then 'parent'::public.app_role
                else 'student'::public.app_role
              end
  from auth.users u
 where u.id = p.id
   and (
        u.email like '%admin%' or u.email like '%teacher%' or u.email like '%lehrer%'
        or u.email like '%parent%' or u.email like '%eltern%'
        or u.email like '%kid%' or u.email like '%kind%'
   )
   -- nicht überschreiben, wenn bewusst anders gesetzt (z. B. Demo-Studenten)
   and coalesce(u.raw_user_meta_data ->> 'role', '') <> 'student'
   and p.role = 'student'
   and not (u.email like '%student%' or u.email like '%schueler%' or u.email like '%schüler%');

-- ============================================================
-- TEIL 3: Fremdschlüssel auf auth.users reparieren
-- ------------------------------------------------------------
-- PROBLEM: Wird ein Konto im Supabase-Dashboard gelöscht,
-- scheitert das mit:
--   "update or delete on table users violates foreign key
--    constraint profiles_id_fkey"
-- Grund: In der urspruenglichen profiles-Tabelle (vor unserem
-- Schema) fehlte ON DELETE CASCADE. Dadurch lassen sich Konten
-- nicht mehr loeschen – und beim Anlegen neuer Testkonten
-- scheitert alles.
--
-- Fix: FK auf profiles neu setzen mit ON DELETE CASCADE.
-- ============================================================

do $$
begin
  -- alten Constraint finden und entfernen
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and contype = 'f'
  ) then
    execute 'alter table public.profiles
              drop constraint if exists profiles_id_fkey';
    raise notice 'Alter FK entfernt';
  end if;

  -- neuen Constraint mit CASCADE anlegen
  execute 'alter table public.profiles
            add constraint profiles_id_fkey
            foreign key (id) references auth.users (id)
            on delete cascade';
  raise notice 'FK profiles -> auth.users mit ON DELETE CASCADE gesetzt';
exception
  when duplicate_object then
    raise notice 'FK existiert bereits (mit CASCADE)';
  when others then
    raise notice 'FK konnte nicht gesetzt werden: %', sqlerrm;
end $$;

-- Kontrolle
select conname,
       pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.profiles'::regclass
   and contype = 'f';


-- ============================================================
-- TEIL 4: Endkontrolle aller Konten
-- ============================================================
select u.email, p.role, p.display_name
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by p.role, u.email;