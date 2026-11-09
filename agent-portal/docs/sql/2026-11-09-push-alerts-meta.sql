-- Push alerts: everything the portal needs for device alerts, in one file.
-- Safe on a database that has never had push set up, on one that has, and to run again.
-- Run in the Supabase SQL editor (MAISON DE VEUX project). Needs public.organizations to exist.

-- 1. Devices that turned alerts on (one row per device)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text,
  auth text,
  platform text,
  user_agent text,
  enabled boolean not null default true,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 2. Alerts waiting to be shown on a device
create table if not exists public.push_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  user_id uuid not null,
  category text,
  title text not null,
  body text,
  url text,
  tag text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

-- 3. New: how an alert looks and behaves (level info / soon / urgent / win, an icon, an optional picture)
alter table public.push_alerts add column if not exists meta jsonb not null default '{}'::jsonb;

-- 4. Lock both tables to the server only (no policies on purpose)
alter table public.push_subscriptions enable row level security;
alter table public.push_alerts enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.push_subscriptions from anon';
    execute 'revoke all on public.push_alerts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.push_subscriptions from authenticated';
    execute 'revoke all on public.push_alerts from authenticated';
  end if;
end $$;

-- 5. Indexes
create index if not exists push_subscriptions_org_user_idx on public.push_subscriptions (organization_id, user_id) where enabled = true;
create index if not exists push_alerts_sub_pending_idx on public.push_alerts (subscription_id, created_at) where delivered_at is null;

-- 6. Check: this should list the meta column
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'push_alerts' and column_name = 'meta';
