-- Skin & Walks: makes sure the submissions table exists with every column the Model Portal and the agent review page use.
-- Safe to run more than once. Does not change or delete any existing rows.

do $$
begin
  if to_regclass('public.model_development_submissions') is null then
    create table public.model_development_submissions (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      model_id uuid not null,
      submission_type text not null,
      status text not null default 'pending',
      model_note text,
      agent_note text,
      submitted_by uuid,
      timezone text,
      reviewed_by uuid,
      reviewed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    -- Only the server (service role) reads and writes this table.
    alter table public.model_development_submissions enable row level security;
  end if;
end $$;

alter table public.model_development_submissions add column if not exists model_note text;
alter table public.model_development_submissions add column if not exists agent_note text;
alter table public.model_development_submissions add column if not exists submitted_by uuid;
alter table public.model_development_submissions add column if not exists timezone text;
alter table public.model_development_submissions add column if not exists reviewed_by uuid;
alter table public.model_development_submissions add column if not exists reviewed_at timestamptz;
alter table public.model_development_submissions add column if not exists updated_at timestamptz not null default now();

create index if not exists model_development_submissions_model_idx
  on public.model_development_submissions (organization_id, model_id, created_at desc);

-- Check: should list the columns above.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'model_development_submissions' order by ordinal_position;

-- If an old check rule on "status" blocks 'withdrawn', this shows it (empty result = no such rule).
select conname, pg_get_constraintdef(oid) as rule from pg_constraint
where conrelid = 'public.model_development_submissions'::regclass and contype = 'c';
