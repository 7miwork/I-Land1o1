-- ============================================================
-- I-Land1o1 – Abos & Zahlungen (Stripe)
-- Ausführen im Supabase Dashboard: SQL Editor -> New query -> Run
-- Voraussetzung: schema.sql (profiles, RLS-Hilfsfunktionen)
-- Idempotent: kann mehrfach laufen.
-- ============================================================

-- 1) Abo-Status pro User (1:1, wird vom Stripe-Webhook gepflegt)
create table if not exists public.subscriptions (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  plan                  text not null default 'level1-monthly',
  status                text not null default 'incomplete',
  -- Stripe-Status: incomplete | trialing | active | past_due | canceled | unpaid
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 2) Zahlungsprotokoll (für Belege / "Downloads")
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  stripe_invoice_id text unique,
  amount_cents     integer not null default 0,
  currency         text not null default 'eur',
  status           text not null default 'paid',
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id, paid_at desc);

-- 3) RLS: User liest nur SEINE Daten. Schreiben darf ausschliesslich der
--    stripe-webhook (service role, umgeht RLS) – daher bewusst KEINE
--    insert/update/delete-Policies. Ein Schüler kann sein Abo also weder
--    selbst freischalten noch manipulieren.
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;

drop policy if exists "abo: eigenes lesen" on public.subscriptions;
create policy "abo: eigenes lesen"
  on public.subscriptions for select
  using (user_id = auth.uid() or public.my_role() in ('teacher','admin'));

drop policy if exists "zahlungen: eigenes lesen" on public.payments;
create policy "zahlungen: eigenes lesen"
  on public.payments for select
  using (user_id = auth.uid() or public.my_role() in ('teacher','admin'));

-- 4) Bequeme Auswertung fuer dich als Admin (RLS greift weiterhin!)
--    Beispiel: alle aktiven Abos
--    select p.display_name, s.plan, s.status, s.current_period_end
--    from subscriptions s join profiles p on p.id = s.user_id
--    where s.status = 'active';