-- Calendar duplicate clean-up: the backup table.
-- Run this once in the Supabase SQL editor. Every copy the clean-up removes is saved here first, so a run can be undone.
-- Safe to run twice.

create table if not exists public.calendar_dedupe_backup (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  run_id uuid not null,
  kind text not null check (kind in ('event','task','block')),
  row_id text not null,
  payload jsonb not null,
  children jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists calendar_dedupe_backup_run_idx on public.calendar_dedupe_backup (organization_id, run_id);
create index if not exists calendar_dedupe_backup_created_idx on public.calendar_dedupe_backup (organization_id, created_at desc);

-- Only the server (service role) touches this table.
alter table public.calendar_dedupe_backup enable row level security;
