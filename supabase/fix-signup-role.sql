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