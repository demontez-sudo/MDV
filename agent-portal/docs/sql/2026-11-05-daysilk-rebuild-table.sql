-- DaySilk (The Rebuild) inside the portal: its one table. Run once in the MAISON DE VEUX Supabase project (SQL Editor).
-- Safe to run again. Each person can only read and change their own rows. Nothing to edit.
-- After this, open the portal's DaySilk page: your schedule, models, trips and body plan are built in and save to your account.

-- The Rebuild: one row per saved document per user.
--   doc_id 'core'         everything that isn't tied to a day (tasks, calendar events, models, pipelines, trips, body log...)
--   doc_id 'dYYYY-MM-DD'  that day's checks, counters, notes and completed blocks
create table if not exists public.rebuild_docs (
  user_id    uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  doc_id     text        not null check (doc_id = 'core' or doc_id ~ '^d\d{4}-\d{2}-\d{2}$'),
  data       jsonb       not null default '{}'::jsonb,
  client_id  text,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_id),
  constraint rebuild_docs_size check (pg_column_size(data) < 2000000)
);

create or replace function public.rebuild_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rebuild_docs_touch on public.rebuild_docs;
create trigger rebuild_docs_touch before insert or update on public.rebuild_docs
  for each row execute function public.rebuild_touch_updated_at();

-- Row-level security: every person can only ever see and change their own rows.
alter table public.rebuild_docs enable row level security;
alter table public.rebuild_docs force row level security;

drop policy if exists "read own docs"   on public.rebuild_docs;
drop policy if exists "insert own docs" on public.rebuild_docs;
drop policy if exists "update own docs" on public.rebuild_docs;
drop policy if exists "delete own docs" on public.rebuild_docs;
create policy "read own docs"   on public.rebuild_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own docs" on public.rebuild_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own docs" on public.rebuild_docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own docs" on public.rebuild_docs for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.rebuild_docs from anon;
grant select, insert, update, delete on public.rebuild_docs to authenticated;

-- Live sync between your phone and laptop.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rebuild_docs') then
    alter publication supabase_realtime add table public.rebuild_docs;
  end if;
end $$;
