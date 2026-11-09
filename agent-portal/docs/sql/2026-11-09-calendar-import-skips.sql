-- Remembers which prepared-schedule events (the "665 events ready to add" import) were deleted on purpose,
-- so running the import again does not bring them back. Safe to run more than once. Run in the Supabase SQL editor.
create table if not exists public.calendar_import_skips (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_set text not null,
  import_key text not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now(),
  primary key (organization_id, import_set, import_key)
);
alter table public.calendar_import_skips enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on public.calendar_import_skips from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on public.calendar_import_skips from authenticated'; end if;
end $$;

-- Optional check (read-only): imported events that exist twice, or that came back after you moved them.
-- select metadata->>'import_key' as import_key, count(*) as copies, min(starts_at) as first_date, max(starts_at) as last_date
-- from public.events where metadata->>'import_set' = 'mdv-2026-wk43' group by 1 having count(*) > 1;
