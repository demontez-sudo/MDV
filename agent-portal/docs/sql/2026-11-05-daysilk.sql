-- DaySilk inside the Maison de Veux portal. Run once in the Supabase SQL editor of the Maison de Veux project.
-- Each person's DaySilk lives in their own rows (daysilk_docs). The company team board is shared by team members (ds_team_items).
-- Safe to run again.

create table if not exists public.daysilk_docs (
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_id text not null,
  data jsonb not null default '{}'::jsonb,
  client_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_id)
);

create table if not exists public.ds_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid unique references public.organizations(id) on delete cascade,
  name text not null,
  code text not null unique,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ds_members (
  team_id uuid not null references public.ds_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  name text,
  email text,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.ds_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'personal',
  status text not null default 'trial',
  trial_ends timestamptz,
  team_id uuid references public.ds_teams(id) on delete set null,
  first_name text,
  last_name text,
  onboarded boolean not null default false,
  stripe_customer text,
  seats int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ds_team_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.ds_teams(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ds_team_items_team_idx on public.ds_team_items (team_id, created_at desc);

create or replace function public.ds_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_ds_docs_touch on public.daysilk_docs;
create trigger trg_ds_docs_touch before update on public.daysilk_docs for each row execute function public.ds_touch();
drop trigger if exists trg_ds_items_touch on public.ds_team_items;
create trigger trg_ds_items_touch before update on public.ds_team_items for each row execute function public.ds_touch();
drop trigger if exists trg_ds_accounts_touch on public.ds_accounts;
create trigger trg_ds_accounts_touch before update on public.ds_accounts for each row execute function public.ds_touch();

-- who is on which team (security definer so the policies do not recurse)
create or replace function public.ds_in_team(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ds_members m where m.team_id = t and m.user_id = (select auth.uid()));
$$;
create or replace function public.ds_team_admin(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ds_members m where m.team_id = t and m.user_id = (select auth.uid()) and m.role in ('owner','admin'));
$$;

alter table public.daysilk_docs enable row level security;
alter table public.ds_teams enable row level security;
alter table public.ds_members enable row level security;
alter table public.ds_accounts enable row level security;
alter table public.ds_team_items enable row level security;

drop policy if exists ds_docs_own on public.daysilk_docs;
create policy ds_docs_own on public.daysilk_docs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists ds_accounts_own on public.ds_accounts;
create policy ds_accounts_own on public.ds_accounts for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists ds_teams_member on public.ds_teams;
create policy ds_teams_member on public.ds_teams for select to authenticated using (public.ds_in_team(id));

drop policy if exists ds_members_read on public.ds_members;
create policy ds_members_read on public.ds_members for select to authenticated using (public.ds_in_team(team_id));
drop policy if exists ds_members_admin_write on public.ds_members;
create policy ds_members_admin_write on public.ds_members for update to authenticated using (public.ds_team_admin(team_id)) with check (public.ds_team_admin(team_id));
drop policy if exists ds_members_admin_delete on public.ds_members;
create policy ds_members_admin_delete on public.ds_members for delete to authenticated using (public.ds_team_admin(team_id));

drop policy if exists ds_items_all on public.ds_team_items;
create policy ds_items_all on public.ds_team_items for all to authenticated using (public.ds_in_team(team_id)) with check (public.ds_in_team(team_id));

revoke all on public.daysilk_docs, public.ds_teams, public.ds_members, public.ds_accounts, public.ds_team_items from anon;
grant select, insert, update, delete on public.daysilk_docs, public.ds_team_items to authenticated;
grant select on public.ds_teams, public.ds_accounts to authenticated;
grant select, update, delete on public.ds_members to authenticated;

-- the calls DaySilk makes. Team access here comes from the portal, so plan changes and codes are kept simple.
create or replace function public.ds_choose_plan(p_plan text) returns public.ds_accounts language plpgsql security definer set search_path = '' as $$
declare r public.ds_accounts; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Sign in first'; end if;
  insert into public.ds_accounts (user_id, plan, status) values (uid, p_plan, 'active')
  on conflict (user_id) do update set plan = case when public.ds_accounts.status = 'member' then public.ds_accounts.plan else excluded.plan end
  returning * into r;
  return r;
end; $$;

create or replace function public.ds_redeem_code(p_code text) returns public.ds_accounts language plpgsql security definer set search_path = '' as $$
declare r public.ds_accounts;
begin
  select * into r from public.ds_accounts where user_id = (select auth.uid());
  return r;
end; $$;

create or replace function public.ds_set_profile(p_name text default null, p_onboarded boolean default null) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); f text; l text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  f := split_part(coalesce(p_name, ''), ' ', 1); l := nullif(btrim(substr(coalesce(p_name, ''), length(split_part(coalesce(p_name, ''), ' ', 1)) + 1)), '');
  update public.ds_accounts set
    first_name = coalesce(nullif(f, ''), first_name), last_name = coalesce(l, last_name), onboarded = coalesce(p_onboarded, onboarded)
  where user_id = uid;
  if p_name is not null then update public.ds_members set name = p_name where user_id = uid; end if;
end; $$;

create or replace function public.ds_create_team(p_name text, p_my_name text default '') returns public.ds_teams language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); t public.ds_teams; c text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into public.ds_teams (name, code, owner_id) values (p_name, c, uid) returning * into t;
  insert into public.ds_members (team_id, user_id, role, name, email) values (t.id, uid, 'owner', nullif(p_my_name, ''), (select email from auth.users where id = uid));
  update public.ds_accounts set team_id = t.id where user_id = uid;
  return t;
end; $$;

create or replace function public.ds_join_team(p_code text, p_my_name text default '') returns public.ds_teams language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); t public.ds_teams;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into t from public.ds_teams where upper(code) = upper(btrim(p_code));
  if not found then raise exception 'That team code was not found'; end if;
  insert into public.ds_members (team_id, user_id, role, name, email) values (t.id, uid, 'member', nullif(p_my_name, ''), (select email from auth.users where id = uid))
  on conflict (team_id, user_id) do nothing;
  update public.ds_accounts set team_id = t.id, plan = 'member', status = 'member' where user_id = uid;
  return t;
end; $$;

create or replace function public.ds_leave_team(p_team uuid) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if exists (select 1 from public.ds_members where team_id = p_team and user_id = uid and role = 'owner') then
    raise exception 'The owner cannot leave the team';
  end if;
  delete from public.ds_members where team_id = p_team and user_id = uid;
  update public.ds_accounts set team_id = null where user_id = uid and team_id = p_team;
end; $$;

create or replace function public.ds_rotate_code(p_team uuid) returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not public.ds_team_admin(p_team) then raise exception 'Only an owner or admin can change the team code'; end if;
  c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update public.ds_teams set code = c where id = p_team;
  return c;
end; $$;

revoke all on function public.ds_choose_plan(text), public.ds_redeem_code(text), public.ds_set_profile(text, boolean), public.ds_create_team(text, text), public.ds_join_team(text, text), public.ds_leave_team(uuid), public.ds_rotate_code(uuid) from public, anon;
grant execute on function public.ds_choose_plan(text), public.ds_redeem_code(text), public.ds_set_profile(text, boolean), public.ds_create_team(text, text), public.ds_join_team(text, text), public.ds_leave_team(uuid), public.ds_rotate_code(uuid) to authenticated;

-- live updates between a person's open devices and across the team board
do $$ begin
  begin alter publication supabase_realtime add table public.daysilk_docs; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.ds_team_items; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
