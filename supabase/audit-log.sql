-- ============================================================
-- I-Land1o1 – Admin-Audit-Log
-- Protokolliert destruktive Aktionen im Admin-Dashboard:
-- Rollenänderungen, Abo-Resets, Fortschritts-Löschungen
-- ============================================================

-- 1) Tabelle erstellen (idempotent)
create table if not exists public.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references auth.users(id) on delete set null,
  actor_email   text,
  action        text not null,           -- 'role_change', 'subscription_reset', 'progress_reset', 'user_delete', 'link_create', 'link_delete', ...
  target_id     uuid,                    -- auf welchen User/Link bezog sich die Aktion
  target_email  text,
  details       jsonb default '{}',      -- z. B. alte/neue Rolle, Plan, etc.
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log (actor_id);
create index if not exists admin_audit_log_action_idx
  on public.admin_audit_log (action);

-- 2) RLS aktivieren
alter table public.admin_audit_log enable row level security;

-- Nur Admins und Lehrer lesen das Log, niemand schreibt direkt (Schreiben über Security-Definer-Funktion oder direkt im JS mit RLS-Policy für admin)
drop policy if exists "audit: admin/teacher lesen" on public.admin_audit_log;
create policy "audit: admin/teacher lesen" on public.admin_audit_log for select
  using (public.my_role() in ('admin','teacher'));

-- Admins dürfen Einträge schreiben (für das Logging aus dem Frontend)
drop policy if exists "audit: admin schreibt" on public.admin_audit_log;
create policy "audit: admin schreibt" on public.admin_audit_log for insert
  with check (public.my_role() = 'admin');

-- ============================================================
-- Befund: Es gab bisher kein Audit-Log im Admin-Dashboard.
-- Dieser Fix ergänzt die Tabelle und RLS-Policies.
-- ============================================================