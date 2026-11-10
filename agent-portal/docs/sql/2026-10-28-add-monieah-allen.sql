-- Add Monieah Allen (Personal Assistant to Demontez) as staff on the Maison de Veux agent portal.
-- Run in the Supabase SQL editor.
--
-- FIRST create her login: Supabase Dashboard -> Authentication -> Users -> Add user -> "Send invitation"
-- (or Create new user) with email monieah@casadeveux.com. The portal has no screen that creates logins,
-- and this script needs the login to exist.
--
-- STEP 1: see which roles exist, then set the role key in STEP 2 (change 'staff' if she should have another).
select key, name from public.roles where organization_id is null or organization_id = (select id from public.organizations where slug='maison-de-veux') order by name;

-- STEP 2: add her.
do $$
declare
  org uuid; uid uuid; mid uuid; rid uuid;
  role_key text := 'assistant';   -- Assistant / Coordinator
begin
  select id into org from public.organizations where slug = 'maison-de-veux';
  select id into uid from auth.users where lower(btrim(email)) = 'monieah@casadeveux.com';
  if org is null then raise exception 'Organization maison-de-veux not found'; end if;
  if uid is null then raise exception 'Create the login for monieah@casadeveux.com first (Authentication -> Users)'; end if;

  insert into public.profiles (user_id, display_name, first_name, last_name)
  values (uid, 'Monieah Allen', 'Monieah', 'Allen')
  on conflict (user_id) do update set display_name = excluded.display_name, first_name = excluded.first_name, last_name = excluded.last_name;

  select id into mid from public.organization_members where organization_id = org and user_id = uid and member_type = 'staff';
  if mid is null then
    insert into public.organization_members (organization_id, user_id, member_type, status, job_title)
    values (org, uid, 'staff', 'invited', 'Personal Assistant to Demontez Culbreath')
    returning id into mid;
  else
    update public.organization_members set status = 'active', job_title = 'Personal Assistant to Demontez Culbreath' where id = mid;
  end if;

  select id into rid from public.roles where key = role_key and (organization_id is null or organization_id = org) order by organization_id nulls last limit 1;
  if rid is null then raise exception 'Role % not found; pick one from STEP 1', role_key; end if;
  insert into public.member_roles (member_id, role_id) values (mid, rid) on conflict do nothing;
end $$;

-- STEP 3: confirm.
select m.id, m.status, m.job_title, p.display_name, r.key as role
from public.organization_members m
left join public.profiles p on p.user_id = m.user_id
left join public.member_roles mr on mr.member_id = m.id
left join public.roles r on r.id = mr.role_id
where m.user_id = (select id from auth.users where lower(btrim(email)) = 'monieah@casadeveux.com');
