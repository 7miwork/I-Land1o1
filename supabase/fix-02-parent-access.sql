-- ============================================================
-- REPARATUR 3: Elternlogik + has_course_access()
-- ------------------------------------------------------------
-- BEFUND: has_course_access() EXISTIERT NICHT (404), obwohl
-- dashboard.js und family.js sie aufrufen. parents.sql wurde also
-- nicht vollstaendig ausgefuehrt.
--
-- Das ist zwingend noetig: ohne diese Funktion kann ein Kind das
-- Abo seiner Eltern nicht erben – die ganze Eltern-Kind-Verknuepfung
-- waere wirkungslos.
--
-- Ausfuehren NACH fix-01-stripe-schema.sql (braucht subscriptions.plan).
-- ============================================================

-- 3a) Einladungen: Eltern erzeugt Code, Kind löst ihn ein
create table if not exists public.parent_invites (
  code        text primary key,
  parent_id   uuid not null references public.profiles (id) on delete cascade,
  student_id  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

alter table public.parent_invites enable row level security;

-- 3b) Verknuepfung Eltern <-> Kind
alter table public.parent_links enable row level security;

drop policy if exists "links: als Elternteil lesen" on public.parent_links;
create policy "links: als Elternteil lesen" on public.parent_links for select
  using (parent_id = auth.uid() or public.my_role() = 'admin');

drop policy if exists "links: Admin schreibt" on public.parent_links;
create policy "links: Admin schreibt" on public.parent_links for all
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- 3c) Eltern erzeugt einen Einladungs-Code
create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = public as $$
declare
  v text;
begin
  if public.my_role() <> 'parent' then
    raise exception 'Nur Eltern koennen einen Code erstellen.';
  end if;
  -- 8 Zeichen hex, gut lesbar
  v := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.parent_invites (code, parent_id)
  values (v, auth.uid());
  return v;
end $$;

revoke execute on function public.create_invite() from anon;

-- 3d) Kind loest den Code ein -> parent_links entsteht
create or replace function public.accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_parent  uuid;
  v_student uuid := auth.uid();
begin
  if v_student is null then
    raise exception 'Bitte zuerst anmelden.';
  end if;

  select parent_id into v_parent
    from public.parent_invites
   where code = p_code and used_at is null;

  if v_parent is null then
    raise exception 'Dieser Code ist ungueltig oder schon benutzt.';
  end if;
  if v_parent = v_student then
    raise exception 'Du kannst deinen eigenen Code nicht einloesen.';
  end if;

  update public.parent_invites
     set student_id = v_student, used_at = now()
   where code = p_code;

  insert into public.parent_links (parent_id, student_id)
  values (v_parent, v_student)
  on conflict (parent_id, student_id) do nothing;

  return v_parent;
end $$;

revoke execute on function public.accept_invite(text) from anon;

-- 3e) Zugangspruefung: eigenes Abo ODER Abo eines Elternteils.
--     'paid' = Einmalzahlung und gilt dauerhaft.
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

-- 3f) RLS fuer Einladungen
drop policy if exists "einladung: eigenes lesen" on public.parent_invites;
create policy "einladung: eigenes lesen" on public.parent_invites for select
  using (parent_id = auth.uid() or student_id = auth.uid());

drop policy if exists "einladung: Eltern schreibt" on public.parent_invites;
create policy "einladung: Eltern schreibt" on public.parent_invites for insert
  with check (parent_id = auth.uid() and public.my_role() = 'parent');


-- ============================================================
-- REPARATUR 4: RLS fuer subscriptions / payments
-- (die alte Tabellenform hatte keine Policies fuer diese Namen)
-- ============================================================
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;

drop policy if exists "abo: eigenes lesen" on public.subscriptions;
create policy "abo: eigenes lesen"
  on public.subscriptions for select
  using (user_id = auth.uid() or public.my_role() in ('teacher', 'admin'));

drop policy if exists "zahlungen: eigenes lesen" on public.payments;
create policy "zahlungen: eigenes lesen"
  on public.payments for select
  using (user_id = auth.uid() or public.my_role() in ('teacher', 'admin'));


-- ============================================================
-- KONTROLLE
-- ============================================================
-- MUSS 7 Zeilen ergeben:
select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
 order by 1;

select 'profiles'         as tabelle, count(*) as zeilen from public.profiles
union all select 'subscriptions',    count(*) from public.subscriptions
union all select 'payments',         count(*) from public.payments
union all select 'parent_links',     count(*) from public.parent_links
union all select 'parent_invites',   count(*) from public.parent_invites
union all select 'lesson_progress',  count(*) from public.lesson_progress
order by 1;