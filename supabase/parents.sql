-- ============================================================
-- I-Land1o1 – Eltern-Konten, Einladungs-Codes & Zugangsrechte
-- Ausführen: SQL Editor -> New query -> Run
-- Reihenfolge: schema.sql -> subscriptions.sql -> DIESE Datei
-- Idempotent: mehrfach ausführbar.
-- ============================================================

-- 1) Registrierung: Der Browser darf nur 'student' oder 'parent' wählen.
--    'teacher'/'admin' sind ausschliesslich über das Dashboard/SQL setzbar.
--    (Sonst könnte sich jeder selbst als Lehrer anmelden.)
create or replace function public.guard_signup_role()
returns trigger language plpgsql as $$
begin
  if new.role not in ('student', 'parent') then
    raise exception 'Diese Rolle kann man nicht selbst wählen';
  end if;
  return new;
end $$;

drop trigger if exists guard_signup_role on public.profiles;
create trigger guard_signup_role
  before insert on public.profiles
  for each row execute function public.guard_signup_role();

-- 2) Einladungen: Eltern erzeugt einen Code, das Kind löst ihn ein.
--    So klappt es in BEIDEN Reihenfolgen:
--    Eltern zuerst  -> Kind registriert sich mit dem Code
--    Kind zuerst    -> Kind trägt den Code später im Dashboard ein
create table if not exists public.parent_invites (
  code        text primary key,
  parent_id   uuid not null references public.profiles (id) on delete cascade,
  student_id  uuid references public.profiles (id) on delete set null,
  status      text not null default 'open',   -- open | accepted | revoked
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.parent_invites enable row level security;

drop policy if exists "einladung: eigenes lesen" on public.parent_invites;
create policy "einladung: eigenes lesen"
  on public.parent_invites for select
  using (parent_id = auth.uid() or student_id = auth.uid() or public.my_role() = 'admin');

drop policy if exists "einladung: eltern erstellt" on public.parent_invites;
create policy "einladung: eltern erstellt"
  on public.parent_invites for insert
  with check (parent_id = auth.uid() and public.my_role() = 'parent');

drop policy if exists "einladung: eltern verwaltet" on public.parent_invites;
create policy "einladung: eltern verwaltet"
  on public.parent_invites for update
  using (parent_id = auth.uid()) with check (parent_id = auth.uid());

drop policy if exists "einladung: eltern loescht" on public.parent_invites;
create policy "einladung: eltern loescht"
  on public.parent_invites for delete
  using (parent_id = auth.uid());

-- 3) Einladungs-Code erzeugen (nur Eltern-Konten)
create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code  text;
  v_try   int := 0;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if public.my_role() <> 'parent' then
    raise exception 'Nur Eltern-Konten koennen Einladungen erstellen';
  end if;

  loop
    v_code := 'ILAND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    v_try  := v_try + 1;
    begin
      insert into public.parent_invites (code, parent_id) values (v_code, auth.uid());
      return v_code;
    exception when unique_violation then
      if v_try >= 5 then raise exception 'Code konnte nicht erzeugt werden'; end if;
    end;
  end loop;
end $$;

-- 4) Einladung einloesen: Kind ruft das mit seinem Code auf.
--    SECURITY DEFINER noetig, weil der Link sonst die RLS-Regeln
--    von parent_links verletzen wuerde (die sind absichtlich admin-only).
create or replace function public.accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv    public.parent_invites;
  v_parent uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_inv
    from public.parent_invites
    where code = upper(trim(coalesce(p_code, ''))) and status = 'open';

  if v_inv.parent_id is null then
    raise exception 'Dieser Code ist ungueltig oder schon eingeloest';
  end if;
  -- Ein Kind darf hoechstens bei EINEM Elternteil haengen
  if exists (select 1 from public.parent_links where student_id = auth.uid()) then
    raise exception 'Dein Konto ist bereits einem Elternteil zugeordnet';
  end if;

  v_parent := v_inv.parent_id;

  update public.parent_invites
     set status = 'accepted', student_id = auth.uid(), accepted_at = now()
   where code = v_inv.code;

  insert into public.parent_links (parent_id, student_id)
    values (v_parent, auth.uid())
    on conflict do nothing;

  return v_parent;
end $$;

-- Diese Funktionen nur fuer angemeldete Nutzer (nicht anonym)
revoke execute on function public.accept_invite(text) from anon;
revoke execute on function public.create_invite() from anon;

-- 5) Zugangsrechte: Hat dieses Kind (oder sein Elternteil) ein aktives Abo?
--    Wird spaeter von der Video-Funktion benutzt, um signierte URLs
--    nur fuer berechtigte Nutzer zu erzeugen.
create or replace function public.has_course_access(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.subscriptions s
     where s.status in ('active', 'trialing', 'paid')
       and (
         s.user_id = p_user
         or exists (
              select 1 from public.parent_links l
               where l.student_id = p_user and l.parent_id = s.user_id
         )
       )
  )
$$;

revoke execute on function public.has_course_access(uuid) from anon;

-- 6) Rechte nachschärfen: Eltern müssen die Profildaten ihrer Kinder
--    lesen dürfen (für "Meine Kinder"-Liste), Kinder sehen ihrEN Link.
--    Die alten Policies werden deshalb hier ersetzt.
drop policy if exists "profile: sich selbst lesen" on public.profiles;
create policy "profile: sich selbst lesen"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.my_role() in ('teacher', 'admin')
    or public.is_parent_of(id)          -- NEU: Eltern sehen ihr Kind
  );

drop policy if exists "links: als Elternteil lesen" on public.parent_links;
create policy "links: als Elternteil lesen"
  on public.parent_links for select
  using (
    parent_id = auth.uid()              -- Elternteil
    or student_id = auth.uid()          -- NEU: Kind sieht die Verknüpfung
    or public.my_role() = 'admin'
  );

-- 7) Übersicht für dich als Admin (RLS greift beim Lesen trotzdem)
--    Beispiel: alle Kinder mit Abo-Status
--    select p.display_name, l.parent_id, s.status, s.plan, s.current_period_end
--      from parent_links l
--      join profiles p on p.id = l.student_id
--      left join subscriptions s on s.user_id = l.parent_id;