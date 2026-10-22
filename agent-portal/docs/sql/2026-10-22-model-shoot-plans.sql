-- Shoot plans for a model: the shoot treatment (brief, each shoot with its shot list, run of day, book order, prep).
-- Shown in Model 360 > Development > Shoot plan. Staff only. Safe to run more than once. Run in the Supabase SQL editor.

create table if not exists public.model_shoot_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  title text not null,
  status text not null default 'active',
  source_name text,
  plan jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Locked down: only the server (service role) reads or writes this table. No policies on purpose.
alter table public.model_shoot_plans enable row level security;
revoke all on public.model_shoot_plans from anon, authenticated;

create index if not exists model_shoot_plans_model_idx on public.model_shoot_plans (organization_id, model_id, updated_at desc);
