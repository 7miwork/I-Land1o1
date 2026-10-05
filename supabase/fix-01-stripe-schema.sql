-- ============================================================
-- REPARATUR 1: subscriptions / payments auf das Stripe-Schema bringen
-- ------------------------------------------------------------
-- BEFUND: In der Datenbank liegt eine ALTERE subscriptions-Tabelle
-- mit anderen Spalten (monthly_lesson_quota, remaining_credits,
-- current_period_start) als der stripe-webhook schreibt
-- (stripe_customer_id, stripe_subscription_id, plan).
-- Deshalb schlug jeder Checkout fehl und die Tabelle blieb leer.
--
-- "create table if not exists" hat hier NICHT geholft: die Tabelle
-- existierte bereits, also wurde nichts angepasst. Deshalb ALTER.
--
-- Die alten Credits-Spalten bleiben erhalten (falls dort noch
-- historische Testdaten drin sind).
-- ============================================================

alter table public.subscriptions
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan                   text not null default 'level1-monthly',
  add column if not exists cancel_at_period_end   boolean not null default false,
  add column if not exists updated_at              timestamptz not null default now();

create unique index if not exists subs_customer_idx
  on public.subscriptions (stripe_customer_id);
create unique index if not exists subs_subid_idx
  on public.subscriptions (stripe_subscription_id);

-- --------------------------------------------
-- payments: fehlende Stripe-Spalten ergaenzen
-- --------------------------------------------
alter table public.payments
  add column if not exists stripe_invoice_id text,
  add column if not exists amount_cents       integer not null default 0,
  add column if not exists currency           text not null default 'eur',
  add column if not exists status             text not null default 'paid',
  add column if not exists paid_at            timestamptz,
  add column if not exists created_at         timestamptz not null default now();

create unique index if not exists payments_invoice_idx
  on public.payments (stripe_invoice_id);


-- ============================================================
-- REPARATUR 2: Fremdschluessel auf auth.users (ON DELETE CASCADE)
-- ------------------------------------------------------------
-- Ohne CASCADE laesst sich kein Konto loeschen (Fehler 23503).
-- ============================================================
do $$
begin
  execute 'alter table public.profiles drop constraint if exists profiles_id_fkey';
  execute 'alter table public.profiles
            add constraint profiles_id_fkey
            foreign key (id) references auth.users (id) on delete cascade';
  raise notice 'profiles -> auth.users: ON DELETE CASCADE gesetzt';
exception
  when others then
    raise notice 'FK konnte nicht gesetzt werden: %', sqlerrm;
end $$;


-- ============================================================
-- KONTROLLE Teil 1
-- ============================================================
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'subscriptions'
 order by ordinal_position;

-- MUSS sein: stripe_customer_id, stripe_subscription_id, plan,
--             cancel_at_period_end