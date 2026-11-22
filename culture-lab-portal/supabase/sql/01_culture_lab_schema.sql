-- Culture Lab Casting database.
-- Run once on a new, empty Supabase project. Every kind of record has its own table in the culture_lab schema.
-- The full record is kept in `data`; the columns beside it are filled in automatically from that record
-- so they can be searched, sorted, joined and reported on. Browsers never read these tables directly:
-- only the culture-lab-api function can, after it has checked who is signed in and what their role allows.

create schema if not exists culture_lab;

-- Reads an ISO date safely for the generated columns. Anything that is not a date becomes empty.
create or replace function culture_lab.ts(t text) returns timestamptz
language plpgsql immutable parallel safe as $$
begin
  if t is null or t = '' then return null; end if;
  return t::timestamptz;
exception when others then return null;
end $$;

create or replace function culture_lab.flag(t text) returns boolean
language sql immutable parallel safe as $$ select case lower(coalesce(t, '')) when 'true' then true when 'false' then false else null end $$;

-- Portal-wide configuration: roles and permissions, automations, numbering, pitch availability and integrations.
create table culture_lab.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table culture_lab.staff (
  id         text primary key,
  data       jsonb not null,
  name       text generated always as (data->>'name') stored,
  email      text generated always as (lower(data->>'email')) stored,
  role       text generated always as (data->>'role') stored,
  team_id    text generated always as (nullif(data->>'teamId', '')) stored,
  active     boolean generated always as (culture_lab.flag(data->>'active')) stored,
  mfa        boolean generated always as (culture_lab.flag(data->>'mfa')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index staff_email_key on culture_lab.staff (email) where email is not null and email <> '';

create table culture_lab.productions (
  id         text primary key,
  data       jsonb not null,
  title      text generated always as (data->>'title') stored,
  code       text generated always as (data->>'code') stored,
  format     text generated always as (data->>'format') stored,
  status     text generated always as (data->>'status') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table culture_lab.teams (
  id            text primary key,
  data          jsonb not null,
  name          text generated always as (data->>'name') stored,
  production_id text generated always as (nullif(data->>'prodId', '')) stored
                references culture_lab.productions (id) deferrable initially deferred,
  season_id     text generated always as (data->>'seasonId') stored,
  producer_id   text generated always as (nullif(data->>'producerId', '')) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table culture_lab.people (
  id           text primary key,
  data         jsonb not null,
  name         text generated always as (data->>'name') stored,
  email        text generated always as (lower(nullif(data->>'email', ''))) stored,
  phone        text generated always as (nullif(data->>'phone', '')) stored,
  city         text generated always as (nullif(data->>'city', '')) stored,
  retain_until timestamptz generated always as (culture_lab.ts(data->>'retainUntil')) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table culture_lab.leads (
  id            text primary key,
  data          jsonb not null,
  person_id     text generated always as (nullif(data->>'personId', '')) stored
                references culture_lab.people (id) deferrable initially deferred,
  production_id text generated always as (nullif(data->>'prodId', '')) stored
                references culture_lab.productions (id) deferrable initially deferred,
  status        text generated always as (data->>'status') stored,
  source        text generated always as (data->>'source') stored,
  assignee_id   text generated always as (nullif(data->>'assignee', '')) stored,
  story_id      text generated always as (nullif(data->>'storyId', '')) stored,
  submitted_at  timestamptz generated always as (culture_lab.ts(data->>'submitted')) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table culture_lab.stories (
  id               text primary key,
  data             jsonb not null,
  title            text generated always as (data->>'title') stored,
  production_id    text generated always as (nullif(data->>'prodId', '')) stored
                   references culture_lab.productions (id) deferrable initially deferred,
  season_id        text generated always as (data->>'seasonId') stored,
  team_id          text generated always as (nullif(data->>'teamId', '')) stored,
  delivery_no      text generated always as (data->>'delivery') stored,
  stage            text generated always as (data->>'stage') stored,
  disposition      text generated always as (data->>'disposition') stored,
  producer_id      text generated always as (nullif(data->>'producerId', '')) stored,
  editor_id        text generated always as (nullif(data->>'editorId', '')) stored,
  network_decision text generated always as (data#>>'{network,decision}') stored,
  last_activity_at timestamptz generated always as (culture_lab.ts(data->>'updated')) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table culture_lab.events (
  id            text primary key,
  data          jsonb not null,
  type          text generated always as (data->>'type') stored,
  title         text generated always as (data->>'title') stored,
  story_id      text generated always as (nullif(data->>'storyId', '')) stored,
  production_id text generated always as (nullif(data->>'prodId', '')) stored,
  status        text generated always as (data->>'status') stored,
  starts_at     timestamptz generated always as (culture_lab.ts(data->>'start')) stored,
  ends_at       timestamptz generated always as (culture_lab.ts(data->>'end')) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table culture_lab.tasks (
  id          text primary key,
  data        jsonb not null,
  title       text generated always as (data->>'title') stored,
  assignee_id text generated always as (nullif(data->>'assignee', '')) stored,
  story_id    text generated always as (nullif(data->>'storyId', '')) stored,
  status      text generated always as (data->>'status') stored,
  due_at      timestamptz generated always as (culture_lab.ts(data->>'due')) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table culture_lab.notes (
  id         text primary key,
  data       jsonb not null,
  author_id  text generated always as (data->>'by') stored,
  kind       text generated always as (data->>'kind') stored,
  written_at timestamptz generated always as (culture_lab.ts(data->>'at')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table culture_lab.notifications (
  id           text primary key,
  data         jsonb not null,
  recipient_id text generated always as (data->>'to') stored,
  is_read      boolean generated always as (coalesce(culture_lab.flag(data->>'read'), false)) stored,
  sent_at      timestamptz generated always as (culture_lab.ts(data->>'at')) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table culture_lab.activity (
  id          text primary key,
  data        jsonb not null,
  actor_id    text generated always as (data->>'by') stored,
  action      text generated always as (data->>'action') stored,
  target      text generated always as (data->>'target') stored,
  happened_at timestamptz generated always as (culture_lab.ts(data->>'at')) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table culture_lab.automation_runs (
  id         text primary key,
  data       jsonb not null,
  trigger    text generated always as (data->>'trigger') stored,
  action     text generated always as (data->>'action') stored,
  succeeded  boolean generated always as (culture_lab.flag(data->>'ok')) stored,
  ran_at     timestamptz generated always as (culture_lab.ts(data->>'at')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table culture_lab.deliveries (
  id            text primary key,
  data          jsonb not null,
  name          text generated always as (data->>'name') stored,
  production_id text generated always as (nullif(data->>'prodId', '')) stored
                references culture_lab.productions (id) deferrable initially deferred,
  season_id     text generated always as (data->>'seasonId') stored,
  status        text generated always as (data->>'status') stored,
  due_at        timestamptz generated always as (culture_lab.ts(data->>'due')) stored,
  sent_at       timestamptz generated always as (culture_lab.ts(data->>'sentAt')) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Every saved change: who made it, which action, and how many records it touched.
create table culture_lab.change_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text,
  command text not null,
  changed integer not null default 0
);

create index teams_production_idx      on culture_lab.teams (production_id);
create index leads_person_idx          on culture_lab.leads (person_id);
create index leads_production_idx      on culture_lab.leads (production_id, status);
create index leads_assignee_idx        on culture_lab.leads (assignee_id, status);
create index people_email_idx          on culture_lab.people (email);
create index stories_production_idx    on culture_lab.stories (production_id, season_id, stage);
create index stories_team_idx          on culture_lab.stories (team_id);
create index stories_producer_idx      on culture_lab.stories (producer_id);
create index stories_editor_idx        on culture_lab.stories (editor_id);
create index events_time_idx           on culture_lab.events (starts_at);
create index events_story_idx          on culture_lab.events (story_id);
create index tasks_assignee_idx        on culture_lab.tasks (assignee_id, status, due_at);
create index tasks_story_idx           on culture_lab.tasks (story_id);
create index notifications_inbox_idx   on culture_lab.notifications (recipient_id, is_read);
create index activity_time_idx         on culture_lab.activity (happened_at desc);
create index deliveries_production_idx on culture_lab.deliveries (production_id, status);
create index change_log_time_idx       on culture_lab.change_log (at desc);

-- Ready-made reports for the owner and for exports.
create view culture_lab.story_board with (security_invoker = true) as
select s.id, s.title, p.title as production, s.season_id as season, t.name as team, s.delivery_no as delivery,
       s.stage, s.disposition, pr.name as producer, ed.name as editor, s.network_decision, s.last_activity_at
from culture_lab.stories s
left join culture_lab.productions p on p.id = s.production_id
left join culture_lab.teams t on t.id = s.team_id
left join culture_lab.staff pr on pr.id = s.producer_id
left join culture_lab.staff ed on ed.id = s.editor_id;

create view culture_lab.lead_pipeline with (security_invoker = true) as
select l.id, pe.name, pe.city, p.title as production, l.status, l.source, a.name as assigned_to, l.submitted_at, l.story_id
from culture_lab.leads l
left join culture_lab.people pe on pe.id = l.person_id
left join culture_lab.productions p on p.id = l.production_id
left join culture_lab.staff a on a.id = l.assignee_id;

-- Lock the schema: nothing is reachable from the public API or with the anon key.
do $$
declare t text;
begin
  foreach t in array array['settings','staff','productions','teams','people','leads','stories','events','tasks','notes','notifications','activity','automation_runs','deliveries','change_log'] loop
    execute format('alter table culture_lab.%I enable row level security', t);
  end loop;
end $$;
revoke all on schema culture_lab from public;
revoke all on all tables in schema culture_lab from public;
revoke all on all functions in schema culture_lab from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema culture_lab from anon'; execute 'revoke all on all tables in schema culture_lab from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema culture_lab from authenticated'; execute 'revoke all on all tables in schema culture_lab from authenticated'; end if;
end $$;
