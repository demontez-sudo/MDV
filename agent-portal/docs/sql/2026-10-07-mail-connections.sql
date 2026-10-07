-- Team-member email (Microsoft 365). One row per staff member per organization.
-- Tokens are stored ENCRYPTED by the app (AES-256-GCM); the table is service-role only.
-- Safe to run more than once. Run in the Supabase SQL editor.

create table if not exists public.mail_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'microsoft' check (provider in ('microsoft')),
  email text,
  display_name text,
  access_token_enc text,
  refresh_token_enc text not null,
  expires_at timestamptz,
  scope text,
  status text not null default 'active' check (status in ('active','needs_reconnect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, provider)
);

-- Locked down: only the server (service role) reads or writes this table. No policies on purpose.
alter table public.mail_connections enable row level security;
revoke all on public.mail_connections from anon, authenticated;

create index if not exists mail_connections_org_user_idx on public.mail_connections (organization_id, user_id);
