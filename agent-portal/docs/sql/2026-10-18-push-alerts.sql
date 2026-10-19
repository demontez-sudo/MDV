-- Push alerts (MacBook + iPhone). One row per device that turned alerts on, and one row per alert waiting to be shown.
-- Locked down: only the server (service role) reads or writes these tables. No policies on purpose.
-- Safe to run more than once. Run in the Supabase SQL editor.

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
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
create index if not exists push_subscriptions_org_user_idx on public.push_subscriptions (organization_id, user_id) where enabled = true;

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
alter table public.push_alerts enable row level security;
revoke all on public.push_alerts from anon, authenticated;
create index if not exists push_alerts_sub_pending_idx on public.push_alerts (subscription_id, created_at) where delivered_at is null;
