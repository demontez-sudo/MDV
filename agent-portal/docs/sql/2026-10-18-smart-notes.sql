-- Smart Notes: one shared notes system that can be attached to anything in the portal
-- (a model, a contact, a company, a booking, a casting, a package, a scout record, or just a page).
-- Each note keeps its connections (links), the teammates it mentions, tags, an optional follow-up date
-- and the "smart" read of the note (suggested tasks, kind, priority).
-- Safe to run more than once. Run in the Supabase SQL editor.

create table if not exists public.smart_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.smart_notes(id) on delete cascade,
  kind text not null default 'note',
  title text,
  body text not null,
  visibility text not null default 'team' check (visibility in ('team','private','model')),
  pinned boolean not null default false,
  resolved boolean not null default false,
  archived boolean not null default false,
  author_id uuid,
  author_name text,
  links jsonb not null default '[]'::jsonb,
  mentions jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  follow_up_at timestamptz,
  smart jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Locked down: only the server (service role) reads or writes this table. No policies on purpose.
alter table public.smart_notes enable row level security;
revoke all on public.smart_notes from anon, authenticated;

create index if not exists smart_notes_org_created_idx on public.smart_notes (organization_id, created_at desc);
create index if not exists smart_notes_org_follow_idx on public.smart_notes (organization_id, follow_up_at) where follow_up_at is not null and resolved = false and archived = false;
create index if not exists smart_notes_links_idx on public.smart_notes using gin (links jsonb_path_ops);
create index if not exists smart_notes_parent_idx on public.smart_notes (parent_id);
